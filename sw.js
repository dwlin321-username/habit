// Service Worker：在背景把 App 的檔案存到手機裡，讓 App 沒網路也能打開。
// 每次更新 App 時，把 VERSION 改掉，手機就會下載新版本。
const VERSION = 'v2.0.0';
const CACHE = `ypym-app-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/data.js',
  './js/stage3d.js',
  './js/lowpoly.js',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/three/three.module.min.js',
  './vendor/three/environments/RoomEnvironment.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    // 只刪除舊版 App 檔案；動物縮圖（ypym-thumbs-*）保留
    await Promise.all(keys.filter((k) => k.startsWith('ypym-app-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return fetch(req);
  })());
});
