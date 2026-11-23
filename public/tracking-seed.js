'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const marker = 'job-tracker-seed-20261123-v1';
  try {
    if (localStorage.getItem(marker)) return;
    if (typeof state === 'undefined' || !state.tracked || Array.isArray(state.tracked)) throw new Error('Format du suivi incompatible');
    const response = await fetch('tracking-entries.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error(`CSV indisponible (${response.status})`);
    const text = (await response.text()).replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (c === ',' && !quoted) { row.push(field); field = ''; }
      else if ((c === '\n' || c === '\r') && !quoted) {
        row.push(field);
        if (row.some(Boolean)) rows.push(row);
        row = []; field = '';
        if (c === '\r' && text[i + 1] === '\n') i++;
      } else field += c;
    }
    if (quoted) throw new Error('CSV mal formé');
    row.push(field); if (row.some(Boolean)) rows.push(row);
    const header = rows.shift();
    if (!header || header.join(',') !== 'company,role,location,contract_type,status,notes' || rows.length !== 44 || rows.some(r => r.length !== 6 || !r[1])) throw new Error('Les 44 entrées attendues ne sont pas valides');
    const key = 'job-tracker-tracked-v1';
    const previous = localStorage.getItem(key);
    localStorage.setItem('job-tracker-backup-before-seed-20261123-' + Date.now(), previous || '{}');
    const next = { ...state.tracked };
    const norm = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    let added = 0;
    rows.forEach(([company, title, location, jobType, status, note], index) => {
      const id = `seed-20261123-${index + 1}`;
      const exists = Object.values(next).some(item => {
        if (!item || norm(item.title) !== norm(title) || norm(item.company) !== norm(company)) return false;
        return !company.startsWith('Mille-Alliance') || norm(item.note).includes(note.includes('3 mois') ? '3 mois' : '2 mois');
      });
      if (next[id] || exists) return;
      next[id] = { title, company, jobType, status, note: [location, note, status === 'Candidature envoyée' ? 'Date exacte de candidature inconnue ; ancienneté issue de la capture.' : ''].filter(Boolean).join(' — '), addedAt: new Date().toISOString(), appliedAt: null, manual: true, url: '' };
      added++;
    });
    localStorage.setItem(key, JSON.stringify(next));
    state.tracked = next;
    localStorage.setItem(marker, JSON.stringify({ added, completedAt: new Date().toISOString() }));
    renderTracking();
    renderOffers();
    updateDashboard();
    statusText.textContent = `${added} entrée(s) ajoutée(s) automatiquement au suivi, sans remplacer les fiches existantes.`;
  } catch (error) {
    console.error('Chargement du suivi :', error);
    const target = document.getElementById('statusText');
    if (target) target.textContent = `Chargement du suivi impossible : ${error.message}`;
  }
});
