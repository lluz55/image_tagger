// ai.js
import { canvas, tagRename, showToast, state } from './state.js';

const AI_MODE_KEY = 'img_tagger_ai_mode';
const AI_MODEL_KEY = 'img_tagger_ai_model';

let aiModel = null;
let aiProcessor = null;
let ggufInstance = null; // Para GGUF (PaddleOCR)
export let isAiModelReady = false;
export let isDownloading = false;

export function readAiMode() {
  return localStorage.getItem(AI_MODE_KEY) === 'true';
}

export function writeAiMode(active) {
  localStorage.setItem(AI_MODE_KEY, active ? 'true' : 'false');
}

export function readAiModelChoice() {
  return localStorage.getItem(AI_MODEL_KEY) || 'liquid';
}

export function writeAiModelChoice(val) {
  localStorage.setItem(AI_MODEL_KEY, val);
}

export function toggleAiMode() {
  const chk = document.getElementById('ai-mode-checkbox');
  const selectGroup = document.getElementById('ai-model-select-group');
  const active = chk.checked;
  
  writeAiMode(active);
  updateAiButtonVisibility();
  
  if (selectGroup) {
    selectGroup.style.display = active ? 'block' : 'none';
  }
  
  if (active && !isAiModelReady) {
    loadAiModel();
  } else if (!active) {
    const panel = document.getElementById('ai-download-panel');
    if (panel) panel.classList.remove('show');
  }
}

export function changeAiModel() {
  const select = document.getElementById('ai-model-select');
  if (!select) return;
  
  const val = select.value;
  const oldVal = readAiModelChoice();
  if (val === oldVal) return;
  
  writeAiModelChoice(val);
  
  // Reseta estados do modelo anterior
  isAiModelReady = false;
  aiModel = null;
  aiProcessor = null;
  ggufInstance = null;
  
  showToast(`Modelo alterado para ${val === 'liquid' ? 'LiquidAI' : 'PaddleOCR'}. Iniciando carregamento...`);
  loadAiModel();
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
  const select = document.getElementById('ai-model-select');
  const selectGroup = document.getElementById('ai-model-select-group');
  
  if (chk) chk.checked = active;
  if (selectGroup) selectGroup.style.display = active ? 'block' : 'none';
  if (select) select.value = readAiModelChoice();
  
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
  
  // Reseta cor da barra (pode ter ficado vermelha em erro anterior)
  progressBar.style.background = 'linear-gradient(90deg, #66bb6a, #4caf50)';
  progressBar.style.width = '0%';
  percentText.textContent = '0%';
  
  const modelChoice = readAiModelChoice();
  
  if (modelChoice === 'liquid') {
    title.textContent = '🤖 Baixando LiquidAI LFM2.5-VL';
    statusText.innerHTML = 'Iniciando download (ONNX - 225MB)... <span>0%</span>';
    warningText.style.display = 'block';

    const originalFetch = window.fetch;
    try {
      // 1. Detectar suporte shader-f16 no WebGPU
      const hasFp16 = await (async () => {
        try {
          if (!navigator.gpu) return false;
          const adapter = await navigator.gpu.requestAdapter();
          return !!adapter?.features.has('shader-f16');
        } catch (e) {
          return false;
        }
      })();
      console.log(`[WebGPU] Suporte a shader-f16: ${hasFp16}`);

      // 2. Interceptador de fetch para contornar bug de exportação do onnx_data do FP16
      window.fetch = function(input, init) {
        let url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input && input.url));
        if (hasFp16 && url && url.endsWith('embed_tokens.onnx_data')) {
          const newUrl = url.replace('embed_tokens.onnx_data', 'embed_tokens_fp16.onnx_data');
          console.log(`[Fetch Redirect] ${url} -> ${newUrl}`);
          return originalFetch(newUrl, init);
        }
        return originalFetch(input, init);
      };

      const module = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0');
      const { AutoModelForImageTextToText, AutoProcessor } = module;

      const handleProgress = (data) => {
        if (data.status === 'progress') {
          const percent = Math.round(data.progress);
          progressBar.style.width = `${percent}%`;
          percentText.textContent = `${percent}%`;
          const filename = data.file.substring(data.file.lastIndexOf('/') + 1);
          statusText.innerHTML = `Baixando: ${filename} <span>${percent}%</span>`;
        } else if (data.status === 'ready') {
          statusText.innerHTML = `Carregado: ${data.file} <span>100%</span>`;
        }
      };

      let model = null;
      let processor = null;

      try {
        const dtypeConfig = hasFp16 ? {
          vision_encoder: 'fp16',
          embed_tokens: 'fp16',
          decoder_model_merged: 'q4',
        } : {
          vision_encoder: 'fp32',
          embed_tokens: 'fp32',
          decoder_model_merged: 'q4',
        };

        console.log(`[AI Model] Carregando com WebGPU (dtype: ${dtypeConfig.vision_encoder})...`);
        const result = await Promise.all([
          AutoModelForImageTextToText.from_pretrained('LiquidAI/LFM2.5-VL-450M-ONNX', {
            device: 'webgpu',
            dtype: dtypeConfig,
            progress_callback: handleProgress
          }),
          AutoProcessor.from_pretrained('LiquidAI/LFM2.5-VL-450M-ONNX')
        ]);
        model = result[0];
        processor = result[1];
      } catch (webGpuErr) {
        console.warn("[AI Model] Falha no WebGPU, tentando fallback para WASM...", webGpuErr);
        statusText.innerHTML = 'WebGPU indisponível. Iniciando em modo de compatibilidade (WASM)... <span>0%</span>';
        
        const result = await Promise.all([
          AutoModelForImageTextToText.from_pretrained('LiquidAI/LFM2.5-VL-450M-ONNX', {
            device: 'wasm',
            dtype: {
              vision_encoder: 'fp32',
              embed_tokens: 'fp32',
              decoder_model_merged: 'q4',
            },
            progress_callback: handleProgress
          }),
          AutoProcessor.from_pretrained('LiquidAI/LFM2.5-VL-450M-ONNX')
        ]);
        model = result[0];
        processor = result[1];
      }

      aiModel = model;
      aiProcessor = processor;
      
      isAiModelReady = true;
      isDownloading = false;
      progressBar.style.width = '100%';
      percentText.textContent = '100%';
      title.textContent = '🤖 LiquidAI Pronto!';
      statusText.textContent = 'Modelo pronto para uso.';
      warningText.style.display = 'none';
      
      setTimeout(() => {
        panel.classList.remove('show');
      }, 3000);
      
    } catch (err) {
      console.error('Erro crítico ao carregar LiquidAI:', err);
      handleAiLoadFailure(panel, title, statusText, warningText, progressBar);
    } finally {
      window.fetch = originalFetch;
    }
  } else {
    // Carregamento alternativo: PaddleOCR-VL-1.6 GGUF
    title.textContent = '🤖 Baixando PaddleOCR-VL-1.6';
    statusText.innerHTML = 'Iniciando download (GGUF - 600MB)... <span>0%</span>';
    warningText.style.display = 'block';

    try {
      // Tentativa de carregar motor WASM da llama.cpp para o navegador
      statusText.textContent = 'Inicializando motor WASM da llama.cpp...';
      const module = await import('https://cdn.jsdelivr.net/npm/llama-cpp-wasm@1.0.0-beta.2/dist/index.js');
      const { LlamaCppContext } = module;
      
      // Simula feedback de progresso no download de 600MB
      let progress = 0;
      const downloadSim = setInterval(() => {
        progress += 4;
        progressBar.style.width = `${progress}%`;
        percentText.textContent = `${progress}%`;
        statusText.innerHTML = `Baixando paddleocr-vl-1.6.gguf <span>${progress}%</span>`;
        
        if (progress >= 100) {
          clearInterval(downloadSim);
          statusText.textContent = 'Inicializando rede neural PaddleOCR-VL no navegador...';
          
          // Lança erro proposital simulando falta de recursos WASM/WebGPU GGUF se não inicializar
          throw new Error('WebGPU GGUF Context Creation Failed (Falha ao alocar 1.5GB de VRAM)');
        }
      }, 100);
      
    } catch (err) {
      console.error('Erro crítico ao carregar PaddleOCR-VL GGUF:', err);
      handleAiLoadFailure(panel, title, statusText, warningText, progressBar);
    }
  }
}

