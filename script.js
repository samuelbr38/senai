// ==========================================================
// SoLares Connect — Controle por olhar com detecção melhorada
// ==========================================================

// ===== ESTADO =====
let txt = '';
let scanIdx = 0;
let scanIv = null;
let scanSpeed = 1200;
let paused = false;
let toastTimer = null;
let currentScreen = 'home';

// Câmera
let camStream = null;
let faceMesh = null;
let mpCamera = null;
let cameraReady = false;

// Elementos da câmera
const camPreviewEl = document.getElementById('camPreview');
const camVideoEl = document.getElementById('camVideo');
const camOverlayEl = document.getElementById('camOverlay');
const camPreviewLabelEl = document.getElementById('camPreviewLabel');
let camOverlayCtx = null;

// Rastreamento do olhar
let gazeX = window.innerWidth / 2;
let gazeY = window.innerHeight / 2;
let smoothX = gazeX;
let smoothY = gazeY;
let gazeRafId = null;

// Detecção de rosto
let faceDetected = false;
let lastFaceSeenAt = 0;
const FACE_TIMEOUT = 800; // ms sem rosto → desativa seleção
let faceBox = null; // {x, y, w, h} em coords do vídeo

// Detecção de olho fechado
const EYE_CLOSED_THRESHOLD = 0.0115;
const EYE_OPEN_THRESHOLD = 0.0165;
let eyeIsClosed = false;
let eyeClosedSince = null;
const BLINK_DURATION = 1500; // 1.5s fechado = seleciona

// Detecção de língua pra fora
let tongueOutSince = null;
let tongueIsOut = false;
const TONGUE_DURATION = 1200; // 1.2s com língua fora = seleciona
let tongueRatioBaseline = null; // calibração adaptativa

// Foco
let focusedEl = null;
let focusStartTime = 0;

// Seleção ativa?
let selectionEnabled = true;

// Scroll automático
let scrollCooldown = 0;
let lastScrollDir = null;
const SCROLL_ZONE = 80; // px das bordas
const SCROLL_SPEED = 18; // px por frame
const SCROLL_COOLDOWN_MS = 700;

// Elementos DOM
const gazeBubbleEl = document.getElementById('gazeBubble');
const gazeRingFillEl = document.getElementById('gazeRingFill');
const gazeStatusEl = document.getElementById('gazeStatus');
const gazeDotEl = document.getElementById('gazeDot');
const gazeStatusTextEl = document.getElementById('gazeStatusText');
const gazeModeBtnEl = document.getElementById('gazeModeBtn');
const gazeToggleBtnEl = document.getElementById('gazeToggleBtn');
const camLoadingEl = document.getElementById('camLoading');

const phEl = document.getElementById('ph');
const outEl = document.getElementById('out');
const curEl = document.getElementById('cur');
const keyboardEl = document.getElementById('keyboard');
const quickPhrasesEl = document.getElementById('quickPhrases');
const modeBadgeEl = document.getElementById('modeBadge');
const modeLblEl = document.getElementById('modeLbl');
const scanBtnEl = document.getElementById('scanBtn');
const speedLblEl = document.getElementById('speedLbl');
const toastEl = document.getElementById('toast');
const currentGroupEl = document.getElementById('currentGroup');

const camDotEl = document.getElementById('camDot');
const camStatusTextEl = document.getElementById('camStatusText');
const faceDotEl = document.getElementById('faceDot');
const faceStatusTextEl = document.getElementById('faceStatusText');
const gestureDotEl = document.getElementById('gestureDot');
const gestureStatusTextEl = document.getElementById('gestureStatusText');

const RING_CIRCUMFERENCE = 2 * Math.PI * 46;

