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
