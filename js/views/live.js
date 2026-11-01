// The session in progress and its save screens (PRD 6, 7.3–7.5). Timing, beeps and
// auto-advance live in engine.js; these screens only display state and handle taps.
import { state, saveActive, clearActive, saveSession, saveSettings } from "../store.js";
import { workoutById, followingWorkout, setsOf, CORE, CORE_TOTAL, CORE_INTERVALS, corePositionAt } from "../plan.js";
import { lastCompletedWeights } from "../rotation.js";
import * as S from "../session.js";
import { beep, unlockAudio } from "../sound.js";
import { setDisplay } from "../engine.js";
import * as wake from "../wake.js";
import { navigate, render } from "../router.js";
import { esc, uid, toISODate, fmtClock, fmtElapsed, fmtDate, parseWeight } from "../util.js";

export function renderLive(view) {
  const a = state.active;
  wake.acquire();
  // The core workout may have reached its end while another tab was showing.
  if (a.kind === "core" && !a.saving && S.coreSeconds(a, Date.now()) >= CORE_TOTAL) S.endCore(a);
  if (a.kind === "planned") return a.saving ? plannedSave(view, a) : plannedRun(view, a);
  return a.saving ? coreSave(view, a) : coreRun(view, a);
}

function setLabel(items) {
  return items.map((it) => `<div class="now-ex">${it.reps} × ${esc(it.name)}</div>`).join("");
}

// Shared tap handling for both kinds of session.
function handleTap(a, act, update) {
  const now = Date.now();
  if (act === "rest") S.tapRest(a, now);
  if (act === "skip") { S.skipRest(a, now); beep("go"); }
  if (act === "undo") S.undo(a, now);
  if (act === "pause") S.pause(a, now);
  if (act === "resume") { unlockAudio(); S.resume(a, now); }
  if (act === "finish") S.finish(a, now);
  if (act === "stop") S.stop(a, now);
  saveActive();
  if (a.saving) render();
  else update(now);
}

// ---------- Planned workout in progress ----------

function plannedRun(view, a) {
  const w = workoutById(a.workoutId);
  const sets = setsOf(w);
  const total = sets.length;
  let key = null;

  function draw() {
    const done = a.history.length;
    const paused = S.isPaused(a);
    const inRest = a.phase === "rest";
    const s = sets[done]; // current set, or the upcoming one during rest
    const nextSet = sets[done + 1];
    const isFinal = done === total - 1;
    const blockInfo = s.blockLabel
      ? `<div class="muted small" style="text-align:center">${esc(s.blockLabel)} · Set ${s.setInBlock} of ${s.blockSets}</div>`
      : "";
    const progress = inRest ? `Rest · ${done} of ${total} sets done` : `Set ${done + 1} of ${total}`;

    const detail = inRest
      ? `<div class="eyebrow">Next set</div>${setLabel(s.items)}`
      : `<div class="eyebrow">Now</div>${setLabel(s.items)}
         <div class="eyebrow" style="margin-top:12px">Next up</div>
         <div class="muted">${nextSet ? nextSet.items.map((it) => `${it.reps} × ${esc(it.name)}`).join(" + ") : "Finish workout"}</div>`;

    let buttons;
    if (paused) {
      buttons = `<button class="btn btn-primary btn-xl" data-act="resume">Resume</button>
        <button class="btn btn-danger" data-act="stop">Stop workout</button>`;
    } else {
      const primary = inRest
        ? `<button class="btn btn-primary btn-xl" data-act="skip">Skip rest</button>`
        : isFinal
          ? `<button class="btn btn-primary btn-xl" data-act="finish">Finish</button>`
          : `<button class="btn btn-primary btn-xl" data-act="rest">Rest</button>`;
      buttons = `${primary}
        <div class="btn-row">
          <button class="btn" data-act="undo" ${done ? "" : "disabled"}>Undo</button>
          <button class="btn" data-act="pause">Pause</button>
        </div>`;
    }

    view.innerHTML = `<div class="live">
      <div class="live-head"><h1>${esc(w.name)}</h1><span class="session-clock" id="clock"></span></div>
      <div class="banner ${paused ? "paused" : inRest ? "rest" : "set"}">${paused ? "PAUSED" : inRest ? "REST" : "SET " + (done + 1)}</div>
      <div class="big-timer" id="itimer"></div>
      <div class="progress-text">${progress}</div>
      ${blockInfo}
      <div class="progress"><div style="width:${(done / total) * 100}%"></div></div>
      <div class="card">${detail}</div>
      ${buttons}
    </div>`;
  }

  function update(now) {
    const k = `${a.phase}|${a.history.length}|${S.isPaused(a)}`;
    if (k !== key) { key = k; draw(); }
    const el = S.virtual(a, now) - a.phaseStartV;
    const sec = a.phase === "rest" ? Math.ceil(Math.max(0, a.restMs - el) / 1000) : Math.floor(el / 1000);
    view.querySelector("#itimer").textContent = fmtClock(sec);
    view.querySelector("#clock").textContent = fmtElapsed(now - a.startedAt);
  }

  view.onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act) handleTap(a, act, update);
  };

  S.advance(a, Date.now());
  update(Date.now());
  setDisplay(update);
  return () => setDisplay(null);
}

