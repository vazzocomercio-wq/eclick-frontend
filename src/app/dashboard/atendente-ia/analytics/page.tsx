'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { TrendingUp, MessageCircle, Zap, UserCheck, AlertTriangle, Loader2, Calendar } from 'lucide-react'

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
      if (res.ok) setRows(await res.json())
    } finally { setLoading(false) }
  }, [getHeaders, agentId, range])

  useEffect(() => { loadAgents() }, [loadAgents])
  useEffect(() => { loadAnalytics() }, [loadAnalytics])

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
        </>
      )}
    </div>
  )
}
