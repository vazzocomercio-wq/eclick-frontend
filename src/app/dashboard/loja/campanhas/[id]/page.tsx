'use client'

/**
 * Detalhe da Campanha — gerencia produtos atrelados, override individual,
 * aplica/desaplica.
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Megaphone, Loader2, ChevronLeft, Plus, X, Save, AlertCircle,
  Trash2, Sparkles, Package, Search, Check, Power, PowerOff,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Campaign {
  id:                   string
  name:                 string
  description:          string | null
  default_discount_pct: number
  badge_text:           string | null
  starts_at:            string | null
  ends_at:              string | null
  active:               boolean
  applied_at:           string | null
  applied_count:        number
}

interface CampaignProduct {
  id:                       string
  campaign_id:              string
  product_id:               string
  discount_pct_override:    number | null
  sale_price_override:      number | null
  added_at:                 string
  product?: { id: string; name: string; sku: string | null; price: number; photo_urls: string[] | null }
}

interface ProductLite {
  id:    string
  name:  string
  sku:   string | null
  price: number
  photo_urls: string[] | null
}

const brl = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function CampanhaDetalhePage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [products, setProducts] = useState<CampaignProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [applyResult, setApplyResult] = useState<string | null>(null)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { campaign: Campaign; products: CampaignProduct[] }
      setCampaign(data.campaign)
      setProducts(data.products ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchToken, id])

  useEffect(() => { void load() }, [load])

  const apply = async () => {
    setBusy(true); setError(null); setApplyResult(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config/campaigns/${id}/apply`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { updated: number; skipped: number }
      setApplyResult(`✓ ${data.updated} produto${data.updated === 1 ? '' : 's'} atualizado${data.updated === 1 ? '' : 's'}${data.skipped > 0 ? ` · ${data.skipped} ignorado${data.skipped === 1 ? '' : 's'}` : ''}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }

  const unapply = async () => {
    if (!confirm('Remover sale_price dos produtos desta campanha?')) return
    setBusy(true); setError(null); setApplyResult(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config/campaigns/${id}/unapply`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }

  const removeProduct = async (productId: string) => {
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config/campaigns/${id}/products/${productId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  const updateOverride = async (productId: string, override: { discount_pct_override?: number | null; sale_price_override?: number | null }) => {
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config/campaigns/${id}/products/${productId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(override),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  if (loading || !campaign) {
    return (
      <div className="p-6 text-center" style={{ color: '#a1a1aa' }}>
        <Loader2 className="animate-spin inline-block mr-2" size={16} /> Carregando…
      </div>
    )
  }

  const isApplied = Boolean(campaign.applied_at)

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">
      <div>
        <Link href="/dashboard/loja/campanhas" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pra lista
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-2xl sm:text-3xl font-semibold flex items-center gap-2">
              <Megaphone size={24} /> {campaign.name}
            </h1>
            {campaign.description && (
              <p className="text-xs text-zinc-500 mt-1">{campaign.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isApplied ? (
              <button onClick={unapply} disabled={busy}
                className="text-xs px-3 py-2 rounded font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', minHeight: 44 }}>
                <PowerOff size={12} /> Desaplicar
              </button>
            ) : null}
            <button onClick={apply} disabled={busy || products.length === 0 || !campaign.active}
              className="text-sm px-4 py-2 rounded font-semibold inline-flex items-center gap-2 disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isApplied ? 'Reaplicar' : 'Aplicar campanha'}
            </button>
          </div>
        </div>
        {!campaign.active && (
          <p className="text-xs mt-2" style={{ color: '#f59e0b' }}>
            ⚠ Campanha desativada — ative pra poder aplicar
          </p>
        )}
        {applyResult && (
          <p className="text-xs mt-2" style={{ color: '#22c55e' }}>{applyResult}</p>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Desconto padrão" value={`${campaign.default_discount_pct}%`} color="#22c55e" />
        <StatCard label="Produtos" value={String(products.length)} color="#fafafa" />
        <StatCard label="Badge" value={campaign.badge_text ?? '—'} color="#ef4444" />
        <StatCard label="Aplicada"
          value={isApplied ? new Date(campaign.applied_at!).toLocaleDateString('pt-BR') : 'não'}
          color={isApplied ? '#22c55e' : '#71717a'} />
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </p>
        </div>
      )}

      {/* Produtos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-100 flex items-center gap-2">
            <Package size={14} /> Produtos da campanha
          </h2>
          <button onClick={() => setShowPicker(true)}
            className="text-xs px-3 py-2 rounded font-medium inline-flex items-center gap-1"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 36 }}>
            <Plus size={12} /> Adicionar produtos
          </button>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-10 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
            <Package size={28} className="mx-auto text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">Nenhum produto na campanha</p>
            <button onClick={() => setShowPicker(true)}
              className="text-xs mt-3 px-3 py-1.5 rounded font-medium inline-flex items-center gap-1"
              style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 36 }}>
              <Plus size={12} /> Adicionar primeiro
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {products.map(cp => (
              <CampaignProductRow
                key={cp.id}
                cp={cp}
                defaultPct={campaign.default_discount_pct}
                onUpdate={(override) => updateOverride(cp.product_id, override)}
                onRemove={() => removeProduct(cp.product_id)}
              />
            ))}
          </ul>
        )}
      </div>

      {showPicker && (
        <ProductPickerModal
          existingProductIds={new Set(products.map(p => p.product_id))}
          onClose={() => setShowPicker(false)}
          onAdded={() => { setShowPicker(false); void load() }}
          campaignId={id}
          fetchToken={fetchToken}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded p-3" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <p className="text-[10px] text-zinc-500 uppercase">{label}</p>
      <p className="text-base font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}

function CampaignProductRow({ cp, defaultPct, onUpdate, onRemove }: {
  cp: CampaignProduct
  defaultPct: number
  onUpdate: (override: { discount_pct_override?: number | null; sale_price_override?: number | null }) => void
  onRemove: () => void
}) {
  const [overridePct, setOverridePct] = useState<string>(
    cp.discount_pct_override != null ? String(cp.discount_pct_override) : ''
  )
  const [saving, setSaving] = useState(false)

  if (!cp.product) {
    return (
      <li className="p-3 rounded text-xs text-zinc-500" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
        Produto removido do catálogo (id: {cp.product_id.slice(0, 8)})
      </li>
    )
  }

  const product = cp.product
  const img = Array.isArray(product.photo_urls) && product.photo_urls.length > 0 ? product.photo_urls[0] : null
  const effectivePct = cp.discount_pct_override ?? defaultPct
  const finalPrice = cp.sale_price_override ?? (product.price * (1 - effectivePct / 100))
  const isOverride = cp.discount_pct_override != null

  const saveOverride = async () => {
    setSaving(true)
    const num = overridePct.trim() === '' ? null : parseFloat(overridePct)
    if (num != null && (!Number.isFinite(num) || num <= 0 || num >= 100)) {
      setSaving(false)
      return
    }
    await onUpdate({ discount_pct_override: num })
    setSaving(false)
  }

  return (
    <li className="rounded-lg p-3 flex items-center gap-3"
      style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      {/* Thumb */}
      <div style={{ width: 48, height: 48, borderRadius: 4, overflow: 'hidden', background: '#18181b', flexShrink: 0 }}>
        {img
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={img} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div className="w-full h-full grid place-items-center text-zinc-700 text-[10px]">—</div>}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-100 line-clamp-1">{product.name}</p>
        <p className="text-[11px] text-zinc-500">
          {product.sku && <>SKU: {product.sku} · </>}
          <span className="line-through">{brl(product.price)}</span>
          {' → '}
          <span style={{ color: '#22c55e', fontWeight: 600 }}>{brl(finalPrice)}</span>
        </p>
      </div>

      {/* Override % */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-zinc-500">%</span>
        <input
          type="number" min="1" max="99" step="1"
          value={overridePct}
          onChange={e => setOverridePct(e.target.value)}
          onBlur={saveOverride}
          placeholder={String(defaultPct)}
          disabled={saving}
          className="w-16 text-sm text-center font-semibold rounded outline-none px-1 py-1"
          style={{
            background: '#09090b',
            color: isOverride ? '#a78bfa' : '#22c55e',
            border: `1px solid ${isOverride ? '#a78bfa' : '#27272a'}`,
            minHeight: 36,
          }}
          title={isOverride ? 'Override individual' : `Default da campanha: ${defaultPct}%`}
        />
      </div>

      <button onClick={onRemove}
        className="p-2 rounded hover:bg-zinc-800"
        style={{ minHeight: 36, minWidth: 36 }} title="Remover">
        <X size={14} style={{ color: '#ef4444' }} />
      </button>
    </li>
  )
}

