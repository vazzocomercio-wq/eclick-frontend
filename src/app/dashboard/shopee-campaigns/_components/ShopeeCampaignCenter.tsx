'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle, AlertTriangle, RefreshCw, Tag, Zap, Megaphone,
  TrendingUp, Calendar, ShoppingBag, Calculator,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import MarginCalculatorModal from './MarginCalculatorModal'

/** F18 F1.4 — Shopee Campaign Center (READ-ONLY).
 *  CRUD vem na Sprint 2 quando creds Shopee aprovarem. */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const SHOPEE = '#EE4D2D'
const CYAN   = '#00E5FF'

type CampaignKind   = 'voucher' | 'flash_sale' | 'ads'
type CampaignStatus = 'planned' | 'active' | 'paused' | 'ended' | 'cancelled'

interface CampaignCard {
  id:               string
  shop_id:          number
  shop_name:        string | null
  kind:             CampaignKind
  status:           CampaignStatus
  title:            string
  config:           Record<string, unknown>
  starts_at:        string
  ends_at:          string | null
  metrics: {
    revenue_cents: number
    cost_cents:    number
    orders:        number
    views?:        number
    clicks?:       number
  }
  roi:             number | null
  margin_warning:  string | null
  created_at:      string
  updated_at:      string
}

type KindFilter = 'all' | CampaignKind

export default function ShopeeCampaignCenter() {
  const t = useTranslations('shopeeCampaigns')
  const [items, setItems]     = useState<CampaignCard[] | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<KindFilter>('all')
  const [showCalc, setShowCalc] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/campaigns?limit=100`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json() as { items: CampaignCard[]; total: number }
      setItems(body.items ?? [])
    } catch (e) {
      setError((e as Error).message)
      setItems([])
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = (items ?? []).filter(it => filter === 'all' || it.kind === filter)
  const summary = computeSummary(items ?? [])

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>
      <Header onRefresh={load} onOpenCalc={() => setShowCalc(true)} t={t} />
      {showCalc && <MarginCalculatorModal onClose={() => setShowCalc(false)} />}
      {error && <ErrorBanner error={error} onRetry={load} t={t} />}
      {items !== null && items.length > 0 && <SummaryCards summary={summary} t={t} />}
      <Tabs filter={filter} onChange={setFilter} counts={kindCounts(items ?? [])} t={t} />
      {items === null && !error ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState t={t} hasFilter={filter !== 'all'} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(c => <CampaignCardItem key={c.id} card={c} t={t} />)}
        </div>
      )}
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────

function Header({ onRefresh, onOpenCalc, t }: { onRefresh: () => void; onOpenCalc: () => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-zinc-500 text-xs">{t('breadcrumb')}</p>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <div>
        <h2 className="text-white text-lg font-semibold">{t('title')}</h2>
        <p className="text-zinc-500 text-xs">{t('subtitle')}</p>
      </div>
      <button
        onClick={onOpenCalc}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{ background: `${CYAN}15`, color: CYAN, border: `1px solid ${CYAN}40` }}
      >
        <Calculator size={12} />
        {t('marginCalc.openBtn')}
      </button>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
        style={{ borderColor: '#2e2e33', color: '#a1a1aa', background: '#111114' }}
      >
        <RefreshCw size={12} />
        {t('refresh')}
      </button>
    </div>
  )
}

// ── Summary cards ──────────────────────────────────────────────────────────

interface Summary {
  active:        number
  revenueCents:  number
  costCents:     number
  orders:        number
  blendedROI:    number | null
}

function computeSummary(items: CampaignCard[]): Summary {
  let revenue = 0, cost = 0, orders = 0, active = 0
  for (const it of items) {
    if (it.status === 'active') active++
    revenue += it.metrics.revenue_cents
    cost    += it.metrics.cost_cents
    orders  += it.metrics.orders
  }
  return {
    active,
    revenueCents: revenue,
    costCents:    cost,
    orders,
    blendedROI:   cost > 0 ? (revenue - cost) / cost : null,
  }
}

function SummaryCards({ summary, t }: { summary: Summary; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <SummaryTile label={t('summary.active')}     value={String(summary.active)}                    accent={CYAN} />
      <SummaryTile label={t('summary.revenue')}    value={formatBRL(summary.revenueCents)}           accent="#34d399" />
      <SummaryTile label={t('summary.cost')}       value={formatBRL(summary.costCents)}              accent="#fbbf24" />
      <SummaryTile label={t('summary.blendedROI')} value={summary.blendedROI != null ? `${summary.blendedROI.toFixed(1)}x` : '—'} accent={roiColor(summary.blendedROI)} />
    </div>
  )
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
      <p className="text-lg font-black mt-1" style={{ color: accent }}>{value}</p>
    </div>
  )
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function kindCounts(items: CampaignCard[]) {
  const c: Record<CampaignKind, number> = { voucher: 0, flash_sale: 0, ads: 0 }
  for (const it of items) c[it.kind]++
  return c
}

function Tabs({ filter, onChange, counts, t }: {
  filter:   KindFilter
  onChange: (k: KindFilter) => void
  counts:   Record<CampaignKind, number>
  t:        ReturnType<typeof useTranslations>
}) {
  const tabs: Array<{ key: KindFilter; label: string; count?: number }> = [
    { key: 'all',        label: t('tabs.all'),         count: counts.voucher + counts.flash_sale + counts.ads },
    { key: 'voucher',    label: t('tabs.voucher'),     count: counts.voucher },
    { key: 'flash_sale', label: t('tabs.flash_sale'),  count: counts.flash_sale },
    { key: 'ads',        label: t('tabs.ads'),         count: counts.ads },
  ]
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {tabs.map(tab => {
        const active = filter === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0"
            style={{
              background: active ? CYAN + '18'   : '#111114',
              color:      active ? CYAN          : '#a1a1aa',
              border:     `1px solid ${active ? CYAN + '55' : '#1e1e24'}`,
            }}
          >
            {tab.label}
            <span className="text-[10px] opacity-75">{tab.count ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Campaign card ──────────────────────────────────────────────────────────

function CampaignCardItem({ card, t }: { card: CampaignCard; t: ReturnType<typeof useTranslations> }) {
  const kindMeta = KIND_META[card.kind]
  const sColor = statusColor(card.status)
  return (
    <div className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: kindMeta.bg, color: kindMeta.color }}>
          {kindMeta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] uppercase tracking-wider font-bold"
              style={{ color: kindMeta.color }}>{t(`kind.${card.kind}`)}</span>
            <StatusPill status={card.status} t={t} />
          </div>
          <p className="text-sm font-semibold text-zinc-100 truncate">{card.title}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
            {card.shop_name ?? `Shop #${card.shop_id}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t('roi')}</p>
          <p className="text-xl font-black leading-none mt-0.5" style={{ color: roiColor(card.roi) }}>
            {card.roi != null ? `${card.roi.toFixed(1)}x` : '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <MetricMini icon={<TrendingUp size={11} />} label={t('metric.revenue')} value={formatBRL(card.metrics.revenue_cents)} color="#34d399" />
        <MetricMini icon={<Tag       size={11} />} label={t('metric.cost')}    value={formatBRL(card.metrics.cost_cents)}    color="#fbbf24" />
        <MetricMini icon={<ShoppingBag size={11} />} label={t('metric.orders')}  value={String(card.metrics.orders)}           color={CYAN} />
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#1e1e24' }}>
        <Calendar size={11} className="text-zinc-600 shrink-0" />
        <p className="text-[10px] text-zinc-500 truncate">
          {formatRange(card.starts_at, card.ends_at, t)}
        </p>
      </div>

      {card.margin_warning && (
        <div className="mt-3 rounded-lg p-2.5 flex items-start gap-2"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-200 leading-relaxed">{card.margin_warning}</p>
        </div>
      )}

      {/* status footer: applies only to active/paused for the colored bar */}
      <div className="h-0.5 rounded-full mt-3" style={{ background: sColor, opacity: 0.4 }} />
    </div>
  )
}

