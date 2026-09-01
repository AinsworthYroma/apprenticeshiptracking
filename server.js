const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TARGET_CITY = 'Paris';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const LINKEDIN_MAX_PAGES = Math.max(1, parseInt(process.env.LINKEDIN_MAX_PAGES || '180', 10));
const LINKEDIN_BATCH_SIZE = Math.max(1, parseInt(process.env.LINKEDIN_BATCH_SIZE || '8', 10));
const LINKEDIN_DESCRIPTION_FETCH_MAX = Math.max(
  0,
  parseInt(process.env.LINKEDIN_DESCRIPTION_FETCH_MAX || '80', 10)
);

// Secteurs cibles (finance/conseil/banque) pour mieux capter les offres bac+5.
const SECTOR_KEYWORDS = [
  { fr: 'finance', en: 'finance' },
  { fr: 'conseil en stratégie', en: 'strategy consulting' },
  { fr: 'conseil en management', en: 'management consulting' },
  { fr: 'banque', en: 'banking' },
  { fr: 'financement', en: 'financing' },
  { fr: 'fund finance', en: 'fund finance' },
  { fr: "fonds d'investissement", en: 'investment fund' },
  { fr: 'private equity', en: 'private equity' },
  { fr: "gestion d'actifs", en: 'asset management' },
  { fr: "banque d'investissement", en: 'investment banking' },
  { fr: 'fusions acquisitions', en: 'mergers and acquisitions' },
  { fr: 'corporate finance', en: 'corporate finance' },
  { fr: 'grand groupe', en: 'multinational corporation' },
];
const SECTOR_MATCH_REGEX = new RegExp(
  SECTOR_KEYWORDS.flatMap(({ fr, en }) => [fr, en])
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'i'
);

// Certains intitules de metiers hors-secteur (sante, etc.) matchent quand meme
// SECTOR_MATCH_REGEX quand la description mentionne juste "grand groupe" ou
// "banque" en passant (ex: "Infirmier(e)... Siege social grand groupe"). On
// exclut ces intitules connus meme s'ils matchent par ailleurs un mot-cle secteur.
const SECTOR_EXCLUDE_REGEX =
  /\b(infirmier|infirmi[eè]re|aide[- ]soignant|kin[ée]sith[ée]rapeute|m[ée]decin|pharmacien|sage[- ]femme|[ée]ducateur sp[ée]cialis[ée])\b/i;

// Termes utilises pour multiplier les recherches sur Jobijoba/Talent.com (qui
// n'ont pas d'API par mots-cles multiples comme LinkedIn) : une requete generique
// ("CDI Paris") remonte tres peu d'offres finance une fois SECTOR_MATCH_REGEX
// applique, donc on interroge chaque terme sectoriel separement.
const SCRAPE_QUERY_TERMS = Array.from(
  new Set(['finance', 'banque', 'conseil', ...SECTOR_KEYWORDS.map(({ fr }) => fr)])
);

// Identifiant stable base sur l'URL (ou a defaut titre/entreprise/lieu) : les
// offres doivent garder le meme id d'un scraping a l'autre, sinon le suivi ne
// reconnait plus une offre deja ajoutee (elle redevient "+ Ajouter au suivi").
function stableOfferId(source, url, title, company, location) {
  const identity = url
    ? url.toLowerCase()
    : normalizeText(`${source}|${title}|${company}|${location}`).toLowerCase();
  const hash = crypto.createHash('sha1').update(identity).digest('hex').slice(0, 16);
  const sourceSlug = normalizeText(source).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${sourceSlug}-${hash}`;
}

// Jobijoba encode ses liens d'offres en ROT13 (avec "=cg=" a la place des points
// pour brouiller le domaine) dans l'attribut data-atc, plutot qu'un <a href> classique.
function decodeJobijobaLink(atc) {
  if (!atc) return '';
  const rot13 = atc.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
  return rot13.replace(/=cg=/g, '.');
}

const DEFAULT_CELEXTIME_ADMIN_PASSWORD = 'Celextime1';
const CELEXTIME_ADMIN_PASSWORD = normalizeText(
  process.env.CELEXTIME_ADMIN_PASSWORD || DEFAULT_CELEXTIME_ADMIN_PASSWORD
);

const DEFAULT_COPINE_PASSWORD = 'Celest1';
const COPINE_PASSWORD = normalizeText(
  process.env.COPINE_PASSWORD || DEFAULT_COPINE_PASSWORD
);

if (process.env.NODE_ENV === 'production' && !normalizeText(process.env.CELEXTIME_ADMIN_PASSWORD || '')) {
  console.warn('Warning: CELEXTIME_ADMIN_PASSWORD non defini, mot de passe par defaut utilise en production.');
}
if (process.env.NODE_ENV === 'production' && !normalizeText(process.env.COPINE_PASSWORD || '')) {
  console.warn('Warning: COPINE_PASSWORD non defini, mot de passe par defaut utilise en production.');
}

// ---------------------------------------------------------------------------
// Cache serveur en mémoire
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 heures par défaut

const offersCache = new Map();
// Store persistant : conserve toutes les offres déjà vues, par cacheKey
const persistentOffersStore = new Map();

// ---------------------------------------------------------------------------
// Persistance disque du cache : le cache vivait uniquement en mémoire, donc
// il disparaissait a chaque redemarrage du serveur et n'existait que pour le
// process en cours. En l'ecrivant sur disque dans le codespace, tous les
// appareils qui tapent sur le port forwarde du codespace voient les memes
// offres deja recuperees, et un redemarrage ne force pas un re-scraping complet.
const CACHE_DATA_DIR = path.join(__dirname, 'data');
const CACHE_FILE_PATH = path.join(CACHE_DATA_DIR, 'jobs-cache.json');

function loadCacheFromDisk() {
  try {
    const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    (parsed.offersCache || []).forEach(([key, value]) => offersCache.set(key, value));
    (parsed.persistentOffersStore || []).forEach(([key, value]) => persistentOffersStore.set(key, value));
    console.log(
      `Cache charge depuis le disque: ${offersCache.size} entrees TTL, ${persistentOffersStore.size} entrees persistantes.`
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Impossible de charger le cache disque (${CACHE_FILE_PATH}): ${error.message}`);
    }
  }
}

