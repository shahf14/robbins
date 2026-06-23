const SHELL_CACHE = 'robbins-app-shell-v2';
const API_CACHE = 'robbins-app-api-v1';
const ACTIVE_CACHES = [SHELL_CACHE, API_CACHE];

const SHELL_URLS = ['/he', '/en', '/icon.svg', '/manifest.webmanifest'];

const OFFLINE_API_BODY = JSON.stringify({
  error: 'offline',
  offline: true,
});

function offlineApiResponse() {
  return new Response(OFFLINE_API_BODY, {
    status: 503,
    headers: {'Content-Type': 'application/json'},
  });
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function shouldCacheApiGet(url) {
  if (!url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/api/log')) return false;
  if (url.pathname.startsWith('/api/auth/session')) return false;
  return true;
}

async function networkFirstApi(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineApiResponse();
  }
}

async function networkOnlyApi(request) {
  try {
    return await fetch(request);
  } catch {
    return offlineApiResponse();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !ACTIVE_CACHES.includes(key)).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (isApiRequest(url)) {
    if (request.method === 'GET' && shouldCacheApiGet(url)) {
      event.respondWith(networkFirstApi(request));
      return;
    }

    event.respondWith(networkOnlyApi(request));
    return;
  }

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const pathname = url.pathname;
        const locale = pathname.startsWith('/en') ? '/en' : '/he';
        const cached = await caches.match(locale);
        if (cached) return cached;
        return caches.match('/he');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request);
    })
  );
});
