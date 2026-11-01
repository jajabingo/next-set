// All data lives in this phone's IndexedDB. Everything is also kept in memory
// so screens can render instantly; every change is written through to the database.

const DB_NAME = "next-set";
const DB_VERSION = 1;

export const DEFAULT_SETTINGS = { restSeconds: 80, units: "lb", sounds: true, nextOverride: null };

export const state = {
  sessions: [],
  settings: { ...DEFAULT_SETTINGS },
  active: null, // the session in progress, if any
};

let dbPromise = null;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("sessions", { keyPath: "id" });
      req.result.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result?.result);
    t.onerror = () => reject(t.error);
  });
}

export async function load() {
  const [sessions, settings, active] = await Promise.all([
    tx("sessions", "readonly", (s) => s.getAll()),
    tx("kv", "readonly", (s) => s.get("settings")),
    tx("kv", "readonly", (s) => s.get("active")),
  ]);
  state.sessions = sessions || [];
  state.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  state.active = active || null;
}

export async function saveSession(session) {
  const i = state.sessions.findIndex((s) => s.id === session.id);
  if (i >= 0) state.sessions[i] = session;
  else state.sessions.push(session);
  await tx("sessions", "readwrite", (s) => s.put(session));
}

export async function deleteSession(id) {
  state.sessions = state.sessions.filter((s) => s.id !== id);
  await tx("sessions", "readwrite", (s) => s.delete(id));
}

export async function saveSettings() {
  await tx("kv", "readwrite", (s) => s.put(state.settings, "settings"));
}

export async function saveActive() {
  if (!state.active) return;
  await tx("kv", "readwrite", (s) => s.put(state.active, "active"));
}

export async function clearActive() {
  state.active = null;
  await tx("kv", "readwrite", (s) => s.delete("active"));
}

// Replace everything (restore from backup, or erase all when given empty data).
export async function replaceAll(sessions, settings) {
  await tx("sessions", "readwrite", (s) => {
    s.clear();
    sessions.forEach((x) => s.put(x));
  });
  await tx("kv", "readwrite", (s) => s.clear());
  state.sessions = [...sessions];
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  state.active = null;
  await saveSettings();
}
