// Which screen is showing. Each view renders into #view and may return a cleanup function.
export const route = { tab: "workout", sub: null, param: null };

const views = {};
let cleanup = null;

export function registerViews(map) {
  Object.assign(views, map);
}

// anim: "forward" (new page slides in from the right), "back" (page slides away to the
// right), "fade" (tab switches and returns), or null (instant).
export function navigate(tab, sub = null, param = null, anim = null) {
  Object.assign(route, { tab, sub, param });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ghost = anim && !reduce ? snapshot() : null;
  render();
  if (ghost) animate(ghost, anim);
}

export function render() {
  if (cleanup) { cleanup(); cleanup = null; }
  document.querySelectorAll(".scrim, .toast").forEach((el) => el.remove());
  document.querySelectorAll("#nav button").forEach((b) => {
    if (b.dataset.tab === route.tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  const view = document.getElementById("view");
  view.onclick = view.oninput = view.onchange = null;
  cleanup = views[route.tab](view, route) || null;
}

// ---------- Page transitions ----------

// A frozen copy of the current page, laid over the exact same spot, to animate away.
function snapshot() {
  document.querySelectorAll(".page-ghost").forEach((g) => g.remove());
  const view = document.getElementById("view");
  const r = view.getBoundingClientRect();
  const ghost = view.cloneNode(true);
  ghost.removeAttribute("id");
  ghost.className = "page-ghost";
  ghost.setAttribute("aria-hidden", "true");
  ghost.inert = true;
  Object.assign(ghost.style, { top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
  const from = view.querySelectorAll(".scroll");
  document.body.appendChild(ghost);
  ghost.querySelectorAll(".scroll").forEach((s, i) => { s.scrollTop = from[i]?.scrollTop ?? 0; });
  return ghost;
}

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

function animate(ghost, anim) {
  const view = document.getElementById("view");
  let a, b;
  if (anim === "forward") {
    // New page comes in from the right over the old one, which drifts left.
    ghost.style.zIndex = 4;
    view.style.zIndex = 5;
    a = ghost.animate([{ transform: "none" }, { transform: "translateX(-30%)", opacity: 0.6 }], { duration: 320, easing: EASE });
    b = view.animate([{ transform: "translateX(100%)", boxShadow: "-8px 0 24px rgba(0,0,0,.12)" }, { transform: "none", boxShadow: "-8px 0 24px rgba(0,0,0,0)" }], { duration: 320, easing: EASE });
  } else if (anim === "back") {
    // Old page slides away to the right, revealing the page underneath.
    ghost.style.zIndex = 6;
    a = ghost.animate([{ transform: "none", boxShadow: "-8px 0 24px rgba(0,0,0,.12)" }, { transform: "translateX(100%)", boxShadow: "-8px 0 24px rgba(0,0,0,0)" }], { duration: 300, easing: EASE });
    b = view.animate([{ transform: "translateX(-30%)", opacity: 0.6 }, { transform: "none", opacity: 1 }], { duration: 300, easing: EASE });
  } else {
    ghost.style.zIndex = 6;
    a = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-out" });
    b = null;
  }
  a.onfinish = a.oncancel = () => { ghost.remove(); view.style.zIndex = ""; };
  if (b) b.onfinish = () => { view.style.zIndex = ""; };
}
