// Keyboard and pointer input. Held keys steer the ship; one-shot presses
// (start, restart, pause, mute) are queued until the game consumes them.

const held = new Set();
const pressed = new Set();
let clicked = false;

const STEERING_CODES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

// onGesture runs on any first interaction so audio can unlock.
export function initInput(canvas, onGesture) {
  window.addEventListener('keydown', (event) => {
    if (STEERING_CODES.includes(event.code)) event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
    if (onGesture) onGesture();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  canvas.addEventListener('pointerdown', () => {
    clicked = true;
    if (onGesture) onGesture();
  });
}

export function isDown(code) {
  return held.has(code);
}

// Steering axes in screen space: x right, y down, each -1, 0 or 1.
export function axisX() {
  const right = isDown('KeyD') || isDown('ArrowRight') ? 1 : 0;
  const left = isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0;
  return right - left;
}

export function axisY() {
  const down = isDown('KeyS') || isDown('ArrowDown') ? 1 : 0;
  const up = isDown('KeyW') || isDown('ArrowUp') ? 1 : 0;
  return down - up;
}

// True once per physical press of the given code.
export function takePress(code) {
  if (!pressed.has(code)) return false;
  pressed.delete(code);
  return true;
}

// True once when any of the given codes was pressed since the last call;
// consumes every queued press, so one gesture never fires two actions.
export function takeAnyPress(codes) {
  for (const code of codes) {
    if (pressed.has(code)) {
      pressed.clear();
      return true;
    }
  }
  return false;
}

// True once per pointer click since the last call.
export function takeClick() {
  const was = clicked;
  clicked = false;
  return was;
}

export function clearTransient() {
  pressed.clear();
  clicked = false;
}
