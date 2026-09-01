// ============================================================
// Job Tracker — recherche, suivi et dashboard
// ============================================================

const $ = (id) => document.getElementById(id);

const cityInput = $('cityInput');
const startInput = $('startInput');
const scrapeButton = $('scrapeButton');
const refreshButton = $('refreshButton');

const keywordFilter = $('keywordFilter');
const contractTypeFilter = $('contractTypeFilter');
const locationFilter = $('locationFilter');
const sourceFilter = $('sourceFilter');
const unseenOnlyFilter = $('unseenOnlyFilter');

const uncheckedSources = new Set();

const statusText = $('statusText');
const scrapeProgressBar = $('scrapeProgressBar');
const scrapeProgressLabel = $('scrapeProgressLabel');

const offersTabButton = $('offersTabButton');
const trackingTabButton = $('trackingTabButton');
const dashboardTabButton = $('dashboardTabButton');
const offersTab = $('offersTab');
const trackingTab = $('trackingTab');
const dashboardTab = $('dashboardTab');

const offerCount = $('offerCount');
const offerList = $('offerList');

const profileForm = $('profileForm');
const sourceStatusList = $('sourceStatusList');
const coverLetterOutput = $('coverLetterOutput');
const linkedinOutput = $('linkedinOutput');

const trackingCount = $('trackingCount');
const trackingBoard = $('trackingBoard');
const addManualButton = $('addManualButton');
const manualAddForm = $('manualAddForm');
const cancelManualAdd = $('cancelManualAdd');
const exportCsvButton = $('exportCsvButton');

const dashTotalOffers = $('dashTotalOffers');
const dashTotalApplications = $('dashTotalApplications');
const dashApplicationRate = $('dashApplicationRate');
const dashTodayApplications = $('dashTodayApplications');

const STORAGE_TRACKED = 'job-tracker-tracked-v1';
const STORAGE_VIEWED = 'job-tracker-viewed-v1';
const STORAGE_PROFILE = 'job-tracker-profile-v1';
const STORAGE_OFFERS_CACHE = 'job-tracker-offers-cache-v1';
const OFFERS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const TRACKING_STATUSES = ['A contacter', 'Candidature envoyée', 'Entretien', 'Refusée', 'Acceptée'];
const JOB_TYPES = ['Non défini', 'CDI', 'CDD', 'Stage', 'Alternance', 'VIE'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Erreur lecture ${key}:`, error);
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Erreur sauvegarde ${key}:`, error);
  }
}

const state = {
  offers: [],
  tracked: loadJSON(STORAGE_TRACKED, {}),
  viewed: loadJSON(STORAGE_VIEWED, {}),
};

let applicationsChartInstance = null;
let typeChartInstance = null;

// ---- storage helpers -------------------------------------------------

function saveTracked() {
  saveJSON(STORAGE_TRACKED, state.tracked);
}

function saveViewed() {
  saveJSON(STORAGE_VIEWED, state.viewed);
}

function getCachedOffers() {
  const cache = loadJSON(STORAGE_OFFERS_CACHE, null);
  if (!cache || Date.now() - cache.cachedAt > OFFERS_CACHE_TTL_MS) {
    return null;
  }
  return cache;
}

function setCachedOffers(offers, sourceStatuses, city) {
  saveJSON(STORAGE_OFFERS_CACHE, {
    offers,
    sourceStatuses,
    city,
    cachedAt: Date.now(),
  });
}

// ---- progress / status -------------------------------------------------

function showProgress(label) {
  scrapeProgressLabel.textContent = label || 'Recherche en cours...';
  scrapeProgressBar.classList.remove('hidden');
}

function hideProgress() {
  scrapeProgressBar.classList.add('hidden');
}

// ---- fetching offers -------------------------------------------------

// Le scraping cote serveur tourne en tache de fond : on interroge /api/jobs
// jusqu'a ce que le resultat soit pret, plutot que de garder une seule requete
// ouverte (ce qui provoquait des erreurs 504). Le scraping interroge desormais
// beaucoup plus de mots-cles sectoriels (banque/fonds/private equity/etc. sur
// LinkedIn + Jobijoba + Talent.com) et prend regulierement 4-5 minutes : le
// timeout client doit rester tres au-dessus de ca, sinon on affiche une erreur
// a l'utilisateur alors meme que le scraping continue en arriere-plan cote
// serveur et aurait fini quelques secondes plus tard.
const JOBS_POLL_INTERVAL_MS = 3000;
const JOBS_POLL_MAX_ATTEMPTS = 240; // ~12 minutes max

