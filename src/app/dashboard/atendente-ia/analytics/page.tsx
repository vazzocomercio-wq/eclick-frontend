'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { TrendingUp, MessageCircle, Zap, UserCheck, AlertTriangle, Loader2, Calendar, MessageSquare, Trophy, Sparkles, Plus } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface AnalyticsRow {
  date: string
  messages_received: number
  messages_auto_replied: number
  messages_human_replied: number
  messages_escalated: number
  avg_confidence: number
  avg_response_time_seconds: number
  positive_sentiment: number
  negative_sentiment: number
}

interface Agent { id: string; name: string }

interface TopQuestion { question: string; count: number; last_at: string }
interface AgentPerf {
  agent_id: string; agent_name: string; model_id: string
  messages: number; auto_pct: number; escalated: number; avg_confidence: number
}
interface InsightRow {
  id: string; type: string
  data: Record<string, unknown> | null
  generated_at: string
}

const CHART_TOOLTIP_STYLE = {
  contentStyle: { background: '#111114', border: '1px solid #1e1e24', borderRadius: 12 },
  labelStyle: { color: '#a1a1aa', fontSize: 11 },
  itemStyle: { color: '#e4e4e7', fontSize: 11 },
}

export default function AnalyticsPage() {
  const [agents, setAgents]   = useState<Agent[]>([])
  const [agentId, setAgentId] = useState('')
  const [rows, setRows]       = useState<AnalyticsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [range, setRange]     = useState(30)

  // Wave-1 sessão 3 additions
  const [topQ,    setTopQ]    = useState<TopQuestion[] | null>(null)
  const [byAgent, setByAgent] = useState<AgentPerf[] | null>(null)
  const [insights,setInsights]= useState<InsightRow[] | null>(null)

  const getHeaders = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }, [])

  const loadAgents = useCallback(async () => {
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/atendente-ia/agents`, { headers })
    if (res.ok) {
      const data = await res.json()
      setAgents(data)
      if (data.length > 0 && !agentId) setAgentId(data[0].id)
    }
  }, [getHeaders, agentId])

  const loadAnalytics = useCallback(async () => {
    if (!agentId) return
    setLoading(true)
    try {
      const headers = await getHeaders()
      const from = new Date(Date.now() - range * 86400 * 1000).toISOString().split('T')[0]
      const to   = new Date().toISOString().split('T')[0]
      const res = await fetch(`${BACKEND}/atendente-ia/analytics?agent_id=${agentId}&from=${from}&to=${to}`, { headers })
      if (res.ok) { const v = await res.json(); setRows(Array.isArray(v) ? v : []) }
    } finally { setLoading(false) }
  }, [getHeaders, agentId, range])

  const loadAggregates = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const [topRes, byRes, insRes] = await Promise.allSettled([
        fetch(`${BACKEND}/atendente-ia/analytics/top-questions?limit=10`, { headers }),
        fetch(`${BACKEND}/atendente-ia/analytics/by-agent?days=${range}`, { headers }),
        fetch(`${BACKEND}/atendente-ia/analytics/insights?limit=10`, { headers }),
      ])
      if (topRes.status === 'fulfilled' && topRes.value.ok) {
        const v = await topRes.value.json(); setTopQ(Array.isArray(v) ? v : [])
      }
      if (byRes.status  === 'fulfilled' && byRes.value.ok) {
        const v = await byRes.value.json(); setByAgent(Array.isArray(v) ? v : [])
      }
      if (insRes.status === 'fulfilled' && insRes.value.ok) {
        const v = await insRes.value.json(); setInsights(Array.isArray(v) ? v : [])
      }
    } catch { /* silent */ }
  }, [getHeaders, range])

  useEffect(() => { loadAgents() }, [loadAgents])
  useEffect(() => { loadAnalytics() }, [loadAnalytics])
  useEffect(() => { loadAggregates() }, [loadAggregates])

  // Aggregated KPIs
  const totalReceived   = rows.reduce((s, r) => s + r.messages_received, 0)
  const totalAuto       = rows.reduce((s, r) => s + r.messages_auto_replied, 0)
  const totalEscalated  = rows.reduce((s, r) => s + r.messages_escalated, 0)
  const autoRate        = totalReceived > 0 ? Math.round((totalAuto / totalReceived) * 100) : 0
  const avgConf         = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.avg_confidence, 0) / rows.length) : 0

  const chartData = rows.map(r => ({
    date: r.date.slice(5),
    Recebidas: r.messages_received,
    'Auto-resp.': r.messages_auto_replied,
    Escaladas: r.messages_escalated,
    Confiança: r.avg_confidence,
  }))

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp size={22} style={{ color: '#00E5FF' }} /> Analytics
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Performance dos agentes de IA</p>
        </div>
        <div className="flex items-center gap-2">
          {agents.length > 0 && (
            <select value={agentId} onChange={e => setAgentId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-xl text-sm text-white"
              style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setRange(d)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{ background: range === d ? '#1e1e24' : 'transparent', color: range === d ? '#fff' : '#71717a' }}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-2">
          <TrendingUp size={36} style={{ color: '#27272a' }} />
          <p className="text-zinc-500">{!agentId ? 'Selecione um agente' : 'Sem dados para o período'}</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <MessageCircle size={18} />, label: 'Mensagens',         value: String(totalReceived), sub: `últimos ${range} dias` },
              { icon: <Zap size={18} />,           label: 'Taxa auto-resposta', value: `${autoRate}%`,        sub: `${totalAuto} auto-respostas` },
              { icon: <UserCheck size={18} />,     label: 'Confiança média',   value: `${avgConf}%`,         sub: 'da IA' },
              { icon: <AlertTriangle size={18} />, label: 'Escaladas',         value: String(totalEscalated), sub: 'para humano' },
            ].map(k => (
              <div key={k.label} className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">{k.label}</p>
                  <span style={{ color: '#00E5FF' }}>{k.icon}</span>
                </div>
                <p className="text-3xl font-bold text-white">{k.value}</p>
                <p className="text-xs text-zinc-600">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Volume chart */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-sm font-semibold text-white">Volume de mensagens</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" />
                <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#52525b', fontSize: 10 }} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
                <Bar dataKey="Recebidas"  fill="#3f3f46" radius={[3,3,0,0]} />
                <Bar dataKey="Auto-resp." fill="#00E5FF" radius={[3,3,0,0]} />
                <Bar dataKey="Escaladas"  fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Confidence chart */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-sm font-semibold text-white">Confiança da IA ao longo do tempo</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" />
                <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 10 }} />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v) => [`${v}%`, 'Confiança']} />
                <Line type="monotone" dataKey="Confiança" stroke="#00E5FF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Daily breakdown table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1e1e24' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#111114' }}>
                  {['Data','Recebidas','Auto','Humano','Escaladas','Conf. %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().slice(0, 15).map((r, i) => (
                  <tr key={r.date} style={{ background: i % 2 === 0 ? '#09090b' : '#0d0d10', borderTop: '1px solid #1e1e24' }}>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs">{r.date}</td>
                    <td className="px-4 py-2.5 text-white font-medium text-xs">{r.messages_received}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#00E5FF' }}>{r.messages_auto_replied}</td>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs">{r.messages_human_replied}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: r.messages_escalated > 0 ? '#f87171' : '#52525b' }}>{r.messages_escalated}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">{r.avg_confidence > 0 ? `${r.avg_confidence}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top perguntas recorrentes */}
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center gap-2">
              <MessageSquare size={14} style={{ color: '#00E5FF' }} />
              <p className="text-sm font-semibold text-white">Top perguntas recorrentes</p>
              <span className="text-[10px] text-zinc-500 ml-auto">últimas 2.000 mensagens</span>
            </div>
            {!topQ ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={12} className="animate-spin" /> carregando…</div>
            ) : topQ.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3">Sem perguntas suficientes pra agregar ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {topQ.map((q, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
                    <span className="text-[10px] font-bold tabular-nums w-6 text-zinc-600">#{i + 1}</span>
                    <p className="text-xs text-zinc-300 flex-1 truncate">{q.question}</p>
                    <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: '#00E5FF' }}>{q.count}×</span>
                    <button title="Criar item de conhecimento desta pergunta"
                      onClick={() => window.location.href = `/dashboard/atendente-ia/conhecimento?prefill=${encodeURIComponent(q.question)}`}
                      className="p-1 rounded transition-colors hover:bg-white/5 text-zinc-500 hover:text-cyan-400 shrink-0">
                      <Plus size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Performance por agente */}
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center gap-2">
              <Trophy size={14} style={{ color: '#fbbf24' }} />
              <p className="text-sm font-semibold text-white">Performance por agente</p>
              <span className="text-[10px] text-zinc-500 ml-auto">últimos {range} dias</span>
            </div>
            {!byAgent ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={12} className="animate-spin" /> carregando…</div>
            ) : byAgent.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3">Nenhum dado de agentes ainda.</p>
            ) : (
              <div className="overflow-hidden rounded-lg" style={{ border: '1px solid #1e1e24' }}>
                <table className="w-full text-xs">
                  <thead style={{ background: '#0d0d10' }}>
                    <tr>
                      {['Agente','Mensagens','Auto%','Conf. média','Escaladas'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byAgent.map((a, i) => (
                      <tr key={a.agent_id} style={{ background: i % 2 === 0 ? '#09090b' : '#0d0d10', borderTop: '1px solid #1e1e24' }}>
                        <td className="px-3 py-2 text-zinc-300">
                          <div>{a.agent_name}</div>
                          <div className="text-[10px] text-zinc-600 font-mono truncate max-w-[200px]">{a.model_id}</div>
                        </td>
                        <td className="px-3 py-2 text-white font-medium tabular-nums">{a.messages}</td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: a.auto_pct >= 70 ? '#4ade80' : a.auto_pct >= 40 ? '#fbbf24' : '#f87171' }}>{a.auto_pct}%</td>
                        <td className="px-3 py-2 text-zinc-400 tabular-nums">{a.avg_confidence > 0 ? `${a.avg_confidence}%` : '—'}</td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: a.escalated > 0 ? '#f87171' : '#52525b' }}>{a.escalated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Insights automáticos */}
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center gap-2">
              <Sparkles size={14} style={{ color: '#a78bfa' }} />
              <p className="text-sm font-semibold text-white">Insights automáticos</p>
            </div>
            {!insights ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={12} className="animate-spin" /> carregando…</div>
            ) : insights.length === 0 ? (
              <div className="rounded-lg p-4 text-center" style={{ background: '#0d0d10', border: '1px dashed #2a2a3f' }}>
                <p className="text-xs text-zinc-500">
                  Nenhum insight gerado ainda. O sistema vai detectar padrões automáticos
                  (anúncios com pico de perguntas, queda de sentiment, etc) conforme o
                  volume de conversas crescer.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map(ins => (
                  <div key={ins.id} className="rounded-xl p-4" style={{ background: '#0d0d10', border: '1px solid rgba(167,139,250,0.15)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>{ins.type}</span>
                      <span className="text-[10px] text-zinc-600 ml-auto">{new Date(ins.generated_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed font-sans">
                      {JSON.stringify(ins.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
