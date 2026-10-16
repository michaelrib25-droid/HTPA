const STORAGE_KEY = 'htpa_training_v1';

function defaultData() {
  return { sessions: [], bodyweight: [] };
}

function genId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeKey(name) {
  return name.trim().toLowerCase();
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.bodyweight)) return defaultData();
    return parsed;
  } catch (e) {
    return defaultData();
  }
}

// Deep structural check for *imported* data specifically (not load(), which
// only ever reads the app's own previously-saved state — this is the actual
// external-input boundary). A backup file can pass a shallow "sessions/
// bodyweight are arrays" check while still having e.g. a session with no
// `entries` array, which would otherwise crash every view's render (they all
// go through distinctExercises()) the moment that data is read, bricking the
// whole app until a valid backup is re-imported — and importData() persists
// before anything renders, so the broken data would survive a reload too.
function isValidImport(parsed) {
  if (!parsed || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.bodyweight)) return false;
  return parsed.sessions.every((s) =>
    s && typeof s.date === 'string' && Array.isArray(s.entries) &&
    s.entries.every((e) => e && typeof e.exercise === 'string' && Array.isArray(e.sets) &&
      e.sets.every((set) => set && typeof set.weight === 'number' && typeof set.reps === 'number'))
  ) && parsed.bodyweight.every((b) => b && typeof b.date === 'string' && typeof b.weight === 'number');
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) - data stays in memory only
  }
}

function bestSetInSets(sets) {
  return sets.reduce((best, s) => {
    if (!best) return s;
    if (s.weight > best.weight) return s;
    if (s.weight === best.weight && s.reps > best.reps) return s;
    return best;
  }, null);
}

// Most-recently-added first. `date` is day-only, so two sessions logged the
// same day compare as equal — reversing insertion order *before* the sort
// means a stable sort keeps them in recently-added-first order instead of
// falling back to oldest-first insertion order on that tie.
function sessionsNewestFirst(sessions) {
  return [...sessions].reverse().sort((a, b) => b.date.localeCompare(a.date));
}

