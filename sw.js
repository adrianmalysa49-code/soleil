// Soleil — Service Worker
// Pozwala aplikacji działać offline i być instalowaną jako PWA

const CACHE_NAME = 'soleil-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalacja — zapisz pliki w cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Aktywacja — usuń stary cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — serwuj z cache jeśli offline, w innym razie z sieci
self.addEventListener('fetch', (event) => {
  // Nie cachuj zapytań do API Anthropic
  if (event.request.url.includes('api.anthropic.com')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
