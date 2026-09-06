const CACHE = 'stokcep-v1';
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/','/manifest.webmanifest','/icon.svg']))));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('/'))));
});
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(data.title || 'StokCep', {
    body: data.body || 'Yeni bir stok bildiriminiz var.',
    icon: '/icon.svg', badge: '/icon.svg', data: data.data || {}, tag: data.tag || undefined
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate('/?tab=expiry'); return c.focus(); } }
    if (clients.openWindow) return clients.openWindow('/?tab=expiry');
  }));
});
