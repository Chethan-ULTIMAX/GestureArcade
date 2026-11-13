import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD,
  createCarromRack,
  createStriker,
  isCarromSettled,
  isValidStrikerLineup,
  stepCarromPhysics
} from "./CarromPhysics.js";

const makeBody = (id, x, y, vx = 0, vy = 0, radius = 16.5) => ({
  id, color: "white", x, y, vx, vy, radius, mass: 1, active: true
});

test("rack has a queen and exactly nine coins for each player", () => {
  const rack = createCarromRack();
  assert.equal(rack.length, 19);
  assert.equal(rack.filter((piece) => piece.color === "white").length, 9);
  assert.equal(rack.filter((piece) => piece.color === "black").length, 9);
  assert.equal(rack.filter((piece) => piece.color === "queen").length, 1);
  assert.ok(rack.every((piece) => piece.active && piece.vx === 0 && piece.vy === 0));
});

test("rack begins compactly around the centre circle", () => {
  const rack = createCarromRack();
  const queen = rack.find((piece) => piece.color === "queen");
  assert.deepEqual({ x: queen.x, y: queen.y }, { x: BOARD.center, y: BOARD.center });
  for (const piece of rack.filter((entry) => entry.color !== "queen")) {
    assert.ok(Math.hypot(piece.x - 500, piece.y - 500) <= 70);
  }
});

test("striker is placed on the correct player's baseline", () => {
  assert.equal(createStriker("white").y, 862);
  assert.equal(createStriker("black").y, 138);
  assert.ok(isValidStrikerLineup("white", 500));
  assert.ok(isValidStrikerLineup("black", 500));
  assert.equal(isValidStrikerLineup("white", 200), false);
});

test("collisions transfer momentum to the struck coin", () => {
  const striker = makeBody("striker", 465, 500, 500, 0, 24);
  striker.color = "striker";
  striker.mass = 1.9;
  const coin = makeBody("coin", 510, 500);
  stepCarromPhysics([striker, coin], 0.04);
  assert.ok(coin.vx > 0, "the coin should receive forward momentum");
  assert.ok(striker.vx < 500, "the striker should lose some momentum");
});

test("the rail reflects a coin back into the playing surface", () => {
  const coin = makeBody("rail-test", 95, 500, -400, 0);
  stepCarromPhysics([coin], 0.05);
  assert.ok(coin.x >= BOARD.min + coin.radius);
  assert.ok(coin.vx > 0, "the rail should reverse the horizontal velocity");
});

test("a coin entering a corner pocket is removed from active play", () => {
  const coin = makeBody("pocket-test", 118, 118, -270, -270);
  let potted = [];
  for (let frame = 0; frame < 14 && coin.active; frame += 1) {
    potted = potted.concat(stepCarromPhysics([coin], 0.05));
  }
  assert.equal(coin.active, false);
  assert.equal(potted.length, 1);
  assert.equal(potted[0].body.id, "pocket-test");
  assert.equal(potted[0].pocket.id, "top-left");
});

test("moving pieces naturally settle under board friction", () => {
  const coin = makeBody("sliding-coin", 500, 500, 450, -120);
  for (let frame = 0; frame < 240; frame += 1) {
    stepCarromPhysics([coin], 1 / 60);
  }
  assert.ok(isCarromSettled([coin]));
  assert.equal(coin.vx, 0);
  assert.equal(coin.vy, 0);
});


test("opening rack pieces do not overlap", () => {
  const rack = createCarromRack();
  for (let i = 0; i < rack.length; i += 1) {
    for (let j = i + 1; j < rack.length; j += 1) {
      const spacing = Math.hypot(rack[i].x - rack[j].x, rack[i].y - rack[j].y);
      assert.ok(spacing >= rack[i].radius + rack[j].radius - 0.001);
    }
  }
});

test("a piece that misses the corner mouth is kept on the board", () => {
  const coin = makeBody("corner-safety", 22, 130, -250, 0);
  stepCarromPhysics([coin], 0.05);
  assert.ok(coin.x >= coin.radius + 4);
  assert.ok(coin.vx > 0);
});
