const STORAGE_KEY = 'timebox-app';

const DEFAULT_STATE = {
  timeboxes: [],
  autoAdvance: true,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function secondsToMMSS(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function mmssToSeconds(str) {
  const parts = str.split(':');
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(s) || s >= 60) return null;
  return m * 60 + s;
}

let state = loadState();
let sessionState = null;

function render() {
  const app = document.getElementById('app');
  if (sessionState) {
    app.innerHTML = renderRunView();
  } else {
    app.innerHTML = renderEditView();
  }
  attachListeners();
}

function renderEditView() {
  const hasValid = state.timeboxes.some(t => t.duration > 0);
  return `
    <div class="view edit-view">
      <h1>Timebox</h1>
      <ul class="timebox-list" id="timebox-list">
        ${state.timeboxes.length === 0
          ? '<li class="empty-hint">No timeboxes yet. Add one below.</li>'
          : state.timeboxes.map((tb, i) => renderTimeboxRow(tb, i)).join('')}
      </ul>
      <button class="btn btn-secondary" id="add-btn">+ Add timebox</button>
      <button class="btn btn-primary" id="start-btn" ${(state.timeboxes.length === 0 || !hasValid) ? 'disabled' : ''}>
        Start Session
      </button>
    </div>
  `;
}

function renderTimeboxRow(tb, index) {
  return `
    <li class="timebox-row" data-id="${tb.id}">
      <input class="tb-name" type="text" value="${escapeHtml(tb.name)}" placeholder="Task name" data-id="${tb.id}" />
      <input class="tb-duration" type="text" value="${secondsToMMSS(tb.duration)}" placeholder="MM:SS" data-id="${tb.id}" />
      <button class="btn-icon" data-action="up" data-index="${index}">↑</button>
      <button class="btn-icon" data-action="down" data-index="${index}">↓</button>
      <button class="btn-icon btn-danger" data-action="delete" data-id="${tb.id}">✕</button>
    </li>
  `;
}

function renderRunView() {
  return `<div class="view run-view"><p>Run view placeholder</p></div>`;
}

function attachListeners() {
  // filled in Task 4
}

render();
