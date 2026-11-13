import "./style.css";
import { GAMES, FILTERS, getGameById } from "./data/games.js";
import { ArcadeScene } from "./core/ArcadeScene.js";

const app = document.querySelector("#app");
const PRIORITY_KEY = "gesturearcade:priority-games";

function readPriorityGames() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRIORITY_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((id) => getGameById(id)) : [];
  } catch {
    return [];
  }
}

const state = {
  filter: "all",
  query: "",
  priorityGames: readPriorityGames(),
  mobileNavOpen: false
};

const icon = (name, className = "") => {
  const paths = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUpRight: '<path d="M7 17 17 7M7 7h10v10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    hand: '<path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v8-4a1.5 1.5 0 0 1 3 0v7c0 4-2.8 7-7 7h-1c-2.4 0-4.1-1.1-5.5-3L3 15a1.5 1.5 0 0 1 2.3-1.9L8 16"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>'
  };
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
};

function artMarkup(game) {
  const scenes = {
    chess: `<div class="chess-board">${Array.from({ length: 16 }, (_, i) => `<i class="${(Math.floor(i / 4) + i % 4) % 2 ? "dark" : "light"}"></i>`).join("")}</div><span class="chess-piece chess-piece--one">♞</span><span class="chess-piece chess-piece--two">♜</span><span class="art-orbit"></span>`,
    carrom: `<div class="carrom-board"><span class="carrom-pocket pocket--a"></span><span class="carrom-pocket pocket--b"></span><span class="carrom-pocket pocket--c"></span><span class="carrom-pocket pocket--d"></span><span class="carrom-ring"></span><i class="coin coin--red"></i><i class="coin coin--cream"></i><i class="coin coin--gold"></i><i class="striker"></i></div>`,
    "air-hockey": `<div class="hockey-table"><span class="hockey-line"></span><span class="hockey-circle"></span><span class="hockey-goal hockey-goal--top"></span><span class="hockey-goal hockey-goal--bottom"></span><i class="hockey-puck"></i><i class="hockey-paddle hockey-paddle--left"></i><i class="hockey-paddle hockey-paddle--right"></i></div>`,
    bowling: `<div class="bowling-lane"><span class="lane-arrow"></span><span class="lane-dot"></span><div class="pins">${Array.from({ length: 6 }, (_, i) => `<i style="--pin:${i}"></i>`).join("")}</div><div class="bowling-ball"></div></div>`,
    jenga: `<div class="jenga-tower">${Array.from({ length: 7 }, (_, row) => `<div class="jenga-layer ${row % 2 ? "vertical" : ""}">${Array.from({ length: 3 }, (_, block) => "<i></i>").join("")}</div>`).join("")}</div><span class="jenga-highlight"></span>`
  };
  return `<div class="game-art game-art--${game.art}" aria-hidden="true"><div class="art-glow"></div><div class="art-object">${scenes[game.art]}</div><span class="art-number">${game.number}</span></div>`;
}

function renderGameCard(game) {
  const isPriority = state.priorityGames.includes(game.id);
  return `
    <article class="game-card-wrap" data-card-id="${game.id}">
      <button class="game-card" type="button" data-open-game="${game.id}" aria-haspopup="dialog" aria-label="Explore ${game.name}">
        ${artMarkup(game)}
        <div class="game-card-content">
          <div class="game-card-topline">
            <span class="game-category">${game.categoryLabel}</span>
            <span class="game-number">/${game.number}</span>
          </div>
          <div class="game-title-row">
            <h3>${game.name}</h3>
            <span class="card-arrow">${icon("arrowUpRight")}</span>
          </div>
          <p>${game.tagline}</p>
          <div class="game-card-meta">
            <span>${game.players}</span>
            <span class="meta-dot"></span>
            <span>${game.interaction}</span>
          </div>
        </div>
        ${isPriority ? '<span class="priority-indicator" title="In your build priorities">' + icon("check") + " PRIORITY</span>" : ""}
      </button>
    </article>`;
}

function renderFilters() {
  return FILTERS.map((filter) => `
    <button class="filter-chip ${state.filter === filter.id ? "is-active" : ""}" type="button" data-filter="${filter.id}" aria-pressed="${state.filter === filter.id}">
      ${filter.label}
    </button>`).join("");
}

