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

console.log('Timebox app loaded');
