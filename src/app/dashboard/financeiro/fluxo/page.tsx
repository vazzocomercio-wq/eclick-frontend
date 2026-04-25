'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, LineChart, Line,
} from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const shortBrl = (v: number) => {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return brl(v)
}

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

// ── types ─────────────────────────────────────────────────────────────────────

type MonthKpis = {
  faturamento_ml: number
  tarifa_total: number
  frete_vendedor: number
  vendas_aprovadas: number
  custo_total: number
  imposto_total: number
  margem_contribuicao: number
  margem_pct: number
  qtd_aprovadas: number
}

type MonthData = {
  label: string      // e.g. "Jan/25"
  from: string
  to: string
  kpis: MonthKpis | null
  loading: boolean
}

// ── month helpers ─────────────────────────────────────────────────────────────

const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function buildMonths(n: number): MonthData[] {
  const now = new Date()
  const result: MonthData[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const lastDay = new Date(y, m + 1, 0)
    const isCurrentMonth = i === 0
    result.push({
      label: `${PT_MONTHS[m]}/${String(y).slice(2)}`,
      from:  `${y}-${String(m + 1).padStart(2, '0')}-01`,
      to:    isCurrentMonth
        ? now.toISOString().slice(0, 10)
        : lastDay.toISOString().slice(0, 10),
      kpis:    null,
      loading: true,
    })
  }
  return result
}

// ── custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; fill?: string; color?: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-sm" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <p className="font-semibold text-white mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 justify-between">
          <span style={{ color: p.fill ?? p.color ?? '#e4e4e7' }} className="text-xs">{p.name}</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: p.fill ?? p.color ?? '#e4e4e7' }}>
            {shortBrl(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── kpi card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, delta, loading }: {
  label: string; value: string; delta?: { v: number; label: string }; loading?: boolean
}) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <p className="text-[11px] text-zinc-500 mb-1">{label}</p>
      {loading
        ? <div className="h-6 w-24 rounded animate-pulse bg-zinc-800" />
        : <p className="text-lg font-bold text-white leading-none">{value}</p>
      }
      {delta && !loading && (
        <div className="flex items-center gap-1 mt-1"
          style={{ color: delta.v >= 0 ? '#34d399' : '#f43f5e' }}>
          {delta.v >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          <span className="text-[11px] font-semibold">{delta.v >= 0 ? '+' : ''}{delta.v.toFixed(1)}% {delta.label}</span>
        </div>
      )}
    </div>
  )
}

// ── N-month selector ──────────────────────────────────────────────────────────

const RANGES = [
  { label: '3m',  value: 3 },
  { label: '6m',  value: 6 },
  { label: '12m', value: 12 },
]

// ── page ──────────────────────────────────────────────────────────────────────

