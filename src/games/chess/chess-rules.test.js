import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";

test("starts from the standard position with 20 legal moves", () => {
  const chess = new Chess();
  assert.equal(chess.moves().length, 20);
  assert.equal(chess.turn(), "w");
});

test("rejects an illegal move without changing the position", () => {
  const chess = new Chess();
  const before = chess.fen();
  assert.throws(() => chess.move({ from: "e2", to: "e5" }));
  assert.equal(chess.fen(), before);
});

test("supports castling and moves the rook as part of the move", () => {
  const chess = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  chess.move({ from: "e1", to: "g1" });
  assert.equal(chess.get("g1")?.type, "k");
  assert.equal(chess.get("f1")?.type, "r");
  assert.equal(chess.get("h1"), undefined);
});

test("supports en-passant capture", () => {
  const chess = new Chess("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
  const moves = chess.moves({ square: "e5", verbose: true });
  assert.ok(moves.some((move) => move.to === "d6" && move.flags.includes("e")));
  chess.move({ from: "e5", to: "d6" });
  assert.equal(chess.get("d5"), undefined);
  assert.equal(chess.get("d6")?.type, "p");
});

test("supports all four promotion choices", () => {
  for (const promotion of ["q", "r", "b", "n"]) {
    const chess = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    chess.move({ from: "a7", to: "a8", promotion });
    assert.equal(chess.get("a8")?.type, promotion);
  }
});

test("detects checkmate", () => {
  const chess = new Chess();
  chess.move("f3");
  chess.move("e5");
  chess.move("g4");
  chess.move("Qh4#");
  assert.equal(chess.isCheckmate(), true);
  assert.equal(chess.isGameOver(), true);
});

test("detects stalemate", () => {
  const chess = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(chess.isStalemate(), true);
  assert.equal(chess.isGameOver(), true);
});

test("detects threefold repetition", () => {
  const chess = new Chess();
  for (let cycle = 0; cycle < 2; cycle += 1) {
    chess.move("Nf3");
    chess.move("Nf6");
    chess.move("Ng1");
    chess.move("Ng8");
  }
  assert.equal(chess.isThreefoldRepetition(), true);
  assert.equal(chess.isDraw(), true);
});
