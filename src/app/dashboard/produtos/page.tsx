'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ── types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string
  name: string
  sku: string | null
  brand: string | null
  price: number | null
  stock: number | null
  status: 'draft' | 'active' | 'paused'
  platforms: string[]
  photo_urls: string[] | null
  ml_title: string | null
  condition: string | null
  category: string | null
  created_at: string
}

// ── helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_META: Record<string, { abbr: string; bg: string; fg: string }> = {
  mercadolivre: { abbr: 'ML', bg: '#FFE600', fg: '#111' },
  shopee:       { abbr: 'SH', bg: '#EE4D2D', fg: '#fff' },
  amazon:       { abbr: 'AZ', bg: '#FF9900', fg: '#111' },
  magalu:       { abbr: 'MG', bg: '#0086FF', fg: '#fff' },
}

const STATUS_META = {
  active: { label: 'Ativo',    bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
  draft:  { label: 'Rascunho', bg: 'rgba(161,161,170,0.12)', color: '#a1a1aa' },
  paused: { label: 'Pausado',  bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
}

function fmt(price: number | null) {
  if (price == null) return '—'
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── product card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onDelete,
}: {
  product: Product
  onDelete: (id: string) => void
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const status = STATUS_META[product.status] ?? STATUS_META.draft
  const cover = product.photo_urls?.[0] ?? null

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('products').delete().eq('id', product.id)
    onDelete(product.id)
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden flex flex-col transition-all group"
      style={{ background: '#111114', borderColor: '#1e1e24' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,229,255,0.15)')}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#1e1e24'
        setConfirmDelete(false)
      }}
    >
      {/* Photo */}
      <div className="relative h-44 shrink-0 overflow-hidden"
        style={{ background: '#1c1c1f' }}>
        {cover ? (
          <img src={cover} alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.25}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}

        {/* Status badge */}
        <span className="absolute top-3 left-3 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: status.bg, color: status.color }}>
          {status.label}
        </span>

        {/* Platform badges */}
        {product.platforms?.length > 0 && (
          <div className="absolute top-3 right-3 flex gap-1">
            {product.platforms.map(p => {
              const m = PLATFORM_META[p]
              if (!m) return null
              return (
                <span key={p} className="text-[9px] font-black w-5 h-5 rounded-md flex items-center justify-center"
                  style={{ background: m.bg, color: m.fg }}>
                  {m.abbr}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        <div>
          <p className="text-white text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
          {product.sku && (
            <p className="text-zinc-600 text-[11px] mt-1 font-mono">SKU: {product.sku}</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div>
            <p className="text-[#00E5FF] font-bold text-base leading-tight">{fmt(product.price)}</p>
            <p className="text-zinc-600 text-[11px] mt-0.5">
              {product.stock ?? 0} em estoque
            </p>
          </div>
          {product.brand && (
            <span className="text-[11px] text-zinc-500 px-2 py-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              {product.brand}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={() => router.push(`/dashboard/produtos/${product.id}/editar`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium border transition-all"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa', background: 'transparent' }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#00E5FF'
            e.currentTarget.style.color = '#00E5FF'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#3f3f46'
            e.currentTarget.style.color = '#a1a1aa'
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </button>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all disabled:opacity-50"
          style={{
            borderColor: confirmDelete ? '#f87171' : '#3f3f46',
            color: confirmDelete ? '#f87171' : '#71717a',
            background: confirmDelete ? 'rgba(248,113,113,0.08)' : 'transparent',
          }}
        >
          {deleting
            ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            : confirmDelete
              ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          }
          {confirmDelete ? 'Confirmar' : 'Excluir'}
        </button>
      </div>
    </div>
  )
}

// ── skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="rounded-2xl border overflow-hidden animate-pulse"
      style={{ background: '#111114', borderColor: '#1e1e24' }}>
      <div className="h-44" style={{ background: '#1c1c1f' }} />
      <div className="p-4 space-y-3">
        <div className="h-4 rounded-lg w-3/4" style={{ background: '#1e1e24' }} />
        <div className="h-3 rounded-lg w-1/3" style={{ background: '#1e1e24' }} />
        <div className="h-5 rounded-lg w-1/2 mt-2" style={{ background: '#1e1e24' }} />
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <div className="flex-1 h-8 rounded-lg" style={{ background: '#1e1e24' }} />
        <div className="w-20 h-8 rounded-lg" style={{ background: '#1e1e24' }} />
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    // Get org_id for the current user
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .maybeSingle()

    if (!member) {
      setLoading(false)
      setError('Organização não encontrada.')
      return
    }

    const { data, error: err } = await supabase
      .from('products')
      .select('id,name,sku,brand,price,stock,status,platforms,photo_urls,ml_title,condition,category,created_at')
      .eq('organization_id', member.organization_id)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setProducts(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function handleDelete(id: string) {
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  // Filtered list
  const filtered = products.filter(p => {
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.brand ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-semibold">Produtos</h2>
          <p className="text-zinc-500 text-sm mt-0.5">
            {loading ? 'Carregando…' : `${products.length} produto${products.length !== 1 ? 's' : ''} no catálogo`}
          </p>
        </div>
        <Link
          href="/dashboard/produtos/novo"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
          style={{ background: '#00E5FF', color: '#000' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Produto
        </Link>
      </div>

      {/* Filters */}
      {!loading && products.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nome, SKU ou marca…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder-zinc-600 border border-[#3f3f46] outline-none transition-all focus:border-[#00E5FF]"
              style={{ background: '#111114' }}
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'active', 'draft', 'paused'] as const).map(s => {
              const labels = { all: 'Todos', active: 'Ativos', draft: 'Rascunhos', paused: 'Pausados' }
              const active = filterStatus === s
              return (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className="px-3 py-2 rounded-lg text-[12px] font-medium border transition-all"
                  style={{
                    background: active ? 'rgba(0,229,255,0.08)' : 'transparent',
                    borderColor: active ? '#00E5FF' : '#3f3f46',
                    color: active ? '#00E5FF' : '#71717a',
                  }}>
                  {labels[s]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl border text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.2)', color: '#f87171' }}>
          Erro ao carregar produtos: {error}
          <button onClick={load} className="ml-3 underline">Tentar novamente</button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && products.length === 0 && !error && (
        <div className="rounded-2xl border flex flex-col items-center justify-center py-20"
          style={{ background: '#111114', borderColor: '#1e1e24' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,229,255,0.08)' }}>
            <svg className="w-7 h-7" fill="none" stroke="#00E5FF" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-white font-semibold text-base mb-1">Nenhum produto cadastrado</p>
          <p className="text-zinc-500 text-sm mb-6 text-center max-w-xs">
            Adicione produtos ao seu catálogo para começar a monitorar preços e concorrentes.
          </p>
          <Link href="/dashboard/produtos/novo"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: '#00E5FF', color: '#000' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Cadastrar primeiro produto
          </Link>
        </div>
      )}

      {/* No search results */}
      {!loading && products.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border flex flex-col items-center justify-center py-16"
          style={{ background: '#111114', borderColor: '#1e1e24' }}>
          <p className="text-zinc-400 text-sm">Nenhum produto encontrado para <strong className="text-white">"{search}"</strong></p>
          <button onClick={() => { setSearch(''); setFilterStatus('all') }}
            className="mt-3 text-[12px] font-medium"
            style={{ color: '#00E5FF' }}>
            Limpar filtros
          </button>
        </div>
      )}

      {/* Product grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
