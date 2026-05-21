// ── Constantes ──────────────────────────────────────────
const HISTORY_KEY       = 'img_tagger_history';
const PREFIXES_KEY      = 'img_tagger_prefixes';
const ACTIVE_PREFIX_KEY = 'img_tagger_active_prefix';
const TAGS_KEY          = 'img_tagger_tags';
const ACTIVE_TAGS_KEY   = 'img_tagger_active_tags';
const MAX_ITEMS         = 20;
const THUMB_SIZE        = 56;

// ── Refs ────────────────────────────────────────────────
const inputCam      = document.getElementById('input-cam');
const inputGallery  = document.getElementById('input-gallery');
const nameInput     = document.getElementById('name-input');
const prefixHint    = document.getElementById('prefix-hint');
const prefixInput   = document.getElementById('prefix-input');
const prefixInput2  = document.getElementById('prefix-input-2');
const tagInput      = document.getElementById('tag-input');
const tagInput2     = document.getElementById('tag-input-2');
const tagRename     = document.getElementById('tag-rename');
const prefixHint2   = document.getElementById('prefix-hint-2');
const screenCap     = document.getElementById('screen-capture');
const screenPrev    = document.getElementById('screen-preview');
const canvas        = document.getElementById('canvas');
const ctx           = canvas.getContext('2d');
const toast         = document.getElementById('toast');

// ── Estado ──────────────────────────────────────────────
let currentImg  = null;
let currentName = '';   // nome base (sem prefixo/tags)

// ── Prefixos ────────────────────────────────────────────

function readPrefixes()     { return JSON.parse(localStorage.getItem(PREFIXES_KEY) || '[]'); }
function readActivePrefix() { return localStorage.getItem(ACTIVE_PREFIX_KEY) || ''; }

