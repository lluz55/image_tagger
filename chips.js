// chips.js
import { 
  PREFIXES_KEY, ACTIVE_PREFIX_KEY, TAGS_KEY, ACTIVE_TAGS_KEY,
  prefixChips = document.getElementById('prefix-chips') ? null : null
} from './state.js';
import { updateNameHint, renderCanvas } from './app.js';

// ── Prefixos ────────────────────────────────────────────

export function readPrefixes()     { return JSON.parse(localStorage.getItem(PREFIXES_KEY) || '[]'); }
export function readActivePrefix() { return localStorage.getItem(ACTIVE_PREFIX_KEY) || ''; }

export function addPrefix(inputId) {
  const el = document.getElementById(inputId);
  const val = el.value.trim();
  if (!val) { el.focus(); return; }
  const arr = readPrefixes();
  if (!arr.includes(val)) {
    arr.push(val);
    localStorage.setItem(PREFIXES_KEY, JSON.stringify(arr));
  }
  localStorage.setItem(ACTIVE_PREFIX_KEY, val);  // ativa automaticamente
  el.value = '';
  renderPrefixes();
  renderCanvas();
}

export function togglePrefix(p) {
  const current = readActivePrefix();
  localStorage.setItem(ACTIVE_PREFIX_KEY, current === p ? '' : p);
  renderPrefixes();
  renderCanvas();
}

export function deletePrefix(p) {
  const arr = readPrefixes().filter(x => x !== p);
  localStorage.setItem(PREFIXES_KEY, JSON.stringify(arr));
  if (readActivePrefix() === p) localStorage.setItem(ACTIVE_PREFIX_KEY, '');
  renderPrefixes();
  renderCanvas();
}

export function renderPrefixes() {
  const arr    = readPrefixes();
  const active = readActivePrefix();
  const wraps  = [document.getElementById('prefix-chips'), document.getElementById('prefix-chips-2')];
  
  wraps.forEach(wrap => {
    if (!wrap) return;
    wrap.innerHTML = '';

    if (!arr.length) {
      const msg = document.createElement('span');
      msg.style.cssText = 'color:#3a3a3a;font-size:0.82rem';
      msg.textContent = 'Nenhum prefixo salvo';
      wrap.appendChild(msg);
    } else {
      arr.forEach(p => {
        const chip = document.createElement('div');
        chip.className = 'prefix-chip' + (p === active ? ' active' : '');

        const label = document.createElement('span');
        label.textContent = p;

        const del = document.createElement('button');
        del.className = 'chip-del';
        del.textContent = '×';
        del.title = 'Remover prefixo';
        del.addEventListener('click', e => { e.stopPropagation(); deletePrefix(p); });

        chip.appendChild(label);
        chip.appendChild(del);
        chip.addEventListener('click', () => togglePrefix(p));
        wrap.appendChild(chip);
      });
    }
  });

  updateNameHint();
}

// ── Tags ────────────────────────────────────────────────

export function readTags() { 
  const stored = localStorage.getItem(TAGS_KEY);
  if (!stored) return ['Sen', 'Cam']; // Valores iniciais
  return JSON.parse(stored);
}
export function readActiveTags() { return JSON.parse(localStorage.getItem(ACTIVE_TAGS_KEY) || '[]'); }

export function addTag(inputId) {
  const el = document.getElementById(inputId);
  const val = el.value.trim();
  if (!val) { el.focus(); return; }
  const arr = readTags();
  if (!arr.includes(val)) {
    arr.push(val);
    localStorage.setItem(TAGS_KEY, JSON.stringify(arr));
  }
  // Ativa apenas a nova tag (single selection)
  localStorage.setItem(ACTIVE_TAGS_KEY, JSON.stringify([val]));
  el.value = '';
  renderTags();
  renderCanvas();
}

export function toggleTag(t) {
  const active = readActiveTags();
  const newActive = active.includes(t) ? [] : [t];
  localStorage.setItem(ACTIVE_TAGS_KEY, JSON.stringify(newActive));
  renderTags();
  renderCanvas();
}

export function deleteTag(t) {
  const arr = readTags().filter(x => x !== t);
  localStorage.setItem(TAGS_KEY, JSON.stringify(arr));
  let active = readActiveTags().filter(x => x !== t);
  localStorage.setItem(ACTIVE_TAGS_KEY, JSON.stringify(active));
  renderTags();
  renderCanvas();
}

export function renderTags() {
  const arr    = readTags();
  const active = readActiveTags();
  const wraps  = [document.getElementById('tag-chips'), document.getElementById('tag-chips-2')];
  
  wraps.forEach(wrap => {
    if (!wrap) return;
    wrap.innerHTML = '';

    if (!arr.length) {
      const msg = document.createElement('span');
      msg.style.cssText = 'color:#3a3a3a;font-size:0.82rem';
      msg.textContent = 'Nenhuma tag salva';
      wrap.appendChild(msg);
    } else {
      arr.forEach(t => {
        const chip = document.createElement('div');
        chip.className = 'prefix-chip' + (active.includes(t) ? ' active' : '');

        const label = document.createElement('span');
        label.textContent = t;

        const del = document.createElement('button');
        del.className = 'chip-del';
        del.textContent = '×';
        del.title = 'Remover tag';
        del.addEventListener('click', e => { e.stopPropagation(); deleteTag(t); });

        chip.appendChild(label);
        chip.appendChild(del);
        chip.addEventListener('click', () => toggleTag(t));
        wrap.appendChild(chip);
      });
    }
  });

  updateNameHint();
}
