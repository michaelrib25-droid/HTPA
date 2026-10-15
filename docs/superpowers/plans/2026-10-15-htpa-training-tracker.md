# HTPA Training Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the HTPA PWA — a local, offline-capable workout/training-set logger with session history, per-exercise progress charts, personal records, and bodyweight tracking.

**Architecture:** Vanilla HTML/CSS/JS (ES modules), no build step, no framework. `store.js` owns all `localStorage` persistence plus every read-time derivation (distinct exercise names, per-exercise progress points, PRs, bodyweight points). `chart.js` is a single hand-rolled inline-SVG line chart reused by both the Progress and Bodyweight tabs. Each of the five tab view modules (`logView.js`, `historyView.js`, `progressView.js`, `recordsView.js`, `bodyweightView.js`) owns its whole tab, including calling `store.js` for the mutations relevant to that tab — only cross-tab navigation (Edit → switch to Log) bubbles up to `app.js`, which owns the tab-switching state and the top-level render loop.

**Tech Stack:** Plain JavaScript (ES modules), HTML5, CSS3, a 40-line Node static file server for local testing (no npm dependencies), Service Worker for offline caching, a git `pre-commit` hook (POSIX shell) for cache-busting on deploy.

**Spec:** `docs/superpowers/specs/2026-10-15-htpa-training-tracker-design.md`

## Global Constraints

- No build tools/frameworks — plain vanilla HTML/CSS/JS using native ES modules.
- All persistence is local only, via `localStorage` under the single key `htpa_training_v1`.
- Exercises are flat/string-keyed, not a normalized library — exercise lists, progress points, and PRs are always derived at read time from `sessions`, never stored as a separate entity.
- RPE is optional on every set.
- `sessions` and `bodyweight` are independent arrays; multiple entries on the same date are allowed in both, with no dedup/merge logic.
- No automated test suite — the spec explicitly rejects one as disproportionate for a single-user offline app. Each task below is verified manually in the browser (desktop first, then phone) instead of with `assert`/test-runner code.
- Scope excludes fixed weekly routines/templates, social features, multi-user support, cloud sync, and nutrition tracking.
- The real project repo (`https://github.com/michaelrib25-droid/HTPA`, GitHub Pages already enabled at `https://michaelrib25-droid.github.io/HTPA/`) already exists and contains the hello-world pipeline-test skeleton (`index.html`, `manifest.json`, `service-worker.js`, `icons/`) plus the approved spec — this plan replaces/extends that skeleton in place, it does not start a new repo.

## Review Focus