function addPrefix(inputId) {
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

function togglePrefix(p) {
  const current = readActivePrefix();
  localStorage.setItem(ACTIVE_PREFIX_KEY, current === p ? '' : p);
  renderPrefixes();
  renderCanvas();
}

function deletePrefix(p) {
  const arr = readPrefixes().filter(x => x !== p);
  localStorage.setItem(PREFIXES_KEY, JSON.stringify(arr));
  if (readActivePrefix() === p) localStorage.setItem(ACTIVE_PREFIX_KEY, '');
  renderPrefixes();
  renderCanvas();
}

function renderPrefixes() {
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

function readTags()       { 
  const stored = localStorage.getItem(TAGS_KEY);
  if (!stored) return ['Sen', 'Cam']; // Valores iniciais
  return JSON.parse(stored);
}
function readActiveTags() { return JSON.parse(localStorage.getItem(ACTIVE_TAGS_KEY) || '[]'); }

function addTag(inputId) {
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

function toggleTag(t) {
  const active = readActiveTags();
  // Se já está ativa, desativa. Se não, ativa apenas ela.
  const newActive = active.includes(t) ? [] : [t];
  localStorage.setItem(ACTIVE_TAGS_KEY, JSON.stringify(newActive));
  renderTags();
  renderCanvas();
}

function deleteTag(t) {
  const arr = readTags().filter(x => x !== t);
  localStorage.setItem(TAGS_KEY, JSON.stringify(arr));
  let active = readActiveTags().filter(x => x !== t);
  localStorage.setItem(ACTIVE_TAGS_KEY, JSON.stringify(active));
  renderTags();
  renderCanvas();
}

function renderTags() {
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

// ── Incrementador Lógica ─────────────────────────────────
const INCREMENT_MODE_KEY = 'img_tagger_increment_mode';
const COUNTER_VALUE_KEY  = 'img_tagger_counter_value';

function readIncrementMode() {
  return localStorage.getItem(INCREMENT_MODE_KEY) === 'true';
}

function readCounterValue() {
  const val = parseInt(localStorage.getItem(COUNTER_VALUE_KEY));
  return isNaN(val) ? 1 : val;
}

function writeIncrementMode(active) {
  localStorage.setItem(INCREMENT_MODE_KEY, active ? 'true' : 'false');
}

function writeCounterValue(val) {
  localStorage.setItem(COUNTER_VALUE_KEY, val);
}

function toggleIncrementMode() {
  const chk = document.getElementById('increment-mode-checkbox');
  const active = chk.checked;
  writeIncrementMode(active);
  
  const ctrl = document.getElementById('counter-control-group');
  if (ctrl) {
    ctrl.style.display = active ? 'flex' : 'none';
  }
  
  updateNameHint();
  renderCanvas();
}

function adjustCounter(amt) {
  const current = readCounterValue();
  const next = Math.max(1, current + amt);
  writeCounterValue(next);
  
  const input = document.getElementById('counter-value-input');
  if (input) input.value = next;
  
  updateNameHint();
  renderCanvas();
}

function setCounterValue(val) {
  let num = parseInt(val);
  if (isNaN(num) || num < 1) num = 1;
  writeCounterValue(num);
  
  const input = document.getElementById('counter-value-input');
  if (input) input.value = num;
  
  updateNameHint();
  renderCanvas();
}

function incrementCounter() {
  const current = readCounterValue();
  writeCounterValue(current + 1);
  
  const input = document.getElementById('counter-value-input');
  if (input) input.value = current + 1;
  
  updateNameHint();
}

function resolveName(name, counter) {
  if (readIncrementMode() && name.includes('{}')) {
    return name.replaceAll('{}', counter);
  }
  return name;
}

function initIncrementMode() {
  const active = readIncrementMode();
  const counter = readCounterValue();
  
  const chk = document.getElementById('increment-mode-checkbox');
  if (chk) chk.checked = active;
  
  const ctrl = document.getElementById('counter-control-group');
  if (ctrl) ctrl.style.display = active ? 'flex' : 'none';
  
  const input = document.getElementById('counter-value-input');
  if (input) input.value = counter;
}

function updateNameHint() {
  const prefix = readActivePrefix();
  const tags   = readActiveTags();
  
  // Tela 1
  const rawName1 = nameInput.value.trim();
  const name1 = resolveName(rawName1, readCounterValue());
  const parts1 = [];
  if (prefix) parts1.push(prefix);
  if (tags.length) parts1.push(tags.join(' - '));
  if (name1) parts1.push(name1);
  const full1 = parts1.join(' - ');

  if (prefixHint) {
    if (!full1) {
      prefixHint.textContent = '';
    } else {
      prefixHint.innerHTML = `Tag final: <strong style="color:#66bb6a">${full1}</strong>`;
    }
  }

  // Tela 2
  const rawName2 = tagRename.value.trim();
  const name2 = resolveName(rawName2, readCounterValue());
  const parts2 = [];
  if (prefix) parts2.push(prefix);
  if (tags.length) parts2.push(tags.join(' - '));
  if (name2) parts2.push(name2);
  const full2 = parts2.join(' - ');

  if (prefixHint2) {
    if (!full2) {
      prefixHint2.textContent = '';
    } else {
      prefixHint2.innerHTML = `Tag final: <strong style="color:#66bb6a">${full2}</strong>`;
    }
  }
}

// Enter no input de prefixo adiciona
prefixInput.addEventListener('keydown', e => { if (e.key === 'Enter') addPrefix('prefix-input'); });
prefixInput2.addEventListener('keydown', e => { if (e.key === 'Enter') addPrefix('prefix-input-2'); });
// Enter no input de tag adiciona
tagInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTag('tag-input'); });
tagInput2.addEventListener('keydown', e => { if (e.key === 'Enter') addTag('tag-input-2'); });

nameInput.addEventListener('input', updateNameHint);

// ── Captura ─────────────────────────────────────────────

function triggerCapture() {
  currentName = nameInput.value.trim();
  const prefix = readActivePrefix();
  const tags   = readActiveTags();
  if (!currentName && !prefix && !tags.length) { nameInput.focus(); return; }
  inputCam.value = '';
  inputCam.click();
}

function triggerGallery() {
  currentName = nameInput.value.trim();
  const prefix = readActivePrefix();
  const tags   = readActiveTags();
  if (!currentName && !prefix && !tags.length) { nameInput.focus(); return; }
  inputGallery.value = '';
  inputGallery.click();
}

inputCam.addEventListener('change',     () => onFileSelected(inputCam.files[0]));
inputGallery.addEventListener('change', () => onFileSelected(inputGallery.files[0]));

function onFileSelected(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      currentImg    = img;
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      tagRename.value = currentName;
      updateNameHint();
      renderCanvas();
      screenCap.style.display  = 'none';
      screenPrev.style.display = 'flex';
      window.scrollTo(0, 0);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Canvas ───────────────────────────────────────────────

function buildFullTag() {
  const prefix = (readActivePrefix() || '').trim();
  const tags   = readActiveTags();
  const rawName = (tagRename.value || '').trim();
  const name = resolveName(rawName, readCounterValue());
  
  const parts = [];
  if (prefix) parts.push(prefix);
  if (tags.length) parts.push(tags.join(' - '));
  if (name) parts.push(name);

  return parts.join(' - ');
}

function fitFontSize(text) {
  const maxW   = canvas.width * 0.9;
  let fontSize = Math.max(14, Math.round(canvas.height * 0.06));
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  if (ctx.measureText(text).width <= maxW) return fontSize;

  let lo = 14, hi = fontSize;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    ctx.font = `bold ${mid}px system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxW) lo = mid;
    else hi = mid;
  }
  return lo;
}

function renderCanvas() {
  if (!currentImg) return;
  const w   = canvas.width;
  const h   = canvas.height;
  const tag = buildFullTag();

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(currentImg, 0, 0);

  if (!tag) return;

  const fontSize = fitFontSize(tag);
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  
  const metrics = ctx.measureText(tag);
  const textW = metrics.width;
  const textH = fontSize; // aproximado

  const paddingX = fontSize * 0.5;
  const paddingY = fontSize * 0.3;
  const rectW = textW + paddingX * 2;
  const rectH = textH + paddingY * 2;
  const rectX = (w - rectW) / 2;
  const rectY = h - rectH - Math.round(h * 0.05);

  ctx.save();
  
  // Fundo da tag
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  const r = fontSize * 0.2; // border radius proporcional
  ctx.roundRect(rectX, rectY, rectW, rectH, r);
  ctx.fill();

  // Texto
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillStyle     = '#ffffff';
  
  ctx.fillText(tag, w / 2, rectY + rectH / 2);
  ctx.restore();
}

tagRename.addEventListener('input', () => {
  renderCanvas();
  updateNameHint();
});

// ── Salvar ───────────────────────────────────────────────

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function saveImage() {
  const finalTag = buildFullTag();
  canvas.toBlob(blob => {
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const safe = finalTag.replace(/[^a-z0-9_\-]/gi, '_');
    a.href     = url;
    a.download = `${safe || 'foto'}.jpg`;
    a.click();
    
    showToast('Imagem salva com sucesso!');
    saveToHistory(finalTag);

    // Auto-increment if mode is active and name template contains {}
    if (readIncrementMode() && tagRename.value.includes('{}')) {
      incrementCounter();
    }

    setTimeout(() => {
      URL.revokeObjectURL(url);
      newPhoto(); // Redireciona mantendo os dados
    }, 1500);

  }, 'image/jpeg', 0.92);
}

function newPhoto() {
  // Propaga o nome editado na Tela 2 de volta para Tela 1
  const edited = tagRename.value.trim();
  nameInput.value = edited; 
  currentName = edited;
  
  updateNameHint();
  screenPrev.style.display = 'none';
  screenCap.style.display  = 'flex';
  window.scrollTo(0, 0);
}

// ── Histórico ────────────────────────────────────────────

function makeThumbnail() {
  const off  = document.createElement('canvas');
  off.width  = THUMB_SIZE;
  off.height = THUMB_SIZE;
  const oc   = off.getContext('2d');
  const iw   = currentImg.naturalWidth;
  const ih   = currentImg.naturalHeight;
  const scale = THUMB_SIZE / Math.min(iw, ih);
  oc.drawImage(currentImg,
    (THUMB_SIZE - iw * scale) / 2,
    (THUMB_SIZE - ih * scale) / 2,
    iw * scale, ih * scale);
  return off.toDataURL('image/jpeg', 0.5);
}

function readHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveToHistory(name) {
  let arr = readHistory();
  arr.unshift({ name, ts: Date.now(), thumb: makeThumbnail() });
  if (arr.length > MAX_ITEMS) arr = arr.slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
  } catch {
    arr.pop();
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch {}
  }
  renderHistory();
}

function formatDate(ts) {
  const d   = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function renderHistory() {
  const arr     = readHistory();
  const section = document.getElementById('history-section');
  const list    = document.getElementById('history-list');

  if (!arr.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  list.innerHTML = '';

  arr.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML = `
      <img class="history-thumb" src="${item.thumb}" alt="">
      <div class="history-info">
        <div class="history-name">${escapeHtml(item.name)}</div>
        <div class="history-date">${formatDate(item.ts)}</div>
      </div>
      <span class="history-use">usar →</span>`;
    el.addEventListener('click', () => {
      nameInput.value = item.name;
      nameInput.focus();
      updateNameHint();
    });
    list.appendChild(el);
  });
}

// ── Init ─────────────────────────────────────────────────
renderPrefixes();
renderTags();
renderHistory();
initIncrementMode();
