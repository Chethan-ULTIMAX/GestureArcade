# GestureArcade

**Play beyond the screen.** GestureArcade is a browser-based collection of games controlled with natural hand movement.

## Current status

| Game | Status | Main interaction |
|---|---|---|
| Chess | **Playable** | Pinch, pick up, move and release |
| Carrom | **Playable** | Position, pinch, pull back and flick |
| Air Hockey | Planned | Palm-tracked paddle |
| Bowling | Planned | Swing and release |
| Jenga | Planned | Pinch and slide |

The arcade shell and shared camera/hand-landmark runtime are in place. Chess and Carrom are playable local two-player modules; the other game cards remain previews.

## Gesture Chess

Gesture Chess is a local two-player chess match with a perspective board and seven fixed camera presets:

1. White · top
2. Black · top
3. White · left
4. White · right
5. Black · left
6. Black · right
7. Top · middle

The board uses a 2.5D presentation: raised piece styling, layered shadows and a perspective board plane. It is not a free-orbit 3D scene.

The chess.js rules engine validates every move and supports check, checkmate, stalemate, castling, en passant, four-way promotion, undo, PGN and draw detection. See [Chess gesture controls](docs/CHESS-GESTURE-CONTROLS.md).

## Gesture Carrom

Gesture Carrom is a local two-player singles match on a perspective wooden board. It includes:

- A full 19-piece opening rack: nine white, nine black and the red queen
- Four corner pockets, cushioned rails and responsive disc collisions
- Striker positioning, pull-back power, aim guide and flick release
- Turn retention when your own carrommen are pocketed
- Queen eligibility and immediate cover handling
- Striker fouls, returned coins and outstanding due pieces
- Shot log, undo, reset and captured-piece counts
- Board points, alternating breaks, a first-to-25 match target and an eight-board limit
- The same seven fixed camera views as Chess

### Hand controls

| Gesture | Action |
|---|---|
| Point along your baseline | Position the striker |
| Pinch the striker | Begin a shot |
| Keep pinching and pull away from the target | Set aim and power |
| Release | Flick the striker |
| Open palm | Cancel an aim before release |

A mouse/touch fallback is available: move to the baseline, press on the striker, drag backwards and release. The camera is opt-in and uses the same MediaPipe runtime as Chess.

The Carrom rules implement the core singles flow based on the published All India Carrom Federation laws. A few tournament-referee edge cases are intentionally simplified for a two-player exhibition game; see [Carrom gesture controls](docs/CARROM-GESTURE-CONTROLS.md).

## Camera and privacy

- Webcam permission is requested only after the player presses Enable.
- Hand landmark detection runs in the browser using MediaPipe Tasks Vision.
- The camera stream is not uploaded by this application.
- Use localhost or HTTPS for webcam access.
- Stop hand tracking from the camera panel or leave the game to stop the camera stream.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

    git clone https://github.com/Chethan-ULTIMAX/GestureArcade.git
    cd GestureArcade
    npm ci
    npm run dev

Open the local Vite URL in a modern browser. For a production build, run:

    npm run build
    npm run preview

Run the chess and carrom regression tests:

    npm test

## Project structure

    src/
      core/       Shared 3D scene and game lifecycle
      data/       Game registry and UI metadata
      vision/     Webcam + MediaPipe hand landmark runtime
      games/
        chess/    Chess UI, rules integration, gesture mapping and tests
        carrom/   Carrom game, physics, gesture mapping and tests
      main.js     Arcade shell and navigation
      style.css   Arcade design system
    docs/
      ARCHITECTURE.md
      CHESS-GESTURE-CONTROLS.md
      CARROM-GESTURE-CONTROLS.md

## Guiding architecture

Track hands once. Interpret gestures once. Map those gestures into each game independently. Every game must stop its camera use, animation loops, event listeners and owned resources when it closes.

## License notes

- GestureArcade source code: repository license applies.
- chess.js: BSD-2-Clause.
- Three.js: MIT.
- MediaPipe Tasks Vision: Apache-2.0.
