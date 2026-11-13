# GestureArcade — Foundation Architecture

## Product boundary

GestureArcade is the gesture-controlled gaming arena. It owns the game-selection experience, shared 3D runtime, webcam/hand-landmark input, common gesture vocabulary, and game lifecycle. It is independent from the Engineering Lab and Spatial Interaction Lab projects.

The landing page is a real working shell. Gesture Chess and Gesture Carrom are registered playable modules. Air Hockey, Bowling and Jenga remain previews until their own modules are implemented and tested.

## Current stack

- Vite + vanilla JavaScript (ES modules)
- Three.js for the landing-page 3D scene
- MediaPipe Tasks Vision for shared hand landmarks
- chess.js for standard chess rules and legal-move validation
- Canvas 2D for the 2.5D carrom board and disc rendering
- Browser MediaDevices API for explicit webcam access
- No framework, backend, account system, paid API or server-side dependency

## Runtime layers

    src/
      core/
        ArcadeScene.js
        GameManager.js
      data/
        games.js
      vision/
        GestureInput.js
      games/
        chess/
          ChessGame.js
          chess.css
          chess-rules.test.js
        carrom/
          CarromGame.js
          CarromPhysics.js
          carrom.css
          carrom-physics.test.js
        air-hockey/
        bowling/
        jenga/
      main.js
      style.css

## Game lifecycle

Every game registered with GameManager exposes mount({ root, gameId, input, options, onExit }) and dispose(). A module owns its gameplay state and listeners. The active module must stop the camera, animation frames, observers, listeners and any owned resources when disposed.

## Shared camera and hand input

GestureInput owns:

1. Explicit camera permission and MediaStream lifecycle.
2. MediaPipe Tasks Vision initialization (GPU with CPU fallback).
3. A video-frame-driven detection loop.
4. Landmark callbacks and lifecycle events.
5. Cleanup of camera tracks, animation frames and model resources.

Camera access begins only after a clear user action. The game must not start the camera on page load. No camera frames are stored or uploaded.

## Gesture Chess

The chess module uses chess.js as its only rules authority. It supports standard legal move validation, check, checkmate, stalemate, castling, en passant, promotion, history, undo, PGN and draw states. It uses the seven fixed camera views documented in CHESS-GESTURE-CONTROLS.md.

## Gesture Carrom

The Carrom module uses a dedicated deterministic board-space physics layer and the same seven fixed camera views as Chess. It offers striker positioning, pinch/pull/release aiming, disc collisions, rails, pockets, a core singles queen-cover flow, striker due handling, board scores and local two-player turns.

Physics and rules are kept separate from the DOM and webcam layer where practical. CarromPhysics owns the board bodies, collision stepping, pocket detection and settle checks. CarromGame maps mouse/touch or hand landmarks into striker placement and shot actions, then resolves the returned pocket events into turn and match state.

See CARROM-GESTURE-CONTROLS.md for the interaction contract and explicit rule scope. The implementation is an exhibition-ready core singles variant, not a complete tournament referee for every rare penalty and doubles edge case.

## Future modules

Carrom and Chess establish two reusable interaction patterns:

- Pick-up/place for discrete pieces and rule-validated board movement
- Aim/pull/release for physical objects and impulse-driven tabletop play

Air Hockey, Bowling and Jenga should reuse GestureInput and GameManager, but keep their game-specific controls and physics independent.
