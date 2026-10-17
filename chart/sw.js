// 상담차트를 아이패드에 저장해 두고, 인터넷이 없어도 열리게 함 (있으면 새 버전을 받아 둠)
const C = 'we4d-chart-v1';
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.add('./'))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(C).then(c => c.put("./", copy)); } return r; }).catch(() => caches.match('./')));
});
