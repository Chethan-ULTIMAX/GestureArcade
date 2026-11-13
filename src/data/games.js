export const GAMES = [
  {
    id: "chess",
    number: "01",
    name: "Chess",
    tagline: "Think three moves ahead.",
    description: "A complete standard-rules chess match with perspective camera presets, crisp legal-move feedback, and pinch-to-pick-up hand control. Play locally with White and Black taking turns.",
    category: "tabletop",
    categoryLabel: "TABLETOP",
    players: "1–2 PLAYERS",
    session: "10–30 MIN",
    accent: "mint",
    badge: "STRATEGY",
    interaction: "Pick up & place",
    controls: [
      { gesture: "Point", action: "Hover over a piece or destination square" },
      { gesture: "Pinch & hold", action: "Pick up a piece and carry it" },
      { gesture: "Release", action: "Place it on a highlighted legal square" },
      { gesture: "Open palm", action: "Cancel the current selection" }
    ],
    buildNotes: [
      "Standard chess rules: legal moves, check, checkmate and draws",
      "Castling, en passant, four-way promotion and complete turn history",
      "Seven fixed camera views, 2.5D pieces and gesture-driven moves"
    ],
    art: "chess"
  },
  {
    id: "carrom",
    number: "02",
    name: "Carrom",
    tagline: "Line it up. Flick it. Pocket it.",
    description: "A full local two-player carrom board with responsive striker physics, four corner pockets, queen cover rules, fouls, match scoring and seven fixed camera views. Aim, pull back and flick with your hand.",
    category: "tabletop",
    categoryLabel: "TABLETOP",
    players: "1–2 PLAYERS",
    session: "5–15 MIN",
    accent: "amber",
    badge: "PRECISION",
    interaction: "Aim & flick",
    controls: [
      { gesture: "Point", action: "Position the striker along your baseline" },
      { gesture: "Pinch & hold", action: "Grab the striker to begin a shot" },
      { gesture: "Pull back", action: "Aim opposite the target and set power" },
      { gesture: "Release", action: "Flick the striker into the coins" }
    ],
    buildNotes: [
      "Responsive striker, carromman and rail collision physics",
      "Four corner pockets, queen cover and striker-foul handling",
      "Two-player turns, board scoring, match to 25 and eight-board limit",
      "Seven fixed camera views and smooth pinch-pull-release controls"
    ],
    art: "carrom"
  },
  {
    id: "air-hockey",
    number: "03",
    name: "Air Hockey",
    tagline: "Fast hands. Faster rebounds.",
    description: "A glowing arena where your palm becomes the paddle. Track the puck, own your half, and send it flying toward the goal.",
    category: "action",
    categoryLabel: "ARCADE ACTION",
    players: "1–2 PLAYERS",
    session: "2–5 MIN",
    accent: "blue",
    badge: "REFLEX",
    interaction: "Palm tracking",
    controls: [
      { gesture: "Open palm", action: "Control the paddle position" },
      { gesture: "Move quickly", action: "Intercept and strike the puck" },
      { gesture: "Hold position", action: "Defend your goal" }
    ],
    buildNotes: [
      "Low-latency palm-to-paddle mapping",
      "Puck physics, wall bounces and goal sensors",
      "Player zones, score system and match reset"
    ],
    art: "hockey"
  },
  {
    id: "bowling",
    number: "04",
    name: "Bowling",
    tagline: "Find your line. Make it count.",
    description: "Set your stance, aim down the lane, then release a virtual bowling ball with a natural hand motion. Chase the perfect strike.",
    category: "action",
    categoryLabel: "ARCADE ACTION",
    players: "1 PLAYER",
    session: "5–10 MIN",
    accent: "violet",
    badge: "MOTION",
    interaction: "Swing & release",
    controls: [
      { gesture: "Grip gesture", action: "Hold the bowling ball" },
      { gesture: "Move sideways", action: "Adjust your aim" },
      { gesture: "Forward swing", action: "Release the ball down the lane" }
    ],
    buildNotes: [
      "Lane, pins and ball built as 3D objects",
      "Swing velocity and release-direction estimation",
      "Pin collision, frame scoring and reset flow"
    ],
    art: "bowling"
  },
  {
    id: "jenga",
    number: "05",
    name: "Jenga",
    tagline: "Steady hands. No second chances.",
    description: "Find the block that can move, pinch to take hold, and slide it free without bringing the tower down. Easy to learn. Hard to master.",
    category: "skill",
    categoryLabel: "SKILL & BALANCE",
    players: "1–2 PLAYERS",
    session: "5–15 MIN",
    accent: "rose",
    badge: "BALANCE",
    interaction: "Pinch & slide",
    controls: [
      { gesture: "Pinch", action: "Select a wooden block" },
      { gesture: "Slow lateral move", action: "Slide the block out" },
      { gesture: "Release", action: "Place it on top of the tower" }
    ],
    buildNotes: [
      "Stack generation with alternating block layers",
      "Precise object selection and collision-aware dragging",
      "Tower stability checks and turn progression"
    ],
    art: "jenga"
  }
];

export const FILTERS = [
  { id: "all", label: "All games" },
  { id: "tabletop", label: "Tabletop" },
  { id: "action", label: "Arcade action" },
  { id: "skill", label: "Skill & balance" }
];

export function getGameById(id) {
  return GAMES.find((game) => game.id === id) ?? null;
}
