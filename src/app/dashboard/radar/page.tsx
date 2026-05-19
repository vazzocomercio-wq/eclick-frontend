'use client'

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  Boxes, Users, Activity, TrendingDown, ArrowUpDown, Search, ChevronRight,
} from 'lucide-react'
import { AnimatedRadarIcon } from '@/components/AnimatedRadarIcon'
import { api } from './_components/api'
import { brl, pct, severityOf, eventLabel, relativeTime, secureImg } from './_components/shared'
import { computeContributionMargin, round2 } from '@/lib/margin'

interface Summary {
  products_monitored: number
  products_total: number
  competitors: number
  new_events: number
  products_losing_lead: number
  market_demand_total: number
  conversion: {
    rate: number | null
    confidence: 'ok' | 'low'
    own_visits: number
    own_units: number
    calc_date: string | null
  }
}

interface RadarEvent {
  id: string
  catalog_product_ref: string
  event_type: string
  severity: string
  detected_at: string
  catalog: { id: string; title: string | null } | null
}

interface RadarProduct {
  id: string
  catalog_product_id: string
  title: string | null
  category_id: string | null
  status: string
  competitors: number
  total_offers: number
  min_price: number | null
  vazzo_price: number | null
  runner_up_price: number | null
  vazzo_has_lead: boolean
  price_delta_pct: number | null
  new_events: number
  market_demand: number | null
  sku: string | null
  thumbnail: string | null
  price_to_win: number | null
  catalog_status: string | null
  vazzo_item_id: string | null
}

type SortKey =
  | 'title' | 'competitors' | 'min_price' | 'catalog_status'
  | 'price_delta_pct' | 'new_events' | 'market_demand'

interface PriceContext {
  has_listing: boolean
  item_id: string | null
  current_price: number | null
  price_to_win: number | null
  catalog_status: string | null
  cost: number | null
  tax_pct: number | null
  fee_pct: number | null
  fixed_fee: number | null
  shipping_cost: number | null
  runner_up_price: number | null
  runner_up_seller: string | null
}

const CARD = { background: '#111114', border: '1px solid #1a1a1f' }

/** Regra ML: frete grátis só é obrigatório (custo do vendedor) a partir
 *  de R$79. Abaixo disso o comprador paga — o vendedor não arca com frete. */
const FREE_SHIPPING_MIN = 79