function csvField(value) {
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function formatDateDisplay(iso) {
  return iso.replace(/-/g, '.');
}

export function todayIso() {
  // Local calendar date, not toISOString()'s UTC date — otherwise a
  // late-night/early-morning entry can silently land on the wrong day
  // for any user not at UTC+0.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const Store = {
  data: load(),

  addSession(date, entries, durationMinutes = null, caffeineMg = null) {
    const session = { id: genId('session'), date, entries, durationMinutes, caffeineMg };
    this.data.sessions.push(session);
    save(this.data);
    return session;
  },

  updateSession(id, date, entries, durationMinutes = null, caffeineMg = null) {
    const session = this.data.sessions.find((s) => s.id === id);
    if (!session) return;
    session.date = date;
    session.entries = entries;
    session.durationMinutes = durationMinutes;
    session.caffeineMg = caffeineMg;
    save(this.data);
  },

  removeSession(id) {
    this.data.sessions = this.data.sessions.filter((s) => s.id !== id);
    save(this.data);
  },

  addBodyweight(date, weight) {
    const entry = { id: genId('bw'), date, weight };
    this.data.bodyweight.push(entry);
    save(this.data);
    return entry;
  },

  removeBodyweight(id) {
    this.data.bodyweight = this.data.bodyweight.filter((b) => b.id !== id);
    save(this.data);
  },

  distinctExercises() {
    const byKey = new Map(); // key -> { label, lastDate }
    for (const session of this.data.sessions) {
      for (const entry of session.entries) {
        const key = normalizeKey(entry.exercise);
        const existing = byKey.get(key);
        if (!existing || session.date >= existing.lastDate) {
          byKey.set(key, { label: entry.exercise.trim(), lastDate: session.date });
        }
      }
    }
    return [...byKey.entries()]
      .map(([key, v]) => ({ key, label: v.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },

  // Returns one point per session that touched this exercise, carrying all
  // three metrics the Progress chart can show (top-set weight, total volume,
  // estimated 1RM) so the view can switch between them without re-deriving.
  getProgressPoints(key) {
    const points = [];
    for (const session of this.data.sessions) {
      const matchingSets = session.entries
        .filter((e) => normalizeKey(e.exercise) === key)
        .flatMap((e) => e.sets);
      if (matchingSets.length === 0) continue;
      const best = bestSetInSets(matchingSets);
      const volume = matchingSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      // Epley formula, taken from whichever set in the session implies the
      // highest 1RM (not necessarily the heaviest-weight set).
      const e1rm = Math.round(Math.max(...matchingSets.map((s) => s.weight * (1 + s.reps / 30))) * 10) / 10;
      points.push({ date: session.date, weight: best.weight, reps: best.reps, rpe: best.rpe, volume, e1rm });
    }
    return points.sort((a, b) => a.date.localeCompare(b.date));
  },

  mostRecentlyTrainedExerciseKey() {
    for (const session of sessionsNewestFirst(this.data.sessions)) {
      if (session.entries.length > 0) return normalizeKey(session.entries[0].exercise);
    }
    return null;
  },

  // Last-used weight/reps for an exercise, so the Log form can prefill a
  // sensible starting point instead of a blank set.
  getLastSetForExercise(exerciseName) {
    const key = normalizeKey(exerciseName);
    for (const session of sessionsNewestFirst(this.data.sessions)) {
      const matching = session.entries.filter((e) => normalizeKey(e.exercise) === key);
      if (matching.length === 0) continue;
      const sets = matching[matching.length - 1].sets;
      if (sets.length > 0) return sets[sets.length - 1];
    }
    return null;
  },

  getMostRecentSession() {
    return sessionsNewestFirst(this.data.sessions)[0] || null;
  },

  getDurationPoints() {
    return this.data.sessions
      .filter((s) => s.durationMinutes != null)
      .map((s) => ({ date: s.date, value: s.durationMinutes }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  getCaffeinePoints() {
    return this.data.sessions
      .filter((s) => s.caffeineMg != null)
      .map((s) => ({ date: s.date, value: s.caffeineMg }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  getAllPRs() {
    // Label comes from distinctExercises() (most-recently-typed casing),
    // not from whichever entry happened to hold the winning set — otherwise
    // the same exercise can render under two different casings between the
    // Records tab and everywhere else (Progress picker, autocomplete).
    const labelByKey = new Map(this.distinctExercises().map((e) => [e.key, e.label]));
    const prs = new Map(); // key -> { weight, reps, date }
    for (const session of this.data.sessions) {
      for (const entry of session.entries) {
        const key = normalizeKey(entry.exercise);
        const best = bestSetInSets(entry.sets);
        if (!best) continue;
        const existing = prs.get(key);
        if (!existing || best.weight > existing.weight ||
            (best.weight === existing.weight && best.reps > existing.reps)) {
          prs.set(key, { weight: best.weight, reps: best.reps, date: session.date });
        }
      }
    }
    return [...prs.entries()]
      .map(([key, v]) => ({ label: labelByKey.get(key), ...v }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },

  getBodyweightPoints() {
    const points = this.data.bodyweight
      .map((b) => ({ date: b.date, weight: b.weight }))
      .sort((a, b) => a.date.localeCompare(b.date));
    // Trailing 7-*calendar*-day average, not "last 7 entries" — entries
    // aren't necessarily daily, so a count-based window would span a very
    // different amount of real time depending on how often weigh-ins happen.
    const MS_PER_DAY = 86400000;
    return points.map((p) => {
      const windowEnd = new Date(p.date).getTime();
      const windowStart = windowEnd - 6 * MS_PER_DAY;
      const inWindow = points.filter((q) => {
        const t = new Date(q.date).getTime();
        return t >= windowStart && t <= windowEnd;
      });
      const avg7 = inWindow.reduce((sum, q) => sum + q.weight, 0) / inWindow.length;
      return { ...p, avg7: Math.round(avg7 * 10) / 10 };
    });
  },

  exportData() {
    return JSON.stringify(this.data, null, 2);
  },

  // One row per logged set (session-level fields like date/duration/caffeine
  // repeat across that session's rows) — flat and spreadsheet-friendly,
  // unlike exportData()'s nested JSON which is for round-tripping, not analysis.
  exportSessionsCsv() {
    const header = ['Date', 'Exercise', 'Weight (kg)', 'Reps', 'RPE', 'Duration (min)', 'Caffeine (mg)'];
    const rows = [header];
    for (const session of [...this.data.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
      for (const entry of session.entries) {
        for (const set of entry.sets) {
          rows.push([
            session.date,
            entry.exercise,
            set.weight,
            set.reps,
            set.rpe != null ? set.rpe : '',
            session.durationMinutes != null ? session.durationMinutes : '',
            session.caffeineMg != null ? session.caffeineMg : ''
          ]);
        }
      }
    }
    return rows.map((row) => row.map(csvField).join(',')).join('\r\n');
  },

  importData(json) {
    const parsed = JSON.parse(json);
    if (!isValidImport(parsed)) {
      throw new Error('Invalid backup file: does not match the expected sessions/bodyweight structure.');
    }
    this.data = parsed;
    save(this.data);
  }
};