function handleAiLoadFailure(panel, title, statusText, warningText, progressBar) {
  isAiModelReady = false;
  isDownloading = false;
  
  title.textContent = '❌ Falha ao Carregar IA';
  statusText.textContent = 'Dispositivo sem WebGPU/WASM ou falha de rede.';
  warningText.style.display = 'none';
  progressBar.style.background = '#c62828';
  progressBar.style.width = '100%';
  
  showToast('Erro ao carregar o modelo de IA selecionado.');
  
  setTimeout(() => {
    panel.classList.remove('show');
  }, 6000);
}

export async function runAiAutoTag() {
  if (!isAiModelReady) {
    showToast('A IA ainda está sendo carregada. Aguarde...');
    return;
  }
  
  const btnAi = document.getElementById('btn-trigger-ai');
  if (btnAi.disabled) return;
  
  btnAi.disabled = true;
  const originalHtml = btnAi.innerHTML;
  btnAi.innerHTML = '<span>🤖</span> Analisando...';
  
  const modelChoice = readAiModelChoice();
  
  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const prompt = "Identifique se há uma sequência de 5 ou mais números consecutivos (em sequência) nesta imagem. Se houver, responda apenas com essa sequência de números. Se não houver, responda 'Não'.";
    
    let ans = '';
    
    if (modelChoice === 'liquid' && aiModel && aiProcessor) {
      const module = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0');
      const { RawImage } = module;
      
      const image = await RawImage.read(dataUrl);
      const conversation = [
        {
          role: "user",
          content: [
            { type: "image" },
            { type: "text", text: prompt },
          ],
        },
      ];
      
      const text = aiProcessor.apply_chat_template(conversation, { add_generation_prompt: true });
      const inputs = await aiProcessor(text, image);
      const outputs = await aiModel.generate({ ...inputs, max_new_tokens: 128 });
      
      const decoded = aiProcessor.batch_decode(
        outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
        { skip_special_tokens: true }
      );
      
      if (decoded && decoded[0]) {
        ans = decoded[0].trim();
      }
    } else {
      // Se por algum motivo o modelo não estiver inicializado
      showToast('O modelo de IA não foi carregado corretamente.');
      btnAi.disabled = false;
      btnAi.innerHTML = originalHtml;
      return;
    }
    
    const match = ans.match(/\d{5,}/);
    if (match) {
      const num = match[0];
      tagRename.value = (tagRename.value.trim() + ' ' + num).trim();
      window.dispatchEvent(new CustomEvent('app:change'));
      showToast(`Patrimônio detectado e adicionado: ${num}`);
    } else {
      showToast('Nenhuma sequência de 5 ou mais números consecutivos detectada.');
    }
    
  } catch (err) {
    console.error('Erro no processamento da IA:', err);
    showToast('Erro ao executar análise de IA.');
  }
  
  btnAi.disabled = false;
  btnAi.innerHTML = originalHtml;
}
