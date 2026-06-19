// incrementer.js
import { getRecentImages } from './db.js';
import { showToast } from './state.js';

const INCREMENT_MODE_KEY = 'img_tagger_increment_mode';
const COUNTER_VALUE_KEY  = 'img_tagger_counter_value';

export function readIncrementMode() {
  return localStorage.getItem(INCREMENT_MODE_KEY) === 'true';
}

export function readCounterValue() {
  const val = parseInt(localStorage.getItem(COUNTER_VALUE_KEY));
  return isNaN(val) ? 1 : val;
}

export function writeIncrementMode(active) {
  localStorage.setItem(INCREMENT_MODE_KEY, active ? 'true' : 'false');
}

export function writeCounterValue(val) {
  localStorage.setItem(COUNTER_VALUE_KEY, val);
}

export async function updateCounterFromHistory() {
  try {
    const history = await getRecentImages();
    if (history && history.length > 0) {
      const lastItem = history[0];
      const lastTitle = lastItem.name;
      const match = lastTitle.match(/(\d+)$/);
      if (match) {
        const lastNum = parseInt(match[1]);
        setCounterValue(lastNum + 1);
        return;
      }
    }
  } catch (err) {
    console.warn('Erro ao atualizar contador pelo histórico:', err);
  }
}

export function updateResetButtonVisibility() {
  const btn = document.getElementById('btn-counter-reset');
  const displayVal = document.getElementById('counter-display-value');
  const ctrlGroup = document.getElementById('counter-control-group');
  
  if (!ctrlGroup) return;
  
  const current = readCounterValue();
  const active = readIncrementMode();
  
  if (active) {
    ctrlGroup.style.display = 'flex';
    if (displayVal) displayVal.textContent = current;
    if (btn) {
      btn.style.display = (current !== 1) ? 'inline-block' : 'none';
    }
  } else {
    ctrlGroup.style.display = 'none';
  }
}

export function resetCounter() {
  setCounterValue(1);
  showToast('Contador resetado para 1.');
}

export async function toggleIncrementMode() {
  const chk = document.getElementById('increment-mode-checkbox');
  const active = chk.checked;
  writeIncrementMode(active);
  
  if (active) {
    await updateCounterFromHistory();
  }
  
  window.dispatchEvent(new CustomEvent('app:change'));
  updateResetButtonVisibility();
}

export function setCounterValue(val) {
  let num = parseInt(val);
  if (isNaN(num) || num < 1) num = 1;
  writeCounterValue(num);
  
  window.dispatchEvent(new CustomEvent('app:change'));
  updateResetButtonVisibility();
}

export function incrementCounter() {
  const current = readCounterValue();
  writeCounterValue(current + 1);
  
  window.dispatchEvent(new CustomEvent('app:change'));
  updateResetButtonVisibility();
}

export function resolveName(name, counter) {
  if (readIncrementMode()) {
    const trimmed = name.trim();
    if (trimmed) {
      return trimmed + ' ' + counter;
    }
    return String(counter);
  }
  return name;
}

export function initIncrementMode() {
  const active = readIncrementMode();
  const chk = document.getElementById('increment-mode-checkbox');
  if (chk) chk.checked = active;
  
  updateResetButtonVisibility();
}