function renderGrid() {
  const query = state.query.trim().toLowerCase();
  const filtered = GAMES.filter((game) => {
    const matchesFilter = state.filter === "all" || game.category === state.filter;
    const searchable = `${game.name} ${game.tagline} ${game.description} ${game.categoryLabel} ${game.interaction}`.toLowerCase();
    return matchesFilter && (!query || searchable.includes(query));
  });

  const grid = document.querySelector("#games-grid");
  const count = document.querySelector("#results-count");
  const empty = document.querySelector("#empty-state");
  if (!grid || !count || !empty) return;

  grid.innerHTML = filtered.map(renderGameCard).join("");
  count.textContent = `${filtered.length} ${filtered.length === 1 ? "game" : "games"}`;
  empty.hidden = filtered.length > 0;
}

function renderDialog(game) {
  const dialog = document.querySelector("#game-dialog");
  const priority = state.priorityGames.includes(game.id);
  dialog.innerHTML = `
    <div class="dialog-shell">
      <button class="dialog-close" type="button" data-close-dialog aria-label="Close game details">${icon("close")}</button>
      <div class="dialog-art-wrap">${artMarkup(game)}<span class="dialog-index">GAME ${game.number} / 05</span></div>
      <div class="dialog-content">
        <div class="dialog-eyebrow"><span class="eyebrow-dot"></span> ${game.categoryLabel} <span class="dialog-separator">/</span> ${game.badge}</div>
        <h2>${game.name}<span>.</span></h2>
        <p class="dialog-description">${game.description}</p>
        <div class="dialog-stats">
          <span><small>PLAYERS</small>${game.players}</span>
          <span><small>SESSION</small>${game.session}</span>
          <span><small>INPUT</small>${game.interaction}</span>
        </div>
        <div class="dialog-section">
          <h3>THE GESTURE LANGUAGE</h3>
          <div class="control-list">
            ${game.controls.map((control, index) => `
              <div class="control-row">
                <span class="control-index">0${index + 1}</span>
                <strong>${control.gesture}</strong>
                <span>${control.action}</span>
              </div>`).join("")}
          </div>
        </div>
        <div class="dialog-section build-section">
          <div class="build-heading"><h3>GAME MODULE CHECKLIST</h3><span class="build-status">FOUNDATION PHASE</span></div>
          <ul>${game.buildNotes.map((note) => `<li>${icon("check")}${note}</li>`).join("")}</ul>
        </div>
        <div class="dialog-actions">
          <button class="button button--primary" type="button" data-toggle-priority="${game.id}">
            ${priority ? icon("check") + " Added to priorities" : icon("spark") + " Make this a priority"}
          </button>
          <span class="dialog-footnote">Gameplay module is the next build phase.</span>
        </div>
      </div>
    </div>`;
  if (!dialog.open) dialog.showModal();
}

function savePriorities() {
  try {
    localStorage.setItem(PRIORITY_KEY, JSON.stringify(state.priorityGames));
  } catch {
    // The arcade remains usable when storage is unavailable.
  }
}

function updatePriorityButton(gameId) {
  const game = getGameById(gameId);
  if (!game) return;
  const isPriority = state.priorityGames.includes(gameId);
  const button = document.querySelector("[data-toggle-priority]");
  if (button) {
    button.innerHTML = isPriority ? icon("check") + " Added to priorities" : icon("spark") + " Make this a priority";
    button.classList.toggle("is-selected", isPriority);
  }
  renderGrid();
}

