/**
 * Carrinho client-side da Loja Propria.
 *
 * Persiste em localStorage por slug — cada loja tem seu carrinho isolado.
 * Sem backend nesta fase: o checkout abre wa.me com a mensagem formatada
 * pro lojista. Quando entrar pagamento integrado, esse modulo evolui pra
 * snapshot no DB antes do redirect pro gateway.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatBRL, whatsappLink } from './data'

export interface CartItem {
  productId: string
  name:      string
  price:     number   // preco unitario
  qty:       number
  imageUrl?: string
}

const KEY = (slug: string) => `eclick-cart:${slug}`

function read(slug: string): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY(slug))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isItem)
  } catch {
    return []
  }
}

function write(slug: string, items: CartItem[]) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(KEY(slug), JSON.stringify(items)) } catch { /* quota */ }
  // Avisa outras abas / outros hooks no mesmo documento
  try { window.dispatchEvent(new CustomEvent('eclick-cart-change', { detail: { slug } })) } catch { /* ignore */ }
}

function isItem(x: unknown): x is CartItem {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.productId === 'string'
      && typeof o.name === 'string'
      && typeof o.price === 'number'
      && typeof o.qty === 'number'
}

export interface UseCartApi {
  items:        CartItem[]
  count:        number   // soma de qty
  subtotal:     number   // soma de price*qty
  add:          (item: Omit<CartItem, 'qty'>, qty?: number) => void
  setQty:       (productId: string, qty: number) => void
  remove:       (productId: string) => void
  clear:        () => void
  checkoutMsg:  (storeName: string) => string
  checkoutLink: (storeName: string, whatsappNumber: string | null) => string | null
}

/** Hook reativo do carrinho — sincroniza entre abas e componentes. */
export function useCart(slug: string): UseCartApi {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    setItems(read(slug))
    const handler = (e: Event) => {
      // Eventos do storage (outra aba) ou do custom event (mesma aba)
      const ev = e as CustomEvent<{ slug: string }> | StorageEvent
      const isStorage = 'key' in ev
      if (isStorage) {
        if (ev.key && ev.key !== KEY(slug)) return
      } else {
        if (ev.detail?.slug && ev.detail.slug !== slug) return
      }
      setItems(read(slug))
    }
    window.addEventListener('storage', handler)
    window.addEventListener('eclick-cart-change', handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('eclick-cart-change', handler)
    }
  }, [slug])

  const persist = useCallback((next: CartItem[]) => {
    setItems(next)
    write(slug, next)
  }, [slug])

  const add = useCallback((item: Omit<CartItem, 'qty'>, qty = 1) => {
    const current = read(slug)
    const idx = current.findIndex(i => i.productId === item.productId)
    if (idx >= 0) {
      const next = current.map((i, k) => k === idx ? { ...i, qty: i.qty + qty } : i)
      persist(next)
    } else {
      persist([...current, { ...item, qty }])
    }
  }, [slug, persist])

  const setQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      persist(read(slug).filter(i => i.productId !== productId))
      return
    }
    persist(read(slug).map(i => i.productId === productId ? { ...i, qty } : i))
  }, [slug, persist])

  const remove = useCallback((productId: string) => {
    persist(read(slug).filter(i => i.productId !== productId))
  }, [slug, persist])

  const clear = useCallback(() => { persist([]) }, [persist])

  const count    = items.reduce((s, i) => s + i.qty, 0)
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0)

  const checkoutMsg = useCallback((storeName: string) => {
    const lines = items.map((i, n) =>
      `${n + 1}. ${i.name} — ${i.qty} × ${formatBRL(i.price)} = ${formatBRL(i.qty * i.price)}`,
    )
    return [
      `Olá! Tenho interesse em finalizar uma compra na loja "${storeName}":`,
      '',
      ...lines,
      '',
      `Total: ${formatBRL(subtotal)}`,
    ].join('\n')
  }, [items, subtotal])

  const checkoutLink = useCallback((storeName: string, whatsappNumber: string | null) => {
    if (!whatsappNumber || items.length === 0) return null
    return whatsappLink(whatsappNumber, checkoutMsg(storeName))
  }, [items.length, checkoutMsg])

  return { items, count, subtotal, add, setQty, remove, clear, checkoutMsg, checkoutLink }
}
