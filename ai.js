// ai.js
import { canvas, tagRename, showToast, state } from './state.js';

const AI_MODE_KEY = 'img_tagger_ai_mode';

let tesseractWorker = null;
export let isAiModelReady = false;
export let isDownloading = false;

export function readAiMode() {
  return localStorage.getItem(AI_MODE_KEY) === 'true';
}

export function writeAiMode(active) {
  localStorage.setItem(AI_MODE_KEY, active ? 'true' : 'false');
}

// Para manter compatibilidade com assinaturas anteriores
export function readAiModelChoice() {
  return 'tesseract';
}
export function writeAiModelChoice(val) {}
export function changeAiModel() {}

export function toggleAiMode() {
  const chk = document.getElementById('ai-mode-checkbox');
  const active = chk.checked;
  
  writeAiMode(active);
  updateAiButtonVisibility();
  
  if (active && !isAiModelReady) {
    loadAiModel();
  } else if (!active) {
    const panel = document.getElementById('ai-download-panel');
    if (panel) panel.classList.remove('show');
  }
}

export function updateAiButtonVisibility() {
  const active = readAiMode();
  const btn = document.getElementById('btn-trigger-ai');
  if (btn) {
    btn.style.display = active ? 'inline-flex' : 'none';
  }
}

export function initAiMode() {
  const active = readAiMode();
  const chk = document.getElementById('ai-mode-checkbox');
  
  if (chk) chk.checked = active;
  updateAiButtonVisibility();
  
  if (active && !isAiModelReady) {
    loadAiModel();
  }
}

export function minimizeAiPanel() {
  const panel = document.getElementById('ai-download-panel');
  if (panel) {
    panel.classList.toggle('minimized');
    const btn = document.querySelector('.ai-panel-minimize');
    if (btn) {
      btn.textContent = panel.classList.contains('minimized') ? '⬜' : '_';
    }
  }
}

export async function loadAiModel() {
  if (isAiModelReady || isDownloading) return;
  
  const panel = document.getElementById('ai-download-panel');
  const progressBar = document.getElementById('ai-panel-progress-bar');
  const percentText = document.getElementById('ai-panel-percent');
  const statusText = document.querySelector('.ai-panel-status');
  const warningText = document.querySelector('.ai-warning-text');
  const title = document.querySelector('.ai-panel-title');
  
  if (!panel || !progressBar || !percentText || !statusText || !warningText || !title) return;
  
  isDownloading = true;
  panel.classList.remove('minimized');
  panel.classList.add('show');
  
  progressBar.style.background = 'linear-gradient(90deg, #66bb6a, #4caf50)';
  progressBar.style.width = '0%';
  percentText.textContent = '0%';
  
  title.textContent = '🤖 Inicializando OCR Local';
  statusText.innerHTML = 'Carregando motor OCR (WebAssembly)... <span>0%</span>';
  warningText.style.display = 'block';
  warningText.innerHTML = '⚠️ <strong>Atenção:</strong> Carregando Tesseract.js e arquivos de idioma locais (~10MB). Não feche o navegador.';

  try {
    const Tesseract = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
    
    tesseractWorker = await Tesseract.default.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'loading tesseract core') {
          progressBar.style.width = '35%';
          percentText.textContent = '35%';
          statusText.innerHTML = 'Carregando núcleo do OCR... <span>35%</span>';
        } else if (m.status === 'initializing api') {
          progressBar.style.width = '65%';
          percentText.textContent = '65%';
          statusText.innerHTML = 'Inicializando API... <span>65%</span>';
        } else if (m.status === 'loading language traineddata') {
          const pct = Math.round(65 + (m.progress || 0) * 30);
          progressBar.style.width = `${pct}%`;
          percentText.textContent = `${pct}%`;
          statusText.innerHTML = `Baixando modelo de idioma: eng <span>${pct}%</span>`;
        }
      }
    });

    isAiModelReady = true;
    isDownloading = false;
    progressBar.style.width = '100%';
    percentText.textContent = '100%';
    title.textContent = '🤖 OCR Pronto!';
    statusText.textContent = 'Motor OCR carregado e pronto para extração.';
    warningText.style.display = 'none';
    
    setTimeout(() => {
      panel.classList.remove('show');
    }, 2500);
    
  } catch (err) {
    console.error('Erro crítico ao carregar Tesseract:', err);
    isAiModelReady = false;
    isDownloading = false;
    title.textContent = '❌ Falha ao Inicializar OCR';
    statusText.textContent = 'Dispositivo sem suporte a WASM ou falha de rede.';
    warningText.style.display = 'none';
    progressBar.style.background = '#c62828';
    progressBar.style.width = '100%';
    showToast('Erro ao carregar o motor de OCR.');
    setTimeout(() => {
      panel.classList.remove('show');
    }, 5000);
  }
}

export async function runAiAutoTag() {
  if (!isAiModelReady || !tesseractWorker) {
    showToast('O motor OCR ainda está sendo carregado. Aguarde...');
    return;
  }
  
  const btnAi = document.getElementById('btn-trigger-ai');
  if (btnAi.disabled) return;
  
  btnAi.disabled = true;
  const originalHtml = btnAi.innerHTML;
  btnAi.innerHTML = '<span>🤖</span> Lendo imagem...';
  
  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    const ret = await tesseractWorker.recognize(dataUrl);
    const text = ret.data.text || '';
    
    console.log('[OCR Result]', text);
    
    const match = text.match(/\d{5,}/);
    if (match) {
      const num = match[0];
      tagRename.value = (tagRename.value.trim() + ' ' + num).trim();
      window.dispatchEvent(new CustomEvent('app:change'));
      showToast(`Patrimônio detectado: ${num}`);
    } else {
      showToast('Nenhum número de patrimônio (5+ dígitos) encontrado.');
    }
  } catch (err) {
    console.error('Erro ao rodar OCR:', err);
    showToast('Erro ao executar análise OCR.');
  } finally {
    btnAi.disabled = false;
    btnAi.innerHTML = originalHtml;
  }
}
