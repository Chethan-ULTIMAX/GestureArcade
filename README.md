# GestureArcade

**Play beyond the screen.** GestureArcade is a 3D gaming arena where natural hand movements become game controls.

Five familiar games. One shared gesture-input system.

## The games

| Game | Core interaction | Style |
|---|---|---|
| Chess | Pinch, pick up and place pieces | Strategy |
| Carrom | Aim, pull back and flick | Precision |
| Air Hockey | Move a paddle with your palm | Reflex |
| Bowling | Aim, swing and release | Motion |
| Jenga | Pinch and slide blocks | Balance |

> The arcade selection experience and shared runtime foundations are in place. Individual game modules are the next implementation phase; the cards are not playable games yet.

## Built with

- Vite + vanilla JavaScript
- Three.js
- MediaPipe Tasks Vision
- Browser webcam APIs

No framework or backend is required.

## Run locally

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
npm run preview
```

Use localhost or HTTPS for webcam permissions. The camera is not started automatically; a future calibration/game flow must request permission only after the player chooses to enable it.

## Project structure

```text
src/
  core/       Shared 3D scene and game lifecycle
  data/       Game registry and UI metadata
  vision/     Webcam + MediaPipe hand landmark runtime
  input/      Future semantic gesture recognition/mapping
  games/      Independent game modules
  shared/     Reusable physics, objects and utilities
  ui/         Shared game UI components
  main.js     Arcade shell and navigation
  style.css   Design system and responsive styles
docs/
  ARCHITECTURE.md
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before adding a game. It defines the module lifecycle, gesture pipeline, input event contract and implementation order.

## Guiding architecture

Track hands once. Recognize gestures once. Map semantic actions into each game independently. Every game must clean up its animation loops, event listeners, scene resources and camera usage when it closes.

## Repository

https://github.com/Chethan-ULTIMAX/GestureArcade