async function requestJobs(city, forceRefresh) {
  let refreshFlag = forceRefresh;

  for (let attempt = 0; attempt < JOBS_POLL_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(
      `/api/jobs?city=${encodeURIComponent(city)}&refresh=${refreshFlag ? 'true' : 'false'}`
    );
    if (!response.ok) {
      throw new Error(`Le serveur a répondu avec le statut ${response.status}`);
    }
    const data = await response.json();
    if (!data.inProgress) {
      return data;
    }
    // Ne jamais redemander un refresh une fois le scraping lancé : le serveur
    // le relancerait sinon en boucle a chaque poll.
    refreshFlag = false;
    showProgress(`Recherche en cours... (${Math.round(((attempt + 1) * JOBS_POLL_INTERVAL_MS) / 1000)}s)`);
    await new Promise((resolve) => setTimeout(resolve, JOBS_POLL_INTERVAL_MS));
  }

  throw new Error('La recherche prend trop de temps, réessayez plus tard.');
}

async function fetchOffers(forceRefresh) {
  const city = (cityInput.value || 'Paris').trim();

  if (!forceRefresh) {
    const cached = getCachedOffers();
    if (cached && cached.city === city) {
      state.offers = cached.offers;
      statusText.textContent = `${state.offers.length} offres chargées depuis le cache.`;
      renderSourceStatus(cached.sourceStatuses || []);
      updateLocationFilterOptions();
      updateSourceFilterOptions();
      renderOffers();
      updateDashboard();
      return;
    }
  }

  showProgress('Recherche des offres en cours...');
  statusText.textContent = 'Recherche des offres...';

  try {
    const data = await requestJobs(city, forceRefresh);
    state.offers = data.jobs || [];
    setCachedOffers(state.offers, data.sourceStatuses || [], city);
    statusText.textContent = `${state.offers.length} offres trouvées.`;
    renderSourceStatus(data.sourceStatuses || []);
  } catch (error) {
    console.error(error);
    statusText.textContent = `Erreur lors de la recherche: ${error.message}`;
    renderSourceStatus([{ source: 'Recherche', status: 'error', fetched: 0, error: error.message }]);
  } finally {
    hideProgress();
    updateLocationFilterOptions();
    updateSourceFilterOptions();
    renderOffers();
    updateDashboard();
  }
}

function renderSourceStatus(sourceStatuses) {
  sourceStatusList.innerHTML =
    sourceStatuses
      .map(
        (source) => `
    <div class="source-status-item">
      <span class="source-name">${source.source}</span>
      <span class="source-badge ${source.status === 'ok' ? 'ok' : 'error'}">
        ${source.status === 'ok' ? `✓ ${source.fetched}` : `✕ ${source.error || 'Erreur'}`}
      </span>
    </div>
  `
      )
      .join('') || '<p>Pas de données de source.</p>';
}

// ---- filters -------------------------------------------------

function updateLocationFilterOptions() {
  const locations = new Set();
  state.offers.forEach((offer) => {
    if (offer.location) locations.add(offer.location);
  });

  const currentValue = locationFilter.value;
  locationFilter.innerHTML =
    '<option value="">Localisation</option>' +
    Array.from(locations)
      .sort()
      .map((loc) => `<option value="${loc}">${loc}</option>`)
      .join('');
  locationFilter.value = currentValue;
}

function updateSourceFilterOptions() {
  const sources = new Set();
  state.offers.forEach((offer) => {
    if (offer.source) sources.add(offer.source);
  });

  sourceFilter.innerHTML = Array.from(sources)
    .sort()
    .map((source) => {
      const checked = uncheckedSources.has(source) ? '' : 'checked';
      return `
        <label class="toggle-filter">
          <input type="checkbox" class="source-filter-checkbox" value="${source}" ${checked} />
          ${source}
        </label>
      `;
    })
    .join('');
}

