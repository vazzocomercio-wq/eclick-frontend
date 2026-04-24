'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type VinculoRow = {
  id: string
  listing_id: string
  platform: string
  account_id: string | null
  quantity_per_unit: number
  variation_id: string | null
  listing_title: string | null
  listing_price: number | null
  listing_thumbnail: string | null
  is_active: boolean
}

type StockRow = {
  id: string
  quantity: number
  platform: string | null
  account_id: string | null
}

type ProductRow = {
  id: string
  name: string
  sku: string | null
  cost_price: number | null
  photo_urls: string[] | null
  product_listings: VinculoRow[]
  product_stock: StockRow[]
}

type Movement = {
  id: string
  type: string
  quantity: number
  reason: string | null
  created_at: string
}

type Toast  = { id: number; msg: string; type: 'success' | 'error' | 'info' }
type Filter = 'all' | 'vinculado' | 'sem_vinculo' | 'kit' | 'variacao'
type PlatformFilter = 'all' | 'mercadolivre' | 'shopee' | 'amazon' | 'magalu'

type PreviewData = {
  id: string; title: string; price: number
  available_quantity: number; thumbnail: string | null; permalink: string; status: string
}

// ── Config ────────────────────────────────────────────────────────────────────

const PLATFORM_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  mercadolivre: { label: 'ML',     color: '#00E5FF', bg: 'rgba(0,229,255,0.1)'  },
  shopee:       { label: 'Shopee', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  amazon:       { label: 'Amazon', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  magalu:       { label: 'Magalu', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
}

const MOV_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  in:         { label: 'Entrada',    color: '#4ade80' },
  out:        { label: 'Saída',      color: '#f87171' },
  adjustment: { label: 'Ajuste',     color: '#fbbf24' },
  sale:       { label: 'Venda',      color: '#f87171' },
  return:     { label: 'Devolução',  color: '#4ade80' },
  transfer:   { label: 'Transfer.',  color: '#a78bfa' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number) => v.toLocaleString('pt-BR')

function parseMlbId(input: string): string | null {
  const m = input.match(/MLB-?(\d{6,})/i)
  return m ? `MLB${m[1]}` : null
}

function vinculoBadge(v: VinculoRow) {
  if (v.variation_id)        return { label: 'Variação',           color: '#00E5FF', bg: 'rgba(0,229,255,0.1)'     }
  if (v.quantity_per_unit > 1) return { label: `Kit ×${v.quantity_per_unit}`, color: '#a78bfa', bg: 'rgba(167,139,250,0.1)'  }
  return                            { label: 'Simples',             color: '#52525b', bg: 'rgba(82,82,91,0.12)'      }
}

function fmtMovDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toasts({ list }: { list: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {list.map(t => (
        <div key={t.id} className="px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
          style={{
            background: t.type === 'error' ? '#1f0d0d' : '#111114',
            border: `1px solid ${t.type === 'error' ? 'rgba(248,113,113,.3)' : t.type === 'success' ? 'rgba(34,197,94,.3)' : 'rgba(0,229,255,.2)'}`,
            color: t.type === 'error' ? '#f87171' : t.type === 'success' ? '#4ade80' : '#00E5FF',
          }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-zinc-600 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Add Vínculo Modal ─────────────────────────────────────────────────────────

function AddVinculoModal({
  productId, productName, defaultQty,
  onClose, onSaved, getHeaders,
}: {
  productId: string; productName: string; defaultQty?: number
  onClose: () => void; onSaved: (v: VinculoRow) => void
  getHeaders: () => Promise<Record<string, string>>
}) {
  const [input,       setInput]       = useState('')
  const [previewing,  setPreviewing]  = useState(false)
  const [preview,     setPreview]     = useState<PreviewData | null>(null)
  const [previewErr,  setPreviewErr]  = useState<string | null>(null)
  const [qty,         setQty]         = useState(String(defaultQty ?? 1))
  const [variationId, setVariationId] = useState('')
  const [accountId,   setAccountId]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function buscar() {
    const mlbId = parseMlbId(input)
    if (!mlbId) { setPreviewErr('ID inválido — use o formato MLB1234567 ou cole a URL do anúncio'); return }
    setPreviewing(true); setPreviewErr(null); setPreview(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/vinculos/preview?listing_id=${mlbId}`, { headers })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? `HTTP ${res.status}`) }
      setPreview(await res.json())
    } catch (e: unknown) {
      setPreviewErr(e instanceof Error ? e.message : 'Erro ao buscar anúncio')
    } finally { setPreviewing(false) }
  }

  async function handleSave() {
    if (!preview) return
    setSaving(true); setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/products/vinculos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id:        productId,
          platform:          'mercadolivre',
          listing_id:        preview.id,
          quantity_per_unit: Number(qty) || 1,
          variation_id:      variationId.trim() || null,
          account_id:        accountId.trim()   || null,
          listing_title:     preview.title,
          listing_price:     preview.price,
          listing_thumbnail: preview.thumbnail,
          listing_permalink: preview.permalink,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
      onSaved(data as VinculoRow)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao vincular')
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none transition-colors focus:border-[#00E5FF] placeholder-zinc-600'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.75)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: '#111114', border: '1px solid #27272a' }}>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div>
            <h2 className="text-white text-sm font-semibold">Vincular Anúncio</h2>
            <p className="text-zinc-500 text-[11px] mt-0.5 truncate max-w-[300px]">{productName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* MLB input */}
          <div>
            <label className={lbl}>ID ou URL do anúncio</label>
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
                placeholder="MLB1234567 ou https://www.mercadolivre.com.br/..."
                className={inp + ' flex-1'} />
              <button onClick={buscar} disabled={!input.trim() || previewing}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50 shrink-0"
                style={{ background: '#00E5FF', color: '#000' }}>
                {previewing ? '…' : 'Buscar'}
              </button>
            </div>
            {previewErr && <p className="text-[11px] text-red-400 mt-1">{previewErr}</p>}
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-xl p-3 flex gap-3" style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>
              {preview.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.thumbnail} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" style={{ border: '1px solid #27272a' }} />
              )}
              <div className="min-w-0">
                <p className="text-zinc-100 text-xs font-medium line-clamp-2 leading-snug">{preview.title}</p>
                <p className="text-[#00E5FF] font-semibold text-sm mt-1">{brl(preview.price)}</p>
                <p className="text-zinc-500 text-[10px] mt-0.5">
                  Estoque: {preview.available_quantity} · {preview.id}
                  {preview.status !== 'active' && (
                    <span className="ml-1 text-yellow-400">({preview.status})</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Quantidade por anúncio</label>
              <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} className={inp} />
              <p className="text-[10px] text-zinc-600 mt-1">
                {Number(qty) > 1 ? `Kit: ${qty} unidades por venda` : 'Venda individual'}
              </p>
            </div>
            <div>
              <label className={lbl}>Variação (opcional)</label>
              <input value={variationId} onChange={e => setVariationId(e.target.value)}
                placeholder="Branco, 42, M..." className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Conta (opcional)</label>
              <input value={accountId} onChange={e => setAccountId(e.target.value)}
                placeholder="VAZZO, IRIS_ECOMMERCE..." className={inp} />
            </div>
          </div>

          {error && <p className="text-[11px] text-red-400 bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
            style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!preview || saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving ? 'Vinculando…' : 'Vincular →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stock Panel ───────────────────────────────────────────────────────────────

function StockPanel({
  product, onClose, getHeaders, onUpdated,
}: {
  product: ProductRow; onClose: () => void
  getHeaders: () => Promise<Record<string, string>>
  onUpdated: (productId: string, newQty: number) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [movements,  setMovements]  = useState<Movement[]>([])
  const [movLoading, setMovLoading] = useState(true)
  const [adjForm,    setAdjForm]    = useState(false)
  const [adjType,    setAdjType]    = useState<'in' | 'out' | 'adjustment'>('adjustment')
  const [adjQty,     setAdjQty]     = useState('')
  const [adjReason,  setAdjReason]  = useState('')
  const [adjSaving,  setAdjSaving]  = useState(false)
  const [adjError,   setAdjError]   = useState<string | null>(null)

  const sharedStock = product.product_stock.find(s => s.platform === null) ?? null
  const currentQty  = sharedStock?.quantity ?? 0

  useEffect(() => {
    setMovLoading(true)
    supabase
      .from('stock_movements')
      .select('id, type, quantity, reason, created_at')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { setMovements((data ?? []) as Movement[]); setMovLoading(false) })
  }, [product.id, supabase])

  async function handleAdjust() {
    const qty = parseInt(adjQty, 10)
    if (isNaN(qty) || qty <= 0) { setAdjError('Informe uma quantidade válida'); return }
    setAdjSaving(true); setAdjError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/products/stock/movement`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, type: adjType, quantity: qty, reason: adjReason || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
      const newQty = adjType === 'adjustment' ? qty : adjType === 'in' ? currentQty + qty : Math.max(0, currentQty - qty)
      onUpdated(product.id, newQty)
      // Refresh movements
      const { data: mvs } = await supabase.from('stock_movements').select('id, type, quantity, reason, created_at')
        .eq('product_id', product.id).order('created_at', { ascending: false }).limit(10)
      setMovements((mvs ?? []) as Movement[])
      setAdjForm(false); setAdjQty(''); setAdjReason('')
    } catch (e: unknown) {
      setAdjError(e instanceof Error ? e.message : 'Erro ao ajustar')
    } finally { setAdjSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-50 flex flex-col w-full max-w-sm overflow-hidden"
        style={{ background: '#111114', borderLeft: '1px solid #1e1e24' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div>
            <h2 className="text-white text-sm font-semibold">Estoque</h2>
            <p className="text-zinc-500 text-[11px] truncate max-w-[220px]">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Current stock */}
          <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Estoque Atual</p>
            {product.product_stock.length === 0 ? (
              <p className="text-zinc-600 text-xs">Nenhum registro de estoque</p>
            ) : (
              <div className="space-y-2">
                {product.product_stock.map(s => (
                  <div key={s.id} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">
                      {s.platform ? `${s.platform}${s.account_id ? ` · ${s.account_id}` : ''}` : 'Compartilhado'}
                    </span>
                    <span className="text-sm font-bold text-white tabular-nums">{num(s.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adjust button */}
          {!adjForm ? (
            <button onClick={() => setAdjForm(true)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
              Ajustar estoque manualmente
            </button>
          ) : (
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Ajuste Manual</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(['adjustment', 'in', 'out'] as const).map(t => (
                  <button key={t} onClick={() => setAdjType(t)}
                    className="py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={{
                      background: adjType === t ? (t === 'in' ? 'rgba(74,222,128,0.1)' : t === 'out' ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)') : '#111114',
                      color:      adjType === t ? (t === 'in' ? '#4ade80'              : t === 'out' ? '#f87171'             : '#fbbf24')             : '#71717a',
                      border:     `1px solid ${adjType === t ? (t === 'in' ? 'rgba(74,222,128,0.3)' : t === 'out' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)') : '#27272a'}`,
                    }}>
                    {t === 'adjustment' ? 'Ajuste' : t === 'in' ? 'Entrada' : 'Saída'}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">
                  {adjType === 'adjustment' ? 'Nova quantidade total' : 'Quantidade'}
                </label>
                <input type="number" min={1} value={adjQty} onChange={e => setAdjQty(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]" />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">Motivo (opcional)</label>
                <input value={adjReason} onChange={e => setAdjReason(e.target.value)}
                  placeholder="Contagem física, quebra, etc."
                  className="w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]" />
              </div>
              {adjError && <p className="text-[11px] text-red-400">{adjError}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setAdjForm(false); setAdjError(null) }}
                  className="flex-1 py-2 rounded-lg text-xs text-zinc-400 transition-colors hover:text-white"
                  style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
                  Cancelar
                </button>
                <button onClick={handleAdjust} disabled={adjSaving || !adjQty}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: '#00E5FF', color: '#000' }}>
                  {adjSaving ? 'Salvando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {/* Movement history */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Últimas Movimentações</p>
            {movLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1a1f' }} />)}
              </div>
            ) : movements.length === 0 ? (
              <p className="text-zinc-600 text-xs py-2">Nenhuma movimentação registrada</p>
            ) : (
              <div className="space-y-1.5">
                {movements.map(mv => {
                  const t = MOV_TYPE_LABEL[mv.type] ?? { label: mv.type, color: '#71717a' }
                  const sign = mv.type === 'in' || mv.type === 'return' ? '+' : mv.type === 'adjustment' ? '→' : '-'
                  return (
                    <div key={mv.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: t.color, background: `${t.color}15` }}>{t.label}</span>
                      <span className="flex-1 text-[11px] text-zinc-500 truncate">{mv.reason ?? '—'}</span>
                      <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: t.color }}>
                        {sign}{num(mv.quantity)}
                      </span>
                      <span className="text-[10px] text-zinc-600 shrink-0">{fmtMovDate(mv.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({
  product, onAddVinculo, onAddKit, onStockPanel, onRemoveVinculo,
}: {
  product: ProductRow
  onAddVinculo: (p: ProductRow) => void
  onAddKit:     (p: ProductRow) => void
  onStockPanel: (p: ProductRow) => void
  onRemoveVinculo: (vinculoId: string, listingId: string, productId: string) => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const thumb = product.photo_urls?.[0] ?? null
  const stock = product.product_stock.find(s => s.platform === null)?.quantity ?? 0

  return (
    <div className="rounded-xl" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      <div className="p-4 flex gap-4">

        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-xl shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
          {thumb
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={thumb} alt="" className="w-full h-full object-cover" />
            : <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#3f3f46" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
              </svg>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-zinc-100 text-sm font-semibold leading-snug truncate">{product.name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-zinc-500">
            {product.sku && <span>SKU: <span className="text-zinc-400 font-mono">{product.sku}</span></span>}
            <span>Estoque: <span className="text-zinc-300 font-semibold">{num(stock)}</span></span>
            {product.cost_price != null && product.cost_price > 0 && (
              <span>Custo: <span className="text-zinc-300">{brl(product.cost_price)}</span></span>
            )}
          </div>

          {/* Vinculos list */}
          <div className="mt-3 space-y-1.5">
            {product.product_listings.length === 0 ? (
              <p className="text-[11px] text-zinc-700 italic">Nenhum anúncio vinculado</p>
            ) : (
              product.product_listings.map(v => {
                const pb  = PLATFORM_BADGE[v.platform] ?? { label: v.platform, color: '#71717a', bg: 'rgba(113,113,122,0.1)' }
                const vb  = vinculoBadge(v)
                const isConfirm = confirmId === v.id
                return (
                  <div key={v.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                    style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: pb.color, background: pb.bg }}>{pb.label}</span>
                    {v.listing_thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.listing_thumbnail} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-mono text-zinc-400">{v.listing_id}</span>
                        {v.listing_price != null && (
                          <span className="text-[11px] text-zinc-300 font-semibold">{brl(v.listing_price)}</span>
                        )}
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ color: vb.color, background: vb.bg }}>{vb.label}</span>
                        {v.account_id && (
                          <span className="text-[10px] text-zinc-600">{v.account_id}</span>
                        )}
                      </div>
                      {v.listing_title && (
                        <p className="text-[10px] text-zinc-600 truncate mt-0.5">{v.listing_title}</p>
                      )}
                    </div>
                    {/* Remove / confirm */}
                    {!isConfirm ? (
                      <button onClick={() => setConfirmId(v.id)}
                        className="shrink-0 text-zinc-600 hover:text-red-400 transition-colors px-1">
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setConfirmId(null)}
                          className="text-[10px] px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors">
                          Não
                        </button>
                        <button
                          onClick={() => { setConfirmId(null); onRemoveVinculo(v.id, v.listing_id, product.id) }}
                          className="text-[10px] px-2 py-0.5 rounded font-semibold transition-colors"
                          style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5" style={{ borderTop: '1px solid #111114' }}>
        <button onClick={() => onAddVinculo(product)}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all"
          style={{ background: 'rgba(0,229,255,0.06)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.15)' }}>
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Adicionar vínculo
        </button>
        <button onClick={() => onAddKit(product)}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all"
          style={{ background: 'rgba(167,139,250,0.06)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.15)' }}>
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Kit
        </button>
        <button onClick={() => onStockPanel(product)}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all"
          style={{ background: '#1a1a1f', color: '#71717a', border: '1px solid #27272a' }}>
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Estoque
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VinculosPage() {
  const supabase = useMemo(() => createClient(), [])

  const [products,     setProducts]     = useState<ProductRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filter,       setFilter]       = useState<Filter>('all')
  const [platFilter,   setPlatFilter]   = useState<PlatformFilter>('all')
  const [toasts,       setToasts]       = useState<Toast[]>([])
  const [modalProduct, setModalProduct] = useState<ProductRow | null>(null)
  const [modalKitQty,  setModalKitQty]  = useState(1)
  const [stockProduct, setStockProduct] = useState<ProductRow | null>(null)
  const tid = { current: 0 }

  function toast(msg: string, type: Toast['type'] = 'info') {
    const id = ++tid.current
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}` }
  }, [supabase])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, sku, cost_price, photo_urls,
        product_listings(id, listing_id, platform, account_id, quantity_per_unit,
          variation_id, listing_title, listing_price, listing_thumbnail, is_active),
        product_stock(id, quantity, platform, account_id)
      `)
      .order('name')
      .limit(200)
    if (error) { toast('Erro ao carregar produtos: ' + error.message, 'error'); setLoading(false); return }
    setProducts((data ?? []) as unknown as ProductRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadProducts() }, [loadProducts])

  // KPIs
  const kpis = useMemo(() => {
    const total       = products.length
    const vinculados  = products.filter(p => p.product_listings.length > 0).length
    const listingIds  = new Set(products.flatMap(p => p.product_listings.map(v => v.listing_id)))
    const semVinculo  = total - vinculados
    return { total, vinculados, anuncios: listingIds.size, semVinculo }
  }, [products])

  // Filtered list
  const filtered = useMemo(() => {
    let list = products
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))
    }
    if (filter === 'vinculado')   list = list.filter(p => p.product_listings.length > 0)
    if (filter === 'sem_vinculo') list = list.filter(p => p.product_listings.length === 0)
    if (filter === 'kit')         list = list.filter(p => p.product_listings.some(v => v.quantity_per_unit > 1))
    if (filter === 'variacao')    list = list.filter(p => p.product_listings.some(v => v.variation_id != null))
    if (platFilter !== 'all')     list = list.filter(p => p.product_listings.some(v => v.platform === platFilter))
    return list
  }, [products, search, filter, platFilter])

  function handleVinculoSaved(productId: string, newVinculo: VinculoRow) {
    setProducts(prev => prev.map(p =>
      p.id === productId
        ? { ...p, product_listings: [...p.product_listings, newVinculo] }
        : p
    ))
    setModalProduct(null)
    toast('Anúncio vinculado com sucesso!', 'success')
  }

  async function handleRemoveVinculo(vinculoId: string, listingId: string, productId: string) {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/products/vinculos/${vinculoId}`, { method: 'DELETE', headers })
      if (!res.ok && res.status !== 204) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { message?: string }).message ?? `HTTP ${res.status}`)
      }
      setProducts(prev => prev.map(p =>
        p.id === productId
          ? { ...p, product_listings: p.product_listings.filter(v => v.id !== vinculoId) }
          : p
      ))
      toast(`Vínculo com ${listingId} removido`, 'success')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao remover vínculo', 'error')
    }
  }

  function handleStockUpdated(productId: string, newQty: number) {
    setProducts(prev => prev.map(p =>
      p.id === productId
        ? {
            ...p,
            product_stock: p.product_stock.map(s =>
              s.platform === null ? { ...s, quantity: newQty } : s
            ),
          }
        : p
    ))
    toast('Estoque atualizado!', 'success')
  }

  const FILTER_BTNS: { key: Filter; label: string }[] = [
    { key: 'all',        label: 'Todos'       },
    { key: 'vinculado',  label: 'Com vínculo' },
    { key: 'sem_vinculo',label: 'Sem vínculo' },
    { key: 'kit',        label: 'Kit'         },
    { key: 'variacao',   label: 'Variação'    },
  ]

  const PLAT_BTNS: { key: PlatformFilter; label: string }[] = [
    { key: 'all',          label: 'Plataforma' },
    { key: 'mercadolivre', label: 'ML'         },
    { key: 'shopee',       label: 'Shopee'     },
    { key: 'amazon',       label: 'Amazon'     },
    { key: 'magalu',       label: 'Magalu'     },
  ]

  return (
    <div style={{ background: '#09090b', minHeight: '100vh' }} className="p-6 max-w-[1200px] space-y-6">
      <Toasts list={toasts} />

      {/* Header */}
      <div>
        <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Catálogo</p>
        <h1 className="text-white text-2xl font-semibold">Gestão de Vínculos</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Conecte produtos a anúncios de qualquer plataforma e configure kits e variações
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de produtos"     value={num(kpis.total)}      color="#e4e4e7" />
        <KpiCard label="Produtos vinculados"   value={num(kpis.vinculados)} color="#4ade80"
          sub={kpis.total > 0 ? `${Math.round(kpis.vinculados / kpis.total * 100)}% do catálogo` : undefined} />
        <KpiCard label="Anúncios vinculados"   value={num(kpis.anuncios)}   color="#00E5FF" />
        <KpiCard label="Sem vínculo"           value={num(kpis.semVinculo)} color={kpis.semVinculo > 0 ? '#f59e0b' : '#4ade80'}
          sub={kpis.semVinculo > 0 ? 'Precisam de vínculo' : 'Tudo vinculado!'} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou SKU..."
          className="text-sm px-4 py-2 rounded-xl text-zinc-200 placeholder-zinc-600 outline-none w-64"
          style={{ background: '#111114', border: '1px solid #27272a' }} />

        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          {FILTER_BTNS.map(b => (
            <button key={b.key} onClick={() => setFilter(b.key)}
              className="px-3 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={filter === b.key
                ? { background: '#00E5FF', color: '#000' }
                : { color: '#71717a' }}>
              {b.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          {PLAT_BTNS.map(b => (
            <button key={b.key} onClick={() => setPlatFilter(b.key)}
              className="px-3 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={platFilter === b.key
                ? { background: '#00E5FF', color: '#000' }
                : { color: '#71717a' }}>
              {b.label}
            </button>
          ))}
        </div>

        <button onClick={loadProducts}
          className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl transition-colors"
          style={{ color: '#52525b', background: '#111114', border: '1px solid #1a1a1f' }}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>

        <span className="text-[11px] text-zinc-600 ml-auto">
          {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8} className="mb-4 opacity-25">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-sm font-medium text-zinc-500">Nenhum produto encontrado</p>
          <p className="text-xs text-zinc-600 mt-1">Tente outro filtro ou busca</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onAddVinculo={prod => { setModalKitQty(1); setModalProduct(prod) }}
              onAddKit={prod    => { setModalKitQty(2); setModalProduct(prod) }}
              onStockPanel={prod => setStockProduct(prod)}
              onRemoveVinculo={handleRemoveVinculo}
            />
          ))}
        </div>
      )}

      {/* Add vínculo modal */}
      {modalProduct && (
        <AddVinculoModal
          productId={modalProduct.id}
          productName={modalProduct.name}
          defaultQty={modalKitQty}
          onClose={() => setModalProduct(null)}
          onSaved={v => handleVinculoSaved(modalProduct.id, v)}
          getHeaders={getHeaders}
        />
      )}

      {/* Stock panel */}
      {stockProduct && (
        <StockPanel
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          getHeaders={getHeaders}
          onUpdated={(pid, qty) => { handleStockUpdated(pid, qty); setStockProduct(null) }}
        />
      )}
    </div>
  )
}
