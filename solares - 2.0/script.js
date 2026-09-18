let txt = "";
let scanIdx = 0;
let scanIv = null;
let scanSpeed = 1200;
let paused = false;
let toastTimer = null;
let currentScreen = "home";
let currentMode = "eye";

let camStream = null;
let faceMesh = null;
let cameraReady = false;
let lastFrameTs = 0;
let sendPending = false;
let adaptiveIntervalMs = 66;

const camPreviewEl = document.getElementById("camPreview");
const camVideoEl = document.getElementById("camVideo");
const camOverlayEl = document.getElementById("camOverlay");
const camPreviewLabelEl = document.getElementById("camPreviewLabel");
let camOverlayCtx = null;

let gazeX = window.innerWidth / 2;
let gazeY = window.innerHeight / 2;
let smoothX = gazeX;
let smoothY = gazeY;
let velocityX = 0;
let velocityY = 0;
let gazeRafId = null;

let rawEyeX = 0.5;
let rawEyeY = 0.5;
let hasEyeSample = false;

let eyeSampleHistory = [];
const EYE_HISTORY_SIZE = 8;

let faceDetected = false;
let lastFaceSeenAt = 0;
const FACE_TIMEOUT = 2500;
let faceBox = null;
let faceMissingFrames = 0;
const FACE_GRACE_FRAMES = 20;

let EYE_CLOSED_RATIO = 0.55;
let EYE_OPEN_RATIO = 0.7;
let eyeOpenRatioBaseline = null;
let eyeIsClosed = false;
let eyeClosedSince = null;
let eyeStableCount = 0;
let BLINK_DURATION = 1500;
const EYE_STABLE_FRAMES = 2;

let tongueOutSince = null;
let tongueIsOut = false;
let TONGUE_DURATION = 1200;
let tongueRatioBaseline = null;
let tongueStableCount = 0;
const TONGUE_STABLE_FRAMES = 2;

let focusedEl = null;
let focusStartTime = 0;
let selectionEnabled = true;

let emergencyMode = null;
let emergencyUtterance = null;
let emergencySpeakLoop = null;
let emergencyVibInterval = null;
let emergencyGestureStart = null;
const EMERGENCY_GESTURE_HOLD_MS = 3000;

let scrollHoldStart = 0;
let scrollLastDir = null;
let scrollReleaseAt = 0;
const SCROLL_HOLD_DELAY = 500;
const SCROLL_RELEASE_GRACE = 250;
const SCROLL_SPEED_SLOW = 8;
const SCROLL_SPEED_MED = 16;
const SCROLL_SPEED_FAST = 26;

let voiceUnlocked = false;
let audioContextUnlocked = false;

let calibrationActive = false;
let calibrationStep = 0;
let calibrationPoints = [];
let calibrationData = [];
let calibrationCurrentSamples = [];
let calibrationLastEye = null;
let calibrationStableSince = null;
let calibrationSampleStart = null;
let calibrationMovedEnough = false;
const CALIBRATION_TOTAL_STEPS = 5;
const CALIBRATION_MOVE_THRESHOLD = 0.008;
const CALIBRATION_STABLE_MS = 500;
const CALIBRATION_SAMPLE_MS = 2000;
const CALIBRATION_MAX_POINT_MS = 12000;
let calibrationPointStartedAt = 0;
let calibrationResolvedRanges = { rangeX: 0.06, rangeY: 0.05 };

const GAZE_SPEED_FACTOR = 0.04;
const GAZE_DEAD_ZONE_PX = 15;
const GAZE_SMOOTHING = 0.25;

const STORAGE_KEYS = {
  calibration: "solares_calibration_v4",
  history: "solares_history_v1",
  settings: "solares_settings_v4",
};

let caregiverPhone = "";
let emergencyMessage = "Preciso de ajuda";
let callMessage = "Preciso de ajuda";
let hapticEnabled = true;
let suggestionsEnabled = true;
let lowPowerMode = false;

let phraseHistory = [];
const HISTORY_MAX = 20;

const SUGGESTION_MAP = [
  { prefix: /(^|\s)preciso(\s+de)?$/i, items: ["água", "ajuda", "ir ao banheiro", "comer", "descansar", "remédio"] },
  { prefix: /(^|\s)estou(\s+com)?$/i, items: ["com dor", "bem", "cansado", "com fome", "com sede", "com frio", "com calor"] },
  { prefix: /(^|\s)quero$/i, items: ["comer", "beber água", "dormir", "sair", "conversar", "ver televisão", "ir ao banheiro"] },
  { prefix: /(^|\s)me\s+sinto$/i, items: ["bem", "mal", "cansado", "triste", "feliz", "ansioso"] },
  { prefix: /(^|\s)chame$/i, items: ["minha mãe", "meu pai", "o médico", "a enfermeira", "alguém"] },
  { prefix: /(^|\s)queria$/i, items: ["conversar", "ver alguém", "sair", "descansar", "comer algo"] },
  { prefix: /(^|\s)por\s+favor$/i, items: ["me ajude", "traga água", "chame alguém", "espere um pouco"] },
  { prefix: /(^|\s)obrigado$/i, items: ["pela ajuda", "pela atenção", "por tudo"] },
  { prefix: /(^|\s)sim$/i, items: ["por favor", "obrigado", "eu quero"] },
  { prefix: /(^|\s)não$/i, items: ["obrigado", "agora não", "mais tarde", "por favor não"] },
  { prefix: /(^|\s)ajuda$/i, items: ["por favor", "rápido", "estou com dor", "não consigo me mexer"] },
  { prefix: /(^|\s)dor$/i, items: ["de cabeça", "nas costas", "no peito", "na barriga", "nas pernas"] },
  { prefix: /(^|\s)banheiro$/i, items: ["por favor", "urgente", "preciso de ajuda"] },
];

const $ = (id) => document.getElementById(id);

const gazeBubbleEl = $("gazeBubble");
const gazeRingFillEl = $("gazeRingFill");
const gazeToggleBtnEl = $("gazeToggleBtn");
const emergencyBtnEl = $("emergencyBtn");
const camLoadingEl = $("camLoading");
const voiceGateEl = $("voiceGate");
const voiceGateBtnEl = $("voiceGateBtn");

const phEl = $("ph");
const outEl = $("out");
const curEl = $("cur");
const keyboardEl = $("keyboard");
const quickPhrasesEl = $("quickPhrases");
const modeBadgeEl = $("modeBadge");
const modeLblEl = $("modeLbl");
const scanBtnEl = $("scanBtn");
const speedLblEl = $("speedLbl");
const toastEl = $("toast");

const camDotEl = $("camDot");
const camStatusTextEl = $("camStatusText");
const faceDotEl = $("faceDot");
const faceStatusTextEl = $("faceStatusText");
const gestureDotEl = $("gestureDot");
const gestureStatusTextEl = $("gestureStatusText");

const scrollUpBtnEl = $("scrollUpBtn");
const scrollDownBtnEl = $("scrollDownBtn");

const suggestionsBoxEl = $("suggestionsBox");
const suggestionsListEl = $("suggestionsList");

const historyPanelEl = $("historyPanel");
const historyListEl = $("historyList");
const historyCloseBtnEl = $("historyCloseBtn");
const historyClearBtnEl = $("historyClearBtn");

const settingsPanelEl = $("settingsPanel");
const settingsCloseBtnEl = $("settingsCloseBtn");
const settingsSaveBtnEl = $("settingsSaveBtn");
const caregiverPhoneEl = $("caregiverPhone");
const emergencyMessageEl = $("emergencyMessage");
const callMessageEl = $("callMessage");
const hapticToggleEl = $("hapticToggle");
const suggestionsToggleEl = $("suggestionsToggle");
const lowPowerToggleEl = $("lowPowerToggle");

const emergencyOverlayEl = $("emergencyOverlay");
const emergencyTextEl = $("emergencyText");
const emergencyOptionsEl = $("emergencyOptions");
const emergencyHelpBtnEl = $("emergencyHelpBtn");
const emergencyCallBtnEl = $("emergencyCallBtn");
const emergencyCancelBtnEl = $("emergencyCancelBtn");
const emergencyStopBtnEl = $("emergencyStopBtn");
const emergencyCallDescEl = $("emergencyCallDesc");

