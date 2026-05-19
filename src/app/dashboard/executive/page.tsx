'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { getSocket } from '@/lib/socket'
import {
  RefreshCw, TrendingUp, ShoppingCart, AlertCircle, Tag,
  Sparkles, Package, Activity, BarChart3, ChevronRight,
} from 'lucide-react'
import FullFulfillmentCard from './components/FullFulfillmentCard'
import FlexOpportunityCard from './components/FlexOpportunityCard'
import VisitsLowConvCard from './components/VisitsLowConvCard'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface DashboardSnapshot {
  organization_id:                    string
  seller_id:                          number
  nickname:                           string | null

  total_active_listings:              number
  sales_7d_count:                     number
  sales_7d_units:                     number
  sales_7d_gmv:                       number
  sales_7d_avg_ticket:                number | null

  sales_today_count:                  number
  sales_today_gmv:                    number

  listings_quality_low:               number
  listings_quality_basic:             number
  listings_with_penalty:              number
  listings_incomplete_specs:          number

  active_campaigns:                   number
  campaigns_ending_today:             number
  campaigns_ending_this_week:         number
  campaign_recommendations_pending:   number
  campaign_high_opportunities:        number

  // E2/E3/E4 — nulos no MVP
  reputation_level_id:                string | null
  reputation_color:                   string | null
  reputation_power_seller_status:     string | null
  reputation_complaints_pct:          number | null   // fração 0-1 (espelha claims_rate)
  reputation_cancellations_pct:       number | null   // fração 0-1
  reputation_late_shipments_pct:      number | null   // fração 0-1
  visits_7d:                          number | null
  visits_7d_change_pct:               number | null
  conversion_rate_pct:                number | null
  // E3 Logística (mergeado pelo dashboard refresh a partir de ml_logistics_summary)
  shipments_to_dispatch_today:        number
  shipments_late:                     number
  flex_active_listings:               number
  full_active_listings:               number
  // E5 Ads (org-level — mesmo valor pra todos sellers da org)
  ads_spend_7d:                       number
  ads_revenue_7d:                     number
  ads_clicks_7d:                      number
  ads_impressions_7d:                 number
  ads_acos_7d:                        number | null   // fração 0-1
  ads_roas_7d:                        number | null
  ads_campaigns_active:               number
  ads_campaigns_losing_money:         number

  high_impact_recommendations_count:  number
  high_impact_total_estimated_brl:    number

  last_refresh_at:                    string
  next_refresh_at:                    string | null
}

type Translator = ReturnType<typeof useTranslations>

const LEVEL_BADGE: Record<string, { labelKey: string; color: string; bg: string; border: string }> = {
  '5_green':       { labelKey: 'levelPlatinum',  color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.30)' },
  '4_light_green': { labelKey: 'levelGold',      color: '#84cc16', bg: 'rgba(132,204,22,0.08)', border: 'rgba(132,204,22,0.30)' },
  '3_yellow':      { labelKey: 'levelLeader',    color: '#eab308', bg: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.30)' },
  '2_orange':      { labelKey: 'levelNone',      color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.30)' },
  '1_red':         { labelKey: 'levelRed',       color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.30)' },
  '0_red':         { labelKey: 'levelNoRep',     color: '#a1a1aa', bg: 'rgba(113,113,122,0.08)', border: 'rgba(113,113,122,0.25)' },
  unknown:         { labelKey: 'levelUnknown',   color: '#71717a', bg: 'rgba(255,255,255,0.015)', border: 'rgba(255,255,255,0.10)' },
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const brlPrecise = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number) => v.toLocaleString('pt-BR')

function timeSince(iso: string, t: Translator): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60_000)
  if (m < 1)  return t('timeNow')
  if (m < 60) return t('timeMinutesAgo', { m })
  const h = Math.round(m / 60)
  return h < 24 ? t('timeHoursAgo', { h }) : t('timeDaysAgo', { d: Math.round(h / 24) })
}

function timeUntil(iso: string | null, t: Translator): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return t('timeAnyMoment')
  const m = Math.max(1, Math.round(diff / 60_000))
  return t('timeInMinutes', { m })
}

