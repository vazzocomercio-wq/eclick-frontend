'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  Sparkles, Loader2, ChevronRight, AlertOctagon, ShieldCheck,
  Zap, Recycle, X, RefreshCw,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Recommendation {
  id:                       string
  campaign_item_id:         string
  product_id:               string | null
  opportunity_score:        number | null
  recommendation:           string
  recommendation_reason:    string
  recommended_strategy:     string | null
  recommended_price:        number | null
  recommended_quantity:     number | null
  status:                   string
  warnings:                 Array<{ code: string; severity: string; message: string }>
  expires_at:               string | null
  ml_campaign_items?: {
    ml_item_id:      string
    ml_campaign_id:  string
    original_price:  number | null
    current_price:   number | null
    status:          string
  }
  ml_campaigns?: {
    name:               string | null
    ml_promotion_type:  string
    deadline_date:      string | null
    has_subsidy_items:  boolean
  }
  seller_id: number
}

interface ListResp { recommendations: Recommendation[]; total: number }

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

function RecoFallback() {
  const t = useTranslations('mlCampaigns.recommendations')
  return <div className="p-6 text-zinc-500 text-sm">{t('loading')}</div>
}

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<RecoFallback />}>
      <Inner />
    </Suspense>
  )
}

function Inner() {
  const t        = useTranslations('mlCampaigns.recommendations')
  const sp       = useSearchParams()
  const router   = useRouter()
  const pathname = usePathname()
  const { selected: selectedSellerId } = useMlAccount()

  const classification = sp.get('classification') ?? ''
  const status         = sp.get('status') ?? 'pending'
  const minScore       = sp.get('min_score') ?? ''

  const [recos, setRecos]     = useState<Recommendation[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
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
      if (sid != null)        params.set('seller_id', String(sid))
      if (classification)     params.set('classification', classification)
      if (status)             params.set('status', status)
      if (minScore)           params.set('min_score', minScore)
      params.set('limit', '100')
      const r = await fetch(`${BACKEND}/ml-campaigns/recommendations?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      const body = (await r.json()) as ListResp
      setRecos(body.recommendations); setTotal(body.total)
    } catch (e) {
      setError((e as Error).message)
      setRecos([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [classification, status, minScore])

  useEffect(() => { void load() }, [load, selectedSellerId])

  async function generateNow() {
    setGenerating(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const url = sid != null
        ? `${BACKEND}/ml-campaigns/recommendations/generate?seller_id=${sid}`
        : `${BACKEND}/ml-campaigns/recommendations/generate`
      const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">{t('breadcrumb')}</Link>
            <span>/</span>
            <span className="text-zinc-300">{t('breadcrumbCurrent')}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Sparkles size={22} className="text-cyan-400" />
            {t('title')}
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            {loading ? t('loading') : t('count', { count: total })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AccountSelector compact hideWhenEmpty />
          <button onClick={generateNow} disabled={generating}
            className="glow-rainbow flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold">
            {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {generating ? t('generating') : t('generateNow')}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs"
        style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <FilterChip label={t('filter.classification')} value={classification}
          options={[
            { value: '',                    label: t('filter.allClassifications') },
            { value: 'recommended',         label: t('filter.classRecommended') },
            { value: 'recommended_caution', label: t('filter.classCaution') },
            { value: 'clearance_only',      label: t('filter.classClearance') },
            { value: 'review_costs',        label: t('filter.classReviewCosts') },
            { value: 'low_quality_listing', label: t('filter.classLowQuality') },
            { value: 'skip',                label: t('filter.classSkip') },
          ]}
          onChange={v => updateFilter({ classification: v || null })}
        />
        <FilterChip label={t('filter.status')} value={status}
          options={[
            { value: 'pending',  label: t('filter.statusPending') },
            { value: 'approved', label: t('filter.statusApproved') },
            { value: 'edited',   label: t('filter.statusEdited') },
            { value: 'rejected', label: t('filter.statusRejected') },
            { value: 'applied',  label: t('filter.statusApplied') },
          ]}
          onChange={v => updateFilter({ status: v || null })}
        />
        <FilterChip label={t('filter.minScore')} value={minScore}
          options={[
            { value: '',   label: t('filter.minScoreAny') },
            { value: '50', label: '≥ 50' },
            { value: '70', label: '≥ 70' },
            { value: '85', label: '≥ 85' },
          ]}
          onChange={v => updateFilter({ min_score: v || null })}
        />
        {(classification || minScore) && (
          <button onClick={() => router.replace(pathname)} className="ml-auto text-zinc-500 hover:text-red-400">
            {t('clearFilters')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && recos.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-zinc-900/50 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && recos.length === 0 && !error && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <Sparkles size={48} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-300 font-medium">{t('empty.title')}</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
            {t('empty.desc')}
          </p>
        </div>
      )}

      {recos.length > 0 && (
        <div className="space-y-2">
          {recos.map(r => <RecoCard key={r.id} reco={r} />)}
        </div>
      )}
    </div>
  )
}

function RecoCard({ reco }: { reco: Recommendation }) {
  const t = useTranslations('mlCampaigns.recommendations')
  const td = useTranslations('mlCampaigns')
  const config = classificationConfig(reco.recommendation)
  const score = reco.opportunity_score ?? 0

  return (
    <Link href={`/dashboard/ml-campaigns/recommendations/${reco.id}`}
      className="block rounded-lg p-4 transition-all hover:border-cyan-400/30"
      style={{ background: '#0c0c10', border: `1px solid ${config.color}30` }}>
      <div className="flex items-start gap-4">
        {/* Score */}
        <div className="flex-shrink-0 rounded-lg w-14 h-14 flex flex-col items-center justify-center font-bold"
          style={{ background: `${scoreColor(score)}15`, border: `1px solid ${scoreColor(score)}40`, color: scoreColor(score) }}>
          <span className="text-lg leading-none">{score}</span>
          <span className="text-[8px] mt-0.5 opacity-70">/100</span>
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1"
              style={{ background: `${config.color}15`, color: config.color, border: `1px solid ${config.color}40` }}>
              {config.icon} {config.key ? t(`classification.${config.key}`) : reco.recommendation}
            </span>
            <span className="font-mono text-xs text-zinc-300">{reco.ml_campaign_items?.ml_item_id ?? '—'}</span>
            {reco.ml_campaigns?.has_subsidy_items && (
              <span className="text-[10px] text-cyan-400">{t('subsidyTag')}</span>
            )}
          </div>

          <p className="text-xs text-zinc-300 mt-1.5 line-clamp-2 leading-relaxed">
            {reco.recommendation_reason}
          </p>

          {/* Action preview */}
          {reco.recommended_price != null && reco.recommended_quantity != null && (
            <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-400">
              <span>
                {t('suggestedPrice')}: <strong className="text-zinc-200">R$ {reco.recommended_price.toFixed(2)}</strong>
                {reco.ml_campaign_items?.original_price && (
                  <span className="ml-1 text-emerald-400">
                    −{Math.round(((reco.ml_campaign_items.original_price - reco.recommended_price) / reco.ml_campaign_items.original_price) * 100)}%
                  </span>
                )}
              </span>
              <span>·</span>
              <span>{t('quantity')}: <strong className="text-zinc-200">{t('unitsValue', { n: reco.recommended_quantity })}</strong></span>
              <span>·</span>
              <span className="capitalize">{reco.recommended_strategy ?? '—'}</span>
            </div>
          )}

          {/* Warnings */}
          {reco.warnings && reco.warnings.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {reco.warnings.slice(0, 3).map((w, i) => (
                <span key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                  style={{
                    background: w.severity === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)',
                    color:      w.severity === 'high' ? '#f87171' : '#fbbf24',
                    border:     `1px solid ${w.severity === 'high' ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.25)'}`,
                  }}>
                  <AlertOctagon size={9} /> {w.message}
                </span>
              ))}
            </div>
          )}

          {/* Campaign info */}
          <div className="text-[10px] text-zinc-500 mt-2">
            {reco.ml_campaigns?.name ?? reco.ml_campaign_items?.ml_campaign_id} ·
            {' '}{reco.ml_campaigns?.ml_promotion_type}
            {reco.expires_at && ` · ${t('expires', { date: new Date(reco.expires_at).toLocaleDateString('pt-BR') })}`}
            {' '}· {td('seller', { id: reco.seller_id })}
          </div>
        </div>

        <ChevronRight size={14} className="text-zinc-600 flex-shrink-0 mt-1" />
      </div>
    </Link>
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
          background: value && value !== 'pending' ? 'rgba(0,229,255,0.08)' : '#09090b',
          border: `1px solid ${value && value !== 'pending' ? 'rgba(0,229,255,0.3)' : '#1a1a1f'}`,
          color: value && value !== 'pending' ? '#67e8f9' : '#fafafa',
        }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function classificationConfig(c: string): { key: string | null; color: string; icon: string } {
  switch (c) {
    case 'recommended':         return { key: 'recommended',       color: '#22c55e', icon: '✅' }
    case 'recommended_caution': return { key: 'recommended_caution', color: '#fbbf24', icon: '⚠️' }
    case 'clearance_only':      return { key: 'clearance_only',     color: '#a78bfa', icon: '♻️' }
    case 'review_costs':        return { key: 'review_costs',       color: '#f97316', icon: '📋' }
    case 'low_quality_listing': return { key: 'low_quality_listing', color: '#ef4444', icon: '🔧' }
    case 'skip':                return { key: 'skip',               color: '#71717a', icon: '❌' }
    default:                    return { key: null,                color: '#71717a', icon: '·' }
  }
}

function scoreColor(s: number): string {
  if (s >= 75) return '#22c55e'
  if (s >= 50) return '#fbbf24'
  if (s > 0)   return '#ef4444'
  return '#52525b'
}
