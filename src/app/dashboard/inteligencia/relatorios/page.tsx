'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import OnboardingBanner from '@/components/inteligencia/OnboardingBanner'
import {
  RefreshCw, TrendingUp, MessageSquare, Clock, CheckCircle2,
  Activity, AlertCircle, AlertTriangle, Award,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface OrgStats {
  window_days:       number
  signals_total:     number
  by_severity:       Record<'critical' | 'warning' | 'info', number>
  by_analyzer:       Record<string, number>
  by_status:         Record<string, number>
  top_categories:    Array<{ category: string; count: number }>
  deliveries_total:  number
  deliveries_sent:   number
  deliveries_failed: number
  responded_total:   number
  action_rate:       number
  avg_response_min:  number | null
}

interface ManagerStat {
  manager_id:       string
  name:             string
  department:       string
  signals_received: number
  sent:             number
  failed:           number
  responded:        number
  approved:         number
  ignored:          number
  details:          number
  custom:           number
  action_rate:      number
  avg_response_min: number | null
  top_categories:   Array<{ category: string; count: number }>
}

const DEPT_COLORS: Record<string, string> = {
  compras:   '#a78bfa',
  comercial: '#4ade80',
  marketing: '#f472b6',
  logistica: '#60a5fa',
  diretoria: '#FFE600',
}

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string): Promise<T> {
  const token = await getToken()
  if (!token) throw new Error('Sessão expirada')
  const res = await fetch(`${BACKEND}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function pct(n: number) { return `${Math.round(n * 100)}%` }
function humanizeCategory(c: string) { return c.replace(/_/g, ' ') }

function StatCard({ label, value, sub, color = '#00E5FF', icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string
  icon: typeof Activity
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}1a`, border: `1px solid ${color}33` }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black text-white leading-none">{value}</p>
      {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
    </div>
  )
}