function getFilteredOffers() {
  const keyword = (keywordFilter.value || '').toLowerCase().trim();
  const contractType = (contractTypeFilter.value || '').toLowerCase();
  const location = locationFilter.value || '';
  const unseenOnly = unseenOnlyFilter.checked;

  return state.offers.filter((offer) => {
    if (keyword) {
      const haystack = `${offer.title} ${offer.company} ${offer.description}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    if (contractType) {
      const offerContract = (offer.contractType || '').toLowerCase();
      if (!offerContract.includes(contractType)) return false;
    }
    if (location && offer.location !== location) return false;
    if (offer.source && uncheckedSources.has(offer.source)) return false;
    if (unseenOnly && state.viewed[offer.id]) return false;
    return true;
  });
}

// ---- offers rendering -------------------------------------------------

function renderOffers() {
  const filtered = getFilteredOffers();
  offerCount.textContent = filtered.length;

  offerList.innerHTML =
    filtered
      .map((offer) => {
        const isViewed = !!state.viewed[offer.id];
        const inTracking = !!state.tracked[offer.id];
        return `
      <article class="offer-card ${isViewed ? 'viewed' : ''}" data-offer-id="${offer.id}">
        <div class="offer-card-header">
          <h3>${offer.title || 'Titre non disponible'}</h3>
          <div class="offer-meta">
            <span class="offer-source">${offer.source || 'Source inconnue'}</span>
            ${offer.company ? `<span class="offer-company">${offer.company}</span>` : ''}
          </div>
        </div>
        <div class="offer-details">
          ${offer.location ? `<p><strong>Localisation:</strong> ${offer.location}</p>` : ''}
          ${offer.contractType ? `<p><strong>Contrat:</strong> ${offer.contractType}</p>` : ''}
          ${offer.studyLevel ? `<p><strong>Niveau requis:</strong> ${offer.studyLevel}</p>` : ''}
          ${offer.description ? `<p><strong>Description:</strong> ${offer.description.substring(0, 200)}...</p>` : ''}
        </div>
        <div class="offer-actions">
          <a href="${offer.url || '#'}" target="_blank" rel="noopener" class="btn btn-primary">Voir l'offre</a>
          <button type="button" class="btn btn-secondary add-to-tracking" data-offer-id="${offer.id}">
            ${inTracking ? '✓ En suivi' : '+ Ajouter au suivi'}
          </button>
        </div>
      </article>
    `;
      })
      .join('') || '<p class="empty-state">Aucune offre trouvée. Lancez une recherche.</p>';

  offerList.querySelectorAll('.add-to-tracking').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      addToTracking(btn.getAttribute('data-offer-id'));
    });
  });

  offerList.querySelectorAll('.offer-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.tagName === 'A' || event.target.closest('.add-to-tracking')) {
        return;
      }
      const offerId = card.getAttribute('data-offer-id');
      markViewed(offerId);
      generateTemplates(offerId);
    });
  });
}

function markViewed(offerId) {
  if (!state.viewed[offerId]) {
    state.viewed[offerId] = { viewedAt: new Date().toISOString() };
    saveViewed();
    renderOffers();
  }
}

function generateTemplates(offerId) {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) return;

  const profileData = profileForm ? Object.fromEntries(new FormData(profileForm)) : {};

  coverLetterOutput.value = `Madame, Monsieur,

Je suis vivement intéressé par le poste de ${offer.title || 'cette position'} proposé par ${offer.company || 'votre entreprise'}.

Avec ma formation ${profileData.formation || '[votre formation]'} et mes compétences en ${profileData.skills || '[vos compétences]'}, je suis convaincu de pouvoir contribuer efficacement à votre équipe.

Je me tiens à votre disposition pour échanger sur cette opportunité.

Cordialement,
${profileData.firstName || 'Prénom'} ${profileData.lastName || 'Nom'}`;

  linkedinOutput.value = `Je suis passionné par ${offer.contractType || 'les opportunités'} chez ${offer.company || 'des entreprises ambitieuses'}. Mes compétences: ${profileData.skills || '[vos compétences]'}. Ouvert à en discuter ! 🎯`;
}

// ---- tracking -------------------------------------------------

function addToTracking(offerId) {
  if (!state.tracked[offerId]) {
    const offer = state.offers.find((o) => o.id === offerId);
    state.tracked[offerId] = {
      status: TRACKING_STATUSES[0],
      jobType: 'Non défini',
      note: '',
      addedAt: new Date().toISOString(),
      appliedAt: null,
      title: offer?.title || 'Offre',
      company: offer?.company || '',
      url: offer?.url || '',
    };
    saveTracked();
  }
  renderOffers();
  renderTracking();
}

function addManualTrackingEntry({ title, company, url, jobType }) {
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) return;

  const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  state.tracked[id] = {
    status: TRACKING_STATUSES[0],
    jobType: jobType || 'Non défini',
    note: '',
    addedAt: new Date().toISOString(),
    appliedAt: null,
    manual: true,
    title: cleanTitle,
    company: (company || '').trim(),
    url: (url || '').trim(),
  };
  saveTracked();
  renderTracking();
  updateDashboard();
}

function removeFromTracking(offerId) {
  delete state.tracked[offerId];
  saveTracked();
  renderOffers();
  renderTracking();
  updateDashboard();
}

function renderTracking() {
  const entries = Object.entries(state.tracked);
  trackingCount.textContent = `${entries.length} candidature${entries.length !== 1 ? 's' : ''}`;

  trackingBoard.innerHTML = TRACKING_STATUSES.map((status) => {
    const items = entries.filter(([, item]) => item.status === status);
    return `
      <div class="tracking-column">
        <h3>${status}</h3>
        <div class="tracking-items">
          ${items
            .map(([offerId, item]) => {
              const offer = state.offers.find((o) => o.id === offerId);
              const title = item.title || offer?.title || 'Offre';
              const company = item.company || offer?.company || 'Entreprise inconnue';
              const offerUrl = item.url || offer?.url || '#';
              return `
              <div class="tracking-item" data-offer-id="${offerId}">
                <a class="tracking-item-content" href="${offerUrl}" target="_blank" rel="noopener" title="Voir l'offre">
                  <strong>${title}</strong>
                  <small>${company}</small>
                </a>
                <select class="track-status-select" data-offer-id="${offerId}">
                  ${TRACKING_STATUSES.map(
                    (s) => `<option value="${s}" ${s === item.status ? 'selected' : ''}>${s}</option>`
                  ).join('')}
                </select>
                <select class="track-type-select" data-offer-id="${offerId}">
                  ${JOB_TYPES.map(
                    (t) => `<option value="${t}" ${t === item.jobType ? 'selected' : ''}>${t}</option>`
                  ).join('')}
                </select>
                <textarea class="tracking-note" data-offer-id="${offerId}" placeholder="Notes (relance, contact, retour entretien...)" rows="2">${escapeHtml(item.note || '')}</textarea>
                <button class="track-delete" data-offer-id="${offerId}" type="button">✕</button>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;
  }).join('');

  trackingBoard.querySelectorAll('.track-status-select').forEach((select) => {
    select.addEventListener('change', (event) => {
      const offerId = event.target.getAttribute('data-offer-id');
      const item = state.tracked[offerId];
      if (!item) return;
      item.status = event.target.value;
      if (item.status === 'A contacter') {
        item.appliedAt = null;
      } else if (!item.appliedAt) {
        item.appliedAt = new Date().toISOString();
      }
      saveTracked();
      renderTracking();
      updateDashboard();
    });
  });

  trackingBoard.querySelectorAll('.track-type-select').forEach((select) => {
    select.addEventListener('change', (event) => {
      const offerId = event.target.getAttribute('data-offer-id');
      const item = state.tracked[offerId];
      if (!item) return;
      item.jobType = event.target.value;
      saveTracked();
      updateDashboard();
    });
  });

  trackingBoard.querySelectorAll('.track-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeFromTracking(btn.getAttribute('data-offer-id'));
    });
  });

  // Pas de renderTracking() ici : un re-render sur chaque frappe ferait perdre
  // le focus/curseur du textarea pendant la saisie.
  trackingBoard.querySelectorAll('.tracking-note').forEach((textarea) => {
    textarea.addEventListener('input', (event) => {
      const offerId = event.target.getAttribute('data-offer-id');
      const item = state.tracked[offerId];
      if (!item) return;
      item.note = event.target.value;
      saveTracked();
    });
  });
}

// ---- CSV export -------------------------------------------------

const CSV_BOM = String.fromCharCode(0xfeff);

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[";\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportTrackingCsv() {
  const header = ['Titre', 'Entreprise', 'Statut', 'Type de poste', "Date d'ajout", 'Date de candidature', 'Lien', 'Notes'];

  const rows = Object.entries(state.tracked).map(([offerId, item]) => {
    const offer = state.offers.find((o) => o.id === offerId);
    const title = item.title || offer?.title || 'Offre';
    const company = item.company || offer?.company || '';
    const url = item.url || offer?.url || '';
    const addedAt = item.addedAt ? new Date(item.addedAt).toLocaleDateString('fr-FR') : '';
    const appliedAt = item.appliedAt ? new Date(item.appliedAt).toLocaleDateString('fr-FR') : '';
    return [title, company, item.status, item.jobType, addedAt, appliedAt, url, item.note || ''];
  });

  const csvContent = [header, ...rows].map((row) => row.map(csvEscape).join(';')).join('\r\n');

  const blob = new Blob([CSV_BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `candidatures-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

// ---- dashboard -------------------------------------------------

function updateDashboard() {
  const tracked = Object.values(state.tracked);
  const applied = tracked.filter((item) => item.appliedAt);

  dashTotalOffers.textContent = state.offers.length;
  dashTotalApplications.textContent = applied.length;
  dashApplicationRate.textContent = state.offers.length
    ? `${Math.round((applied.length / state.offers.length) * 100)}%`
    : '0%';

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = applied.filter((item) => item.appliedAt.slice(0, 10) === todayKey).length;
  dashTodayApplications.textContent = todayCount;

  updateApplicationsChart(applied);
  updateTypeChart(tracked);
}

function updateApplicationsChart(applied) {
  const days = [];
  const counts = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    days.push(key.slice(5));
    counts.push(applied.filter((item) => item.appliedAt.slice(0, 10) === key).length);
  }

  const ctx = document.getElementById('applicationsChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (applicationsChartInstance) {
    applicationsChartInstance.data.labels = days;
    applicationsChartInstance.data.datasets[0].data = counts;
    applicationsChartInstance.update();
    return;
  }

  applicationsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Candidatures',
          data: counts,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

function updateTypeChart(tracked) {
  const counts = {};
  tracked.forEach((item) => {
    const type = item.jobType || 'Non défini';
    counts[type] = (counts[type] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const data = Object.values(counts);

  const ctx = document.getElementById('typeChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (typeChartInstance) {
    typeChartInstance.data.labels = labels;
    typeChartInstance.data.datasets[0].data = data;
    typeChartInstance.update();
    return;
  }

  typeChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#9333ea', '#0891b2'],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

// ---- profile persistence -------------------------------------------------

function loadStoredProfile() {
  const stored = loadJSON(STORAGE_PROFILE, null);
  if (stored && profileForm) {
    Object.keys(stored).forEach((key) => {
      const input = profileForm.querySelector(`[name="${key}"]`);
      if (input) input.value = stored[key];
    });
  }
}

if (profileForm) {
  profileForm.addEventListener('change', () => {
    const formData = Object.fromEntries(new FormData(profileForm));
    saveJSON(STORAGE_PROFILE, formData);
  });
}

// ---- tabs -------------------------------------------------

function activateTab(tabName) {
  const tabs = [
    { button: offersTabButton, pane: offersTab, name: 'offers' },
    { button: trackingTabButton, pane: trackingTab, name: 'tracking' },
    { button: dashboardTabButton, pane: dashboardTab, name: 'dashboard' },
  ];

  tabs.forEach(({ button, pane, name }) => {
    const active = name === tabName;
    button.classList.toggle('active', active);
    pane.classList.toggle('active', active);
  });

  if (tabName === 'dashboard') {
    updateDashboard();
  }
}

offersTabButton.addEventListener('click', () => activateTab('offers'));
trackingTabButton.addEventListener('click', () => activateTab('tracking'));
dashboardTabButton.addEventListener('click', () => activateTab('dashboard'));

// ---- event wiring -------------------------------------------------

scrapeButton.addEventListener('click', () => fetchOffers(false));
refreshButton.addEventListener('click', () => fetchOffers(true));

let filterDebounceTimer = null;
keywordFilter.addEventListener('input', () => {
  clearTimeout(filterDebounceTimer);
  filterDebounceTimer = setTimeout(renderOffers, 250);
});
contractTypeFilter.addEventListener('change', renderOffers);
locationFilter.addEventListener('change', renderOffers);
sourceFilter.addEventListener('change', (event) => {
  if (!event.target.classList.contains('source-filter-checkbox')) return;
  const source = event.target.value;
  if (event.target.checked) {
    uncheckedSources.delete(source);
  } else {
    uncheckedSources.add(source);
  }
  renderOffers();
});
unseenOnlyFilter.addEventListener('change', renderOffers);

addManualButton.addEventListener('click', () => {
  manualAddForm.classList.toggle('hidden');
});

cancelManualAdd.addEventListener('click', () => {
  manualAddForm.reset();
  manualAddForm.classList.add('hidden');
});

manualAddForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(manualAddForm));
  addManualTrackingEntry(formData);
  manualAddForm.reset();
  manualAddForm.classList.add('hidden');
});

exportCsvButton.addEventListener('click', exportTrackingCsv);

// ---- init -------------------------------------------------

function init() {
  loadStoredProfile();
  renderTracking();
  updateDashboard();

  const cached = getCachedOffers();
  if (cached) {
    state.offers = cached.offers;
    statusText.textContent = `${state.offers.length} offres chargées depuis le cache.`;
    renderSourceStatus(cached.sourceStatuses || []);
    updateLocationFilterOptions();
    updateSourceFilterOptions();
    renderOffers();
    updateDashboard();
  }
}

document.addEventListener('DOMContentLoaded', init);
