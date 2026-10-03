import * as C from './calc.js';

const VERSION = '1.0';
const BACKUP_DAYS = 14;
const PRESETS = [4, 8, 12, 26, 'all'];
const DEFAULT_SETS = 3;
const ACCENT = '#FF8A1F';

// ---------- Hilfsfunktionen ----------

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2))
  .replace(/-/g, '').slice(0, 12);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nfKg = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const nfW = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

const fmtW = w => nfW.format(w);

function fmtPct(rate) {
  const v = rate * 100;
  const s = nf1.format(Math.abs(v));
  if (s === '0,0') return '±0,0 %';
  return `${v > 0 ? '+' : '−'}${s} %`;
}

const signClass = r => (r > 0.0005 ? 'pos' : r < -0.0005 ? 'neg' : '');

function fmtSet(s) {
  if (!(s.w > 0)) return `${s.r ?? '–'} Wdh.`;
  return `${fmtW(s.w)} × ${s.r ?? '–'}`;
}

const fmtMetric = m => (m.kind === 'e1rm' ? `${nfKg.format(m.value)} kg` : `${m.value} Wdh.`);

function parseNum(str) {
  const t = String(str).trim().replace(',', '.');
  if (t === '') return null;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const dateObj = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const dfWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });
const dfLong = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
const dfShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
const dfDayMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
const dfWd = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

function relDay(iso, today) {
  const d = C.daysBetween(today, iso);
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  if (d === 2) return 'übermorgen';
  if (d === -1) return 'gestern';
  return dfShort.format(dateObj(iso));
}

