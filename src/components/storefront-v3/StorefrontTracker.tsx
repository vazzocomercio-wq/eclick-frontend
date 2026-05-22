'use client'

/**
 * AI — Tracker de eventos da vitrine (beacon fire-and-forget).
 *
 * Dispara page_view (sempre) + product_view (página de produto) + begin_checkout
 * (página de checkout). Carrinho dispara add_to_cart via window.eclickTrack().
 * purchase NÃO vem daqui — é derivado de storefront_orders no backend.
 *
 * Sessão anônima em localStorage (sem PII). Origem: utm_source → referrer → direto.
 */

import { useEffect } from 'react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface TrackEvent { type: string; productId?: string; value?: number; source?: string; meta?: Record<string, unknown> }

function sessionId(): string {
  try {
    let s = localStorage.getItem('eclick_sf_sid')
    if (!s) {
      s = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
      localStorage.setItem('eclick_sf_sid', s)
    }
    return s
  } catch { return 'anon' }
}

function detectSource(): string {
  try {
    const p = new URLSearchParams(window.location.search)
    const utm = p.get('utm_source')
    if (utm) return utm.slice(0, 60)
    if (document.referrer) {
      const h = new URL(document.referrer).host
      if (h && h !== window.location.host) return h.slice(0, 60)
    }
    return 'direto'
  } catch { return 'direto' }
}

function send(slug: string, events: TrackEvent[]) {
  if (!events.length) return
  const body = JSON.stringify({ slug, sessionId: sessionId(), events })
  const url = `${BACKEND}/storefront/events/track`
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      return
    }
  } catch { /* fallthrough */ }
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

interface TrackerWindow extends Window { eclickTrack?: (type: string, productId?: string, value?: number) => void }

export function StorefrontTracker({ slug, page, productId }: { slug: string; page: string; productId?: string }) {
  useEffect(() => {
    const events: TrackEvent[] = [{ type: 'page_view', source: detectSource(), meta: { page } }]
    if (page === 'product' && productId) events.push({ type: 'product_view', productId, source: detectSource() })
    if (page === 'checkout') events.push({ type: 'begin_checkout', source: detectSource() })
    send(slug, events)

    // Helper global pro carrinho disparar add_to_cart / begin_checkout
    const w = window as TrackerWindow
    w.eclickTrack = (type: string, pid?: string, value?: number) =>
      send(slug, [{ type, productId: pid, value, source: detectSource() }])
    return () => { if (w.eclickTrack) delete w.eclickTrack }
  }, [slug, page, productId])

  return null
}