function ProgressBar({ pct: p, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1e24' }}>
      <div className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, p))}%`, background: color }} />
    </div>
  )
}

function ManagerRow({ m }: { m: ManagerStat }) {
  const color = DEPT_COLORS[m.department] ?? '#a1a1aa'
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-base font-bold"
          style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}>
          {m.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">{m.name}</h3>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}>
            {m.department}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600">Recebidos</p>
          <p className="text-base font-bold text-white">{m.signals_received}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600">Respondidos</p>
          <p className="text-base font-bold text-white">{m.responded}
            <span className="text-[10px] text-zinc-600 font-normal">
              {m.signals_received > 0 ? ` · ${pct(m.responded / m.signals_received)}` : ''}
            </span>
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600">Action rate</p>
          <p className="text-base font-bold" style={{ color: m.action_rate > 0.5 ? '#4ade80' : m.action_rate > 0.2 ? '#f59e0b' : '#a1a1aa' }}>
            {pct(m.action_rate)}
          </p>
        </div>
      </div>

      {m.responded > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-500">Distribuição de respostas</span>
            <span className="text-zinc-600">{m.responded} total</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5" style={{ background: '#1e1e24' }}>
            {m.approved > 0 && <div title={`Aprovados: ${m.approved}`} style={{ flex: m.approved, background: '#4ade80' }} />}
            {m.details  > 0 && <div title={`Detalhes: ${m.details}`}   style={{ flex: m.details,  background: '#60a5fa' }} />}
            {m.ignored  > 0 && <div title={`Ignorados: ${m.ignored}`}   style={{ flex: m.ignored,  background: '#71717a' }} />}
            {m.custom   > 0 && <div title={`Custom: ${m.custom}`}        style={{ flex: m.custom,   background: '#a78bfa' }} />}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
            {m.approved > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded" style={{ background: '#4ade80' }} />Aprovado: <strong style={{ color: '#4ade80' }}>{m.approved}</strong></span>}
            {m.details  > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded" style={{ background: '#60a5fa' }} />Detalhes: <strong style={{ color: '#60a5fa' }}>{m.details}</strong></span>}
            {m.ignored  > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded" style={{ background: '#71717a' }} />Ignorado: <strong style={{ color: '#71717a' }}>{m.ignored}</strong></span>}
            {m.custom   > 0 && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded" style={{ background: '#a78bfa' }} />Custom: <strong style={{ color: '#a78bfa' }}>{m.custom}</strong></span>}
          </div>
        </div>
      )}

      {m.avg_response_min != null && (
        <div className="text-[10px] text-zinc-500 inline-flex items-center gap-1">
          <Clock size={10} /> Tempo médio de resposta: <strong className="text-zinc-300">{Math.round(m.avg_response_min)} min</strong>
        </div>
      )}

      {m.top_categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t" style={{ borderColor: '#1e1e24' }}>
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold w-full">
            Top categorias recebidas
          </span>
          {m.top_categories.slice(0, 4).map(c => (
            <span key={c.category} className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
              {humanizeCategory(c.category)} <strong className="text-zinc-300">{c.count}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RelatoriosPage() {
  const [days, setDays]                 = useState(30)
  const [stats, setStats]               = useState<OrgStats | null>(null)
  const [managers, setManagers]         = useState<ManagerStat[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, m] = await Promise.all([
        api<OrgStats>(`/alert-hub/stats?days=${days}`),
        api<ManagerStat[]>(`/alert-hub/stats/managers?days=${days}`),
      ])
      setStats(s)
      setManagers(m.sort((a, b) => b.signals_received - a.signals_received))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const sortedAnalyzers = stats
    ? Object.entries(stats.by_analyzer).sort((a, b) => b[1] - a[1])
    : []

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-zinc-500 text-xs">Inteligência</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Relatórios</h2>
          <p className="text-[11px] text-zinc-600 mt-1">
            Métricas de efetividade dos alertas nas últimas {days} dias.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: '#111114', border: '1px solid #27272a' }}>
            {[7, 30, 90].map(d => {
              const active = days === d
              return (
                <button key={d} onClick={() => setDays(d)}
                  className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all"
                  style={{
                    background: active ? 'rgba(0,229,255,0.12)' : 'transparent',
                    color:      active ? '#00E5FF' : '#a1a1aa',
                  }}>
                  {d}d
                </button>
              )
            })}
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      <OnboardingBanner />

      {/* Org-level KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total signals" value={stats?.signals_total ?? '—'}
          sub={stats ? `${stats.by_severity.critical} críticos · ${stats.by_severity.warning} atenções` : ''}
          color="#00E5FF" icon={Activity} />
        <StatCard label="Mensagens enviadas" value={stats?.deliveries_sent ?? '—'}
          sub={stats ? `${stats.deliveries_total} total · ${stats.deliveries_failed} falharam` : ''}
          color="#4ade80" icon={MessageSquare} />
        <StatCard label="Respostas" value={stats?.responded_total ?? '—'}
          sub={stats && stats.deliveries_sent > 0
            ? `${pct(stats.responded_total / stats.deliveries_sent)} dos enviados`
            : ''}
          color="#a78bfa" icon={CheckCircle2} />
        <StatCard label="Action rate" value={stats ? pct(stats.action_rate) : '—'}
          sub={stats?.avg_response_min != null
            ? `${Math.round(stats.avg_response_min)}min médio de resposta`
            : 'Sem dados'}
          color="#FFE600" icon={Award} />
      </div>

      {/* Severity + Analyzer breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Severity */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <h3 className="text-white font-semibold text-sm">Distribuição por severity</h3>
          {!stats || stats.signals_total === 0 ? (
            <p className="text-xs text-zinc-500">Sem dados.</p>
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5" style={{ background: '#1e1e24' }}>
                {stats.by_severity.critical > 0 && <div title={`Crítico: ${stats.by_severity.critical}`} style={{ flex: stats.by_severity.critical, background: '#f87171' }} />}
                {stats.by_severity.warning  > 0 && <div title={`Atenção: ${stats.by_severity.warning}`}   style={{ flex: stats.by_severity.warning,  background: '#f59e0b' }} />}
                {stats.by_severity.info     > 0 && <div title={`Info: ${stats.by_severity.info}`}          style={{ flex: stats.by_severity.info,     background: '#60a5fa' }} />}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 inline-flex items-center gap-1"><AlertCircle size={10} style={{ color: '#f87171' }} /> Crítico</span>
                  <span className="text-base font-bold" style={{ color: '#f87171' }}>{stats.by_severity.critical}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 inline-flex items-center gap-1"><AlertTriangle size={10} style={{ color: '#f59e0b' }} /> Atenção</span>
                  <span className="text-base font-bold" style={{ color: '#f59e0b' }}>{stats.by_severity.warning}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 inline-flex items-center gap-1"><Activity size={10} style={{ color: '#60a5fa' }} /> Info</span>
                  <span className="text-base font-bold" style={{ color: '#60a5fa' }}>{stats.by_severity.info}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Analyzers */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <h3 className="text-white font-semibold text-sm">Por analyzer</h3>
          {sortedAnalyzers.length === 0 ? (
            <p className="text-xs text-zinc-500">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {sortedAnalyzers.map(([name, count]) => {
                const max  = sortedAnalyzers[0][1]
                const pctV = max > 0 ? (count / max) * 100 : 0
                return (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-300 capitalize">{name}</span>
                      <span className="text-white font-semibold">{count}</span>
                    </div>
                    <ProgressBar pct={pctV} color="#00E5FF" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top categorias */}
      {stats && stats.top_categories.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <h3 className="text-white font-semibold text-sm mb-3 inline-flex items-center gap-2">
            <TrendingUp size={14} /> Top categorias
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.top_categories.map(c => (
              <span key={c.category} className="text-[11px] px-3 py-1.5 rounded-full"
                style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
                {humanizeCategory(c.category)} · <strong className="text-white">{c.count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Per-manager */}
      <div>
        <h3 className="text-white font-semibold text-sm mb-3">Por gestor</h3>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-56 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
            ))}
          </div>
        ) : managers.length === 0 ? (
          <div className="rounded-2xl p-8 text-center text-xs text-zinc-500"
            style={{ background: '#111114', border: '1px dashed #27272a' }}>
            Nenhum gestor cadastrado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {managers.map(m => <ManagerRow key={m.manager_id} m={m} />)}
          </div>
        )}
      </div>

      <p className="text-[10px] text-zinc-700 leading-relaxed pt-2">
        <strong>Action rate</strong> = porcentagem de respostas &quot;1&quot; (aprovar) sobre o total
        de respostas. <strong>Tempo médio</strong> só inclui respostas chegadas em até
        7 dias após o envio. Os números são recalculados em tempo real, sem cache —
        se acabou de receber novos signals, é só atualizar.
      </p>
    </div>
  )
}

