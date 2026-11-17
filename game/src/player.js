// The courier ship: position, velocity and the drift physics that give
// Neon Drift its name. Thrust accelerates, but momentum is only gently
// damped, so the ship slides and has to be steered out of its own drift.

export const SHIP_RADIUS = 16;
const THRUST = 950; // px per second squared
const DRAG = 0.42; // fraction of velocity kept after one second
const MAX_SPEED = 560;

export function createShip(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2, // nose up
    radius: SHIP_RADIUS,
    invuln: 0, // seconds of post-hit invulnerability left
    thrusting: false,
  };
}

export function resetShip(ship, x, y) {
  ship.x = x;
  ship.y = y;
  ship.vx = 0;
  ship.vy = 0;
  ship.angle = -Math.PI / 2;
  ship.invuln = 0;
  ship.thrusting = false;
}

// ax/ay are the steering axes from input.js. The ship eases its nose
// toward wherever it is actually travelling.
export function stepShip(ship, ax, ay, dt, width, height) {
  ship.thrusting = ax !== 0 || ay !== 0;
  if (ship.thrusting) {
    const len = Math.hypot(ax, ay) || 1;
    ship.vx += (ax / len) * THRUST * dt;
    ship.vy += (ay / len) * THRUST * dt;
  }
  const keep = Math.pow(DRAG, dt);
  ship.vx *= keep;
  ship.vy *= keep;
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > MAX_SPEED) {
    ship.vx = (ship.vx / speed) * MAX_SPEED;
    ship.vy = (ship.vy / speed) * MAX_SPEED;
  }
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  // The field's edge is a hard wall: stop dead rather than bounce away.
  const r = ship.radius;
  if (ship.x < r) { ship.x = r; ship.vx = Math.max(0, ship.vx); }
  if (ship.x > width - r) { ship.x = width - r; ship.vx = Math.min(0, ship.vx); }
  if (ship.y < r) { ship.y = r; ship.vy = Math.max(0, ship.vy); }
  if (ship.y > height - r) { ship.y = height - r; ship.vy = Math.min(0, ship.vy); }

  if (speed > 24) {
    const target = Math.atan2(ship.vy, ship.vx);
    let diff = target - ship.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ship.angle += diff * Math.min(1, dt * 10);
  }
  if (ship.invuln > 0) ship.invuln -= dt;
}
