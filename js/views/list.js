// List tab and the Detail page for one saved session (PRD 7.7, 7.8).
import { state, saveSession, deleteSession } from "../store.js";
import { workoutById } from "../plan.js";
import { nextWorkout, byRecency } from "../rotation.js";
import { navigate } from "../router.js";
import { esc, fmtDate, fmtElapsed, parseWeight, toast } from "../util.js";
import { startPlanned, renderSkip } from "./workout.js";

const STATUS = { completed: "Completed", stopped: "Stopped", skipped: "Skipped" };

export function renderList(view, route) {
  if (route.sub === "detail") return renderDetail(view, route.param);
  if (route.sub === "skip") return renderSkip(view, "list");

  const w = nextWorkout(state.sessions, state.settings);
  const top = state.active
    ? `<div class="card"><div class="eyebrow">In progress</div>
         <div class="row-title">${esc(state.active.kind === "core" ? "Core" : workoutById(state.active.workoutId).name)}</div>
         <button class="btn btn-primary" data-act="goto">Go to workout</button></div>`
    : `<div class="card"><div class="eyebrow">Next up</div>
         <div class="row-title">${esc(w.name)}</div>
         <div class="btn-row"><button class="btn btn-primary" data-act="start">Start</button>
         <button class="btn" data-act="skip">Skip</button></div></div>`;

  const sessions = [...state.sessions].sort(byRecency);
  const rows = sessions.map((s) => `
    <button class="row" data-id="${s.id}">
      <div class="row-main">
        <div class="row-title">${esc(s.name)}</div>
        <div class="row-sub">${fmtDate(s.date)}</div>
        <span class="badge ${s.status}">${STATUS[s.status]}</span>
      </div>
      <div class="row-side">${s.elapsedMs != null ? fmtElapsed(s.elapsedMs) : ""}</div>
    </button>`).join("");

  view.innerHTML = `<h1>List</h1>${top}
    ${rows || `<div class="empty">No workouts saved yet.</div>`}`;

  view.onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "start") startPlanned(w);
    if (act === "skip") navigate("list", "skip");
    if (act === "goto") navigate("workout");
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (id) navigate("list", "detail", id);
  };
}

function renderDetail(view, id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) { navigate("list"); return; }
  const w = s.type === "planned" ? workoutById(s.workoutId) : null;
  const skipped = s.status === "skipped";
  const units = state.settings.units;

  let body = "";
  if (skipped) {
    body = `<label class="field"><span>Date</span><input type="date" id="date" value="${s.date}"></label>`;
  } else {
    body = `<div class="card">
        <div class="ro"><span>Date</span><b>${fmtDate(s.date)}</b></div>
        <div class="ro"><span>Elapsed</span><b>${fmtElapsed(s.elapsedMs)}</b></div>
        ${s.status === "stopped" && s.nextTime ? `<div class="ro"><span>Next time</span><b>${s.nextTime === "repeat" ? "Repeat" : "Move on"}</b></div>` : ""}
      </div>
      <label class="field"><span>${s.type === "core" ? "Work intervals completed" : "Sets completed"} (of ${s.setsTotal})</span>
        <input type="number" inputmode="numeric" min="0" max="${s.setsTotal}" step="1" id="sets" value="${s.setsCompleted ?? ""}"></label>`;
    if (w) {
      body += `<h2>Weights</h2><div class="card">
        ${w.exercises.map((ex) => `<label class="weight-row"><span class="ex-name">${esc(ex.name)}</span>
          <input type="number" inputmode="decimal" step="0.5" min="0" data-ex="${ex.id}" value="${s.weights[ex.id] ?? ""}">
          <span class="unit">${units}</span></label>`).join("")}
      </div>`;
    }
  }
  if (skipped && w) {
    body += `<div class="card">${w.exercises.map((ex) => `<div class="ex-row"><span class="ex-name">${esc(ex.name)}</span></div>`).join("")}</div>`;
  }

  view.innerHTML = `
    <button class="link" data-act="back">‹ List</button>
    <div class="eyebrow"><span class="badge ${s.status}">${STATUS[s.status]}</span></div>
    <h1>${esc(s.name)}</h1>
    ${body}
    <label class="field"><span>Notes</span><textarea id="notes" placeholder="Optional">${esc(s.notes)}</textarea></label>
    <button class="btn btn-primary" data-act="save">Save changes</button>
    <button class="btn btn-danger" data-act="delete">Delete workout</button>`;

  view.onclick = async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "back") navigate("list");
    if (act === "delete" && confirm("Delete this workout? This can't be undone.")) {
      await deleteSession(s.id);
      navigate("list");
    }
    if (act === "save") {
      const updated = { ...s, weights: { ...s.weights }, notes: view.querySelector("#notes").value.trim() };
      if (skipped) {
        const date = view.querySelector("#date").value;
        if (!date) { alert("Please choose a date."); return; }
        updated.date = date;
      } else {
        const sets = Number(view.querySelector("#sets").value);
        if (!Number.isInteger(sets) || sets < 0 || sets > s.setsTotal) {
          alert(`Sets completed must be a whole number from 0 to ${s.setsTotal}.`);
          return;
        }
        updated.setsCompleted = sets;
        view.querySelectorAll("[data-ex]").forEach((inp) => { updated.weights[inp.dataset.ex] = parseWeight(inp.value); });
      }
      await saveSession(updated);
      toast("Saved");
      navigate("list");
    }
  };
}
