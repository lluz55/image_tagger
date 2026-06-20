// ai.js
import { canvas, tagRename, showToast } from './state.js';

const AI_MODE_KEY = 'img_tagger_ai_mode';

let barcodeReader = null;
let ocrWorker = null;
let isOcrReady = false;
export let isAiModelReady = false;
export let isDownloading = false;

export function readAiMode() {
  return localStorage.getItem(AI_MODE_KEY) === 'true';
}

export function writeAiMode(active) {
  localStorage.setItem(AI_MODE_KEY, active ? 'true' : 'false');
}

export function readAiModelChoice() { return 'scanner'; }
export function writeAiModelChoice() {}
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
  if (btn) btn.style.display = active ? 'inline-flex' : 'none';
}

export function initAiMode() {
  const active = readAiMode();
  const chk = document.getElementById('ai-mode-checkbox');
  if (chk) chk.checked = active;
  updateAiButtonVisibility();
  if (active && !isAiModelReady) loadAiModel();
}

export function minimizeAiPanel() {
  const panel = document.getElementById('ai-download-panel');
  if (panel) {
    panel.classList.toggle('minimized');
    const btn = document.querySelector('.ai-panel-minimize');
    if (btn) btn.textContent = panel.classList.contains('minimized') ? '⬜' : '_';
  }
}

export async function loadAiModel() {
  if (isAiModelReady || isDownloading) return;

  const panel      = document.getElementById('ai-download-panel');
  const progressBar = document.getElementById('ai-panel-progress-bar');
  const percentText = document.getElementById('ai-panel-percent');
  const statusText  = document.querySelector('.ai-panel-status');
  const warningText = document.querySelector('.ai-warning-text');
  const title       = document.querySelector('.ai-panel-title');

  if (!panel || !progressBar || !percentText || !statusText || !title) return;

  isDownloading = true;
  panel.classList.remove('minimized');
  panel.classList.add('show');

  progressBar.style.background = 'linear-gradient(90deg, #66bb6a, #4caf50)';
  progressBar.style.width = '0%';
  percentText.textContent = '0%';
  title.textContent = 'Carregando Leitores';
  statusText.innerHTML = 'Carregando leitor de código de barras...';
  if (warningText) warningText.style.display = 'none';

  const filesContainer = document.getElementById('ai-files-container');
  if (filesContainer) filesContainer.innerHTML = '';

  try {
    progressBar.style.width = '25%';
    percentText.textContent = '25%';

    const zxingModule = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
    barcodeReader = new zxingModule.BrowserMultiFormatReader();

    isAiModelReady = true;
    window.isAiModelReady = true;

    progressBar.style.width = '50%';
    percentText.textContent = '50%';
    statusText.innerHTML = 'Código de barras pronto. Carregando OCR de texto (~10 MB)...';

    loadTesseractBackground(progressBar, percentText, statusText, title, panel);

  } catch (err) {
    console.error('Erro ao inicializar leitor de código de barras:', err);
    isDownloading = false;
    title.textContent = 'Erro ao Carregar';
    statusText.textContent = 'Falha ao carregar o leitor de código de barras.';
    progressBar.style.background = '#c62828';
    progressBar.style.width = '100%';
    showToast('Erro ao inicializar o leitor de código de barras.');
    setTimeout(() => panel.classList.remove('show'), 4000);
  }
}

async function loadTesseractBackground(progressBar, percentText, statusText, title, panel) {
  try {
    const { createWorker } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@4/+esm');

    ocrWorker = await createWorker('eng', 1, {
      workerBlobURL: false,
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@4/tesseract-core-simd-lstm.wasm.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast',
      logger: (m) => {
        if (m.status === 'loading language traineddata') {
          const p = Math.round(50 + (m.progress || 0) * 45);
          progressBar.style.width = `${p}%`;
          percentText.textContent = `${p}%`;
          statusText.innerHTML = `Baixando modelo OCR... <span>${p}%</span>`;
        }
      },
    });

    await ocrWorker.setParameters({ tessedit_char_whitelist: '0123456789' });
    isOcrReady = true;
    isDownloading = false;

    progressBar.style.width = '100%';
    percentText.textContent = '100%';
    title.textContent = 'Leitores Prontos!';
    statusText.textContent = 'Código de barras e OCR prontos.';
    setTimeout(() => panel.classList.remove('show'), 2000);

  } catch (err) {
    console.warn('[Tesseract] Falha ao carregar OCR, continuando sem ele:', err);
    isDownloading = false;
    progressBar.style.width = '100%';
    percentText.textContent = '100%';
    title.textContent = 'Leitor Pronto';
    statusText.textContent = 'Leitor de código de barras ativo (OCR de texto indisponível).';
    setTimeout(() => panel.classList.remove('show'), 2500);
  }
}