const calibrationIntroEl = $("calibrationIntro");
const calibrationStageEl = $("calibrationStage");
const calibrationDoneEl = $("calibrationDone");
const calibrationCanvasEl = $("calibrationCanvas");
const calibrationTargetEl = $("calibrationTarget");
const calibrationStepLabelEl = $("calibrationStepLabel");
const calibrationProgressFillEl = $("calibrationProgressFill");
const calibrationInstructionEl = $("calibrationInstruction");
const calibrationStartBtnEl = $("calibrationStartBtn");
const calibrationSkipBtnEl = $("calibrationSkipBtn");
const calibrationAbortBtnEl = $("calibrationAbortBtn");
const calibrationResultTextEl = $("calibrationResultText");

const RING_CIRCUMFERENCE = 2 * Math.PI * 46;

const KEYS = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T",
  "U","V","W","X","Y","Z","0","1","2","3","4","5","6","7","8","9","ESPAÇO","⌫",
];
const QUICK_PHRASES = [
  "Sim","Não","Estou bem","Preciso de água","Chame alguém","Obrigado","Ajuda","Estou com dor",
];

let cachedTargets = [];
let cachedTargetsAt = 0;
const CACHE_TARGETS_MS = 500;

let scrollButtonRects = null;
let scrollRectsAt = 0;
const SCROLL_RECTS_MS = 400;

window.addEventListener("DOMContentLoaded", () => {
  gazeRingFillEl.style.strokeDasharray = RING_CIRCUMFERENCE;
  gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;

  loadSettings();
  loadCalibration();
  loadHistory();
  applyLowPowerClass();

  buildQuickPhrases();
  buildKeyboard();
  camOverlayCtx = camOverlayEl.getContext("2d", { willReadFrequently: true });

  unlockAudio();
  initVoices();
  setupVoiceGate();
  setupKeyboardNavigation();
  setupPanelHandlers();
  setupEmergencyHandlers();
  setupCalibrationHandlers();
  setupVisibilityOptimizations();

  scrollUpBtnEl.addEventListener("click", scrollUp, { passive: true });
  scrollDownBtnEl.addEventListener("click", scrollDown, { passive: true });
  appendScrollProgressBars();

  setTimeout(initCamera, 30);
  startGazeLoop();
});

function unlockAudio() {
  const unlock = () => {
    if (audioContextUnlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.01);
        ctx.resume();
      }
    } catch (e) {}
    if ("speechSynthesis" in window) {
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        speechSynthesis.speak(u);
      } catch (e) {}
    }
    audioContextUnlocked = true;
  };
  document.addEventListener("click", unlock, { once: true, passive: true });
  document.addEventListener("touchstart", unlock, { once: true, passive: true });
  document.addEventListener("keydown", unlock, { once: true });
}

function appendScrollProgressBars() {
  const upP = document.createElement("div");
  upP.className = "scroll-progress";
  scrollUpBtnEl.appendChild(upP);
  const downP = document.createElement("div");
  downP.className = "scroll-progress";
  scrollDownBtnEl.appendChild(downP);
}

function setupVisibilityOptimizations() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (gazeRafId) {
        cancelAnimationFrame(gazeRafId);
        gazeRafId = null;
      }
    } else if (!gazeRafId) {
      startGazeLoop();
    }
  });
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return;
    const s = JSON.parse(raw);
    caregiverPhone = s.caregiverPhone || "";
    emergencyMessage = s.emergencyMessage || "Preciso de ajuda";
    callMessage = s.callMessage || "Preciso de ajuda";
    hapticEnabled = s.hapticEnabled !== false;
    suggestionsEnabled = s.suggestionsEnabled !== false;
    lowPowerMode = !!s.lowPowerMode;
  } catch (e) {}
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({
      caregiverPhone,
      emergencyMessage,
      callMessage,
      hapticEnabled,
      suggestionsEnabled,
      lowPowerMode,
    }));
  } catch (e) {}
}

function applyLowPowerClass() {
  document.body.classList.toggle("low-power", lowPowerMode);
  adaptiveIntervalMs = lowPowerMode ? 100 : 66;
}

function loadCalibration() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.calibration);
    if (!raw) return;
    const c = JSON.parse(raw);
    if (c.rangeX && c.rangeY) {
      calibrationResolvedRanges.rangeX = c.rangeX;
      calibrationResolvedRanges.rangeY = c.rangeY;
    }
    if (c.blinkDuration) BLINK_DURATION = c.blinkDuration;
    if (c.eyeClosedRatio) EYE_CLOSED_RATIO = c.eyeClosedRatio;
    if (c.eyeOpenRatio) EYE_OPEN_RATIO = c.eyeOpenRatio;
  } catch (e) {}
}

function saveCalibration(data) {
  try {
    localStorage.setItem(STORAGE_KEYS.calibration, JSON.stringify(data));
  } catch (e) {}
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history);
    phraseHistory = raw ? JSON.parse(raw) || [] : [];
  } catch (e) { phraseHistory = []; }
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(phraseHistory.slice(0, HISTORY_MAX)));
  } catch (e) {}
}

function addToHistory(text) {
  if (!text || !text.trim()) return;
  const t = text.trim();
  if (phraseHistory[0]?.text === t) return;
  phraseHistory.unshift({ text: t, time: Date.now() });
  if (phraseHistory.length > HISTORY_MAX) phraseHistory.length = HISTORY_MAX;
  saveHistory();
  if (historyPanelEl.classList.contains("visible")) renderHistory();
}

function haptic(ms = 40) {
  if (!hapticEnabled) return;
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) {}
  }
}

function initVoices() {
  if (!("speechSynthesis" in window)) return;
  try { speechSynthesis.getVoices(); } catch (e) {}
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
      try { speechSynthesis.getVoices(); } catch (e) {}
    };
  }
  setTimeout(() => {
    try { speechSynthesis.getVoices(); } catch (e) {}
  }, 1000);
}

function getPtVoice() {
  if (!("speechSynthesis" in window)) return null;
  let voices = [];
  try { voices = speechSynthesis.getVoices() || []; } catch (e) {}
  if (!voices.length) return null;
  const ptBr = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("pt-br"));
  if (ptBr) return ptBr;
  const pt = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("pt"));
  return pt || null;
}

function setupVoiceGate() {
  if (!("speechSynthesis" in window)) {
    voiceGateEl.classList.add("hidden");
    voiceUnlocked = true;
    return;
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    voiceUnlocked = true;
    voiceGateEl.classList.add("hidden");
    showToast("✓ Voz ativada!");
  };

  const activate = (e) => {
    if (voiceUnlocked) return;
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      speechSynthesis.cancel();
      try { speechSynthesis.getVoices(); } catch (err) {}
      const greeting = new SpeechSynthesisUtterance("Voz ativada");
      greeting.lang = "pt-BR";
      greeting.rate = 1.0;
      greeting.volume = 1.0;
      const v = getPtVoice();
      if (v) greeting.voice = v;
      greeting.onend = finish;
      greeting.onerror = finish;
      speechSynthesis.speak(greeting);
      setTimeout(finish, 1200);
    } catch (err) {
      finish();
    }
  };

  voiceGateBtnEl.addEventListener("click", activate, { passive: true });
  voiceGateEl.addEventListener("click", activate, { passive: true });
  voiceGateEl.addEventListener("touchstart", activate, { passive: true });
  document.addEventListener("keydown", (e) => { if (!voiceUnlocked) activate(e); }, { once: true });
}

