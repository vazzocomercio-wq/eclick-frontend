'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, Megaphone, TrendingUp, TrendingDown, DollarSign,
  Target, AlertTriangle, CheckCircle2, Activity, Filter,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface AdsSummary {
  organization_id:            string
  ads_spend_7d:               number
  ads_revenue_7d:             number
  ads_clicks_7d:              number
  ads_impressions_7d:         number
  ads_conversions_7d:         number
  ads_acos_7d:                number | null     // fração 0-1
  ads_roas_7d:                number | null     // multiplicador
  ads_ctr_7d:                 number | null     // já em %
  ads_spend_change_pct:       number | null
  ads_revenue_change_pct:     number | null
  ads_campaigns_active:       number
  ads_campaigns_paused:       number
  ads_campaigns_losing_money: number
  ads_campaigns_winning:      number
  has_advertiser:             boolean
  advertiser_ids:             string[]
  acos_threshold:             number
  last_refresh_at:            string
}

interface CampaignRow {
  campaign_id:    string
  name:           string | null
  type:           string | null
  status:         string | null
  daily_budget:   number | null
  advertiser_id:  string | null
  spend_7d:       number
  revenue_7d:     number
  clicks_7d:      number
  impressions_7d: number
  acos_7d:        number | null
  roas_7d:        number | null
}

interface ChartPoint {
  date:    string
  spend:   number
  revenue: number
  clicks:  number
  roas:    number | null
}

const brl = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brlPrecise = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString('pt-BR')
const pctFrac = (v: number | null, digits = 1) => v == null ? '—' : `${(v * 100).toFixed(digits)}%`
const pctPct  = (v: number | null, digits = 2) => v == null ? '—' : `${v.toFixed(digits)}%`
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

const TYPE_LABEL: Record<string, string> = {
  PADS: 'Product Ads',
  BADS: 'Brand Ads',
  DISPLAY: 'Display',
}