// Converte canvas para escala de cinza, estica o contraste e binariza.
// Melhora a taxa de detecção do ZXing em fotos escuras ou com reflexo.
function preprocessCanvas(srcCanvas) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  const tCtx = temp.getContext('2d');
  tCtx.drawImage(srcCanvas, 0, 0);

  const imgData = tCtx.getImageData(0, 0, w, h);
  const d = imgData.data;

  let minG = 255, maxG = 0;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const g = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
    gray[i] = g;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
  }

  const range = maxG - minG || 1;
  const threshold = minG + range * 0.5;

  for (let i = 0; i < w * h; i++) {
    const bin = gray[i] >= threshold ? 255 : 0;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = bin;
    d[i * 4 + 3] = 255;
  }

  tCtx.putImageData(imgData, 0, 0);
  return temp;
}

function detectAndCropROI(srcCanvas) {
  const targetSize = 300;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = targetSize;
  tempCanvas.height = targetSize;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(srcCanvas, 0, 0, targetSize, targetSize);

  const imgData = tempCtx.getImageData(0, 0, targetSize, targetSize);
  const data = imgData.data;

  const grad = new Float32Array(targetSize * targetSize);
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize - 1; x++) {
      const idx1 = (y * targetSize + x) * 4;
      const idx2 = (y * targetSize + (x + 1)) * 4;
      const g1 = (data[idx1] + data[idx1 + 1] + data[idx1 + 2]) / 3;
      const g2 = (data[idx2] + data[idx2 + 1] + data[idx2 + 2]) / 3;
      grad[y * targetSize + x] = Math.abs(g1 - g2);
    }
  }

  const gridSize = 15;
  const cellSize = targetSize / gridSize;
  const energy = [];
  let maxEnergy = 0;
  let maxCell = { r: 0, c: 0 };

  for (let r = 0; r < gridSize; r++) {
    energy[r] = [];
    for (let c = 0; c < gridSize; c++) {
      let cellEnergy = 0;
      const startY = Math.floor(r * cellSize);
      const endY   = Math.floor((r + 1) * cellSize);
      const startX = Math.floor(c * cellSize);
      const endX   = Math.floor((c + 1) * cellSize);
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          cellEnergy += grad[y * targetSize + x];
        }
      }
      energy[r][c] = cellEnergy;
      if (cellEnergy > maxEnergy) {
        maxEnergy = cellEnergy;
        maxCell = { r, c };
      }
    }
  }

  const threshold = maxEnergy * 0.4;
  let minR = maxCell.r, maxR = maxCell.r;
  let minC = maxCell.c, maxC = maxCell.c;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (energy[r][c] > threshold) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
  }

  const scaleX = srcCanvas.width / targetSize;
  const scaleY = srcCanvas.height / targetSize;

  const pad = 1;
  const finalMinR = Math.max(0, minR - pad);
  const finalMaxR = Math.min(gridSize - 1, maxR + pad);
  const finalMinC = Math.max(0, minC - pad);
  const finalMaxC = Math.min(gridSize - 1, maxC + pad);

  const x = finalMinC * cellSize * scaleX;
  const y = finalMinR * cellSize * scaleY;
  const w = (finalMaxC - finalMinC + 1) * cellSize * scaleX;
  const h = (finalMaxR - finalMinR + 1) * cellSize * scaleY;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = w;
  croppedCanvas.height = h;
  croppedCanvas.getContext('2d').drawImage(srcCanvas, x, y, w, h, 0, 0, w, h);

  return { croppedCanvas, x, y, w, h };
}

async function tryNativeBarcodeDetector(srcCanvas) {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const want = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'itf', 'qr_code', 'data_matrix', 'pdf417', 'upc_a', 'upc_e'];
    const formats = want.filter(f => supported.includes(f));
    if (!formats.length) return null;

    const detector = new window.BarcodeDetector({ formats });
    const barcodes = await detector.detect(srcCanvas);
    for (const bc of barcodes) {
      const match = bc.rawValue.match(/\d{5,}/);
      if (match) return match[0];
    }
  } catch (err) {
    console.warn('[BarcodeDetector] Erro:', err);
  }
  return null;
}

