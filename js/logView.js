import { Store, todayIso } from './store.js';

// Days-since-last-session commentary, one line per day so the tone can drift
// from neutral to gently guilt-tripping without a formula trying to fake
// personality. Index 0 = trained today. Capped at a single catch-all past 19
// days — past that point the exact day count stops mattering next to the bit.
const STREAK_MESSAGES = [
  'Heute schon trainiert. Nicht schlecht.',
  'Gestern warst du noch da. Passt.',
  '2 Tage Pause. Alles im grünen Bereich.',
  '3 Tage. Kurz nachgedacht, ob ich mir Sorgen machen soll. Noch nicht.',
  '4 Tage. Die Hantelbank hat angefangen zu fragen.',
  '5 Tage. Ich tu noch so, als wäre nichts.',
  '6 Tage. Fast eine Woche. Fast.',
  '7 Tage. Eine ganze Woche. Ich zähl jetzt offiziell mit.',
  '8 Tage. Ich hab aufgehört, überrascht zu sein.',
  '9 Tage. Die Matte sammelt Staub.',
  '10 Tage. Zweistellig. Ein neues Kapitel.',
  '11 Tage. Ich frag mich, ob du mich vergessen hast.',
  '12 Tage. Ich hab nicht vergessen. Ich wünschte, ich hätte.',
  '13 Tage. Unglückszahl. Passt gerade ganz gut.',
  '14 Tage. Zwei Wochen. Ich sag nichts mehr dazu.',
  '15 Tage. Ich bin nicht enttäuscht. Nur... still.',
  '16 Tage. Ich hab aufgehört zu fragen, wann du wiederkommst.',
  '17 Tage. Die Hantelbank hat einen Decknamen für dich: "der Mythos".',
  '18 Tage. Ich erinnere mich noch schwach an dich.',
  '19 Tage. Fast drei Wochen. Ich zähl trotzdem noch.'
];

function streakMessage(daysSinceLastSession) {
  if (daysSinceLastSession == null) return 'Noch kein Training geloggt. Fang einfach an.';
  if (daysSinceLastSession < STREAK_MESSAGES.length) return STREAK_MESSAGES[daysSinceLastSession];
  return `${daysSinceLastSession} Tage. Ich hab eine Kerze für dich angezündet — neben deinem Trainingsplan, im Regal für Vermisste.`;
}

