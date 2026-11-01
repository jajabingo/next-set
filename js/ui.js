// Shared building blocks for every screen: icons, rows, fields, buttons, sheets and toasts.
// Each builder returns an HTML string; screens wire up taps with data-act attributes.
import { esc, fmtDate } from "./util.js";

const PATHS = {
  workout: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  skip: '<path d="M5 5l10 7-10 7z"/><path d="M19 5v14"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  go: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.75 2.75L16 10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
};
const SOLID = {
  play: '<path d="M8 5l11 7-11 7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
};

export function icon(name, size = 20, extra = "") {
  const solid = name in SOLID;
  return `<svg class="i${solid ? " solid" : ""}${extra ? " " + extra : ""}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${solid ? SOLID[name] : PATHS[name]}</svg>`;
}

const STATUS = { completed: "Completed", stopped: "Stopped", skipped: "Skipped" };

export function badge(status, withLabel = false) {
  const glyph = status === "completed" ? `<svg class="i" width="12" height="12" viewBox="0 0 24 24" stroke-width="3" aria-hidden="true">${PATHS.check}</svg>`
    : status === "stopped" ? icon("square", 12)
    : `<svg class="i" width="12" height="12" viewBox="0 0 24 24" stroke-width="2.75" aria-hidden="true">${PATHS.skip}</svg>`;
  const b = `<span class="badge ${status}" role="img" aria-label="${STATUS[status]}">${glyph}</span>`;
  return withLabel ? `<span class="badge-wrap">${b}<span aria-hidden="true">${STATUS[status]}</span></span>` : b;
}

export function header(title, { back = "", status = "" } = {}) {
  return `<header class="header"><div class="header-bar">
      ${back ? `<button class="back" data-act="back">${icon("back", 22)}<span>${esc(back)}</span></button>` : ""}
      ${status ? badge(status, true) : ""}
    </div><h1>${esc(title)}</h1></header>`;
}

export function section(text, { aside = "", divider = false } = {}) {
  return `<div class="section${divider ? " divider" : ""}"><h2>${esc(text)}</h2>${aside ? `<span>${esc(aside)}</span>` : ""}</div>`;
}

// A list row. With `act` or `id` it is a tappable button with a chevron; otherwise static.
export function row({ title, sub = "", status = "", trail = "", act = "", id = "" }) {
  const meta = sub || status
    ? `<span class="row-sub">${status ? badge(status) : ""}<span>${esc(sub)}</span></span>` : "";
  const inner = `<span class="row-main"><span class="row-title">${esc(title)}</span>${meta}</span>
    ${trail ? `<span class="row-trail">${esc(trail)}</span>` : ""}`;
  const cls = `row${meta ? " two" : ""}`;
  if (act || id) {
    return `<button class="${cls}" ${act ? `data-act="${act}"` : ""} ${id ? `data-id="${id}"` : ""}>${inner}${icon("chev", 18, "chev")}</button>`;
  }
  return `<div class="${cls}">${inner}</div>`;
}

