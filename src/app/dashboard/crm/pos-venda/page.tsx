'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Clock, Star, TrendingDown, Package, ExternalLink,
} from 'lucide-react'

type TFn = (key: string, values?: Record<string, string | number>) => string

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type ReputationMetric = { rate: number; value: number; period: string }
type Reputation = {
  level_id?: string
  power_seller_status?: string | null
  transactions?: {
    total: number
    canceled: number
    completed: number
    period: string
    ratings?: { positive: number; negative: number; neutral: number }
  }
  metrics?: {
    sales?: { completed: number; period: string }
    claims?: ReputationMetric
    delayed_handling_time?: ReputationMetric
    cancellations?: ReputationMetric
  }
}

type Claim = {
  id: string | number
  resource_id?: string | number
  reason?: { id?: string; label?: string }
  status?: string
  type?: string
  date_created?: string
  last_updated?: string
  players?: { role: string; user_id: number; available_actions?: string[] }[]
  resolution?: { reason?: string } | null
}

type Order = {
  id: number
  status: string
  date_created: string
  total_amount: number
  order_items: { item: { id: string; title: string; thumbnail?: string }; quantity: number }[]
  buyer: { id: number; nickname: string }
  shipping?: { status: string; substatus?: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_CFG: Record<string, { color: string; bg: string }> = {
  '5_green':       { color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  '4_light_green': { color: '#a3e635', bg: 'rgba(163,230,53,0.12)' },
  '3_yellow':      { color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  '2_orange':      { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  '1_red':         { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

/** Resolve cor + label do nível. label vem traduzido via t() quando o id é conhecido. */
function levelCfg(t: TFn, levelId?: string) {
  if (!levelId) return { label: t('levels.na'), color: '#71717a', bg: 'rgba(113,113,122,0.12)' }
  const cfg = LEVEL_CFG[levelId]
  if (cfg) return { label: t(`levels.${levelId}`), color: cfg.color, bg: cfg.bg }
  return { label: levelId, color: '#a1a1aa', bg: 'rgba(161,161,170,0.12)' }
}

function fmtRate(r: number) {
  return `${(r * 100).toFixed(1)}%`
}

function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CLAIM_REASON_KEYS = ['PNR', 'PDD', 'PNDA', 'WP']

const ORDER_STATUS_COLOR: Record<string, string> = {
  paid:               '#4ade80',
  confirmed:          '#60a5fa',
  payment_in_process: '#facc15',
  cancelled:          '#f87171',
  invalid:            '#71717a',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = '#a1a1aa', icon }: {
  label: string; value: string; sub?: string; color?: string; icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl p-4 space-y-2" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-500">{sub}</p>}
    </div>
  )
}

function MetricBar({ label, rate, color }: { label: string; rate: number; color: string }) {
  const pct = Math.min(rate * 100, 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">{label}</span>
        <span className="text-[11px] font-semibold" style={{ color }}>{fmtRate(rate)}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: '#1e1e24' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function ClaimRow({ claim, t }: { claim: Claim; t: TFn }) {
  const reasonId  = claim.reason?.id ?? ''
  const reasonLbl = claim.reason?.label
    ?? (CLAIM_REASON_KEYS.includes(reasonId) ? t(`claimReasons.${reasonId}`) : '')
    ?? reasonId
    ?? t('claimDefault')
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: '#1e1e24' }}>
      <AlertTriangle size={13} className="shrink-0 text-amber-400" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-zinc-200 truncate">{reasonLbl || t('claimDefault')}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">{t('orderNumber', { id: String(claim.resource_id ?? claim.id) })} · {fmtDate(claim.date_created)}</p>
      </div>
      <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
        {claim.status ?? t('claimOpen')}
      </span>
      {claim.resource_id && (
        <a href={`https://www.mercadolivre.com.br/vendas/${claim.resource_id}`} target="_blank" rel="noreferrer"
          className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors">
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  )
}

function OrderRow({ order, t }: { order: Order; t: TFn }) {
  const item  = order.order_items?.[0]
  const title = item?.item?.title ?? t('orderNumber', { id: String(order.id) })
  const stColor = ORDER_STATUS_COLOR[order.status] ?? '#a1a1aa'
  const stLabel = ORDER_STATUS_COLOR[order.status] ? t(`orderStatus.${order.status}`) : order.status
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: '#1e1e24' }}>
      <Package size={13} className="shrink-0 text-zinc-500" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-zinc-200 truncate">{title}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          {order.buyer?.nickname ?? `#${order.buyer?.id}`} · {fmtBRL(order.total_amount)} · {fmtDate(order.date_created)}
        </p>
      </div>
      <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: stColor + '1a', color: stColor }}>
        {stLabel}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PosVendaPage() {
  const t = useTranslations('crm.posVenda')
  const [rep,     setRep]     = useState<Reputation | null>(null)
  const [claims,  setClaims]  = useState<Claim[]>([])
  const [orders,  setOrders]  = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setLoading(false); return }
    const h = { Authorization: `Bearer ${session.access_token}` }

    try {
      const [repRes, claimRes, orderRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/reputation`,      { headers: h }),
        fetch(`${BACKEND}/ml/claims`,          { headers: h }),
        fetch(`${BACKEND}/ml/orders/enriched?limit=20`, { headers: h }),
      ])

      if (repRes.status === 'fulfilled' && repRes.value.ok) {
        setRep(await repRes.value.json())
      }
      if (claimRes.status === 'fulfilled' && claimRes.value.ok) {
        const d = await claimRes.value.json()
        setClaims(d?.data ?? d ?? [])
      }
      if (orderRes.status === 'fulfilled' && orderRes.value.ok) {
        const d = await orderRes.value.json()
        setOrders(d?.orders ?? d ?? [])
      }
    } catch (e: any) {
      setError(e?.message ?? t('loadError'))
    }
    setLoading(false)
  }, [t])

  useEffect(() => { load() }, [load])

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const lvl      = levelCfg(t, rep?.level_id)
  const metrics  = rep?.metrics
  const txn      = rep?.transactions
  const claimRate   = metrics?.claims?.rate ?? 0
  const cancelRate  = metrics?.cancellations?.rate ?? 0
  const delayRate   = metrics?.delayed_handling_time?.rate ?? 0

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: 'var(--background)' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">{t('breadcrumb')}</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">{t('title')}</h2>
          <p className="text-zinc-500 text-xs mt-1">{t('subtitle')}</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {t('refresh')}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-xs text-red-400" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          {error}
        </div>
      )}

      {/* Reputation KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label={t('kpiReputationLevel')}
          value={lvl.label}
          sub={rep?.power_seller_status ? t('powerSeller', { status: rep.power_seller_status }) : t('mercadoLivre')}
          color={lvl.color}
          icon={<Star size={14} />}
        />
        <KpiCard
          label={t('kpiClaims')}
          value={loading ? '…' : fmtRate(claimRate)}
          sub={t('claimsOpen', { count: claims.length })}
          color={claimRate > 0.03 ? '#f87171' : claimRate > 0.01 ? '#facc15' : '#4ade80'}
          icon={<AlertTriangle size={14} />}
        />
        <KpiCard
          label={t('kpiCancellations')}
          value={loading ? '…' : fmtRate(cancelRate)}
          sub={txn ? t('canceledOfTotal', { canceled: txn.canceled, total: txn.total }) : undefined}
          color={cancelRate > 0.03 ? '#f87171' : cancelRate > 0.01 ? '#facc15' : '#4ade80'}
          icon={<XCircle size={14} />}
        />
        <KpiCard
          label={t('kpiShipDelay')}
          value={loading ? '…' : fmtRate(delayRate)}
          sub={t('handlingTime')}
          color={delayRate > 0.05 ? '#f87171' : delayRate > 0.02 ? '#facc15' : '#4ade80'}
          icon={<Clock size={14} />}
        />
      </div>

      {/* Reputation details */}
      {rep && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2">
            <Star size={13} style={{ color: lvl.color }} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{t('reputationTitle')}</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ background: lvl.bg, color: lvl.color }}>
              {lvl.label}
            </span>
            {rep.power_seller_status && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>
                {t('powerSeller', { status: rep.power_seller_status })}
              </span>
            )}
            {txn && (
              <span className="text-xs text-zinc-400">{t('completedSales', { count: txn.completed })}</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {metrics?.claims           && <MetricBar label={t('metricClaimRate')}        rate={metrics.claims.rate}                color={metrics.claims.rate > 0.03 ? '#f87171' : '#4ade80'} />}
            {metrics?.cancellations    && <MetricBar label={t('metricCancelRate')}       rate={metrics.cancellations.rate}         color={metrics.cancellations.rate > 0.03 ? '#f87171' : '#4ade80'} />}
            {metrics?.delayed_handling_time && <MetricBar label={t('metricDelayedShip')} rate={metrics.delayed_handling_time.rate} color={metrics.delayed_handling_time.rate > 0.05 ? '#f87171' : '#4ade80'} />}
          </div>
          {txn?.ratings && (
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-green-400" />
                <span className="text-[11px] text-zinc-300">{t('ratingsPositive', { count: txn.ratings.positive })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle size={12} className="text-red-400" />
                <span className="text-[11px] text-zinc-300">{t('ratingsNegative', { count: txn.ratings.negative })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-zinc-500" />
                <span className="text-[11px] text-zinc-300">{t('ratingsNeutral', { count: txn.ratings.neutral })}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Open Claims */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1e1e24' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber-400" />
              <span className="text-xs font-semibold text-zinc-300">{t('openClaims')}</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
              {loading ? '…' : claims.length}
            </span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-600 text-xs">{t('loading')}</div>
          ) : claims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CheckCircle2 size={24} className="text-green-500" />
              <p className="text-xs text-zinc-500">{t('noClaims')}</p>
            </div>
          ) : (
            <div>
              {claims.slice(0, 10).map(c => <ClaimRow key={c.id} claim={c} t={t} />)}
              {claims.length > 10 && (
                <p className="text-center text-[10px] text-zinc-600 py-3">{t('moreClaims', { count: claims.length - 10 })}</p>
              )}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1e1e24' }}>
            <div className="flex items-center gap-2">
              <TrendingDown size={13} className="text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-300">{t('recentOrders')}</span>
            </div>
            <span className="text-[10px] text-zinc-600">{t('last20')}</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-600 text-xs">{t('loading')}</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Package size={24} className="text-zinc-700" />
              <p className="text-xs text-zinc-500">{t('noOrders')}</p>
            </div>
          ) : (
            <div>
              {orders.map(o => <OrderRow key={o.id} order={o} t={t} />)}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