// Colors each exercise block from the app's accent-2 (teal/green, "just
// started") toward its error red ("deep into the session"), scaled against
// a typical ~8-exercise session, so a glance at the block's left border
// gives a sense of how far into the session you already are while logging.
const PROGRESS_EARLY = [0x2d, 0xd4, 0xbf];
const PROGRESS_LATE = [0xff, 0x6b, 0x6b];
const TYPICAL_SESSION_LENGTH = 8;
function sessionProgressColor(index) {
  const t = Math.min(1, index / (TYPICAL_SESSION_LENGTH - 1));
  const [r, g, b] = PROGRESS_EARLY.map((c, i) => Math.round(c + (PROGRESS_LATE[i] - c) * t));
  return `rgb(${r}, ${g}, ${b})`;
}

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

  // Only shown while logging a new session, not while editing a past one —
  // "days since last training" refers to today's state, not the session
  // being edited.
  if (!existingSession) {
    const streak = document.createElement('p');
    streak.className = 'streak-line';
    streak.textContent = streakMessage(Store.daysSinceLastSession());
    container.appendChild(streak);
  }

  const repeatBtn = document.createElement('button');
  repeatBtn.type = 'button';
  repeatBtn.className = 'secondary-btn repeat-btn';
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

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'set-remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Remove set');
    removeBtn.addEventListener('click', () => {
      row.remove();
      markDirty();
    });

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
    rpeInput.placeholder = 'RPE';
    rpeInput.value = set && set.rpe != null ? set.rpe : '';
    // min/max alone never trigger browser validation here (these inputs
    // aren't inside a <form>, so there's no submit event to check them) —
    // without this, an out-of-range RPE was silently cleared on save with
    // no indication why. Validate on every change instead.
    function validateRpe() {
      const v = rpeInput.value;
      const invalid = v !== '' && (Number(v) < 0 || Number(v) > 10);
      rpeInput.classList.toggle('input-error', invalid);
    }
    rpeInput.addEventListener('input', validateRpe);
    validateRpe();

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
    row.appendChild(removeBtn);
    setsContainer.appendChild(row);
  }

  function addExerciseBlock(prefill) {
    const block = document.createElement('div');
    block.className = 'exercise-block';
    block.style.borderLeftColor = sessionProgressColor(exerciseList.children.length);

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
    const header = document.createElement('div');
    header.className = 'exercise-header';
    header.appendChild(nameInput);

    const removeBlockBtn = document.createElement('button');
    removeBlockBtn.type = 'button';
    removeBlockBtn.className = 'exercise-remove-btn';
    removeBlockBtn.textContent = '✕';
    removeBlockBtn.setAttribute('aria-label', 'Remove exercise');
    removeBlockBtn.addEventListener('click', () => {
      block.remove();
      markDirty();
    });
    header.appendChild(removeBlockBtn);
    block.appendChild(header);

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
    addSetBtn.className = 'secondary-btn add-set-btn';
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
      if (dirty && !confirm('Replace your current entries with last session\'s exercises, duration, and caffeine?')) return;
      const lastSession = Store.getMostRecentSession();
      exerciseList.innerHTML = '';
      lastSession.entries.forEach((entry) => {
        const last = Store.getLastSetForExercise(entry.exercise);
        addExerciseBlock({
          exercise: entry.exercise,
          sets: last ? [{ weight: last.weight, reps: last.reps, rpe: null }] : []
        });
      });
      // Duration/caffeine carry over too, unlike weight/reps which only
      // prefill — this button means "repeat the whole session", and unlike
      // RPE (always subjective to today) these are plausible starting
      // points the user explicitly asked to reuse by clicking here.
      durationInput.value = lastSession.durationMinutes != null ? lastSession.durationMinutes : '';
      caffeineInput.value = lastSession.caffeineMg != null ? lastSession.caffeineMg : '';
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
  errorMsg.className = 'form-error';
  errorMsg.textContent = 'Add at least one exercise with a complete set (name, weight, and reps) before saving.';
  errorMsg.style.display = 'none';
  container.appendChild(errorMsg);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const { entries, droppedBlocks, droppedSets, invalidRpe } = collectEntries(exerciseList);
    if (invalidRpe > 0) {
      errorMsg.textContent = `Fix ${invalidRpe} RPE value(s) outside the 0–10 range before saving.`;
      errorMsg.style.display = 'block';
      return;
    }
    if (entries.length === 0) {
      errorMsg.textContent = 'Add at least one exercise with a complete set (name, weight, and reps) before saving.';
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
  let invalidRpe = 0;
  exerciseList.querySelectorAll('.exercise-block').forEach((block) => {
    const name = block.querySelector('input[type="text"]').value.trim();
    if (!name) { droppedBlocks++; return; }
    const sets = [];
    block.querySelectorAll('.set-row').forEach((row) => {
      const [weightInput, repsInput, rpeInput] = row.querySelectorAll('input');
      const weight = Number(weightInput.value);
      const reps = Number(repsInput.value);
      if (!weightInput.value || !repsInput.value || weight < 0 || reps < 1) { droppedSets++; return; }
      let rpe = null;
      if (rpeInput.value) {
        const rawRpe = Number(rpeInput.value);
        if (rawRpe >= 0 && rawRpe <= 10) rpe = rawRpe;
        else invalidRpe++;
      }
      sets.push({ weight, reps, rpe });
    });
    if (sets.length > 0) entries.push({ exercise: name, sets });
    else droppedBlocks++;
  });
  return { entries, droppedBlocks, droppedSets, invalidRpe };
}