// ---------- Planned workout save screen ----------

function plannedSave(view, a) {
  const w = workoutById(a.workoutId);
  const total = setsOf(w).length;
  const isStop = a.saving === "stop";
  const done = isStop ? a.history.length : total;
  const units = state.settings.units;
  const next = followingWorkout(w.id);
  a.draft ??= { weights: lastCompletedWeights(state.sessions, w.id), notes: "", nextTime: null };
  const d = a.draft;

  view.innerHTML = `
    <div class="eyebrow">${isStop ? "Workout stopped" : "Workout complete"}</div>
    <h1>${esc(w.name)}</h1>
    <div class="card">
      <div class="ro"><span>Date</span><b>${fmtDate(toISODate(new Date(a.startedAt)))}</b></div>
      <div class="ro"><span>Elapsed</span><b>${fmtElapsed(a.endedAt - a.startedAt)}</b></div>
      <div class="ro"><span>Sets completed</span><b>${done} of ${total}</b></div>
    </div>
    <h2>Weights</h2>
    <div class="card">
      ${w.exercises.map((ex) => `<label class="weight-row"><span class="ex-name">${esc(ex.name)}</span>
        <input type="number" inputmode="decimal" step="0.5" min="0" data-ex="${ex.id}" value="${d.weights[ex.id] ?? ""}">
        <span class="unit">${units}</span></label>`).join("")}
    </div>
    <label class="field"><span>Notes</span><textarea id="notes" placeholder="Optional">${esc(d.notes)}</textarea></label>
    ${isStop ? `
      <h2>Next time</h2>
      <label class="choice"><input type="radio" name="next" value="repeat" ${d.nextTime === "repeat" ? "checked" : ""}> Repeat ${esc(w.name)}</label>
      <label class="choice"><input type="radio" name="next" value="move-on" ${d.nextTime === "move-on" ? "checked" : ""}> Move on to ${esc(next.name)}</label>` : ""}
    <button class="btn btn-primary" data-act="save" ${isStop && !d.nextTime ? "disabled" : ""}>Save</button>
    ${!isStop ? `<button class="btn btn-ghost" data-act="back">Back to workout</button>` : ""}
    <button class="btn btn-danger" data-act="discard">Discard</button>`;

  view.oninput = view.onchange = (e) => {
    const t = e.target;
    if (t.dataset.ex) d.weights[t.dataset.ex] = parseWeight(t.value);
    if (t.id === "notes") d.notes = t.value;
    if (t.name === "next") {
      d.nextTime = t.value;
      view.querySelector('[data-act="save"]').disabled = false;
    }
    saveActive();
  };

  view.onclick = async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "back") {
      S.backFromFinish(a);
      await saveActive();
      render();
    }
    if (act === "discard" && confirm("Discard this workout? It will not be saved.")) {
      await endSession();
    }
    if (act === "save") {
      const weights = {};
      w.exercises.forEach((ex) => { weights[ex.id] = d.weights[ex.id] ?? null; });
      await saveSession({
        id: uid(),
        type: "planned",
        workoutId: w.id,
        name: w.name,
        status: isStop ? "stopped" : "completed",
        date: toISODate(new Date(a.startedAt)),
        elapsedMs: a.endedAt - a.startedAt,
        setsCompleted: done,
        setsTotal: total,
        weights,
        nextTime: isStop ? d.nextTime : null,
        notes: d.notes.trim(),
        saveOrder: Date.now(),
      });
      state.settings.nextOverride = null;
      await saveSettings();
      await endSession();
    }
  };
}

