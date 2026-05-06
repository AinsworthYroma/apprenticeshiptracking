const scrapeButton = document.getElementById('scrapeButton');
const refreshButton = document.getElementById('refreshButton');
const cityInput = document.getElementById('cityInput');
const startInput = document.getElementById('startInput');
const offerList = document.getElementById('offerList');
const offerMap = document.getElementById('offerMap');
const offerCount = document.getElementById('offerCount');
const statusText = document.getElementById('statusText');
const profileForm = document.getElementById('profileForm');
const trackingBoard = document.getElementById('trackingBoard');
const trackingCount = document.getElementById('trackingCount');
const coverLetterOutput = document.getElementById('coverLetterOutput');
const linkedinOutput = document.getElementById('linkedinOutput');
const sourceStatusList = document.getElementById('sourceStatusList');
const locationFilter = document.getElementById('locationFilter');
const companySizeFilter = document.getElementById('companySizeFilter');
const studyLevelFilter = document.getElementById('studyLevelFilter');
const unseenOnlyFilter = document.getElementById('unseenOnlyFilter');
const keywordFilter = document.getElementById('keywordFilter');
const offersTabButton = document.getElementById('offersTabButton');
const trackingTabButton = document.getElementById('trackingTabButton');
const adminTabButton = document.getElementById('adminTabButton');
const offersTab = document.getElementById('offersTab');
const trackingTab = document.getElementById('trackingTab');
const adminTab = document.getElementById('adminTab');
const offersPanel = document.querySelector('.offers-panel');
const sidebar = document.querySelector('.sidebar');
const spaceCats = document.getElementById('spaceCats');
const profileGate = document.getElementById('profileGate');
const profileChoiceButtons = document.querySelectorAll('[data-profile-choice]');
const activeProfileLabel = document.getElementById('activeProfileLabel');
const switchProfileButton = document.getElementById('switchProfileButton');
const profileIntro = document.getElementById('profileIntro');
const adminCacheGuard = document.getElementById('adminCacheGuard');
const adminCacheContent = document.getElementById('adminCacheContent');
const cacheInfoUpdatedAt = document.getElementById('cacheInfoUpdatedAt');
const metricRuntimeTotal = document.getElementById('metricRuntimeTotal');
const metricPersistentTotal = document.getElementById('metricPersistentTotal');
const metricViewedMentions = document.getElementById('metricViewedMentions');
const metricPipelineMentions = document.getElementById('metricPipelineMentions');
const adminAccountStats = document.getElementById('adminAccountStats');
const adminCacheStatus = document.getElementById('adminCacheStatus');
const adminAccountTarget = document.getElementById('adminAccountTarget');
const adminAccountCacheType = document.getElementById('adminAccountCacheType');
const adminTypeCacheType = document.getElementById('adminTypeCacheType');
const adminViewedTarget = document.getElementById('adminViewedTarget');
const clearByAccountButton = document.getElementById('clearByAccountButton');
const clearByTypeButton = document.getElementById('clearByTypeButton');
const clearAllServerCacheButton = document.getElementById('clearAllServerCacheButton');
const clearAllViewedButton = document.getElementById('clearAllViewedButton');
const clearViewedBothButton = document.getElementById('clearViewedBothButton');
const celextimePassword = document.getElementById('celextimePassword');
const celextimePasswordConfirm = document.getElementById('celextimePasswordConfirm');
const mobileOffersToggle = document.getElementById('mobileOffersToggle');
const profileChoiceView = document.getElementById('profileChoiceView');
const profileLoginView = document.getElementById('profileLoginView');
const profileLoginTitle = document.getElementById('profileLoginTitle');
const profileLoginForm = document.getElementById('profileLoginForm');
const profileLoginPassword = document.getElementById('profileLoginPassword');
const profileLoginError = document.getElementById('profileLoginError');
const profileLoginBackButton = document.getElementById('profileLoginBackButton');

const PROFILE_STORAGE_KEY = 'apprenticeship-active-profile-v1';
const STORAGE_KEY = 'apprenticeship-tracker-v2';
const VIEWED_STORAGE_KEY = 'apprenticeship-viewed-v1';
const CUSTOM_LINKS_STORAGE_KEY = 'apprenticeship-custom-links-v1';
const OFFERS_CACHE_KEY = 'apprenticeship-offers-cache-v1';
const OFFERS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 heures
const TRACKING_STATUSES = ['A contacter', 'Candidature envoyee', 'Entretien', 'Refusee', 'Acceptee'];
const PROFILE_LABELS = {
  admin: 'Admin (tests)',
  copine: 'Célest',
};
const PROFILE_ORDER = ['admin', 'copine'];

let activeProfile = getStoredProfile();
let profileIntroTimer = null;
let searchCascadeTimer = null;
let pendingProfileLogin = '';
let mobileOffersExpanded = false;

function isMobileViewport() {
  return window.innerWidth <= 760;
}

function updateMobileOffersToggleUI() {
  if (!offersPanel || !mobileOffersToggle) {
    return;
  }

  const mobile = isMobileViewport();
  if (!mobile) {
    offersPanel.classList.remove('mobile-collapsed');
    mobileOffersToggle.setAttribute('aria-expanded', 'true');
    return;
  }

  offersPanel.classList.toggle('mobile-collapsed', !mobileOffersExpanded);
  mobileOffersToggle.setAttribute('aria-expanded', mobileOffersExpanded ? 'true' : 'false');
}

function updateMobileOffersToggleLabel() {
  if (!mobileOffersToggle) {
    return;
  }

  const count = state.filteredOffers.length;
  if (isMobileViewport() && !mobileOffersExpanded) {
    mobileOffersToggle.textContent = `Voir les offres (${count})`;
  } else if (isMobileViewport()) {
    mobileOffersToggle.textContent = 'Masquer les offres';
  } else {
    mobileOffersToggle.textContent = 'Voir les offres';
  }
}

const state = {
  activeProfile,
  offers: [],
  filteredOffers: [],
  sourceStatuses: [],
  selectedSource: '',
  tracked: loadTracking(),
  viewed: loadViewed(),
  customLinks: loadCustomLinks(),
  adminCacheInfo: null,
};

let mapInstance = null;
let markersLayer = null;
let layoutSyncRaf = null;

function getStoredProfile() {
  const stored = (localStorage.getItem(PROFILE_STORAGE_KEY) || '').trim().toLowerCase();
  return PROFILE_LABELS[stored] ? stored : '';
}

function getProfileStorageKey(baseKey) {
  const profile = activeProfile || 'admin';
  return `${baseKey}-${profile}`;
}

function loadTracking() {
  try {
    return JSON.parse(localStorage.getItem(getProfileStorageKey(STORAGE_KEY)) || '{}');
  } catch {
    return {};
  }
}

