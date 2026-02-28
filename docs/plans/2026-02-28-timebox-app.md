# Timebox App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-based timebox app where users define named tasks with durations, run them in sequence, and persist their list via localStorage.

**Architecture:** Single-page vanilla JS app with two views (Edit and Run) toggled in-place. All state lives in a plain JS object, serialized to localStorage on every mutation. No build step — open index.html directly.

**Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES6+), Web Audio API, localStorage

---

### Task 1: Project Scaffold

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `app.js`

**Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Timebox</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>
```

**Step 2: Create `style.css`** with a minimal reset:

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, sans-serif;
  background: #f5f5f5;
  color: #1a1a1a;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

#app {
  width: 100%;
  max-width: 540px;
  padding: 2rem 1rem;
}
```

**Step 3: Create `app.js`** with a console.log to verify linking:

```js
console.log('Timebox app loaded');
```

**Step 4: Verify in browser**

Open `index.html` in a browser. Open DevTools console. Expected: `Timebox app loaded` is printed with no errors.

**Step 5: Commit**

```bash
git init
git add index.html style.css app.js docs/
git commit -m "feat: project scaffold"
```

---

### Task 2: Data Layer

**Files:**
- Modify: `app.js`

**Step 1: Define the state shape and storage key**

```js
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}
```

**Step 2: Verify in browser console**

Open DevTools and run:
```js
saveState({ timeboxes: [{ id: '1', name: 'Test', duration: 60 }], autoAdvance: true });
console.log(loadState());
```
Expected: object with the timebox is printed.

**Step 3: Commit**

```bash
git add app.js
git commit -m "feat: data layer with localStorage persistence"
```

---

### Task 3: Edit View — Render Timebox List

**Files:**
- Modify: `app.js`
- Modify: `style.css`

**Step 1: Add the main render function and Edit View skeleton**

Replace the `console.log` in `app.js` with:

```js
let state = loadState();
let sessionState = null; // runtime only, not persisted

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
  return `
    <div class="view edit-view">
      <h1>Timebox</h1>
      <ul class="timebox-list" id="timebox-list">
        ${state.timeboxes.map((tb, i) => renderTimeboxRow(tb, i)).join('')}
      </ul>
      <button class="btn btn-secondary" id="add-btn">+ Add timebox</button>
      <button class="btn btn-primary" id="start-btn" ${state.timeboxes.length === 0 ? 'disabled' : ''}>
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

function attachListeners() {
  // placeholder — filled in next tasks
}

render();
```

**Step 2: Add Edit View styles to `style.css`**

```css
h1 { font-size: 1.8rem; margin-bottom: 1.5rem; }

.timebox-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }

.timebox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}

.tb-name { flex: 1; border: none; outline: none; font-size: 1rem; }
.tb-duration { width: 5rem; border: none; outline: none; font-size: 1rem; text-align: center; font-family: monospace; }

