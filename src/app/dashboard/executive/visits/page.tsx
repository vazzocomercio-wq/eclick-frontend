'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, Eye, ShoppingCart, TrendingUp, TrendingDown, Minus,
  Activity, AlertCircle, BarChart3,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface VisitsDay {
  date:                              string
  total_visits:                      number
  total_orders:                      number
  total_units_sold:                  number
  conversion_rate_pct:               number | null
  is_partial:                        boolean
  visits_change_pct_vs_prev_day:     number | null
  visits_change_pct_vs_same_day_lw:  number | null
}

interface AccountConnection {
  seller_id: number
  nickname:  string | null
}

const num  = (v: number) => v.toLocaleString('pt-BR')
const pct  = (v: number | null, digits = 2) =>
  v == null ? '—' : `${v.toFixed(digits)}%`
const dateBr = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

type Translator = ReturnType<typeof useTranslations>

function timeSince(iso: string, t: Translator): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60_000)
  if (m < 1)  return t('timeNow')
  if (m < 60) return t('timeMinutesAgo', { m })
  const h = Math.round(m / 60)
  return h < 24 ? t('timeHoursAgo', { h }) : t('timeDaysAgo', { d: Math.round(h / 24) })
}

/** Mini line chart SVG das últimas N visitas + pontos de orders. */
function VisitsChart({ data, t, height = 180, width = 800 }: { data: VisitsDay[]; t: Translator; height?: number; width?: number }) {
  if (data.length === 0) return null
  const padding = { top: 20, right: 20, bottom: 28, left: 50 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const maxVisits = Math.max(...data.map(d => d.total_visits), 1)
  const maxOrders = Math.max(...data.map(d => d.total_orders), 1)

  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0
  const yVisits = (v: number) => chartH - (v / maxVisits) * chartH * 0.92
  const yOrders = (v: number) => chartH - (v / maxOrders) * chartH * 0.92

  const visitsPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${yVisits(d.total_visits).toFixed(1)}`)
    .join(' ')
  const ordersPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${yOrders(d.total_orders).toFixed(1)}`)
    .join(' ')

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {/* Grid horizontal */}
        {[0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={0} x2={chartW} y1={chartH - chartH * t * 0.92} y2={chartH - chartH * t * 0.92}
                stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}
        {/* Visitas line */}
        <path d={visitsPath} fill="none" stroke="#00E5FF" strokeWidth={2} strokeLinejoin="round" />
        {/* Orders line (escala diferente) */}
        <path d={ordersPath} fill="none" stroke="#84cc16" strokeWidth={1.5} strokeLinejoin="round" strokeDasharray="4 4" />

        {/* Dots last day se parcial */}
        {data.length > 0 && data[data.length - 1].is_partial && (
          <circle cx={(data.length - 1) * stepX} cy={yVisits(data[data.length - 1].total_visits)}
                  r={4} fill="#f59e0b" stroke="#0d0d10" strokeWidth={2} />
        )}

        {/* X-axis labels (a cada ~5 dias) */}
        {data.map((d, i) => {
          if (i % Math.max(1, Math.floor(data.length / 6)) !== 0 && i !== data.length - 1) return null
          return (
            <text key={d.date} x={i * stepX} y={chartH + 18} fontSize="10" fill="#71717a" textAnchor="middle">
              {dateBr(d.date)}
            </text>
          )
        })}

        {/* Y-axis labels — visitas */}
        {[0, 0.5, 1].map(t => (
          <text key={t} x={-8} y={chartH - chartH * t * 0.92 + 4}
                fontSize="10" fill="#71717a" textAnchor="end">
            {Math.round(maxVisits * t).toLocaleString('pt-BR')}
          </text>
        ))}
      </g>

      {/* Legenda */}
      <g transform={`translate(${padding.left + 8}, 12)`}>
        <line x1={0} x2={14} y1={0} y2={0} stroke="#00E5FF" strokeWidth={2} />
        <text x={20} y={4} fontSize="11" fill="#a1a1aa">{t('visitsLegendVisits')}</text>
        <line x1={74} x2={88} y1={0} y2={0} stroke="#84cc16" strokeWidth={1.5} strokeDasharray="4 4" />
        <text x={94} y={4} fontSize="11" fill="#a1a1aa">{t('visitsLegendOrders')}</text>
      </g>
    </svg>
  )
}