function saveTracking() {
  localStorage.setItem(getProfileStorageKey(STORAGE_KEY), JSON.stringify(state.tracked));
}

function loadViewed() {
  try {
    return JSON.parse(localStorage.getItem(getProfileStorageKey(VIEWED_STORAGE_KEY)) || '{}');
  } catch {
    return {};
  }
}

function saveViewed() {
  localStorage.setItem(getProfileStorageKey(VIEWED_STORAGE_KEY), JSON.stringify(state.viewed));
}

function loadCustomLinks() {
  try {
    return JSON.parse(localStorage.getItem(getProfileStorageKey(CUSTOM_LINKS_STORAGE_KEY)) || '{}');
  } catch {
    return {};
  }
}

function saveCustomLinks() {
  localStorage.setItem(getProfileStorageKey(CUSTOM_LINKS_STORAGE_KEY), JSON.stringify(state.customLinks));
}

function updateActiveProfileLabel() {
  if (!activeProfileLabel) {
    return;
  }
  activeProfileLabel.textContent = PROFILE_LABELS[activeProfile] || 'Aucun';
}

function updateAdminControlsVisibility() {
  if (!adminTabButton) {
    return;
  }

  const isAdmin = activeProfile === 'admin';
  adminTabButton.classList.toggle('hidden', !isAdmin);

  if (adminCacheGuard) {
    adminCacheGuard.classList.toggle('hidden', isAdmin);
  }
  if (adminCacheContent) {
    adminCacheContent.classList.toggle('hidden', !isAdmin);
  }

  if (!isAdmin && adminTab?.classList.contains('active')) {
    setActiveTab('offers');
  }
}

function showProfileGate() {
  if (!profileGate) {
    return;
  }
  profileGate.classList.remove('hidden');
  document.body.classList.add('profile-locked');
}

function hideProfileGate() {
  if (!profileGate) {
    return;
  }
  profileGate.classList.add('hidden');
  document.body.classList.remove('profile-locked');
}

function hideProfileIntro() {
  if (!profileIntro) {
    return;
  }
  if (profileIntroTimer) {
    clearTimeout(profileIntroTimer);
    profileIntroTimer = null;
  }
  profileIntro.classList.remove('launching');
  profileIntro.classList.remove('fading-out');
  profileIntro.classList.add('hidden');
}

function triggerSearchCascade() {
  document.body.classList.remove('search-cascade-active');
  if (searchCascadeTimer) {
    clearTimeout(searchCascadeTimer);
  }

  requestAnimationFrame(() => {
    document.body.classList.add('search-cascade-active');
    searchCascadeTimer = setTimeout(() => {
      document.body.classList.remove('search-cascade-active');
      searchCascadeTimer = null;
    }, 1300);
  });
}

function showProfileIntroThenUnlock(profile) {
  if (profile === 'admin' || !profileIntro) {
    hideProfileGate();
    hideProfileIntro();
    triggerSearchCascade();
    return;
  }

  const introTitle = profileIntro.querySelector('h2');
  const introText = profileIntro.querySelector('p:last-of-type');
  if (introTitle) {
    introTitle.textContent = `Bonjour ${PROFILE_LABELS[profile] || 'profil'}`;
  }
  if (introText) {
    introText.textContent = 'Ton espace se révèle...';
  }

  hideProfileGate();
  profileIntro.classList.remove('launching');
  profileIntro.classList.remove('fading-out');
  profileIntro.classList.remove('hidden');
  document.body.classList.add('profile-locked');

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const greetingMs = prefersReducedMotion ? 450 : 950;
  const fadeOutMs = prefersReducedMotion ? 180 : 520;
  const totalMs = prefersReducedMotion ? 980 : 2100;

  setTimeout(() => {
    profileIntro.classList.add('launching');
  }, greetingMs);

  setTimeout(() => {
    profileIntro.classList.add('fading-out');
  }, Math.max(greetingMs + 120, totalMs - fadeOutMs));

  profileIntroTimer = setTimeout(() => {
    hideProfileIntro();
    document.body.classList.remove('profile-locked');
    triggerSearchCascade();
  }, totalMs);
}

function resetWorkingStateForProfile() {
  state.offers = [];
  state.filteredOffers = [];
  state.sourceStatuses = [];
  state.selectedSource = '';
  state.tracked = loadTracking();
  state.viewed = loadViewed();
  state.customLinks = loadCustomLinks();
  coverLetterOutput.value = '';
  linkedinOutput.value = '';
  if (profileForm) {
    profileForm.reset();
  }
  state.adminCacheInfo = null;

  updateFilterOptions();
  renderSourceStatuses();
  applyOfferFilters();
  renderTracking();
  renderAdminCacheInfo();
}

function showProfileLoginForm(profile) {
  if (!profileChoiceView || !profileLoginView || !PROFILE_LABELS[profile]) {
    return;
  }

  pendingProfileLogin = profile;
  profileLoginTitle.textContent = profile === 'admin' ? 'Connexion Admin' : 'Connexion Célest';
  profileChoiceView.classList.add('hidden');
  profileLoginView.classList.remove('hidden');
  profileLoginPassword.value = '';
  profileLoginError.classList.add('hidden');
  profileLoginPassword.focus();
}

function hideProfileLoginForm() {
  if (!profileChoiceView || !profileLoginView) {
    return;
  }

  pendingProfileLogin = '';
  profileLoginView.classList.add('hidden');
  profileChoiceView.classList.remove('hidden');
  profileLoginPassword.value = '';
  profileLoginError.classList.add('hidden');
}

async function verifyCelextimePassword(password, passwordConfirm = password) {
  try {
    const response = await fetch('/api/admin/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password || '', passwordConfirm: passwordConfirm || '' }),
    });

    const data = await readApiResponse(response, '/api/admin/verify-password');
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error || 'Mot de passe Celextime invalide.' };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Validation mot de passe impossible: ${error.message}` };
  }
}

async function verifyCopinePassword(password) {
  try {
    const response = await fetch('/api/copine/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password || '' }),
    });

    const data = await readApiResponse(response, '/api/copine/verify-password');
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error || 'Mot de passe incorrect.' };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Validation mot de passe impossible: ${error.message}` };
  }
}

function selectProfile(profile, options = {}) {
  if (!PROFILE_LABELS[profile]) {
    return;
  }

  activeProfile = profile;
  state.activeProfile = profile;
  localStorage.setItem(PROFILE_STORAGE_KEY, profile);
  updateActiveProfileLabel();
  updateAdminControlsVisibility();
  resetWorkingStateForProfile();

  if (!options.keepGateOpen) {
    showProfileIntroThenUnlock(profile);
  }

  if (profile === 'admin') {
    loadAdminCacheInfo();
  }

  statusText.textContent = `Profil actif: ${PROFILE_LABELS[profile]}. Lance une collecte pour ce profil.`;
}

