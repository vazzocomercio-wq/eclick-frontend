'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ──────────────────────────────────────────────────────────────────

type Listing = {
  id: string
  title: string
  price: number
  original_price: number | null
  available_quantity: number
  sold_quantity: number
  thumbnail: string
  permalink: string
  status: string
  listing_type_id: string
  catalog_product_id: string | null
  catalog_listing: boolean
  free_shipping: boolean
  logistic_type: string | null
  sku: string | null
  has_variations: boolean
  pictures_count: number
  tags: string[]
  last_updated: string
  date_created: string
  category_id: string
}

type VisitDay = { date: string; visits: number }
type Toast = { id: number; msg: string; type: 'success' | 'error' | 'info' }

type Tab = 'active' | 'paused' | 'closed' | 'under_review' | 'full' | 'catalog'
type SearchType = 'title' | 'sku' | 'mlb'

// ── Helpers ────────────────────────────────────────────────────────────────

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const n = (v: number) => v.toLocaleString('pt-BR')

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

function mlFeeRate(listingTypeId: string): number {
  if (listingTypeId === 'gold_pro' || listingTypeId === 'gold_premium') return 0.16
  return 0.115
}

function listingTypeMeta(type: string) {
  if (type === 'gold_pro' || type === 'gold_premium')
    return { label: 'Premium', bg: '#0e2a33', border: '#00E5FF33', text: '#00E5FF' }
  if (type === 'gold_special')
    return { label: 'Ouro', bg: '#2a1f00', border: '#F59E0B33', text: '#F59E0B' }
  return { label: 'Classico', bg: '#1a1a1f', border: '#3f3f46', text: '#71717a' }
}

function statusColor(status: string) {
  if (status === 'active') return { dot: '#22c55e', label: 'Ativo' }
  if (status === 'paused') return { dot: '#f87171', label: 'Pausado' }
  if (status === 'closed') return { dot: '#52525b', label: 'Finalizado' }
  return { dot: '#eab308', label: 'Em revisao' }
}

// ── Mini bar chart ─────────────────────────────────────────────────────────

function MiniBar({ data, color }: { data: VisitDay[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <BarChart data={data} barSize={2} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Bar dataKey="visits" fill={color} radius={1} />
        <Tooltip
          contentStyle={{ background: '#111114', border: '1px solid #1a1a1f', borderRadius: 6, fontSize: 10 }}
          labelStyle={{ color: '#52525b' }}
          itemStyle={{ color }}
          cursor={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toasts({ toasts }: { toasts: Toast[] }) {
  const styles: Record<Toast['type'], { bg: string; border: string; color: string }> = {
    success: { bg: '#0d1f17', border: 'rgba(34,197,94,.3)',  color: '#4ade80' },
    error:   { bg: '#1f0d0d', border: 'rgba(248,113,113,.3)', color: '#f87171' },
    info:    { bg: '#111114', border: 'rgba(0,229,255,.25)',  color: '#00E5FF' },
  }
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const s = styles[t.type]
        return (
          <div key={t.id} className="px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
            {t.msg}
          </div>
        )
      })}
    </div>
  )
}

// ── Copy button ────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="text-zinc-600 hover:text-zinc-400 transition-colors ml-1"
      title="Copiar"
    >
      {copied
        ? <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        : <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
      }
    </button>
  )
}

// ── Action menu ────────────────────────────────────────────────────────────

const ACTIONS = [
  { key: 'finalize',    label: 'Finalizar Anuncio' },
  { key: 'promotions',  label: 'Ver Promocoes Disponiveis' },
  { key: 'reviews',     label: 'Ver Avaliacoes do Anuncio' },
  { key: 'visits',      label: 'Ver Visitas do Anuncio' },
  { key: 'reload',      label: 'Recarregar Informacoes' },
]