export default function VisitsPage() {
  const t = useTranslations('executive')
  const supabase = useMemo(() => createClient(), [])
  const [history,  setHistory]  = useState<VisitsDay[]>([])
  const [accounts, setAccounts] = useState<AccountConnection[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [days,     setDays]     = useState<number>(30)
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase, t])

  // Carrega contas via /executive/dashboard pra reusar a lista de nicknames
  const loadAccounts = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/executive/dashboard`, { headers })
      if (!res.ok) return
      const body = await res.json() as { snapshots: Array<{ seller_id: number; nickname: string | null }> }
      const list = body.snapshots ?? []
      setAccounts(list.map(s => ({ seller_id: s.seller_id, nickname: s.nickname })))
      if (!selected && list.length > 0) setSelected(list[0].seller_id)
    } catch (err) {
      console.warn('[visits] accounts fail:', (err as Error).message)
    }
  }, [getHeaders, selected])

  const loadHistory = useCallback(async (sellerId: number, n: number) => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/executive/visits?seller_id=${sellerId}&days=${n}`, { headers })
      if (res.ok) {
        const body = await res.json() as { history: VisitsDay[] }
        setHistory(body.history ?? [])
      }
    } catch (err) {
      console.warn('[visits] history fail:', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [getHeaders])

  const triggerSync = useCallback(async () => {
    if (!selected) return
    setSyncing(true)
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/executive/visits/sync?seller_id=${selected}&days=${days}`, {
        method: 'POST', headers,
      })
      await loadHistory(selected, days)
    } catch (err) {
      console.warn('[visits] sync fail:', (err as Error).message)
    } finally {
      setSyncing(false)
    }
  }, [getHeaders, loadHistory, selected, days])

  useEffect(() => { void loadAccounts() }, [loadAccounts])
  useEffect(() => {
    if (selected != null) void loadHistory(selected, days)
  }, [selected, days, loadHistory])

  // Agregados 7d/30d (excluindo dia parcial)
  const stats = useMemo(() => {
    const full = history.filter(d => !d.is_partial)
    if (full.length === 0) return null

    const sumOf = (n: number) => full.slice(-n).reduce(
      (a, r) => ({ visits: a.visits + r.total_visits, orders: a.orders + r.total_orders, units: a.units + r.total_units_sold }),
      { visits: 0, orders: 0, units: 0 },
    )
    const last7  = sumOf(7)
    const prev7  = full.slice(-14, -7).reduce(
      (a, r) => ({ visits: a.visits + r.total_visits, orders: a.orders + r.total_orders }),
      { visits: 0, orders: 0 },
    )

    const conv7d = last7.visits > 0 ? (last7.orders / last7.visits) * 100 : null
    const change = prev7.visits > 0 ? ((last7.visits - prev7.visits) / prev7.visits) * 100 : null

    return {
      last7:    { ...last7, conv: conv7d },
      change,
      partialToday: history.find(d => d.is_partial),
    }
  }, [history])

  const currentNickname = accounts.find(a => a.seller_id === selected)?.nickname ?? null

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: '#fafafa' }}>
            {t('visitsTitle')}
          </h1>
          <div style={{ fontSize: 13, color: '#71717a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={12} />
            {history.length > 0
              ? <>{t('visitsUpdatedMeta', { since: timeSince(history[history.length - 1]?.date + 'T00:00:00Z', t) })}</>
              : <>{t('visitsNoDataYet')}</>}
          </div>
        </div>
        <button
          onClick={triggerSync}
          disabled={syncing || !selected}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,229,255,0.10)',
            border: '1px solid rgba(0,229,255,0.30)',
            color: '#00E5FF', padding: '8px 14px', borderRadius: 8,
            fontSize: 13, cursor: syncing ? 'wait' : 'pointer',
            opacity: syncing || !selected ? 0.6 : 1, fontWeight: 500,
          }}
        >
          <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : undefined }} />
          {syncing ? t('reputationSyncing') : t('reputationSyncNow')}
        </button>
      </div>

      {/* Seletor de conta */}
      {accounts.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {accounts.map(a => (
            <button
              key={a.seller_id}
              onClick={() => setSelected(a.seller_id)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12,
                background: a.seller_id === selected ? 'rgba(0,229,255,0.10)' : 'rgba(255,255,255,0.02)',
                border:     a.seller_id === selected ? '1px solid rgba(0,229,255,0.30)' : '1px solid rgba(255,255,255,0.10)',
                color:      a.seller_id === selected ? '#00E5FF' : '#a1a1aa',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              {a.nickname ?? t('accountFallback', { id: a.seller_id })}
            </button>
          ))}
        </div>
      )}

      {/* Seletor de período */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {[7, 14, 30, 60].map(n => (
          <button key={n}
            onClick={() => setDays(n)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11,
              background: days === n ? 'rgba(255,255,255,0.05)' : 'transparent',
              border:     days === n ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.05)',
              color:      days === n ? '#e4e4e7' : '#71717a',
              cursor: 'pointer', fontWeight: 500,
            }}>
            {n}d
          </button>
        ))}
      </div>

      {loading && history.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#71717a' }}>{t('loading')}</div>
      )}

      {stats && (
        <>
          {/* KPI cards */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            {t('visitsSummary7d')}
            <span style={{ marginLeft: 8, fontSize: 10, color: '#52525b', textTransform: 'none', letterSpacing: 0 }}>
              {t('visitsExcludingPartial')}
            </span>
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <div style={{
              background: 'rgba(0,229,255,0.04)',
              border: '1px solid rgba(0,229,255,0.20)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Eye size={14} color="#00E5FF" />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
                  {t('visitsLabelVisits')}
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: '#00E5FF', lineHeight: 1 }}>
                {num(stats.last7.visits)}
              </div>
              {stats.change != null && (
                <div style={{
                  fontSize: 12, color: stats.change >= 0 ? '#22c55e' : '#ef4444',
                  marginTop: 6, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {stats.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {stats.change > 0 ? '+' : ''}{t('visitsChangeVsPrev7d', { pct: stats.change.toFixed(1) })}
                </div>
              )}
            </div>

            <div style={{
              background: 'rgba(132,204,22,0.04)',
              border: '1px solid rgba(132,204,22,0.20)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ShoppingCart size={14} color="#84cc16" />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
                  {t('visitsLabelOrders')}
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: '#84cc16', lineHeight: 1 }}>
                {num(stats.last7.orders)}
              </div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 6 }}>
                {t('visitsUnitsSold', { count: num(stats.last7.units) })}
              </div>
            </div>

            <div style={{
              background: stats.last7.conv != null
                ? (stats.last7.conv >= 5 ? 'rgba(34,197,94,0.06)' : stats.last7.conv >= 1 ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)')
                : 'rgba(255,255,255,0.02)',
              border: stats.last7.conv != null
                ? (stats.last7.conv >= 5 ? '1px solid rgba(34,197,94,0.30)' : stats.last7.conv >= 1 ? '1px solid rgba(245,158,11,0.30)' : '1px solid rgba(239,68,68,0.30)')
                : '1px solid rgba(255,255,255,0.10)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrendingUp size={14} color={
                  stats.last7.conv == null ? '#71717a' :
                  stats.last7.conv >= 5 ? '#22c55e' :
                  stats.last7.conv >= 1 ? '#f59e0b' : '#ef4444'
                } />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
                  {t('visitsConversionRate')}
                </span>
              </div>
              <div style={{
                fontSize: 28, fontWeight: 600, lineHeight: 1,
                color: stats.last7.conv == null ? '#71717a' :
                       stats.last7.conv >= 5 ? '#22c55e' :
                       stats.last7.conv >= 1 ? '#f59e0b' : '#ef4444',
              }}>
                {pct(stats.last7.conv, 3)}
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 6 }}>
                {num(stats.last7.orders)} ÷ {num(stats.last7.visits)}
              </div>
            </div>

            {stats.partialToday && (
              <div style={{
                background: 'rgba(245,158,11,0.04)',
                border: '1px dashed rgba(245,158,11,0.25)',
                borderRadius: 12, padding: '16px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <AlertCircle size={14} color="#f59e0b" />
                  <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
                    {t('visitsTodayPartial')}
                  </span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 500, color: '#f59e0b' }}>
                  {num(stats.partialToday.total_visits)}
                </div>
                <div style={{ fontSize: 11, color: '#71717a', marginTop: 6 }}>
                  {t('visitsSoFar', { orders: stats.partialToday.total_orders })}
                </div>
              </div>
            )}
          </div>

          {/* Gráfico */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            {t('visitsEvolution', { days })}
          </h2>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '20px 16px',
            marginBottom: 28,
          }}>
            <VisitsChart data={history} t={t} />
          </div>

          {/* Tabela detalhada */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            {t('visitsDaily', { days: history.length })}
          </h2>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, overflow: 'hidden', marginBottom: 28,
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ textAlign: 'left',  padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('visitsColDate')}</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('visitsColVisits')}</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('visitsColVsPrevDay')}</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('visitsColVsPrevWeek')}</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('visitsColOrders')}</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('visitsColConversion')}</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map(d => (
                  <tr key={d.date} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 16px', color: d.is_partial ? '#f59e0b' : '#e4e4e7' }}>
                      {dateBr(d.date)}{d.is_partial && t('visitsPartialSuffix')}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#e4e4e7' }}>
                      {num(d.total_visits)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: d.visits_change_pct_vs_prev_day == null ? '#52525b' : d.visits_change_pct_vs_prev_day >= 0 ? '#22c55e' : '#ef4444' }}>
                      {d.visits_change_pct_vs_prev_day == null ? '—'
                        : `${d.visits_change_pct_vs_prev_day > 0 ? '+' : ''}${d.visits_change_pct_vs_prev_day.toFixed(1)}%`}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: d.visits_change_pct_vs_same_day_lw == null ? '#52525b' : d.visits_change_pct_vs_same_day_lw >= 0 ? '#22c55e' : '#ef4444' }}>
                      {d.visits_change_pct_vs_same_day_lw == null ? '—'
                        : `${d.visits_change_pct_vs_same_day_lw > 0 ? '+' : ''}${d.visits_change_pct_vs_same_day_lw.toFixed(1)}%`}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#a1a1aa' }}>
                      {num(d.total_orders)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: d.conversion_rate_pct == null ? '#52525b' : d.conversion_rate_pct >= 5 ? '#22c55e' : d.conversion_rate_pct >= 1 ? '#f59e0b' : '#ef4444' }}>
                      {pct(d.conversion_rate_pct, 3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Nota sobre top items */}
          <div style={{
            background: 'rgba(255,255,255,0.015)',
            border: '1px dashed rgba(255,255,255,0.10)',
            borderRadius: 12, padding: '14px 18px',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <BarChart3 size={16} color="#71717a" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.5 }}>
              {t.rich('visitsNextNote', {
                strong: (chunks) => <strong style={{ color: '#e4e4e7' }}>{chunks}</strong>,
                code: (chunks) => <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>{chunks}</code>,
              })}
            </div>
          </div>
        </>
      )}

      {!loading && stats == null && (
        <div style={{
          background: 'rgba(255,255,255,0.015)',
          border: '1px dashed rgba(255,255,255,0.10)',
          borderRadius: 12, padding: 20, color: '#71717a', fontSize: 13,
        }}>
          {t('visitsNoDataEmpty')}
        </div>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
