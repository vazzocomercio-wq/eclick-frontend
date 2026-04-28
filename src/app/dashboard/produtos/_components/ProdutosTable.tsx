'use client'

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { DataTable } from '@/components/data-table'
import type { Column, RowAction, BulkAction, QuickFilter } from '@/components/data-table'
import {
  Eye, Pause, Play, Copy, Trash2, Sparkles, Megaphone,
  Search as SearchIcon, FileDown,
} from 'lucide-react'
import { todoToast, pushToast } from '@/hooks/useToast'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const PREFS_KEY = 'eclick.produtos.datatable.prefs'

type QuickFilterValue = 'all' | 'active' | 'paused' | 'no_stock' | 'critical' | 'in_ads' | 'no_ads'

const QUICK_OPTIONS: { value: QuickFilterValue; label: string }[] = [
  { value: 'all',       label: 'Todos' },
  { value: 'active',    label: 'Ativos' },
  { value: 'paused',    label: 'Pausados' },
  { value: 'no_stock',  label: 'Sem estoque' },
  { value: 'critical',  label: 'Estoque crítico' },
  { value: 'in_ads',    label: 'Em Ads' },
  { value: 'no_ads',    label: 'Sem Ads' },
]

// Tipos vivem em page.tsx; redeclarado aqui pra contornar barrel.
// Quando migração consolidar, vira import único.
export type ProdutoRow = {
  id: string
  name: string
  sku: string | null
  brand: string | null
  price: number | null
  stock: number | null
  status: 'draft' | 'active' | 'paused'
  platforms: string[]
  photo_urls: string[] | null
  ml_listing_id: string | null
}

const PM: Record<string, { abbr: string; bg: string; fg: string }> = {
  mercadolivre: { abbr: 'ML', bg: '#FFE600', fg: '#111' },
  shopee:       { abbr: 'SH', bg: '#EE4D2D', fg: '#fff' },
  amazon:       { abbr: 'AZ', bg: '#FF9900', fg: '#111' },
  magalu:       { abbr: 'MG', bg: '#0086FF', fg: '#fff' },
}

const SM: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: 'Ativo',    bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
  draft:  { label: 'Rascunho', bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  paused: { label: 'Pausado',  bg: 'rgba(113,113,122,0.15)', color: '#71717a' },
}

const brl = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Beta DataTable view do catálogo. Ativável via `?view=table` na URL.
 * Bloco 1 da Sprint A — read-only. Inline editing virá no Bloco 2. */
/** Carrega prefs do localStorage. Tolerante a chave inexistente / corrompida. */
function loadPrefs(): { perPage: number; quickFilter: QuickFilterValue } {
  if (typeof window === 'undefined') return { perPage: 25, quickFilter: 'all' }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<{ perPage: number; quickFilter: QuickFilterValue }>
      return {
        perPage:     [10, 25, 50, 100].includes(p.perPage ?? 0) ? p.perPage as number : 25,
        quickFilter: QUICK_OPTIONS.some(o => o.value === p.quickFilter) ? p.quickFilter as QuickFilterValue : 'all',
      }
    }
  } catch {}
  return { perPage: 25, quickFilter: 'all' }
}

