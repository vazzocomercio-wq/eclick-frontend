'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Heart, ChevronLeft, ShoppingBag } from 'lucide-react'
import {
  fetchCurrentCustomer, fetchMyWishlist, removeFromWishlist,
} from '@/lib/storefront/customer-auth'

interface WishProduct {
  id: string
  name: string
  price: number
  sale_price: number | null
  sale_start_at: string | null
  sale_end_at:   string | null
  sale_badge_text: string | null
  photo_urls: string[] | null
  category: string | null
  brand: string | null
  stock: number | null
  ai_short_description: string | null
}

const brl = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Calcula preço efetivo (sale ativa?) — usado no card.
function getEffectivePrice(p: WishProduct, now = Date.now()): { price: number; effective: number; onSale: boolean; pct: number } {
  const price = Number(p.price ?? 0)
  const sale  = p.sale_price != null ? Number(p.sale_price) : null
  if (sale == null || sale <= 0 || sale >= price) return { price, effective: price, onSale: false, pct: 0 }
  if (p.sale_start_at && now < Date.parse(p.sale_start_at)) return { price, effective: price, onSale: false, pct: 0 }
  if (p.sale_end_at   && now > Date.parse(p.sale_end_at))   return { price, effective: price, onSale: false, pct: 0 }
  return {
    price, effective: sale, onSale: true,
    pct: Math.round(((price - sale) / price) * 100),
  }
}

export function FavoritosClient({ slug, storeName }: { slug: string; storeName: string }) {
  const router = useRouter()
  const [products, setProducts] = useState<WishProduct[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const cur = await fetchCurrentCustomer(slug)
    if (!cur) {
      router.push(`/loja/${slug}/conta/entrar`)
      return
    }
    const list = await fetchMyWishlist(slug)
    setProducts(list as unknown as WishProduct[])
    setLoading(false)
  }, [slug, router])

  useEffect(() => { void load() }, [load])

  const remove = async (productId: string) => {
    // Optimistic remove
    setProducts(prev => prev.filter(p => p.id !== productId))
    await removeFromWishlist(slug, productId)
  }

  if (loading) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--c-text-muted)' }}>
        <Loader2 className="animate-spin inline-block" size={24} />
      </div>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href={`/loja/${slug}/conta`} className="text-xs hover:underline inline-flex items-center gap-1"
          style={{ color: 'var(--c-text-muted)' }}>
          <ChevronLeft size={12} /> Voltar pra minha conta
        </Link>
        <Link href={`/loja/${slug}`}
          className="text-xs px-3 py-2 rounded inline-flex items-center gap-1.5"
          style={{ background: 'var(--c-surface)', color: 'var(--c-text-muted)', border: '1px solid var(--c-border)', minHeight: 36 }}>
          <ShoppingBag size={12} /> Ver loja
        </Link>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3"
          style={{ color: 'var(--c-text)', fontFamily: 'var(--f-heading)' }}>
          <Heart size={28} style={{ color: '#ef4444' }} fill="#ef4444" />
          Meus favoritos
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--c-text-muted)' }}>
          {products.length === 0
            ? 'Sua lista de favoritos está vazia'
            : `${products.length} produto${products.length === 1 ? '' : 's'} salvo${products.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl p-12 text-center"
          style={{ background: 'var(--c-surface)', border: '1px dashed var(--c-border)' }}>
          <Heart size={48} className="mx-auto mb-3" style={{ color: 'var(--c-text-muted)', opacity: 0.4 }} />
          <p className="text-sm mb-3" style={{ color: 'var(--c-text-muted)' }}>
            Quando você marcar um produto como favorito (♥), ele aparece aqui
          </p>
          <Link href={`/loja/${slug}`}
            className="inline-block mt-2 px-5 py-2.5 text-sm font-semibold"
            style={{
              background: 'var(--c-primary)', color: 'var(--c-on-accent, #000)',
              borderRadius: 'var(--r)', minHeight: 44,
            }}>
            Ver produtos
          </Link>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {products.map(p => {
            const price = getEffectivePrice(p)
            const img = Array.isArray(p.photo_urls) && p.photo_urls.length > 0 ? p.photo_urls[0] : null
            return (
              <div key={p.id} className="rounded-lg overflow-hidden transition-all"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                <Link href={`/loja/${slug}/produto/${p.id}`}>
                  <div style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', background: 'var(--c-bg)' }}>
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {price.onSale && (
                      <span style={{
                        position: 'absolute', top: 8, left: 8,
                        padding: '4px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
                        background: '#ef4444', color: '#fff',
                        borderRadius: 'var(--r)', textTransform: 'uppercase',
                      }}>
                        {p.sale_badge_text ?? `OFERTA -${price.pct}%`}
                      </span>
                    )}
                  </div>
                </Link>
                <div className="p-3 space-y-2">
                  {p.category && (
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>{p.category}</p>
                  )}
                  <Link href={`/loja/${slug}/produto/${p.id}`}
                    className="block text-sm font-medium line-clamp-2 hover:underline"
                    style={{ color: 'var(--c-text)' }}>
                    {p.name}
                  </Link>
                  <div>
                    {price.onSale && (
                      <p className="text-xs line-through" style={{ color: 'var(--c-text-muted)' }}>{brl(price.price)}</p>
                    )}
                    <p className="text-base font-bold" style={{ color: 'var(--c-primary)' }}>
                      {brl(price.effective)}
                    </p>
                  </div>
                  <button onClick={() => remove(p.id)}
                    className="w-full text-xs px-3 py-2 rounded inline-flex items-center justify-center gap-1.5 transition-colors"
                    style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', minHeight: 36 }}>
                    <Heart size={12} fill="#ef4444" /> Remover dos favoritos
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-center pt-6" style={{ color: 'var(--c-text-muted)' }}>
        {storeName} · Sua lista de desejos
      </p>
    </main>
  )
}
