'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

const BrazilSalesMap = dynamic(() => import('@/components/BrazilSalesMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-[#111114] rounded-xl animate-pulse flex items-center justify-center">
      <span className="text-gray-500 text-sm">Carregando mapa...</span>
    </div>
  ),
})

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const REFRESH_MS = 60_000

// ── types ─────────────────────────────────────────────────────────────────────

type OrderItem = { item_id: string; title: string; quantity: number; unit_price: number }
type Order = {
  id: string
  status: string
  date_created: string
  total_amount: number
  items: OrderItem[]
  shipping_state?: string | null
  shipping_city?: string | null
}

type DayMetrics = { revenue: number; count: number; units: number; avgTicket: number }

// ── helpers ───────────────────────────────────────────────────────────────────

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(a: number, b: number): number | null {
  if (!b) return null
  return ((a - b) / b) * 100
}

// ML returns date_created with -03:00 offset, so .slice(0,10) gives the
// Brazil local date. We must use the same UTC-3 offset here for comparisons.
function brazilDateStr(daysOffset = 0): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
  if (daysOffset) d.setUTCDate(d.getUTCDate() + daysOffset)
  return d.toISOString().slice(0, 10)
}

function todayStr() { return brazilDateStr(0) }
function yestStr()  { return brazilDateStr(-1) }
function lwStr()    { return brazilDateStr(-7) }

function orderBrazilDate(dateStr: string): string {
  return new Date(new Date(dateStr).getTime() - 3 * 60 * 60 * 1000)
    .toISOString().slice(0, 10)
}

function brazilHour(dateStr: string): number {
  return new Date(new Date(dateStr).getTime() - 3 * 60 * 60 * 1000).getUTCHours()
}

function isPaid(o: Order) { return o.status === 'paid' || o.status === 'payment_in_process' }

function metricsFor(orders: Order[], ds: string): DayMetrics {
  const day = orders.filter(o => orderBrazilDate(o.date_created) === ds && isPaid(o))
  const revenue = day.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const count = day.length
  const units = day.reduce((s, o) => s + o.items.reduce((ss, i) => ss + (i.quantity ?? 0), 0), 0)
  return { revenue, count, units, avgTicket: count ? revenue / count : 0 }
}

function hourlyRevenue(orders: Order[], ds: string): number[] {
  const arr = Array(24).fill(0)
  for (const o of orders) {
    if (!isPaid(o) || orderBrazilDate(o.date_created) !== ds) continue
    arr[brazilHour(o.date_created)] += o.total_amount ?? 0
  }
  return arr
}

function topProducts(orders: Order[], ds: string) {
  const map = new Map<string, { title: string; units: number; revenue: number; lastSold: number }>()
  for (const o of orders) {
    if (!isPaid(o) || orderBrazilDate(o.date_created) !== ds) continue
    for (const item of o.items) {
      const key = item.item_id ?? item.title
      const ts = new Date(o.date_created).getTime()
      const ex = map.get(key)
      if (ex) { ex.units += item.quantity ?? 0; ex.revenue += (item.unit_price ?? 0) * (item.quantity ?? 1); if (ts > ex.lastSold) ex.lastSold = ts }
      else map.set(key, { title: item.title ?? '—', units: item.quantity ?? 0, revenue: (item.unit_price ?? 0) * (item.quantity ?? 1), lastSold: ts })
    }
  }
  return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
}

function buildHeatMap(orders: Order[]): number[][] {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
  const todayMs = new Date(brazilDateStr(0) + 'T00:00:00Z').getTime()
  for (const o of orders) {
    if (!isPaid(o)) continue
    const oDateMs = new Date(orderBrazilDate(o.date_created) + 'T00:00:00Z').getTime()
    const daysAgo = Math.floor((todayMs - oDateMs) / 86_400_000)
    if (daysAgo >= 0 && daysAgo < 7) grid[6 - daysAgo][brazilHour(o.date_created)] += o.total_amount ?? 0
  }
  return grid
}

