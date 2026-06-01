'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle, RefreshCw, Search, Sparkles, X,
  Link2, Link2Off, Package,
  Boxes, DollarSign, Save, Pencil, Type, FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { computeContributionMargin, round2 } from '@/lib/margin'

/** F18 F1.2 — Listing Center Shopee.
 *  Consome GET /shopee/listings/scores (diagnóstico: Algorithm Score 4 pilares +
 *  issues) e, em paralelo, GET /shopee/listings/link-status (F18 Fase A/B:
 *  vínculo ao produto + custo + margem). Funde por item_id → cada card mostra
 *  diagnóstico + financeiro. Auto-vínculo por SKU + vínculo manual no drawer. */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN   = '#00E5FF'
const SHOPEE = '#EE4D2D'

type Pillar = 'relevance' | 'performance' | 'seller_quality' | 'price_marketing'
type Severity = 'high' | 'medium' | 'low'

interface Issue {
  pillar:              Pillar
  code:                string
  severity:            Severity
  description:         string
  recommended_action:  string
  current_value?:      number | string
  target_value?:       number | string
}

interface ListingCard {
  shop_id:         number
  item_id:         number
  product_id:      string | null
  title:           string | null
  main_image_url:  string | null
  score:           number
  pillars: {
    relevance:        number
    performance:      number
    seller_quality:   number
    price_marketing:  number
  }
  top_issues:      Issue[]
  total_issues:    number
  computed_at:     string
}

// F18 Fase A/B — vínculo + margem por anúncio (de /shopee/listings/link-status)
interface LinkedProduct {
  id: string; sku: string | null; name: string | null
  cost_price: number | null; price: number | null; stock: number | null
  tax_percentage?: number | null; tax_on_freight?: boolean | null
}
interface MarginInfo {
  price: number; commission_pct: number; sale_fee: number; cost: number
  tax_amount: number; contribution_margin: number; contribution_margin_pct: number
}
interface LinkInfo {
  linked: boolean
  product: LinkedProduct | null
  margin: MarginInfo | null
}
interface LinkStatus {
  shop_id: number; total: number; linked: number; unlinked: number; with_margin: number
  items: Array<{ item_id: number; linked: boolean; product: LinkedProduct | null; margin: MarginInfo | null }>
}
interface ProductHit { id: string; name: string | null; sku: string | null; cost_price?: number | null }

