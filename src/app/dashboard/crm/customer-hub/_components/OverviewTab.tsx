'use client'

import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { api } from './api'
import {
  Overview, AbcResult, ABC_COLORS, ABC_LABELS, CHURN_COLORS, CHURN_LABELS, ChurnRisk, Curve,
  fmtCurrency, fmtNumber,
} from './types'

export function OverviewTab({ onToast }: { onToast: (m: string, type?: 'success' | 'error') => void }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [abc, setAbc]           = useState<AbcResult | null>(null)
  const [loading, setLoading]   = useState(true)
  const [computing, setComputing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [o, a] = await Promise.all([
        api<Overview>('/customer-hub/overview'),
        api<AbcResult>('/customer-hub/abc'),
      ])
      setOverview(o); setAbc(a)
    } catch (e) { onToast((e as Error).message, 'error') }
    setLoading(false)
  }, [onToast])

  useEffect(() => { load() }, [load])

  async function recompute() {
    setComputing(true)
    try {
      const r = await api<{ updated: number; duration_ms: number }>('/customer-hub/compute', { method: 'POST' })
      onToast(`${r.updated} clientes atualizados em ${(r.duration_ms / 1000).toFixed(1)}s`, 'success')
      await load()
    } catch (e) { onToast((e as Error).message, 'error') }
    setComputing(false)
  }

  if (loading) return <div className="h-64 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
  if (!overview || !abc) return <div className="text-zinc-500 text-sm">Sem dados.</div>

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-zinc-400 text-sm">Visão consolidada de RFM, ABC e churn. Recálculo manual abaixo (cron diário @03:17 BRT também roda).</p>
        <button
          onClick={recompute}
          disabled={computing}
          className="relative px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition"
          style={{
            background: '#00E5FF',
            color: '#08323b',
            boxShadow: computing ? '0 0 18px rgba(0,229,255,0.6)' : 'none',
          }}
        >
          {computing && <span className="absolute inset-0 rounded-lg animate-pulse" style={{ background: 'rgba(0,229,255,0.3)' }} />}
          <span className="relative">{computing ? 'Recalculando…' : 'Recalcular métricas'}</span>
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Total clientes"   value={fmtNumber(overview.total_customers)} />
        <Kpi label="LTV médio"        value={fmtCurrency(overview.avg_ltv)}       accent="#00E5FF" />
        <Kpi label="Ticket médio"     value={fmtCurrency(overview.avg_ticket)}    accent="#34d399" />
        <Kpi label="Ativos (90d)"     value={fmtNumber(overview.active_customers_90d)} accent="#60a5fa" />
      </div>

      {/* 3 ABC cards lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {(['A', 'B', 'C'] as Curve[]).map(c => (
          <AbcCard key={c} curve={c} bucket={abc[c]} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Donut ABC */}
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <p className="text-zinc-300 text-sm font-semibold mb-3">Distribuição ABC</p>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { name: 'A', value: abc.A.count, fill: ABC_COLORS.A },
                    { name: 'B', value: abc.B.count, fill: ABC_COLORS.B },
                    { name: 'C', value: abc.C.count, fill: ABC_COLORS.C },
                  ]}
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {(['A', 'B', 'C'] as Curve[]).map(c => <Cell key={c} fill={ABC_COLORS[c]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#a1a1aa' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BarChart horizontal de churn */}
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <p className="text-zinc-300 text-sm font-semibold mb-3">Distribuição de churn risk</p>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart
                layout="vertical"
                data={(['low', 'medium', 'high', 'critical'] as ChurnRisk[]).map(k => ({
                  name: CHURN_LABELS[k].split(' ')[0], value: overview.churn[k], fill: CHURN_COLORS[k],
                }))}
                margin={{ top: 5, right: 10, left: 30, bottom: 0 }}
              >
                <XAxis type="number" stroke="#52525b" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#52525b" fontSize={11} width={70} />
                <Tooltip
                  contentStyle={{ background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#a1a1aa' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {(['low', 'medium', 'high', 'critical'] as ChurnRisk[]).map(k => (
                    <Cell key={k} fill={CHURN_COLORS[k]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  )
}

function Kpi({ label, value, accent = '#fafafa' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <p className="text-zinc-500 text-[11px] uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1 truncate" style={{ color: accent }}>{value}</p>
    </div>
  )
}

function AbcCard({ curve, bucket }: { curve: Curve; bucket: { count: number; revenue: number; pct_revenue: number; avg_ticket: number } }) {
  const color = ABC_COLORS[curve]
  return (
    <div className="rounded-2xl p-5" style={{ background: '#111114', border: `1px solid ${color}40` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-2xl font-bold" style={{ color }}>{curve}</p>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${color}1a`, color }}>
          {(bucket.pct_revenue * 100).toFixed(1)}% receita
        </span>
      </div>
      <p className="text-zinc-400 text-xs mb-3">{ABC_LABELS[curve]}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Clientes</span>
          <span className="text-white font-medium">{fmtNumber(bucket.count)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Receita</span>
          <span className="text-white font-medium">{fmtCurrency(bucket.revenue)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Ticket médio</span>
          <span className="text-white font-medium">{fmtCurrency(bucket.avg_ticket)}</span>
        </div>
      </div>
    </div>
  )
}
