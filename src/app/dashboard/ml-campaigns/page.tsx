'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  RefreshCw, Loader2, Megaphone, Clock, ShieldAlert, Sparkles,
  TrendingUp, AlertOctagon, ChevronRight, Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Dashboard {
  total_active_campaigns:        number
  total_pending_campaigns:       number
  total_ending_today:            number
  total_ending_this_week:        number
  total_candidate_items:         number
  total_pending_items:           number
  total_participating_items:     number
  items_missing_cost:            number
  items_missing_tax:             number
  items_health_ok:               number
  total_meli_subsidy_available:  number
  last_sync_at:                  string | null
  sellers?: Array<{ seller_id: number; active_campaigns: number; candidate_items: number; participating_items: number }>
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

type AgoT = (key: string, values?: Record<string, string | number>) => string

function ago(iso: string | null, t: AgoT): string {
  if (!iso) return t('ago.never')
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return t('ago.now')
  if (min < 60) return t('ago.minutes', { n: min })
  const h = Math.floor(min / 60)
  if (h < 24) return t('ago.hours', { n: h })
  return t('ago.days', { n: Math.floor(h / 24) })
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function MlCampaignsDashboardPage() {
  const t = useTranslations('mlCampaigns')
  const { selected: selectedSellerId } = useMlAccount()
  const [data, setData]       = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const url = sid != null
        ? `${BACKEND}/ml-campaigns/dashboard?seller_id=${sid}`
        : `${BACKEND}/ml-campaigns/dashboard`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) {
        const body = await r.text().catch(() => '')
        throw new Error(`HTTP ${r.status}: ${body || r.statusText}`)
      }
      setData(await r.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load, selectedSellerId])

  async function syncNow() {
    setSyncing(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const url = sid != null
        ? `${BACKEND}/ml-campaigns/sync?seller_id=${sid}`
        : `${BACKEND}/ml-campaigns/sync`
      const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      // Sync agora roda em background. Resposta retorna { log_id, status: 'running' }
      // imediatamente. Damos feedback visual e fazemos polling soft a cada 10s
      // ate o status mudar pra completed/failed.
      const { log_id } = await r.json() as { log_id: string; status: string }

      // Polling soft: 30 ticks de 10s = 5min cap
      let ticks = 0
      const maxTicks = 30
      const poll = async () => {
        ticks++
        if (ticks > maxTicks) { setSyncing(false); await load(); return }
        try {
          const lr = await fetch(`${BACKEND}/ml-campaigns/sync/logs?limit=5`, { headers: { Authorization: `Bearer ${t}` } })
          if (lr.ok) {
            const logs = await lr.json() as Array<{ id: string; status: string }>
            const ours = logs.find(l => l.id === log_id)
            if (ours && ['completed', 'failed', 'partial'].includes(ours.status)) {
              setSyncing(false)
              await load()
              return
            }
          }
        } catch { /* segue tentando */ }
        setTimeout(poll, 10_000)
      }
      setTimeout(poll, 5_000)
    } catch (e) {
      setError((e as Error).message)
      setSyncing(false)
    }
  }

  const totalCampaigns = (data?.total_active_campaigns ?? 0) + (data?.total_pending_campaigns ?? 0)
  const totalItems = (data?.total_candidate_items ?? 0) + (data?.total_participating_items ?? 0) + (data?.total_pending_items ?? 0)
  const itemsHealthIssues = (data?.items_missing_cost ?? 0) + (data?.items_missing_tax ?? 0)

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-widest">{t('eyebrow')}</p>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Megaphone size={22} className="text-cyan-400" />
            {t('title')}
          </h1>
          {data?.last_sync_at && (
            <p className="text-[11px] text-zinc-500 mt-1">{t('lastSync', { time: ago(data.last_sync_at, t) })}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AccountSelector compact hideWhenEmpty />
          <button onClick={syncNow} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold">
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? t('syncing') : t('syncNow')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-zinc-900/50 animate-pulse" />
          ))}
        </div>
      )}

      {data && totalCampaigns === 0 && totalItems === 0 && !loading && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <Megaphone size={48} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-300 font-medium">{t('empty.title')}</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
            {t('empty.desc')}
          </p>
        </div>
      )}

      {data && (totalCampaigns > 0 || totalItems > 0) && (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label={t('kpi.activeCampaigns')}
              value={`${data.total_active_campaigns}`}
              suffix={data.total_pending_campaigns > 0 ? ` ${t('kpi.activeCampaignsSuffix', { n: data.total_pending_campaigns })}` : ''}
              color="#22c55e"
              icon={<Megaphone size={14} />}
              href="/dashboard/ml-campaigns/list"
            />
            <KpiCard
              label={t('kpi.candidateItems')}
              value={`${data.total_candidate_items}`}
              suffix={data.total_participating_items > 0 ? ` ${t('kpi.candidateItemsSuffix', { n: data.total_participating_items })}` : ''}
              color="#00E5FF"
              icon={<Sparkles size={14} />}
            />
            <KpiCard
              label={t('kpi.endingThisWeek')}
              value={`${data.total_ending_this_week}`}
              suffix={data.total_ending_today > 0 ? ` ${t('kpi.endingThisWeekSuffix', { n: data.total_ending_today })}` : ''}
              color={data.total_ending_today > 0 ? '#ef4444' : '#fbbf24'}
              icon={<Clock size={14} />}
              href="/dashboard/ml-campaigns/deadlines"
            />
            <KpiCard
              label={t('kpi.mlSubsidy')}
              value={brl(data.total_meli_subsidy_available)}
              color="#a78bfa"
              icon={<TrendingUp size={14} />}
            />
          </div>

          {/* Health alerts */}
          {itemsHealthIssues > 0 && (
            <div className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <AlertOctagon size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-200 font-medium text-sm">
                  {t('healthAlert.title', { count: itemsHealthIssues })}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t('healthAlert.desc')}
                </p>
              </div>
              <Link href="/dashboard/ml-campaigns/health"
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 flex-shrink-0">
                {t('healthAlert.fix')} <ChevronRight size={12} />
              </Link>
            </div>
          )}

          {/* Distribuicao por status */}
          <div className="rounded-xl p-5 space-y-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {t('itemDistribution')}
            </h2>
            <ItemDistribution
              candidate={data.total_candidate_items}
              pending={data.total_pending_items}
              started={data.total_participating_items}
              healthOk={data.items_health_ok}
              total={totalItems}
            />
          </div>

          {/* Atalhos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Link href="/dashboard/ml-campaigns/recommendations"
              className="rounded-lg px-3 py-2.5 text-xs font-semibold hover:border-cyan-400/40 transition-colors inline-flex items-center gap-1.5"
              style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.3)', color: '#67e8f9' }}>
              <Sparkles size={12} /> {t('shortcuts.recommendations')}
            </Link>
            <Link href="/dashboard/ml-campaigns/list"
              className="rounded-lg px-3 py-2.5 text-xs font-medium hover:border-cyan-400/40 transition-colors"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#a1a1aa' }}>
              {t('shortcuts.allCampaigns')}
            </Link>
            <Link href="/dashboard/ml-campaigns/deadlines"
              className="rounded-lg px-3 py-2.5 text-xs font-medium hover:border-cyan-400/40 transition-colors"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#a1a1aa' }}>
              {t('shortcuts.endingSoon')}
            </Link>
            <Link href="/dashboard/ml-campaigns/health"
              className="rounded-lg px-3 py-2.5 text-xs font-medium hover:border-cyan-400/40 transition-colors"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#a1a1aa' }}>
              {t('shortcuts.healthCheck')}
            </Link>
          </div>

          {/* Multi-conta breakdown */}
          {data.sellers && data.sellers.length > 1 && (
            <div className="rounded-xl p-5" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                {t('byAccount')}
              </h2>
              <div className="space-y-2">
                {data.sellers.map(s => (
                  <div key={s.seller_id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1f' }}>
                    <span className="text-zinc-300 font-mono">{t('seller', { id: s.seller_id })}</span>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                      <span>{t('sellerCampaigns', { n: s.active_campaigns })}</span>
                      <span>·</span>
                      <span>{t('sellerCandidates', { n: s.candidate_items })}</span>
                      <span>·</span>
                      <span>{t('sellerParticipating', { n: s.participating_items })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, suffix, color, icon, href }: {
  label: string; value: string; suffix?: string; color: string;
  icon?: React.ReactNode; href?: string;
}) {
  const inner = (
    <div className="rounded-xl p-4 transition-all hover:scale-[1.01]"
      style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        <div style={{ color }}>{icon}</div>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}{suffix && <span className="text-xs text-zinc-500 font-normal">{suffix}</span>}
      </p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function ItemDistribution({ candidate, pending, started, healthOk, total }: {
  candidate: number; pending: number; started: number; healthOk: number; total: number;
}) {
  const t = useTranslations('mlCampaigns')
  const pct = (n: number) => total > 0 ? (n / total) * 100 : 0
  return (
    <>
      <div className="flex h-3 rounded-full overflow-hidden" style={{ background: '#1a1a1f' }}>
        {candidate > 0 && <div style={{ width: `${pct(candidate)}%`, background: '#00E5FF' }} title={`${t('dist.candidate')}: ${candidate}`} />}
        {pending   > 0 && <div style={{ width: `${pct(pending)}%`,   background: '#a78bfa' }} title={`${t('dist.scheduled')}: ${pending}`} />}
        {started   > 0 && <div style={{ width: `${pct(started)}%`,   background: '#22c55e' }} title={`${t('dist.participating')}: ${started}`} />}
      </div>
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <Legend color="#00E5FF" label={`${t('dist.candidate')} (${candidate})`}    />
        <Legend color="#a78bfa" label={`${t('dist.scheduled')} (${pending})`}     />
        <Legend color="#22c55e" label={`${t('dist.participating')} (${started})`}    />
        <span className="ml-auto text-zinc-500">
          <strong className="text-emerald-400">{healthOk}</strong>/{total} {t('dist.readyToJoin')}
        </span>
      </div>
    </>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-zinc-400">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