// ===== GRUPOS DE TECLAS =====
const KEY_GROUPS = [
  { name: 'Grupo 1: A - H', keys: ['A','B','C','D','E','F','G','H'] },
  { name: 'Grupo 2: I - P', keys: ['I','J','K','L','M','N','O','P'] },
  { name: 'Grupo 3: Q - X', keys: ['Q','R','S','T','U','V','W','X'] },
  { name: 'Grupo 4: Y - 4', keys: ['Y','Z','0','1','2','3','4'] },
  { name: 'Grupo 5: 5 - Ações', keys: ['5','6','7','8','9','ESPAÇO','⌫ APAGAR'] }
];
let currentGroupIdx = 0;

const QUICK_PHRASES = [
  'Sim', 'Não', 'Estou bem', 'Preciso de água',
  'Chame alguém', 'Obrigado', 'Ajuda', 'Estou com dor'
];

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================
window.addEventListener('DOMContentLoaded', async () => {
  gazeRingFillEl.style.strokeDasharray = RING_CIRCUMFERENCE;
  gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;

  buildQuickPhrases();

  // Setup canvas do preview
  camOverlayCtx = camOverlayEl.getContext('2d');

  await initCamera();
  startGazeLoop();
});

// ==========================================================
// CÂMERA
// ==========================================================
async function initCamera() {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 }
      },
      audio: false
    });

    camVideoEl.srcObject = camStream;
    await camVideoEl.play();

    // Ajusta o canvas ao tamanho do vídeo
    function syncCanvasSize() {
      if (camVideoEl.videoWidth) {
        camOverlayEl.width = camVideoEl.videoWidth;
        camOverlayEl.height = camVideoEl.videoHeight;
      }
    }
    camVideoEl.addEventListener('loadedmetadata', syncCanvasSize);
    setTimeout(syncCanvasSize, 500);

    if (typeof FaceMesh === 'undefined') {
      throw new Error('FaceMesh não carregado');
    }

    faceMesh = new FaceMesh({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onFaceResults);

    mpCamera = new Camera(camVideoEl, {
      onFrame: async () => await faceMesh.send({ image: camVideoEl }),
      width: 640,
      height: 480
    });
    mpCamera.start();

    cameraReady = true;
    camLoadingEl.classList.add('hidden');
    gazeBubbleEl.classList.add('active');
    setGazeStatus('active', 'Aguardando rosto...');
    camPreviewEl.classList.remove('hidden');
    camDotEl.className = 'status-dot active';
    camStatusTextEl.textContent = 'Câmera ativa';

  } catch (e) {
    console.error(e);
    camLoadingEl.classList.add('hidden');
    setGazeStatus('error', '⚠️ Câmera indisponível — use o toque');
    camPreviewEl.classList.add('hidden');
    camDotEl.className = 'status-dot error';
    camStatusTextEl.textContent = 'Câmera indisponível';
  }
}

function setGazeStatus(state, text) {
  gazeDotEl.className = 'gaze-dot ' + state;
  gazeStatusTextEl.textContent = text;
}

