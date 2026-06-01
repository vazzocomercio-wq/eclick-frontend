'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle, RefreshCw, Search, Sparkles, X,
  Link2, Link2Off, Package, TrendingUp, TrendingDown,
  Boxes, DollarSign, Save, Pencil,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(it => (
            <Card key={`${it.shop_id}:${it.item_id}`} card={it} link={links.get(it.item_id) ?? null}
              onClick={() => setSelected(it)} t={t} />
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

function Card({ card, link, onClick, t }: { card: ListingCard; link: LinkInfo | null; onClick: () => void; t: ReturnType<typeof useTranslations> }) {
  const sColor = scoreColor(card.score)
  const m = link?.margin ?? null
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl p-4 transition-all hover:bg-[#15151a]"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}
    >
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0"
          style={{ background: '#18181b', border: '1px solid #27272a' }}>
          {card.main_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.main_image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">SH</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-zinc-600">#{card.item_id}</p>
          <p className="text-sm font-semibold text-zinc-200 line-clamp-2 leading-tight mt-0.5">
            {card.title ?? `Item ${card.item_id}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t('score')}</p>
          <p className="text-2xl font-black leading-none mt-1" style={{ color: sColor }}>
            {card.score}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-3">
        <PillarBar value={card.pillars.relevance}        label={t('pillar.relevance.short')}        weight={40} />
        <PillarBar value={card.pillars.performance}      label={t('pillar.performance.short')}      weight={30} />
        <PillarBar value={card.pillars.seller_quality}   label={t('pillar.seller_quality.short')}   weight={20} />
        <PillarBar value={card.pillars.price_marketing}  label={t('pillar.price_marketing.short')}  weight={10} />
      </div>

      {/* F18 Fase A/B — vínculo + margem */}
      <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: '#1e1e24' }}>
        {link?.linked && link.product ? (
          <span className="flex items-center gap-1 text-[10px] text-zinc-400 min-w-0">
            <Link2 size={11} className="text-emerald-400 shrink-0" />
            <span className="truncate">{link.product.sku ?? link.product.name}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-zinc-600">
            <Link2Off size={11} /> sem vínculo
          </span>
        )}
        {m && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold shrink-0"
            style={{ color: marginHex(m.contribution_margin_pct) }}>
            {m.contribution_margin_pct >= 10 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {m.contribution_margin_pct}%
          </span>
        )}
      </div>
    </button>
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
