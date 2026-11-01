// Keeps the screen awake for the whole session (PRD 8.3).
let lock = null;
let wanted = false;

export async function acquire() {
  wanted = true;
  if (lock || !("wakeLock" in navigator) || document.hidden) return;
  try {
    lock = await navigator.wakeLock.request("screen");
    lock.addEventListener("release", () => { lock = null; });
  } catch { /* denied or unsupported */ }
}

export function release() {
  wanted = false;
  lock?.release();
  lock = null;
}

// iOS drops the lock when the app is hidden; take it back when the app returns.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && wanted) acquire();
});