async function tryZXing(srcCanvas) {
  if (!barcodeReader) return null;
  try {
    const result = await barcodeReader.decodeFromCanvasElement(srcCanvas);
    const match = result.getText().match(/\d{5,}/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

async function tryTesseract(srcCanvas) {
  if (!isOcrReady || !ocrWorker) return null;
  try {
    const { data } = await ocrWorker.recognize(srcCanvas);
    const match = data.text.replace(/\s/g, '').match(/\d{5,}/);
    return match ? match[0] : null;
  } catch (err) {
    console.warn('[Tesseract] Erro:', err);
    return null;
  }
}

export async function runAiAutoTag() {
  if (!isAiModelReady) {
    showToast('Aguarde o carregamento dos leitores...');
    return;
  }

  const btnAi = document.getElementById('btn-trigger-ai');
  let originalHtml = '';
  if (btnAi) {
    if (btnAi.disabled) return;
    btnAi.disabled = true;
    originalHtml = btnAi.innerHTML;
    btnAi.innerHTML = '<span>🔍</span> Analisando...';
  }

  const overlay     = document.getElementById('ai-inference-overlay');
  const overlayText = document.getElementById('ai-inference-text');
  if (overlay) {
    if (overlayText) overlayText.textContent = 'Processando imagem...';
    overlay.classList.add('show');
  }

  const suggestions = [];

  try {
    const container = document.getElementById('ai-suggestions-container');
    const chipsWrap = document.getElementById('ai-suggestions-chips');
    if (container) container.style.display = 'none';
    if (chipsWrap) chipsWrap.innerHTML = '';

    const { croppedCanvas }  = detectAndCropROI(canvas);
    const preprocessedFull   = preprocessCanvas(canvas);
    const preprocessedCrop   = preprocessCanvas(croppedCanvas);

    // ── 1. BarcodeDetector nativo (zero-custo, usa ML Kit no Android) ──
    if (overlayText) overlayText.textContent = 'Verificando código de barras...';
    let found = await tryNativeBarcodeDetector(canvas)
             || await tryNativeBarcodeDetector(croppedCanvas);
    if (found) {
      console.log('[AutoTag] BarcodeDetector nativo:', found);
      suggestions.push(found);
    }

    // ── 2. ZXing com e sem pré-processamento ──
    if (!found) {
      if (overlayText) overlayText.textContent = 'Lendo código de barras (ZXing)...';
      found = await tryZXing(preprocessedCrop)
           || await tryZXing(croppedCanvas)
           || await tryZXing(preprocessedFull)
           || await tryZXing(canvas);
      if (found) {
        console.log('[AutoTag] ZXing:', found);
        suggestions.push(found);
      }
    }

    // ── 3. Tesseract OCR para números impressos sem código de barras ──
    if (!found && isOcrReady) {
      if (overlayText) overlayText.textContent = 'Lendo números via OCR...';
      found = await tryTesseract(preprocessedCrop)
           || await tryTesseract(croppedCanvas)
           || await tryTesseract(preprocessedFull);
      if (found) {
        console.log('[AutoTag] Tesseract OCR:', found);
        suggestions.push(found);
      }
    }

    const uniqueSuggestions = [...new Set(suggestions)];
    renderSuggestions(uniqueSuggestions, true);

    if (uniqueSuggestions.length > 0) {
      showToast(`${uniqueSuggestions.length} patrimônio(s) detectado(s).`);
    } else {
      showToast('Nenhum código ou patrimônio detectado.');
    }
  } catch (err) {
    console.error('Erro na análise:', err);
    showToast('Erro ao executar análise.');
  } finally {
    if (btnAi) {
      btnAi.disabled = false;
      btnAi.innerHTML = originalHtml;
    }
    if (overlay) overlay.classList.remove('show');
  }
}

export function renderSuggestions(suggestions, autoSelect = true) {
  const container = document.getElementById('ai-suggestions-container');
  const chipsWrap = document.getElementById('ai-suggestions-chips');
  if (!container || !chipsWrap) return;

  chipsWrap.innerHTML = '';
  if (!suggestions || suggestions.length === 0) {
    container.style.display = 'none';
    return;
  }

  if (suggestions.length <= 1) {
    container.style.display = 'none';
    if (autoSelect && suggestions.length === 1) applySuggestion(suggestions[0]);
    return;
  }

  container.style.display = 'block';
  suggestions.forEach(suggestion => {
    const chip = document.createElement('div');
    chip.className = 'suggestion-chip';
    chip.dataset.value = suggestion;
    chip.textContent = suggestion;
    chip.addEventListener('click', () => applySuggestion(suggestion));
    chipsWrap.appendChild(chip);
  });

  if (autoSelect && suggestions.length > 0) applySuggestion(suggestions[0]);
}

export function applySuggestion(num) {
  const current = tagRename.value.trim();
  const match = current.match(/\b\d{5,}\b/);
  if (match) {
    tagRename.value = current.replace(match[0], num);
  } else {
    tagRename.value = (current + ' ' + num).trim();
  }
  window.dispatchEvent(new CustomEvent('app:change'));

  document.querySelectorAll('#ai-suggestions-chips .suggestion-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.value === num);
  });
}