async function initCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Sem getUserMedia");

    camStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 480 },
        height: { ideal: 360 },
        frameRate: { ideal: 20, max: 24 },
      },
      audio: false,
    });

    camVideoEl.srcObject = camStream;
    await camVideoEl.play();

    function syncCanvasSize() {
      if (camVideoEl.videoWidth) {
        camOverlayEl.width = camVideoEl.videoWidth;
        camOverlayEl.height = camVideoEl.videoHeight;
      }
    }
    camVideoEl.addEventListener("loadedmetadata", syncCanvasSize);
    setTimeout(syncCanvasSize, 500);

    if (typeof FaceMesh === "undefined") throw new Error("FaceMesh ausente");

    faceMesh = new FaceMesh({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(onFaceResults);

    cameraReady = true;
    camLoadingEl.classList.add("hidden");
    gazeBubbleEl.classList.add("active");
    camPreviewEl.classList.remove("hidden");
    camDotEl.className = "status-dot active";
    camStatusTextEl.textContent = "Câmera ativa";

    pumpFrames();
  } catch (e) {
    console.error(e);
    camLoadingEl.classList.add("hidden");
    camPreviewEl.classList.add("hidden");
    camDotEl.className = "status-dot error";
    camStatusTextEl.textContent = "Câmera indisponível";
    faceDotEl.className = "status-dot error";
    faceStatusTextEl.textContent = "Use o toque";
  }
}

function pumpFrames() {
  requestAnimationFrame(pumpFrames);
  if (!faceMesh || !cameraReady) return;
  if (document.hidden) return;
  const now = performance.now();
  if (now - lastFrameTs < adaptiveIntervalMs) return;
  if (sendPending) return;
  if (camVideoEl.readyState < 2) return;

  lastFrameTs = now;
  sendPending = true;
  const t0 = performance.now();
  faceMesh.send({ image: camVideoEl }).then(() => {
    const dt = performance.now() - t0;
    if (dt > 100) adaptiveIntervalMs = Math.min(adaptiveIntervalMs + 8, 160);
    else if (dt < 45) adaptiveIntervalMs = Math.max(adaptiveIntervalMs - 4, 50);
    sendPending = false;
  }).catch(() => { sendPending = false; });
}

function onFaceResults(results) {
  const now = performance.now();
  const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

  if (!hasFace) {
    faceMissingFrames++;
    faceDetected = false;
    faceBox = null;
    hasEyeSample = false;
    if (Date.now() - lastFaceSeenAt > FACE_TIMEOUT && faceMissingFrames > FACE_GRACE_FRAMES) {
      if (selectionEnabled) {
        selectionEnabled = false;
        gazeBubbleEl.classList.add("disabled");
        camPreviewEl.classList.add("no-face");
        camPreviewEl.classList.remove("face-detected");
        camPreviewLabelEl.textContent = "Sem rosto";
        faceDotEl.className = "status-dot warn";
        faceStatusTextEl.textContent = "Rosto não detectado";
      }
    }
    drawOverlay(null);
    return;
  }

  faceMissingFrames = 0;
  faceDetected = true;
  lastFaceSeenAt = Date.now();

  if (!selectionEnabled && !emergencyMode) {
    selectionEnabled = true;
    gazeBubbleEl.classList.remove("disabled");
  }
  camPreviewEl.classList.remove("no-face");
  camPreviewEl.classList.add("face-detected");
  camPreviewLabelEl.textContent = "✓ Rosto detectado";
  faceDotEl.className = "status-dot active";
  faceStatusTextEl.textContent = "Rosto detectado";

  const lm = results.multiFaceLandmarks[0];

  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const mX = (maxX - minX) * 0.12;
  const mY = (maxY - minY) * 0.12;
  faceBox = {
    x: Math.max(0, minX - mX),
    y: Math.max(0, minY - mY),
    w: Math.min(1, maxX + mX) - Math.max(0, minX - mX),
    h: Math.min(1, maxY + mY) - Math.max(0, minY - mY),
  };
  drawOverlay(faceBox);

  const leftIris = lm[468];
  const rightIris = lm[473];

  let eyeCx, eyeCy;
  if (leftIris && rightIris) {
    eyeCx = (leftIris.x + rightIris.x) / 2;
    eyeCy = (leftIris.y + rightIris.y) / 2;
  } else {
    eyeCx = (lm[33].x + lm[263].x) / 2;
    eyeCy = (lm[159].y + lm[386].y) / 2;
  }

  eyeSampleHistory.push({ x: eyeCx, y: eyeCy });
  if (eyeSampleHistory.length > EYE_HISTORY_SIZE) eyeSampleHistory.shift();

  let sx = 0, sy = 0, sw = 0;
  for (let i = 0; i < eyeSampleHistory.length; i++) {
    const w = i + 1;
    sx += eyeSampleHistory[i].x * w;
    sy += eyeSampleHistory[i].y * w;
    sw += w;
  }
  rawEyeX = sx / sw;
  rawEyeY = sy / sw;
  hasEyeSample = true;

  const leftEyeH = Math.abs(lm[145].y - lm[159].y);
  const rightEyeH = Math.abs(lm[374].y - lm[386].y);
  const eyeH = (leftEyeH + rightEyeH) / 2;
  const leftEyeW = Math.abs(lm[133].x - lm[33].x);
  const rightEyeW = Math.abs(lm[263].x - lm[362].x);
  const eyeW = (leftEyeW + rightEyeW) / 2;
  const ear = eyeH / Math.max(eyeW, 0.001);

  if (eyeOpenRatioBaseline === null) eyeOpenRatioBaseline = ear;
  else if (ear > eyeOpenRatioBaseline)
    eyeOpenRatioBaseline = eyeOpenRatioBaseline * 0.98 + ear * 0.02;
  else if (ear > eyeOpenRatioBaseline * 0.7)
    eyeOpenRatioBaseline = eyeOpenRatioBaseline * 0.998 + ear * 0.002;

  const closedRatio = ear / Math.max(eyeOpenRatioBaseline, 0.001);
  const rawClosed = closedRatio < EYE_CLOSED_RATIO;
  const rawOpen = closedRatio > EYE_OPEN_RATIO;

  if (eyeIsClosed) {
    if (rawOpen) {
      eyeStableCount++;
      if (eyeStableCount >= EYE_STABLE_FRAMES) { eyeIsClosed = false; eyeStableCount = 0; }
    } else eyeStableCount = 0;
  } else {
    if (rawClosed) {
      eyeStableCount++;
      if (eyeStableCount >= EYE_STABLE_FRAMES) { eyeIsClosed = true; eyeStableCount = 0; }
    } else eyeStableCount = 0;
  }

  const mouthOpen = Math.abs(lm[14].y - lm[13].y);
  const faceH = Math.abs(lm[152].y - lm[1].y);
  const mouthRatio = mouthOpen / Math.max(faceH, 0.001);

  if (tongueRatioBaseline === null) tongueRatioBaseline = mouthRatio;
  else if (mouthRatio < tongueRatioBaseline * 1.3)
    tongueRatioBaseline = tongueRatioBaseline * 0.97 + mouthRatio * 0.03;

  const rawTongue = mouthRatio > tongueRatioBaseline * 2.0 && mouthRatio > 0.06;
  if (rawTongue) tongueStableCount++;
  else tongueStableCount = Math.max(0, tongueStableCount - 1);

  const tongueDetected = tongueStableCount >= TONGUE_STABLE_FRAMES;
  if (tongueDetected) {
    if (tongueOutSince === null) tongueOutSince = now;
  } else if (tongueStableCount === 0) {
    tongueOutSince = null;
  }
  tongueIsOut = tongueOutSince !== null;

  if (!emergencyMode && eyeIsClosed && tongueIsOut) {
    if (emergencyGestureStart === null) emergencyGestureStart = now;
    if (now - emergencyGestureStart >= EMERGENCY_GESTURE_HOLD_MS) {
      openEmergencyMenu("Gesto");
      emergencyGestureStart = null;
    }
  } else {
    emergencyGestureStart = null;
  }

  if (emergencyMode) {
    gestureDotEl.className = "status-dot error";
    gestureStatusTextEl.textContent = "🚨 Emergência";
  } else if (eyeIsClosed) {
    gestureDotEl.className = "status-dot active";
    gestureStatusTextEl.textContent = "👁️ Olho fechado";
  } else if (tongueIsOut) {
    gestureDotEl.className = "status-dot active";
    gestureStatusTextEl.textContent = "👅 Língua detectada";
  } else {
    gestureDotEl.className = "status-dot";
    gestureStatusTextEl.textContent = "—";
  }

  if (calibrationActive) {
    updateCalibration(rawEyeX, rawEyeY, now);
  }
}

