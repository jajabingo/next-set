// Serves the app from the phone's cache so it works with no connection.
// App files are only replaced from the app's Settings ("Check for updates"), never by the
// browser on its own.
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
  const req = event.request;
  if (req.method !== "GET") return;
  // "Check for updates" asks for fresh copies; those must come from the network, not this cache.
  if (req.cache === "no-store" || req.cache === "reload") return;
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
