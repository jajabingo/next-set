// The session in progress. All timing is computed from the clock, so it stays correct
// even if the app was in the background.
//
// "Virtual" time is time since Start minus time spent paused. Interval timers (set, rest,
// core intervals) run on virtual time, so they freeze while paused. The session clock uses
// real time and keeps running through pauses (PRD 8.1).
import { CORE_TOTAL, corePositionAt } from "./plan.js";

export function newPlanned(workout, restMs, now) {
  return {
    kind: "planned",
    workoutId: workout.id,
    startedAt: now,
    pausedAt: null,
    pausedTotal: 0,
    restMs,
    phase: "set",
    phaseStartV: 0, // virtual ms when the current set or rest began
    history: [], // one entry per Rest tap: how long the set had run
    endedAt: null,
    saving: null, // "finish" or "stop" once on the save screen
    draft: null,
    lastSeen: now,
  };
}

export function newCore(now) {
  return { kind: "core", startedAt: now, pausedAt: null, pausedTotal: 0, endedAt: null, saving: null, intervalsDone: 0, notes: "", lastSeen: now };
}

export function virtual(a, now) {
  return (a.pausedAt ?? now) - a.startedAt - a.pausedTotal;
}

export function isPaused(a) {
  return a.pausedAt != null;
}

// --- Planned workout ---

// If the rest has run out, start the next set at the moment the rest ended. Returns true if it did.
export function advance(a, now) {
  if (a.phase !== "rest" || virtual(a, now) - a.phaseStartV < a.restMs) return false;
  a.phase = "set";
  a.phaseStartV += a.restMs;
  return true;
}

export function tapRest(a, now) {
  const v = virtual(a, now);
  a.history.push({ setElapsed: v - a.phaseStartV });
  a.phase = "rest";
  a.phaseStartV = v;
}

export function skipRest(a, now) {
  a.phase = "set";
  a.phaseStartV = virtual(a, now);
}

// Back to the set just left; its timer continues from where it stopped.
export function undo(a, now) {
  const last = a.history.pop();
  if (!last) return;
  a.phase = "set";
  a.phaseStartV = virtual(a, now) - last.setElapsed;
}

export function pause(a, now) {
  if (a.pausedAt == null) a.pausedAt = now;
}

export function resume(a, now) {
  if (a.pausedAt == null) return;
  a.pausedTotal += now - a.pausedAt;
  a.pausedAt = null;
}

export function finish(a, now) {
  a.endedAt = now;
  a.saving = "finish";
}

// Back to the session from the save screen. After Finish the final set carries on;
// after Stop the session was paused, so it stays paused.
export function backToWorkout(a) {
  a.endedAt = null;
  a.saving = null;
}

export function stop(a, now) {
  if (a.kind === "core") a.intervalsDone = corePositionAt(coreSeconds(a, now)).completedWork;
  a.endedAt = now;
  a.saving = "stop";
}

// --- Core workout ---

export function coreSeconds(a, now) {
  return virtual(a, now) / 1000;
}

// The core workout ran to the end. The end moment is computed, in case it happened in the background.
export function endCore(a) {
  a.endedAt = a.startedAt + a.pausedTotal + CORE_TOTAL * 1000;
  a.intervalsDone = corePositionAt(CORE_TOTAL).completedWork;
  a.saving = "complete";
}

// --- App was fully closed ---

// Show the session paused at the moment the app was last open (PRD 8.1).
export function recover(a, now) {
  if (!a || a.saving || a.pausedAt != null) return;
  const t = Math.min(a.lastSeen ?? now, now);
  if (a.kind === "planned") {
    advance(a, t);
    a.pausedAt = t;
  } else if (coreSeconds(a, t) >= CORE_TOTAL) {
    endCore(a);
  } else {
    a.pausedAt = t;
  }
}