function persistCacheToDisk() {
  try {
    fs.mkdirSync(CACHE_DATA_DIR, { recursive: true });
    const payload = {
      offersCache: Array.from(offersCache.entries()),
      persistentOffersStore: Array.from(persistentOffersStore.entries()),
    };
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(payload));
  } catch (error) {
    console.warn(`Impossible d'ecrire le cache disque (${CACHE_FILE_PATH}): ${error.message}`);
  }
}

loadCacheFromDisk();

const KNOWN_PROFILES = new Set(['admin', 'copine']);

function buildCacheKey(profile, city, start) {
  return `${normalizeText(profile || 'admin').toLowerCase()}|${normalizeText(city)}|${normalizeText(start)}`;
}

function parseProfileFromCacheKey(cacheKey) {
  const firstPart = String(cacheKey || '').split('|')[0] || 'admin';
  const normalized = normalizeText(firstPart).toLowerCase();
  return normalized || 'admin';
}

function normalizeCacheType(rawType) {
  const normalized = normalizeText(rawType).toLowerCase();
  if (normalized === 'ttl' || normalized === 'runtime') {
    return 'ttl';
  }
  if (normalized === 'persistent') {
    return 'persistent';
  }
  if (normalized === 'all') {
    return 'all';
  }
  return '';
}

function validateCelextimePassword(payload = {}) {
  const password = normalizeText(payload.password || '');
  const passwordConfirm = normalizeText(payload.passwordConfirm || '');

  if (!password || !passwordConfirm) {
    return { ok: false, error: 'Mot de passe Celextime requis (double validation).' };
  }
  if (password !== passwordConfirm) {
    return { ok: false, error: 'Les deux mots de passe ne correspondent pas.' };
  }
  if (password !== CELEXTIME_ADMIN_PASSWORD) {
    return { ok: false, error: 'Mot de passe Celextime invalide.' };
  }

  return { ok: true };
}

function shouldRequireCelextimePassword(scope, targetAccount) {
  if (scope === 'all') {
    return true;
  }
  return normalizeText(targetAccount).toLowerCase() === 'copine';
}

function clearCachesForAccount(account, cacheType) {
  const normalizedAccount = normalizeText(account).toLowerCase();
  const normalizedType = normalizeCacheType(cacheType);
  let cacheEntriesCleared = 0;
  let persistentEntriesCleared = 0;

  if (normalizedType === 'ttl' || normalizedType === 'all') {
    for (const key of offersCache.keys()) {
      if (parseProfileFromCacheKey(key) !== normalizedAccount) {
        continue;
      }
      offersCache.delete(key);
      cacheEntriesCleared += 1;
    }
  }

  if (normalizedType === 'persistent' || normalizedType === 'all') {
    for (const key of persistentOffersStore.keys()) {
      if (parseProfileFromCacheKey(key) !== normalizedAccount) {
        continue;
      }
      persistentOffersStore.delete(key);
      persistentEntriesCleared += 1;
    }
  }

  persistCacheToDisk();
  return { cacheEntriesCleared, persistentEntriesCleared };
}

function clearCachesByType(cacheType) {
  const normalizedType = normalizeCacheType(cacheType);
  let cacheEntriesCleared = 0;
  let persistentEntriesCleared = 0;

  if (normalizedType === 'ttl' || normalizedType === 'all') {
    cacheEntriesCleared = offersCache.size;
    offersCache.clear();
  }

  if (normalizedType === 'persistent' || normalizedType === 'all') {
    persistentEntriesCleared = persistentOffersStore.size;
    persistentOffersStore.clear();
  }

  persistCacheToDisk();
  return { cacheEntriesCleared, persistentEntriesCleared };
}

