// ai.js
import { canvas, tagRename, showToast, state } from './state.js';

const AI_MODE_KEY = 'img_tagger_ai_mode';

let tesseractWorker = null;
let barcodeReader = null;
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
  return 'hybrid';
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

function getPreprocessedCanvas(originalCanvas) {
  const offscreen = document.createElement('canvas');
  offscreen.width = originalCanvas.width;
  offscreen.height = originalCanvas.height;
  const octx = offscreen.getContext('2d');
  octx.drawImage(originalCanvas, 0, 0);
  
  try {
    const imgData = octx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imgData.data;
    
    // Converte para tons de cinza e aumenta o contraste
    const contrastFactor = 1.6;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      // Coeficientes padrão BT.601
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Amplia contraste
      gray = contrastFactor * (gray - 128) + 128;
      
      const finalVal = Math.min(255, Math.max(0, gray));
      
      data[i] = finalVal;
      data[i+1] = finalVal;
      data[i+2] = finalVal;
    }
    
    octx.putImageData(imgData, 0, 0);
    return offscreen;
  } catch (err) {
    console.warn('Erro ao processar imagem para OCR. Usando canvas original.', err);
    return originalCanvas;
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
  
  title.textContent = '🤖 Inicializando Leitor / OCR';
  statusText.innerHTML = 'Carregando motores de leitura... <span>0%</span>';
  warningText.style.display = 'block';
  warningText.innerHTML = '⚠️ <strong>Atenção:</strong> Inicializando leitor de código de barras e OCR local (~10MB). Não feche o navegador.';

  try {
    // 1. Carrega leitor de código de barras (ZXing)
    statusText.innerHTML = 'Carregando decodificador de código de barras... <span>15%</span>';
    progressBar.style.width = '15%';
    percentText.textContent = '15%';
    const zxingModule = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
    barcodeReader = new zxingModule.BrowserMultiFormatReader();

    // 2. Carrega motor OCR (Tesseract.js)
    statusText.innerHTML = 'Carregando motor OCR (WebAssembly)... <span>35%</span>';
    progressBar.style.width = '35%';
    percentText.textContent = '35%';
    const Tesseract = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
    
    tesseractWorker = await Tesseract.default.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'loading tesseract core') {
          progressBar.style.width = '55%';
          percentText.textContent = '55%';
          statusText.innerHTML = 'Carregando núcleo do OCR... <span>55%</span>';
        } else if (m.status === 'initializing api') {
          progressBar.style.width = '75%';
          percentText.textContent = '75%';
          statusText.innerHTML = 'Inicializando API... <span>75%</span>';
        } else if (m.status === 'loading language traineddata') {
          const pct = Math.round(75 + (m.progress || 0) * 20);
          progressBar.style.width = `${pct}%`;
          percentText.textContent = `${pct}%`;
          statusText.innerHTML = `Baixando modelo de idioma: eng <span>${pct}%</span>`;
        }
      }
    });

    // 3. Configura whitelist de números
    statusText.innerHTML = 'Otimizando parâmetros de OCR... <span>95%</span>';
    progressBar.style.width = '95%';
    percentText.textContent = '95%';
    await tesseractWorker.setParameters({
      tessedit_char_whitelist: '0123456789',
    });

    isAiModelReady = true;
    isDownloading = false;
    progressBar.style.width = '100%';
    percentText.textContent = '100%';
    title.textContent = '🤖 Leitores Prontos!';
    statusText.textContent = 'Motores de leitura e OCR inicializados com sucesso.';
    warningText.style.display = 'none';
    
    setTimeout(() => {
      panel.classList.remove('show');
    }, 2500);
    
  } catch (err) {
    console.error('Erro crítico ao inicializar motores:', err);
    isAiModelReady = false;
    isDownloading = false;
    title.textContent = '❌ Falha ao Inicializar';
    statusText.textContent = 'Dispositivo sem suporte a WASM ou falha de rede.';
    warningText.style.display = 'none';
    progressBar.style.background = '#c62828';
    progressBar.style.width = '100%';
    showToast('Erro ao carregar os motores de leitura.');
    setTimeout(() => {
      panel.classList.remove('show');
    }, 5000);
  }
}

export async function runAiAutoTag() {
  if (!isAiModelReady) {
    showToast('Aguarde o carregamento dos motores de leitura...');
    return;
  }
  
  const btnAi = document.getElementById('btn-trigger-ai');
  if (btnAi.disabled) return;
  
  btnAi.disabled = true;
  const originalHtml = btnAi.innerHTML;
  btnAi.innerHTML = '<span>🤖</span> Lendo códigos...';
  
  try {
    let tagFound = null;
    
    // ── PASSO 1: Tenta Ler Código de Barras / QR Code ──
    if (barcodeReader) {
      try {
        console.log('[Scanner] Tentando detectar código de barras/QR...');
        const result = await barcodeReader.decodeFromCanvasElement(canvas);
        const text = result.getText();
        if (text) {
          const match = text.match(/\d{5,}/);
          if (match) {
            tagFound = match[0];
            console.log('[Scanner] Patrimônio encontrado via código de barras:', tagFound);
          } else if (text.trim()) {
            tagFound = text.trim();
            console.log('[Scanner] Tag textual encontrada via código de barras:', tagFound);
          }
        }
      } catch (barcodeErr) {
        console.log('[Scanner] Nenhum código de barras/QR detectado.');
      }
    }
    
    // ── PASSO 2: Fallback para OCR do Tesseract Otimizado ──
    if (!tagFound && tesseractWorker) {
      btnAi.innerHTML = '<span>🤖</span> Processando OCR...';
      console.log('[OCR] Iniciando processamento de imagem para OCR...');
      
      const processedCanvas = getPreprocessedCanvas(canvas);
      
      const ret = await tesseractWorker.recognize(processedCanvas);
      const text = ret.data.text || '';
      console.log('[OCR] Texto reconhecido:', text);
      
      const match = text.match(/\d{5,}/);
      if (match) {
        tagFound = match[0];
      }
    }
    
    // ── PASSO 3: Aplica o resultado ──
    if (tagFound) {
      tagRename.value = (tagRename.value.trim() + ' ' + tagFound).trim();
      window.dispatchEvent(new CustomEvent('app:change'));
      showToast(`Patrimônio detectado: ${tagFound}`);
    } else {
      showToast('Nenhum código de barras ou número de patrimônio (5+ dígitos) detectado.');
    }
  } catch (err) {
    console.error('Erro na análise automática:', err);
    showToast('Erro ao executar análise.');
  } finally {
    btnAi.disabled = false;
    btnAi.innerHTML = originalHtml;
  }
}
