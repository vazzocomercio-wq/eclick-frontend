'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, Eye, ShoppingCart, TrendingUp, TrendingDown,
  BarChart2, Percent, DollarSign,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from 'recharts'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type DayVisit  = { date: string; visits: number }
type DayOrder  = { date: string; count: number; revenue: number }

type KpiMonth = {
  count: number
  revenue: number
  by_day: DayOrder[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

function shortDate(d: string) {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

function delta(cur: number, prv: number) {
  if (prv === 0) return null
  return ((cur - prv) / prv) * 100
}

// Merge visits + orders by date into a single array
function buildFunnel(visits: DayVisit[], orders: DayOrder[]) {
  const map: Record<string, { date: string; visits: number; count: number; revenue: number }> = {}
  for (const v of visits)  map[v.date] = { date: v.date, visits: v.visits, count: 0, revenue: 0 }
  for (const o of orders) {
    if (!map[o.date]) map[o.date] = { date: o.date, visits: 0, count: 0, revenue: 0 }
    map[o.date].count   = o.count
    map[o.date].revenue = o.revenue
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).map(r => ({
    ...r,
    cvr: r.visits > 0 ? r.count / r.visits : 0,
    label: shortDate(r.date),
  }))
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color = '#a1a1aa', change }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color?: string; change?: number | null
}) {
  return (
    <div className="rounded-2xl p-4 space-y-2" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <div className="flex items-center gap-2">
        {change != null && (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold"
            style={{ color: change >= 0 ? '#4ade80' : '#f87171' }}>
            {change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs mês ant.
          </span>
        )}
        {sub && <span className="text-[10px] text-zinc-600">{sub}</span>}
      </div>
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-xs space-y-1" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <p className="font-semibold text-zinc-300">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-400">{p.name}:</span>
          <span className="font-medium text-zinc-200">
            {p.dataKey === 'revenue' ? fmtBRL(p.value)
             : p.dataKey === 'cvr'    ? fmtPct(p.value)
             : p.value.toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdsPerformancePage() {
  const [visits,     setVisits]     = useState<DayVisit[]>([])
  const [curMonth,   setCurMonth]   = useState<KpiMonth | null>(null)
  const [prevMonth,  setPrevMonth]  = useState<KpiMonth | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const sb  = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setLoading(false); return }
    const h = { Authorization: `Bearer ${session.access_token}` }

    try {
      const [visRes, kpiRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/listings/visits`, { headers: h }),
        fetch(`${BACKEND}/ml/orders/kpis`,     { headers: h }),
      ])

      if (visRes.status === 'fulfilled' && visRes.value.ok) {
        const d = await visRes.value.json()
        setVisits(d?.byDay ?? [])
      }
      if (kpiRes.status === 'fulfilled' && kpiRes.value.ok) {
        const d = await kpiRes.value.json()
        setCurMonth(d?.current_month ?? null)
        setPrevMonth(d?.last_month ?? null)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar dados')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalVisits  = visits.reduce((s, v) => s + v.visits, 0)
  const curOrders    = curMonth?.count   ?? 0
  const curRevenue   = curMonth?.revenue ?? 0
  const prvOrders    = prevMonth?.count  ?? 0
  const prvRevenue   = prevMonth?.revenue ?? 0
  const cvrGlobal    = totalVisits > 0 ? curOrders / totalVisits : 0
  const avgTicket    = curOrders > 0 ? curRevenue / curOrders : 0

  const funnel = buildFunnel(visits.slice(-30), curMonth?.by_day ?? [])

  // Last 30 days visits only
  const recentVisits = visits.slice(-30)

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Ads</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Performance</h2>
          <p className="text-zinc-500 text-xs mt-1">Visitas, conversão e receita dos canais conectados.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-xs text-red-400" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Visitas (30d)"
          value={loading ? '…' : totalVisits.toLocaleString('pt-BR')}
          icon={<Eye size={14} />}
          color="#60a5fa"
        />
        <KpiCard
          label="Pedidos (mês)"
          value={loading ? '…' : curOrders.toLocaleString('pt-BR')}
          change={delta(curOrders, prvOrders)}
          icon={<ShoppingCart size={14} />}
          color="#4ade80"
        />
        <KpiCard
          label="Taxa de conversão"
          value={loading ? '…' : fmtPct(cvrGlobal)}
          sub="visitas → pedidos"
          icon={<Percent size={14} />}
          color="#a78bfa"
        />
        <KpiCard
          label="Receita (mês)"
          value={loading ? '…' : fmtBRL(curRevenue)}
          change={delta(curRevenue, prvRevenue)}
          sub={`Ticket médio: ${fmtBRL(avgTicket)}`}
          icon={<DollarSign size={14} />}
          color="#34d399"
        />
      </div>

      {/* Visits chart */}
      {recentVisits.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2">
            <Eye size={13} className="text-blue-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Visitas diárias (30 dias)</h3>
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recentVisits.map(v => ({ ...v, label: shortDate(v.date) }))}>
                <defs>
                  <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="visits" name="Visitas" stroke="#60a5fa" strokeWidth={1.5} fill="url(#visitGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Revenue by day */}
        {(curMonth?.by_day ?? []).length > 0 && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center gap-2">
              <DollarSign size={13} className="text-emerald-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Receita diária — mês atual</h3>
            </div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(curMonth?.by_day ?? []).map(d => ({ ...d, label: shortDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} width={45}
                    tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Receita" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CVR funnel chart */}
        {funnel.length > 0 && (
          <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center gap-2">
              <Percent size={13} className="text-violet-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Taxa de conversão diária</h3>
            </div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={funnel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} width={35}
                    tickFormatter={v => `${(v * 100).toFixed(1)}%`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="cvr" name="Conversão" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Channel summary */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2">
          <BarChart2 size={13} className="text-zinc-500" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Resumo por canal</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* ML */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: '#18181b', border: '1px solid #27272a' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black" style={{ background: 'rgba(255,230,0,0.15)', color: '#FFE600' }}>ML</div>
              <span className="text-xs font-semibold text-zinc-300">Mercado Livre</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">Visitas</span>
                <span className="text-zinc-200 font-medium">{totalVisits.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">Pedidos</span>
                <span className="text-zinc-200 font-medium">{curOrders.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">CVR</span>
                <span className="text-zinc-200 font-medium">{fmtPct(cvrGlobal)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">Receita</span>
                <span className="text-zinc-200 font-medium">{fmtBRL(curRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Shopee — coming soon */}
          {(['Shopee', 'Amazon'] as const).map(name => (
            <div key={name} className="rounded-xl p-3 space-y-2" style={{ background: '#18181b', border: '1px solid #27272a', opacity: 0.45 }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black"
                  style={{ background: name === 'Shopee' ? 'rgba(238,77,45,0.15)' : 'rgba(255,153,0,0.15)', color: name === 'Shopee' ? '#EE4D2D' : '#FF9900' }}>
                  {name === 'Shopee' ? 'SH' : 'AZ'}
                </div>
                <span className="text-xs font-semibold text-zinc-300">{name}</span>
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#27272a', color: '#52525b' }}>em breve</span>
              </div>
              <p className="text-[10px] text-zinc-600">Integração disponível em breve.</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
