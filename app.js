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

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // audio not available — silent fail
  }
}

let timerInterval = null;

function clearTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function startTimer() {
  clearTimer();
  timerInterval = setInterval(() => {
    if (sessionState.secondsRemaining <= 0) {
      clearTimer();
      onTimeboxEnd();
      return;
    }
    sessionState.secondsRemaining--;
    const el = document.querySelector('.countdown');
    if (el) el.textContent = secondsToMMSS(sessionState.secondsRemaining);
  }, 1000);
  sessionState.isRunning = true;
}

function pauseTimer() {
  clearTimer();
  sessionState.isRunning = false;
  const pp = document.getElementById('playpause-btn');
  if (pp) pp.textContent = 'Play';
}

function onTimeboxEnd() {
  playBeep();
  const next = sessionState.currentIndex + 1;
  if (next >= state.timeboxes.length) {
    sessionState.complete = true;
    sessionState.isRunning = false;
    render();
    return;
  }
  if (state.autoAdvance) {
    sessionState.isRunning = false;
    setTimeout(() => {
      advanceTo(next);
    }, 1000);
  } else {
    sessionState.currentIndex = next;
    sessionState.secondsRemaining = state.timeboxes[next].duration;
    sessionState.isRunning = false;
    render();
  }
}

function advanceTo(index) {
  sessionState.currentIndex = index;
  sessionState.secondsRemaining = state.timeboxes[index].duration;
  sessionState.isRunning = false;
  render();
  startTimer();
}

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
    <li class="timebox-row" data-id="${escapeHtml(tb.id)}">
      <input class="tb-name" type="text" value="${escapeHtml(tb.name)}" placeholder="Task name" data-id="${escapeHtml(tb.id)}" />
      <input class="tb-duration" type="text" value="${secondsToMMSS(tb.duration)}" placeholder="MM:SS" data-id="${escapeHtml(tb.id)}" />
      <button class="btn-icon" data-action="up" data-index="${index}">↑</button>
      <button class="btn-icon" data-action="down" data-index="${index}">↓</button>
      <button class="btn-icon btn-danger" data-action="delete" data-id="${escapeHtml(tb.id)}">✕</button>
    </li>
  `;
}

function renderRunView() {
  const tb = state.timeboxes[sessionState.currentIndex] || { name: '', duration: 0 };
  const isComplete = sessionState.complete;
  return `
    <div class="view run-view">
      <button class="btn-link" id="edit-btn">← Edit</button>
      ${isComplete ? `
        <div class="complete-state">
          <p class="complete-label">Session complete!</p>
          <button class="btn btn-primary" id="reset-btn">Reset</button>
        </div>
      ` : `
        <p class="tb-label">${escapeHtml(tb.name || 'Untitled')}</p>
        <div class="countdown">${secondsToMMSS(sessionState.secondsRemaining)}</div>
        <p class="progress">${sessionState.currentIndex + 1} / ${state.timeboxes.length}</p>
        <div class="run-controls">
          <button class="btn btn-primary" id="playpause-btn">
            ${sessionState.isRunning ? 'Pause' : 'Play'}
          </button>
          <button class="btn btn-secondary" id="skip-btn">Skip →</button>
          <button class="btn btn-secondary" id="reset-btn">Reset</button>
        </div>
        <label class="auto-advance-toggle">
          <input type="checkbox" id="auto-advance" ${state.autoAdvance ? 'checked' : ''} />
          Auto-advance
        </label>
      `}
    </div>
  `;
}

function attachListeners() {
  if (!sessionState) {
    attachEditListeners();
  } else {
    attachRunListeners();
  }
}

function attachEditListeners() {
  document.getElementById('add-btn')?.addEventListener('click', () => {
    state.timeboxes.push({ id: generateId(), name: '', duration: 1500 });
    saveState(state);
    render();
    const inputs = document.querySelectorAll('.tb-name');
    inputs[inputs.length - 1]?.focus();
  });

  document.getElementById('start-btn')?.addEventListener('click', () => {
    if (state.timeboxes.length === 0) return;
    sessionState = { currentIndex: 0, secondsRemaining: state.timeboxes[0].duration, isRunning: false };
    render();
  });

  document.querySelectorAll('.tb-name').forEach(input => {
    input.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const tb = state.timeboxes.find(t => t.id === id);
      if (tb) { tb.name = e.target.value; saveState(state); }
      const hasValid = state.timeboxes.some(t => t.duration > 0);
      const startBtn = document.getElementById('start-btn');
      if (startBtn) startBtn.disabled = state.timeboxes.length === 0 || !hasValid;
    });
  });

  document.querySelectorAll('.tb-duration').forEach(input => {
    input.addEventListener('change', e => {
      const id = e.target.dataset.id;
      const tb = state.timeboxes.find(t => t.id === id);
      if (!tb) return;
      const secs = mmssToSeconds(e.target.value);
      if (secs !== null && secs > 0) {
        tb.duration = secs;
        saveState(state);
        e.target.value = secondsToMMSS(secs);
      } else {
        e.target.value = secondsToMMSS(tb.duration);
      }
    });
  });

  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', e => {
      const id = e.target.dataset.id;
      state.timeboxes = state.timeboxes.filter(t => t.id !== id);
      saveState(state);
      render();
    });
  });

  document.querySelectorAll('[data-action="up"]').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = parseInt(e.target.dataset.index, 10);
      if (i === 0) return;
      [state.timeboxes[i - 1], state.timeboxes[i]] = [state.timeboxes[i], state.timeboxes[i - 1]];
      saveState(state);
      render();
    });
  });

  document.querySelectorAll('[data-action="down"]').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = parseInt(e.target.dataset.index, 10);
      if (i === state.timeboxes.length - 1) return;
      [state.timeboxes[i], state.timeboxes[i + 1]] = [state.timeboxes[i + 1], state.timeboxes[i]];
      saveState(state);
      render();
    });
  });
}

function attachRunListeners() {
  document.getElementById('edit-btn')?.addEventListener('click', () => {
    clearTimer();
    sessionState = null;
    render();
  });

  document.getElementById('playpause-btn')?.addEventListener('click', () => {
    if (sessionState.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  document.getElementById('skip-btn')?.addEventListener('click', () => {
    clearTimer();
    const next = sessionState.currentIndex + 1;
    if (next >= state.timeboxes.length) {
      sessionState.complete = true;
      sessionState.isRunning = false;
      render();
    } else {
      sessionState.currentIndex = next;
      sessionState.secondsRemaining = state.timeboxes[next].duration;
      sessionState.isRunning = false;
      render();
    }
  });

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    clearTimer();
    sessionState = { currentIndex: 0, secondsRemaining: state.timeboxes[0].duration, isRunning: false };
    render();
  });

  document.getElementById('auto-advance')?.addEventListener('change', e => {
    state.autoAdvance = e.target.checked;
    saveState(state);
  });
}

render();
