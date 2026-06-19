// app.js
import { 
  inputCam, inputGallery, nameInput, prefixHint, prefixInput, prefixInput2,
  tagInput, tagInput2, tagRename, prefixHint2, screenCap, screenPrev,
  canvas, ctx, toast, state, showToast, saveBlobToDevice
} from './state.js';
import { initDB, addRecentImage } from './db.js';
import { 
  readActivePrefix, readActiveTags, addPrefix, addTag, 
  renderPrefixes, renderTags, detectPrefixInName 
} from './chips.js';
import { 
  readIncrementMode, readCounterValue, incrementCounter, 
  resolveName, initIncrementMode, setCounterValue, 
  toggleIncrementMode, resetCounter, updateCounterFromHistory
} from './incrementer.js';
import { 
  toggleAiMode, changeAiModel, runAiAutoTag, 
  initAiMode, minimizeAiPanel
} from './ai.js';
import { 
  renderHistory, makeThumbnail, openPreviewModal, closePreviewModal, 
  useModalTag, downloadModalImage, deleteModalImage 
} from './history.js';

// ── Captura / Arquivos ───────────────────────────────────

export function triggerCapture() {
  state.currentName = nameInput.value.trim();
  const prefix = readActivePrefix();
  const tags   = readActiveTags();
  if (!state.currentName && !prefix && !tags.length) { nameInput.focus(); return; }
  inputCam.value = '';
  inputCam.click();
}

export function triggerGallery() {
  state.currentName = nameInput.value.trim();
  const prefix = readActivePrefix();
  const tags   = readActiveTags();
  if (!state.currentName && !prefix && !tags.length) { nameInput.focus(); return; }
  inputGallery.value = '';
  inputGallery.click();
}

inputCam.addEventListener('change',     () => onFileSelected(inputCam.files[0]));
inputGallery.addEventListener('change', () => onFileSelected(inputGallery.files[0]));

function onFileSelected(file) {
  if (!file) return;
  state.originalFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      state.currentImg    = img;
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      tagRename.value = state.currentName;
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

// ── Canvas e Tag Building ────────────────────────────────

export function buildFullTag(forceExclude = false) {
  const prefix = (readActivePrefix() || '').trim();
  const tags   = readActiveTags();
  const rawName = (tagRename.value || '').trim();
  const name = resolveName(rawName, readCounterValue());
  
  const detectedPrefix = detectPrefixInName(state.originalFileName);
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

export function renderCanvas() {
  if (!state.currentImg) return;
  const w   = canvas.width;
  const h   = canvas.height;
  const tag = buildFullTag();

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(state.currentImg, 0, 0);

  if (!tag) return;

  const fontSize = fitFontSize(tag);
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  
  const metrics = ctx.measureText(tag);
  const textW = metrics.width;
  const textH = fontSize;

  const paddingX = fontSize * 0.5;
  const paddingY = fontSize * 0.3;
  const rectW = textW + paddingX * 2;
  const rectH = textH + paddingY * 2;
  const rectX = (w - rectW) / 2;
  const rectY = h - rectH - Math.round(h * 0.05);

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  const r = fontSize * 0.2;
  ctx.roundRect(rectX, rectY, rectW, rectH, r);
  ctx.fill();

  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillStyle     = '#ffffff';
  ctx.fillText(tag, w / 2, rectY + rectH / 2);
  ctx.restore();
}

export function updateNameHint() {
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
    prefixHint.innerHTML = !full1 ? '' : `Tag final: <strong style="color:#66bb6a">${full1}</strong>`;
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
    prefixHint2.innerHTML = !full2 ? '' : `Tag final: <strong style="color:#66bb6a">${full2}</strong>`;
  }
}

tagRename.addEventListener('input', () => {
  renderCanvas();
  updateNameHint();
});

nameInput.addEventListener('input', updateNameHint);

// ── Salvar ───────────────────────────────────────────────

export async function saveImage() {
  const saveBtn = document.querySelector('.fab-save');
  if (saveBtn.disabled) return;

  const activeTags = readActiveTags();
  const activeTag = activeTags[0];
  const detectedPrefix = detectPrefixInName(state.originalFileName);
  
  if (detectedPrefix && activeTag && activeTag !== detectedPrefix) {
    const confirmChange = confirm(`O nome original da imagem contém o prefixo "${detectedPrefix}", mas a tag ativa selecionada é "${activeTag}". Deseja confirmar a troca de tag antes de salvar?`);
    if (!confirmChange) {
      showToast('Salvamento cancelado.');
      return;
    }
  }

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
      try {
        await addRecentImage(finalTag, Date.now(), makeThumbnail(), blob);
        await renderHistory();
      } catch (err) {
        console.error('Erro ao salvar no histórico:', err);
      }

      if (readIncrementMode() && tagRename.value.includes('')) {
        incrementCounter();
      }

      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHtml;
        newPhoto();
      }, 1000);
    } else {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHtml;
    }
  }, 'image/jpeg', 0.92);
}

export function newPhoto() {
  const edited = tagRename.value.trim();
  nameInput.value = edited; 
  state.currentName = edited;
  
  canvas.classList.remove('fullscreen-view');
  updateNameHint();
  screenPrev.style.display = 'none';
  screenCap.style.display  = 'flex';
  window.scrollTo(0, 0);
}

export function toggleFullscreen(element) {
  element.classList.toggle('fullscreen-view');
  if (element.classList.contains('fullscreen-view')) {
    showToast('Toque na imagem para voltar');
  }
}

// ── Teclas Enter para adicionar chips ────────────────────
prefixInput.addEventListener('keydown', e => { if (e.key === 'Enter') addPrefix('prefix-input'); });
prefixInput2.addEventListener('keydown', e => { if (e.key === 'Enter') addPrefix('prefix-input-2'); });
tagInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTag('tag-input'); });
tagInput2.addEventListener('keydown', e => { if (e.key === 'Enter') addTag('tag-input-2'); });

// ── Exposição Global para Eventos Inline do HTML ─────────
window.toggleIncrementMode = toggleIncrementMode;
window.setCounterValue = setCounterValue;
window.addPrefix = addPrefix;
window.addTag = addTag;
window.triggerCapture = triggerCapture;
window.triggerGallery = triggerGallery;
window.newPhoto = newPhoto;
window.saveImage = saveImage;
window.closePreviewModal = closePreviewModal;
window.useModalTag = useModalTag;
window.downloadModalImage = downloadModalImage;
window.deleteModalImage = deleteModalImage;
window.toggleAiMode = toggleAiMode;
window.changeAiModel = changeAiModel;
window.runAiAutoTag = runAiAutoTag;
window.minimizeAiPanel = minimizeAiPanel;
window.resetCounter = resetCounter;
window.toggleFullscreen = toggleFullscreen;

// ── Evento de mudança global ─────────────────────────────
window.addEventListener('app:change', () => {
  updateNameHint();
  renderCanvas();
});

// ── Init ─────────────────────────────────────────────────
renderPrefixes();
renderTags();
updateNameHint();
initIncrementMode();
initAiMode();

initDB().then(async () => {
  if (readIncrementMode()) {
    await updateCounterFromHistory();
  }
  renderHistory();
});
