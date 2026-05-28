'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle, AlertTriangle, CheckCircle2, MessageCircle,
  Clock, Truck, RotateCcw, Star, ShieldAlert, RefreshCw, XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 F1.3 — Shopee Quality Center.
 *  Cockpit de saúde por loja: 7 métricas com semáforos + alertas
 *  priorizados por severity + status overall. */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const SHOPEE = '#EE4D2D'

type HealthStatus = 'healthy' | 'attention' | 'warning' | 'critical'
type AlertSeverity = 'info' | 'warning' | 'critical'
type MetricKey =
  | 'chat_response_rate' | 'chat_response_time_min'
  | 'prep_time_days'     | 'late_ship_rate'
  | 'return_refund_rate' | 'rating'
  | 'penalty_points'

interface Alert {
  severity:            AlertSeverity
  code:                string
  description:         string
  recommended_action:  string
  metric:              MetricKey
  current_value?:      number | string
  target_value?:       number | string
}

interface HealthCard {
  shop_id:        number
  shop_name:      string | null
  snapshot_date:  string
  status:         HealthStatus
  metrics: {
    chat_response_rate:     number | null
    chat_response_time_min: number | null
    prep_time_days:         number | null
    late_ship_rate:         number | null
    return_refund_rate:     number | null
    rating:                 number | null
    penalty_points:         number | null
  }
  alerts:         Alert[]
  completeness:   { filled: number; total: number }
}

export default function ShopeeQualityCenter() {
  const t = useTranslations('shopeeQuality')
  const [items, setItems] = useState<HealthCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/shop-metrics/latest`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json() as { items: HealthCard[]; total: number }
      // ordena: critical > warning > attention > healthy
      const order = { critical: 0, warning: 1, attention: 2, healthy: 3 }
      setItems((body.items ?? []).sort((a, b) => order[a.status] - order[b.status]))
    } catch (e) {
      setError((e as Error).message)
      setItems([])
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>
      <Header onRefresh={load} t={t} count={items?.length ?? 0} />
      {error && <ErrorBanner error={error} onRetry={load} t={t} />}
      {items === null && !error ? (
        <LoadingState />
      ) : items?.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {items?.map(card => <ShopCard key={card.shop_id} card={card} t={t} />)}
        </div>
      )}
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────

function Header({ count, onRefresh, t }: { count: number; onRefresh: () => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-zinc-500 text-xs">{t('breadcrumb')}</p>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <div>
        <h2 className="text-white text-lg font-semibold">{t('title')}</h2>
        <p className="text-zinc-500 text-xs">{t('subtitle', { count })}</p>
      </div>
      <button
        onClick={onRefresh}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
        style={{ borderColor: '#2e2e33', color: '#a1a1aa', background: '#111114' }}
      >
        <RefreshCw size={12} />
        {t('refresh')}
      </button>
    </div>
  )
}

// ── Shop Card ──────────────────────────────────────────────────────────────

function ShopCard({ card, t }: { card: HealthCard; t: ReturnType<typeof useTranslations> }) {
  const sColor = statusColor(card.status)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: `1px solid ${sColor}33` }}>
      {/* status header */}
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: `${sColor}10`, borderBottom: `1px solid ${sColor}22` }}>
        <StatusBadge status={card.status} t={t} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {card.shop_name ?? `Shop #${card.shop_id}`}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            #{card.shop_id} · {t('snapshotDate', { d: card.snapshot_date })} · {t('coverage', { f: card.completeness.filled, t: card.completeness.total })}
          </p>
        </div>
      </div>

      {/* metrics grid */}
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        <MetricTile
          icon={<MessageCircle size={12} />}
          label={t('metric.chat_response_rate.label')}
          value={card.metrics.chat_response_rate}
          format="percent"
          severity={metricSeverity('chat_response_rate', card.metrics.chat_response_rate)}
        />
        <MetricTile
          icon={<Clock size={12} />}
          label={t('metric.chat_response_time_min.label')}
          value={card.metrics.chat_response_time_min}
          format="minutes"
          severity={metricSeverity('chat_response_time_min', card.metrics.chat_response_time_min)}
        />
        <MetricTile
          icon={<Truck size={12} />}
          label={t('metric.prep_time_days.label')}
          value={card.metrics.prep_time_days}
          format="days"
          severity={metricSeverity('prep_time_days', card.metrics.prep_time_days)}
        />
        <MetricTile
          icon={<AlertTriangle size={12} />}
          label={t('metric.late_ship_rate.label')}
          value={card.metrics.late_ship_rate}
          format="percent"
          severity={metricSeverity('late_ship_rate', card.metrics.late_ship_rate)}
        />
        <MetricTile
          icon={<RotateCcw size={12} />}
          label={t('metric.return_refund_rate.label')}
          value={card.metrics.return_refund_rate}
          format="percent"
          severity={metricSeverity('return_refund_rate', card.metrics.return_refund_rate)}
        />
        <MetricTile
          icon={<Star size={12} />}
          label={t('metric.rating.label')}
          value={card.metrics.rating}
          format="rating"
          severity={metricSeverity('rating', card.metrics.rating)}
        />
        <MetricTile
          icon={<ShieldAlert size={12} />}
          label={t('metric.penalty_points.label')}
          value={card.metrics.penalty_points}
          format="int"
          severity={metricSeverity('penalty_points', card.metrics.penalty_points)}
        />
      </div>

      {/* alerts */}
      {card.alerts.length > 0 && (
        <div className="px-5 pb-5 space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {t('alertsTitle', { n: card.alerts.length })}
          </h4>
          {card.alerts.slice(0, 3).map((a, i) => (
            <AlertRow key={`${a.code}-${i}`} alert={a} t={t} />
          ))}
          {card.alerts.length > 3 && (
            <p className="text-[10px] text-zinc-600 text-center pt-1">
              {t('moreAlerts', { n: card.alerts.length - 3 })}
            </p>
          )}
        </div>
      )}

      {card.alerts.length === 0 && card.status === 'healthy' && (
        <div className="px-5 pb-5">
          <div className="rounded-xl p-3 flex items-center gap-2"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300 flex-1">{t('healthyHint')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: HealthStatus; t: ReturnType<typeof useTranslations> }) {
  const color = statusColor(status)
  const Icon =
    status === 'critical'  ? XCircle :
    status === 'warning'   ? AlertTriangle :
    status === 'attention' ? AlertCircle :
                             CheckCircle2
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: `${color}1a`, color, border: `1px solid ${color}44` }}>
      <Icon size={11} />
      {t(`status.${status}`)}
    </span>
  )
}