function updateGazeFromEye() {
  if (!hasEyeSample) return;

  const rangeX = calibrationResolvedRanges.rangeX;
  const rangeY = calibrationResolvedRanges.rangeY;

  const mirroredX = 1 - rawEyeX;
  const cx = 0.5;
  const cy = 0.5;

  let nx = (mirroredX - (cx - rangeX / 2)) / rangeX;
  let ny = (rawEyeY - (cy - rangeY / 2)) / rangeY;

  nx = Math.max(0, Math.min(1, nx));
  ny = Math.max(0, Math.min(1, ny));

  const targetX = nx * window.innerWidth;
  const targetY = ny * window.innerHeight;

  const dx = targetX - smoothX;
  const dy = targetY - smoothY;

  velocityX = velocityX * (1 - GAZE_SMOOTHING) + dx * GAZE_SPEED_FACTOR * GAZE_SMOOTHING;
  velocityY = velocityY * (1 - GAZE_SMOOTHING) + dy * GAZE_SPEED_FACTOR * GAZE_SMOOTHING;

  smoothX += velocityX;
  smoothY += velocityY;

  const dist = Math.sqrt((targetX - smoothX) ** 2 + (targetY - smoothY) ** 2);
  if (dist > GAZE_DEAD_ZONE_PX) {
    smoothX += (targetX - smoothX) * 0.08;
    smoothY += (targetY - smoothY) * 0.08;
  }

  gazeX = Math.max(10, Math.min(window.innerWidth - 10, smoothX));
  gazeY = Math.max(10, Math.min(window.innerHeight - 10, smoothY));
}

function isScrolling() {
  return (
    scrollUpBtnEl.classList.contains("scrolling") ||
    scrollDownBtnEl.classList.contains("scrolling")
  );
}

function drawOverlay(box) {
  if (!camOverlayCtx || !camOverlayEl.width) return;
  const w = camOverlayEl.width;
  const h = camOverlayEl.height;
  camOverlayCtx.clearRect(0, 0, w, h);
  if (!box) return;

  const x = (1 - (box.x + box.w)) * w;
  const y = box.y * h;
  const bw = box.w * w;
  const bh = box.h * h;
  const cl = Math.min(bw, bh) * 0.25;

  camOverlayCtx.strokeStyle = "#10b981";
  camOverlayCtx.lineWidth = 3;
  camOverlayCtx.beginPath();
  camOverlayCtx.moveTo(x, y + cl);
  camOverlayCtx.lineTo(x, y);
  camOverlayCtx.lineTo(x + cl, y);
  camOverlayCtx.moveTo(x + bw - cl, y);
  camOverlayCtx.lineTo(x + bw, y);
  camOverlayCtx.lineTo(x + bw, y + cl);
  camOverlayCtx.moveTo(x + bw, y + bh - cl);
  camOverlayCtx.lineTo(x + bw, y + bh);
  camOverlayCtx.lineTo(x + bw - cl, y + bh);
  camOverlayCtx.moveTo(x + cl, y + bh);
  camOverlayCtx.lineTo(x, y + bh);
  camOverlayCtx.lineTo(x, y + bh - cl);
  camOverlayCtx.stroke();
}

let frameSkipCounter = 0;

function startGazeLoop() {
  if (gazeRafId) return;
  function loop() {
    if (document.hidden) {
      gazeRafId = null;
      return;
    }

    updateGazeFromEye();

    gazeBubbleEl.style.transform = `translate(${gazeX}px, ${gazeY}px) translate(-50%, -50%)`;

    frameSkipCounter++;
    if (frameSkipCounter % 2 === 0) {
      updateFocusFromGaze();
    }
    if (frameSkipCounter % 3 === 0) {
      updateScrollButtons();
    }

    gazeRafId = requestAnimationFrame(loop);
  }
  gazeRafId = requestAnimationFrame(loop);
}

function updateScrollButtons() {
  if (!selectionEnabled) {
    scrollHoldStart = 0;
    scrollLastDir = null;
    scrollUpBtnEl.classList.remove("gaze-focus", "scrolling", "scroll-hover");
    scrollDownBtnEl.classList.remove("gaze-focus", "scrolling", "scroll-hover");
    return;
  }

  const now = Date.now();
  if (!scrollButtonRects || now - scrollRectsAt > SCROLL_RECTS_MS) {
    scrollButtonRects = {
      up: scrollUpBtnEl.getBoundingClientRect(),
      down: scrollDownBtnEl.getBoundingClientRect(),
    };
    scrollRectsAt = now;
  }

  const upRect = scrollButtonRects.up;
  const downRect = scrollButtonRects.down;
  const pad = 8;

  const overUp = gazeX >= upRect.left - pad && gazeX <= upRect.right + pad &&
                 gazeY >= upRect.top - pad && gazeY <= upRect.bottom + pad;
  const overDown = gazeX >= downRect.left - pad && gazeX <= downRect.right + pad &&
                   gazeY >= downRect.top - pad && gazeY <= downRect.bottom + pad;

  let dir = null;
  if (overUp && !overDown) dir = "up";
  else if (overDown && !overUp) dir = "down";

  if (dir !== null) scrollReleaseAt = now + SCROLL_RELEASE_GRACE;
  else if (now < scrollReleaseAt && scrollLastDir) dir = scrollLastDir;

  if (dir !== scrollLastDir) {
    scrollHoldStart = dir ? now : 0;
    scrollLastDir = dir;
    scrollUpBtnEl.classList.toggle("gaze-focus", dir === "up");
    scrollDownBtnEl.classList.toggle("gaze-focus", dir === "down");
    if (!dir) {
      scrollUpBtnEl.classList.remove("scrolling", "scroll-hover");
      scrollDownBtnEl.classList.remove("scrolling", "scroll-hover");
    }
  }

  if (dir) {
    scrollUpBtnEl.classList.toggle("scroll-hover", dir === "up" && !scrollUpBtnEl.classList.contains("scrolling"));
    scrollDownBtnEl.classList.toggle("scroll-hover", dir === "down" && !scrollDownBtnEl.classList.contains("scrolling"));

    if (scrollHoldStart > 0) {
      const held = now - scrollHoldStart;
      if (held > SCROLL_HOLD_DELAY) {
        let speed = SCROLL_SPEED_SLOW;
        if (held > 1200) speed = SCROLL_SPEED_MED;
        if (held > 2200) speed = SCROLL_SPEED_FAST;
        window.scrollBy(0, dir === "up" ? -speed : speed);
        if (dir === "up") scrollUpBtnEl.classList.add("scrolling");
        else scrollDownBtnEl.classList.add("scrolling");
      }
    }
  } else {
    scrollUpBtnEl.classList.remove("scrolling");
    scrollDownBtnEl.classList.remove("scrolling");
  }
}

function getFocusableContainers() {
  const containers = [];
  const activeScreen = document.querySelector(".screen.active");
  if (activeScreen) containers.push(activeScreen);
  if (emergencyMode) containers.push(emergencyOverlayEl);
  if (historyPanelEl.classList.contains("visible")) containers.push(historyPanelEl);
  if (settingsPanelEl.classList.contains("visible")) containers.push(settingsPanelEl);
  return containers;
}

