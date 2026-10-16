import { Store, todayIso } from './store.js';

export function renderLogView(container, existingSession, onDone, onDirtyChange = () => {}) {
  container.innerHTML = '';
  container.className = 'log-view';

  // Every (re)render starts clean — resets any stale dirty flag left over
  // from a previous time this view was open.
  onDirtyChange(false);
  let dirty = false;
  function markDirty() {
    if (!dirty) {
      dirty = true;
      onDirtyChange(true);
    }
  }

  const title = document.createElement('h2');
  title.textContent = existingSession ? 'Edit Session' : 'Log Session';
  container.appendChild(title);

  const repeatBtn = document.createElement('button');
  repeatBtn.type = 'button';
  repeatBtn.className = 'repeat-btn';
  repeatBtn.textContent = '↻ Repeat last session';

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = existingSession ? existingSession.date : todayIso();
  container.appendChild(dateInput);

  const meta = document.createElement('div');
  meta.className = 'session-meta';

  function metaField(labelText, input) {
    const wrap = document.createElement('div');
    wrap.className = 'meta-field';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(input);
    return wrap;
  }

  const durationInput = document.createElement('input');
  durationInput.type = 'number';
  durationInput.min = '0';
  durationInput.value = existingSession && existingSession.durationMinutes != null ? existingSession.durationMinutes : '';
  meta.appendChild(metaField('Duration (min)', durationInput));

  const caffeineInput = document.createElement('input');
  caffeineInput.type = 'number';
  caffeineInput.min = '0';
  caffeineInput.value = existingSession && existingSession.caffeineMg != null ? existingSession.caffeineMg : '';
  meta.appendChild(metaField('Caffeine (mg)', caffeineInput));

  container.appendChild(meta);

  const datalist = document.createElement('datalist');
  datalist.id = 'exercise-names';
  Store.distinctExercises().forEach((ex) => {
    const opt = document.createElement('option');
    opt.value = ex.label;
    datalist.appendChild(opt);
  });
  container.appendChild(datalist);

  const exerciseList = document.createElement('div');
  exerciseList.className = 'exercise-list';
  container.appendChild(exerciseList);

  function addSetRow(setsContainer, set) {
    const row = document.createElement('div');
    row.className = 'set-row';

    const weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.step = '0.5';
    weightInput.min = '0';
    weightInput.placeholder = 'kg';
    weightInput.value = set ? set.weight : '';

    const repsInput = document.createElement('input');
    repsInput.type = 'number';
    repsInput.min = '1';
    repsInput.placeholder = 'reps';
    repsInput.value = set ? set.reps : '';

    const rpeInput = document.createElement('input');
    rpeInput.type = 'number';
    rpeInput.step = '0.5';
    rpeInput.min = '0';
    rpeInput.max = '10';
    rpeInput.placeholder = 'RPE (optional)';
    rpeInput.value = set && set.rpe != null ? set.rpe : '';

    const rpeWrap = document.createElement('div');
    rpeWrap.className = 'rpe-wrap';
    rpeWrap.appendChild(rpeInput);

    // A tiny, self-dismissing explainer instead of a native alert/confirm —
    // those are modal and block the page, far too heavy for "what does this
    // abbreviation mean".
    const rpeHelp = document.createElement('button');
    rpeHelp.type = 'button';
    rpeHelp.className = 'rpe-help';
    rpeHelp.textContent = '?';
    rpeHelp.setAttribute('aria-label', 'What is RPE?');
    rpeHelp.tabIndex = -1; // tap-only affordance, stays out of the Tab/Enter flow below
    let activeTooltip = null;
    rpeHelp.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
        return;
      }
      const tip = document.createElement('div');
      tip.className = 'help-tooltip';
      const line1 = document.createElement('div');
      line1.textContent = 'RPE = Rate of Perceived Exertion';
      const line2 = document.createElement('div');
      line2.textContent = '1-10 wie schwers sich anfühlte';
      tip.appendChild(line1);
      tip.appendChild(line2);
      rpeWrap.appendChild(tip);
      activeTooltip = tip;
      setTimeout(() => {
        tip.remove();
        if (activeTooltip === tip) activeTooltip = null;
      }, 3000);
    });
    rpeWrap.appendChild(rpeHelp);

    row.appendChild(weightInput);
    row.appendChild(repsInput);
    row.appendChild(rpeWrap);
    setsContainer.appendChild(row);
  }

  function addExerciseBlock(prefill) {
    const block = document.createElement('div');
    block.className = 'exercise-block';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.setAttribute('list', 'exercise-names');
    nameInput.placeholder = 'Exercise name';
    nameInput.value = prefill ? prefill.exercise : '';
    // Prefill still-empty set rows with the last-used weight/reps for this
    // exercise, so repeating a lift doesn't start from a blank set every time.
    // Only touches rows the user hasn't typed into yet, and never RPE (that's
    // subjective to today's session, not something to carry over).
    nameInput.addEventListener('input', () => {
      const last = Store.getLastSetForExercise(nameInput.value);
      if (!last) return;
      setsContainer.querySelectorAll('.set-row').forEach((row) => {
        const [weightInput, repsInput] = row.querySelectorAll('input');
        if (!weightInput.value && !repsInput.value) {
          weightInput.value = last.weight;
          repsInput.value = last.reps;
        }
      });
    });
    block.appendChild(nameInput);

    const setsContainer = document.createElement('div');
    setsContainer.className = 'sets-container';
    block.appendChild(setsContainer);

    if (prefill && prefill.sets.length > 0) {
      prefill.sets.forEach((s) => addSetRow(setsContainer, s));
    } else {
      addSetRow(setsContainer, null);
    }

    const addSetBtn = document.createElement('button');
    addSetBtn.type = 'button';
    addSetBtn.className = 'secondary-btn';
    addSetBtn.textContent = '+ Add set';
    addSetBtn.addEventListener('click', () => {
      addSetRow(setsContainer, null);
      markDirty();
    });
    block.appendChild(addSetBtn);

    exerciseList.appendChild(block);
  }

  if (existingSession) {
    existingSession.entries.forEach((entry) => addExerciseBlock(entry));
  } else {
    addExerciseBlock(null);
  }

  if (!existingSession && Store.getMostRecentSession()) {
    repeatBtn.addEventListener('click', () => {
      if (dirty && !confirm('Replace your current entries with last session\'s exercises?')) return;
      const lastSession = Store.getMostRecentSession();
      exerciseList.innerHTML = '';
      lastSession.entries.forEach((entry) => {
        const last = Store.getLastSetForExercise(entry.exercise);
        addExerciseBlock({
          exercise: entry.exercise,
          sets: last ? [{ weight: last.weight, reps: last.reps, rpe: null }] : []
        });
      });
      markDirty();
    });
    container.insertBefore(repeatBtn, dateInput);
  }

  const addExerciseBtn = document.createElement('button');
  addExerciseBtn.type = 'button';
  addExerciseBtn.className = 'secondary-btn';
  addExerciseBtn.textContent = '+ Add exercise';
  addExerciseBtn.addEventListener('click', () => {
    addExerciseBlock(null);
    markDirty();
  });
  container.appendChild(addExerciseBtn);

  // Delegated listener catches edits to any input added above (date, duration,
  // caffeine, exercise name, weight/reps/RPE) without wiring each one individually.
  container.addEventListener('input', markDirty);

  // Enter jumps to the next input/button in reading order instead of doing
  // nothing — on a phone's on-screen keyboard this lets a whole session be
  // logged without reaching for the Save button until the very end.
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    const focusables = [...container.querySelectorAll('input, button')].filter((el) => el.tabIndex !== -1);
    const idx = focusables.indexOf(e.target);
    if (idx >= 0 && idx < focusables.length - 1) focusables[idx + 1].focus();
  });

  const errorMsg = document.createElement('p');
  errorMsg.className = 'log-error';
  errorMsg.textContent = 'Add at least one exercise with a complete set (name, weight, and reps) before saving.';
  errorMsg.style.display = 'none';
  container.appendChild(errorMsg);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const { entries, droppedBlocks, droppedSets } = collectEntries(exerciseList);
    if (entries.length === 0) {
      errorMsg.style.display = 'block';
      return;
    }
    if ((droppedBlocks > 0 || droppedSets > 0) &&
        !confirm(`Saving will skip ${droppedBlocks} incomplete exercise(s) and ${droppedSets} incomplete set(s). Continue?`)) {
      return;
    }
    errorMsg.style.display = 'none';
    const durationMinutes = durationInput.value && Number(durationInput.value) >= 0 ? Number(durationInput.value) : null;
    const caffeineMg = caffeineInput.value && Number(caffeineInput.value) >= 0 ? Number(caffeineInput.value) : null;
    if (existingSession) {
      Store.updateSession(existingSession.id, dateInput.value, entries, durationMinutes, caffeineMg);
    } else {
      Store.addSession(dateInput.value, entries, durationMinutes, caffeineMg);
    }
    dirty = false;
    onDirtyChange(false);
    onDone();
  });
  container.appendChild(saveBtn);
}

function collectEntries(exerciseList) {
  const entries = [];
  let droppedBlocks = 0;
  let droppedSets = 0;
  exerciseList.querySelectorAll('.exercise-block').forEach((block) => {
    const name = block.querySelector('input[type="text"]').value.trim();
    if (!name) { droppedBlocks++; return; }
    const sets = [];
    block.querySelectorAll('.set-row').forEach((row) => {
      const [weightInput, repsInput, rpeInput] = row.querySelectorAll('input');
      const weight = Number(weightInput.value);
      const reps = Number(repsInput.value);
      if (!weightInput.value || !repsInput.value || weight < 0 || reps < 1) { droppedSets++; return; }
      const rpe = rpeInput.value ? Number(rpeInput.value) : null;
      sets.push({
        weight,
        reps,
        rpe: rpe != null && rpe >= 0 && rpe <= 10 ? rpe : null
      });
    });
    if (sets.length > 0) entries.push({ exercise: name, sets });
    else droppedBlocks++;
  });
  return { entries, droppedBlocks, droppedSets };
}