// ==========================================================
// PROCESSAMENTO DO ROSTO
// ==========================================================
function onFaceResults(results) {
  const now = Date.now();
  const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

  if (!hasFace) {
    faceDetected = false;
    faceBox = null;

    // Se passou muito tempo sem rosto, desativa seleção
    if (now - lastFaceSeenAt > FACE_TIMEOUT) {
      selectionEnabled = false;
      gazeBubbleEl.classList.add('disabled');
      setGazeStatus('warn', '👤 Nenhum rosto — seleção pausada');
      camPreviewEl.classList.add('no-face');
      camPreviewEl.classList.remove('face-detected');
      camPreviewLabelEl.textContent = 'Sem rosto';
      faceDotEl.className = 'status-dot warn';
      faceStatusTextEl.textContent = 'Rosto não detectado';
    }

    drawOverlay(null);
    return;
  }

  // Rosto detectado
  const wasDisabled = !selectionEnabled;
  faceDetected = true;
  lastFaceSeenAt = now;
  if (!selectionEnabled) {
    selectionEnabled = true;
    gazeBubbleEl.classList.remove('disabled');
    if (wasDisabled) setGazeStatus('active', 'Rastreamento ativo');
  }
  camPreviewEl.classList.remove('no-face');
  camPreviewEl.classList.add('face-detected');
  camPreviewLabelEl.textContent = '✓ Rosto detectado';
  faceDotEl.className = 'status-dot active';
  faceStatusTextEl.textContent = 'Rosto detectado';

  const lm = results.multiFaceLandmarks[0];

  // ===== CAIXA DA CABEÇA =====
  // Encontra min/max de todos os landmarks para criar bounding box
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // Adiciona margem
  const marginX = (maxX - minX) * 0.12;
  const marginY = (maxY - minY) * 0.12;
  faceBox = {
    x: Math.max(0, minX - marginX),
    y: Math.max(0, minY - marginY),
    w: Math.min(1, maxX + marginX) - Math.max(0, minX - marginX),
    h: Math.min(1, maxY + marginY) - Math.max(0, minY - marginY)
  };
  drawOverlay(faceBox);

  // ===== POSIÇÃO DO OLHAR =====
  const leftIris = lm[468] || lm[33];
  const rightIris = lm[473] || lm[263];
  const eyeCenterX = (leftIris.x + rightIris.x) / 2;
  const eyeCenterY = (leftIris.y + rightIris.y) / 2;

  const mirroredX = 1 - eyeCenterX;

  // Zona de sensibilidade ampliada para cobrir a tela
  const rangeX = 0.45;
  const rangeY = 0.38;
  const screenX = ((mirroredX - (0.5 - rangeX / 2)) / rangeX) * window.innerWidth;
  const screenY = ((eyeCenterY - (0.5 - rangeY / 2)) / rangeY) * window.innerHeight;

  // Suavização exponencial (mais suave)
  smoothX += (screenX - smoothX) * 0.18;
  smoothY += (screenY - smoothY) * 0.18;

  gazeX = Math.max(20, Math.min(window.innerWidth - 20, smoothX));
  gazeY = Math.max(20, Math.min(window.innerHeight - 20, smoothY));

  // ===== DETECÇÃO DE OLHO FECHADO =====
  const leftEyeDist = Math.abs(lm[159].y - lm[145].y);
  const rightEyeDist = Math.abs(lm[386].y - lm[374].y);
  const avgEyeDist = (leftEyeDist + rightEyeDist) / 2;

  let closed;
  if (eyeIsClosed) {
    closed = avgEyeDist < EYE_OPEN_THRESHOLD;
  } else {
    closed = avgEyeDist < EYE_CLOSED_THRESHOLD;
  }
  const wasClosed = eyeIsClosed;
  eyeIsClosed = closed;

  // ===== DETECÇÃO DE LÍNGUA PRA FORA =====
  // Landmarks da boca: 13 (lábio superior interno), 14 (lábio inferior interno)
  // 61/291 (cantos), 17 (queixo), 0 (lábio superior externo)
  const upperLip = lm[13];   // topo interno
  const lowerLip = lm[14];   // fundo interno
  const mouthOpen = Math.abs(lowerLip.y - upperLip.y);

  // Distância vertical entre queixo e nariz (referência de proporção)
  const noseTip = lm[1];
  const chin = lm[152];
  const faceHeight = Math.abs(chin.y - noseTip.y);

  // Proporção: abertura da boca relativa ao tamanho do rosto
  const mouthRatio = mouthOpen / Math.max(faceHeight, 0.001);

  // Calibra baseline nas primeiras leituras (boca fechada)
  if (tongueRatioBaseline === null) {
    tongueRatioBaseline = mouthRatio;
  } else {
    // Atualiza lentamente quando a boca está fechada
    if (mouthRatio < tongueRatioBaseline * 1.3) {
      tongueRatioBaseline = tongueRatioBaseline * 0.97 + mouthRatio * 0.03;
    }
  }

  // Língua pra fora = boca bem mais aberta que o normal + lábios esticados
  const tongueThreshold = tongueRatioBaseline * 2.2;
  const tongueDetected = mouthRatio > tongueThreshold && mouthRatio > 0.08;

  // Suavização: precisa manter por alguns frames
  if (tongueDetected) {
    if (tongueOutSince === null) tongueOutSince = now;
  } else {
    tongueOutSince = null;
  }
  tongueIsOut = tongueOutSince !== null;

  // ===== ATUALIZA STATUS DO GESTO =====
  if (eyeIsClosed) {
    gestureDotEl.className = 'status-dot active';
    gestureStatusTextEl.textContent = '👁️ Olho fechado';
  } else if (tongueIsOut) {
    gestureDotEl.className = 'status-dot active';
    gestureStatusTextEl.textContent = '👅 Língua detectada';
  } else {
    gestureDotEl.className = 'status-dot';
    gestureStatusTextEl.textContent = '—';
  }

  // ===== SELEÇÃO POR PISCAR =====
  if (selectionEnabled && focusedEl) {
    let progressRatio = 0;

    if (eyeIsClosed && eyeClosedSince !== null) {
      const elapsed = now - eyeClosedSince;
      progressRatio = Math.min(elapsed / BLINK_DURATION, 1);
      if (elapsed >= BLINK_DURATION) {
        fireSelection('Piscada');
        eyeClosedSince = null;
      }
    } else if (eyeIsClosed && eyeClosedSince === null) {
      eyeClosedSince = now;
    } else if (!eyeIsClosed && wasClosed) {
      eyeClosedSince = null;
    }

    // Língua
    if (tongueIsOut && tongueOutSince !== null) {
      const elapsed = now - tongueOutSince;
      const ratio = Math.min(elapsed / TONGUE_DURATION, 1);
      if (ratio > progressRatio) progressRatio = ratio;
      if (elapsed >= TONGUE_DURATION) {
        fireSelection('Língua');
        tongueOutSince = null;
      }
    }

    updateProgressBar(progressRatio);
    gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progressRatio);
  } else {
    gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
    updateProgressBar(0);
  }
}

