'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Radar, Boxes, Users, Activity, TrendingDown, ArrowUpDown, Search, ChevronRight,
} from 'lucide-react'
import { api } from './_components/api'
import { brl, pct, severityOf, eventLabel, relativeTime } from './_components/shared'

interface Summary {
  products_monitored: number
  products_total: number
  competitors: number
  new_events: number
  products_losing_lead: number
  market_demand_total: number
  conversion: {
    rate: number | null
    confidence: 'ok' | 'low'
    own_visits: number
    own_units: number
    calc_date: string | null
  }
}

interface RadarEvent {
  id: string
  catalog_product_ref: string
  event_type: string
  severity: string
  detected_at: string
  catalog: { id: string; title: string | null } | null
}

interface RadarProduct {
  id: string
  catalog_product_id: string
  title: string | null
  category_id: string | null
  status: string
  competitors: number
  total_offers: number
  min_price: number | null
  vazzo_price: number | null
  vazzo_has_lead: boolean
  price_delta_pct: number | null
  new_events: number
  market_demand: number | null
}

type SortKey =
  | 'title' | 'competitors' | 'min_price' | 'vazzo_has_lead'
  | 'price_delta_pct' | 'new_events' | 'market_demand'

const CARD = { background: '#111114', border: '1px solid #1a1a1f' }

