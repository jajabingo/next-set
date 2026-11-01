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
  b.addEventListener("click", () => navigate(b.dataset.tab));
});

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
