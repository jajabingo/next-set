// CSV export and backup files (PRD 7.9, 11).
import { workoutById } from "./plan.js";
import { byRecency } from "./rotation.js";
import { toISODate } from "./util.js";

const STATUS = { completed: "Completed", stopped: "Stopped", skipped: "Skipped" };
const NEXT = { repeat: "Repeat", "move-on": "Move on" };

function hms(ms) {
  const s = Math.floor(ms / 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

function cell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCSV(sessions, units) {
  const header = ["Date", "Type", "Workout", "Status", "Elapsed (h:mm:ss)", "Sets Completed", "Sets Total", "Next Time"];
  for (let i = 1; i <= 4; i++) header.push(`Exercise ${i}`, `Exercise ${i} Weight`);
  header.push("Units", "Notes");

  const rows = [...sessions].sort(byRecency).map((s) => {
    const skipped = s.status === "skipped";
    const w = s.type === "planned" ? workoutById(s.workoutId) : null;
    const row = [
      s.date,
      s.type === "core" ? "Core" : "Planned",
      s.name,
      STATUS[s.status],
      s.elapsedMs != null ? hms(s.elapsedMs) : "",
      skipped ? "" : s.setsCompleted,
      skipped ? "" : s.setsTotal,
      NEXT[s.nextTime] ?? "",
    ];
    for (let i = 0; i < 4; i++) {
      const ex = w?.exercises[i];
      row.push(ex?.name ?? "", ex && !skipped ? (s.weights[ex.id] ?? "") : "");
    }
    row.push(w && !skipped ? units : "", s.notes);
    return row;
  });

  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function buildBackup(sessions, settings) {
  return JSON.stringify({ app: "next-set", backupVersion: 1, createdOn: toISODate(), settings, sessions }, null, 2);
}

export function parseBackup(text) {
  const data = JSON.parse(text);
  if (data?.app !== "next-set" || !Array.isArray(data.sessions)) throw new Error("This isn't a Next Set backup file.");
  return data;
}

// Opens the iPhone Share sheet (Save to Files). Falls back to a download on computers.
export async function shareFile(name, type, text) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if (e.name !== "AbortError") throw e;
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