function SpendRevenueChart({ data, t, width = 800, height = 220 }: { data: ChartPoint[]; t: Translator; width?: number; height?: number }) {
  if (data.length === 0) return null
  const padding = { top: 20, right: 30, bottom: 28, left: 60 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const max = Math.max(...data.map(d => Math.max(d.spend, d.revenue)), 1)
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0
  const y = (v: number) => chartH - (v / max) * chartH * 0.92

  const path = (key: 'spend' | 'revenue') => data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${y(d[key]).toFixed(1)}`)
    .join(' ')

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {[0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1={0} x2={chartW} y1={chartH - chartH * t * 0.92} y2={chartH - chartH * t * 0.92}
                stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}
        <path d={path('revenue')} fill="none" stroke="#22c55e" strokeWidth={2} strokeLinejoin="round" />
        <path d={path('spend')}   fill="none" stroke="#ef4444" strokeWidth={2} strokeLinejoin="round" strokeDasharray="4 4" />

        {data.map((d, i) => {
          if (i % Math.max(1, Math.floor(data.length / 6)) !== 0 && i !== data.length - 1) return null
          return (
            <text key={d.date} x={i * stepX} y={chartH + 18} fontSize="10" fill="#71717a" textAnchor="middle">
              {dateBr(d.date)}
            </text>
          )
        })}

        {[0, 0.5, 1].map(t => (
          <text key={t} x={-8} y={chartH - chartH * t * 0.92 + 4} fontSize="10" fill="#71717a" textAnchor="end">
            {brl(max * t)}
          </text>
        ))}
      </g>
      <g transform={`translate(${padding.left + 8}, 12)`}>
        <line x1={0} x2={14} y1={0} y2={0} stroke="#22c55e" strokeWidth={2} />
        <text x={20} y={4} fontSize="11" fill="#a1a1aa">{t('adsLegendRevenue')}</text>
        <line x1={84} x2={98} y1={0} y2={0} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" />
        <text x={104} y={4} fontSize="11" fill="#a1a1aa">{t('adsLegendSpend')}</text>
      </g>
    </svg>
  )
}

function CampaignTable({ rows, kind, t }: { rows: CampaignRow[]; kind: 'winners' | 'losers'; t: Translator }) {
  if (rows.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.015)',
        border: '1px dashed rgba(255,255,255,0.10)',
        borderRadius: 12, padding: 20, color: '#71717a', fontSize: 13,
      }}>
        {kind === 'winners' ? t('adsNoWinners') : t('adsNoLosers')}
      </div>
    )
  }
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <th style={{ textAlign: 'left',  padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('adsColCampaign')}</th>
            <th style={{ textAlign: 'left',  padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('adsColType')}</th>
            <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('adsColSpend7d')}</th>
            <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('adsColRevenue7d')}</th>
            <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('adsColAcos')}</th>
            <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('adsColRoas')}</th>
            <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>{t('adsColClicks')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => {
            const acosColor = c.acos_7d == null ? '#71717a'
              : c.acos_7d <= 0.15 ? '#22c55e'
              : c.acos_7d <= 0.30 ? '#f59e0b' : '#ef4444'
            const roasColor = c.roas_7d == null ? '#71717a'
              : c.roas_7d >= 5 ? '#22c55e'
              : c.roas_7d >= 2 ? '#f59e0b' : '#ef4444'
            return (
              <tr key={c.campaign_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '10px 16px', color: '#e4e4e7' }}>
                  <div style={{ fontWeight: 500 }}>{c.name ?? t('adsNoName')}</div>
                  <div style={{ fontSize: 10, color: '#52525b', fontFamily: 'monospace' }}>{c.campaign_id}</div>
                </td>
                <td style={{ padding: '10px 16px', color: '#a1a1aa', fontSize: 11 }}>
                  {c.type ? (TYPE_LABEL[c.type] ?? c.type) : '—'}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#e4e4e7' }}>
                  {brlPrecise(c.spend_7d)}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#22c55e' }}>
                  {brlPrecise(c.revenue_7d)}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: acosColor, fontWeight: 500 }}>
                  {pctFrac(c.acos_7d)}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: roasColor, fontWeight: 500 }}>
                  {c.roas_7d == null ? '—' : `${c.roas_7d.toFixed(2)}x`}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#a1a1aa' }}>
                  {num(c.clicks_7d)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function AdsPage() {
  const t = useTranslations('executive')
  const supabase = useMemo(() => createClient(), [])
  const [summary, setSummary] = useState<AdsSummary | null>(null)
  const [winners, setWinners] = useState<CampaignRow[]>([])
  const [losers,  setLosers]  = useState<CampaignRow[]>([])
  const [chart,   setChart]   = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterType, setFilterType] = useState<string>('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase, t])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const [sumRes, winRes, losRes, chartRes] = await Promise.all([
        fetch(`${BACKEND}/executive/ads`, { headers }),
        fetch(`${BACKEND}/executive/ads/leaderboard?kind=winners&limit=10`, { headers }),
        fetch(`${BACKEND}/executive/ads/leaderboard?kind=losers&limit=10`, { headers }),
        fetch(`${BACKEND}/executive/ads/chart?days=30`, { headers }),
      ])
      if (sumRes.ok) {
        const body = await sumRes.json() as { summary: AdsSummary | null }
        setSummary(body.summary)
      }
      if (winRes.ok) {
        const body = await winRes.json() as { campaigns: CampaignRow[] }
        setWinners(body.campaigns ?? [])
      }
      if (losRes.ok) {
        const body = await losRes.json() as { campaigns: CampaignRow[] }
        setLosers(body.campaigns ?? [])
      }
      if (chartRes.ok) {
        const body = await chartRes.json() as { chart: ChartPoint[] }
        setChart(body.chart ?? [])
      }
    } catch (err) {
      console.warn('[ads] load fail:', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [getHeaders])

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/executive/ads/refresh`, { method: 'POST', headers })
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [getHeaders, load])

  useEffect(() => { void load() }, [load])

  // Filtros client-side por type (PADS/BADS/DISPLAY)
  const filteredWinners = useMemo(
    () => filterType ? winners.filter(c => c.type === filterType) : winners,
    [winners, filterType],
  )
  const filteredLosers = useMemo(
    () => filterType ? losers.filter(c => c.type === filterType) : losers,
    [losers, filterType],
  )

  // Coverage: org sem advertiser
  if (!loading && (summary == null || !summary.has_advertiser)) {
    return (
      <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: '#fafafa', marginBottom: 24 }}>
          {t('adsTitle')}
        </h1>
        <div style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.30)',
          borderRadius: 12, padding: '24px 28px',
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>
              {t('connectProductAds')}
            </div>
            <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.5, maxWidth: 600 }}>
              {t.rich('adsNoAdvertiserDesc', {
                code: (chunks) => <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3, margin: '0 4px' }}>{chunks}</code>,
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const acosTone = summary?.ads_acos_7d == null ? 'neutral'
    : summary.ads_acos_7d <= 0.15 ? 'positive'
    : summary.ads_acos_7d <= (summary.acos_threshold ?? 0.30) ? 'attention'
    : 'critical'
  const acosColor = acosTone === 'positive' ? '#22c55e'
    : acosTone === 'attention' ? '#f59e0b'
    : acosTone === 'critical' ? '#ef4444' : '#71717a'

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: '#fafafa' }}>
            {t('adsTitle')}
          </h1>
          <div style={{ fontSize: 13, color: '#71717a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={12} />
            {summary
              ? <>{t('adsUpdatedMeta', { since: timeSince(summary.last_refresh_at, t), count: summary.advertiser_ids.length })}</>
              : <>{t('loading')}</>}
          </div>
        </div>
        <button
          onClick={triggerRefresh}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,229,255,0.10)',
            border: '1px solid rgba(0,229,255,0.30)',
            color: '#00E5FF', padding: '8px 14px', borderRadius: 8,
            fontSize: 13, cursor: refreshing ? 'wait' : 'pointer',
            opacity: refreshing ? 0.6 : 1, fontWeight: 500,
          }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
          {refreshing ? t('refreshing') : t('refreshNow')}
        </button>
      </div>

      {summary && (
        <>
          {/* KPI cards 7d */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            {t('adsPerformance7d')}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <DollarSign size={14} color="#ef4444" />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>{t('adsLabelSpend')}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, color: '#ef4444', lineHeight: 1 }}>{brl(summary.ads_spend_7d)}</div>
              {summary.ads_spend_change_pct != null && (
                <div style={{ fontSize: 12, color: summary.ads_spend_change_pct >= 0 ? '#ef4444' : '#22c55e', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {summary.ads_spend_change_pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {summary.ads_spend_change_pct > 0 ? '+' : ''}{t('changeVsPrev7d', { pct: summary.ads_spend_change_pct.toFixed(1) })}
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.20)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrendingUp size={14} color="#22c55e" />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>{t('adsLabelRevenue')}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, color: '#22c55e', lineHeight: 1 }}>{brl(summary.ads_revenue_7d)}</div>
              {summary.ads_revenue_change_pct != null && (
                <div style={{ fontSize: 12, color: summary.ads_revenue_change_pct >= 0 ? '#22c55e' : '#ef4444', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {summary.ads_revenue_change_pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {summary.ads_revenue_change_pct > 0 ? '+' : ''}{t('changeVsPrev7d', { pct: summary.ads_revenue_change_pct.toFixed(1) })}
                </div>
              )}
            </div>

            <div style={{
              background: acosTone === 'positive' ? 'rgba(34,197,94,0.04)' : acosTone === 'attention' ? 'rgba(245,158,11,0.04)' : 'rgba(239,68,68,0.04)',
              border:     acosTone === 'positive' ? '1px solid rgba(34,197,94,0.20)' : acosTone === 'attention' ? '1px solid rgba(245,158,11,0.20)' : '1px solid rgba(239,68,68,0.20)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Target size={14} color={acosColor} />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>{t('adsLabelAcos')}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, color: acosColor, lineHeight: 1 }}>
                {pctFrac(summary.ads_acos_7d)}
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 6 }}>
                {t('adsConfiguredLimit', { limit: pctFrac(summary.acos_threshold) })}
              </div>
            </div>

            <div style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.20)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Megaphone size={14} color="#00E5FF" />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>{t('adsLabelRoas')}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, color: '#00E5FF', lineHeight: 1 }}>
                {summary.ads_roas_7d == null ? '—' : `${summary.ads_roas_7d.toFixed(2)}x`}
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 6 }}>
                {t('adsRoasHint')}
              </div>
            </div>
          </div>

          {/* 2ª linha: tráfego + estado */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('adsClicks7d')}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#e4e4e7' }}>{num(summary.ads_clicks_7d)}</div>
              {summary.ads_ctr_7d != null && (
                <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{t('adsCtr', { ctr: pctPct(summary.ads_ctr_7d, 2) })}</div>
              )}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('adsImpressions7d')}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#e4e4e7' }}>{num(summary.ads_impressions_7d)}</div>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.20)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('adsWinning')}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#22c55e' }}>{num(summary.ads_campaigns_winning)}</div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{t('adsRoasOver3')}</div>
            </div>
            <div style={{ background: summary.ads_campaigns_losing_money > 0 ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                          border: summary.ads_campaigns_losing_money > 0 ? '1px solid rgba(239,68,68,0.20)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('adsLosingMoney')}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: summary.ads_campaigns_losing_money > 0 ? '#ef4444' : '#22c55e' }}>
                {num(summary.ads_campaigns_losing_money)}
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
                {t('adsAcosOver', { limit: pctFrac(summary.acos_threshold) })}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('adsCampaigns')}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#e4e4e7' }}>{num(summary.ads_campaigns_active)}</div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
                {t('adsActivePaused', { paused: summary.ads_campaigns_paused })}
              </div>
            </div>
          </div>

          {/* Gráfico spend vs revenue 30d */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            {t('adsSpendVsRevenue30d')}
          </h2>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '20px 16px', marginBottom: 28,
          }}>
            {chart.length > 0
              ? <SpendRevenueChart data={chart} t={t} />
              : <div style={{ color: '#71717a', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('adsNoChartData')}</div>}
          </div>

          {/* Toggle de filtros + chip bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button
              onClick={() => setFiltersOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: filtersOpen ? 'rgba(0,229,255,0.10)' : 'rgba(255,255,255,0.02)',
                border:     filtersOpen ? '1px solid rgba(0,229,255,0.30)' : '1px solid rgba(255,255,255,0.10)',
                color:      filtersOpen ? '#00E5FF' : '#a1a1aa',
                padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 500,
              }}
            >
              <Filter size={12} />
              {t('adsFilters')}{filterType ? ` (1)` : ''}
            </button>
            {filterType && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.20)',
                color: '#00E5FF', padding: '3px 10px', borderRadius: 99, fontSize: 11,
              }}>
                {t('adsTypeChip', { type: TYPE_LABEL[filterType] ?? filterType })}
                <button onClick={() => setFilterType('')} style={{
                  background: 'none', border: 'none', color: '#00E5FF', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1,
                }}>×</button>
              </span>
            )}
          </div>

          {filtersOpen && (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 24,
            }}>
              <div style={{ fontSize: 11, color: '#71717a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('adsCampaignType')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['', 'PADS', 'BADS', 'DISPLAY'].map(opt => (
                  <button key={opt || 'all'}
                    onClick={() => setFilterType(opt)}
                    style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 11,
                      background: filterType === opt ? 'rgba(255,255,255,0.05)' : 'transparent',
                      border:     filterType === opt ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.05)',
                      color:      filterType === opt ? '#e4e4e7' : '#71717a',
                      cursor: 'pointer', fontWeight: 500,
                    }}>
                    {opt === '' ? t('adsAll') : (TYPE_LABEL[opt] ?? opt)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Losers primeiro — ação imediata */}
          <h2 style={{
            fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8,
            color: filteredLosers.length > 0 ? '#ef4444' : '#a1a1aa',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={14} />
            {t('adsTopLosers')}
          </h2>
          <div style={{ marginBottom: 28 }}>
            <CampaignTable rows={filteredLosers} kind="losers" t={t} />
          </div>

          {/* Winners */}
          <h2 style={{
            fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#22c55e',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <CheckCircle2 size={14} />
            {t('adsTopWinners')}
          </h2>
          <div style={{ marginBottom: 28 }}>
            <CampaignTable rows={filteredWinners} kind="winners" t={t} />
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