async function endSession() {
  wake.release();
  await clearActive();
  navigate("workout");
}

// ---------- Core workout in progress ----------

function coreRun(view, a) {
  let key = null;

  function draw(p) {
    const paused = S.isPaused(a);
    const onDeck = CORE.exercises[p.exIndex + 1];
    const label = paused ? "PAUSED" : p.phase === "prep" ? "GET READY" : p.phase === "work" ? "WORK" : "REST";
    view.innerHTML = `<div class="live">
      <div class="live-head"><h1>Core</h1><span class="session-clock" id="clock"></span></div>
      <div class="banner ${paused ? "paused" : p.phase}">${label}</div>
      <div class="core-ex">${esc(CORE.exercises[p.exIndex])}</div>
      <div class="big-timer" id="itimer"></div>
      <div class="progress-text">Round ${p.round} of ${CORE.rounds} · Exercise ${p.exIndex + 1} of ${CORE.exercises.length}</div>
      <div class="progress"><div style="width:${(p.completedWork / CORE_INTERVALS) * 100}%"></div></div>
      <div class="ondeck">On deck: <b>${onDeck ? esc(onDeck) : "Finish"}</b></div>
      <div class="ondeck small" id="total-left"></div>
      ${paused
        ? `<button class="btn btn-primary btn-xl" data-act="resume">Resume</button>
           <button class="btn btn-danger" data-act="stop">Stop workout</button>`
        : `<button class="btn btn-xl" data-act="pause">Pause</button>`}
    </div>`;
  }

  function update(now) {
    const t = Math.min(S.coreSeconds(a, now), CORE_TOTAL);
    const p = corePositionAt(t);
    if (p.phase === "done") return; // the engine is about to show the save screen
    const k = `${p.phase}|${p.k}|${S.isPaused(a)}`;
    if (k !== key) { key = k; draw(p); }
    view.querySelector("#itimer").textContent = fmtClock(Math.ceil(p.left));
    view.querySelector("#clock").textContent = fmtElapsed(now - a.startedAt);
    view.querySelector("#total-left").textContent = `Total left ${fmtClock(Math.ceil(CORE_TOTAL - t))}`;
  }

  view.onclick = (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act) handleTap(a, act, update);
  };

  update(Date.now());
  setDisplay(update);
  return () => setDisplay(null);
}

// ---------- Core workout save screen ----------

function coreSave(view, a) {
  const isStop = a.saving === "stop";
  view.innerHTML = `
    <div class="eyebrow">${isStop ? "Core workout stopped" : "Core workout complete"}</div>
    <h1>Core</h1>
    <div class="card">
      <div class="ro"><span>Date</span><b>${fmtDate(toISODate(new Date(a.startedAt)))}</b></div>
      <div class="ro"><span>Elapsed</span><b>${fmtElapsed(a.endedAt - a.startedAt)}</b></div>
      <div class="ro"><span>Work intervals</span><b>${a.intervalsDone} of ${CORE_INTERVALS}</b></div>
    </div>
    <label class="field"><span>Notes</span><textarea id="notes" placeholder="Optional">${esc(a.notes)}</textarea></label>
    <button class="btn btn-primary" data-act="save">Save</button>
    <button class="btn btn-danger" data-act="discard">Discard</button>`;

  view.oninput = (e) => {
    if (e.target.id === "notes") { a.notes = e.target.value; saveActive(); }
  };
  view.onclick = async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "discard" && confirm("Discard this core workout? It will not be saved.")) {
      await endSession();
      return;
    }
    if (act !== "save") return;
    await saveSession({
      id: uid(),
      type: "core",
      workoutId: null,
      name: "Core",
      status: isStop ? "stopped" : "completed",
      date: toISODate(new Date(a.startedAt)),
      elapsedMs: a.endedAt - a.startedAt,
      setsCompleted: a.intervalsDone,
      setsTotal: CORE_INTERVALS,
      weights: {},
      nextTime: null,
      notes: a.notes.trim(),
      saveOrder: Date.now(),
    });
    await endSession();
  };
}
