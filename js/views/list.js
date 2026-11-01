// List tab and the Detail page for one saved session (PRD 7.7, 7.8).
import { state, saveSession, deleteSession } from "../store.js";
import { workoutById } from "../plan.js";
import { nextWorkout, byRecency } from "../rotation.js";
import { navigate } from "../router.js";
import { esc, fmtDate, fmtElapsed, parseWeight } from "../util.js";
import { header, section, row, btn, ibtn, inputField, dateField, syncDate, textareaField, sheet, alertSheet, toast } from "../ui.js";
import { startPlanned, renderSkip } from "./workout.js";

export function renderList(view, route) {
  if (route.sub === "detail") return renderDetail(view, route.param);
  if (route.sub === "skip") return renderSkip(view, "list");

  const w = nextWorkout(state.sessions, state.settings);
  const a = state.active;
  const activeName = a && (a.kind === "core" ? "Core" : workoutById(a.workoutId).name);
  const top = a
    ? `${section(a.ready ? "Ready to start" : "In progress")}
       <div class="title-row card-row"><p class="wname">${esc(activeName)}</p>
         <div class="icon-group">${ibtn("go", "Go to workout", "goto", { kind: "filled" })}</div></div>`
    : `${section("Next up")}
       <div class="title-row card-row"><p class="wname">${esc(w.name)}</p>
         <div class="icon-group">${ibtn("skip", `Skip ${w.name}`, "skip")}${ibtn("play", `Start ${w.name}`, "start", { kind: "filled" })}</div></div>`;

  const rows = [...state.sessions].sort(byRecency).map((s) => row({
    title: s.name, sub: fmtDate(s.date), status: s.status, id: s.id,
    trail: s.elapsedMs != null ? fmtElapsed(s.elapsedMs) : "",
  })).join("");

  view.innerHTML = `<div class="scroll tabpage">${top}
    ${section("Past workouts", { divider: true })}
    ${rows || `<div class="empty"><p>No workouts saved yet</p><p>Completed, stopped and skipped workouts appear here, newest first.</p></div>`}
  </div>`;

  view.onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "start") startPlanned(w);
    if (act === "skip") navigate("list", "skip", null, "forward");
    if (act === "goto") navigate("workout", null, null, "forward");
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (id) navigate("list", "detail", id, "forward");
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
    body = `${section("Date")}
      <div class="stack">${dateField({ id: "date", label: "Date", value: s.date })}</div>
      ${section("Exercises", { divider: true })}
      ${w.blocks.flatMap((b) => b.items.map((it) => row({ title: w.exercises[it.ex].name, sub: `${b.sets} sets × ${it.reps} reps` }))).join("")}`;
  } else {
    body = `${section("Session", { divider: true })}
      ${row({ title: "Date", trail: fmtDate(s.date) })}
      ${row({ title: "Elapsed", trail: fmtElapsed(s.elapsedMs) })}
      ${s.status === "stopped" && s.nextTime ? row({ title: "Next time", trail: s.nextTime === "repeat" ? "Repeat" : "Move on" }) : ""}
      ${section("Results")}
      <div class="stack">${inputField({ id: "sets", label: s.type === "core" ? "Work intervals" : "Sets completed",
        value: s.setsCompleted ?? "", suffix: `of ${s.setsTotal}`, mode: "numeric" })}</div>
      ${w ? `${section("Weights")}
        <div class="stack">${w.exercises.map((ex) => inputField({ id: `w-${ex.id}`, label: ex.name,
          value: s.weights[ex.id] ?? "", suffix: units, attrs: `data-ex="${ex.id}"` })).join("")}</div>` : ""}`;
  }

  view.innerHTML = `
    ${header(s.name, { back: "Back to List", status: s.status })}
    <div class="scroll">
      ${body}
      ${section("Notes", { aside: "Optional" })}
      <div class="stack">${textareaField({ id: "notes", label: "Notes", value: s.notes })}</div>
      <div class="end-actions">${btn("Delete workout", "delete", { kind: "danger" })}</div>
    </div>
    <div class="actionbar inline" id="save-bar" hidden>
      ${btn("Cancel", "cancel", { xl: true })}${btn("Save changes", "save", { kind: "primary", xl: true })}
    </div>`;

  // Redraw this page in place (after Save or Cancel), keeping the scroll position.
  const redraw = () => {
    document.activeElement?.blur(); // lowers the keyboard
    const top = view.querySelector(".scroll").scrollTop;
    renderDetail(view, id);
    view.querySelector(".scroll").scrollTop = top;
  };

  // Save changes and Cancel appear only after a field is edited.
  view.oninput = view.onchange = (e) => {
    if (e.target.type === "date") syncDate(e.target);
    view.querySelector("#save-bar").hidden = false;
  };

  view.onclick = async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "back") navigate("list", null, null, "back");
    if (act === "cancel") redraw();
    if (act === "delete") {
      const ok = await sheet({
        title: "Delete this workout?",
        body: s.type === "core" ? "It can't be recovered." : "It can't be recovered, and deleting it can change what's next in the rotation.",
        keep: "Keep workout", confirm: "Delete workout",
      });
      if (!ok) return;
      await deleteSession(s.id);
      navigate("list", null, null, "back");
      toast("Workout deleted");
    }
    if (act === "save") {
      const updated = { ...s, weights: { ...s.weights }, notes: view.querySelector("#notes").value.trim() };
      if (skipped) {
        const date = view.querySelector("#date").value;
        if (!date) { alertSheet("Choose a date", "A skipped workout needs a date."); return; }
        updated.date = date;
      } else {
        const raw = view.querySelector("#sets").value.trim();
        const sets = Number(raw);
        if (raw === "" || !Number.isInteger(sets) || sets < 0 || sets > s.setsTotal) {
          alertSheet("Check the count", `${s.type === "core" ? "Work intervals" : "Sets completed"} must be a whole number from 0 to ${s.setsTotal}.`);
          return;
        }
        updated.setsCompleted = sets;
        view.querySelectorAll("[data-ex]").forEach((inp) => { updated.weights[inp.dataset.ex] = parseWeight(inp.value); });
      }
      await saveSession(updated);
      redraw();
      toast("Changes saved");
    }
  };
}
