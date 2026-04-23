'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  ResponsiveContainer,
} from 'recharts'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pctFmt = (v: number) => `${v.toFixed(2)}%`

// ── Types ─────────────────────────────────────────────────────────────────────

type Kpis = {
  vendas_aprovadas: number; faturamento_ml: number; canceladas: number
  custo_total: number; imposto_total: number; tarifa_total: number
  frete_comprador: number; frete_vendedor: number; frete_total: number
  margem_contribuicao: number; margem_pct: number
  qtd_aprovadas: number; qtd_canceladas: number
  ticket_medio: number; ticket_medio_mc: number
}

type DonutSlice = { name: string; value: number; pct: number; color: string }

type EnrichedOrder = {
  order_id: number; status: string; date_created: string
  account_nickname: string; seller_id: number
  item_id: string | null; title: string | null; sku: string | null
  thumbnail: string | null; quantity: number; unit_price: number
  total_amount: number; shipping_type: string | null
  frete_comprador: number; frete_vendedor: number; tarifa_ml: number
  cost_price: number | null; tax_amount: number | null
  lucro_bruto: number; contribution_margin: number | null
  contribution_margin_pct: number | null
  is_paid: boolean; is_cancelled: boolean
}

type Summary = { kpis: Kpis; donut_data: DonutSlice[]; orders: EnrichedOrder[] }

type Filters = {
  date_from: string; date_to: string; status: string
  q: string; shipping_type: string
}

