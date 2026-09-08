const CACHE = 'stokcep-v2'

const START_FILES = [
  '/',
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
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request

  if(request.method !== 'GET') return

  const url = new URL(request.url)

  // Supabase ve diğer dış servisleri cache'e karıştırma
  if(url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(request).then(cached => {

      const networkRequest = fetch(request)
        .then(response => {
          if(response && response.ok){
            const copy = response.clone()

            caches.open(CACHE).then(cache => {
              cache.put(request, copy)
            })
          }

          return response
        })
        .catch(() => cached || caches.match('/'))

      // Daha önce varsa anında cache'den aç,
      // arkada güncel sürümü indir
      return cached || networkRequest
    })
  )
})

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {}

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'StokCep',
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