export function btn(label, act, { kind = "", xl = false, disabled = false } = {}) {
  const cls = ["btn", kind && `btn-${kind}`, xl && "btn-xl"].filter(Boolean).join(" ");
  return `<button class="${cls}" data-act="${act}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
}

export function ibtn(name, label, act, { kind = "", lg = false, disabled = false } = {}) {
  const cls = ["ibtn", kind, lg && "lg"].filter(Boolean).join(" ");
  return `<button class="${cls}" data-act="${act}" aria-label="${esc(label)}" ${disabled ? "disabled" : ""}>${icon(name, lg ? 28 : 20)}</button>`;
}

const helperHtml = (h) => (h ? `<p class="helper">${esc(h)}</p>` : "");

export function inputField({ id, label, value = "", suffix = "", mode = "decimal", attrs = "", helper = "" }) {
  return `<div class="field"><label for="${id}">${esc(label)}</label>
    <div class="box"><input id="${id}" type="text" inputmode="${mode}" autocomplete="off" value="${esc(value)}" ${attrs}>
    ${suffix ? `<span class="suffix">${esc(suffix)}</span>` : ""}</div>${helperHtml(helper)}</div>`;
}

export function selectField({ id, label, options, value, helper = "" }) {
  return `<div class="field"><label for="${id}">${esc(label)}</label>
    <div class="box"><select id="${id}">${options.map((o) => `<option value="${esc(o.value)}" ${o.value === value ? "selected" : ""}>${esc(o.text)}</option>`).join("")}</select>
    ${icon("down", 18, "end-icon")}</div>${helperHtml(helper)}</div>`;
}

// Two-option segmented control. Taps arrive as data-act="seg" with data-seg / data-value.
export function segField({ id, label, options, value, helper = "", hideLabel = false }) {
  return `<div class="field">${hideLabel ? "" : `<span class="label" id="${id}-l">${esc(label)}</span>`}
    <div class="seg" role="radiogroup" ${hideLabel ? `aria-label="${esc(label)}"` : `aria-labelledby="${id}-l"`}>
    ${options.map((o) => `<button role="radio" aria-checked="${o.value === value}" data-act="seg" data-seg="${id}" data-value="${esc(o.value)}">${esc(o.text)}</button>`).join("")}
    </div>${helperHtml(helper)}</div>`;
}

export function toggleField({ id, label, on }) {
  return `<div class="field"><div class="toggle-row"><label for="${id}">${esc(label)}</label>
    <button id="${id}" class="switch" role="switch" aria-checked="${on}" data-act="toggle"></button></div></div>`;
}

export function choiceField({ name, label, options, value, helper = "" }) {
  return `<div class="field"><div class="choices" role="radiogroup" aria-label="${esc(label)}">
    ${options.map((o) => `<button class="choice" role="radio" aria-checked="${o.value === value}" data-act="choice" data-choice="${name}" data-value="${esc(o.value)}"><span class="dot" aria-hidden="true"></span><span>${esc(o.text)}</span></button>`).join("")}
    </div>${helperHtml(helper)}</div>`;
}

// A date picker that looks like the other fields; the native picker opens on tap.
export function dateField({ id, label, value, helper = "" }) {
  return `<div class="field"><label class="box date" aria-label="${esc(label)}">
    <span data-date-text="${id}">${esc(fmtDate(value))}</span>${icon("calendar")}
    <input id="${id}" type="date" value="${esc(value)}" required></label>${helperHtml(helper)}</div>`;
}

// Keep a date field's visible text in step with its picker.
export function syncDate(input) {
  const label = document.querySelector(`[data-date-text="${input.id}"]`);
  if (label && input.value) label.textContent = fmtDate(input.value);
}

export function textareaField({ id, label, value = "" }) {
  return `<div class="field"><textarea id="${id}" aria-label="${esc(label)}" rows="4">${esc(value)}</textarea></div>`;
}

// ---------- Sheets (replace confirm / alert / prompt) ----------
// tone: "destructive" (Keep is primary, confirm is red), "neutral" (confirm is primary),
// "alert" (one OK button). With `prompt`, the confirm button waits for that word.
// Resolves true when confirmed.
export function sheet({ title, body = "", confirm = "", keep = "Cancel", tone = "destructive", prompt = "" }) {
  return new Promise((resolve) => {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    const keepBtn = (primary) => `<button class="btn ${primary ? "btn-primary btn-xl" : ""}" data-r="0">${esc(keep)}</button>`;
    const okBtn = (primary) => `<button class="btn ${primary ? "btn-primary btn-xl" : "btn-danger"}" data-r="1" ${prompt ? "disabled" : ""}>${esc(confirm)}</button>`;
    const actions = tone === "alert" ? keepBtn(true)
      : tone === "neutral" ? okBtn(true) + `<button class="btn" data-r="0">${esc(keep)}</button>`
      : keepBtn(true) + okBtn(false);
    scrim.innerHTML = `<section class="sheet" role="${tone === "alert" ? "alertdialog" : "dialog"}" aria-modal="true" aria-labelledby="sheet-t">
      <div class="grabber" aria-hidden="true"></div>
      <div><h2 id="sheet-t">${esc(title)}</h2>${body ? `<p class="sheet-body">${esc(body)}</p>` : ""}</div>
      ${prompt ? `<div class="field"><label for="sheet-word">Type ${esc(prompt)} to confirm</label>
        <div class="box"><input id="sheet-word" type="text" autocomplete="off" autocapitalize="characters" placeholder="${esc(prompt)}"></div></div>` : ""}
      <div class="sheet-actions">${actions}</div></section>`;
    const close = (result) => { scrim.remove(); resolve(result); };
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) return close(false);
      const r = e.target.closest("[data-r]");
      if (r && !r.disabled) close(r.dataset.r === "1");
    });
    if (prompt) {
      scrim.querySelector("#sheet-word").addEventListener("input", (e) => {
        scrim.querySelector('[data-r="1"]').disabled = e.target.value.trim().toUpperCase() !== prompt.toUpperCase();
      });
    }
    document.body.appendChild(scrim);
  });
}

export const alertSheet = (title, body = "") => sheet({ title, body, keep: "OK", tone: "alert" });

// ---------- Toast ----------
// Sits 16 pt above the highest pinned bar (action bar or tab bar).
export function toast(message, kind = "check") {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.innerHTML = `${icon(kind === "info" ? "info" : "checkCircle", 20)}<span>${esc(message)}</span>`;
  const bars = [...document.querySelectorAll("#nav, #view .actionbar, #view .controls")];
  const top = Math.min(...bars.map((b) => b.getBoundingClientRect().top), innerHeight);
  el.style.bottom = `${innerHeight - top + 16}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