type SortDir = 'asc' | 'desc'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function monthStartStr() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function defaultFilters(): Filters {
  return { date_from: monthStartStr(), date_to: todayStr(), status: 'all', q: '', shipping_type: 'all' }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skel({ h = 16, w = '100%', className = '' }: { h?: number; w?: string; className?: string }) {
  return <div className={`rounded-lg animate-pulse ${className}`} style={{ height: h, width: w, background: '#1e1e24' }} />
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────

function KpiCard6({
  label, value, sub1, sub2, color, loading, toggle, toggled, onToggle,
}: {
  label: string; value: string; sub1?: string; sub2?: string
  color: string; loading: boolean
  toggle?: string; toggled?: boolean; onToggle?: () => void
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-zinc-400 text-[11px] font-medium leading-tight">{label}</p>
        {toggle && (
          <button onClick={onToggle}
            className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded transition-all"
            style={{ background: toggled ? `${color}20` : 'rgba(255,255,255,0.04)', color: toggled ? color : '#52525b', border: `1px solid ${toggled ? color + '40' : '#2e2e33'}` }}>
            {toggle}
          </button>
        )}
      </div>
      {loading
        ? <div className="space-y-1.5"><Skel h={26} w="70%" /><Skel h={11} w="55%" /></div>
        : <>
            <p className="text-xl font-black leading-none" style={{ color }}>{value}</p>
            {sub1 && <p className="text-[10px] text-zinc-500 leading-snug">{sub1}</p>}
            {sub2 && <p className="text-[10px] text-zinc-600 leading-snug">{sub2}</p>}
          </>
      }
    </div>
  )
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

function DonutChart({ data, marginPct }: { data: DonutSlice[]; marginPct: number }) {
  const [active, setActive] = useState<number | null>(null)
  const displayData = data.filter(d => d.value > 0)
  const marginColor = marginPct >= 0 ? '#22c55e' : '#f87171'
  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie
              data={displayData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={82}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={(_, idx) => setActive(idx)}
              onMouseLeave={() => setActive(null)}
            >
              {displayData.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  opacity={active === null || active === i ? 1 : 0.4}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <ReTooltip
              content={({ active: a, payload }) => {
                if (!a || !payload?.length) return null
                const d = payload[0].payload as DonutSlice
                return (
                  <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '8px 12px' }}>
                    <p style={{ color: d.color, fontWeight: 700, fontSize: 12 }}>{d.name}</p>
                    <p style={{ color: '#e4e4e7', fontSize: 12 }}>{brl(d.value)}</p>
                    <p style={{ color: '#71717a', fontSize: 11 }}>{d.pct.toFixed(1)}%</p>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-lg font-black leading-none" style={{ color: marginColor }}>{marginPct.toFixed(1)}%</p>
            <p className="text-[9px] text-zinc-600 mt-0.5">margem</p>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 flex-1 min-w-0">
        {displayData.map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
            <span className="text-[11px] text-zinc-400 truncate flex-1">{d.name}</span>
            <span className="text-[11px] font-semibold text-zinc-200 shrink-0 tabular-nums">{d.pct.toFixed(1)}%</span>
          </div>
        ))}
        <p className="text-[9px] text-zinc-700 mt-1 leading-snug">*Frete pago pelo comprador não considerado</p>
      </div>
    </div>
  )
}

// ── Filters ───────────────────────────────────────────────────────────────────

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-xs rounded-lg px-2.5 py-2 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const sel = `${inp} cursor-pointer`
const lbl = 'block text-[11px] font-medium text-zinc-400 mb-1'

function FilterPanel({
  filters, setFilters, onSearch, loading,
}: {
  filters: Filters; setFilters: (f: Filters) => void
  onSearch: () => void; loading: boolean
}) {
  function set(key: keyof Filters, val: string) {
    setFilters({ ...filters, [key]: val })
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      <div>
        <label className={lbl}>Data início</label>
        <input type="date" className={inp} value={filters.date_from}
          onChange={e => set('date_from', e.target.value)} />
      </div>
      <div>
        <label className={lbl}>Data fim</label>
        <input type="date" className={inp} value={filters.date_to}
          onChange={e => set('date_to', e.target.value)} />
      </div>
      <div>
        <label className={lbl}>Status</label>
        <select className={sel} value={filters.status} onChange={e => set('status', e.target.value)}>
          <option value="all">Todos</option>
          <option value="paid">Aprovadas</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>
      <div>
        <label className={lbl}>Tipo de Frete</label>
        <select className={sel} value={filters.shipping_type} onChange={e => set('shipping_type', e.target.value)}>
          <option value="all">Todos</option>
          <option value="fulfillment">Full</option>
          <option value="self_service">Flex</option>
          <option value="drop_off">ME1/ME2</option>
          <option value="xd_drop_off">XD</option>
        </select>
      </div>
      <div>
        <label className={lbl}>Título ou SKU</label>
        <input type="text" className={inp} placeholder="buscar..." value={filters.q}
          onChange={e => set('q', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()} />
      </div>
      <div className="flex items-end col-span-2 sm:col-span-1">
        <button onClick={onSearch} disabled={loading}
          className="w-full py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
          style={{ background: '#00E5FF', color: '#000' }}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
    </div>
  )
}

// ── Sort helper ───────────────────────────────────────────────────────────────

function Th({ col, label, sortCol, sortDir, onSort }: {
  col: string; label: string; sortCol: string; sortDir: SortDir
  onSort: (c: string) => void
}) {
  const active = sortCol === col
  return (
    <th
      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest cursor-pointer select-none whitespace-nowrap"
      style={{ color: active ? '#00E5FF' : '#52525b' }}
      onClick={() => onSort(col)}>
      {label}
      {active && <span className="ml-1 text-[9px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

// ── Shipping badge ─────────────────────────────────────────────────────────────

const SHIP_BADGE: Record<string, { text: string; color: string; bg: string }> = {
  fulfillment: { text: 'FULL',   color: '#00E5FF', bg: '#0a1f2e' },
  self_service: { text: 'FLEX',  color: '#fb923c', bg: '#2a1500' },
  drop_off:     { text: 'ME1',   color: '#71717a', bg: '#1a1a1f' },
  xd_drop_off:  { text: 'XD',    color: '#a78bfa', bg: '#1a0e33' },
}

// ── Monetary cell ─────────────────────────────────────────────────────────────

function MonCell({ v, color, prefix = '' }: { v: number | null; color?: string; prefix?: string }) {
  if (v == null) return <span className="text-zinc-700 text-[11px]">—</span>
  return (
    <span className="text-[11px] font-semibold tabular-nums" style={{ color: color ?? '#e4e4e7' }}>
      {prefix}{brl(v)}
    </span>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, total, size, onPage, onSize }: {
  page: number; total: number; size: number
  onPage: (p: number) => void; onSize: (s: 20 | 50 | 100) => void
}) {
  const last = Math.max(0, Math.ceil(total / size) - 1)
  return (
    <div className="flex items-center justify-between pt-4">
      <div className="flex items-center gap-2">
        <span className="text-zinc-600 text-xs">{total.toLocaleString('pt-BR')} registros</span>
        <select
          value={size}
          onChange={e => onSize(Number(e.target.value) as 20 | 50 | 100)}
          className="text-[11px] px-2 py-1 rounded border"
          style={{ background: '#1c1c1f', borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      <div className="flex items-center gap-1">
        {[
          { l: '«', p: 0,       d: page === 0 },
          { l: '‹', p: page-1,  d: page === 0 },
          { l: `${page+1}/${last+1}`, p: -1, d: false },
          { l: '›', p: page+1,  d: page === last },
          { l: '»', p: last,    d: page === last },
        ].map(({ l, p, d }, i) => (
          <button key={i} onClick={() => p >= 0 && onPage(p)} disabled={d || p < 0}
            className="px-2 py-1 rounded text-xs text-zinc-400 disabled:opacity-30 hover:text-white transition-colors"
            style={{ pointerEvents: p < 0 ? 'none' : undefined }}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Action bar ────────────────────────────────────────────────────────────────

function ActionBar({ onExport }: { onExport: (fmt: 'csv') => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
        style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
        Nivelar Custo &amp; Imposto
      </button>
      <button className="px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
        style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
        Nivelar SKU
      </button>
      <button className="px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
        style={{ background: 'rgba(251,191,36,0.10)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
        Ranking de Produtos
      </button>
      <button className="px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
        style={{ background: 'rgba(34,197,94,0.10)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
        Reaver Dias Perdidos
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        <button onClick={() => onExport('csv')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold border transition-all"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          CSV
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FinancialSummaryPage() {
  const [summary, setSummary]       = useState<Summary | null>(null)
  const [loading, setLoading]       = useState(true)
  const [filters, setFilters]       = useState<Filters>(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortCol, setSortCol]       = useState('date_created')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')
  const [page, setPage]             = useState(0)
  const [pageSize, setPageSize]     = useState<20 | 50 | 100>(20)
  const [freteToggle, setFreteToggle] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const load = useCallback(async (f: Filters) => {
    setLoading(true)
    setError(null)
    const token = await getToken()
    if (!token) { setError('Sessão expirada.'); setLoading(false); return }

    const qs = new URLSearchParams({
      date_from:  new Date(f.date_from).toISOString(),
      date_to:    new Date(f.date_to + 'T23:59:59').toISOString(),
      ...(f.status !== 'all' ? { status: f.status } : {}),
    })

    const res = await fetch(`${BACKEND}/ml/financial-summary?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      setError(txt.slice(0, 200) || 'Erro ao carregar resumo financeiro')
      setLoading(false)
      return
    }

    const data = await res.json()
    setSummary(data)
    setPage(0)
    setLoading(false)
  }, [])

  useEffect(() => { load(appliedFilters) }, [load, appliedFilters])

  function handleSearch() {
    setAppliedFilters({ ...filters })
  }

  // Filter orders client-side by q and shipping_type
  const filteredOrders = useMemo(() => {
    if (!summary) return []
    let rows = summary.orders
    const q = appliedFilters.q.trim().toLowerCase()
    if (q) rows = rows.filter(o => (o.title ?? '').toLowerCase().includes(q) || (o.sku ?? '').toLowerCase().includes(q))
    if (appliedFilters.shipping_type !== 'all')
      rows = rows.filter(o => o.shipping_type === appliedFilters.shipping_type)
    return rows
  }, [summary, appliedFilters])

  // Sort
  const sortedOrders = useMemo(() => {
    const arr = [...filteredOrders]
    arr.sort((a, b) => {
      let av: any = (a as any)[sortCol]
      let bv: any = (b as any)[sortCol]
      if (av == null) av = sortDir === 'asc' ? Infinity : -Infinity
      if (bv == null) bv = sortDir === 'asc' ? Infinity : -Infinity
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [filteredOrders, sortCol, sortDir])

  const pagedOrders = useMemo(() => sortedOrders.slice(page * pageSize, (page + 1) * pageSize), [sortedOrders, page, pageSize])

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(0)
  }

  function exportCsv() {
    if (!sortedOrders.length) return
    const cols = ['Data','Conta','Título','SKU','Status','Frete','Qtd','Valor Unit.','Faturamento ML',
      'Custo','Imposto','Tarifa ML','Frete Comprador','Frete Vendedor','Margem Contrib.','MC %']
    const rows = sortedOrders.map(o => [
      new Date(o.date_created).toLocaleDateString('pt-BR'),
      o.account_nickname, o.title ?? '', o.sku ?? '', o.status, o.shipping_type ?? '',
      o.quantity, o.unit_price, o.total_amount,
      o.cost_price ?? '', o.tax_amount ?? '', o.tarifa_ml,
      o.frete_comprador, o.frete_vendedor,
      o.contribution_margin ?? '', o.contribution_margin_pct ?? '',
    ])
    const csv = [cols, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'resumo-financeiro.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const kpis = summary?.kpis
  const donut = summary?.donut_data ?? []

  // Effective vendas_aprovadas (toggle: + frete comprador)
  const vendasEfetivas = kpis
    ? (freteToggle ? kpis.vendas_aprovadas + kpis.frete_comprador : kpis.vendas_aprovadas)
    : null

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-xs">Financeiro</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Resumo Financeiro</h2>
        </div>
        <button onClick={() => setFiltersOpen(o => !o)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all"
          style={{ borderColor: filtersOpen ? '#00E5FF' : '#3f3f46', color: filtersOpen ? '#00E5FF' : '#a1a1aa' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filtros avançados
          <svg className="w-3 h-3 transition-transform" style={{ transform: filtersOpen ? 'rotate(180deg)' : undefined }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard6
            label="Vendas Aprovadas" loading={loading}
            value={vendasEfetivas != null ? brl(vendasEfetivas) : '—'}
            sub1={`Faturamento ML: ${kpis ? brl(kpis.faturamento_ml) : '—'}`}
            sub2={`Canceladas: ${kpis ? brl(kpis.canceladas) : '—'}`}
            color="#22c55e"
            toggle="+ frete comprador" toggled={freteToggle} onToggle={() => setFreteToggle(t => !t)}
          />
          <KpiCard6
            label="Custo &amp; Imposto" loading={loading}
            value={kpis ? brl(kpis.custo_total + kpis.imposto_total) : '—'}
            sub1={`Custo: ${kpis ? brl(kpis.custo_total) : '—'}`}
            sub2={`Imposto: ${kpis ? brl(kpis.imposto_total) : '—'}`}
            color="#f87171"
          />
          <KpiCard6
            label="Tarifa de Venda" loading={loading}
            value={kpis ? brl(kpis.tarifa_total) : '—'}
            sub1={`${kpis && kpis.faturamento_ml > 0 ? ((kpis.tarifa_total / kpis.faturamento_ml) * 100).toFixed(1) : '0'}% do faturamento`}
            color="#f59e0b"
          />
          <KpiCard6
            label="Frete Total" loading={loading}
            value={kpis ? brl(kpis.frete_total) : '—'}
            sub1={`Comprador: ${kpis ? brl(kpis.frete_comprador) : '—'}`}
            sub2={`Vendedor: ${kpis ? brl(kpis.frete_vendedor) : '—'}`}
            color="#3b82f6"
          />
          <KpiCard6
            label="Margem de Contribuição" loading={loading}
            value={kpis ? `${brl(kpis.margem_contribuicao)} / ${pctFmt(kpis.margem_pct)}` : '—'}
            color={kpis ? (kpis.margem_pct >= 0 ? '#22c55e' : '#f87171') : '#52525b'}
          />
          <KpiCard6
            label="Ticket Médio MC" loading={loading}
            value={kpis ? brl(kpis.ticket_medio_mc) : '—'}
            sub1={pctFmt(kpis?.margem_pct ?? 0)}
            color="#00E5FF"
          />
        </div>
      </section>

      {/* Filters + Donut */}
      {filtersOpen && (
        <section className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex flex-col xl:flex-row gap-6">
            <div className="flex-1">
              <FilterPanel
                filters={filters} setFilters={setFilters}
                onSearch={handleSearch} loading={loading}
              />
            </div>
            {!loading && donut.length > 0 && (
              <div className="shrink-0 xl:w-72">
                <DonutChart data={donut} marginPct={kpis?.margem_pct ?? 0} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Donut (when filters hidden) */}
      {!filtersOpen && !loading && donut.length > 0 && (
        <section className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <DonutChart data={donut} marginPct={kpis?.margem_pct ?? 0} />
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {kpis && [
                { l: 'Pedidos aprovados', v: kpis.qtd_aprovadas, c: '#22c55e' },
                { l: 'Pedidos cancelados', v: kpis.qtd_canceladas, c: '#f87171' },
                { l: 'Ticket médio', v: brl(kpis.ticket_medio), c: '#00E5FF' },
                { l: 'Faturamento ML', v: brl(kpis.faturamento_ml), c: '#e4e4e7' },
                { l: 'Margem total', v: pctFmt(kpis.margem_pct), c: kpis.margem_pct >= 0 ? '#22c55e' : '#f87171' },
                { l: 'MC / pedido', v: brl(kpis.ticket_medio_mc), c: '#a78bfa' },
              ].map(item => (
                <div key={item.l} className="flex flex-col gap-0.5">
                  <p className="text-[10px] text-zinc-500">{item.l}</p>
                  <p className="text-sm font-bold" style={{ color: item.c }}>
                    {typeof item.v === 'number' ? item.v.toLocaleString('pt-BR') : item.v}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Action buttons */}
      <ActionBar onExport={exportCsv} />

      {/* Table */}
      <section className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1100 }}>
            <thead>
              <tr style={{ background: '#0a0a0d', borderBottom: '1px solid #1e1e24' }}>
                <Th col="title"                  label="Anúncio"           sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="account_nickname"        label="Conta"             sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="sku"                     label="SKU"               sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="date_created"            label="Data"              sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="shipping_type"           label="Frete"             sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="unit_price"              label="Valor Unit."       sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="quantity"                label="Qtd"               sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="total_amount"            label="Faturamento ML"    sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="cost_price"              label="Custo (−)"         sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="tax_amount"              label="Imposto (−)"       sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="tarifa_ml"               label="Tarifa (−)"        sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="frete_comprador"         label="Fr. Comprador (−)" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="frete_vendedor"          label="Fr. Vendedor (−)"  sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="contribution_margin"     label="Margem Contrib. (=)" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                <Th col="contribution_margin_pct" label="MC %"              sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(8)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e1e24' }}>
                      {[...Array(15)].map((__, j) => (
                        <td key={j} className="px-3 py-3"><Skel h={12} /></td>
                      ))}
                    </tr>
                  ))
                : pagedOrders.length === 0
                  ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-12 text-center text-zinc-600 text-sm">
                        Nenhuma venda no período selecionado.
                      </td>
                    </tr>
                  )
                  : pagedOrders.map(o => {
                      const cancelled = o.is_cancelled
                      const ship = SHIP_BADGE[o.shipping_type ?? '']
                      const mcColor = o.contribution_margin != null
                        ? (o.contribution_margin >= 0 ? '#4ade80' : '#f87171')
                        : undefined
                      return (
                        <tr key={o.order_id}
                          style={{ borderBottom: '1px solid #1a1a1f', opacity: cancelled ? 0.5 : 1 }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                          {/* Anúncio */}
                          <td className="px-3 py-2.5" style={{ maxWidth: 220 }}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg shrink-0 overflow-hidden flex items-center justify-center"
                                style={{ background: '#1c1c1f', border: '1px solid #2e2e33' }}>
                                {o.thumbnail
                                  ? <img src={o.thumbnail} alt="" className="w-full h-full object-cover" />
                                  : <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#3f3f46" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" /></svg>
                                }
                              </div>
                              <div className="min-w-0">
                                <a href={`https://www.mercadolivre.com.br/vendas/${o.order_id}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-[11px] text-zinc-200 hover:text-white font-medium line-clamp-2 leading-snug transition-colors">
                                  {o.title ?? '—'}
                                </a>
                                <span className="text-[9px] font-mono text-zinc-600">#{o.order_id}</span>
                              </div>
                            </div>
                          </td>

                          {/* Conta */}
                          <td className="px-3 py-2.5">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}>
                              {o.account_nickname}
                            </span>
                          </td>

                          {/* SKU */}
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] font-mono text-zinc-400">{o.sku ?? '—'}</span>
                          </td>

                          {/* Data */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="text-[11px] text-zinc-400">
                              {new Date(o.date_created).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                            </span>
                          </td>

                          {/* Frete */}
                          <td className="px-3 py-2.5">
                            {ship
                              ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: ship.bg, color: ship.color }}>{ship.text}</span>
                              : <span className="text-zinc-600 text-[11px]">—</span>
                            }
                          </td>

                          {/* Valor unit */}
                          <td className="px-3 py-2.5"><MonCell v={o.unit_price} /></td>

                          {/* Qtd */}
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] text-zinc-300 font-semibold">{o.quantity}</span>
                          </td>

                          {/* Faturamento */}
                          <td className="px-3 py-2.5"><MonCell v={o.total_amount} color="#e4e4e7" /></td>

                          {/* Custo */}
                          <td className="px-3 py-2.5"><MonCell v={o.cost_price} color="#f97316" /></td>

                          {/* Imposto */}
                          <td className="px-3 py-2.5"><MonCell v={o.tax_amount} color="#f97316" /></td>

                          {/* Tarifa */}
                          <td className="px-3 py-2.5"><MonCell v={o.tarifa_ml} color="#f59e0b" /></td>

                          {/* Frete comprador */}
                          <td className="px-3 py-2.5"><MonCell v={o.frete_comprador > 0 ? o.frete_comprador : null} color="#60a5fa" /></td>

                          {/* Frete vendedor */}
                          <td className="px-3 py-2.5"><MonCell v={o.frete_vendedor > 0 ? o.frete_vendedor : null} color="#3b82f6" /></td>

                          {/* Margem contrib */}
                          <td className="px-3 py-2.5"><MonCell v={o.contribution_margin} color={mcColor} /></td>

                          {/* MC % */}
                          <td className="px-3 py-2.5">
                            {o.contribution_margin_pct != null
                              ? <span className="text-[11px] font-bold tabular-nums" style={{ color: mcColor }}>
                                  {o.contribution_margin_pct.toFixed(2)}%
                                </span>
                              : <span className="text-zinc-700 text-[11px]">—</span>
                            }
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>

        {!loading && sortedOrders.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination
              page={page} total={sortedOrders.length} size={pageSize}
              onPage={p => setPage(p)} onSize={s => { setPageSize(s); setPage(0) }}
            />
          </div>
        )}
      </section>

    </div>
  )
}
