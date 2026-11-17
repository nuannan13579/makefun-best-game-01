// Neon Drift's rules and state. One run: 90 seconds to bank 1500 points
// by collecting star shards. Shards feed a combo multiplier that grows
// with every catch and drains when you stop collecting. Asteroids cost
// hull; three good hits end the run. Reach the target to win.

import { makeShard, makeAsteroid, makeRepair, burst, stepParticles, stepDrifter } from './entities.js';
import { createShip, resetShip, stepShip } from './player.js';
import { sfx } from './audio.js';

export const VIEW_W = 1280;
export const VIEW_H = 800;
export const RUN_SECONDS = 90;
export const TARGET_SCORE = 1500;
export const SHARD_POINTS = 10;
export const HULL_MAX = 100;
export const ROCK_DAMAGE = 34;
export const REPAIR_AMOUNT = 25;
export const COMBO_STEP = 0.25;
export const COMBO_MAX = 6;
export const COMBO_HOLD = 3.5; // seconds a combo survives without a catch

// Small seeded PRNG so the starfield and the screenshot scenes are the
// same on every load. Live spawning uses Math.random instead.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStars() {
  const rng = mulberry32(20261115);
  const stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({ x: rng() * VIEW_W, y: rng() * VIEW_H, z: 0.3 + rng() * 0.7, tw: rng() * Math.PI * 2 });
  }
  return stars;
}

export function createGame() {
  return {
    mode: 'title', // title | playing | paused | won | lost
    loseReason: '',
    time: 0,
    ship: createShip(VIEW_W / 2, VIEW_H / 2),
    stars: makeStars(),
    shards: [],
    rocks: [],
    pickups: [],
    parts: [],
    score: 0,
    combo: 1,
    comboTimer: 0,
    maxCombo: 1,
    hull: HULL_MAX,
    timeLeft: RUN_SECONDS,
    elapsed: 0,
    collected: 0,
    shake: 0,
    shardClock: 0,
    rockClock: 1.2,
    repairClock: 9,
  };
}

export function startRun(g) {
  resetShip(g.ship, VIEW_W / 2, VIEW_H / 2);
  g.shards = [];
  g.rocks = [];
  g.pickups = [];
  g.parts = [];
  g.score = 0;
  g.combo = 1;
  g.comboTimer = 0;
  g.maxCombo = 1;
  g.hull = HULL_MAX;
  g.timeLeft = RUN_SECONDS;
  g.elapsed = 0;
  g.collected = 0;
  g.shake = 0;
  g.shardClock = 0;
  g.rockClock = 1.4;
  g.repairClock = 9;
  g.loseReason = '';
  g.mode = 'playing';
  sfx.launch();
}

export function togglePause(g) {
  if (g.mode === 'playing') g.mode = 'paused';
  else if (g.mode === 'paused') g.mode = 'playing';
}

function endRun(g, won, reason) {
  g.mode = won ? 'won' : 'lost';
  g.loseReason = reason || '';
  if (won) {
    burst(g.parts, g.ship.x, g.ship.y, '#26e7ff', 42, 320);
    burst(g.parts, g.ship.x, g.ship.y, '#ff3ed8', 30, 240);
    sfx.win();
  } else {
    burst(g.parts, g.ship.x, g.ship.y, '#ff7847', 46, 300);
    sfx.lose();
  }
}

// --- spawning ------------------------------------------------------------

function spawnShard(g) {
  // Keep shards a fair flight away from the ship so each one is a trip.
  for (let tries = 0; tries < 12; tries++) {
    const x = 50 + Math.random() * (VIEW_W - 100);
    const y = 90 + Math.random() * (VIEW_H - 150);
    if (Math.hypot(x - g.ship.x, y - g.ship.y) > 150) {
      g.shards.push(makeShard(x, y));
      return;
    }
  }
}

function spawnRock(g) {
  const edge = Math.floor(Math.random() * 4);
  let x;
  let y;
  if (edge === 0) { x = Math.random() * VIEW_W; y = -50; }
  else if (edge === 1) { x = VIEW_W + 50; y = Math.random() * VIEW_H; }
  else if (edge === 2) { x = Math.random() * VIEW_W; y = VIEW_H + 50; }
  else { x = -50; y = Math.random() * VIEW_H; }
  // Aim at a random interior point so rocks cross the play field.
  const tx = VIEW_W * (0.2 + Math.random() * 0.6);
  const ty = VIEW_H * (0.2 + Math.random() * 0.6);
  const dist = Math.hypot(tx - x, ty - y) || 1;
  const ramp = g.elapsed / RUN_SECONDS;
  const speed = 70 + ramp * 120 + Math.random() * 60;
  const r = 16 + Math.random() * 26;
  g.rocks.push(makeAsteroid(x, y, ((tx - x) / dist) * speed, ((ty - y) / dist) * speed, r));
}

