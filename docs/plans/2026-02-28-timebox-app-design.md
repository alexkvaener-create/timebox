# Timebox App Design

**Date:** 2026-02-28

## Overview

A browser-based timebox app. Users define named tasks with specific durations, then run them in sequence. Data is saved locally via `localStorage`. No build step — plain HTML, CSS, and JS.

## Stack

- Vanilla HTML/CSS/JS
- Single `index.html` entry point
- No dependencies, no build tooling

## Data Model

Stored in `localStorage` under the key `timebox-app`:

```js
{
  timeboxes: [
    { id: "uuid", name: "Deep Work", duration: 1500 } // duration in seconds
  ],
  autoAdvance: true
}
```

Session state (current index, seconds remaining, running/paused) is runtime-only and not persisted. Refreshing the page returns to Edit View.

## Views

### Edit View (default)

- List of timeboxes, each row: name input, MM:SS duration input, delete button, up/down reorder arrows
- "Add timebox" button at the bottom
- "Start Session" button to switch to Run View
- Changes auto-saved to localStorage on every edit

### Run View

- Large centered countdown (MM:SS)
- Current timebox name above countdown
- Progress indicator below countdown (e.g. `2 / 5`)
- Controls: Play/Pause · Skip · Reset Session
- Auto-advance toggle (on/off), preference saved to localStorage
- "Edit" button to return to Edit View (resets session)

## Timer Logic

- `setInterval` at 1-second ticks
- Play/Pause clears/restarts the interval
- Runtime state: `currentIndex`, `secondsRemaining`, `isRunning`

### On timebox end

1. Play a short beep via Web Audio API (no external files)
2. If auto-advance ON → wait 1 second, start next timebox
3. If auto-advance OFF → pause, wait for user to click Play or Skip
4. After last timebox → show "Session complete!" with Reset button

## Files

```
index.html
style.css
app.js
docs/plans/2026-02-28-timebox-app-design.md
```