// ── Metric Tile ────────────────────────────────────────────────────────────

function MetricTile({ icon, label, value, format, severity }: {
  icon:     React.ReactNode
  label:    string
  value:    number | null
  format:   'percent' | 'minutes' | 'days' | 'rating' | 'int'
  severity: 'ok' | 'warn' | 'bad' | 'na'
}) {
  const color =
    severity === 'bad'  ? '#f87171' :
    severity === 'warn' ? '#fbbf24' :
    severity === 'ok'   ? '#34d399' :
                          '#52525b'
  return (
    <div className="rounded-lg p-2.5" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
        <span style={{ color }}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className="text-base font-bold mt-1" style={{ color: value == null ? '#52525b' : color }}>
        {value == null ? '—' : formatValue(value, format)}
      </p>
    </div>
  )
}

// ── Alert Row ──────────────────────────────────────────────────────────────

function AlertRow({ alert, t }: { alert: Alert; t: ReturnType<typeof useTranslations> }) {
  const color =
    alert.severity === 'critical' ? '#f87171' :
    alert.severity === 'warning'  ? '#fbbf24' :
                                    '#71717a'
  return (
    <div className="rounded-lg p-2.5" style={{ background: '#18181b', border: `1px solid ${color}33` }}>
      <div className="flex items-start gap-2">
        <AlertCircle size={12} style={{ color }} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-200">{alert.description}</p>
          <p className="text-[11px] text-zinc-400 mt-1">
            <span className="text-zinc-500">{t('actionLabel')}: </span>
            {alert.recommended_action}
          </p>
          {alert.current_value != null && alert.target_value != null && (
            <p className="text-[10px] text-zinc-600 mt-1">
              {t('current')}: <span className="text-zinc-400">{alert.current_value}</span> · {t('target')}: <span className="text-zinc-400">{alert.target_value}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── States ─────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-2xl h-64 animate-pulse"
          style={{ background: '#111114', border: '1px solid #1e1e24' }} />
      ))}
    </div>
  )
}

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 rounded-2xl"
      style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <p className="text-sm font-semibold text-zinc-300">{t('empty.title')}</p>
      <p className="text-xs text-zinc-500 text-center max-w-md">{t('empty.desc')}</p>
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

function statusColor(s: HealthStatus): string {
  if (s === 'critical')  return '#f87171'
  if (s === 'warning')   return '#fb923c'
  if (s === 'attention') return '#fbbf24'
  return '#34d399'
}

function formatValue(v: number, fmt: 'percent' | 'minutes' | 'days' | 'rating' | 'int'): string {
  if (fmt === 'percent') return `${(v * 100).toFixed(1)}%`
  if (fmt === 'minutes') return `${Math.round(v)}min`
  if (fmt === 'days')    return `${v.toFixed(1)}d`
  if (fmt === 'rating')  return v.toFixed(2)
  return String(Math.round(v))
}

/** Mapeia métrica → severity local (alinhado aos QUALITY_THRESHOLDS do
 *  backend). Não chamamos o backend pra cada decisão — duplicação OK
 *  pra UX responsiva. */
function metricSeverity(key: MetricKey, value: number | null): 'ok' | 'warn' | 'bad' | 'na' {
  if (value == null) return 'na'
  switch (key) {
    case 'chat_response_rate':
      return value < 0.70 ? 'bad' : value < 0.85 ? 'warn' : 'ok'
    case 'chat_response_time_min':
      return value > 240 ? 'bad' : value > 60 ? 'warn' : 'ok'
    case 'prep_time_days':
      return value > 3 ? 'bad' : value > 2 ? 'warn' : 'ok'
    case 'late_ship_rate':
      return value > 0.10 ? 'bad' : value > 0.05 ? 'warn' : 'ok'
    case 'return_refund_rate':
      return value > 0.10 ? 'bad' : value > 0.05 ? 'warn' : 'ok'
    case 'rating':
      return value < 4.0 ? 'bad' : value < 4.5 ? 'warn' : 'ok'
    case 'penalty_points':
      return value >= 6 ? 'bad' : value >= 3 ? 'warn' : 'ok'
  }
}
