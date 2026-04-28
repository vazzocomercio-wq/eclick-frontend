'use client'

import { useMemo, useState } from 'react'
import { DataTable } from '@/components/data-table'
import type { Column, RowAction, QuickFilter } from '@/components/data-table'
import {
  Eye, Send, Truck, AlertOctagon, Printer,
  Search as SearchIcon,
} from 'lucide-react'
import { todoToast } from '@/hooks/useToast'

/** Subset do MOrder de page.tsx — só os campos que a tabela usa.
 * Quando Sprint B consolidar, vira import único. */
export type PedidoRow = {
  order_id:     number
  status:       string
  date_created: string
  date_closed:  string | null
  total_amount: number
  lucro_bruto:  number | null
  buyer: {
    id:         number | null
    nickname:   string | null
    first_name: string | null
    last_name:  string | null
    full_name:  string | null
    doc_number: string | null
  }
  order_items: Array<{
    item_id:    string | null
    title:      string | null
    seller_sku: string | null
    quantity:   number
    thumbnail:  string | null
  }>
  shipping: {
    status:    string | null
    substatus: string | null
  } | null
  mediations: unknown[]
}

const brl = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Status badges (ML order.status + shipping.status combinados) ───────────────
type StatusMeta = { label: string; color: string; bg: string }

