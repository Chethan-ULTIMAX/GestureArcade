# Gesture Carrom — implementation and controls

## Scope

Gesture Carrom is the second playable module in GestureArcade. It is a local two-player singles match, with White starting from the bottom baseline and Black from the top. The game uses a perspective wooden board, responsive disc physics and optional webcam hand control.

The presentation is 2.5D rather than a free-orbit 3D scene. The view selector exposes exactly the same seven camera presets as Gesture Chess:

- White · top
- Black · top
- White · left
- White · right
- Black · left
- Black · right
- Top · middle

## Table and physics

The opening rack contains one red queen, nine white carrommen and nine black carrommen. Each piece is a circular body with a position, velocity, radius, mass and active state.

The physics module provides:

- Fixed-size substeps to reduce frame-rate-dependent collision behavior
- Exponential surface friction and a low-speed rest threshold
- Disc-to-disc collision resolution with restitution and a small tangential impulse
- Cushioned edge rails with open corner mouths
- Four pocket sensors that remove a body from play and report which pocket received it

The board is rendered on a high-DPI canvas with wood grain, base lines, arrows, centre markings, shaded pockets, beveled coin gradients, shadows, shot trajectory and pocket effects. Board-view rotation and perspective compression are applied in the drawing transform; pointer coordinates are mapped back through the inverse transform so the seven views remain interactive.

## Shot controls

The striker is positioned along the active player's baseline.

### Mouse or touch

1. Move to the active baseline to position the striker.
2. Press on the striker or baseline.
3. Drag away from the direction you want the striker to travel.
4. Release to launch the shot.

### Webcam hand control

The webcam is opt-in. The camera panel is started only after the player presses Enable.

1. Point along your own baseline to position the striker.
2. Move the index fingertip over the striker and pinch thumb-to-index to grab it.
3. Keep the pinch closed and pull away from the target.
4. Release the pinch to shoot.

The power guide shows the direction and approximate strength before release. Position smoothing is adaptive, pinch transitions use separate start/end thresholds, and the camera panel draws a hand skeleton. If tracking is lost during a pull, the unlaunched shot is cancelled instead of firing from an uncertain cursor position.

## Singles rules implemented

The gameplay follows the core singles flow from the All India Carrom Federation's published Laws of Carrom:

- White breaks first; the break alternates between boards.
- A player keeps the turn after legally pocketing their own carromman.
- Pocketing only the opponent's carromman ends the current turn.
- The red queen is shared. It can be pocketed once the player has pocketed an own carromman and must be covered by pocketing an own carromman in the immediate next stroke.
- A queen pocketed with multiple own carrommen on the opening break is considered covered; one own carromman with the queen creates a cover obligation.
- Pocketing the striker is a foul. The player's own carrommen pocketed in that shot are returned and one due carromman is owed. If a due is outstanding, the next own carromman pocketed is returned to the board.
- A player wins a board by clearing all own carrommen with the queen covered. Clearing all own carrommen before covering the queen loses the board.
- Board points are based on the opponent's carrommen left on the board, with the queen's three-point value available to the board winner up to the published score threshold.
- The exhibition match ends at 25 points or after eight boards. Breaks alternate between boards.

This is an exhibition-oriented implementation of the core singles flow, not a certified tournament referee. Rare and complex tournament cases (including every technical foul, jump/overboard placement, contested placement, doubles rotation and best-of-three match administration) are not fully modeled. The board uses approximated screen-space physics, not a calibrated physical simulation.

Official rule reference: https://www.indiancarrom.co.in/laws-of-carrom/

## Match interface

The HUD includes:

- Current player and baseline ownership
- White and Black match scores
- Remaining carrommen for both sides
- Queen state and outstanding due handling
- Shot log
- Undo for the most recent shot
- New match and next-board controls

The game supports local two-player play only. There is no computer opponent or online multiplayer.

## Lifecycle and privacy

CarromGame follows the GameManager mount/dispose contract. Disposing the game cancels its animation frame, disconnects resize observation, stops MediaPipe, stops every webcam track and removes the game root. Camera processing remains in the browser.

## Regression tests

The CarromPhysics tests cover:

- The opening rack count and colour split
- Queen placement and opening layout bounds
- White and Black striker baselines
- Disc collision momentum transfer
- Rail reflection
- Corner-pocket detection
- Surface friction and rest detection

Run the checks with npm test.