function normalizeCustomUrl(value) {
  const raw = (value || '').trim();
  if (!raw) {
    return '';
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function buildGoogleSearchUrl(offer) {
  const q = encodeURIComponent(
    `${offer?.title || ''} ${offer?.company || ''} ${offer?.city || offer?.location || ''} alternance`.trim()
  );
  return `https://www.google.com/search?q=${q}`;
}

async function readApiResponse(response, endpointLabel) {
  const contentType = response.headers.get('content-type') || '';
  const bodyText = await response.text();

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(bodyText || '{}');
    } catch {
      throw new Error(`Reponse JSON invalide pour ${endpointLabel}`);
    }
  }

  if (/<!doctype html|<html/i.test(bodyText)) {
    throw new Error(
      `Le serveur a renvoye du HTML pour ${endpointLabel}. Redemarre le serveur pour charger les nouvelles routes API.`
    );
  }

  if (!bodyText.trim()) {
    return {};
  }

  throw new Error(`Reponse inattendue pour ${endpointLabel}: ${bodyText.slice(0, 140)}`);
}

function updateCustomLink(offerId, value) {
  if (!offerId) {
    return '';
  }

  const normalized = normalizeCustomUrl(value);
  if (normalized) {
    state.customLinks[offerId] = normalized;
  } else {
    delete state.customLinks[offerId];
  }
  saveCustomLinks();
  return normalized;
}

function initSpaceCats() {
  if (!spaceCats) {
    return;
  }

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const catCount = prefersReducedMotion ? 8 : 18;
  const cats = ['\u{1F63A}', '\u{1F638}', '\u{1F639}', '\u{1F63B}', '\u{1F63C}', '\u{1F63D}'];

  for (let i = 0; i < catCount; i += 1) {
    const cat = document.createElement('span');
    cat.className = 'cat-float';
    cat.textContent = cats[i % cats.length];

    const left = Math.random() * 96;
    const top = Math.random() * 96;
    const size = 0.9 + Math.random() * 1.3;
    const duration = 7 + Math.random() * 8;
    const delay = -Math.random() * duration;
    const opacity = 0.12 + Math.random() * 0.24;

    cat.style.left = `${left}%`;
    cat.style.top = `${top}%`;
    cat.style.fontSize = `${size}rem`;
    cat.style.opacity = String(opacity);
    cat.style.animationDuration = `${duration}s`;
    cat.style.animationDelay = `${delay}s`;

    spaceCats.appendChild(cat);
  }
}

function markOfferViewed(offer) {
  if (!offer?.id) {
    return;
  }
  state.viewed[offer.id] = {
    viewedAt: new Date().toISOString(),
    title: offer.title,
  };
  saveViewed();
}

function setActiveTab(tabName) {
  const isOffers = tabName === 'offers';
  const isTracking = tabName === 'tracking';
  const isAdmin = tabName === 'admin';

  offersTab.classList.toggle('active', isOffers);
  trackingTab.classList.toggle('active', isTracking);
  if (adminTab) {
    adminTab.classList.toggle('active', isAdmin);
  }

  offersTabButton.classList.toggle('active', isOffers);
  trackingTabButton.classList.toggle('active', isTracking);
  if (adminTabButton) {
    adminTabButton.classList.toggle('active', isAdmin);
  }
}

function updateFilterOptions() {
  const uniqueLocations = Array.from(new Set(state.offers.map((offer) => offer.city).filter(Boolean))).sort();
  const uniqueSizes = Array.from(new Set(state.offers.map((offer) => offer.companySizeCategory).filter(Boolean))).sort();
  const uniqueStudyLevels = Array.from(
    new Set(state.offers.map((offer) => offer.studyLevelCategory).filter(Boolean))
  ).sort();

  locationFilter.innerHTML = '<option value="">Toutes les villes</option>';
  uniqueLocations.forEach((location) => {
    const option = document.createElement('option');
    option.value = location;
    option.textContent = location;
    locationFilter.appendChild(option);
  });

  companySizeFilter.innerHTML = '<option value="">Toutes les tailles d\'entreprise</option>';
  uniqueSizes.forEach((size) => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = size;
    companySizeFilter.appendChild(option);
  });

  studyLevelFilter.innerHTML = '<option value="">Tous les niveaux d\'etude</option>';
  uniqueStudyLevels.forEach((level) => {
    const option = document.createElement('option');
    option.value = level;
    option.textContent = level;
    studyLevelFilter.appendChild(option);
  });
}

function buildOpenOfferUrl(offer) {
  const chosenUrl = state.customLinks[offer.id] || offer.url || '';
  const params = new URLSearchParams({
    url: chosenUrl,
    source: offer.source || '',
    title: offer.title || '',
    company: offer.company || '',
    city: offer.city || offer.location || '',
  });
  return `/api/open-offer?${params.toString()}`;
}

function updateTrackingNote(itemId, note) {
  if (!state.tracked[itemId]) {
    return;
  }
  state.tracked[itemId].note = note;
  state.tracked[itemId].updatedAt = new Date().toISOString();
  saveTracking();
}

function ensureMap() {
  if (mapInstance || !offerMap || typeof L === 'undefined') {
    return;
  }

  mapInstance = L.map('offerMap', {
    zoomControl: true,
  }).setView([48.8566, 2.3522], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapInstance);

  markersLayer = L.layerGroup().addTo(mapInstance);
}

function renderMap() {
  ensureMap();
  if (!mapInstance || !markersLayer) {
    return;
  }

  markersLayer.clearLayers();

  const withGeo = state.filteredOffers.filter(
    (offer) => typeof offer.latitude === 'number' && typeof offer.longitude === 'number'
  );

  withGeo.slice(0, 800).forEach((offer) => {
    const marker = L.circleMarker([offer.latitude, offer.longitude], {
      radius: state.tracked[offer.id] ? 7 : 5,
      color: state.tracked[offer.id] ? '#0f766e' : '#ef6c3a',
      fillColor: state.tracked[offer.id] ? '#0f766e' : '#ef6c3a',
      fillOpacity: 0.75,
      weight: 1,
    });
    marker.bindPopup(`<strong>${offer.title}</strong><br/>${offer.company}<br/>${offer.city || offer.location}`);
    markersLayer.addLayer(marker);
  });

  if (withGeo.length > 0) {
    const bounds = L.latLngBounds(withGeo.map((offer) => [offer.latitude, offer.longitude]));
    mapInstance.fitBounds(bounds.pad(0.2));
  }
}

