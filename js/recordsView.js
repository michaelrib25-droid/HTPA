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
