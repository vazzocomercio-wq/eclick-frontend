'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown, ShoppingCart, DollarSign, Ticket, CalendarDays } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const brl   = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const shortBrl = (v: number) => Math.abs(v) >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : brl(v)

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

// ── types ─────────────────────────────────────────────────────────────────────

type DayPoint = { date: string; count: number; revenue: number }

type MonthData = {
  count: number
  revenue: number
  by_day: DayPoint[]
}

type KpisResponse = {
  current_month: MonthData
  last_month: MonthData
}

// ── helpers ───────────────────────────────────────────────────────────────────

const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function monthLabel(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  return `${PT_MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
}

function dayLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${PT_MONTHS[d.getMonth()]}`
}

function delta(cur: number, prv: number): number | null {
  if (!prv) return null
  return ((cur - prv) / prv) * 100
}

// ── chart tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string; fill?: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2.5 text-sm" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <p className="text-zinc-400 text-xs mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-3 justify-between">
          <span className="text-xs" style={{ color: p.color ?? p.fill }}>{p.name}</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: p.color ?? p.fill }}>
            {p.name.toLowerCase().includes('pedido') ? p.value : shortBrl(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, deltaVal, loading }: {
  icon: React.ReactNode; label: string; value: string; sub?: string
  deltaVal?: number | null; loading?: boolean
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1.5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-500">{label}</p>
        <span className="text-zinc-700">{icon}</span>
      </div>
      {loading
        ? <div className="h-7 w-28 rounded animate-pulse bg-zinc-800" />
        : <p className="text-xl font-bold text-white leading-tight">{value}</p>
      }
      {!loading && (
        <div className="flex items-center gap-2">
          {deltaVal != null && (
            <span className="flex items-center gap-0.5 text-[11px] font-semibold"
              style={{ color: deltaVal >= 0 ? '#34d399' : '#f43f5e' }}>
              {deltaVal >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {deltaVal >= 0 ? '+' : ''}{deltaVal.toFixed(1)}%
            </span>
          )}
          {sub && <span className="text-[11px] text-zinc-600">{sub}</span>}
        </div>
      )}
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function VendasPage() {
  const [kpis,    setKpis]    = useState<KpisResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState<'revenue' | 'orders'>('revenue')

  const load = useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    if (!token) { setLoading(false); return }
    try {
      const res = await fetch(`${BACKEND}/ml/orders/kpis`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setKpis(await res.json())
    } catch { setKpis(null) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const cur = kpis?.current_month
  const prv = kpis?.last_month

  const ticketCur = cur && cur.count > 0 ? cur.revenue / cur.count : null
  const ticketPrv = prv && prv.count > 0 ? prv.revenue / prv.count : null

  const curLabel = monthLabel(0)
  const prvLabel = monthLabel(1)

  // Fill current-month days from day 1 up to today
  const today = new Date()
  const daysInMonth = today.getDate()
  const curByDay = cur?.by_day ?? []
  const prvByDay = prv?.by_day ?? []

  // Map for quick lookup
  const curMap: Record<string, DayPoint> = {}
  const prvMap: Record<string, DayPoint> = {}
  curByDay.forEach(d => { curMap[d.date] = d })
  prvByDay.forEach(d => { prvMap[d.date] = d })

  // Build cumulative daily chart: day 1..N of the month
  const dailyChart = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const curDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    // Find last month's equivalent day
    const prvD = new Date(today.getFullYear(), today.getMonth() - 1, day)
    const prvDate = `${prvD.getFullYear()}-${String(prvD.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    return {
      dia: `${day}`,
      [`Receita (${curLabel})`]: curMap[curDate]?.revenue ?? 0,
      [`Receita (${prvLabel})`]: prvMap[prvDate]?.revenue ?? 0,
      [`Pedidos (${curLabel})`]: curMap[curDate]?.count ?? 0,
      [`Pedidos (${prvLabel})`]: prvMap[prvDate]?.count ?? 0,
    }
  })

  // Cumulative revenue chart
  let cumCur = 0, cumPrv = 0
  const cumulChart = dailyChart.map(d => {
    cumCur += d[`Receita (${curLabel})`] as number
    cumPrv += d[`Receita (${prvLabel})`] as number
    return {
      dia: d.dia,
      [curLabel]: Math.round(cumCur * 100) / 100,
      [prvLabel]: Math.round(cumPrv * 100) / 100,
    }
  })

  // Top-day this month
  const topDay = curByDay.reduce((best, d) => d.revenue > (best?.revenue ?? 0) ? d : best, curByDay[0] ?? null)

  return (
    <div className="flex flex-col h-full overflow-auto px-6 py-6" style={{ color: '#e4e4e7' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Vendas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{curLabel} — comparativo com {prvLabel}</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={<DollarSign size={16} />}
          label={`Faturamento ${curLabel}`}
          value={brl(cur?.revenue ?? 0)}
          deltaVal={delta(cur?.revenue ?? 0, prv?.revenue ?? 0)}
          sub={`vs ${brl(prv?.revenue ?? 0)}`}
          loading={loading}
        />
        <KpiCard
          icon={<ShoppingCart size={16} />}
          label={`Pedidos ${curLabel}`}
          value={String(cur?.count ?? 0)}
          deltaVal={delta(cur?.count ?? 0, prv?.count ?? 0)}
          sub={`vs ${prv?.count ?? 0} no mês ant.`}
          loading={loading}
        />
        <KpiCard
          icon={<Ticket size={16} />}
          label="Ticket médio"
          value={ticketCur != null ? brl(ticketCur) : '—'}
          deltaVal={ticketCur != null && ticketPrv != null ? delta(ticketCur, ticketPrv) : null}
          sub={ticketPrv != null ? `vs ${brl(ticketPrv)}` : undefined}
          loading={loading}
        />
        <KpiCard
          icon={<CalendarDays size={16} />}
          label="Melhor dia do mês"
          value={topDay ? brl(topDay.revenue) : '—'}
          sub={topDay ? `${dayLabel(topDay.date)} · ${topDay.count} pedido${topDay.count !== 1 ? 's' : ''}` : undefined}
          loading={loading}
        />
      </div>

      {!loading && !kpis && (
        <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
          ML não conectado ou sem dados disponíveis.
        </div>
      )}

      {(loading || kpis) && (
        <>
          {/* Cumulative chart */}
          <div className="rounded-xl p-4 mb-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Receita acumulada no mês</p>
            </div>
            {loading
              ? <div className="h-52 flex items-center justify-center text-zinc-600 text-sm gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                </div>
              : (
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={cumulChart}>
                    <defs>
                      <linearGradient id="gradCur" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00E5FF" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#00E5FF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradPrv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v % 5 === 1 || v === '1' ? String(v) : ''} />
                    <YAxis tickFormatter={shortBrl} tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#71717a' }} />
                    <Area dataKey={curLabel} stroke="#00E5FF" strokeWidth={2} fill="url(#gradCur)" dot={false} activeDot={{ r: 4 }} />
                    <Area dataKey={prvLabel} stroke="#6366f1" strokeWidth={1.5} fill="url(#gradPrv)" dot={false} strokeDasharray="4 4" activeDot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )
            }
          </div>

          {/* Daily bar chart */}
          <div className="rounded-xl p-4 mb-6" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Por dia</p>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                {(['revenue', 'orders'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className="px-3 py-1 text-xs font-medium transition-all"
                    style={view === v
                      ? { background: 'rgba(0,229,255,0.12)', color: '#00E5FF' }
                      : { background: 'rgba(255,255,255,0.03)', color: '#71717a' }
                    }
                  >
                    {v === 'revenue' ? 'Receita' : 'Pedidos'}
                  </button>
                ))}
              </div>
            </div>
            {loading
              ? <div className="h-44 flex items-center justify-center text-zinc-600 text-sm gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                </div>
              : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dailyChart} barCategoryGap="20%" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v % 5 === 1 || v === '1' ? String(v) : ''} />
                    <YAxis tickFormatter={v => view === 'revenue' ? shortBrl(v) : String(v)}
                      tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#71717a' }} />
                    <ReferenceLine y={0} stroke="#27272a" />
                    {view === 'revenue' ? (
                      <>
                        <Bar dataKey={`Receita (${curLabel})`} fill="#00E5FF" radius={[3,3,0,0]} opacity={0.85} />
                        <Bar dataKey={`Receita (${prvLabel})`} fill="#6366f1" radius={[3,3,0,0]} opacity={0.5} />
                      </>
                    ) : (
                      <>
                        <Bar dataKey={`Pedidos (${curLabel})`} fill="#22c55e" radius={[3,3,0,0]} opacity={0.85} />
                        <Bar dataKey={`Pedidos (${prvLabel})`} fill="#84cc16" radius={[3,3,0,0]} opacity={0.5} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>

          {/* Day-by-day table */}
          {!loading && curByDay.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="px-4 py-3 border-b border-zinc-800/60">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Detalhe por dia — {curLabel}</p>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="py-2 px-4 text-left text-[11px] font-semibold text-zinc-600 uppercase tracking-wide">Data</th>
                    <th className="py-2 px-4 text-right text-[11px] font-semibold text-zinc-600 uppercase tracking-wide">Pedidos</th>
                    <th className="py-2 px-4 text-right text-[11px] font-semibold text-zinc-600 uppercase tracking-wide">Receita</th>
                    <th className="py-2 px-4 text-right text-[11px] font-semibold text-zinc-600 uppercase tracking-wide">Ticket médio</th>
                  </tr>
                </thead>
                <tbody>
                  {[...curByDay].sort((a, b) => b.date.localeCompare(a.date)).map(d => (
                    <tr key={d.date} className="border-b border-zinc-800/40 hover:bg-zinc-900/30 transition-colors">
                      <td className="py-2.5 px-4 text-sm text-zinc-300">{dayLabel(d.date)}</td>
                      <td className="py-2.5 px-4 text-sm text-right text-zinc-400 tabular-nums">{d.count}</td>
                      <td className="py-2.5 px-4 text-sm text-right font-semibold text-white tabular-nums">{brl(d.revenue)}</td>
                      <td className="py-2.5 px-4 text-sm text-right text-zinc-400 tabular-nums">
                        {d.count > 0 ? brl(d.revenue / d.count) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderTop: '2px solid rgba(255,255,255,0.07)' }}>
                    <td className="py-2.5 px-4 text-sm font-bold text-white">Total</td>
                    <td className="py-2.5 px-4 text-sm text-right font-semibold text-zinc-200 tabular-nums">{cur?.count ?? 0}</td>
                    <td className="py-2.5 px-4 text-sm text-right font-bold text-white tabular-nums">{brl(cur?.revenue ?? 0)}</td>
                    <td className="py-2.5 px-4 text-sm text-right font-semibold text-zinc-200 tabular-nums">
                      {ticketCur != null ? brl(ticketCur) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
