// Drives the session in progress no matter which tab is showing: auto-advances rest into the
// next set, ends the core workout, plays beeps, and saves progress (PRD 8).
import { state, saveActive } from "./store.js";
import * as S from "./session.js";
import { CORE_TOTAL, corePositionAt } from "./plan.js";
import { beep } from "./sound.js";
import { route, render } from "./router.js";

const TICK_MS = 100;
const PERSIST_MS = 5000;
// A gap longer than this between ticks means the app was in the background: skip the sounds it missed.
const GAP_MS = 1500;

let lastTick = Date.now();
let lastPersist = 0;
let sessionKey = null;
let prevRestSec = null;
let prevCore = null;
let display = null;

// The live screen registers a function to refresh its timers after each tick.
export function setDisplay(fn) {
  display = fn;
}

function tick() {
  const now = Date.now();
  const gap = now - lastTick;
  lastTick = now;
  const a = state.active;
  if (!a || a.ready || a.saving) return;

  if (sessionKey !== a.startedAt) {
    sessionKey = a.startedAt;
    prevRestSec = null;
    prevCore = null;
  }
  const audible = gap < GAP_MS && !S.isPaused(a);
  a.lastSeen = now;

  if (a.kind === "planned") {
    if (S.advance(a, now)) {
      if (audible) beep("go");
      persist(now);
    }
    if (a.phase === "rest") {
      const sec = Math.ceil(Math.max(0, a.restMs - (S.virtual(a, now) - a.phaseStartV)) / 1000);
      if (audible && sec !== prevRestSec && sec >= 1 && sec <= 3) beep("tick");
      prevRestSec = sec;
    } else {
      prevRestSec = null;
    }
  } else {
    const t = S.coreSeconds(a, now);
    if (t >= CORE_TOTAL) {
      S.endCore(a);
      persist(now);
      if (route.tab === "workout") render();
      return;
    }
    const p = corePositionAt(t);
    const sec = Math.ceil(p.left);
    if (prevCore && audible) {
      if (p.phase !== prevCore.phase || p.k !== prevCore.k) {
        if (p.phase === "work") beep("go");
        if (p.phase === "rest") beep("rest");
      }
      if ((p.phase === "prep" || p.phase === "rest") && sec !== prevCore.sec && sec >= 1 && sec <= 3) beep("tick");
    }
    prevCore = { phase: p.phase, k: p.k, sec };
  }

  if (now - lastPersist > PERSIST_MS) persist(now);
  display?.(now);
}

function persist(now) {
  lastPersist = now;
  saveActive();
}

export function startEngine() {
  setInterval(tick, TICK_MS);
}
