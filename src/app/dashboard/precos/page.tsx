'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  TrendingUp, TrendingDown, Minus, Search, RefreshCw,
  ChevronUp, ChevronDown, AlertTriangle, CheckCircle2, Edit2, X, Check,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

// ── types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string
  name: string
  sku: string | null
  photo_urls: string[] | null
  price: number | null
  cost_price: number | null
  tax_percentage: number | null
  tax_on_freight: boolean | null
  stock: number | null
  status: string
  ml_listing_id: string | null
}

type Competitor = {
  id: string
  product_id: string
  title: string | null
  current_price: number
  my_price: number | null
  platform: string
  seller: string | null
  status: string
}

type PricedProduct = Product & {
  competitors: Competitor[]
  margin: number | null        // %
  minCompetitor: number | null
  maxCompetitor: number | null
  avgCompetitor: number | null
  competitorDiff: number | null // (price - avgCompetitor) / avgCompetitor * 100
}

type SortKey = 'name' | 'price' | 'cost_price' | 'margin' | 'competitorDiff' | 'stock'
type SortDir = 'asc' | 'desc'

// ── helpers ──────────────────────────────────────────────────────────────────

function brl(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(v: number | null | undefined, decimals = 1) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}%`
}

function calcMargin(price: number | null, cost: number | null, tax: number | null): number | null {
  if (!price || !cost || price <= 0) return null
  const taxRate = (tax ?? 0) / 100
  const revenue = price * (1 - taxRate)
  return ((revenue - cost) / revenue) * 100
}

function marginColor(m: number | null): string {
  if (m == null) return '#71717a'
  if (m >= 30) return '#34d399'
  if (m >= 15) return '#f59e0b'
  if (m >= 0)  return '#f97316'
  return '#f43f5e'
}

function diffColor(d: number | null): string {
  if (d == null) return '#71717a'
  if (d > 5)  return '#f43f5e'   // very expensive
  if (d > 0)  return '#f97316'   // a bit expensive
  if (d > -5) return '#34d399'   // slightly cheaper
  return '#22d3ee'               // much cheaper
}

// ── inline price editor ───────────────────────────────────────────────────────

function PriceEditor({
  productId, initial, onSaved,
}: { productId: string; initial: number | null; onSaved: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(initial != null ? String(initial) : '')
  const [saving, setSaving]   = useState(false)

  async function save() {
    const num = parseFloat(val.replace(',', '.'))
    if (isNaN(num) || num <= 0) return
    setSaving(true)
    const token = await getToken()
    await fetch(`${BACKEND}/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ price: num }),
    })
    setSaving(false)
    setEditing(false)
    onSaved(num)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 group"
        title="Editar preço"
      >
        <span className="font-semibold text-white">{brl(initial)}</span>
        <Edit2 size={11} className="opacity-0 group-hover:opacity-60 transition-opacity text-zinc-400" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-zinc-400 text-xs">R$</span>
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="w-24 bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-cyan-500"
      />
      <button onClick={save} disabled={saving}
        className="text-emerald-400 hover:text-emerald-300 transition-colors">
        <Check size={13} />
      </button>
      <button onClick={() => setEditing(false)}
        className="text-zinc-500 hover:text-zinc-300 transition-colors">
        <X size={13} />
      </button>
    </div>
  )
}

// ── competitor chip ───────────────────────────────────────────────────────────

const PM_COLOR: Record<string, string> = {
  mercadolivre: '#FFE600',
  shopee:       '#EE4D2D',
  amazon:       '#FF9900',
  magalu:       '#0086FF',
}

