'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Sparkles, Loader2, Image as ImageIcon, Clock, CheckCircle2, AlertCircle, Search, X, ArrowDownAZ, ArrowDown, Trash2, Archive } from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import CreativeUsageCard from '@/components/creative/CreativeUsageCard'
import type { CreativeProduct } from '@/components/creative/types'
import { useConfirm, useAlert } from '@/components/ui/dialog-provider'

type StatusFilter = 'all' | 'draft' | 'analyzing' | 'ready' | 'archived'
type SortOption   = 'recent' | 'name'

export default function CreativeListPage() {
  const [products, setProducts] = useState<CreativeProduct[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const confirmDialog = useConfirm()
  const alertDialog   = useAlert()

  // Filtros
  const [search, setSearch]   = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus]   = useState<StatusFilter>('all')
  const [sort, setSort]       = useState<SortOption>('recent')

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, status, sort])

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const list = await CreativeApi.listProducts({
        search: debounced || undefined,
        status: status === 'all' ? undefined : status,
        sort,
        include_archived: status === 'archived',
      })
      setProducts(list)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // ── Seleção & bulk archive ────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function handleBulkArchive() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const names = products.filter(p => selected.has(p.id)).map(p => `· ${p.name}`).join('\n')
    const ok = await confirmDialog({
      title:        `Arquivar ${ids.length} produto${ids.length > 1 ? 's' : ''}`,
      message: (
        <div>
          <p className="mb-2">Os produtos selecionados serão arquivados — saem da listagem principal mas o histórico (briefings, imagens, listings) é preservado:</p>
          <pre className="text-xs text-zinc-400 max-h-40 overflow-y-auto bg-zinc-900/50 p-2 rounded whitespace-pre-wrap">{names}</pre>
        </div>
      ),
      confirmLabel: `Arquivar ${ids.length}`,
      variant:      'danger',
    })
    if (!ok) return
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(
        ids.map(id => CreativeApi.archiveProduct(id)),
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed > 0) {
        await alertDialog({
          title:   'Atenção',
          message: `${failed} produto${failed > 1 ? 's' : ''} não pôde ser arquivado. Os outros foram processados normalmente.`,
          variant: 'warning',
        })
      }
      clearSelection()
      await load()
    } catch (e) {
      await alertDialog({ title: 'Erro', message: (e as Error).message, variant: 'danger' })
    } finally {
      setBulkBusy(false)
    }
  }

  const hasFilters = !!debounced || status !== 'all' || sort !== 'recent'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-cyan-400" />
            <h1 className="text-lg font-semibold">IA Criativo</h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
              BETA
            </span>
          </div>
          <Link
            href="/dashboard/creative/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold transition-all shadow-[0_0_12px_rgba(0,229,255,0.25)]"
          >
            <Plus size={14} /> Novo anúncio
          </Link>
        </header>

        <p className="text-sm text-zinc-400 mb-6 max-w-2xl">
          Esteira completa de criação de anúncios. Suba uma imagem do produto e a IA
          gera título, descrição, bullets, ficha técnica e palavras-chave otimizados
          pro marketplace que você escolher.
        </p>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <CreativeUsageCard />

        {/* Filtros */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, SKU ou marca…"
              className="w-full pl-8 pr-8 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="flex gap-1">
            {([
              { value: 'all',       label: 'Todos' },
              { value: 'ready',     label: 'Prontos' },
              { value: 'draft',     label: 'Rascunhos' },
              { value: 'analyzing', label: 'Analisando' },
              { value: 'archived',  label: 'Arquivados' },
            ] as const).map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setStatus(o.value)}
                className={[
                  'px-2.5 py-1 rounded-full text-[11px] transition-all',
                  status === o.value
                    ? 'bg-cyan-400 text-black font-semibold'
                    : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700',
                ].join(' ')}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <button
            type="button"
            onClick={() => setSort(s => s === 'recent' ? 'name' : 'recent')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-zinc-950 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
            title={sort === 'recent' ? 'Ordenado por mais recente — clique pra mudar' : 'Ordenado por nome — clique pra mudar'}
          >
            {sort === 'recent' ? <ArrowDown size={11} /> : <ArrowDownAZ size={11} />}
            {sort === 'recent' ? 'Recentes' : 'A-Z'}
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearch(''); setStatus('all'); setSort('recent') }}
              className="text-[11px] text-zinc-500 hover:text-red-400"
            >
              limpar filtros
            </button>
          )}

          {/* Result count */}
          <span className="text-[11px] text-zinc-500 ml-auto">
            {loading ? <Loader2 size={11} className="inline animate-spin" /> : `${products.length} resultado${products.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {loading && products.length === 0 ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 size={14} className="animate-spin" /> Carregando produtos…
          </div>
        ) : products.length === 0 ? (
          hasFilters ? <NoResultsState /> : <EmptyState />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                selected={selected.has(p.id)}
                onToggleSelect={() => toggleSelect(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bulk actions floating bar */}
      {selected.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-30 max-w-[95vw]">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 shadow-2xl">
            <span className="text-sm font-medium text-zinc-100 whitespace-nowrap">
              {selected.size} selecionad{selected.size > 1 ? 'os' : 'o'}
            </span>
            <div className="h-5 w-px bg-zinc-800" />
            <button
              type="button"
              onClick={handleBulkArchive}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
              Arquivar
            </button>
            <div className="h-5 w-px bg-zinc-800" />
            <button
              type="button"
              onClick={clearSelection}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X size={12} /> Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
      <div className="inline-flex p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4">
        <Sparkles size={28} className="text-cyan-400" />
      </div>
      <h2 className="text-base font-semibold text-zinc-200">Nenhum anúncio ainda</h2>
      <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
        Comece subindo a foto do seu primeiro produto. A IA cuida do resto.
      </p>
      <Link
        href="/dashboard/creative/new"
        className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold transition-all"
      >
        <Plus size={14} /> Criar primeiro anúncio
      </Link>
    </div>
  )
}

function NoResultsState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
      <Search size={24} className="text-zinc-600 mx-auto mb-3" />
      <h2 className="text-sm font-semibold text-zinc-300">Nenhum produto encontrado</h2>
      <p className="text-xs text-zinc-500 mt-1">Tente ajustar os filtros ou a busca.</p>
    </div>
  )
}

function ProductCard({
  product, selected, onToggleSelect,
}: {
  product:         CreativeProduct
  selected:        boolean
  onToggleSelect:  () => void
}) {
  const status = product.status
  return (
    <div
      className={[
        'group block rounded-xl overflow-hidden border bg-zinc-900/50 transition-all',
        selected ? 'border-cyan-400 ring-2 ring-cyan-400/20' : 'border-zinc-800 hover:border-cyan-400/40 hover:bg-zinc-900',
      ].join(' ')}
    >
      <Link href={`/dashboard/creative/${product.id}`} className="block">
        <div className="aspect-square bg-zinc-950 relative overflow-hidden">
          {product.signed_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.signed_image_url}
              alt={product.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-700">
              <ImageIcon size={32} />
            </div>
          )}
          <StatusBadge status={status} />

          {/* Checkbox de seleção — top-left. Click NÃO navega. */}
          <button
            type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleSelect() }}
            aria-label={selected ? 'Desmarcar produto' : 'Selecionar produto'}
            className={[
              'absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all',
              selected
                ? 'bg-cyan-400 border-cyan-400 opacity-100'
                : 'bg-zinc-950/70 border-zinc-600 opacity-0 group-hover:opacity-100 hover:border-cyan-400',
            ].join(' ')}
          >
            {selected && (
              <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        </div>
        <div className="p-3">
          <h3 className="text-sm font-medium text-zinc-100 truncate" title={product.name}>
            {product.name}
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
            {product.category}{product.brand ? ` · ${product.brand}` : ''}
          </p>
        </div>
      </Link>
    </div>
  )
}

function StatusBadge({ status }: { status: CreativeProduct['status'] }) {
  const config: Record<CreativeProduct['status'], { icon: React.ReactNode; label: string; className: string }> = {
    draft:     { icon: <Clock size={10} />,        label: 'Rascunho',  className: 'bg-zinc-900 text-zinc-300 border-zinc-700' },
    analyzing: { icon: <Loader2 size={10} className="animate-spin" />, label: 'Analisando', className: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' },
    ready:     { icon: <CheckCircle2 size={10} />, label: 'Pronto',    className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' },
    archived:  { icon: <Clock size={10} />,        label: 'Arquivado', className: 'bg-zinc-900 text-zinc-500 border-zinc-700' },
  }
  const c = config[status]
  return (
    <span className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${c.className}`}>
      {c.icon} {c.label}
    </span>
  )
}
