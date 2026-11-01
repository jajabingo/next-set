// Beeps generated in the app (no sound files). "Ambient" mode mixes with music instead of
// pausing it; iOS mutes ambient sound when the silent switch is on.
import { state } from "./store.js";

let ctx = null;

export function initAudioSession() {
  if ("audioSession" in navigator) {
    try { navigator.audioSession.type = "ambient"; } catch { /* unsupported */ }
  }
}

// Must run inside a tap: iOS only allows audio to start from a user gesture.
export function unlockAudio() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state !== "running") ctx.resume();
}

export function wakeAudio() {
  if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
}

const TONES = {
  tick: [880, 0.12], // 3-2-1
  go: [1320, 0.45], // a set or work interval begins
  rest: [440, 0.45], // a core rest begins
};

export function beep(name) {
  if (!state.settings.sounds || !ctx) return;
  const [freq, dur] = TONES[name];
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
