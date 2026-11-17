// Boot and main loop for Neon Drift. Wires the canvas, input and audio to
// the rules in game.js and the painting in render.js.
//
// ?scene=title|play|action|over stages one deterministic scene instead of
// running the loop: it paints through the real render path twice and sets
// window.__shotReady, which is how the screenshots in /screenshots were
// taken. It changes nothing about how the game itself plays.

import { createGame, startRun, togglePause, stepGame, stageScene, TARGET_SCORE } from './game.js';
import { draw } from './render.js';
import { initInput, axisX, axisY, takePress, takeAnyPress, takeClick, clearTransient } from './input.js';
import { ensureAudio, setMuted, isMuted } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const game = createGame();

initInput(canvas, ensureAudio);

const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');

if (scene) {
  stageScene(game, scene);
  requestAnimationFrame(() => {
    draw(ctx, game, false);
    requestAnimationFrame(() => {
      draw(ctx, game, false);
      window.__shotReady = true;
    });
  });
} else {
  runLoop();
}

function runLoop() {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    handleControls();
    stepGame(game, dt, axisX(), axisY());
    draw(ctx, game, isMuted());
    announce();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// The keys a player naturally reaches for first: any of them, or a click,
// launches from the title screen, so nobody hunts for the one right key.
const LAUNCH_KEYS = [
  'Enter', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
];

// One-shot presses and clicks drive the screens around the run itself.
function handleControls() {
  if (takePress('KeyM')) setMuted(!isMuted());

  if (game.mode === 'title') {
    if (takeAnyPress(LAUNCH_KEYS) || takeClick()) {
      startRun(game);
      clearTransient();
    }
    return;
  }
  if (game.mode === 'won' || game.mode === 'lost') {
    if (takePress('KeyR') || takeAnyPress(['Enter', 'Space']) || takeClick()) {
      startRun(game);
      clearTransient();
    }
    return;
  }
  if (takePress('KeyP') || (game.mode === 'paused' && takePress('Enter'))) togglePause(game);
}

// Keep the screen-reader status line roughly current without chattering.
let lastAnnounced = '';
function announce() {
  if (!status) return;
  const text =
    game.mode === 'playing'
      ? `Score ${game.score} of ${TARGET_SCORE}, hull ${Math.max(0, Math.ceil(game.hull))}, ${Math.ceil(game.timeLeft)} seconds left`
      : game.mode;
  if (text !== lastAnnounced) {
    lastAnnounced = text;
    status.textContent = `Neon Drift: ${text}`;
  }
}
