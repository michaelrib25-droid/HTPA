import { Store, formatDateDisplay } from './store.js';
import { createIcon } from './icons.js';

export function renderRecordsView(container) {
  container.innerHTML = '';
  container.className = 'records-view';

  const prs = Store.getAllPRs();

  if (prs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-hint';
    const icon = createIcon('records');
    if (icon) { icon.classList.add('empty-hint-icon'); empty.appendChild(icon); }
    const text = document.createElement('p');
    text.textContent = 'No personal records yet — add a session in Log.';
    empty.appendChild(text);
    container.appendChild(empty);
    return;
  }

  prs.forEach((pr) => {
    const row = document.createElement('div');
    row.className = 'record-row';

    const icon = createIcon('records');
    if (icon) { icon.classList.add('record-row-icon'); row.appendChild(icon); }

    // Name + date grouped on the left (what it is), the PR number stands
    // out big on the right (the thing you actually scan for) — one long
    // run-on sentence per row was hard to scan once there were several.
    const info = document.createElement('div');
    info.className = 'record-info';
    const name = document.createElement('div');
    name.className = 'record-name';
    name.textContent = pr.label;
    const date = document.createElement('div');
    date.className = 'record-date';
    date.textContent = formatDateDisplay(pr.date);
    info.appendChild(name);
    info.appendChild(date);
    row.appendChild(info);

    const value = document.createElement('div');
    value.className = 'record-value';
    value.textContent = `${pr.weight}kg × ${pr.reps}`;
    row.appendChild(value);

    container.appendChild(row);
  });
}
