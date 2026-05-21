'use client'

/**
 * AB1 — Tracker de carrinho abandonado.
 *
 * Pinga POST /public/store/by-slug/:slug/cart/track sempre que o
 * cliente identifica-se (logado, ou preencheu phone/email no checkout)
 * E tem items no carrinho. Backend persiste em whatsapp_carts e, se
 * o lojista habilitou recovery, dispara WhatsApp depois de N min.
 *
 * Debounce: 1.5s — evita flood ao digitar no telefone/email.
 *
 * Privacidade: só pinga quando há contato + items. Quando o cliente
 * limpa o carrinho ou desloga, o backend marca como dismissed.
 */

import { useEffect, useRef } from 'react'
import type { CartItem } from './cart'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface TrackInput {
  slug:     string
  items:    CartItem[]
  subtotal: number
  phone?:   string | null
  email?:   string | null
  name?:    string | null
  /** Customer logado (storefront_customers.id). Opcional. */
  customerId?: string | null
}

const DEBOUNCE_MS = 1500

/** Hook que envia ping debounced toda vez que items+contato mudam. */
export function useCartTracker(input: TrackInput): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSnapshotRef = useRef<string>('')

  useEffect(() => {
    const hasContact = !!(input.phone?.trim() || input.email?.trim() || input.customerId)
    if (!hasContact) return
    if (!input.items || input.items.length === 0) {
      // Carrinho vazio → manda 1 ping pra backend marcar como dismissed
      // (mas só se já chegamos a mandar algo antes nessa sessão).
      if (lastSnapshotRef.current) {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { void sendPing({ ...input, items: [] }) }, DEBOUNCE_MS)
      }
      return
    }

    // Skip se o snapshot é idêntico ao último (evita spam ao re-render)
    const snapshot = JSON.stringify({
      i: input.items.map(it => ({ p: it.productId, q: it.qty })),
      c: { p: input.phone?.trim() ?? null, e: input.email?.trim().toLowerCase() ?? null },
    })
    if (snapshot === lastSnapshotRef.current) return
    lastSnapshotRef.current = snapshot

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void sendPing(input) }, DEBOUNCE_MS)

    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [
    input.slug,
    input.subtotal,
    input.phone,
    input.email,
    input.name,
    input.customerId,
    // items: usa o length + a soma dos productIds pra detectar mudança
    input.items.length,
    input.items.map(i => `${i.productId}:${i.qty}`).join('|'),
  ])
}

async function sendPing(input: TrackInput): Promise<void> {
  try {
    await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(input.slug)}/cart/track`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        customer_id: input.customerId ?? null,
        phone:       input.phone ?? null,
        email:       input.email ?? null,
        name:        input.name ?? null,
        items:       input.items,
        subtotal:    input.subtotal,
      }),
      // Não esperamos resposta — não falha silenciosamente
      keepalive: true,
    })
  } catch {
    // silent: tracking é best-effort
  }
}