app.innerHTML = `
  <div class="ambient ambient--one"></div>
  <div class="ambient ambient--two"></div>
  <header class="site-header">
    <a class="brand" href="#" aria-label="GestureArcade home">
      <span class="brand-mark"><i></i><i></i><i></i></span>
      <span class="brand-word">gesture<span>arcade</span></span>
      <span class="brand-beta">LAB / 01</span>
    </a>
    <nav class="main-nav" id="main-nav" aria-label="Main navigation">
      <a href="#games">The games <span>05</span></a>
      <a href="#how-it-works">How it works</a>
      <a href="#build-next">Build status</a>
    </nav>
    <div class="header-actions">
      <a class="github-link" href="https://github.com/Chethan-ULTIMAX/GestureArcade" target="_blank" rel="noreferrer">GitHub ${icon("arrowUpRight")}</a>
      <a class="header-cta" href="#games">Enter arcade ${icon("arrow")}</a>
    </div>
    <button class="mobile-menu-button" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="main-nav"><span></span><span></span></button>
  </header>

  <main>
    <section class="hero-section">
      <div class="hero-copy">
        <div class="eyebrow"><span class="live-dot"></span> A NEW WAY TO PLAY <span class="eyebrow-line"></span> WEBCAM × 3D</div>
        <h1>Your hands.<br />Your <span class="title-accent">move.</span><br /><span class="title-outline">Your arena.</span></h1>
        <p class="hero-description">Five familiar games. A whole new dimension. Pick up, aim, flick and play — no controller between you and the game.</p>
        <div class="hero-actions">
          <a class="button button--primary" href="#games">Explore the games ${icon("arrow")}</a>
          <a class="text-link" href="#how-it-works">See how it works <span>↘</span></a>
        </div>
        <div class="hero-proof">
          <div class="proof-avatars"><span>✳</span><span>⌁</span><span>◉</span></div>
          <div><strong>ONE CAMERA. FIVE PLAYGROUNDS.</strong><small>Built around natural hand movement</small></div>
        </div>
      </div>
      <div class="hero-visual">
        <div class="visual-label visual-label--top"><span>FIG. 01</span> THE GESTURE INTERFACE</div>
        <div class="hero-canvas-shell">
          <div class="canvas-grid"></div>
          <canvas id="hero-canvas" aria-label="Animated 3D holographic hand illustration"></canvas>
          <div class="visual-orbit-label orbit-label--one"><span></span> TRACK</div>
          <div class="visual-orbit-label orbit-label--two"><span></span> INTERACT</div>
          <div class="visual-coordinate">X 024.08<br />Y 018.42<br />Z 001.70</div>
          <div class="visual-caption"><span class="caption-rule"></span><span>HUMAN INPUT<br /><b>REIMAGINED</b></span></div>
        </div>
        <div class="visual-label visual-label--bottom"><span>INTERACTION MODEL</span><span>01 / 05</span></div>
        <div class="visual-side-note">MOVE NATURALLY<br />LET THE GAME RESPOND</div>
      </div>
      <div class="hero-bottomline"><span>SCROLL TO ENTER THE ARCADE</span><span class="scroll-mark">↓</span><span>DESIGNED FOR DESKTOP + WEBCAM</span></div>
    </section>

    <section class="games-section section-wrap" id="games">
      <div class="section-kicker"><span>01</span> THE PLAYLIST <i></i> FIVE WAYS TO PLAY</div>
      <div class="section-heading-row">
        <div><h2>Choose your <em>game.</em></h2><p>Familiar rules. A different kind of control.</p></div>
        <div class="game-count"><strong>05</strong><span>GAME<br />WORLDS</span></div>
      </div>
      <div class="game-toolbar">
        <div class="filter-list" role="group" aria-label="Filter games by type">${renderFilters()}</div>
        <label class="search-box">${icon("search")}<input id="game-search" type="search" placeholder="Find your game…" autocomplete="off" /><kbd>/</kbd></label>
      </div>
      <div class="results-line"><span id="results-count">5 games</span><span>SELECT A CARD TO EXPLORE <b>↗</b></span></div>
      <div class="games-grid" id="games-grid">${GAMES.map(renderGameCard).join("")}</div>
      <div class="empty-state" id="empty-state" hidden><span>⌕</span><h3>No games found.</h3><p>Try a different name or switch the category.</p><button type="button" class="text-link" data-reset-filters>Reset filters ↗</button></div>
    </section>

    <section class="how-section" id="how-it-works">
      <div class="section-wrap how-inner">
        <div class="how-intro">
          <div class="section-kicker section-kicker--light"><span>02</span> THE MAGIC, MADE SIMPLE <i></i></div>
          <h2>From real movement<br />to <em>game moment.</em></h2>
          <p>The same interaction layer will power every game. Learn it once, then play your way through the entire arcade.</p>
          <div class="how-note">${icon("hand")} <span>NO SPECIAL CONTROLLER.<br /><b>JUST YOUR WEBCAM.</b></span></div>
        </div>
        <div class="steps-list">
          <article class="step-card"><span class="step-number">01</span><div class="step-icon step-icon--camera"><span class="camera-lens"></span></div><div><h3>See</h3><p>Your webcam reads hand landmarks in real time. Camera access stays off until you choose to start.</p></div><span class="step-status">INPUT</span></article>
          <article class="step-card"><span class="step-number">02</span><div class="step-icon step-icon--gesture"><span class="gesture-finger"></span></div><div><h3>Gesture</h3><p>Pinch, point, flick or move your palm. A shared gesture layer translates movement into game-ready actions.</p></div><span class="step-status">TRANSLATE</span></article>
          <article class="step-card"><span class="step-number">03</span><div class="step-icon step-icon--play"><span class="play-triangle"></span></div><div><h3>Play</h3><p>Each game responds with its own rules, 3D objects, physics and feedback — all from the same input system.</p></div><span class="step-status">INTERACT</span></article>
        </div>
      </div>
    </section>

    <section class="build-section section-wrap" id="build-next">
      <div class="build-copy">
        <div class="section-kicker"><span>03</span> IN THE WORKSHOP <i></i> PROJECT STATUS</div>
        <h2>The foundation<br />is <em>in motion.</em></h2>
        <p>The arcade shell, shared scene and gesture-runtime boundaries are in place. Next comes the first playable game — then the rest join the same system.</p>
        <a class="button button--dark" href="https://github.com/Chethan-ULTIMAX/GestureArcade" target="_blank" rel="noreferrer">Follow the build on GitHub ${icon("arrowUpRight")}</a>
      </div>
      <div class="build-board">
        <div class="build-board-top"><span>BUILD ROADMAP</span><span>PHASE 01 — 04</span></div>
        <div class="roadmap-item is-done"><span class="roadmap-check">${icon("check")}</span><div><strong>Arcade foundation</strong><small>Navigation, game registry, UI system</small></div><span class="roadmap-state">READY</span></div>
        <div class="roadmap-item is-done"><span class="roadmap-check">${icon("check")}</span><div><strong>Shared 3D + input boundaries</strong><small>Three.js stage, camera runtime contract</small></div><span class="roadmap-state">READY</span></div>
        <div class="roadmap-item is-next"><span class="roadmap-check">03</span><div><strong>First playable game</strong><small>Game loop, object interaction, feedback</small></div><span class="roadmap-state">NEXT</span></div>
        <div class="roadmap-item"><span class="roadmap-check">04</span><div><strong>Five-game arcade</strong><small>Shared controls, polish, performance pass</small></div><span class="roadmap-state">QUEUED</span></div>
        <div class="build-board-foot"><span class="status-pulse"></span> FOUNDATION BRANCH / MAIN</div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <a class="brand brand--footer" href="#"><span class="brand-mark"><i></i><i></i><i></i></span><span class="brand-word">gesture<span>arcade</span></span></a>
    <span class="footer-message">PLAY BEYOND THE SCREEN.</span>
    <span class="footer-meta">BUILT FOR CURIOUS HANDS <b>✳</b> 2026</span>
  </footer>

  <dialog class="game-dialog" id="game-dialog" aria-label="Game details"></dialog>
`;

