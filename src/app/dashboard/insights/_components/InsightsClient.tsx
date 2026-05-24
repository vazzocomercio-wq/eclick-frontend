'use client'

/**
 * Dashboard e-Click Insights (founder, cross-org). Consome os endpoints
 * /insights/* do backend (gated por PlatformAdminGuard) com token Supabase.
 * Seções: KPIs, módulos mais usados, insights da IA, matriz usuário×módulo,
 * engajamento/churn e funis de tarefa.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2, RefreshCw, Sparkles, TrendingUp, TrendingDown, Minus, Users, MousePointerClick, Clock, Activity,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Overview {
  active_users: { value: number; delta: number }
  sessions:     { value: number; delta: number }
  avg_session_minutes: number
  total_events: { value: number; delta: number }
}
interface ModulesRanking { total_active_users: number; modules: Array<{ module: string; users: number; usage_pct: number; events: number; time_minutes: number }> }
interface UsageMatrix { users: Array<{ user_id: string; email: string | null; modules: Record<string, number>; total_events: number }> }
interface Engagement { by_status: Record<string, number>; users: Array<{ user_id: string; email: string | null; score: number; status: string; weekly_active_days: number; weekly_module_count: number; trend: string; days_since_last_seen: number | null }> }
interface Funnels { tasks: Array<{ task: string; started: number; completed: number; abandoned: number; completion_rate: number; abandon_rate: number; top_abandon_step: string | null }> }
interface AiInsight { id: string; type: string; severity: string; title: string; body: string; recommendation: string | null; created_at: string }

const STATUS_COLOR: Record<string, string> = {
  power_user: '#4ade80', engaged: '#22d3ee', casual: '#fcd34d', at_risk: '#fb923c', inactive: '#f87171',
}
const SEVERITY_COLOR: Record<string, string> = { high: '#f87171', medium: '#fcd34d', low: '#67e8f9' }
const STATUS_ORDER = ['power_user', 'engaged', 'casual', 'at_risk', 'inactive']

const card: React.CSSProperties = { background: '#111114', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }

export function InsightsClient() {
  const t = useTranslations('insights')
  const [period, setPeriod] = useState<7 | 30>(7)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [overview, setOverview] = useState<Overview | null>(null)
  const [ranking, setRanking] = useState<ModulesRanking | null>(null)
  const [matrix, setMatrix] = useState<UsageMatrix | null>(null)
  const [engagement, setEngagement] = useState<Engagement | null>(null)
  const [funnels, setFunnels] = useState<Funnels | null>(null)
  const [ai, setAi] = useState<AiInsight[]>([])

  const authHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const { data: { session } } = await createClient().auth.getSession()
    return session ? { Authorization: `Bearer ${session.access_token}` } : null
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const h = await authHeaders()
    if (!h) { setError(t('loadError')); setLoading(false); return }
    const get = async <T,>(path: string): Promise<T | null> => {
      try { const r = await fetch(`${BACKEND}${path}`, { headers: h }); return r.ok ? (await r.json() as T) : null }
      catch { return null }
    }
    const [ov, rk, mx, en, fn, aii] = await Promise.all([
      get<Overview>(`/insights/overview`),
      get<ModulesRanking>(`/insights/modules/ranking?period=${period}`),
      get<UsageMatrix>(`/insights/usage-matrix?period=${period}`),
      get<Engagement>(`/insights/engagement`),
      get<Funnels>(`/insights/funnels?period=${period}`),
      get<{ insights: AiInsight[] }>(`/insights/ai-insights`),
    ])
    setOverview(ov); setRanking(rk); setMatrix(mx); setEngagement(en); setFunnels(fn); setAi(aii?.insights ?? [])
    setLoading(false)
  }, [authHeaders, period, t])

  useEffect(() => { void load() }, [load])

  const post = useCallback(async (path: string, key: string) => {
    setBusy(key); setError(null)
    const h = await authHeaders()
    if (!h) { setError(t('loadError')); setBusy(null); return }
    try { await fetch(`${BACKEND}${path}`, { method: 'POST', headers: h }) } catch { /* noop */ }
    setBusy(null)
    await load()
  }, [authHeaders, load, t])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#fafafa' }}>{t('title')}</h1>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
            {([7, 30] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className="px-3 py-1.5 text-sm"
                style={{ background: period === p ? 'rgba(0,229,255,0.14)' : 'transparent', color: period === p ? '#67e8f9' : '#a1a1aa' }}>
                {p === 7 ? t('period7') : t('period30')}
              </button>
            ))}
          </div>
          <button onClick={() => void post('/insights/run-rollup', 'rollup').then(() => post('/insights/run-engagement', 'eng'))}
            disabled={!!busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#fafafa', border: '1px solid rgba(255,255,255,0.10)' }}>
            {busy === 'rollup' || busy === 'eng' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {busy === 'rollup' || busy === 'eng' ? t('refreshing') : t('refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: '#a1a1aa' }}>
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={<Users size={16} />} label={t('kpi.activeUsers')} value={overview?.active_users.value ?? 0} delta={overview?.active_users.delta} hint={t('kpi.vsPrev')} />
            <Kpi icon={<Activity size={16} />} label={t('kpi.sessions')} value={overview?.sessions.value ?? 0} delta={overview?.sessions.delta} hint={t('kpi.vsPrev')} />
            <Kpi icon={<Clock size={16} />} label={t('kpi.avgSession')} value={`${overview?.avg_session_minutes ?? 0} ${t('kpi.minutes')}`} />
            <Kpi icon={<MousePointerClick size={16} />} label={t('kpi.events')} value={overview?.total_events.value ?? 0} delta={overview?.total_events.delta} hint={t('kpi.vsPrev')} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Módulos mais usados */}
            <section style={card} className="p-4">
              <h2 className="text-sm font-semibold mb-3" style={{ color: '#fafafa' }}>{t('modulesCard.title')}</h2>
              {!ranking?.modules.length ? <Empty text={t('modulesCard.empty')} /> : (
                <div className="space-y-2">
                  {ranking.modules.slice(0, 8).map(m => (
                    <div key={m.module}>
                      <div className="flex justify-between text-xs mb-1" style={{ color: '#d4d4d8' }}>
                        <span className="capitalize">{m.module}</span>
                        <span style={{ color: '#71717a' }}>{t('modulesCard.usersEvents', { users: m.users, events: m.events })}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(4, m.usage_pct)}%`, background: '#00E5FF' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Insights da IA */}
            <section style={card} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#fafafa' }}><Sparkles size={15} style={{ color: '#00E5FF' }} />{t('ai.title')}</h2>
                <button onClick={() => void post('/insights/run-ai-insights', 'ai')} disabled={!!busy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs"
                  style={{ background: 'rgba(0,229,255,0.10)', color: '#67e8f9', border: '1px solid rgba(0,229,255,0.25)' }}>
                  {busy === 'ai' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {busy === 'ai' ? t('ai.generating') : t('ai.generate')}
                </button>
              </div>
              {!ai.length ? <Empty text={t('ai.empty')} /> : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto">
                  {ai.slice(0, 12).map(i => (
                    <div key={i.id} className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${SEVERITY_COLOR[i.severity] ?? '#67e8f9'}` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${SEVERITY_COLOR[i.severity] ?? '#67e8f9'}22`, color: SEVERITY_COLOR[i.severity] ?? '#67e8f9' }}>
                          {t(`ai.${i.severity}` as 'ai.high')}
                        </span>
                        <span className="text-xs font-medium" style={{ color: '#fafafa' }}>{i.title}</span>
                      </div>
                      <p className="text-xs leading-snug" style={{ color: '#a1a1aa' }}>{i.body}</p>
                      {i.recommendation && <p className="text-xs mt-1" style={{ color: '#67e8f9' }}>→ {i.recommendation}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Engajamento / churn */}
          <section style={card} className="p-4">
            <h2 className="text-sm font-semibold mb-3" style={{ color: '#fafafa' }}>{t('engagement.title')}</h2>
            {!engagement?.users.length ? <Empty text={t('engagement.empty')} /> : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {STATUS_ORDER.filter(s => engagement.by_status[s]).map(s => (
                    <span key={s} className="text-xs px-2.5 py-1 rounded-full" style={{ background: `${STATUS_COLOR[s]}1a`, color: STATUS_COLOR[s], border: `1px solid ${STATUS_COLOR[s]}40` }}>
                      {t(`engagement.${s}` as 'engagement.power_user')}: {engagement.by_status[s]}
                    </span>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {engagement.users.slice(0, 15).map(u => (
                    <div key={u.user_id} className="flex items-center justify-between text-xs rounded-md px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[u.status] ?? '#71717a' }} />
                        <span className="truncate" style={{ color: '#d4d4d8' }}>{u.email ?? u.user_id.slice(0, 8)}</span>
                        <Trend trend={u.trend} />
                      </span>
                      <span className="flex items-center gap-3 shrink-0" style={{ color: '#71717a' }}>
                        <span style={{ color: '#a1a1aa' }}>{t('engagement.score')} {u.score}</span>
                        <span>{u.days_since_last_seen === null ? t('engagement.never') : `${t('engagement.seen')} ${t('engagement.daysAgo', { n: u.days_since_last_seen })}`}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Funis */}
          <section style={card} className="p-4">
            <h2 className="text-sm font-semibold mb-3" style={{ color: '#fafafa' }}>{t('funnels.title')}</h2>
            {!funnels?.tasks.length ? <Empty text={t('funnels.empty')} /> : (
              <div className="grid sm:grid-cols-2 gap-3">
                {funnels.tasks.map(f => (
                  <div key={f.task} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium capitalize" style={{ color: '#fafafa' }}>{f.task.replace(/_/g, ' ')}</span>
                      <span className="text-xs" style={{ color: f.completion_rate >= 50 ? '#4ade80' : '#fb923c' }}>{t('funnels.completionRate')}: {f.completion_rate}%</span>
                    </div>
                    <div className="flex gap-2 text-[11px]" style={{ color: '#a1a1aa' }}>
                      <span>{t('funnels.started')}: {f.started}</span>
                      <span style={{ color: '#4ade80' }}>{t('funnels.completed')}: {f.completed}</span>
                      <span style={{ color: '#f87171' }}>{t('funnels.abandoned')}: {f.abandoned}</span>
                    </div>
                    {f.top_abandon_step && (
                      <p className="text-[11px] mt-1.5" style={{ color: '#fb923c' }}>{t('funnels.abandonStep')}: <span className="capitalize">{f.top_abandon_step.replace(/_/g, ' ')}</span></p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Matriz usuário × módulo */}
          {matrix?.users.length ? (
            <section style={card} className="p-4 overflow-x-auto">
              <h2 className="text-sm font-semibold mb-3" style={{ color: '#fafafa' }}>{t('matrix.title')}</h2>
              <Heatmap matrix={matrix} modules={(ranking?.modules ?? []).map(m => m.module)} userLabel={t('matrix.user')} />
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function Kpi({ icon, label, value, delta, hint }: { icon: React.ReactNode; label: string; value: number | string; delta?: number; hint?: string }) {
  const up = typeof delta === 'number' && delta > 0
  const down = typeof delta === 'number' && delta < 0
  return (
    <div style={card} className="p-3.5">
      <div className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: '#71717a' }}>{icon}{label}</div>
      <div className="text-2xl font-semibold" style={{ color: '#fafafa' }}>{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</div>
      {typeof delta === 'number' && (
        <div className="flex items-center gap-1 text-xs mt-1" style={{ color: up ? '#4ade80' : down ? '#f87171' : '#71717a' }}>
          {up ? <TrendingUp size={12} /> : down ? <TrendingDown size={12} /> : <Minus size={12} />}
          {delta > 0 ? '+' : ''}{delta} <span style={{ color: '#52525b' }}>{hint}</span>
        </div>
      )}
    </div>
  )
}

function Trend({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={12} style={{ color: '#4ade80' }} />
  if (trend === 'down') return <TrendingDown size={12} style={{ color: '#f87171' }} />
  return <Minus size={12} style={{ color: '#52525b' }} />
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs py-6 text-center" style={{ color: '#52525b' }}>{text}</p>
}

function Heatmap({ matrix, modules, userLabel }: { matrix: UsageMatrix; modules: string[]; userLabel: string }) {
  const cols = modules.length ? modules : [...new Set(matrix.users.flatMap(u => Object.keys(u.modules)))]
  const max = Math.max(1, ...matrix.users.flatMap(u => Object.values(u.modules)))
  return (
    <table className="text-xs border-collapse">
      <thead>
        <tr>
          <th className="text-left font-medium pr-3 pb-2 sticky left-0" style={{ color: '#71717a', background: '#111114' }}>{userLabel}</th>
          {cols.map(c => <th key={c} className="px-1.5 pb-2 font-medium capitalize" style={{ color: '#71717a' }}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {matrix.users.slice(0, 20).map(u => (
          <tr key={u.user_id}>
            <td className="pr-3 py-1 truncate max-w-[160px] sticky left-0" style={{ color: '#d4d4d8', background: '#111114' }}>{u.email ?? u.user_id.slice(0, 8)}</td>
            {cols.map(c => {
              const v = u.modules[c] ?? 0
              const op = v ? 0.15 + 0.85 * (v / max) : 0
              return (
                <td key={c} className="px-1.5 py-1">
                  <div className="w-7 h-5 rounded mx-auto" title={`${v}`} style={{ background: v ? `rgba(0,229,255,${op.toFixed(2)})` : 'rgba(255,255,255,0.04)' }} />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