function buildCacheInfo() {
  const byAccount = {};

  KNOWN_PROFILES.forEach((profile) => {
    byAccount[profile] = {
      cacheEntries: 0,
      persistentEntries: 0,
      offersMentioned: 0,
      unavailableMentions: 0,
    };
  });

  for (const [cacheKey, cacheEntry] of offersCache.entries()) {
    const profile = parseProfileFromCacheKey(cacheKey);
    if (!byAccount[profile]) {
      byAccount[profile] = {
        cacheEntries: 0,
        persistentEntries: 0,
        offersMentioned: 0,
        unavailableMentions: 0,
      };
    }
    byAccount[profile].cacheEntries += 1;

    const offers = Array.isArray(cacheEntry?.data?.offers) ? cacheEntry.data.offers : [];
    byAccount[profile].offersMentioned += offers.length;
    byAccount[profile].unavailableMentions += offers.filter((offer) => Boolean(offer?.unavailable)).length;
  }

  for (const [cacheKey, offers] of persistentOffersStore.entries()) {
    const profile = parseProfileFromCacheKey(cacheKey);
    if (!byAccount[profile]) {
      byAccount[profile] = {
        cacheEntries: 0,
        persistentEntries: 0,
        offersMentioned: 0,
        unavailableMentions: 0,
      };
    }

    byAccount[profile].persistentEntries += 1;
    byAccount[profile].offersMentioned += Array.isArray(offers) ? offers.length : 0;
    byAccount[profile].unavailableMentions += Array.isArray(offers)
      ? offers.filter((offer) => Boolean(offer?.unavailable)).length
      : 0;
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      cacheEntries: offersCache.size,
      persistentEntries: persistentOffersStore.size,
    },
    byAccount,
  };
}

function isCacheValid(cacheKey) {
  const cacheEntry = offersCache.get(cacheKey);
  if (!cacheEntry || !cacheEntry.fetchedAt) {
    return false;
  }
  return Date.now() - cacheEntry.fetchedAt < CACHE_TTL_MS;
}

