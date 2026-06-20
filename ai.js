// ai.js
import { canvas, ctx, tagRename, showToast, state } from './state.js';

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

async function rotateCanvasDegrees(degrees) {
  if (degrees !== 90 && degrees !== 180 && degrees !== 270) return;
  
  const angle = (degrees * Math.PI) / 180;
  const w = canvas.width;
  const h = canvas.height;
  
  // Criar canvas temporário para guardar conteúdo original
  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  const tempCtx = temp.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);
  
  // Redimensionar dimensões do canvas principal
  if (degrees === 90 || degrees === 270) {
    canvas.width = h;
    canvas.height = w;
  } else {
    canvas.width = w;
    canvas.height = h;
  }
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(angle);
  ctx.drawImage(temp, -w / 2, -h / 2);
  ctx.restore();
  
  // Criar novo objeto Image para atualizar o estado
  const newImg = new Image();
  await new Promise((resolve) => {
    newImg.onload = resolve;
    newImg.src = canvas.toDataURL('image/jpeg');
  });
  state.currentImg = newImg;
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
  
  // Converter para tons de cinza e computar o gradiente horizontal (densidade de bordas verticais, ex: códigos de barra)
  const grad = new Float32Array(targetSize * targetSize);
  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize - 1; x++) {
      const idx1 = (y * targetSize + x) * 4;
      const idx2 = (y * targetSize + (x + 1)) * 4;
      
      const g1 = (data[idx1] + data[idx1+1] + data[idx1+2]) / 3;
      const g2 = (data[idx2] + data[idx2+1] + data[idx2+2]) / 3;
      
      grad[y * targetSize + x] = Math.abs(g1 - g2);
    }
  }
  
  // Mapeamento de energia em uma grade 15x15
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
      const endY = Math.floor((r + 1) * cellSize);
      const startX = Math.floor(c * cellSize);
      const endX = Math.floor((c + 1) * cellSize);
      
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
  
  // Limiarizar células vizinhas para obter a região de interesse
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
  
  // Margem de segurança de 1 célula
  const pad = 1;
  const finalMinR = Math.max(0, minR - pad);
  const finalMaxR = Math.min(gridSize - 1, maxR + pad);
  const finalMinC = Math.max(0, minC - pad);
  const finalMaxC = Math.min(gridSize - 1, maxC + pad);
  
  const x = finalMinC * cellSize * scaleX;
  const y = finalMinR * cellSize * scaleY;
  const w = (finalMaxC - finalMinC + 1) * cellSize * scaleX;
  const h = (finalMaxR - finalMinR + 1) * cellSize * scaleY;
  
  // Cria canvas recortado
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = w;
  croppedCanvas.height = h;
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCtx.drawImage(srcCanvas, x, y, w, h, 0, 0, w, h);
  
  console.log(`[AutoCrop] Recortou ROI de [${x}, ${y}] com tamanho [${w}x${h}]`);
  return { croppedCanvas, x, y, w, h };
}