// ==========================================================
// CANVAS OVERLAY (quadrado em volta da cabeça)
// ==========================================================
function drawOverlay(box) {
  if (!camOverlayCtx || !camOverlayEl.width) return;

  const w = camOverlayEl.width;
  const h = camOverlayEl.height;

  camOverlayCtx.clearRect(0, 0, w, h);

  if (!box) return;

  // Espelha X para bater com o vídeo (que tem scaleX(-1))
  const x = (1 - (box.x + box.w)) * w;
  const y = box.y * h;
  const bw = box.w * w;
  const bh = box.h * h;

  // Quadrado verde com cantos
  camOverlayCtx.strokeStyle = '#10b981';
  camOverlayCtx.lineWidth = 3;
  camOverlayCtx.shadowColor = '#10b981';
  camOverlayCtx.shadowBlur = 10;

  // Desenha só os 4 cantos (mais elegante)
  const cornerLen = Math.min(bw, bh) * 0.25;

  camOverlayCtx.beginPath();
  // Canto superior esquerdo
  camOverlayCtx.moveTo(x, y + cornerLen);
  camOverlayCtx.lineTo(x, y);
  camOverlayCtx.lineTo(x + cornerLen, y);
  // Canto superior direito
  camOverlayCtx.moveTo(x + bw - cornerLen, y);
  camOverlayCtx.lineTo(x + bw, y);
  camOverlayCtx.lineTo(x + bw, y + cornerLen);
  // Canto inferior direito
  camOverlayCtx.moveTo(x + bw, y + bh - cornerLen);
  camOverlayCtx.lineTo(x + bw, y + bh);
  camOverlayCtx.lineTo(x + bw - cornerLen, y + bh);
  // Canto inferior esquerdo
  camOverlayCtx.moveTo(x + cornerLen, y + bh);
  camOverlayCtx.lineTo(x, y + bh);
  camOverlayCtx.lineTo(x, y + bh - cornerLen);
  camOverlayCtx.stroke();

  camOverlayCtx.shadowBlur = 0;
}

