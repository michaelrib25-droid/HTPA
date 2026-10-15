import { Store, todayIso, formatDateDisplay } from './store.js';
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
    x: formatDateDisplay(p.date),
    y: p.weight,
    tooltip: `${p.weight}kg`
  }));

  if (points.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-hint';
    empty.textContent = 'No bodyweight entries yet.';
    container.appendChild(empty);
    return;
  }

  const chartContainer = document.createElement('div');
  container.appendChild(chartContainer);
  renderLineChart(chartContainer, points);

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

      const label = document.createElement('span');
      label.textContent = `${formatDateDisplay(entry.date)}: ${entry.weight}kg`;
      row.appendChild(label);

      const deleteBtn = document.createElement('button');
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
