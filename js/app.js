import { state, load, saveActive } from "./store.js";
import { recover } from "./session.js";
import { initAudioSession, wakeAudio } from "./sound.js";
import { startEngine } from "./engine.js";
import { registerViews, navigate, render } from "./router.js";
import { registerServiceWorker } from "./update.js";
import { renderWorkout } from "./views/workout.js";
import { renderList } from "./views/list.js";
import { renderSettings } from "./views/settings.js";

registerViews({ workout: renderWorkout, list: renderList, settings: renderSettings });

document.querySelectorAll("#nav button").forEach((b) => {
  b.addEventListener("click", () => navigate(b.dataset.tab, null, null, "fade"));
});

// On iOS 26 a Home Screen app's page already stops above the home indicator. Adding the
// safe-area inset again leaves a gap under the tab bar, so only add it when the page
// really reaches the bottom of the screen (PRD 7.1).
function fitNav() {
  const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  const portrait = innerHeight >= innerWidth;
  const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const clipped = standalone && innerHeight < screenH - 1;
  document.documentElement.style.setProperty("--nav-bottom", clipped ? "10px" : "");
}
fitNav();
addEventListener("resize", fitNav);

// Save progress whenever the app is hidden, so a closed app can be picked up again.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) saveActive();
  else wakeAudio();
});
window.addEventListener("pagehide", () => saveActive());

initAudioSession();
await load();
if (state.active) {
  recover(state.active, Date.now());
  await saveActive();
}
render();
startEngine();
registerServiceWorker();
