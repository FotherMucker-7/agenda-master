const CACHE_VERSION = 'v2';
const CACHE_NAME = `agenda-master-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Recursos estáticos para cachear inmediatamente
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json'
];

// Recursos externos (Google Fonts)
const GOOGLE_FONTS = [
    'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

// Instalación: Cachear recursos estáticos
self.addEventListener('install', event => {
    console.log('[SW] Instalando Service Worker v2...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Cacheando archivos estáticos');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting()) // Activar inmediatamente
    );
});

// Activación: Limpiar caches antiguos
self.addEventListener('activate', event => {
    console.log('[SW] Activando Service Worker v2...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && cacheName !== RUNTIME_CACHE) {
                        console.log('[SW] Eliminando cache antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Estrategias de cache
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Estrategia 1: Google Fonts - Cache First con Network Fallback
    if (url.origin === 'https://fonts.googleapis.com' ||
        url.origin === 'https://fonts.gstatic.com') {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) {
                    return cached;
                }
                return fetch(request).then(response => {
                    return caches.open(RUNTIME_CACHE).then(cache => {
                        cache.put(request, response.clone());
                        return response;
                    });
                }).catch(() => {
                    // Fallback: devolver desde cache aunque esté desactualizado
                    return caches.match(request);
                });
            })
        );
        return;
    }

    // Estrategia 2: Archivos locales - Cache First, Network Fallback
    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(request).then(cached => {
                return cached || fetch(request).then(response => {
                    return caches.open(RUNTIME_CACHE).then(cache => {
                        cache.put(request, response.clone());
                        return response;
                    });
                });
            })
        );
        return;
    }

    // Estrategia 3: Recursos externos - Network First, Cache Fallback
    event.respondWith(
        fetch(request)
            .then(response => {
                // Si la respuesta es válida, cachearla
                if (response && response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(RUNTIME_CACHE).then(cache => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla la red, intentar servir desde cache
                return caches.match(request);
            })
    );
});

// Pre-cachear Google Fonts en background
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CACHE_FONTS') {
        event.waitUntil(
            caches.open(RUNTIME_CACHE).then(cache => {
                return cache.addAll(GOOGLE_FONTS).catch(err => {
                    console.log('[SW] Error cacheando fuentes:', err);
                });
            })
        );
    }
});