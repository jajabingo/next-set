// Offline support and manual updates (PRD 12).
//
// The service worker serves the app from a cache on the phone, so nothing updates on its
// own: new app files are only downloaded when you tap "Check for updates", which is the
// app's only network request. Its fetches use no-store / reload, which sw.js passes
// straight to the network instead of answering from the cache.
import { APP_VERSION } from "./version.js";

export const CACHE = "next-set-app";
const isLocalDev = ["localhost", "127.0.0.1"].includes(location.hostname);

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || isLocalDev) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Returns the new version number, or null if already up to date.
export async function checkForUpdates() {
  const info = await (await fetch("version.json", { cache: "no-store" })).json();
  if (info.version === APP_VERSION) return null;

  // Download everything into a staging cache first, so a dropped connection can't leave a half-updated app.
  const staging = await caches.open(CACHE + "-staging");
  for (const f of info.files) {
    const res = await fetch(f, { cache: "reload" });
    if (!res.ok) throw new Error(`Couldn't download ${f}`);
    await staging.put(f, res);
  }
  const live = await caches.open(CACHE);
  for (const req of await staging.keys()) await live.put(req, await staging.match(req));
  await caches.delete(CACHE + "-staging");
  return info.version;
}
