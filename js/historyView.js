import { Store } from './store.js';

export function renderHistoryView(container, callbacks) {
  container.innerHTML = '';
  container.className = 'history-view';

  const sessions = [...Store.data.sessions].sort((a, b) => b.date.localeCompare(a.date));

  if (sessions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-hint';
    empty.textContent = 'No sessions logged yet — add one in Log.';
    container.appendChild(empty);
    return;
  }

  sessions.forEach((session) => {
    const totalSets = session.entries.reduce((sum, e) => sum + e.sets.length, 0);

    const row = document.createElement('div');
    row.className = 'history-row';

    const summary = document.createElement('button');
    summary.className = 'history-summary';
    summary.textContent = `${session.date} — ${session.entries.length} exercise(s), ${totalSets} set(s)`;
    row.appendChild(summary);

    const detail = document.createElement('div');
    detail.className = 'history-detail';
    detail.style.display = 'none';

    session.entries.forEach((entry) => {
      const line = document.createElement('p');
      const setsText = entry.sets
        .map((s) => `${s.weight}kg × ${s.reps}${s.rpe != null ? ` @RPE ${s.rpe}` : ''}`)
        .join(', ');
      line.textContent = `${entry.exercise}: ${setsText}`;
      detail.appendChild(line);
    });

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => callbacks.onEdit(session));
    detail.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      Store.removeSession(session.id);
      renderHistoryView(container, callbacks);
    });
    detail.appendChild(deleteBtn);

    summary.addEventListener('click', () => {
      detail.style.display = detail.style.display === 'none' ? 'block' : 'none';
    });

    row.appendChild(detail);
    container.appendChild(row);
  });
}
