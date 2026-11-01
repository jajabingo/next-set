// Which screen is showing. Each view renders into #view and may return a cleanup function.
export const route = { tab: "workout", sub: null, param: null };

const views = {};
let cleanup = null;

export function registerViews(map) {
  Object.assign(views, map);
}

export function navigate(tab, sub = null, param = null) {
  Object.assign(route, { tab, sub, param });
  window.scrollTo(0, 0);
  render();
}

export function render() {
  if (cleanup) { cleanup(); cleanup = null; }
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === route.tab));
  const view = document.getElementById("view");
  view.onclick = view.oninput = view.onchange = null;
  cleanup = views[route.tab](view, route) || null;
}
