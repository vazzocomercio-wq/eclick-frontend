// force-deploy-v3
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useTodayOrders } from '@/hooks/useTodayOrders'
import HubSummaryCard from '@/components/inteligencia/HubSummaryCard'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

const BrazilSalesMap = dynamic(() => import('@/components/BrazilSalesMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[350px] bg-[#111114] rounded-xl animate-pulse flex items-center justify-center">
      <span className="text-gray-400 text-sm">Carregando mapa...</span>
    </div>
  ),
})

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── types ─────────────────────────────────────────────────────────────────────

type Order = {
  id: string
  status: string
  date_created: string
  total_amount: number
  contribution_margin?: number
  items: Array<{ item_id: string; title: string; quantity: number; unit_price: number }>
  shipping_state?: string | null
  shipping_city?: string | null
}

type DBProduct = {
  id: string
  name: string
  price: number | null
  stock: number | null
  status: 'active' | 'paused' | 'draft'
  platforms: string[] | null
}

type ProdutoCusto = {
  id: string
  sku: string | null
  ml_listing_id: string | null
  cost_price: number | null
  tax_percentage: number | null
  quantity_per_unit: number
}

type Period = 'today' | '7d' | '30d' | 'month'
type Channel = 'all' | 'ml' | 'shopee' | 'amazon' | 'magalu'

type SellerInfo = {
  power_seller_status: string | null
  level_id: string | null
  points: number | null
}

// ── helpers ───────────────────────────────────────────────────────────────────

