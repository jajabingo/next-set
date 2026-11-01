export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Local calendar date as YYYY-MM-DD.
export function toISODate(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// Seconds as m:ss.
export function fmtClock(sec) {
  sec = Math.max(0, sec);
  return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
}

// Milliseconds as m:ss, or h:mm:ss once past an hour.
export function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function fmtWeight(w, units) {
  return w == null ? "—" : `${w} ${units}`;
}

export function parseWeight(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
