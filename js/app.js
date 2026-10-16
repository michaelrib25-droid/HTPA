import { renderLogView } from './logView.js';
import { renderHistoryView } from './historyView.js';
import { renderProgressView } from './progressView.js';
import { renderRecordsView } from './recordsView.js';
import { renderBodyweightView } from './bodyweightView.js';
import { createIcon } from './icons.js';
import { showToast } from './toast.js';

const appRoot = document.getElementById('app');

const TABS = [
  { id: 'log', label: 'Log', icon: 'log' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'records', label: 'Records', icon: 'records' },
  { id: 'bodyweight', label: 'Bodyweight', icon: 'bodyweight' }
];

let activeTab = 'log';
let editingSession = null;
let logDirty = false;

function render() {
  appRoot.innerHTML = '';

  const nav = document.createElement('nav');
  nav.className = 'tab-nav';
  TABS.forEach((tab) => {
    const btn = document.createElement('button');
    btn.className = tab.id === activeTab ? 'active' : '';
    const icon = createIcon(tab.icon);
    if (icon) btn.appendChild(icon);
    const label = document.createElement('span');
    label.textContent = tab.label;
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      if (activeTab === 'log' && logDirty &&
          !confirm('You have unsaved changes in the Log form. Switch tabs and discard them?')) {
        return;
      }
      editingSession = null;
      activeTab = tab.id;
      render();
    });
    nav.appendChild(btn);
  });
  appRoot.appendChild(nav);

  const viewContainer = document.createElement('div');
  viewContainer.className = 'view-container';
  appRoot.appendChild(viewContainer);

  if (activeTab === 'log') {
    const wasEditing = !!editingSession;
    renderLogView(viewContainer, editingSession, () => {
      editingSession = null;
      activeTab = 'history';
      render();
      showToast(wasEditing ? 'Session updated' : 'Session saved');
    }, (isDirty) => { logDirty = isDirty; });
  } else if (activeTab === 'history') {
    renderHistoryView(viewContainer, {
      onEdit: (session) => {
        editingSession = session;
        activeTab = 'log';
        render();
      }
    });
  } else if (activeTab === 'progress') {
    renderProgressView(viewContainer);
  } else if (activeTab === 'records') {
    renderRecordsView(viewContainer);
  } else if (activeTab === 'bodyweight') {
    renderBodyweightView(viewContainer);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}

render();