async function httpGetWithRetries(url, config = {}, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await axios.get(url, config);
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      const retryable = status === 429 || (status >= 500 && status < 600) || !status;
      if (!retryable || attempt === retries - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractCityFromLocation(location, fallbackCity = TARGET_CITY) {
  const clean = normalizeText(location);
  if (!clean) {
    return fallbackCity;
  }

  const match = clean.match(/(?:^|,|-)\s*([A-Za-z\u00C0-\u017F\s']+?)\s*(?:\d{5}|$)/);
  if (match && match[1]) {
    return normalizeText(match[1]);
  }

  return clean.split(',')[0].trim() || fallbackCity;
}

function normalizeCompanySizeCategory(size) {
  const raw = normalizeText(size).toLowerCase();

  if (!raw || raw === 'inconnue') {
    return 'Inconnue';
  }
  if (/1\s*-\s*9|moins de 10|tpe|micro/.test(raw)) {
    return 'TPE (1-9)';
  }
  if (/10\s*-\s*49|11\s*-\s*49|pme/.test(raw)) {
    return 'PME (10-49)';
  }
  if (/50\s*-\s*249|250\s*-\s*499|et[iy]|mid|moyenne/.test(raw)) {
    return 'ETI (50-499)';
  }
  if (/500|grande|ge|1000|\+/.test(raw)) {
    return 'Grande entreprise (500+)';
  }

  return 'Inconnue';
}

function normalizeStudyLevelCategory(level, contextText = '') {
  const raw = normalizeText(level).toLowerCase();
  const context = normalizeText(contextText).toLowerCase();
  const text = `${raw} ${context}`.trim();

  if (!text) {
    return 'Non precise';
  }

  if (/cap|bep|niveau\s*3|niveau\s*iv|sans\s*diplome/.test(text)) {
    return 'CAP/BEP';
  }
  if (/bac\s*pro|bac\s*techno|bac\b|niveau\s*4\b/.test(text)) {
    return 'Bac';
  }
  if (/bac\s*\+?\s*1|bac\s*\+?\s*2|bts|dut|deust|niveau\s*5\b/.test(text)) {
    return 'Bac+1/2';
  }
  if (/bac\s*\+?\s*3|bac\s*\+?\s*4|licence|bachelor|but\b|master\s*1|niveau\s*6\b/.test(text)) {
    return 'Bac+3/4';
  }
  if (/bac\s*\+?\s*5|master\s*2|ingenieur|ecole\s*de\s*commerce|mba|niveau\s*7\b|doctorat|phd/.test(text)) {
    return 'Bac+5 et plus';
  }

  return 'Non precise';
}

function buildOffer(partial) {
  const location = normalizeText(partial.location);
  const city = normalizeText(partial.city || extractCityFromLocation(location));
  const companySizeCategory = normalizeCompanySizeCategory(partial.companySize);
  const normalizedDescription = normalizeText(partial.description || '');
  const studyLevelCategory = normalizeStudyLevelCategory(
    partial.studyLevel,
    `${partial.title || ''} ${normalizedDescription}`
  );

  return {
    id: partial.id,
    title: normalizeText(partial.title),
    company: normalizeText(partial.company),
    companySize: normalizeText(partial.companySize || 'Inconnue'),
    companySizeCategory,
    studyLevel: normalizeText(partial.studyLevel || 'Non precise'),
    studyLevelCategory,
    city,
    location,
    latitude:
      typeof partial.latitude === 'number' && Number.isFinite(partial.latitude)
        ? partial.latitude
        : null,
    longitude:
      typeof partial.longitude === 'number' && Number.isFinite(partial.longitude)
        ? partial.longitude
        : null,
    url: partial.url,
    linkMode: partial.linkMode || (isLikelyDeadUrl(partial.url) ? 'fallback' : 'direct'),
    source: partial.source,
    description: normalizedDescription,
    postedAt: partial.postedAt || null,
    contractType: partial.contractType || 'Non précisé',
    cityMatch: /paris/i.test(`${location} ${city}`),
  };
}

function buildSourceSearchUrl({ source, title, company, city }) {
  const q = encodeURIComponent(`${title || ''} ${company || ''} ${city || ''}`.trim());

  if ((source || '').includes('Jobijoba')) {
    return `https://www.jobijoba.com/fr/emploi/${encodeURIComponent(`${title || 'Emploi'} ${city || 'Paris'}`)}`;
  }
  if ((source || '').includes('LinkedIn')) {
    return `https://www.linkedin.com/jobs/search/?keywords=${q}`;
  }
  if ((source || '').includes('Talent.com')) {
    return `https://www.talent.com/fr/jobs?k=${q}`;
  }
  return `https://www.google.com/search?q=${q}`;
}

function isLikelyDeadUrl(url) {
  if (!url || typeof url !== 'string') {
    return true;
  }
  if (!/^https?:\/\//i.test(url)) {
    return true;
  }

  if (/example\.com/i.test(url)) {
    return true;
  }

  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch (error) {
    return true;
  }

  return false;
}

function extractLinkedInJobId(url) {
  const clean = (url || '').split('?')[0];
  const match = clean.match(/(\d{6,})\/?$/);
  return match ? match[1] : null;
}

async function fetchLinkedInDescription(url) {
  const jobId = extractLinkedInJobId(url);
  if (!jobId) {
    return '';
  }
  try {
    const response = await httpGetWithRetries(
      `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`,
      { headers: { 'User-Agent': USER_AGENT }, timeout: 15000 },
      2
    );
    const $ = cheerio.load(response.data || '');
    return normalizeText($('.description__text').text());
  } catch (error) {
    return '';
  }
}

async function scrapeLinkedIn(city) {
  // LinkedIn guest API avec plans multiples pour maximiser le volume utile.
  const primaryOffsets = Array.from({ length: LINKEDIN_MAX_PAGES }, (_, i) => i * 25);
  const tertiaryOffsets = Array.from(
    { length: Math.min(35, LINKEDIN_MAX_PAGES) },
    (_, i) => i * 25
  );
  const cityText = normalizeText(city || TARGET_CITY) || TARGET_CITY;
  const regionHint = /paris/i.test(cityText) ? 'Ile-de-France' : 'France';
  const broaderLocation = /paris/i.test(cityText) ? 'Ile-de-France, France' : 'France';
  const sectorPlans = SECTOR_KEYWORDS.flatMap(({ fr, en }) => [
    { keywords: `CDI ${fr}`, location: `${cityText}, ${regionHint}`, offsets: tertiaryOffsets },
    { keywords: `full-time ${en}`, location: broaderLocation, offsets: tertiaryOffsets },
  ]);
  const searchPlans = [
    { keywords: 'CDI finance', location: `${cityText}, ${regionHint}`, offsets: primaryOffsets },
    { keywords: 'CDI banque', location: `${cityText}, ${regionHint}`, offsets: primaryOffsets },
    { keywords: 'CDI conseil', location: `${cityText}, ${regionHint}`, offsets: primaryOffsets },
    ...sectorPlans,
  ];
  const rawEntries = [];
  const seenUrls = new Set();
  const allRequests = [];
  const seenRequestKeys = new Set();

  searchPlans.forEach((plan) => {
    plan.offsets.forEach((start) => {
      const requestKey = `${plan.keywords}|${plan.location}|${start}`.toLowerCase();
      if (seenRequestKeys.has(requestKey)) {
        return;
      }
      seenRequestKeys.add(requestKey);
      allRequests.push({
        start,
        keywords: plan.keywords,
        location: plan.location,
      });
    });
  });

  for (let i = 0; i < allRequests.length; i += LINKEDIN_BATCH_SIZE) {
    const batchItems = allRequests.slice(i, i + LINKEDIN_BATCH_SIZE);
    const batchRequests = [];

    batchItems.forEach((item) => {
      batchRequests.push(
        httpGetWithRetries(
          'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search',
          {
            params: { keywords: item.keywords, location: item.location, start: item.start },
            headers: { 'User-Agent': USER_AGENT },
            timeout: 20000,
          },
          4
        ).then((response) => ({ response, item }))
      );
    });

    const settled = await Promise.allSettled(batchRequests);
    settled.forEach((result) => {
      if (result.status !== 'fulfilled') {
        return;
      }
      const { response, item } = result.value;
      const $ = cheerio.load(response.data);
      $('.job-search-card').each((index, node) => {
        const title = normalizeText($('.base-search-card__title', node).text());
        const company = normalizeText($('.base-search-card__subtitle', node).text());
        const location = normalizeText($('.job-search-card__location', node).text());
        const href = $('a.base-card__full-link', node).attr('href') || '';
        const url = href.split('?')[0];
        if (title && url && !seenUrls.has(url)) {
          seenUrls.add(url);
          rawEntries.push({
            id: stableOfferId('linkedin', url, title, company, location),
            title,
            company,
            location,
            city: extractCityFromLocation(location, cityText),
            url,
            source: 'LinkedIn',
          });
        }
      });
    });

    // Petite pause entre lots pour limiter les 429 côté LinkedIn.
    await sleep(140);
  }

  // Pour les offres finance/conseil/banque, on va chercher la description complete
  // sur la page de l'offre (les cartes de recherche ne donnent que titre/entreprise/lieu),
  // ce qui permet a normalizeStudyLevelCategory de bien détecter les postes bac+5.
  const sectorMatches = rawEntries.filter((entry) =>
    SECTOR_MATCH_REGEX.test(`${entry.title} ${entry.company}`)
  );
  const toFetch = sectorMatches.slice(0, LINKEDIN_DESCRIPTION_FETCH_MAX);

  for (let i = 0; i < toFetch.length; i += LINKEDIN_BATCH_SIZE) {
    const batch = toFetch.slice(i, i + LINKEDIN_BATCH_SIZE);
    const descriptions = await Promise.allSettled(batch.map((entry) => fetchLinkedInDescription(entry.url)));
    descriptions.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        batch[index].description = result.value;
      }
    });
    await sleep(200);
  }

  return sectorMatches.map((entry) => buildOffer(entry));
}

async function scrapeTalentCom() {
  // Talent.com n'a pas de recherche multi-mots-clefs comme LinkedIn : on lance
  // une recherche par terme sectoriel (finance/banque/private equity/fonds/...)
  // sur plusieurs pages, pour avoir bien plus de volume qu'une seule requete
  // generique "CDI Paris" une fois le filtre sectoriel applique.
  const pages = [1, 2, 3];
  const allOffers = [];
  const seenUrls = new Set();

  const requests = [];
  SCRAPE_QUERY_TERMS.forEach((term) => {
    pages.forEach((page) => {
      requests.push({ term, page });
    });
  });

  await Promise.allSettled(
    requests.map(async ({ term, page }) => {
      const response = await axios.get('https://www.talent.com/fr/jobs', {
        params: { k: `CDI ${term}`, l: 'Paris', p: page },
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
        timeout: 15000,
      });
      const $ = cheerio.load(response.data);

      $('[class*="JobCard_card"]').each((index, node) => {
        const title = normalizeText($('[class*="JobCard_title"]', node).text());
        const company = normalizeText($('[class*="JobCard_company"]', node).text());
        const location = normalizeText($('[class*="JobCard_location"]', node).text());
        const href = $('a', node).first().attr('href') || '';
        const url = href.startsWith('http') ? href : href ? `https://www.talent.com${href}` : '';

        if (title && url && !seenUrls.has(url)) {
          seenUrls.add(url);
          allOffers.push(
            buildOffer({
              id: stableOfferId('talent', url, title, company, location),
              title,
              company,
              location,
              url,
              source: 'Talent.com',
            })
          );
        }
      });
    })
  );

  return allOffers;
}

async function scrapeJobijoba() {
  // Meme logique que Talent.com : une requete par terme sectoriel plutot
  // qu'une seule recherche generique "CDI Paris". Le site n'expose plus de
  // <a href> classique sur ses cartes d'offres : le lien est dans l'attribut
  // data-atc, encode en ROT13 (cf. decodeJobijobaLink).
  const allOffers = [];
  const seenUrls = new Set();

  await Promise.allSettled(
    SCRAPE_QUERY_TERMS.map(async (term) => {
      const slug = ['CDI', ...term.split(' '), 'Paris'].map(encodeURIComponent).join('+');
      const url = `https://www.jobijoba.com/fr/emploi/${slug}`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);

      $('.offer').each((index, node) => {
        const container = $(node);
        const linkNode = container.find('[data-atc]').first();
        const fullUrl = decodeJobijobaLink(linkNode.attr('data-atc'));

        let title = normalizeText(container.find('.offer-header-title').first().text());
        let company = '';
        try {
          const product = JSON.parse(linkNode.attr('data-product') || '{}');
          const item = product.ecommerce && product.ecommerce.click && product.ecommerce.click.products && product.ecommerce.click.products[0];
          if (item) {
            title = title || normalizeText(item.name || '');
            company = normalizeText(item.brand || '');
          }
        } catch (error) {
          // data-product non parsable : on garde le fallback DOM ci-dessous
        }

        if (!company) {
          company =
            normalizeText(container.find('.icon-apartment').closest('.feature').find('span').last().text()) ||
            'Entreprise non specifiee';
        }

        const location =
          normalizeText(container.find('.icon-map-marker').closest('.feature').find('span').last().text()) ||
          'Paris';

        if (title && fullUrl && !seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl);
          allOffers.push(
            buildOffer({
              id: stableOfferId('jobijoba', fullUrl, title, company, location),
              title,
              company,
              location,
              url: fullUrl,
              source: 'Jobijoba',
            })
          );
        }
      });
    })
  );

  return allOffers;
}


