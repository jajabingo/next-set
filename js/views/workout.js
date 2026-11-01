// Workout tab: the next planned workout, the Skip form, and starting sessions (PRD 7.2, 7.6).
import { state, saveActive, saveSession, saveSettings } from "../store.js";
import { setsOf } from "../plan.js";
import { nextWorkout, lastCompletedWeights } from "../rotation.js";
import { newPlanned, newCore } from "../session.js";
import { unlockAudio } from "../sound.js";
import * as wake from "../wake.js";
import { navigate } from "../router.js";
import { esc, uid, toISODate, fmtWeight } from "../util.js";
import { renderLive } from "./live.js";

export function renderWorkout(view, route) {
  if (state.active) return renderLive(view);
  if (route.sub === "skip") return renderSkip(view, "workout");

  const w = nextWorkout(state.sessions, state.settings);
  const weights = lastCompletedWeights(state.sessions, w.id);
  view.innerHTML = `
    <div class="eyebrow">Next up</div>
    <h1>${esc(w.name)}</h1>
    <div class="card">${planHtml(w, weights)}</div>
    <button class="btn btn-primary btn-xl" data-act="start">Start</button>
    <div class="btn-row">
      <button class="btn" data-act="skip">Skip</button>
      <button class="btn" data-act="core">Core Workout</button>
    </div>`;
  view.onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "start") startPlanned(w);
    if (act === "skip") navigate("workout", "skip", w.id);
    if (act === "core") startCore();
  };
}

// The workout's exercises grouped by block, with sets × reps and last weights.
export function planHtml(w, weights) {
  return w.blocks.map((b) => {
    const head = b.items.length > 1 ? `Superset · ${b.sets} sets` : `${b.sets} sets`;
    const rows = b.items.map((it) => {
      const ex = w.exercises[it.ex];
      return `<div class="ex-row"><span class="ex-name">${esc(ex.name)}</span>
        <span class="ex-meta">${b.sets} × ${it.reps}</span>
        <span class="ex-meta">${fmtWeight(weights[ex.id], state.settings.units)}</span></div>`;
    }).join("");
    return `<div class="block-head">${head}</div>${rows}`;
  }).join("");
}

export function startPlanned(w) {
  unlockAudio();
  wake.acquire();
  state.active = newPlanned(w, state.settings.restSeconds * 1000, Date.now());
  saveActive();
  navigate("workout");
}

export function startCore() {
  unlockAudio();
  wake.acquire();
  state.active = newCore(Date.now());
  saveActive();
  navigate("workout");
}

// Skip form, reachable from the Workout and List tabs.
export function renderSkip(view, backTab) {
  const w = nextWorkout(state.sessions, state.settings);
  view.innerHTML = `
    <button class="link" data-act="cancel">‹ Cancel</button>
    <div class="eyebrow">Skip workout</div>
    <h1>${esc(w.name)}</h1>
    <label class="field"><span>Date</span><input type="date" id="skip-date" value="${toISODate()}"></label>
    <label class="field"><span>Notes</span><textarea id="skip-notes" placeholder="Optional"></textarea></label>
    <button class="btn btn-primary" data-act="save">Save as skipped</button>`;
  view.onclick = async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "cancel") navigate(backTab);
    if (act === "save") {
      const date = view.querySelector("#skip-date").value;
      if (!date) { alert("Please choose a date."); return; }
      await saveSession({
        id: uid(),
        type: "planned",
        workoutId: w.id,
        name: w.name,
        status: "skipped",
        date,
        elapsedMs: null,
        setsCompleted: null,
        setsTotal: setsOf(w).length,
        weights: {},
        nextTime: null,
        notes: view.querySelector("#skip-notes").value.trim(),
        saveOrder: Date.now(),
      });
      state.settings.nextOverride = null;
      await saveSettings();
      navigate(backTab);
    }
  };
}
