// Workout tab: the next planned workout or the core workout, the Skip form, and starting
// sessions (PRD 7.2, 7.6).
import { state, saveActive, saveSession, saveSettings } from "../store.js";
import { setsOf, followingWorkout, CORE } from "../plan.js";
import { nextWorkout, lastCompletedWeights } from "../rotation.js";
import { newPlanned, newCore } from "../session.js";
import { unlockAudio } from "../sound.js";
import * as wake from "../wake.js";
import { navigate } from "../router.js";
import { esc, uid, toISODate, fmtWeight } from "../util.js";
import { header, section, row, btn, ibtn, segField, dateField, syncDate, textareaField, alertSheet, toast } from "../ui.js";
import { renderLive } from "./live.js";

export function renderWorkout(view, route) {
  if (state.active) return renderLive(view);
  if (route.sub === "skip") return renderSkip(view, "workout");

  const w = nextWorkout(state.sessions, state.settings);
  const weights = lastCompletedWeights(state.sessions, w.id);
  let mode = "next"; // the switch returns to Next up each time the page opens

  function draw() {
    const core = mode === "core";
    view.innerHTML = `
      <div class="scroll tabpage">
        <div class="title-row"><p class="wname">${core ? "Core" : esc(w.name)}</p>
          ${core ? "" : `<div class="icon-group">${ibtn("skip", `Skip ${w.name}`, "skip")}</div>`}</div>
        ${core ? coreHtml() : planHtml(w, weights)}
      </div>
      <div class="actionbar full">
        ${btn(core ? "Start core workout" : `Start ${w.name}`, "start", { kind: "primary", xl: true })}
        ${segField({ id: "mode", label: "Workout type", hideLabel: true, value: mode,
          options: [{ value: "next", text: "Next up" }, { value: "core", text: "Core" }] })}
      </div>`;
  }

  view.onclick = (e) => {
    const el = e.target.closest("[data-act]");
    const act = el?.dataset.act;
    if (act === "seg") { mode = el.dataset.value; draw(); }
    if (act === "start") mode === "core" ? startCore() : startPlanned(w);
    if (act === "skip") navigate("workout", "skip");
  };
  draw();
}

// The workout's blocks with sets × reps and the weights from the last Completed session.
export function planHtml(w, weights) {
  const many = w.blocks.length > 1;
  return w.blocks.map((b, i) => {
    const superset = b.items.length > 1 ? "Superset · " : "";
    const label = many ? `Block ${i + 1} · ${superset}${b.sets} sets` : `${superset}${b.sets} sets`;
    const rows = b.items.map((it) => {
      const ex = w.exercises[it.ex];
      return row({ title: ex.name, sub: `${b.sets} sets × ${it.reps} reps`, trail: fmtWeight(weights[ex.id], state.settings.units) });
    }).join("");
    return section(label, { aside: i === 0 ? "Last time" : "", divider: true }) + rows;
  }).join("");
}

function coreHtml() {
  return section(`${CORE.rounds} rounds each`, { aside: `${CORE.work} s work · ${CORE.rest} s rest`, divider: true })
    + CORE.exercises.map((name) => row({ title: name })).join("");
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

// Skip form, reachable from the Workout and List tabs. A skip always moves the rotation on.
export function renderSkip(view, backTab) {
  const w = nextWorkout(state.sessions, state.settings);
  view.innerHTML = `
    ${header("Skip workout", { back: "Cancel" })}
    <div class="scroll">
      ${section("Workout", { divider: true })}
      ${row({ title: w.name })}
      ${section("Date")}
      <div class="stack">${dateField({ id: "skip-date", label: "Date", value: toISODate(),
        helper: `Defaults to today. The rotation moves on to ${followingWorkout(w.id).name}.` })}</div>
      ${section("Notes", { aside: "Optional" })}
      <div class="stack">${textareaField({ id: "skip-notes", label: "Notes" })}</div>
    </div>
    <div class="actionbar">${btn("Save as skipped", "save", { kind: "primary", xl: true })}</div>`;

  view.onchange = (e) => { if (e.target.id === "skip-date") syncDate(e.target); };
  view.onclick = async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "back") navigate(backTab);
    if (act === "save") {
      const date = view.querySelector("#skip-date").value;
      if (!date) { alertSheet("Choose a date", "A skipped workout needs a date."); return; }
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
      toast(`${w.name} skipped`);
    }
  };
}