.btn {
  display: block;
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  margin-bottom: 0.5rem;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary { background: #2563eb; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.btn-secondary { background: #e5e7eb; color: #1a1a1a; }
.btn-secondary:hover { background: #d1d5db; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0.25rem 0.4rem; border-radius: 4px; }
.btn-icon:hover { background: #f3f4f6; }
.btn-danger { color: #ef4444; }
```

**Step 3: Verify in browser**

Open `index.html`. Expected: "Timebox" heading, empty list, disabled "Start Session" button, "+ Add timebox" button. No console errors.

**Step 4: Commit**

```bash
git add app.js style.css
git commit -m "feat: edit view render with timebox rows"
```

---

### Task 4: Edit View — Interactions (Add, Delete, Reorder, Edit)

**Files:**
- Modify: `app.js`

**Step 1: Replace `attachListeners` with full edit-view event wiring**

```js
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
    // focus new name input
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
      // refresh start button state only
      const startBtn = document.getElementById('start-btn');
      if (startBtn) startBtn.disabled = state.timeboxes.length === 0;
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
        e.target.value = secondsToMMSS(tb.duration); // revert invalid
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
```

**Step 2: Add `attachRunListeners` stub (filled in Task 6)**

```js
function attachRunListeners() {
  // filled in Task 6
}
```

**Step 3: Verify in browser**

- Click "+ Add timebox" → row appears, name input is focused
- Type a name → saved (reload page, name persists)
- Change duration to `00:30` → accepted; type `99:99` → reverts
- Click ↑ / ↓ → rows reorder
- Click ✕ → row removed
- With ≥1 row: "Start Session" is enabled; with 0 rows: disabled

**Step 4: Commit**

```bash
git add app.js
git commit -m "feat: edit view interactions — add, delete, reorder, inline edit"
```

---

### Task 5: Run View — Layout & Display

**Files:**
- Modify: `app.js`
- Modify: `style.css`

**Step 1: Add `renderRunView`**

```js
function renderRunView() {
  const tb = state.timeboxes[sessionState.currentIndex];
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
```

**Step 2: Add Run View styles to `style.css`**

```css
.run-view { text-align: center; }

.btn-link { background: none; border: none; color: #2563eb; cursor: pointer; font-size: 0.9rem; margin-bottom: 1.5rem; display: inline-block; }
.btn-link:hover { text-decoration: underline; }

.tb-label { font-size: 1.2rem; color: #555; margin-bottom: 0.5rem; min-height: 1.5rem; }

.countdown { font-size: 5rem; font-weight: 700; font-family: monospace; letter-spacing: 0.05em; margin-bottom: 0.5rem; }

.progress { color: #888; margin-bottom: 1.5rem; }

.run-controls { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }

.auto-advance-toggle { display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.95rem; cursor: pointer; }

.complete-state { display: flex; flex-direction: column; align-items: center; gap: 1rem; margin-top: 2rem; }
.complete-label { font-size: 1.5rem; font-weight: 600; }
```

**Step 3: Verify in browser**

Add 2+ timeboxes in Edit View, click "Start Session". Expected: Run View shows first timebox name, full countdown, "1 / N" progress, Play/Skip/Reset buttons, Auto-advance checkbox, "← Edit" link.

**Step 4: Commit**

```bash
git add app.js style.css
git commit -m "feat: run view layout and display"
```

---

### Task 6: Timer Logic — Play, Pause, Skip, Reset

**Files:**
- Modify: `app.js`

**Step 1: Add timer interval variable and helpers at top of `app.js`** (after the state declarations):

```js
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
    // update countdown display without full re-render
    const el = document.querySelector('.countdown');
    if (el) el.textContent = secondsToMMSS(sessionState.secondsRemaining);
    const pp = document.getElementById('playpause-btn');
    if (pp) pp.textContent = 'Pause';
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
```

**Step 2: Fill in `attachRunListeners`**

```js
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
      advanceTo(next);
      pauseTimer(); // skip does not auto-start
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
```

**Step 3: Verify in browser**

- Click Play → countdown ticks down, button shows "Pause"
- Click Pause → countdown stops, button shows "Play"
- Click Skip → moves to next timebox, paused; skip on last → "Session complete!"
- Click Reset → returns to first timebox, paused
- Click "← Edit" → returns to Edit View, timer cleared

**Step 4: Commit**

```bash
git add app.js
git commit -m "feat: timer logic — play, pause, skip, reset, auto-advance"
```

---

### Task 7: Beep Sound via Web Audio API

**Files:**
- Modify: `app.js`

**Step 1: Add `playBeep` function** (add near top of `app.js`, after `generateId`):

```js
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
```

**Step 2: Verify in browser**

Run a timebox with a 5-second duration (`00:05`). When it hits zero, a short beep should play.

**Step 3: Commit**

```bash
git add app.js
git commit -m "feat: beep on timebox end via Web Audio API"
```

---

### Task 8: Polish — Edge Cases & UX

**Files:**
- Modify: `app.js`
- Modify: `style.css`

**Step 1: Prevent "Start Session" when all timeboxes have 0 duration**

In `attachEditListeners`, update the `start-btn` disabled check:

```js
const hasValid = state.timeboxes.some(t => t.duration > 0);
if (startBtn) startBtn.disabled = state.timeboxes.length === 0 || !hasValid;
```

Also apply the same check in `renderEditView`:

```js
const hasValid = state.timeboxes.some(t => t.duration > 0);
// ...
<button ... ${(state.timeboxes.length === 0 || !hasValid) ? 'disabled' : ''}>
```

**Step 2: Show a placeholder message when list is empty**

In `renderEditView`, replace the `<ul>` with:

```js
`<ul class="timebox-list" id="timebox-list">
  ${state.timeboxes.length === 0
    ? '<li class="empty-hint">No timeboxes yet. Add one below.</li>'
    : state.timeboxes.map((tb, i) => renderTimeboxRow(tb, i)).join('')}
</ul>`
```

Add style:

```css
.empty-hint { color: #aaa; font-style: italic; padding: 0.5rem 0; list-style: none; }
```

**Step 3: Verify in browser**

- Empty list shows placeholder text
- "Start Session" stays disabled with empty list
- All prior functionality still works

**Step 4: Commit**

```bash
git add app.js style.css
git commit -m "feat: polish — empty state, edge case guards"
```

---

### Task 9: Final Verification

**Step 1: Full end-to-end test**

1. Open `index.html` fresh (clear localStorage if needed via DevTools → Application → localStorage → Clear)
2. Add 3 timeboxes: "Focus" 25:00, "Break" 05:00, "Review" 10:00
3. Reload page — all 3 persist
4. Reorder with ↑↓ arrows
5. Delete one, add it back
6. Start session with auto-advance ON
7. Skip to last timebox, let timer run to 0
8. Verify beep plays, "Session complete!" appears
9. Reset → back to first timebox
10. Toggle auto-advance OFF, let a timebox end → verify it pauses instead of advancing
11. Click "← Edit" during a running timer → verify timer stops cleanly

**Step 2: Commit**

```bash
git add .
git commit -m "chore: final verification complete"
```