function syncOffersPanelHeightWithSidebar() {
  if (!offersPanel || !sidebar || !offerList || !offersTab?.classList.contains('active')) {
    return;
  }

  // On mobile/tablette, laisser le flux naturel.
  if (window.innerWidth <= 1180) {
    offersPanel.style.height = '';
    offerList.style.maxHeight = '';
    return;
  }

  const sidebarHeight = Math.floor(sidebar.getBoundingClientRect().height);
  if (!sidebarHeight || sidebarHeight < 120) {
    return;
  }

  offersPanel.style.height = `${sidebarHeight}px`;

  const panelRect = offersPanel.getBoundingClientRect();
  const listRect = offerList.getBoundingClientRect();
  const panelStyles = window.getComputedStyle(offersPanel);
  const paddingBottom = parseFloat(panelStyles.paddingBottom || '0');
  const listTopOffset = listRect.top - panelRect.top;
  const maxListHeight = sidebarHeight - listTopOffset - paddingBottom;

  offerList.style.maxHeight = `${Math.max(160, Math.floor(maxListHeight))}px`;
}

function requestLayoutSync() {
  updateMobileOffersToggleUI();

  if (layoutSyncRaf) {
    cancelAnimationFrame(layoutSyncRaf);
  }

  layoutSyncRaf = requestAnimationFrame(() => {
    layoutSyncRaf = null;
    syncOffersPanelHeightWithSidebar();
  });
}

function applyOfferFilters() {
  const location = locationFilter.value;
  const companySize = companySizeFilter.value;
  const studyLevel = studyLevelFilter.value;
  const unseenOnly = unseenOnlyFilter.checked;
  const keyword = (keywordFilter.value || '').trim().toLowerCase();

  state.filteredOffers = state.offers.filter((offer) => {
    const locationOk = !location || offer.city === location;
    const sizeOk = !companySize || offer.companySizeCategory === companySize;
    const studyLevelOk = !studyLevel || offer.studyLevelCategory === studyLevel;
    const unseenOk = !unseenOnly || (!state.viewed[offer.id] && !state.tracked[offer.id]);

    let sourceOk = true;
    if (state.selectedSource) {
      if (state.selectedSource === 'La Bonne Alternance API') {
        sourceOk = offer.source.startsWith('La Bonne Alternance');
      } else {
        sourceOk = offer.source === state.selectedSource || offer.source.startsWith(state.selectedSource);
      }
    }

    const searchableText = [
      offer.title,
      offer.company,
      offer.description,
      offer.city,
      offer.location,
      offer.source,
      offer.contractType,
      offer.studyLevel,
      offer.studyLevelCategory,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const keywordOk = !keyword || searchableText.includes(keyword);

    return locationOk && sizeOk && studyLevelOk && unseenOk && sourceOk && keywordOk;
  });

  // Affichage strict du plus recent au plus ancien.
  state.filteredOffers.sort((a, b) => {
    const aTime = a.postedAt ? new Date(a.postedAt).getTime() : NaN;
    const bTime = b.postedAt ? new Date(b.postedAt).getTime() : NaN;
    const aValid = Number.isFinite(aTime);
    const bValid = Number.isFinite(bTime);

    if (!aValid && !bValid) return 0;
    if (!aValid) return 1;
    if (!bValid) return -1;
    return bTime - aTime;
  });

  renderOffers();
  renderMap();
}

function renderSourceStatuses() {
  sourceStatusList.innerHTML = '';

  if (!state.sourceStatuses.length) {
    sourceStatusList.innerHTML = '<p>Le statut des sources apparaitra apres la premiere collecte.</p>';
    return;
  }

  const allItem = document.createElement('button');
  allItem.type = 'button';
  allItem.className = `source-item source-filter ${!state.selectedSource ? 'source-selected' : ''}`;
  allItem.innerHTML = '<strong>Toutes les sources</strong><span>Afficher toutes les offres</span>';
  allItem.addEventListener('click', () => {
    state.selectedSource = '';
    renderSourceStatuses();
    applyOfferFilters();
  });
  sourceStatusList.appendChild(allItem);

  state.sourceStatuses.forEach((status) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `source-item source-filter ${status.status === 'ok' ? 'source-ok' : 'source-error'} ${
      state.selectedSource === status.source ? 'source-selected' : ''
    }`;
    item.innerHTML = `
      <strong>${status.source}</strong>
      <span>${status.status === 'ok' ? `OK - ${status.fetched} offres` : 'Erreur'}</span>
      ${status.error ? `<small>${status.error}</small>` : ''}
    `;
    item.addEventListener('click', () => {
      state.selectedSource = state.selectedSource === status.source ? '' : status.source;
      renderSourceStatuses();
      applyOfferFilters();
    });
    sourceStatusList.appendChild(item);
  });

  requestLayoutSync();
}

