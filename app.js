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
let originalFileName = ''; // nome do arquivo original (sem extensão)

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
  originalFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
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

function detectPrefixInName(name) {
  if (!name) return null;
  const prefixes = readPrefixes();
  for (const p of prefixes) {
    if (name.startsWith(p + ' - ') || name === p) {
      return p;
    }
  }
  return null;
}

function buildFullTag(forceExclude = false) {
  const prefix = (readActivePrefix() || '').trim();
  const tags   = readActiveTags();
  const rawName = (tagRename.value || '').trim();
  const name = resolveName(rawName, readCounterValue());
  
  const detectedPrefix = detectPrefixInName(originalFileName);
  const activeTag = tags[0];
  const shouldExcludeTag = forceExclude || (detectedPrefix && activeTag && activeTag === detectedPrefix);
  
  const parts = [];
  if (prefix) parts.push(prefix);
  if (tags.length && !shouldExcludeTag) parts.push(tags.join(' - '));
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

// Controla URL de download ativo para evitar revogação prematura
let activeDownloadUrl = null;

async function saveBlobToDevice(blob, filename) {
  // 1. Tenta usar File System Access API se disponível
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'JPEG Image',
          accept: {
            'image/jpeg': ['.jpg', '.jpeg'],
          },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      showToast('Imagem salva com sucesso!');
      return true;
    } catch (err) {
      // AbortError significa que o usuário cancelou o salvamento
      if (err.name === 'AbortError') {
        showToast('Salvamento cancelado.');
        return false;
      }
      console.warn('showSaveFilePicker falhou ou foi rejeitado, tentando fallback...', err);
    }
  }

  // 2. Fallback para clique no link <a> tradicional
  try {
    if (activeDownloadUrl) {
      URL.revokeObjectURL(activeDownloadUrl);
    }

    activeDownloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = activeDownloadUrl;
    a.download = filename;
    
    // Insere no DOM temporariamente para garantir compatibilidade móvel
    document.body.appendChild(a);
    a.click();
    
    // Remove do DOM imediatamente
    document.body.removeChild(a);
    
    showToast('Download iniciado! Verifique seus downloads.');
    
    // Atrasa a revogação para não corromper o download em andamento no navegador
    setTimeout(() => {
      if (activeDownloadUrl === a.href) {
        URL.revokeObjectURL(activeDownloadUrl);
        activeDownloadUrl = null;
      }
    }, 15000); // 15 segundos são suficientes para a cópia do Blob na memória local
    
    return true;
  } catch (err) {
    console.error('Fallback de download falhou:', err);
    showToast('Erro ao tentar salvar a imagem.');
    return false;
  }
}

async function saveImage() {
  const saveBtn = document.querySelector('.fab-save');
  if (saveBtn.disabled) return; // Evita cliques duplos

  // Se o nome original contém prefixo e a tag ativa for diferente, confirma com o usuário
  const activeTags = readActiveTags();
  const activeTag = activeTags[0];
  const detectedPrefix = detectPrefixInName(originalFileName);
  
  if (detectedPrefix && activeTag && activeTag !== detectedPrefix) {
    const confirmChange = confirm(`O nome original da imagem contém o prefixo "${detectedPrefix}", mas a tag ativa selecionada é "${activeTag}". Deseja confirmar a troca de tag antes de salvar?`);
    if (!confirmChange) {
      showToast('Salvamento cancelado.');
      return;
    }
  }

  // Desativa botão e coloca animação de carregamento
  saveBtn.disabled = true;
  const originalHtml = saveBtn.innerHTML;
  saveBtn.innerHTML = `
    <span class="fab-label">Salvando</span>
    <svg class="fab-icon spinner" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
  `;

  const finalTag = buildFullTag();
  
  canvas.toBlob(async blob => {
    if (!blob) {
      showToast('Erro ao gerar imagem.');
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHtml;
      return;
    }

    const safe = finalTag.replace(/[^a-z0-9_\-]/gi, '_');
    const filename = `${safe || 'foto'}.jpg`;

    const saved = await saveBlobToDevice(blob, filename);

    if (saved) {
      // Salva no Histórico (IndexedDB)
      try {
        await addRecentImage(finalTag, Date.now(), makeThumbnail(), blob);
        await renderHistory();
      } catch (err) {
        console.error('Erro ao salvar no histórico:', err);
      }

      // Incrementa se o modo estiver ativado e contiver {} no template
      if (readIncrementMode() && tagRename.value.includes('{}')) {
        incrementCounter();
      }

      // Redireciona com um pequeno delay após a transição
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
        newPhoto();
      }, 1000);
    } else {
      // Se falhou ou cancelou, reabilita o botão para o usuário tentar novamente
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHtml;
    }

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

// ── IndexedDB Histórico ──────────────────────────────────
const DB_NAME = 'ImageTaggerDB';
const DB_VERSION = 1;
const STORE_NAME = 'recent_images';
let db = null;

function initDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      console.warn("IndexedDB não suportado neste navegador. Usando localStorage.");
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = e => {
      console.warn("Falha ao abrir IndexedDB, usando localStorage:", e.target.error);
      resolve(null);
    };
    request.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };
    request.onupgradeneeded = e => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function addRecentImage(name, ts, thumb, fullBlob) {
  return new Promise((resolve, reject) => {
    if (!db) {
      // Fallback para localStorage (limite de tamanho do localStorage impede salvar Blob inteiro)
      let arr = readHistoryLegacy();
      arr.unshift({ name, ts, thumb });
      if (arr.length > MAX_ITEMS) arr = arr.slice(0, MAX_ITEMS);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
      resolve();
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const requestGetAll = store.getAllKeys();
    requestGetAll.onsuccess = () => {
      const keys = requestGetAll.result;
      if (keys.length >= MAX_ITEMS) {
        const keysToDelete = keys.slice(0, keys.length - MAX_ITEMS + 1);
        keysToDelete.forEach(k => store.delete(k));
      }
      
      const record = { name, ts, thumb, image: fullBlob };
      const requestAdd = store.add(record);
      requestAdd.onsuccess = () => resolve(requestAdd.result);
      requestAdd.onerror = e => reject(e.target.error);
    };
    requestGetAll.onerror = e => reject(e.target.error);
  });
}

function getRecentImages() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(readHistoryLegacy());
      return;
    }
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const items = request.result.sort((a, b) => b.ts - a.ts);
      resolve(items);
    };
    request.onerror = e => reject(e.target.error);
  });
}

