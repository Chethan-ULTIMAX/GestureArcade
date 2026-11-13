# GestureArcade — Foundation Architecture

## Product boundary

GestureArcade is the gesture-controlled gaming arena. It owns the game-selection experience, shared 3D runtime, webcam/hand-landmark input, common gesture vocabulary, and game lifecycle. It is independent from the Engineering Lab and Spatial Interaction Lab projects.

The landing page is a real working shell. The five cards currently describe the intended game interactions and expose their build checklists. The five actual game modules are **not implemented yet**; do not label the games as playable until their modules are registered and tested.

## Current stack

- Vite + vanilla JavaScript (ES modules)
- Three.js for 3D scenes and rendering
- MediaPipe Tasks Vision for hand landmarks
- Browser MediaDevices API for explicit webcam access
- No framework, backend, account system, paid API, or server-side dependency

## Runtime layers

```text
src/
  core/
    ArcadeScene.js       Landing-page ambient Three.js scene
    GameManager.js       Game registration, launch and disposal lifecycle
  data/
    games.js             Single source of truth for game metadata
  vision/
    GestureInput.js      Camera lifecycle + MediaPipe hand landmarks
  input/                 Future: gesture recognition and game action mapping
  games/
    chess/
    carrom/
    air-hockey/
    bowling/
    jenga/
  shared/
    physics/
    objects/
    utilities/
  ui/
    GameCard.js          Future extraction from the arcade shell
    GameDialog.js        Future extraction from the arcade shell
```

The folders under `games/`, `input/`, `shared/`, and `ui/` are extension points. Create them when the first relevant modules are added; do not add empty placeholder files solely to make the tree look complete.

## Core contracts

### Game registry — `src/data/games.js`

`GAMES` is the canonical metadata list used by the landing page and game selector. IDs are stable kebab-case identifiers:

- `chess`
- `carrom`
- `air-hockey`
- `bowling`
- `jenga`

Keep game display metadata out of the game implementations. Add a game to this list only when the product owner approves it.

### Game lifecycle — `src/core/GameManager.js`

A game implementation registered with `GameManager` must provide:

```js
const gameModule = {
  async mount({ root, gameId, input, options, onExit }) {
    // Build the game scene, subscribe to input and start the game loop.
  },
  async dispose() {
    // Stop animation loops, remove listeners, dispose Three.js resources.
  }
};
```

Register one implementation per stable game ID. `launch()` stops the previous game before mounting the next. A failed mount emits `gameerror` and clears the mount root. `stop()` is idempotent.

### Camera and landmarks — `src/vision/GestureInput.js`

The service is deliberately game-agnostic. It owns:

1. Explicit camera permission and MediaStream lifecycle.
2. MediaPipe Tasks Vision initialization (GPU, then CPU fallback).
3. A video-frame-driven detection loop.
4. Landmark callbacks and service lifecycle events.
5. Complete cleanup of tracks, animation frames and model resources.

Only request camera access after a clear user action. Do not start the camera on page load. Do not store or upload camera frames. Each game must be able to stop and release camera usage when leaving its session.

### Future gesture pipeline

Keep recognition separate from game-specific behavior:

```text
Webcam video
  -> GestureInput (MediaPipe landmarks)
  -> HandLandmarks (normalize, smooth, handedness)
  -> GestureRecognizer (pinch, open palm, point, flick, grab)
  -> GestureMapper (semantic action + normalized coordinates)
  -> Active game controller
  -> Game state / physics / visual feedback
```

A gesture event should be semantic, not a raw MediaPipe object. Suggested shape:

```js
{
  type: "pinch-start",       // pinch-start | pinch-move | pinch-end | palm-move | flick
  hand: "left",              // left | right
  position: { x: 0.52, y: 0.41, z: 0.08 }, // normalized 0..1 x/y
  velocity: { x: 0.02, y: -0.01 },
  confidence: 0.91,
  timestamp: 123456.7
}
```

Use hysteresis for pinch start/end thresholds, smooth position without introducing obvious latency, and avoid dispatching duplicate semantic events every frame. Keep raw landmarks available for advanced game-specific interactions, but do not make every game reimplement hand tracking.

## Initial game interaction proposals

| Game | Primary interaction | Supporting actions |
|---|---|---|
| Chess | Pinch to pick up and place a piece | Hover highlight, cancel, snap to legal square |
| Carrom | Point to aim, pull back and release to shoot | Power preview, striker reposition |
| Air Hockey | Open palm controls a paddle | Fast movement, defensive positioning |
| Bowling | Grip, aim and swing to release | Direction adjustment, power feedback |
| Jenga | Pinch and slide a block | Hover/select, release, tower stability feedback |

Use the same camera and gesture runtime. The mapper may expose game-specific sensitivity profiles, but should not duplicate camera/model lifecycle logic.

## Visual and performance principles

- Use one shared renderer/scene utility where it makes sense, but each game owns its gameplay scene and must dispose its resources.
- Prefer low-poly/custom procedural objects for the first playable version; avoid large paid asset dependencies.
- Cap device pixel ratio and handle resize.
- Use `requestAnimationFrame` and avoid allocating large objects in each frame.
- Smooth landmarks in the interaction layer; do not stack heavy smoothing in every game.
- Keep the landing page usable when WebGL is unavailable.
- Respect `prefers-reduced-motion` and provide keyboard/mouse alternatives where practical.
- Camera access must be opt-in and visible to the user.

## Suggested implementation order

1. Implement shared landmark utilities and semantic gesture recognition; test pinch and palm tracking in a dedicated calibration view.
2. Build one polished vertical slice (recommended: Carrom or Chess) through scene, input, interaction, rules and reset.
3. Validate camera latency, lighting tolerance, hand-loss recovery and performance on ordinary laptop hardware.
4. Extract reusable 3D board/object helpers and game HUD patterns.
5. Implement the remaining games using the same input runtime.
6. Add settings, calibration, accessibility options and a full cross-game performance pass.

## Local development

```bash
npm install
npm run dev
npm run build
npm run preview
```

Camera permissions work on localhost and HTTPS origins. Production hosting must use HTTPS.