function updateFocusFromGaze() {
  if (!selectionEnabled && !emergencyMode) {
    if (focusedEl) {
      focusedEl.classList.remove("gaze-focus");
      focusedEl = null;
    }
    gazeBubbleEl.classList.remove("target");
    return;
  }

  if (isScrolling() || scrollLastDir) {
    if (focusedEl) {
      focusedEl.classList.remove("gaze-focus");
      updateProgressBar(0, focusedEl);
      focusedEl = null;
    }
    gazeBubbleEl.classList.toggle("target", true);
    return;
  }

  const now = Date.now();
  if (!cachedTargets.length || now - cachedTargetsAt > CACHE_TARGETS_MS) {
    const containers = getFocusableContainers();
    const list = [];
    for (const c of containers) {
      const els = c.querySelectorAll(
        "[data-gaze], .mode-card, .quick-btn, .suggestion-btn, .ctrl-btn, .scan-toggle, .home-action-btn, .history-repeat-btn, .emergency-option, .emergency-stop-btn, .calibration-skip-btn, .panel-close, .gaze-mode-btn, .scroll-btn"
      );
      for (const el of els) list.push(el);
    }
    cachedTargets = list;
    cachedTargetsAt = now;
  }

  let target = null;
  if (focusedEl && document.body.contains(focusedEl)) {
    const r = focusedEl.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      if (gazeX >= r.left && gazeX <= r.right && gazeY >= r.top && gazeY <= r.bottom) {
        target = focusedEl;
      }
    }
  }

  if (!target) {
    for (const el of cachedTargets) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      if (gazeX >= r.left && gazeX <= r.right && gazeY >= r.top && gazeY <= r.bottom) {
        target = el;
        break;
      }
    }
  }

  if (target !== focusedEl) {
    if (focusedEl) {
      focusedEl.classList.remove("gaze-focus");
      updateProgressBar(0, focusedEl);
    }
    focusedEl = target;
    if (focusedEl) {
      focusedEl.classList.add("gaze-focus");
      focusStartTime = Date.now();
      eyeClosedSince = null;
      tongueOutSince = null;
    }
  }
  gazeBubbleEl.classList.toggle("target", !!focusedEl);

  const target2 = focusedEl;
  if (selectionEnabled && target2 && !isScrolling()) {
    const now2 = performance.now();
    let progressRatio = 0;

    if (eyeIsClosed) {
      if (eyeClosedSince === null) eyeClosedSince = now2;
      const elapsed = now2 - eyeClosedSince;
      progressRatio = Math.min(elapsed / BLINK_DURATION, 1);
      if (elapsed >= BLINK_DURATION) {
        eyeClosedSince = null;
        updateProgressBar(0, target2);
        gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
        fireSelection("Olho fechado", target2);
        return;
      }
    } else {
      eyeClosedSince = null;
    }

    if (tongueIsOut && tongueOutSince !== null) {
      const elapsed = now2 - tongueOutSince;
      const ratio = Math.min(elapsed / TONGUE_DURATION, 1);
      if (ratio > progressRatio) progressRatio = ratio;
      if (elapsed >= TONGUE_DURATION) {
        tongueOutSince = null;
        updateProgressBar(0, target2);
        gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
        fireSelection("Língua", target2);
        return;
      }
    }

    updateProgressBar(progressRatio, target2);
    gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - progressRatio);
  } else {
    gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
    updateProgressBar(0, focusedEl);
    if (!eyeIsClosed) eyeClosedSince = null;
    if (!tongueIsOut) tongueOutSince = null;
  }
}

function updateProgressBar(ratio, el) {
  const target = el || focusedEl;
  if (!target) return;
  let bar = target.querySelector(".gaze-progress-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "gaze-progress-bar";
    target.style.position = "relative";
    target.style.overflow = "hidden";
    target.appendChild(bar);
  }
  if (bar) bar.style.width = ratio * 100 + "%";
}

function fireSelection(gestureName, targetEl) {
  const el = targetEl || focusedEl;
  if (!el) return;
  haptic(50);

  const mode = el.dataset.mode;
  el.classList.add("gaze-selected");
  setTimeout(() => el.classList.remove("gaze-selected"), 600);

  gestureStatusTextEl.textContent = `✓ ${gestureName}!`;
  gestureDotEl.className = "status-dot active";

  if (mode) {
    showToast(`✓ Modo ${mode === "eye" ? "Olhar" : "Toque"} selecionado!`);
    setTimeout(() => startMode(mode), 500);
    return;
  }

  const id = el.id;
  if (id === "scanBtn") toggleScan();
  else if (id === "speakBtn") speak();
  else if (id === "clearBtn") clearText();
  else if (id === "homeBtn") goHome();
  else if (id === "calibrateBtn") openCalibration();
  else if (id === "historyBtn") openHistoryPanel();
  else if (id === "settingsBtn") openSettingsPanel();
  else if (id === "emergencyBtn") openEmergencyMenu("Botão");
  else if (id === "historyCloseBtn") closeHistoryPanel();
  else if (id === "settingsCloseBtn") closeSettingsPanel();
  else if (id === "historyClearBtn") clearHistory();
  else if (id === "settingsSaveBtn") saveSettingsFromPanel();
  else if (id === "emergencyHelpBtn") startEmergencyHelp();
  else if (id === "emergencyCallBtn") startEmergencyCall();
  else if (id === "emergencyCancelBtn") closeEmergencyMenu();
  else if (id === "emergencyStopBtn") stopEmergency();
  else if (id === "calibrationStartBtn") startCalibration();
  else if (id === "calibrationSkipBtn") skipCalibrationPoint();
  else if (id === "calibrationAbortBtn") abortCalibration();
  else if (el.classList.contains("quick-btn")) addPhrase(el.textContent.trim());
  else if (el.classList.contains("suggestion-btn")) applySuggestion(el.textContent.trim());
  else if (el.classList.contains("history-repeat-btn")) speakText(el.dataset.text || "");
  else if (el.classList.contains("key")) selectKeyElement(el);
  else if (typeof el.onclick === "function") el.onclick();
}

function scrollUp() {
  window.scrollBy({ top: -window.innerHeight * 0.6, behavior: "smooth" });
  showToast("▲ Subindo...");
}
function scrollDown() {
  window.scrollBy({ top: window.innerHeight * 0.6, behavior: "smooth" });
  showToast("▼ Descendo...");
}

function buildKeyboard() {
  keyboardEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  KEYS.forEach((k) => {
    const div = document.createElement("div");
    div.className = "key";
    div.textContent = k;
    div.dataset.gaze = "";
    div.setAttribute("role", "button");
    div.setAttribute("tabindex", "0");
    if (k === "ESPAÇO") div.classList.add("space");
    if (k === "⌫") div.classList.add("del");
    frag.appendChild(div);
  });
  keyboardEl.appendChild(frag);
}

function buildQuickPhrases() {
  quickPhrasesEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  QUICK_PHRASES.forEach((phrase) => {
    const btn = document.createElement("button");
    btn.className = "quick-btn";
    btn.dataset.gaze = "";
    btn.textContent = phrase;
    btn.onclick = () => addPhrase(phrase);
    frag.appendChild(btn);
  });
  quickPhrasesEl.appendChild(frag);
}

const getKeys = () => document.querySelectorAll(".key");

function startScan() {
  stopScan();
  scanIdx = 0;
  paused = false;
  scanBtnEl.textContent = "⏸ Pausar";
  scanBtnEl.classList.remove("paused");

  scanIv = setInterval(() => {
    if (paused || document.hidden) return;
    const ks = getKeys();
    if (!ks.length) return;
    ks.forEach((k) => k.classList.remove("scanning"));
    if (scanIdx >= ks.length) scanIdx = 0;
    ks[scanIdx].classList.add("scanning");
    scanIdx++;
  }, scanSpeed);
}

function stopScan() {
  clearInterval(scanIv);
  scanIv = null;
  getKeys().forEach((k) => k.classList.remove("scanning"));
}

function toggleScan() {
  paused = !paused;
  scanBtnEl.textContent = paused ? "▶ Retomar" : "⏸ Pausar";
  scanBtnEl.classList.toggle("paused", paused);
}

function selectKeyElement(el) {
  const v = el.textContent.trim();
  if (v === "ESPAÇO") txt += " ";
  else if (v === "⌫") txt = txt.slice(0, -1);
  else txt += v;
  updateOutput();
  el.classList.add("selected");
  setTimeout(() => el.classList.remove("selected"), 350);
  showToast("✓ Letra selecionada!");
  haptic(30);
  scanIdx = 0;
}

function updateOutput() {
  if (txt.length) {
    phEl.style.display = "none";
    curEl.style.display = "inline-block";
    outEl.textContent = txt;
  } else {
    phEl.style.display = "";
    curEl.style.display = "none";
    outEl.textContent = "";
  }
  scheduleSuggestionsUpdate();
}

function addPhrase(phrase) {
  if (txt.length && !txt.endsWith(" ")) txt += " ";
  txt += phrase;
  updateOutput();
  showToast("✓ Frase adicionada!");
  haptic(60);
  addToHistory(phrase);
  speak();
}

