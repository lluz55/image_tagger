// ai.js
import { canvas, tagRename, showToast, state } from './state.js';

const AI_MODE_KEY = 'img_tagger_ai_mode';

let donutPipeline = null;
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
  
  title.textContent = '🤖 Inicializando Leitor / IA';
  statusText.innerHTML = 'Carregando motores de leitura... <span>0%</span>';
  warningText.style.display = 'block';
  warningText.innerHTML = '⚠️ <strong>Atenção:</strong> Inicializando leitor de código de barras e modelo VQA local (~220MB). Não feche o navegador.';

  try {
    // 1. Carrega leitor de código de barras (ZXing)
    statusText.innerHTML = 'Carregando decodificador de código de barras... <span>10%</span>';
    progressBar.style.width = '10%';
    percentText.textContent = '10%';
    const zxingModule = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
    barcodeReader = new zxingModule.BrowserMultiFormatReader();

    // 2. Carrega motor Donut VQA (Transformers.js)
    statusText.innerHTML = 'Carregando modelo Donut DocVQA... <span>20%</span>';
    progressBar.style.width = '20%';
    percentText.textContent = '20%';
    
    const module = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0');
    const { pipeline } = module;

    const handleProgress = (data) => {
      if (data.status === 'progress') {
        const percent = Math.round(data.progress);
        const globalPercent = Math.round(20 + (percent * 0.75));
        progressBar.style.width = `${globalPercent}%`;
        percentText.textContent = `${globalPercent}%`;
        const filename = data.file.substring(data.file.lastIndexOf('/') + 1);
        statusText.innerHTML = `Baixando modelo IA: ${filename} <span>${globalPercent}%</span>`;
      } else if (data.status === 'ready') {
        statusText.innerHTML = `Carregado: ${data.file}`;
      }
    };

    try {
      console.log('[AI Model] Carregando Donut com WebGPU...');
      donutPipeline = await pipeline('document-question-answering', 'Xenova/donut-base-finetuned-docvqa', {
        device: 'webgpu',
        progress_callback: handleProgress
      });
    } catch (webGpuErr) {
      console.warn("[AI Model] Falha no WebGPU, tentando fallback para WASM...", webGpuErr);
      statusText.innerHTML = 'WebGPU incompatível. Iniciando em modo WASM... <span>20%</span>';
      
      donutPipeline = await pipeline('document-question-answering', 'Xenova/donut-base-finetuned-docvqa', {
        device: 'wasm',
        progress_callback: handleProgress
      });
    }

    isAiModelReady = true;
    isDownloading = false;
    progressBar.style.width = '100%';
    percentText.textContent = '100%';
    title.textContent = '🤖 Leitores Prontos!';
    statusText.textContent = 'Modelos de leitura e VQA carregados com sucesso.';
    warningText.style.display = 'none';
    
    setTimeout(() => {
      panel.classList.remove('show');
    }, 2500);
    
  } catch (err) {
    console.error('Erro crítico ao inicializar motores:', err);
    isAiModelReady = false;
    isDownloading = false;
    title.textContent = '❌ Falha ao Inicializar';
    statusText.textContent = 'Erro ao baixar ou carregar os modelos locais.';
    warningText.style.display = 'none';
    progressBar.style.background = '#c62828';
    progressBar.style.width = '100%';
    showToast('Erro ao inicializar os leitores.');
    setTimeout(() => {
      panel.classList.remove('show');
    }, 5000);
  }
}

export async function runAiAutoTag() {
  if (!isAiModelReady) {
    showToast('Aguarde o carregamento do modelo de leitura...');
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
    
    // ── PASSO 2: Fallback para Donut VQA ──
    if (!tagFound && donutPipeline) {
      btnAi.innerHTML = '<span>🤖</span> Lendo com IA...';
      console.log('[AI] Enviando imagem para Donut DocVQA...');
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      const questions = [
        'What is the asset tag or number?',
        'What is the serial number?',
        'What is the tag number?'
      ];
      
      for (const question of questions) {
        try {
          console.log(`[AI] Perguntando: "${question}"`);
          const result = await donutPipeline(dataUrl, question);
          if (result && result[0] && result[0].answer) {
            const ans = result[0].answer.trim();
            console.log(`[AI] Resposta para "${question}":`, ans);
            
            const match = ans.match(/\d{5,}/);
            if (match) {
              tagFound = match[0];
              break;
            }
          }
        } catch (vqaErr) {
          console.warn(`[AI] Falha ao processar pergunta "${question}":`, vqaErr);
        }
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
