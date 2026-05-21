'use client'

/**
 * Promoções por produto — admin UI.
 *
 * Lista produtos com filtros (ativa / agendada / expirada / sem) e
 * permite setar sale_price + janela + badge_text inline ou em modal.
 *
 * Backend:
 *   GET   /store/config/promotions?filter=...&q=...&limit=...&offset=...
 *   PATCH /store/config/promotions/:productId
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Tag, Loader2, ChevronLeft, Search, X, Save, AlertCircle, Calendar } from 'lucide-react'
import Link from 'next/link'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Product {
  id:               string
  name:             string
  sku:              string | null
  price:            number
  sale_price:       number | null
  sale_start_at:    string | null
  sale_end_at:      string | null
  sale_badge_text:  string | null
  photo_urls:       string[] | null
  stock:            number | null
  storefront_visible: boolean
  category:         string | null
  effective_price?: number
  on_sale?:         boolean
  discount_pct?:    number
  has_sale_set?:    boolean
}

type Filter = 'all' | 'active' | 'scheduled' | 'expired' | 'none'

const FILTER_LABELS: Record<Filter, string> = {
  all:       'Todos',
  active:    'Ativa agora',
  scheduled: 'Agendada',
  expired:   'Expirada',
  none:      'Sem promoção',
}

const FILTER_COLORS: Record<Filter, string> = {
  all:       '#a1a1aa',
  active:    '#22c55e',
  scheduled: '#3b82f6',
  expired:   '#f59e0b',
  none:      '#71717a',
}

const brl = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PromocoesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await fetchToken()
      const params = new URLSearchParams({ filter, limit: '50' })
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`${BACKEND}/store/config/promotions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProducts(data.products ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchToken, filter, q])

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
          <Tag size={24} /> Promoções por produto
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Desconto direto no produto · janela opcional · badge "OFERTA" automático na vitrine
        </p>
      </div>

      {/* Filtros + busca */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{
              background: filter === f ? FILTER_COLORS[f] : '#0a0a0e',
              color:      filter === f ? '#0a0a0e' : '#fafafa',
              border:     `1px solid ${filter === f ? FILTER_COLORS[f] : '#27272a'}`,
              minHeight: 36,
            }}>
            {FILTER_LABELS[f]}
          </button>
        ))}
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nome ou SKU…"
            className="w-full text-sm pl-9 pr-3 py-2 rounded-lg outline-none"
            style={{
              background: '#0a0a0e', color: '#fafafa',
              border: '1px solid #27272a', minHeight: 36,
            }}
          />
        </div>
        <span className="text-xs text-zinc-500 ml-auto">
          {loading ? '…' : `${total} produto${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500">
          <Loader2 className="animate-spin inline-block" size={20} />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <Tag size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">
            {filter === 'none' ? 'Todos os produtos têm promoção setada' : 'Nenhum produto encontrado'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {products.map(p => (
            <ProductRow key={p.id} product={p} onEdit={() => setEditing(p)} />
          ))}
        </div>
      )}

      {editing && (
        <PromotionModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load() }}
          fetchToken={fetchToken}
        />
      )}
    </div>
  )
}

function ProductRow({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const img = Array.isArray(product.photo_urls) && product.photo_urls.length > 0 ? product.photo_urls[0] : null
  const onSale = Boolean(product.on_sale)
  const now = Date.now()
  const startMs = product.sale_start_at ? Date.parse(product.sale_start_at) : 0
  const endMs   = product.sale_end_at   ? Date.parse(product.sale_end_at)   : 0
  const scheduled = !onSale && product.sale_price != null && startMs > 0 && Number.isFinite(startMs) && startMs > now
  const expired   = !onSale && product.sale_price != null && endMs > 0 && Number.isFinite(endMs) && endMs < now

  let badge: { label: string; color: string } | null = null
  if (onSale)        badge = { label: `Ativa -${product.discount_pct ?? 0}%`, color: '#22c55e' }
  else if (scheduled) badge = { label: 'Agendada', color: '#3b82f6' }
  else if (expired)   badge = { label: 'Expirada', color: '#f59e0b' }

  return (
    <button
      onClick={onEdit}
      className="text-left rounded-lg overflow-hidden transition-all hover:border-cyan-400/50"
      style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <div className="flex gap-3 p-3">
        <div className="flex-shrink-0" style={{ width: 64, height: 64, borderRadius: 6, overflow: 'hidden', background: '#18181b' }}>
          {img
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={img} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div className="w-full h-full grid place-items-center text-zinc-700 text-xs">sem foto</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm text-zinc-100 line-clamp-2">{product.name}</p>
            {badge && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase whitespace-nowrap flex-shrink-0"
                style={{ background: `${badge.color}20`, color: badge.color, border: `1px solid ${badge.color}40` }}>
                {badge.label}
              </span>
            )}
          </div>
          {product.sku && <p className="text-[10px] text-zinc-600 mb-1">SKU: {product.sku}</p>}
          <div className="text-xs">
            {onSale ? (
              <span>
                <span className="text-zinc-500 line-through">{brl(product.price)}</span>
                {' '}
                <span className="font-semibold" style={{ color: '#22c55e' }}>{brl(Number(product.effective_price ?? product.price))}</span>
              </span>
            ) : (
              <span className="text-zinc-300 font-medium">{brl(product.price)}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function PromotionModal({ product, onClose, onSaved, fetchToken }: {
  product: Product; onClose: () => void; onSaved: () => void
  fetchToken: () => Promise<string | undefined>
}) {
  const [salePrice, setSalePrice] = useState<string>(
    product.sale_price != null ? String(product.sale_price) : ''
  )
  const [startAt, setStartAt] = useState<string>(
    product.sale_start_at ? product.sale_start_at.slice(0, 16) : ''
  )
  const [endAt, setEndAt] = useState<string>(
    product.sale_end_at ? product.sale_end_at.slice(0, 16) : ''
  )
  const [badgeText, setBadgeText] = useState<string>(product.sale_badge_text ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const salePriceNum = salePrice ? parseFloat(salePrice) : null
  const valid = salePriceNum == null || (salePriceNum > 0 && salePriceNum < product.price)
  const discountPct = salePriceNum != null && salePriceNum > 0 && salePriceNum < product.price
    ? Math.round(((product.price - salePriceNum) / product.price) * 100)
    : 0

  const save = async (clearAll = false) => {
    setSaving(true)
    setErr(null)
    try {
      const token = await fetchToken()
      const body = clearAll
        ? { sale_price: null, sale_start_at: null, sale_end_at: null, sale_badge_text: null }
        : {
            sale_price:      salePriceNum,
            sale_start_at:   startAt ? new Date(startAt).toISOString() : null,
            sale_end_at:     endAt   ? new Date(endAt).toISOString()   : null,
            sale_badge_text: badgeText.trim() || null,
          }
      const res = await fetch(`${BACKEND}/store/config/promotions/${product.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-lg p-5 max-h-[90vh] overflow-y-auto" style={{ background: '#09090b', border: '1px solid #27272a' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Editar promoção</h2>
            <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100" style={{ minHeight: 44, minWidth: 44 }}>
            <X size={20} />
          </button>
        </div>

        {err && (
          <div className="mb-4 p-2.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
            {err}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Preço normal</label>
            <div className="text-sm text-zinc-300 font-mono">{brl(product.price)}</div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Desconto <span className="text-zinc-600">(deixe em branco pra remover promoção)</span>
            </label>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-zinc-600 mb-1">Preço promocional</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">R$</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={salePrice}
                    onChange={e => {
                      setSalePrice(e.target.value)
                    }}
                    placeholder="Ex: 60,00"
                    className="w-full text-sm pl-9 pr-3 py-2 rounded outline-none"
                    style={{ background: '#0a0a0e', color: '#fafafa', border: `1px solid ${!valid ? '#ef4444' : '#27272a'}`, minHeight: 44 }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-zinc-600 mb-1">% Desconto</label>
                <div className="relative">
                  <input
                    type="number" step="1" min="0" max="99"
                    value={discountPct || ''}
                    onChange={e => {
                      const pct = parseFloat(e.target.value)
                      if (!Number.isFinite(pct) || pct <= 0) {
                        setSalePrice('')
                      } else {
                        const newPrice = product.price * (1 - Math.min(99, pct) / 100)
                        // 2 casas, mas evita "63.4399999"
                        setSalePrice((Math.round(newPrice * 100) / 100).toFixed(2))
                      }
                    }}
                    placeholder="Ex: 20"
                    className="w-full text-sm pl-3 pr-8 py-2 rounded outline-none text-center font-semibold"
                    style={{ background: '#0a0a0e', color: '#22c55e', border: `1px solid ${!valid ? '#ef4444' : '#27272a'}`, minHeight: 44 }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
                </div>
              </div>
            </div>
            {!valid && (
              <p className="text-[11px] text-red-400 mt-1">Preço promocional deve ser maior que 0 e menor que {brl(product.price)}</p>
            )}
            {valid && discountPct > 0 && (
              <p className="text-[11px] mt-1" style={{ color: '#22c55e' }}>
                Economia de {brl(product.price - (salePriceNum ?? 0))}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                <Calendar size={11} className="inline mr-1" /> Início <span className="text-zinc-600">(opcional)</span>
              </label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={e => setStartAt(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                <Calendar size={11} className="inline mr-1" /> Fim <span className="text-zinc-600">(opcional)</span>
              </label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={e => setEndAt(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded outline-none"
                style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Texto do badge <span className="text-zinc-600">(opcional — auto se vazio)</span>
            </label>
            <input
              value={badgeText}
              onChange={e => setBadgeText(e.target.value)}
              placeholder='Ex: "BLACK FRIDAY", "LIQUIDA"'
              maxLength={20}
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          {product.has_sale_set && (
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="text-sm px-3 py-2 rounded font-medium disabled:opacity-50"
              style={{ background: 'transparent', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', minHeight: 44 }}>
              Remover promoção
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={saving}
            className="text-sm px-4 py-2 rounded font-medium disabled:opacity-50"
            style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', minHeight: 44 }}>
            Cancelar
          </button>
          <button
            onClick={() => save(false)}
            disabled={saving || !valid}
            className="text-sm px-4 py-2 rounded font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
