/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

// --- Offline app shell ------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// Single-page app: every navigation serves index.html from the cache.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

self.skipWaiting()
clientsClaim()

// --- Push notifications (M09) -------------------------------------------------
// The server (Supabase Edge Function `send-reminders`) sends a JSON payload:
// { title, body, url?, tag? }
interface PushPayload {
  title: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let data: PushPayload = { title: 'Personaire' }
  try {
    if (event.data) data = event.data.json() as PushPayload
  } catch {
    data = { title: 'Personaire', body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: data.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await (client as WindowClient).navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