function fallbackOffers() {
  return [
    buildOffer({
      id: 'fallback-1',
      title: 'Analyste Financier',
      company: 'Agence Horizon',
      location: 'Paris 11',
      url: 'https://example.com/offre-1',
      source: 'Fallback',
      description: 'Poste en CDI, analyse financière et reporting pour des clients grands comptes.',
      postedAt: '2026-04-20',
      contractType: 'CDI',
    }),
    buildOffer({
      id: 'fallback-2',
      title: 'Consultant Junior en Stratégie',
      company: 'Nova Data',
      location: 'Paris 13',
      url: 'https://example.com/offre-2',
      source: 'Fallback',
      description: 'CDI oriente conseil en management, disponibilite immediate.',
      postedAt: '2026-04-25',
      contractType: 'CDI',
    }),
  ];
}

function dedupeOffers(offers) {
  const seen = new Set();
  return offers.filter((offer) => {
    const key = normalizeText(`${offer.source}|${offer.url || ''}|${offer.title}|${offer.company}|${offer.location}`).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

app.get('/api/admin/cache-info', (req, res) => {
  const profile = normalizeText(req.query.profile || '').toLowerCase();
  if (profile !== 'admin') {
    return res.status(403).json({ error: 'Action reservee au profil Admin' });
  }

  return res.json({
    ok: true,
    ...buildCacheInfo(),
  });
});

app.post('/api/admin/verify-password', (req, res) => {
  const passwordCheck = validateCelextimePassword(req.body || {});
  if (!passwordCheck.ok) {
    return res.status(401).json({ ok: false, error: passwordCheck.error });
  }

  return res.json({ ok: true });
});

app.post('/api/copine/verify-password', (req, res) => {
  const password = normalizeText(req.body?.password || '');
  if (!password) {
    return res.status(401).json({ ok: false, error: 'Mot de passe requis.' });
  }
  if (password !== COPINE_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Mot de passe incorrect.' });
  }

  return res.json({ ok: true });
});

app.post('/api/admin/cache-clear', (req, res) => {
  const requesterProfile = normalizeText(req.body?.profile || '').toLowerCase();
  if (requesterProfile !== 'admin') {
    return res.status(403).json({ error: 'Action reservee au profil Admin' });
  }

  const scope = normalizeText(req.body?.scope || '').toLowerCase();
  const targetAccount = normalizeText(req.body?.targetAccount || '').toLowerCase();
  const cacheType = normalizeCacheType(req.body?.cacheType || 'all');

  if (!['account', 'type', 'all'].includes(scope)) {
    return res.status(400).json({ error: 'scope invalide (account, type, all)' });
  }
  if (!cacheType) {
    return res.status(400).json({ error: 'cacheType invalide (ttl, persistent, all)' });
  }

  if (scope === 'account' && !KNOWN_PROFILES.has(targetAccount)) {
    return res.status(400).json({ error: 'Compte cible invalide' });
  }

  const protectedAction = shouldRequireCelextimePassword(scope, targetAccount);
  if (protectedAction) {
    const passwordCheck = validateCelextimePassword(req.body || {});
    if (!passwordCheck.ok) {
      return res.status(401).json({ error: passwordCheck.error });
    }
  }

  let result;
  if (scope === 'account') {
    result = clearCachesForAccount(targetAccount, cacheType);
  } else if (scope === 'type') {
    result = clearCachesByType(cacheType);
  } else {
    result = clearCachesByType('all');
  }

  return res.json({
    ok: true,
    scope,
    targetAccount: scope === 'account' ? targetAccount : null,
    cacheType: scope === 'all' ? 'all' : cacheType,
    protectedAction,
    cacheEntriesCleared: result.cacheEntriesCleared,
    persistentEntriesCleared: result.persistentEntriesCleared,
    cacheInfo: buildCacheInfo(),
  });
});

// Compatibilite: ancien endpoint admin -> clear account admin, tous types.
app.post('/api/admin/clear-cache', (req, res) => {
  const profile = normalizeText(req.body?.profile || '').toLowerCase();

  if (profile !== 'admin') {
    return res.status(403).json({ error: 'Action reservee au profil Admin' });
  }

  const result = clearCachesForAccount('admin', 'all');
  return res.json({
    ok: true,
    ...result,
    cacheInfo: buildCacheInfo(),
  });
});

// Compatibilite: ancien endpoint admin -> clear global, protégé mot de passe Celextime.
app.post('/api/admin/clear-cache-all', (req, res) => {
  const profile = normalizeText(req.body?.profile || '').toLowerCase();

  if (profile !== 'admin') {
    return res.status(403).json({ error: 'Action reservee au profil Admin' });
  }

  const passwordCheck = validateCelextimePassword(req.body || {});
  if (!passwordCheck.ok) {
    return res.status(401).json({ error: passwordCheck.error });
  }

  const result = clearCachesByType('all');
  return res.json({
    ok: true,
    ...result,
    cacheInfo: buildCacheInfo(),
  });
});

function extractKeywords(text, limit = 4) {
  const stopWords = new Set([
    'stage',
    'paris',
    'poste',
    'offre',
    'entreprise',
    'contrat',
    'pour',
    'avec',
    'dans',
    'des',
    'les',
    'une',
    'vous',
    'votre',
  ]);

  const tokens = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3 && !stopWords.has(token));

  return Array.from(new Set(tokens)).slice(0, limit);
}

function toTitleWords(words) {
  if (!words || words.length === 0) {
    return 'les missions du poste';
  }
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(', ');
}

app.post('/api/templates', (req, res) => {
  const { profile, offer } = req.body;

  if (!profile || !offer) {
    return res.status(400).json({ error: 'profile et offer sont requis' });
  }

  const firstName = profile.firstName || 'Prenom';
  const lastName = profile.lastName || 'Nom';
  const formation = profile.formation || 'ma formation';
  const skills = profile.skills || 'mes competences';
  const email = profile.email || 'email@example.com';
  const phone = profile.phone || '06 00 00 00 00';
  const city = offer.location || 'Paris';

  const keywords = extractKeywords(`${offer.title} ${offer.description}`);
  const focusTopics = toTitleWords(keywords);
  const descriptionSnippet =
    normalizeText(offer.description).slice(0, 240) ||
    'des missions operationnelles avec de fortes responsabilites';

  const coverLetter = `Objet : Candidature - ${offer.title}\n\nMadame, Monsieur,\n\nTitulaire d'${formation}, je suis vivement interesse(e) par le poste de ${offer.title} chez ${offer.company}, disponible sur ${city}. Ce poste correspond exactement a la direction que je souhaite donner a mon projet professionnel, et je suis disponible pour debuter des que possible.\n\nLe poste met en avant ${focusTopics}. Sur ces sujets, je peux mobiliser ${skills} et une forte capacite d execution. Je souhaite contribuer concretement a vos objectifs, tout en evoluant dans un environnement exigeant et stimulant.\n\nCe qui m interesse particulierement dans votre annonce est l orientation suivante : ${descriptionSnippet}. Cette dynamique est en coherence directe avec mes attentes et ma motivation pour ce poste.\n\nJe serais ravie d echanger avec vous lors d un entretien afin de vous presenter plus en detail ce que je peux apporter a votre equipe.\n\nCordialement,\n${firstName} ${lastName}\n${phone}\n${email}`;

  const linkedinHook = `Bonjour ${offer.company},\n\nJe suis actuellement a la recherche d'un poste a Paris, disponible des que possible, et votre offre \"${offer.title}\" correspond parfaitement a mon projet.\n\nJe serais ravie d'echanger rapidement sur le poste et la valeur que je peux apporter a votre equipe.\n\n${firstName} ${lastName}`;

  return res.json({ coverLetter, linkedinHook });
});


const jobsCacheKey = 'jobs-cache-v1';

// Scraping toutes sources peut prendre plusieurs minutes (LinkedIn: des centaines
// de requetes). On ne bloque donc jamais la reponse HTTP dessus (ca provoquerait
// un 504 cote proxy/hebergeur) : le scraping tourne en tache de fond et le client
// fait du polling sur ce meme endpoint jusqu'a ce que le resultat soit pret.
const jobsInProgress = new Map(); // cacheKey -> { startedAt }

async function runScrapeJob(cacheKey, city) {
  const results = [];
  const errors = [];

  const tasks = [
    { name: 'Jobijoba', fn: scrapeJobijoba },
    { name: 'LinkedIn', fn: () => scrapeLinkedIn(city) },
    { name: 'Talent.com', fn: scrapeTalentCom },
  ];

  const sourceStatuses = tasks.map((task) => ({
    source: task.name,
    status: 'pending',
    fetched: 0,
    error: null,
  }));

  await Promise.all(
    tasks.map(async (task, index) => {
      try {
        const offers = await task.fn();
        results.push(...offers);
        sourceStatuses[index] = {
          source: task.name,
          status: 'ok',
          fetched: offers.length,
          error: null,
        };
      } catch (error) {
        errors.push({ source: task.name, error: error.message });
        sourceStatuses[index] = {
          source: task.name,
          status: 'error',
          fetched: 0,
          error: error.message,
        };
        console.error(`Error fetching ${task.name} jobs: ${error.message}`);
      }
    })
  );

  // Jobijoba/Talent.com sont interrogés avec une requête generique ("CDI Paris")
  // qui remonte tous les secteurs (y compris santé, etc.) : on ne garde que les
  // offres qui matchent réellement finance/conseil/banque/stratégie.
  const sectorFiltered = results.filter(
    (offer) =>
      SECTOR_MATCH_REGEX.test(`${offer.title} ${offer.company} ${offer.description || ''}`) &&
      !SECTOR_EXCLUDE_REGEX.test(offer.title)
  );

  const deduped = dedupeOffers(sectorFiltered);

  // --- Fusion avec le store persistant ---
  // Une source est considérée "fiable" pour marquer indispo seulement si elle a
  // renvoyé au moins MIN_OFFERS_TO_TRUST offres (évite les faux positifs quand
  // l'anti-scraping retourne 0 résultat alors que les offres existent encore)
  const MIN_OFFERS_TO_TRUST = 3;
  const UNAVAILABLE_GRACE_DAYS = 10; // offres < 10 jours ne sont jamais marquées indispo

  const successfulSources = new Set(
    sourceStatuses
      .filter((s) => s.status === 'ok' && s.fetched >= MIN_OFFERS_TO_TRUST)
      .map((s) => s.source)
  );

  // Index des nouvelles offres par URL (ou clé dedup)
  function offerKey(o) {
    return (o.url || normalizeText(`${o.source}|${o.title}|${o.company}`)).toLowerCase();
  }
  const freshByKey = new Map(deduped.map((o) => [offerKey(o), o]));

  // Récupérer le store persistant pour cette clé de cache (on purge au passage les
  // offres hors-secteur qui auraient pu y être ajoutées avant ce filtre)
  const previousOffer = (persistentOffersStore.get(cacheKey) || []).filter(
    (offer) =>
      SECTOR_MATCH_REGEX.test(`${offer.title} ${offer.company} ${offer.description || ''}`) &&
      !SECTOR_EXCLUDE_REGEX.test(offer.title)
  );

  // Mettre à jour ou conserver les offres précédentes
  const nowIso = new Date().toISOString();
  const mergedMap = new Map();

  // 1. Intégrer les anciennes offres
  for (const prev of previousOffer) {
    const key = offerKey(prev);
    if (freshByKey.has(key)) {
      // L'offre est revenue : supprimer le flag indisponible
      const updated = { ...freshByKey.get(key), unavailable: false, unavailableSince: null };
      mergedMap.set(key, updated);
      freshByKey.delete(key); // ne pas la rajouter en double
    } else if (successfulSources.has(prev.source)) {
      // Source fiable et offre absente → marquer indisponible, sauf si offre récente
      const postedTime = prev.postedAt ? new Date(prev.postedAt).getTime() : NaN;
      const isRecent = Number.isFinite(postedTime) &&
        (Date.now() - postedTime) < UNAVAILABLE_GRACE_DAYS * 24 * 60 * 60 * 1000;
      if (!prev.unavailable && !isRecent) {
        mergedMap.set(key, { ...prev, unavailable: true, unavailableSince: nowIso });
      } else {
        mergedMap.set(key, prev);
      }
    } else {
      // Source en erreur : conserver l'offre telle quelle sans la marquer
      mergedMap.set(key, prev);
    }
  }

  // 2. Ajouter les nouvelles offres jamais vues
  for (const [key, offer] of freshByKey) {
    mergedMap.set(key, { ...offer, unavailable: false, unavailableSince: null });
  }

  const allOffersMerged = Array.from(mergedMap.values());

  // Sauvegarder dans le store persistant
  persistentOffersStore.set(cacheKey, allOffersMerged);

  // Trier strictement par date (plus recent en premier, date absente/invalide a la fin)
  allOffersMerged.sort((a, b) => {
    const aTime = a.postedAt ? new Date(a.postedAt).getTime() : NaN;
    const bTime = b.postedAt ? new Date(b.postedAt).getTime() : NaN;
    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);

    if (!aValid && !bValid) return 0;
    if (!aValid) return 1;
    if (!bValid) return -1;
    return bTime - aTime;
  });

  const cacheData = {
    jobs: allOffersMerged.length > 0 ? allOffersMerged : fallbackOffers(),
    totalFetchedBeforeDedup: results.length,
    totalAfterDedup: allOffersMerged.length,
    errors,
    sourceStatuses,
    fetchedAt: new Date().toISOString(),
  };

  offersCache.set(cacheKey, {
    data: cacheData,
    fetchedAt: Date.now(),
  });

  persistCacheToDisk();

  return cacheData;
}

app.get('/api/jobs', (req, res) => {
  const city = normalizeText(req.query.city || 'Paris');
  const forceRefresh = req.query.refresh === 'true';
  const cacheKey = `${jobsCacheKey}|${city.toLowerCase()}`;

  // Si un scraping est déjà en cours pour cette clé, ne jamais servir le cache
  // TTL même sans refresh=true : sinon le 2e appel du polling (qui repasse en
  // refresh=false pour ne pas relancer un scrape) renvoie immédiatement les
  // anciennes données avec inProgress=false pendant que le refresh tourne
  // encore en arrière-plan, ce qui coupe le polling trop tôt côté client.
  const existingJob = jobsInProgress.get(cacheKey);
  if (existingJob) {
    return res.json({
      jobs: [],
      inProgress: true,
      fromCache: false,
      startedAt: existingJob.startedAt,
    });
  }

  if (!forceRefresh) {
    const cached = offersCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.json({
        ...cached.data,
        fromCache: true,
        inProgress: false,
        cachedAt: new Date(cached.fetchedAt).toISOString(),
      });
    }
  }

  const startedAt = Date.now();
  const job = runScrapeJob(cacheKey, city)
    .catch((error) => {
      console.error(`Erreur scraping (${cacheKey}): ${error.message}`);
    })
    .finally(() => {
      jobsInProgress.delete(cacheKey);
    });
  jobsInProgress.set(cacheKey, { startedAt, job });

  return res.json({
    jobs: [],
    inProgress: true,
    fromCache: false,
    startedAt,
  });
});

app.get('/api/open-offer', async (req, res) => {
  const url = req.query.url;
  const source = req.query.source;
  const title = req.query.title;
  const company = req.query.company;
  const city = req.query.city;

  const fallbackUrl = buildSourceSearchUrl({ source, title, company, city });

  if (isLikelyDeadUrl(url)) {
    return res.redirect(302, fallbackUrl);
  }

  // Avoid server-side preflight checks: many ATS links reject bots but work in browser.
  return res.redirect(302, url);
});

app.use('/api', (req, res) => {
  return res.status(404).json({ error: `Route API introuvable: ${req.method} ${req.originalUrl}` });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
