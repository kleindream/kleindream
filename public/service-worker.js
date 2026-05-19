const CACHE_NAME = "klein-dream-static-v3";

// Cache só de arquivos estáticos. Nunca cachear /login, /home, perfil, sessão ou HTML.
const STATIC_ASSETS = [
  "/manifest.json",
  "/style.css",
  "/kd.js",
  "/gtalk-mini.css",
  "/gtalk-mini.js",
  "/img/favicon.png",
  "/img/sr-disquete.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => key !== CACHE_NAME ? caches.delete(key) : Promise.resolve())
    ))
  );
  self.clients.claim();
});

function shouldBypass(request) {
  if (request.method !== "GET") return true;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return true;

  // Navegação/HTML sempre na rede para não quebrar login no Chrome.
  if (request.mode === "navigate") return true;

  const path = url.pathname;
  if (
    path === "/" ||
    path === "/login" ||
    path === "/register" ||
    path === "/logout" ||
    path === "/home" ||
    path.startsWith("/profile") ||
    path.startsWith("/u/") ||
    path.startsWith("/api/") ||
    path.startsWith("/socket.io/")
  ) return true;

  return false;
}

self.addEventListener("fetch", (event) => {
  if (shouldBypass(event.request)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