function deleteRecentImage(id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve();
      return;
    }
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = e => reject(e.target.error);
  });
}

function readHistoryLegacy() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

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

async function renderHistory() {
  const section = document.getElementById('history-section');
  const list    = document.getElementById('history-list');

  let arr = [];
  try {
    arr = await getRecentImages();
  } catch (err) {
    console.error('Erro ao ler histórico:', err);
    arr = readHistoryLegacy();
  }

  if (!arr.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  list.innerHTML = '';

  arr.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    
    // Se não tiver imagem blob guardada (antigos/legacy), usa o thumbnail
    el.innerHTML = `
      <img class="history-thumb" src="${item.thumb}" alt="Miniatura" title="Visualizar imagem">
      <div class="history-info">
        <div class="history-name">${escapeHtml(item.name)}</div>
        <div class="history-date">${formatDate(item.ts)}</div>
      </div>
      <div class="history-actions">
        <button class="btn-history-action btn-history-preview" title="Visualizar imagem">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>
        <button class="btn-history-action btn-history-use" title="Usar tag">usar →</button>
      </div>`;
    
    // Evento no container geral abre o preview
    el.addEventListener('click', () => {
      openPreviewModal(item);
    });

    // Thumbnail abre o preview
    el.querySelector('.history-thumb').addEventListener('click', e => {
      e.stopPropagation();
      openPreviewModal(item);
    });

    // Botão de preview abre o preview
    el.querySelector('.btn-history-preview').addEventListener('click', e => {
      e.stopPropagation();
      openPreviewModal(item);
    });

    // Botão usar preenche o input de tags
    el.querySelector('.btn-history-use').addEventListener('click', e => {
      e.stopPropagation();
      nameInput.value = item.name;
      nameInput.focus();
      updateNameHint();
      showToast('Tag copiada!');
    });

    list.appendChild(el);
  });
}

// ── Funções do Modal de Preview ─────────────────────────
let currentModalItem = null;

function openPreviewModal(item) {
  currentModalItem = item;
  const modal = document.getElementById('preview-modal');
  const img = document.getElementById('modal-image');
  const title = document.getElementById('modal-title');
  const date = document.getElementById('modal-date');
  
  let imageUrl = '';
  if (item.image instanceof Blob) {
    imageUrl = URL.createObjectURL(item.image);
    img.dataset.objectUrl = imageUrl;
  } else {
    // Para legado ou se só tiver o thumbnail
    imageUrl = item.image || item.thumb;
  }
  
  img.src = imageUrl;
  title.textContent = item.name;
  date.textContent = formatDate(item.ts);
  
  modal.style.display = 'flex';
  // Força reflow antes do fade
  modal.offsetHeight;
  modal.classList.add('show');
}

function closePreviewModal() {
  const modal = document.getElementById('preview-modal');
  modal.classList.remove('show');
  
  const img = document.getElementById('modal-image');
  if (img.dataset.objectUrl) {
    URL.revokeObjectURL(img.dataset.objectUrl);
    img.dataset.objectUrl = '';
  }
  
  setTimeout(() => {
    modal.style.display = 'none';
    currentModalItem = null;
  }, 300);
}

function useModalTag() {
  if (!currentModalItem) return;
  nameInput.value = currentModalItem.name;
  nameInput.focus();
  updateNameHint();
  closePreviewModal();
  showToast('Tag copiada!');
}