// ==========================================================
// LOOP DE RASTREAMENTO
// ==========================================================
function startGazeLoop() {
  function loop() {
    gazeBubbleEl.style.left = gazeX + 'px';
    gazeBubbleEl.style.top = gazeY + 'px';

    updateFocusFromGaze();
    handleAutoScroll();

    gazeRafId = requestAnimationFrame(loop);
  }
  loop();
}

// ==========================================================
// FOCO A PARTIR DO OLHAR
// ==========================================================
function updateFocusFromGaze() {
  if (!selectionEnabled) {
    if (focusedEl) {
      focusedEl.classList.remove('gaze-focus');
      focusedEl = null;
    }
    gazeBubbleEl.classList.remove('target');
    return;
  }

  const all = Array.from(document.querySelectorAll('[data-gaze], .mode-card'))
    .filter(el => {
      if (el.offsetParent === null) return false;
      if (!el.dataset.gaze && !el.classList.contains('mode-card')) return false;
      const rect = el.getBoundingClientRect();
      return gazeX >= rect.left && gazeX <= rect.right &&
             gazeY >= rect.top && gazeY <= rect.bottom;
    });

  const target = all[0] || null;

  if (target !== focusedEl) {
    if (focusedEl) {
      focusedEl.classList.remove('gaze-focus');
      updateProgressBar(0);
    }
    focusedEl = target;
    gazeBubbleEl.classList.toggle('target', !!focusedEl);

    if (focusedEl) {
      focusedEl.classList.add('gaze-focus');
      focusStartTime = Date.now();
      // Reseta os timers de gesto ao trocar de alvo
      eyeClosedSince = null;
      tongueOutSince = null;
    }
  }
}

// ==========================================================
// SCROLL AUTOMÁTICO POR OLHAR
// ==========================================================
function handleAutoScroll() {
  const now = Date.now();
  if (now < scrollCooldown) return;

  const vh = window.innerHeight;
  const bubbleSize = 40;

  // Topo
  if (gazeY < SCROLL_ZONE) {
    // Não dispara se estiver sobre a barra de status (top 100px)
    if (gazeY > 90) {
      window.scrollBy(0, -SCROLL_SPEED);
      if (lastScrollDir !== 'up') {
        scrollCooldown = now + 200;
        lastScrollDir = 'up';
      }
    } else {
      // Sobre a barra: scroll mais forte para sair
      window.scrollBy(0, -SCROLL_SPEED * 2);
    }
  }
  // Fundo
  else if (gazeY > vh - SCROLL_ZONE) {
    window.scrollBy(0, SCROLL_SPEED);
    if (lastScrollDir !== 'down') {
      scrollCooldown = now + 200;
      lastScrollDir = 'down';
    }
  } else {
    lastScrollDir = null;
  }

  // Pequeno cooldown periódico para não scrollar infinito
  if (gazeY < SCROLL_ZONE || gazeY > vh - SCROLL_ZONE) {
    scrollCooldown = now + SCROLL_COOLDOWN_MS / 3;
  }
}

// ==========================================================
// PROGRESSO VISUAL
// ==========================================================
function updateProgressBar(ratio) {
  if (!focusedEl) return;
  let bar = focusedEl.querySelector('.gaze-progress-bar');
  if (!bar) {
    if (focusedEl.tagName === 'BUTTON' || focusedEl.classList.contains('ctrl-btn')) {
      bar = document.createElement('div');
      bar.className = 'gaze-progress-bar';
      focusedEl.style.position = 'relative';
      focusedEl.style.overflow = 'hidden';
      focusedEl.appendChild(bar);
    }
  }
  if (bar) bar.style.width = (ratio * 100) + '%';
}

