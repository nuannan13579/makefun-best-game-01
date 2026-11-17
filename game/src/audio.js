// Sound effects synthesized live with WebAudio. There are no audio files:
// every blip is an oscillator with a short envelope, started on demand.

let ctx = null;
let muted = false;

// Browsers only let audio start after a gesture, so the context is created
// lazily from the first key press or click (main.js wires that up).
export function ensureAudio() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

// One oscillator note: frequency, length, and an optional pitch slide.
function tone(freq, dur, opts = {}) {
  if (!ctx || muted) return;
  const type = opts.type || 'square';
  const gainPeak = opts.gain || 0.12;
  const delay = opts.delay || 0;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + opts.slide), t0 + dur);
  }
  amp.gain.setValueAtTime(gainPeak, t0);
  amp.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

// The named effects the game calls. Each is a tiny phrase of tones.
export const sfx = {
  collect() {
    tone(880, 0.09, { gain: 0.1 });
    tone(1318, 0.13, { gain: 0.1, delay: 0.05 });
  },
  hit() {
    tone(170, 0.28, { type: 'sawtooth', gain: 0.2, slide: -120 });
    tone(90, 0.3, { type: 'triangle', gain: 0.16, slide: -40 });
  },
  repair() {
    [523, 659, 784].forEach((f, i) => tone(f, 0.12, { type: 'triangle', gain: 0.14, delay: i * 0.06 }));
  },
  launch() {
    tone(220, 0.32, { type: 'triangle', gain: 0.12, slide: 660 });
  },
  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, { gain: 0.11, delay: i * 0.11 }));
  },
  lose() {
    [392, 330, 262, 175].forEach((f, i) => tone(f, 0.22, { type: 'sawtooth', gain: 0.09, delay: i * 0.14 }));
  },
};