function renderOffers() {
  offerList.innerHTML = '';

  if (state.filteredOffers.length === 0) {
    offerList.innerHTML = '<p>Aucune offre ne correspond aux filtres actuels.</p>';
    offerCount.textContent = '0';
    updateMobileOffersToggleLabel();
    requestLayoutSync();
    return;
  }

  offerCount.textContent = `${state.filteredOffers.length}`;
  updateMobileOffersToggleLabel();

  state.filteredOffers.forEach((offer, index) => {
    const inPipeline = Boolean(state.tracked[offer.id]);
    const viewed = Boolean(state.viewed[offer.id]);
    const customUrl = state.customLinks[offer.id] || '';
    const openUrl = buildOpenOfferUrl(offer);
    const googleUrl = buildGoogleSearchUrl(offer);
    const card = document.createElement('article');
    card.className = `offer-card ${inPipeline ? 'offer-in-pipeline' : ''} ${viewed ? 'offer-viewed' : ''} ${offer.unavailable ? 'offer-unavailable' : ''}`;
    card.innerHTML = `
      <h4>${offer.title}</h4>
      <p class="offer-meta">${offer.company} • ${offer.city || offer.location}</p>
      <p class="offer-meta">Taille: ${offer.companySizeCategory || 'Inconnue'} • Niveau: ${offer.studyLevelCategory || 'Non precise'}</p>
      <p class="offer-meta">Source: ${offer.source}</p>
      <span class="link-badge ${offer.linkMode === 'fallback' ? 'link-fallback' : 'link-direct'}">
        ${offer.linkMode === 'fallback' ? 'Lien de secours' : 'Lien direct'}
      </span>
      ${offer.unavailable ? `<span class="unavailable-badge">Plus disponible${offer.unavailableSince ? ' depuis le ' + new Date(offer.unavailableSince).toLocaleDateString('fr-FR') : ''}</span>` : ''}
      ${viewed ? '<span class="viewed-badge">Deja ouverte</span>' : ''}
      ${inPipeline ? '<span class="pipeline-badge">Deja dans le pipeline</span>' : ''}
      <div class="offer-actions-row">
        <a class="offer-link" href="${openUrl}" target="_blank" rel="noopener noreferrer">Voir l'offre</a>
        <a class="offer-google" href="${googleUrl}" target="_blank" rel="noopener noreferrer">Recherche Google</a>
      </div>
      <div class="custom-link-row">
        <input class="custom-link-input" type="text" value="${customUrl}" placeholder="Lien perso (optionnel si fallback KO)" />
        <button class="custom-link-open" type="button">Ouvrir lien perso</button>
      </div>
      <button class="offer-add" type="button" ${inPipeline ? 'disabled' : ''}>
        ${inPipeline ? 'Ajoutee' : 'Ajouter au pipeline'}
      </button>
    `;

    card.addEventListener('click', async (event) => {
      const target = event.target;
      if (target.closest('a, button, input, textarea, select, label')) {
        return;
      }
      markOfferViewed(offer);
      await generateTemplates(offer);
      renderOffers();
      setActiveTab('offers');
    });

    const offerLink = card.querySelector('.offer-link');
    offerLink.addEventListener('click', () => {
      markOfferViewed(offer);
      renderOffers();
    });

    const googleLink = card.querySelector('.offer-google');
    googleLink.addEventListener('click', () => {
      markOfferViewed(offer);
      renderOffers();
    });

    const customInput = card.querySelector('.custom-link-input');
    customInput.addEventListener('blur', () => {
      const normalized = updateCustomLink(offer.id, customInput.value);
      customInput.value = normalized;
      renderTracking();
    });

    const customOpenButton = card.querySelector('.custom-link-open');
    customOpenButton.addEventListener('click', () => {
      const normalized = updateCustomLink(offer.id, customInput.value);
      customInput.value = normalized;
      if (!normalized) {
        statusText.textContent = 'Lien personnalise invalide. Utilise un URL complet ou un domaine valide.';
        return;
      }

      markOfferViewed(offer);
      renderOffers();
      renderTracking();
      window.open(normalized, '_blank', 'noopener,noreferrer');
    });

    const addButton = card.querySelector('.offer-add');
    addButton.addEventListener('click', async () => {
      markOfferViewed(offer);
      addToTracking(offer);
      await generateTemplates(offer);
      renderOffers();
    });

    card.style.animationDelay = `${index * 30}ms`;
    offerList.appendChild(card);
  });

  requestLayoutSync();
}

function addToTracking(offer) {
  if (!state.tracked[offer.id]) {
    state.tracked[offer.id] = {
      id: offer.id,
      title: offer.title,
      company: offer.company,
      url: offer.url,
      linkMode: offer.linkMode,
      location: offer.location,
      city: offer.city,
      source: offer.source,
      status: 'A contacter',
      note: '',
      updatedAt: new Date().toISOString(),
    };
    saveTracking();
  }
  applyOfferFilters();
  renderTracking();
}

function deleteTrackingItem(itemId) {
  if (!state.tracked[itemId]) {
    return;
  }
  delete state.tracked[itemId];
  saveTracking();
  applyOfferFilters();
  renderTracking();
}

function updateTrackingStatus(itemId, status) {
  if (!state.tracked[itemId]) {
    return;
  }
  state.tracked[itemId].status = status;
  state.tracked[itemId].updatedAt = new Date().toISOString();
  saveTracking();
  renderTracking();
}

function renderTracking() {
  const items = Object.values(state.tracked);
  trackingBoard.innerHTML = '';
  trackingCount.textContent = `${items.length}`;

  if (items.length === 0) {
    trackingBoard.innerHTML = '<p>Aucune candidature suivie pour le moment.</p>';
    return;
  }

  TRACKING_STATUSES.forEach((status) => {
    const column = document.createElement('section');
    column.className = 'tracking-column';

    const columnItems = items
      .filter((item) => item.status === status)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const header = document.createElement('h3');
    header.textContent = `${status} (${columnItems.length})`;
    column.appendChild(header);

    if (columnItems.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'column-empty';
      empty.textContent = 'Aucune candidature';
      column.appendChild(empty);
    }

    columnItems.forEach((item) => {
      const googleUrl = buildGoogleSearchUrl(item);
      const customUrl = state.customLinks[item.id] || '';
      const openUrl = buildOpenOfferUrl(item);
      const card = document.createElement('article');
      card.className = 'track-item';
      card.innerHTML = `
        <strong>${item.title}</strong>
        <div>${item.company}</div>
        <small>${item.city || item.location || 'Localisation non precisee'}</small>
        <small>Source: ${item.source || 'N/A'}</small>
        <div class="track-links-row">
          <a class="track-link" href="${openUrl}" target="_blank" rel="noopener noreferrer">Retourner a l'offre</a>
          <a class="track-link alt" href="${googleUrl}" target="_blank" rel="noopener noreferrer">Google</a>
        </div>
        ${customUrl ? `<small>Lien perso actif</small>` : ''}
      `;

      const select = document.createElement('select');
      TRACKING_STATUSES.forEach((optionStatus) => {
        const option = document.createElement('option');
        option.value = optionStatus;
        option.textContent = optionStatus;
        if (optionStatus === item.status) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      select.addEventListener('change', () => {
        updateTrackingStatus(item.id, select.value);
      });

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'track-delete';
      removeButton.textContent = 'Supprimer';
      removeButton.addEventListener('click', () => {
        deleteTrackingItem(item.id);
      });

      const noteToggle = document.createElement('button');
      noteToggle.type = 'button';
      noteToggle.className = 'track-note-toggle';
      noteToggle.textContent = 'Ouvrir note';

      const noteArea = document.createElement('textarea');
      noteArea.className = 'track-note-area hidden';
      noteArea.rows = 4;
      noteArea.placeholder = 'Ajouter une note perso: relance, feedback entretien, prochaines actions...';
      noteArea.value = item.note || '';

      noteToggle.addEventListener('click', () => {
        const isHidden = noteArea.classList.contains('hidden');
        noteArea.classList.toggle('hidden', !isHidden);
        noteToggle.textContent = isHidden ? 'Fermer note' : 'Ouvrir note';
      });

      noteArea.addEventListener('input', () => {
        updateTrackingNote(item.id, noteArea.value);
      });

      card.appendChild(select);
      card.appendChild(noteToggle);
      card.appendChild(noteArea);
      card.appendChild(removeButton);
      column.appendChild(card);
    });

    trackingBoard.appendChild(column);
  });

  requestLayoutSync();
}

function getProfile() {
  const values = new FormData(profileForm);
  return {
    firstName: values.get('firstName')?.toString().trim(),
    lastName: values.get('lastName')?.toString().trim(),
    formation: values.get('formation')?.toString().trim(),
    skills: values.get('skills')?.toString().trim(),
    email: values.get('email')?.toString().trim(),
    phone: values.get('phone')?.toString().trim(),
  };
}

async function generateTemplates(offer) {
  const profile = getProfile();

  if (!profile.firstName || !profile.lastName || !profile.formation || !profile.skills || !profile.email || !profile.phone) {
    statusText.textContent = 'Complete d\'abord le profil pour generer une lettre personnalisee.';
    return;
  }

  statusText.textContent = `Generation de templates pour ${offer.company}...`;

  try {
    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, offer }),
    });

    const data = await readApiResponse(response, '/api/templates');

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    coverLetterOutput.value = data.coverLetter || '';
    linkedinOutput.value = data.linkedinHook || '';
    statusText.textContent = 'Lettre et accroche generees. Clique sur Suivi pour organiser les candidatures.';
  } catch (error) {
    statusText.textContent = `Erreur generation templates: ${error.message}`;
  }
}

