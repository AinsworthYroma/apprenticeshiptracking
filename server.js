const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TARGET_CITY = 'Paris';
const TARGET_START = 'septembre 2026';
const LBA_API_BASE = 'https://labonnealternance.apprentissage.beta.gouv.fr/api';

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const LINKEDIN_MAX_PAGES = Math.max(1, parseInt(process.env.LINKEDIN_MAX_PAGES || '180', 10));
const LINKEDIN_BATCH_SIZE = Math.max(1, parseInt(process.env.LINKEDIN_BATCH_SIZE || '8', 10));
const WTTJ_MAX_SCAN_PAGES = Math.max(1, parseInt(process.env.WTTJ_MAX_SCAN_PAGES || '180', 10));
const WTTJ_SECONDARY_SCAN_PAGES = Math.max(
  1,
  parseInt(process.env.WTTJ_SECONDARY_SCAN_PAGES || '60', 10)
);
const DEFAULT_CELEXTIME_ADMIN_PASSWORD = 'Celextime1';
const CELEXTIME_ADMIN_PASSWORD = normalizeText(
  process.env.CELEXTIME_ADMIN_PASSWORD || DEFAULT_CELEXTIME_ADMIN_PASSWORD
);

if (process.env.NODE_ENV === 'production' && !normalizeText(process.env.CELEXTIME_ADMIN_PASSWORD || '')) {
  console.warn('Warning: CELEXTIME_ADMIN_PASSWORD non defini, mot de passe par defaut utilise en production.');
}

// ---------------------------------------------------------------------------
// Cache serveur en mémoire
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 heures par défaut

const offersCache = new Map();
// Store persistant : conserve toutes les offres déjà vues, par cacheKey
const persistentOffersStore = new Map();

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

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
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

function resolveInseeFromCity(city) {
  const normalizedCity = normalizeText(city).toLowerCase();
  const mapping = {
    paris: '75056',
  };
  return mapping[normalizedCity] || '75056';
}

function findBestUrl(item) {
  const candidates = [
    item?.offer?.url,
    item?.offer?.originUrl,
    item?.offer?.publicUrl,
    item?.offer?.applyUrl,
    item?.apply?.url,
    item?.contact?.url,
    item?.origin?.url,
    item?.url,
  ]
    .map((value) => (typeof value === 'string' ? normalizeText(value) : ''))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!isLikelyDeadUrl(candidate)) {
      return candidate;
    }
  }

  return (
    candidates[0] ||
    'https://labonnealternance.apprentissage.beta.gouv.fr/'
  );
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
    contractType: partial.contractType || 'Alternance',
    cityMatch: /paris/i.test(`${location} ${city}`),
    startMatch: /sept(embre)?\s*2026/i.test(`${partial.title} ${partial.description || ''}`),
  };
}

function buildSourceSearchUrl({ source, title, company, city }) {
  const q = encodeURIComponent(`${title || ''} ${company || ''} ${city || ''} alternance`.trim());

  if ((source || '').startsWith('La Bonne Alternance')) {
    return `https://labonnealternance.apprentissage.beta.gouv.fr/recherche-apprentissage?job_name=${q}`;
  }
  if ((source || '').includes('Welcome to the Jungle')) {
    return `https://www.welcometothejungle.com/fr/jobs?query=${q}`;
  }
  if ((source || '').includes('Jobijoba')) {
    return `https://www.jobijoba.com/fr/emploi/${encodeURIComponent(`${title || 'Alternance'} ${city || 'Paris'}`)}`;
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
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // Some sources send only the platform homepage, which is not a real offer link.
    if (
      hostname.includes('labonnealternance.apprentissage.beta.gouv.fr') &&
      (pathname === '/' || pathname === '')
    ) {
      return true;
    }
  } catch (error) {
    return true;
  }

  return false;
}

