// Which screen is showing. Each view renders into #view and may return a cleanup function.
export const route = { tab: "workout", sub: null, param: null };

const views = {};
let cleanup = null;

export function registerViews(map) {
  Object.assign(views, map);
}

export function navigate(tab, sub = null, param = null) {
  Object.assign(route, { tab, sub, param });
  render();
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
