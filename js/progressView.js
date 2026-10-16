import { Store, formatDateDisplay } from './store.js';
import { renderLineChart } from './chart.js';

// Maps RPE 0-10 to a blue (easier) -> red (harder) hue, so effort is visible
// on the chart itself without a separate legend widget.
function rpeColor(rpe) {
  const clamped = Math.max(0, Math.min(10, rpe));
  const hue = 220 - (clamped / 10) * 220;
  return `hsl(${hue}, 70%, 58%)`;
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
  const recentKey = Store.mostRecentlyTrainedExerciseKey();
  if (recentKey && exercises.some((ex) => ex.key === recentKey)) {
    select.value = recentKey;
  }
  container.appendChild(select);

  const caption = document.createElement('p');
  caption.className = 'chart-caption';
  caption.textContent = 'Heaviest set logged per session, in kg. Point color reflects RPE when logged (blue = easier, red = harder). Hover (or tap) a point for details.';
  container.appendChild(caption);

  const chartContainer = document.createElement('div');
  container.appendChild(chartContainer);

  function drawFor(key) {
    const points = Store.getProgressPoints(key).map((p) => ({
      x: p.date.slice(5).replace('-', '.'),
      y: p.weight,
      tooltip: `${formatDateDisplay(p.date)} — top set ${p.weight}kg × ${p.reps}` + (p.rpe != null ? ` @ RPE ${p.rpe}` : ''),
      pointColor: p.rpe != null ? rpeColor(p.rpe) : undefined
    }));
    renderLineChart(chartContainer, points, { color: '#4f6df5', unit: 'kg' });
  }

  select.addEventListener('change', () => drawFor(select.value));
  drawFor(select.value);
}
