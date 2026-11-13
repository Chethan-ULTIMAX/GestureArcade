# GestureArcade

**Play beyond the screen.** GestureArcade is a browser-based collection of games controlled with natural hand movement.

## Current status

| Game | Status | Main interaction |
|---|---|---|
| Chess | **Playable** | Pinch, pick up, move and release |
| Carrom | Planned | Aim and flick |
| Air Hockey | Planned | Palm-tracked paddle |
| Bowling | Planned | Swing and release |
| Jenga | Planned | Pinch and slide |

The arcade shell and shared runtime are in place. Chess is the first complete game module; the other game cards remain previews until their modules are implemented.

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

### Standard chess rules

The rules engine is chess.js 1.4.x. The game accepts only legal moves and supports:

- Check, checkmate and stalemate
- Castling on either side when the rules permit it
- En passant
- Promotion to queen, rook, bishop or knight
- Move history and PGN export
- Undo and reset
- Draw detection, including threefold repetition, insufficient material and the fifty-move rule

The game is local two-player (White and Black taking turns). It does not currently include a computer opponent or online multiplayer.

### Hand controls

Enable the camera from inside the chess game; it does not start automatically.

| Gesture | Action |
|---|---|
| Point with index finger | Move the on-screen hand cursor |
| Pinch thumb and index finger | Pick up the piece under the cursor |
| Keep pinching and move | Carry the selected piece |
| Release over a highlighted square | Place the piece if the move is legal |
| Hold an open palm | Cancel the current selection |

Legal empty destinations glow green. Capture destinations are marked red. The active turn controls which color of pieces can be selected, so after White moves, the next hand interaction is limited to Black's pieces.

The hand cursor is smoothed and pinch transitions use separate grab/release thresholds to reduce jitter and accidental drops. A mouse/touch click-to-select and click-to-move fallback is also available.

### Camera and privacy

- Webcam permission is requested only after the player presses Enable.
- Hand landmark detection runs in the browser using MediaPipe Tasks Vision.
- The camera stream is not uploaded by this application.
- Use localhost or HTTPS for webcam access.
- Stop hand tracking from the camera panel or leave the game to stop the camera stream.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

    git clone https://github.com/Chethan-ULTIMAX/GestureArcade.git
    cd GestureArcade
    npm install
    npm run dev

Open the local Vite URL in a modern browser. For a production build, run:

    npm run build
    npm run preview

Run the chess rules regression tests:

    npm test

## Project structure

    src/
      core/       Shared 3D scene and game lifecycle
      data/       Game registry and UI metadata
      vision/     Webcam + MediaPipe hand landmark runtime
      games/
        chess/    Chess UI, rules integration, gesture mapping and tests
      main.js     Arcade shell and navigation
      style.css   Arcade design system
    docs/
      ARCHITECTURE.md
      CHESS-GESTURE-CONTROLS.md

## Guiding architecture

Track hands once. Interpret gestures once. Map those gestures into each game independently. Every game must stop its camera use, animation loops, event listeners and owned resources when it closes.

## License notes

- GestureArcade source code: repository license applies.
- chess.js: BSD-2-Clause.
- Three.js: MIT.
- MediaPipe Tasks Vision: Apache-2.0.
