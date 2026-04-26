'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, Megaphone, AlertCircle, ChevronDown, ChevronRight,
  TrendingUp, MousePointerClick, Eye, DollarSign, Target, Activity,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type Campaign = {
  id: string
  name: string | null
  status: string | null
  daily_budget: number | null
  type: string | null
  clicks: number
  impressions: number
  spend: number
  conversions: number
  revenue: number
  ctr: number
  roas: number
  acos: number
}

type SeriesPoint = {
  date: string
  clicks: number
  impressions: number
  spend: number
  conversions: number
  revenue: number
  ctr: number
  roas: number
  acos: number
}

type SummaryResp = {
  totals: {
    clicks: number; impressions: number; spend: number
    conversions: number; revenue: number
    ctr: number; roas: number; acos: number
  }
  series: SeriesPoint[]
}

type CampaignDayRow = SeriesPoint

type Preset = '7d' | '30d' | 'custom'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) =>
  (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtNum = (n: number) => (n ?? 0).toLocaleString('pt-BR')
const fmtPct = (n: number) => `${((n ?? 0) * 100).toFixed(2)}%`
const fmtRoas = (n: number) => `${(n ?? 0).toFixed(2)}x`
const shortDate = (d: string) => {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
}

function acosColor(acos: number) {
  if (acos < 0.33) return '#4ade80'
  if (acos <= 1)   return '#facc15'
  return '#f87171'
}
function roasColor(roas: number) {
  if (roas > 3) return '#4ade80'
  if (roas >= 1) return '#facc15'
  return '#f87171'
}
function statusBadge(s: string | null) {
  const v = (s ?? '').toLowerCase()
  if (v === 'active' || v === 'enabled' || v === 'ativo')
    return { label: 'Ativa',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)' }
  if (v === 'paused' || v === 'pausado')
    return { label: 'Pausada',  color: '#facc15', bg: 'rgba(250,204,21,0.12)' }
  if (v === 'ended' || v === 'finished' || v === 'finalizado')
    return { label: 'Finalizada', color: '#71717a', bg: 'rgba(113,113,122,0.12)' }
  return { label: s ?? '—', color: '#a1a1aa', bg: 'rgba(161,161,170,0.10)' }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color = '#a1a1aa', subColor }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color?: string; subColor?: string
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 min-h-[110px] justify-between"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
        {sub && <p className="text-[11px] mt-1" style={{ color: subColor ?? '#52525b' }}>{sub}</p>}
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-xs space-y-1"
      style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <p className="font-semibold text-zinc-300">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-400">{p.name ?? p.dataKey}:</span>
          <span className="font-medium text-zinc-200">
            {p.dataKey === 'spend' || p.dataKey === 'revenue' ? fmtBRL(p.value)
             : p.dataKey === 'roas' ? fmtRoas(p.value)
             : fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function CampaignRow({
  c, expanded, onToggle, getHeaders, dateFrom, dateTo,
}: {
  c: Campaign
  expanded: boolean
  onToggle: () => void
  getHeaders: () => Promise<Record<string, string>>
  dateFrom: string
  dateTo: string
}) {
  const sb = statusBadge(c.status)
  const [days, setDays] = useState<CampaignDayRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!expanded || days.length > 0) return
    setLoading(true)
    ;(async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(
          `${BACKEND}/ml-ads/reports/campaign/${c.id}?from=${dateFrom}&to=${dateTo}`,
          { headers },
        )
        if (res.ok) {
          const v = await res.json()
          setDays(Array.isArray(v) ? v : [])
        }
      } finally { setLoading(false) }
    })()
  }, [expanded, c.id, dateFrom, dateTo, getHeaders, days.length])

  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-[#161618] transition-colors">
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
            <div>
              <p className="text-sm font-medium text-zinc-200 truncate max-w-[300px]">{c.name ?? '(sem nome)'}</p>
              <p className="text-[10px] text-zinc-600 font-mono">{c.id}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ color: sb.color, background: sb.bg }}>{sb.label}</span>
        </td>
        <td className="px-3 py-3 text-right text-xs text-zinc-300 tabular-nums">
          {c.daily_budget != null ? fmtBRL(c.daily_budget) : '—'}
        </td>
        <td className="px-3 py-3 text-right text-xs text-zinc-300 tabular-nums">{fmtBRL(c.spend)}</td>
        <td className="px-3 py-3 text-right text-xs text-zinc-300 tabular-nums">{fmtBRL(c.revenue)}</td>
        <td className="px-3 py-3 text-right text-xs font-semibold tabular-nums" style={{ color: roasColor(c.roas) }}>
          {fmtRoas(c.roas)}
        </td>
        <td className="px-3 py-3 text-right text-xs text-zinc-300 tabular-nums">{fmtNum(c.clicks)}</td>
        <td className="px-3 py-3 text-right text-xs text-zinc-400 tabular-nums">{fmtPct(c.ctr)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-3 py-4" style={{ background: '#0c0c0f', borderTop: '1px solid #1a1a1f' }}>
            {loading ? (
              <p className="text-xs text-zinc-500 px-3">Carregando dias…</p>
            ) : days.length === 0 ? (
              <p className="text-xs text-zinc-600 px-3 italic">Sem métricas no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600">
                      <th className="px-3 py-1.5">Data</th>
                      <th className="px-3 py-1.5 text-right">Imp.</th>
                      <th className="px-3 py-1.5 text-right">Cliques</th>
                      <th className="px-3 py-1.5 text-right">CTR</th>
                      <th className="px-3 py-1.5 text-right">Gasto</th>
                      <th className="px-3 py-1.5 text-right">Receita</th>
                      <th className="px-3 py-1.5 text-right">ROAS</th>
                      <th className="px-3 py-1.5 text-right">ACoS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(d => (
                      <tr key={d.date} className="text-zinc-300 tabular-nums">
                        <td className="px-3 py-1">{shortDate(d.date)}</td>
                        <td className="px-3 py-1 text-right">{fmtNum(d.impressions)}</td>
                        <td className="px-3 py-1 text-right">{fmtNum(d.clicks)}</td>
                        <td className="px-3 py-1 text-right text-zinc-500">{fmtPct(d.ctr)}</td>
                        <td className="px-3 py-1 text-right">{fmtBRL(d.spend)}</td>
                        <td className="px-3 py-1 text-right">{fmtBRL(d.revenue)}</td>
                        <td className="px-3 py-1 text-right" style={{ color: roasColor(d.roas) }}>{fmtRoas(d.roas)}</td>
                        <td className="px-3 py-1 text-right" style={{ color: acosColor(d.acos) }}>{fmtPct(d.acos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MlAdsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [preset, setPreset] = useState<Preset>('30d')
  const [customFrom, setCustomFrom] = useState(daysAgoISO(30))
  const [customTo, setCustomTo]     = useState(todayISO())

  const [summary, setSummary]   = useState<SummaryResp | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastSyncMsg, setLastSyncMsg] = useState<string | null>(null)

  const range = useMemo(() => {
    if (preset === '7d')  return { from: daysAgoISO(7),  to: todayISO() }
    if (preset === '30d') return { from: daysAgoISO(30), to: todayISO() }
    return { from: customFrom, to: customTo }
  }, [preset, customFrom, customTo])

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}` }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getHeaders()
      const [sumRes, campRes] = await Promise.all([
        fetch(`${BACKEND}/ml-ads/reports/summary?from=${range.from}&to=${range.to}`, { headers }),
        fetch(`${BACKEND}/ml-ads/campaigns?from=${range.from}&to=${range.to}`, { headers }),
      ])

      if (sumRes.status === 401) {
        setError('token-expired')
        return
      }

      if (sumRes.ok) {
        const v = await sumRes.json()
        setSummary({
          totals: v?.totals ?? { clicks: 0, impressions: 0, spend: 0, conversions: 0, revenue: 0, ctr: 0, roas: 0, acos: 0 },
          series: Array.isArray(v?.series) ? v.series : [],
        })
      }
      if (campRes.ok) {
        const v = await campRes.json()
        setCampaigns(Array.isArray(v) ? v : [])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [getHeaders, range.from, range.to])

  useEffect(() => { load() }, [load])

  async function sync() {
    setSyncing(true)
    setError(null)
    setLastSyncMsg(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml-ads/sync`, { method: 'POST', headers })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) { setError('token-expired'); return }
        throw new Error(d?.message ?? `HTTP ${res.status}`)
      }
      if (d?.ok === false && d?.message) {
        setLastSyncMsg(d.message)
      } else {
        setLastSyncMsg(`Sincronizado: ${d?.campaigns ?? 0} campanha(s) · ${d?.reports ?? 0} dias`)
      }
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const totals = summary?.totals
  const series = (summary?.series ?? []).map(d => ({ ...d, label: shortDate(d.date) }))

  // Empty state: never synced (no campaigns in DB)
  const isEmpty = !loading && campaigns.length === 0 && (totals?.spend ?? 0) === 0

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,230,0,0.12)' }}>
            <Megaphone size={18} style={{ color: '#FFE600' }} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Ads</p>
            <h1 className="text-white text-xl font-semibold">Mercado Livre Ads</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period presets */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            {(['7d', '30d', 'custom'] as const).map(p => (
              <button key={p} onClick={() => setPreset(p)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: preset === p ? '#FFE600' : 'transparent',
                  color:      preset === p ? '#000'    : '#a1a1aa',
                }}>
                {p === 'custom' ? 'Custom' : p === '7d' ? '7 dias' : '30 dias'}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-1 text-[11px]">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-[#111114] border border-[#27272a] text-zinc-300" />
              <span className="text-zinc-600">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-[#111114] border border-[#27272a] text-zinc-300" />
            </div>
          )}

          <button onClick={sync} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-60"
            style={{ background: '#FFE600', color: '#000' }}>
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {lastSyncMsg && (
        <div className="px-4 py-2 rounded-xl text-[11px] text-emerald-400"
          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)' }}>
          {lastSyncMsg}
        </div>
      )}

      {error === 'token-expired' && (
        <div className="px-4 py-3 rounded-xl text-xs text-amber-400 flex items-center gap-2"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertCircle size={14} />
          <span>Token ML expirado — reconecte em <a href="/dashboard/configuracoes/integracoes" className="underline font-semibold">Integrações</a>.</span>
        </div>
      )}

      {error && error !== 'token-expired' && (
        <div className="px-4 py-3 rounded-xl text-xs text-red-400"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !error ? (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center gap-4"
          style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,230,0,0.10)' }}>
            <Megaphone size={24} style={{ color: '#FFE600' }} />
          </div>
          <div>
            <h2 className="text-white text-base font-semibold">Sem dados de campanhas ainda</h2>
            <p className="text-zinc-500 text-xs mt-1 max-w-md">Sincronize agora pra puxar suas campanhas e métricas dos últimos 30 dias direto do Mercado Livre Ads.</p>
          </div>
          <button onClick={sync} disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
            style={{ background: '#FFE600', color: '#000' }}>
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando…' : 'Sincronizar com ML Ads'}
          </button>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Gasto total"   value={loading ? '…' : fmtBRL(totals?.spend ?? 0)}    icon={<DollarSign size={13} />} color="#f87171" />
            <KpiCard label="Receita"       value={loading ? '…' : fmtBRL(totals?.revenue ?? 0)}  icon={<TrendingUp size={13} />} color="#4ade80" />
            <KpiCard label="ROAS"          value={loading ? '…' : fmtRoas(totals?.roas ?? 0)}    icon={<Target size={13} />}     color={roasColor(totals?.roas ?? 0)} />
            <KpiCard label="Cliques"       value={loading ? '…' : fmtNum(totals?.clicks ?? 0)}   icon={<MousePointerClick size={13} />} color="#60a5fa" />
            <KpiCard label="CTR"           value={loading ? '…' : fmtPct(totals?.ctr ?? 0)}      icon={<Eye size={13} />}        color="#a78bfa" sub={`${fmtNum(totals?.impressions ?? 0)} imp.`} />
            <KpiCard label="ACoS"          value={loading ? '…' : fmtPct(totals?.acos ?? 0)}     icon={<Activity size={13} />}   color={acosColor(totals?.acos ?? 0)} />
          </div>

          {/* Chart: Spend vs Revenue vs ROAS */}
          {series.length > 0 && (
            <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-emerald-400" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Gasto · Receita · ROAS por dia</h3>
              </div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis yAxisId="brl"  tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={55}
                      tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="roas" orientation="right" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={40}
                      tickFormatter={v => `${v.toFixed(1)}x`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} iconSize={10} />
                    <Line yAxisId="brl"  type="monotone" dataKey="spend"   name="Gasto"   stroke="#f87171" strokeWidth={1.5} dot={false} />
                    <Line yAxisId="brl"  type="monotone" dataKey="revenue" name="Receita" stroke="#4ade80" strokeWidth={1.5} dot={false} />
                    <Line yAxisId="roas" type="monotone" dataKey="roas"    name="ROAS"    stroke="#FFE600" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Campaigns table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1a1a1f' }}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Campanhas</h3>
              <span className="text-[11px] text-zinc-600">{campaigns.length} no período</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600"
                    style={{ borderBottom: '1px solid #1a1a1f' }}>
                    <th className="px-3 py-2 font-semibold">Campanha</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold text-right">Orçamento/dia</th>
                    <th className="px-3 py-2 font-semibold text-right">Gasto</th>
                    <th className="px-3 py-2 font-semibold text-right">Receita</th>
                    <th className="px-3 py-2 font-semibold text-right">ROAS</th>
                    <th className="px-3 py-2 font-semibold text-right">Cliques</th>
                    <th className="px-3 py-2 font-semibold text-right">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-zinc-600">Carregando…</td></tr>
                  ) : campaigns.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-zinc-600 italic">Nenhuma campanha no período.</td></tr>
                  ) : campaigns.map(c => (
                    <CampaignRow
                      key={c.id}
                      c={c}
                      expanded={expandedId === c.id}
                      onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      getHeaders={getHeaders}
                      dateFrom={range.from}
                      dateTo={range.to}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
