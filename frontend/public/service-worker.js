// Service Worker for PWA functionality with version control
const CACHE_NAME = 'diabexpert-v1';
const VERSION_URL = '/version.json';
let CURRENT_VERSION = null;

const urlsToCache = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
  // NOTE: version.json is INTENTIONALLY EXCLUDED to prevent caching
];

// Fetch and check version
async function checkVersion() {
  try {
    const response = await fetch(VERSION_URL, { cache: 'no-store' });
    const versionData = await response.json();
    return versionData.version;
  } catch (error) {
    console.error('[SW] Failed to fetch version:', error);
    return null;
  }
}

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => {
      console.log('[SW] Deleting cache:', cacheName);
      return caches.delete(cacheName);
    })
  );
}

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new service worker');
  event.waitUntil(
    (async () => {
      // Get current version
      const version = await checkVersion();
      CURRENT_VERSION = version;
      console.log('[SW] Current version:', version);
      
      // Open cache and add assets
      const cache = await caches.open(CACHE_NAME);
      console.log('[SW] Opened cache');
      
      try {
        await cache.addAll(urlsToCache);
        console.log('[SW] Assets cached');
      } catch (error) {
        console.error('[SW] Cache failed:', error);
      }
    })()
  );
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // CRITICAL: NEVER cache version.json - always fetch fresh from network
  if (event.request.url.includes('/version.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => {
          // If network fails, return a default version
          return new Response(JSON.stringify({ version: '0.0.0' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(() => {
          // Return offline page if available
          return caches.match('/index.html');
        });
      })
  );
});

// Activate event - check version and delete old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    (async () => {
      // Fetch current version
      const newVersion = await checkVersion();
      console.log('[SW] New version:', newVersion);
      
      // Get stored version from cache
      const cache = await caches.open(CACHE_NAME);
      const versionResponse = await cache.match(VERSION_URL);
      let oldVersion = null;
      
      if (versionResponse) {
        try {
          const versionData = await versionResponse.json();
          oldVersion = versionData.version;
          console.log('[SW] Old version:', oldVersion);
        } catch (e) {
          console.error('[SW] Failed to parse old version:', e);
        }
      }
      
      // If version changed, clear all caches
      if (oldVersion && newVersion && oldVersion !== newVersion) {
        console.log('[SW] Version changed! Clearing all caches...');
        await clearAllCaches();
        
        // Notify all clients about version change
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'VERSION_CHANGED',
            oldVersion,
            newVersion
          });
        });
      } else {
        // Delete only old caches, keep current one
        const cacheWhitelist = [CACHE_NAME];
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }
      
      // Take control of all pages
      await self.clients.claim();
      console.log('[SW] Service worker activated');
    })()
  );
});

// NOTE: Web push notification handlers have been REMOVED
// Native Android apps must use native Firebase Cloud Messaging (FCM) only
// Mixing web push logic with native FCM causes token generation to stall/timeout
// This service worker now handles PWA caching ONLY (for web browser usage)
// Push notifications on native Android are handled by @capacitor-firebase/messaging
