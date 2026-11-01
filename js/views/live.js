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
import { icon, header, section, row, btn, ibtn, inputField, choiceField, textareaField, sheet, toast } from "../ui.js";

const CUE_MS = 1200; // how long the "go" / "rest" frame shows after a phase change

export function renderLive(view) {
  const a = state.active;
  wake.acquire();
  // The core workout may have reached its end while another tab was showing.
  if (a.kind === "core" && !a.saving && S.coreSeconds(a, Date.now()) >= CORE_TOTAL) S.endCore(a);
  if (a.kind === "planned") return a.saving ? plannedSave(view, a) : plannedRun(view, a);
  return a.saving ? coreSave(view, a) : coreRun(view, a);
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

// ---------- Shared live layout ----------

// p: { cls, workout, status, progress, aside, pct, go, goIcon, paused }
function phaseHtml(p) {
  return `<section class="phase ${p.cls}${p.go ? " go" : ""}" aria-label="Workout status">
    <div class="p-top"><span>${esc(p.workout)}</span><span>Session</span></div>
    <div class="p-mid">
      <span class="p-status" aria-live="polite">
        ${p.paused ? icon("pause", 34) : ""}
        ${p.goIcon ? icon("play", 32, "go-icon show") : ""}
        <span>${esc(p.status)}</span>
        <span class="pips" hidden aria-hidden="true"><span></span><span></span><span></span></span>
      </span>
      <span class="p-clock" id="clock"></span>
    </div>
    <div class="p-timer" id="itimer" role="timer" aria-label="Interval timer"><span></span></div>
    <div class="p-prog"><span>${esc(p.progress)}</span><span id="aside">${esc(p.aside)}</span></div>
    <div class="bar"><div id="bar" style="width:${p.fromPct}%"></div></div>
  </section>`;
}

// One "Now" or "On deck" block: a label and up to two exercise lines.
function exBlock(label, items, deck = false) {
  return section(label) + `<div class="exblock${deck ? " deck" : ""}">${items.map((it) =>
    `<div class="exrow"><span class="reps">${esc(it.reps)}</span><span>${esc(it.name)}</span></div>`).join("")}</div>`;
}

function controlsHtml({ paused, undoOff, advance, advAct, auto }) {
  const left = paused
    ? ibtn("stop", "Stop workout", "stop", { kind: "danger", lg: true }) + ibtn("play", "Resume", "resume", { kind: "filled", lg: true })
    : ibtn("undo", "Undo last rest", "undo", { lg: true, disabled: undoOff }) + ibtn("pause", "Pause", "pause", { lg: true });
  return `<div class="controls">${left}${btn(advance, advAct, { kind: auto ? "" : "primary", xl: true, disabled: auto || paused })}</div>`;
}

// Fills the timer, clock and countdown cue on every tick.
function makeTicker(view) {
  let lastCount = null;
  return ({ timerSec, clockMs, count }) => {
    const timer = view.querySelector("#itimer");
    if (!timer) return;
    const text = fmtClock(timerSec);
    timer.firstChild.textContent = text;
    timer.classList.toggle("long", text.length >= 5);
    view.querySelector("#clock").textContent = fmtElapsed(clockMs);
    const pips = view.querySelector(".pips");
    pips.hidden = !count;
    timer.classList.toggle("count", !!count);
    if (count) {
      pips.querySelectorAll("span").forEach((d, i) => d.classList.toggle("on", i < count));
      if (count !== lastCount) {
        timer.classList.remove("pop");
        void timer.offsetWidth; // restart the grow-in for each new second
        timer.classList.add("pop");
      }
    }
    lastCount = count;
  };
}

// After drawing: slide the progress bar forward and end the go/rest frame.
function afterDraw(view, pct) {
  requestAnimationFrame(() => {
    const bar = view.querySelector("#bar");
    if (bar) bar.style.width = `${pct}%`;
  });
  const panel = view.querySelector(".phase.go");
  if (panel) setTimeout(() => panel.classList.remove("go"), CUE_MS);
}

const reps = (it) => `${it.reps} ×`;

// ---------- Planned workout in progress ----------

function plannedRun(view, a) {
  const w = workoutById(a.workoutId);
  const sets = setsOf(w);
  const total = sets.length;
  const tick = makeTicker(view);
  let key = null;
  let shownPct = (a.history.length / total) * 100;

  function draw(now) {
    const done = a.history.length;
    const paused = S.isPaused(a);
    const inRest = a.phase === "rest";
    const s = sets[done]; // current set, or the upcoming one during rest
    const next = sets[done + 1];
    const isFinal = done === total - 1;
    const pct = (done / total) * 100;
    const setElapsed = S.virtual(a, now) - a.phaseStartV;
    // The next set just began after a rest: show the go frame.
    const go = !paused && !inRest && done > 0 && setElapsed < CUE_MS;

    view.innerHTML = `<div class="live" style="display:contents">
      ${phaseHtml({
        cls: paused ? "paused" : inRest ? "rest" : "set",
        workout: w.name,
        status: paused ? "PAUSED" : inRest ? "REST" : `SET ${done + 1}`,
        progress: inRest ? `Rest · ${done} of ${total} sets done` : `Set ${done + 1} of ${total}`,
        aside: s.blockLabel ? `${s.blockLabel} · ${s.setInBlock} of ${s.blockSets}` : isFinal && !inRest ? "Last set" : "",
        fromPct: shownPct, go, goIcon: go, paused,
      })}
      <div class="scroll">
        ${exBlock(`${inRest ? "Next set" : "Now"} · Set ${done + 1}`, s.items.map((it) => ({ name: it.name, reps: reps(it) })))}
        ${next
          ? exBlock(`On deck · Set ${done + 2}`, next.items.map((it) => ({ name: it.name, reps: reps(it) })), true)
          : exBlock("On deck", [{ name: "Finish and save", reps: "" }], true)}
      </div>
      ${controlsHtml({
        paused, undoOff: done === 0,
        advance: inRest ? "Skip rest" : isFinal ? "Finish" : "Rest",
        advAct: inRest ? "skip" : isFinal ? "finish" : "rest",
      })}
    </div>`;
    afterDraw(view, pct);
    shownPct = pct;
  }

  function update(now) {
    const k = `${a.phase}|${a.history.length}|${S.isPaused(a)}`;
    if (k !== key) { key = k; draw(now); }
    const el = S.virtual(a, now) - a.phaseStartV;
    const inRest = a.phase === "rest";
    const sec = inRest ? Math.ceil(Math.max(0, a.restMs - el) / 1000) : Math.floor(el / 1000);
    tick({ timerSec: sec, clockMs: now - a.startedAt, count: inRest && !S.isPaused(a) && sec >= 1 && sec <= 3 ? sec : 0 });
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
  const choiceHelp = "Choose one to save this workout.";

  view.innerHTML = `
    ${header(isStop ? "Workout stopped" : "Workout complete")}
    <div class="scroll">
      ${section(w.name, { divider: true })}
      ${row({ title: "Date", trail: fmtDate(toISODate(new Date(a.startedAt))) })}
      ${row({ title: "Elapsed", trail: fmtElapsed(a.endedAt - a.startedAt) })}
      ${row({ title: "Sets completed", trail: `${done} of ${total}` })}
      ${isStop ? `${section("Next time", { aside: "Required" })}
        <div class="stack">${choiceField({ name: "next", label: "Next time", value: d.nextTime, helper: d.nextTime ? "" : choiceHelp,
          options: [{ value: "repeat", text: `Repeat ${w.name}` }, { value: "move-on", text: `Move on to ${next.name}` }] })}</div>` : ""}
      ${section("Weights", { aside: "From last completed" })}
      <div class="stack">${w.exercises.map((ex) => inputField({ id: `w-${ex.id}`, label: ex.name,
        value: d.weights[ex.id] ?? "", suffix: units, attrs: `data-ex="${ex.id}"` })).join("")}</div>
      ${section("Notes", { aside: "Optional" })}
      <div class="stack">${textareaField({ id: "notes", label: "Notes", value: d.notes })}</div>
      <div class="end-actions">
        ${btn("Back to workout", "back")}
        ${btn("Discard workout", "discard", { kind: "danger" })}
      </div>
    </div>
    <div class="actionbar">${btn("Save workout", "save", { kind: "primary", xl: true, disabled: isStop && !d.nextTime })}</div>`;

  view.oninput = (e) => {
    const t = e.target;
    if (t.dataset.ex) d.weights[t.dataset.ex] = parseWeight(t.value);
    if (t.id === "notes") d.notes = t.value;
    saveActive();
  };

  view.onclick = async (e) => {
    const el = e.target.closest("[data-act]");
    const act = el?.dataset.act;
    if (act === "choice") {
      d.nextTime = el.dataset.value;
      view.querySelectorAll(".choice").forEach((c) => c.setAttribute("aria-checked", c === el));
      view.querySelector(".choices + .helper")?.remove();
      view.querySelector('[data-act="save"]').disabled = false;
      saveActive();
    }
    if (act === "back") {
      S.backToWorkout(a);
      await saveActive();
      render();
    }
    if (act === "discard") {
      const ok = await sheet({ title: "Discard this workout?", keep: "Keep editing", confirm: "Discard workout",
        body: `Nothing from this ${w.name} session will be saved, and the rotation won't move on. This can't be undone.` });
      if (ok) await endSession("workout");
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
      await endSession("list");
      toast("Workout saved");
    }
  };
}

async function endSession(tab) {
  wake.release();
  await clearActive();
  navigate(tab);
}

// ---------- Core workout in progress ----------

function coreRun(view, a) {
  const tick = makeTicker(view);
  let key = null;
  let shownPct = (corePositionAt(Math.min(S.coreSeconds(a, Date.now()), CORE_TOTAL)).completedWork / CORE_INTERVALS) * 100;

  function draw(p) {
    const paused = S.isPaused(a);
    const ex = CORE.exercises;
    const work = { reps: `${CORE.work} s` };
    // During rest, "Next" is the coming interval: the same exercise's next round, or the next exercise.
    const nk = p.k + 1;
    const nextEx = Math.floor(nk / CORE.rounds);
    const now = p.phase === "prep" ? { label: "First up · Round 1", ex: 0 }
      : p.phase === "work" ? { label: `Now · Round ${p.round}`, ex: p.exIndex }
      : { label: `Next · Round ${(nk % CORE.rounds) + 1}`, ex: nextEx };
    const deck = ex[now.ex + 1];
    const phaseLen = p.phase === "prep" ? CORE.prep : p.phase === "work" ? CORE.work : CORE.rest;
    const go = !paused && p.phase !== "prep" && phaseLen - p.left < CUE_MS / 1000;
    const pct = (p.completedWork / CORE_INTERVALS) * 100;

    view.innerHTML = `<div class="live" style="display:contents">
      ${phaseHtml({
        cls: paused ? "paused" : p.phase === "prep" ? "prep" : p.phase === "rest" ? "rest" : "set",
        workout: "Core",
        status: paused ? "PAUSED" : p.phase === "prep" ? "GET READY" : p.phase === "work" ? "WORK" : "REST",
        progress: `Round ${p.round} of ${CORE.rounds} · Exercise ${p.exIndex + 1} of ${ex.length}`,
        aside: "", fromPct: shownPct, go, goIcon: go && p.phase === "work", paused,
      })}
      <div class="scroll">
        ${exBlock(now.label, [{ name: ex[now.ex], ...work }])}
        ${exBlock("On deck", [{ name: deck ?? "Finish and save", reps: "" }], true)}
      </div>
      ${controlsHtml({ paused, undoOff: true, advance: "Automatic", advAct: "none", auto: true })}
    </div>`;
    afterDraw(view, pct);
    shownPct = pct;
  }

  function update(now) {
    const t = Math.min(S.coreSeconds(a, now), CORE_TOTAL);
    const p = corePositionAt(t);
    if (p.phase === "done") return; // the engine is about to show the save screen
    const k = `${p.phase}|${p.k}|${S.isPaused(a)}`;
    if (k !== key) { key = k; draw(p); }
    const sec = Math.ceil(p.left);
    tick({ timerSec: sec, clockMs: now - a.startedAt,
      count: p.phase !== "work" && !S.isPaused(a) && sec >= 1 && sec <= 3 ? sec : 0 });
    view.querySelector("#aside").textContent = `${fmtClock(Math.ceil(CORE_TOTAL - t))} left`;
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
    ${header(isStop ? "Core workout stopped" : "Core workout complete")}
    <div class="scroll">
      ${section("Core", { divider: true })}
      ${row({ title: "Date", trail: fmtDate(toISODate(new Date(a.startedAt))) })}
      ${row({ title: "Elapsed", trail: fmtElapsed(a.endedAt - a.startedAt) })}
      ${row({ title: "Work intervals", trail: `${a.intervalsDone} of ${CORE_INTERVALS}` })}
      ${section("Notes", { aside: "Optional" })}
      <div class="stack">${textareaField({ id: "notes", label: "Notes", value: a.notes })}</div>
      <div class="end-actions">
        ${isStop ? btn("Back to workout", "back") : ""}
        ${btn("Discard workout", "discard", { kind: "danger" })}
      </div>
    </div>
    <div class="actionbar">${btn("Save workout", "save", { kind: "primary", xl: true })}</div>`;

  view.oninput = (e) => {
    if (e.target.id === "notes") { a.notes = e.target.value; saveActive(); }
  };
  view.onclick = async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "back") {
      S.backToWorkout(a);
      await saveActive();
      render();
    }
    if (act === "discard") {
      const ok = await sheet({ title: "Discard this workout?", keep: "Keep editing", confirm: "Discard workout",
        body: "Nothing from this core workout will be saved. This can't be undone." });
      if (ok) await endSession("workout");
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
    await endSession("list");
    toast("Workout saved");
  };
}
