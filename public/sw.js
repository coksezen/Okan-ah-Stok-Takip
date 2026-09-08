const CACHE = 'okan-sah-stok-v3'

const START_FILES = [
  '/manifest.webmanifest',
  '/icon.svg'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(START_FILES))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request

  if(request.method !== 'GET') return

  const url = new URL(request.url)

  // Supabase ve diğer dış servisleri cache'e alma
  if(url.origin !== self.location.origin) return

  // Sayfa açılışlarında her zaman önce güncel sürümü dene.
  // İnternet yoksa son çalışan sayfayı cache'den aç.
  if(request.mode === 'navigate'){
    event.respondWith(
      fetch(request)
        .then(response => {
          if(response && response.ok){
            const copy = response.clone()
            caches.open(CACHE).then(cache => cache.put('/', copy))
          }
          return response
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Vite'ın hash'li JS/CSS dosyaları değişince isimleri de değişir.
  // Bu yüzden bunları hızlı açmak için cache kullanabiliriz.
  event.respondWith(
    caches.match(request).then(cached => {
      if(cached) return cached

      return fetch(request).then(response => {
        if(response && response.ok){
          const copy = response.clone()
          caches.open(CACHE).then(cache => cache.put(request, copy))
        }
        return response
      })
    })
  )
})

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {}

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Okan-Şah Gıda',
      {
        body: data.body || 'Yeni bir stok bildiriminiz var.',
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: data.data || {},
        tag: data.tag || undefined
      }
    )
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  event.waitUntil(
    clients
      .matchAll({
        type:'window',
        includeUncontrolled:true
      })
      .then(list => {
        for(const client of list){
          if('focus' in client){
            client.navigate('/?tab=expiry')
            return client.focus()
          }
        }

        if(clients.openWindow){
          return clients.openWindow('/?tab=expiry')
        }
      })
  )
})