function ProductPickerModal({ existingProductIds, onClose, onAdded, campaignId, fetchToken }: {
  existingProductIds: Set<string>
  onClose: () => void
  onAdded: () => void
  campaignId: string
  fetchToken: () => Promise<string | undefined>
}) {
  const [products, setProducts] = useState<ProductLite[]>([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('products')
          .select('id, name, sku, price, photo_urls')
          .eq('storefront_visible', true)
          .order('name')
          .limit(500)
        if (error) throw new Error(error.message)
        setProducts((data ?? []) as unknown as ProductLite[])
      } catch (e) { setErr((e as Error).message) }
      finally { setLoading(false) }
    })()
  }, [])

  const filtered = q.trim()
    ? products.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase()))
    : products

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev)
      const all = filtered.filter(p => !existingProductIds.has(p.id))
      const allSelected = all.every(p => next.has(p.id))
      if (allSelected) {
        for (const p of all) next.delete(p.id)
      } else {
        for (const p of all) next.add(p.id)
      }
      return next
    })
  }

  const add = async () => {
    if (selected.size === 0) return
    setSaving(true); setErr(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/store/config/campaigns/${campaignId}/products`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: [...selected] }),
      })
      if (!res.ok) throw new Error(await res.text())
      onAdded()
    } catch (e) {
      setErr((e as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl rounded-lg flex flex-col" style={{ background: '#09090b', border: '1px solid #27272a', maxHeight: '85vh' }}>
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: '#27272a' }}>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Adicionar produtos</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Selecione N produtos pra adicionar a esta campanha
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100" style={{ minHeight: 44, minWidth: 44 }}>
            <X size={20} />
          </button>
        </div>

        <div className="p-5 border-b space-y-3" style={{ borderColor: '#27272a' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar por nome ou SKU..."
              className="w-full text-sm pl-9 pr-3 py-2 rounded outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <button onClick={selectAllFiltered} className="text-cyan-400 hover:underline">
              Selecionar todos visíveis ({filtered.filter(p => !existingProductIds.has(p.id)).length})
            </button>
            <span className="text-zinc-500">{selected.size} selecionado{selected.size === 1 ? '' : 's'}</span>
          </div>
        </div>

        {err && (
          <div className="m-3 p-2.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}>
            {err}
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-3">
          {loading ? (
            <div className="text-center py-10 text-zinc-500">
              <Loader2 className="animate-spin inline-block" size={20} />
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map(p => {
                const already = existingProductIds.has(p.id)
                const isSelected = selected.has(p.id)
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => !already && toggle(p.id)}
                      disabled={already}
                      className="w-full text-left p-2 rounded flex items-center gap-3 transition-colors hover:bg-zinc-800/50 disabled:opacity-40"
                      style={{
                        background: isSelected ? 'rgba(0,229,255,0.08)' : 'transparent',
                        border: `1px solid ${isSelected ? '#00E5FF' : 'transparent'}`,
                      }}>
                      {already
                        ? <Check size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                        : <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4" style={{ accentColor: '#00E5FF' }} />}
                      {Array.isArray(p.photo_urls) && p.photo_urls[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_urls[0]} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-100 line-clamp-1">{p.name}</p>
                        <p className="text-[10px] text-zinc-500">
                          {p.sku && <>SKU: {p.sku} · </>}{brl(p.price)}
                          {already && ' · já na campanha'}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t" style={{ borderColor: '#27272a' }}>
          <div className="flex-1" />
          <button onClick={onClose} disabled={saving}
            className="text-sm px-4 py-2 rounded font-medium disabled:opacity-50"
            style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', minHeight: 44 }}>
            Cancelar
          </button>
          <button onClick={add} disabled={saving || selected.size === 0}
            className="text-sm px-4 py-2 rounded font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Adicionar {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