- First start with zero sessions/bodyweight — every view (Log's autocomplete, History, Progress's exercise picker, Records, Bodyweight's chart) must show a helpful empty-state message instead of a blank or broken screen. Covered across Tasks 4, 5, 6, 7, 8.
- Exercise name variants ("Bench" vs "Bench Press ", differing case/whitespace) must group correctly for autocomplete, Progress, and Records via trim+lowercase matching, displaying the most-recently-used casing. Covered in Task 2, re-verified in Tasks 6 and 7.
- Editing a session must preserve its original `id` (no duplicate created) and the change must be reflected consistently in History, Progress, and Records. Covered in Task 5.
- Deleting the only session referencing an exercise must make that exercise disappear from the Progress picker and Records list on the next render — since nothing about an exercise is stored except inside the sessions that reference it. Covered in Task 5, re-verified in Tasks 6 and 7.
- Saving the Log form with no complete exercise/set must not silently create an empty session, and must tell the user why nothing was saved. Covered in Task 4.

---

## Task 1: Project scaffold

**Files:**
- Modify: `index.html` (replace hello-world placeholder content)
- Modify: `manifest.json` (replace hello-world name/short_name)
- Modify: `service-worker.js` (replace with a dev-mode placeholder; finalized in Task 10)
- Create: `server.js`
- Create: `css/styles.css` (base reset + generic input/button/empty-hint styles only; component-specific CSS appended in later tasks)
- Icons: `icons/icon-192.png` and `icons/icon-512.png` already exist from the hello-world pipeline test — no action needed.

**Interfaces:**
- Produces: `#app` root `<div>` in `index.html` that `js/app.js` (Task 9) renders into.

- [ ] **Step 1: Replace `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>HTPA Training Tracker</title>
<link rel="manifest" href="manifest.json" />
<meta name="theme-color" content="#1a1a2e" />
<link rel="icon" href="icons/icon-192.png" />
<link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Replace `manifest.json`**

```json
{
  "name": "HTPA Training Tracker",
  "short_name": "HTPA",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "orientation": "portrait",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 3: Replace `service-worker.js` with a dev-mode placeholder** (final asset list added in Task 10; this version just keeps the app installable while building)

```js
const CACHE_NAME = 'htpa-dev';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
```

- [ ] **Step 4: Create `server.js`** (same pattern as HNSA/hello-world)

```js
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 8000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 5: Create `css/styles.css`**

```css
:root {
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #1a1a2e;
  color: #f5f5f7;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  height: 100%;
}
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
input, select, button {
  font-size: 1rem;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #44446a;
  background: #22223b;
  color: #f5f5f7;
}
button {
  cursor: pointer;
  background: #2d2d44;
}
button.save-btn, button.active {
  background: #4f6df5;
  border-color: #4f6df5;
}
h2 { font-size: 1.2rem; margin: 12px 0 8px; }
.empty-hint { color: #a0a0b0; padding: 16px; text-align: center; }
```

- [ ] **Step 6: Create an empty `js/app.js` so the page doesn't 404 on the module script, and verify the scaffold loads**

```js
document.getElementById('app').textContent = 'HTPA – scaffold loading.';
```

Start the server:

```bash
cd "C:/Users/micha/desktop/HTPA" && node server.js
```

In a second terminal:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/index.html
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/manifest.json
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/icons/icon-192.png
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/js/app.js
```

Expected: all four return `HTTP 200`. Leave the server running in the background for the remaining tasks.

- [ ] **Step 7: Commit and push**

```bash
cd "C:/Users/micha/desktop/HTPA"
git add index.html manifest.json service-worker.js server.js css/styles.css js/app.js
git commit -m "Replace hello-world placeholder with HTPA app scaffold"
git push
```

---

## Task 2: `js/store.js` — persistence and derived data

**Files:**
- Create: `js/store.js`

**Interfaces:**
- Consumes: nothing (only `localStorage`, a browser global).
- Produces: the `Store` singleton with `Store.data` (`{ sessions: [], bodyweight: [] }`), `Store.addSession(date, entries)`, `Store.updateSession(id, date, entries)`, `Store.removeSession(id)`, `Store.addBodyweight(date, weight)`, `Store.distinctExercises()` → `[{ key, label }]`, `Store.getProgressPoints(key)` → `[{ date, weight, reps }]` sorted ascending by date, `Store.getAllPRs()` → `[{ label, weight, reps, date }]` sorted alphabetically by label, `Store.getBodyweightPoints()` → `[{ date, weight }]` sorted ascending by date. `entries` is always `[{ exercise: string, sets: [{ weight, reps, rpe }] }]`, `rpe` may be `null`.

- [ ] **Step 1: Write `js/store.js`**

```js
const STORAGE_KEY = 'htpa_training_v1';

function defaultData() {
  return { sessions: [], bodyweight: [] };
}

function genId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeKey(name) {
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

export const Store = {
  data: load(),

  addSession(date, entries) {
    const session = { id: genId('session'), date, entries };
    this.data.sessions.push(session);
    save(this.data);
    return session;
  },

  updateSession(id, date, entries) {
    const session = this.data.sessions.find((s) => s.id === id);
    if (!session) return;
    session.date = date;
    session.entries = entries;
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

  getProgressPoints(key) {
    const points = [];
    for (const session of this.data.sessions) {
      const matchingSets = session.entries
        .filter((e) => normalizeKey(e.exercise) === key)
        .flatMap((e) => e.sets);
      if (matchingSets.length === 0) continue;
      const best = bestSetInSets(matchingSets);
      points.push({ date: session.date, weight: best.weight, reps: best.reps });
    }
    return points.sort((a, b) => a.date.localeCompare(b.date));
  },

  getAllPRs() {
    const prs = new Map(); // key -> { label, weight, reps, date }
    for (const session of this.data.sessions) {
      for (const entry of session.entries) {
        const key = normalizeKey(entry.exercise);
        const best = bestSetInSets(entry.sets);
        if (!best) continue;
        const existing = prs.get(key);
        if (!existing || best.weight > existing.weight ||
            (best.weight === existing.weight && best.reps > existing.reps)) {
          prs.set(key, { label: entry.exercise.trim(), weight: best.weight, reps: best.reps, date: session.date });
        }
      }
    }
    return [...prs.values()].sort((a, b) => a.label.localeCompare(b.label));
  },

  getBodyweightPoints() {
    return this.data.bodyweight
      .map((b) => ({ date: b.date, weight: b.weight }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
};
```

- [ ] **Step 2: Manually verify in the browser console** (server from Task 1 still running; reload `http://localhost:8000/index.html` first)

```js
const { Store } = await import('./js/store.js');
Store.addSession('2026-10-10', [{ exercise: 'Bench Press', sets: [{ weight: 80, reps: 5, rpe: 8 }, { weight: 85, reps: 3, rpe: 9 }] }]);
Store.addSession('2026-10-13', [{ exercise: 'bench press ', sets: [{ weight: 85, reps: 5, rpe: 8 }] }]);
Store.distinctExercises();
```

Expected: one entry, `{ key: 'bench press', label: 'bench press' }` — **Review Focus check**: the second (most recent, by date) session's casing/whitespace variant is used for `label`, and both sessions are grouped under the same `key` despite the differing case/whitespace.

```js
Store.getProgressPoints('bench press');
```

Expected: `[{ date: '2026-10-10', weight: 85, reps: 3 }, { date: '2026-10-13', weight: 85, reps: 5 }]` — the first session's best set is the 85kg×3 one (tie-broken by weight, not reps, since 85 > 80), sorted ascending by date.

```js
Store.getAllPRs();
```

Expected: `[{ label: 'bench press', weight: 85, reps: 5, date: '2026-10-13' }]` — tie between the 85×3 and 85×5 sets broken in favor of higher reps.

**Reload the page** (persistence check), then in the console:

```js
const { Store } = await import('./js/store.js');
Store.data.sessions.length;
```

Expected: `2` — confirms real `localStorage` persistence survives a reload.

- [ ] **Step 3: Clean up test data**

```js
localStorage.removeItem('htpa_training_v1');
```

Reload the page once more and confirm `Store.data.sessions` is back to `[]`.

- [ ] **Step 4: Commit and push**

```bash
cd "C:/Users/micha/desktop/HTPA"
git add js/store.js
git commit -m "Add store.js: persistence plus derived exercise/progress/PR data"
git push
```

---

## Task 3: `js/chart.js` — hand-rolled inline-SVG line chart

**Files:**
- Create: `js/chart.js`
- Modify: `css/styles.css` (append chart styles)

**Interfaces:**
- Consumes: nothing.
- Produces: `renderLineChart(container, points)` where `points` is `[{ x: string, y: number, tooltip: string }]` with **at least one element** — callers are responsible for their own empty-state message and must not call this with an empty array. Consumed by `js/progressView.js` (Task 6) and `js/bodyweightView.js` (Task 8).

- [ ] **Step 1: Write `js/chart.js`**

```js
const WIDTH = 320;
const HEIGHT = 160;
const PADDING = 24;

export function renderLineChart(container, points) {
  container.innerHTML = '';

  const xStep = points.length > 1 ? (WIDTH - PADDING * 2) / (points.length - 1) : 0;
  const values = points.map((p) => p.y);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;

  function scaleY(value) {
    if (range === 0) return HEIGHT / 2;
    return HEIGHT - PADDING - ((value - minVal) / range) * (HEIGHT - PADDING * 2);
  }

  const coords = points.map((p, i) => ({
    x: PADDING + i * xStep,
    y: scaleY(p.y)
  }));

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute('class', 'trend-chart-svg');

  if (coords.length > 1) {
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', coords.map((c) => `${c.x},${c.y}`).join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', '#4f6df5');
    polyline.setAttribute('stroke-width', '2');
    svg.appendChild(polyline);
  }

  coords.forEach((c, i) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', c.x);
    circle.setAttribute('cy', c.y);
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', '#4f6df5');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = points[i].tooltip;
    circle.appendChild(title);

    svg.appendChild(circle);
  });

  container.appendChild(svg);

  const labels = document.createElement('div');
  labels.className = 'trend-chart-labels';
  const first = document.createElement('span');
  first.textContent = points[0].x;
  const last = document.createElement('span');
  last.textContent = points[points.length - 1].x;
  labels.appendChild(first);
  labels.appendChild(last);
  container.appendChild(labels);
}
```

- [ ] **Step 2: Append chart styles to `css/styles.css`**

```css
.trend-chart-svg {
  width: 100%;
  max-width: 400px;
  height: auto;
  background: #22223b;
  border-radius: 8px;
}
.trend-chart-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #a0a0b0;
  max-width: 400px;
  padding: 2px 4px;
}
```

- [ ] **Step 3: Manually verify in the browser console** (reload `http://localhost:8000/index.html`)

```js
const { renderLineChart } = await import('./js/chart.js');
const container = document.createElement('div');
document.body.appendChild(container);
renderLineChart(container, [
  { x: '2026-10-01', y: 80, tooltip: '80kg × 5' },
  { x: '2026-10-08', y: 85, tooltip: '85kg × 3' },
  { x: '2026-10-15', y: 85, tooltip: '85kg × 5' }
]);
```

Expected, inspected visually: an SVG line chart appears below the (still-minimal) app, rising from the first point then flat between the last two (both at weight 85). Hovering/long-pressing a dot shows its tooltip (e.g. "85kg × 5"). The labels row below shows `2026-10-01` on the left and `2026-10-15` on the right.

Also verify the single-point and flat-value cases don't crash:

```js
renderLineChart(container, [{ x: '2026-10-01', y: 80, tooltip: '80kg × 5' }]);
renderLineChart(container, [
  { x: '2026-10-01', y: 80, tooltip: '80kg × 5' },
  { x: '2026-10-08', y: 80, tooltip: '80kg × 5' }
]);
```

Expected: first call shows a single dot with no line; second shows two dots joined by a flat horizontal line (no divide-by-zero error in the console).

Remove the test container when done: `container.remove()`.

- [ ] **Step 4: Commit and push**

```bash
cd "C:/Users/micha/desktop/HTPA"
git add js/chart.js css/styles.css
git commit -m "Add chart.js: hand-rolled inline-SVG line chart"
git push
```

---

## Task 4: `js/logView.js` — Log tab

**Files:**
- Create: `js/logView.js`
- Modify: `css/styles.css` (append log-view styles)

**Interfaces:**
- Consumes: `Store` from `js/store.js` (Task 2) — specifically `Store.distinctExercises()`, `Store.addSession(date, entries)`, `Store.updateSession(id, date, entries)`.
- Produces: `renderLogView(container, existingSession, onDone)` where `existingSession` is `null` for a new entry or `{ id, date, entries }` to edit in place, and `onDone` is a zero-argument callback invoked after a successful save. Consumed by `js/app.js` (Task 9).

- [ ] **Step 1: Write `js/logView.js`**

```js
import { Store } from './store.js';

export function renderLogView(container, existingSession, onDone) {
  container.innerHTML = '';
  container.className = 'log-view';

  const title = document.createElement('h2');
  title.textContent = existingSession ? 'Edit Session' : 'Log Session';
  container.appendChild(title);

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = existingSession ? existingSession.date : todayIso();
  container.appendChild(dateInput);

  const datalist = document.createElement('datalist');
  datalist.id = 'exercise-names';
  Store.distinctExercises().forEach((ex) => {
    const opt = document.createElement('option');
    opt.value = ex.label;
    datalist.appendChild(opt);
  });
  container.appendChild(datalist);

  const exerciseList = document.createElement('div');
  exerciseList.className = 'exercise-list';
  container.appendChild(exerciseList);

  function addSetRow(setsContainer, set) {
    const row = document.createElement('div');
    row.className = 'set-row';

    const weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.step = '0.5';
    weightInput.placeholder = 'kg';
    weightInput.value = set ? set.weight : '';

    const repsInput = document.createElement('input');
    repsInput.type = 'number';
    repsInput.placeholder = 'reps';
    repsInput.value = set ? set.reps : '';

    const rpeInput = document.createElement('input');
    rpeInput.type = 'number';
    rpeInput.step = '0.5';
    rpeInput.placeholder = 'RPE (optional)';
    rpeInput.value = set && set.rpe != null ? set.rpe : '';

    row.appendChild(weightInput);
    row.appendChild(repsInput);
    row.appendChild(rpeInput);
    setsContainer.appendChild(row);
  }

  function addExerciseBlock(prefill) {
    const block = document.createElement('div');
    block.className = 'exercise-block';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.setAttribute('list', 'exercise-names');
    nameInput.placeholder = 'Exercise name';
    nameInput.value = prefill ? prefill.exercise : '';
    block.appendChild(nameInput);

    const setsContainer = document.createElement('div');
    setsContainer.className = 'sets-container';
    block.appendChild(setsContainer);

    if (prefill && prefill.sets.length > 0) {
      prefill.sets.forEach((s) => addSetRow(setsContainer, s));
    } else {
      addSetRow(setsContainer, null);
    }

    const addSetBtn = document.createElement('button');
    addSetBtn.type = 'button';
    addSetBtn.textContent = '+ Add set';
    addSetBtn.addEventListener('click', () => addSetRow(setsContainer, null));
    block.appendChild(addSetBtn);

    exerciseList.appendChild(block);
  }

  if (existingSession) {
    existingSession.entries.forEach((entry) => addExerciseBlock(entry));
  } else {
    addExerciseBlock(null);
  }

  const addExerciseBtn = document.createElement('button');
  addExerciseBtn.type = 'button';
  addExerciseBtn.textContent = '+ Add exercise';
  addExerciseBtn.addEventListener('click', () => addExerciseBlock(null));
  container.appendChild(addExerciseBtn);

  const errorMsg = document.createElement('p');
  errorMsg.className = 'log-error';
  errorMsg.textContent = 'Add at least one exercise with a complete set (name, weight, and reps) before saving.';
  errorMsg.style.display = 'none';
  container.appendChild(errorMsg);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const entries = collectEntries(exerciseList);
    if (entries.length === 0) {
      errorMsg.style.display = 'block';
      return;
    }
    if (existingSession) {
      Store.updateSession(existingSession.id, dateInput.value, entries);
    } else {
      Store.addSession(dateInput.value, entries);
    }
    onDone();
  });
  container.appendChild(saveBtn);
}

function collectEntries(exerciseList) {
  const entries = [];
  exerciseList.querySelectorAll('.exercise-block').forEach((block) => {
    const name = block.querySelector('input[type="text"]').value.trim();
    if (!name) return;
    const sets = [];
    block.querySelectorAll('.set-row').forEach((row) => {
      const [weightInput, repsInput, rpeInput] = row.querySelectorAll('input');
      if (!weightInput.value || !repsInput.value) return;
      sets.push({
        weight: Number(weightInput.value),
        reps: Number(repsInput.value),
        rpe: rpeInput.value ? Number(rpeInput.value) : null
      });
    });
    if (sets.length > 0) entries.push({ exercise: name, sets });
  });
  return entries;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Append log-view styles to `css/styles.css`**

```css
.log-view, .history-view, .progress-view, .records-view, .bodyweight-view {
  padding: 12px;
  flex: 1;
}
.exercise-block {
  background: #22223b;
  border-radius: 8px;
  padding: 10px;
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sets-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.set-row {
  display: flex;
  gap: 6px;
}
.set-row input {
  flex: 1;
  min-width: 0;
}
.log-error {
  color: #ff6b6b;
  font-size: 0.85rem;
}
```

- [ ] **Step 3: Manually verify in the browser** (reload `http://localhost:8000/index.html`, console)

```js
const { renderLogView } = await import('./js/logView.js');
const container = document.createElement('div');
document.body.appendChild(container);
renderLogView(container, null, () => console.log('saved'));
```

1. Click "Save" with everything empty → the red error message appears, nothing is logged to the console, and `(await import('./js/store.js')).Store.data.sessions` is still empty (**Review Focus**: no empty session is created).
2. Type "Bench Press" in the exercise name field, fill weight `80` and reps `5`, leave RPE blank, click "Save" → console logs `saved`.
3. Re-run `renderLogView` fresh and check the browser's native autocomplete dropdown on the exercise name field now offers "Bench Press" (confirms the `<datalist>` is wired to `Store.distinctExercises()`).
4. Test edit mode:

```js
const { Store } = await import('./js/store.js');
const session = Store.data.sessions[0];
renderLogView(container, session, () => console.log('saved edit'));
```

Expected: the form is pre-filled with the existing date, exercise name, and set values. Change the weight to `82`, click Save → console logs `saved edit`, and `Store.data.sessions.length` is still `1` (the same session was updated in place, not duplicated — **Review Focus** check carried forward into Task 5's fuller verification).

Clean up: `localStorage.removeItem('htpa_training_v1'); container.remove();`

- [ ] **Step 4: Commit and push**

```bash
cd "C:/Users/micha/desktop/HTPA"
git add js/logView.js css/styles.css
git commit -m "Add logView.js: new/edit workout session form"
git push
```

---

## Task 5: `js/historyView.js` — History tab

**Files:**
- Create: `js/historyView.js`
- Modify: `css/styles.css` (append history-view styles)

**Interfaces:**
- Consumes: `Store` from `js/store.js` (Task 2) — `Store.data.sessions`, `Store.removeSession(id)`.
- Produces: `renderHistoryView(container, callbacks)` where `callbacks = { onEdit(session) }`. Consumed by `js/app.js` (Task 9).

- [ ] **Step 1: Write `js/historyView.js`**

```js
import { Store } from './store.js';

export function renderHistoryView(container, callbacks) {
  container.innerHTML = '';
  container.className = 'history-view';

  const sessions = [...Store.data.sessions].sort((a, b) => b.date.localeCompare(a.date));

  if (sessions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-hint';
    empty.textContent = 'No sessions logged yet — add one in Log.';
    container.appendChild(empty);
    return;
  }

  sessions.forEach((session) => {
    const totalSets = session.entries.reduce((sum, e) => sum + e.sets.length, 0);

    const row = document.createElement('div');
    row.className = 'history-row';

    const summary = document.createElement('button');
    summary.className = 'history-summary';
    summary.textContent = `${session.date} — ${session.entries.length} exercise(s), ${totalSets} set(s)`;
    row.appendChild(summary);

    const detail = document.createElement('div');
    detail.className = 'history-detail';
    detail.style.display = 'none';

    session.entries.forEach((entry) => {
      const line = document.createElement('p');
      const setsText = entry.sets
        .map((s) => `${s.weight}kg × ${s.reps}${s.rpe != null ? ` @RPE ${s.rpe}` : ''}`)
        .join(', ');
      line.textContent = `${entry.exercise}: ${setsText}`;
      detail.appendChild(line);
    });

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => callbacks.onEdit(session));
    detail.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      Store.removeSession(session.id);
      renderHistoryView(container, callbacks);
    });
    detail.appendChild(deleteBtn);

    summary.addEventListener('click', () => {
      detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    });

    row.appendChild(detail);
    container.appendChild(row);
  });
}
```

- [ ] **Step 2: Append history-view styles to `css/styles.css`**

```css
.history-row {
  border-bottom: 1px solid #2a2a45;
  padding: 8px 0;
}
.history-summary {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 6px 0;
  color: #f5f5f7;
  font-size: 0.95rem;
}
.history-detail {
  padding: 6px 0 6px 12px;
}
.history-detail p {
  margin: 4px 0;
  font-size: 0.9rem;
}
```

- [ ] **Step 3: Manually verify in the browser** (reload `http://localhost:8000/index.html`, console)

```js
const { Store } = await import('./js/store.js');
Store.addSession('2026-10-10', [{ exercise: 'Bench Press', sets: [{ weight: 80, reps: 5, rpe: null }] }]);
Store.addSession('2026-10-12', [{ exercise: 'Squat', sets: [{ weight: 100, reps: 5, rpe: 8 }] }]);

const { renderHistoryView } = await import('./js/historyView.js');
const container = document.createElement('div');
document.body.appendChild(container);
renderHistoryView(container, { onEdit: (s) => console.log('edit', s) });
```

Expected: two rows, newest (`2026-10-12`) first. Click a row's summary → it expands showing the exercise/set breakdown with Edit/Delete buttons; click again → collapses.

1. Click "Edit" on the Squat row → console logs `edit` with that session's full object (including its `id`).
2. Click "Delete" on the Bench Press row → that row disappears immediately, and `Store.data.sessions.length` is now `1`.
3. **Review Focus check**: before deleting, confirm in the console that `(await import('./js/store.js')).Store.distinctExercises()` lists both "Bench Press" and "Squat"; after deleting the Bench Press row, re-run it and confirm only "Squat" remains — the deleted exercise disappears without any separate cleanup step.

Clean up: `localStorage.removeItem('htpa_training_v1'); container.remove();`

- [ ] **Step 4: Commit and push**

```bash
cd "C:/Users/micha/desktop/HTPA"
git add js/historyView.js css/styles.css
git commit -m "Add historyView.js: session list with expand/edit/delete"
git push
```

---

## Task 6: `js/progressView.js` — Progress tab

**Files:**
- Create: `js/progressView.js`
- Modify: `css/styles.css` (append progress-view styles)

**Interfaces:**
- Consumes: `Store` from `js/store.js` (Task 2) — `Store.distinctExercises()`, `Store.getProgressPoints(key)`; `renderLineChart` from `js/chart.js` (Task 3).
- Produces: `renderProgressView(container)` — fully self-contained, no callbacks. Consumed by `js/app.js` (Task 9).

- [ ] **Step 1: Write `js/progressView.js`**

```js
import { Store } from './store.js';
import { renderLineChart } from './chart.js';

export function renderProgressView(container) {
  container.innerHTML = '';
  container.className = 'progress-view';

  const exercises = Store.distinctExercises();

  if (exercises.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-hint';
    empty.textContent = 'No exercises logged yet — add a session in Log.';
    container.appendChild(empty);
    return;
  }

  const select = document.createElement('select');
  exercises.forEach((ex) => {
    const opt = document.createElement('option');
    opt.value = ex.key;
    opt.textContent = ex.label;
    select.appendChild(opt);
  });
  container.appendChild(select);

  const chartContainer = document.createElement('div');
  container.appendChild(chartContainer);

  function drawFor(key) {
    const points = Store.getProgressPoints(key).map((p) => ({
      x: p.date,
      y: p.weight,
      tooltip: `${p.weight}kg × ${p.reps}`
    }));
    renderLineChart(chartContainer, points);
  }

  select.addEventListener('change', () => drawFor(select.value));
  drawFor(select.value);
}
```

- [ ] **Step 2: Append progress-view styles to `css/styles.css`**

```css
.progress-view select {
  margin-bottom: 12px;
  width: 100%;
}
```

- [ ] **Step 3: Manually verify in the browser** (reload `http://localhost:8000/index.html`, console)

```js
const container = document.createElement('div');
document.body.appendChild(container);
const { renderProgressView } = await import('./js/progressView.js');
renderProgressView(container);
```

Expected with no data yet: "No exercises logged yet — add a session in Log." (**Review Focus**: empty state).

```js
const { Store } = await import('./js/store.js');
Store.addSession('2026-10-01', [{ exercise: 'Bench Press', sets: [{ weight: 80, reps: 5, rpe: null }] }]);
Store.addSession('2026-10-08', [{ exercise: 'bench press ', sets: [{ weight: 85, reps: 5, rpe: null }] }]);
Store.addSession('2026-10-08', [{ exercise: 'Squat', sets: [{ weight: 100, reps: 5, rpe: null }] }]);
renderProgressView(container);
```

Expected: the `<select>` has exactly **two** options, "bench press" and "Squat" — **Review Focus check**: the casing/whitespace variant ("bench press " vs "Bench Press") did not create a third dropdown entry. The chart initially shows the bench-press line as two points (80→85). Change the dropdown to "Squat" → the chart redraws to Squat's single point.

Clean up: `localStorage.removeItem('htpa_training_v1'); container.remove();`

- [ ] **Step 4: Commit and push**

```bash
cd "C:/Users/micha/desktop/HTPA"
git add js/progressView.js css/styles.css
git commit -m "Add progressView.js: per-exercise progress chart"
git push
```

---

## Task 7: `js/recordsView.js` — Records tab

**Files:**
- Create: `js/recordsView.js`
- Modify: `css/styles.css` (append records-view styles)

**Interfaces:**
- Consumes: `Store` from `js/store.js` (Task 2) — `Store.getAllPRs()`.
- Produces: `renderRecordsView(container)` — fully self-contained, no callbacks. Consumed by `js/app.js` (Task 9).

- [ ] **Step 1: Write `js/recordsView.js`**

```js
import { Store } from './store.js';

export function renderRecordsView(container) {
  container.innerHTML = '';
  container.className = 'records-view';

  const prs = Store.getAllPRs();

  if (prs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-hint';
    empty.textContent = 'No personal records yet — add a session in Log.';
    container.appendChild(empty);
    return;
  }

  prs.forEach((pr) => {
    const row = document.createElement('p');
    row.className = 'record-row';
    row.textContent = `${pr.label}: ${pr.weight}kg × ${pr.reps} (${pr.date})`;
    container.appendChild(row);
  });
}
```

- [ ] **Step 2: Append records-view styles to `css/styles.css`**

```css
.record-row {
  background: #22223b;
  border-radius: 8px;
  padding: 8px 12px;
  margin: 6px 0;
}
```

- [ ] **Step 3: Manually verify in the browser** (reload `http://localhost:8000/index.html`, console)

```js
const container = document.createElement('div');
document.body.appendChild(container);
const { renderRecordsView } = await import('./js/recordsView.js');
renderRecordsView(container);
```

Expected with no data: "No personal records yet — add a session in Log." (**Review Focus**: empty state).

```js
const { Store } = await import('./js/store.js');
Store.addSession('2026-10-01', [{ exercise: 'Bench Press', sets: [
  { weight: 80, reps: 5, rpe: null },
  { weight: 85, reps: 3, rpe: null }
] }]);
Store.addSession('2026-10-08', [{ exercise: 'bench press', sets: [{ weight: 85, reps: 5, rpe: null }] }]);
renderRecordsView(container);
```

Expected: a single row `"Bench Press: 85kg × 5 (2026-10-08)"` — confirms the casing-variant "bench press" is grouped into the same record as "Bench Press" (**Review Focus**), and the weight tie between the two 85kg sets is broken in favor of the higher-rep one.

Clean up: `localStorage.removeItem('htpa_training_v1'); container.remove();`

- [ ] **Step 4: Commit and push**

```bash
cd "C:/Users/micha/desktop/HTPA"
git add js/recordsView.js css/styles.css
git commit -m "Add recordsView.js: personal records per exercise"
git push
```

---

## Task 8: `js/bodyweightView.js` — Bodyweight tab

**Files:**
- Create: `js/bodyweightView.js`
- Modify: `css/styles.css` (append bodyweight-view styles)

**Interfaces:**
- Consumes: `Store` from `js/store.js` (Task 2) — `Store.addBodyweight(date, weight)`, `Store.getBodyweightPoints()`; `renderLineChart` from `js/chart.js` (Task 3).
- Produces: `renderBodyweightView(container)` — fully self-contained, no callbacks. Consumed by `js/app.js` (Task 9).

- [ ] **Step 1: Write `js/bodyweightView.js`**

```js
import { Store } from './store.js';
import { renderLineChart } from './chart.js';

export function renderBodyweightView(container) {
  container.innerHTML = '';
  container.className = 'bodyweight-view';

  const form = document.createElement('div');
  form.className = 'bodyweight-form';

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = todayIso();
  form.appendChild(dateInput);

  const weightInput = document.createElement('input');
  weightInput.type = 'number';
  weightInput.step = '0.1';
  weightInput.placeholder = 'kg';
  form.appendChild(weightInput);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    if (!weightInput.value) return;
    Store.addBodyweight(dateInput.value, Number(weightInput.value));
    renderBodyweightView(container);
  });
  form.appendChild(saveBtn);

  container.appendChild(form);

  const points = Store.getBodyweightPoints().map((p) => ({
    x: p.date,
    y: p.weight,
    tooltip: `${p.weight}kg`
  }));

  if (points.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-hint';
    empty.textContent = 'No bodyweight entries yet.';
    container.appendChild(empty);
  } else {
    const chartContainer = document.createElement('div');
    container.appendChild(chartContainer);
    renderLineChart(chartContainer, points);
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Append bodyweight-view styles to `css/styles.css`**

```css
.bodyweight-form {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.bodyweight-form input {
  flex: 1;
}
```

- [ ] **Step 3: Manually verify in the browser** (reload `http://localhost:8000/index.html`, console)

```js
const container = document.createElement('div');
document.body.appendChild(container);
const { renderBodyweightView } = await import('./js/bodyweightView.js');
renderBodyweightView(container);
```

Expected: a date input (defaulted to today), a weight input, a Save button, and "No bodyweight entries yet." below (**Review Focus**: empty state).

1. Type `78.5` in the weight field, click Save → the view re-renders, the empty-state text is replaced by a single-point chart, and the form resets to today's date with an empty weight field.
2. Change the date to an earlier date, enter a different weight, click Save again → the chart now shows two points in chronological order (not insertion order), confirming `getBodyweightPoints()` sorts by date.

Clean up: `localStorage.removeItem('htpa_training_v1'); container.remove();`

- [ ] **Step 4: Commit and push**

```bash
cd "C:/Users/micha/desktop/HTPA"
git add js/bodyweightView.js css/styles.css
git commit -m "Add bodyweightView.js: bodyweight entry and trend chart"
git push
```

---

## Task 9: `js/app.js` — tab navigation and integration

**Files:**
- Create: `js/app.js` (overwrites the Task 1 placeholder)
- Modify: `css/styles.css` (append tab-nav styles)

**Interfaces:**
- Consumes: `renderLogView` from `js/logView.js` (Task 4); `renderHistoryView` from `js/historyView.js` (Task 5); `renderProgressView` from `js/progressView.js` (Task 6); `renderRecordsView` from `js/recordsView.js` (Task 7); `renderBodyweightView` from `js/bodyweightView.js` (Task 8).
- Produces: nothing consumed elsewhere — this is the top-level entry point registered from `index.html`.

- [ ] **Step 1: Write `js/app.js`**

```js
import { renderLogView } from './logView.js';
import { renderHistoryView } from './historyView.js';
import { renderProgressView } from './progressView.js';
import { renderRecordsView } from './recordsView.js';
import { renderBodyweightView } from './bodyweightView.js';

const appRoot = document.getElementById('app');

const TABS = [
  { id: 'log', label: 'Log' },
  { id: 'history', label: 'History' },
  { id: 'progress', label: 'Progress' },
  { id: 'records', label: 'Records' },
  { id: 'bodyweight', label: 'Bodyweight' }
];

let activeTab = 'log';
let editingSession = null;

function render() {
  appRoot.innerHTML = '';

  const nav = document.createElement('nav');
  nav.className = 'tab-nav';
  TABS.forEach((tab) => {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.className = tab.id === activeTab ? 'active' : '';
    btn.addEventListener('click', () => {
      editingSession = null;
      activeTab = tab.id;
      render();
    });
    nav.appendChild(btn);
  });
  appRoot.appendChild(nav);

  const viewContainer = document.createElement('div');
  viewContainer.className = 'view-container';
  appRoot.appendChild(viewContainer);

  if (activeTab === 'log') {
    renderLogView(viewContainer, editingSession, () => {
      editingSession = null;
      activeTab = 'history';
      render();
    });
  } else if (activeTab === 'history') {
    renderHistoryView(viewContainer, {
      onEdit: (session) => {
        editingSession = session;
        activeTab = 'log';
        render();
      }
    });
  } else if (activeTab === 'progress') {
    renderProgressView(viewContainer);
  } else if (activeTab === 'records') {
    renderRecordsView(viewContainer);
  } else if (activeTab === 'bodyweight') {
    renderBodyweightView(viewContainer);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}

render();
```

- [ ] **Step 2: Append tab-nav styles to `css/styles.css`**

```css
.tab-nav {
  display: flex;
  background: #22223b;
  border-bottom: 1px solid #333358;
  overflow-x: auto;
}
.tab-nav button {
  flex: 1;
  background: none;
  border: none;
  border-radius: 0;
  padding: 12px 6px;
  font-size: 0.8rem;
  color: #a0a0b0;
  white-space: nowrap;
}
.tab-nav button.active {
  color: #f5f5f7;
  border-bottom: 2px solid #4f6df5;
  background: none;
}
.view-container {
  flex: 1;
  overflow-y: auto;
}
```

- [ ] **Step 3: Manually verify the full app end-to-end in the desktop browser** (reload `http://localhost:8000/index.html`)

1. The app loads on the Log tab with an empty form.
2. Fill in "Squat", weight `100`, reps `5`, leave RPE blank, click Save → switches to History tab showing the new session.
3. Expand it, click Edit → switches back to Log tab with the form pre-filled; change weight to `105`, Save → back on History, still exactly one row, now showing `105kg`.
4. Click the Progress tab → dropdown shows "Squat"; chart shows the one point.
5. Click the Records tab → shows `"Squat: 105kg × 5 (today's date)"`.
6. Click the Bodyweight tab → log an entry, confirm the chart appears.
7. Click back to the Log tab (not via Edit) → confirms it opens a **blank** new-entry form, not the stale edit from step 3 (**Review Focus**: tab-switch via nav clears `editingSession`).
8. Reload the page → all of the above (session, bodyweight entry) is still there.

Clean up test data once satisfied: `localStorage.removeItem('htpa_training_v1')`, then reload.

- [ ] **Step 4: Commit and push**

```bash
cd "C:/Users/micha/desktop/HTPA"
git add js/app.js css/styles.css
git commit -m "Add app.js: tab navigation and view wiring"
git push
```

---

## Task 10: Finalize service worker, offline and phone verification

**Files:**
- Modify: `service-worker.js` (replace the Task 1 placeholder with the real caching list)

**Interfaces:**
- Consumes: nothing new — this is the final asset manifest for everything built in Tasks 1–9.

- [ ] **Step 1: Replace `service-worker.js` with the real cache-first implementation**

```js
const CACHE_NAME = 'htpa-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/chart.js',
  './js/logView.js',
  './js/historyView.js',
  './js/progressView.js',
  './js/recordsView.js',
  './js/bodyweightView.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 2: Verify the new service worker installs cleanly on desktop**

Reload `http://localhost:8000/index.html`. DevTools → Application → Service Workers: confirm a worker for `htpa-v1` is "activated and running" (unregister any leftover `htpa-dev` worker from Task 1 first, then reload).

In DevTools → Application → Cache Storage, confirm `htpa-v1` contains all 14 entries from `ASSETS`.

- [ ] **Step 3: Verify real offline behavior on desktop**

DevTools → Network tab → throttling dropdown → "Offline". Reload the page. Expected: the app still loads fully (nav, tabs, any saved data) — confirms the service worker serves from cache when the network is unreachable. Switch throttling back to "No throttling" afterward.

- [ ] **Step 4: Commit and push**

```bash
cd "C:/Users/micha/desktop/HTPA"
git add service-worker.js
git commit -m "Finalize service worker with full offline asset cache list"
git push
```

- [ ] **Step 5: Install and test on the phone**

1. On the phone, same Wi-Fi as the PC, open Chrome and go to `http://<PC-LAN-IP>:8000` (find the PC's LAN IP the same way as for HNSA/hello-world: `Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Select-Object InterfaceAlias, NextHop` in PowerShell, then use the IP on that interface). Confirm `node server.js` from Task 1 is still running.
2. Confirm the app loads and behaves like the desktop verification in Task 9, Step 3.
3. Chrome menu → "Install app".
4. Open the installed app from the home screen icon, log a real session, then turn on airplane mode and reopen the app from the icon — it must still show the data and remain usable.
5. Turn airplane mode back off.

---

## Task 11: Cache-busting deploy hook

**Files:**
- Create: `.githooks/pre-commit`

**Interfaces:**
- Consumes: the `CACHE_NAME` constant declared in `service-worker.js` (Task 10) — the hook rewrites its value, it does not call any JS module.
- Produces: nothing consumed by app code — this only changes repo/git behavior from here on.

- [ ] **Step 1: Create `.githooks/pre-commit`**

```sh
#!/bin/sh
# Auto-bump the service worker cache name whenever an app file changes,
# so GitHub Pages redeploys always invalidate the installed PWA's cache.

changed=$(git diff --cached --name-only --diff-filter=ACMR)

touches_app=false
for f in $changed; do
  case "$f" in
    service-worker.js|.githooks/*|docs/*) ;;
    *) touches_app=true ;;
  esac
done

if [ "$touches_app" = "true" ]; then
  version=$(date -u +%Y%m%d%H%M%S)
  sed -i.bak "s/const CACHE_NAME = '[^']*';/const CACHE_NAME = 'htpa-v$version';/" service-worker.js
  rm -f service-worker.js.bak
  git add service-worker.js
fi
```

- [ ] **Step 2: Make the hook executable and point git at the tracked hooks directory**

```bash
cd "C:/Users/micha/desktop/HTPA"
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

`core.hooksPath` is a local repo setting (stored in `.git/config`, not versioned) — note that a fresh clone of this repo on another machine would need this same `git config` command run once before the hook takes effect there.

- [ ] **Step 3: Verify the hook fires and bumps the cache name**

```bash
cd "C:/Users/micha/desktop/HTPA"
grep "CACHE_NAME" service-worker.js
```

Note the current value (should still be `htpa-v1` from Task 10). Make a trivial, real change to an app file — add a trailing blank line to `css/styles.css` — then commit:

```bash
git add .githooks/pre-commit
echo "" >> css/styles.css
git add css/styles.css
git commit -m "Add pre-commit hook to auto-bump service worker cache name"
grep "CACHE_NAME" service-worker.js
```

Expected: the second `grep` shows a new value like `const CACHE_NAME = 'htpa-v20261015143022';` — different from `htpa-v1` — and:

```bash
git show --stat HEAD
```

Expected: `service-worker.js` is listed as changed in this same commit, even though it was never explicitly `git add`-ed in this step — confirming the hook staged it automatically.

- [ ] **Step 4: Verify the hook does *not* fire for doc-only or hook-only changes**

```bash
cd "C:/Users/micha/desktop/HTPA"
grep "CACHE_NAME" service-worker.js
echo "<!-- test -->" >> docs/superpowers/plans/2026-10-15-htpa-training-tracker.md
git add docs/superpowers/plans/2026-10-15-htpa-training-tracker.md
git commit -m "Test: doc-only change should not bump cache"
grep "CACHE_NAME" service-worker.js
```

Expected: both `grep` outputs are identical — a doc-only commit did not touch `service-worker.js`. Revert that test edit afterward:

```bash
git revert --no-edit HEAD
```

- [ ] **Step 5: Push**

```bash
git push
```

Confirm on GitHub (`https://github.com/michaelrib25-droid/HTPA/commits/main`) that the pre-commit-hook commit and its auto-bumped `service-worker.js` are both present. From now on, any future "commit and push an update" request exercises this same hook automatically — no manual `CACHE_NAME` editing needed, and the installed app on the phone picks up the change on its next open via Chrome's background service-worker check.
<!-- test -->