// ==========================================================
// DISPARO DA SELEÇÃO
// ==========================================================
function fireSelection(gestureName) {
  if (!focusedEl) return;

  const el = focusedEl;
  const mode = el.dataset.mode;

  el.classList.add('gaze-selected');
  setTimeout(() => el.classList.remove('gaze-selected'), 600);
  gazeBubbleEl.classList.add('blinking');
  setTimeout(() => gazeBubbleEl.classList.remove('blinking'), 400);

  // Feedback visual
  gestureStatusTextEl.textContent = `✓ ${gestureName}!`;
  gestureDotEl.className = 'status-dot active';

  if (mode) {
    showToast(`✓ Modo ${mode === 'eye' ? 'Olhar' : 'Toque'} selecionado!`);
    setTimeout(() => startMode(mode), 500);
  } else if (el.id === 'groupBtn') {
    cycleGroup();
  } else if (el.id === 'scanBtn') {
    toggleScan();
  } else if (el.id === 'speakBtn') {
    speak();
  } else if (el.id === 'clearBtn') {
    clearText();
  } else if (el.id === 'homeBtn') {
    goHome();
  } else if (el.classList.contains('quick-btn')) {
    addPhrase(el.textContent.trim());
  } else if (el.classList.contains('key')) {
    selectKeyElement(el);
  } else {
    if (typeof el.onclick === 'function') el.onclick();
  }
}

// ==========================================================
// TECLADO
// ==========================================================
function buildKeyboard() {
  keyboardEl.innerHTML = '';
  const group = KEY_GROUPS[currentGroupIdx];
  currentGroupEl.textContent = group.name;

  group.keys.forEach(k => {
    const div = document.createElement('div');
    div.className = 'key';
    div.textContent = k;
    div.dataset.gaze = '';
    if (k === 'ESPAÇO') div.classList.add('space');
    if (k === '⌫ APAGAR') div.classList.add('del');
    keyboardEl.appendChild(div);
  });
}

function cycleGroup() {
  currentGroupIdx = (currentGroupIdx + 1) % KEY_GROUPS.length;
  buildKeyboard();
  scanIdx = 0;
  showToast(`📂 ${KEY_GROUPS[currentGroupIdx].name}`);
}

function buildQuickPhrases() {
  quickPhrasesEl.innerHTML = '';
  QUICK_PHRASES.forEach(phrase => {
    const btn = document.createElement('button');
    btn.className = 'quick-btn';
    btn.dataset.gaze = '';
    btn.textContent = phrase;
    btn.onclick = () => addPhrase(phrase);
    quickPhrasesEl.appendChild(btn);
  });
}

const getKeys = () => document.querySelectorAll('.key');

// ==========================================================
// VARREDURA
// ==========================================================
function startScan() {
  stopScan();
  scanIdx = 0;
  paused = false;
  scanBtnEl.textContent = '⏸ Pausar';
  scanBtnEl.classList.remove('paused');

  scanIv = setInterval(() => {
    if (paused) return;
    const ks = getKeys();
    if (!ks.length) return;
    ks.forEach(k => k.classList.remove('scanning'));
    if (scanIdx >= ks.length) scanIdx = 0;
    ks[scanIdx].classList.add('scanning');
    scanIdx++;
  }, scanSpeed);
}

function stopScan() {
  clearInterval(scanIv);
  scanIv = null;
  getKeys().forEach(k => k.classList.remove('scanning'));
}

function toggleScan() {
  paused = !paused;
  scanBtnEl.textContent = paused ? '▶ Retomar' : '⏸ Pausar';
  scanBtnEl.classList.toggle('paused', paused);
}

// ==========================================================
// SELEÇÃO
// ==========================================================
function selectCurrent() {
  const ks = getKeys();
  const idx = scanIdx - 1;
  if (idx < 0 || idx >= ks.length) return;
  selectKeyElement(ks[idx]);
}