const scene = new ArcadeScene(document.querySelector("#hero-canvas"));
renderGrid();

const dialog = document.querySelector("#game-dialog");
const search = document.querySelector("#game-search");
const nav = document.querySelector("#main-nav");
const menuButton = document.querySelector(".mobile-menu-button");

document.querySelector(".filter-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach((chip) => {
    const selected = chip.dataset.filter === state.filter;
    chip.classList.toggle("is-active", selected);
    chip.setAttribute("aria-pressed", String(selected));
  });
  renderGrid();
});

search.addEventListener("input", () => {
  state.query = search.value;
  renderGrid();
});

document.querySelector("#games-grid").addEventListener("click", (event) => {
  const card = event.target.closest("[data-open-game]");
  if (card) renderDialog(getGameById(card.dataset.openGame));
});

document.querySelector("#empty-state").addEventListener("click", (event) => {
  if (!event.target.closest("[data-reset-filters]")) return;
  state.filter = "all";
  state.query = "";
  search.value = "";
  document.querySelectorAll("[data-filter]").forEach((chip) => {
    const selected = chip.dataset.filter === "all";
    chip.classList.toggle("is-active", selected);
    chip.setAttribute("aria-pressed", String(selected));
  });
  renderGrid();
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog || event.target.closest("[data-close-dialog]")) {
    dialog.close();
    return;
  }
  const priorityButton = event.target.closest("[data-toggle-priority]");
  if (!priorityButton) return;
  const gameId = priorityButton.dataset.togglePriority;
  state.priorityGames = state.priorityGames.includes(gameId)
    ? state.priorityGames.filter((id) => id !== gameId)
    : [...state.priorityGames, gameId];
  savePriorities();
  updatePriorityButton(gameId);
});

dialog.addEventListener("close", () => {
  dialog.innerHTML = "";
});

menuButton.addEventListener("click", () => {
  state.mobileNavOpen = !state.mobileNavOpen;
  nav.classList.toggle("is-open", state.mobileNavOpen);
  menuButton.setAttribute("aria-expanded", String(state.mobileNavOpen));
  menuButton.setAttribute("aria-label", state.mobileNavOpen ? "Close navigation" : "Open navigation");
});

nav.addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  nav.classList.remove("is-open");
  state.mobileNavOpen = false;
  menuButton.setAttribute("aria-expanded", "false");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) && !dialog.open) {
    event.preventDefault();
    search.focus();
  }
});

window.addEventListener("pagehide", () => scene?.dispose(), { once: true });