function brl(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function shortBrl(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`
  return brl(v)
}

function pct(a: number, b: number): number | null {
  if (!b) return null
  return ((a - b) / b) * 100
}

// GMT-3 (Brasil)
function brazilDate(d: Date = new Date()) { return new Date(d.getTime() - 3 * 60 * 60 * 1000) }
function brazilDateStr(d: Date = new Date()) { return brazilDate(d).toISOString().slice(0, 10) }
function todayBR() { return brazilDateStr() }
function thisMonthBR() { return brazilDateStr().slice(0, 7) }
function daysAgoDate(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d }
function dayStr(d: Date) { return d.toISOString().slice(0, 10) }

function isPaid(o: Order) { return o.status === 'paid' }

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function Skel({ h = 16, className = '' }: { h?: number; className?: string }) {
  return <div className={`rounded-lg animate-pulse ${className}`} style={{ height: h, background: '#1e1e24' }} />
}

// ── derived calc ──────────────────────────────────────────────────────────────

function calcMetrics(orders: Order[]) {
  const paid = orders.filter(isPaid)
  const revenue = paid.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const count = paid.length
  const units = paid.reduce((s, o) => s + (o.items ?? []).reduce((ss, i) => ss + (i.quantity ?? 0), 0), 0)
  const avgTicket = count ? revenue / count : 0
  return { revenue, count, units, avgTicket }
}

function calcMetricsAll(orders: Order[]) {
  const revenue = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const count = orders.length
  const units = orders.reduce((s, o) => s + (o.items ?? []).reduce((ss, i) => ss + (i.quantity ?? 0), 0), 0)
  const avgTicket = count ? revenue / count : 0
  return { revenue, count, units, avgTicket }
}

function getPeriodDates(period: Period): { from: string; to: string } {
  const now = brazilDate()
  const today = now.toISOString().slice(0, 10)
  if (period === 'today') return { from: today, to: today }
  if (period === '7d') {
    const from = new Date(now); from.setDate(from.getDate() - 7)
    return { from: from.toISOString().slice(0, 10), to: today }
  }
  if (period === '30d') {
    const from = new Date(now); from.setDate(from.getDate() - 30)
    return { from: from.toISOString().slice(0, 10), to: today }
  }
  // month
  return { from: `${today.substring(0, 7)}-01`, to: today }
}

function getPreviousPeriodDates(period: Period): { from: string; to: string } | null {
  const now = brazilDate()
  if (period === 'today') {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    const ys = y.toISOString().slice(0, 10)
    return { from: ys, to: ys }
  }
  if (period === '7d') {
    const to = new Date(now); to.setDate(to.getDate() - 7)
    const from = new Date(now); from.setDate(from.getDate() - 14)
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
  }
  if (period === '30d') {
    const to = new Date(now); to.setDate(to.getDate() - 30)
    const from = new Date(now); from.setDate(from.getDate() - 60)
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
  }
  // month → previous calendar month
  const lastDay = new Date(now); lastDay.setDate(0)
  const lms = lastDay.toISOString().slice(0, 10)
  return { from: `${lms.substring(0, 7)}-01`, to: lms }
}

function filterByPeriod(orders: Order[], period: Period) {
  if (period === 'today') {
    const ds = todayBR()
    return orders.filter(o => brazilDateStr(new Date(o.date_created)) === ds)
  }
  if (period === '7d') {
    const from = daysAgoDate(7)
    return orders.filter(o => new Date(o.date_created) >= from)
  }
  if (period === 'month') {
    const ym = thisMonthBR()
    return orders.filter(o => brazilDateStr(new Date(o.date_created)).slice(0, 7) === ym)
  }
  const from = daysAgoDate(30)
  return orders.filter(o => new Date(o.date_created) >= from)
}

function buildDailyChart(orders: Order[], days: number) {
  const map = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    map.set(brazilDateStr(daysAgoDate(i)), 0)
  }
  for (const o of orders) {
    const ds = brazilDateStr(new Date(o.date_created))
    if (map.has(ds)) map.set(ds, (map.get(ds) ?? 0) + (o.total_amount ?? 0))
  }
  return [...map.entries()].map(([date, value]) => ({
    date: date.slice(5).replace('-', '/'),
    value,
  }))
}

function topProductsFromOrders(orders: Order[]) {
  const map = new Map<string, { title: string; units: number; revenue: number; orders: number }>()
  for (const o of orders) {
    if (!isPaid(o)) continue
    for (const item of (o.items ?? [])) {
      const key = item.item_id ?? item.title
      const ex = map.get(key)
      if (ex) { ex.units += item.quantity ?? 0; ex.revenue += (item.unit_price ?? 0) * (item.quantity ?? 1); ex.orders++ }
      else map.set(key, { title: item.title ?? '—', units: item.quantity ?? 0, revenue: (item.unit_price ?? 0) * (item.quantity ?? 1), orders: 1 })
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
}

// ── Row 1: Header / Filters ───────────────────────────────────────────────────

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'today', label: 'Hoje' },
  { key: '7d',    label: '7 dias' },
  { key: '30d',   label: '30 dias' },
  { key: 'month', label: 'Mês atual' },
]

const CHANNELS: Array<{ key: Channel; label: string; color: string }> = [
  { key: 'all',    label: 'Todos',   color: '#00E5FF' },
  { key: 'ml',     label: 'ML',      color: '#ffe600' },
  { key: 'shopee', label: 'Shopee',  color: '#EE4D2D' },
  { key: 'amazon', label: 'Amazon',  color: '#FF9900' },
  { key: 'magalu', label: 'Magalu',  color: '#0086FF' },
]

function DashHeader({ period, setPeriod, channel, setChannel, onRefresh, refreshing, lastUpdated }: {
  period: Period; setPeriod: (p: Period) => void
  channel: Channel; setChannel: (c: Channel) => void
  onRefresh: () => void; refreshing: boolean; lastUpdated: Date | null
}) {
  const minAgo = lastUpdated ? Math.round((Date.now() - lastUpdated.getTime()) / 60_000) : null
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period pills */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all"
            style={{ background: period === p.key ? 'rgba(0,229,255,0.12)' : 'transparent', color: period === p.key ? '#00E5FF' : '#a1a1aa' }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Channel pills */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        {CHANNELS.map(c => (
          <button key={c.key} onClick={() => setChannel(c.key)}
            className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all"
            style={{ background: channel === c.key ? `${c.color}18` : 'transparent', color: channel === c.key ? c.color : '#a1a1aa' }}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {minAgo !== null && (
          <span className="text-zinc-600 text-[11px]">
            Atualizado há {minAgo < 1 ? 'menos de 1 min' : `${minAgo} min`}
          </span>
        )}
        <button onClick={onRefresh} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          {refreshing
            ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          }
          Atualizar dados
        </button>
      </div>
    </div>
  )
}

// ── Row 2: KPI Cards ──────────────────────────────────────────────────────────

function KpiCard({ label, value, vsYest, vsWeek, sub, color = '#00E5FF', loading, comparison }: {
  label: string; value: string; vsYest?: number | null; vsWeek?: number | null
  sub?: string; color?: string; loading: boolean
  comparison?: { prevValue: number; prevLabel: string; curRaw: number }
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2.5 transition-all"
      style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}28` }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)' }}>
      <p className="text-zinc-400 text-[11px] font-medium leading-tight">{label}</p>
      {loading ? (
        <div className="space-y-2"><Skel h={28} className="w-3/4" /><Skel h={12} className="w-1/2" /></div>
      ) : (
        <>
          <p className="text-white text-xl font-bold leading-none tracking-tight">{value}</p>
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {vsYest != null && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: vsYest >= 0 ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: vsYest >= 0 ? '#34d399' : '#f87171' }}>
                {vsYest >= 0 ? '↑' : '↓'} {Math.abs(vsYest).toFixed(1)}% ontem
              </span>
            )}
            {vsWeek != null && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: vsWeek >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', color: vsWeek >= 0 ? '#34d399' : '#f87171' }}>
                {vsWeek >= 0 ? '↑' : '↓'} {Math.abs(vsWeek).toFixed(1)}% sem.
              </span>
            )}
            {sub && <span className="text-zinc-600 text-[10px]">{sub}</span>}
          </div>
          {comparison && (
            <div className="mt-0.5 pt-2.5 border-t border-[#ffffff10]">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-gray-400">{comparison.prevLabel}</span>
                <span className="text-[10px] text-gray-400 font-medium">{brl(comparison.prevValue)}</span>
              </div>
              {(() => {
                const diff = comparison.curRaw - comparison.prevValue
                if (comparison.prevValue === 0) return (
                  <span className="text-[10px] text-gray-400">sem dado anterior</span>
                )
                const pctChange = (diff / comparison.prevValue) * 100
                const isUp = diff >= 0
                return (
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-semibold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                      {isUp ? '↑' : '↓'} {Math.abs(pctChange).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-gray-400">
                      ({isUp ? '+' : ''}{shortBrl(diff)})
                    </span>
                  </div>
                )
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Row 2b: Reputação ML — termômetro estilo ML ────────────────────────────────
//
// Substitui o texto "5_green" por um indicador visual de 5 barras coloridas,
// igual ao termômetro de reputação que aparece no painel do vendedor no ML.
// Cores seguem a paleta oficial: vermelho → laranja → amarelo → verde-claro → verde.

const ML_LEVEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'] as const
const ML_LEVEL_LABELS = ['Iniciante', 'Em construção', 'Razoável', 'Bom', 'Excelente'] as const

function parseMlLevel(levelId: string | null | undefined): { level: number } | null {
  if (!levelId) return null
  // Formato esperado: "5_green", "4_light_green", "3_yellow", "2_orange", "1_red"
  const m = levelId.match(/^([1-5])_/)
  if (!m) return null
  return { level: parseInt(m[1], 10) }
}

function ReputacaoMlCard({ sellerInfo, mlConnected, loading }: {
  sellerInfo: SellerInfo | null
  mlConnected: boolean
  loading: boolean
}) {
  const parsed = parseMlLevel(sellerInfo?.level_id)
  const level = parsed?.level ?? 0
  const color = level > 0 ? ML_LEVEL_COLORS[level - 1] : '#71717a'
  const label = level > 0 ? ML_LEVEL_LABELS[level - 1] : (mlConnected ? '—' : 'Desconectado')
  const status = sellerInfo?.power_seller_status
  const points = sellerInfo?.points ?? null

  return (
    <div className="rounded-xl p-4 flex flex-col gap-2.5 transition-all"
      style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.06)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}28` }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)' }}>
      <p className="text-zinc-400 text-[11px] font-medium leading-tight">Reputação ML</p>
      {loading ? (
        <div className="space-y-2"><Skel h={28} className="w-3/4" /><Skel h={12} className="w-1/2" /></div>
      ) : (
        <>
          {/* Termômetro: 5 barras (preenchidas até o nível atual) */}
          <div className="flex gap-0.5 mt-0.5" aria-label={`Nível ${level} de 5`}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-2 flex-1 rounded-sm transition-all"
                style={{
                  background: i <= level ? color : '#27272a',
                  boxShadow: i === level && level > 0 ? `0 0 6px ${color}66` : undefined,
                  opacity: i <= level ? 1 : 0.5,
                }} />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-white text-base font-bold leading-none tracking-tight truncate">
              {label}
            </p>
            {status && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                style={{ background: `${color}20`, color }}>
                {status}
              </span>
            )}
          </div>
          <span className="text-zinc-600 text-[10px]">
            {level > 0
              ? `Nível ${level} de 5${points ? ` · ${points.toLocaleString('pt-BR')} transações` : ''}`
              : (mlConnected ? 'Aguardando dados' : 'ML desconect.')}
          </span>
        </>
      )}
    </div>
  )
}

// ── Row 3: Alert Semaphores ────────────────────────────────────────────────────

type AlertLevel = 'red' | 'yellow' | 'green'

function alertColor(level: AlertLevel) {
  return level === 'red' ? '#f87171' : level === 'yellow' ? '#f59e0b' : '#34d399'
}
function alertBg(level: AlertLevel) {
  return level === 'red' ? 'rgba(248,113,113,0.08)' : level === 'yellow' ? 'rgba(245,158,11,0.08)' : 'rgba(52,211,153,0.08)'
}
function alertBorder(level: AlertLevel) {
  return level === 'red' ? 'rgba(248,113,113,0.25)' : level === 'yellow' ? 'rgba(245,158,11,0.25)' : 'rgba(52,211,153,0.2)'
}

function AlertCard({ label, value, level, href, loading }: {
  label: string; value: string | number; level: AlertLevel; href?: string; loading: boolean
}) {
  const color = alertColor(level)
  const bg = alertBg(level)
  const border = alertBorder(level)
  const inner = loading ? (
    <div className="space-y-2"><Skel h={24} className="w-1/2" /><Skel h={12} className="w-3/4" /></div>
  ) : (
    <>
      <p className="text-xl font-black leading-none" style={{ color }}>{value}</p>
      <p className="text-[11px] font-medium mt-0.5" style={{ color: '#a1a1aa' }}>{label}</p>
    </>
  )
  const card = (
    <div className="rounded-xl p-4 flex flex-col gap-1 transition-all"
      style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {href && <svg className="w-3 h-3" style={{ color: '#52525b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>}
      </div>
      {inner}
    </div>
  )
  return href ? <Link href={href}>{card}</Link> : card
}

// ── Row 4: Sales Chart tooltip ────────────────────────────────────────────────

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#18181b', border: '1px solid #2e2e33', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#a1a1aa', fontSize: 10, marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#00E5FF', fontSize: 13, fontWeight: 700 }}>{brl(payload[0].value)}</p>
    </div>
  )
}

// ── Row 5: Funnel ─────────────────────────────────────────────────────────────

function FunnelStep({ label, value, pctVal, color, isBottleneck }: {
  label: string; value: number; pctVal: number; color: string; isBottleneck: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-[11px] text-zinc-400 w-28 shrink-0 truncate">{label}</p>
      <div className="flex-1 h-4 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full rounded-full transition-all duration-700 relative"
          style={{ width: `${pctVal}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }}>
          {isBottleneck && (
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-black" style={{ color: '#000' }}>!</span>
          )}
        </div>
      </div>
      <p className="text-[11px] font-bold text-white w-16 text-right shrink-0">{value.toLocaleString('pt-BR')}</p>
      <p className="text-zinc-600 text-[10px] w-10 text-right shrink-0">{pctVal.toFixed(0)}%</p>
    </div>
  )
}

// ── Row 6: Sector grid card ────────────────────────────────────────────────────

function SectorCard({ title, icon, items, loading }: {
  title: string; icon: React.ReactNode
  items: Array<{ label: string; value: string | number; color?: string }>
  loading: boolean
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: '#00E5FF' }}>{icon}</span>
        <p className="text-white text-[12px] font-semibold">{title}</p>
      </div>
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skel key={i} h={12} />)}</div>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-zinc-500 text-[11px]">{item.label}</span>
              <span className="text-[12px] font-semibold" style={{ color: item.color ?? '#fff' }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Row 8: Channel table ──────────────────────────────────────────────────────

const CHANNEL_META: Record<string, { label: string; color: string; bg: string }> = {
  ml:     { label: 'Mercado Livre', color: '#333', bg: '#ffe600' },
  shopee: { label: 'Shopee',        color: '#fff', bg: '#EE4D2D' },
  amazon: { label: 'Amazon',        color: '#111', bg: '#FF9900' },
  magalu: { label: 'Magalu',        color: '#fff', bg: '#0086FF' },
}

const MAP_PERIOD_LABELS: Record<Period, string> = {
  today: 'Vendas por Região — Hoje',
  '7d':  'Vendas por Região — Últimos 7 dias',
  '30d': 'Vendas por Região — Últimos 30 dias',
  month: 'Vendas por Região — Mês Atual',
}

const PERIOD_LABEL: Record<Period, string> = {
  today: 'Hoje',
  '7d':  '7 dias',
  '30d': '30 dias',
  month: 'Mês atual',
}

const PREV_PERIOD_LABEL: Record<Period, string> = {
  today: 'Ontem',
  '7d':  '7 dias anteriores',
  '30d': '30 dias anteriores',
  month: 'Mês passado',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('today')
  const [channel] = useState<Channel>('all')
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<DBProduct[]>([])
  const [questions, setQuestions] = useState(0)
  const [claims, setClaims] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [mlConnected, setMlConnected] = useState(false)
  const [sellerInfo, setSellerInfo] = useState<SellerInfo | null>(null)
  const [mlItemsTotal, setMlItemsTotal] = useState<number | null>(null)
  const [aboveConcPrice, setAboveConcPrice] = useState(0)
  const [finKpis, setFinKpis] = useState<{ vendas_aprovadas: number; margem_pct: number; margem_contrib: number } | null>(null)
  const [periodOrders, setPeriodOrders] = useState<Order[]>([])
  const [periodLoading, setPeriodLoading] = useState(false)
  const [prevData, setPrevData] = useState<{ faturamento: number; lucro: number } | null>(null)
  const [financialSummary, setFinancialSummary] = useState<{ total_revenue: number; total_orders: number; ml_total: number; average_ticket: number } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [produtos, setProdutos] = useState<ProdutoCusto[]>([])
  // Ads (mês atual) — investimento mídia + ROAS / ROI
  const [adsSummary, setAdsSummary] = useState<{ spend: number; roas: number; clicks: number; revenue: number } | null>(null)
  // Conversas abertas (proxy de "mensagens não lidas" enquanto não há endpoint dedicado)
  const [openConvs, setOpenConvs] = useState<number>(0)
  // Claims (lista) — usado pra derivar "mediações" (claims antigos = escalados)
  const [claimsList, setClaimsList] = useState<Array<{ created_date?: string; date_created?: string }>>([])

  const supabase = useMemo(() => createClient(), [])

  // Shared hook: today's revenue/count without any status filter (same as Vendas ao Vivo)
  const { faturamento: hookTodayRevenue, pedidos: hookTodayCount, loading: hookTodayLoading } = useTodayOrders()

  const refresh = useCallback(async (isInitial = false) => {
    if (!isInitial) setRefreshing(true)
    try {
    const token = await getToken()
    const supabase = createClient()

    console.log('[Dashboard] BACKEND_URL:', BACKEND)
    console.log('[Dashboard] token:', token ? `${token.slice(0, 20)}…` : 'NULL — ML fetches serão pulados')

    // Supabase products + competitors
    let loadedProducts: DBProduct[] = []
    const { data: member } = await supabase.from('organization_members').select('organization_id').maybeSingle()
    console.log('[Dashboard] orgId (Supabase):', member?.organization_id ?? 'null')
    if (member?.organization_id) {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, price, stock, status, platforms')
        .eq('organization_id', member.organization_id)
        .limit(200)
      loadedProducts = prods ?? []
      setProducts(loadedProducts)
      console.log('[Dashboard] produtos DB:', loadedProducts.length)

      if (loadedProducts.length > 0) {
        const { data: comps } = await supabase
          .from('competitors')
          .select('product_id, price')
          .in('product_id', loadedProducts.map(p => p.id))
        if (comps && comps.length > 0) {
          const minPrice = new Map<string, number>()
          for (const c of comps) {
            const cur = minPrice.get(c.product_id)
            if (cur === undefined || c.price < cur) minPrice.set(c.product_id, c.price)
          }
          const above = loadedProducts.filter(p =>
            p.price != null && minPrice.has(p.id) && p.price > (minPrice.get(p.id) ?? Infinity)
          )
          setAboveConcPrice(above.length)
        }
      }
    }

    if (!token) {
      console.warn('[Dashboard] Sem token — verifique se o usuário está logado e a sessão Supabase está ativa')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    // Range pra Ads — mês atual em YYYY-MM-DD
    const monthStartStr = brazilDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    const todayStr = brazilDateStr()
    const [ordersRes, questionsRes, claimsRes, sellerRes, myItemsRes, finRes, adsRes, convsRes] = await Promise.allSettled([
      fetch(`${BACKEND}/ml/recent-orders?limit=200`,  { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${BACKEND}/ml/questions`,                 { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${BACKEND}/ml/claims`,                    { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${BACKEND}/ml/seller-info`,               { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${BACKEND}/ml/my-items?limit=1`,          { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${BACKEND}/ml/financial-summary?kpis_only=true&date_from=${encodeURIComponent(monthStart)}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${BACKEND}/ml-ads/reports/summary?from=${monthStartStr}&to=${todayStr}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${BACKEND}/atendente-ia/conversations?status=open`, { headers: { Authorization: `Bearer ${token}` } }),
    ])

    console.log('[Dashboard] recent-orders:', ordersRes.status === 'fulfilled' ? ordersRes.value.status : `REJECTED(${(ordersRes as PromiseRejectedResult).reason})`)
    console.log('[Dashboard] questions:', questionsRes.status === 'fulfilled' ? questionsRes.value.status : `REJECTED`)
    console.log('[Dashboard] claims:', claimsRes.status === 'fulfilled' ? claimsRes.value.status : `REJECTED`)
    console.log('[Dashboard] seller-info:', sellerRes.status === 'fulfilled' ? sellerRes.value.status : `REJECTED`)
    console.log('[Dashboard] my-items:', myItemsRes.status === 'fulfilled' ? myItemsRes.value.status : `REJECTED`)

    if (ordersRes.status === 'fulfilled') {
      if (ordersRes.value.ok) {
        try {
          const json = await ordersRes.value.json()
          console.log('[Dashboard] orders data:', JSON.stringify(json).slice(0, 300))
          setOrders(json.orders ?? [])
          setMlConnected(true)
        } catch { console.error('[Dashboard] orders JSON parse error') }
      } else {
        const txt = await ordersRes.value.text().catch(() => '')
        console.error('[Dashboard] orders error body:', txt.slice(0, 300))
      }
    }
    if (questionsRes.status === 'fulfilled' && questionsRes.value.ok) {
      try {
        const data = await questionsRes.value.json()
        setQuestions(data?.total ?? 0)
      } catch { /* non-fatal */ }
    }
    if (claimsRes.status === 'fulfilled' && claimsRes.value.ok) {
      try {
        const data = await claimsRes.value.json()
        const arr = Array.isArray(data?.data ?? data) ? (data?.data ?? data) : []
        setClaims(arr.length || (data?.total ?? 0))
        setClaimsList(arr)
      } catch { /* non-fatal */ }
    }
    if (adsRes.status === 'fulfilled' && adsRes.value.ok) {
      try {
        const data = await adsRes.value.json()
        const t = data?.totals
        if (t) setAdsSummary({
          spend:   Number(t.spend ?? 0),
          roas:    Number(t.roas ?? 0),
          clicks:  Number(t.clicks ?? 0),
          revenue: Number(t.revenue ?? 0),
        })
      } catch { /* non-fatal */ }
    }
    if (convsRes.status === 'fulfilled' && convsRes.value.ok) {
      try {
        const data = await convsRes.value.json()
        const arr = Array.isArray(data?.conversations) ? data.conversations
                  : Array.isArray(data) ? data : []
        setOpenConvs(arr.length)
      } catch { /* non-fatal */ }
    }
    if (sellerRes.status === 'fulfilled' && sellerRes.value.ok) {
      try {
        const data = await sellerRes.value.json()
        console.log('[Dashboard] seller-info data:', JSON.stringify(data).slice(0, 200))
        setSellerInfo({
          power_seller_status: data?.seller_reputation?.power_seller_status ?? data?.power_seller_status ?? null,
          level_id: data?.seller_reputation?.level_id ?? data?.level_id ?? null,
          points: data?.seller_reputation?.transactions?.period?.total ?? null,
        })
      } catch { /* non-fatal */ }
    }
    if (myItemsRes.status === 'fulfilled' && myItemsRes.value.ok) {
      try {
        const data = await myItemsRes.value.json()
        setMlItemsTotal(data?.total ?? null)
      } catch { /* non-fatal */ }
    }
    if (finRes.status === 'fulfilled' && finRes.value.ok) {
      try {
        const data = await finRes.value.json()
        const k = data?.kpis
        if (k) setFinKpis({ vendas_aprovadas: k.vendas_aprovadas ?? 0, margem_pct: k.margem_pct ?? 0, margem_contrib: k.margem_contribuicao ?? 0 })
      } catch { /* non-fatal */ }
    }

    } catch (err) {
      console.error('[Dashboard] refresh error:', err)
    } finally {
      setLastUpdated(new Date())
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { refresh(true) }, [refresh])

  useEffect(() => {
    supabase
      .from('product_listings')
      .select('listing_id, quantity_per_unit, product:products(id, sku, cost_price, tax_percentage)')
      .eq('is_active', true)
      .eq('platform', 'mercadolivre')
      .limit(5000)
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: ProdutoCusto[] = (data ?? []).map((v: any) => ({
          id:               v.product?.id ?? '',
          sku:              v.product?.sku ?? null,
          ml_listing_id:    v.listing_id,
          cost_price:       v.product?.cost_price ?? null,
          tax_percentage:   v.product?.tax_percentage ?? null,
          quantity_per_unit: Number(v.quantity_per_unit) || 1,
        })).filter(v => v.id)
        setProdutos(mapped)
        console.log('[dashboard] vínculos carregados:', mapped.length)
      })
  }, [supabase])

  useEffect(() => {
    const handleFocus = () => {
      supabase
        .from('product_listings')
        .select('listing_id, quantity_per_unit, product:products(id, sku, cost_price, tax_percentage)')
        .eq('is_active', true)
        .eq('platform', 'mercadolivre')
        .limit(5000)
        .then(({ data }) => {
          if (!data) return
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped: ProdutoCusto[] = (data ?? []).map((v: any) => ({
            id:               v.product?.id ?? '',
            sku:              v.product?.sku ?? null,
            ml_listing_id:    v.listing_id,
            cost_price:       v.product?.cost_price ?? null,
            tax_percentage:   v.product?.tax_percentage ?? null,
            quantity_per_unit: Number(v.quantity_per_unit) || 1,
          })).filter(v => v.id)
          setProdutos(mapped)
        })
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [supabase])

  // ── Period data (main) — current period orders ───────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setPeriodLoading(true)
      try {
        const token = await getToken()
        if (!token || cancelled) { if (!cancelled) setPeriodLoading(false); return }
        const { from, to } = getPeriodDates(period)
        const url = `${BACKEND}/ml/recent-orders?date_from=${from}&date_to=${to}&limit=200`
        console.log('[period-fetch] URL:', url)
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) {
          console.error('[period-fetch] HTTP error:', res.status)
          if (!cancelled) setPeriodLoading(false)
          return
        }
        const data = await res.json()
        const fetched: Order[] = data?.orders ?? data?.results ?? []
        console.log('[period-fetch] orders received:', fetched.length, '| period:', period)
        if (!cancelled) { setPeriodOrders(fetched); setPeriodLoading(false) }
      } catch (e) {
        console.error('[period-fetch] exception:', e)
        if (!cancelled) setPeriodLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [period])

  // ── Period data (prev) — previous period for comparison, independent ─────────
  useEffect(() => {
    let cancelled = false
    setPrevData(null)
    ;(async () => {
      try {
        const prevDates = getPreviousPeriodDates(period)
        if (!prevDates) return
        const token = await getToken()
        if (!token || cancelled) return
        const url = `${BACKEND}/ml/recent-orders?date_from=${prevDates.from}&date_to=${prevDates.to}&limit=200`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const prevOrders: Order[] = data?.orders ?? data?.results ?? []
        const prevFaturamento = prevOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
        const prevWithMargin  = prevOrders.filter(o => (o.contribution_margin ?? 0) > 0)
        const prevLucro = prevWithMargin.length > 0
          ? prevWithMargin.reduce((s, o) => s + (o.contribution_margin ?? 0), 0)
          : prevFaturamento * 0.885
        if (!cancelled) setPrevData({ faturamento: prevFaturamento, lucro: prevLucro })
      } catch (e) {
        console.error('[prev-fetch] exception:', e)
        if (!cancelled) setPrevData(null)
      }
    })()
    return () => { cancelled = true }
  }, [period])

  // ── Financial summary — exact totals from backend (all pages, no order list) ─
  useEffect(() => {
    let cancelled = false
    setFinancialSummary(null)
    setSummaryLoading(true)
    ;(async () => {
      try {
        const token = await getToken()
        if (!token || cancelled) { if (!cancelled) setSummaryLoading(false); return }
        const { from, to } = getPeriodDates(period)
        const url = `${BACKEND}/ml/financial-summary?totals_only=true&date_from=${from}&date_to=${to}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok || cancelled) { if (!cancelled) setSummaryLoading(false); return }
        const data = await res.json()
        if (!cancelled) { setFinancialSummary(data); setSummaryLoading(false) }
      } catch (e) {
        console.error('[summary-fetch] exception:', e)
        if (!cancelled) setSummaryLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [period])

  // ── Derived ──────────────────────────────────────────────────────────────────

  // For "Hoje" period use hook values (no status filter, identical to Vendas ao Vivo)
  const displayPedidos = period === 'today' ? hookTodayCount : (financialSummary?.total_orders ?? periodOrders.length)
  const displaySummaryLoading = period === 'today' ? hookTodayLoading : (summaryLoading || loading)

  // periodOrders is now a state (fetched from backend per period)
  const yestOrders   = useMemo(() => orders.filter(o => brazilDateStr(new Date(o.date_created)) === brazilDateStr(daysAgoDate(1))), [orders])

  const cur  = useMemo(() => calcMetrics(periodOrders), [periodOrders])

  const { faturamento, lucroEstimado, margemPct, pedidosComCusto, pedidosSemCusto } = useMemo(() => {
    const fat = period === 'today'
      ? hookTodayRevenue
      : (financialSummary?.total_revenue ?? periodOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0))

    if (periodOrders.length === 0) {
      return { faturamento: fat, lucroEstimado: fat * 0.885, margemPct: fat > 0 ? 88.5 : 0, pedidosComCusto: 0, pedidosSemCusto: 0 }
    }

    let custoTotal = 0
    let impostoTotal = 0
    let comCusto = 0
    let semCusto = 0

    for (const order of periodOrders) {
      const valorPago    = order.total_amount || 0
      const item         = order.items?.[0]
      const itemId       = item?.item_id ?? null
      const quantidade   = item?.quantity ?? 1
      const kitProdutos  = itemId ? produtos.filter(p => p.ml_listing_id === itemId) : []
      const taxPct       = Number(kitProdutos[0]?.tax_percentage || 0) / 100
      const kitCustoSum  = kitProdutos.reduce((s, p) => s + Number(p.cost_price || 0) * Number(p.quantity_per_unit || 1) * quantidade, 0)

      if (kitCustoSum > 0 || taxPct > 0) {
        comCusto++
        custoTotal   += kitCustoSum
        impostoTotal += valorPago * taxPct
      } else {
        semCusto++
        custoTotal   += valorPago * 0.75
      }
    }

    const lucro = fat - custoTotal - impostoTotal
    const margemP = fat > 0 ? (lucro / fat) * 100 : 0

    return {
      faturamento: fat,
      lucroEstimado: lucro,
      margemPct: margemP,
      pedidosComCusto: comCusto,
      pedidosSemCusto: semCusto,
    }
  }, [financialSummary, periodOrders, period, hookTodayRevenue, produtos])
  const yest = useMemo(() => calcMetrics(yestOrders), [yestOrders])
  const todayOrdersBR = useMemo(() => orders.filter(o => isPaid(o) && brazilDateStr(new Date(o.date_created)) === todayBR()), [orders])
  const todayM = useMemo(() => calcMetrics(todayOrdersBR), [todayOrdersBR])

  const chartDays = period === 'today' ? 1 : period === '7d' ? 7 : 30
  const chartData = useMemo(() => buildDailyChart(periodOrders, chartDays), [periodOrders, chartDays])

  // Chart-header KPIs — no status filter, consistent with faturamento source
  const curAll = useMemo(() => calcMetricsAll(periodOrders), [periodOrders])
  const chartPedidos = period === 'today' ? hookTodayCount : displayPedidos
  const chartAvgTicket = chartPedidos > 0 ? faturamento / chartPedidos : 0

  const topProds = useMemo(() => topProductsFromOrders(periodOrders), [periodOrders])

  const { topEstados, topCidades } = useMemo(() => {
    // Use exact financialSummary total as denominator so % reflects full period revenue
    const denominator = financialSummary?.total_revenue
      ?? periodOrders.filter(o => o.shipping_state).reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
    const stateMap: Record<string, { count: number; revenue: number }> = {}
    const cityMap:  Record<string, { count: number; revenue: number }> = {}
    for (const o of periodOrders) {
      if (o.shipping_state) {
        const uf = o.shipping_state.includes('-') ? o.shipping_state.split('-').pop()! : o.shipping_state
        if (!stateMap[uf]) stateMap[uf] = { count: 0, revenue: 0 }
        stateMap[uf].count += 1
        stateMap[uf].revenue += o.total_amount ?? 0
      }
      if (o.shipping_city) {
        if (!cityMap[o.shipping_city]) cityMap[o.shipping_city] = { count: 0, revenue: 0 }
        cityMap[o.shipping_city].count += 1
        cityMap[o.shipping_city].revenue += o.total_amount ?? 0
      }
    }
    const topEstados = Object.entries(stateMap)
      .map(([state, d]) => ({ state, ...d, pct: denominator > 0 ? (d.revenue / denominator) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    const topCidades = Object.entries(cityMap)
      .map(([city, d]) => ({ city, ...d, pct: denominator > 0 ? (d.revenue / denominator) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    return { topEstados, topCidades }
  }, [periodOrders, financialSummary])

  // Product alerts
  const activeProds  = products.filter(p => p.status === 'active')
  const pausedProds  = products.filter(p => p.status === 'paused')
  const noStockProds = products.filter(p => (p.stock ?? 0) <= 0 && p.status === 'active')
  const lowStockProds = products.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) < 5 && p.status === 'active')

  // Pedidos atrasados — heurística: status=paid e idade > 5 dias (sem shipping_status
  // disponível no payload do /ml/recent-orders, isso aproxima "pago mas não enviado/entregue").
  const lateOrders = useMemo(() => {
    const fiveDaysAgoMs = Date.now() - 5 * 24 * 60 * 60 * 1000
    return orders.filter(o => {
      if (o.status !== 'paid') return false
      const t = new Date(o.date_created).getTime()
      return Number.isFinite(t) && t < fiveDaysAgoMs
    }).length
  }, [orders])

  // Mediações abertas — proxy: claims com idade > 14 dias (claims antigos tendem a
  // escalar pra mediação no ML). Substituir quando endpoint /ml/mediations existir.
  const mediations = useMemo(() => {
    const twoWeeksAgoMs = Date.now() - 14 * 24 * 60 * 60 * 1000
    return claimsList.filter(c => {
      const raw = c.created_date ?? c.date_created
      if (!raw) return false
      const t = new Date(raw).getTime()
      return Number.isFinite(t) && t < twoWeeksAgoMs
    }).length
  }, [claimsList])

  // Funnel (estimated from order data)
  const paidCount  = periodOrders.filter(isPaid).length
  const totalCount = periodOrders.length
  const funnelSteps = [
    { label: 'Impressões',  value: Math.max(paidCount * 50, 0), color: '#60a5fa' },
    { label: 'Cliques',     value: Math.max(paidCount * 20, 0), color: '#a78bfa' },
    { label: 'Visitas',     value: Math.max(paidCount * 12, 0), color: '#00E5FF' },
    { label: 'Carrinho',    value: Math.max(paidCount * 4,  0), color: '#f59e0b' },
    { label: 'Checkout',    value: Math.max(totalCount, 0),      color: '#fb923c' },
    { label: 'Aprovado',    value: paidCount,                    color: '#34d399' },
    { label: 'Faturado',    value: paidCount,                    color: '#34d399' },
  ]
  const funnelTop = funnelSteps[0].value || 1
  const bottleneckIdx = (() => {
    let maxDrop = 0
    let idx = -1
    for (let i = 1; i < funnelSteps.length; i++) {
      const prev = funnelSteps[i - 1].value
      if (prev === 0) continue
      const drop = (prev - funnelSteps[i].value) / prev
      if (drop > maxDrop) { maxDrop = drop; idx = i }
    }
    return idx
  })()

  // Priority actions
  const priorities = useMemo(() => {
    const list: Array<{ label: string; level: 'red' | 'yellow'; href: string }> = []
    if (claims > 0) list.push({ label: `Resolver ${claims} reclamação${claims > 1 ? 'ões' : ''} aberta${claims > 1 ? 's' : ''}`, level: 'red', href: '/dashboard/atendimento/reclamacoes' })
    if (questions > 0) list.push({ label: `Responder ${questions} pergunta${questions > 1 ? 's' : ''} pendente${questions > 1 ? 's' : ''}`, level: 'yellow', href: '/dashboard/atendimento/perguntas' })
    if (noStockProds.length > 0) list.push({ label: `Repor estoque: ${noStockProds.length} produto${noStockProds.length > 1 ? 's' : ''} zerado${noStockProds.length > 1 ? 's' : ''}`, level: 'red', href: '/dashboard/produtos' })
    if (lowStockProds.length > 0) list.push({ label: `Atenção: ${lowStockProds.length} produto${lowStockProds.length > 1 ? 's' : ''} com estoque crítico (< 5)`, level: 'yellow', href: '/dashboard/produtos' })
    if (pausedProds.length > 0) list.push({ label: `${pausedProds.length} anúncio${pausedProds.length > 1 ? 's' : ''} pausado${pausedProds.length > 1 ? 's' : ''} — verificar`, level: 'yellow', href: '/dashboard/produtos' })
    return list
  }, [claims, questions, noStockProds, lowStockProds, pausedProds])

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>

      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-[12px] capitalize">{today}</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Visão Geral</h2>
        </div>
        {mlConnected && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-400" />
            ML conectado
          </span>
        )}
      </div>

      {/* Intelligence Hub summary (some quando hub disabled ou sem atividade 24h) */}
      <HubSummaryCard />

      {/* LINHA 1 — Filters */}
      <DashHeader
        period={period} setPeriod={setPeriod}
        channel={channel} setChannel={() => {}}
        onRefresh={() => refresh(false)} refreshing={refreshing}
        lastUpdated={lastUpdated}
      />

      {/* LINHA 2 — Cards grandes: Faturamento + Lucro */}
      <div className="grid grid-cols-2 gap-4">

        {/* Faturamento — fundo com glow radial cyan (canto sup-dir) + counter-glow (canto inf-esq) */}
        <div className="rounded-2xl p-6 transition-all relative overflow-hidden"
          style={{
            background: [
              'radial-gradient(ellipse 70% 55% at 100% 0%, rgba(0,229,255,0.22), rgba(0,229,255,0) 65%)',
              'radial-gradient(ellipse 60% 50% at 0% 100%, rgba(0,229,255,0.07), rgba(0,229,255,0) 60%)',
              'linear-gradient(135deg, #0d1a1a, #091414)',
            ].join(', '),
            border: '1px solid rgba(0,229,255,0.25)',
            boxShadow: '0 0 32px -12px rgba(0,229,255,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}>
          <p className="text-[#00E5FF] text-xs uppercase tracking-widest mb-3">
            Faturamento — {PERIOD_LABEL[period]}
          </p>
          {displaySummaryLoading ? (
            <div className="space-y-3"><Skel h={40} className="w-2/3" /><Skel h={14} className="w-1/2" /></div>
          ) : (
            <>
              <p className="text-4xl font-bold text-white leading-none">{formatCurrency(faturamento)}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {displayPedidos} pedido{displayPedidos !== 1 ? 's' : ''} no período
              </p>
              {prevData && (
                <div className="mt-4 pt-3 border-t border-[#ffffff10]">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">{PREV_PERIOD_LABEL[period]}</span>
                    <span className="text-xs text-gray-400">{formatCurrency(prevData.faturamento)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {prevData.faturamento > 0 ? (() => {
                      const diff = faturamento - prevData.faturamento
                      const p = (diff / prevData.faturamento) * 100
                      const up = diff >= 0
                      return (
                        <>
                          <span className={`text-sm font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
                            {up ? '↑' : '↓'} {Math.abs(p).toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-400">
                            ({up ? '+' : ''}{formatCurrency(diff)})
                          </span>
                        </>
                      )
                    })() : <span className="text-xs text-gray-400">sem dado anterior</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Lucro — mesmo efeito do Faturamento mas em verde (#22c55e) */}
        <div className="rounded-2xl p-6 transition-all relative overflow-hidden"
          style={{
            background: [
              'radial-gradient(ellipse 70% 55% at 100% 0%, rgba(34,197,94,0.22), rgba(34,197,94,0) 65%)',
              'radial-gradient(ellipse 60% 50% at 0% 100%, rgba(34,197,94,0.07), rgba(34,197,94,0) 60%)',
              'linear-gradient(135deg, #0d1a0d, #091409)',
            ].join(', '),
            border: '1px solid rgba(34,197,94,0.25)',
            boxShadow: '0 0 32px -12px rgba(34,197,94,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}>
          <p className="text-[#22c55e] text-xs uppercase tracking-widest mb-3">
            Lucro Estimado — {PERIOD_LABEL[period]}
          </p>
          {(summaryLoading || loading) ? (
            <div className="space-y-3"><Skel h={40} className="w-2/3" /><Skel h={14} className="w-1/2" /></div>
          ) : (
            <>
              <p className="text-4xl font-bold text-white leading-none">{formatCurrency(lucroEstimado)}</p>
              <p className="text-xs text-[#22c55e] mt-1">
                {margemPct.toFixed(1)}% do faturamento
              </p>
              {pedidosSemCusto > 0 && (
                <div className="mt-2 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2.5} className="shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span className="text-[10px] text-yellow-300">
                    {pedidosSemCusto} pedido{pedidosSemCusto > 1 ? 's' : ''} sem custo ·{' '}
                    <Link href="/dashboard/pedidos" className="underline hover:text-yellow-200 transition-colors">
                      Atualizar →
                    </Link>
                  </span>
                </div>
              )}
              {pedidosComCusto > 0 && pedidosSemCusto === 0 && (
                <p className="text-[10px] text-zinc-500 mt-1.5">✓ Calculado com custos reais ({pedidosComCusto} pedidos)</p>
              )}
              {prevData && (
                <div className="mt-4 pt-3 border-t border-[#ffffff10]">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">{PREV_PERIOD_LABEL[period]}</span>
                    <span className="text-xs text-gray-400">{formatCurrency(prevData.lucro)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {prevData.lucro > 0 ? (() => {
                      const diff = lucroEstimado - prevData.lucro
                      const p = (diff / prevData.lucro) * 100
                      const up = diff >= 0
                      return (
                        <>
                          <span className={`text-sm font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
                            {up ? '↑' : '↓'} {Math.abs(p).toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-400">
                            ({up ? '+' : ''}{formatCurrency(diff)})
                          </span>
                        </>
                      )
                    })() : <span className="text-xs text-gray-400">sem dado anterior</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* LINHA 3 — KPIs menores */}
      <section>
        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-3">KPIs Executivos</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2.5">
          <KpiCard label={`Pedidos — ${PERIOD_LABEL[period]}`} value={String(displayPedidos)} vsYest={period === 'today' ? pct(cur.count, yest.count) : null} color="#a78bfa" loading={displaySummaryLoading || periodLoading} />
          <KpiCard label="Ticket médio"       value={brl(financialSummary?.average_ticket ?? cur.avgTicket)} color="#fb923c" loading={summaryLoading || periodLoading || loading} />
          <ReputacaoMlCard sellerInfo={sellerInfo} mlConnected={mlConnected} loading={loading} />
          <KpiCard label="Vendas Aprovadas"   value={finKpis ? shortBrl(finKpis.vendas_aprovadas) : '—'} sub="líquido mês atual" color="#22c55e" loading={loading} />
          <KpiCard label={`Margem — ${PERIOD_LABEL[period]}`} value={`${margemPct.toFixed(1)}%`} sub={shortBrl(lucroEstimado)} color={margemPct >= 0 ? '#22c55e' : '#f87171'} loading={periodLoading || summaryLoading} />
          <KpiCard label="Investimento mídia" value={adsSummary ? shortBrl(adsSummary.spend) : '—'} sub={adsSummary && adsSummary.spend > 0 ? 'mês atual' : 'via Ads'} color="#f87171" loading={loading} />
          <KpiCard label="ROAS / ROI"         value={adsSummary && adsSummary.roas > 0 ? `${adsSummary.roas.toFixed(2)}x` : '—'} sub={adsSummary && adsSummary.roas > 0 ? `receita ${shortBrl(adsSummary.revenue)}` : 'via Ads'} color="#e879f9" loading={loading} />
        </div>
      </section>

      {/* LINHA 3 — Alerts */}
      <section>
        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Central de Alertas</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
          <AlertCard label="Reclamações abertas"    value={claims}              level={claims > 0 ? 'red' : 'green'}                              href="/dashboard/atendimento/reclamacoes" loading={loading} />
          <AlertCard label="Mediações abertas"      value={mediations}          level={mediations > 0 ? 'yellow' : 'green'}                       href="/dashboard/atendimento/reclamacoes" loading={loading} />
          <AlertCard label="Pedidos atrasados"      value={lateOrders}          level={lateOrders > 5 ? 'red' : lateOrders > 0 ? 'yellow' : 'green'} href="/dashboard/pedidos" loading={loading} />
          <AlertCard label="Perguntas sem resposta" value={questions}           level={questions > 5 ? 'red' : questions > 0 ? 'yellow' : 'green'} href="/dashboard/atendimento/perguntas" loading={loading} />
          <AlertCard label="Mensagens não lidas"    value={openConvs}           level={openConvs > 5 ? 'red' : openConvs > 0 ? 'yellow' : 'green'}  href="/dashboard/atendente-ia/conversas" loading={loading} />
          <AlertCard label="Sem estoque"            value={noStockProds.length} level={noStockProds.length > 0 ? 'red' : 'green'}                  href="/dashboard/produtos" loading={loading} />
          <AlertCard label="Anúncios pausados"      value={pausedProds.length}  level={pausedProds.length > 3 ? 'yellow' : 'green'}                href="/dashboard/produtos" loading={loading} />
          <AlertCard label="Acima da concorrência"  value={aboveConcPrice}      level={aboveConcPrice > 0 ? 'yellow' : 'green'}                   href="/dashboard/precos" loading={loading} />
        </div>
      </section>

      {/* LINHA 4 — Sales Chart */}
      <section>
        <div className="rounded-2xl px-6 py-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white text-sm font-semibold">Resumo de Vendas</p>
              <p className="text-zinc-500 text-xs mt-0.5">Faturamento diário — todos os pedidos</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Unidades',  value: curAll.units.toLocaleString('pt-BR') },
                { label: 'Pedidos',   value: chartPedidos.toLocaleString('pt-BR') },
                { label: 'Tk. Médio', value: brl(chartAvgTicket) },
              ].map(m => (
                <div key={m.label}>
                  {loading ? <Skel h={20} className="mx-auto w-16 mb-1" /> : <p className="text-white text-[13px] font-bold">{m.value}</p>}
                  <p className="text-zinc-600 text-[10px]">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
          {loading ? (
            <Skel h={180} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1a1a1e" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={v => `R$${((v as number)/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="value" stroke="#00E5FF" strokeWidth={2} fill="url(#gArea)" dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* LINHA 5 — Conversion Funnel */}
      <section>
        <div className="rounded-2xl px-6 py-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white text-sm font-semibold">Funil de Conversão</p>
              <p className="text-zinc-500 text-xs mt-0.5">Estimativas baseadas nos pedidos disponíveis</p>
            </div>
            {bottleneckIdx > 0 && !loading && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                Gargalo: {funnelSteps[bottleneckIdx]?.label}
              </span>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(7)].map((_, i) => <Skel key={i} h={20} />)}</div>
          ) : (
            <div className="space-y-2 max-w-2xl">
              {funnelSteps.map((step, i) => (
                <div key={step.label}>
                  <FunnelStep
                    label={step.label}
                    value={step.value}
                    pctVal={funnelTop > 0 ? (step.value / funnelTop) * 100 : 0}
                    color={step.color}
                    isBottleneck={i === bottleneckIdx}
                  />
                  {i < funnelSteps.length - 1 && step.value > 0 && funnelSteps[i + 1].value > 0 && (
                    <p className="text-zinc-700 text-[10px] ml-32 pl-3 py-0.5">
                      → {((funnelSteps[i + 1].value / step.value) * 100).toFixed(1)}% avançam
                    </p>
                  )}
                </div>
              ))}
              <p className="text-zinc-700 text-[10px] mt-3">* Impressões, cliques e intenções são estimadas. Conecte Analytics para dados reais.</p>
            </div>
          )}
        </div>
      </section>

      {/* LINHA 5.5 — Brazil Sales Map + Rankings */}
      <section className="space-y-3">
        <BrazilSalesMap
          orders={periodLoading ? [] : periodOrders}
          title={MAP_PERIOD_LABELS[period]}
          height={350}
          realtime={false}
        />
        <p className="text-[10px] text-gray-400 -mt-1 px-1">
          * Mapa baseado nos pedidos com endereço de entrega disponível no período selecionado
        </p>

        {/* Rankings: Top Estados e Top Cidades */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Top Estados */}
          <div className="bg-[#111114] rounded-xl border border-[#1a1a1f] p-4">
            <p className="text-white font-semibold text-sm mb-3">Top Estados</p>
            {periodLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skel key={i} h={16} />)}</div>
            ) : topEstados.length === 0 ? (
              <p className="text-gray-400 text-xs">Sem dados de estado no período</p>
            ) : (
              <>
                <div className="flex text-[10px] text-gray-400 mb-2 gap-2">
                  <span className="w-4">#</span>
                  <span className="w-8">UF</span>
                  <span className="flex-1">Participação</span>
                  <span className="w-5 text-right">Qtd</span>
                  <span className="w-20 text-right">Faturamento</span>
                  <span className="w-10 text-right">%</span>
                </div>
                {topEstados.map((e, i) => (
                  <div key={e.state} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                    <span className="text-xs text-white w-8 font-medium">{e.state}</span>
                    <div className="flex-1 bg-[#1a1a1f] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-[#00E5FF] transition-all"
                        style={{ width: `${topEstados[0].revenue > 0 ? (e.revenue / topEstados[0].revenue) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-5 text-right">{e.count}</span>
                    <span className="text-xs text-white w-20 text-right font-medium">
                      R${e.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-xs font-semibold w-10 text-right"
                      style={{ color: e.pct > 40 ? '#00E5FF' : e.pct > 20 ? '#22c55e' : '#6b7280' }}>
                      {e.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Top Cidades */}
          <div className="bg-[#111114] rounded-xl border border-[#1a1a1f] p-4">
            <p className="text-white font-semibold text-sm mb-3">Top Cidades</p>
            {periodLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skel key={i} h={16} />)}</div>
            ) : topCidades.length === 0 ? (
              <p className="text-gray-400 text-xs">Sem dados de cidade no período</p>
            ) : (
              <>
                <div className="flex text-[10px] text-gray-400 mb-2 gap-2">
                  <span className="w-4">#</span>
                  <span className="w-20">Cidade</span>
                  <span className="flex-1">Participação</span>
                  <span className="w-5 text-right">Qtd</span>
                  <span className="w-20 text-right">Faturamento</span>
                  <span className="w-10 text-right">%</span>
                </div>
                {topCidades.map((c, i) => (
                  <div key={c.city} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                    <span className="text-xs text-white w-20 font-medium truncate" title={c.city}>{c.city}</span>
                    <div className="flex-1 bg-[#1a1a1f] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-[#22c55e] transition-all"
                        style={{ width: `${topCidades[0].revenue > 0 ? (c.revenue / topCidades[0].revenue) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-5 text-right">{c.count}</span>
                    <span className="text-xs text-white w-20 text-right font-medium">
                      R${c.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-xs font-semibold w-10 text-right"
                      style={{ color: c.pct > 40 ? '#00E5FF' : c.pct > 20 ? '#22c55e' : '#6b7280' }}>
                      {c.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

        </div>
      </section>

      {/* LINHA 6 — Sector Grid */}
      <section>
        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Visão por Setor</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">

          <SectorCard title="Comercial" loading={summaryLoading || loading} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          } items={[
            { label: 'Faturamento período', value: shortBrl(financialSummary?.total_revenue ?? cur.revenue), color: '#00E5FF' },
            { label: 'Pedidos', value: financialSummary?.total_orders ?? cur.count },
            { label: 'Ticket médio', value: brl(financialSummary?.average_ticket ?? cur.avgTicket) },
            { label: 'Unidades vendidas', value: cur.units },
          ]} />

          <SectorCard title="Catálogo" loading={loading} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          } items={[
            { label: 'Ativos no ML', value: mlItemsTotal != null ? mlItemsTotal : activeProds.length, color: '#34d399' },
            { label: 'Pausados', value: pausedProds.length, color: pausedProds.length > 0 ? '#f59e0b' : '#71717a' },
            { label: 'Sem estoque', value: noStockProds.length, color: noStockProds.length > 0 ? '#f87171' : '#71717a' },
            { label: 'Acima da concorrência', value: aboveConcPrice, color: aboveConcPrice > 0 ? '#f59e0b' : '#71717a' },
          ]} />

          <SectorCard title="Atendimento" loading={loading} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          } items={[
            { label: 'Perguntas pendentes', value: questions, color: questions > 0 ? '#f59e0b' : '#34d399' },
            { label: 'Reclamações abertas', value: claims, color: claims > 0 ? '#f87171' : '#34d399' },
            { label: 'Mediações (>14d)', value: mediations, color: mediations > 0 ? '#f59e0b' : '#34d399' },
            { label: 'Conversas abertas', value: openConvs, color: openConvs > 5 ? '#f87171' : openConvs > 0 ? '#f59e0b' : '#34d399' },
          ]} />

          <SectorCard title="Logística" loading={loading} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1" /></svg>
          } items={[
            { label: 'Pagos hoje', value: todayM.count, color: '#00E5FF' },
            { label: 'Atrasados (>5d)', value: lateOrders, color: lateOrders > 5 ? '#f87171' : lateOrders > 0 ? '#f59e0b' : '#34d399' },
            { label: 'Cancelados', value: orders.filter(o => o.status === 'cancelled').length, color: '#71717a' },
            { label: 'Total pedidos', value: orders.length, color: '#a1a1aa' },
          ]} />

          <SectorCard title="Financeiro" loading={summaryLoading || loading} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          } items={[
            { label: 'Receita bruta',  value: shortBrl(financialSummary?.total_revenue ?? cur.revenue), color: '#00E5FF' },
            { label: 'Taxas ML (~11.5%)', value: shortBrl((financialSummary?.total_revenue ?? cur.revenue) * 0.115), color: '#f87171' },
            { label: 'Receita líquida est.', value: shortBrl((financialSummary?.total_revenue ?? cur.revenue) * 0.885), color: '#34d399' },
            { label: 'Margem est.', value: `${margemPct.toFixed(1)}%`, color: margemPct >= 0 ? '#22c55e' : '#f87171' },
          ]} />

          <SectorCard title="Marketing" loading={loading} icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
          } items={[
            { label: 'Investimento', value: adsSummary ? shortBrl(adsSummary.spend) : '—', color: '#f87171' },
            { label: 'Cliques', value: adsSummary ? adsSummary.clicks.toLocaleString('pt-BR') : '—', color: '#a78bfa' },
            { label: 'ROAS', value: adsSummary && adsSummary.roas > 0 ? `${adsSummary.roas.toFixed(2)}x` : '—', color: adsSummary && adsSummary.roas >= 3 ? '#34d399' : '#f59e0b' },
            { label: 'Receita Ads', value: adsSummary ? shortBrl(adsSummary.revenue) : '—', color: '#22c55e' },
          ]} />

        </div>
      </section>

      {/* LINHA 7 — Top Products + At-Risk */}
      <section>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

          {/* Top 10 */}
          <div className="xl:col-span-3 rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24', background: '#0d0d10' }}>
              <p className="text-white text-sm font-semibold">Top 10 Produtos</p>
              <span className="text-zinc-500 text-xs">{period === 'today' ? 'Hoje' : period === '7d' ? '7 dias' : period === 'month' ? 'Mês' : '30 dias'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: 480 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e1e24', background: '#0a0a0d' }}>
                    {['#', 'Produto', 'Pedidos', 'Receita', 'Unidades'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#a1a1aa' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? [...Array(5)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e1e24' }}>
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skel h={12} /></td>
                      ))}
                    </tr>
                  )) : topProds.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-600 text-sm">Sem vendas no período.</td>
                    </tr>
                  ) : topProds.map((p, i) => (
                    <tr key={p.title} style={{ borderBottom: '1px solid #1e1e24' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: i < 3 ? 'rgba(0,229,255,0.15)' : '#1c1c1f', color: i < 3 ? '#00E5FF' : '#52525b' }}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-white text-[12px] font-medium truncate">{p.title}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-[12px]">{p.orders}</td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-bold" style={{ color: '#00E5FF' }}>{brl(p.revenue)}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-[12px]">{p.units}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* At-risk products */}
          <div className="xl:col-span-2 rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24', background: '#0d0d10' }}>
              <p className="text-white text-sm font-semibold">Produtos em Risco</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                {noStockProds.length + lowStockProds.length}
              </span>
            </div>
            <div className="p-4 space-y-2">
              {loading ? [...Array(4)].map((_, i) => <Skel key={i} h={44} className="rounded-xl" />) :
                [...noStockProds.slice(0, 4).map(p => ({ ...p, risk: 'Sem estoque' as const, color: '#f87171' })),
                 ...lowStockProds.slice(0, 4).map(p => ({ ...p, risk: 'Crítico' as const, color: '#f59e0b' }))
                ].slice(0, 8).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-zinc-600 text-[12px]">Nenhum produto em risco.</p>
                  </div>
                ) : (
                  [...noStockProds.slice(0, 4).map(p => ({ ...p, risk: 'Sem estoque' as const, color: '#f87171' })),
                   ...lowStockProds.slice(0, 4).map(p => ({ ...p, risk: 'Crítico' as const, color: '#f59e0b' }))
                  ].slice(0, 8).map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                      style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${p.color}20` }}>
                      <div className="w-1.5 h-8 rounded-full shrink-0" style={{ background: p.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[12px] font-medium truncate">{p.name}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: p.color }}>{p.risk} · {p.stock ?? 0} un.</p>
                      </div>
                      <Link href="/dashboard/produtos"
                        className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
                        style={{ background: `${p.color}15`, color: p.color }}>
                        Ver
                      </Link>
                    </div>
                  ))
                )
              }
            </div>
          </div>
        </div>
      </section>

      {/* LINHA 8 — Channel Table */}
      <section>
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24', background: '#0d0d10' }}>
            <p className="text-white text-sm font-semibold">Desempenho por Canal</p>
            <span className="text-zinc-500 text-xs">Comparativo de marketplaces</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e1e24', background: '#0a0a0d' }}>
                  {['Canal', 'Faturamento', 'Pedidos', 'Ticket Médio', 'Unidades', 'Cancelamentos', 'Devoluções'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#a1a1aa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? [...Array(3)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1e1e24' }}>
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><Skel h={12} /></td>)}
                  </tr>
                )) : (() => {
                  const mlOrders = periodOrders.filter(o => true) // all from ML for now
                  const mlM = calcMetrics(mlOrders)
                  const rows = [
                    { key: 'ml', m: mlM },
                    { key: 'shopee', m: { revenue: 0, count: 0, units: 0, avgTicket: 0 } },
                    { key: 'amazon', m: { revenue: 0, count: 0, units: 0, avgTicket: 0 } },
                    { key: 'magalu', m: { revenue: 0, count: 0, units: 0, avgTicket: 0 } },
                  ]
                  const totalRevenue = rows.reduce((s, r) => s + r.m.revenue, 0)
                  return rows.map(row => {
                    const meta = CHANNEL_META[row.key]
                    return (
                      <tr key={row.key} style={{ borderBottom: '1px solid #1e1e24' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>{row.key.toUpperCase().slice(0, 2)}</span>
                            <span className="text-[12px] text-white font-medium">{meta.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[12px] font-bold" style={{ color: row.m.revenue > 0 ? '#00E5FF' : '#3f3f46' }}>{row.m.revenue > 0 ? brl(row.m.revenue) : '—'}</p>
                          {totalRevenue > 0 && row.m.revenue > 0 && <p className="text-zinc-600 text-[10px]">{((row.m.revenue / totalRevenue) * 100).toFixed(0)}% do total</p>}
                        </td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: row.m.count > 0 ? '#fff' : '#3f3f46' }}>{row.m.count || '—'}</td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: row.m.avgTicket > 0 ? '#a1a1aa' : '#3f3f46' }}>{row.m.avgTicket > 0 ? brl(row.m.avgTicket) : '—'}</td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: row.m.units > 0 ? '#a1a1aa' : '#3f3f46' }}>{row.m.units || '—'}</td>
                        <td className="px-4 py-3 text-zinc-600 text-[12px]">—</td>
                        <td className="px-4 py-3 text-zinc-600 text-[12px]">—</td>
                      </tr>
                    )
                  })
                })()}
                {/* Total row */}
                {!loading && (
                  <tr style={{ background: 'rgba(0,229,255,0.04)', borderTop: '1px solid rgba(0,229,255,0.1)' }}>
                    <td className="px-4 py-3 text-[12px] font-bold text-white">Total</td>
                    <td className="px-4 py-3"><p className="text-[13px] font-black" style={{ color: '#00E5FF' }}>{brl(cur.revenue)}</p></td>
                    <td className="px-4 py-3 text-[12px] font-bold text-white">{cur.count}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-zinc-300">{brl(cur.avgTicket)}</td>
                    <td className="px-4 py-3 text-[12px] font-semibold text-zinc-300">{cur.units}</td>
                    <td className="px-4 py-3 text-zinc-500 text-[12px]">—</td>
                    <td className="px-4 py-3 text-zinc-500 text-[12px]">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* LINHA 9 — Priorities */}
      {(loading || priorities.length > 0) && (
        <section>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-3">Prioridades do Dia</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skel key={i} h={44} className="rounded-xl" />)}</div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#1e1e24' }}>
                {priorities.map((p, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.level === 'red' ? '#f87171' : '#f59e0b' }} />
                    <p className="flex-1 text-white text-[13px]">{p.label}</p>
                    <Link href={p.href}
                      className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: p.level === 'red' ? 'rgba(248,113,113,0.12)' : 'rgba(245,158,11,0.12)', color: p.level === 'red' ? '#f87171' : '#f59e0b' }}>
                      Resolver →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

    </div>
  )
}
