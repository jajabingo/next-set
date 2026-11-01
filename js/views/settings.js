// Settings tab (PRD 7.9).
import { state, saveSettings, saveSession, replaceAll } from "../store.js";
import { ROTATION } from "../plan.js";
import { nextWorkout } from "../rotation.js";
import { buildCSV, buildBackup, parseBackup, shareFile } from "../export.js";
import { checkForUpdates } from "../update.js";
import { APP_VERSION } from "../version.js";
import * as wake from "../wake.js";
import { render } from "../router.js";
import { esc, toISODate, toast } from "../util.js";

const LB_PER_KG = 2.20462262;
const roundHalf = (n) => Math.round(n * 2) / 2;

export function renderSettings(view) {
  const st = state.settings;
  const autoNext = nextWorkout(state.sessions, { ...st, nextOverride: null });

  view.innerHTML = `
    <h1>Settings</h1>

    <h2>Workout</h2>
    <div class="card">
      <label class="field"><span>Rest between sets (seconds)</span>
        <input type="number" inputmode="numeric" min="1" step="1" id="rest" value="${st.restSeconds}"></label>
      <label class="field"><span>Units</span>
        <select id="units">
          <option value="lb" ${st.units === "lb" ? "selected" : ""}>Pounds (lb)</option>
          <option value="kg" ${st.units === "kg" ? "selected" : ""}>Kilograms (kg)</option>
        </select></label>
      <label class="choice"><input type="checkbox" id="sounds" ${st.sounds ? "checked" : ""}> Sounds</label>
      <label class="field"><span>Next workout</span>
        <select id="next">
          <option value="">Follow the rotation (${esc(autoNext.name)})</option>
          ${ROTATION.map((w) => `<option value="${w.id}" ${st.nextOverride === w.id ? "selected" : ""}>${esc(w.name)}</option>`).join("")}
        </select></label>
    </div>

    <h2>Your data</h2>
    <button class="btn" data-act="csv">Export CSV</button>
    <button class="btn" data-act="backup">Back up data</button>
    <button class="btn" data-act="restore">Restore from backup</button>
    <input type="file" id="restore-file" accept=".json,application/json" hidden>

    <h2>App</h2>
    <button class="btn" data-act="update">Check for updates</button>
    <p class="muted small" style="text-align:center">Version ${APP_VERSION}. Checking for updates is the only thing that uses the internet.</p>
    <button class="btn btn-danger" data-act="erase">Erase all data</button>`;

  view.onchange = async (e) => {
    const t = e.target;
    if (t.id === "rest") {
      const n = Number(t.value);
      if (!Number.isInteger(n) || n < 1) { alert("Rest must be a whole number of seconds."); t.value = st.restSeconds; return; }
      st.restSeconds = n;
    }
    if (t.id === "sounds") st.sounds = t.checked;
    if (t.id === "next") st.nextOverride = t.value || null;
    if (t.id === "units") {
      const to = t.value;
      if (!confirm(`Switch to ${to === "kg" ? "kilograms" : "pounds"}? All saved weights will be converted.`)) { t.value = st.units; return; }
      await convertWeights(to);
      st.units = to;
    }
    await saveSettings();
    toast("Saved");
  };

  view.onclick = async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "csv") {
      shareFile(`workouts-${toISODate()}.csv`, "text/csv", buildCSV(state.sessions, st.units)).catch((err) => alert(err.message));
    }
    if (act === "backup") {
      shareFile(`next-set-backup-${toISODate()}.json`, "application/json", buildBackup(state.sessions, st)).catch((err) => alert(err.message));
    }
    if (act === "restore") view.querySelector("#restore-file").click();
    if (act === "update") {
      const btn = e.target.closest("button");
      btn.disabled = true;
      btn.textContent = "Checking…";
      try {
        const v = await checkForUpdates();
        if (v) { alert(`Updated to version ${v}. The app will now reload.`); location.reload(); return; }
        toast("You're on the latest version.");
      } catch {
        alert("Couldn't check for updates. Make sure you're connected to the internet and try again.");
      }
      btn.disabled = false;
      btn.textContent = "Check for updates";
    }
    if (act === "erase") {
      const typed = prompt('This deletes every saved workout and setting. Type ERASE to confirm.');
      if (typed?.trim().toUpperCase() !== "ERASE") return;
      wake.release();
      await replaceAll([], {});
      toast("All data erased");
      render();
    }
  };

  view.querySelector("#restore-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = parseBackup(await file.text());
      if (!confirm(`Restore ${data.sessions.length} workouts from this backup? This replaces all current data.`)) return;
      wake.release();
      await replaceAll(data.sessions, data.settings || {});
      toast("Backup restored");
      render();
    } catch (err) {
      alert(err.message || "Couldn't read that file.");
    }
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
