import { Store, formatDateDisplay, formatWeekdayShort, todayIso, normalizeKey } from './store.js';
import { renderLineChart } from './chart.js';
import { createIcon } from './icons.js';
import { showToast } from './toast.js';

function appendBackupToolbar(container, callbacks) {
  const toolbar = document.createElement('div');
  toolbar.className = 'backup-toolbar';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'secondary-btn';
  exportBtn.textContent = 'Export backup';
  exportBtn.addEventListener('click', () => {
    const json = Store.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `htpa-backup-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported');
  });
  toolbar.appendChild(exportBtn);

  const exportCsvBtn = document.createElement('button');
  exportCsvBtn.className = 'secondary-btn';
  exportCsvBtn.textContent = 'Export CSV';
  exportCsvBtn.addEventListener('click', () => {
    const csv = Store.exportSessionsCsv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `htpa-sessions-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported');
  });
  toolbar.appendChild(exportCsvBtn);

  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json';
  importInput.style.display = 'none';
  importInput.addEventListener('change', () => {
    const file = importInput.files[0];
    importInput.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (!confirm('This replaces ALL current sessions and bodyweight entries with the backup file. Continue?')) return;
      try {
        Store.importData(reader.result);
        renderHistoryView(container, callbacks);
        showToast('Backup imported');
      } catch (e) {
        alert(`Could not import backup: ${e.message}`);
      }
    };
    reader.readAsText(file);
  });
  toolbar.appendChild(importInput);

  const importBtn = document.createElement('button');
  importBtn.className = 'secondary-btn';
  importBtn.textContent = 'Import backup';
  importBtn.addEventListener('click', () => importInput.click());
  toolbar.appendChild(importBtn);

  container.appendChild(toolbar);
}

// Duration/caffeine have no dedicated tab of their own (unlike bodyweight),
// so their trend lives here alongside the data that drives them. Each chart
// only renders once at least one session actually logged that field.
function appendSessionTrends(container) {
  const durationPoints = Store.getDurationPoints().map((p) => ({
    x: p.date.slice(5).replace('-', '.'),
    y: p.value,
    tooltip: `${formatDateDisplay(p.date)} — ${p.value} min`
  }));
  const caffeinePoints = Store.getCaffeinePoints().map((p) => ({
    x: p.date.slice(5).replace('-', '.'),
    y: p.value,
    tooltip: `${formatDateDisplay(p.date)} — ${p.value} mg`
  }));

  if (durationPoints.length === 0 && caffeinePoints.length === 0) return;

  // Collapsed by default behind a toggle — the plain session list is the
  // tab's main job, the trend charts are a secondary, opt-in extra.
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'secondary-btn trends-toggle-btn';
  toggleBtn.textContent = 'Show session trends';
  container.appendChild(toggleBtn);

  const trends = document.createElement('div');
  trends.className = 'session-trends';
  trends.style.display = 'none';

  if (durationPoints.length > 0) {
    const caption = document.createElement('p');
    caption.className = 'chart-caption';
    caption.textContent = 'Session duration over time.';
    trends.appendChild(caption);
    const chartContainer = document.createElement('div');
    chartContainer.className = 'session-trend-chart';
    trends.appendChild(chartContainer);
    renderLineChart(chartContainer, durationPoints, { color: '#4f6df5', unit: 'min' });
  }

  if (caffeinePoints.length > 0) {
    const caption = document.createElement('p');
    caption.className = 'chart-caption';
    caption.textContent = 'Caffeine intake over time.';
    trends.appendChild(caption);
    const chartContainer = document.createElement('div');
    chartContainer.className = 'session-trend-chart';
    trends.appendChild(chartContainer);
    renderLineChart(chartContainer, caffeinePoints, { color: '#2dd4bf', unit: 'mg' });
  }

  container.appendChild(trends);

  toggleBtn.addEventListener('click', () => {
    const show = trends.style.display === 'none';
    trends.style.display = show ? '' : 'none';
    toggleBtn.textContent = show ? 'Hide session trends' : 'Show session trends';
  });
}