// ── Cache local des offres (localStorage, TTL 12h) ──────────────────────────
function buildOffersCacheLocalKey(profile, city, start) {
  return `${OFFERS_CACHE_KEY}-${(profile || 'admin').toLowerCase()}-${city}-${start}`;
}

function saveOffersToLocalCache(profile, city, start, data) {
  try {
    const key = buildOffersCacheLocalKey(profile, city, start);
    localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch (e) {
    // localStorage plein ou indisponible — on ignore silencieusement
  }
}

function loadOffersFromLocalCache(profile, city, start) {
  try {
    const key = buildOffersCacheLocalKey(profile, city, start);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.savedAt || !entry.data) return null;
    if (Date.now() - entry.savedAt > OFFERS_CACHE_TTL_MS) return null;
    return { data: entry.data, savedAt: entry.savedAt };
  } catch {
    return null;
  }
}

function clearOffersLocalCache(profile, city, start) {
  try {
    const key = buildOffersCacheLocalKey(profile, city, start);
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

async function scrapeOffers(forceRefresh = false) {
  const city = cityInput.value.trim() || 'Paris';
  const start = startInput.value.trim() || 'septembre 2026';
  if (!state.activeProfile) {
    showProfileGate();
    statusText.textContent = 'Choisis d\'abord un profil pour acceder a la recherche.';
    return;
  }

  // -- Cache local : si pas force-refresh, servir depuis localStorage --
  if (!forceRefresh) {
    const cached = loadOffersFromLocalCache(state.activeProfile, city, start);
    if (cached) {
      state.offers = cached.data.offers || [];
      state.sourceStatuses = cached.data.sourceStatuses || [];
      updateFilterOptions();
      applyOfferFilters();
      renderSourceStatuses();
      renderTracking();
      const age = Math.round((Date.now() - cached.savedAt) / 60000);
      statusText.textContent = `${state.offers.length} offres chargées depuis le cache local (sauvegardé il y a ${age} min). Clique sur ↺ pour actualiser.`;
      return;
    }
  }

  // -- Sinon, appel serveur --
  statusText.textContent = forceRefresh ? 'Rafraîchissement forcé en cours (peut prendre 1-2 min)...' : 'Scraping en cours...';
  scrapeButton.disabled = true;
  refreshButton.disabled = true;

  try {
    const url = `/api/offers?city=${encodeURIComponent(city)}&start=${encodeURIComponent(start)}&profile=${encodeURIComponent(
      state.activeProfile
    )}${forceRefresh ? '&refresh=true' : ''}`;
    const response = await fetch(url);
    const data = await readApiResponse(response, '/api/offers');

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    // Sauvegarder dans le cache local
    saveOffersToLocalCache(state.activeProfile, city, start, data);

    state.offers = data.offers || [];
    state.sourceStatuses = data.sourceStatuses || [];
    updateFilterOptions();
    applyOfferFilters();
    renderSourceStatuses();
    renderTracking();

    const sourceErrors = (data.errors || []).length;
    const totalFetchedBeforeDedup = data.totalFetchedBeforeDedup ?? state.offers.length;
    const totalAfterDedup = data.totalAfterDedup ?? state.offers.length;
    const totalMatchedHeuristic = data.totalMatchedHeuristic ?? state.offers.length;
    const cacheInfo = data.fromCache
      ? ` [cache serveur du ${new Date(data.cachedAt).toLocaleTimeString('fr-FR')}]`
      : ' [données fraîches]';
    statusText.textContent = sourceErrors
      ? `Collecte: ${totalFetchedBeforeDedup} brutes, ${totalAfterDedup} uniques, ${state.offers.length} affichees (${totalMatchedHeuristic} ciblees ville/date, ${sourceErrors} source(s) en erreur).${cacheInfo}`
      : `Collecte: ${totalFetchedBeforeDedup} brutes, ${totalAfterDedup} uniques, ${state.offers.length} affichees (${totalMatchedHeuristic} ciblees ville/date).${cacheInfo}`;
  } catch (error) {
    statusText.textContent = `Erreur scraping: ${error.message}`;
  } finally {
    scrapeButton.disabled = false;
    refreshButton.disabled = false;
  }
}

function getLocalMentionsByProfile() {
  return PROFILE_ORDER.reduce((acc, profile) => {
    let viewed = {};
    let tracked = {};

    try {
      viewed = JSON.parse(localStorage.getItem(`${VIEWED_STORAGE_KEY}-${profile}`) || '{}');
    } catch {
      viewed = {};
    }

    try {
      tracked = JSON.parse(localStorage.getItem(`${STORAGE_KEY}-${profile}`) || '{}');
    } catch {
      tracked = {};
    }

    acc[profile] = {
      viewedCount: Object.keys(viewed).length,
      pipelineCount: Object.keys(tracked).length,
    };
    return acc;
  }, {});
}

function renderAdminCacheInfo() {
  if (!adminCacheContent || state.activeProfile !== 'admin') {
    return;
  }

  const info = state.adminCacheInfo;
  const localMentions = getLocalMentionsByProfile();
  const totalViewedMentions = Object.values(localMentions).reduce((sum, item) => sum + item.viewedCount, 0);
  const totalPipelineMentions = Object.values(localMentions).reduce((sum, item) => sum + item.pipelineCount, 0);

  metricRuntimeTotal.textContent = `${info?.totals?.cacheEntries ?? 0}`;
  metricPersistentTotal.textContent = `${info?.totals?.persistentEntries ?? 0}`;
  metricViewedMentions.textContent = `${totalViewedMentions}`;
  metricPipelineMentions.textContent = `${totalPipelineMentions}`;
  cacheInfoUpdatedAt.textContent = info?.generatedAt
    ? `Maj ${new Date(info.generatedAt).toLocaleTimeString('fr-FR')}`
    : '--';

  const byAccount = info?.byAccount || {};
  adminAccountStats.innerHTML = '';

  PROFILE_ORDER.forEach((profile) => {
    const serverStats = byAccount[profile] || {
      cacheEntries: 0,
      persistentEntries: 0,
      offersMentioned: 0,
      unavailableMentions: 0,
    };
    const localStats = localMentions[profile] || { viewedCount: 0, pipelineCount: 0 };

    const card = document.createElement('article');
    card.className = 'admin-account-card';
    card.innerHTML = `
      <h4>${PROFILE_LABELS[profile] || profile}</h4>
      <p>Runtime: <strong>${serverStats.cacheEntries}</strong> | Persistant: <strong>${serverStats.persistentEntries}</strong></p>
      <p>Mentions serveur offres: <strong>${serverStats.offersMentioned}</strong> (indispo: ${serverStats.unavailableMentions})</p>
      <p>Mentions locales vues: <strong>${localStats.viewedCount}</strong> | Pipeline: <strong>${localStats.pipelineCount}</strong></p>
    `;
    adminAccountStats.appendChild(card);
  });
}

async function loadAdminCacheInfo() {
  if (state.activeProfile !== 'admin') {
    return;
  }

  adminCacheStatus.textContent = 'Chargement des infos cache serveur...';

  try {
    const response = await fetch(
      `/api/admin/cache-info?profile=${encodeURIComponent(state.activeProfile || '')}`
    );
    const data = await readApiResponse(response, '/api/admin/cache-info');

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de recuperer les infos cache');
    }

    state.adminCacheInfo = data;
    renderAdminCacheInfo();
    adminCacheStatus.textContent = 'Infos cache chargees.';
  } catch (error) {
    adminCacheStatus.textContent = `Erreur infos cache: ${error.message}`;
  }
}

function getCelextimePasswordPayload(required) {
  if (!required) {
    return {};
  }

  return {
    password: celextimePassword.value || '',
    passwordConfirm: celextimePasswordConfirm.value || '',
  };
}

function clearCelextimePasswordInputs() {
  celextimePassword.value = '';
  celextimePasswordConfirm.value = '';
}

async function hasValidCelextimePasswordInputs() {
  const password = celextimePassword.value || '';
  const passwordConfirm = celextimePasswordConfirm.value || '';
  if (!password || !passwordConfirm) {
    return { ok: false, error: 'Mot de passe Celextime requis (double validation).' };
  }
  if (password !== passwordConfirm) {
    return { ok: false, error: 'Les deux mots de passe ne correspondent pas.' };
  }
  return verifyCelextimePassword(password, passwordConfirm);
}

async function executeAdminClearViewed(targetAccount) {
  if (state.activeProfile !== 'admin') {
    adminCacheStatus.textContent = 'Action reservee au profil Admin.';
    return;
  }

  const account = (targetAccount || 'admin').toLowerCase();
  const accountLabel = PROFILE_LABELS[account] || account;
  const requiresPassword = account === 'copine';

  if (requiresPassword) {
    const passwordCheck = await hasValidCelextimePasswordInputs();
    if (!passwordCheck.ok) {
      adminCacheStatus.textContent = passwordCheck.error || 'Mot de passe Celextime invalide pour le compte Célest.';
      return;
    }
  }

  if (!window.confirm(`Confirmer la suppression des mentions offres vues pour ${accountLabel} ?`)) {
    return;
  }

  adminCacheStatus.textContent = `Suppression des mentions vues en cours pour ${accountLabel}...`;
  clearAllViewedButton.disabled = true;
  if (clearViewedBothButton) {
    clearViewedBothButton.disabled = true;
  }
  clearByAccountButton.disabled = true;
  clearByTypeButton.disabled = true;
  clearAllServerCacheButton.disabled = true;

  try {
    const viewedKey = `${VIEWED_STORAGE_KEY}-${account}`;
    localStorage.removeItem(viewedKey);

    if (state.activeProfile === account) {
      state.viewed = {};
      applyOfferFilters();
      renderOffers();
    }

    adminCacheStatus.textContent = `Mentions vues supprimees pour ${accountLabel}.`;
    if (requiresPassword) {
      clearCelextimePasswordInputs();
    }
    loadAdminCacheInfo();
  } catch (error) {
    adminCacheStatus.textContent = `Erreur lors de la suppression: ${error.message}`;
  } finally {
    clearAllViewedButton.disabled = false;
    if (clearViewedBothButton) {
      clearViewedBothButton.disabled = false;
    }
    clearByAccountButton.disabled = false;
    clearByTypeButton.disabled = false;
    clearAllServerCacheButton.disabled = false;
  }
}

async function executeAdminClearViewedBoth() {
  if (state.activeProfile !== 'admin') {
    adminCacheStatus.textContent = 'Action reservee au profil Admin.';
    return;
  }

  const passwordCheck = await hasValidCelextimePasswordInputs();
  if (!passwordCheck.ok) {
    adminCacheStatus.textContent = passwordCheck.error || 'Mot de passe Celextime invalide pour effacer les 2 comptes.';
    return;
  }

  if (!window.confirm('Confirmer la suppression des mentions offres vues pour Admin et Célest ?')) {
    return;
  }

  adminCacheStatus.textContent = 'Suppression des mentions vues en cours pour Admin et Célest...';
  clearAllViewedButton.disabled = true;
  if (clearViewedBothButton) {
    clearViewedBothButton.disabled = true;
  }
  clearByAccountButton.disabled = true;
  clearByTypeButton.disabled = true;
  clearAllServerCacheButton.disabled = true;

  try {
    localStorage.removeItem(`${VIEWED_STORAGE_KEY}-admin`);
    localStorage.removeItem(`${VIEWED_STORAGE_KEY}-copine`);

    state.viewed = {};
    applyOfferFilters();
    renderOffers();

    clearCelextimePasswordInputs();
    adminCacheStatus.textContent = 'Mentions vues supprimees pour les 2 comptes.';
    loadAdminCacheInfo();
  } catch (error) {
    adminCacheStatus.textContent = `Erreur lors de la suppression: ${error.message}`;
  } finally {
    clearAllViewedButton.disabled = false;
    if (clearViewedBothButton) {
      clearViewedBothButton.disabled = false;
    }
    clearByAccountButton.disabled = false;
    clearByTypeButton.disabled = false;
    clearAllServerCacheButton.disabled = false;
  }
}

async function executeAdminCacheClear({ scope, targetAccount = '', cacheType = 'all', requiresPassword }) {
  if (state.activeProfile !== 'admin') {
    adminCacheStatus.textContent = 'Action reservee au profil Admin.';
    return;
  }

  const confirmLabel =
    scope === 'all'
      ? 'Confirmer la purge COMPLETE de tous les caches serveur ?'
      : scope === 'type'
        ? `Confirmer la suppression du type ${cacheType} pour tous les comptes ?`
        : `Confirmer la suppression du compte ${PROFILE_LABELS[targetAccount] || targetAccount} (${cacheType}) ?`;

  if (!window.confirm(confirmLabel)) {
    return;
  }

  adminCacheStatus.textContent = 'Suppression des caches en cours...';
  clearByAccountButton.disabled = true;
  clearByTypeButton.disabled = true;
  clearAllServerCacheButton.disabled = true;

  try {
    const response = await fetch('/api/admin/cache-clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: state.activeProfile,
        scope,
        targetAccount,
        cacheType,
        ...getCelextimePasswordPayload(requiresPassword),
      }),
    });

    const data = await readApiResponse(response, '/api/admin/cache-clear');

    if (!response.ok) {
      throw new Error(data.error || 'Echec de la purge');
    }

    state.adminCacheInfo = data.cacheInfo || null;
    renderAdminCacheInfo();

    if (scope === 'all' || (scope === 'account' && targetAccount === state.activeProfile)) {
      state.offers = [];
      state.filteredOffers = [];
      state.sourceStatuses = [];
      renderSourceStatuses();
      renderOffers();
      renderMap();
    }

    adminCacheStatus.textContent =
      `Purge terminee: runtime=${data.cacheEntriesCleared}, persistant=${data.persistentEntriesCleared}.`;
    clearCelextimePasswordInputs();
    statusText.textContent = 'Caches serveur mis a jour. Lance un scraping pour recharger des donnees fraiches.';
  } catch (error) {
    adminCacheStatus.textContent = `Erreur purge cache: ${error.message}`;
  } finally {
    clearByAccountButton.disabled = false;
    clearByTypeButton.disabled = false;
    clearAllServerCacheButton.disabled = false;
  }
}

