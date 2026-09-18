let txt = "";
let scanIdx = 0;
let scanIv = null;
let scanSpeed = 1200;
let paused = false;
let toastTimer = null;
let currentScreen = "home";

let camStream = null;
let faceMesh = null;
let mpCamera = null;
let cameraReady = false;

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

let faceDetected = false;
let lastFaceSeenAt = 0;
const FACE_TIMEOUT = 2500;
let faceBox = null;
let faceMissingFrames = 0;
const FACE_GRACE_FRAMES = 30;

const EYE_CLOSED_RATIO = 0.35;
const EYE_OPEN_RATIO = 0.5;
let eyeOpenRatioBaseline = null;
let eyeIsClosed = false;
let eyeClosedSince = null;
let eyeStableCount = 0;
const BLINK_DURATION = 1500;
const EYE_STABLE_FRAMES = 3;

let tongueOutSince = null;
let tongueIsOut = false;
const TONGUE_DURATION = 1200;
let tongueRatioBaseline = null;
let tongueStableCount = 0;
const TONGUE_STABLE_FRAMES = 3;

let focusedEl = null;
let focusStartTime = 0;

let selectionEnabled = true;

let scrollHoldStart = 0;
let scrollLastDir = null;
let scrollReleaseAt = 0;
const SCROLL_HOLD_DELAY = 500;
const SCROLL_RELEASE_GRACE = 250;
const SCROLL_SPEED_SLOW = 6;
const SCROLL_SPEED_MED = 12;
const SCROLL_SPEED_FAST = 20;

let voiceUnlocked = false;

const gazeBubbleEl = document.getElementById("gazeBubble");
const gazeRingFillEl = document.getElementById("gazeRingFill");
const gazeDotEl = document.getElementById("gazeDot");
const gazeStatusTextEl = document.getElementById("gazeStatusText");
const gazeToggleBtnEl = document.getElementById("gazeToggleBtn");
const camLoadingEl = document.getElementById("camLoading");
const voiceGateEl = document.getElementById("voiceGate");
const voiceGateBtnEl = document.getElementById("voiceGateBtn");

const phEl = document.getElementById("ph");
const outEl = document.getElementById("out");
const curEl = document.getElementById("cur");
const keyboardEl = document.getElementById("keyboard");
const quickPhrasesEl = document.getElementById("quickPhrases");
const modeBadgeEl = document.getElementById("modeBadge");
const modeLblEl = document.getElementById("modeLbl");
const scanBtnEl = document.getElementById("scanBtn");
const speedLblEl = document.getElementById("speedLbl");
const toastEl = document.getElementById("toast");

const camDotEl = document.getElementById("camDot");
const camStatusTextEl = document.getElementById("camStatusText");
const faceDotEl = document.getElementById("faceDot");
const faceStatusTextEl = document.getElementById("faceStatusText");
const gestureDotEl = document.getElementById("gestureDot");
const gestureStatusTextEl = document.getElementById("gestureStatusText");

const scrollUpBtnEl = document.getElementById("scrollUpBtn");
const scrollDownBtnEl = document.getElementById("scrollDownBtn");

const RING_CIRCUMFERENCE = 2 * Math.PI * 46;

const KEYS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "ESPAÇO",
  "⌫",
];

const QUICK_PHRASES = [
  "Sim",
  "Não",
  "Estou bem",
  "Preciso de água",
  "Chame alguém",
  "Obrigado",
  "Ajuda",
  "Estou com fome",
  "Estou com duvida",
  "Pode explicar novamente?",
  "Estou com dor",
];

const scrollUpProgress = document.createElement("div");
scrollUpProgress.className = "scroll-progress";
scrollUpBtnEl.appendChild(scrollUpProgress);

const scrollDownProgress = document.createElement("div");
scrollDownProgress.className = "scroll-progress";
scrollDownBtnEl.appendChild(scrollDownProgress);

window.addEventListener("DOMContentLoaded", async () => {
  gazeRingFillEl.style.strokeDasharray = RING_CIRCUMFERENCE;
  gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
  buildQuickPhrases();
  buildKeyboard();
  camOverlayCtx = camOverlayEl.getContext("2d");
  initVoices();
  setupVoiceGate();

  await initCamera();
  startGazeLoop();

  scrollUpBtnEl.addEventListener("click", () => scrollUp());
  scrollDownBtnEl.addEventListener("click", () => scrollDown());
});