function MetricMini({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
        <span style={{ color }}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className="text-xs font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  )
}

function StatusPill({ status, t }: { status: CampaignStatus; t: ReturnType<typeof useTranslations> }) {
  const c = statusColor(status)
  return (
    <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
      style={{ background: `${c}1a`, color: c }}>
      {t(`status.${status}`)}
    </span>
  )
}

// ── States ─────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl h-44 animate-pulse"
          style={{ background: '#111114', border: '1px solid #1e1e24' }} />
      ))}
    </div>
  )
}

function EmptyState({ t, hasFilter }: { t: ReturnType<typeof useTranslations>; hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 rounded-2xl"
      style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <p className="text-sm font-semibold text-zinc-300">
        {hasFilter ? t('empty.filterTitle') : t('empty.title')}
      </p>
      <p className="text-xs text-zinc-500 text-center max-w-md">
        {hasFilter ? t('empty.filterDesc') : t('empty.desc')}
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

const KIND_META: Record<CampaignKind, { icon: React.ReactNode; color: string; bg: string }> = {
  voucher:    { icon: <Tag       size={16} />, color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  flash_sale: { icon: <Zap       size={16} />, color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  ads:        { icon: <Megaphone size={16} />, color: SHOPEE,    bg: 'rgba(238,77,45,0.15)' },
}

function statusColor(s: CampaignStatus): string {
  if (s === 'active')    return '#34d399'
  if (s === 'paused')    return '#fbbf24'
  if (s === 'planned')   return CYAN
  if (s === 'ended')     return '#71717a'
  return '#f87171'
}

function roiColor(roi: number | null): string {
  if (roi == null)  return '#71717a'
  if (roi >= 3)     return '#34d399'
  if (roi >= 1)     return CYAN
  if (roi >= 0)     return '#fbbf24'
  return '#f87171'
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
}

function formatRange(starts: string, ends: string | null, t: ReturnType<typeof useTranslations>): string {
  const s = new Date(starts).toLocaleDateString('pt-BR')
  if (!ends) return t('window.fromOpen', { d: s })
  const e = new Date(ends).toLocaleDateString('pt-BR')
  return t('window.range', { from: s, to: e })
}
