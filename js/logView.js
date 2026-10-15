import { Store } from './store.js';

export function renderLogView(container, existingSession, onDone) {
  container.innerHTML = '';
  container.className = 'log-view';

  const title = document.createElement('h2');
  title.textContent = existingSession ? 'Edit Session' : 'Log Session';
  container.appendChild(title);

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = existingSession ? existingSession.date : todayIso();
  container.appendChild(dateInput);

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
    weightInput.placeholder = 'kg';
    weightInput.value = set ? set.weight : '';

    const repsInput = document.createElement('input');
    repsInput.type = 'number';
    repsInput.placeholder = 'reps';
    repsInput.value = set ? set.reps : '';

    const rpeInput = document.createElement('input');
    rpeInput.type = 'number';
    rpeInput.step = '0.5';
    rpeInput.placeholder = 'RPE (optional)';
    rpeInput.value = set && set.rpe != null ? set.rpe : '';

    row.appendChild(weightInput);
    row.appendChild(repsInput);
    row.appendChild(rpeInput);
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
    addSetBtn.textContent = '+ Add set';
    addSetBtn.addEventListener('click', () => addSetRow(setsContainer, null));
    block.appendChild(addSetBtn);

    exerciseList.appendChild(block);
  }

  if (existingSession) {
    existingSession.entries.forEach((entry) => addExerciseBlock(entry));
  } else {
    addExerciseBlock(null);
  }

  const addExerciseBtn = document.createElement('button');
  addExerciseBtn.type = 'button';
  addExerciseBtn.textContent = '+ Add exercise';
  addExerciseBtn.addEventListener('click', () => addExerciseBlock(null));
  container.appendChild(addExerciseBtn);

  const errorMsg = document.createElement('p');
  errorMsg.className = 'log-error';
  errorMsg.textContent = 'Add at least one exercise with a complete set (name, weight, and reps) before saving.';
  errorMsg.style.display = 'none';
  container.appendChild(errorMsg);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const entries = collectEntries(exerciseList);
    if (entries.length === 0) {
      errorMsg.style.display = 'block';
      return;
    }
    if (existingSession) {
      Store.updateSession(existingSession.id, dateInput.value, entries);
    } else {
      Store.addSession(dateInput.value, entries);
    }
    onDone();
  });
  container.appendChild(saveBtn);
}

function collectEntries(exerciseList) {
  const entries = [];
  exerciseList.querySelectorAll('.exercise-block').forEach((block) => {
    const name = block.querySelector('input[type="text"]').value.trim();
    if (!name) return;
    const sets = [];
    block.querySelectorAll('.set-row').forEach((row) => {
      const [weightInput, repsInput, rpeInput] = row.querySelectorAll('input');
      if (!weightInput.value || !repsInput.value) return;
      sets.push({
        weight: Number(weightInput.value),
        reps: Number(repsInput.value),
        rpe: rpeInput.value ? Number(rpeInput.value) : null
      });
    });
    if (sets.length > 0) entries.push({ exercise: name, sets });
  });
  return entries;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