function initVoices() {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.getVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  }
}

function setupVoiceGate() {
  if (!("speechSynthesis" in window)) {
    voiceGateEl.classList.add("hidden");
    voiceUnlocked = true;
    return;
  }

  const activate = (e) => {
    if (voiceUnlocked) return;
    e.stopPropagation();

    try {
      speechSynthesis.cancel();
      const greeting = new SpeechSynthesisUtterance("Voz ativada");
      greeting.lang = "pt-BR";
      greeting.rate = 1.0;
      greeting.pitch = 1.0;
      greeting.volume = 1.0;

      const voices = speechSynthesis.getVoices();
      const ptVoice = voices.find(
        (v) => v.lang && v.lang.toLowerCase().startsWith("pt"),
      );
      if (ptVoice) greeting.voice = ptVoice;

      greeting.onend = () => {
        voiceUnlocked = true;
        voiceGateEl.classList.add("hidden");
        showToast("✓ Voz ativada!");
      };

      greeting.onerror = () => {
        voiceUnlocked = true;
        voiceGateEl.classList.add("hidden");
        showToast("✓ Voz ativada!");
      };

      speechSynthesis.speak(greeting);

      setTimeout(() => {
        voiceUnlocked = true;
        voiceGateEl.classList.add("hidden");
      }, 800);
    } catch (err) {
      console.warn(err);
      voiceUnlocked = true;
      voiceGateEl.classList.add("hidden");
    }
  };

  voiceGateBtnEl.addEventListener("click", activate);
  voiceGateEl.addEventListener("click", activate);
  voiceGateEl.addEventListener("touchstart", activate, { passive: true });
  document.addEventListener(
    "keydown",
    (e) => {
      if (!voiceUnlocked) activate(e);
    },
    { once: true },
  );
}

async function initCamera() {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 },
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

    if (typeof FaceMesh === "undefined") {
      throw new Error("FaceMesh não carregado");
    }

    faceMesh = new FaceMesh({
      locateFile: (f) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    faceMesh.onResults(onFaceResults);

    mpCamera = new Camera(camVideoEl, {
      onFrame: async () => await faceMesh.send({ image: camVideoEl }),
      width: 640,
      height: 480,
    });
    mpCamera.start();

    cameraReady = true;
    camLoadingEl.classList.add("hidden");
    gazeBubbleEl.classList.add("active");
    camPreviewEl.classList.remove("hidden");
    camDotEl.className = "status-dot active";
    camStatusTextEl.textContent = "Câmera ativa";
  } catch (e) {
    console.error(e);
    camLoadingEl.classList.add("hidden");
    setGazeStatus("error", "⚠️ Câmera indisponível — use o toque");
    camPreviewEl.classList.add("hidden");
    camDotEl.className = "status-dot error";
    camStatusTextEl.textContent = "Câmera indisponível";
  }
}

function setGazeStatus(state, text) {
  gazeDotEl.className = "gaze-dot " + state;
  gazeStatusTextEl.textContent = text;
}

