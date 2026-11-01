// Serves the app from the phone's cache so it works with no connection.
// This file should never need to change: updates are pulled in from the app's Settings
// ("Check for updates"), not by the browser.
const CACHE = "next-set-app";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    if ((await cache.keys()).length) return; // already installed
    const info = await (await fetch("version.json", { cache: "reload" })).json();
    await cache.addAll(info.files.map((f) => new Request(f, { cache: "reload" })));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request))
  );
});
