/* e-Click Fulfillment — service worker offline-first.
 *
 * Estratégia:
 *  - App shell (rotas + ícone + logo) pré-cacheado no install (tolerante a falha).
 *  - Navegações: network-first com fallback pro cache (carrega offline).
 *  - Assets estáticos (_next/static, imagens): cache-first (preenche em runtime).
 *  - Mutações (POST/PUT) NÃO são tocadas — a fila offline do app (outbox)
 *    cuida de reenviar quando a conexão volta.
 */
const CACHE = 'eclick-fulfillment-v1'
const SHELL = [
  '/fulfillment',
  '/fulfillment/picking',
  '/fulfillment/packing',
  '/fulfillment-manifest.webmanifest',
  '/fulfillment-icon.svg',
  '/logo.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // tolerante: se 1 url falhar, não derruba o install inteiro
      Promise.all(SHELL.map((u) => fetch(u, { credentials: 'same-origin' })
        .then((res) => (res.ok ? cache.put(u, res) : undefined))
        .catch(() => undefined))),
    ).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // mutações passam direto (sem cache)

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // só same-origin

  // Navegações → network-first, fallback cache (ou o shell base)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/fulfillment'))),
    )
    return
  }

  // Assets → cache-first
  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
        }
        return res
      }).catch(() => cached),
    ),
  )
})