function onFaceResults(results) {
  const now = Date.now();
  const hasFace =
    results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

  if (!hasFace) {
    faceMissingFrames++;
    faceDetected = false;
    faceBox = null;

    if (
      now - lastFaceSeenAt > FACE_TIMEOUT &&
      faceMissingFrames > FACE_GRACE_FRAMES
    ) {
      if (selectionEnabled) {
        selectionEnabled = false;
        gazeBubbleEl.classList.add("disabled");
        setGazeStatus("warn", "👤 Nenhum rosto — seleção pausada");
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
  lastFaceSeenAt = now;

  if (!selectionEnabled) {
    selectionEnabled = true;
    gazeBubbleEl.classList.remove("disabled");
    setGazeStatus("active", "Rastreamento ativo");
  }
  camPreviewEl.classList.remove("no-face");
  camPreviewEl.classList.add("face-detected");
  camPreviewLabelEl.textContent = "✓ Rosto detectado";
  faceDotEl.className = "status-dot active";
  faceStatusTextEl.textContent = "Rosto detectado";

  const lm = results.multiFaceLandmarks[0];

  let minX = 1,
    maxX = 0,
    minY = 1,
    maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const marginX = (maxX - minX) * 0.12;
  const marginY = (maxY - minY) * 0.12;
  faceBox = {
    x: Math.max(0, minX - marginX),
    y: Math.max(0, minY - marginY),
    w: Math.min(1, maxX + marginX) - Math.max(0, minX - marginX),
    h: Math.min(1, maxY + marginY) - Math.max(0, minY - marginY),
  };
  drawOverlay(faceBox);

  const leftIris = lm[468] || lm[33];
  const rightIris = lm[473] || lm[263];
  const eyeCenterX = (leftIris.x + rightIris.x) / 2;
  const eyeCenterY = (leftIris.y + rightIris.y) / 2;

  const mirroredX = 1 - eyeCenterX;

  const rangeX = 0.5;
  const rangeY = 0.42;
  const rawScreenX =
    ((mirroredX - (0.5 - rangeX / 2)) / rangeX) * window.innerWidth;
  const rawScreenY =
    ((eyeCenterY - (0.5 - rangeY / 2)) / rangeY) * window.innerHeight;

  const deadZone = 3;
  const dx = rawScreenX - smoothX;
  const dy = rawScreenY - smoothY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > deadZone) {
    const damping = 0.3;
    velocityX = velocityX * 0.65 + dx * damping;
    velocityY = velocityY * 0.65 + dy * damping;
  } else {
    velocityX *= 0.85;
    velocityY *= 0.85;
  }

  smoothX += velocityX;
  smoothY += velocityY;

  gazeX = Math.max(20, Math.min(window.innerWidth - 20, smoothX));
  gazeY = Math.max(20, Math.min(window.innerHeight - 20, smoothY));

  const leftEyeTop = lm[159].y;
  const leftEyeBottom = lm[145].y;
  const rightEyeTop = lm[386].y;
  const rightEyeBottom = lm[374].y;

  const leftEyeHeight = Math.abs(leftEyeBottom - leftEyeTop);
  const rightEyeHeight = Math.abs(rightEyeBottom - rightEyeTop);
  const eyeHeight = (leftEyeHeight + rightEyeHeight) / 2;

  const leftEyeCornerA = lm[33];
  const leftEyeCornerB = lm[133];
  const rightEyeCornerA = lm[362];
  const rightEyeCornerB = lm[263];

  const leftEyeWidth = Math.abs(leftEyeCornerB.x - leftEyeCornerA.x);
  const rightEyeWidth = Math.abs(rightEyeCornerB.x - rightEyeCornerA.x);
  const eyeWidth = (leftEyeWidth + rightEyeWidth) / 2;

  const eyeAspectRatio = eyeHeight / Math.max(eyeWidth, 0.001);

  if (eyeOpenRatioBaseline === null) {
    eyeOpenRatioBaseline = eyeAspectRatio;
  } else if (eyeAspectRatio > eyeOpenRatioBaseline) {
    eyeOpenRatioBaseline = eyeOpenRatioBaseline * 0.98 + eyeAspectRatio * 0.02;
  } else if (eyeAspectRatio > eyeOpenRatioBaseline * 0.7) {
    eyeOpenRatioBaseline =
      eyeOpenRatioBaseline * 0.998 + eyeAspectRatio * 0.002;
  }

  const closedRatio = eyeAspectRatio / Math.max(eyeOpenRatioBaseline, 0.001);
  const rawClosed = closedRatio < EYE_CLOSED_RATIO;
  const rawOpen = closedRatio > EYE_OPEN_RATIO;

  if (eyeIsClosed) {
    if (rawOpen) {
      eyeStableCount++;
      if (eyeStableCount >= EYE_STABLE_FRAMES) {
        eyeIsClosed = false;
        eyeStableCount = 0;
      }
    } else {
      eyeStableCount = 0;
    }
  } else {
    if (rawClosed) {
      eyeStableCount++;
      if (eyeStableCount >= EYE_STABLE_FRAMES) {
        eyeIsClosed = true;
        eyeStableCount = 0;
      }
    } else {
      eyeStableCount = 0;
    }
  }

  const wasClosed = eyeIsClosed;

  const upperLip = lm[13];
  const lowerLip = lm[14];
  const mouthOpen = Math.abs(lowerLip.y - upperLip.y);

  const noseTip = lm[1];
  const chin = lm[152];
  const faceHeight = Math.abs(chin.y - noseTip.y);

  const mouthRatio = mouthOpen / Math.max(faceHeight, 0.001);

  if (tongueRatioBaseline === null) {
    tongueRatioBaseline = mouthRatio;
  } else if (mouthRatio < tongueRatioBaseline * 1.3) {
    tongueRatioBaseline = tongueRatioBaseline * 0.97 + mouthRatio * 0.03;
  }

  const tongueThreshold = tongueRatioBaseline * 2.0;
  const rawTongue = mouthRatio > tongueThreshold && mouthRatio > 0.06;

  if (rawTongue) {
    tongueStableCount++;
  } else {
    tongueStableCount = Math.max(0, tongueStableCount - 1);
  }

  const tongueDetected = tongueStableCount >= TONGUE_STABLE_FRAMES;

  if (tongueDetected) {
    if (tongueOutSince === null) tongueOutSince = now;
  } else if (tongueStableCount === 0) {
    tongueOutSince = null;
  }
  tongueIsOut = tongueOutSince !== null;

  if (eyeIsClosed) {
    gestureDotEl.className = "status-dot active";
    gestureStatusTextEl.textContent = "👁️ Olho fechado";
  } else if (tongueIsOut) {
    gestureDotEl.className = "status-dot active";
    gestureStatusTextEl.textContent = "👅 Língua detectada";
  } else {
    gestureDotEl.className = "status-dot";
    gestureStatusTextEl.textContent = "—";
  }

  const target = focusedEl;

  if (selectionEnabled && target && !isScrolling()) {
    let progressRatio = 0;

    if (eyeIsClosed) {
      if (eyeClosedSince === null) eyeClosedSince = now;
      const elapsed = now - eyeClosedSince;
      progressRatio = Math.min(elapsed / BLINK_DURATION, 1);
      if (elapsed >= BLINK_DURATION) {
        eyeClosedSince = null;
        updateProgressBar(0, target);
        gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
        fireSelection("Piscada", target);
        return;
      }
    } else if (wasClosed) {
      eyeClosedSince = null;
    }

    if (tongueIsOut && tongueOutSince !== null) {
      const elapsed = now - tongueOutSince;
      const ratio = Math.min(elapsed / TONGUE_DURATION, 1);
      if (ratio > progressRatio) progressRatio = ratio;
      if (elapsed >= TONGUE_DURATION) {
        tongueOutSince = null;
        updateProgressBar(0, target);
        gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
        fireSelection("Língua", target);
        return;
      }
    }

    updateProgressBar(progressRatio, target);
    gazeRingFillEl.style.strokeDashoffset =
      RING_CIRCUMFERENCE * (1 - progressRatio);
  } else {
    gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
    updateProgressBar(0, focusedEl);
    if (!eyeIsClosed) eyeClosedSince = null;
    if (!tongueIsOut) tongueOutSince = null;
  }
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

  camOverlayCtx.strokeStyle = "#10b981";
  camOverlayCtx.lineWidth = 3;
  camOverlayCtx.shadowColor = "#10b981";
  camOverlayCtx.shadowBlur = 10;

  const cornerLen = Math.min(bw, bh) * 0.25;

  camOverlayCtx.beginPath();
  camOverlayCtx.moveTo(x, y + cornerLen);
  camOverlayCtx.lineTo(x, y);
  camOverlayCtx.lineTo(x + cornerLen, y);
  camOverlayCtx.moveTo(x + bw - cornerLen, y);
  camOverlayCtx.lineTo(x + bw, y);
  camOverlayCtx.lineTo(x + bw, y + cornerLen);
  camOverlayCtx.moveTo(x + bw, y + bh - cornerLen);
  camOverlayCtx.lineTo(x + bw, y + bh);
  camOverlayCtx.lineTo(x + bw - cornerLen, y + bh);
  camOverlayCtx.moveTo(x + cornerLen, y + bh);
  camOverlayCtx.lineTo(x, y + bh);
  camOverlayCtx.lineTo(x, y + bh - cornerLen);
  camOverlayCtx.stroke();

  camOverlayCtx.shadowBlur = 0;
}

function startGazeLoop() {
  function loop() {
    gazeBubbleEl.style.left = gazeX + "px";
    gazeBubbleEl.style.top = gazeY + "px";

    updateScrollButtons();
    updateFocusFromGaze();

    gazeRafId = requestAnimationFrame(loop);
  }
  loop();
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
  const upRect = scrollUpBtnEl.getBoundingClientRect();
  const downRect = scrollDownBtnEl.getBoundingClientRect();

  const pad = 8;
  const overUp =
    gazeX >= upRect.left - pad &&
    gazeX <= upRect.right + pad &&
    gazeY >= upRect.top - pad &&
    gazeY <= upRect.bottom + pad;
  const overDown =
    gazeX >= downRect.left - pad &&
    gazeX <= downRect.right + pad &&
    gazeY >= downRect.top - pad &&
    gazeY <= downRect.bottom + pad;

  let dir = null;
  if (overUp && !overDown) dir = "up";
  else if (overDown && !overUp) dir = "down";

  if (dir !== null) {
    scrollReleaseAt = now + SCROLL_RELEASE_GRACE;
  } else if (now < scrollReleaseAt && scrollLastDir) {
    dir = scrollLastDir;
  }

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
    scrollUpBtnEl.classList.toggle(
      "scroll-hover",
      dir === "up" && !scrollUpBtnEl.classList.contains("scrolling"),
    );
    scrollDownBtnEl.classList.toggle(
      "scroll-hover",
      dir === "down" && !scrollDownBtnEl.classList.contains("scrolling"),
    );

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

function updateFocusFromGaze() {
  if (!selectionEnabled) {
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

  const activeScreen = document.querySelector(".screen.active");
  if (!activeScreen) return;

  const candidates = Array.from(
    activeScreen.querySelectorAll("[data-gaze], .mode-card"),
  ).filter((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
    return (
      gazeX >= rect.left &&
      gazeX <= rect.right &&
      gazeY >= rect.top &&
      gazeY <= rect.bottom
    );
  });

  let target = null;

  if (focusedEl && candidates.includes(focusedEl)) {
    target = focusedEl;
  } else {
    target = candidates[0] || null;
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
}

function updateProgressBar(ratio, el) {
  const target = el || focusedEl;
  if (!target) return;
  let bar = target.querySelector(".gaze-progress-bar");
  if (!bar) {
    if (
      target.tagName === "BUTTON" ||
      target.classList.contains("ctrl-btn") ||
      target.classList.contains("quick-btn") ||
      target.classList.contains("scroll-btn") ||
      target.classList.contains("key")
    ) {
      bar = document.createElement("div");
      bar.className = "gaze-progress-bar";
      target.style.position = "relative";
      target.style.overflow = "hidden";
      target.appendChild(bar);
    }
  }
  if (bar) bar.style.width = ratio * 100 + "%";
}

function fireSelection(gestureName, targetEl) {
  const el = targetEl || focusedEl;
  if (!el) return;

  const mode = el.dataset.mode;

  el.classList.add("gaze-selected");
  setTimeout(() => el.classList.remove("gaze-selected"), 600);
  gazeBubbleEl.classList.add("blinking");
  setTimeout(() => gazeBubbleEl.classList.remove("blinking"), 400);

  gestureStatusTextEl.textContent = `✓ ${gestureName}!`;
  gestureDotEl.className = "status-dot active";

  if (mode) {
    showToast(`✓ Modo ${mode === "eye" ? "Olhar" : "Toque"} selecionado!`);
    setTimeout(() => startMode(mode), 500);
    return;
  }

  if (el.id === "scanBtn") {
    toggleScan();
  } else if (el.id === "speakBtn") {
    speak();
  } else if (el.id === "clearBtn") {
    clearText();
  } else if (el.id === "homeBtn") {
    goHome();
  } else if (el.classList.contains("quick-btn")) {
    addPhrase(el.textContent.trim());
  } else if (el.classList.contains("key")) {
    selectKeyElement(el);
  } else if (typeof el.onclick === "function") {
    el.onclick();
  }
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
  KEYS.forEach((k) => {
    const div = document.createElement("div");
    div.className = "key";
    div.textContent = k;
    div.dataset.gaze = "";
    if (k === "ESPAÇO") div.classList.add("space");
    if (k === "⌫") div.classList.add("del");
    keyboardEl.appendChild(div);
  });
}

function buildQuickPhrases() {
  quickPhrasesEl.innerHTML = "";
  QUICK_PHRASES.forEach((phrase) => {
    const btn = document.createElement("button");
    btn.className = "quick-btn";
    btn.dataset.gaze = "";
    btn.textContent = phrase;
    btn.onclick = () => addPhrase(phrase);
    quickPhrasesEl.appendChild(btn);
  });
}

const getKeys = () => document.querySelectorAll(".key");

function startScan() {
  stopScan();
  scanIdx = 0;
  paused = false;
  scanBtnEl.textContent = "⏸ Pausar";
  scanBtnEl.classList.remove("paused");

  scanIv = setInterval(() => {
    if (paused) return;
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

function selectCurrent() {
  const ks = getKeys();
  const idx = scanIdx - 1;
  if (idx < 0 || idx >= ks.length) return;
  selectKeyElement(ks[idx]);
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
}

function addPhrase(phrase) {
  if (txt.length && !txt.endsWith(" ")) txt += " ";
  txt += phrase;
  updateOutput();
  showToast("✓ Frase adicionada!");
  speak();
}

function speak() {
  const text = txt.trim();
  if (!text) {
    showToast("⚠️ Nada para falar");
    return;
  }

  if (!("speechSynthesis" in window)) {
    showToast("⚠️ Navegador sem suporte a voz");
    return;
  }

  try {
    speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "pt-BR";
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.volume = 1.0;

    const voices = speechSynthesis.getVoices();
    const ptVoice = voices.find(
      (v) => v.lang && v.lang.toLowerCase().startsWith("pt"),
    );
    if (ptVoice) utter.voice = ptVoice;

    utter.onstart = () => {
      gestureStatusTextEl.textContent = "🔊 Falando...";
    };
    utter.onend = () => {
      gestureStatusTextEl.textContent = "—";
    };
    utter.onerror = (e) => {
      console.warn("TTS error", e);
      gestureStatusTextEl.textContent = "—";
    };

    speechSynthesis.speak(utter);

    setTimeout(() => {
      if (speechSynthesis.paused) speechSynthesis.resume();
    }, 100);
  } catch (err) {
    console.error(err);
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
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1500);
}

function startMode(mode) {
  document.getElementById("screenHome").classList.remove("active");
  document.getElementById("screenApp").classList.add("active");
  currentScreen = "app";
  modeBadgeEl.textContent = mode === "eye" ? "👁️ Olhar" : "👆 Toque";
  modeLblEl.textContent = mode === "eye" ? "Olhar" : "Toque";
  startScan();
  clearFocusState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goHome() {
  stopScan();
  document.getElementById("screenApp").classList.remove("active");
  document.getElementById("screenHome").classList.add("active");
  currentScreen = "home";
  modeBadgeEl.textContent = "Início";
  txt = "";
  updateOutput();
  clearFocusState();
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
  scrollUpBtnEl.classList.remove(
    "gaze-focus",
    "scrolling",
    "scroll-hover",
    "gaze-selected",
  );
  scrollDownBtnEl.classList.remove(
    "gaze-focus",
    "scrolling",
    "scroll-hover",
    "gaze-selected",
  );
  updateProgressBar(0);
  gazeRingFillEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
}

gazeToggleBtnEl.addEventListener("click", () => {
  selectionEnabled = !selectionEnabled;
  if (selectionEnabled) {
    gazeToggleBtnEl.textContent = "⏸ Pausar seleção";
    gazeToggleBtnEl.classList.remove("paused");
    gazeBubbleEl.classList.remove("disabled");
    showToast("✓ Seleção ativada");
  } else {
    gazeToggleBtnEl.textContent = "▶ Retomar seleção";
    gazeToggleBtnEl.classList.add("paused");
    gazeBubbleEl.classList.add("disabled");
    clearFocusState();
    showToast("⏸ Seleção pausada");
  }
});

window.startMode = startMode;
window.goHome = goHome;
window.speak = speak;
window.clearText = clearText;
window.toggleScan = toggleScan;
window.updateSpeed = updateSpeed;
window.scrollUp = scrollUp;
window.scrollDown = scrollDown;
