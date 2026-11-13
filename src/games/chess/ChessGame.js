import { Chess } from "chess.js";
import { GestureInput } from "../../vision/GestureInput.js";
import "./chess.css";

const PIECE_GLYPHS = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};

const PIECE_NAMES = {
  k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn"
};

const VIEWS = [
  { id: "white-top", label: "White · top", angle: 0, tilt: 53, black: false },
  { id: "black-top", label: "Black · top", angle: 180, tilt: 53, black: true },
  { id: "white-left", label: "White · left", angle: 27, tilt: 53, black: false },
  { id: "white-right", label: "White · right", angle: -27, tilt: 53, black: false },
  { id: "black-left", label: "Black · left", angle: 153, tilt: 53, black: true },
  { id: "black-right", label: "Black · right", angle: -153, tilt: 53, black: true },
  { id: "top-middle", label: "Top · middle", angle: 0, tilt: 0, black: false }
];

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [17, 0]
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function icon(name) {
  const paths = {
    back: '<path d="M19 12H5m7 7-7-7 7-7"/>',
    reset: '<path d="M3 12a9 9 0 1 0 2.7-6.4L3 8"/><path d="M3 3v5h5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-1"/>',
    camera: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="m8 6 1.2-2h5.6L16 6"/><circle cx="12" cy="13" r="3"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    swap: '<path d="m7 7 3-3 3 3M10 4v12M17 17l-3 3-3-3m3 3V8"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || "") + "</svg>";
}

export class ChessGame {
  async mount({ root, onExit }) {
    this.root = root;
    this.onExit = onExit;
    this.chess = new Chess();
    this.input = new GestureInput();
    this.selected = null;
    this.legalMoves = [];
    this.lastMove = null;
    this.view = VIEWS[0];
    this.cursorPoint = null;
    this.smoothedPoint = null;
    this.pinchActive = false;
    this.pinchStartFrames = 0;
    this.pinchEndFrames = 0;
    this.gestureFrom = null;
    this.gestureTarget = null;
    this.pendingPromotion = null;
    this.lastHandSeen = 0;
    this.lastToastTimer = 0;
    this.cameraEnabled = false;
    this.disposed = false;

    root.innerHTML = this.renderShell();
    this.cacheElements();
    this.bindEvents();
    this.renderAll();
    this.updateView();
    this.resizeCameraCanvas();
    this.resizeHandler = () => this.resizeCameraCanvas();
    window.addEventListener("resize", this.resizeHandler);
    this.input.addEventListener("trackingerror", (event) => {
      this.showToast(event.detail?.message || "Hand tracking paused. Try again.");
    });
  }

  renderShell() {
    return [
      '<div class="ga-chess">',
        '<header class="ga-chess-topbar">',
          '<button class="ga-back-button" type="button" data-exit>' + icon("back") + '<span>ARCADE</span></button>',
          '<div class="ga-brand"><span class="ga-brand-mark">G</span><div><strong>GESTURE<span>CHESS</span></strong><small>SPATIAL PLAY / 01</small></div></div>',
          '<div class="ga-topbar-actions">',
            '<span class="ga-live-status"><i></i> LOCAL SESSION</span>',
            '<button class="ga-icon-button" type="button" data-undo title="Undo last move">' + icon("undo") + '<span>UNDO</span></button>',
            '<button class="ga-reset-button" type="button" data-reset>' + icon("reset") + '<span>RESET</span></button>',
          '</div>',
        '</header>',
        '<main class="ga-chess-layout">',
          '<section class="ga-board-column">',
            '<div class="ga-player-strip ga-player-strip--black" id="black-player">',
              '<div class="ga-player-avatar ga-avatar--black">♚</div>',
              '<div class="ga-player-meta"><strong>BLACK</strong><small>PLAYER 02</small></div>',
              '<span class="ga-player-turn" id="black-turn-label">WAITING</span>',
            '</div>',
            '<div class="ga-board-stage" id="board-stage">',
              '<div class="ga-board-backplate"></div>',
              '<div class="ga-board-shadow"></div>',
              '<div class="ga-board-plane" id="board-plane">',
                '<div class="ga-board-grid" id="chess-board" role="grid" aria-label="Chess board"></div>',
              '</div>',
              '<div class="ga-board-coordinates" aria-hidden="true"><span>A</span><span>B</span><span>C</span><span>D</span><span>E</span><span>F</span><span>G</span><span>H</span></div>',
              '<div class="ga-hand-cursor" id="hand-cursor" aria-hidden="true"><i></i><span class="ga-held-piece" id="held-piece"></span><span>PINCH</span></div>',
              '<section class="ga-camera-float" id="camera-float" aria-label="Hand tracking camera">',
                '<div class="ga-camera-head"><span><i></i> HAND TRACKING</span><button type="button" data-camera-minimize aria-label="Minimize camera preview">−</button></div>',
                '<div class="ga-camera-screen"><video id="chess-video" autoplay muted playsinline></video><canvas id="hand-overlay"></canvas><div class="ga-camera-placeholder" id="camera-placeholder"><span class="ga-camera-icon">' + icon("camera") + '</span><strong>CAMERA OFF</strong><small>Enable hand control to begin</small></div><span class="ga-camera-corner">LIVE / LOCAL</span></div>',
                '<div class="ga-camera-foot"><span id="camera-state">READY WHEN YOU ARE</span><button type="button" data-camera-toggle id="camera-toggle">ENABLE</button></div>',
              '</section>',
              '<div class="ga-promotion-overlay" id="promotion-overlay" hidden>',
                '<div class="ga-promotion-card"><small>PAWN PROMOTION</small><h3>Choose your piece</h3><div class="ga-promotion-options">',
                  '<button type="button" data-promotion="q" aria-label="Promote to queen">♕</button>',
                  '<button type="button" data-promotion="r" aria-label="Promote to rook">♖</button>',
                  '<button type="button" data-promotion="b" aria-label="Promote to bishop">♗</button>',
                  '<button type="button" data-promotion="n" aria-label="Promote to knight">♘</button>',
                '</div><button class="ga-promotion-cancel" type="button" data-promotion-cancel>Cancel move</button></div>',
              '</div>',
              '<div class="ga-result-overlay" id="result-overlay" hidden><div class="ga-result-card"><span class="ga-result-star">✦</span><small>GAME COMPLETE</small><h2 id="result-title">CHECKMATE</h2><p id="result-copy"></p><button type="button" data-reset>PLAY AGAIN</button></div></div>',
            '</div>',
            '<div class="ga-view-controls">',
              '<div class="ga-view-heading"><span>CAMERA VIEWS</span><small>7 FIXED ANGLES</small></div>',
              '<div class="ga-view-list" id="view-list">',
                VIEWS.map((view) => '<button type="button" class="ga-view-button' + (view.id === this.view.id ? ' is-active' : '') + '" data-view="' + view.id + '">' + escapeHTML(view.label) + '</button>').join(""),
              '</div>',
            '</div>',
            '<div class="ga-board-instruction"><span class="ga-instruction-dot"></span><div><strong>POINT TO A PIECE · PINCH TO PICK IT UP</strong><small>Keep the pinch closed while moving. Release over a highlighted square to place.</small></div><span class="ga-gesture-key">✌ OPEN PALM = CANCEL</span></div>',
            '<div class="ga-player-strip ga-player-strip--white" id="white-player">',
              '<div class="ga-player-avatar ga-avatar--white">♔</div>',
              '<div class="ga-player-meta"><strong>WHITE</strong><small>PLAYER 01</small></div>',
              '<span class="ga-player-turn" id="white-turn-label">YOUR TURN</span>',
            '</div>',
          '</section>',
          '<aside class="ga-chess-sidebar">',
            '<section class="ga-turn-card" id="turn-card"><div class="ga-turn-topline"><span>MATCH STATUS</span><span class="ga-turn-number" id="move-number">01</span></div><div class="ga-turn-main"><span class="ga-turn-piece" id="turn-piece">♔</span><div><small id="turn-eyebrow">WHITE TO MOVE</small><h2 id="turn-title">Your move.</h2></div></div><p id="turn-description">Select a white piece to see every legal move.</p><div class="ga-turn-progress"><span id="turn-progress"></span></div></section>',
            '<section class="ga-side-card ga-moves-card"><div class="ga-side-card-head"><div><span class="ga-side-eyebrow">THE GAME</span><h3>Move history</h3></div><span class="ga-count-pill" id="move-count">00</span></div><div class="ga-move-list" id="move-list"><div class="ga-empty-moves">The first move is yours.</div></div><div class="ga-pgn-row"><span>STANDARD CHESS / FIDE RULESET</span><button type="button" data-copy-pgn>COPY PGN</button></div></section>',
            '<section class="ga-side-card ga-captured-card"><div class="ga-side-card-head"><div><span class="ga-side-eyebrow">TAKEN PIECES</span><h3>Captured</h3></div></div><div class="ga-captured-row"><span>WHITE</span><div id="white-captured" class="ga-captured-pieces">—</div></div><div class="ga-captured-row"><span>BLACK</span><div id="black-captured" class="ga-captured-pieces">—</div></div></section>',
            '<section class="ga-side-card ga-gesture-card"><div class="ga-side-card-head"><div><span class="ga-side-eyebrow">CONTROL GUIDE</span><h3>Gesture language</h3></div><span class="ga-gesture-status" id="gesture-status">MOUSE READY</span></div><div class="ga-gesture-row"><span class="ga-gesture-symbol">⌖</span><div><strong>Point</strong><small>Move the cursor to a square</small></div></div><div class="ga-gesture-row"><span class="ga-gesture-symbol">🤏</span><div><strong>Pinch & hold</strong><small>Pick up a piece and carry it</small></div></div><div class="ga-gesture-row"><span class="ga-gesture-symbol">↗</span><div><strong>Release</strong><small>Drop on a legal destination</small></div></div><div class="ga-gesture-row"><span class="ga-gesture-symbol">✋</span><div><strong>Open palm</strong><small>Cancel the current selection</small></div></div></section>',
            '<div class="ga-sidebar-foot"><span><i></i> CAMERA PROCESSING STAYS ON THIS DEVICE</span><span>GESTUREARCADE / CHESS 01</span></div>',
          '</aside>',
        '</main>',
        '<div class="ga-toast" id="chess-toast" role="status" aria-live="polite"></div>',
      '</div>'
    ].join("");
  }

  cacheElements() {
    const find = (selector) => this.root.querySelector(selector);
    this.board = find("#chess-board");
    this.boardPlane = find("#board-plane");
    this.boardStage = find("#board-stage");
    this.turnCard = find("#turn-card");
    this.turnPiece = find("#turn-piece");
    this.turnEyebrow = find("#turn-eyebrow");
    this.turnTitle = find("#turn-title");
    this.turnDescription = find("#turn-description");
    this.moveList = find("#move-list");
    this.video = find("#chess-video");
    this.overlay = find("#hand-overlay");
    this.cameraFloat = find("#camera-float");
    this.cameraToggle = find("#camera-toggle");
    this.cameraState = find("#camera-state");
    this.cameraPlaceholder = find("#camera-placeholder");
    this.cursor = find("#hand-cursor");
    this.cursorHeld = find("#held-piece");
    this.toast = find("#chess-toast");
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;

      if (target.hasAttribute("data-exit")) {
        this.onExit?.();
      } else if (target.hasAttribute("data-reset")) {
        this.resetGame();
      } else if (target.hasAttribute("data-undo")) {
        this.undoMove();
      } else if (target.hasAttribute("data-camera-toggle")) {
        this.toggleCamera();
      } else if (target.hasAttribute("data-camera-minimize")) {
        this.cameraFloat.classList.toggle("is-minimized");
      } else if (target.dataset.view) {
        this.setView(target.dataset.view);
      } else if (target.dataset.promotion) {
        this.finishPromotion(target.dataset.promotion);
      } else if (target.hasAttribute("data-promotion-cancel")) {
        this.cancelPromotion();
      } else if (target.hasAttribute("data-copy-pgn")) {
        this.copyPGN();
      } else if (target.dataset.square) {
        this.handleSquareClick(target.dataset.square);
      }
    });

    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (this.pendingPromotion) this.cancelPromotion();
        else this.clearSelection();
      }
    });

    this.board.addEventListener("pointermove", (event) => {
      const square = event.target.closest("[data-square]");
      if (square && this.selected) this.setHoverSquare(square.dataset.square);
    });

    this.board.addEventListener("pointerleave", () => {
      if (!this.pinchActive) this.setHoverSquare(null);
    });
  }

  renderAll() {
    this.renderBoard();
    this.renderHUD();
    this.renderHistory();
    this.renderCaptured();
  }

  renderBoard() {
    if (!this.board) return;
    const matrix = this.chess.board();
    const rows = matrix;
    const legalByTarget = new Map();
    this.legalMoves.forEach((move) => legalByTarget.set(move.to, move));
    const lastSquares = this.lastMove ? [this.lastMove.from, this.lastMove.to] : [];
    const checkSquare = this.chess.isCheck()
      ? this.chess.findPiece({ type: "k", color: this.chess.turn() })[0]
      : null;
    const html = [];

    rows.forEach((row, rowIndex) => {
      row.forEach((piece, columnIndex) => {
        const square = piece ? piece.square : this.visualSquare(rowIndex, columnIndex);
        const file = square.charAt(0);
        const rank = square.charAt(1);
        const isLight = (file.charCodeAt(0) - 97 + Number(rank)) % 2 === 0;
        const targetMove = legalByTarget.get(square);
        const classes = ["ga-chess-square", isLight ? "is-light" : "is-dark"];
        if (this.selected === square) classes.push("is-selected");
        if (targetMove && targetMove.captured) classes.push("is-capture-option");
        else if (targetMove) classes.push("is-legal-option");
        if (lastSquares.includes(square)) classes.push("is-last-move");
        if (checkSquare === square) classes.push("is-check");
        if (this.hoverSquare === square && this.selected) classes.push("is-hover-target");
        const pieceMarkup = piece
          ? '<span class="ga-piece ga-piece--' + piece.color + (targetMove?.captured ? ' ga-piece--threatened' : '') + '" aria-hidden="true"><span class="ga-piece-glyph">' + PIECE_GLYPHS[piece.color][piece.type] + '</span><span class="ga-piece-base"></span></span>'
          : "";
        const hint = file + rank;
        const rankLabel = columnIndex === 0 ? '<span class="ga-rank-coordinate">' + rank + '</span>' : "";
        const fileLabel = rowIndex === 7 ? '<span class="ga-file-coordinate">' + file + '</span>' : "";
        const moveMarker = targetMove
          ? (targetMove.captured ? '<span class="ga-capture-marker" aria-hidden="true">×</span>' : '<span class="ga-move-marker" aria-hidden="true"></span>')
          : "";
        html.push(
          '<button type="button" role="gridcell" class="' + classes.join(" ") + '" data-square="' + square + '" aria-label="' +
          hint + (piece ? " " + (piece.color === "w" ? "white " : "black ") + PIECE_NAMES[piece.type] : " empty") +
          (targetMove ? (targetMove.captured ? ", capture available" : ", legal move available") : "") + '">' +
          rankLabel + fileLabel + pieceMarkup + moveMarker + '</button>'
        );
      });
    });

    this.board.innerHTML = html.join("");
    const activeView = this.view;
    this.boardPlane.style.setProperty("--view-angle", activeView.angle + "deg");
    this.boardPlane.style.setProperty("--board-tilt", activeView.tilt + "deg");
    this.boardPlane.style.setProperty("--piece-angle", (-activeView.angle) + "deg");
    this.boardPlane.style.setProperty("--piece-lift", activeView.tilt === 0 ? "0px" : "7px");
    this.boardPlane.classList.toggle("is-overhead", activeView.tilt === 0);
    this.boardPlane.classList.toggle("is-black-view", activeView.black);
  }

  visualSquare(rowIndex, columnIndex) {
    return String.fromCharCode(97 + columnIndex) + String(8 - rowIndex);
  }

  renderHUD() {
    const turn = this.chess.turn();
    const whiteTurn = turn === "w";
    const isOver = this.chess.isGameOver();
    const checked = this.chess.isCheck();
    const turnName = whiteTurn ? "WHITE" : "BLACK";
    const fullMove = this.chess.moveNumber();
    const history = this.chess.history();
    const status = this.gameStatus();

    this.turnPiece.textContent = whiteTurn ? "♔" : "♚";
    this.turnEyebrow.textContent = isOver ? "MATCH FINISHED" : turnName + " TO MOVE";
    this.turnTitle.textContent = isOver ? status.title : (checked ? "Check." : "Your move.");
    this.turnDescription.textContent = isOver ? status.copy : (checked
      ? turnName + " king is under attack. Find a legal response."
      : (this.selected ? "Choose one of the highlighted legal destinations." : "Select a " + turnName.toLowerCase() + " piece to see every legal move."));
    this.turnCard.classList.toggle("is-black-turn", !whiteTurn);
    this.turnCard.classList.toggle("is-check", checked);
    this.turnCard.classList.toggle("is-finished", isOver);
    this.root.querySelector("#move-number").textContent = String(fullMove).padStart(2, "0");
    this.root.querySelector("#move-count").textContent = String(history.length).padStart(2, "0");
    this.root.querySelector("#white-turn-label").textContent = whiteTurn ? "ACTIVE TURN" : "WAITING";
    this.root.querySelector("#black-turn-label").textContent = whiteTurn ? "WAITING" : "ACTIVE TURN";
    this.root.querySelector("#white-player").classList.toggle("is-active", whiteTurn);
    this.root.querySelector("#black-player").classList.toggle("is-active", !whiteTurn);
    this.root.querySelector("#turn-progress").style.width = whiteTurn ? "0%" : "100%";

    const resultOverlay = this.root.querySelector("#result-overlay");
    if (isOver) {
      this.root.querySelector("#result-title").textContent = status.title;
      this.root.querySelector("#result-copy").textContent = status.copy;
      resultOverlay.hidden = false;
    } else {
      resultOverlay.hidden = true;
    }
    this.root.querySelector("[data-undo]").disabled = history.length === 0;
  }

  gameStatus() {
    if (this.chess.isCheckmate()) {
      return { title: "CHECKMATE", copy: (this.chess.turn() === "w" ? "Black" : "White") + " wins. A decisive finish." };
    }
    if (this.chess.isStalemate()) return { title: "STALEMATE", copy: "The king is not in check, but no legal move remains. The game is a draw." };
    if (this.chess.isThreefoldRepetition()) return { title: "THREEFOLD DRAW", copy: "The same position occurred three times. The game is drawn." };
    if (this.chess.isInsufficientMaterial()) return { title: "DRAW", copy: "Neither side has enough material to force checkmate." };
    if (this.chess.isDrawByFiftyMoves()) return { title: "50-MOVE DRAW", copy: "Fifty moves by each side have passed without a pawn move or capture." };
    if (this.chess.isDraw()) return { title: "DRAW", copy: "The game has ended in a draw." };
    return { title: "", copy: "" };
  }

  renderHistory() {
    const moves = this.chess.history({ verbose: true });
    if (!moves.length) {
      this.moveList.innerHTML = '<div class="ga-empty-moves">The first move is yours.</div>';
      return;
    }
    const rows = [];
    for (let index = 0; index < moves.length; index += 2) {
      const white = moves[index];
      const black = moves[index + 1];
      rows.push('<div class="ga-move-row"><span class="ga-move-index">' + (Math.floor(index / 2) + 1) + '.</span><strong>' + escapeHTML(white.san) + '</strong><strong>' + (black ? escapeHTML(black.san) : '<span class="ga-pending-move">…</span>') + '</strong></div>');
    }
    this.moveList.innerHTML = rows.join("");
    this.moveList.scrollTop = this.moveList.scrollHeight;
  }

  renderCaptured() {
    const captures = this.chess.history({ verbose: true }).filter((move) => move.captured);
    const whiteLost = captures.filter((move) => move.color === "w").map((move) => PIECE_GLYPHS.b[move.captured]);
    const blackLost = captures.filter((move) => move.color === "b").map((move) => PIECE_GLYPHS.w[move.captured]);
    this.root.querySelector("#white-captured").innerHTML = whiteLost.length ? whiteLost.map((glyph) => '<span>' + glyph + '</span>').join("") : "—";
    this.root.querySelector("#black-captured").innerHTML = blackLost.length ? blackLost.map((glyph) => '<span>' + glyph + '</span>').join("") : "—";
  }

  handleSquareClick(square) {
    if (this.chess.isGameOver() || this.pendingPromotion) return;
    if (!this.selected) {
      this.selectSquare(square);
      return;
    }
    if (square === this.selected) {
      this.clearSelection();
      return;
    }
    const legal = this.legalMoves.find((move) => move.to === square);
    if (legal) {
      this.beginMove(legal);
      return;
    }
    const piece = this.chess.get(square);
    if (piece && piece.color === this.chess.turn()) {
      this.selectSquare(square);
      return;
    }
    this.showToast("That square is not a legal destination.");
  }

  selectSquare(square, fromGesture = false) {
    const piece = this.chess.get(square);
    if (!piece || piece.color !== this.chess.turn() || this.chess.isGameOver()) {
      if (fromGesture) this.showToast("It is " + (this.chess.turn() === "w" ? "White" : "Black") + "'s turn.");
      return false;
    }
    this.selected = square;
    this.legalMoves = this.chess.moves({ square: square, verbose: true });
    this.hoverSquare = square;
    this.renderBoard();
    this.renderHUD();
    return true;
  }

  clearSelection() {
    this.selected = null;
    this.legalMoves = [];
    this.hoverSquare = null;
    this.gestureFrom = null;
    this.gestureTarget = null;
    this.hideHeldPiece();
    this.renderBoard();
    this.renderHUD();
  }

  setHoverSquare(square) {
    if (this.hoverSquare === square) return;
    this.hoverSquare = square;
    this.renderBoard();
  }

  beginMove(move) {
    if (move.promotion) {
      this.pendingPromotion = { from: move.from, to: move.to };
      this.root.querySelector("#promotion-overlay").hidden = false;
      return;
    }
    this.commitMove(move.from, move.to);
  }

  finishPromotion(piece) {
    if (!this.pendingPromotion) return;
    const move = this.pendingPromotion;
    this.pendingPromotion = null;
    this.root.querySelector("#promotion-overlay").hidden = true;
    this.commitMove(move.from, move.to, piece);
  }

  cancelPromotion() {
    this.pendingPromotion = null;
    this.root.querySelector("#promotion-overlay").hidden = true;
  }

  commitMove(from, to, promotion = null) {
    try {
      const move = { from: from, to: to };
      if (promotion) move.promotion = promotion;
      const result = this.chess.move(move);
      this.lastMove = { from: result.from, to: result.to };
      this.selected = null;
      this.legalMoves = [];
      this.hoverSquare = null;
      this.gestureFrom = null;
      this.gestureTarget = null;
      this.hideHeldPiece();
      this.renderAll();
      if (!this.chess.isGameOver()) {
        this.showToast(result.san + " · " + (this.chess.turn() === "w" ? "White" : "Black") + " to move");
      }
      return true;
    } catch {
      this.showToast("Illegal move. Choose one of the highlighted squares.");
      return false;
    }
  }

  undoMove() {
    if (!this.chess.history().length) return;
    this.chess.undo();
    this.lastMove = this.chess.history({ verbose: true }).slice(-1)[0] || null;
    if (this.lastMove) this.lastMove = { from: this.lastMove.from, to: this.lastMove.to };
    this.pendingPromotion = null;
    this.root.querySelector("#promotion-overlay").hidden = true;
    this.clearSelection();
    this.renderAll();
    this.showToast("Last move undone.");
  }

  resetGame() {
    this.chess.reset();
    this.lastMove = null;
    this.pendingPromotion = null;
    this.root.querySelector("#promotion-overlay").hidden = true;
    this.clearSelection();
    this.renderAll();
    this.showToast("New game. White moves first.");
  }

  setView(viewId) {
    const view = VIEWS.find((candidate) => candidate.id === viewId);
    if (!view) return;
    this.view = view;
    this.updateView();
    this.renderBoard();
  }

  updateView() {
    const view = this.view;
    const coordinateOrder = view.black ? ["H","G","F","E","D","C","B","A"] : ["A","B","C","D","E","F","G","H"];
    this.root.querySelector(".ga-board-coordinates").innerHTML = coordinateOrder.map((file) => "<span>" + file + "</span>").join("");
    this.boardPlane.style.setProperty("--view-angle", view.angle + "deg");
    this.boardPlane.style.setProperty("--board-tilt", view.tilt + "deg");
    this.boardPlane.style.setProperty("--piece-angle", (-view.angle) + "deg");
    this.boardPlane.classList.toggle("is-overhead", view.tilt === 0);
    this.boardPlane.classList.toggle("is-black-view", view.black);
    this.root.querySelectorAll("[data-view]").forEach((button) => {
      const active = button.dataset.view === view.id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
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
      this.cameraFloat.classList.add("is-live");
      this.cameraToggle.textContent = "DISABLE";
      this.cameraState.textContent = "TRACKING ACTIVE";
      this.root.querySelector("#gesture-status").textContent = "LIVE INPUT";
      this.showToast("Hand control is live. Pinch a piece to move it.");
    } catch (error) {
      this.cameraState.textContent = "CAMERA UNAVAILABLE";
      this.cameraToggle.textContent = "RETRY";
      this.cameraPlaceholder.hidden = false;
      this.cameraPlaceholder.querySelector("strong").textContent = "CAMERA UNAVAILABLE";
      this.cameraPlaceholder.querySelector("small").textContent = error?.message || "Allow camera access and try again.";
      this.showToast(error?.message || "Could not start the camera.");
    } finally {
      this.cameraToggle.disabled = false;
    }
  }

  async stopCamera() {
    await this.input.stop();
    this.cameraEnabled = false;
    this.cameraFloat.classList.remove("is-live");
    this.cameraPlaceholder.hidden = false;
    this.cameraPlaceholder.querySelector("strong").textContent = "CAMERA OFF";
    this.cameraPlaceholder.querySelector("small").textContent = "Enable hand control to begin";
    this.cameraToggle.textContent = "ENABLE";
    this.cameraState.textContent = "READY WHEN YOU ARE";
    this.root.querySelector("#gesture-status").textContent = "MOUSE READY";
    this.cursor.classList.remove("is-visible", "is-pinching");
    this.hideHeldPiece();
    this.pinchActive = false;
    this.pinchStartFrames = 0;
    this.pinchEndFrames = 0;
    this.smoothedPoint = null;
    this.overlay.getContext("2d")?.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }

  chooseHand(result) {
    const hands = result.landmarks || [];
    if (!hands.length) return null;
    const candidates = hands.map((landmarks, index) => {
      const palm = Math.max(distance(landmarks[0], landmarks[9]), 0.001);
      const ratio = distance(landmarks[4], landmarks[8]) / palm;
      const score = result.handednesses?.[index]?.[0]?.score || 0.5;
      return { landmarks: landmarks, index: index, ratio: ratio, score: score };
    });
    const pinching = candidates.filter((item) => item.ratio < 0.55).sort((a, b) => a.ratio - b.ratio);
    return pinching[0] || candidates.sort((a, b) => b.score - a.score)[0];
  }

  handleLandmarks(result) {
    if (this.disposed) return;
    const hands = result.landmarks || [];
    this.drawHandOverlay(hands);
    if (!hands.length) {
      const lostFor = performance.now() - this.lastHandSeen;
      if (lostFor > 180) this.cursor.classList.remove("is-visible");
      if (lostFor > 320 && this.pinchActive) {
        this.pinchActive = false;
        this.pinchStartFrames = 0;
        this.pinchEndFrames = 0;
        this.cursor.classList.remove("is-pinching");
        this.hideHeldPiece();
        this.gestureFrom = null;
        this.gestureTarget = null;
        this.showToast("Hand tracking lost. The selected piece is safe; pinch again to continue.");
      }
      return;
    }

    this.lastHandSeen = performance.now();
    const chosen = this.chooseHand(result);
    if (!chosen) return;
    const indexTip = chosen.landmarks[8];
    const target = {
      x: clamp((1 - indexTip.x) * window.innerWidth, 0, window.innerWidth),
      y: clamp(indexTip.y * window.innerHeight, 0, window.innerHeight)
    };
    if (!this.smoothedPoint) this.smoothedPoint = target;
    else {
      const movement = Math.hypot(target.x - this.smoothedPoint.x, target.y - this.smoothedPoint.y);
      const alpha = movement > 24 ? 0.72 : (movement > 8 ? 0.58 : 0.42);
      this.smoothedPoint.x += (target.x - this.smoothedPoint.x) * alpha;
      this.smoothedPoint.y += (target.y - this.smoothedPoint.y) * alpha;
    }
    this.cursorPoint = { x: this.smoothedPoint.x, y: this.smoothedPoint.y };
    this.cursor.style.left = this.cursorPoint.x + "px";
    this.cursor.style.top = this.cursorPoint.y + "px";
    this.cursor.classList.add("is-visible");

    const palm = Math.max(distance(chosen.landmarks[0], chosen.landmarks[9]), 0.001);
    const pinchRatio = distance(chosen.landmarks[4], chosen.landmarks[8]) / palm;
    const isPinch = pinchRatio < (this.pinchActive ? 0.48 : 0.34);
    this.updatePinchState(isPinch);
    if (this.pinchActive) this.cursor.classList.add("is-pinching");
    else this.cursor.classList.remove("is-pinching");

    const openPalm = this.isOpenPalm(chosen.landmarks);
    if (openPalm && !this.pinchActive && this.selected) {
      this.openPalmFrames = (this.openPalmFrames || 0) + 1;
      if (this.openPalmFrames > 16) {
        this.clearSelection();
        this.openPalmFrames = 0;
        this.showToast("Selection cancelled.");
      }
    } else {
      this.openPalmFrames = 0;
    }

    if (this.pinchActive && this.selected) {
      const square = this.squareAtPoint(this.cursorPoint.x, this.cursorPoint.y);
      if (square) {
        this.gestureTarget = square;
        this.setHoverSquare(square);
      }
    }
  }

  updatePinchState(isPinch) {
    if (!this.pinchActive) {
      this.pinchStartFrames = isPinch ? this.pinchStartFrames + 1 : 0;
      if (this.pinchStartFrames >= 2) {
        this.pinchActive = true;
        this.pinchStartFrames = 0;
        this.onPinchStart();
      }
      return;
    }
    this.pinchEndFrames = isPinch ? 0 : this.pinchEndFrames + 1;
    if (this.pinchEndFrames >= 2) {
      this.pinchActive = false;
      this.pinchEndFrames = 0;
      this.onPinchEnd();
    }
  }

  onPinchStart() {
    const point = this.cursorPoint;
    if (!point) return;
    const square = this.squareAtPoint(point.x, point.y);
    if (!square) return;

    if (!this.selected || square !== this.selected) {
      const piece = this.chess.get(square);
      if (piece && piece.color === this.chess.turn()) {
        this.selectSquare(square, true);
        this.gestureFrom = square;
        this.gestureTarget = square;
        this.showHeldPiece();
      } else if (this.selected) {
        this.showToast("Pinch the selected piece to pick it up.");
      }
      return;
    }

    this.gestureFrom = this.selected;
    this.gestureTarget = this.selected;
    this.showHeldPiece();
  }

  onPinchEnd() {
    this.hideHeldPiece();
    if (!this.selected) return;
    const target = this.squareAtPoint(this.cursorPoint?.x || 0, this.cursorPoint?.y || 0) || this.gestureTarget;
    const from = this.gestureFrom || this.selected;
    if (target && target !== from) {
      const move = this.legalMoves.find((candidate) => candidate.to === target);
      if (move) this.beginMove(move);
      else this.showToast("Not a legal move. The piece is still selected.");
    }
    this.gestureFrom = null;
    this.gestureTarget = null;
    this.setHoverSquare(null);
  }

  showHeldPiece() {
    const piece = this.selected ? this.chess.get(this.selected) : null;
    if (!piece || !this.cursorHeld) return;
    this.cursorHeld.textContent = PIECE_GLYPHS[piece.color][piece.type];
    this.cursor.classList.add("has-held-piece");
    this.board?.classList.add("is-carrying");
  }

  hideHeldPiece() {
    if (this.cursorHeld) this.cursorHeld.textContent = "";
    this.cursor?.classList.remove("has-held-piece");
    this.board?.classList.remove("is-carrying");
  }

  squareAtPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    const square = element?.closest?.("[data-square]");
    return square && this.board.contains(square) ? square.dataset.square : null;
  }

  isOpenPalm(landmarks) {
    const pairs = [[8, 6], [12, 10], [16, 14], [20, 18]];
    let extended = 0;
    for (const pair of pairs) {
      if (distance(landmarks[pair[0]], landmarks[0]) > distance(landmarks[pair[1]], landmarks[0]) * 1.13) extended += 1;
    }
    return extended >= 4;
  }

  drawHandOverlay(hands) {
    const canvas = this.overlay;
    const context = canvas.getContext("2d");
    if (!context) return;
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    hands.forEach((landmarks) => {
      context.lineWidth = 2.2;
      context.strokeStyle = "rgba(137,255,204,.82)";
      context.shadowColor = "rgba(64,255,190,.68)";
      context.shadowBlur = 8;
      HAND_CONNECTIONS.forEach(([from, to]) => {
        context.beginPath();
        context.moveTo(landmarks[from].x * width, landmarks[from].y * height);
        context.lineTo(landmarks[to].x * width, landmarks[to].y * height);
        context.stroke();
      });
      context.shadowBlur = 0;
      landmarks.forEach((landmark, index) => {
        context.beginPath();
        context.arc(landmark.x * width, landmark.y * height, index === 4 || index === 8 ? 4.2 : 2, 0, Math.PI * 2);
        context.fillStyle = index === 4 || index === 8 ? "#eaff6f" : "#b8ffdf";
        context.fill();
      });
    });
    context.restore();
  }

  resizeCameraCanvas() {
    if (!this.overlay) return;
    const rect = this.overlay.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = Math.max(1, Math.round(rect.width * ratio));
    this.overlay.height = Math.max(1, Math.round(rect.height * ratio));
    const context = this.overlay.getContext("2d");
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  showToast(message) {
    if (!this.toast) return;
    window.clearTimeout(this.lastToastTimer);
    this.toast.textContent = message;
    this.toast.classList.add("is-visible");
    this.lastToastTimer = window.setTimeout(() => this.toast?.classList.remove("is-visible"), 2200);
  }

  async copyPGN() {
    try {
      await navigator.clipboard.writeText(this.chess.pgn());
      this.showToast("PGN copied to clipboard.");
    } catch {
      this.showToast("Clipboard access is unavailable in this browser.");
    }
  }

  async dispose() {
    this.disposed = true;
    window.removeEventListener("resize", this.resizeHandler);
    window.clearTimeout(this.lastToastTimer);
    await this.stopCamera();
    await this.input.dispose();
    this.root?.replaceChildren();
  }
}
