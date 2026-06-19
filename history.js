// history.js
import { getRecentImages, deleteRecentImage } from './db.js';
import { state, nameInput, showToast, saveBlobToDevice } from './state.js';

export function makeThumbnail() {
  const off  = document.createElement('canvas');
  const THUMB_SIZE = 56;
  off.width  = THUMB_SIZE;
  off.height = THUMB_SIZE;
  const oc   = off.getContext('2d');
  const iw   = state.currentImg.naturalWidth;
  const ih   = state.currentImg.naturalHeight;
  const scale = THUMB_SIZE / Math.min(iw, ih);
  oc.drawImage(state.currentImg,
    (THUMB_SIZE - iw * scale) / 2,
    (THUMB_SIZE - ih * scale) / 2,
    iw * scale, ih * scale);
  return off.toDataURL('image/jpeg', 0.5);
}

export function formatDate(ts) {
  const d   = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function escapeHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

export async function renderHistory() {
  const section = document.getElementById('history-section');
  const list    = document.getElementById('history-list');

  let arr = [];
  try {
    arr = await getRecentImages();
  } catch (err) {
    console.error('Erro ao ler histórico:', err);
  }

  if (!arr.length) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  list.innerHTML = '';

  arr.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    
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
    
    el.addEventListener('click', () => {
      openPreviewModal(item);
    });

    el.querySelector('.history-thumb').addEventListener('click', e => {
      e.stopPropagation();
      openPreviewModal(item);
    });

    el.querySelector('.btn-history-preview').addEventListener('click', e => {
      e.stopPropagation();
      openPreviewModal(item);
    });

    el.querySelector('.btn-history-use').addEventListener('click', e => {
      e.stopPropagation();
      nameInput.value = item.name;
      nameInput.focus();
      window.dispatchEvent(new CustomEvent('app:change'));
      showToast('Tag copiada!');
    });

    list.appendChild(el);
  });
}

// ── Funções do Modal de Preview ─────────────────────────
export let currentModalItem = null;

export function openPreviewModal(item) {
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
    imageUrl = item.image || item.thumb;
  }
  
  img.src = imageUrl;
  title.textContent = item.name;
  date.textContent = formatDate(item.ts);
  
  modal.style.display = 'flex';
  modal.offsetHeight; // Força reflow
  modal.classList.add('show');
}

export function closePreviewModal() {
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

export function useModalTag() {
  if (!currentModalItem) return;
  nameInput.value = currentModalItem.name;
  nameInput.focus();
  window.dispatchEvent(new CustomEvent('app:change'));
  closePreviewModal();
  showToast('Tag copiada!');
}

export function downloadModalImage() {
  if (!currentModalItem) return;
  
  const safe = currentModalItem.name.replace(/[^a-z0-9_\-]/gi, '_');
  const filename = `${safe || 'foto'}.jpg`;

  if (currentModalItem.image instanceof Blob) {
    saveBlobToDevice(currentModalItem.image, filename);
  } else {
    const a = document.createElement('a');
    a.href = currentModalItem.image || currentModalItem.thumb;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Download iniciado!');
  }
}

export async function deleteModalImage() {
  if (!currentModalItem) return;
  if (confirm('Tem certeza que deseja excluir esta imagem do histórico?')) {
    await deleteRecentImage(currentModalItem.id);
    closePreviewModal();
    await renderHistory();
    showToast('Imagem removida do histórico.');
  }
}
