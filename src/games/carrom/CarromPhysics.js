export const BOARD = Object.freeze({
  min: 76,
  max: 924,
  center: 500,
  pocketRadius: 47,
  coinRadius: 16.5,
  strikerRadius: 24
});

const POCKETS = Object.freeze([
  { x: 72, y: 72, id: "top-left" },
  { x: 928, y: 72, id: "top-right" },
  { x: 72, y: 928, id: "bottom-left" },
  { x: 928, y: 928, id: "bottom-right" }
]);

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createCarromRack() {
  const pieces = [];
  let nextId = 0;
  pieces.push({
    id: "queen",
    color: "queen",
    x: BOARD.center,
    y: BOARD.center,
    vx: 0,
    vy: 0,
    radius: BOARD.coinRadius,
    mass: 1,
    active: true,
    angle: 0
  });

  const innerColors = ["white", "black", "white", "black", "white", "black"];
  const outerColors = Array.from({ length: 12 }, (_, index) => index % 2 ? "black" : "white");
  const placeRing = (count, ringRadius, colors, offset) => {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * TAU + offset;
      pieces.push({
        id: "coin-" + (++nextId),
        color: colors[index],
        x: BOARD.center + Math.cos(angle) * ringRadius,
        y: BOARD.center + Math.sin(angle) * ringRadius,
        vx: 0,
        vy: 0,
        radius: BOARD.coinRadius,
        mass: 1,
        active: true,
        angle: 0
      });
    }
  };

  placeRing(6, 34, innerColors, -Math.PI / 2);
  placeRing(12, 68, outerColors, -Math.PI / 2 + Math.PI / 12);

  return pieces;
}

export function createStriker(side = "white", x = BOARD.center) {
  return {
    id: "striker",
    color: "striker",
    x: clamp(x, 310, 690),
    y: side === "white" ? 862 : 138,
    vx: 0,
    vy: 0,
    radius: BOARD.strikerRadius,
    mass: 1.9,
    active: true,
    angle: 0
  };
}

function pocketFor(body) {
  return POCKETS.find((pocket) => distance(body, pocket) <= BOARD.pocketRadius + body.radius * 0.18) || null;
}

function resolveRails(body) {
  const min = BOARD.min + body.radius;
  const max = BOARD.max - body.radius;
  const gap = 147;

  // The four corner mouths are open. The rest of each edge is a cushioned rail.
  if (body.x < min && body.y > gap && body.y < 1000 - gap) {
    body.x = min;
    body.vx = Math.abs(body.vx) * 0.86;
  } else if (body.x > max && body.y > gap && body.y < 1000 - gap) {
    body.x = max;
    body.vx = -Math.abs(body.vx) * 0.86;
  }

  if (body.y < min && body.x > gap && body.x < 1000 - gap) {
    body.y = min;
    body.vy = Math.abs(body.vy) * 0.86;
  } else if (body.y > max && body.x > gap && body.x < 1000 - gap) {
    body.y = max;
    body.vy = -Math.abs(body.vy) * 0.86;
  }

  // Never let a disc escape the physical board if it misses a pocket mouth.
  const safety = body.radius + 4;
  if (body.x < safety) {
    body.x = safety;
    body.vx = Math.abs(body.vx) * 0.72;
  } else if (body.x > 1000 - safety) {
    body.x = 1000 - safety;
    body.vx = -Math.abs(body.vx) * 0.72;
  }
  if (body.y < safety) {
    body.y = safety;
    body.vy = Math.abs(body.vy) * 0.72;
  } else if (body.y > 1000 - safety) {
    body.y = 1000 - safety;
    body.vy = -Math.abs(body.vy) * 0.72;
  }
}

function resolvePair(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minDistance = a.radius + b.radius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared >= minDistance * minDistance) return;

  let distanceNow = Math.sqrt(distanceSquared);
  let nx = distanceNow > 0.0001 ? dx / distanceNow : 1;
  let ny = distanceNow > 0.0001 ? dy / distanceNow : 0;
  if (distanceNow < 0.0001) distanceNow = 0.0001;

  const inverseA = 1 / Math.max(a.mass, 0.01);
  const inverseB = 1 / Math.max(b.mass, 0.01);
  const inverseTotal = inverseA + inverseB;
  const overlap = minDistance - distanceNow;
  const correction = Math.max(0, overlap - 0.02) * 0.82 / inverseTotal;
  a.x -= nx * correction * inverseA;
  a.y -= ny * correction * inverseA;
  b.x += nx * correction * inverseB;
  b.y += ny * correction * inverseB;

  const relativeX = b.vx - a.vx;
  const relativeY = b.vy - a.vy;
  const normalVelocity = relativeX * nx + relativeY * ny;
  if (normalVelocity >= 0) return;

  const restitution = 0.84;
  const impulse = -(1 + restitution) * normalVelocity / inverseTotal;
  const impulseX = impulse * nx;
  const impulseY = impulse * ny;
  a.vx -= impulseX * inverseA;
  a.vy -= impulseY * inverseA;
  b.vx += impulseX * inverseB;
  b.vy += impulseY * inverseB;

  // Small tangential impulse gives wooden coins a little roll rather than
  // making every collision look like frictionless billiards.
  const tangentX = -ny;
  const tangentY = nx;
  const tangentVelocity = relativeX * tangentX + relativeY * tangentY;
  const tangentImpulse = clamp(-tangentVelocity / inverseTotal, -impulse * 0.055, impulse * 0.055);
  a.vx -= tangentImpulse * tangentX * inverseA;
  a.vy -= tangentImpulse * tangentY * inverseA;
  b.vx += tangentImpulse * tangentX * inverseB;
  b.vy += tangentImpulse * tangentY * inverseB;
}

export function stepCarromPhysics(bodies, elapsedSeconds) {
  const active = bodies.filter((body) => body.active);
  const duration = clamp(Number(elapsedSeconds) || 0, 0, 0.05);
  if (!duration || !active.length) return [];

  const substeps = Math.max(1, Math.ceil(duration / (1 / 120)));
  const dt = duration / substeps;
  const damping = Math.exp(-1.72 * dt);
  const potted = [];

  for (let step = 0; step < substeps; step += 1) {
    for (const body of active) {
      if (!body.active) continue;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.angle = (body.angle || 0) + (Math.hypot(body.vx, body.vy) * dt / Math.max(body.radius, 1)) * 0.025;
      body.vx *= damping;
      body.vy *= damping;
      if (Math.hypot(body.vx, body.vy) < 2.7) {
        body.vx = 0;
        body.vy = 0;
      }
      const pocket = pocketFor(body);
      if (pocket) {
        body.active = false;
        body.vx = 0;
        body.vy = 0;
        potted.push({ body, pocket });
        continue;
      }
      resolveRails(body);
    }

    for (let iteration = 0; iteration < 2; iteration += 1) {
      for (let i = 0; i < active.length; i += 1) {
        const a = active[i];
        if (!a.active) continue;
        for (let j = i + 1; j < active.length; j += 1) {
          const b = active[j];
          if (b.active) resolvePair(a, b);
        }
      }
    }
  }

  return potted;
}

export function isCarromSettled(bodies, speedThreshold = 4) {
  return bodies.every((body) => !body.active || Math.hypot(body.vx, body.vy) <= speedThreshold);
}

export function isValidStrikerLineup(side, x) {
  return x >= 310 && x <= 690 && (side === "white" || side === "black");
}
