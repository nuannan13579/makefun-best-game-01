// The things that float in the drift field: star shards to collect,
// asteroids to avoid, repair cells to grab, and the particle bursts that
// mark every event. Factories take an rng so screenshot scenes can place
// them deterministically; live play passes Math.random.

// A glowing shard: worth points, feeds the combo. Spins and pulses.
export function makeShard(x, y, rng = Math.random) {
  return {
    kind: 'shard',
    x,
    y,
    r: 12,
    phase: rng() * Math.PI * 2,
    spin: (rng() - 0.5) * 1.8,
    rot: rng() * Math.PI,
  };
}

// An asteroid: an irregular rock polygon with a slow tumble.
export function makeAsteroid(x, y, vx, vy, r, rng = Math.random) {
  const points = 9 + Math.floor(rng() * 4);
  const verts = [];
  for (let i = 0; i < points; i++) verts.push(0.7 + rng() * 0.55);
  return {
    kind: 'rock',
    x,
    y,
    vx,
    vy,
    r,
    rot: rng() * Math.PI * 2,
    vr: (rng() - 0.5) * 1.5,
    verts,
  };
}

// A repair cell: restores hull, fades away after a while if ignored.
export function makeRepair(x, y, rng = Math.random) {
  return {
    kind: 'repair',
    x,
    y,
    r: 14,
    phase: rng() * Math.PI * 2,
    life: 10,
  };
}

// Spawn a burst of short-lived sparks at a point.
export function burst(list, x, y, color, count, speed, rng = Math.random) {
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const v = speed * (0.25 + rng() * 0.95);
    const life = 0.35 + rng() * 0.5;
    list.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life,
      max: life,
      color,
      size: 1.6 + rng() * 2.8,
    });
  }
}

// Advance every particle; dead ones are removed in place.
export function stepParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.12, dt);
    p.vy *= Math.pow(0.12, dt);
  }
}

// Drift a free-floating entity and advance its spin/pulse clocks.
export function stepDrifter(e, dt) {
  e.x += (e.vx || 0) * dt;
  e.y += (e.vy || 0) * dt;
  if (e.rot !== undefined) e.rot += (e.vr !== undefined ? e.vr : e.spin || 0) * dt;
  if (e.phase !== undefined) e.phase += dt * 3;
  if (e.life !== undefined) e.life -= dt;
}