const svg = (paths, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const ICON = {
  log: svg('<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3.5"/>'),
  today: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/>'),
  stats: svg('<path d="M4 20h16M7 16.5v-4M12 16.5V7.5M17 16.5v-7"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  chev: svg('<path d="M9 6l6 6-6 6"/>', 'ico chev'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'ico check'),
  x: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  up: svg('<path d="M12 18.5V6M6.5 11.5 12 6l5.5 5.5"/>'),
  down: svg('<path d="M12 5.5V18M6.5 12.5 12 18l5.5-5.5"/>'),
};

// ---------- Speicher (IndexedDB, Notfall: localStorage) ----------

const DB_NAME = 'kraftlog';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'kraftlog-state';
let idbOK = 'indexedDB' in window;
let dbPromise = null;

function openDB() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idb(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

async function readStored() {
  if (idbOK) {
    try {
      const v = await idb('readonly', s => s.get(KEY));
      if (v) return v;
    } catch {
      idbOK = false;
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeStored(data) {
  if (idbOK) {
    try {
      await idb('readwrite', s => s.put(data, KEY));
      return;
    } catch {
      idbOK = false;
    }
  }
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

let state;
let saveTimer = null;
let saveErrorShown = false;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
}

async function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!state) return;
  try {
    await writeStored(state);
  } catch {
    if (!saveErrorShown) {
      saveErrorShown = true;
      toast('Speichern fehlgeschlagen – bitte Backup sichern');
    }
  }
}

function emptyState() {
  return {
    version: 1,
    exercises: {},
    trainings: [],
    rotation: [],
    sessions: [],
    meta: { lastBackup: null, statsWeeks: 8, created: new Date().toISOString() },
  };
}

function normalize(d) {
  const s = emptyState();
  if (d && typeof d === 'object') {
    if (d.exercises && typeof d.exercises === 'object') s.exercises = d.exercises;
    if (Array.isArray(d.trainings)) s.trainings = d.trainings;
    if (Array.isArray(d.rotation)) s.rotation = d.rotation;
    if (Array.isArray(d.sessions)) s.sessions = d.sessions;
    if (d.meta && typeof d.meta === 'object') s.meta = { ...s.meta, ...d.meta };
  }
  return s;
}

const isBackupData = d =>
  d && typeof d === 'object' && Array.isArray(d.sessions) && Array.isArray(d.trainings) &&
  d.exercises && typeof d.exercises === 'object';

// ---------- Zugriff auf Daten ----------

const training = id => state.trainings.find(t => t.id === id);
const exName = id => state.exercises[id]?.name ?? 'Unbekannte Übung';
const sessionById = id => state.sessions.find(s => s.id === id);
const trainingLabel = s => training(s.trainingId)?.name || s.trainingName || 'Training';
const stepName = st => (st.type === 'rest' ? 'Ruhetag' : training(st.trainingId)?.name || 'Training');

function exSummary(t) {
  if (!t.items.length) return 'Noch keine Übungen';
  const names = t.items.map(it => exName(it.exerciseId));
  return esc(`${plural(names.length, 'Übung', 'Übungen')} · ${names.join(', ')}`);
}

function cycleText() {
  const n = state.rotation.length;
  const counts = {};
  for (const st of state.rotation) {
    if (st.type === 'training') counts[st.trainingId] = (counts[st.trainingId] || 0) + 1;
  }
  const once = Object.values(counts).every(c => c === 1);
  const len = `Ein Durchlauf dauert ${plural(n, 'Tag', 'Tage')}.`;
  if (!once) return len;
  return `${len} Jedes Training kommt ${n === 1 ? 'jeden Tag' : `alle ${n} Tage`} dran.`;
}

// ---------- Oberfläche: Grundgerüst ----------

const ui = { page: 1, statsExercise: 'all', historyLimit: 15, chart: null, persisted: null };
const pager = $('#pager');
const pages = [$('#page-log'), $('#page-home'), $('#page-stats')];

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function renderTabbar() {
  const tabs = [['log', 'Logbuch'], ['today', 'Heute'], ['stats', 'Statistik']];
  $('#tabbar').innerHTML = tabs.map(([icon, label], i) =>
    `<button class="tab" data-action="tab" data-page="${i}">${ICON[icon]}<span>${label}</span></button>`).join('');
}

function markTab(i) {
  document.querySelectorAll('.tab').forEach((t, k) => {
    t.classList.toggle('on', k === i);
    if (k === i) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
}

function gotoPage(i, smooth = true) {
  ui.page = i;
  markTab(i);
  pager.scrollTo({ left: i * pager.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
}

let scrollFrame = 0;
pager.addEventListener('scroll', () => {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    const i = Math.round(pager.scrollLeft / pager.clientWidth);
    if (i !== ui.page) {
      ui.page = i;
      markTab(i);
    }
  });
}, { passive: true });

window.addEventListener('resize', () => {
  pager.scrollLeft = ui.page * pager.clientWidth;
  drawChart();
});

let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function renderAll() {
  renderHome();
  renderLog();
  renderStats();
}

// ---------- Seite „Heute“ ----------

function renderHome() {
  const today = C.todayISO();
  const plan = C.planStatus(state, today);
  const done = C.sortSessions(state.sessions.filter(s => s.date === today && C.sessionHasData(s)));
  const st = C.progressStats(state, today, 4);

  pages[1].innerHTML = `
    <div class="topbar">
      <span class="brand">Kraft<b>log</b></span>
      <button class="icon-btn" data-action="open-settings" aria-label="Daten und Backup">${ICON.gear}</button>
    </div>
    <header class="today-head">
      <div class="weekday">${esc(dfWeekday.format(dateObj(today)))}</div>
      <div class="date-long">${esc(dfLong.format(dateObj(today)))}</div>
    </header>
    ${installHintHTML()}
    ${backupBannerHTML(today)}
    <div class="stack">
      ${todayCardHTML(today, plan, done)}
      ${progressCardHTML(st)}
    </div>`;
}

function todayCardHTML(today, plan, done) {
  if (!plan) {
    return `<div class="card">
      <div class="eyebrow">Heute</div>
      <div class="hero-title dim">Noch kein Plan</div>
      <p class="muted">${state.trainings.length
        ? 'Leg im Logbuch die Reihenfolge deiner Trainings fest.'
        : 'Leg im Logbuch deine Trainings und ihre Reihenfolge an.'}</p>
      <button class="btn btn-primary" data-action="goto" data-page="0">Zum Logbuch</button>
    </div>`;
  }

  const next = C.upcoming(state, today, 4);
  if (done.length) {
    const first = next[0];
    return `<div class="card">
      <div class="eyebrow accent">Heute erledigt</div>
      <div class="hero-title">${esc(done.map(trainingLabel).join(' + '))} ${ICON.check}</div>
      <p class="muted">Als Nächstes: <b>${esc(stepName(first))}</b> ${esc(relDay(first.date, today))}.</p>
      <button class="btn btn-secondary" data-action="open-session" data-id="${done[done.length - 1].id}">Einheit ansehen</button>
      ${nextRowHTML(next.slice(1))}
    </div>`;
  }

  const t = training(plan.trainingId);
  if (plan.due <= today) {
    const late = C.daysBetween(plan.due, today);
    return `<div class="card">
      <div class="row-between">
        <div class="eyebrow accent">Heute dran</div>
        ${late > 0 ? `<span class="tag">${late === 1 ? 'seit gestern fällig' : `seit ${late} Tagen fällig`}</span>` : ''}
      </div>
      <div class="hero-title accent">${esc(t.name)}</div>
      <p class="ex-summary">${exSummary(t)}</p>
      <button class="btn btn-primary" data-action="start-planned">Training eintragen</button>
      ${nextRowHTML(next.slice(1))}
    </div>`;
  }

  return `<div class="card">
    <div class="eyebrow">Heute</div>
    <div class="hero-title">Ruhetag</div>
    <p class="muted">Nächstes Training: <b>${esc(t.name)}</b> ${esc(relDay(plan.due, today))}.</p>
    <button class="btn btn-secondary" data-action="start-planned">Trotzdem trainieren</button>
    ${nextRowHTML(next.slice(1))}
  </div>`;
}

function nextRowHTML(steps) {
  if (!steps.length) return '';
  return `<div class="next-row"><span>Danach:</span>${steps.map(st =>
    `<span><b>${esc(stepName(st))}</b> ${esc(dfWd.format(dateObj(st.date)))}</span>`).join('')}</div>`;
}

function progressCardHTML(st) {
  const has = st.avg != null;
  const best = st.rows[0];
  return `<div class="card stat-card" data-action="goto" data-page="2" role="button" tabindex="0">
    <div class="eyebrow">Ø Kraftsteigerung pro Woche</div>
    <div class="big-num ${has ? (st.avg >= 0 ? 'pos' : 'neg') : 'none'}">${has ? fmtPct(st.avg) : '–'}</div>
    <div class="muted small">${has
      ? `Letzte 4 Wochen · ${plural(st.rows.length, 'Übung', 'Übungen')}`
      : 'Noch zu wenig Daten. Sobald du eine Übung zweimal im Abstand von mindestens 7 Tagen eingetragen hast, steht hier dein Wert.'}</div>
    ${has && st.rows.length > 1
      ? `<div class="stat-foot">Stärkste Übung: <b>${esc(exName(best.exerciseId))}</b> ${fmtPct(best.rate)}</div>`
      : ''}
  </div>`;
}

function backupDueDays(today) {
  if (!state.sessions.length) return null;
  const since = state.meta.lastBackup
    ? new Date(state.meta.lastBackup)
    : new Date(Math.min(...state.sessions.map(s => s.createdAt || Date.now())));
  const days = C.daysBetween(C.todayISO(since), today);
  return days >= BACKUP_DAYS ? days : null;
}

function backupBannerHTML(today) {
  const days = backupDueDays(today);
  if (days == null) return '';
  const text = state.meta.lastBackup ? `Letztes Backup vor ${days} Tagen.` : 'Du hast noch kein Backup gesichert.';
  return `<div class="banner"><p>${text}</p><button class="mini-btn" data-action="backup-export">Jetzt sichern</button></div>`;
}

function installHintHTML() {
  if (!isIOS || standalone || state.meta.installHintDismissed) return '';
  return `<div class="banner info">
    <p><b>Tipp:</b> Über Teilen → „Zum Home-Bildschirm“ wird Kraftlog zur App. Nutze danach nur noch das Icon, denn Safari speichert getrennt davon.</p>
    <button class="icon-btn" data-action="dismiss-install" aria-label="Hinweis ausblenden">${ICON.x}</button>
  </div>`;
}

// ---------- Seite „Logbuch“ ----------

function renderLog() {
  const today = C.todayISO();
  const sessions = C.sortSessions(state.sessions.filter(C.sessionHasData)).reverse();
  pages[0].innerHTML = `
    <h1 class="page-title">Logbuch</h1>
    ${state.trainings.length ? logEntryCardHTML(today) : onboardingHTML()}
    ${sessions.length ? `
      <h2 class="section-title">Verlauf</h2>
      <div class="list">${sessions.slice(0, ui.historyLimit).map(historyRowHTML).join('')}</div>
      ${sessions.length > ui.historyLimit ? '<button class="btn btn-text" data-action="history-more">Ältere anzeigen</button>' : ''}` : ''}
    ${state.trainings.length ? planSectionHTML() : ''}`;
}

function onboardingHTML() {
  return `<div class="card">
    <div class="eyebrow accent">Los geht's</div>
    <ol class="steps">
      <li><b>Trainings anlegen</b>, z. B. Push, Pull und Beine, jeweils mit Übungen und Satzanzahl.</li>
      <li><b>Reihenfolge festlegen.</b> Neue Trainings landen automatisch darin, Ruhetage fügst du dazu.</li>
      <li><b>Eintragen:</b> pro Satz Gewicht und Wiederholungen.</li>
    </ol>
    <button class="btn btn-primary" data-action="new-training">Erstes Training anlegen</button>
  </div>`;
}

function logEntryCardHTML(today) {
  const plan = C.planStatus(state, today);
  if (!plan) {
    return `<div class="card">
      <div class="eyebrow">Eintragen</div>
      <p class="muted">Noch keine Reihenfolge festgelegt. Eintragen kannst du trotzdem jedes Training.</p>
      <button class="btn btn-primary" data-action="start-other">Training eintragen</button>
    </div>`;
  }
  const t = training(plan.trainingId);
  const due = plan.due <= today;
  return `<div class="card">
    <div class="eyebrow ${due ? 'accent' : ''}">${due ? 'Heute dran' : `Als Nächstes · ${esc(relDay(plan.due, today))}`}</div>
    <div class="title-lg">${esc(t.name)}</div>
    <p class="ex-summary">${exSummary(t)}</p>
    <button class="btn ${due ? 'btn-primary' : 'btn-secondary'}" data-action="start-planned">${due ? 'Training eintragen' : 'Jetzt schon eintragen'}</button>
    <button class="btn btn-text" data-action="start-other">Anderes Training eintragen</button>
  </div>`;
}

function historyRowHTML(s) {
  const filled = s.entries.filter(en => en.sets.some(C.setFilled));
  const nSets = filled.reduce((a, en) => a + en.sets.filter(C.setFilled).length, 0);
  const ch = C.sessionChange(state.sessions, s);
  return `<button class="list-row" data-action="open-session" data-id="${s.id}">
    <span class="row-main">
      <span class="row-title">${esc(trainingLabel(s))}</span>
      <span class="row-sub">${esc(dfShort.format(dateObj(s.date)))} · ${plural(filled.length, 'Übung', 'Übungen')} · ${plural(nSets, 'Satz', 'Sätze')}</span>
    </span>
    ${ch != null ? `<span class="row-meta ${signClass(ch)}">${fmtPct(ch)}</span>` : ''}
    ${ICON.chev}
  </button>`;
}

function planSectionHTML() {
  const rot = state.rotation;
  return `
    <h2 class="section-title">Reihenfolge</h2>
    <div class="card plan-card" data-action="edit-rotation" role="button" tabindex="0">
      <div class="row-between"><span class="eyebrow">Ablauf</span><span class="link">Bearbeiten</span></div>
      ${rot.length
        ? `<div class="chain">${rot.map(st =>
            `<span class="chain-item ${st.type === 'rest' ? 'rest' : ''}">${esc(stepName(st))}</span>`).join('<span class="chain-arrow">→</span>')}</div>
           <div class="muted small">${cycleText()}</div>`
        : '<p class="muted small">Noch leer. Tippe hier, um Trainings und Ruhetage anzuordnen.</p>'}
    </div>
    <h2 class="section-title">Trainings</h2>
    <div class="list">${state.trainings.map(t => `
      <button class="list-row" data-action="edit-training" data-id="${t.id}">
        <span class="row-main">
          <span class="row-title">${esc(t.name || 'Ohne Namen')}</span>
          <span class="row-sub">${plural(t.items.length, 'Übung', 'Übungen')} · ${plural(t.items.reduce((a, i) => a + i.sets, 0), 'Satz', 'Sätze')}</span>
        </span>
        ${ICON.chev}
      </button>`).join('')}
    </div>
    <button class="btn btn-secondary" data-action="new-training">+ Training anlegen</button>`;
}

// ---------- Seite „Statistik“ ----------

function statsWeeks() {
  const w = state.meta.statsWeeks;
  return w === 'all' || (Number.isInteger(w) && w >= 2) ? w : 8;
}

function exercisesWithData() {
  const ids = new Set();
  for (const s of state.sessions) {
    for (const en of s.entries) if (C.entryMetric(en)) ids.add(en.exerciseId);
  }
  return [...ids].sort((a, b) => exName(a).localeCompare(exName(b), 'de'));
}

function renderStats() {
  const today = C.todayISO();
  const weeks = statsWeeks();
  const st = C.progressStats(state, today, weeks);
  const exIds = exercisesWithData();
  if (ui.statsExercise !== 'all' && !exIds.includes(ui.statsExercise)) ui.statsExercise = 'all';
  const chart = chartData();

  pages[2].innerHTML = `
    <h1 class="page-title">Statistik</h1>
    <div class="period">
      <div class="period-stepper">
        <button data-action="stats-step" data-d="-1" aria-label="Zeitraum verkürzen" ${weeks !== 'all' && weeks <= 2 ? 'disabled' : ''}>−</button>
        <div class="period-label">${weeks === 'all' ? 'Gesamter Zeitraum' : `Letzte ${weeks} Wochen`}</div>
        <button data-action="stats-step" data-d="1" aria-label="Zeitraum verlängern" ${weeks === 'all' ? 'disabled' : ''}>+</button>
      </div>
      <div class="seg">${PRESETS.map(w =>
        `<button class="${w === weeks ? 'on' : ''}" data-action="stats-weeks" data-weeks="${w}">${w === 'all' ? 'Alles' : `${w} W`}</button>`).join('')}</div>
    </div>
    ${!exIds.length ? `
      <div class="card empty">
        <div class="hero-title dim">Noch keine Daten</div>
        <p class="muted">Trag im Logbuch ein paar Trainings ein. Sobald eine Übung zweimal im Abstand von mindestens 7 Tagen vorkommt, siehst du hier deinen Fortschritt.</p>
      </div>` : `
      <div class="stack">
        <div class="card">
          <div class="eyebrow">Ø Steigerung pro Woche</div>
          <div class="big-num ${st.avg == null ? 'none' : st.avg >= 0 ? 'pos' : 'neg'}">${st.avg == null ? '–' : fmtPct(st.avg)}</div>
          <div class="muted small">${st.avg == null
            ? 'Im Zeitraum noch zu wenig Daten für eine Rate.'
            : `${plural(st.rows.length, 'Übung', 'Übungen')} · ${plural(st.sessionCount, 'Einheit', 'Einheiten')} im Zeitraum`}</div>
        </div>
        <div id="chart-card">
          <div class="row-between section-row">
            <h2 class="section-title flush">Verlauf</h2>
            <select class="select" data-input="stats-exercise" aria-label="Übung für den Verlauf">
              <option value="all"${ui.statsExercise === 'all' ? ' selected' : ''}>Alle Übungen</option>
              ${exIds.map(id => `<option value="${id}"${ui.statsExercise === id ? ' selected' : ''}>${esc(exName(id))}</option>`).join('')}
            </select>
          </div>
          <div class="card">
            <div class="chart-caption">${chart.caption}</div>
            <div class="chart" id="chart"></div>
            ${chartFootHTML(chart)}
          </div>
        </div>
        <div>
          <h2 class="section-title section-row">Fortschritt je Übung</h2>
          <div class="card">
            ${st.rows.length ? rankHTML(st.rows) : '<p class="muted small flush">Noch keine Übung mit genug Daten im Zeitraum.</p>'}
            ${st.insufficient.length ? `<p class="muted small insufficient">Zu wenig Daten: ${st.insufficient.map(id => esc(exName(id))).join(', ')}. Nötig sind zwei Einheiten mit mindestens 7 Tagen Abstand.</p>` : ''}
          </div>
        </div>
      </div>`}`;
  drawChart();
}

function rankHTML(rows) {
  const maxPos = Math.max(0, ...rows.map(r => r.rate));
  const maxNeg = Math.max(0, ...rows.map(r => -r.rate));
  const total = maxPos + maxNeg || 1;
  const zero = (maxNeg / total) * 100;
  return rows.map(r => {
    const w = (Math.abs(r.rate) / total) * 100;
    const bar = r.rate >= 0
      ? `<span class="bar pos" style="left:${zero}%;width:${w}%"></span>`
      : `<span class="bar neg" style="left:${zero - w}%;width:${w}%"></span>`;
    return `<button class="rank-row${ui.statsExercise === r.exerciseId ? ' sel' : ''}" data-action="stats-select" data-id="${r.exerciseId}">
      <span class="rank-top">
        <span class="rank-name">${esc(exName(r.exerciseId))}</span>
        <span class="rank-val">${fmtPct(r.rate)}<small>/Woche</small></span>
      </span>
      <span class="bar-track">${maxNeg > 0 ? `<span class="bar-zero" style="left:${zero}%"></span>` : ''}${bar}</span>
      <span class="rank-sub">${fmtMetric(r.first)} → ${fmtMetric(r.last)} · ${plural(r.count, 'Einheit', 'Einheiten')}</span>
    </button>`;
  }).join('');
}

function chartData() {
  const today = C.todayISO();
  const weeks = statsWeeks();
  if (ui.statsExercise === 'all') {
    return {
      pts: C.overallSeries(state, today, weeks),
      kind: 'pct',
      fmt: v => fmtPct(v / 100),
      caption: 'Ø Veränderung aller Übungen seit Beginn des Zeitraums',
    };
  }
  const series = C.exerciseSeries(state.sessions, ui.statsExercise, C.windowStart(today, weeks), today);
  const kind = series.length ? series[series.length - 1].kind : 'e1rm';
  return {
    pts: series.filter(p => p.kind === kind),
    kind,
    fmt: v => (kind === 'e1rm' ? `${nfKg.format(v)} kg` : `${Math.round(v)} Wdh.`),
    caption: kind === 'e1rm' ? 'Geschätztes Maximalgewicht (e1RM) in kg' : 'Wiederholungen im besten Satz',
  };
}

function chartFootHTML(chart) {
  const { pts, fmt, kind } = chart;
  if (!pts.length) return '';
  let note = '';
  if (kind !== 'pct') {
    const best = pts.reduce((a, b) => (b.value > a.value ? b : a));
    const what = kind === 'e1rm' ? `${fmtW(best.w)} kg × ${best.r}` : `${best.r} Wdh.`;
    note = `<p class="chart-note">Bestwert im Zeitraum: <b>${what}</b> am ${esc(dfDayMonth.format(dateObj(best.date)))}</p>`;
  }
  const rows = [...pts].reverse().map(p =>
    `<tr><td>${esc(dfShort.format(dateObj(p.date)))}</td><td>${esc(fmt(p.value))}</td></tr>`).join('');
  return `${note}<details class="tbl"><summary>Werte als Tabelle</summary><table class="data"><tbody>${rows}</tbody></table></details>`;
}

function niceTicks(lo, hi, count) {
  const raw = (hi - lo) / Math.max(1, count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step / 2; v += step) {
    out.push(Math.round(v / step) * step);
  }
  return out;
}

function drawChart() {
  const host = document.getElementById('chart');
  if (!host) return;
  const { pts, kind, fmt } = chartData();
  if (pts.length < 2) {
    ui.chart = null;
    host.innerHTML = `<div class="chart-empty">${pts.length
      ? 'Erst ein Messpunkt im Zeitraum. Ab dem zweiten entsteht hier eine Linie.'
      : 'Keine Daten im gewählten Zeitraum.'}</div>`;
    return;
  }

  const W = host.clientWidth || 320;
  const H = host.clientHeight || 220;
  const padL = 50, padR = 14, padT = 36, padB = 24;
  const xs = pts.map(p => C.dayNum(p.date));
  const vs = pts.map(p => p.value);
  const x0 = xs[0];
  const x1 = xs[xs.length - 1];
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (kind === 'pct') {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const ticks = niceTicks(lo, hi, 4);
  lo = ticks[0];
  hi = ticks[ticks.length - 1];

  const X = d => padL + ((d - x0) / (x1 - x0 || 1)) * (W - padL - padR);
  const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const tickFmt = t => (kind === 'pct'
    ? `${t > 1e-9 ? '+' : t < -1e-9 ? '−' : ''}${nfKg.format(Math.abs(t))} %`
    : nfKg.format(t));

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(p.value).toFixed(1)}`).join('');
  const area = `${line}L${X(x1).toFixed(1)},${Y(lo).toFixed(1)}L${X(x0).toFixed(1)},${Y(lo).toFixed(1)}Z`;
  const grid = ticks.map(t => `
    <line class="grid${kind === 'pct' && Math.abs(t) < 1e-9 ? ' zero' : ''}" x1="${padL}" x2="${W - padR}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/>
    <text class="tick" x="${padL - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${tickFmt(t)}</text>`).join('');
  const xLabels = `
    <text class="tick" x="${X(x0)}" y="${H - 4}" text-anchor="start">${esc(dfDayMonth.format(dateObj(pts[0].date)))}</text>
    <text class="tick" x="${X(x1)}" y="${H - 4}" text-anchor="end">${esc(dfDayMonth.format(dateObj(pts[pts.length - 1].date)))}</text>`;
  const dots = pts.length <= 40
    ? pts.map((p, i) => `<circle class="dot" cx="${X(xs[i]).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="4"/>`).join('')
    : '';

  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlaufsdiagramm, Werte auch als Tabelle darunter">
    <defs>
      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.2"/>
        <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grid}${xLabels}
    <path d="${area}" fill="url(#areaFill)"/>
    <path class="line" d="${line}"/>
    ${dots}
    <g class="hl"></g>
  </svg>`;

  ui.chart = { pts, xs, X, Y, fmt, W, H, padT, padB };
  highlight(pts.length - 1);
}

// Tippen aufs Diagramm: Fadenkreuz am nächsten Datenpunkt mit Wert
function highlight(i) {
  const c = ui.chart;
  const g = document.querySelector('#chart .hl');
  if (!c || !g) return;
  const p = c.pts[i];
  const x = c.X(c.xs[i]);
  const y = c.Y(p.value);
  g.innerHTML = `
    <line class="cross" x1="${x}" x2="${x}" y1="${c.padT - 6}" y2="${c.H - c.padB}"/>
    <circle class="dot-hl" cx="${x}" cy="${y}" r="5.5"/>
    <rect class="tip" x="0" y="2" width="10" height="26" rx="8"/>
    <text y="20"><tspan class="tip-val">${esc(c.fmt(p.value))}</tspan><tspan class="tip-date" dx="7">${esc(dfDayMonth.format(dateObj(p.date)))}</tspan></text>`;
  const text = g.querySelector('text');
  const tw = text.getComputedTextLength ? text.getComputedTextLength() : 120;
  const w = tw + 20;
  const bx = Math.min(Math.max(x - w / 2, 2), c.W - w - 2);
  const rect = g.querySelector('rect');
  rect.setAttribute('x', bx);
  rect.setAttribute('width', w);
  text.setAttribute('x', bx + 10);
}

function chartTap(e) {
  const c = ui.chart;
  const svgEl = document.querySelector('#chart svg');
  if (!c || !svgEl) return;
  const r = svgEl.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * c.W;
  let best = 0;
  c.xs.forEach((d, i) => {
    if (Math.abs(c.X(d) - x) < Math.abs(c.X(c.xs[best]) - x)) best = i;
  });
  highlight(best);
}

// ---------- Overlays ----------

const sheets = [];

function openSheet(id, render, onClose) {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.dataset.sheet = id;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = render();
  document.body.appendChild(el);
  sheets.push({ id, el, render, onClose });
  el.getBoundingClientRect();
  el.classList.add('open');
}

const sheetEl = id => sheets.find(s => s.id === id)?.el;

function refreshSheet(id) {
  const sh = sheets.find(s => s.id === id);
  if (!sh) return;
  const top = sh.el.querySelector('.sheet-body')?.scrollTop ?? 0;
  sh.el.innerHTML = sh.render();
  const body = sh.el.querySelector('.sheet-body');
  if (body) body.scrollTop = top;
}

function closeSheet() {
  const sh = sheets.pop();
  if (!sh) return;
  document.activeElement?.blur?.();
  sh.el.classList.remove('open');
  setTimeout(() => sh.el.remove(), 320);
  sh.onClose?.();
}

// ---------- Einheit eintragen ----------

function startTraining(trainingId) {
  const today = C.todayISO();
  const existing = state.sessions.find(s => s.date === today && s.trainingId === trainingId);
  if (existing) return openSession(existing.id);
  const t = training(trainingId);
  if (!t) return;
  const s = {
    id: uid(),
    date: today,
    trainingId,
    trainingName: t.name,
    slot: C.slotForNewSession(state, trainingId, today),
    createdAt: Date.now(),
    entries: t.items.map(it => ({
      exerciseId: it.exerciseId,
      sets: Array.from({ length: it.sets }, () => ({ w: null, r: null })),
    })),
  };
  state.sessions.push(s);
  save();
  openSession(s.id);
}

function openSession(id) {
  ui.sessionId = id;
  openSheet('session', renderSessionSheet, () => {
    const s = sessionById(id);
    if (s && !C.sessionHasData(s)) state.sessions = state.sessions.filter(x => x.id !== id);
    save();
    renderAll();
  });
}

function renderSessionSheet() {
  const s = sessionById(ui.sessionId);
  if (!s) return '';
  return `
    <header class="sheet-head">
      <span></span>
      <div class="sheet-title">${esc(trainingLabel(s))}</div>
      <button class="head-btn right" data-action="close-sheet">Fertig</button>
    </header>
    <div class="sheet-body">
      <label class="field"><span>Datum</span><input type="date" data-input="session-date" value="${s.date}" max="${C.todayISO()}"></label>
      ${s.entries.map((en, i) => entryHTML(s, en, i)).join('')}
      <button class="btn btn-secondary" data-action="session-add-ex">+ Übung hinzufügen</button>
      <button class="btn btn-danger" data-action="session-delete">Einheit löschen</button>
    </div>`;
}

function entryHTML(s, en, i) {
  const prev = C.previousEntry(state.sessions, s, en.exerciseId);
  const prevSets = prev ? prev.entry.sets : [];
  const rows = en.sets.map((st, j) => {
    const pv = prevSets[j] && C.setFilled(prevSets[j]) ? prevSets[j] : null;
    return `<div class="set-grid">
      <span class="set-no">${j + 1}</span>
      <button class="prev-cell" data-action="copy-prev" data-ex="${i}" data-set="${j}"${pv ? '' : ' disabled'} aria-label="Werte vom letzten Mal übernehmen">${pv ? esc(fmtSet(pv)) : '–'}</button>
      <input class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="–"
        data-input="set" data-ex="${i}" data-set="${j}" data-field="w" value="${st.w != null ? fmtW(st.w) : ''}" aria-label="Satz ${j + 1}: Gewicht in kg">
      <input class="num" type="text" inputmode="numeric" autocomplete="off" placeholder="–"
        data-input="set" data-ex="${i}" data-set="${j}" data-field="r" value="${st.r ?? ''}" aria-label="Satz ${j + 1}: Wiederholungen">
    </div>`;
  }).join('');
  return `<div class="card entry">
    <div class="entry-head">
      <h3>${esc(exName(en.exerciseId))}</h3>
      <span>${prev ? `zuletzt ${esc(dfDayMonth.format(dateObj(prev.session.date)))}` : 'erstes Mal'}</span>
    </div>
    <div class="set-grid set-head"><span>Satz</span><span>Zuletzt</span><span>kg</span><span>Wdh.</span></div>
    ${rows}
    <div class="entry-foot">
      <div class="set-btns">
        <button class="chip-btn" data-action="remove-set" data-ex="${i}"${en.sets.length <= 1 ? ' disabled' : ''} aria-label="Letzten Satz entfernen">− Satz</button>
        <button class="chip-btn" data-action="add-set" data-ex="${i}">+ Satz</button>
      </div>
      <div class="entry-result" data-result="${i}">${entryResultHTML(en, prev)}</div>
    </div>
  </div>`;
}

function entryResultHTML(en, prev) {
  const cur = C.entryMetric(en);
  if (!cur) return '';
  const label = cur.kind === 'e1rm'
    ? `e1RM <b>${nfKg.format(cur.value)} kg</b>`
    : `Bester Satz <b>${cur.value} Wdh.</b>`;
  const pm = prev && C.entryMetric(prev.entry);
  if (!pm || pm.kind !== cur.kind) return label;
  const ch = cur.value / pm.value - 1;
  return `${label}<br><span class="delta ${signClass(ch)}">${fmtPct(ch)}</span> zum letzten Mal`;
}

function updateEntryResult(s, i) {
  const box = sheetEl('session')?.querySelector(`[data-result="${i}"]`);
  if (!box) return;
  const en = s.entries[i];
  box.innerHTML = entryResultHTML(en, C.previousEntry(state.sessions, s, en.exerciseId));
}

function currentEntry(el) {
  const s = sessionById(ui.sessionId);
  const en = s?.entries[+el.dataset.ex];
  return en ? { s, en } : null;
}

function copyPrev(el) {
  const ctx = currentEntry(el);
  if (!ctx) return;
  const j = +el.dataset.set;
  const prev = C.previousEntry(state.sessions, ctx.s, ctx.en.exerciseId);
  const pv = prev?.entry.sets[j];
  if (!pv) return;
  ctx.en.sets[j] = { w: pv.w ?? null, r: pv.r ?? null };
  save();
  const sheet = sheetEl('session');
  const sel = f => `input[data-ex="${el.dataset.ex}"][data-set="${j}"][data-field="${f}"]`;
  sheet.querySelector(sel('w')).value = pv.w != null ? fmtW(pv.w) : '';
  sheet.querySelector(sel('r')).value = pv.r ?? '';
  updateEntryResult(ctx.s, +el.dataset.ex);
}

// ---------- Trainings bearbeiten ----------

function newTraining() {
  const t = { id: uid(), name: '', items: [] };
  state.trainings.push(t);
  state.rotation.push({ type: 'training', trainingId: t.id });
  save();
  openTrainingEditor(t.id);
}

function removeTraining(id) {
  state.trainings = state.trainings.filter(t => t.id !== id);
  state.rotation = state.rotation.filter(st => st.trainingId !== id);
}

function openTrainingEditor(id) {
  ui.trainingId = id;
  openSheet('training', renderTrainingSheet, () => {
    const t = training(id);
    if (t) {
      t.name = t.name.trim();
      if (!t.name && !t.items.length) removeTraining(id);
      else if (!t.name) t.name = `Training ${state.trainings.indexOf(t) + 1}`;
    }
    save();
    renderAll();
  });
}

function renderTrainingSheet() {
  const t = training(ui.trainingId);
  if (!t) return '';
  const items = t.items.map((it, i) => `
    <div class="card ex-card">
      <div class="ex-top">
        <button class="ex-name" data-action="tr-rename-ex" data-i="${i}">${esc(exName(it.exerciseId))}</button>
        <button class="sq-btn" data-action="tr-remove" data-i="${i}" aria-label="Übung entfernen">${ICON.x}</button>
      </div>
      <div class="ex-bottom">
        <div class="stepper">
          <button data-action="tr-sets" data-i="${i}" data-d="-1"${it.sets <= 1 ? ' disabled' : ''} aria-label="Ein Satz weniger">−</button>
          <span>${plural(it.sets, 'Satz', 'Sätze')}</span>
          <button data-action="tr-sets" data-i="${i}" data-d="1"${it.sets >= 12 ? ' disabled' : ''} aria-label="Ein Satz mehr">+</button>
        </div>
        <div class="move">
          <button class="sq-btn" data-action="tr-move" data-i="${i}" data-d="-1"${i === 0 ? ' disabled' : ''} aria-label="Nach oben">${ICON.up}</button>
          <button class="sq-btn" data-action="tr-move" data-i="${i}" data-d="1"${i === t.items.length - 1 ? ' disabled' : ''} aria-label="Nach unten">${ICON.down}</button>
        </div>
      </div>
    </div>`).join('');
  return `
    <header class="sheet-head">
      <span></span>
      <div class="sheet-title">Training</div>
      <button class="head-btn right" data-action="close-sheet">Fertig</button>
    </header>
    <div class="sheet-body">
      <label class="label" for="tr-name">Name</label>
      <input id="tr-name" class="text-input" data-input="training-name" value="${esc(t.name)}"
        placeholder="z. B. Push, Pull oder Beine" autocomplete="off" enterkeyhint="done">
      <h2 class="section-title">Übungen</h2>
      ${items || '<p class="muted">Noch keine Übungen. Füge die erste hinzu.</p>'}
      <button class="btn btn-secondary" data-action="tr-add-ex">+ Übung hinzufügen</button>
      ${t.items.length ? '<p class="muted small hint">Tippe auf den Namen einer Übung, um sie umzubenennen.</p>' : ''}
      <button class="btn btn-danger" data-action="tr-delete">Training löschen</button>
    </div>`;
}

function moveItem(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

// ---------- Reihenfolge bearbeiten ----------

function openRotationEditor() {
  openSheet('rotation', renderRotationSheet, () => {
    save();
    renderAll();
  });
}

function renderRotationSheet() {
  const rot = state.rotation;
  const rows = rot.map((st, i) => `
    <div class="list-row rot-row">
      <span class="rot-no">${i + 1}</span>
      <span class="row-main"><span class="row-title${st.type === 'rest' ? ' dim' : ''}">${esc(stepName(st))}</span></span>
      <button class="sq-btn" data-action="rot-move" data-i="${i}" data-d="-1"${i === 0 ? ' disabled' : ''} aria-label="Nach oben">${ICON.up}</button>
      <button class="sq-btn" data-action="rot-move" data-i="${i}" data-d="1"${i === rot.length - 1 ? ' disabled' : ''} aria-label="Nach unten">${ICON.down}</button>
      <button class="sq-btn" data-action="rot-remove" data-i="${i}" aria-label="Entfernen">${ICON.x}</button>
    </div>`).join('');
  return `
    <header class="sheet-head">
      <span></span>
      <div class="sheet-title">Reihenfolge</div>
      <button class="head-btn right" data-action="close-sheet">Fertig</button>
    </header>
    <div class="sheet-body">
      <p class="muted small">Jeder Eintrag steht für einen Tag. Nach dem letzten geht es von vorn los. Fällt ein Training aus, rutscht alles einen Tag nach hinten.</p>
      ${rot.length ? `<div class="list">${rows}</div><p class="muted small">${cycleText()}</p>` : '<p class="muted">Noch leer.</p>'}
      <h2 class="section-title">Hinzufügen</h2>
      <div class="chip-wrap">
        ${state.trainings.map(t => `<button class="chip-btn" data-action="rot-add" data-id="${t.id}">+ ${esc(t.name || 'Ohne Namen')}</button>`).join('')}
        <button class="chip-btn" data-action="rot-add" data-id="rest">+ Ruhetag</button>
      </div>
    </div>`;
}

// ---------- Auswahl: Übung und Training ----------

let pickerCallback = null;

function openExercisePicker(exclude, cb) {
  pickerCallback = cb;
  ui.pickerExclude = new Set(exclude);
  openSheet('expick', renderExercisePicker);
}

function renderExercisePicker() {
  const list = Object.values(state.exercises)
    .filter(x => !ui.pickerExclude.has(x.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return `
    <header class="sheet-head">
      <button class="head-btn left" data-action="close-sheet">Abbrechen</button>
      <div class="sheet-title">Übung hinzufügen</div>
      <span></span>
    </header>
    <div class="sheet-body">
      <div class="new-ex">
        <input class="text-input" data-input="new-ex-name" placeholder="Neue Übung, z. B. Bankdrücken"
          autocomplete="off" autocapitalize="sentences" enterkeyhint="done">
        <button class="btn btn-primary" data-action="create-ex">Hinzufügen</button>
      </div>
      ${list.length ? `
        <h2 class="section-title">Vorhandene Übungen</h2>
        <div class="list">${list.map(x => `
          <button class="list-row" data-action="pick-ex" data-id="${x.id}">
            <span class="row-main"><span class="row-title">${esc(x.name)}</span></span>
            <span class="plus" aria-hidden="true">+</span>
          </button>`).join('')}
        </div>` : ''}
    </div>`;
}

function pickExercise(id) {
  const cb = pickerCallback;
  pickerCallback = null;
  closeSheet();
  cb?.(id);
}

function createExercise() {
  const input = sheetEl('expick')?.querySelector('[data-input="new-ex-name"]');
  const name = input?.value.trim();
  if (!name) {
    input?.focus();
    return;
  }
  let ex = Object.values(state.exercises).find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!ex) {
    ex = { id: uid(), name };
    state.exercises[ex.id] = ex;
  }
  pickExercise(ex.id);
}

function openTrainingPicker() {
  openSheet('tpick', () => `
    <header class="sheet-head">
      <button class="head-btn left" data-action="close-sheet">Abbrechen</button>
      <div class="sheet-title">Training wählen</div>
      <span></span>
    </header>
    <div class="sheet-body">
      <div class="list">${state.trainings.map(t => `
        <button class="list-row" data-action="pick-training" data-id="${t.id}">
          <span class="row-main"><span class="row-title">${esc(t.name)}</span><span class="row-sub">${exSummary(t)}</span></span>
          ${ICON.chev}
        </button>`).join('')}
      </div>
    </div>`);
}

// ---------- Daten & Backup ----------

function openSettings() {
  openSheet('settings', renderSettingsSheet);
}

function renderSettingsSheet() {
  const lb = state.meta.lastBackup;
  const today = C.todayISO();
  const persist = ui.persisted === true
    ? 'Speicherschutz: aktiv. iOS löscht die Daten nicht automatisch.'
    : 'Speicherschutz: nicht bestätigt. Regelmäßige Backups sind deshalb besonders wichtig.';
  return `
    <header class="sheet-head">
      <span></span>
      <div class="sheet-title">Daten &amp; Backup</div>
      <button class="head-btn right" data-action="close-sheet">Fertig</button>
    </header>
    <div class="sheet-body">
      <div class="card">
        <div class="eyebrow">Backup</div>
        <p class="muted">${lb ? `Letztes Backup: <b>${esc(relDay(C.todayISO(new Date(lb)), today))}</b>` : 'Noch kein Backup gesichert.'}</p>
        <button class="btn btn-primary" data-action="backup-export">Backup sichern</button>
        <p class="muted small">Speichert eine Datei. Wähle im Teilen-Menü „In Dateien sichern“, z. B. in iCloud Drive.</p>
        <button class="btn btn-secondary" data-action="backup-import">Backup einspielen</button>
      </div>
      <h2 class="section-title">Wichtig</h2>
      <div class="card">
        <ul class="hints flush">
          <li>Deine Daten liegen <b>nur auf diesem Gerät</b>, ohne Account und ohne Server.</li>
          <li>Nutze Kraftlog <b>nur über das Homescreen-Icon</b>. Safari hat einen eigenen, getrennten Speicher.</li>
          <li><b>Löschst du das Icon, sind die Daten weg.</b> Vorher ein Backup sichern.</li>
        </ul>
        <p class="muted small flush" style="margin-top:12px">${persist}</p>
      </div>
      <p class="version">Kraftlog · Version ${VERSION}</p>
    </div>`;
}

function markBackup() {
  state.meta.lastBackup = new Date().toISOString();
  save();
  renderHome();
  refreshSheet('settings');
  toast('Backup gesichert');
}

async function exportBackup() {
  const payload = { app: 'kraftlog', version: 1, exportedAt: new Date().toISOString(), data: state };
  const name = `kraftlog-backup-${C.todayISO()}.json`;
  const json = JSON.stringify(payload, null, 1);
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Kraftlog-Backup' });
      markBackup();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  markBackup();
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    let data;
    try {
      const obj = JSON.parse(await file.text());
      data = obj?.data ?? obj;
      if (!isBackupData(data)) throw new Error('kein Backup');
    } catch {
      alert('Diese Datei ist kein gültiges Kraftlog-Backup.');
      return;
    }
    const n = data.sessions.length;
    if (!confirm(`Backup mit ${plural(n, 'Einheit', 'Einheiten')} einspielen? Deine aktuellen Daten werden dabei ersetzt.`)) return;
    state = normalize(data);
    await flush();
    renderAll();
    refreshSheet('settings');
    toast('Backup eingespielt');
  });
  input.click();
}

async function requestPersist() {
  try {
    if (!navigator.storage?.persist) return;
    ui.persisted = await navigator.storage.persisted();
    if (!ui.persisted) ui.persisted = await navigator.storage.persist();
  } catch {
    ui.persisted = null;
  }
}

// ---------- Eingaben ----------

const actions = {
  tab: el => {
    const i = +el.dataset.page;
    if (i === ui.page) pages[i].scrollTo({ top: 0, behavior: 'smooth' });
    else gotoPage(i);
  },
  goto: el => gotoPage(+el.dataset.page),
  'open-settings': openSettings,
  'dismiss-install': () => {
    state.meta.installHintDismissed = true;
    save();
    renderHome();
  },
  'close-sheet': closeSheet,

  'start-planned': () => {
    const plan = C.planStatus(state, C.todayISO());
    if (plan) startTraining(plan.trainingId);
  },
  'start-other': openTrainingPicker,
  'pick-training': el => {
    closeSheet();
    startTraining(el.dataset.id);
  },
  'open-session': el => openSession(el.dataset.id),
  'history-more': () => {
    ui.historyLimit += 30;
    renderLog();
  },

  'copy-prev': copyPrev,
  'add-set': el => {
    const ctx = currentEntry(el);
    if (!ctx) return;
    ctx.en.sets.push({ w: null, r: null });
    save();
    refreshSheet('session');
  },
  'remove-set': el => {
    const ctx = currentEntry(el);
    if (!ctx || ctx.en.sets.length <= 1) return;
    ctx.en.sets.pop();
    save();
    refreshSheet('session');
  },
  'session-add-ex': () => {
    const s = sessionById(ui.sessionId);
    if (!s) return;
    openExercisePicker(s.entries.map(en => en.exerciseId), id => {
      s.entries.push({ exerciseId: id, sets: Array.from({ length: DEFAULT_SETS }, () => ({ w: null, r: null })) });
      save();
      refreshSheet('session');
    });
  },
  'session-delete': () => {
    if (!confirm('Diese Einheit wirklich löschen?')) return;
    state.sessions = state.sessions.filter(x => x.id !== ui.sessionId);
    save();
    closeSheet();
    toast('Einheit gelöscht');
  },

  'new-training': newTraining,
  'edit-training': el => openTrainingEditor(el.dataset.id),
  'tr-add-ex': () => {
    const t = training(ui.trainingId);
    if (!t) return;
    openExercisePicker(t.items.map(it => it.exerciseId), id => {
      t.items.push({ exerciseId: id, sets: DEFAULT_SETS });
      save();
      refreshSheet('training');
    });
  },
  'tr-sets': el => {
    const it = training(ui.trainingId)?.items[+el.dataset.i];
    if (!it) return;
    it.sets = Math.min(12, Math.max(1, it.sets + +el.dataset.d));
    save();
    refreshSheet('training');
  },
  'tr-move': el => {
    const t = training(ui.trainingId);
    if (!t) return;
    moveItem(t.items, +el.dataset.i, +el.dataset.d);
    save();
    refreshSheet('training');
  },
  'tr-remove': el => {
    const t = training(ui.trainingId);
    if (!t) return;
    t.items.splice(+el.dataset.i, 1);
    save();
    refreshSheet('training');
  },
  'tr-rename-ex': el => {
    const it = training(ui.trainingId)?.items[+el.dataset.i];
    const ex = it && state.exercises[it.exerciseId];
    if (!ex) return;
    const name = prompt('Übung umbenennen (gilt in allen Trainings und im Verlauf):', ex.name);
    if (name && name.trim()) {
      ex.name = name.trim();
      save();
      refreshSheet('training');
    }
  },
  'tr-delete': () => {
    const t = training(ui.trainingId);
    if (!t) return;
    if (!confirm(`„${t.name || 'Training'}“ löschen? Bereits eingetragene Einheiten bleiben im Verlauf.`)) return;
    removeTraining(t.id);
    save();
    closeSheet();
  },

  'edit-rotation': openRotationEditor,
  'rot-add': el => {
    const id = el.dataset.id;
    state.rotation.push(id === 'rest' ? { type: 'rest' } : { type: 'training', trainingId: id });
    save();
    refreshSheet('rotation');
  },
  'rot-move': el => {
    moveItem(state.rotation, +el.dataset.i, +el.dataset.d);
    save();
    refreshSheet('rotation');
  },
  'rot-remove': el => {
    state.rotation.splice(+el.dataset.i, 1);
    save();
    refreshSheet('rotation');
  },

  'pick-ex': el => pickExercise(el.dataset.id),
  'create-ex': createExercise,

  'stats-weeks': el => {
    state.meta.statsWeeks = el.dataset.weeks === 'all' ? 'all' : +el.dataset.weeks;
    save();
    renderStats();
  },
  'stats-step': el => {
    let w = statsWeeks();
    const d = +el.dataset.d;
    if (w === 'all') w = d < 0 ? 52 : 'all';
    else {
      w += d;
      if (w < 2) w = 2;
      if (w > 104) w = 'all';
    }
    state.meta.statsWeeks = w;
    save();
    renderStats();
  },
  'stats-select': el => {
    ui.statsExercise = el.dataset.id;
    renderStats();
    document.getElementById('chart-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  'backup-export': exportBackup,
  'backup-import': importBackup,
};

document.addEventListener('click', e => {
  if (e.target.closest('#chart') && ui.chart) {
    chartTap(e);
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  actions[el.dataset.action]?.(el, e);
});

document.addEventListener('keydown', e => {
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t.matches?.('[role="button"][data-action]')) {
    e.preventDefault();
    t.click();
  } else if (e.key === 'Enter' && t.dataset?.input === 'new-ex-name') {
    e.preventDefault();
    createExercise();
  } else if (e.key === 'Enter' && t.dataset?.input === 'training-name') {
    t.blur();
  }
});

document.addEventListener('input', e => {
  const el = e.target;
  const kind = el.dataset?.input;
  if (kind === 'set') {
    const ctx = currentEntry(el);
    const st = ctx?.en.sets[+el.dataset.set];
    if (!st) return;
    let v = parseNum(el.value);
    if (el.dataset.field === 'r' && v != null) v = Math.round(v);
    st[el.dataset.field] = v;
    save();
    updateEntryResult(ctx.s, +el.dataset.ex);
  } else if (kind === 'training-name') {
    const t = training(ui.trainingId);
    if (t) {
      t.name = el.value;
      save();
    }
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  const kind = el.dataset?.input;
  if (kind === 'session-date') {
    const s = sessionById(ui.sessionId);
    if (!s) return;
    const today = C.todayISO();
    if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) s.date = el.value > today ? today : el.value;
    save();
    refreshSheet('session');
  } else if (kind === 'set' && el.dataset.field === 'w') {
    const v = parseNum(el.value);
    el.value = v != null ? fmtW(v) : '';
  } else if (kind === 'stats-exercise') {
    ui.statsExercise = el.value;
    renderStats();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
  else if (state) {
    renderHome();
    renderLog();
    renderStats();
  }
});
window.addEventListener('pagehide', flush);

// ---------- Start ----------

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local && !location.search.includes('sw=1')) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

async function init() {
  renderTabbar();
  state = normalize(await readStored());
  // Leere Einheiten entfernen, z. B. wenn die App beim Eintragen geschlossen wurde
  const before = state.sessions.length;
  state.sessions = state.sessions.filter(C.sessionHasData);
  if (state.sessions.length !== before) save();
  renderAll();
  pager.scrollLeft = pager.clientWidth;
  markTab(1);
  pager.classList.add('ready');
  requestPersist();
  registerServiceWorker();
}

init();
