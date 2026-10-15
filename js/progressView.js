import { Store, formatDateDisplay } from './store.js';
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
      x: formatDateDisplay(p.date),
      y: p.weight,
      tooltip: `${p.weight}kg × ${p.reps}`
    }));
    renderLineChart(chartContainer, points);
  }

  select.addEventListener('change', () => drawFor(select.value));
  drawFor(select.value);
}
