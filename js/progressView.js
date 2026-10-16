import { Store, formatDateDisplay, normalizeKey } from './store.js';
import { renderLineChart } from './chart.js';

// The exercise most recently trained (last session, its first entry), so the
// picker opens on something relevant instead of forcing a scroll/select every time.
// Reverse to most-recently-added-first before the date sort: `date` is day-only,
// so two sessions logged the same day compare as equal and a plain sort would
// otherwise fall back to original (oldest-first) insertion order on that tie.
function mostRecentExerciseKey() {
  const sorted = [...Store.data.sessions].reverse().sort((a, b) => b.date.localeCompare(a.date));
  for (const session of sorted) {
    if (session.entries.length > 0) return normalizeKey(session.entries[0].exercise);
  }
  return null;
}

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
  const recentKey = mostRecentExerciseKey();
  if (recentKey && exercises.some((ex) => ex.key === recentKey)) {
    select.value = recentKey;
  }
  container.appendChild(select);

  const caption = document.createElement('p');
  caption.className = 'chart-caption';
  caption.textContent = 'Heaviest set logged per session, in kg. Hover (or tap) a point for the date and reps.';
  container.appendChild(caption);

  const chartContainer = document.createElement('div');
  container.appendChild(chartContainer);

  function drawFor(key) {
    const points = Store.getProgressPoints(key).map((p) => ({
      x: p.date.slice(5).replace('-', '.'),
      y: p.weight,
      tooltip: `${formatDateDisplay(p.date)} — top set ${p.weight}kg × ${p.reps}`
    }));
    renderLineChart(chartContainer, points, { color: '#4f6df5', unit: 'kg' });
  }

  select.addEventListener('change', () => drawFor(select.value));
  drawFor(select.value);
}
