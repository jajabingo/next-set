// "What's next?" (PRD section 9).
import { ROTATION, workoutById, followingWorkout } from "./plan.js";

// Newest first: latest date, then latest saved on the same date.
export function byRecency(a, b) {
  return a.date === b.date ? b.saveOrder - a.saveOrder : a.date < b.date ? 1 : -1;
}

// The rotation follows save order, not dates, so a skip always moves it on.
export function nextWorkout(sessions, settings) {
  if (settings.nextOverride && workoutById(settings.nextOverride)) return workoutById(settings.nextOverride);
  const last = sessions.filter((s) => s.type === "planned").sort((a, b) => b.saveOrder - a.saveOrder)[0];
  if (!last) return ROTATION[0];
  if (last.status === "stopped" && last.nextTime === "repeat") return workoutById(last.workoutId);
  return followingWorkout(last.workoutId);
}

// Weights from the most recent Completed session of this workout (Stopped and Skipped are ignored).
export function lastCompletedWeights(sessions, workoutId) {
  const last = sessions
    .filter((s) => s.type === "planned" && s.workoutId === workoutId && s.status === "completed")
    .sort(byRecency)[0];
  return last ? { ...last.weights } : {};
}
