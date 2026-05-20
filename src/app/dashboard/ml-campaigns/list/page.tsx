'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  Megaphone, Clock, Loader2, ChevronRight, Sparkles, X, ArrowUpDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Campaign {
  id:                          string
  ml_campaign_id:              string
  ml_promotion_type:           string
  name:                        string | null
  start_date:                  string | null
  finish_date:                 string | null
  deadline_date:               string | null
  status:                      string
  candidate_count:             number
  pending_count:               number
  started_count:               number
  has_subsidy_items:           boolean
  items_with_subsidy_count:    number
  avg_meli_subsidy_pct:        number | null
  seller_id:                   number
}

interface ListResp { campaigns: Campaign[]; total: number }

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

function ListFallback() {
  const t = useTranslations('mlCampaigns.list')
  return <div className="p-6 text-zinc-500 text-sm">{t('loading')}</div>
}

export default function CampaignsListPage() {
  return (
    <Suspense fallback={<ListFallback />}>
      <Inner />
    </Suspense>
  )
}

function Inner() {
  const t        = useTranslations('mlCampaigns.list')
  const sp       = useSearchParams()
  const router   = useRouter()
  const pathname = usePathname()
  const { selected: selectedSellerId } = useMlAccount()

  const status     = sp.get('status')      ?? ''
  const type       = sp.get('type')        ?? ''
  const hasSubsidy = sp.get('has_subsidy') ?? ''

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const updateFilter = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else                        next.set(k, v)
    }
    router.replace(`${pathname}?${next.toString()}`)
  }, [sp, router, pathname])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const params = new URLSearchParams()
      if (sid != null)   params.set('seller_id', String(sid))
      if (status)        params.set('status', status)
      if (type)          params.set('type',   type)
      if (hasSubsidy)    params.set('has_subsidy', hasSubsidy)
      params.set('limit', '200')
      const r = await fetch(`${BACKEND}/ml-campaigns?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      const body = (await r.json()) as ListResp
      setCampaigns(body.campaigns); setTotal(body.total)
    } catch (e) {
      setError((e as Error).message)
      setCampaigns([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [status, type, hasSubsidy])

  useEffect(() => { void load() }, [load, selectedSellerId])

  const hasFilters = !!(status || type || hasSubsidy)

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400 transition-colors">
              {t('breadcrumb')}
            </Link>
            <span>/</span>
            <span className="text-zinc-300">{t('breadcrumbCurrent')}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">{t('title')}</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {loading ? t('loading') : t('campaignsCount', { count: total })}
          </p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {/* Filtros */}
      <div className="rounded-xl p-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FilterChip label={t('filter.status')} value={status}
            options={[
              { value: '',         label: t('filter.all') },
              { value: 'started',  label: t('filter.statusStarted') },
              { value: 'pending',  label: t('filter.statusPending') },
              { value: 'finished', label: t('filter.statusFinished') },
              { value: 'paused',   label: t('filter.statusPaused') },
            ]}
            onChange={v => updateFilter({ status: v || null })}
          />
          <FilterChip label={t('filter.type')} value={type}
            options={[
              { value: '',                     label: t('filter.all') },
              { value: 'DEAL',                 label: t('filter.typeDeal') },
              { value: 'SMART',                label: t('filter.typeSmart') },
              { value: 'LIGHTNING',            label: t('filter.typeLightning') },
              { value: 'PRICE_DISCOUNT',       label: t('filter.typePriceDiscount') },
              { value: 'MARKETPLACE_CAMPAIGN', label: t('filter.typeMarketplace') },
              { value: 'DOD',                  label: t('filter.typeDod') },
              { value: 'VOLUME',               label: t('filter.typeVolume') },
            ]}
            onChange={v => updateFilter({ type: v || null })}
          />
          <FilterChip label={t('filter.subsidy')} value={hasSubsidy}
            options={[
              { value: '',     label: t('filter.all') },
              { value: 'true', label: t('filter.withSubsidy') },
              { value: 'false',label: t('filter.withoutSubsidy') },
            ]}
            onChange={v => updateFilter({ has_subsidy: v || null })}
          />
          {hasFilters && (
            <button onClick={() => router.replace(pathname)}
              className="ml-auto text-zinc-500 hover:text-red-400 transition-colors">
              {t('clearFilters')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && campaigns.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-zinc-900/50 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <Megaphone size={48} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-300 font-medium">{t('empty.title')}</p>
          <p className="text-xs text-zinc-500 mt-2">
            {hasFilters ? t('empty.descFiltered') : t('empty.descNoSync')}
          </p>
        </div>
      )}

      {/* Cards */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}
    </div>
  )
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const t = useTranslations('mlCampaigns.list')
  const td = useTranslations('mlCampaigns')
  const totalItems = campaign.candidate_count + campaign.pending_count + campaign.started_count
  const deadline = campaign.deadline_date ? deadlineLabel(campaign.deadline_date, td) : null

  return (
    <Link href={`/dashboard/ml-campaigns/${campaign.id}`}
      className="block rounded-xl p-4 transition-all hover:scale-[1.01]"
      style={{
        background: '#0c0c10',
        border: campaign.has_subsidy_items ? '1px solid rgba(0,229,255,0.3)' : '1px solid #1a1a1f',
      }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <CampaignTypeBadge type={campaign.ml_promotion_type} />
        <StatusBadge status={campaign.status} />
      </div>

      <h3 className="font-semibold text-sm text-zinc-100 line-clamp-2 leading-snug">
        {campaign.name ?? `${campaign.ml_promotion_type} ${campaign.ml_campaign_id}`}
      </h3>

      {/* Subsidy callout */}
      {campaign.has_subsidy_items && campaign.avg_meli_subsidy_pct != null && (
        <div className="mt-2 px-2 py-1 rounded inline-flex items-center gap-1 text-[10px] font-semibold"
          style={{ background: 'rgba(0,229,255,0.1)', color: '#67e8f9', border: '1px solid rgba(0,229,255,0.25)' }}>
          <Sparkles size={10} />
          {t('mlSubsidizes', { pct: campaign.avg_meli_subsidy_pct.toFixed(1) })}
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-300">{t('itemsCount', { n: campaign.items_with_subsidy_count })}</span>
        </div>
      )}

      {/* Counters */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Counter label={t('counter.candidates')}   value={campaign.candidate_count} color="#00E5FF" />
        <Counter label={t('counter.scheduled')}  value={campaign.pending_count}   color="#a78bfa" />
        <Counter label={t('counter.participating')} value={campaign.started_count}   color="#22c55e" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 text-[11px] text-zinc-500"
        style={{ borderTop: '1px solid #1a1a1f' }}>
        {deadline ? (
          <span className="flex items-center gap-1" style={{ color: deadline.color }}>
            <Clock size={10} /> {deadline.label}
          </span>
        ) : (
          <span>{t('eligibleItems', { n: totalItems })}</span>
        )}
        <span className="font-mono">{td('seller', { id: campaign.seller_id })}</span>
      </div>
    </Link>
  )
}

const CAMPAIGN_TYPE_COLORS: Record<string, string> = {
  DEAL: '#a78bfa', SMART: '#00E5FF', LIGHTNING: '#f97316', PRICE_DISCOUNT: '#22c55e',
  MARKETPLACE_CAMPAIGN: '#fbbf24', DOD: '#ec4899', VOLUME: '#84cc16', PRE_NEGOTIATED: '#94a3b8',
  SELLER_CAMPAIGN: '#94a3b8', PRICE_MATCHING: '#94a3b8', UNHEALTHY_STOCK: '#ef4444',
  SELLER_COUPON_CAMPAIGN: '#94a3b8',
}

function CampaignTypeBadge({ type }: { type: string }) {
  const t = useTranslations('mlCampaigns')
  const color = CAMPAIGN_TYPE_COLORS[type] ?? '#71717a'
  const label = CAMPAIGN_TYPE_COLORS[type] ? t(`campaignType.${type}`) : type
  return (
    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold"
      style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}>
      {label}
    </span>
  )
}

const STATUS_COLORS: Record<string, string> = {
  started: '#22c55e', pending: '#a78bfa', finished: '#71717a', paused: '#fbbf24', expired: '#ef4444',
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('mlCampaigns')
  const color = STATUS_COLORS[status] ?? '#71717a'
  const label = STATUS_COLORS[status] ? t(`statusBadge.${status}`) : status
  return (
    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold"
      style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}>
      {label}
    </span>
  )
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center rounded p-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <p className="text-base font-bold" style={{ color }}>{value}</p>
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function FilterChip({ label, value, options, onChange }: {
  label: string; value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-zinc-500 text-[10px] uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer"
        style={{
          background: value ? 'rgba(0,229,255,0.08)' : '#09090b',
          border: `1px solid ${value ? 'rgba(0,229,255,0.3)' : '#1a1a1f'}`,
          color: value ? '#67e8f9' : '#fafafa',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

type DeadlineT = (key: string, values?: Record<string, string | number>) => string

function deadlineLabel(iso: string, t: DeadlineT): { label: string; color: string } {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms < 0)            return { label: t('deadline.expired'), color: '#ef4444' }
  const h = Math.floor(ms / 3_600_000)
  if (h < 1)             return { label: t('deadline.lessThanHour'), color: '#ef4444' }
  if (h < 24)            return { label: t('deadline.hours', { h }), color: '#ef4444' }
  const d = Math.floor(h / 24)
  if (d <= 2)            return { label: t('deadline.days', { d }), color: '#fbbf24' }
  return { label: t('deadline.days', { d }), color: '#71717a' }
}
