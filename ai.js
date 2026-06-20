// ai.js
import { canvas, tagRename, showToast, state } from './state.js';

const AI_MODE_KEY = 'img_tagger_ai_mode';

let lfmModel = null;
let lfmProcessor = null;
let RawImage = null;
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
  
  if (active) {
    if (!navigator.gpu) {
      showToast('Aviso: Seu navegador não suporta WebGPU. A IA usará o processamento em CPU (WASM), o que será mais lento.');
    }
    if (!isAiModelReady) {
      loadAiModel();
    }
  } else {
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
  
  if (active) {
    if (!navigator.gpu) {
      showToast('Aviso: Seu navegador não suporta WebGPU. A IA usará o processamento em CPU (WASM), o que será mais lento.');
    }
    if (!isAiModelReady) {
      loadAiModel();
    }
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
  warningText.innerHTML = '⚠️ <strong>Atenção:</strong> Inicializando leitor de código de barras e modelo LFM2.5 VL local (~300MB). Não feche o navegador.';

  const filesContainer = document.getElementById('ai-files-container');
  if (filesContainer) filesContainer.innerHTML = '';
  
  const activeDownloads = {};
  let lastGlobalPercent = 0;

  try {
    // 1. Carrega leitor de código de barras (ZXing)
    statusText.innerHTML = 'Carregando decodificador de código de barras... <span>10%</span>';
    progressBar.style.width = '10%';
    percentText.textContent = '10%';
    const zxingModule = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
    barcodeReader = new zxingModule.BrowserMultiFormatReader();

    // 2. Carrega motor LFM2.5 VL 450M (Transformers.js)
    statusText.innerHTML = 'Carregando modelo LFM2.5 VL 450M... <span>20%</span>';
    progressBar.style.width = '20%';
    percentText.textContent = '20%';
    
    const module = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0');
    const { AutoProcessor, AutoModelForImageTextToText, env } = module;
    RawImage = module.RawImage;

    // Desativa multi-threading para evitar problemas de SharedArrayBuffer / CORS no servidor local
    env.backends.onnx.wasm.numThreads = 1;

    const handleProgress = (data) => {
      if (!data.file) return;
      const filename = data.file.substring(data.file.lastIndexOf('/') + 1) || data.file;

      if (!activeDownloads[data.file]) {
        activeDownloads[data.file] = {
          name: filename,
          progress: 0,
          status: 'initiate'
        };
      }

      if (data.status === 'progress') {
        activeDownloads[data.file].progress = data.progress;
        activeDownloads[data.file].status = 'progress';
      } else if (data.status === 'done' || data.status === 'ready') {
        activeDownloads[data.file].progress = 100;
        activeDownloads[data.file].status = 'done';
      }

      if (filesContainer) {
        let row = filesContainer.querySelector(`[data-file="${CSS.escape(data.file)}"]`);
        if (!row) {
          row = document.createElement('div');
          row.className = 'ai-file-row';
          row.setAttribute('data-file', data.file);
          row.innerHTML = `
            <div class="ai-file-name" title="${data.file}">${filename}</div>
            <div class="ai-file-progress-bg">
              <div class="ai-file-progress-bar" style="width: 0%;"></div>
            </div>
            <div class="ai-file-percent">0%</div>
          `;
          filesContainer.appendChild(row);
        }

        const fileBar = row.querySelector('.ai-file-progress-bar');
        const filePct = row.querySelector('.ai-file-percent');
        const pct = Math.round(activeDownloads[data.file].progress);
        if (fileBar) fileBar.style.width = `${pct}%`;
        if (filePct) filePct.textContent = `${pct}%`;
      }

      const files = Object.values(activeDownloads);
      if (files.length > 0) {
        const totalSum = files.reduce((sum, f) => sum + f.progress, 0);
        const avgProgress = totalSum / files.length;
        const globalPercent = Math.round(20 + (avgProgress * 0.8));
        if (globalPercent > lastGlobalPercent) {
          lastGlobalPercent = globalPercent;
        }
        progressBar.style.width = `${lastGlobalPercent}%`;
        percentText.textContent = `${lastGlobalPercent}%`;

        const downloadingCount = files.filter(f => f.progress < 100).length;
        if (downloadingCount > 0) {
          statusText.innerHTML = `Baixando modelo IA (${downloadingCount} arquivo(s) ativo(s))... <span>${lastGlobalPercent}%</span>`;
        } else {
          statusText.innerHTML = `Arquivos carregados. Inicializando... <span>${lastGlobalPercent}%</span>`;
        }
      }
    };

    const modelId = 'LiquidAI/LFM2.5-VL-450M-ONNX';

    try {
      console.log('[AI Model] Carregando LFM2.5 com WebGPU...');
      lfmModel = await AutoModelForImageTextToText.from_pretrained(modelId, {
        device: 'webgpu',
        dtype: {
          vision_encoder: 'fp16',
          embed_tokens: 'fp16',
          decoder_model_merged: 'q4',
        },
        progress_callback: handleProgress
      });
      lfmProcessor = await AutoProcessor.from_pretrained(modelId, {
        progress_callback: handleProgress
      });
    } catch (webGpuErr) {
      console.warn("[AI Model] Falha no WebGPU, tentando fallback para WASM...", webGpuErr.message, webGpuErr.stack);
      statusText.innerHTML = 'WebGPU incompatível. Iniciando em modo WASM... <span>20%</span>';
      
      lfmModel = await AutoModelForImageTextToText.from_pretrained(modelId, {
        device: 'wasm',
        dtype: {
          vision_encoder: 'q4',
          embed_tokens: 'fp16',
          decoder_model_merged: 'q4',
        },
        progress_callback: handleProgress
      });
      lfmProcessor = await AutoProcessor.from_pretrained(modelId, {
        progress_callback: handleProgress
      });
    }

    isAiModelReady = true;
    window.isAiModelReady = true;
    isDownloading = false;
    progressBar.style.width = '100%';
    percentText.textContent = '100%';
    title.textContent = '🤖 Leitores Prontos!';
    statusText.textContent = 'Modelos de leitura e LFM2.5 VL carregados com sucesso.';
    warningText.style.display = 'none';
    
    setTimeout(() => {
      panel.classList.remove('show');
    }, 2500);
    
  } catch (err) {
    console.error('Erro crítico ao inicializar motores:', err.message, err.stack);
    isAiModelReady = !!barcodeReader;
    if (isAiModelReady) {
      window.isAiModelReady = true;
    }
    isDownloading = false;
    title.textContent = isAiModelReady ? '🤖 Apenas Leitor Ativo' : '❌ Falha ao Inicializar';
    statusText.textContent = isAiModelReady 
      ? 'Falha ao carregar IA (requer WebGPU), mas leitor de código de barras está pronto.'
      : 'Erro ao baixar ou carregar os modelos locais.';
    warningText.style.display = 'none';
    progressBar.style.background = isAiModelReady ? '#ffa726' : '#c62828';
    progressBar.style.width = '100%';
    showToast(isAiModelReady ? 'Apenas o leitor de código de barras está disponível.' : 'Erro ao inicializar os leitores.');
    setTimeout(() => {
      panel.classList.remove('show');
    }, isAiModelReady ? 4000 : 5000);
  }
}

export async function runAiAutoTag() {
  if (!barcodeReader) {
    showToast('Aguarde o carregamento do leitor de código de barras...');
    return;
  }
  
  const btnAi = document.getElementById('btn-trigger-ai');
  if (btnAi.disabled) return;
  
  btnAi.disabled = true;
  const originalHtml = btnAi.innerHTML;
  btnAi.innerHTML = '<span>🤖</span> Lendo códigos...';

  const overlay = document.getElementById('ai-inference-overlay');
  const overlayText = document.getElementById('ai-inference-text');
  
  if (overlay) {
    if (overlayText) overlayText.textContent = 'Processando imagem...';
    overlay.classList.add('show');
  }
  
  try {
    let tagFound = null;
    
    // ── PASSO 1: Tenta Ler Código de Barras / QR Code ──
    try {
      if (overlayText) overlayText.textContent = 'Buscando códigos de barras / QR Code...';
      console.log('[Scanner] Tentando detectar código de barras/QR...');
      const result = await barcodeReader.decodeFromCanvasElement(canvas);
      const text = result.getText();
      if (text) {
        const match = text.match(/\d{5,}/);
        if (match) {
          tagFound = match[0];
          console.log('[Scanner] Patrimônio encontrado via código de barras:', tagFound);
        }
      }
    } catch (barcodeErr) {
      console.log('[Scanner] Nenhum código de barras/QR detectado.');
    }
    
    // ── PASSO 2: Fallback para LFM2.5-VL ──
    if (!tagFound) {
      if (isAiModelReady && lfmModel && lfmProcessor && RawImage) {
        btnAi.innerHTML = '<span>🤖</span> Lendo com IA...';
        console.log('[AI] Enviando imagem para LFM2.5 VL 450M...');
        if (overlayText) overlayText.textContent = 'Preparando imagem para IA...';
        
        const rawImage = await RawImage.read(canvas);
        
        try {
          if (overlayText) overlayText.textContent = 'IA: Procurando número de patrimônio...';
          const question = 'Identify the asset tag number containing 5 or more digits in the image. Respond ONLY with the asset number and nothing else.';
          console.log(`[AI] Perguntando: "${question}"`);
          
          const messages = [
            { role: 'user', content: `<image>\n${question}` }
          ];
          const prompt = lfmProcessor.apply_chat_template(messages, { add_generation_prompt: true });
          const inputs = await lfmProcessor(rawImage, prompt, { add_special_tokens: false });
          
          const outputs = await lfmModel.generate({
            ...inputs,
            max_new_tokens: 64,
            do_sample: false
          });
          
          const promptLength = inputs.input_ids.dims[1];
          const newTokens = Array.from(outputs.data).slice(promptLength);
          const ans = lfmProcessor.batch_decode([newTokens], { skip_special_tokens: true })[0].trim();
          
          console.log(`[AI] Resposta da IA:`, ans);
          
          const match = ans.match(/\d{5,}/);
          if (match) {
            tagFound = match[0];
          }
        } catch (vqaErr) {
          console.warn(`[AI] Falha ao processar pergunta da IA:`, vqaErr);
        }
      } else if (isDownloading) {
        showToast('Aviso: Código de barras não detectado. A IA ainda está carregando...');
      }
    }
    
    // ── PASSO 3: Aplica o resultado ──
    if (tagFound) {
      tagRename.value = (tagRename.value.trim() + ' ' + tagFound).trim();
      window.dispatchEvent(new CustomEvent('app:change'));
      showToast(`Patrimônio detectado: ${tagFound}`);
    } else if (!isAiModelReady && isDownloading) {
      // Já mostrou toast informando do download da IA
    } else {
      showToast('Nenhum código de barras ou número de patrimônio (5+ dígitos) detectado.');
    }
  } catch (err) {
    console.error('Erro na análise automática:', err);
    showToast('Erro ao executar análise.');
  } finally {
    btnAi.disabled = false;
    btnAi.innerHTML = originalHtml;
    if (overlay) {
      overlay.classList.remove('show');
    }
  }
}