export function renderHistoryView(container, callbacks) {
  container.innerHTML = '';
  container.className = 'history-view';

  appendBackupToolbar(container, callbacks);
  appendSessionTrends(container);

  const sessions = [...Store.data.sessions].sort((a, b) => b.date.localeCompare(a.date));

  if (sessions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-hint';
    const icon = createIcon('history');
    if (icon) { icon.classList.add('empty-hint-icon'); empty.appendChild(icon); }
    const text = document.createElement('p');
    text.textContent = 'No sessions logged yet — add one in Log.';
    empty.appendChild(text);
    container.appendChild(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'history-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Date', 'Exercises', 'Sets', 'Duration (min)', 'Caffeine (mg)'].forEach((label, i) => {
    const th = document.createElement('th');
    th.textContent = label;
    if (i > 0) th.className = 'history-num';
    headRow.appendChild(th);
  });
  headRow.appendChild(document.createElement('th')); // chevron column
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Keyed by exercise so each set chip below can check if it IS that
  // exercise's current all-time PR (same date/weight/reps), not just a
  // high-looking number.
  const prByKey = new Map(Store.getAllPRs().map((pr) => [normalizeKey(pr.label), pr]));

  const tbody = document.createElement('tbody');

  sessions.forEach((session) => {
    const totalSets = session.entries.reduce((sum, e) => sum + e.sets.length, 0);

    const row = document.createElement('tr');
    row.className = 'history-row';

    const dateTd = document.createElement('td');
    dateTd.className = 'history-date';
    dateTd.textContent = `${formatWeekdayShort(session.date)}, ${formatDateDisplay(session.date)}`;
    row.appendChild(dateTd);

    [String(session.entries.length), String(totalSets)].forEach((text) => {
      const td = document.createElement('td');
      td.className = 'history-num';
      td.textContent = text;
      row.appendChild(td);
    });

    [session.durationMinutes, session.caffeineMg].forEach((value) => {
      const td = document.createElement('td');
      td.className = value != null ? 'history-num' : 'history-num history-empty-value';
      td.textContent = value != null ? String(value) : '–';
      row.appendChild(td);
    });

    const chevronTd = document.createElement('td');
    chevronTd.className = 'history-chevron-col';
    const chevron = document.createElement('span');
    chevron.className = 'history-chevron';
    chevron.textContent = '▾';
    chevronTd.appendChild(chevron);
    row.appendChild(chevronTd);

    const detailRow = document.createElement('tr');
    detailRow.className = 'history-detail-row';
    detailRow.style.display = 'none';
    const detailCell = document.createElement('td');
    detailCell.setAttribute('colspan', '6');

    session.entries.forEach((entry) => {
      const entryBlock = document.createElement('div');
      entryBlock.className = 'detail-entry';

      const name = document.createElement('div');
      name.className = 'detail-entry-name';
      name.textContent = entry.exercise;
      entryBlock.appendChild(name);

      const setsRow = document.createElement('div');
      setsRow.className = 'detail-sets';
      const pr = prByKey.get(normalizeKey(entry.exercise));
      entry.sets.forEach((s) => {
        const chip = document.createElement('span');
        const isPR = pr && pr.date === session.date && pr.weight === s.weight && pr.reps === s.reps;
        chip.className = isPR ? 'detail-set-chip pr-chip' : 'detail-set-chip';
        if (isPR) {
          const star = document.createElement('span');
          star.className = 'pr-star';
          star.textContent = '★ PR';
          chip.appendChild(star);
        }
        chip.appendChild(document.createTextNode(`${s.weight}kg × ${s.reps}`));
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
    editBtn.className = 'secondary-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => callbacks.onEdit(session));
    detailCell.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      if (!confirm(`Delete the session from ${formatDateDisplay(session.date)}? This cannot be undone.`)) return;
      Store.removeSession(session.id);
      renderHistoryView(container, callbacks);
    });
    detailCell.appendChild(deleteBtn);

    detailRow.appendChild(detailCell);

    row.addEventListener('click', () => {
      const isOpen = detailRow.style.display !== 'none';
      detailRow.style.display = isOpen ? 'none' : 'table-row';
      chevron.classList.toggle('open', !isOpen);
    });

    tbody.appendChild(row);
    tbody.appendChild(detailRow);
  });

  table.appendChild(tbody);
  // The table is wider than a phone screen (6 columns, several nowrap) — scope
  // the horizontal scroll to this wrapper so it doesn't drag the whole page
  // (tab nav included) sideways with it.
  const tableWrap = document.createElement('div');
  tableWrap.className = 'history-table-wrap';
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);
}
