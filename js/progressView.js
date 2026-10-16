import { Store, formatDateDisplay } from './store.js';
import { renderLineChart } from './chart.js';
import { createIcon } from './icons.js';

// Maps RPE to a gradient between the app's own accent (easier) and its
// existing error red (harder), rather than an arbitrary blue-red hue sweep —
// keeps the chart's effort coloring inside the app's existing 3-color palette.
// Scaled over RPE_MIN..10, not 0..10 — logged RPE in practice is almost
// always 6-10 (nobody logs a warmup set's RPE), so stretching the full
// gradient across 0-10 left every real point bunched in the red end with
// barely any visible difference between an "easy" and "hard" session.
const RPE_EASY = [0x4f, 0x6d, 0xf5];
const RPE_HARD = [0xff, 0x6b, 0x6b];
const RPE_GRADIENT_MIN = 5;
function rpeColor(rpe) {
  const t = Math.max(0, Math.min(10, rpe) - RPE_GRADIENT_MIN) / (10 - RPE_GRADIENT_MIN);
  const [r, g, b] = RPE_EASY.map((c, i) => Math.round(c + (RPE_HARD[i] - c) * t));
  return `rgb(${r}, ${g}, ${b})`;
}

export function renderProgressView(container) {
  container.innerHTML = '';
  container.className = 'progress-view';

  const exercises = Store.distinctExercises();

  if (exercises.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-hint';
    const icon = createIcon('progress');
    if (icon) { icon.classList.add('empty-hint-icon'); empty.appendChild(icon); }
    const text = document.createElement('p');
    text.textContent = 'No exercises logged yet — add a session in Log.';
    empty.appendChild(text);
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
  const recentKey = Store.mostRecentlyTrainedExerciseKey();
  if (recentKey && exercises.some((ex) => ex.key === recentKey)) {
    select.value = recentKey;
  }
  container.appendChild(select);

  const METRICS = {
    weight: {
      label: 'Top set',
      unit: 'kg',
      caption: 'Heaviest set logged per session, in kg.',
      value: (p) => p.weight,
      tooltip: (p) => `top set ${p.weight}kg × ${p.reps}`
    },
    volume: {
      label: 'Volume',
      unit: 'kg',
      caption: 'Total volume (weight × reps, summed across all sets) per session, in kg.',
      value: (p) => p.volume,
      tooltip: (p) => `volume ${p.volume}kg`
    },
    e1rm: {
      label: 'Est. 1RM',
      unit: 'kg',
      caption: 'Estimated one-rep max per session (Epley formula), in kg.',
      value: (p) => p.e1rm,
      tooltip: (p) => `est. 1RM ${p.e1rm}kg (from ${p.weight}kg × ${p.reps})`
    }
  };
  let metric = 'weight';

  const metricToggle = document.createElement('div');
  metricToggle.className = 'toggle-group';
  const metricButtons = {};
  Object.entries(METRICS).forEach(([key, def]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = key === metric ? 'secondary-btn active' : 'secondary-btn';
    btn.textContent = def.label;
    btn.addEventListener('click', () => {
      if (metric === key) return;
      metric = key;
      Object.entries(metricButtons).forEach(([k, b]) => b.classList.toggle('active', k === metric));
      drawFor(select.value);
    });
    metricButtons[key] = btn;
    metricToggle.appendChild(btn);
  });
  container.appendChild(metricToggle);

  const caption = document.createElement('p');
  caption.className = 'chart-caption';
  container.appendChild(caption);

  const chartContainer = document.createElement('div');
  container.appendChild(chartContainer);

  function drawFor(key) {
    const def = METRICS[metric];
    caption.textContent = `${def.caption} Point color reflects RPE when logged (blue = easier, red = harder). Hover (or tap) a point for details.`;
    const points = Store.getProgressPoints(key).map((p) => ({
      x: p.date.slice(5).replace('-', '.'),
      y: def.value(p),
      tooltip: `${formatDateDisplay(p.date)} — ${def.tooltip(p)}` + (p.rpe != null ? ` @ RPE ${p.rpe}` : ''),
      pointColor: p.rpe != null ? rpeColor(p.rpe) : undefined
    }));
    renderLineChart(chartContainer, points, { color: '#4f6df5', unit: def.unit });
  }

  select.addEventListener('change', () => drawFor(select.value));
  drawFor(select.value);
}