/** Wrapper de card. Variantes semânticas por cor de borda + glow sutil. */
function KpiCard({
  label, value, hint, icon: Icon, tone = 'neutral', onClick,
}: {
  label: string
  value: string | number
  hint?: string
  icon: typeof Package
  tone?: 'positive' | 'attention' | 'critical' | 'neutral' | 'brand'
  onClick?: () => void
}) {
  const palette = {
    positive:  { border: 'rgba(34,197,94,0.30)',  text: '#22c55e', glow: 'rgba(34,197,94,0.08)' },
    attention: { border: 'rgba(245,158,11,0.30)', text: '#f59e0b', glow: 'rgba(245,158,11,0.08)' },
    critical:  { border: 'rgba(239,68,68,0.30)',  text: '#ef4444', glow: 'rgba(239,68,68,0.08)' },
    brand:     { border: 'rgba(0,229,255,0.30)',  text: '#00E5FF', glow: 'rgba(0,229,255,0.08)' },
    neutral:   { border: 'rgba(255,255,255,0.10)', text: '#e4e4e7', glow: 'rgba(255,255,255,0.02)' },
  }[tone]

  return (
    <div
      onClick={onClick}
      style={{
        background:    'rgba(255,255,255,0.02)',
        border:        `1px solid ${palette.border}`,
        borderRadius:  12,
        padding:       '16px 18px',
        cursor:        onClick ? 'pointer' : 'default',
        transition:    'transform 120ms, border-color 120ms',
        position:      'relative',
        overflow:      'hidden',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div
        style={{
          position: 'absolute',
          top: 0, right: 0,
          width: 120, height: 120,
          background: `radial-gradient(circle at top right, ${palette.glow}, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} color={palette.text} />
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: palette.text, lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: '#71717a', marginTop: 6 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

/** Card placeholder pra campos E2/E3/E4 ainda não cobertos. */
function CoverageAlertCard({
  label, sprintHint, nextRefresh, icon: Icon, t,
}: {
  label: string
  sprintHint: string
  nextRefresh: string | null
  icon: typeof Package
  t: Translator
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.015)',
        border: '1px dashed rgba(255,255,255,0.10)',
        borderRadius: 12,
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} color="#71717a" />
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#71717a' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#71717a', lineHeight: 1.2 }}>
        {t('noData')}
      </div>
      <div style={{ fontSize: 11, color: '#52525b', marginTop: 6, lineHeight: 1.4 }}>
        {t('coverageNextSync', { hint: sprintHint, until: timeUntil(nextRefresh, t) })}
      </div>
    </div>
  )
}

export default function ExecutiveDashboardPage() {
  const t = useTranslations('executive')
  const supabase = useMemo(() => createClient(), [])
  const [snapshots, setSnapshots] = useState<DashboardSnapshot[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tick,      setTick]      = useState(0) // força recálculo dos relógios "há Xm"

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase, t])

  const load = useCallback(async (fresh?: 'sales' | 'all') => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const qs = fresh ? `?fresh=${fresh}` : ''
      const res = await fetch(`${BACKEND}/executive/dashboard${qs}`, { headers })
      if (res.ok) {
        const body = await res.json() as { snapshots: DashboardSnapshot[] }
        setSnapshots(body.snapshots ?? [])
      }
    } catch (err) {
      console.warn('[executive] load fail:', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [getHeaders])

  const triggerRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/executive/dashboard/refresh`, { method: 'POST', headers })
      if (res.ok) {
        const body = await res.json() as { snapshots: DashboardSnapshot[] }
        setSnapshots(body.snapshots ?? [])
      }
    } catch (err) {
      console.warn('[executive] refresh fail:', (err as Error).message)
    } finally {
      setRefreshing(false)
    }
  }, [getHeaders])

  useEffect(() => { void load() }, [load])

  // Atualiza relógios "há Xm" / "em Xm" a cada 30s sem refetch
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Real-time: webhook ML → 'order:invalidate' → debounce 1.5s → load(fresh=sales).
  // Latência típica: <3s do bipe à UI.
  useEffect(() => {
    let active = true
    let debounce: NodeJS.Timeout | null = null

    const handler = () => {
      if (!active) return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => { void load('sales') }, 1500)
    }

    void (async () => {
      try {
        const socket = await getSocket()
        if (!active) return
        socket.on('order:invalidate', handler)
      } catch (err) {
        console.warn('[executive] socket falhou — refresh só via cron 15min:', (err as Error).message)
      }
    })()

    return () => {
      active = false
      if (debounce) clearTimeout(debounce)
      void (async () => {
        try {
          const socket = await getSocket()
          socket.off('order:invalidate', handler)
        } catch { /* ignore */ }
      })()
    }
  }, [load])

  // Agregado: soma KPIs cross-account (Vazzo tem VAZZO_ + ESLAR_).
  const aggregate = useMemo(() => {
    if (snapshots.length === 0) return null
    const sum = (k: keyof DashboardSnapshot) =>
      snapshots.reduce((acc, s) => acc + (typeof s[k] === 'number' ? (s[k] as number) : 0), 0)
    return {
      total_active_listings:    sum('total_active_listings'),
      sales_7d_count:           sum('sales_7d_count'),
      sales_7d_units:           sum('sales_7d_units'),
      sales_7d_gmv:             sum('sales_7d_gmv'),
      sales_today_count:        sum('sales_today_count'),
      sales_today_gmv:          sum('sales_today_gmv'),
      listings_quality_low:     sum('listings_quality_low'),
      listings_with_penalty:    sum('listings_with_penalty'),
      listings_incomplete_specs: sum('listings_incomplete_specs'),
      active_campaigns:         sum('active_campaigns'),
      campaigns_ending_today:   sum('campaigns_ending_today'),
      campaign_recommendations_pending: sum('campaign_recommendations_pending'),
      campaign_high_opportunities:      sum('campaign_high_opportunities'),
      high_impact_recommendations_count: sum('high_impact_recommendations_count'),
      high_impact_total_estimated_brl:   sum('high_impact_total_estimated_brl'),
      shipments_to_dispatch_today:      sum('shipments_to_dispatch_today'),
      shipments_late:                   sum('shipments_late'),
      flex_active_listings:             sum('flex_active_listings'),
      // Ads é org-level — NÃO somar cross-account (todos sellers da org têm
      // o mesmo valor). Pegar do primeiro snapshot.
      ads_spend_7d:                snapshots[0].ads_spend_7d ?? 0,
      ads_revenue_7d:              snapshots[0].ads_revenue_7d ?? 0,
      ads_acos_7d:                 snapshots[0].ads_acos_7d ?? null,
      ads_roas_7d:                 snapshots[0].ads_roas_7d ?? null,
      ads_campaigns_active:        snapshots[0].ads_campaigns_active ?? 0,
      ads_campaigns_losing_money:  snapshots[0].ads_campaigns_losing_money ?? 0,
    }
  }, [snapshots])

  const newestRefresh = useMemo(() => {
    if (snapshots.length === 0) return null
    return snapshots.reduce<string | null>((latest, s) => {
      if (!latest) return s.last_refresh_at
      return new Date(s.last_refresh_at) > new Date(latest) ? s.last_refresh_at : latest
    }, null)
  }, [snapshots])

  const nextRefresh = useMemo(() => {
    if (snapshots.length === 0) return null
    return snapshots.reduce<string | null>((earliest, s) => {
      if (!s.next_refresh_at) return earliest
      if (!earliest) return s.next_refresh_at
      return new Date(s.next_refresh_at) < new Date(earliest) ? s.next_refresh_at : earliest
    }, null)
  }, [snapshots])

  // Suprime warning de re-render se tick atual não muda visual nada
  void tick

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: '#fafafa' }}>
            {t('title')}
          </h1>
          <div style={{ fontSize: 13, color: '#71717a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={12} />
            {newestRefresh
              ? <>{t('updatedNextSync', { since: timeSince(newestRefresh, t), until: timeUntil(nextRefresh, t) })}</>
              : <>{t('noCacheYet')}</>
            }
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

      {loading && !aggregate && (
        <div style={{ textAlign: 'center', padding: 40, color: '#71717a' }}>{t('loading')}</div>
      )}

      {/* Vendas (linha destaque) */}
      {aggregate && (
        <>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginTop: 0, marginBottom: 12 }}>
            {t('sectionRealtimeSales')}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <KpiCard
              icon={TrendingUp} tone="brand"
              label={t('kpiSalesToday')}
              value={num(aggregate.sales_today_count)}
              hint={brl(aggregate.sales_today_gmv)}
            />
            <KpiCard
              icon={BarChart3} tone="brand"
              label={t('kpiGmv7d')}
              value={brl(aggregate.sales_7d_gmv)}
              hint={t('kpiGmv7dHint', { orders: num(aggregate.sales_7d_count), units: num(aggregate.sales_7d_units) })}
            />
            <KpiCard
              icon={ShoppingCart} tone="positive"
              label={t('kpiActiveListings')}
              value={num(aggregate.total_active_listings)}
              hint={snapshots.length > 1 ? t('kpiConnectedAccounts', { count: snapshots.length }) : undefined}
            />
            <KpiCard
              icon={Sparkles} tone="attention"
              label={t('kpiHighImpactRecs')}
              value={num(aggregate.high_impact_recommendations_count)}
              hint={aggregate.high_impact_total_estimated_brl > 0
                ? t('kpiHighImpactValue', { value: brlPrecise(aggregate.high_impact_total_estimated_brl) })
                : t('kpiNoImpactCalc')}
              onClick={() => { window.location.href = '/dashboard/listings?severity=high' }}
            />
          </div>

          {/* Qualidade + Campanhas */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            {t('sectionOpHealth')}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <KpiCard
              icon={AlertCircle}
              tone={aggregate.listings_quality_low > 0 ? 'attention' : 'positive'}
              label={t('kpiLowQuality')}
              value={num(aggregate.listings_quality_low)}
              hint={t('kpiIncompleteSpecs', { count: num(aggregate.listings_incomplete_specs) })}
              onClick={() => { window.location.href = '/dashboard/listings?type=QUALITY_LOW' }}
            />
            <KpiCard
              icon={AlertCircle}
              tone={aggregate.listings_with_penalty > 0 ? 'critical' : 'positive'}
              label={t('kpiPenalizedListings')}
              value={num(aggregate.listings_with_penalty)}
              hint={aggregate.listings_with_penalty > 0 ? t('kpiPenalizedHint') : t('kpiNoPenalty')}
            />
            <KpiCard
              icon={Tag} tone="brand"
              label={t('kpiActiveCampaigns')}
              value={num(aggregate.active_campaigns)}
              hint={aggregate.campaigns_ending_today > 0
                ? t('kpiCampaignsEndingToday', { count: aggregate.campaigns_ending_today })
                : t('kpiCampaignsRecsPending', { count: aggregate.campaign_recommendations_pending })}
              onClick={() => { window.location.href = '/dashboard/ml-campaigns' }}
            />
            <KpiCard
              icon={Sparkles}
              tone={aggregate.campaign_high_opportunities > 0 ? 'attention' : 'neutral'}
              label={t('kpiCampaignOpportunities')}
              value={num(aggregate.campaign_high_opportunities)}
              hint={t('kpiCampaignOppHint')}
              onClick={() => { window.location.href = '/dashboard/ml-campaigns?recommended=high' }}
            />
          </div>

          {/* Reputação (E2) — gauge resumido por conta com link pra detalhes */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            {t('sectionReputation')}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            {snapshots.map(s => {
              const hasData = s.reputation_level_id != null
              if (!hasData) {
                return (
                  <CoverageAlertCard key={s.seller_id} icon={Activity} t={t}
                    label={t('reputationAccountLabel', { account: s.nickname ?? t('accountFallback', { id: s.seller_id }) })}
                    sprintHint={t('awaitingFirstSync')} nextRefresh={nextRefresh} />
                )
              }
              const lvl = LEVEL_BADGE[s.reputation_level_id ?? ''] ?? LEVEL_BADGE.unknown
              return (
                <div key={s.seller_id}
                  onClick={() => { window.location.href = '/dashboard/executive/reputation' }}
                  style={{
                    background:   lvl.bg, border: `1px solid ${lvl.border}`,
                    borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
                    transition: 'transform 120ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Activity size={14} color={lvl.color} />
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
                      {s.nickname ?? t('accountFallback', { id: s.seller_id })}
                    </span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: lvl.color, lineHeight: 1.1 }}>
                    {t(`levels.${lvl.labelKey}`)}
                  </div>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {s.reputation_complaints_pct != null && (
                      <span>{t('repComplaints', { pct: (s.reputation_complaints_pct * 100).toFixed(2) })}</span>
                    )}
                    {s.reputation_late_shipments_pct != null && (
                      <span>{t('repDelays', { pct: (s.reputation_late_shipments_pct * 100).toFixed(2) })}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Logística (E3) — operação do dia + Flex eligível */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            {t('sectionLogistics')}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <KpiCard
              icon={Package}
              tone={(aggregate.shipments_to_dispatch_today ?? 0) > 0 ? 'attention' : 'positive'}
              label={t('kpiToDispatchToday')}
              value={num(aggregate.shipments_to_dispatch_today ?? 0)}
              hint={(aggregate.shipments_to_dispatch_today ?? 0) > 0 ? t('kpiShipmentsReady') : t('kpiNoPending')}
              onClick={() => { window.location.href = '/dashboard/executive/logistics' }}
            />
            <KpiCard
              icon={Activity}
              tone={(aggregate.shipments_late ?? 0) > 0 ? 'critical' : 'positive'}
              label={t('kpiOpenDelays')}
              value={num(aggregate.shipments_late ?? 0)}
              hint={(aggregate.shipments_late ?? 0) > 0 ? t('kpiAffectsReputation') : t('kpiNoDelays')}
              onClick={() => { window.location.href = '/dashboard/executive/logistics' }}
            />
            <KpiCard
              icon={Sparkles}
              tone={(aggregate.flex_active_listings ?? 0) > 0 ? 'positive' : 'neutral'}
              label={t('kpiFlexEligibleItems')}
              value={num(aggregate.flex_active_listings ?? 0)}
              hint={t('kpiFlexFastDelivery')}
              onClick={() => { window.location.href = '/dashboard/executive/logistics' }}
            />
          </div>

          {/* Ads · 7d (E5) — org-level, 1 card só */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            {t('sectionAds7d')}
          </h2>
          {(aggregate.ads_spend_7d ?? 0) === 0 && (aggregate.ads_campaigns_active ?? 0) === 0 ? (
            <div style={{
              background: 'rgba(245,158,11,0.04)',
              border: '1px dashed rgba(245,158,11,0.25)',
              borderRadius: 12, padding: '14px 18px',
              marginBottom: 28, color: '#a1a1aa', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Activity size={14} color="#f59e0b" />
              {t('connectProductAds')} ·{' '}
              <a href="/dashboard/executive/ads" style={{ color: '#00E5FF', textDecoration: 'none' }}>{t('detailsLink')}</a>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12, marginBottom: 28,
            }}>
              <KpiCard
                icon={Activity} tone="critical"
                label={t('kpiAdsSpend')}
                value={brl(aggregate.ads_spend_7d ?? 0)}
                hint={t('kpiAdsActiveCampaigns', { count: aggregate.ads_campaigns_active ?? 0 })}
                onClick={() => { window.location.href = '/dashboard/executive/ads' }}
              />
              <KpiCard
                icon={Activity} tone="positive"
                label={t('kpiAdsRevenue')}
                value={brl(aggregate.ads_revenue_7d ?? 0)}
                hint={
                  aggregate.ads_roas_7d != null
                    ? t('kpiAdsRoas', { roas: aggregate.ads_roas_7d.toFixed(2) })
                    : t('kpiAdsNoReturn')
                }
                onClick={() => { window.location.href = '/dashboard/executive/ads' }}
              />
              <KpiCard
                icon={Activity}
                tone={
                  aggregate.ads_acos_7d == null ? 'neutral' :
                  aggregate.ads_acos_7d <= 0.15 ? 'positive' :
                  aggregate.ads_acos_7d <= 0.30 ? 'attention' : 'critical'
                }
                label={t('kpiAcos')}
                value={aggregate.ads_acos_7d == null ? '—' : `${(aggregate.ads_acos_7d * 100).toFixed(1)}%`}
                hint={t('kpiAcosHint')}
                onClick={() => { window.location.href = '/dashboard/executive/ads' }}
              />
              <KpiCard
                icon={Activity}
                tone={(aggregate.ads_campaigns_losing_money ?? 0) > 0 ? 'critical' : 'positive'}
                label={t('kpiCampaignsLosingMoney')}
                value={num(aggregate.ads_campaigns_losing_money ?? 0)}
                hint={(aggregate.ads_campaigns_losing_money ?? 0) > 0
                  ? t('kpiAcosOverLimit')
                  : t('kpiAllHealthy')}
                onClick={() => { window.location.href = '/dashboard/executive/ads' }}
              />
            </div>
          )}

          {/* Visitas + conversão (E4) */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            {t('sectionVisitsConversion')}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            {snapshots.map(s => {
              const hasVisits = s.visits_7d != null
              if (!hasVisits) {
                return (
                  <CoverageAlertCard key={s.seller_id} icon={BarChart3} t={t}
                    label={t('visitsAccountLabel', { account: s.nickname ?? t('accountFallback', { id: s.seller_id }) })}
                    sprintHint={t('awaitingFirstSync')} nextRefresh={nextRefresh} />
                )
              }
              const conv = s.conversion_rate_pct
              const tone = conv == null ? 'neutral'
                         : conv >= 5 ? 'positive'
                         : conv >= 1 ? 'attention'
                         : 'critical'
              return (
                <div key={s.seller_id}
                  onClick={() => { window.location.href = '/dashboard/executive/visits' }}
                  style={{
                    background: 'rgba(0,229,255,0.03)',
                    border: '1px solid rgba(0,229,255,0.20)',
                    borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
                    transition: 'transform 120ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <BarChart3 size={14} color="#00E5FF" />
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
                      {s.nickname ?? t('accountFallback', { id: s.seller_id })}
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: '#00E5FF', lineHeight: 1.1 }}>
                    {(s.visits_7d ?? 0).toLocaleString('pt-BR')}
                    <span style={{ fontSize: 11, color: '#71717a', fontWeight: 400, marginLeft: 6 }}>{t('visitsPerWeekUnit')}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>
                      {t('convLabel')}{' '}
                      <strong style={{
                        color: tone === 'positive' ? '#22c55e' : tone === 'attention' ? '#f59e0b' : tone === 'critical' ? '#ef4444' : '#71717a',
                      }}>
                        {conv == null ? '—' : `${conv.toFixed(2)}%`}
                      </strong>
                    </span>
                    {s.visits_7d_change_pct != null && (
                      <span style={{ color: s.visits_7d_change_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                        {s.visits_7d_change_pct > 0 ? '+' : ''}{t('changeVsPrev7d', { pct: s.visits_7d_change_pct.toFixed(1) })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* F11 Fase 2 — Full Fulfillment + Flex Opportunity + Visit Low Conv */}
          <h2 style={{
            fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8,
            color: '#a1a1aa', marginBottom: 12, marginTop: 4,
          }}>
            {t('sectionF11Phase2')}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <FullFulfillmentCard />
            <FlexOpportunityCard />
            <VisitsLowConvCard />
          </div>

          {/* Breakdown por conta se >1 */}
          {snapshots.length > 1 && (
            <>
              <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
                {t('sectionByAccount')}
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 12,
              }}>
                {snapshots.map(s => (
                  <div key={s.seller_id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12, padding: '14px 16px',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e4e7' }}>
                        {s.nickname ?? t('accountFallback', { id: s.seller_id })}
                      </div>
                      <ChevronRight size={14} color="#52525b" />
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12 }}>
                      <span style={{ color: '#a1a1aa' }}>
                        {t('byAccountToday')} <strong style={{ color: '#00E5FF' }}>{num(s.sales_today_count)}</strong> · {brl(s.sales_today_gmv)}
                      </span>
                      <span style={{ color: '#a1a1aa' }}>
                        {t('byAccount7d')} <strong style={{ color: '#22c55e' }}>{brl(s.sales_7d_gmv)}</strong>
                      </span>
                      <span style={{ color: '#a1a1aa' }}>
                        {t('byAccountListings')} <strong style={{ color: '#e4e4e7' }}>{num(s.total_active_listings)}</strong>
                      </span>
                      <span style={{ color: '#a1a1aa' }}>
                        {t('byAccountLowQuality')} <strong style={{ color: s.listings_quality_low > 0 ? '#f59e0b' : '#22c55e' }}>{num(s.listings_quality_low)}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