function spawnRepair(g) {
  const x = 70 + Math.random() * (VIEW_W - 140);
  const y = 110 + Math.random() * (VIEW_H - 190);
  g.pickups.push(makeRepair(x, y));
}

// --- the simulation ------------------------------------------------------

export function stepGame(g, dt, ax, ay) {
  g.time += dt;
  stepParticles(g.parts, dt);
  if (g.shake > 0) g.shake -= dt;

  if (g.mode === 'title' || g.mode === 'won' || g.mode === 'lost') {
    for (const s of g.shards) stepDrifter(s, dt);
    for (const r of g.rocks) stepDrifter(r, dt);
    return;
  }
  if (g.mode !== 'playing') return;

  g.elapsed += dt;
  g.timeLeft = Math.max(0, RUN_SECONDS - g.elapsed);

  stepShip(g.ship, ax, ay, dt, VIEW_W, VIEW_H);

  // Combo drains once its hold timer runs out.
  if (g.comboTimer > 0) g.comboTimer -= dt;
  else if (g.combo > 1) g.combo = Math.max(1, g.combo - 2.0 * dt);

  // Shards: keep a handful in play at all times.
  g.shardClock -= dt;
  if (g.shardClock <= 0 && g.shards.length < 7) {
    spawnShard(g);
    g.shardClock = 0.8;
  }

  // Asteroids arrive faster and quicker the longer the run goes.
  g.rockClock -= dt;
  if (g.rockClock <= 0) {
    spawnRock(g);
    const ramp = g.elapsed / RUN_SECONDS;
    g.rockClock = 1.15 - ramp * 0.77 + Math.random() * 0.25;
  }

  // A repair cell every so often, while the hull needs one.
  g.repairClock -= dt;
  if (g.repairClock <= 0) {
    if (g.hull < HULL_MAX - 5 && g.pickups.length === 0) spawnRepair(g);
    g.repairClock = 14;
  }

  for (const s of g.shards) stepDrifter(s, dt);
  for (const r of g.rocks) stepDrifter(r, dt);
  for (const p of g.pickups) stepDrifter(p, dt);
  g.rocks = g.rocks.filter((r) => r.x > -90 && r.x < VIEW_W + 90 && r.y > -90 && r.y < VIEW_H + 90);
  g.pickups = g.pickups.filter((p) => p.life > 0);

  collide(g);

  if (g.mode !== 'playing') return; // a collision may have ended the run
  if (g.score >= TARGET_SCORE) endRun(g, true);
  else if (g.hull <= 0) endRun(g, false, 'hull');
  else if (g.timeLeft <= 0) endRun(g, false, 'time');
}

function collide(g) {
  const ship = g.ship;
  const reach = (e) => Math.hypot(e.x - ship.x, e.y - ship.y) < e.r + ship.radius - 4;

  g.shards = g.shards.filter((s) => {
    if (!reach(s)) return true;
    g.score += Math.round(SHARD_POINTS * g.combo);
    g.combo = Math.min(COMBO_MAX, g.combo + COMBO_STEP);
    g.maxCombo = Math.max(g.maxCombo, g.combo);
    g.comboTimer = COMBO_HOLD;
    g.collected += 1;
    burst(g.parts, s.x, s.y, '#ffd94a', 12, 190);
    sfx.collect();
    return false;
  });

  g.pickups = g.pickups.filter((p) => {
    if (!reach(p)) return true;
    g.hull = Math.min(HULL_MAX, g.hull + REPAIR_AMOUNT);
    burst(g.parts, p.x, p.y, '#3dff8e', 16, 200);
    sfx.repair();
    return false;
  });

  if (ship.invuln <= 0) {
    for (const r of g.rocks) {
      if (!reach(r)) continue;
      g.hull -= ROCK_DAMAGE;
      ship.invuln = 1.2;
      g.shake = 0.35;
      burst(g.parts, ship.x, ship.y, '#ff7847', 22, 280);
      sfx.hit();
      r.x = -9999; // the rock that hit is spent; the filter in stepGame drops it
      break;
    }
  }
}