async function scrapeLinkedIn(city) {
  // LinkedIn guest API avec plans multiples pour maximiser le volume utile.
  const primaryOffsets = Array.from({ length: LINKEDIN_MAX_PAGES }, (_, i) => i * 25);
  const secondaryOffsets = Array.from(
    { length: Math.min(80, LINKEDIN_MAX_PAGES) },
    (_, i) => i * 25
  );
  const tertiaryOffsets = Array.from(
    { length: Math.min(35, LINKEDIN_MAX_PAGES) },
    (_, i) => i * 25
  );
  const cityText = normalizeText(city || TARGET_CITY) || TARGET_CITY;
  const regionHint = /paris/i.test(cityText) ? 'Ile-de-France' : 'France';
  const broaderLocation = /paris/i.test(cityText) ? 'Ile-de-France, France' : 'France';
  const searchPlans = [
    { keywords: 'alternance', location: `${cityText}, ${regionHint}`, offsets: primaryOffsets },
    { keywords: 'apprentissage', location: `${cityText}, ${regionHint}`, offsets: secondaryOffsets },
    { keywords: 'alternance', location: cityText, offsets: secondaryOffsets },
    { keywords: 'alternant', location: `${cityText}, ${regionHint}`, offsets: secondaryOffsets },
    { keywords: 'alternance', location: broaderLocation, offsets: secondaryOffsets },
    { keywords: 'contrat professionnalisation', location: `${cityText}, ${regionHint}`, offsets: tertiaryOffsets },
    { keywords: 'work-study', location: broaderLocation, offsets: tertiaryOffsets },
    { keywords: 'apprenticeship', location: broaderLocation, offsets: tertiaryOffsets },
    { keywords: 'alternance marketing', location: `${cityText}, ${regionHint}`, offsets: tertiaryOffsets },
    { keywords: 'alternance data', location: `${cityText}, ${regionHint}`, offsets: tertiaryOffsets },
  ];
  const offers = [];
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
          offers.push(
            buildOffer({
              id: `linkedin-${item.keywords}-${item.start}-${index}`,
              title,
              company,
              location,
              city: extractCityFromLocation(location, cityText),
              url,
              source: 'LinkedIn',
            })
          );
        }
      });
    });

    // Petite pause entre lots pour limiter les 429 côté LinkedIn.
    await sleep(140);
  }

  return offers;
}

async function scrapeTalentCom() {
  // Talent.com: pagination via ?p=N (pages 1 à 5)
  const pages = [1, 2, 3, 4, 5];
  const allOffers = [];

  await Promise.allSettled(
    pages.map(async (page) => {
      const response = await axios.get('https://www.talent.com/fr/jobs', {
        params: { k: 'alternance', l: 'Paris', p: page },
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
        timeout: 15000,
      });
      const $ = cheerio.load(response.data);
      const pageOffers = [];

      $('[class*="JobCard_card"]').each((index, node) => {
        const title = normalizeText($('[class*="JobCard_title"]', node).text());
        const company = normalizeText($('[class*="JobCard_company"]', node).text());
        const location = normalizeText($('[class*="JobCard_location"]', node).text());
        const href = $('a', node).first().attr('href') || '';
        const url = href.startsWith('http') ? href : href ? `https://www.talent.com${href}` : '';

        if (title && url) {
          pageOffers.push(
            buildOffer({
              id: `talent-p${page}-${index}`,
              title,
              company,
              location,
              url,
              source: 'Talent.com',
            })
          );
        }
      });

      allOffers.push(...pageOffers);
    })
  );

  return allOffers;
}