function speak() {
  const text = txt.trim();
  if (!text) {
    showToast("⚠️ Nada para falar");
    return;
  }
  speakText(text);
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    showToast("⚠️ Navegador sem suporte a voz");
    return;
  }
  try {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "pt-BR";
    utter.rate = 0.95;
    utter.volume = 1.0;
    const v = getPtVoice();
    if (v) utter.voice = v;
    speechSynthesis.speak(utter);
    addToHistory(text);
  } catch (err) {
    showToast("⚠️ Erro ao falar");
  }
}

function clearText() {
  txt = "";
  updateOutput();
}

function updateSpeed(v) {
  scanSpeed = parseInt(v);
  speedLblEl.textContent = (scanSpeed / 1000).toFixed(1) + "s";
  if (scanIv) startScan();
}

function showToast(msg = "✓ Selecionado!") {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function startMode(mode) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById("screenApp").classList.add("active");
  currentScreen = "app";
  currentMode = mode;
  modeBadgeEl.textContent = mode === "eye" ? "👁️ Olhar" : "👆 Toque";
  modeLblEl.textContent = mode === "eye" ? "Olhar" : "Toque";
  if (mode === "touch") startScan();
  else stopScan();
  clearFocusState();
  cachedTargets = [];
  cachedTargetsAt = 0;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goHome() {
  stopScan();
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById("screenHome").classList.add("active");
  currentScreen = "home";
  modeBadgeEl.textContent = "Início";
  txt = "";
  updateOutput();
  clearFocusState();
  calibrationActive = false;
  cachedTargets = [];
  cachedTargetsAt = 0;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearFocusState() {
  if (focusedEl) {
    focusedEl.classList.remove("gaze-focus");
    focusedEl = null;
  }
  gazeBubbleEl.classList.remove("target");
  focusStartTime = 0;
  eyeClosedSince = null;
  tongueOutSince = null;
  eyeStableCount = 0;
  tongueStableCount = 0;
  scrollHoldStart = 0;
  scrollLastDir = null;
  scrollReleaseAt = 0;
  scrollUpBtnEl.classList.remove("gaze-focus", "scrolling", "scroll-hover", "gaze-selected");
  scrollDownBtnEl.classList.remove("gaze-focus", "scrolling", "scroll-hover", "gaze-selected");
  updateProgressBar(0);
  gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
}

gazeToggleBtnEl.addEventListener("click", () => {
  selectionEnabled = !selectionEnabled;
  if (selectionEnabled) {
    gazeToggleBtnEl.textContent = "⏸ Pausar seleção";
    gazeToggleBtnEl.classList.remove("paused");
    gazeToggleBtnEl.setAttribute("aria-pressed", "false");
    gazeBubbleEl.classList.remove("disabled");
    showToast("✓ Seleção ativada");
  } else {
    gazeToggleBtnEl.textContent = "▶ Retomar seleção";
    gazeToggleBtnEl.classList.add("paused");
    gazeToggleBtnEl.setAttribute("aria-pressed", "true");
    gazeBubbleEl.classList.add("disabled");
    clearFocusState();
    showToast("⏸ Seleção pausada");
  }
});

function setupPanelHandlers() {
  historyCloseBtnEl.addEventListener("click", closeHistoryPanel);
  settingsCloseBtnEl.addEventListener("click", closeSettingsPanel);
  historyClearBtnEl.addEventListener("click", clearHistory);
  settingsSaveBtnEl.addEventListener("click", saveSettingsFromPanel);

  historyPanelEl.addEventListener("click", (e) => {
    if (e.target === historyPanelEl) closeHistoryPanel();
  });
  settingsPanelEl.addEventListener("click", (e) => {
    if (e.target === settingsPanelEl) closeSettingsPanel();
  });
}

function openHistoryPanel() {
  renderHistory();
  historyPanelEl.classList.add("visible");
  cachedTargets = [];
  cachedTargetsAt = 0;
}
function closeHistoryPanel() {
  historyPanelEl.classList.remove("visible");
  cachedTargets = [];
  cachedTargetsAt = 0;
}
function openSettingsPanel() {
  caregiverPhoneEl.value = caregiverPhone;
  emergencyMessageEl.value = emergencyMessage;
  callMessageEl.value = callMessage;
  hapticToggleEl.checked = hapticEnabled;
  suggestionsToggleEl.checked = suggestionsEnabled;
  lowPowerToggleEl.checked = lowPowerMode;
  settingsPanelEl.classList.add("visible");
  cachedTargets = [];
  cachedTargetsAt = 0;
}
function closeSettingsPanel() {
  settingsPanelEl.classList.remove("visible");
  cachedTargets = [];
  cachedTargetsAt = 0;
}

function saveSettingsFromPanel() {
  caregiverPhone = caregiverPhoneEl.value.trim();
  emergencyMessage = emergencyMessageEl.value.trim() || "Preciso de ajuda";
  callMessage = callMessageEl.value.trim() || "Preciso de ajuda";
  hapticEnabled = hapticToggleEl.checked;
  suggestionsEnabled = suggestionsToggleEl.checked;
  lowPowerMode = lowPowerToggleEl.checked;
  saveSettings();
  applyLowPowerClass();
  updateSuggestions();
  updateEmergencyCallDesc();
  showToast("✓ Configurações salvas");
  closeSettingsPanel();
}

function updateEmergencyCallDesc() {
  if (!emergencyCallDescEl) return;
  emergencyCallDescEl.textContent = caregiverPhone
    ? `Ligar para ${caregiverPhone}`
    : "Cadastre um telefone nas Configurações";
}

function renderHistory() {
  historyListEl.innerHTML = "";
  if (!phraseHistory.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Nenhuma frase ainda. Fale algo para começar!";
    historyListEl.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  phraseHistory.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const textSpan = document.createElement("span");
    textSpan.className = "history-item-text";
    textSpan.textContent = entry.text;

    const timeSpan = document.createElement("span");
    timeSpan.className = "history-item-time";
    const d = new Date(entry.time);
    timeSpan.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

    const repeatBtn = document.createElement("button");
    repeatBtn.className = "history-repeat-btn";
    repeatBtn.textContent = "🔊 Repetir";
    repeatBtn.dataset.gaze = "";
    repeatBtn.dataset.text = entry.text;

    item.appendChild(textSpan);
    item.appendChild(timeSpan);
    item.appendChild(repeatBtn);
    frag.appendChild(item);
  });
  historyListEl.appendChild(frag);
}

function clearHistory() {
  phraseHistory = [];
  saveHistory();
  renderHistory();
  showToast("✓ Histórico limpo");
}

let suggestionsTimer = null;
function scheduleSuggestionsUpdate() {
  if (suggestionsTimer) clearTimeout(suggestionsTimer);
  suggestionsTimer = setTimeout(updateSuggestions, 120);
}

function updateSuggestions() {
  if (!suggestionsEnabled) {
    suggestionsBoxEl.classList.remove("visible");
    return;
  }
  const text = txt.trimEnd();
  if (!text) {
    suggestionsBoxEl.classList.remove("visible");
    return;
  }

  const suggestions = new Set();
  for (const rule of SUGGESTION_MAP) {
    if (rule.prefix.test(text)) rule.items.forEach((i) => suggestions.add(i));
  }

  const lastWord = text.split(/\s+/).pop() || "";
  if (lastWord.length >= 2 && suggestions.size < 4) {
    const learned = new Set();
    for (const h of phraseHistory) {
      for (const w of h.text.split(/\s+/)) {
        if (w.toLowerCase().startsWith(lastWord.toLowerCase()) && w.toLowerCase() !== lastWord.toLowerCase()) {
          learned.add(w);
          if (learned.size >= 3) break;
        }
      }
      if (learned.size >= 3) break;
    }
    learned.forEach((w) => suggestions.add(w));
  }

  const items = Array.from(suggestions).slice(0, 4);
  if (!items.length) {
    suggestionsBoxEl.classList.remove("visible");
    return;
  }

  suggestionsListEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  items.forEach((s) => {
    const btn = document.createElement("button");
    btn.className = "suggestion-btn";
    btn.dataset.gaze = "";
    btn.textContent = s;
    btn.onclick = () => applySuggestion(s);
    frag.appendChild(btn);
  });
  suggestionsListEl.appendChild(frag);
  suggestionsBoxEl.classList.add("visible");
  cachedTargets = [];
  cachedTargetsAt = 0;
}

function applySuggestion(s) {
  const t = txt.trimEnd();
  const words = t.split(/\s+/);
  const lastWord = words[words.length - 1] || "";
  if (lastWord.length >= 2 && s.toLowerCase().startsWith(lastWord.toLowerCase())) {
    words[words.length - 1] = s;
    txt = words.join(" ") + " ";
  } else {
    if (txt.length && !txt.endsWith(" ")) txt += " ";
    txt += s + " ";
  }
  updateOutput();
  haptic(40);
  showToast("✓ Sugestão aplicada");
}

function setupEmergencyHandlers() {
  emergencyBtnEl.addEventListener("click", () => openEmergencyMenu("Botão"));
  emergencyHelpBtnEl.addEventListener("click", startEmergencyHelp);
  emergencyCallBtnEl.addEventListener("click", startEmergencyCall);
  emergencyCancelBtnEl.addEventListener("click", closeEmergencyMenu);
  emergencyStopBtnEl.addEventListener("click", stopEmergency);
  updateEmergencyCallDesc();
}

function openEmergencyMenu(source) {
  if (emergencyMode && emergencyMode !== "menu") return;
  emergencyMode = "menu";
  clearFocusState();

  emergencyOverlayEl.classList.remove("hidden");
  emergencyTextEl.textContent = "O que você precisa?";
  emergencyStopBtnEl.classList.add("hidden");
  emergencyOptionsEl.style.display = "flex";
  updateEmergencyCallDesc();

  cachedTargets = [];
  cachedTargetsAt = 0;

  showToast(`🚨 Menu de emergência (${source})`);
  haptic(80);
}

function startEmergencyHelp() {
  if (emergencyMode === "help") return;
  emergencyMode = "help";
  clearFocusState();

  emergencyTextEl.textContent = "Pedindo ajuda em voz alta...";
  emergencyOptionsEl.style.display = "none";
  emergencyStopBtnEl.classList.remove("hidden");

  speakLoop(emergencyMessage || "Preciso de ajuda");

  if (navigator.vibrate) {
    try { navigator.vibrate([300, 200, 300]); } catch (e) {}
    emergencyVibInterval = setInterval(() => {
      if (emergencyMode !== "help" && emergencyMode !== "call") {
        clearInterval(emergencyVibInterval);
        emergencyVibInterval = null;
        return;
      }
      try { navigator.vibrate([300, 200, 300]); } catch (e) {}
    }, 2500);
  }

  showToast("📢 Pedindo ajuda");
  cachedTargets = [];
  cachedTargetsAt = 0;
}

function startEmergencyCall() {
  if (emergencyMode === "call") return;
  if (!caregiverPhone) {
    showToast("⚠️ Cadastre um telefone nas Configurações");
    return;
  }
  emergencyMode = "call";
  clearFocusState();

  emergencyTextEl.textContent = `Ligando para ${caregiverPhone}...`;
  emergencyOptionsEl.style.display = "none";
  emergencyStopBtnEl.classList.remove("hidden");

  if (navigator.vibrate) {
    try { navigator.vibrate([300, 200, 300]); } catch (e) {}
  }

  const message = callMessage || emergencyMessage || "Preciso de ajuda";
  speakCallMessage(message, () => {
    setTimeout(() => {
      try {
        window.location.href = `tel:${caregiverPhone.replace(/\s+/g, "")}`;
      } catch (e) {}
    }, 500);
  });

  showToast("📞 Ligando para cuidador");
  cachedTargets = [];
  cachedTargetsAt = 0;
}

function speakCallMessage(text, onDone) {
  if (!("speechSynthesis" in window)) {
    onDone && onDone();
    return;
  }
  try {
    speechSynthesis.cancel();
    try { speechSynthesis.resume(); } catch (e) {}
    try { speechSynthesis.getVoices(); } catch (e) {}

    let called = false;
    const finish = () => {
      if (called) return;
      called = true;
      onDone && onDone();
    };

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "pt-BR";
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    const v = getPtVoice();
    if (v) utter.voice = v;

    utter.onend = finish;
    utter.onerror = finish;

    speechSynthesis.speak(utter);

    let safetyCounter = 0;
    const safety = setInterval(() => {
      safetyCounter++;
      if (called) { clearInterval(safety); return; }
      try {
        if (!speechSynthesis.speaking && !speechSynthesis.pending) {
          clearInterval(safety);
          finish();
        }
      } catch (e) {}
      if (safetyCounter > 20) {
        clearInterval(safety);
        finish();
      }
    }, 200);
  } catch (e) {
    onDone && onDone();
  }
}

function closeEmergencyMenu() {
  if (emergencyMode !== "menu") return;
  emergencyMode = null;
  emergencyOverlayEl.classList.add("hidden");
  if (!selectionEnabled) selectionEnabled = true;
  showToast("✓ Emergência cancelada");
  cachedTargets = [];
  cachedTargetsAt = 0;
}

function stopEmergency() {
  emergencyMode = null;
  stopSpeakLoop();
  if ("speechSynthesis" in window) {
    try { speechSynthesis.cancel(); } catch (e) {}
  }
  if (navigator.vibrate) {
    try { navigator.vibrate(0); } catch (e) {}
  }
  if (emergencyVibInterval) {
    clearInterval(emergencyVibInterval);
    emergencyVibInterval = null;
  }
  emergencyOverlayEl.classList.add("hidden");
  emergencyStopBtnEl.classList.add("hidden");
  emergencyOptionsEl.style.display = "flex";
  if (!selectionEnabled) selectionEnabled = true;
  showToast("✓ Emergência cancelada");
  cachedTargets = [];
  cachedTargetsAt = 0;
}

function speakLoop(text) {
  stopSpeakLoop();
  if (!("speechSynthesis" in window)) return;

  const run = () => {
    if (emergencyMode !== "help" && emergencyMode !== "call") return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "pt-BR";
      utter.rate = 1.0;
      utter.pitch = 1.1;
      utter.volume = 1.0;
      const v = getPtVoice();
      if (v) utter.voice = v;
      utter.onend = () => {
        if (emergencyMode === "help" || emergencyMode === "call") {
          emergencySpeakLoop = setTimeout(run, 600);
        }
      };
      utter.onerror = () => {
        if (emergencyMode === "help" || emergencyMode === "call") {
          emergencySpeakLoop = setTimeout(run, 1000);
        }
      };
      emergencyUtterance = utter;
      speechSynthesis.speak(utter);
    } catch (e) {
      emergencySpeakLoop = setTimeout(run, 1200);
    }
  };
  run();
}