scrapeButton.addEventListener('click', () => scrapeOffers(false));
refreshButton.addEventListener('click', () => scrapeOffers(true));
locationFilter.addEventListener('change', applyOfferFilters);
companySizeFilter.addEventListener('change', applyOfferFilters);
studyLevelFilter.addEventListener('change', applyOfferFilters);
unseenOnlyFilter.addEventListener('change', applyOfferFilters);
keywordFilter.addEventListener('input', applyOfferFilters);
offersTabButton.addEventListener('click', () => setActiveTab('offers'));
trackingTabButton.addEventListener('click', () => setActiveTab('tracking'));
if (adminTabButton) {
  adminTabButton.addEventListener('click', () => {
    setActiveTab('admin');
    loadAdminCacheInfo();
  });
}
window.addEventListener('resize', requestLayoutSync);

if (mobileOffersToggle) {
  mobileOffersToggle.addEventListener('click', () => {
    mobileOffersExpanded = !mobileOffersExpanded;
    updateMobileOffersToggleUI();
    updateMobileOffersToggleLabel();
    requestLayoutSync();
  });
}

profileChoiceButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const profile = button.getAttribute('data-profile-choice');
    showProfileLoginForm(profile);
  });
});

if (profileLoginForm) {
  profileLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pendingProfileLogin) {
      return;
    }

    const password = profileLoginPassword.value;
    const passwordCheck = pendingProfileLogin === 'admin'
      ? await verifyCelextimePassword(password, password)
      : await verifyCopinePassword(password);

    if (passwordCheck.ok) {
      const profileToSelect = pendingProfileLogin;
      hideProfileLoginForm();
      selectProfile(profileToSelect);
      return;
    }

    profileLoginError.textContent = passwordCheck.error || 'Mot de passe incorrect.';
    profileLoginError.classList.remove('hidden');
    profileLoginPassword.value = '';
    profileLoginPassword.focus();
  });
}