async function scrapeWelcomeToTheJungle() {
  const scanPlans = [
    {
      base:
        'https://www.welcometothejungle.com/fr/jobs?aroundLatLng=48.85718%2C2.34141&aroundQuery=Paris%2C%20France&aroundRadius=40&refinementList%5Bcontract_type%5D%5B%5D=apprenticeship&refinementList%5Boffices.country_code%5D%5B%5D=FR&aroundPrecision=5',
      maxPages: WTTJ_MAX_SCAN_PAGES,
    },
    {
      base:
        'https://www.welcometothejungle.com/fr/jobs?query=alternance&aroundLatLng=48.85718%2C2.34141&aroundQuery=Paris%2C%20France&aroundRadius=80&refinementList%5Boffices.country_code%5D%5B%5D=FR&aroundPrecision=5',
      maxPages: Math.min(WTTJ_SECONDARY_SCAN_PAGES, WTTJ_MAX_SCAN_PAGES),
    },
    {
      base:
        'https://www.welcometothejungle.com/fr/jobs?query=apprentissage&aroundLatLng=48.85718%2C2.34141&aroundQuery=Paris%2C%20France&aroundRadius=80&refinementList%5Boffices.country_code%5D%5B%5D=FR&aroundPrecision=5',
      maxPages: Math.min(WTTJ_SECONDARY_SCAN_PAGES, WTTJ_MAX_SCAN_PAGES),
    },
  ];

  const seedUrls = [
    'https://www.welcometothejungle.com/fr/pages/emploi-alternance-paris',
    ...scanPlans.map((plan) => plan.base),
  ];
  const scanUrls = [...seedUrls];
  const seenScanUrls = new Set(scanUrls);

  const appendUrl = (url) => {
    if (!url || seenScanUrls.has(url)) {
      return;
    }
    seenScanUrls.add(url);
    scanUrls.push(url);
  };

  scanPlans.forEach((plan) => {
    for (let p = 2; p <= plan.maxPages; p += 1) {
      appendUrl(`${plan.base}&page=${p}`);
    }
  });

  const offers = [];
  const seenUrls = new Set();
  const companySlugs = new Set();

  function addOfferFromHref(href, title, company, location) {
    if (!href) {
      return;
    }
    const absoluteUrl = href.startsWith('http')
      ? href
      : `https://www.welcometothejungle.com${href}`;
    if (seenUrls.has(absoluteUrl)) {
      return;
    }
    seenUrls.add(absoluteUrl);

    offers.push(
      buildOffer({
        id: `wttj-${seenUrls.size}`,
        title: title || 'Alternance',
        company: company || 'Entreprise non specifiee',
        location: location || 'Paris',
        url: absoluteUrl,
        source: 'Welcome to the Jungle',
      })
    );

    const cleanParts = absoluteUrl
      .replace(/^https?:\/\/www\.welcometothejungle\.com/, '')
      .split('/')
      .filter(Boolean);
    if (cleanParts[0] === 'fr' && cleanParts[1] === 'companies' && cleanParts[2]) {
      companySlugs.add(cleanParts[2]);
    }
  }

  function harvestFromHtml(html) {
    const $ = cheerio.load(html || '');

    $('a[href*="/fr/companies/"][href*="/jobs/"]').each((index, node) => {
      const card = $(node);
      const href = card.attr('href');
      const parts = (href || '').split('/').filter(Boolean);
      const companySlug = parts[2] || '';
      const jobSlug = parts[4] || '';

      const titleFromDom =
        normalizeText(card.find('h2, h3, h4').first().text()) ||
        normalizeText(card.attr('title'));
      const titleFromSlug = decodeURIComponent(jobSlug)
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      addOfferFromHref(
        href,
        titleFromDom || titleFromSlug || 'Alternance',
        decodeURIComponent(companySlug).replace(/[-_]+/g, ' ') || 'Entreprise non specifiee',
        'Paris'
      );
    });

    const patterns = [
      /\/fr\/companies\/[^"\s]+\/jobs\/[^"\s]+/g,
      new RegExp('\\\\/fr\\\\/companies\\\\/[^"\\\\s]+\\\\/jobs\\\\/[^"\\\\s]+', 'g'),
    ];

    for (const pattern of patterns) {
      const matches = (html || '').match(pattern) || [];
      for (const rawMatch of matches) {
        const href = rawMatch.replace(/\\\//g, '/');
        const cleanHref = href.split('?')[0];
        const parts = cleanHref.split('/').filter(Boolean);
        const companySlug = parts[2] || 'entreprise';
        const jobSlug = parts[4] || 'alternance';
        const prettyTitle = decodeURIComponent(jobSlug)
          .replace(/[-_]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        addOfferFromHref(
          cleanHref,
          prettyTitle || 'Alternance',
          decodeURIComponent(companySlug).replace(/[-_]+/g, ' '),
          'Paris'
        );
      }
    }

    const jsonLdPattern = /"url"\s*:\s*"(https?:\\?\/\\?\/www\.welcometothejungle\.com\\?\/fr\\?\/companies\\?\/[^"\\]+\\?\/jobs\\?\/[^"\\]+)"/g;
    let jsonLdMatch;
    while ((jsonLdMatch = jsonLdPattern.exec(html || '')) !== null) {
      const decodedUrl = jsonLdMatch[1].replace(/\\\//g, '/');
      const relative = decodedUrl.replace(/^https?:\/\/www\.welcometothejungle\.com/, '');
      addOfferFromHref(relative, 'Alternance', 'Entreprise non specifiee', 'Paris');
    }
  }

  const pageResponses = await Promise.allSettled(
    scanUrls.map((url) =>
      httpGetWithRetries(
        url,
        {
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
          timeout: 20000,
        },
        2
      )
    )
  );

  pageResponses.forEach((result) => {
    if (result.status !== 'fulfilled') {
      return;
    }
    harvestFromHtml(result.value.data || '');
  });

  if (offers.length === 0) {
    const fallbackUrls = [];
    const seenFallback = new Set();
    const pushFallback = (url) => {
      if (!url || seenFallback.has(url)) {
        return;
      }
      seenFallback.add(url);
      fallbackUrls.push(url);
    };

    scanPlans.forEach((plan) => {
      for (let p = 2; p <= plan.maxPages; p += 1) {
        pushFallback(`${plan.base}&page=${p}`);
      }
    });

    const fallbackResponses = await Promise.allSettled(
      fallbackUrls.map((url) =>
        httpGetWithRetries(
          url,
          {
            headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
            timeout: 20000,
          },
          2
        )
      )
    );

    fallbackResponses.forEach((result) => {
      if (result.status !== 'fulfilled') {
        return;
      }
      harvestFromHtml(result.value.data || '');
    });
  }

  // Elargissement: on visite les pages jobs des entreprises detectees pour capter plus d'offres.
  const companyUrls = Array.from(companySlugs)
    .filter(Boolean)
    .slice(0, 160)
    .flatMap((slug) => [
      `https://www.welcometothejungle.com/fr/companies/${slug}/jobs`,
      `https://www.welcometothejungle.com/fr/companies/${slug}/jobs?query=alternance`,
      `https://www.welcometothejungle.com/fr/companies/${slug}/jobs?query=apprentissage`,
    ]);

  const companyResponses = await Promise.allSettled(
    companyUrls.map((url) =>
      httpGetWithRetries(
        url,
        {
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
          timeout: 20000,
        },
        2
      )
    )
  );

  companyResponses.forEach((result) => {
    if (result.status !== 'fulfilled') {
      return;
    }
    harvestFromHtml(result.value.data || '');
  });

  if (offers.length === 0) {
    throw new Error('Aucune offre exploitable detectee sur WTTJ (anti-bot / HTML limite)');
  }

  return offers;
}

async function scrapeLaBonneAlternance(city) {
  const insee = resolveInseeFromCity(city);
  const seedRomeBatches = [
    'M1805,M1705,M1405,D1401,D1402',
    'M1801,M1802,M1803,M1806,M1807',
    'N1101,N1103,G1603,G1202',
    'E1103,E1104,E1106,F1602,F1603',
  ];
  const sourceBuckets = [
    { key: 'peJobs', label: 'PE Jobs' },
    { key: 'partnerJobs', label: 'Partner Jobs' },
    { key: 'matchas', label: 'Matcha' },
    { key: 'lbaCompanies', label: 'LBA Recruiters' },
  ];

  const offers = [];
  const caller = process.env.LBA_CALLER || 'contact@example.com apprenticeshiptracking';

  async function fetchBatch(romes) {
    const response = await axios.get(`${LBA_API_BASE}/v1/jobsEtFormations`, {
      params: {
        romes,
        insee,
        radius: 45,
        sources: 'peJob,partnerJob,matcha,lba',
        caller,
        options: 'with_description',
      },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 20000,
    });
    return { romes, data: response.data };
  }

  const firstWave = await Promise.allSettled(seedRomeBatches.map((romes) => fetchBatch(romes)));
  const successfulWaves = firstWave.filter((item) => item.status === 'fulfilled').map((item) => item.value);
  const discoveredRomeCodes = new Set();

  successfulWaves.forEach((wave) => {
    const jobs = wave.data?.jobs || {};
    sourceBuckets.forEach(({ key }) => {
      const results = jobs[key]?.results || [];
      results.forEach((item) => {
        (item?.romes || []).forEach((rome) => {
          const code = normalizeText(rome?.code || '').toUpperCase();
          if (/^[A-Z]\d{4}$/.test(code)) {
            discoveredRomeCodes.add(code);
          }
        });
      });
    });
  });

  const alreadyQueriedCodes = new Set(
    seedRomeBatches.join(',').split(',').map((code) => normalizeText(code).toUpperCase())
  );
  const extraCodes = Array.from(discoveredRomeCodes).filter((code) => !alreadyQueriedCodes.has(code));
  const extraBatches = [];
  for (let i = 0; i < extraCodes.length && extraBatches.length < 24; i += 5) {
    extraBatches.push(extraCodes.slice(i, i + 5).join(','));
  }

  const secondWave = await Promise.allSettled(extraBatches.map((romes) => fetchBatch(romes)));
  const allWaveData = [
    ...successfulWaves,
    ...secondWave.filter((item) => item.status === 'fulfilled').map((item) => item.value),
  ];

  allWaveData.forEach((wave, batchIndex) => {
    const response = { data: wave.data };
    const jobs = response.data?.jobs || {};
    sourceBuckets.forEach(({ key, label }) => {
      const results = jobs[key]?.results || [];
      results.forEach((item, index) => {
        const address =
          item?.place?.fullAddress ||
          item?.place?.city ||
          item?.workplace?.location?.address ||
          city;
        const title = item?.title || item?.offer?.title || item?.job?.title || 'Alternance';

        offers.push(
          buildOffer({
            id: `lba-${batchIndex}-${key}-${item?.id || index}`,
            title,
            company: item?.company?.name || item?.workplace?.name || 'Entreprise non specifiee',
            companySize: item?.company?.size || item?.workplace?.size || 'Inconnue',
            location: address,
            city: item?.place?.city || extractCityFromLocation(address, city),
            url: findBestUrl(item),
            source: `La Bonne Alternance (${label})`,
            description: item?.job?.description || item?.description || item?.offer?.description || '',
            studyLevel:
              (Array.isArray(item?.job?.offer_access_conditions)
                ? item.job.offer_access_conditions.join(' ')
                : item?.job?.offer_access_conditions || '') ||
              item?.job?.diploma ||
              '',
            postedAt: item?.job?.creationDate || item?.offer?.publication?.creation || null,
            contractType: item?.job?.contractType || item?.contractType || 'Alternance',
            latitude:
              typeof item?.place?.latitude === 'number' ? item.place.latitude : null,
            longitude:
              typeof item?.place?.longitude === 'number' ? item.place.longitude : null,
          })
        );
      });
    });
  });

  return offers;
}

async function scrapeJobijoba() {
  const query = encodeURIComponent('alternance paris septembre 2026');
  const url = `https://www.jobijoba.com/fr/emploi/Alternance+Paris`; 
  const response = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);
  const offers = [];

  $('article, .offer, .job').each((index, node) => {
    const container = $(node);
    const title = container.find('h2, h3, .title').first().text();
    const company = container.find('.company, .societe').first().text() || 'Entreprise non specifiee';
    const location = container.find('.location, .ville').first().text() || 'Paris';
    const link = container.find('a').first().attr('href');

    if (title && link) {
      offers.push(
        buildOffer({
          id: `jobijoba-${index}`,
          title,
          company,
          location,
          url: link.startsWith('http') ? link : `https://www.jobijoba.com${link}`,
          source: 'Jobijoba',
        })
      );
    }
  });

  return offers;
}

function fallbackOffers() {
  return [
    buildOffer({
      id: 'fallback-1',
      title: 'Assistant Marketing Digital en alternance',
      company: 'Agence Horizon',
      location: 'Paris 11',
      url: 'https://example.com/offre-1',
      source: 'Fallback',
      description: 'Alternance de 12 mois. Demarrage souhaite en septembre 2026.',
      postedAt: '2026-04-20',
    }),
    buildOffer({
      id: 'fallback-2',
      title: 'Data Analyst Junior - Alternance',
      company: 'Nova Data',
      location: 'Paris 13',
      url: 'https://example.com/offre-2',
      source: 'Fallback',
      description: 'Alternance orientee BI, prise de poste septembre 2026.',
      postedAt: '2026-04-25',
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

app.get('/api/offers', async (req, res) => {
  const city = req.query.city || TARGET_CITY;
  const start = req.query.start || TARGET_START;
  const profile = normalizeText(req.query.profile || 'admin').toLowerCase();
  const forceRefresh = req.query.refresh === 'true';
  const cacheKey = buildCacheKey(profile, city, start);

  // --- Servir depuis le cache si disponible et non expiré ---
  if (!forceRefresh && isCacheValid(cacheKey)) {
    const cacheEntry = offersCache.get(cacheKey);
    return res.json({
      ...cacheEntry.data,
      fromCache: true,
      cachedAt: new Date(cacheEntry.fetchedAt).toISOString(),
    });
  }

  const results = [];
  const errors = [];

  const tasks = [
    { name: 'La Bonne Alternance API', fn: () => scrapeLaBonneAlternance(city) },
    { name: 'Welcome to the Jungle', fn: scrapeWelcomeToTheJungle },
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
      }
    })
  );

  const deduped = dedupeOffers(results);

  // --- Fusion avec le store persistant ---
  // Sources ayant réussi le scrape (on ne marque indispo que celles-là)
  const successfulSources = new Set(
    sourceStatuses.filter((s) => s.status === 'ok').map((s) => s.source)
  );

  // Index des nouvelles offres par URL (ou clé dedup)
  function offerKey(o) {
    return (o.url || normalizeText(`${o.source}|${o.title}|${o.company}`)).toLowerCase();
  }
  const freshByKey = new Map(deduped.map((o) => [offerKey(o), o]));

  // Récupérer le store persistant pour cette clé de cache
  const previousOffer = persistentOffersStore.get(cacheKey) || [];

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
      // Source OK mais offre absente → marquer indisponible
      if (!prev.unavailable) {
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
  const offers = allOffersMerged;
  const filtered = offers.filter((offer) => {
    const cityOk = new RegExp(city, 'i').test(`${offer.location || ''} ${offer.city || ''}`) || offer.cityMatch;
    const startOk = new RegExp(start.replace(/\s+/g, '.*'), 'i').test(`${offer.title} ${offer.description}`) || offer.startMatch;
    return cityOk || startOk;
  });

  const payload = {
    query: { city, start, profile },
    totalFetchedBeforeDedup: results.length,
    totalAfterDedup: offers.length,
    totalMatchedHeuristic: filtered.length,
    total: offers.length,
    offers: allOffersMerged.length > 0 ? allOffersMerged : fallbackOffers(),
    errors,
    sourceStatuses,
    fromCache: false,
    cachedAt: new Date().toISOString(),
    note:
      'Certaines plateformes changent regulierement leur HTML. Si une source echoue, les autres continuent et des offres de demonstration sont ajoutees en secours.',
  };

  // Stocker en cache
  offersCache.set(cacheKey, {
    data: payload,
    fetchedAt: Date.now(),
  });

  res.json(payload);
});

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
    'alternance',
    'apprentissage',
    'stage',
    'paris',
    'septembre',
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
    'des missions operationnelles avec une forte courbe d apprentissage';

  const coverLetter = `Objet : Candidature alternance - ${offer.title}\n\nMadame, Monsieur,\n\nActuellement en ${formation}, je recherche une alternance a partir de septembre 2026 sur ${city}. Votre offre \"${offer.title}\" chez ${offer.company} correspond exactement a la direction que je souhaite donner a mon projet professionnel.\n\nLe poste met en avant ${focusTopics}. Sur ces sujets, je peux mobiliser ${skills} et une forte capacite d execution. Je souhaite contribuer concretement a vos objectifs, tout en progressant dans un environnement exigeant et formateur.\n\nCe qui m interesse particulierement dans votre annonce est l orientation suivante : ${descriptionSnippet}. Cette dynamique est en coherence directe avec mes attentes et ma motivation pour cette alternance.\n\nJe serais ravie d echanger avec vous lors d un entretien afin de vous presenter plus en detail ce que je peux apporter a votre equipe.\n\nCordialement,\n${firstName} ${lastName}\n${phone}\n${email}`;

  const linkedinHook = `Bonjour ${offer.company},\n\nJe suis actuellement a la recherche d'une alternance a Paris pour septembre 2026 et votre offre \"${offer.title}\" correspond parfaitement a mon projet.\n\nJe serais ravie d'echanger rapidement sur le poste et la valeur que je peux apporter a votre equipe.\n\n${firstName} ${lastName}`;

  return res.json({ coverLetter, linkedinHook });
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
