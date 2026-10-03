// Reine Rechenfunktionen ohne Bildschirm-Code, damit sie sich einzeln testen lassen.

// Mindestabstand zwischen erster und letzter Einheit, damit eine Wochenrate berechnet wird.
// Bei kürzeren Abständen springen die Werte zu stark (z. B. +30 % pro Woche nach 2 Tagen).
export const MIN_SPAN_DAYS = 7;

const DAY_MS = 86400000;

// ---------- Datum ----------
// Daten werden als "JJJJ-MM-TT" gespeichert. Gerechnet wird in ganzen Tagen (UTC),
// damit Sommer-/Winterzeit nichts verschiebt.

export function dayNum(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function isoFromDayNum(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function todayISO(now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const addDays = (iso, n) => isoFromDayNum(dayNum(iso) + n);
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);

// ---------- Leistung ----------

// Epley-Formel: geschätztes Maximalgewicht für eine Wiederholung
export function e1rm(w, r) {
  return w * (1 + r / 30);
}

export function setFilled(s) {
  return s.w != null || s.r != null;
}

export function sessionHasData(session) {
  return session.entries.some(en => en.sets.some(setFilled));
}

// Sätze mit Gewicht schlagen Sätze ohne Gewicht, sonst zählt der höhere Wert.
function better(a, b) {
  if (a.kind !== b.kind) return a.kind === 'e1rm';
  return a.value > b.value;
}

// Leistungswert einer Übung in einer Einheit: der beste Satz.
// Mit Gewicht zählt das e1RM, ohne Gewicht (Körpergewicht) die Wiederholungen.
export function entryMetric(entry) {
  let best = null;
  for (const s of entry?.sets ?? []) {
    const w = Number(s.w) || 0;
    const r = Number(s.r) || 0;
    if (r <= 0) continue;
    const m = w > 0
      ? { kind: 'e1rm', value: e1rm(w, r), w, r }
      : { kind: 'reps', value: r, w: 0, r };
    if (!best || better(m, best)) best = m;
  }
  return best;
}

export function sortSessions(sessions) {
  return [...sessions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

// Die Einheit vor `session`, in der die Übung zuletzt mit Werten vorkam.
export function previousEntry(sessions, session, exerciseId) {
  const sorted = sortSessions(sessions);
  let found = null;
  for (const s of sorted) {
    if (s.id === session.id) break;
    const before = s.date < session.date ||
      (s.date === session.date && (s.createdAt ?? 0) < (session.createdAt ?? 0));
    if (!before) break;
    const en = s.entries.find(e => e.exerciseId === exerciseId && e.sets.some(setFilled));
    if (en) found = { session: s, entry: en };
  }
  return found;
}

// Verlauf einer Übung: ein Punkt pro Trainingstag (bester Wert des Tages).
export function exerciseSeries(sessions, exerciseId, from = null, to = null) {
  const byDate = new Map();
  for (const s of sessions) {
    if ((from && s.date < from) || (to && s.date > to)) continue;
    for (const en of s.entries) {
      if (en.exerciseId !== exerciseId) continue;
      const m = entryMetric(en);
      if (!m) continue;
      const cur = byDate.get(s.date);
      if (!cur || better(m, cur)) byDate.set(s.date, { ...m, date: s.date });
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Deine Formel: Rate pro Woche = (Ende / Start)^(1 / Wochen) − 1
export function weeklyRate(series) {
  if (!series.length) return null;
  const kind = series[series.length - 1].kind;
  const pts = series.filter(p => p.kind === kind);
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const days = daysBetween(first.date, last.date);
  if (days < MIN_SPAN_DAYS) return null;
  const weeks = days / 7;
  return {
    rate: Math.pow(last.value / first.value, 1 / weeks) - 1,
    first, last, weeks, kind,
    count: pts.length,
  };
}

// weeks: Zahl oder 'all'
export function windowStart(today, weeks) {
  return weeks === 'all' ? null : addDays(today, -weeks * 7);
}

function exerciseIdsWithData(sessions) {
  const ids = new Set();
  for (const s of sessions) for (const en of s.entries) ids.add(en.exerciseId);
  return [...ids];
}

// Fortschritt aller Übungen im Zeitraum, sortiert nach Wochenrate.
export function progressStats(state, today, weeks) {
  const from = windowStart(today, weeks);
  const rows = [];
  const insufficient = [];
  for (const id of exerciseIdsWithData(state.sessions)) {
    const series = exerciseSeries(state.sessions, id, from, today);
    if (!series.length) continue;
    const r = weeklyRate(series);
    if (r) rows.push({ exerciseId: id, ...r });
    else insufficient.push(id);
  }
  rows.sort((a, b) => b.rate - a.rate);
  const avg = rows.length ? rows.reduce((sum, r) => sum + r.rate, 0) / rows.length : null;
  const sessionCount = state.sessions.filter(s =>
    (!from || s.date >= from) && s.date <= today && sessionHasData(s)).length;
  return { from, rows, insufficient, avg, sessionCount };
}

// Gesamtverlauf: durchschnittliche Veränderung aller Übungen seit ihrem
// ersten Wert im Zeitraum, in Prozent, ein Punkt pro Woche.
export function overallSeries(state, today, weeks) {
  const from = windowStart(today, weeks);
  const perExercise = [];
  for (const id of exerciseIdsWithData(state.sessions)) {
    const series = exerciseSeries(state.sessions, id, from, today);
    if (!series.length) continue;
    const kind = series[0].kind;
    perExercise.push(series.filter(p => p.kind === kind));
  }
  if (!perExercise.length) return [];

  const start = perExercise.map(p => p[0].date).sort()[0];
  const checkpoints = [];
  for (let d = start; d <= today; d = addDays(d, 7)) checkpoints.push(d);
  if (checkpoints[checkpoints.length - 1] !== today) checkpoints.push(today);

  return checkpoints.map(cp => {
    let sum = 0;
    let n = 0;
    for (const pts of perExercise) {
      if (pts[0].date > cp) continue;
      let latest = pts[0];
      for (const p of pts) {
        if (p.date > cp) break;
        latest = p;
      }
      sum += latest.value / pts[0].value - 1;
      n++;
    }
    return { date: cp, value: n ? (sum / n) * 100 : 0 };
  });
}

// Veränderung einer Einheit gegenüber dem jeweils letzten Mal, gemittelt über ihre Übungen.
export function sessionChange(sessions, session) {
  let sum = 0;
  let n = 0;
  for (const en of session.entries) {
    const cur = entryMetric(en);
    if (!cur) continue;
    const prev = previousEntry(sessions, session, en.exerciseId);
    const pm = prev && entryMetric(prev.entry);
    if (!pm || pm.kind !== cur.kind) continue;
    sum += cur.value / pm.value - 1;
    n++;
  }
  return n ? sum / n : null;
}

// ---------- Reihenfolge ----------
// rotation: [{ type: 'training', trainingId } | { type: 'rest' }]
// Ruhetage laufen mit dem Kalender ab, Trainings erst, wenn sie eingetragen sind.

export function resolveSlot(rotation, session) {
  const st = rotation[session.slot];
  if (Number.isInteger(session.slot) && st?.type === 'training' && st.trainingId === session.trainingId) {
    return session.slot;
  }
  const i = rotation.findIndex(x => x.type === 'training' && x.trainingId === session.trainingId);
  return i === -1 ? null : i;
}

// Was als Nächstes dran ist: { slot, trainingId, due, lastDate } oder null ohne Plan.
export function planStatus(state, today) {
  const rot = state.rotation;
  const n = rot.length;
  if (!rot.some(x => x.type === 'training')) return null;

  const sorted = sortSessions(state.sessions.filter(s => s.date <= today)).reverse();
  for (const s of sorted) {
    const slot = resolveSlot(rot, s);
    if (slot === null) continue;
    let k = (slot + 1) % n;
    let rest = 0;
    while (rot[k].type !== 'training') {
      rest++;
      k = (k + 1) % n;
    }
    return { slot: k, trainingId: rot[k].trainingId, due: addDays(s.date, rest + 1), lastDate: s.date };
  }

  const first = rot.findIndex(x => x.type === 'training');
  return { slot: first, trainingId: rot[first].trainingId, due: today, lastDate: null };
}

// Position einer neuen Einheit in der Reihenfolge. Weicht das Training vom Plan ab,
// geht es ab dessen nächstem Vorkommen weiter.
export function slotForNewSession(state, trainingId, today) {
  const plan = planStatus(state, today);
  if (!plan) return null;
  const rot = state.rotation;
  for (let i = 0; i < rot.length; i++) {
    const k = (plan.slot + i) % rot.length;
    if (rot[k].type === 'training' && rot[k].trainingId === trainingId) return k;
  }
  return null;
}

// Die nächsten Schritte ab dem geplanten Training, einer pro Tag.
export function upcoming(state, today, count = 4) {
  const plan = planStatus(state, today);
  if (!plan) return [];
  const rot = state.rotation;
  let date = plan.due < today ? today : plan.due;
  let k = plan.slot;
  const out = [{ date, ...rot[k] }];
  while (out.length < count) {
    k = (k + 1) % rot.length;
    date = addDays(date, 1);
    out.push({ date, ...rot[k] });
  }
  return out;
}
