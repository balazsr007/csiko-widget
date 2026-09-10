// Csiko Widget - Service Worker
// Feladata: 1) offline mukodes (alap fajlok gyorsitotarazasa)
//           2) push-ertesitesek fogadasa es megjelenitese
//           3) ertesitesre kattintas kezelese (app megnyitasa/fokuszalasa)

const CACHE_NAME = "csiko-widget-v1";
const CORE_FILES = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./kancaregiszter.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Offline-first: elobb a cache-bol, ha nincs ott, halozatrol
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// --- PUSH ERTESITES FOGADASA ---
// Ide fog erkezni a hattersz erver altal kuldott push uzenet, amikor
// a Raspberry Pi jelzi, hogy megindult az elles.
self.addEventListener("push", (event) => {
  let data = { title: "Csiko Widget", body: "Uj ertesites erkezett." };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const title = data.title || "Csiko Widget";
  const options = {
    body: data.body || "",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    vibrate: [200, 100, 200, 100, 200, 100, 400], // hatarozott, ismetlodo minta - elles-riasztashoz
    requireInteraction: true, // ne tunjon el magatol, amig a felhasznalo nem reagal
    tag: data.tag || "csiko-alert",
    data: { url: data.url || "./index.html" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// --- ERTESITESRE KATTINTAS: nyissa meg / hozza elore az appot ---
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./index.html";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("index.html") && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