export async function runAiAutoTag() {
  if (!barcodeReader) {
    showToast('Aguarde o carregamento do leitor de código de barras...');
    return;
  }
  
  const btnAi = document.getElementById('btn-trigger-ai');
  let originalHtml = '';
  if (btnAi) {
    if (btnAi.disabled) return;
    btnAi.disabled = true;
    originalHtml = btnAi.innerHTML;
    btnAi.innerHTML = '<span>🤖</span> Analisando...';
  }

  const overlay = document.getElementById('ai-inference-overlay');
  const overlayText = document.getElementById('ai-inference-text');
  
  if (overlay) {
    if (overlayText) overlayText.textContent = 'Processando imagem...';
    overlay.classList.add('show');
  }
  
  const suggestions = [];

  try {
    // Limpa as sugestões anteriores no DOM
    const container = document.getElementById('ai-suggestions-container');
    const chipsWrap = document.getElementById('ai-suggestions-chips');
    if (container) container.style.display = 'none';
    if (chipsWrap) chipsWrap.innerHTML = '';

    const active = readAiMode();

    // ── PASSO 0: Orientação de imagem via IA ──
    if (active && isAiModelReady && lfmModel && lfmProcessor && RawImage) {
      if (overlayText) overlayText.textContent = 'IA: Verificando orientação...';
      const rawImgOri = await RawImage.read(canvas);
      
      try {
        const orientationQuestion = "Examine the text/barcode in the image. Is it oriented horizontally and right-side up? If it is rotated, respond with the clockwise rotation angle in degrees (90, 180, or 270) to correct it. If it is already correct, respond with '0'. Respond ONLY with one of: '0', '90', '180', '270' and nothing else.";
        const messages = [
          { role: 'user', content: `<image>\n${orientationQuestion}` }
        ];
        const prompt = lfmProcessor.apply_chat_template(messages, { add_generation_prompt: true });
        const inputs = await lfmProcessor(rawImgOri, prompt, { add_special_tokens: false });
        
        const outputs = await lfmModel.generate({
          ...inputs,
          max_new_tokens: 16,
          do_sample: false
        });
        
        const promptLength = inputs.input_ids.dims[1];
        const newTokens = Array.from(outputs.data).slice(promptLength);
        const ans = lfmProcessor.batch_decode([newTokens], { skip_special_tokens: true })[0].trim();
        console.log(`[AutoTag] Resposta de orientação IA:`, ans);
        
        const matchRotation = ans.match(/90|180|270/);
        if (matchRotation) {
          const rotationDegrees = parseInt(matchRotation[0], 10);
          console.log(`[AutoTag] Rotacionando imagem em ${rotationDegrees} graus...`);
          if (overlayText) overlayText.textContent = `IA: Ajustando rotação (${rotationDegrees}°)...`;
          await rotateCanvasDegrees(rotationDegrees);
          window.dispatchEvent(new CustomEvent('app:change'));
        }
      } catch (oriErr) {
        console.warn('[AutoTag] Erro ao detectar orientação via IA:', oriErr);
      }
    }

    // ── PASSO 1: Tenta Ler Código de Barras / QR Code (com Zoom ROI) ──
    let decodedBarcode = false;
    let croppedInfo = null;
    let croppedCanvas = null;

    try {
      console.log('[AutoTag] Analisando densidade de bordas para recorte (zoom)...');
      croppedInfo = detectAndCropROI(canvas);
      croppedCanvas = croppedInfo.croppedCanvas;

      if (overlayText) overlayText.textContent = 'Buscando códigos de barras na área recortada...';
      const result = await barcodeReader.decodeFromCanvasElement(croppedCanvas);
      const text = result.getText();
      if (text) {
        const match = text.match(/\d{5,}/);
        if (match) {
          console.log('[AutoTag] Código de barras detectado no crop:', match[0]);
          suggestions.push(match[0]);
          decodedBarcode = true;
        }
      }
    } catch (cropErr) {
      console.log('[AutoTag] Sem códigos na área recortada. Tentando imagem completa...');
    }

    if (!decodedBarcode) {
      try {
        if (overlayText) overlayText.textContent = 'Buscando códigos de barras na imagem inteira...';
        const result = await barcodeReader.decodeFromCanvasElement(canvas);
        const text = result.getText();
        if (text) {
          const match = text.match(/\d{5,}/);
          if (match) {
            console.log('[AutoTag] Código de barras detectado na imagem completa:', match[0]);
            suggestions.push(match[0]);
          }
        }
      } catch (barcodeErr) {
        console.log('[AutoTag] Nenhum código de barras/QR detectado.');
      }
    }
    
    // ── PASSO 2: Fallback / Sequência para LFM2.5-VL ──
    if (active && isAiModelReady && lfmModel && lfmProcessor && RawImage) {
      // Se tiver crop, usa para a IA ler também (melhora resolução do texto distante)
      const targetCanvas = croppedCanvas || canvas;
      if (overlayText) overlayText.textContent = 'Preparando imagem para IA...';
      const rawImage = await RawImage.read(targetCanvas);
      
      try {
        if (overlayText) overlayText.textContent = 'IA: Analisando número de patrimônio...';
        const question = 'Identify the asset tag number containing 5 or more digits in the image. If there are no readable numbers or you are not confident, respond ONLY with "NONE". Respond ONLY with the asset number or "NONE" and nothing else.';
        console.log(`[AutoTag] Consultando IA: "${question}"`);
        
        const messages = [
          { role: 'user', content: `<image>\n${question}` }
        ];
        const prompt = lfmProcessor.apply_chat_template(messages, { add_generation_prompt: true });
        const inputs = await lfmProcessor(rawImage, prompt, { add_special_tokens: false });
        
        const outputs = await lfmModel.generate({
          ...inputs,
          max_new_tokens: 32,
          do_sample: false
        });
        
        const promptLength = inputs.input_ids.dims[1];
        const newTokens = Array.from(outputs.data).slice(promptLength);
        const ans = lfmProcessor.batch_decode([newTokens], { skip_special_tokens: true })[0].trim();
        
        console.log(`[AutoTag] IA resposta:`, ans);
        
        if (ans.toUpperCase().includes('NONE')) {
          console.log('[AutoTag] IA indicou ausência ou baixa confiança de números ("NONE").');
        } else {
          const match = ans.match(/\b\d{5,}\b/);
          if (match) {
            console.log('[AutoTag] Patrimônio detectado via IA (Confiança alta):', match[0]);
            suggestions.push(match[0]);
          } else {
            console.log('[AutoTag] Resposta da IA não corresponde ao formato esperado (Regex inválido):', ans);
          }
        }
      } catch (vqaErr) {
        console.warn(`[AutoTag] Falha ao processar pergunta da IA:`, vqaErr);
      }
    } else if (active && isDownloading) {
      showToast('Aviso: O modelo de IA ainda está carregando no fundo.');
    }
    
    // ── PASSO 3: Processa as sugestões encontradas ──
    const uniqueSuggestions = [...new Set(suggestions)];
    renderSuggestions(uniqueSuggestions, true);

    if (uniqueSuggestions.length > 0) {
      showToast(`Análise concluída. ${uniqueSuggestions.length} patrimônio(s) sugerido(s).`);
    } else {
      showToast('Nenhum código de barras ou patrimônio detectado.');
    }
  } catch (err) {
    console.error('Erro na análise automática:', err);
    showToast('Erro ao executar análise.');
  } finally {
    if (btnAi) {
      btnAi.disabled = false;
      btnAi.innerHTML = originalHtml;
    }
    if (overlay) {
      overlay.classList.remove('show');
    }
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

  // Só mostra em formato de chips se houver mais de uma sugestão
  if (suggestions.length <= 1) {
    container.style.display = 'none';
    if (autoSelect && suggestions.length === 1) {
      applySuggestion(suggestions[0]);
    }
    return;
  }

  container.style.display = 'block';
  
  suggestions.forEach(suggestion => {
    const chip = document.createElement('div');
    chip.className = 'suggestion-chip';
    chip.dataset.value = suggestion;
    chip.textContent = suggestion;
    
    chip.addEventListener('click', () => {
      applySuggestion(suggestion);
    });
    
    chipsWrap.appendChild(chip);
  });

  if (autoSelect && suggestions.length > 0) {
    applySuggestion(suggestions[0]);
  }
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

  const chips = document.querySelectorAll('#ai-suggestions-chips .suggestion-chip');
  chips.forEach(c => {
    if (c.dataset.value === num) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
}
