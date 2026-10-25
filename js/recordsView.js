import { Store, formatDateDisplay, daysBetweenIso, todayIso } from './store.js';
import { createIcon } from './icons.js';

// A PR this old hasn't been chased in a while — dim it instead of letting it
// sit under the same gold "fresh achievement" accent as a PR from yesterday.
const STALE_PR_DAYS = 60;

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

  const SORTS = {
    alpha: { label: 'A–Z', apply: (list) => [...list].sort((a, b) => a.label.localeCompare(b.label)) },
    recent: { label: 'Recently improved', apply: (list) => [...list].sort((a, b) => b.date.localeCompare(a.date)) }
  };
  let sortMode = 'alpha';

  // Collapsed by default, same pattern as History's session-trends toggle —
  // the record list itself is the tab's main job, sorting is a secondary,
  // opt-in extra most visits don't need.
  const filterBtn = document.createElement('button');
  filterBtn.type = 'button';
  filterBtn.className = 'secondary-btn trends-toggle-btn';
  filterBtn.textContent = 'Filter';
  container.appendChild(filterBtn);

  const sortPanel = document.createElement('div');
  sortPanel.className = 'toggle-group';
  sortPanel.style.display = 'none';
  const sortButtons = {};
  Object.entries(SORTS).forEach(([key, def]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = key === sortMode ? 'secondary-btn active' : 'secondary-btn';
    btn.textContent = def.label;
    btn.addEventListener('click', () => {
      if (sortMode === key) return;
      sortMode = key;
      Object.entries(sortButtons).forEach(([k, b]) => b.classList.toggle('active', k === sortMode));
      renderList();
    });
    sortButtons[key] = btn;
    sortPanel.appendChild(btn);
  });
  container.appendChild(sortPanel);

  filterBtn.addEventListener('click', () => {
    const show = sortPanel.style.display === 'none';
    sortPanel.style.display = show ? '' : 'none';
    filterBtn.textContent = show ? 'Hide filter' : 'Filter';
  });

  const list = document.createElement('div');
  container.appendChild(list);

  function renderList() {
    list.innerHTML = '';
    SORTS[sortMode].apply(prs).forEach((pr) => {
      const daysSince = daysBetweenIso(pr.date, todayIso());
      const stale = daysSince >= STALE_PR_DAYS;

      const row = document.createElement('div');
      row.className = stale ? 'record-row record-row-stale' : 'record-row';

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
      if (stale) {
        const staleNote = document.createElement('div');
        staleNote.className = 'record-stale-note';
        staleNote.textContent = `${STALE_PR_DAYS}+ days stale`;
        info.appendChild(staleNote);
      }
      row.appendChild(info);

      const value = document.createElement('div');
      value.className = 'record-value';
      value.textContent = `${pr.weight}kg × ${pr.reps}`;
      row.appendChild(value);

      list.appendChild(row);
    });
  }
  renderList();
}
