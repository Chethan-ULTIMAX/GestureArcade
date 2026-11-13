import { GestureInput } from "../../vision/GestureInput.js";
import {
  BOARD,
  createCarromRack,
  createStriker,
  isCarromSettled,
  isValidStrikerLineup,
  stepCarromPhysics
} from "./CarromPhysics.js";
import "./carrom.css";

const VIEWS = [
  { id: "white-top", label: "White · top", angle: 0, tilt: 53 },
  { id: "black-top", label: "Black · top", angle: 180, tilt: 53 },
  { id: "white-left", label: "White · left", angle: 27, tilt: 53 },
  { id: "white-right", label: "White · right", angle: -27, tilt: 53 },
  { id: "black-left", label: "Black · left", angle: 153, tilt: 53 },
  { id: "black-right", label: "Black · right", angle: -153, tilt: 53 },
  { id: "top-middle", label: "Top · middle", angle: 0, tilt: 0 }
];

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15],
  [15, 16], [5, 17], [17, 18], [18, 19], [19, 20], [0, 17]
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const length = (x, y) => Math.hypot(x, y);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const deepClone = (value) => JSON.parse(JSON.stringify(value));

function icon(name) {
  const paths = {
    back: '<path d="M19 12H5m7 7-7-7 7-7"/>',
    reset: '<path d="M3 12a9 9 0 1 0 2.7-6.4L3 8"/><path d="M3 3v5h5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-1"/>',
    camera: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 6 1.2-2h5.6L16 6"/><circle cx="12" cy="13" r="3"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

export class CarromGame {
  async mount({ root, onExit }) {
    this.root = root;
    this.onExit = onExit;
    this.input = new GestureInput();
    this.view = VIEWS[0];
    this.turn = "white";
    this.breakSide = "white";
    this.scores = { white: 0, black: 0 };
    this.boardsPlayed = 0;
    this.boardNumber = 1;
    this.pocketed = { white: [], black: [] };
    this.due = { white: 0, black: 0 };
    this.queenCoveredBy = null;
    this.queenPendingBy = null;
    this.phase = "ready";
    this.selectedAim = null;
    this.shotPockets = [];
    this.shotHistory = [];
    this.shotLog = [];
    this.effects = [];
    this.pointerWorld = null;
    this.cursorPoint = null;
    this.smoothedPoint = null;
    this.pinchActive = false;
    this.pinchStartFrames = 0;
    this.pinchEndFrames = 0;
    this.openPalmFrames = 0;
    this.lastHandSeen = 0;
    this.cameraEnabled = false;
    this.matchFinished = false;
    this.boardFinished = false;
    this.lastToastTimer = 0;
    this.lastFrameTime = 0;
    this.frameId = 0;
    this.disposed = false;
    this.resizeObserver = null;

    this.coins = createCarromRack();
    this.striker = createStriker(this.turn);
    root.innerHTML = this.renderShell();
    this.cacheElements();
    this.bindEvents();
    this.resizeCanvas();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvas);
    this.resizeHandler = () => this.resizeCanvas();
    window.addEventListener("resize", this.resizeHandler);
    this.input.addEventListener("trackingerror", (event) => {
      this.showToast(event.detail?.message || "Hand tracking paused. Try again.");
    });
    this.updateView();
    this.renderHUD();
    this.drawFrame();
    this.frameId = requestAnimationFrame((time) => this.animate(time));
  }

  renderShell() {
    return [
      '<div class="ga-carrom">',
        '<header class="ga-carrom-topbar">',
          '<button class="ga-carrom-back" type="button" data-exit>' + icon("back") + '<span>ARCADE</span></button>',
          '<div class="ga-carrom-brand"><span class="ga-carrom-mark">C</span><div><strong>GESTURE<span>CARROM</span></strong><small>SPATIAL PLAY / 02</small></div></div>',
          '<div class="ga-carrom-actions"><span class="ga-carrom-live"><i></i> LOCAL MATCH</span><button type="button" class="ga-carrom-icon-btn" data-undo title="Undo last shot">' + icon("undo") + '<span>UNDO</span></button><button type="button" class="ga-carrom-reset" data-reset>' + icon("reset") + '<span>NEW MATCH</span></button></div>',
        '</header>',
        '<main class="ga-carrom-layout">',
          '<section class="ga-carrom-main">',
            '<div class="ga-carrom-player ga-carrom-player--black" id="black-player"><span class="ga-carrom-player-token token-black"></span><div><strong>BLACK</strong><small>PLAYER 02 · TOP BASELINE</small></div><b id="black-status">WAITING</b></div>',
            '<div class="ga-carrom-stage" id="carrom-stage">',
              '<div class="ga-carrom-board-glow"></div>',
              '<canvas id="carrom-board" width="1000" height="1000" aria-label="Interactive carrom board. Move the striker along your baseline, then pull back and release to shoot." tabindex="0"></canvas>',
              '<div class="ga-carrom-cursor" id="carrom-cursor" aria-hidden="true"><i></i><span>POINT</span></div>',
              '<section class="ga-carrom-camera" id="camera-float" aria-label="Hand tracking camera">',
                '<div class="ga-carrom-camera-head"><span><i></i> HAND TRACKING</span><button type="button" data-camera-minimize aria-label="Minimize camera preview">−</button></div>',
                '<div class="ga-carrom-camera-screen"><video id="carrom-video" autoplay muted playsinline></video><canvas id="carrom-hand-overlay"></canvas><div class="ga-carrom-camera-placeholder" id="camera-placeholder"><span>' + icon("camera") + '</span><strong>CAMERA OFF</strong><small>Enable hand control to aim and flick</small></div><em>LOCAL / LIVE</em></div>',
                '<div class="ga-carrom-camera-foot"><span id="camera-state">READY WHEN YOU ARE</span><button type="button" data-camera-toggle id="camera-toggle">ENABLE</button></div>',
              '</section>',
              '<div class="ga-carrom-overlay" id="board-result" hidden><div class="ga-carrom-result-card"><span class="ga-carrom-result-star">✦</span><small id="result-eyebrow">BOARD COMPLETE</small><h2 id="result-title">WHITE WINS</h2><p id="result-copy"></p><button type="button" data-next-board id="next-board">NEXT BOARD ↗</button></div></div>',
            '</div>',
            '<div class="ga-carrom-aim-hint"><span class="ga-carrom-hint-dot"></span><div><strong>POSITION · PINCH · PULL BACK · RELEASE</strong><small>Point along your baseline to position the striker. Pinch it, pull away from your target, then release to shoot.</small></div><span class="ga-carrom-hint-badge">2 PLAYER / LOCAL</span></div>',
            '<div class="ga-carrom-view-panel"><div class="ga-carrom-view-title"><span>CAMERA VIEWS</span><small>7 FIXED ANGLES · SAME AS CHESS</small></div><div class="ga-carrom-view-list" id="view-list">' +
              VIEWS.map((view) => '<button type="button" class="ga-carrom-view-btn' + (view.id === this.view.id ? ' is-active' : '') + '" data-view="' + view.id + '">' + escapeHTML(view.label) + '</button>').join("") +
            '</div></div>',
            '<div class="ga-carrom-player ga-carrom-player--white" id="white-player"><span class="ga-carrom-player-token token-white"></span><div><strong>WHITE</strong><small>PLAYER 01 · BOTTOM BASELINE</small></div><b id="white-status">YOUR TURN</b></div>',
          '</section>',
          '<aside class="ga-carrom-side">',
            '<section class="ga-carrom-turn-card" id="turn-card"><div class="ga-carrom-card-head"><span>MATCH STATUS</span><b id="board-number">BOARD 01 / 08</b></div><div class="ga-carrom-turn-main"><span class="ga-carrom-turn-coin" id="turn-coin"></span><div><small id="turn-eyebrow">WHITE TO BREAK</small><h2 id="turn-title">Line it up.</h2></div></div><p id="turn-description">Position your striker on the bottom baseline, then pull back and release.</p><div class="ga-carrom-meter"><span id="turn-progress"></span></div><div class="ga-carrom-scores"><div><small>WHITE</small><strong id="white-score">00</strong></div><div class="ga-carrom-score-divider"></div><div><small>BLACK</small><strong id="black-score">00</strong></div><div class="ga-carrom-score-target">FIRST TO 25</div></div></section>',
            '<section class="ga-carrom-side-card"><div class="ga-carrom-side-head"><div><span>THE BOARD</span><h3>Pieces remaining</h3></div><span class="ga-carrom-count" id="coin-count">18</span></div><div class="ga-carrom-piece-count"><span class="ga-piece-key"><i class="key-white"></i> White</span><strong id="white-remaining">9</strong><span class="ga-piece-key"><i class="key-black"></i> Black</span><strong id="black-remaining">9</strong></div><div class="ga-carrom-queen-status"><span class="key-queen"></span><span id="queen-status">Queen on the board</span></div></section>',
            '<section class="ga-carrom-side-card"><div class="ga-carrom-side-head"><div><span>SHOT TELEMETRY</span><h3>Recent play</h3></div><span class="ga-carrom-count" id="shot-count">00</span></div><div class="ga-carrom-shot-log" id="shot-log"><div class="ga-carrom-empty">Waiting for the break.</div></div></section>',
            '<section class="ga-carrom-side-card ga-carrom-control-card"><div class="ga-carrom-side-head"><div><span>CONTROL GUIDE</span><h3>Natural gestures</h3></div><span class="ga-carrom-input-status" id="gesture-status">MOUSE READY</span></div><div class="ga-carrom-control-row"><span class="ga-control-symbol">⌖</span><div><strong>Point</strong><small>Place the striker along your baseline</small></div></div><div class="ga-carrom-control-row"><span class="ga-control-symbol">🤏</span><div><strong>Pinch the striker</strong><small>Grab it to begin your shot</small></div></div><div class="ga-carrom-control-row"><span class="ga-control-symbol">↙</span><div><strong>Pull back</strong><small>Pull opposite to the direction you want to shoot</small></div></div><div class="ga-carrom-control-row"><span class="ga-control-symbol">✦</span><div><strong>Release</strong><small>Launch the striker with your chosen power</small></div></div></section>',
            '<div class="ga-carrom-privacy"><i></i> CAMERA PROCESSING STAYS ON THIS DEVICE</div>',
          '</aside>',
        '</main>',
        '<div class="ga-carrom-toast" id="carrom-toast" role="status" aria-live="polite"></div>',
      '</div>'
    ].join("");
  }

  cacheElements() {
    const find = (selector) => this.root.querySelector(selector);
    this.canvas = find("#carrom-board");
    this.context = this.canvas.getContext("2d", { alpha: false });
    this.stage = find("#carrom-stage");
    this.video = find("#carrom-video");
    this.handOverlay = find("#carrom-hand-overlay");
    this.camera = find("#camera-float");
    this.cameraToggle = find("#camera-toggle");
    this.cameraState = find("#camera-state");
    this.cameraPlaceholder = find("#camera-placeholder");
    this.cursor = find("#carrom-cursor");
    this.toast = find("#carrom-toast");
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      if (target.hasAttribute("data-exit")) this.onExit?.();
      else if (target.hasAttribute("data-reset")) this.resetMatch();
      else if (target.hasAttribute("data-undo")) this.undoShot();
      else if (target.hasAttribute("data-camera-toggle")) this.toggleCamera();
      else if (target.hasAttribute("data-camera-minimize")) this.camera.classList.toggle("is-minimized");
      else if (target.dataset.view) this.setView(target.dataset.view);
      else if (target.hasAttribute("data-next-board")) this.nextBoard();
    });

    this.canvas.addEventListener("pointermove", (event) => {
      const world = this.screenToWorld(event.clientX, event.clientY);
      this.pointerWorld = world;
      this.updateCursor(event.clientX, event.clientY, false);
      if (this.phase === "aiming") this.updateAim(world);
      else if (this.phase === "ready") this.positionStriker(world);
    });
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || this.phase !== "ready" || this.boardFinished) return;
      const world = this.screenToWorld(event.clientX, event.clientY);
      this.pointerWorld = world;
      if (this.startAim(world, true)) {
        this.mouseAiming = true;
        this.canvas.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      }
    });
    this.canvas.addEventListener("pointerup", (event) => {
      if (!this.mouseAiming) return;
      this.mouseAiming = false;
      const world = this.screenToWorld(event.clientX, event.clientY);
      this.releaseShot(world);
    });
    this.canvas.addEventListener("pointercancel", () => {
      if (this.mouseAiming) this.cancelAim("Shot cancelled.");
      this.mouseAiming = false;
    });

    this.canvas.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.phase === "aiming") this.cancelAim("Shot cancelled.");
    });
  }

  animate = (time) => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.animate);
    const elapsed = this.lastFrameTime ? Math.min((time - this.lastFrameTime) / 1000, 0.04) : 0;
    this.lastFrameTime = time;

    if (this.phase === "moving") {
      const bodies = this.activeBodies();
      const potted = stepCarromPhysics(bodies, elapsed);
      for (const item of potted) {
        this.shotPockets.push(item);
        this.addPocketEffect(item.pocket.x, item.pocket.y, item.body.color);
      }
      if (isCarromSettled(bodies, 4.2) && time - this.shotStartedAt > 550) {
        this.resolveShot();
      }
    }
    this.updateEffects(elapsed);
    this.drawFrame();
  };

  activeBodies() {
    return [...this.coins.filter((coin) => coin.active), ...(this.striker?.active ? [this.striker] : [])];
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(1000 * dpr);
    this.canvas.height = Math.round(1000 * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rect = this.handOverlay.getBoundingClientRect();
    this.handOverlay.width = Math.max(1, Math.round(rect.width * dpr));
    this.handOverlay.height = Math.max(1, Math.round(rect.height * dpr));
    this.handOverlay.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawFrame();
  }

  worldTransform(context) {
    const angle = this.view.angle * Math.PI / 180;
    const perspective = Math.cos(this.view.tilt * Math.PI / 180);
    context.translate(500, 500);
    context.scale(1, perspective);
    context.rotate(angle);
    context.translate(-500, -500);
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = clamp((clientX - rect.left) / rect.width, 0, 1) * 1000;
    const py = clamp((clientY - rect.top) / rect.height, 0, 1) * 1000;
    const dx = px - 500;
    const dy = (py - 500) / Math.max(0.2, Math.cos(this.view.tilt * Math.PI / 180));
    const angle = this.view.angle * Math.PI / 180;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return {
      x: clamp(500 + c * dx + s * dy, 0, 1000),
      y: clamp(500 - s * dx + c * dy, 0, 1000)
    };
  }

  drawFrame() {
    if (!this.context) return;
    const ctx = this.context;
    ctx.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0);
    ctx.clearRect(0, 0, 1000, 1000);
    ctx.save();
    this.worldTransform(ctx);
    this.drawBoard(ctx);
    this.drawAim(ctx);
    this.drawPieces(ctx);
    this.drawEffects(ctx);
    ctx.restore();
  }

  drawBoard(ctx) {
    ctx.save();
    const outer = ctx.createLinearGradient(25, 25, 980, 980);
    outer.addColorStop(0, "#8b512b");
    outer.addColorStop(.35, "#482719");
    outer.addColorStop(.68, "#a86e3c");
    outer.addColorStop(1, "#3a2118");
    ctx.fillStyle = outer;
    ctx.shadowColor = "rgba(0,0,0,.6)";
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 23;
    this.roundRect(ctx, 24, 24, 952, 952, 44);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 13;
    ctx.strokeStyle = "rgba(255,218,158,.38)";
    this.roundRect(ctx, 37, 37, 926, 926, 34);
    ctx.stroke();

    const wood = ctx.createLinearGradient(75, 75, 920, 920);
    wood.addColorStop(0, "#f4dfb8");
    wood.addColorStop(.48, "#e5c997");
    wood.addColorStop(1, "#c99e66");
    ctx.fillStyle = wood;
    this.roundRect(ctx, 67, 67, 866, 866, 16);
    ctx.fill();

    ctx.save();
    this.roundRect(ctx, 76, 76, 848, 848, 9);
    ctx.clip();
    for (let row = 0; row < 23; row += 1) {
      const y = 92 + row * 36;
      ctx.strokeStyle = row % 2 ? "rgba(116,75,40,.035)" : "rgba(255,255,255,.16)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.bezierCurveTo(310, y - 12, 690, y + 12, 920, y - 2);
      ctx.stroke();
    }
    for (let index = 0; index < 170; index += 1) {
      const x = 80 + ((index * 73) % 840);
      const y = 80 + ((index * 137) % 840);
      ctx.fillStyle = index % 2 ? "rgba(113,75,43,.07)" : "rgba(255,255,255,.12)";
      ctx.beginPath();
      ctx.arc(x, y, 1 + (index % 3) * .45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(74,42,27,.75)";
    ctx.strokeRect(100, 100, 800, 800);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,248,219,.85)";
    ctx.beginPath();
    ctx.arc(500, 500, 122, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#a74237";
    ctx.beginPath();
    ctx.arc(500, 500, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(168,55,43,.13)";
    ctx.beginPath();
    ctx.arc(500, 500, 26, 0, Math.PI * 2);
    ctx.fill();

    this.drawBaseLines(ctx);
    this.drawArrows(ctx);
    this.drawCornerPockets(ctx);
    ctx.restore();
  }

  drawBaseLines(ctx) {
    const positions = [
      { y: 137, dir: 1 }, { y: 863, dir: -1 }
    ];
    ctx.save();
    ctx.lineCap = "round";
    positions.forEach(({ y, dir }) => {
      ctx.strokeStyle = "rgba(119,48,42,.78)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(292, y);
      ctx.lineTo(708, y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(119,48,42,.4)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(292, y + dir * 23);
      ctx.lineTo(708, y + dir * 23);
      ctx.stroke();
      [292, 708].forEach((x) => {
        ctx.fillStyle = "rgba(161,57,49,.13)";
        ctx.beginPath();
        ctx.arc(x, y + dir * 10, 27, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#a94c3f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y + dir * 10, 27, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y + dir * 10, 19, 0, Math.PI * 2);
        ctx.stroke();
      });
    });
    ctx.restore();
  }

  drawArrows(ctx) {
    const arrows = [
      [190, 190, 75, 75], [810, 190, 925, 75],
      [190, 810, 75, 925], [810, 810, 925, 925]
    ];
    ctx.save();
    ctx.strokeStyle = "rgba(126,49,41,.74)";
    ctx.fillStyle = "rgba(126,49,41,.74)";
    ctx.lineWidth = 3;
    arrows.forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2 - (x2 - x1) * .17, y2 - (y2 - y1) * .17);
      ctx.stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.save();
      ctx.translate(x2, y2);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-17, -8);
      ctx.lineTo(-17, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }

  drawCornerPockets(ctx) {
    const pockets = [[72,72],[928,72],[72,928],[928,928]];
    pockets.forEach(([x, y]) => {
      const rim = ctx.createRadialGradient(x - 7, y - 8, 3, x, y, 57);
      rim.addColorStop(0, "#160e0a");
      rim.addColorStop(.54, "#281711");
      rim.addColorStop(.67, "#7e4b2c");
      rim.addColorStop(.8, "#d2a46e");
      rim.addColorStop(1, "#75452a");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(x, y, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,230,179,.68)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 49, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#100a08";
      ctx.beginPath();
      ctx.arc(x, y, 39, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.65)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, 39, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  drawDisc(ctx, body) {
    const { x, y, radius, color, angle = 0 } = body;
    const palette = color === "white"
      ? ["#fffef0", "#eee8d2", "#c8bda4", "#7c715f"]
      : color === "black"
        ? ["#69716d", "#303a37", "#111b19", "#050b0a"]
        : color === "queen"
          ? ["#ffb0a2", "#dc4c45", "#9f2428", "#591419"]
          : ["#f8f1d5", "#d9bd7d", "#96703a", "#3d2b1d"];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = "rgba(34,20,10,.48)";
    ctx.shadowBlur = color === "striker" ? 13 : 8;
    ctx.shadowOffsetY = 7;
    const edge = ctx.createRadialGradient(-radius * .34, -radius * .38, radius * .12, 0, 0, radius * 1.1);
    edge.addColorStop(0, palette[0]);
    edge.addColorStop(.63, palette[1]);
    edge.addColorStop(.88, palette[2]);
    edge.addColorStop(1, palette[3]);
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = Math.max(1.3, radius * .085);
    ctx.strokeStyle = color === "white" ? "#9d9077" : color === "black" ? "#090f0e" : color === "queen" ? "#7b2426" : "#76552f";
    ctx.stroke();
    ctx.lineWidth = Math.max(.8, radius * .035);
    ctx.strokeStyle = "rgba(255,255,255,.58)";
    ctx.beginPath();
    ctx.arc(0, 0, radius * .73, -.8, 2.8);
    ctx.stroke();
    if (color === "striker") {
      ctx.fillStyle = "rgba(91,59,30,.72)";
      ctx.beginPath();
      ctx.arc(0, 0, radius * .43, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff0c9";
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.arc(0, 0, radius * .33, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#fff2d1";
      ctx.font = "bold 13px Georgia";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("G", 0, 1);
    } else {
      ctx.fillStyle = color === "black" ? "rgba(224,242,226,.55)" : color === "queen" ? "rgba(255,241,214,.8)" : "rgba(103,78,45,.58)";
      ctx.beginPath();
      ctx.arc(0, 0, radius * .19, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPieces(ctx) {
    this.coins.filter((coin) => coin.active).forEach((coin) => this.drawDisc(ctx, coin));
    if (this.striker?.active) this.drawDisc(ctx, this.striker);
  }

  drawAim(ctx) {
    if (this.phase !== "aiming" || !this.selectedAim || !this.striker) return;
    const dx = this.striker.x - this.selectedAim.x;
    const dy = this.striker.y - this.selectedAim.y;
    const pull = length(dx, dy);
    if (pull < 2) return;
    const nx = dx / pull;
    const ny = dy / pull;
    const guideLength = 170 + Math.min(pull, 155) * .65;
    const endX = this.striker.x + nx * guideLength;
    const endY = this.striker.y + ny * guideLength;
    ctx.save();
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(43,117,73,.72)";
    ctx.beginPath();
    ctx.moveTo(this.striker.x, this.striker.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(46,145,79,.92)";
    ctx.beginPath();
    ctx.arc(endX, endY, 8 + Math.min(pull, 155) * .04, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(this.striker.x, this.striker.y);
    ctx.rotate(Math.atan2(ny, nx));
    ctx.fillStyle = "#2e9659";
    ctx.beginPath();
    ctx.moveTo(guideLength - 3, 0);
    ctx.lineTo(guideLength - 27, -13);
    ctx.lineTo(guideLength - 27, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = "rgba(89,68,36,.92)";
    ctx.font = "bold 20px 'DM Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("POWER " + Math.round(clamp(pull / 155, 0, 1) * 100) + "%", this.striker.x, this.striker.y - 48 * (this.turn === "white" ? 1 : -1));
    ctx.restore();
  }

  drawEffects(ctx) {
    this.effects.forEach((effect) => {
      const progress = effect.age / effect.life;
      const alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 5 * alpha + 1;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 14 + progress * 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  addPocketEffect(x, y, color) {
    const colors = { white: "#fff4d9", black: "#8da79b", queen: "#ff716a", striker: "#ffe3a0" };
    this.effects.push({ x, y, color: colors[color] || "#b8eaa6", age: 0, life: .55 });
  }

  updateEffects(elapsed) {
    this.effects.forEach((effect) => { effect.age += elapsed; });
    this.effects = this.effects.filter((effect) => effect.age < effect.life);
  }

  positionStriker(world) {
    if (!this.striker || !this.isBaselineZone(world)) return;
    if (isValidStrikerLineup(this.turn, world.x)) {
      this.striker.x += (world.x - this.striker.x) * .24;
    }
  }

  isBaselineZone(world) {
    const expectedY = this.turn === "white" ? 862 : 138;
    return Math.abs(world.y - expectedY) < 60 && world.x >= 270 && world.x <= 730;
  }

  startAim(world, allowLineup = false) {
    if (this.phase !== "ready" || this.boardFinished || this.matchFinished || !this.striker) return false;
    if (allowLineup && this.isBaselineZone(world)) this.striker.x = clamp(world.x, 310, 690);
    const nearStriker = distance(world, this.striker) <= 62;
    if (!nearStriker && !this.isBaselineZone(world)) return false;
    if (this.isBaselineZone(world)) this.striker.x = clamp(world.x, 310, 690);
    this.phase = "aiming";
    this.selectedAim = { x: world.x, y: world.y };
    this.pointerWorld = world;
    this.showToast("Pull away from your target. Release to flick.");
    return true;
  }

  updateAim(world) {
    if (this.phase !== "aiming" || !this.selectedAim) return;
    this.selectedAim = {
      x: clamp(world.x, 12, 988),
      y: clamp(world.y, 12, 988)
    };
  }

  releaseShot(world) {
    if (this.phase !== "aiming" || !this.striker || !this.selectedAim) return;
    this.updateAim(world);
    const dx = this.striker.x - this.selectedAim.x;
    const dy = this.striker.y - this.selectedAim.y;
    const pull = length(dx, dy);
    if (pull < 12) {
      this.cancelAim("Pull back a little further to shoot.");
      return;
    }

    const snapshot = this.snapshot();
    this.shotHistory.push(snapshot);
    if (this.shotHistory.length > 12) this.shotHistory.shift();

    const power = clamp(pull / 155, 0, 1);
    const speed = 230 + power * 1020;
    this.striker.vx = dx / pull * speed;
    this.striker.vy = dy / pull * speed;
    this.striker.active = true;
    this.phase = "moving";
    this.selectedAim = null;
    this.shotPockets = [];
    this.shotStartedAt = performance.now();
    this.shotsTaken = (this.shotsTaken || 0) + 1;
    this.renderHUD();
  }

  cancelAim(message) {
    if (this.phase !== "aiming") return;
    this.phase = "ready";
    this.selectedAim = null;
    if (message) this.showToast(message);
    this.drawFrame();
  }

  snapshot() {
    return {
      coins: deepClone(this.coins),
      striker: deepClone(this.striker),
      turn: this.turn,
      breakSide: this.breakSide,
      scores: deepClone(this.scores),
      boardsPlayed: this.boardsPlayed,
      boardNumber: this.boardNumber,
      pocketed: deepClone(this.pocketed),
      due: deepClone(this.due),
      queenCoveredBy: this.queenCoveredBy,
      queenPendingBy: this.queenPendingBy,
      boardFinished: this.boardFinished,
      matchFinished: this.matchFinished,
      shotLog: deepClone(this.shotLog),
      shotsTaken: this.shotsTaken || 0
    };
  }

  undoShot() {
    if (this.phase !== "ready" || !this.shotHistory.length) {
      this.showToast("Undo is available after the pieces settle.");
      return;
    }
    const snapshot = this.shotHistory.pop();
    Object.assign(this, snapshot);
    this.phase = "ready";
    this.shotPockets = [];
    this.selectedAim = null;
    this.boardFinished = false;
    this.renderHUD();
    this.showToast("Previous shot restored.");
    this.drawFrame();
  }

  resolveShot() {
    const player = this.turn;
    const ownAtStart = this.pocketed[player].length;
    const ownPotted = this.shotPockets.filter((item) => item.body.color === player);
    const opponent = player === "white" ? "black" : "white";
    const opponentPotted = this.shotPockets.filter((item) => item.body.color === opponent);
    const queenPotted = this.shotPockets.some((item) => item.body.color === "queen");
    const strikerPotted = this.shotPockets.some((item) => item.body.color === "striker");
    const queenWasPending = this.queenPendingBy === player;
    let keepTurn = false;
    const notes = [];

    for (const item of [...ownPotted, ...opponentPotted]) {
      this.pocketed[item.body.color].push(item.body.id);
    }

    if (strikerPotted) {
      for (const item of ownPotted) this.returnCoin(item.body.id, player);
      this.returnDueCoin(player);
      if (queenPotted) this.returnQueen();
      if (queenWasPending) this.returnQueen();
      keepTurn = ownPotted.length > 0;
      notes.push("FOUL · striker pocketed");
      if (opponentPotted.length) notes.push("opponent coin remains pocketed");
    } else {
      if (queenWasPending) {
        if (ownPotted.length > 0) {
          this.queenCoveredBy = player;
          this.queenPendingBy = null;
          notes.push("QUEEN COVERED");
        } else {
          this.returnQueen();
          notes.push("queen returned · cover missed");
        }
      } else if (queenPotted) {
        if (ownAtStart > 0 && ownPotted.length > 0) {
          this.queenCoveredBy = player;
          this.queenPendingBy = null;
          notes.push("QUEEN COVERED");
        } else if (ownPotted.length >= 2) {
          this.queenCoveredBy = player;
          this.queenPendingBy = null;
          notes.push("QUEEN COVERED");
        } else if (ownAtStart > 0 || ownPotted.length === 1) {
          this.queenPendingBy = player;
          notes.push("QUEEN · cover on next stroke");
        } else {
          this.returnQueen();
          notes.push("queen returned · pocket a coin first");
        }
      }

      this.payDue(player);
      keepTurn = ownPotted.length > 0 || (queenPotted && this.queenPendingBy === player);
    }

    if (ownPotted.length) notes.push(ownPotted.length + " own coin" + (ownPotted.length === 1 ? "" : "s") + " pocketed");
    if (opponentPotted.length) notes.push(opponentPotted.length + " opponent coin" + (opponentPotted.length === 1 ? "" : "s") + " pocketed");
    if (!notes.length) notes.push("no pocket · turn passes");

    const ownRemaining = this.coins.filter((coin) => coin.active && coin.color === player).length;
    const opponentRemaining = this.coins.filter((coin) => coin.active && coin.color === opponent).length;
    this.striker = null;

    if (!this.queenPendingBy) {
      if (ownRemaining === 0) {
        if (this.queenCoveredBy === player) {
          const queenPoints = this.scores[player] < 22 ? 3 : 0;
          this.finishBoard(player, opponentRemaining + queenPoints, "All your coins are cleared. The queen is covered.");
          return;
        }
        this.finishBoard(opponent, 3, "The last coin was cleared before the queen was covered. The opponent takes the board.");
        return;
      }
      if (opponentRemaining === 0 && ownRemaining > 0) {
        this.finishBoard(opponent, ownRemaining + (this.queenCoveredBy !== player && this.scores[opponent] < 22 ? 3 : 0), "The opponent's last coin was pocketed while your coins remained.");
        return;
      }
    }

    if (keepTurn) {
      this.turn = player;
      this.shotLog.unshift({ player, note: notes.join(" · "), shot: this.shotsTaken || 1 });
      this.showToast(notes.join(" · ") + " — shoot again.");
    } else {
      this.turn = opponent;
      this.shotLog.unshift({ player, note: notes.join(" · "), shot: this.shotsTaken || 1 });
      this.showToast(notes.join(" · ") + " — " + opponent.toUpperCase() + " to play.");
    }
    this.shotLog = this.shotLog.slice(0, 10);
    this.phase = "ready";
    this.shotPockets = [];
    this.striker = createStriker(this.turn);
    this.renderHUD();
    this.drawFrame();
  }

  returnDueCoin(side) {
    this.due[side] = (this.due[side] || 0) + 1;
    this.payDue(side);
  }

  payDue(side) {
    while (this.due[side] > 0 && this.pocketed[side].length) {
      const id = this.pocketed[side][this.pocketed[side].length - 1];
      this.returnCoin(id, side);
      this.due[side] -= 1;
    }
  }

  returnCoin(id, side) {
    const coin = this.coins.find((piece) => piece.id === id);
    if (!coin) return;
    this.pocketed[side] = this.pocketed[side].filter((entry) => entry !== id);
    this.placeReturned(coin, side);
  }

  placeReturned(coin, side) {
    coin.active = true;
    coin.vx = 0;
    coin.vy = 0;
    coin.angle = 0;
    const candidates = [];
    for (let ring = 0; ring < 8; ring += 1) {
      const radius = 38 + ring * 13;
      for (let index = 0; index < 24; index += 1) {
        const angle = index / 24 * Math.PI * 2 + ring * .18;
        const x = 500 + Math.cos(angle) * radius;
        const y = 500 + Math.sin(angle) * radius;
        const clearance = this.coins
          .filter((other) => other.active && other.id !== coin.id)
          .reduce((minimum, other) => Math.min(minimum, distance({ x, y }, other) - coin.radius - other.radius), Infinity);
        if (clearance > 2) candidates.push({ x, y, clearance, radius });
      }
    }
    candidates.sort((a, b) => a.radius - b.radius);
    const spot = candidates[0];
    if (spot) {
      coin.x = spot.x;
      coin.y = spot.y;
    } else {
      coin.x = side === "white" ? 500 : 500;
      coin.y = side === "white" ? 650 : 350;
    }
  }

  returnQueen() {
    const queen = this.coins.find((coin) => coin.color === "queen");
    if (!queen) return;
    if (queen.active) return;
    this.placeReturned(queen, "white");
    queen.x = 500;
    queen.y = 500;
    this.queenCoveredBy = null;
    this.queenPendingBy = null;
  }

  finishBoard(winner, points, reason) {
    this.boardFinished = true;
    this.phase = "ready";
    this.boardsPlayed += 1;
    const award = Math.max(1, Math.min(12, points));
    this.scores[winner] += award;
    const reachedScore = this.scores[winner] >= 25;
    const reachedBoards = this.boardsPlayed >= 8;
    this.matchFinished = reachedScore || reachedBoards;
    const matchWinner = reachedScore
      ? winner
      : reachedBoards
        ? (this.scores.white === this.scores.black ? null : (this.scores.white > this.scores.black ? "white" : "black"))
        : winner;
    this.root.querySelector("#result-eyebrow").textContent = this.matchFinished ? "MATCH COMPLETE" : "BOARD " + String(this.boardsPlayed).padStart(2, "0") + " COMPLETE";
    this.root.querySelector("#result-title").textContent = this.matchFinished
      ? (matchWinner ? matchWinner.toUpperCase() + " WINS THE MATCH" : "MATCH DRAW")
      : winner.toUpperCase() + " WINS THE BOARD";
    this.root.querySelector("#result-copy").textContent = reason + " +" + award + " board points. Match score: White " + this.scores.white + " — Black " + this.scores.black + ".";
    this.root.querySelector("#next-board").textContent = this.matchFinished ? "BACK TO ARCADE ↗" : "NEXT BOARD ↗";
    this.root.querySelector("#board-result").hidden = false;
    this.shotLog.unshift({ player: winner, note: "BOARD WON · +" + award + " POINTS", shot: this.shotsTaken || 1 });
    this.renderHUD();
    this.drawFrame();
  }

  nextBoard() {
    if (this.matchFinished) {
      this.onExit?.();
      return;
    }
    this.breakSide = this.breakSide === "white" ? "black" : "white";
    this.turn = this.breakSide;
    this.boardNumber = this.boardsPlayed + 1;
    this.coins = createCarromRack();
    this.pocketed = { white: [], black: [] };
    this.due = { white: 0, black: 0 };
    this.queenCoveredBy = null;
    this.queenPendingBy = null;
    this.striker = createStriker(this.turn);
    this.shotPockets = [];
    this.shotHistory = [];
    this.shotsTaken = 0;
    this.shotLog.unshift({ player: this.turn, note: "NEW BOARD · " + this.turn.toUpperCase() + " BREAK", shot: 0 });
    this.boardFinished = false;
    this.root.querySelector("#board-result").hidden = true;
    this.renderHUD();
    this.drawFrame();
  }

  resetMatch() {
    this.turn = "white";
    this.breakSide = "white";
    this.scores = { white: 0, black: 0 };
    this.boardsPlayed = 0;
    this.boardNumber = 1;
    this.coins = createCarromRack();
    this.pocketed = { white: [], black: [] };
    this.due = { white: 0, black: 0 };
    this.queenCoveredBy = null;
    this.queenPendingBy = null;
    this.striker = createStriker("white");
    this.phase = "ready";
    this.boardFinished = false;
    this.matchFinished = false;
    this.shotPockets = [];
    this.shotHistory = [];
    this.shotLog = [];
    this.shotsTaken = 0;
    this.selectedAim = null;
    this.root.querySelector("#board-result").hidden = true;
    this.renderHUD();
    this.showToast("New match. White breaks first.");
    this.drawFrame();
  }

  setView(viewId) {
    const view = VIEWS.find((candidate) => candidate.id === viewId);
    if (!view) return;
    this.view = view;
    this.updateView();
    this.drawFrame();
  }

  updateView() {
    this.root.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === this.view.id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  renderHUD() {
    const side = this.turn;
    const other = side === "white" ? "black" : "white";
    const remainingWhite = this.coins.filter((coin) => coin.active && coin.color === "white").length;
    const remainingBlack = this.coins.filter((coin) => coin.active && coin.color === "black").length;
    const activeCount = remainingWhite + remainingBlack + (this.coins.some((coin) => coin.active && coin.color === "queen") ? 1 : 0);
    this.root.querySelector("#turn-eyebrow").textContent = side.toUpperCase() + " TO " + (this.shotsTaken ? "PLAY" : "BREAK");
    this.root.querySelector("#turn-title").textContent = this.phase === "aiming" ? "Set your power." : this.phase === "moving" ? "Watch the break." : (side === "white" ? "Line it up." : "Your shot.");
    this.root.querySelector("#turn-description").textContent = this.phase === "aiming"
      ? "Pull farther for more power. Release to send the striker toward the guide."
      : this.phase === "moving"
        ? "The coins are still moving. Your turn resolves when the board settles."
        : (side === "white" ? "Position your striker on the bottom baseline, then pull back and release." : "Position your striker on the top baseline, then pull back and release.");
    this.root.querySelector("#turn-card").classList.toggle("is-black-turn", side === "black");
    this.root.querySelector("#turn-progress").style.width = side === "white" ? "34%" : "66%";
    this.root.querySelector("#turn-coin").className = "ga-carrom-turn-coin " + (side === "white" ? "token-white" : "token-black");
    this.root.querySelector("#board-number").textContent = "BOARD " + String(this.boardNumber).padStart(2, "0") + " / 08";
    this.root.querySelector("#white-score").textContent = String(this.scores.white).padStart(2, "0");
    this.root.querySelector("#black-score").textContent = String(this.scores.black).padStart(2, "0");
    this.root.querySelector("#white-remaining").textContent = remainingWhite;
    this.root.querySelector("#black-remaining").textContent = remainingBlack;
    this.root.querySelector("#coin-count").textContent = String(activeCount).padStart(2, "0");
    this.root.querySelector("#shot-count").textContent = String(this.shotsTaken || 0).padStart(2, "0");
    this.root.querySelector("#white-status").textContent = side === "white" ? "ACTIVE TURN" : "WAITING";
    this.root.querySelector("#black-status").textContent = side === "black" ? "ACTIVE TURN" : "WAITING";
    this.root.querySelector("#white-player").classList.toggle("is-active", side === "white");
    this.root.querySelector("#black-player").classList.toggle("is-active", side === "black");
    const queenLabel = this.queenCoveredBy
      ? "Queen covered by " + this.queenCoveredBy
      : this.queenPendingBy
        ? "Queen waiting for cover"
        : (this.coins.some((coin) => coin.active && coin.color === "queen") ? "Queen on the board" : "Queen pocketed");
    this.root.querySelector("#queen-status").textContent = queenLabel + (this.due[side] ? " · " + this.due[side] + " due" : "");
    const log = this.root.querySelector("#shot-log");
    log.innerHTML = this.shotLog.length
      ? this.shotLog.slice(0, 8).map((entry) => '<div class="ga-carrom-shot-entry"><span>' + entry.player.toUpperCase() + '</span><strong>' + escapeHTML(entry.note) + '</strong></div>').join("")
      : '<div class="ga-carrom-empty">Waiting for the break.</div>';
    this.root.querySelector("[data-undo]").disabled = !this.shotHistory.length || this.phase !== "ready" || this.boardFinished;
  }

  updateCursor(x, y, pinching) {
    this.cursor.style.left = x + "px";
    this.cursor.style.top = y + "px";
    this.cursor.classList.add("is-visible");
    this.cursor.classList.toggle("is-pinching", Boolean(pinching));
    this.cursor.querySelector("span").textContent = pinching ? "PULL" : "POINT";
  }

  chooseHand(result) {
    const hands = result.landmarks || [];
    if (!hands.length) return null;
    const candidates = hands.map((landmarks, index) => {
      const palm = Math.max(distance(landmarks[0], landmarks[9]), .001);
      const ratio = distance(landmarks[4], landmarks[8]) / palm;
      const confidence = result.handednesses?.[index]?.[0]?.score || .5;
      return { landmarks, ratio, confidence };
    });
    return candidates.filter((item) => item.ratio < .58).sort((a, b) => a.ratio - b.ratio)[0]
      || candidates.sort((a, b) => b.confidence - a.confidence)[0];
  }

  handleLandmarks(result) {
    if (this.disposed) return;
    const hands = result.landmarks || [];
    this.drawHandOverlay(hands);
    if (!hands.length) {
      const lostFor = performance.now() - this.lastHandSeen;
      if (lostFor > 180) this.cursor.classList.remove("is-visible");
      if (lostFor > 360 && this.pinchActive) {
        this.pinchActive = false;
        this.cursor.classList.remove("is-pinching");
        this.cancelAim("Hand tracking lost. The shot was cancelled.");
      }
      return;
    }

    this.lastHandSeen = performance.now();
    const hand = this.chooseHand(result);
    if (!hand) return;
    const tip = hand.landmarks[8];
    const target = { x: clamp((1 - tip.x) * window.innerWidth, 0, window.innerWidth), y: clamp(tip.y * window.innerHeight, 0, window.innerHeight) };
    if (!this.smoothedPoint) this.smoothedPoint = target;
    else {
      const movement = distance(target, this.smoothedPoint);
      const alpha = movement > 24 ? .72 : movement > 8 ? .58 : .42;
      this.smoothedPoint.x += (target.x - this.smoothedPoint.x) * alpha;
      this.smoothedPoint.y += (target.y - this.smoothedPoint.y) * alpha;
    }
    this.cursorPoint = { x: this.smoothedPoint.x, y: this.smoothedPoint.y };
    this.updateCursor(this.cursorPoint.x, this.cursorPoint.y, this.pinchActive);

    const world = this.screenToWorld(this.cursorPoint.x, this.cursorPoint.y);
    this.pointerWorld = world;
    if (this.phase === "aiming" && this.pinchActive) this.updateAim(world);
    else if (this.phase === "ready" && !this.pinchActive) this.positionStriker(world);

    const openPalm = this.isOpenPalm(hand.landmarks);
    if (openPalm && this.pinchActive && this.phase === "aiming") {
      this.pinchActive = false;
      this.pinchStartFrames = 0;
      this.pinchEndFrames = 0;
      this.cursor.classList.remove("is-pinching");
      this.cancelAim("Open palm · shot cancelled.");
      return;
    }

    const palm = Math.max(distance(hand.landmarks[0], hand.landmarks[9]), .001);
    const ratio = distance(hand.landmarks[4], hand.landmarks[8]) / palm;
    const isPinch = ratio < (this.pinchActive ? .49 : .34);
    this.updatePinchState(isPinch, world);

    if (openPalm && !this.pinchActive && this.phase === "aiming") {
      this.openPalmFrames += 1;
      if (this.openPalmFrames > 12) {
        this.openPalmFrames = 0;
        this.cancelAim("Open palm · shot cancelled.");
      }
    } else this.openPalmFrames = 0;
  }

  updatePinchState(isPinch, world) {
    if (!this.pinchActive) {
      this.pinchStartFrames = isPinch ? this.pinchStartFrames + 1 : 0;
      if (this.pinchStartFrames >= 2) {
        this.pinchActive = true;
        this.pinchStartFrames = 0;
        this.cursor.classList.add("is-pinching");
        if (this.phase === "ready") this.startAim(world, true);
      }
      return;
    }
    this.pinchEndFrames = isPinch ? 0 : this.pinchEndFrames + 1;
    if (this.pinchEndFrames >= 2) {
      this.pinchActive = false;
      this.pinchEndFrames = 0;
      this.cursor.classList.remove("is-pinching");
      if (this.phase === "aiming") this.releaseShot(world);
    }
  }

  isOpenPalm(landmarks) {
    const pairs = [[8, 6], [12, 10], [16, 14], [20, 18]];
    let extended = 0;
    for (const [tip, joint] of pairs) {
      if (distance(landmarks[tip], landmarks[0]) > distance(landmarks[joint], landmarks[0]) * 1.13) extended += 1;
    }
    return extended >= 4;
  }

  drawHandOverlay(hands) {
    const canvas = this.handOverlay;
    const context = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const scaleX = canvas.width / Math.max(width, 1);
    const scaleY = canvas.height / Math.max(height, 1);
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    hands.forEach((landmarks) => {
      context.lineWidth = 2;
      context.strokeStyle = "rgba(135,255,198,.86)";
      context.shadowColor = "rgba(76,255,185,.65)";
      context.shadowBlur = 7;
      HAND_CONNECTIONS.forEach(([from, to]) => {
        context.beginPath();
        context.moveTo(landmarks[from].x * width, landmarks[from].y * height);
        context.lineTo(landmarks[to].x * width, landmarks[to].y * height);
        context.stroke();
      });
      context.shadowBlur = 0;
      landmarks.forEach((point, index) => {
        context.beginPath();
        context.arc(point.x * width, point.y * height, index === 4 || index === 8 ? 4 : 2, 0, Math.PI * 2);
        context.fillStyle = index === 4 || index === 8 ? "#edff7a" : "#b8ffdf";
        context.fill();
      });
    });
    context.restore();
  }

  async toggleCamera() {
    if (this.cameraEnabled) {
      await this.stopCamera();
      return;
    }
    this.cameraToggle.disabled = true;
    this.cameraToggle.textContent = "STARTING…";
    this.cameraState.textContent = "REQUESTING CAMERA";
    try {
      await this.input.start(this.video, (result) => this.handleLandmarks(result));
      this.cameraEnabled = true;
      this.cameraPlaceholder.hidden = true;
      this.camera.classList.add("is-live");
      this.cameraToggle.textContent = "DISABLE";
      this.cameraState.textContent = "TRACKING ACTIVE";
      this.root.querySelector("#gesture-status").textContent = "LIVE INPUT";
      this.showToast("Hand control live. Point to your baseline, then pinch and pull.");
    } catch (error) {
      this.cameraState.textContent = "CAMERA UNAVAILABLE";
      this.cameraToggle.textContent = "RETRY";
      this.cameraPlaceholder.querySelector("strong").textContent = "CAMERA UNAVAILABLE";
      this.cameraPlaceholder.querySelector("small").textContent = error?.message || "Allow access and retry.";
      this.showToast(error?.message || "Could not start the camera.");
    } finally {
      this.cameraToggle.disabled = false;
    }
  }

  async stopCamera() {
    await this.input.stop();
    this.cameraEnabled = false;
    this.camera.classList.remove("is-live");
    this.cameraPlaceholder.hidden = false;
    this.cameraPlaceholder.querySelector("strong").textContent = "CAMERA OFF";
    this.cameraPlaceholder.querySelector("small").textContent = "Enable hand control to aim and flick";
    this.cameraToggle.textContent = "ENABLE";
    this.cameraState.textContent = "READY WHEN YOU ARE";
    this.root.querySelector("#gesture-status").textContent = "MOUSE READY";
    this.cursor.classList.remove("is-visible", "is-pinching");
    this.pinchActive = false;
    this.pinchStartFrames = 0;
    this.pinchEndFrames = 0;
    this.smoothedPoint = null;
    this.cancelAim();
    this.handOverlay.getContext("2d")?.clearRect(0, 0, this.handOverlay.width, this.handOverlay.height);
  }

  showToast(message) {
    if (!this.toast) return;
    window.clearTimeout(this.lastToastTimer);
    this.toast.textContent = message;
    this.toast.classList.add("is-visible");
    this.lastToastTimer = window.setTimeout(() => this.toast?.classList.remove("is-visible"), 2300);
  }

  async dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.lastToastTimer);
    window.removeEventListener("resize", this.resizeHandler);
    this.resizeObserver?.disconnect();
    await this.stopCamera();
    await this.input.dispose();
    this.root?.replaceChildren();
  }
}