function recentOrders(orders: Order[], n = 20) {
  return [...orders]
    .sort((a, b) => b.date_created.localeCompare(a.date_created))
    .slice(0, n)
}

// ── sparkline svg ──────────────────────────────────────────────────────────────

function Spark({ values, color = '#00E5FF' }: { values: number[]; color?: string }) {
  const w = 72, h = 28
  const max = Math.max(...values, 0.01)
  const min = Math.min(...values)
  const range = (max - min) || 1
  if (values.length < 2) return <div style={{ width: w, height: h }} />
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
    </svg>
  )
}

// ── tooltip components ─────────────────────────────────────────────────────────

function HourTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#18181b', border: '1px solid #2e2e33', borderRadius: 8, padding: '8px 12px', minWidth: 140 }}>
      <p style={{ color: '#71717a', fontSize: 10, marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => p.value != null && p.value > 0 && (
        <p key={i} style={{ color: p.color, fontSize: 12, fontWeight: 600 }}>{p.name}: {brl(p.value)}</p>
      ))}
    </div>
  )
}

// ── metric card ────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, change, sparkData, color = '#00E5FF' }: {
  label: string; value: string; sub?: string
  change: number | null; sparkData: number[]; color?: string
}) {
  const up = change != null && change >= 0
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2 transition-all"
      style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.border = `1px solid ${color}28`; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px ${color}10` }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
      <div className="flex items-start justify-between">
        <p className="text-zinc-400 text-[11px] font-medium leading-tight">{label}</p>
        {change != null && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
            style={{ background: up ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: up ? '#34d399' : '#f87171' }}>
            {up ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-white text-xl font-bold tracking-tight leading-none">{value}</p>
          {sub && <p className="text-zinc-600 text-[10px] mt-1">{sub}</p>}
        </div>
        <div className="shrink-0 mb-1"><Spark values={sparkData} color={color} /></div>
      </div>
    </div>
  )
}

// ── conversion funnel ──────────────────────────────────────────────────────────

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const w = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <p className="text-zinc-400 text-[11px] w-32 shrink-0 truncate">{label}</p>
      <div className="flex-1 h-5 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${w}%`, background: `linear-gradient(to right, ${color}aa, ${color})` }} />
      </div>
      <p className="text-white text-[11px] font-bold w-14 text-right shrink-0">{value.toLocaleString('pt-BR')}</p>
      <p className="text-zinc-600 text-[10px] w-12 text-right shrink-0">{w.toFixed(1)}%</p>
    </div>
  )
}

// ── heat map cell ──────────────────────────────────────────────────────────────

function HeatCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0
  const bg = intensity === 0
    ? '#0e0e11'
    : `rgba(0, 229, 255, ${0.08 + intensity * 0.72})`
  return (
    <div title={value > 0 ? brl(value) : ''}
      style={{ width: 28, height: 20, borderRadius: 3, background: bg, transition: 'background 0.3s', flexShrink: 0 }} />
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function VendasAoVivoPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [now, setNow] = useState(new Date())
  const prevIdsRef = useRef<Set<string>>(new Set())
  const newIdsRef = useRef<Set<string>>(new Set())

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchOrders = useCallback(async () => {
    const { data: sess } = await createClient().auth.getSession()
    const token = sess.session?.access_token

    if (!token) {
      setLoading(false)
      return
    }

    // Step 1: verify connection (backend falls back to first available record)
    try {
      const statusRes = await fetch(`${BACKEND}/ml/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        if (statusData?.seller_id) setConnected(true)
      }
    } catch { /* silent */ }

    // Step 2: fetch orders — 7-day window using Brazil time (UTC-3)
    try {
      const brazilNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const brazilToday = brazilNow.toISOString().slice(0, 10)
      brazilNow.setUTCDate(brazilNow.getUTCDate() - 7)
      const dateFrom = brazilNow.toISOString().slice(0, 10)

      console.log('[vendas-ao-vivo] data hoje GMT-3:', brazilToday)
      console.log('[vendas-ao-vivo] date_from enviado:', dateFrom)

      const res = await fetch(
        `${BACKEND}/ml/recent-orders?date_from=${dateFrom}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (res.ok) {
        const json = await res.json()
        const next: Order[] = json.orders ?? []
        console.log('[vendas-ao-vivo] pedidos retornados:', next.length)
        console.log('[vendas-ao-vivo] pedidos hoje:', next.filter(o => o.date_created.slice(0, 10) === brazilToday).length)
        const nextIds = new Set(next.map((o: Order) => o.id))
        newIdsRef.current = new Set([...nextIds].filter(id => !prevIdsRef.current.has(id) && prevIdsRef.current.size > 0))
        prevIdsRef.current = nextIds
        setOrders(next)
        setLastUpdated(new Date())
      }
    } catch { /* silent */ }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
    const t = setInterval(fetchOrders, REFRESH_MS)
    return () => clearInterval(t)
  }, [fetchOrders])

  // Derived data
  const today = todayStr()
  const yest = yestStr()
  const lw = lwStr()

  const todayM = useMemo(() => metricsFor(orders, today), [orders, today])
  const yestM = useMemo(() => metricsFor(orders, yest), [orders, yest])

  const todayHourly = useMemo(() => hourlyRevenue(orders, today), [orders, today])
  const yestHourly = useMemo(() => hourlyRevenue(orders, yest), [orders, yest])
  const lwHourly = useMemo(() => hourlyRevenue(orders, lw), [orders, lw])

  const hourlyData = useMemo(() => {
    const curH = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCHours()
    return Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}h`,
      hoje: h <= curH ? todayHourly[h] : null,
      ontem: yestHourly[h],
      semPassada: lwHourly[h],
      isCurrent: h === curH,
    }))
  }, [todayHourly, yestHourly, lwHourly, now])

  const products = useMemo(() => topProducts(orders, today), [orders, today])
  const heatGrid = useMemo(() => buildHeatMap(orders), [orders])
  const heatMax = useMemo(() => Math.max(...heatGrid.flat(), 0.01), [heatGrid])

  const recentFeed = useMemo(() => recentOrders(orders, 20), [orders])

  const sparkRevenue = useMemo(() => {
    const brazilH = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCHours()
    return todayHourly.slice(0, brazilH + 1)
  }, [todayHourly, now])

  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const minAgo = lastUpdated ? Math.round((now.getTime() - lastUpdated.getTime()) / 60_000) : null

  const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`)
  const DAYS = ['Dom -6', 'Seg -5', 'Ter -4', 'Qua -3', 'Qui -2', 'Sex -1', 'Hoje']

  if (!loading && !connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ background: '#09090b' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,229,255,0.08)' }}>
          <svg className="w-7 h-7" fill="none" stroke="#00E5FF" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="text-white font-semibold">Mercado Livre não conectado</p>
        <p className="text-zinc-500 text-sm">Conecte sua conta em Integrações para ver as vendas ao vivo.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#09090b' }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-6 pb-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #09090b 0%, #0d1117 50%, #09090b 100%)', borderBottom: '1px solid #1e1e24' }}>
        {/* glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(0,229,255,0.06) 0%, transparent 70%)' }} />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* left */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white text-xl font-bold tracking-tight">Vendas ao Vivo</h1>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00E5FF' }} />
                Ao vivo
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: '#ffe600', color: '#333' }}>ML</span>
            </div>
            <p className="text-zinc-500 text-[12px] capitalize">{dateLabel} · {timeStr}</p>
            {minAgo !== null && (
              <p className="text-zinc-600 text-[11px] mt-0.5">
                Atualizado há {minAgo < 1 ? 'menos de 1 min' : `${minAgo} min`}
              </p>
            )}
          </div>

          {/* center — revenue hero */}
          <div className="text-center">
            <p className="text-zinc-500 text-[11px] uppercase tracking-widest mb-1">Faturamento de hoje</p>
            {loading ? (
              <div className="h-10 w-48 rounded-lg animate-pulse mx-auto" style={{ background: '#1e1e24' }} />
            ) : (
              <p className="text-4xl font-black tracking-tight leading-none" style={{ color: '#00E5FF' }}>
                {brl(todayM.revenue)}
              </p>
            )}
            {!loading && (
              <div className="flex items-center justify-center gap-2 mt-2">
                {(() => {
                  const delta = pct(todayM.revenue, yestM.revenue)
                  if (delta === null) return <p className="text-zinc-600 text-[11px]">Sem dados de ontem</p>
                  const up = delta >= 0
                  return (
                    <span className="text-[12px] font-bold px-2 py-0.5 rounded-md"
                      style={{ background: up ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: up ? '#34d399' : '#f87171' }}>
                      {up ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% vs ontem
                    </span>
                  )
                })()}
              </div>
            )}
          </div>

          {/* right — refresh */}
          <div className="flex flex-col items-end gap-2">
            <button onClick={() => fetchOrders()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all active:scale-[0.97]"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-6 space-y-6">

        {/* LINHA 1 — 6 metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {loading ? [...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl p-4 animate-pulse h-24" style={{ background: '#111114' }} />
          )) : [
            {
              label: 'Faturamento hoje',
              value: brl(todayM.revenue),
              change: pct(todayM.revenue, yestM.revenue),
              color: '#00E5FF',
              sparkData: sparkRevenue,
            },
            {
              label: 'Pedidos hoje',
              value: String(todayM.count),
              sub: 'pagos',
              change: pct(todayM.count, yestM.count),
              color: '#34d399',
              sparkData: sparkRevenue.map((_, i) => orders.filter(o => isPaid(o) && orderBrazilDate(o.date_created) === today && brazilHour(o.date_created) === i).length),
            },
            {
              label: 'Unidades vendidas',
              value: String(todayM.units),
              sub: 'itens',
              change: pct(todayM.units, yestM.units),
              color: '#a78bfa',
              sparkData: sparkRevenue,
            },
            {
              label: 'Ticket médio',
              value: brl(todayM.avgTicket),
              change: pct(todayM.avgTicket, yestM.avgTicket),
              color: '#fb923c',
              sparkData: sparkRevenue,
            },
            {
              label: 'Taxa conversão',
              value: '—',
              sub: 'requer visitas',
              change: null,
              color: '#60a5fa',
              sparkData: [0],
            },
            {
              label: 'Compradores únicos',
              value: String(new Set(recentFeed.filter(o => isPaid(o) && orderBrazilDate(o.date_created) === today).map(o => o.id)).size),
              sub: 'estimativa',
              change: null,
              color: '#f87171',
              sparkData: sparkRevenue,
            },
          ].map(m => (
            <MetricCard key={m.label} label={m.label} value={m.value} sub={m.sub}
              change={m.change} sparkData={m.sparkData} color={m.color} />
          ))}
        </div>

        {/* LINHA 2 — Hourly chart */}
        <div className="rounded-2xl px-6 py-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white text-sm font-semibold">Faturamento por hora</p>
              <p className="text-zinc-500 text-xs mt-0.5">Hoje vs ontem vs semana passada</p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              {[{ color: '#00E5FF', label: 'Hoje' }, { color: '#3f3f46', label: 'Ontem' }, { color: '#fb923c', label: 'Sem. passada' }].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5" style={{ color: '#71717a' }}>
                  <span className="w-4 h-0.5 inline-block rounded" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourlyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradHoje" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1a1a1e" strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: '#52525b', fontSize: 10 }} tickFormatter={v => `R$${(v as number / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<HourTip />} />
              <ReferenceLine x={`${String(new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCHours()).padStart(2, '0')}h`} stroke="#00E5FF" strokeOpacity={0.3} strokeDasharray="4 3" />
              <Area type="monotone" dataKey="hoje" stroke="#00E5FF" strokeWidth={2} fill="url(#gradHoje)" name="Hoje" connectNulls dot={false} />
              <Line type="monotone" dataKey="ontem" stroke="#3f3f46" strokeWidth={1.5} name="Ontem" dot={false} strokeDasharray="5 3" />
              <Line type="monotone" dataKey="semPassada" stroke="#fb923c" strokeWidth={1.5} name="Sem. passada" dot={false} strokeDasharray="3 3" strokeOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* LINHA 3 — Conversion Funnel */}
        <div className="rounded-2xl px-6 py-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white text-sm font-semibold">Funil de Conversão</p>
              <p className="text-zinc-500 text-xs mt-0.5">Baseado nos pedidos disponíveis</p>
            </div>
          </div>
          <div className="space-y-2.5 max-w-2xl">
            {(() => {
              const totalOrders = orders.filter(o => orderBrazilDate(o.date_created) === today).length
              const paidCount = todayM.count
              const funnel = [
                { label: 'Visitas estimadas', value: Math.max(paidCount * 12, 0), color: '#60a5fa' },
                { label: 'Visualizações produto', value: Math.max(paidCount * 8, 0), color: '#a78bfa' },
                { label: 'Intenções (carrinho)', value: Math.max(paidCount * 3, 0), color: '#fb923c' },
                { label: 'Pedidos realizados', value: totalOrders, color: '#f59e0b' },
                { label: 'Pedidos pagos', value: paidCount, color: '#34d399' },
              ]
              const top = funnel[0].value
              return funnel.map((f, i) => (
                <div key={f.label}>
                  <FunnelBar label={f.label} value={f.value} total={top} color={f.color} />
                  {i < funnel.length - 1 && (
                    <div className="flex items-center gap-3 py-0.5">
                      <div className="w-32 shrink-0" />
                      <span className="text-zinc-700 text-[10px] pl-2">
                        {funnel[i].value > 0 ? `${((funnel[i + 1].value / funnel[i].value) * 100).toFixed(0)}% avançam` : '—'}
                      </span>
                    </div>
                  )}
                </div>
              ))
            })()}
          </div>
          <p className="text-zinc-700 text-[10px] mt-4">* Visitas e intenções são estimativas. Conecte a API de Analytics do ML para dados reais.</p>
        </div>

        {/* LINHA 3.5 — Brazil Sales Map */}
        {console.log('[MAP DEBUG] vendas-ao-vivo orders total:', orders?.length, 'hoje:', orders?.filter(o => o.date_created?.slice(0, 10) === today)?.length, 'shipping_state[0]:', orders?.[0]?.shipping_state) as unknown as null}
        <BrazilSalesMap
          orders={orders.filter(o => orderBrazilDate(o.date_created) === today)}
          title="Mapa de Vendas do Dia"
          height={400}
          realtime={true}
          newOrderIds={newIdsRef.current}
        />

        {/* LINHA 4 — Top products + Recent orders */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Top 10 Products */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24', background: '#0d0d10' }}>
              <p className="text-white text-sm font-semibold">Top Produtos do Dia</p>
              <span className="text-zinc-500 text-xs">{products.length} produtos</span>
            </div>
            <div className="divide-y" style={{ borderColor: '#1e1e24' }}>
              {loading ? [...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                  <div className="w-7 h-7 rounded" style={{ background: '#1e1e24' }} />
                  <div className="flex-1 h-3 rounded" style={{ background: '#1e1e24' }} />
                  <div className="w-16 h-3 rounded" style={{ background: '#1e1e24' }} />
                </div>
              )) : products.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-zinc-600 text-sm">Sem vendas hoje ainda.</p>
                </div>
              ) : products.map((p, idx) => {
                const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
                const hot = p.lastSold > twoHoursAgo
                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3 transition-colors"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {/* rank */}
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: idx < 3 ? 'rgba(0,229,255,0.15)' : '#1c1c1f', color: idx < 3 ? '#00E5FF' : '#52525b', fontSize: 9, fontWeight: 800 }}>
                      {idx + 1}
                    </div>
                    {/* name */}
                    <p className="flex-1 text-white text-[12px] font-medium truncate min-w-0">{p.title}</p>
                    {/* badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hot && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>🔥</span>}
                      {/* low stock badge would need stock data */}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white text-[12px] font-bold">{brl(p.revenue)}</p>
                      <p className="text-zinc-600 text-[10px]">{p.units} un.</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent Orders Feed */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24', background: '#0d0d10' }}>
              <p className="text-white text-sm font-semibold">Pedidos Recentes</p>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: '#ffe600', color: '#333' }}>ML</span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
              {loading ? [...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse" style={{ borderBottom: '1px solid #1e1e24' }}>
                  <div className="w-10 h-3 rounded" style={{ background: '#1e1e24' }} />
                  <div className="flex-1 h-3 rounded" style={{ background: '#1e1e24' }} />
                  <div className="w-16 h-3 rounded" style={{ background: '#1e1e24' }} />
                </div>
              )) : recentFeed.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-zinc-600 text-sm">Nenhum pedido recente.</p>
                </div>
              ) : recentFeed.map((o) => {
                const isNew = newIdsRef.current.has(o.id)
                const d = new Date(o.date_created)
                const timeLabel = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                const firstItem = o.items?.[0]?.title ?? '—'
                return (
                  <div key={o.id}
                    className="flex items-center gap-3 px-5 py-3 transition-all"
                    style={{
                      borderBottom: '1px solid #1e1e24',
                      background: isNew ? 'rgba(0,229,255,0.04)' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = isNew ? 'rgba(0,229,255,0.04)' : 'transparent')}>
                    <span className="text-zinc-500 text-[11px] font-mono shrink-0 w-12">{timeLabel}</span>
                    <p className="flex-1 text-zinc-300 text-[12px] truncate min-w-0">{firstItem}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-bold ${isPaid(o) ? '' : 'text-zinc-600'}`}
                        style={{ color: isPaid(o) ? '#34d399' : undefined }}>
                        {brl(o.total_amount ?? 0)}
                      </span>
                      <span className="text-[9px] px-1 py-0.5 rounded font-semibold"
                        style={{ background: isPaid(o) ? 'rgba(52,211,153,0.1)' : 'rgba(113,113,122,0.15)', color: isPaid(o) ? '#34d399' : '#71717a' }}>
                        {o.status === 'paid' ? 'Pago' : o.status === 'cancelled' ? 'Cancel.' : 'Pend.'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* LINHA 5 — Heat Map */}
        <div className="rounded-2xl px-6 py-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white text-sm font-semibold">Mapa de Calor — Vendas por Horário</p>
              <p className="text-zinc-500 text-xs mt-0.5">Últimos 7 dias · intensidade = faturamento</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <span>Baixo</span>
              <div className="flex gap-0.5">
                {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
                  <div key={v} style={{ width: 16, height: 12, borderRadius: 2, background: `rgba(0,229,255,${0.08 + v * 0.72})` }} />
                ))}
              </div>
              <span>Alto</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 700 }}>
              {/* Hour labels */}
              <div className="flex gap-0.5 mb-1.5 ml-14">
                {HOURS.filter((_, i) => i % 3 === 0).map(h => (
                  <div key={h} style={{ width: 28 * 3 + 2, flexShrink: 0 }}>
                    <span className="text-[9px] text-zinc-600">{h}</span>
                  </div>
                ))}
              </div>
              {/* Rows */}
              {heatGrid.map((row, dayIdx) => (
                <div key={dayIdx} className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-zinc-600 w-14 shrink-0 text-right pr-2">{DAYS[dayIdx]}</span>
                  <div className="flex gap-0.5">
                    {row.map((val, h) => (
                      <HeatCell key={h} value={val} max={heatMax} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
