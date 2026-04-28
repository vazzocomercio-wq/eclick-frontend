'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/data-table'
import type { Column, RowAction } from '@/components/data-table'
import {
  Eye, Pause, Play, Copy, Trash2, Sparkles, Megaphone,
  Search as SearchIcon,
} from 'lucide-react'
import { todoToast } from '@/hooks/useToast'

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
export function ProdutosTable({
  products,
  loading = false,
  onRefresh,
  onToggleStatus,
  onDuplicate,
  onDelete,
}: {
  products:        ProdutoRow[]
  loading?:        boolean
  onRefresh?:      () => void
  onToggleStatus?: (id: string, next: 'active' | 'paused') => Promise<void> | void
  onDuplicate?:    (id: string) => Promise<void> | void
  onDelete?:       (id: string) => Promise<void> | void
}) {
  const router = useRouter()
  const [page,    setPage]    = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [search,  setSearch]  = useState('')
  const [selected, setSelected] = useState<string[]>([])

  // Filtro + paginação client-side neste bloco. Server-side virá no Bloco 4.
  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const s = search.trim().toLowerCase()
    return products.filter(p =>
      (p.name ?? '').toLowerCase().includes(s) ||
      (p.sku  ?? '').toLowerCase().includes(s) ||
      (p.brand ?? '').toLowerCase().includes(s),
    )
  }, [products, search])

  const paged = useMemo(() => {
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page, perPage])

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

  return (
    <DataTable<ProdutoRow>
      title="Produtos (DataTable beta)"
      breadcrumb={['Catálogo']}
      columns={columns}
      data={paged}
      totalCount={filtered.length}
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
      rowActions={rowActions}
      emptyState={{
        icon: <SearchIcon size={20} />,
        title: 'Nenhum produto encontrado',
        description: search ? 'Tente outra busca.' : 'O catálogo está vazio. Importe do ML pra começar.',
      }}
      headerExtras={onRefresh && (
        <button onClick={onRefresh}
          className="text-[11px] px-3 py-2 rounded-xl font-semibold transition-colors"
          style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>
          Atualizar
        </button>
      )}
    />
  )
}
