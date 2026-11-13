# Gesture Chess — implementation and interaction contract

## Scope

Gesture Chess is the first playable module in GestureArcade. It is a local, two-player match: White moves, then Black moves, and the side-to-move changes only after a legal move is committed.

The board is deliberately 2.5D rather than a free-orbit 3D scene. It uses raised chess-piece styling, shadows and one perspective plane. The view selector exposes exactly seven fixed presets:

- White · top
- Black · top
- White · left
- White · right
- Black · left
- Black · right
- Top · middle

No orbit controls or arbitrary camera angles are provided.

## Rules authority

chess.js is the only rules authority. UI and gesture input never move a piece directly. They submit a { from, to, promotion } request to the rules engine. The engine validates the move before the visible board is updated.

Supported standard rules include legal movement and king-safety validation, check, checkmate, stalemate, castling, en passant, promotion choice, move history, undo, PGN and draw conditions. The UI also marks the checked king and displays terminal results.

## Turn and selection contract

1. chess.turn() determines the only color that can be selected.
2. Selecting a current-side piece loads its verbose legal-move list.
3. Empty legal destinations are green.
4. Legal captures (including en passant) are red.
5. A move is committed only when the destination exists in the selected piece's legal-move list.
6. A successful move clears selection and switches the active side through the rules engine.
7. After promotion, the player chooses queen, rook, bishop or knight.

A gesture cannot select the other side's pieces or skip the current turn.

## Hand-tracking pipeline

GestureInput requests webcam access only after a button press and provides MediaPipe hand landmarks. ChessGame maps the index fingertip into the mirrored viewport coordinate space and uses browser hit-testing to identify the square under that cursor.

The control path is:

camera → hand landmarks → smoothed index cursor → pinch state → square hit-test → legal move request → chess.js

The cursor uses adaptive exponential smoothing: larger movements are followed more quickly and small movements are damped. Pinch grab/release use different normalized thumb-index thresholds and a two-frame confirmation to reduce flicker. With two visible hands, the hand showing the clearest pinch is selected as the controller. Both sides may use either physical hand; turn ownership is enforced by the chess rules state.

### Gesture mapping

| Input | Meaning |
|---|---|
| Index fingertip movement | Point / hover |
| Thumb-index pinch | Grab current-side piece |
| Continued pinch + hand movement | Carry selected piece |
| Pinch release | Drop on legal destination |
| Sustained open palm while not pinching | Cancel selection |

The live preview draws the hand skeleton and fingertip landmarks. The cursor is overlaid on the main screen so the player can see exactly where the gesture is targeting.

## Fallback input

The board supports click-to-select and click-to-move. This makes the game playable on a desktop without a camera and provides a way to verify chess rules independently of hand-tracking conditions.

## Lifecycle and cleanup

The module is registered through GameManager and follows mount() / dispose(). dispose() stops MediaPipe, stops all camera tracks, clears the overlay and removes its resize listener. The camera does not remain active after the chess game is exited.

## Tests

chess-rules.test.js uses Node's built-in test runner and checks:

- Initial legal move count
- Rejection of an illegal move without changing FEN
- Castling and rook relocation
- En-passant capture
- All four promotion choices
- Checkmate
- Stalemate
- Threefold repetition

Run with npm test.