export default function RadarPage() {
  const t = useTranslations('radar')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [events, setEvents] = useState<RadarEvent[]>([])
  const [products, setProducts] = useState<RadarProduct[]>([])

  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'pausado'>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('new_events')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [adjust, setAdjust] = useState<RadarProduct | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, e, p] = await Promise.all([
        api<Summary>('/radar/summary'),
        api<RadarEvent[]>('/radar/events?limit=40'),
        api<RadarProduct[]>('/radar/products'),
      ])
      setSummary(s)
      setEvents(e)
      setProducts(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorLoadRadar'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    let rows = products
    if (statusFilter !== 'all') rows = rows.filter(p => p.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) rows = rows.filter(p => (p.title ?? '').toLowerCase().includes(q)
      || p.catalog_product_id.toLowerCase().includes(q))
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = sortVal(a, sortKey)
      const bv = sortVal(b, sortKey)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [products, statusFilter, search, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('desc') }
  }

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <AnimatedRadarIcon size={44} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#fafafa' }}>e-Click Radar IA</h1>
          <p className="text-sm mt-0.5" style={{ color: '#71717a' }}>
            {t('headerSubtitle')}
          </p>
        </div>
        <Link href="/dashboard/radar/concorrentes"
          className="ml-auto self-center inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-white/[0.04]"
          style={{ border: '1px solid #27272a', color: '#a1a1aa' }}>
          <Users size={14} style={{ color: '#00E5FF' }} /> {t('linkedCompetitors')}
        </Link>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm mb-5" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>{error}</div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label={t('kpiMonitored')} value={summary?.products_monitored} loading={loading}
          icon={<Boxes size={15} />} accent="#00E5FF" />
        <Kpi label={t('kpiCompetitors')} value={summary?.competitors} loading={loading}
          icon={<Users size={15} />} accent="#a1a1aa" />
        <Kpi label={t('kpiNewEvents')} value={summary?.new_events} loading={loading}
          icon={<Activity size={15} />} accent="#00E5FF" />
        <Kpi label={t('kpiLosingLead')} value={summary?.products_losing_lead} loading={loading}
          icon={<TrendingDown size={15} />} accent="#f59e0b" />
      </div>

      {summary?.conversion && (
        <p className="text-[11px] mb-5 -mt-1" style={{
          color: summary.conversion.confidence === 'low' ? '#fbbf24' : '#52525b',
        }}>
          {summary.conversion.rate == null
            ? t('conversionNotCalibrated')
            : t('conversionCalibrated', {
                rate: (summary.conversion.rate * 100).toFixed(1).replace('.', ','),
                visits: summary.conversion.own_visits,
                units: summary.conversion.own_units,
              }) + (summary.conversion.confidence === 'low' ? t('conversionSmallSample') : '')}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* O que mudou */}
        <section className="rounded-xl overflow-hidden" style={CARD}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a1a1f' }}>
            <Activity size={15} style={{ color: '#00E5FF' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#fafafa' }}>{t('whatChanged')}</h2>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {loading && <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-zinc-800/40 animate-pulse" />)}
            </div>}
            {!loading && events.length === 0 && (
              <div className="p-8 text-center">
                <Activity size={26} className="mx-auto mb-2" style={{ color: '#3f3f46' }} />
                <p className="text-sm" style={{ color: '#a1a1aa' }}>{t('noRecentChanges')}</p>
                <p className="text-xs mt-1" style={{ color: '#52525b' }}>
                  {t('collectionRunsDaily')}
                </p>
              </div>
            )}
            {!loading && events.map(ev => {
              const sev = severityOf(ev.severity)
              return (
                <Link key={ev.id} href={`/dashboard/radar/${ev.catalog_product_ref}`}
                  className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-zinc-900/50 transition-colors"
                  style={{ borderBottom: '1px solid #18181b', borderLeft: `2px solid ${sev.rule}` }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: '#fafafa' }}>
                      {eventLabel(ev.event_type)}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: '#71717a' }}>
                      {ev.catalog?.title ?? t('catalogProduct')}
                    </p>
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: '#52525b' }}>
                    {relativeTime(ev.detected_at)}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Tabela de produtos */}
        <section className="lg:col-span-2 rounded-xl overflow-hidden" style={CARD}>
          <div className="px-4 py-3 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid #1a1a1f' }}>
            <h2 className="text-sm font-semibold mr-auto" style={{ color: '#fafafa' }}>
              {t('monitoredProducts')} {!loading && <span style={{ color: '#52525b' }}>· {visible.length}</span>}
            </h2>
            <div className="flex items-center gap-1.5 rounded-lg px-2 py-1"
              style={{ background: '#09090b', border: '1px solid #27272a' }}>
              <Search size={13} style={{ color: '#52525b' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchProduct')}
                className="bg-transparent text-xs outline-none w-40" style={{ color: '#fafafa' }} />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="text-xs rounded-lg px-2 py-1.5 outline-none"
              style={{ background: '#09090b', border: '1px solid #27272a', color: '#a1a1aa' }}>
              <option value="all">{t('statusAll')}</option>
              <option value="ativo">{t('statusActive')}</option>
              <option value="pausado">{t('statusPaused')}</option>
            </select>
          </div>

          {/* header */}
          <div className="flex items-center gap-3 px-4 py-2 text-[10px] uppercase tracking-wide"
            style={{ borderBottom: '1px solid #1a1a1f', color: '#52525b' }}>
            <Th label={t('colProduct')} k="title" cur={sortKey} dir={sortDir} onSort={toggleSort} className="flex-1" />
            <Th label={t('colComp')} k="competitors" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-14 justify-end" />
            <Th label={t('colMinPrice')} k="min_price" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-24 justify-end" />
            <Th label={t('colCatalog')} k="catalog_status" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-28 justify-center" />
            <Th label={t('colPriceDelta')} k="price_delta_pct" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-20 justify-end" />
            <Th label={t('colDemand')} k="market_demand" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-20 justify-end" />
            <Th label={t('colEvents')} k="new_events" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-16 justify-end" />
            <span className="w-4" />
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {loading && <div className="p-4 space-y-2">
              {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-11 rounded-lg bg-zinc-800/40 animate-pulse" />)}
            </div>}
            {!loading && visible.length === 0 && (
              <div className="p-10 text-center">
                <Boxes size={28} className="mx-auto mb-2" style={{ color: '#3f3f46' }} />
                <p className="text-sm" style={{ color: '#a1a1aa' }}>{t('noProductsInFilter')}</p>
              </div>
            )}
            {!loading && visible.map(p => (
              <Link key={p.id} href={`/dashboard/radar/${p.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-900/50 transition-colors"
                style={{ borderBottom: '1px solid #18181b' }}>
                <div className="flex-1 min-w-0 flex items-center gap-2.5">
                  {p.thumbnail
                    ? <img src={secureImg(p.thumbnail)} alt="" loading="lazy"
                        className="h-9 w-9 rounded object-cover shrink-0"
                        style={{ border: '1px solid #27272a' }} />
                    : <div className="h-9 w-9 rounded shrink-0"
                        style={{ background: '#1a1a1f', border: '1px solid #27272a' }} />}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: '#fafafa' }}>
                      {p.title ?? p.catalog_product_id}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: '#52525b' }}>
                      {p.sku ? `${t('skuLabel', { sku: p.sku })} · ` : ''}{p.catalog_product_id}
                    </p>
                  </div>
                </div>
                <span className="w-14 text-right text-xs tabular-nums" style={{ color: '#a1a1aa' }}>
                  {p.competitors}
                </span>
                <span className="w-24 text-right text-xs tabular-nums font-medium" style={{ color: '#fafafa' }}>
                  {brl(p.min_price)}
                </span>
                <span className="w-28 flex justify-center">
                  <CatalogCell status={p.catalog_status} priceToWin={p.price_to_win}
                    hasLeadFallback={p.vazzo_has_lead} hasPrice={p.min_price != null}
                    runnerUpPrice={p.runner_up_price} vazzoPrice={p.vazzo_price}
                    onAdjust={p.vazzo_item_id
                      ? (e) => { e.preventDefault(); e.stopPropagation(); setAdjust(p) }
                      : undefined} />
                </span>
                <span className="w-20 text-right text-xs tabular-nums" style={{
                  color: p.price_delta_pct == null ? '#52525b'
                    : p.price_delta_pct < 0 ? '#22c55e' : p.price_delta_pct > 0 ? '#f87171' : '#71717a',
                }}>
                  {pct(p.price_delta_pct)}
                </span>
                <span className="w-20 text-right text-xs tabular-nums" style={{ color: '#a1a1aa' }}>
                  {p.market_demand == null ? '—' : `~${p.market_demand.toLocaleString('pt-BR')}`}
                </span>
                <span className="w-16 flex justify-end">
                  {p.new_events > 0 ? (
                    <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 tabular-nums"
                      style={{ background: 'rgba(0,229,255,0.12)', color: '#67e8f9' }}>
                      {p.new_events}
                    </span>
                  ) : <span className="text-xs" style={{ color: '#3f3f46' }}>—</span>}
                </span>
                <ChevronRight size={14} className="w-4 shrink-0" style={{ color: '#3f3f46' }} />
              </Link>
            ))}
          </div>
        </section>
      </div>

      {adjust && (
        <PriceAdjustModal product={adjust}
          onClose={() => setAdjust(null)}
          onSaved={() => { setAdjust(null); void load() }} />
      )}
    </div>
  )
}

function PriceAdjustModal({ product, onClose, onSaved }: {
  product: RadarProduct; onClose: () => void; onSaved: () => void
}) {
  const t = useTranslations('radar')
  const [ctx, setCtx] = useState<PriceContext | null>(null)
  const [price, setPrice] = useState(
    product.price_to_win != null ? String(product.price_to_win)
      : product.vazzo_price != null ? String(product.vazzo_price) : '',
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Puxa custo, tarifa, frete e preço pra ganhar pra calcular a margem.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const c = await api<PriceContext>(`/radar/products/${product.id}/price-context`)
        if (!alive) return
        setCtx(c)
        if (c.price_to_win != null && product.price_to_win == null) setPrice(String(c.price_to_win))
      } catch { /* segue sem o contexto detalhado */ }
    })()
    return () => { alive = false }
  }, [product.id, product.price_to_win])

  /** Margem de contribuição (%) num dado preço, com os custos puxados.
   *  Regra ML: abaixo de R$79 o frete é do comprador — o vendedor não
   *  arca com ele, então some do cálculo da margem. */
  const marginAt = (p: number | null | undefined): number | null => {
    if (p == null || p <= 0 || !ctx || ctx.cost == null) return null
    const fee = ctx.fee_pct != null ? p * ctx.fee_pct / 100 + (ctx.fixed_fee ?? 0) : 0
    const shipping = p >= FREE_SHIPPING_MIN ? (ctx.shipping_cost ?? 0) : 0
    const m = computeContributionMargin({
      price: p, saleFee: fee, shipping,
      cost: ctx.cost, taxPercentage: ctx.tax_pct ?? 0, taxOnFreight: false,
    })
    return m.contributionMarginPct
  }
  const marginColor = (m: number | null): string =>
    m == null ? '#71717a' : m >= 15 ? '#4ade80' : m >= 5 ? '#fbbf24' : '#f87171'
  const fmtPct = (m: number | null): string =>
    m == null ? '—' : `${m.toFixed(1).replace('.', ',')}%`

  const currentPrice = ctx?.current_price ?? product.vazzo_price
  const ptw = ctx?.price_to_win ?? product.price_to_win
  const newNum = Number(price.replace(',', '.'))
  const mCur = marginAt(currentPrice)
  const mPtw = marginAt(ptw)
  const mNew = marginAt(Number.isFinite(newNum) ? newNum : null)

  // Ganhando o catálogo? → mostra o "teto" (até onde dá pra subir sem perder
  // a ponta) em vez do "preço pra ganhar". Teto = concorrente mais barato − 1¢.
  const status = ctx?.catalog_status ?? product.catalog_status
  const winning = status === 'winning' || (status == null && product.vazzo_has_lead)
  const runnerUp = ctx?.runner_up_price ?? product.runner_up_price ?? null
  const teto = runnerUp != null ? round2(runnerUp - 0.01) : null
  const mTeto = marginAt(teto)

  const submit = async () => {
    const n = Number(price.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) { setErr(t('enterValidPrice')); return }
    setErr(null)
    setSaving(true)
    try {
      await api(`/ml/listings/${product.vazzo_item_id}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ price: n }),
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errorAdjustPrice'))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl p-5" style={CARD} onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: '#fafafa' }}>
          {t('adjustPriceMl')}
        </h2>
        <p className="text-xs mb-4 truncate" style={{ color: '#71717a' }}>
          {product.title ?? product.catalog_product_id}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg p-2.5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            <p className="text-[10px]" style={{ color: '#71717a' }}>{t('currentPrice')}</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: '#fafafa' }}>{brl(currentPrice)}</p>
            <p className="text-[10px] tabular-nums mt-0.5" style={{ color: marginColor(mCur) }}>
              {t('marginValue', { value: fmtPct(mCur) })}
            </p>
          </div>
          {winning ? (
            <div className="rounded-lg p-2.5"
              style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <div className="flex items-center justify-between">
                <p className="text-[10px]" style={{ color: '#4ade80' }}>{t('catalogCeiling')}</p>
                {teto != null && (
                  <button onClick={() => setPrice(String(teto))}
                    className="text-[9px] hover:underline" style={{ color: '#4ade80' }}>{t('use')}</button>
                )}
              </div>
              <p className="text-sm font-semibold tabular-nums" style={{ color: '#4ade80' }}>
                {teto != null ? brl(teto) : t('free')}
              </p>
              <p className="text-[10px] tabular-nums mt-0.5"
                style={{ color: teto != null ? marginColor(mTeto) : '#52525b' }}>
                {teto != null ? t('marginValue', { value: fmtPct(mTeto) }) : t('noCompetitors')}
              </p>
            </div>
          ) : (
            <div className="rounded-lg p-2.5"
              style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
              <div className="flex items-center justify-between">
                <p className="text-[10px]" style={{ color: '#67e8f9' }}>{t('priceToWin')}</p>
                {ptw != null && (
                  <button onClick={() => setPrice(String(ptw))}
                    className="text-[9px] hover:underline" style={{ color: '#67e8f9' }}>{t('use')}</button>
                )}
              </div>
              <p className="text-sm font-semibold tabular-nums" style={{ color: '#67e8f9' }}>
                {ptw != null ? brl(ptw) : '—'}
              </p>
              <p className="text-[10px] tabular-nums mt-0.5" style={{ color: marginColor(mPtw) }}>
                {t('marginValue', { value: fmtPct(mPtw) })}
              </p>
            </div>
          )}
        </div>

        {winning && runnerUp != null && (
          <p className="text-[11px] mb-3" style={{ color: '#71717a' }}>
            {t.rich('cheapestCompetitorHint', {
              seller: ctx?.runner_up_seller ? ` (${ctx.runner_up_seller})` : '',
              price: brl(runnerUp),
              ceiling: brl(teto),
              priceVal: (chunks) => <span className="tabular-nums" style={{ color: '#a1a1aa' }}>{chunks}</span>,
              ceilingVal: (chunks) => <span className="tabular-nums font-medium" style={{ color: '#4ade80' }}>{chunks}</span>,
            })}
          </p>
        )}

        <label className="text-[11px] block mb-1" style={{ color: '#a1a1aa' }}>{t('newPrice')}</label>
        <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" autoFocus
          className="w-full rounded-lg px-3 py-2 text-sm tabular-nums outline-none"
          style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
        <p className="text-[11px] mt-1.5 mb-3 tabular-nums font-medium" style={{ color: marginColor(mNew) }}>
          {mNew != null
            ? t('marginAtPrice', { value: fmtPct(mNew) })
            : (ctx && ctx.cost == null
                ? t('registerCostForMargin')
                : t('marginAtPrice', { value: '—' }))}
        </p>

        {ctx && ctx.cost != null && (
          <p className="text-[10px] mb-3" style={{ color: '#52525b' }}>
            {t('costLabel', { value: brl(ctx.cost) })}
            {ctx.fee_pct != null ? ` · ${t('mlFeeLabel', { value: ctx.fee_pct.toFixed(1).replace('.', ',') })}` : ''}
            {Number.isFinite(newNum) && newNum < FREE_SHIPPING_MIN
              ? ` · ${t('shippingBuyerPays')}`
              : ctx.shipping_cost != null ? ` · ${t('shippingLabel', { value: brl(ctx.shipping_cost) })}` : ''}
            {(ctx.tax_pct ?? 0) > 0 ? ` · ${t('taxLabel', { value: ctx.tax_pct ?? 0 })}` : ''}
          </p>
        )}

        <p className="text-[10px] mb-3" style={{ color: '#fbbf24' }}>
          {t('warnRealPriceChange')}
        </p>
        {err && (
          <div className="rounded-lg p-2.5 text-xs mb-3" style={{
            background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
          }}>{err}</div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg py-2 text-xs font-medium"
            style={{ border: '1px solid #27272a', color: '#a1a1aa' }}>{t('cancel')}</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 rounded-lg py-2 text-xs font-medium transition-opacity disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#09090b' }}>
            {saving ? t('applying') : t('confirmOnMl')}
          </button>
        </div>
      </div>
    </div>
  )
}

function sortVal(p: RadarProduct, k: SortKey): string | number | null {
  if (k === 'title') return (p.title ?? p.catalog_product_id).toLowerCase()
  if (k === 'catalog_status') {
    if (p.catalog_status === 'winning') return 3
    if (p.catalog_status === 'sharing_first_place') return 2
    if (p.catalog_status) return 1
    return p.vazzo_has_lead ? 3 : 0 // fallback enquanto a coleta não rodou
  }
  return p[k]
}

function Kpi(props: {
  label: string; value: number | undefined; loading: boolean; icon: ReactNode; accent: string
}) {
  return (
    <div className="rounded-xl p-4" style={CARD}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: props.accent }}>
        {props.icon}
        <span className="text-[11px] font-medium" style={{ color: '#71717a' }}>{props.label}</span>
      </div>
      {props.loading
        ? <div className="h-7 w-16 rounded bg-zinc-800/60 animate-pulse" />
        : <div className="text-2xl font-bold tabular-nums" style={{ color: '#fafafa' }}>
            {props.value ?? 0}
          </div>}
    </div>
  )
}

/** Status real do catálogo (price_to_win do ML) + preço pra ganhar.
 * Enquanto a coleta não rodou (catalog_status null), cai no heurístico de
 * menor preço — mesmo rótulo, vira dado real na próxima coleta diária. */
function CatalogCell({ status, priceToWin, hasLeadFallback, hasPrice, runnerUpPrice, vazzoPrice, onAdjust }: {
  status: string | null; priceToWin: number | null; hasLeadFallback: boolean; hasPrice: boolean
  runnerUpPrice?: number | null; vazzoPrice?: number | null
  onAdjust?: (e: MouseEvent) => void
}) {
  const t = useTranslations('radar')
  let label: string
  let bg: string
  let text: string
  let winning: boolean

  if (status === 'winning') {
    label = t('catalogWinning'); bg = 'rgba(34,197,94,0.12)'; text = '#4ade80'; winning = true
  } else if (status === 'sharing_first_place') {
    label = t('catalogTied'); bg = 'rgba(245,158,11,0.12)'; text = '#fbbf24'; winning = false
  } else if (status) {
    label = t('catalogLosing'); bg = 'rgba(239,68,68,0.12)'; text = '#f87171'; winning = false
  } else if (!hasPrice) {
    return <span className="text-xs" style={{ color: '#3f3f46' }}>—</span>
  } else {
    winning = hasLeadFallback
    label = winning ? t('catalogWinning') : t('catalogLosing')
    bg = winning ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'
    text = winning ? '#4ade80' : '#f87171'
  }

  // Teto do catálogo (quando ganhando): até onde dá pra subir o preço sem
  // perder a ponta — concorrente mais barato − R$ 0,01.
  const teto = winning && runnerUpPrice != null ? round2(runnerUpPrice - 0.01) : null
  const folga = teto != null && vazzoPrice != null && teto > vazzoPrice
    ? round2(teto - vazzoPrice)
    : null
  const tetoTitle = teto != null
    ? (folga != null
        ? t('catalogCeilingTitleWithSlack', { ceiling: brl(teto), slack: brl(folga) })
        : t('catalogCeilingTitle', { ceiling: brl(teto) }))
    : undefined

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-semibold rounded-full px-2 py-0.5"
        style={{ background: bg, color: text }}>{label}</span>
      {onAdjust ? (
        <button onClick={onAdjust} title={tetoTitle}
          className="text-[9px] tabular-nums hover:underline"
          style={{ color: teto != null ? '#4ade80' : '#67e8f9' }}>
          {!winning && priceToWin != null ? `→ ${brl(priceToWin)}`
            : teto != null ? t('ceilingShort', { value: brl(teto) })
            : t('adjustPrice')}
        </button>
      ) : teto != null ? (
        <span className="text-[9px] tabular-nums" style={{ color: '#4ade80' }} title={tetoTitle}>
          {t('ceilingShort', { value: brl(teto) })}
        </span>
      ) : (!winning && priceToWin != null && (
        <span className="text-[9px] tabular-nums" style={{ color: '#67e8f9' }}>
          → {brl(priceToWin)}
        </span>
      ))}
    </div>
  )
}

function Th(props: {
  label: string; k: SortKey; cur: SortKey; dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void; className?: string
}) {
  const active = props.cur === props.k
  return (
    <button onClick={() => props.onSort(props.k)}
      className={`flex items-center gap-1 hover:text-zinc-300 transition-colors ${props.className ?? ''}`}
      style={{ color: active ? '#00E5FF' : undefined }}>
      {props.label}
      <ArrowUpDown size={10} style={{ opacity: active ? 1 : 0.4 }} />
    </button>
  )
}
