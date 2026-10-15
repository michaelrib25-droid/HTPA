import { Store, formatDateDisplay } from './store.js';

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

  const table = document.createElement('table');
  table.className = 'history-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Date', 'Exercises', 'Sets', 'Duration (min)', 'Caffeine (mg)'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  sessions.forEach((session) => {
    const totalSets = session.entries.reduce((sum, e) => sum + e.sets.length, 0);

    const row = document.createElement('tr');
    row.className = 'history-row';

    [formatDateDisplay(session.date), String(session.entries.length), String(totalSets)].forEach((text) => {
      const td = document.createElement('td');
      td.textContent = text;
      row.appendChild(td);
    });

    [session.durationMinutes, session.caffeineMg].forEach((value) => {
      const td = document.createElement('td');
      if (value != null) {
        const badge = document.createElement('span');
        badge.className = 'meta-badge';
        badge.textContent = String(value);
        td.appendChild(badge);
      } else {
        td.textContent = '–';
      }
      row.appendChild(td);
    });

    const detailRow = document.createElement('tr');
    detailRow.className = 'history-detail-row';
    detailRow.style.display = 'none';
    const detailCell = document.createElement('td');
    detailCell.setAttribute('colspan', '5');

    session.entries.forEach((entry) => {
      const entryBlock = document.createElement('div');
      entryBlock.className = 'detail-entry';

      const name = document.createElement('div');
      name.className = 'detail-entry-name';
      name.textContent = entry.exercise;
      entryBlock.appendChild(name);

      const setsRow = document.createElement('div');
      setsRow.className = 'detail-sets';
      entry.sets.forEach((s) => {
        const chip = document.createElement('span');
        chip.className = 'detail-set-chip';
        chip.textContent = `${s.weight}kg × ${s.reps}`;
        if (s.rpe != null) {
          const rpe = document.createElement('span');
          rpe.className = 'detail-set-rpe';
          rpe.textContent = `RPE ${s.rpe}`;
          chip.appendChild(rpe);
        }
        setsRow.appendChild(chip);
      });
      entryBlock.appendChild(setsRow);

      detailCell.appendChild(entryBlock);
    });

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => callbacks.onEdit(session));
    detailCell.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      if (!confirm(`Delete the session from ${formatDateDisplay(session.date)}? This cannot be undone.`)) return;
      Store.removeSession(session.id);
      renderHistoryView(container, callbacks);
    });
    detailCell.appendChild(deleteBtn);

    detailRow.appendChild(detailCell);

    row.addEventListener('click', () => {
      detailRow.style.display = detailRow.style.display === 'none' ? 'table-row' : 'none';
    });

    tbody.appendChild(row);
    tbody.appendChild(detailRow);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}
