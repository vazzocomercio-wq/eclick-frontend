'use client'

/**
 * Vitrine de kits/combos — "Monte o ambiente" / "Complete o ambiente".
 *
 * Client component: busca os kits ATIVOS da loja no endpoint público
 * (`/public/store/by-slug/:slug/kits[...]`) e renderiza cards. Reusa o
 * módulo `kits` do backend (gerados por IA, curados pelo lojista).
 *
 * filter:
 *   - 'currentProduct' → kits que CONTÊM o produto da página atual (lê o id
 *      da URL /loja/<slug>/produto/<id>). É o bloco "Complete o ambiente".
 *   - 'all' | 'byType' | 'specific' → kits da loja (home, coleção, etc.).
 *
 * Botão "Adicionar o kit": mete os itens no carrinho com preço PROPORCIONAL
 * ao preço do kit (a economia some no checkout WhatsApp). Se não houver kit
 * disponível, a seção não renderiza nada (não polui a vitrine).
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, Check, ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/storefront/cart'
import { formatBRL } from '@/lib/storefront/data'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface PublicKitItem {
  productId: string
  name:      string
  imageUrl:  string | null
  qty:       number
  role:      string
  unitPrice: number
}
interface PublicKit {
  id:            string
  name:          string
  slug:          string | null
  description:   string | null
  coverImageUrl: string | null
  kitType:       string
  reasoning:     string | null
  items:         PublicKitItem[]
  itemsTotal:    number
  kitPrice:      number
  savings:       number
  discountPct:   number
}

export interface ProductKitsSettings {
  title?:        string
  subtitle?:     string
  filter:        'all' | 'byType' | 'specific' | 'currentProduct'
  kitTypes?:     string[]
  kitIds?:       string[]
  columns:       { mobile: 1 | 2; tablet: 2 | 3; desktop: 2 | 3 | 4 }
  limit:         number
  showReasoning: boolean
}

export function ProductKitsClient({ slug, settings }: { slug: string; settings: ProductKitsSettings }) {
  const [kits, setKits]       = useState<PublicKit[]>([])
  const [loading, setLoading] = useState(true)
  const [added, setAdded]     = useState<string | null>(null)
  const cart     = useCart(slug)
  const pathname = usePathname()

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const base = `${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}/kits`
        let url: string
        if (settings.filter === 'currentProduct') {
          const pid = pathname?.match(/\/produto\/([^/?#]+)/)?.[1]
          if (!pid) { if (!cancel) { setKits([]); setLoading(false) } return }
          url = `${base}/by-product/${encodeURIComponent(pid)}`
        } else {
          const params = new URLSearchParams()
          if (settings.filter === 'byType' && settings.kitTypes?.length) params.set('types', settings.kitTypes.join(','))
          if (settings.limit) params.set('limit', String(settings.limit))
          const qs = params.toString()
          url = qs ? `${base}?${qs}` : base
        }
        const res = await fetch(url)
        if (!res.ok) throw new Error('fetch')
        let data = (await res.json()) as PublicKit[]
        if (settings.filter === 'specific' && settings.kitIds?.length) {
          const set = new Set(settings.kitIds)
          data = data.filter(k => set.has(k.id))
        }
        if (settings.limit) data = data.slice(0, settings.limit)
        if (!cancel) setKits(Array.isArray(data) ? data : [])
      } catch {
        if (!cancel) setKits([])
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [slug, pathname, settings.filter, settings.kitTypes, settings.kitIds, settings.limit])

  if (loading || kits.length === 0) return null

  const addKit = (kit: PublicKit) => {
    // Preço proporcional: distribui o preço do kit entre os itens, então o
    // carrinho reflete a economia (vale pro checkout WhatsApp).
    const factor = kit.itemsTotal > 0 ? kit.kitPrice / kit.itemsTotal : 1
    for (const it of kit.items) {
      const price = Math.round(it.unitPrice * factor * 100) / 100
      cart.add({ productId: it.productId, name: it.name, price, imageUrl: it.imageUrl ?? undefined, kitId: kit.id }, it.qty)
    }
    setAdded(kit.id)
    window.setTimeout(() => setAdded(a => (a === kit.id ? null : a)), 2500)
    try {
      const w = window as unknown as { eclickTrack?: (t: string, p?: string, v?: number) => void }
      w.eclickTrack?.('add_to_cart', kit.items[0]?.productId, kit.kitPrice)
    } catch { /* ignore */ }
  }

  const title = settings.title?.trim()
    || (settings.filter === 'currentProduct' ? 'Complete o ambiente' : 'Monte o ambiente')
  const minW = settings.columns?.desktop === 2 ? 340 : settings.columns?.desktop === 4 ? 220 : 280

  return (
    <div className="container mx-auto px-4" style={{ fontFamily: 'var(--f-body)' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.75rem', lineHeight: 1.2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={20} style={{ color: 'var(--c-primary)' }} /> {title}
        </h2>
        {settings.subtitle && (
          <p style={{ color: 'var(--c-text-muted)', marginTop: 8, lineHeight: 1.6 }}>{settings.subtitle}</p>
        )}
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minW}px), 1fr))` }}>
        {kits.map(kit => (
          <article key={kit.id}
            style={{
              border: '1px solid var(--c-border, #27272a)', borderRadius: 'var(--r, 12px)',
              overflow: 'hidden', background: 'var(--c-surface, #111114)', display: 'flex', flexDirection: 'column',
            }}>
            {/* Thumbs dos itens */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--c-bg, #0a0a0e)' }}>
              {kit.items.slice(0, 3).map((it, i) => (
                <a key={i} href={`/loja/${slug}/produto/${it.productId}`}
                  style={{ flex: 1, aspectRatio: '1 / 1', display: 'block', overflow: 'hidden' }}>
                  {it.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={it.imageUrl} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-muted)', fontSize: 12 }}>sem foto</span>}
                </a>
              ))}
            </div>

            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <h3 style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.05rem', lineHeight: 1.3 }}>{kit.name}</h3>

              {/* Itens do kit */}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {kit.items.map((it, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>
                    <a href={`/loja/${slug}/produto/${it.productId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {it.qty > 1 ? `${it.qty}× ` : ''}{it.name}
                    </a>
                  </li>
                ))}
              </ul>

              {settings.showReasoning && kit.reasoning && (
                <p style={{ fontSize: 12.5, color: 'var(--c-text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  ✨ {kit.reasoning}
                </p>
              )}

              {/* Preço */}
              <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                {kit.savings > 0 && (
                  <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>
                    <span style={{ textDecoration: 'line-through' }}>{formatBRL(kit.itemsTotal)}</span>
                    <span style={{ color: '#22c55e', fontWeight: 600, marginLeft: 8 }}>−{kit.discountPct}%</span>
                  </div>
                )}
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--c-text)' }}>{formatBRL(kit.kitPrice)}</div>
                {kit.savings > 0 && (
                  <div style={{ fontSize: 12.5, color: '#22c55e' }}>Economize {formatBRL(kit.savings)} no kit</div>
                )}
              </div>

              <button onClick={() => addKit(kit)}
                style={{
                  marginTop: 6, width: '100%', minHeight: 46, padding: '12px 16px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: added === kit.id ? '#16a34a' : 'var(--c-primary)', color: 'var(--c-on-accent)',
                  border: 0, borderRadius: 'var(--r, 8px)', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                }}>
                {added === kit.id
                  ? <><Check size={16} /> Kit adicionado!</>
                  : <><ShoppingBag size={16} /> Adicionar o kit</>}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