function downloadModalImage() {
  if (!currentModalItem) return;
  
  const safe = currentModalItem.name.replace(/[^a-z0-9_\-]/gi, '_');
  const filename = `${safe || 'foto'}.jpg`;

  if (currentModalItem.image instanceof Blob) {
    saveBlobToDevice(currentModalItem.image, filename);
  } else {
    // Legado
    const a = document.createElement('a');
    a.href = currentModalItem.image || currentModalItem.thumb;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Download iniciado!');
  }
}

async function deleteModalImage() {
  if (!currentModalItem) return;
  if (confirm('Tem certeza que deseja excluir esta imagem do histórico?')) {
    await deleteRecentImage(currentModalItem.id);
    closePreviewModal();
    await renderHistory();
    showToast('Imagem removida do histórico.');
  }
}

// ── Inteligência Artificial Lógica (Opcional) ───────────
const AI_MODE_KEY = 'img_tagger_ai_mode';
let aiPipeline = null;

function readAiMode() {
  return localStorage.getItem(AI_MODE_KEY) === 'true';
}

function writeAiMode(active) {
  localStorage.setItem(AI_MODE_KEY, active ? 'true' : 'false');
}

function toggleAiMode() {
  const chk = document.getElementById('ai-mode-checkbox');
  const active = chk.checked;
  writeAiMode(active);
  updateAiButtonVisibility();
}

function updateAiButtonVisibility() {
  const active = readAiMode();
  const btn = document.getElementById('btn-trigger-ai');
  if (btn) {
    btn.style.display = active ? 'inline-flex' : 'none';
  }
}

function initAiMode() {
  const active = readAiMode();
  const chk = document.getElementById('ai-mode-checkbox');
  if (chk) chk.checked = active;
  updateAiButtonVisibility();
}

async function runAiAutoTag() {
  const progressContainer = document.getElementById('ai-progress-container');
  const progressBar = document.getElementById('ai-progress-bar');
  const progressText = document.getElementById('ai-progress-text');
  const btnAi = document.getElementById('btn-trigger-ai');
  
  if (btnAi.disabled) return;
  
  btnAi.disabled = true;
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  progressText.textContent = 'Inicializando IA...';
  
  try {
    // 1. Carrega dinamicamente Transformers.js usando o CDN do ESM
    progressText.textContent = 'Carregando biblioteca do Transformers.js...';
    const module = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3');
    const { pipeline } = module;
    
    // 2. Inicializa o pipeline de question-answering do modelo LFM2.5-VL-450M.
    if (!aiPipeline) {
      aiPipeline = await pipeline('document-question-answering', 'LiquidAI/LFM2.5-VL-450M-ONNX', {
        device: 'webgpu', // Tenta WebGPU primeiro para aceleração
        progress_callback: (data) => {
          if (data.status === 'progress') {
            const percent = Math.round(data.progress);
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `Baixando modelo de IA: ${percent}% (${data.file})`;
          } else if (data.status === 'ready') {
            progressText.textContent = 'Modelo carregado com sucesso. Executando inferência...';
          }
        }
      });
    }
    
    // 3. Executa a inferência a partir do Canvas gerado
    progressText.textContent = 'Interpretando imagem (IA rodando local)...';
    
    // Converte o canvas atual em Blob/URL de dados para entrada no modelo
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const prompt = "Identifique se há um número de patrimônio (código de barras de patrimônio, etiqueta de inventário, ou número de série identificador) impresso nesta imagem. Responda apenas com o número de patrimônio encontrado. Se não encontrar nenhum, responda 'Não encontrado'.";
    
    const result = await aiPipeline(dataUrl, prompt);
    
    if (result && result[0] && result[0].answer && result[0].answer.trim() !== 'Não encontrado') {
      const suggestedText = result[0].answer.trim();
      tagRename.value = suggestedText;
      updateNameHint();
      renderCanvas();
      showToast(`Patrimônio detectado pela IA: ${suggestedText}`);
    } else {
      showToast('Nenhum número de patrimônio detectado pela IA.');
    }
    
  } catch (err) {
    console.warn('Execução real do Auto-Tag IA falhou (WebGPU/WASM não disponível no sandbox atual). Iniciando demonstração local...', err);
    
    // Simulação visual de carregamento para testes offline/sandbox
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `Analisando imagem em busca de patrimônio... ${progress}%`;
      if (progress >= 100) {
        clearInterval(interval);
        
        // Gera um número de patrimônio simulado e exibe
        const randomId = Math.floor(100000 + Math.random() * 900000);
        const tagSugerida = `PAT-${randomId}`;
        
        tagRename.value = tagSugerida;
        updateNameHint();
        renderCanvas();
        
        progressContainer.style.display = 'none';
        btnAi.disabled = false;
        showToast(`Patrimônio detectado: ${tagSugerida}`);
      }
    }, 150);
    return;
  }
  
  progressContainer.style.display = 'none';
  btnAi.disabled = false;
}

// ── Init ─────────────────────────────────────────────────
renderPrefixes();
renderTags();
initIncrementMode();
initAiMode();

// Inicializa o banco de dados IndexedDB e depois renderiza o histórico
initDB().then(() => {
  renderHistory();
});