if (profileLoginBackButton) {
  profileLoginBackButton.addEventListener('click', () => {
    hideProfileLoginForm();
  });
}

// Toggle afficher/masquer mot de passe
const loginTogglePwd = document.querySelector('.login-toggle-pwd');
if (loginTogglePwd) {
  loginTogglePwd.addEventListener('click', () => {
    const input = document.getElementById('profileLoginPassword');
    const eyeShow = loginTogglePwd.querySelector('.eye-show');
    const eyeHide = loginTogglePwd.querySelector('.eye-hide');
    if (input.type === 'password') {
      input.type = 'text';
      eyeShow.classList.add('hidden');
      eyeHide.classList.remove('hidden');
      loginTogglePwd.setAttribute('aria-label', 'Masquer le mot de passe');
    } else {
      input.type = 'password';
      eyeShow.classList.remove('hidden');
      eyeHide.classList.add('hidden');
      loginTogglePwd.setAttribute('aria-label', 'Afficher le mot de passe');
    }
  });
}

if (switchProfileButton) {
  switchProfileButton.addEventListener('click', () => {
    showProfileGate();
  });
}

if (clearAllViewedButton) {
  clearAllViewedButton.addEventListener('click', () => {
    executeAdminClearViewed((adminViewedTarget?.value || 'admin').toLowerCase());
  });
}

if (clearViewedBothButton) {
  clearViewedBothButton.addEventListener('click', () => {
    executeAdminClearViewedBoth();
  });
}

if (clearByAccountButton) {
  clearByAccountButton.addEventListener('click', () => {
    const target = (adminAccountTarget.value || 'admin').toLowerCase();
    const type = adminAccountCacheType.value || 'all';
    const requiresPassword = target === 'copine';
    executeAdminCacheClear({
      scope: 'account',
      targetAccount: target,
      cacheType: type,
      requiresPassword,
    });
  });
}

if (clearByTypeButton) {
  clearByTypeButton.addEventListener('click', () => {
    executeAdminCacheClear({
      scope: 'type',
      cacheType: adminTypeCacheType.value || 'ttl',
      requiresPassword: false,
    });
  });
}

if (clearAllServerCacheButton) {
  clearAllServerCacheButton.addEventListener('click', () => {
    executeAdminCacheClear({
      scope: 'all',
      cacheType: 'all',
      requiresPassword: true,
    });
  });
}

initSpaceCats();
updateActiveProfileLabel();
updateAdminControlsVisibility();

// Toujours demander le profil à l'ouverture du site
showProfileGate();
hideProfileIntro();
statusText.textContent = 'Choisis un profil pour commencer.';

renderSourceStatuses();
renderOffers();
renderTracking();
renderMap();
renderAdminCacheInfo();
updateMobileOffersToggleUI();
updateMobileOffersToggleLabel();
requestLayoutSync();
