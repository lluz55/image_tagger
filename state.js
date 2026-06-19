// state.js
export const HISTORY_KEY       = 'img_tagger_history';
export const PREFIXES_KEY      = 'img_tagger_prefixes';
export const ACTIVE_PREFIX_KEY = 'img_tagger_active_prefix';
export const TAGS_KEY          = 'img_tagger_tags';
export const ACTIVE_TAGS_KEY   = 'img_tagger_active_tags';
export const MAX_ITEMS         = 20;
export const THUMB_SIZE        = 56;

// Refs DOM
export const inputCam      = document.getElementById('input-cam');
export const inputGallery  = document.getElementById('input-gallery');
export const nameInput     = document.getElementById('name-input');
export const prefixHint    = document.getElementById('prefix-hint');
export const prefixInput   = document.getElementById('prefix-input');
export const prefixInput2  = document.getElementById('prefix-input-2');
export const tagInput      = document.getElementById('tag-input');
export const tagInput2     = document.getElementById('tag-input-2');
export const tagRename     = document.getElementById('tag-rename');
export const prefixHint2   = document.getElementById('prefix-hint-2');
export const screenCap     = document.getElementById('screen-capture');
export const screenPrev    = document.getElementById('screen-preview');
export const canvas        = document.getElementById('canvas');
export const ctx           = canvas.getContext('2d');
export const toast         = document.getElementById('toast');

// Estado compartilhado
export const state = {
  currentImg: null,
  currentName: '',
  originalFileName: ''
};

// Toast utilitário
export function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

let activeDownloadUrl = null;

export async function saveBlobToDevice(blob, filename) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'JPEG Image',
          accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      showToast('Imagem salva com sucesso!');
      return true;
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast('Salvamento cancelado.');
        return false;
      }
      console.warn('showSaveFilePicker falhou ou foi rejeitado, tentando fallback...', err);
    }
  }

  try {
    if (activeDownloadUrl) {
      URL.revokeObjectURL(activeDownloadUrl);
    }
    activeDownloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = activeDownloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showToast('Download iniciado! Verifique seus downloads.');
    setTimeout(() => {
      if (activeDownloadUrl === a.href) {
        URL.revokeObjectURL(activeDownloadUrl);
        activeDownloadUrl = null;
      }
    }, 15000);
    return true;
  } catch (err) {
    console.error('Fallback de download falhou:', err);
    showToast('Erro ao tentar salvar a imagem.');
    return false;
  }
}