export default function RadarPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [events, setEvents] = useState<RadarEvent[]>([])
  const [products, setProducts] = useState<RadarProduct[]>([])

  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'pausado'>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('new_events')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [s, e, p] = await Promise.all([
          api<Summary>('/radar/summary'),
          api<RadarEvent[]>('/radar/events?limit=40'),
          api<RadarProduct[]>('/radar/products'),
        ])
        if (!alive) return
        setSummary(s)
        setEvents(e)
        setProducts(p)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Falha ao carregar o Radar')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const visible = useMemo(() => {
    let rows = products
    if (statusFilter !== 'all') rows = rows.filter(p => p.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) rows = rows.filter(p => (p.title ?? '').toLowerCase().includes(q)
      || p.catalog_product_id.toLowerCase().includes(q))
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = sortVal(a, sortKey)
      const bv = sortVal(b, sortKey)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [products, statusFilter, search, sortKey, sortDir])

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('desc') }
  }

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
          style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.25)' }}>
          <Radar size={22} style={{ color: '#00E5FF' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#fafafa' }}>e-Click Radar IA</h1>
          <p className="text-sm mt-0.5" style={{ color: '#71717a' }}>
            Inteligência de mercado · concorrência por produto de catálogo
          </p>
        </div>
        <Link href="/dashboard/radar/concorrentes"
          className="ml-auto self-center inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-white/[0.04]"
          style={{ border: '1px solid #27272a', color: '#a1a1aa' }}>
          <Users size={14} style={{ color: '#00E5FF' }} /> Concorrentes Vinculados
        </Link>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm mb-5" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>{error}</div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Produtos monitorados" value={summary?.products_monitored} loading={loading}
          icon={<Boxes size={15} />} accent="#00E5FF" />
        <Kpi label="Concorrentes" value={summary?.competitors} loading={loading}
          icon={<Users size={15} />} accent="#a1a1aa" />
        <Kpi label="Eventos novos" value={summary?.new_events} loading={loading}
          icon={<Activity size={15} />} accent="#00E5FF" />
        <Kpi label="Perdendo a ponta" value={summary?.products_losing_lead} loading={loading}
          icon={<TrendingDown size={15} />} accent="#f59e0b" />
      </div>

      {summary?.conversion && (
        <p className="text-[11px] mb-5 -mt-1" style={{
          color: summary.conversion.confidence === 'low' ? '#fbbf24' : '#52525b',
        }}>
          {summary.conversion.rate == null
            ? 'Demanda estimada: conversão ainda não calibrada — será medida na próxima coleta diária.'
            : `Demanda estimada (un./mês) = visitas × conversão calibrada de ${(summary.conversion.rate * 100).toFixed(1).replace('.', ',')}% · base: ${summary.conversion.own_visits} visitas / ${summary.conversion.own_units} vendas suas (30d)${summary.conversion.confidence === 'low' ? ' · amostra pequena, estimativa aproximada' : ''}`}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* O que mudou */}
        <section className="rounded-xl overflow-hidden" style={CARD}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a1a1f' }}>
            <Activity size={15} style={{ color: '#00E5FF' }} />
            <h2 className="text-sm font-semibold" style={{ color: '#fafafa' }}>O que mudou</h2>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {loading && <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-zinc-800/40 animate-pulse" />)}
            </div>}
            {!loading && events.length === 0 && (
              <div className="p-8 text-center">
                <Activity size={26} className="mx-auto mb-2" style={{ color: '#3f3f46' }} />
                <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhuma mudança recente</p>
                <p className="text-xs mt-1" style={{ color: '#52525b' }}>
                  A coleta roda diariamente — os eventos aparecem aqui.
                </p>
              </div>
            )}
            {!loading && events.map(ev => {
              const sev = severityOf(ev.severity)
              return (
                <Link key={ev.id} href={`/dashboard/radar/${ev.catalog_product_ref}`}
                  className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-zinc-900/50 transition-colors"
                  style={{ borderBottom: '1px solid #18181b', borderLeft: `2px solid ${sev.rule}` }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: '#fafafa' }}>
                      {eventLabel(ev.event_type)}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: '#71717a' }}>
                      {ev.catalog?.title ?? 'Produto de catálogo'}
                    </p>
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: '#52525b' }}>
                    {relativeTime(ev.detected_at)}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Tabela de produtos */}
        <section className="lg:col-span-2 rounded-xl overflow-hidden" style={CARD}>
          <div className="px-4 py-3 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid #1a1a1f' }}>
            <h2 className="text-sm font-semibold mr-auto" style={{ color: '#fafafa' }}>
              Produtos monitorados {!loading && <span style={{ color: '#52525b' }}>· {visible.length}</span>}
            </h2>
            <div className="flex items-center gap-1.5 rounded-lg px-2 py-1"
              style={{ background: '#09090b', border: '1px solid #27272a' }}>
              <Search size={13} style={{ color: '#52525b' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto…"
                className="bg-transparent text-xs outline-none w-40" style={{ color: '#fafafa' }} />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="text-xs rounded-lg px-2 py-1.5 outline-none"
              style={{ background: '#09090b', border: '1px solid #27272a', color: '#a1a1aa' }}>
              <option value="all">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="pausado">Pausados</option>
            </select>
          </div>

          {/* header */}
          <div className="flex items-center gap-3 px-4 py-2 text-[10px] uppercase tracking-wide"
            style={{ borderBottom: '1px solid #1a1a1f', color: '#52525b' }}>
            <Th label="Produto" k="title" cur={sortKey} dir={sortDir} onSort={toggleSort} className="flex-1" />
            <Th label="Conc." k="competitors" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-14 justify-end" />
            <Th label="Menor preço" k="min_price" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-24 justify-end" />
            <Th label="Ponta" k="vazzo_has_lead" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-24 justify-center" />
            <Th label="Δ preço" k="price_delta_pct" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-20 justify-end" />
            <Th label="Demanda" k="market_demand" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-20 justify-end" />
            <Th label="Eventos" k="new_events" cur={sortKey} dir={sortDir} onSort={toggleSort} className="w-16 justify-end" />
            <span className="w-4" />
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {loading && <div className="p-4 space-y-2">
              {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-11 rounded-lg bg-zinc-800/40 animate-pulse" />)}
            </div>}
            {!loading && visible.length === 0 && (
              <div className="p-10 text-center">
                <Boxes size={28} className="mx-auto mb-2" style={{ color: '#3f3f46' }} />
                <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhum produto no filtro atual</p>
              </div>
            )}
            {!loading && visible.map(p => (
              <Link key={p.id} href={`/dashboard/radar/${p.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-900/50 transition-colors"
                style={{ borderBottom: '1px solid #18181b' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#fafafa' }}>
                    {p.title ?? p.catalog_product_id}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: '#52525b' }}>{p.catalog_product_id}</p>
                </div>
                <span className="w-14 text-right text-xs tabular-nums" style={{ color: '#a1a1aa' }}>
                  {p.competitors}
                </span>
                <span className="w-24 text-right text-xs tabular-nums font-medium" style={{ color: '#fafafa' }}>
                  {brl(p.min_price)}
                </span>
                <span className="w-24 flex justify-center">
                  <LeadPill hasLead={p.vazzo_has_lead} hasPrice={p.min_price != null} />
                </span>
                <span className="w-20 text-right text-xs tabular-nums" style={{
                  color: p.price_delta_pct == null ? '#52525b'
                    : p.price_delta_pct < 0 ? '#22c55e' : p.price_delta_pct > 0 ? '#f87171' : '#71717a',
                }}>
                  {pct(p.price_delta_pct)}
                </span>
                <span className="w-20 text-right text-xs tabular-nums" style={{ color: '#a1a1aa' }}>
                  {p.market_demand == null ? '—' : `~${p.market_demand.toLocaleString('pt-BR')}`}
                </span>
                <span className="w-16 flex justify-end">
                  {p.new_events > 0 ? (
                    <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 tabular-nums"
                      style={{ background: 'rgba(0,229,255,0.12)', color: '#67e8f9' }}>
                      {p.new_events}
                    </span>
                  ) : <span className="text-xs" style={{ color: '#3f3f46' }}>—</span>}
                </span>
                <ChevronRight size={14} className="w-4 shrink-0" style={{ color: '#3f3f46' }} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function sortVal(p: RadarProduct, k: SortKey): string | number | null {
  if (k === 'title') return (p.title ?? p.catalog_product_id).toLowerCase()
  if (k === 'vazzo_has_lead') return p.vazzo_has_lead ? 1 : 0
  return p[k]
}

function Kpi(props: {
  label: string; value: number | undefined; loading: boolean; icon: ReactNode; accent: string
}) {
  return (
    <div className="rounded-xl p-4" style={CARD}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: props.accent }}>
        {props.icon}
        <span className="text-[11px] font-medium" style={{ color: '#71717a' }}>{props.label}</span>
      </div>
      {props.loading
        ? <div className="h-7 w-16 rounded bg-zinc-800/60 animate-pulse" />
        : <div className="text-2xl font-bold tabular-nums" style={{ color: '#fafafa' }}>
            {props.value ?? 0}
          </div>}
    </div>
  )
}

function LeadPill({ hasLead, hasPrice }: { hasLead: boolean; hasPrice: boolean }) {
  if (!hasPrice) return <span className="text-xs" style={{ color: '#3f3f46' }}>—</span>
  const c = hasLead
    ? { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', label: 'Ganhando' }
    : { bg: 'rgba(239,68,68,0.12)', text: '#f87171', label: 'Perdendo' }
  return (
    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5"
      style={{ background: c.bg, color: c.text }}>{c.label}</span>
  )
}

function Th(props: {
  label: string; k: SortKey; cur: SortKey; dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void; className?: string
}) {
  const active = props.cur === props.k
  return (
    <button onClick={() => props.onSort(props.k)}
      className={`flex items-center gap-1 hover:text-zinc-300 transition-colors ${props.className ?? ''}`}
      style={{ color: active ? '#00E5FF' : undefined }}>
      {props.label}
      <ArrowUpDown size={10} style={{ opacity: active ? 1 : 0.4 }} />
    </button>
  )
}
