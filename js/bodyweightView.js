import { Store, todayIso, formatDateDisplay } from './store.js';
import { renderLineChart } from './chart.js';
import { createIcon } from './icons.js';

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
  weightInput.min = '0';
  weightInput.placeholder = 'kg';
  // Prefilled with the last logged weight as a starting point for today's
  // entry — most days it's close, and it's trivially overwritten otherwise.
  const lastEntry = Store.getLastBodyweight();
  if (lastEntry) weightInput.value = lastEntry.weight;
  form.appendChild(weightInput);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  function save() {
    if (!weightInput.value || Number(weightInput.value) <= 0) {
      errorMsg.style.display = 'block';
      return;
    }
    Store.addBodyweight(dateInput.value, Number(weightInput.value));
    renderBodyweightView(container);
  }
  saveBtn.addEventListener('click', save);
  form.appendChild(saveBtn);

  // Enter submits, same as the Log form's input-chain, so a weigh-in can be
  // logged without reaching for the Save button.
  weightInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
  });

  container.appendChild(form);

  const errorMsg = document.createElement('p');
  errorMsg.className = 'form-error';
  errorMsg.textContent = 'Enter a valid weight before saving.';
  errorMsg.style.display = 'none';
  container.appendChild(errorMsg);

  const rawPoints = Store.getBodyweightPoints();
  const points = rawPoints.map((p) => ({
    x: p.date.slice(5).replace('-', '.'),
    y: p.weight,
    tooltip: `${formatDateDisplay(p.date)} — ${p.weight}kg`
  }));

  if (points.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-hint';
    const icon = createIcon('bodyweight');
    if (icon) { icon.classList.add('empty-hint-icon'); empty.appendChild(icon); }
    const text = document.createElement('p');
    text.textContent = 'No bodyweight entries yet.';
    empty.appendChild(text);
    container.appendChild(empty);
    return;
  }

  const caption = document.createElement('p');
  caption.className = 'chart-caption';
  caption.textContent = rawPoints.length > 1
    ? 'Solid = logged weight. Dashed = trailing 7-day average, smoothing day-to-day fluctuation.'
    : 'Solid = logged weight.';
  container.appendChild(caption);

  const chartContainer = document.createElement('div');
  container.appendChild(chartContainer);
  // Teal (the app's secondary accent) distinguishes this from the Progress
  // tab's blue lift charts — same chart component, different meaning. The
  // 7-day average overlay uses the primary accent (dashed) purely to stay
  // inside the app's existing 2-accent + red palette.
  renderLineChart(chartContainer, points, {
    color: '#2dd4bf',
    unit: 'kg',
    secondary: { points: rawPoints.map((p) => ({ y: p.avg7 })), color: '#4f6df5' }
  });

  // A fat-fingered entry (e.g. 785 instead of 78.5) would otherwise be
  // unrecoverable short of clearing all localStorage, which also wipes
  // every workout session — so each entry needs its own delete affordance.
  const list = document.createElement('div');
  list.className = 'bodyweight-list';
  [...Store.data.bodyweight]
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'bodyweight-row';

      const labelGroup = document.createElement('div');
      labelGroup.className = 'bodyweight-row-labels';

      const dateLabel = document.createElement('span');
      dateLabel.className = 'bodyweight-row-date';
      dateLabel.textContent = formatDateDisplay(entry.date);
      labelGroup.appendChild(dateLabel);

      const weightLabel = document.createElement('span');
      weightLabel.className = 'bodyweight-row-weight';
      weightLabel.textContent = `${entry.weight}kg`;
      labelGroup.appendChild(weightLabel);

      row.appendChild(labelGroup);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'danger-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        if (!confirm(`Delete the bodyweight entry from ${formatDateDisplay(entry.date)} (${entry.weight}kg)?`)) return;
        Store.removeBodyweight(entry.id);
        renderBodyweightView(container);
      });
      row.appendChild(deleteBtn);

      list.appendChild(row);
    });
  container.appendChild(list);
}