export default function ShopeeListingsCenter() {
  const t = useTranslations('catalogo.shopeeListingCenter')
  const [items, setItems]       = useState<ListingCard[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<ListingCard | null>(null)
  const [query, setQuery]       = useState('')
  const [links, setLinks]       = useState<Map<number, LinkInfo>>(new Map())
  const [summary, setSummary]   = useState<{ linked: number; with_margin: number } | null>(null)
  const [autoBusy, setAutoBusy] = useState(false)
  const [notice, setNotice]     = useState<string | null>(null)
  const [propagBusy, setPropagBusy]     = useState(false)
  const [propagConfirm, setPropagConfirm] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const headers = await authHeaders()
      const [scoresRes, linkRes] = await Promise.all([
        fetch(`${BACKEND}/shopee/listings/scores?limit=200`, { headers }),
        fetch(`${BACKEND}/shopee/listings/link-status`, { headers }),
      ])
      if (!scoresRes.ok) throw new Error(`HTTP ${scoresRes.status}`)
      const body = await scoresRes.json() as { items: ListingCard[]; total: number }
      setItems(body.items ?? [])
      setTotal(body.total ?? 0)
      // link-status é enriquecimento (não crítico): falha → segue sem margem
      if (linkRes.ok) {
        const ls = await linkRes.json() as LinkStatus
        const m = new Map<number, LinkInfo>()
        for (const it of ls.items ?? []) m.set(it.item_id, { linked: it.linked, product: it.product, margin: it.margin })
        setLinks(m)
        setSummary({ linked: ls.linked, with_margin: ls.with_margin })
      }
    } catch (e) {
      setError((e as Error).message)
      setItems([])
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const autoLink = useCallback(async () => {
    setAutoBusy(true); setError(null); setNotice(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/listings/auto-link`, { method: 'POST', headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = await res.json()
      setNotice(`Auto-vínculo: ${r.items_linked} anúncios vinculados (${r.products_matched} produtos). ${r.items - r.items_linked} sem vínculo — vincule manualmente no detalhe.`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAutoBusy(false)
    }
  }, [load])

  // F18 Fase C — propaga o estoque virtual (físico+virtual) do catálogo pros
  // anúncios Shopee vinculados (lote). Confirmação em 2 passos (muda a loja toda).
  const propagateStock = useCallback(async () => {
    if (!propagConfirm) { setPropagConfirm(true); return }
    setPropagConfirm(false); setPropagBusy(true); setError(null); setNotice(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/sync/stock`, { method: 'POST', headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = await res.json()
      setNotice(`Estoque propagado: ${r.pushed} anúncios atualizados${r.failed ? `, ${r.failed} falharam` : ''}${r.skipped_no_stock ? `, ${r.skipped_no_stock} sem registro de estoque (pulados)` : ''}.`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPropagBusy(false)
    }
  }, [load, propagConfirm])

  const linkProduct = useCallback(async (itemId: number, productId: string) => {
    const headers = await authHeaders()
    const res = await fetch(`${BACKEND}/shopee/listings/${itemId}/link`, {
      method: 'POST', headers, body: JSON.stringify({ product_id: productId }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await load()
  }, [load])

  const unlinkItem = useCallback(async (itemId: number) => {
    const headers = await authHeaders()
    const res = await fetch(`${BACKEND}/shopee/listings/${itemId}/unlink`, { method: 'POST', headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await load()
  }, [load])

  // ── inline edits no card (formato ML) ────────────────────────────────────
  // Preço (Fase D — item-level, escreve todas as variações com o mesmo preço de
  // lista). Pra preço por variação, usar o drawer.
  const savePrice = useCallback(async (itemId: number, price: number): Promise<boolean> => {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/listings/${itemId}/price`, {
        method: 'POST', headers, body: JSON.stringify({ price }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message ?? `HTTP ${res.status}`) }
      await load(); return true
    } catch (e) { setError((e as Error).message); return false }
  }, [load])

  // Estoque (Fase C/D — item-level). Pra estoque por variação, usar o drawer.
  const saveStock = useCallback(async (itemId: number, quantity: number): Promise<boolean> => {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/listings/${itemId}/stock`, {
        method: 'POST', headers, body: JSON.stringify({ quantity }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message ?? `HTTP ${res.status}`) }
      await load(); return true
    } catch (e) { setError((e as Error).message); return false }
  }, [load])

  // Custo + imposto → produto vinculado (mesmo padrão do ML: update products).
  const saveMargin = useCallback(async (productId: string, patch: { cost: number | null; taxPct: number | null }): Promise<boolean> => {
    try {
      const sb = createClient()
      const { error: e } = await sb.from('products')
        .update({ cost_price: patch.cost, tax_percentage: patch.taxPct })
        .eq('id', productId)
      if (e) throw new Error(e.message)
      await load(); return true
    } catch (e) { setError((e as Error).message); return false }
  }, [load])

  const filtered = (items ?? []).filter(it =>
    !query || (it.title ?? '').toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>
      <Header total={total} summary={summary} onRefresh={load} onAutoLink={autoLink} autoBusy={autoBusy}
        onPropagate={propagateStock} propagBusy={propagBusy} propagConfirm={propagConfirm} t={t} />
      <Toolbar query={query} onQuery={setQuery} t={t} />
      {notice && (
        <div className="rounded-xl p-3 flex items-start gap-2"
          style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
          <Link2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-300 flex-1">{notice}</p>
          <button onClick={() => setNotice(null)} className="text-emerald-400/70"><X size={14} /></button>
        </div>
      )}
      {error && <ErrorBanner error={error} onRetry={load} t={t} />}
      {items === null && !error ? (
        <LoadingState t={t} />
      ) : filtered.length === 0 ? (
        <EmptyState t={t} hasQuery={!!query} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(it => (
            <ListingRow key={`${it.shop_id}:${it.item_id}`} card={it} link={links.get(it.item_id) ?? null}
              onOpen={() => setSelected(it)}
              onUnlink={() => unlinkItem(it.item_id)}
              onSavePrice={(p) => savePrice(it.item_id, p)}
              onSaveStock={(q) => saveStock(it.item_id, q)}
              onSaveMargin={saveMargin}
              t={t} />
          ))}
        </div>
      )}
      {selected && (
        <Drawer
          card={selected}
          link={links.get(selected.item_id) ?? null}
          onClose={() => setSelected(null)}
          onLink={(pid) => linkProduct(selected.item_id, pid)}
          onUnlink={() => unlinkItem(selected.item_id)}
          onSaved={load}
          t={t}
        />
      )}
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function Header({ total, summary, onRefresh, onAutoLink, autoBusy, onPropagate, propagBusy, propagConfirm, t }: {
  total: number
  summary: { linked: number; with_margin: number } | null
  onRefresh: () => void
  onAutoLink: () => void
  autoBusy: boolean
  onPropagate: () => void
  propagBusy: boolean
  propagConfirm: boolean
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-zinc-500 text-xs">{t('breadcrumb')}</p>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <div>
        <h2 className="text-white text-lg font-semibold">{t('title')}</h2>
        <p className="text-zinc-500 text-xs">
          {t('subtitle', { total })}
          {summary && <span className="text-zinc-600"> · {summary.linked} vinculados · {summary.with_margin} com margem</span>}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {/* F18 Fase C — propagar estoque virtual (físico+virtual) → Shopee (lote) */}
        <button
          onClick={onPropagate}
          disabled={propagBusy}
          title="Propaga o estoque (real + virtual) do catálogo pros anúncios Shopee vinculados"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          style={propagConfirm
            ? { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)' }
            : { background: 'rgba(0,229,255,0.08)', color: CYAN, border: '1px solid rgba(0,229,255,0.3)' }}
        >
          <Boxes size={12} className={propagBusy ? 'animate-pulse' : ''} />
          {propagBusy ? 'Propagando…' : propagConfirm ? 'Confirmar propagação?' : 'Propagar estoque'}
        </button>
        <button
          onClick={onAutoLink}
          disabled={autoBusy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ background: SHOPEE }}
        >
          <Sparkles size={12} className={autoBusy ? 'animate-pulse' : ''} />
          {autoBusy ? 'Vinculando…' : 'Auto-vincular por SKU'}
        </button>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
          style={{ borderColor: '#2e2e33', color: '#a1a1aa', background: '#111114' }}
          aria-label={t('refresh')}
        >
          <RefreshCw size={12} />
          {t('refresh')}
        </button>
      </div>
    </div>
  )
}

function Toolbar({ query, onQuery, t }: { query: string; onQuery: (s: string) => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
        <input
          type="text"
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full pl-9 pr-3 py-2 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600"
          style={{ background: '#111114', border: '1px solid #1e1e24', outline: 'none' }}
        />
      </div>
    </div>
  )
}

// ── Card de anúncio no formato ML (horizontal) ──────────────────────────────
// Espelha o ListingCard do ML: thumbnail + info (badges/título/ids/estoque/
// diagnóstico) + painel financeiro à direita (preço editável, líquido, lucro
// bruto, custo/imposto editáveis, margem contrib, tarifa Shopee). Mantém TODO o
// dado Shopee: Algorithm Score (gauge + 4 pilares) + issues; clique abre o
// drawer com a edição rica (preço/estoque por variação, conteúdo, issues).
function ListingRow({ card, link, onOpen, onUnlink, onSavePrice, onSaveStock, onSaveMargin, t }: {
  card: ListingCard
  link: LinkInfo | null
  onOpen: () => void
  onUnlink: () => Promise<void>
  onSavePrice: (price: number) => Promise<boolean>
  onSaveStock: (qty: number) => Promise<boolean>
  onSaveMargin: (productId: string, patch: { cost: number | null; taxPct: number | null }) => Promise<boolean>
  t: ReturnType<typeof useTranslations>
}) {
  const linked  = !!link?.linked && !!link?.product
  const product = link?.product ?? null
  const m       = link?.margin ?? null
  const commissionPct = m?.commission_pct ?? 0
  const price = m?.price ?? product?.price ?? 0

  // ── preço inline (Fase D, item-level, com modal de confirmação) ──
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft,   setPriceDraft]   = useState('')
  const [confirmPrice, setConfirmPrice] = useState<number | null>(null)
  const [priceSaving,  setPriceSaving]  = useState(false)
  function commitPrice() {
    const n = parseFloat(priceDraft.replace(',', '.'))
    if (!isFinite(n) || n <= 0 || n === price) { setEditingPrice(false); return }
    setConfirmPrice(n)
  }
  async function applyPrice() {
    if (confirmPrice == null) return
    setPriceSaving(true)
    const ok = await onSavePrice(confirmPrice)
    setPriceSaving(false); setConfirmPrice(null)
    if (ok) setEditingPrice(false)
  }

  // ── estoque inline (Fase C/D, item-level) ──
  const stockRef = useRef<HTMLInputElement>(null)
  const [stockDraft, setStockDraft] = useState(product?.stock != null ? String(product.stock) : '')
  const [stockState, setStockState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  useEffect(() => { if (product?.stock != null) setStockDraft(String(product.stock)) }, [product?.stock])
  async function commitStock() {
    if (product?.stock == null) return
    const next = parseInt(stockDraft, 10)
    if (isNaN(next) || next < 0) { setStockDraft(String(product.stock)); return }
    if (next === product.stock) return
    setStockState('saving')
    const ok = await onSaveStock(next)
    setStockState(ok ? 'success' : 'error')
    setTimeout(() => setStockState('idle'), 1200)
  }

  // ── custo + imposto inline (→ produto vinculado) ──
  const costInit = product?.cost_price != null ? String(product.cost_price) : ''
  const taxInit  = product?.tax_percentage != null ? String(product.tax_percentage) : ''
  const [costDraft, setCostDraft] = useState(costInit)
  const [taxDraft,  setTaxDraft]  = useState(taxInit)
  const [marginSaving, setMarginSaving] = useState(false)
  useEffect(() => { setCostDraft(product?.cost_price != null ? String(product.cost_price) : '') }, [product?.cost_price])
  useEffect(() => { setTaxDraft(product?.tax_percentage != null ? String(product.tax_percentage) : '') }, [product?.tax_percentage])

  const cost   = parseFloat(costDraft.replace(',', '.')) || 0
  const taxPct = parseFloat(taxDraft.replace(',', '.')) || 0
  const saleFee = round2(price * commissionPct / 100)
  const mm = computeContributionMargin({ price, saleFee, shipping: 0, cost, taxPercentage: taxPct, taxOnFreight: product?.tax_on_freight ?? false })
  const gross    = round2(price - saleFee)
  const grossPct = price > 0 ? round2(gross / price * 100) : 0
  const net      = round2(price - saleFee)
  const marginOverCost = cost > 0 ? round2(mm.contributionMargin / cost * 100) : null
  const noCost   = costDraft.trim() === ''
  const dirtyMargin = costDraft !== costInit || taxDraft !== taxInit
  const marginColor = noCost ? '#71717a' : mm.contributionMarginPct >= 15 ? '#4ade80' : mm.contributionMarginPct >= 5 ? '#fbbf24' : '#f87171'

  async function saveMarginRow() {
    if (!product) return
    setMarginSaving(true)
    await onSaveMargin(product.id, { cost: costDraft.trim() === '' ? null : cost, taxPct: taxDraft.trim() === '' ? null : taxPct })
    setMarginSaving(false)
  }

  const sColor = scoreColor(card.score)
  const fieldStyle = { background: '#0d0d10', border: '1px solid #27272a' }

  return (
    <div className="flex gap-3 p-4 rounded-xl transition-colors"
      style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>

      {/* Confirmação de mudança de preço (modal in-app) */}
      {confirmPrice != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setConfirmPrice(null)}>
          <div className="w-full max-w-sm rounded-xl p-5" style={{ background: '#111114', border: '1px solid #1a1a1f' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold mb-1 text-zinc-100">Alterar preço na Shopee</h2>
            <p className="text-xs mb-4 truncate text-zinc-500">#{card.item_id}</p>
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="text-sm tabular-nums line-through text-zinc-500">{brl(price)}</span>
              <span className="text-zinc-600">→</span>
              <span className="text-xl font-bold tabular-nums" style={{ color: SHOPEE }}>{brl(confirmPrice)}</span>
            </div>
            <p className="text-[10px] mb-4 text-center text-amber-400">Escreve o preço de lista REAL na Shopee (promoções aplicam por cima). Em item com variações, aplica a todas — pra preço por variação use o detalhe.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPrice(null)} className="flex-1 rounded-lg py-2 text-xs font-medium" style={{ border: '1px solid #27272a', color: '#a1a1aa' }}>Cancelar</button>
              <button onClick={applyPrice} disabled={priceSaving} className="flex-1 rounded-lg py-2 text-xs font-medium transition-opacity disabled:opacity-50" style={{ background: SHOPEE, color: '#fff' }}>
                {priceSaving ? 'Aplicando…' : 'Aplicar na Shopee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail */}
      <button onClick={onOpen} className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800" title="Abrir detalhe / edição completa">
        {card.main_image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={card.main_image_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">SH</div>}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1.5 mb-1.5 items-center">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(238,77,45,0.12)', color: SHOPEE, border: '1px solid rgba(238,77,45,0.25)' }}>SHOPEE</span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ativo
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${sColor}1a`, color: sColor, border: `1px solid ${sColor}33` }}>
            Score {card.score}
          </span>
          {card.total_issues > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#1f1a00', color: '#fbbf24', border: '1px solid rgba(251,191,36,.2)' }}>
              {card.total_issues} {card.total_issues === 1 ? 'alerta' : 'alertas'}
            </span>
          )}
          {linked ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(0,229,255,0.08)', color: CYAN, border: '1px solid rgba(0,229,255,0.2)' }}>
              <Package size={10} /> Produto vinculado
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: '#1a1a1f', color: '#71717a', border: '1px solid #27272a' }}>
              <Link2Off size={10} /> sem vínculo
            </span>
          )}
        </div>

        <div className="flex items-start gap-1 mb-1.5">
          <button onClick={onOpen} className="text-left text-zinc-100 text-sm font-medium hover:text-cyan-300 transition-colors line-clamp-2 block flex-1">
            {card.title ?? `Item ${card.item_id}`}
          </button>
          <Copy text={card.title ?? ''} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mb-2">
          <span className="flex items-center font-mono text-zinc-400">{card.item_id}<Copy text={String(card.item_id)} /></span>
          {product?.sku && (
            <span className="flex items-center">SKU: <span className="text-zinc-400 ml-1">{product.sku}</span><Copy text={product.sku} /></span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2">
          {/* Estoque editável (escreve na Shopee — item-level) */}
          <span className="inline-flex items-center gap-1.5 text-zinc-500">
            Estoque
            <input ref={stockRef} type="number" min={0}
              value={product?.stock != null ? stockDraft : ''}
              placeholder={product ? '' : '—'}
              onChange={e => setStockDraft(e.target.value)}
              onBlur={commitStock}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape' && product?.stock != null) { setStockDraft(String(product.stock)); (e.target as HTMLInputElement).blur() } }}
              disabled={!product || stockState === 'saving'}
              title={product ? 'Estoque enviado à Shopee (real+virtual). Por variação, use o detalhe.' : 'Vincule um produto para gerenciar o estoque'}
              className="w-[70px] text-zinc-200 font-semibold tabular-nums text-xs px-2 py-1 rounded outline-none disabled:cursor-not-allowed disabled:text-zinc-700"
              style={{ background: '#0d0d10', border: `1px solid ${stockState === 'success' ? '#22c55e' : stockState === 'error' ? '#ef4444' : '#27272a'}` }} />
          </span>
          <span className="text-zinc-600">Atualizado {ago(card.computed_at)}</span>
        </div>

        {/* Algorithm Score — diagnóstico (mantido): gauge + 4 pilares */}
        <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: '1px solid #1e1e24' }}>
          <SemiGauge score={card.score} label="Score" />
          <div className="grid grid-cols-4 gap-1.5 flex-1">
            <PillarBar value={card.pillars.relevance}       label={t('pillar.relevance.short')}       weight={40} />
            <PillarBar value={card.pillars.performance}     label={t('pillar.performance.short')}     weight={30} />
            <PillarBar value={card.pillars.seller_quality}  label={t('pillar.seller_quality.short')}  weight={20} />
            <PillarBar value={card.pillars.price_marketing} label={t('pillar.price_marketing.short')} weight={10} />
          </div>
        </div>
      </div>

      {/* Painel financeiro (formato ML) */}
      <div className="shrink-0 w-56 flex flex-col items-end gap-1.5">
        <div className="text-right w-full">
          {editingPrice ? (
            <div className="flex items-center gap-1 justify-end">
              <span className="text-zinc-500 text-sm">R$</span>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input value={priceDraft} onChange={e => setPriceDraft(e.target.value)} inputMode="decimal" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') commitPrice(); if (e.key === 'Escape') setEditingPrice(false) }}
                className="w-24 text-right text-white text-lg font-bold tabular-nums px-1.5 py-0.5 rounded outline-none"
                style={{ background: '#0d0d10', border: `1px solid ${SHOPEE}` }} />
            </div>
          ) : (
            <button onClick={() => { setPriceDraft(String(price)); setEditingPrice(true) }} disabled={!price}
              className="group flex items-center gap-1.5 justify-end w-full disabled:cursor-default" title="Ajustar preço na Shopee">
              <p className="text-white text-xl font-bold leading-tight">{price ? brl(price) : '—'}</p>
              {!!price && <Pencil size={11} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
          )}
          {!!price && <p className="text-emerald-400 text-xs font-semibold mt-0.5">Líquido: {brl(net)}</p>}
        </div>

        {/* Margem (custo/imposto editáveis) — só com produto vinculado */}
        {linked && product ? (
          <div className="w-full text-[11px] pt-2 mt-1 space-y-1.5" style={{ borderTop: '1px solid #1e1e24' }}>
            <div className="flex justify-between text-zinc-500">
              <span>Lucro bruto</span>
              <span className="text-emerald-400/90">{brl(gross)} · {grossPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between gap-1 pt-1" style={{ borderTop: '1px dashed #1e1e24' }}>
              <span className="text-zinc-500">Custo (CMV)</span>
              <div className="flex items-center gap-0.5">
                <span className="text-zinc-600">R$</span>
                <input value={costDraft} onChange={e => setCostDraft(e.target.value)} placeholder="0,00" inputMode="decimal"
                  className="w-16 text-right text-zinc-200 tabular-nums px-1.5 py-0.5 rounded outline-none focus:border-cyan-400" style={fieldStyle} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-zinc-500">Imposto</span>
              <div className="flex items-center gap-0.5">
                <input value={taxDraft} onChange={e => setTaxDraft(e.target.value)} placeholder="0" inputMode="decimal"
                  className="w-12 text-right text-zinc-200 tabular-nums px-1.5 py-0.5 rounded outline-none focus:border-cyan-400" style={fieldStyle} />
                <span className="text-zinc-600">%</span>
              </div>
            </div>
            <div className="flex justify-between items-start pt-1" style={{ borderTop: '1px dashed #1e1e24' }}>
              <span className="text-zinc-400 font-medium">Margem contrib.</span>
              <div className="text-right">
                <div className="font-bold" style={{ color: marginColor }}>
                  {noCost ? 'sem custo' : `${brl(mm.contributionMargin)} · ${mm.contributionMarginPct.toFixed(1)}%`}
                </div>
                {!noCost && marginOverCost != null && <div className="text-[10px] text-zinc-600">{marginOverCost.toFixed(1)}% do custo</div>}
              </div>
            </div>
            {dirtyMargin && (
              <button onClick={saveMarginRow} disabled={marginSaving}
                className="w-full text-[10px] py-1 rounded-md font-semibold transition-opacity hover:opacity-90 disabled:opacity-60" style={{ background: CYAN, color: '#000' }}>
                {marginSaving ? 'Salvando…' : 'Salvar custo/imposto'}
              </button>
            )}
          </div>
        ) : null}

        {/* Detalhamento de tarifa */}
        <div className="w-full text-[11px] pt-2 space-y-1" style={{ borderTop: '1px solid #1e1e24' }}>
          <div className="flex justify-between text-zinc-600">
            <span title={commissionPct === 0 ? 'Comissão Shopee não configurada — ajuste em Configurações › Canais' : ''}>
              Tarifa Shopee ({commissionPct.toFixed(1)}%){commissionPct === 0 ? ' ⚠' : ''}
            </span>
            <span className="text-red-400/80">-{brl(saleFee)}</span>
          </div>
          <div className="flex justify-between text-zinc-600">
            <span>Frete vendedor</span>
            <span title="Na Shopee o frete varia por pedido (comprador costuma pagar)">Comprador</span>
          </div>
        </div>

        {/* Ações */}
        <div className="w-full flex flex-col gap-1 mt-1">
          {linked ? (
            <button onClick={onUnlink}
              className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c' }}>
              <Link2Off size={12} /> Desvincular produto
            </button>
          ) : (
            <button onClick={onOpen}
              className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.45)', color: '#4ade80' }}>
              <Link2 size={12} /> Vincular produto
            </button>
          )}
          <button onClick={onOpen}
            className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors"
            style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', color: CYAN }}
            title="Editar conteúdo, preço/estoque por variação, ver diagnóstico completo">
            <Pencil size={12} /> Editar / Detalhes
          </button>
        </div>
      </div>
    </div>
  )
}

function PillarBar({ value, label, weight }: { value: number; label: string; weight: number }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{label}</span>
        <span className="text-[9px] text-zinc-500">{weight}%</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: '#18181b' }}>
        <div className="h-full transition-all" style={{
          width: `${value}%`,
          background: scoreColor(value),
        }} />
      </div>
      <p className="text-[10px] text-zinc-400 mt-0.5">{value}</p>
    </div>
  )
}

function Drawer({ card, link, onClose, onLink, onUnlink, onSaved, t }: {
  card: ListingCard
  link: LinkInfo | null
  onClose: () => void
  onLink: (productId: string) => Promise<void>
  onUnlink: () => Promise<void>
  onSaved: () => Promise<void> | void
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md h-full overflow-y-auto"
        style={{ background: '#0f0f13', borderLeft: '1px solid #1e1e24' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">{t('drawer.eyebrow')}</p>
              <h3 className="text-white font-semibold mt-1 leading-tight">{card.title ?? `Item ${card.item_id}`}</h3>
              <p className="text-xs text-zinc-500 mt-1">#{card.item_id} · {t('drawer.shop')} {card.shop_id}</p>
            </div>
            <button onClick={onClose} aria-label={t('drawer.close')} className="text-zinc-500 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {card.main_image_url && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#18181b', border: '1px solid #27272a' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.main_image_url} alt="" className="w-full aspect-square object-cover" />
            </div>
          )}

          {/* F18 Fase A/B — Vínculo & Margem */}
          <LinkSection link={link} onLink={onLink} onUnlink={onUnlink} />

          {/* F18 Fase E — Editar conteúdo do anúncio (título/descrição) */}
          <ItemContentSection itemId={card.item_id} onSaved={onSaved} />

          {/* F18 Fase C/D — Editar preço & estoque na Shopee (write-back inline) */}
          <EditSection itemId={card.item_id} onSaved={onSaved} />

          <div className="rounded-2xl p-5 text-center" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">{t('drawer.totalScore')}</p>
            <p className="text-5xl font-black mt-1" style={{ color: scoreColor(card.score) }}>{card.score}</p>
            <p className="text-[10px] text-zinc-500 mt-1">/100</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('drawer.pillars')}</h4>
            {(['relevance','performance','seller_quality','price_marketing'] as Pillar[]).map(p => (
              <PillarRow
                key={p}
                value={card.pillars[p]}
                label={t(`pillar.${p}.label`)}
                desc={t(`pillar.${p}.desc`)}
                weight={pillarWeight(p)}
              />
            ))}
          </div>

          {card.top_issues.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                {t('drawer.issues', { n: card.total_issues })}
              </h4>
              {card.top_issues.map((iss, i) => (
                <IssueCard key={`${iss.code}-${i}`} issue={iss} t={t} />
              ))}
              {card.total_issues > card.top_issues.length && (
                <p className="text-[10px] text-zinc-600 text-center pt-1">
                  {t('drawer.moreHidden', { n: card.total_issues - card.top_issues.length })}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl p-5 text-center" style={{ background: '#0d1812', border: '1px solid #1a2e22' }}>
              <Sparkles size={16} className="mx-auto" style={{ color: '#34d399' }} />
              <p className="text-xs font-semibold text-emerald-300 mt-2">{t('drawer.noIssues')}</p>
              <p className="text-[10px] text-emerald-500 mt-0.5">{t('drawer.noIssuesHint')}</p>
            </div>
          )}

          <p className="text-[10px] text-zinc-600 text-center">
            {t('drawer.computedAt', { d: new Date(card.computed_at).toLocaleString('pt-BR') })}
          </p>
        </div>
      </div>
    </div>
  )
}

// F18 Fase A/B — seção de vínculo + margem + picker de produto, dentro do drawer
function LinkSection({ link, onLink, onUnlink }: {
  link: LinkInfo | null
  onLink: (productId: string) => Promise<void>
  onUnlink: () => Promise<void>
}) {
  const [picking, setPicking] = useState(false)
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState<string | null>(null)
  const [q, setQ]             = useState('')
  const [hits, setHits]       = useState<ProductHit[]>([])
  const [searching, setSrch]  = useState(false)

  const search = useCallback(async (term: string) => {
    if (!term.trim()) { setHits([]); return }
    setSrch(true); setErr(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/products?search=${encodeURIComponent(term)}&per_page=8`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr = (j.data ?? j.items ?? j.products ?? []) as any[]
      setHits(arr.map(p => ({ id: p.id, name: p.name, sku: p.sku, cost_price: p.cost_price })))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSrch(false)
    }
  }, [])

  useEffect(() => {
    if (!picking) return
    const id = setTimeout(() => search(q), 350)
    return () => clearTimeout(id)
  }, [q, picking, search])

  const doLink = async (pid: string) => {
    setBusy(true); setErr(null)
    try { await onLink(pid); setPicking(false) }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }
  const doUnlink = async () => {
    setBusy(true); setErr(null)
    try { await onUnlink() }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  const m = link?.margin ?? null

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2">
        <Package size={14} className="text-cyan-400" />
        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Vínculo &amp; Margem</h4>
      </div>

      {link?.linked && link.product ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link2 size={13} className="text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-200 truncate">{link.product.name ?? link.product.sku}</p>
              <p className="text-[11px] text-zinc-500">SKU {link.product.sku ?? '—'} · custo {brl(link.product.cost_price)} · estoque {link.product.stock ?? '—'}</p>
            </div>
            <button onClick={doUnlink} disabled={busy}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-400 disabled:opacity-50 shrink-0">
              <Link2Off size={13} /> desvincular
            </button>
          </div>
          {m && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Metric label="Preço" value={brl(m.price)} />
              <Metric label={`Comissão ${m.commission_pct}%`} value={brl(m.sale_fee)} />
              <Metric label="Margem" value={`${m.contribution_margin_pct}%`} color={marginHex(m.contribution_margin_pct)} />
            </div>
          )}
          {m && m.commission_pct === 0 && (
            <p className="text-[10px] text-amber-500/80">⚠ comissão Shopee não configurada — margem otimista. Ajuste em Configurações › Canais.</p>
          )}
        </div>
      ) : picking ? (
        <div className="space-y-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-600" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar produto por nome ou SKU…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600"
              style={{ background: '#18181b', border: '1px solid #27272a', outline: 'none' }} />
          </div>
          {searching ? (
            <p className="text-[11px] text-zinc-500 py-2 text-center">Buscando…</p>
          ) : hits.length > 0 ? (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {hits.map(p => (
                <button key={p.id} onClick={() => doLink(p.id)} disabled={busy}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-[#18181b] disabled:opacity-50">
                  <Package size={13} className="text-zinc-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-200 truncate">{p.name ?? '(sem nome)'}</p>
                    <p className="text-[10px] text-zinc-500">SKU {p.sku ?? '—'} · custo {brl(p.cost_price ?? null)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-600 py-2 text-center">Digite para buscar.</p>
          )}
          <button onClick={() => setPicking(false)} className="text-[11px] text-zinc-500 hover:text-zinc-300">cancelar</button>
        </div>
      ) : (
        <button onClick={() => setPicking(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors"
          style={{ borderColor: 'rgba(0,229,255,0.3)', color: CYAN, background: 'rgba(0,229,255,0.05)' }}>
          <Link2 size={13} /> Vincular a um produto
        </button>
      )}
      {err && <p className="text-[11px] text-red-400">{err}</p>}
    </div>
  )
}

// F18 Fase E — edição de conteúdo do anúncio (título + descrição), nível ITEM.
// Carrega valores reais (GET :itemId/detail) e escreve (POST :itemId/item).
// Descrição rica ('extended') não é editável por texto → bloqueia com aviso.
interface ItemDetail {
  item_name:        string | null
  description:      string | null
  description_type: string | null
}

function ItemContentSection({ itemId, onSaved }: { itemId: number; onSaved: () => Promise<void> | void }) {
  const [open, setOpen]       = useState(false)
  const [detail, setDetail]   = useState<ItemDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [name, setName]       = useState('')
  const [desc, setDesc]       = useState('')
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState<string | null>(null)
  const [ok, setOk]           = useState(false)

  const loadDetail = useCallback(async () => {
    setLoading(true); setErr(null); setOk(false)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/listings/${itemId}/detail`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json() as ItemDetail
      setDetail(j)
      setName(j.item_name ?? '')
      setDesc(j.description ?? '')
    } catch (e) {
      setErr((e as Error).message)
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [itemId])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && detail === null) void loadDetail()
  }

  const richDesc = !!detail?.description_type && detail.description_type !== 'normal'
  const nameChanged = name.trim() !== '' && name.trim() !== (detail?.item_name ?? '')
  const descChanged = !richDesc && desc !== (detail?.description ?? '')
  const dirty = nameChanged || descChanged

  const save = async () => {
    setBusy(true); setErr(null); setOk(false)
    try {
      const headers = await authHeaders()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {}
      if (nameChanged) payload.item_name = name.trim()
      if (descChanged) payload.description = desc
      const res = await fetch(`${BACKEND}/shopee/listings/${itemId}/item`, {
        method: 'POST', headers, body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      setOk(true)
      await loadDetail()
      await onSaved()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <button onClick={toggle} className="w-full flex items-center gap-2">
        <FileText size={14} className="text-cyan-400" />
        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Editar conteúdo</h4>
        <span className="ml-auto text-[10px] text-zinc-600">{open ? 'ocultar' : 'abrir'}</span>
      </button>

      {open && (
        loading ? (
          <p className="text-[11px] text-zinc-500 py-2 text-center">Carregando da Shopee…</p>
        ) : detail ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-[9px] uppercase tracking-wider text-zinc-600 flex items-center gap-1"><Type size={10} /> Título</span>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={255}
                className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs text-zinc-200"
                style={{ background: '#0d0d10', border: `1px solid ${nameChanged ? 'rgba(0,229,255,0.4)' : '#27272a'}`, outline: 'none' }} />
              <span className="text-[9px] text-zinc-600">{name.length}/255</span>
            </label>

            <label className="block">
              <span className="text-[9px] uppercase tracking-wider text-zinc-600 flex items-center gap-1"><FileText size={10} /> Descrição</span>
              {richDesc ? (
                <p className="mt-1 text-[11px] text-amber-500/90 rounded-lg p-2"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                  ⚠ Este anúncio usa descrição rica (imagens/blocos). A descrição não pode ser editada por texto aqui — edite título/atributos; a descrição rica é editada no Seller Center.
                </p>
              ) : (
                <>
                  <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={6}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs text-zinc-200 resize-y"
                    style={{ background: '#0d0d10', border: `1px solid ${descChanged ? 'rgba(0,229,255,0.4)' : '#27272a'}`, outline: 'none' }} />
                  <span className="text-[9px] text-zinc-600">{desc.length} caracteres</span>
                </>
              )}
            </label>

            <div className="flex items-center gap-2">
              <button onClick={save} disabled={!dirty || busy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-40"
                style={{ background: dirty ? CYAN : '#27272a', color: dirty ? '#06181c' : '#71717a' }}>
                <Save size={12} /> {busy ? 'Salvando…' : 'Salvar conteúdo'}
              </button>
              {err && <p className="text-[11px] text-red-400 flex-1">{err}</p>}
              {ok && !err && <p className="text-[11px] text-emerald-400 flex-1">✓ Atualizado na Shopee.</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-red-400">{err ?? 'Falha ao carregar'}</p>
            <button onClick={loadDetail} className="text-[11px] text-zinc-400 underline">tentar de novo</button>
          </div>
        )
      )}
    </div>
  )
}

// F18 Fase C/D — edição inline de preço & estoque na Shopee, por variação.
// Carrega os valores REAIS ao vivo (GET stock-inspect) e escreve via
// POST :itemId/stock e :itemId/price (variation_id). Estoque = real+virtual
// (mesma regra do catálogo). Preço = original_price (promoção aplica por cima).
interface EditModel {
  model_id:       number
  name:           string
  sku:            string | null
  stock:          number
  original_price: number | null
  current_price:  number | null
}

function EditSection({ itemId, onSaved }: { itemId: number; onSaved: () => Promise<void> | void }) {
  const [open, setOpen]       = useState(false)
  const [models, setModels]   = useState<EditModel[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState<string | null>(null)

  const loadInspect = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/listings/${itemId}/stock-inspect`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (j?.models?.model ?? []) as any[]
      setModels(raw.map(m => ({
        model_id:       Number(m?.model_id ?? 0),
        name:           m?.model_name ?? '(único)',
        sku:            m?.model_sku ?? null,
        stock:          Number(m?.stock_info_v2?.seller_stock?.[0]?.stock ?? 0),
        original_price: m?.price_info?.[0]?.original_price != null ? Number(m.price_info[0].original_price) : null,
        current_price:  m?.price_info?.[0]?.current_price  != null ? Number(m.price_info[0].current_price)  : null,
      })))
    } catch (e) {
      setErr((e as Error).message)
      setModels([])
    } finally {
      setLoading(false)
    }
  }, [itemId])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && models === null) void loadInspect()
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <button onClick={toggle} className="w-full flex items-center gap-2">
        <Pencil size={14} className="text-cyan-400" />
        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Editar preço &amp; estoque</h4>
        <span className="ml-auto text-[10px] text-zinc-600">{open ? 'ocultar' : 'abrir'}</span>
      </button>

      {open && (
        <>
          <p className="text-[10px] text-zinc-600 -mt-1">
            Escreve direto na Shopee. Estoque = real + virtual. Preço = preço de lista (promoção aplica por cima).
          </p>
          {loading ? (
            <p className="text-[11px] text-zinc-500 py-2 text-center">Carregando da Shopee…</p>
          ) : err ? (
            <div className="space-y-2">
              <p className="text-[11px] text-red-400">{err}</p>
              <button onClick={loadInspect} className="text-[11px] text-zinc-400 underline">tentar de novo</button>
            </div>
          ) : models && models.length > 0 ? (
            <div className="space-y-2">
              {models.map(m => (
                <EditRow key={m.model_id} itemId={itemId} model={m} onSaved={async () => { await loadInspect(); await onSaved() }} />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-600 py-2 text-center">Nenhuma variação encontrada.</p>
          )}
        </>
      )}
    </div>
  )
}

function EditRow({ itemId, model, onSaved }: { itemId: number; model: EditModel; onSaved: () => Promise<void> }) {
  const [stock, setStock] = useState(String(model.stock))
  const [price, setPrice] = useState(model.original_price != null ? String(model.original_price) : '')
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState<string | null>(null)
  const [ok, setOk]       = useState(false)

  const stockChanged = Number(stock) !== model.stock && stock.trim() !== ''
  const priceChanged = price.trim() !== '' && Number(price) !== model.original_price
  const dirty = stockChanged || priceChanged

  const save = async () => {
    setBusy(true); setErr(null); setOk(false)
    try {
      const headers = await authHeaders()
      const vid = model.model_id ? String(model.model_id) : ''
      if (stockChanged) {
        const r = await fetch(`${BACKEND}/shopee/listings/${itemId}/stock`, {
          method: 'POST', headers,
          body: JSON.stringify({ quantity: Math.max(0, Math.round(Number(stock))), variation_id: vid }),
        })
        if (!r.ok) throw new Error(`estoque: HTTP ${r.status}`)
      }
      if (priceChanged) {
        const r = await fetch(`${BACKEND}/shopee/listings/${itemId}/price`, {
          method: 'POST', headers,
          body: JSON.stringify({ price: Number(price), variation_id: vid }),
        })
        if (!r.ok) throw new Error(`preço: HTTP ${r.status}`)
      }
      setOk(true)
      await onSaved()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-zinc-200 truncate">{model.name}</span>
        {model.sku && <span className="text-[10px] text-zinc-500">· {model.sku}</span>}
        {model.current_price != null && model.original_price != null && model.current_price < model.original_price && (
          <span className="ml-auto text-[10px] text-emerald-400">promo {brl(model.current_price)}</span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="text-[9px] uppercase tracking-wider text-zinc-600 flex items-center gap-1"><Boxes size={10} /> Estoque</span>
          <input type="number" min={0} value={stock} onChange={e => setStock(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs text-zinc-200"
            style={{ background: '#0d0d10', border: `1px solid ${stockChanged ? 'rgba(0,229,255,0.4)' : '#27272a'}`, outline: 'none' }} />
        </label>
        <label className="flex-1">
          <span className="text-[9px] uppercase tracking-wider text-zinc-600 flex items-center gap-1"><DollarSign size={10} /> Preço (lista)</span>
          <input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs text-zinc-200"
            style={{ background: '#0d0d10', border: `1px solid ${priceChanged ? 'rgba(0,229,255,0.4)' : '#27272a'}`, outline: 'none' }} />
        </label>
        <button onClick={save} disabled={!dirty || busy}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-40"
          style={{ background: dirty ? CYAN : '#27272a', color: dirty ? '#06181c' : '#71717a' }}>
          <Save size={12} /> {busy ? '…' : 'Salvar'}
        </button>
      </div>
      {/* erro/sucesso DENTRO da seção, perto do botão (visível com drawer aberto) */}
      {err && <p className="text-[11px] text-red-400">{err}</p>}
      {ok && !err && <p className="text-[11px] text-emerald-400">✓ Atualizado na Shopee.</p>}
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="text-sm font-bold mt-0.5" style={{ color: color ?? '#e4e4e7' }}>{value}</p>
    </div>
  )
}

function PillarRow({ value, label, desc, weight }: { value: number; label: string; desc: string; weight: number }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-zinc-200">{label}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{desc}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black leading-none" style={{ color: scoreColor(value) }}>{value}</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">{weight}%</p>
        </div>
      </div>
      <div className="h-1 rounded-full overflow-hidden mt-2" style={{ background: '#0d0d10' }}>
        <div className="h-full transition-all" style={{ width: `${value}%`, background: scoreColor(value) }} />
      </div>
    </div>
  )
}

function IssueCard({ issue, t }: { issue: Issue; t: ReturnType<typeof useTranslations> }) {
  const color = severityColor(issue.severity)
  return (
    <div className="rounded-xl p-3" style={{ background: '#18181b', border: `1px solid ${color}33` }}>
      <div className="flex items-start gap-2">
        <AlertCircle size={14} style={{ color }} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
              style={{ background: `${color}1a`, color }}>{t(`severity.${issue.severity}`)}</span>
            <span className="text-[10px] text-zinc-500">{t(`pillar.${issue.pillar}.short`)}</span>
          </div>
          <p className="text-xs text-zinc-200 mt-1.5">{issue.description}</p>
          <p className="text-[11px] text-zinc-400 mt-1.5">
            <span className="text-zinc-500">{t('drawer.action')}: </span>
            {issue.recommended_action}
          </p>
          {issue.current_value != null && issue.target_value != null && (
            <p className="text-[10px] text-zinc-600 mt-1">
              {t('drawer.current')}: <span className="text-zinc-400">{issue.current_value}</span> · {t('drawer.target')}: <span className="text-zinc-400">{issue.target_value}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl p-4 h-40 animate-pulse"
          style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <p className="sr-only">{t('loading')}</p>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ t, hasQuery }: { t: ReturnType<typeof useTranslations>; hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 rounded-2xl"
      style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <p className="text-sm font-semibold text-zinc-300">
        {hasQuery ? t('empty.searchTitle') : t('empty.title')}
      </p>
      <p className="text-xs text-zinc-500 text-center max-w-md">
        {hasQuery ? t('empty.searchDesc') : t('empty.desc')}
      </p>
    </div>
  )
}

function ErrorBanner({ error, onRetry, t }: { error: string; onRetry: () => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
      <AlertCircle size={14} className="text-red-400" />
      <p className="text-xs text-red-300 flex-1">{t('error', { msg: error })}</p>
      <button onClick={onRetry} className="text-xs text-red-300 underline">{t('retry')}</button>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${session?.access_token ?? ''}`,
  }
}

const brl = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function marginHex(pct: number): string {
  if (pct <= 0) return '#f87171'
  if (pct < 10) return '#fbbf24'
  return '#34d399'
}

function scoreColor(s: number): string {
  if (s >= 80) return '#34d399'  // emerald
  if (s >= 60) return CYAN        // cyan = "ok"
  if (s >= 40) return '#fbbf24'  // amber
  return '#f87171'                // red
}

function severityColor(sev: Severity): string {
  if (sev === 'high')   return '#f87171'
  if (sev === 'medium') return '#fbbf24'
  return '#71717a'
}

function pillarWeight(p: Pillar): number {
  if (p === 'relevance')        return 40
  if (p === 'performance')      return 30
  if (p === 'seller_quality')   return 20
  return 10
}

// "há X" a partir de um ISO (formato curto pt-BR).
function ago(iso: string): string {
  const d = new Date(iso).getTime()
  if (!Number.isFinite(d)) return '—'
  const min = Math.floor((Date.now() - d) / 60000)
  if (min < 1)  return 'agora'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h atrás`
  const days = Math.floor(h / 24)
  return `${days}d atrás`
}

// Botão de copiar (mesmo padrão do card ML).
function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  if (!text) return null
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500) }}
      className="ml-1 opacity-40 hover:opacity-100 transition-opacity" title="Copiar">
      {ok
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>}
    </button>
  )
}

// Gauge semicircular do Algorithm Score (mantém o diagnóstico visível no card).
function SemiGauge({ score, label }: { score: number | null; label: string }) {
  const W = 64, H = 40, cx = W / 2, cy = H - 4, r = 26
  const color = score == null ? '#3f3f46' : scoreColor(score)
  const arcLen = Math.PI * r
  const filled = score != null ? (score / 100) * arcLen : 0
  const fullCirc = 2 * Math.PI * r
  const offset = fullCirc * 0.75
  return (
    <div className="flex flex-col items-center shrink-0" style={{ width: W }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="visible">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e24" strokeWidth="5" strokeDasharray={`${arcLen} ${arcLen}`} strokeDashoffset={-offset} strokeLinecap="round" />
        {score != null && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={`${filled} ${fullCirc - filled}`} strokeDashoffset={-offset} strokeLinecap="round" style={{ transition: 'stroke-dasharray .5s' }} />
        )}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="12" fontWeight="800" fill={score != null ? color : '#52525b'}>{score != null ? score : '—'}</text>
      </svg>
      <p className="text-[9px] font-semibold" style={{ color }}>{label}</p>
    </div>
  )
}