function CompetitorChip({ c }: { c: Competitor }) {
  const color = PM_COLOR[c.platform] ?? '#71717a'
  return (
    <span
      title={`${c.title ?? c.seller ?? c.platform} — ${brl(c.current_price)}`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {brl(c.current_price)}
    </span>
  )
}

// ── row ───────────────────────────────────────────────────────────────────────

function Row({ p, onPriceChange }: { p: PricedProduct; onPriceChange: (id: string, v: number) => void }) {
  const thumb = p.photo_urls?.[0]

  return (
    <tr className="border-b border-zinc-800 hover:bg-zinc-900/40 transition-colors group">
      {/* product */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
            {thumb
              ? <img src={thumb} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">{p.name[0]}</div>
            }
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate max-w-[220px]">{p.name}</p>
            {p.sku && <p className="text-[11px] text-zinc-500">{p.sku}</p>}
          </div>
        </div>
      </td>

      {/* my price */}
      <td className="py-3 px-4 text-sm">
        <PriceEditor
          productId={p.id}
          initial={p.price}
          onSaved={v => onPriceChange(p.id, v)}
        />
      </td>

      {/* cost */}
      <td className="py-3 px-4 text-sm text-zinc-400">{brl(p.cost_price)}</td>

      {/* margin */}
      <td className="py-3 px-4 text-sm font-semibold" style={{ color: marginColor(p.margin) }}>
        {p.margin != null ? `${p.margin.toFixed(1)}%` : '—'}
      </td>

      {/* competitors */}
      <td className="py-3 px-4">
        {p.competitors.length === 0
          ? <span className="text-zinc-600 text-xs">Sem dados</span>
          : (
            <div className="flex flex-wrap gap-1">
              {p.competitors.slice(0, 4).map(c => <CompetitorChip key={c.id} c={c} />)}
              {p.competitors.length > 4 && (
                <span className="text-zinc-500 text-[10px] self-center">+{p.competitors.length - 4}</span>
              )}
            </div>
          )
        }
      </td>

      {/* avg competitor */}
      <td className="py-3 px-4 text-sm text-zinc-300">{brl(p.avgCompetitor)}</td>

      {/* diff */}
      <td className="py-3 px-4 text-sm">
        {p.competitorDiff == null
          ? <span className="text-zinc-600">—</span>
          : (
            <div className="flex items-center gap-1" style={{ color: diffColor(p.competitorDiff) }}>
              {p.competitorDiff > 1
                ? <TrendingUp size={13} />
                : p.competitorDiff < -1
                  ? <TrendingDown size={13} />
                  : <Minus size={13} />
              }
              <span className="font-semibold">{pct(p.competitorDiff)}</span>
            </div>
          )
        }
      </td>

      {/* stock */}
      <td className="py-3 px-4 text-sm text-zinc-400 text-right">{p.stock ?? '—'}</td>
    </tr>
  )
}

// ── sort header ───────────────────────────────────────────────────────────────

function SortTh({
  label, sortKey, current, dir, onSort,
}: { label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void }) {
  const active = sortKey === current
  return (
    <th
      className="py-2.5 px-4 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide cursor-pointer select-none hover:text-zinc-300 transition-colors whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? dir === 'asc' ? <ChevronUp size={11} className="text-cyan-400" /> : <ChevronDown size={11} className="text-cyan-400" />
          : <ChevronUp size={11} className="opacity-20" />
        }
      </span>
    </th>
  )
}

// ── kpi card ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-cyan-400">{icon}</div>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-lg font-bold text-white leading-none">{value}</p>
        {sub && <p className="text-[11px] text-zinc-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── filter bar ────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'low_margin' | 'expensive' | 'no_cost' | 'no_competitors'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',            label: 'Todos'           },
  { key: 'low_margin',     label: 'Margem baixa'    },
  { key: 'expensive',      label: 'Acima da média'  },
  { key: 'no_cost',        label: 'Sem custo'       },
  { key: 'no_competitors', label: 'Sem concorrentes'},
]

// ── page ──────────────────────────────────────────────────────────────────────

export default function PrecosPage() {
  const [products,     setProducts]     = useState<Product[]>([])
  const [competitors,  setCompetitors]  = useState<Competitor[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filter,       setFilter]       = useState<FilterKey>('all')
  const [sortKey,      setSortKey]      = useState<SortKey>('name')
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    const token = await getToken()
    if (!token) { setLoading(false); return }

    const [pRes, cRes] = await Promise.allSettled([
      fetch(`${BACKEND}/products`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${BACKEND}/competitors`, { headers: { Authorization: `Bearer ${token}` } }),
    ])

    if (pRes.status === 'fulfilled' && pRes.value.ok) {
      const rows: Product[] = await pRes.value.json()
      setProducts(rows)
    }
    if (cRes.status === 'fulfilled' && cRes.value.ok) {
      const rows: Competitor[] = await cRes.value.json()
      setCompetitors(rows)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Build enriched rows
  const rows: PricedProduct[] = useMemo(() => {
    return products.map(p => {
      const comps = competitors.filter(c => c.product_id === p.id && c.status === 'active')
      const prices = comps.map(c => c.current_price).filter(v => v > 0)
      const minComp = prices.length ? Math.min(...prices) : null
      const maxComp = prices.length ? Math.max(...prices) : null
      const avgComp = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
      const margin  = calcMargin(p.price, p.cost_price, p.tax_percentage)
      const diff    = p.price != null && avgComp != null
        ? ((p.price - avgComp) / avgComp) * 100
        : null

      return { ...p, competitors: comps, margin, minCompetitor: minComp, maxCompetitor: maxComp, avgCompetitor: avgComp, competitorDiff: diff }
    })
  }, [products, competitors])

  // Filter
  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(p => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))
    }
    switch (filter) {
      case 'low_margin':     r = r.filter(p => p.margin != null && p.margin < 15); break
      case 'expensive':      r = r.filter(p => p.competitorDiff != null && p.competitorDiff > 5); break
      case 'no_cost':        r = r.filter(p => !p.cost_price); break
      case 'no_competitors': r = r.filter(p => p.competitors.length === 0); break
    }
    return r
  }, [rows, search, filter])

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: number | string | null = null
      let vb: number | string | null = null
      switch (sortKey) {
        case 'name':           va = a.name;           vb = b.name;           break
        case 'price':          va = a.price;          vb = b.price;          break
        case 'cost_price':     va = a.cost_price;     vb = b.cost_price;     break
        case 'margin':         va = a.margin;         vb = b.margin;         break
        case 'competitorDiff': va = a.competitorDiff; vb = b.competitorDiff; break
        case 'stock':          va = a.stock;          vb = b.stock;          break
      }
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function handleSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function handlePriceChange(id: string, v: number) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, price: v } : p))
  }

  // KPIs
  const priced       = rows.filter(p => p.price != null)
  const withCost     = rows.filter(p => p.cost_price != null && p.price != null)
  const avgMargin    = withCost.length
    ? withCost.reduce((s, p) => s + (p.margin ?? 0), 0) / withCost.length
    : null
  const expensiveCt  = rows.filter(p => p.competitorDiff != null && p.competitorDiff > 5).length
  const lowMarginCt  = rows.filter(p => p.margin != null && p.margin < 15).length

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: '#e4e4e7' }}>
      {/* header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Gestão de Preços</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Margem, custo e comparativo com concorrentes</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="flex-shrink-0 px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi
          label="Produtos com preço"
          value={`${priced.length}/${rows.length}`}
          icon={<CheckCircle2 size={18} />}
        />
        <Kpi
          label="Margem média"
          value={avgMargin != null ? `${avgMargin.toFixed(1)}%` : '—'}
          sub="dos produtos com custo"
          icon={<TrendingUp size={18} />}
        />
        <Kpi
          label="Acima da concorrência"
          value={String(expensiveCt)}
          sub="> 5% acima da média"
          icon={<AlertTriangle size={18} />}
        />
        <Kpi
          label="Margem baixa"
          value={String(lowMarginCt)}
          sub="< 15% de margem"
          icon={<TrendingDown size={18} />}
        />
      </div>

      {/* filters + search */}
      <div className="flex-shrink-0 px-6 pb-3 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produto ou SKU…"
            className="pl-8 pr-3 py-1.5 rounded-lg text-sm bg-zinc-800/60 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-600"
            style={{ width: 220 }}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={filter === f.key
                ? { background: 'rgba(0,229,255,0.15)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }
                : { background: 'rgba(255,255,255,0.04)', color: '#71717a', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >
              {f.label}
              {f.key !== 'all' && (() => {
                const counts: Record<FilterKey, number> = {
                  all:            rows.length,
                  low_margin:     rows.filter(p => p.margin != null && p.margin < 15).length,
                  expensive:      rows.filter(p => p.competitorDiff != null && p.competitorDiff > 5).length,
                  no_cost:        rows.filter(p => !p.cost_price).length,
                  no_competitors: rows.filter(p => p.competitors.length === 0).length,
                }
                const n = counts[f.key]
                return n > 0 ? (
                  <span className="ml-1 px-1 rounded-sm" style={{ background: 'rgba(255,255,255,0.1)', fontSize: 9 }}>{n}</span>
                ) : null
              })()}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-600 ml-auto">{sorted.length} produtos</span>
      </div>

      {/* table */}
      <div className="flex-1 overflow-auto px-6 pb-6 min-h-0">
        {loading
          ? (
            <div className="flex items-center justify-center h-40 text-zinc-600 text-sm gap-2">
              <RefreshCw size={14} className="animate-spin" /> Carregando…
            </div>
          )
          : sorted.length === 0
            ? (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-600 gap-2">
                <Search size={24} />
                <span className="text-sm">Nenhum produto encontrado</span>
              </div>
            )
            : (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10" style={{ background: 'rgba(9,9,11,0.95)' }}>
                  <tr className="border-b border-zinc-800">
                    <SortTh label="Produto"       sortKey="name"           current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Meu preço"     sortKey="price"          current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Custo"         sortKey="cost_price"     current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Margem"        sortKey="margin"         current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                      Concorrentes
                    </th>
                    <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">
                      Média concorr.
                    </th>
                    <SortTh label="Diferença"     sortKey="competitorDiff" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Estoque"       sortKey="stock"          current={sortKey} dir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => (
                    <Row key={p.id} p={p} onPriceChange={handlePriceChange} />
                  ))}
                </tbody>
              </table>
            )
        }
      </div>
    </div>
  )
}
