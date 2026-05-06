'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Megaphone, Plus, Loader2, Search, Activity, DollarSign,
  TrendingUp, Plug, Check, AlertCircle,
} from 'lucide-react'
import {
  AdsCampaignsApi, type AdsCampaign, type AdsPlatform,
  type AdsStatus, type DashboardData, type MetaAdsStatus,
} from '@/components/ads-campaigns/adsCampaignsApi'

const PLATFORM_LABEL: Record<AdsPlatform, string> = {
  meta: 'Meta', google: 'Google', tiktok: 'TikTok', mercado_livre_ads: 'ML Ads',
}
const PLATFORM_COLOR: Record<AdsPlatform, string> = {
  meta: '#0866FF', google: '#4285F4', tiktok: '#FF0050', mercado_livre_ads: '#FFE600',
}
const STATUS_COLOR: Record<AdsStatus, string> = {
  draft: '#71717a', ready: '#00E5FF', publishing: '#a855f7', active: '#22c55e',
  paused: '#f59e0b', completed: '#52525b', error: '#ef4444', archived: '#52525b',
}

export default function AdsHubDashboardPage() {
  const searchParams = useSearchParams()
  const justConnected = searchParams.get('meta_connected') === '1'

  const [meta, setMeta] = useState<MetaAdsStatus | null>(null)
  const [campaigns, setCampaigns] = useState<AdsCampaign[] | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterPlatform, setFilterPlatform] = useState<AdsPlatform | ''>('')
  const [filterStatus, setFilterStatus] = useState<AdsStatus | ''>('')

  async function refresh() {
    setLoading(true); setError(null)
    try {
      const [m, d, c] = await Promise.all([
        AdsCampaignsApi.metaStatus(),
        AdsCampaignsApi.dashboard(),
        AdsCampaignsApi.list({ platform: filterPlatform || undefined, status: filterStatus || undefined, limit: 100 }),
      ])
      setMeta(m); setDashboard(d); setCampaigns(c.items)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [filterPlatform, filterStatus])  // eslint-disable-line

  async function connectMeta() {
    try {
      const { authorize_url } = await AdsCampaignsApi.metaConnect('/dashboard/ads-campaigns')
      window.location.href = authorize_url
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Megaphone size={20} className="text-cyan-400" />
            Ads Hub
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Campanhas Meta/Google/TikTok geradas a partir do catálogo. Um produto, um clique, uma campanha completa.
          </p>
        </div>
        <Link
          href="/dashboard/ads-campaigns/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-medium shrink-0"
        >
          <Plus size={14} /> Nova campanha
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {justConnected && meta?.connected && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
          <Check size={14} /> Meta Ads conectado!
        </div>
      )}

      {/* Meta connection card */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#0866FF20' }}>
              <Plug size={18} style={{ color: '#0866FF' }} />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">Meta Ads (Facebook/Instagram)</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {!meta?.configured_globally && '⚠ App Meta não configurado pelo admin'}
                {meta?.configured_globally && !meta.connected && 'Não conectado'}
                {meta?.connected && !meta.ad_account_id && 'Conectado · Selecione uma Ad Account'}
                {meta?.connected && meta.ad_account_id && (
                  <>Conectado · Ad Account <span className="font-mono text-cyan-300">{meta.ad_account_id}</span></>
                )}
              </p>
            </div>
          </div>
          {meta?.configured_globally && !meta.connected && (
            <button
              onClick={connectMeta}
              className="px-3 py-1.5 rounded-lg bg-[#0866FF] hover:bg-[#0563d6] text-white text-xs font-medium"
            >
              Conectar Meta
            </button>
          )}
        </div>
      </div>

      {/* Dashboard summary */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard
            label="Campanhas ativas"
            value={dashboard.total.count}
            icon={<Activity size={16} className="text-cyan-400" />}
          />
          <SummaryCard
            label="Investimento total"
            value={`R$ ${dashboard.total.spend_brl.toFixed(2)}`}
            icon={<DollarSign size={16} className="text-emerald-400" />}
          />
          <SummaryCard
            label="Conversões"
            value={dashboard.total.conversions}
            icon={<TrendingUp size={16} className="text-amber-400" />}
          />
        </div>
      )}

      {/* By platform */}
      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.entries(dashboard.by_platform) as [AdsPlatform, DashboardData['by_platform'][AdsPlatform]][])
            .filter(([, v]) => v.count > 0)
            .map(([plat, d]) => (
            <div key={plat} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-3 rounded-sm" style={{ background: PLATFORM_COLOR[plat] }} />
                <p className="text-[11px] text-zinc-400">{PLATFORM_LABEL[plat]}</p>
              </div>
              <p className="text-sm text-zinc-200">{d.count} campanha{d.count > 1 ? 's' : ''}</p>
              <p className="text-[11px] text-zinc-500">R$ {d.spend_brl.toFixed(2)} gastos</p>
              {d.roas_avg != null && (
                <p className="text-[11px] text-emerald-300">ROAS médio {d.roas_avg.toFixed(2)}×</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Search size={12} className="text-zinc-500" />
        <select
          value={filterPlatform}
          onChange={e => setFilterPlatform(e.target.value as AdsPlatform | '')}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-cyan-400/60"
        >
          <option value="">Todas plataformas</option>
          {(['meta','google','tiktok','mercado_livre_ads'] as const).map(p => (
            <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as AdsStatus | '')}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 outline-none focus:border-cyan-400/60"
        >
          <option value="">Todos status</option>
          {(['draft','ready','publishing','active','paused','completed','error','archived'] as const).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Campaigns list */}
      {loading && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> carregando…
        </div>
      )}

      {!loading && campaigns && campaigns.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-2">
          <Megaphone size={28} className="mx-auto text-cyan-400 opacity-60" />
          <p className="text-sm text-zinc-300">Nenhuma campanha ainda.</p>
          <p className="text-xs text-zinc-500">Selecione um produto e gere a primeira campanha em segundos.</p>
          <Link
            href="/dashboard/ads-campaigns/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-medium mt-2"
          >
            <Plus size={14} /> Criar primeira
          </Link>
        </div>
      )}

      {!loading && campaigns && campaigns.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800">
          {campaigns.map(c => (
            <Link
              key={c.id}
              href={`/dashboard/ads-campaigns/${c.id}`}
              className="flex items-start sm:items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-900/60 transition-colors flex-col sm:flex-row"
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span className="w-2 h-12 rounded-sm shrink-0" style={{ background: PLATFORM_COLOR[c.platform] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {PLATFORM_LABEL[c.platform]} · {c.objective} · {c.ad_copies.length} variantes · R$ {Number(c.budget_daily_brl).toFixed(2)}/dia
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] border whitespace-nowrap"
                  style={{
                    borderColor: `${STATUS_COLOR[c.status]}40`,
                    background:  `${STATUS_COLOR[c.status]}10`,
                    color:       STATUS_COLOR[c.status],
                  }}
                >
                  {c.status}
                </span>
                {(c.metrics as { roas?: number }).roas != null && (
                  <span className="text-[10px] text-emerald-300 font-mono">
                    ROAS {(c.metrics as { roas: number }).roas.toFixed(2)}×
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  )
}
