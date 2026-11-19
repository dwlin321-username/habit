// Service Worker：在背景把 App 的檔案存到手機裡，讓 App 沒網路也能打開。
// 有網路時一律先抓網站上最新的檔案（網路優先），沒網路才用手機裡存的版本。
// 新版本會自動安裝、自動切換，不需要使用者按「更新」。
const VERSION = 'v2.2.0';
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
  self.skipWaiting(); // 不等舊版關掉，直接換成新版
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
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

// 網路優先：抓得到最新檔案就用最新的並順便存起來；4 秒內沒回應或沒網路，才用手機裡存的
function fromNetwork(req) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 4000);
    fetch(req, { cache: 'no-cache' }).then((res) => { clearTimeout(timer); resolve(res); }, (err) => { clearTimeout(timer); reject(err); });
  });
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fromNetwork(req);
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
