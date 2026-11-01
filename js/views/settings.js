// Settings tab (PRD 7.9).
import { state, saveSettings, saveSession, replaceAll } from "../store.js";
import { ROTATION } from "../plan.js";
import { nextWorkout } from "../rotation.js";
import { buildCSV, buildBackup, parseBackup, shareFile } from "../export.js";
import { checkForUpdates } from "../update.js";
import { APP_VERSION } from "../version.js";
import * as wake from "../wake.js";
import { render } from "../router.js";
import { toISODate } from "../util.js";
import { section, row, btn, inputField, selectField, segField, toggleField, sheet, alertSheet, toast } from "../ui.js";

const LB_PER_KG = 2.20462262;
const roundHalf = (n) => Math.round(n * 2) / 2;

export function renderSettings(view) {
  const st = state.settings;
  const next = nextWorkout(state.sessions, st);

  view.innerHTML = `
    <div class="scroll tabpage">
      ${section("Workout")}
      <div class="stack">
        ${inputField({ id: "rest", label: "Rest between sets", value: st.restSeconds, suffix: "seconds", mode: "numeric" })}
        ${segField({ id: "units", label: "Units", value: st.units, helper: "Switching converts every saved weight.",
          options: [{ value: "lb", text: "Pounds" }, { value: "kg", text: "Kilograms" }] })}
        ${toggleField({ id: "sounds", label: "Sounds", on: st.sounds })}
        ${selectField({ id: "next", label: "Where you are in the rotation", value: next.id,
          helper: "The rotation continues in order from the workout you choose.",
          options: ROTATION.map((w) => ({ value: w.id, text: `Next: ${w.name}` })) })}
      </div>
      ${section("Your data", { divider: true })}
      ${row({ title: "Export CSV", act: "csv" })}
      ${row({ title: "Back up data", act: "backup" })}
      ${row({ title: "Restore from backup", act: "restore" })}
      <input type="file" id="restore-file" accept=".json,application/json" hidden>
      ${section("App", { divider: true })}
      ${row({ title: "Check for updates", trail: `v${APP_VERSION}`, act: "update" })}
      <p class="note">Checking for updates is the only thing in Next Set that uses the internet. Everything else stays on this phone.</p>
      <div class="end-actions">${btn("Erase all data", "erase", { kind: "danger" })}</div>
    </div>`;

  view.onchange = async (e) => {
    const t = e.target;
    if (t.id === "rest") {
      const n = Number(t.value.trim());
      if (!Number.isInteger(n) || n < 1) {
        t.value = st.restSeconds;
        alertSheet("Check the rest time", "Rest must be a whole number of seconds, 1 or more.");
        return;
      }
      st.restSeconds = n;
    }
    if (t.id === "next") {
      // Only store a position when it differs from where your history already puts you.
      const fromHistory = nextWorkout(state.sessions, { ...st, nextOverride: null });
      st.nextOverride = t.value === fromHistory.id ? null : t.value;
    }
    await saveSettings();
  };

  view.onclick = async (e) => {
    const el = e.target.closest("[data-act]");
    const act = el?.dataset.act;
    if (act === "toggle" && el.id === "sounds") {
      st.sounds = !st.sounds;
      el.setAttribute("aria-checked", st.sounds);
      await saveSettings();
    }
    if (act === "seg" && el.dataset.seg === "units" && el.dataset.value !== st.units) {
      const to = el.dataset.value;
      const name = to === "kg" ? "kilograms" : "pounds";
      const ok = await sheet({ title: `Switch to ${name}?`, tone: "neutral", keep: "Cancel", confirm: `Switch to ${name}`,
        body: `Every saved weight will be converted to ${name} and rounded to the nearest 0.5.` });
      if (!ok) return;
      await convertWeights(to);
      st.units = to;
      await saveSettings();
      render();
    }
    if (act === "csv") {
      shareFile(`workouts-${toISODate()}.csv`, "text/csv", buildCSV(state.sessions, st.units))
        .catch((err) => alertSheet("Couldn't export", err.message));
    }
    if (act === "backup") {
      shareFile(`next-set-backup-${toISODate()}.json`, "application/json", buildBackup(state.sessions, st))
        .catch((err) => alertSheet("Couldn't back up", err.message));
    }
    if (act === "restore") view.querySelector("#restore-file").click();
    if (act === "update") {
      const trail = el.querySelector(".row-trail");
      el.disabled = true;
      trail.textContent = "Checking…";
      try {
        const v = await checkForUpdates();
        if (v) {
          await alertSheet(`Updated to version ${v}`, "Next Set will now reload to finish updating.");
          location.reload();
          return;
        }
        toast("You’re on the latest version", "info");
      } catch {
        alertSheet("Couldn't check for updates", "Make sure you're connected to the internet and try again.");
      }
      el.disabled = false;
      trail.textContent = `v${APP_VERSION}`;
    }
    if (act === "erase") {
      const ok = await sheet({ title: "Erase all data?", prompt: "ERASE", keep: "Cancel", confirm: "Erase all data",
        body: "Every saved workout and setting will be deleted from this phone. This can’t be undone." });
      if (!ok) return;
      wake.release();
      await replaceAll([], {});
      render();
      toast("All data erased");
    }
  };

  view.querySelector("#restore-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let data;
    try {
      data = parseBackup(await file.text());
    } catch {
      alertSheet("Couldn’t restore", "That file isn’t a Next Set backup. Nothing on this phone was changed.");
      return;
    }
    const ok = await sheet({ title: "Restore from backup?", keep: "Cancel", confirm: "Replace my data",
      body: `All of your workouts and settings will be replaced by the ${data.sessions.length} workouts in the backup file. Back up first if you want to keep what’s here.` });
    if (!ok) return;
    wake.release();
    await replaceAll(data.sessions, data.settings || {});
    render();
    toast("Backup restored");
  });
}

async function convertWeights(to) {
  const factor = to === "kg" ? 1 / LB_PER_KG : LB_PER_KG;
  for (const s of state.sessions) {
    const keys = Object.keys(s.weights || {}).filter((k) => s.weights[k] != null);
    if (!keys.length) continue;
    const weights = { ...s.weights };
    keys.forEach((k) => { weights[k] = roundHalf(weights[k] * factor); });
    await saveSession({ ...s, weights });
  }
}