export function ProdutosTable({
  products: clientProducts,
  loading: clientLoading = false,
  onRefresh,
  onToggleStatus,
  onDuplicate,
  onDelete,
  onBulkPause,
  onBulkDelete,
}: {
  /** Quando passado, modo client-side (filtra/pagina o array localmente).
   * Quando undefined, modo server-side: fetch GET /products?... */
  products?:        ProdutoRow[]
  loading?:         boolean
  onRefresh?:       () => void
  onToggleStatus?:  (id: string, next: 'active' | 'paused') => Promise<void> | void
  onDuplicate?:     (id: string) => Promise<void> | void
  onDelete?:        (id: string) => Promise<void> | void
  onBulkPause?:     (ids: string[]) => Promise<void> | void
  onBulkDelete?:    (ids: string[]) => Promise<void> | void
}) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const supabase     = useMemo(() => createClient(), [])

  // ── State (lido de URL ou prefs salvos no boot) ────────────────────────────
  const initial = useMemo(() => {
    const saved = loadPrefs()
    const urlPage    = Number(searchParams.get('page'))     || 1
    const urlPerPage = Number(searchParams.get('per_page')) || saved.perPage
    const urlSearch  = searchParams.get('search')     ?? ''
    const urlQF      = (searchParams.get('quick_filter') ?? saved.quickFilter) as QuickFilterValue
    return { page: urlPage, perPage: urlPerPage, search: urlSearch, quickFilter: urlQF }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [page,        setPage]        = useState(initial.page)
  const [perPage,     setPerPage]     = useState(initial.perPage)
  const [search,      setSearch]      = useState(initial.search)
  const [quickFilter, setQuickFilter] = useState<QuickFilterValue>(initial.quickFilter)
  const [selected,    setSelected]    = useState<string[]>([])

  // ── Server-side fetch (quando products não foi passado) ───────────────────
  const [serverData,    setServerData]    = useState<ProdutoRow[]>([])
  const [serverTotal,   setServerTotal]   = useState(0)
  const [serverLoading, setServerLoading] = useState(false)
  const fetchSeq = useRef(0)

  const isServerMode = clientProducts === undefined

  const refetch = useCallback(async () => {
    if (!isServerMode) return
    const seq = ++fetchSeq.current
    setServerLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setServerData([]); setServerTotal(0); return }
      const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) })
      if (search.trim())          qs.set('search', search.trim())
      if (quickFilter !== 'all')  qs.set('quick_filter', quickFilter)
      const res = await fetch(`${BACKEND}/products?${qs}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => null) as { data?: ProdutoRow[]; total?: number } | null
      if (seq !== fetchSeq.current) return // request mais novo já chegou
      setServerData(body?.data ?? [])
      setServerTotal(body?.total ?? 0)
    } finally {
      if (seq === fetchSeq.current) setServerLoading(false)
    }
  }, [isServerMode, supabase, page, perPage, search, quickFilter])

  useEffect(() => { void refetch() }, [refetch])

  // Persiste prefs em localStorage (perPage, quickFilter) + sync URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ perPage, quickFilter })) } catch {}
  }, [perPage, quickFilter])

  useEffect(() => {
    if (!pathname) return
    const qs = new URLSearchParams()
    if (page > 1)               qs.set('page',         String(page))
    if (perPage !== 25)         qs.set('per_page',     String(perPage))
    if (search.trim())          qs.set('search',       search.trim())
    if (quickFilter !== 'all')  qs.set('quick_filter', quickFilter)
    const next = qs.toString()
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
  }, [page, perPage, search, quickFilter, pathname, router])

  // ── Modo client-side: filtragem local (back-compat) ───────────────────────
  const clientFiltered = useMemo(() => {
    if (!clientProducts) return [] as ProdutoRow[]
    let arr = clientProducts
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      arr = arr.filter(p =>
        (p.name ?? '').toLowerCase().includes(s) ||
        (p.sku  ?? '').toLowerCase().includes(s) ||
        (p.brand ?? '').toLowerCase().includes(s),
      )
    }
    switch (quickFilter) {
      case 'active':   arr = arr.filter(p => p.status === 'active'); break
      case 'paused':   arr = arr.filter(p => p.status === 'paused'); break
      case 'no_stock': arr = arr.filter(p => (p.stock ?? 0) === 0); break
      case 'critical': arr = arr.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5); break
      // in_ads/no_ads em modo client-side ficam por conta do parent
    }
    return arr
  }, [clientProducts, search, quickFilter])

  const filtered = isServerMode ? serverData : clientFiltered
  const total    = isServerMode ? serverTotal : clientFiltered.length
  const loading  = isServerMode ? serverLoading : clientLoading

  const paged = useMemo(() => {
    if (isServerMode) return filtered
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [isServerMode, filtered, page, perPage])

  const columns: Column<ProdutoRow>[] = useMemo(() => [
    {
      key: 'photo', label: 'Foto', width: '56px',
      render: p => p.photo_urls?.[0]
        ? <img src={p.photo_urls[0]} alt="" className="w-10 h-10 rounded object-cover" style={{ border: '1px solid #1e1e24' }} />
        : <div className="w-10 h-10 rounded flex items-center justify-center text-zinc-700 text-[10px]" style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>—</div>,
    },
    {
      key: 'sku', label: 'SKU',
      render: p => <span className="text-[11px] font-mono text-zinc-400">{p.sku ?? '—'}</span>,
    },
    {
      key: 'name', label: 'Título',
      render: p => (
        <div className="min-w-0">
          <p className="text-zinc-100 text-xs font-medium truncate max-w-[280px]">{p.name}</p>
          {p.brand && <p className="text-[10px] text-zinc-600">{p.brand}</p>}
        </div>
      ),
    },
    {
      key: 'platforms', label: 'Marketplace',
      render: p => (
        <div className="flex items-center gap-1 flex-wrap">
          {(p.platforms ?? []).map(plat => {
            const meta = PM[plat] ?? { abbr: plat.slice(0, 2).toUpperCase(), bg: '#27272a', fg: '#fff' }
            return (
              <span key={plat} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: meta.bg, color: meta.fg }}>
                {meta.abbr}
              </span>
            )
          })}
          {(p.platforms ?? []).length === 0 && <span className="text-[10px] text-zinc-700">—</span>}
        </div>
      ),
    },
    {
      key: 'stock', label: 'Estoque', align: 'right', sortable: true,
      render: p => {
        const s = p.stock ?? 0
        const color = s === 0 ? '#f87171' : s <= 5 ? '#facc15' : '#a1a1aa'
        return <span className="text-xs font-semibold tabular-nums" style={{ color }}>{s.toLocaleString('pt-BR')}</span>
      },
    },
    {
      key: 'price', label: 'Preço', align: 'right', sortable: true,
      render: p => <span className="text-xs font-semibold tabular-nums" style={{ color: '#00E5FF' }}>{brl(p.price)}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: p => {
        const m = SM[p.status]
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ color: m.color, background: m.bg }}>{m.label}</span>
        )
      },
    },
  ], [])

  const bulkActions: BulkAction<ProdutoRow>[] = useMemo(() => {
    const acts: BulkAction<ProdutoRow>[] = []
    if (onBulkPause) acts.push({
      key: 'pause-bulk', label: 'Pausar', icon: <Pause size={11} />, tone: 'warn',
      onClick: rows => {
        // Filtra só rows com status='active' direto da seleção (cada row já
        // carrega o status atual; não precisa lookup numa lista externa).
        const ids = rows.filter(r => r.status === 'active').map(r => r.id)
        if (ids.length === 0) {
          pushToast({ tone: 'info', message: 'Nenhum produto ativo na seleção' })
          return
        }
        void onBulkPause(ids)
        setSelected([])
      },
    })
    acts.push({
      key: 'export-bulk', label: 'Exportar CSV', icon: <FileDown size={11} />,
      onClick: rows => {
        if (rows.length === 0) return
        const cols = ['sku','name','status','stock','price','brand','platforms']
        const esc  = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
        const csv  = [cols.join(',')]
          .concat(rows.map(r => cols.map(c => esc(
            c === 'platforms' ? (r.platforms ?? []).join('|') : (r as unknown as Record<string, unknown>)[c],
          )).join(',')))
          .join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a'); a.href = url
        a.download = `produtos-selecionados-${new Date().toISOString().slice(0,10)}.csv`
        a.click(); URL.revokeObjectURL(url)
        pushToast({ tone: 'success', message: `✓ ${rows.length} produto${rows.length === 1 ? '' : 's'} exportado${rows.length === 1 ? '' : 's'}` })
      },
    })
    if (onBulkDelete) acts.push({
      key: 'delete-bulk', label: 'Excluir', icon: <Trash2 size={11} />, tone: 'danger',
      onClick: rows => {
        const ids = rows.map(r => r.id)
        void onBulkDelete(ids)
        setSelected([])
      },
    })
    return acts
  }, [onBulkPause, onBulkDelete])

  const rowActions = useMemo(() => (p: ProdutoRow): RowAction<ProdutoRow>[] => {
    const acts: RowAction<ProdutoRow>[] = [
      { key: 'view',  label: 'Ver / Editar',          icon: <Eye size={12} />, onClick: () => router.push(`/dashboard/produtos/${p.id}/editar`) },
    ]
    if (p.status !== 'draft' && onToggleStatus) {
      acts.push({
        key: 'toggle',
        label: p.status === 'active' ? 'Pausar anúncio' : 'Ativar anúncio',
        icon:  p.status === 'active' ? <Pause size={12} /> : <Play size={12} />,
        tone:  p.status === 'active' ? 'warn' : 'success',
        onClick: () => onToggleStatus(p.id, p.status === 'active' ? 'paused' : 'active'),
      })
    }
    acts.push(
      { key: 'ads',     label: 'Adicionar a campanha Ads',   icon: <Megaphone size={12} />, onClick: () => todoToast('Vínculo com campanha Ads') },
      { key: 'ai',      label: 'Gerar conteúdo IA',          icon: <Sparkles  size={12} />, onClick: () => todoToast('IA — título / descrição / fotos / atributos') },
      { key: 'dup',     label: 'Duplicar (outro marketplace)', icon: <Copy size={12} />,    onClick: () => onDuplicate?.(p.id) ?? todoToast('Duplicar produto') },
      { key: 'delete',  label: 'Excluir',                    icon: <Trash2 size={12} />, tone: 'danger',
        onClick: () => onDelete?.(p.id) ?? todoToast('Excluir produto') },
    )
    return acts
  }, [router, onToggleStatus, onDuplicate, onDelete])

  const quickFilterProp: QuickFilter = {
    label:    'Filtro',
    value:    quickFilter,
    options:  QUICK_OPTIONS,
    onChange: v => { setQuickFilter(v as QuickFilterValue); setPage(1); setSelected([]) },
  }

  return (
    <DataTable<ProdutoRow>
      title="Produtos (DataTable beta)"
      breadcrumb={['Catálogo']}
      quickFilter={quickFilterProp}
      columns={columns}
      data={paged}
      totalCount={total}
      loading={loading}
      getRowId={p => p.id}
      onRowClick={p => router.push(`/dashboard/produtos/${p.id}/editar`)}
      pagination={{
        page, perPage,
        onPageChange:    setPage,
        onPerPageChange: pp => { setPerPage(pp); setPage(1) },
      }}
      search={{
        value: search,
        placeholder: 'Buscar por nome, SKU ou marca…',
        onChange: v => { setSearch(v); setPage(1) },
      }}
      selection={{ mode: 'multi', selected, onChange: setSelected }}
      bulkActions={bulkActions}
      rowActions={rowActions}
      emptyState={{
        icon: <SearchIcon size={20} />,
        title: 'Nenhum produto encontrado',
        description: search ? 'Tente outra busca.' : 'O catálogo está vazio. Importe do ML pra começar.',
      }}
      headerExtras={(onRefresh || isServerMode) && (
        <button onClick={() => { onRefresh?.(); void refetch() }}
          className="text-[11px] px-3 py-2 rounded-xl font-semibold transition-colors"
          style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>
          Atualizar
        </button>
      )}
    />
  )
}
