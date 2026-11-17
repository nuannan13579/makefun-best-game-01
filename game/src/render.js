// All drawing for Neon Drift: the starfield, the ship, every entity, the
// HUD and the title / pause / end screens. Nothing here changes state;
// stepGame in game.js owns the rules, this file only paints them.

import { VIEW_W, VIEW_H, TARGET_SCORE, HULL_MAX, RUN_SECONDS, COMBO_HOLD, ROCK_DAMAGE, REPAIR_AMOUNT } from './game.js';

const INK = '#e8f6ff';
const CYAN = '#26e7ff';
const MAGENTA = '#ff3ed8';
const GOLD = '#ffd94a';
const GREEN = '#3dff8e';
const RED = '#ff5470';
const FONT = 'ui-monospace, Menlo, Consolas, monospace';

// Combo values print without trailing zeros: 3.50 -> "3.5", 6.00 -> "6".
function fmtCombo(value) {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

export function draw(ctx, g, muted) {
  ctx.save();
  if (g.shake > 0) {
    const m = g.shake * 14;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  drawBackdrop(ctx, g);
  drawIncomingWarnings(ctx, g);
  for (const p of g.pickups) drawRepair(ctx, p, g.time);
  for (const s of g.shards) drawShard(ctx, s, g.time);
  for (const r of g.rocks) drawRock(ctx, r);
  drawParticles(ctx, g.parts);
  if (g.mode !== 'title') drawShip(ctx, g);
  drawFloats(ctx, g);
  ctx.restore();

  if (g.mode === 'playing' && g.hull <= ROCK_DAMAGE) drawLowHullWarning(ctx, g);
  if (g.mode !== 'title') drawHud(ctx, g, muted);
  if (g.mode === 'title') drawTitle(ctx, g);
  else if (g.mode === 'paused') drawPause(ctx);
  else if (g.mode === 'won') drawEnd(ctx, g, true);
  else if (g.mode === 'lost') drawEnd(ctx, g, false);
}

// --- backdrop --------------------------------------------------------------

function drawBackdrop(ctx, g) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#070b1f');
  grad.addColorStop(0.55, '#0a1030');
  grad.addColorStop(1, '#12082b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Two soft nebula glows, cheap radial gradients in the house colours.
  glow(ctx, 240, 150, 320, 'rgba(255, 62, 216, 0.10)');
  glow(ctx, 1060, 640, 380, 'rgba(38, 231, 255, 0.10)');

  for (const star of g.stars) {
    const twinkle = 0.55 + 0.45 * Math.sin(g.time * 2 + star.tw);
    ctx.globalAlpha = twinkle * star.z;
    ctx.fillStyle = '#cfe9ff';
    const s = star.z * 2.2;
    ctx.fillRect(star.x, star.y, s, s);
  }
  ctx.globalAlpha = 1;
}

function glow(ctx, x, y, r, color) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// --- entities --------------------------------------------------------------

function drawShard(ctx, s, time) {
  const pulse = 1 + 0.16 * Math.sin(s.phase);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.rot);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#fff3b0';
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -s.r);
  ctx.lineTo(s.r * 0.62, 0);
  ctx.lineTo(0, s.r);
  ctx.lineTo(-s.r * 0.62, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  void time;
}

function drawRock(ctx, r) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.rot);
  ctx.fillStyle = '#232038';
  ctx.strokeStyle = '#8f7fb8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < r.verts.length; i++) {
    const a = (i / r.verts.length) * Math.PI * 2;
    const d = r.r * r.verts[i];
    if (i === 0) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // A couple of crater freckles so the rock reads as a rock.
  ctx.fillStyle = 'rgba(143, 127, 184, 0.5)';
  ctx.beginPath();
  ctx.arc(-r.r * 0.25, -r.r * 0.1, r.r * 0.16, 0, Math.PI * 2);
  ctx.arc(r.r * 0.3, r.r * 0.28, r.r * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRepair(ctx, p, time) {
  const pulse = 1 + 0.12 * Math.sin(p.phase);
  const fading = p.life < 3 ? (Math.sin(time * 10) > 0 ? 1 : 0.35) : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(pulse, pulse);
  ctx.globalAlpha = fading;
  ctx.shadowColor = GREEN;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = GREEN;
  const w = 4;
  const l = 8;
  ctx.fillRect(-w / 2, -l, w, l * 2);
  ctx.fillRect(-l, -w / 2, l * 2, w);
  ctx.restore();
}

// Rocks still off screen but about to enter get a pulsing marker on the
// edge they will cross, so an arrival is telegraphed, never a surprise.
function drawIncomingWarnings(ctx, g) {
  if (g.mode !== 'playing' && g.mode !== 'paused') return;
  const pulse = 0.55 + 0.45 * Math.sin(g.time * 9);
  ctx.save();
  ctx.fillStyle = RED;
  for (const r of g.rocks) {
    const outside = r.x < -r.r || r.x > VIEW_W + r.r || r.y < -r.r || r.y > VIEW_H + r.r;
    if (!outside) continue;
    const near = r.x > -140 && r.x < VIEW_W + 140 && r.y > -140 && r.y < VIEW_H + 140;
    if (!near) continue;
    const cx = Math.max(16, Math.min(VIEW_W - 16, r.x));
    const cy = Math.max(16, Math.min(VIEW_H - 16, r.y));
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    if (r.x < -r.r) { ctx.moveTo(6, cy - 10); ctx.lineTo(22, cy); ctx.lineTo(6, cy + 10); }
    else if (r.x > VIEW_W + r.r) { ctx.moveTo(VIEW_W - 6, cy - 10); ctx.lineTo(VIEW_W - 22, cy); ctx.lineTo(VIEW_W - 6, cy + 10); }
    else if (r.y < -r.r) { ctx.moveTo(cx - 10, 6); ctx.lineTo(cx + 10, 6); ctx.lineTo(cx, 22); }
    else { ctx.moveTo(cx - 10, VIEW_H - 6); ctx.lineTo(cx + 10, VIEW_H - 6); ctx.lineTo(cx, VIEW_H - 22); }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Floating score popups: what each event was worth, rising and fading.
function drawFloats(ctx, g) {
  ctx.save();
  ctx.font = `bold 17px ${FONT}`;
  ctx.textAlign = 'center';
  for (const f of g.floats) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

// One hit from death, the screen edge pulses red until a repair lands.
function drawLowHullWarning(ctx, g) {
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.13 * Math.sin(g.time * 6);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, VIEW_W - 12, VIEW_H - 12);
  ctx.restore();
}

function drawParticles(ctx, parts) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

// --- the ship ----------------------------------------------------------------

function drawShip(ctx, g) {
  const ship = g.ship;
  // Post-hit invulnerability blinks the hull and rings it with a shield.
  if (ship.invuln > 0 && Math.sin(g.time * 26) > 0.2) ctx.globalAlpha = 0.35;
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  if (ship.thrusting) {
    const flame = 13 + Math.random() * 9;
    ctx.fillStyle = '#ffab47';
    ctx.beginPath();
    ctx.moveTo(-13, 5);
    ctx.lineTo(-13 - flame, 0);
    ctx.lineTo(-13, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.moveTo(-13, 2.6);
    ctx.lineTo(-13 - flame * 0.55, 0);
    ctx.lineTo(-13, -2.6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#0d2438';
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(21, 0); // nose
  ctx.lineTo(-6, 7);
  ctx.lineTo(-15, 14); // right wing
  ctx.lineTo(-11, 0);
  ctx.lineTo(-15, -14); // left wing
  ctx.lineTo(-6, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#bffbff';
  ctx.beginPath();
  ctx.arc(5, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = MAGENTA;
  ctx.fillRect(-14, 11, 4, 3);
  ctx.fillRect(-14, -14, 4, 3);
  ctx.restore();
  ctx.globalAlpha = 1;

  if (ship.invuln > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(38, 231, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, ship.radius + 9 + Math.sin(g.time * 8) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// --- HUD ---------------------------------------------------------------------

function bar(ctx, x, y, w, h, frac, color, back) {
  ctx.fillStyle = back || 'rgba(232, 246, 255, 0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function drawHud(ctx, g, muted) {
  ctx.save();
  ctx.font = `bold 15px ${FONT}`;
  ctx.textBaseline = 'top';

  // Score and target, top left.
  ctx.fillStyle = INK;
  ctx.fillText('SCORE', 24, 18);
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillStyle = GOLD;
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 10;
  ctx.fillText(String(g.score), 24, 38);
  ctx.shadowBlur = 0;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText(`/ ${TARGET_SCORE} TARGET`, 24, 78);
  // A gold progress bar: how much of the run's goal is already banked.
  bar(ctx, 24, 98, 180, 7, g.score / TARGET_SCORE, GOLD);

  // Combo multiplier with its draining hold bar.
  if (g.combo > 1) {
    ctx.fillStyle = MAGENTA;
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(`COMBO x${fmtCombo(g.combo)}`, 24, 118);
    bar(ctx, 24, 148, 120, 6, g.comboTimer / COMBO_HOLD, MAGENTA);
  }

  // Time, top centre: a bar plus the seconds left.
  const timeFrac = g.timeLeft / RUN_SECONDS;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText('TIME', 540, 18);
  bar(ctx, 470, 42, 340, 12, timeFrac, timeFrac < 0.18 ? RED : CYAN);
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillStyle = timeFrac < 0.18 ? RED : INK;
  ctx.fillText(`${Math.ceil(g.timeLeft)}s`, 608, 60);

  // Hull, top right.
  const hullFrac = g.hull / HULL_MAX;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText('HULL', 1152, 18);
  bar(ctx, 1056, 42, 200, 12, hullFrac, hullFrac <= 0.4 ? RED : GREEN);
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillStyle = hullFrac <= 0.4 ? RED : INK;
  ctx.fillText(`${Math.max(0, Math.ceil(g.hull))}`, 1152, 60);

  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = 'rgba(232, 246, 255, 0.55)';
  ctx.fillText(muted ? 'MUTED (M) · P PAUSE' : 'M SOUND · P PAUSE', 24, 768);
  ctx.restore();
}

// --- screens -------------------------------------------------------------------

function centre(ctx, text, y, font, color, glowColor) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 22;
  }
  ctx.fillText(text, VIEW_W / 2, y);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
}

function drawTitle(ctx, g) {
  ctx.save();
  centre(ctx, 'NEON DRIFT', 190, `bold 92px ${FONT}`, CYAN, CYAN);
  centre(ctx, `Bank ${TARGET_SCORE} points of star shards in ${RUN_SECONDS} seconds —`, 310, `22px ${FONT}`, INK);
  centre(ctx, 'and do not let the asteroid field take your hull.', 342, `22px ${FONT}`, INK);

  ctx.font = `19px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232, 246, 255, 0.85)';
  const lines = [
    'WASD / ARROW KEYS — thrust and drift',
    'Collect shards to raise your COMBO multiplier',
    `Asteroid hit: -${ROCK_DAMAGE} hull · Green cell: +${REPAIR_AMOUNT} hull`,
    'P pause · M mute',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 420 + i * 32));
  ctx.textAlign = 'left';

  if (Math.sin(g.time * 3.4) > -0.25) {
    centre(ctx, 'CLICK OR PRESS ANY MOVE KEY TO LAUNCH', 592, `bold 26px ${FONT}`, GOLD, GOLD);
  }
  ctx.restore();
}

function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 14, 0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  centre(ctx, 'PAUSED', 340, `bold 54px ${FONT}`, INK);
  centre(ctx, 'Press P to resume', 420, `20px ${FONT}`, 'rgba(232, 246, 255, 0.8)');
  ctx.restore();
}

function drawEnd(ctx, g, won) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 14, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (won) {
    centre(ctx, 'MISSION COMPLETE', 250, `bold 58px ${FONT}`, GREEN, GREEN);
    centre(ctx, 'The shipment is away. The drift provides.', 330, `21px ${FONT}`, INK);
  } else if (g.loseReason === 'hull') {
    centre(ctx, 'SHIP DOWN', 250, `bold 58px ${FONT}`, RED, RED);
    centre(ctx, 'The asteroid field collects another courier.', 330, `21px ${FONT}`, INK);
  } else {
    centre(ctx, 'TIME UP', 250, `bold 58px ${FONT}`, RED, RED);
    centre(ctx, `The window closed at ${g.score} of ${TARGET_SCORE} points.`, 330, `21px ${FONT}`, INK);
  }
  centre(ctx, `FINAL SCORE  ${g.score}`, 402, `bold 34px ${FONT}`, GOLD, GOLD);
  centre(
    ctx,
    `Shards banked: ${g.collected} · Best combo: x${fmtCombo(g.maxCombo)} · Hull left: ${Math.max(0, Math.ceil(g.hull))}`,
    458,
    `19px ${FONT}`,
    'rgba(232, 246, 255, 0.9)',
  );
  if (Math.sin(g.time * 3.4) > -0.25) {
    centre(ctx, 'PRESS R, ENTER OR CLICK TO FLY AGAIN', 540, `bold 24px ${FONT}`, CYAN, CYAN);
  }
  ctx.restore();
}