// --- deterministic scenes for screenshots --------------------------------
// Each scene builds a real game state with a seeded rng and lets render.js
// paint it through the normal path. Nothing here is drawn by hand.

export function stageScene(g, scene) {
  const rng = mulberry32(4242);
  startRunQuiet(g);
  if (scene === 'title') {
    g.mode = 'title';
    decorateField(g, rng, 5, 4);
    return;
  }
  if (scene === 'over') {
    g.mode = 'won';
    g.score = 1620;
    g.collected = 58;
    g.maxCombo = 6;
    g.combo = 6;
    g.hull = 41;
    g.elapsed = 77.6;
    g.timeLeft = RUN_SECONDS - g.elapsed;
    g.ship.x = VIEW_W / 2;
    g.ship.y = VIEW_H - 120; // parked below the results panel, clear of its text
    g.ship.angle = -0.5;
    decorateField(g, rng, 4, 3);
    burst(g.parts, g.ship.x - 60, g.ship.y - 40, '#26e7ff', 18, 200, rng);
    burst(g.parts, g.ship.x + 70, g.ship.y + 20, '#ff3ed8', 14, 170, rng);
    return;
  }
  // 'play' and 'action': mid-run states, action the tenser of the two.
  const tense = scene === 'action';
  g.mode = 'playing';
  g.score = tense ? 1240 : 860;
  g.combo = tense ? 5.25 : 3.5;
  g.comboTimer = 2.6;
  g.maxCombo = g.combo;
  g.hull = tense ? 37 : 68;
  g.elapsed = tense ? 63.2 : 42.7;
  g.timeLeft = RUN_SECONDS - g.elapsed;
  g.collected = tense ? 49 : 34;
  g.ship.x = tense ? 760 : 430;
  g.ship.y = tense ? 350 : 470;
  g.ship.vx = 230;
  g.ship.vy = -70;
  g.ship.angle = Math.atan2(-70, 230);
  g.ship.thrusting = true;
  decorateField(g, rng, tense ? 6 : 5, tense ? 8 : 6);
  g.pickups.push(makeRepair(tense ? 250 : 1010, tense ? 620 : 210, rng));
  burst(g.parts, g.ship.x - 90, g.ship.y + 50, '#ffd94a', 10, 150, rng);
}

function startRunQuiet(g) {
  // startRun without the launch sound: no audio context exists on the
  // screenshot path, and sfx calls are inert there, but silence is surer.
  const keepMode = g.mode;
  startRun(g);
  g.mode = keepMode;
}

// The title screen's text block: decoration keeps out of it so the words
// stay readable in the cover screenshot.
const TITLE_TEXT_BOX = { x0: 250, x1: 1030, y0: 380, y1: 650 };
const inTitleText = (x, y) => x > TITLE_TEXT_BOX.x0 && x < TITLE_TEXT_BOX.x1 && y > TITLE_TEXT_BOX.y0 && y < TITLE_TEXT_BOX.y1;

function decorateField(g, rng, shardCount, rockCount) {
  const onTitle = g.mode === 'title';
  for (let i = 0; i < shardCount; i++) {
    for (let tries = 0; tries < 10; tries++) {
      const x = 70 + rng() * (VIEW_W - 140);
      const y = 110 + rng() * (VIEW_H - 200);
      if (onTitle && inTitleText(x, y)) continue;
      g.shards.push(makeShard(x, y, rng));
      break;
    }
  }
  for (let i = 0; i < rockCount; i++) {
    for (let tries = 0; tries < 10; tries++) {
      const x = 60 + rng() * (VIEW_W - 120);
      const y = 90 + rng() * (VIEW_H - 180);
      const r = 17 + rng() * 24;
      if (Math.hypot(x - g.ship.x, y - g.ship.y) < 120) continue;
      if (onTitle && inTitleText(x, y)) continue;
      // Rocks should not sit on top of each other either.
      if (g.rocks.some((o) => Math.hypot(x - o.x, y - o.y) < r + o.r + 14)) continue;
      g.rocks.push(makeAsteroid(x, y, (rng() - 0.5) * 60, (rng() - 0.5) * 60, r, rng));
      break;
    }
  }
}
