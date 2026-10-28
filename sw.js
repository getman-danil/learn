/* Офлайн-режим: сначала сеть (чтобы новые уроки появлялись сразу), без сети — сохранённая копия. */
const CACHE = "learn-v1";
const SHELL = [
  "./",
  "index.html",
  "lesson.html",
  "manifest.webmanifest",
  "assets/style.css",
  "assets/app.js",
  "assets/home.js",
  "assets/blocks.js",
  "assets/lesson.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "lessons/catalog.json"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Шрифты Google: из кэша, в фоне обновляем.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  // Свои файлы: сначала сеть, без сети — кэш. lesson.html?id=… отдаём из одной копии lesson.html.
  e.respondWith(
    fetch(req)
      .then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return r;
      })
      .catch(async () => {
        const c = await caches.open(CACHE);
        return (await c.match(req)) ||
          (await c.match(req, { ignoreSearch: true })) ||
          (req.mode === "navigate" ? c.match("index.html") : Response.error());
      })
  );
});
