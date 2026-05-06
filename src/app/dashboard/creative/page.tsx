'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Sparkles, Loader2, Image as ImageIcon, Clock, CheckCircle2, AlertCircle, Search, X, ArrowDownAZ, ArrowDown } from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import CreativeUsageCard from '@/components/creative/CreativeUsageCard'
import type { CreativeProduct } from '@/components/creative/types'

type StatusFilter = 'all' | 'draft' | 'analyzing' | 'ready' | 'archived'
type SortOption   = 'recent' | 'name'

export default function CreativeListPage() {
  const [products, setProducts] = useState<CreativeProduct[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

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
            <Plus size={14} /> Novo produto
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
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
      <div className="inline-flex p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4">
        <Sparkles size={28} className="text-cyan-400" />
      </div>
      <h2 className="text-base font-semibold text-zinc-200">Nenhum produto criativo ainda</h2>
      <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
        Comece subindo a foto do seu primeiro produto. A IA cuida do resto.
      </p>
      <Link
        href="/dashboard/creative/new"
        className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold transition-all"
      >
        <Plus size={14} /> Criar primeiro produto
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

function ProductCard({ product }: { product: CreativeProduct }) {
  const status = product.status
  return (
    <Link
      href={`/dashboard/creative/${product.id}`}
      className="group block rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50 hover:border-cyan-400/40 hover:bg-zinc-900 transition-all"
    >
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