function stopSpeakLoop() {
  if (emergencySpeakLoop) {
    clearTimeout(emergencySpeakLoop);
    emergencySpeakLoop = null;
  }
  emergencyUtterance = null;
}

function setupCalibrationHandlers() {
  calibrationStartBtnEl.addEventListener("click", startCalibration);
  calibrationSkipBtnEl.addEventListener("click", skipCalibrationPoint);
  calibrationAbortBtnEl.addEventListener("click", abortCalibration);
}

function openCalibration() {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById("screenCalibration").classList.add("active");
  calibrationIntroEl.classList.remove("hidden");
  calibrationStageEl.classList.add("hidden");
  calibrationDoneEl.classList.add("hidden");
  currentScreen = "calibration";
  cachedTargets = [];
  cachedTargetsAt = 0;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startCalibration() {
  calibrationActive = true;
  calibrationStep = 0;
  calibrationData = [];
  calibrationCurrentSamples = [];
  calibrationLastEye = null;
  calibrationStableSince = null;
  calibrationSampleStart = null;
  calibrationMovedEnough = false;
  calibrationPointStartedAt = performance.now();

  calibrationIntroEl.classList.add("hidden");
  calibrationStageEl.classList.remove("hidden");
  calibrationDoneEl.classList.add("hidden");

  calibrationPoints = [
    { x: 0.15, y: 0.20 },
    { x: 0.85, y: 0.20 },
    { x: 0.50, y: 0.50 },
    { x: 0.15, y: 0.80 },
    { x: 0.85, y: 0.80 },
  ];

  positionCalibrationTarget();
  showToast("🎯 Olhe para o círculo verde");
  cachedTargets = [];
  cachedTargetsAt = 0;
}

function positionCalibrationTarget() {
  if (calibrationStep >= CALIBRATION_TOTAL_STEPS) return;
  const point = calibrationPoints[calibrationStep];
  const canvasRect = calibrationCanvasEl.getBoundingClientRect();
  calibrationTargetEl.style.left = (canvasRect.width * point.x) + "px";
  calibrationTargetEl.style.top = (canvasRect.height * point.y) + "px";

  calibrationStepLabelEl.textContent = `Ponto ${calibrationStep + 1} de ${CALIBRATION_TOTAL_STEPS}`;
  calibrationProgressFillEl.style.width =
    ((calibrationStep / CALIBRATION_TOTAL_STEPS) * 100) + "%";
  calibrationInstructionEl.textContent = "Olhe para o círculo verde";
}

function updateCalibration(rawX, rawY, now) {
  if (calibrationStep >= CALIBRATION_TOTAL_STEPS) return;

  if (now - calibrationPointStartedAt > CALIBRATION_MAX_POINT_MS) {
    calibrationInstructionEl.textContent = "Avançando automaticamente...";
    finalizeCalibrationPoint();
    return;
  }

  if (calibrationLastEye === null) {
    calibrationLastEye = { x: rawX, y: rawY };
    calibrationMovedEnough = true;
    calibrationStableSince = now;
    return;
  }

  const dx = rawX - calibrationLastEye.x;
  const dy = rawY - calibrationLastEye.y;
  const moved = Math.sqrt(dx * dx + dy * dy);
  calibrationLastEye = { x: rawX, y: rawY };

  if (!calibrationMovedEnough) {
    if (moved > CALIBRATION_MOVE_THRESHOLD) {
      calibrationMovedEnough = true;
      calibrationStableSince = now;
      calibrationInstructionEl.textContent = "Muito bem! Continue olhando...";
    }
    return;
  }

  calibrationCurrentSamples.push({ x: rawX, y: rawY });
  if (calibrationCurrentSamples.length > 6) calibrationCurrentSamples.shift();

  let meanX = 0, meanY = 0;
  for (const s of calibrationCurrentSamples) { meanX += s.x; meanY += s.y; }
  meanX /= calibrationCurrentSamples.length;
  meanY /= calibrationCurrentSamples.length;

  let varX = 0, varY = 0;
  for (const s of calibrationCurrentSamples) {
    varX += (s.x - meanX) ** 2;
    varY += (s.y - meanY) ** 2;
  }
  const std = Math.sqrt((varX + varY) / calibrationCurrentSamples.length);

  if (std < 0.012) {
    if (calibrationStableSince === null) calibrationStableSince = now;
  } else {
    calibrationStableSince = now;
  }

  const stableFor = calibrationStableSince !== null ? now - calibrationStableSince : 0;

  if (stableFor >= CALIBRATION_STABLE_MS) {
    if (calibrationSampleStart === null) {
      calibrationSampleStart = now;
      calibrationInstructionEl.textContent = "Ótimo! Continue olhando...";
    }

    const sampleElapsed = now - calibrationSampleStart;
    const ratio = Math.min(sampleElapsed / CALIBRATION_SAMPLE_MS, 1);
    calibrationProgressFillEl.style.width =
      (((calibrationStep + ratio) / CALIBRATION_TOTAL_STEPS) * 100) + "%";

    if (sampleElapsed >= CALIBRATION_SAMPLE_MS) {
      calibrationData.push({
        eyeX: meanX,
        eyeY: meanY,
        targetX: calibrationPoints[calibrationStep].x,
        targetY: calibrationPoints[calibrationStep].y,
      });
      finalizeCalibrationPoint();
    }
  }
}

function skipCalibrationPoint() {
  if (!calibrationActive) return;
  if (calibrationCurrentSamples.length > 3) {
    let mx = 0, my = 0;
    for (const s of calibrationCurrentSamples) { mx += s.x; my += s.y; }
    mx /= calibrationCurrentSamples.length;
    my /= calibrationCurrentSamples.length;
    calibrationData.push({
      eyeX: mx, eyeY: my,
      targetX: calibrationPoints[calibrationStep].x,
      targetY: calibrationPoints[calibrationStep].y,
    });
  }
  finalizeCalibrationPoint();
}

function finalizeCalibrationPoint() {
  calibrationStep++;
  calibrationCurrentSamples = [];
  calibrationLastEye = null;
  calibrationStableSince = null;
  calibrationSampleStart = null;
  calibrationMovedEnough = false;
  calibrationPointStartedAt = performance.now();

  if (calibrationStep >= CALIBRATION_TOTAL_STEPS) {
    completeCalibration();
  } else {
    positionCalibrationTarget();
  }
}

function abortCalibration() {
  calibrationActive = false;
  goHome();
}

function completeCalibration() {
  calibrationActive = false;
  calibrationStageEl.classList.add("hidden");
  calibrationDoneEl.classList.remove("hidden");

  if (calibrationData.length < 3) {
    calibrationResolvedRanges.rangeX = 0.06;
    calibrationResolvedRanges.rangeY = 0.05;
  } else {
    let minEyeX = 1, maxEyeX = 0, minEyeY = 1, maxEyeY = 0;
    for (const d of calibrationData) {
      if (d.eyeX < minEyeX) minEyeX = d.eyeX;
      if (d.eyeX > maxEyeX) maxEyeX = d.eyeX;
      if (d.eyeY < minEyeY) minEyeY = d.eyeY;
      if (d.eyeY > maxEyeY) maxEyeY = d.eyeY;
    }

    const eyeRangeX = Math.max(maxEyeX - minEyeX, 0.025);
    const eyeRangeY = Math.max(maxEyeY - minEyeY, 0.02);

    calibrationResolvedRanges.rangeX = Math.min(eyeRangeX * 1.25, 0.25);
    calibrationResolvedRanges.rangeY = Math.min(eyeRangeY * 1.25, 0.20);
  }

  const data = {
    rangeX: calibrationResolvedRanges.rangeX,
    rangeY: calibrationResolvedRanges.rangeY,
    blinkDuration: BLINK_DURATION,
    eyeClosedRatio: EYE_CLOSED_RATIO,
    eyeOpenRatio: EYE_OPEN_RATIO,
    samples: calibrationData.length,
    timestamp: Date.now(),
  };
  saveCalibration(data);

  calibrationResultTextEl.textContent =
    `${calibrationData.length} de ${CALIBRATION_TOTAL_STEPS} pontos calibrados.`;
  showToast("✓ Calibração concluída!");
}

function setupKeyboardNavigation() {
  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    if (!active || !active.classList) return;

    if (active.classList.contains("key")) {
      const keys = Array.from(getKeys());
      const i = keys.indexOf(active);
      if (i < 0) return;
      const cols = window.innerWidth <= 420 ? 6 : window.innerWidth <= 600 ? 7 : 9;
      let next = null;
      if (e.key === "ArrowRight") next = keys[(i + 1) % keys.length];
      else if (e.key === "ArrowLeft") next = keys[(i - 1 + keys.length) % keys.length];
      else if (e.key === "ArrowDown") next = keys[Math.min(i + cols, keys.length - 1)];
      else if (e.key === "ArrowUp") next = keys[Math.max(i - cols, 0)];
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectKeyElement(active);
        return;
      }
      if (next) {
        e.preventDefault();
        next.focus();
      }
      return;
    }

    if ((e.key === "Enter" || e.key === " ") &&
        (active.getAttribute("role") === "button" || active.tagName === "BUTTON")) {
      e.preventDefault();
      active.click();
    }
  });
}

window.startMode = startMode;
window.goHome = goHome;
window.speak = speak;
window.clearText = clearText;
window.toggleScan = toggleScan;
window.updateSpeed = updateSpeed;
window.scrollUp = scrollUp;
window.scrollDown = scrollDown;