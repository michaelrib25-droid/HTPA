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
    const text = document.createElement('span');
    text.textContent = `${pr.label}: ${pr.weight}kg × ${pr.reps} (${formatDateDisplay(pr.date)})`;
    row.appendChild(text);
    container.appendChild(row);
  });
}