export default function FluxoCaixaPage() {
  const [nMonths,   setNMonths]   = useState(6)
  const [months,    setMonths]    = useState<MonthData[]>([])
  const [loading,   setLoading]   = useState(true)
  const [chartView, setChartView] = useState<'bar' | 'line'>('bar')

  const loadAll = useCallback(async (n: number) => {
    setLoading(true)
    const token = await getToken()
    if (!token) { setLoading(false); return }

    const initial = buildMonths(n)
    setMonths(initial)

    const results = await Promise.allSettled(
      initial.map(async m => {
        const params = new URLSearchParams({ date_from: m.from, date_to: m.to, kpis_only: 'true' })
        const res = await fetch(`${BACKEND}/ml/financial-summary?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error()
        const body = await res.json()
        return body.kpis as MonthKpis
      })
    )

    const updated = initial.map((m, i) => ({
      ...m,
      loading: false,
      kpis: results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<MonthKpis>).value : null,
    }))
    setMonths(updated)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll(nMonths) }, [loadAll, nMonths])

  // Chart data
  const chartData = months.map(m => ({
    name: m.label,
    Faturamento:  m.kpis?.faturamento_ml ?? 0,
    'Rec. Líquida': m.kpis?.vendas_aprovadas ?? 0,
    Custos:       (m.kpis?.custo_total ?? 0) + (m.kpis?.imposto_total ?? 0),
    Tarifas:      m.kpis?.tarifa_total ?? 0,
    Frete:        m.kpis?.frete_vendedor ?? 0,
    MC:           m.kpis?.margem_contribuicao ?? 0,
  }))

  // Totals
  const totFat   = months.reduce((s, m) => s + (m.kpis?.faturamento_ml ?? 0), 0)
  const totMC    = months.reduce((s, m) => s + (m.kpis?.margem_contribuicao ?? 0), 0)
  const totQtd   = months.reduce((s, m) => s + (m.kpis?.qtd_aprovadas ?? 0), 0)
  const avgMgPct = months.filter(m => m.kpis).length > 0
    ? months.filter(m => m.kpis).reduce((s, m) => s + (m.kpis?.margem_pct ?? 0), 0) / months.filter(m => m.kpis).length
    : 0

  // MoM delta for last two months
  const last2 = months.filter(m => m.kpis).slice(-2)
  const momFat = last2.length === 2 && last2[0].kpis!.faturamento_ml > 0
    ? ((last2[1].kpis!.faturamento_ml - last2[0].kpis!.faturamento_ml) / last2[0].kpis!.faturamento_ml) * 100
    : undefined
  const momMC = last2.length === 2 && last2[0].kpis!.margem_contribuicao !== 0
    ? ((last2[1].kpis!.margem_contribuicao - last2[0].kpis!.margem_contribuicao) / Math.abs(last2[0].kpis!.margem_contribuicao)) * 100
    : undefined

  return (
    <div className="flex flex-col h-full overflow-auto px-6 py-6" style={{ color: '#e4e4e7' }}>
      {/* header */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Fluxo de Receita</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Evolução mensal de faturamento e margem</p>
        </div>
        <div className="flex items-center gap-2">
          {/* range */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setNMonths(r.value)}
                className="px-3 py-1.5 text-xs font-semibold transition-all"
                style={nMonths === r.value
                  ? { background: 'rgba(0,229,255,0.15)', color: '#00E5FF' }
                  : { background: 'rgba(255,255,255,0.04)', color: '#71717a' }
                }
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* chart view */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {(['bar', 'line'] as const).map(v => (
              <button
                key={v}
                onClick={() => setChartView(v)}
                className="px-3 py-1.5 text-xs font-semibold capitalize transition-all"
                style={chartView === v
                  ? { background: 'rgba(0,229,255,0.15)', color: '#00E5FF' }
                  : { background: 'rgba(255,255,255,0.04)', color: '#71717a' }
                }
              >
                {v === 'bar' ? 'Barras' : 'Linhas'}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadAll(nMonths)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label={`Faturamento (${nMonths}m)`}    value={brl(totFat)}  delta={momFat  !== undefined ? { v: momFat,  label: 'vs mês ant.' } : undefined} loading={loading} />
        <KpiCard label={`MC acumulada (${nMonths}m)`}   value={brl(totMC)}   delta={momMC   !== undefined ? { v: momMC,   label: 'vs mês ant.' } : undefined} loading={loading} />
        <KpiCard label={`Margem média`}                 value={`${avgMgPct.toFixed(1)}%`} loading={loading} />
        <KpiCard label={`Pedidos (${nMonths}m)`}        value={String(totQtd)} loading={loading} />
      </div>

      {/* chart */}
      <div className="rounded-xl p-4 mb-6" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-4">Faturamento vs Margem de Contribuição</p>
        {loading
          ? <div className="h-64 flex items-center justify-center text-zinc-600 text-sm gap-2">
              <RefreshCw size={14} className="animate-spin" /> Carregando…
            </div>
          : (
            <ResponsiveContainer width="100%" height={260}>
              {chartView === 'bar' ? (
                <BarChart data={chartData} barCategoryGap="25%" barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={shortBrl} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#71717a' }} />
                  <ReferenceLine y={0} stroke="#3f3f46" />
                  <Bar dataKey="Faturamento"   fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="Rec. Líquida"  fill="#6366f1" radius={[4,4,0,0]} />
                  <Bar dataKey="MC"            fill="#22c55e" radius={[4,4,0,0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={shortBrl} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#71717a' }} />
                  <ReferenceLine y={0} stroke="#3f3f46" />
                  <Line dataKey="Faturamento"  stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line dataKey="Rec. Líquida" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line dataKey="MC"           stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )
        }
      </div>

      {/* cost breakdown chart */}
      <div className="rounded-xl p-4 mb-6" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-4">Deduções mensais (Tarifas + Frete + Custos + Impostos)</p>
        {loading
          ? <div className="h-48 flex items-center justify-center text-zinc-600 text-sm gap-2">
              <RefreshCw size={14} className="animate-spin" />
            </div>
          : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={shortBrl} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={65} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#71717a' }} />
                <Bar dataKey="Tarifas" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Frete"   stackId="a" fill="#3b82f6" />
                <Bar dataKey="Custos"  stackId="a" fill="#f97316" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        }
      </div>

      {/* monthly table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-800">
              {['Mês','Faturamento','Tarifas','Frete','CPV','Rec. Líquida','MC','Margem %','Pedidos'].map(h => (
                <th key={h} className="py-2.5 px-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => {
              const k = m.kpis
              const isLast = i === months.length - 1
              return (
                <tr key={m.label} className="border-b border-zinc-800/60 hover:bg-zinc-900/30 transition-colors"
                  style={isLast ? { background: 'rgba(0,229,255,0.03)' } : undefined}>
                  <td className="py-2.5 px-3 text-sm font-semibold text-white">{m.label}</td>
                  <td className="py-2.5 px-3 text-sm tabular-nums text-zinc-300">{k ? brl(k.faturamento_ml) : '—'}</td>
                  <td className="py-2.5 px-3 text-sm tabular-nums text-amber-400/80">{k ? brl(k.tarifa_total) : '—'}</td>
                  <td className="py-2.5 px-3 text-sm tabular-nums text-blue-400/80">{k ? brl(k.frete_vendedor) : '—'}</td>
                  <td className="py-2.5 px-3 text-sm tabular-nums text-orange-400/80">{k ? brl(k.custo_total) : '—'}</td>
                  <td className="py-2.5 px-3 text-sm tabular-nums text-indigo-300">{k ? brl(k.vendas_aprovadas) : '—'}</td>
                  <td className="py-2.5 px-3 text-sm tabular-nums font-semibold"
                    style={{ color: k ? (k.margem_contribuicao >= 0 ? '#34d399' : '#f43f5e') : '#71717a' }}>
                    {k ? brl(k.margem_contribuicao) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-sm tabular-nums font-semibold"
                    style={{ color: k ? (k.margem_pct >= 20 ? '#34d399' : k.margem_pct >= 10 ? '#f59e0b' : '#f43f5e') : '#71717a' }}>
                    {k ? `${k.margem_pct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-zinc-400">{k ? k.qtd_aprovadas : '—'}</td>
                </tr>
              )
            })}
            {/* totals row */}
            {!loading && months.some(m => m.kpis) && (
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '2px solid rgba(255,255,255,0.08)' }}>
                <td className="py-2.5 px-3 text-sm font-bold text-white">Total</td>
                <td className="py-2.5 px-3 text-sm tabular-nums font-semibold text-zinc-200">{brl(totFat)}</td>
                <td className="py-2.5 px-3 text-sm tabular-nums font-semibold text-amber-400">
                  {brl(months.reduce((s, m) => s + (m.kpis?.tarifa_total ?? 0), 0))}
                </td>
                <td className="py-2.5 px-3 text-sm tabular-nums font-semibold text-blue-400">
                  {brl(months.reduce((s, m) => s + (m.kpis?.frete_vendedor ?? 0), 0))}
                </td>
                <td className="py-2.5 px-3 text-sm tabular-nums font-semibold text-orange-400">
                  {brl(months.reduce((s, m) => s + (m.kpis?.custo_total ?? 0), 0))}
                </td>
                <td className="py-2.5 px-3 text-sm tabular-nums font-semibold text-indigo-300">
                  {brl(months.reduce((s, m) => s + (m.kpis?.vendas_aprovadas ?? 0), 0))}
                </td>
                <td className="py-2.5 px-3 text-sm tabular-nums font-bold"
                  style={{ color: totMC >= 0 ? '#34d399' : '#f43f5e' }}>
                  {brl(totMC)}
                </td>
                <td className="py-2.5 px-3 text-sm tabular-nums font-bold"
                  style={{ color: avgMgPct >= 20 ? '#34d399' : avgMgPct >= 10 ? '#f59e0b' : '#f43f5e' }}>
                  {avgMgPct.toFixed(1)}%
                </td>
                <td className="py-2.5 px-3 text-sm font-semibold text-zinc-200">{totQtd}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