function statusMeta(o: PedidoRow): StatusMeta {
  // Cancelamento / mediação têm prioridade visual
  if (o.status === 'cancelled')      return { label: 'Cancelado',  color: '#f87171', bg: 'rgba(248,113,113,0.10)' }
  if (o.mediations && o.mediations.length > 0)
                                      return { label: 'Reclamação', color: '#fb923c', bg: 'rgba(251,146,60,0.10)' }
  const ss = o.shipping?.status
  if (ss === 'delivered')             return { label: 'Entregue',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' }
  if (ss === 'shipped' || ss === 'in_transit' || ss === 'handling')
                                      return { label: 'A caminho',  color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' }
  if (ss === 'ready_to_ship' || ss === 'pending')
                                      return { label: 'Enviado',    color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' }
  if (o.status === 'paid' || o.status === 'partially_paid')
                                      return { label: 'Pago',       color: '#4ade80', bg: 'rgba(74,222,128,0.10)' }
  if (o.status === 'payment_required' || o.status === 'payment_in_process')
                                      return { label: 'Pgto. pend.', color: '#facc15', bg: 'rgba(250,204,21,0.10)' }
  return { label: o.status ?? '—',     color: '#a1a1aa', bg: 'rgba(161,161,170,0.10)' }
}

type QuickFilterValue = 'all' | 'paid' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled' | 'mediation'

const QUICK_OPTIONS: { value: QuickFilterValue; label: string }[] = [
  { value: 'all',         label: 'Todos' },
  { value: 'paid',        label: 'Pago' },
  { value: 'shipped',     label: 'Enviado' },
  { value: 'in_transit',  label: 'A caminho' },
  { value: 'delivered',   label: 'Entregue' },
  { value: 'cancelled',   label: 'Cancelado' },
  { value: 'mediation',   label: 'Reclamação' },
]

function applyQuickFilter(o: PedidoRow, qf: QuickFilterValue): boolean {
  switch (qf) {
    case 'all':        return true
    case 'paid':       return o.status === 'paid' || o.status === 'partially_paid'
    case 'shipped':    return o.shipping?.status === 'ready_to_ship' || o.shipping?.status === 'pending'
    case 'in_transit': return ['shipped','in_transit','handling'].includes(o.shipping?.status ?? '')
    case 'delivered':  return o.shipping?.status === 'delivered'
    case 'cancelled':  return o.status === 'cancelled'
    case 'mediation':  return (o.mediations?.length ?? 0) > 0
  }
}

function clientName(o: PedidoRow): string {
  if (o.buyer.full_name) return o.buyer.full_name
  const composed = [o.buyer.first_name, o.buyer.last_name].filter(Boolean).join(' ').trim()
  if (composed) return composed
  return o.buyer.nickname ? `@${o.buyer.nickname}` : `#${o.buyer.id ?? '?'}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

/** DataTable view do /pedidos (Sprint B bloco 1). Read-only — drawer
 * com OrderCard vem no Bloco 2; row actions wirados no Bloco 2/3.
 * onViewDetails é o hook que o Bloco 2 vai usar pra abrir o drawer. */
export function PedidosTable({
  orders,
  loading = false,
  onRefresh,
  onViewDetails,
}: {
  orders:         PedidoRow[]
  loading?:       boolean
  onRefresh?:     () => void
  /** Hook pro Bloco 2 — quando definido, click em row chama isto em
   * vez de navegar. Por ora o bloco 1 só passa stub via todoToast. */
  onViewDetails?: (order: PedidoRow) => void
}) {
  const [page,    setPage]    = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [search,  setSearch]  = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilterValue>('all')
  const [selected, setSelected] = useState<string[]>([])

  const filtered = useMemo(() => {
    let arr = orders.filter(o => applyQuickFilter(o, quickFilter))
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      arr = arr.filter(o =>
        String(o.order_id).includes(s) ||
        clientName(o).toLowerCase().includes(s) ||
        (o.buyer.nickname ?? '').toLowerCase().includes(s) ||
        (o.order_items[0]?.title ?? '').toLowerCase().includes(s) ||
        (o.order_items[0]?.seller_sku ?? '').toLowerCase().includes(s),
      )
    }
    return arr
  }, [orders, search, quickFilter])

  const paged = useMemo(() => {
    const start = (page - 1) * perPage
    return filtered.slice(start, start + perPage)
  }, [filtered, page, perPage])

  const columns: Column<PedidoRow>[] = useMemo(() => [
    {
      key: 'date', label: 'Data', width: '64px',
      render: o => <span className="text-[11px] text-zinc-400 tabular-nums">{fmtDate(o.date_closed ?? o.date_created)}</span>,
    },
    {
      key: 'cliente', label: 'Cliente',
      render: o => (
        <div className="min-w-0">
          <p className="text-zinc-100 text-xs font-medium truncate max-w-[200px]">{clientName(o)}</p>
          {o.buyer.nickname && (
            <p className="text-[10px] text-zinc-600 font-mono">@{o.buyer.nickname}</p>
          )}
        </div>
      ),
    },
    {
      key: 'produto', label: 'Produto',
      render: o => {
        const item = o.order_items[0]
        const more = o.order_items.length - 1
        return (
          <div className="flex items-center gap-2 min-w-0">
            {item?.thumbnail
              ? <img src={item.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0" style={{ border: '1px solid #1e1e24' }} />
              : <div className="w-10 h-10 rounded shrink-0" style={{ background: '#0c0c10', border: '1px solid #1e1e24' }} />}
            <div className="min-w-0">
              <p className="text-[11px] text-zinc-200 truncate max-w-[260px]" title={item?.title ?? undefined}>
                {item?.title ? truncate(item.title, 40) : '—'}
              </p>
              <p className="text-[10px] text-zinc-600 font-mono">
                {item?.seller_sku ?? '—'}{item && item.quantity > 1 ? ` · ${item.quantity}u` : ''}
                {more > 0 ? ` · +${more} item${more > 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'marketplace', label: 'MP', width: '50px',
      render: () => (
        // /pedidos hoje é ML-only (sync via /orders/search). Quando Shopee/
        // Amazon entrarem, ler de o.platform/o.source na PedidoRow.
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#FFE600', color: '#111' }}>ML</span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: o => {
        const m = statusMeta(o)
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ color: m.color, background: m.bg }}>{m.label}</span>
        )
      },
    },
    {
      key: 'total', label: 'Total', align: 'right', sortable: true,
      render: o => <span className="text-xs font-semibold tabular-nums" style={{ color: '#00E5FF' }}>{brl(o.total_amount)}</span>,
    },
    {
      key: 'lucro', label: 'Lucro', align: 'right', sortable: true,
      render: o => {
        const v = o.lucro_bruto
        const color = v == null ? '#52525b' : v > 0 ? '#4ade80' : v < 0 ? '#f87171' : '#a1a1aa'
        return <span className="text-xs font-semibold tabular-nums" style={{ color }}>{brl(v)}</span>
      },
    },
  ], [])

  const rowActions = useMemo(() => (o: PedidoRow): RowAction<PedidoRow>[] => [
    { key: 'view',     label: 'Ver detalhes',         icon: <Eye          size={12} />,
      onClick: () => { onViewDetails ? onViewDetails(o) : todoToast('Drawer de detalhes do pedido') } },
    { key: 'tracking', label: 'Acompanhar rastreio',  icon: <Truck        size={12} />,
      onClick: () => todoToast('Timeline Correios') },
    { key: 'wa',       label: 'Disparar WhatsApp',    icon: <Send         size={12} />,
      onClick: () => todoToast('Mensagem WhatsApp ao comprador') },
    { key: 'problem',  label: 'Marcar problema',      icon: <AlertOctagon size={12} />, tone: 'warn',
      onClick: () => todoToast('Marcação de reclamação') },
    { key: 'label',    label: 'Reimprimir etiqueta',  icon: <Printer      size={12} />,
      onClick: () => todoToast('Reimpressão de etiqueta') },
  ], [onViewDetails])

  const quickFilterProp: QuickFilter = {
    label:    'Filtro',
    value:    quickFilter,
    options:  QUICK_OPTIONS,
    onChange: v => { setQuickFilter(v as QuickFilterValue); setPage(1); setSelected([]) },
  }

  return (
    <DataTable<PedidoRow>
      title="Pedidos (DataTable beta)"
      breadcrumb={['Marketplace']}
      quickFilter={quickFilterProp}
      columns={columns}
      data={paged}
      totalCount={filtered.length}
      loading={loading}
      getRowId={o => String(o.order_id)}
      onRowClick={o => { onViewDetails ? onViewDetails(o) : undefined }}
      pagination={{
        page, perPage,
        onPageChange:    setPage,
        onPerPageChange: pp => { setPerPage(pp); setPage(1) },
      }}
      search={{
        value: search,
        placeholder: 'Buscar por order ID, cliente, @nickname, produto ou SKU…',
        onChange: v => { setSearch(v); setPage(1) },
      }}
      selection={{ mode: 'multi', selected, onChange: setSelected }}
      rowActions={rowActions}
      emptyState={{
        icon: <SearchIcon size={20} />,
        title: 'Nenhum pedido encontrado',
        description: search ? 'Tente outra busca.' : 'Nenhum pedido nessa categoria no momento.',
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