function ActionMenu({ open, onAction, onClose }: {
  open: boolean
  onAction: (key: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <div ref={ref} className="absolute right-0 top-8 z-40 w-52 rounded-xl overflow-hidden shadow-2xl"
      style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      {ACTIONS.map(a => (
        <button key={a.key} onClick={() => { onAction(a.key); onClose() }}
          className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
          {a.label}
        </button>
      ))}
    </div>
  )
}

// ── Listing row ────────────────────────────────────────────────────────────

function ListingRow({
  item, selected, onSelect, onAction,
}: {
  item: Listing
  selected: boolean
  onSelect: (id: string) => void
  onAction: (id: string, action: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const feeRate  = mlFeeRate(item.listing_type_id)
  const fee      = item.price * feeRate
  const profit   = item.price - fee
  const margin   = ((profit / item.price) * 100).toFixed(1)
  const typeMeta = listingTypeMeta(item.listing_type_id)
  const stColor  = statusColor(item.status)
  const isFull   = item.logistic_type === 'fulfillment'
  const isCatalog = item.catalog_listing

  return (
    <div className="flex gap-4 p-4 rounded-xl transition-colors hover:bg-zinc-900/60"
      style={{ background: '#0f0f12', border: '1px solid #1a1a1f', marginBottom: 8 }}>

      {/* Checkbox */}
      <div className="pt-1 shrink-0">
        <input type="checkbox" checked={selected} onChange={() => onSelect(item.id)}
          className="w-4 h-4 rounded accent-cyan-400 cursor-pointer" />
      </div>

      {/* Thumbnail */}
      <div className="shrink-0">
        <img src={item.thumbnail} alt="" width={72} height={72}
          className="rounded-lg object-cover bg-zinc-800" style={{ width: 72, height: 72 }} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: typeMeta.bg, border: `1px solid ${typeMeta.border}`, color: typeMeta.text }}>
            {typeMeta.label}
          </span>
          {isFull && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#0e2033', border: '1px solid #1d4ed833', color: '#60a5fa' }}>
              FULL
            </span>
          )}
          {isCatalog && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#1a0e33', border: '1px solid #7c3aed33', color: '#a78bfa' }}>
              Catalogo
            </span>
          )}
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: stColor.dot }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: stColor.dot }} />
            {stColor.label}
          </span>
        </div>

        {/* Title */}
        <a href={item.permalink} target="_blank" rel="noopener noreferrer"
          className="text-zinc-100 text-sm font-medium hover:text-cyan-300 transition-colors line-clamp-2 block mb-2">
          {item.title}
        </a>

        {/* MLB + SKU */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mb-3">
          <span className="flex items-center gap-0.5 font-mono">
            {item.id}
            <CopyBtn text={item.id} />
          </span>
          {item.sku && <span>SKU: <span className="text-zinc-400">{item.sku}</span></span>}
          {item.catalog_product_id && (
            <span className="flex items-center gap-0.5">
              Cat: <span className="text-zinc-400 font-mono">{item.catalog_product_id}</span>
              <CopyBtn text={item.catalog_product_id} />
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-3">
          <span>Estoque: <span className="text-zinc-200 font-semibold">{n(item.available_quantity)}</span></span>
          <span>Vendidos: <span className="text-zinc-200 font-semibold">{n(item.sold_quantity)}</span></span>
          <span>{item.pictures_count} foto{item.pictures_count !== 1 ? 's' : ''}</span>
          <span>Atualizado {relativeTime(item.last_updated)}</span>
          {item.has_variations && (
            <button className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
              Ver Variacoes
            </button>
          )}
        </div>

        {/* Tags / badges */}
        <div className="flex flex-wrap gap-1.5">
          {item.free_shipping && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#0d1f17', border: '1px solid rgba(34,197,94,.2)', color: '#4ade80' }}>
              Frete Gratis
            </span>
          )}
          {item.logistic_type === 'xd_drop_off' && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#111114', border: '1px solid #3f3f46', color: '#a1a1aa' }}>
              Flex
            </span>
          )}
          {item.logistic_type === 'cross_docking' && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#111114', border: '1px solid #3f3f46', color: '#a1a1aa' }}>
              Coleta
            </span>
          )}
          {item.tags.includes('good_seller') && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#0e2a33', border: '1px solid #00E5FF22', color: '#00E5FF' }}>
              Bom Vendedor
            </span>
          )}
          {item.tags.includes('catalog_boost') && (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#2a1f00', border: '1px solid #F59E0B22', color: '#F59E0B' }}>
              Boost Catalogo
            </span>
          )}
        </div>
      </div>

      {/* Price card */}
      <div className="shrink-0 w-52 flex flex-col items-end gap-2">
        <div className="text-right">
          {item.original_price && item.original_price > item.price && (
            <p className="text-zinc-600 text-xs line-through">{brl(item.original_price)}</p>
          )}
          <p className="text-white text-xl font-bold">{brl(item.price)}</p>
          <p className="text-emerald-400 text-sm font-semibold">
            Lucro: {brl(profit)}
            <span className="text-emerald-600 text-xs ml-1">({margin}%)</span>
          </p>
        </div>

        <div className="w-full text-xs space-y-1" style={{ borderTop: '1px solid #1a1a1f', paddingTop: 8 }}>
          <div className="flex justify-between text-zinc-500">
            <span>Tarifa ML ({(feeRate * 100).toFixed(1)}%)</span>
            <span className="text-red-400">-{brl(fee)}</span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>Frete</span>
            <span className="text-zinc-400">{item.free_shipping ? 'Incluso' : 'A calcular'}</span>
          </div>
        </div>

        {/* Action menu */}
        <div className="relative mt-1">
          <button onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
            Acoes
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <ActionMenu open={menuOpen} onAction={k => onAction(item.id, k)} onClose={() => setMenuOpen(false)} />
        </div>
      </div>
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pages.push(i)
  } else {
    pages.push(0)
    if (page > 2) pages.push('...')
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i)
    if (page < totalPages - 3) pages.push('...')
    pages.push(totalPages - 1)
  }

  return (
    <div className="flex items-center justify-between mt-6">
      <p className="text-zinc-500 text-xs">{n(total)} anuncios</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(0)} disabled={page === 0}
          className="px-2 py-1.5 rounded-lg text-xs text-zinc-400 disabled:opacity-30 hover:bg-zinc-800 transition-colors">
          {'<<'}
        </button>
        <button onClick={() => onChange(page - 1)} disabled={page === 0}
          className="px-2 py-1.5 rounded-lg text-xs text-zinc-400 disabled:opacity-30 hover:bg-zinc-800 transition-colors">
          {'<'}
        </button>
        {pages.map((p, idx) =>
          p === '...'
            ? <span key={`e${idx}`} className="px-2 text-zinc-600 text-xs">...</span>
            : <button key={p} onClick={() => onChange(p as number)}
                className="w-8 h-7 rounded-lg text-xs font-medium transition-colors"
                style={p === page
                  ? { background: '#00E5FF', color: '#000' }
                  : { color: '#a1a1aa' }}>
                {(p as number) + 1}
              </button>
        )}
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}
          className="px-2 py-1.5 rounded-lg text-xs text-zinc-400 disabled:opacity-30 hover:bg-zinc-800 transition-colors">
          {'>'}
        </button>
        <button onClick={() => onChange(totalPages - 1)} disabled={page >= totalPages - 1}
          className="px-2 py-1.5 rounded-lg text-xs text-zinc-400 disabled:opacity-30 hover:bg-zinc-800 transition-colors">
          {'>>'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Page() {
  const supabase = useMemo(() => createClient(), [])

  // State
  const [tab, setTab]           = useState<Tab>('active')
  const [page, setPage]         = useState(0)
  const PAGE_SIZE               = 20
  const [search, setSearch]     = useState('')
  const [searchType, setSearchType] = useState<SearchType>('title')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [listings, setListings] = useState<Listing[]>([])
  const [total, setTotal]       = useState(0)
  const [counts, setCounts]     = useState<Record<string, number>>({})
  const [visits, setVisits]     = useState<{ total: number; byDay: VisitDay[] } | null>(null)
  const [loading, setLoading]   = useState(true)
  const [visitsLoading, setVisitsLoading] = useState(true)
  const [toasts, setToasts]     = useState<Toast[]>([])
  const toastId                 = useRef(0)

  // Filter state
  const [filterFree, setFilterFree]   = useState(false)
  const [filterVars, setFilterVars]   = useState(false)

  function toast(msg: string, type: Toast['type'] = 'info') {
    const id = ++toastId.current
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  // ── Auth helper ──────────────────────────────────────────────────────────

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Nao autenticado')
    return { Authorization: `Bearer ${session.access_token}` }
  }, [supabase])

  // ── Load visits (header) ─────────────────────────────────────────────────

  const loadVisits = useCallback(async () => {
    setVisitsLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/listings/visits`, { headers })
      if (res.ok) setVisits(await res.json())
    } catch { /* silent */ } finally {
      setVisitsLoading(false)
    }
  }, [getHeaders])

  // ── Load counts (tabs) ───────────────────────────────────────────────────

  const loadCounts = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/listings/counts`, { headers })
      if (res.ok) setCounts(await res.json())
    } catch { /* silent */ }
  }, [getHeaders])

  // ── Load listings ────────────────────────────────────────────────────────

  const loadListings = useCallback(async (currentTab: Tab, currentPage: number) => {
    setLoading(true)
    try {
      const headers  = await getHeaders()
      const mlStatus = currentTab === 'full' || currentTab === 'catalog' ? 'active' : currentTab
      const params   = new URLSearchParams({
        status: mlStatus,
        offset: String(currentPage * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      })
      const res = await fetch(`${BACKEND}/ml/listings?${params}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      setListings(body.items ?? [])
      setTotal(body.total ?? 0)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao carregar anuncios', 'error')
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [getHeaders])

  // ── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => { loadVisits(); loadCounts() }, [loadVisits, loadCounts])
  useEffect(() => { loadListings(tab, page) }, [tab, page, loadListings])

  // ── Tab change ────────────────────────────────────────────────────────────

  function handleTab(t: Tab) { setTab(t); setPage(0); setSelectedIds(new Set()) }

  // ── Select all on page ────────────────────────────────────────────────────

  function toggleSelectAll() {
    if (displayedListings.every(l => selectedIds.has(l.id))) {
      setSelectedIds(s => { const n = new Set(s); displayedListings.forEach(l => n.delete(l.id)); return n })
    } else {
      setSelectedIds(s => { const n = new Set(s); displayedListings.forEach(l => n.add(l.id)); return n })
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleAction(id: string, action: string) {
    if (action === 'reload') { loadListings(tab, page); toast('Recarregando...', 'info'); return }
    toast(`${action} — em desenvolvimento`, 'info')
  }

  async function handleImport() {
    toast('Importando anuncios do ML...', 'info')
    try {
      const headers  = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/my-items`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      toast(`${body.items?.length ?? 0} anuncios importados`, 'success')
      loadListings(tab, page)
      loadCounts()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao importar', 'error')
    }
  }

  // ── Client-side filtering ─────────────────────────────────────────────────

  const displayedListings = useMemo(() => {
    let list = listings

    // Tab sub-filter
    if (tab === 'full')    list = list.filter(l => l.logistic_type === 'fulfillment')
    if (tab === 'catalog') list = list.filter(l => l.catalog_listing)

    // Advanced filters
    if (filterFree) list = list.filter(l => l.free_shipping)
    if (filterVars) list = list.filter(l => l.has_variations)

    // Search
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(l => {
        if (searchType === 'mlb')   return l.id.toLowerCase().includes(q)
        if (searchType === 'sku')   return (l.sku ?? '').toLowerCase().includes(q)
        return l.title.toLowerCase().includes(q)
      })
    }
    return list
  }, [listings, tab, filterFree, filterVars, search, searchType])

  // ── Visit stats derived ───────────────────────────────────────────────────

  const now = new Date()
  const curMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

  const allDays       = visits?.byDay ?? []
  const curMonthDays  = allDays.filter(d => d.date.startsWith(curMonth))
  const prevMonthDays = allDays.filter(d => d.date.startsWith(prevMonth))
  const curMonthTotal  = curMonthDays.reduce((a, d) => a + d.visits, 0)
  const prevMonthTotal = prevMonthDays.reduce((a, d) => a + d.visits, 0)
  const totalVisits150 = visits?.total ?? 0
  const avgPerMonth    = Math.round(totalVisits150 / 5)

  // ── Tabs config ───────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'active',       label: 'Ativos',      count: counts.active },
    { key: 'paused',       label: 'Pausados',    count: counts.paused },
    { key: 'closed',       label: 'Finalizados', count: counts.closed },
    { key: 'under_review', label: 'Em revisao',  count: counts.under_review },
    { key: 'full',         label: 'FULL' },
    { key: 'catalog',      label: 'Catalogo' },
  ]

  const allSelected = displayedListings.length > 0 && displayedListings.every(l => selectedIds.has(l.id))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl space-y-5" style={{ background: '#09090b', minHeight: '100vh' }}>
      <Toasts toasts={toasts} />

      {/* ── Section 1: Header visits ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: 150-day total */}
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-zinc-500 text-xs mb-2">Visitas — 150 dias</p>
          {visitsLoading
            ? <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded" />
            : <p className="text-white text-3xl font-bold" style={{ color: '#00E5FF' }}>{n(totalVisits150)}</p>
          }
          <p className="text-zinc-600 text-xs mt-1">top 20 anuncios ativos</p>
        </div>

        {/* Card 2: avg/month */}
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-zinc-500 text-xs mb-2">Media por mes</p>
          {visitsLoading
            ? <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded" />
            : <p className="text-white text-3xl font-bold">{n(avgPerMonth)}</p>
          }
          <p className="text-zinc-600 text-xs mt-1">ultimos 5 meses</p>
        </div>

        {/* Card 3: last month */}
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-zinc-500 text-xs mb-2">Mes passado</p>
          {visitsLoading
            ? <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded" />
            : <>
                <p className="text-white text-3xl font-bold mb-2">{n(prevMonthTotal)}</p>
                {prevMonthDays.length > 0 && <MiniBar data={prevMonthDays} color="#00E5FF" />}
              </>
          }
        </div>

        {/* Card 4: current month */}
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-zinc-500 text-xs mb-2">Mes atual</p>
          {visitsLoading
            ? <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded" />
            : <>
                <p className="text-white text-3xl font-bold mb-2">{n(curMonthTotal)}</p>
                {curMonthDays.length > 0 && <MiniBar data={curMonthDays} color="#22c55e" />}
              </>
          }
        </div>
      </div>

      {/* ── Section 2: Search + actions ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 flex-wrap">
          <select value={searchType} onChange={e => setSearchType(e.target.value as SearchType)}
            className="text-sm px-3 py-2 rounded-lg text-zinc-300 outline-none"
            style={{ background: '#111114', border: '1px solid #27272a' }}>
            <option value="title">Titulo</option>
            <option value="sku">SKU</option>
            <option value="mlb">MLB</option>
          </select>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadListings(tab, 0)}
            placeholder="Buscar anuncio..."
            className="text-sm px-3 py-2 rounded-lg text-zinc-200 placeholder-zinc-600 outline-none w-64"
            style={{ background: '#111114', border: '1px solid #27272a' }}
          />
          <button onClick={() => { setPage(0); loadListings(tab, 0) }}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ background: '#00E5FF', color: '#000' }}>
            Buscar
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleImport}
            className="text-xs px-3 py-2 rounded-lg font-medium transition-colors hover:opacity-90"
            style={{ background: '#0e2a33', border: '1px solid #00E5FF33', color: '#00E5FF' }}>
            Importar do ML
          </button>
          {['Nivelar Preco', 'Nivelar Estoque', 'Nivelar Descricao'].map(label => (
            <button key={label} onClick={() => toast(`${label} — em desenvolvimento`, 'info')}
              className="text-xs px-3 py-2 rounded-lg font-medium transition-colors"
              style={{ background: '#1a1a1f', border: '1px solid #27272a', color: '#a1a1aa' }}>
              {label}
            </button>
          ))}
          <button onClick={() => loadListings(tab, page)}
            className="text-xs px-3 py-2 rounded-lg transition-colors"
            style={{ background: '#1a1a1f', border: '1px solid #27272a', color: '#a1a1aa' }}
            title="Atualizar">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Section 3: Status tabs ────────────────────────────────────── */}
      <div className="flex gap-1 flex-wrap" style={{ borderBottom: '1px solid #1a1a1f', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => handleTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg relative"
            style={tab === t.key
              ? { color: '#00E5FF', borderBottom: '2px solid #00E5FF', background: '#0e2a3322' }
              : { color: '#71717a' }}>
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                style={tab === t.key
                  ? { background: '#00E5FF22', color: '#00E5FF' }
                  : { background: '#1a1a1f', color: '#52525b' }}>
                {n(t.count)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Section 4: Advanced filters (collapsible) ─────────────────── */}
      <div>
        <button onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-3">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ transform: showFilters ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          Filtros avancados
          {(filterFree || filterVars) && (
            <span className="px-1.5 py-0.5 rounded-full text-xs"
              style={{ background: '#00E5FF22', color: '#00E5FF' }}>
              {[filterFree, filterVars].filter(Boolean).length} ativo{[filterFree, filterVars].filter(Boolean).length > 1 ? 's' : ''}
            </span>
          )}
        </button>

        {showFilters && (
          <div className="flex flex-wrap gap-4 p-4 rounded-xl mb-4"
            style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={filterFree} onChange={e => setFilterFree(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400" />
              Frete gratis
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={filterVars} onChange={e => setFilterVars(e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400" />
              Tem variacoes
            </label>
            {(filterFree || filterVars) && (
              <button onClick={() => { setFilterFree(false); setFilterVars(false) }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Section 5: Listings ──────────────────────────────────────────── */}
      <div>
        {/* Select all bar */}
        {displayedListings.length > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
              className="w-4 h-4 rounded accent-cyan-400 cursor-pointer" />
            <span className="text-zinc-500 text-xs">
              {selectedIds.size > 0
                ? `${selectedIds.size} selecionado${selectedIds.size > 1 ? 's' : ''}`
                : `${n(displayedListings.length)} anuncios`}
            </span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: '#111114' }} />
            ))}
          </div>
        ) : displayedListings.length === 0 ? (
          <div className="text-center py-16 text-zinc-600">
            <svg className="mx-auto mb-4 opacity-30" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
            <p className="text-sm">Nenhum anuncio encontrado</p>
          </div>
        ) : (
          displayedListings.map(item => (
            <ListingRow
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onSelect={toggleSelect}
              onAction={handleAction}
            />
          ))
        )}

        <Pagination
          page={page}
          total={tab === 'full' || tab === 'catalog' ? displayedListings.length : total}
          pageSize={PAGE_SIZE}
          onChange={p => { setPage(p); setSelectedIds(new Set()) }}
        />
      </div>
    </div>
  )
}