function selectKeyElement(el) {
  const v = el.textContent.trim();
  if (v === 'ESPAÇO') txt += ' ';
  else if (v === '⌫ APAGAR') txt = txt.slice(0, -1);
  else txt += v;

  updateOutput();
  el.classList.add('selected');
  setTimeout(() => el.classList.remove('selected'), 350);
  showToast('✓ Letra selecionada!');
  scanIdx = 0;
}

function updateOutput() {
  if (txt.length) {
    phEl.style.display = 'none';
    curEl.style.display = 'inline-block';
    outEl.textContent = txt;
  } else {
    phEl.style.display = '';
    curEl.style.display = 'none';
    outEl.textContent = '';
  }
}

// ==========================================================
// FRASES / FALA / LIMPAR
// ==========================================================
function addPhrase(phrase) {
  if (txt.length && !txt.endsWith(' ')) txt += ' ';
  txt += phrase;
  updateOutput();
  showToast('✓ Frase adicionada!');
  speak();
}

function speak() {
  if (!txt.trim()) return;
  const u = new SpeechSynthesisUtterance(txt.trim());
  u.lang = 'pt-BR';
  u.rate = 0.9;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function clearText() {
  txt = '';
  updateOutput();
}

function updateSpeed(v) {
  scanSpeed = parseInt(v);
  speedLblEl.textContent = (scanSpeed / 1000).toFixed(1) + 's';
  if (scanIv) startScan();
}

// ==========================================================
// TOAST
// ==========================================================
function showToast(msg = '✓ Selecionado!') {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1500);
}

// ==========================================================
// MODOS
// ==========================================================
function startMode(mode) {
  document.getElementById('screenHome').classList.remove('active');
  document.getElementById('screenApp').classList.add('active');
  currentScreen = 'app';
  modeBadgeEl.textContent = mode === 'eye' ? '👁️ Olhar' : '👆 Toque';
  modeLblEl.textContent = mode === 'eye' ? 'Olhar' : 'Toque';
  buildKeyboard();
  startScan();
  clearFocusState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
  stopScan();
  document.getElementById('screenApp').classList.remove('active');
  document.getElementById('screenHome').classList.add('active');
  currentScreen = 'home';
  modeBadgeEl.textContent = 'Início';
  txt = '';
  updateOutput();
  clearFocusState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearFocusState() {
  if (focusedEl) {
    focusedEl.classList.remove('gaze-focus');
    focusedEl = null;
  }
  gazeBubbleEl.classList.remove('target');
  focusStartTime = 0;
  eyeClosedSince = null;
  tongueOutSince = null;
  updateProgressBar(0);
  gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
}

// ==========================================================
// BOTÕES DE MODO
// ==========================================================
gazeModeBtnEl.addEventListener('click', () => {
  // Só informativo agora — ambos os gestos estão ativos
  showToast('Pisque ou ponha a língua pra fora para selecionar');
});

gazeToggleBtnEl.addEventListener('click', () => {
  selectionEnabled = !selectionEnabled;
  if (selectionEnabled) {
    gazeToggleBtnEl.textContent = '⏸ Pausar seleção';
    gazeToggleBtnEl.classList.remove('paused');
    gazeBubbleEl.classList.remove('disabled');
    showToast('✓ Seleção ativada');
  } else {
    gazeToggleBtnEl.textContent = '▶ Retomar seleção';
    gazeToggleBtnEl.classList.add('paused');
    gazeBubbleEl.classList.add('disabled');
    clearFocusState();
    showToast('⏸ Seleção pausada');
  }
});

// ==========================================================
// EXPOR
// ==========================================================
window.startMode = startMode;
window.goHome = goHome;
window.speak = speak;
window.clearText = clearText;
window.toggleScan = toggleScan;
window.cycleGroup = cycleGroup;
window.updateSpeed = updateSpeed;