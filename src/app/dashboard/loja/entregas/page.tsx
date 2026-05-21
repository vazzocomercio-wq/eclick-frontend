'use client'

/**
 * Entregas da loja própria — operação de tracking físico.
 *
 * Lista pedidos pagos com filtros por status de envio. Permite marcar
 * como Em preparação → Enviado (com carrier + tracking code) → Entregue.
 *
 * Endpoint admin:
 *   PATCH /storefront-orders/:id/shipping
 *     { shipping_status, shipping_carrier, tracking_code }
 *
 * Pra listar usa Supabase client direto (mais leve que /orders/list).
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Truck, Loader2, ChevronLeft, Search, X, Save, AlertCircle, Package,
  Check, Clock, MapPin, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

type ShippingStatus = 'pending' | 'preparing' | 'shipped' | 'in_transit' | 'delivered' | 'returned' | 'lost'

interface Order {
  id:               string
  store_slug:       string
  customer:         {
    name?: string; email?: string; phone?: string; doc?: string;
    address?: { zip?: string; street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string }
  }
  items:            Array<{ name?: string; qty?: number; price?: number }>
  total:            number
  status:           string
  shipping_status:  ShippingStatus
  shipping_carrier: string | null
  tracking_code:    string | null
  shipped_at:       string | null
  delivered_at:     string | null
  created_at:       string
  updated_at:       string
}

type Filter = 'all' | 'pending' | 'preparing' | 'shipped' | 'in_transit' | 'delivered' | 'returned'

const STATUS_LABELS: Record<ShippingStatus, string> = {
  pending:    'Aguardando',
  preparing:  'Em preparação',
  shipped:    'Enviado',
  in_transit: 'Em trânsito',
  delivered:  'Entregue',
  returned:   'Devolvido',
  lost:       'Perdido',
}

const STATUS_COLORS: Record<ShippingStatus, string> = {
  pending:    '#a1a1aa',
  preparing:  '#3b82f6',
  shipped:    '#06b6d4',
  in_transit: '#0ea5e9',
  delivered:  '#22c55e',
  returned:   '#f59e0b',
  lost:       '#ef4444',
}

const brl = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function EntregasPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Order | null>(null)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      let query = supabase
        .from('storefront_orders')
        .select('id, store_slug, customer, items, total, status, shipping_status, shipping_carrier, tracking_code, shipped_at, delivered_at, created_at, updated_at')
        .eq('status', 'paid')   // só pedidos pagos têm entrega
        .order('created_at', { ascending: false })
        .limit(200)

      if (filter !== 'all') {
        query = query.eq('shipping_status', filter)
      }

      const { data, error: err } = await query
      if (err) throw new Error(err.message)

      let list = (data ?? []) as unknown as Order[]
      // Filtro de texto client-side (email/id)
      if (q.trim()) {
        const lower = q.trim().toLowerCase()
        list = list.filter(o =>
          o.id.toLowerCase().includes(lower) ||
          (o.customer?.email ?? '').toLowerCase().includes(lower) ||
          (o.customer?.name ?? '').toLowerCase().includes(lower) ||
          (o.tracking_code ?? '').toLowerCase().includes(lower),
        )
      }

      setOrders(list)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filter, q])

  useEffect(() => { void load() }, [load])

  const quickAction = async (order: Order, status: ShippingStatus) => {
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/storefront-orders/${order.id}/shipping`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipping_status: status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  // Contadores por status (a partir do load atual)
  const countsByStatus: Record<Filter, number> = {
    all:        orders.length,
    pending:    orders.filter(o => o.shipping_status === 'pending').length,
    preparing:  orders.filter(o => o.shipping_status === 'preparing').length,
    shipped:    orders.filter(o => o.shipping_status === 'shipped').length,
    in_transit: orders.filter(o => o.shipping_status === 'in_transit').length,
    delivered:  orders.filter(o => o.shipping_status === 'delivered').length,
    returned:   orders.filter(o => o.shipping_status === 'returned').length,
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
          <Truck size={24} /> Entregas
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Operação de envio dos pedidos da loja própria · marca status + adiciona código de rastreio
        </p>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'pending', 'preparing', 'shipped', 'in_transit', 'delivered', 'returned'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{
              background: filter === f ? (f === 'all' ? '#00E5FF' : STATUS_COLORS[f as ShippingStatus]) : '#0a0a0e',
              color:      filter === f ? '#0a0a0e' : '#fafafa',
              border:     `1px solid ${filter === f ? (f === 'all' ? '#00E5FF' : STATUS_COLORS[f as ShippingStatus]) : '#27272a'}`,
              minHeight: 36,
            }}>
            {f === 'all' ? 'Todos' : STATUS_LABELS[f as ShippingStatus]}
            {countsByStatus[f] > 0 && (
              <span className="opacity-80">({countsByStatus[f]})</span>
            )}
          </button>
        ))}
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por email, nome, ID ou tracking..."
            className="w-full text-sm pl-9 pr-3 py-2 rounded-lg outline-none"
            style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 36 }}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500">
          <Loader2 className="animate-spin inline-block" size={20} />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <Package size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">
            {filter === 'all' ? 'Nenhum pedido pago da loja própria ainda' : `Nenhum pedido com status "${STATUS_LABELS[filter as ShippingStatus] ?? filter}"`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <OrderRow
              key={o.id}
              order={o}
              onOpen={() => setEditing(o)}
              onQuickAction={(s) => quickAction(o, s)}
            />
          ))}
        </div>
      )}

      {editing && (
        <ShippingModal
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load() }}
          fetchToken={fetchToken}
        />
      )}
    </div>
  )
}

function OrderRow({ order, onOpen, onQuickAction }: {
  order: Order
  onOpen: () => void
  onQuickAction: (status: ShippingStatus) => void
}) {
  const status = order.shipping_status
  const color = STATUS_COLORS[status]
  const label = STATUS_LABELS[status]
  const itemCount = order.items?.length ?? 0
  const customerName = order.customer?.name ?? '—'
  const city = order.customer?.address?.city
  const state = order.customer?.address?.state

  const nextAction: { label: string; status: ShippingStatus; color: string } | null = (() => {
    if (status === 'pending')    return { label: '✓ Preparar',  status: 'preparing', color: '#3b82f6' }
    if (status === 'preparing')  return { label: '📦 Enviar',    status: 'shipped',   color: '#06b6d4' }
    if (status === 'shipped' || status === 'in_transit')
                                  return { label: '✅ Entregue', status: 'delivered', color: '#22c55e' }
    return null
  })()

  return (
    <div className="rounded-lg p-3 grid gap-3 items-center"
      style={{
        background: '#0a0a0e',
        border: `1px solid ${color}30`,
        gridTemplateColumns: 'auto 1fr auto auto',
      }}>
      {/* Badge status */}
      <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded whitespace-nowrap"
        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
        {label}
      </span>

      {/* Info do pedido */}
      <div className="min-w-0">
        <p className="text-sm text-zinc-100 line-clamp-1">
          <strong>{customerName}</strong>
          <span className="text-zinc-500"> · {itemCount} {itemCount === 1 ? 'item' : 'itens'} · {brl(order.total)}</span>
        </p>
        <p className="text-[11px] text-zinc-500 line-clamp-1">
          #{order.id.slice(0, 8)}
          {city && state && (
            <> · <MapPin size={9} className="inline" /> {city}, {state}</>
          )}
          {order.tracking_code && (
            <> · <strong className="text-zinc-300">{order.tracking_code}</strong> ({order.shipping_carrier})</>
          )}
          <> · <Clock size={9} className="inline" /> {new Date(order.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</>
        </p>
      </div>

      {/* Quick action */}
      {nextAction && (
        <button
          onClick={() => onQuickAction(nextAction.status)}
          className="text-xs px-3 py-2 rounded font-semibold whitespace-nowrap"
          style={{
            background: `${nextAction.color}15`,
            color: nextAction.color,
            border: `1px solid ${nextAction.color}40`,
            minHeight: 36,
          }}>
          {nextAction.label}
        </button>
      )}

      {/* Editar */}
      <button
        onClick={onOpen}
        className="text-xs px-3 py-2 rounded font-medium"
        style={{ background: '#18181b', color: '#fafafa', border: '1px solid #27272a', minHeight: 36 }}>
        Detalhes
      </button>
    </div>
  )
}

function ShippingModal({ order, onClose, onSaved, fetchToken }: {
  order: Order
  onClose: () => void
  onSaved: () => void
  fetchToken: () => Promise<string | undefined>
}) {
  const [status, setStatus]   = useState<ShippingStatus>(order.shipping_status)
  const [carrier, setCarrier] = useState(order.shipping_carrier ?? '')
  const [code, setCode]       = useState(order.tracking_code ?? '')
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setErr(null)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/storefront-orders/${order.id}/shipping`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipping_status:  status,
          shipping_carrier: carrier.trim() || null,
          tracking_code:    code.trim() || null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved()
    } catch (e) {
      setErr((e as Error).message)
    } finally { setSaving(false) }
  }

  const c = order.customer ?? {}
  const addr = c.address ?? {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-xl rounded-lg p-5 max-h-[90vh] overflow-y-auto" style={{ background: '#09090b', border: '1px solid #27272a' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Atualizar entrega</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Pedido #{order.id.slice(0, 8)} · {brl(order.total)}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100" style={{ minHeight: 44, minWidth: 44 }}>
            <X size={20} />
          </button>
        </div>

        {err && (
          <div className="mb-4 p-2.5 rounded text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
            {err}
          </div>
        )}

        {/* Dados do cliente */}
        <div className="rounded p-3 mb-4 text-xs" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
          <p className="text-zinc-100 font-semibold mb-1">{c.name ?? '—'}</p>
          <p className="text-zinc-500">{c.email ?? '—'}{c.phone && ` · ${c.phone}`}</p>
          {(addr.street || addr.city) && (
            <p className="text-zinc-400 mt-2">
              {[addr.street, addr.number, addr.complement, addr.neighborhood].filter(Boolean).join(', ')}
              <br />
              {[addr.city, addr.state].filter(Boolean).join(' / ')}
              {addr.zip && ` · CEP ${addr.zip}`}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-400 mb-2">Status</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['pending', 'preparing', 'shipped', 'in_transit', 'delivered', 'returned', 'lost'] as ShippingStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className="text-xs px-2 py-2 rounded font-medium transition-all"
                style={{
                  background: status === s ? `${STATUS_COLORS[s]}20` : '#0a0a0e',
                  color: status === s ? STATUS_COLORS[s] : '#a1a1aa',
                  border: `1px solid ${status === s ? STATUS_COLORS[s] : '#27272a'}`,
                  minHeight: 44,
                }}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Carrier + tracking */}
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Transportadora</label>
            <input
              value={carrier}
              onChange={e => setCarrier(e.target.value)}
              placeholder="Correios, Jadlog, etc"
              className="w-full text-sm px-3 py-2 rounded outline-none"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Código de rastreio</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Ex: BR123456789BR"
              className="w-full text-sm px-3 py-2 rounded outline-none font-mono"
              style={{ background: '#0a0a0e', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}
            />
          </div>
        </div>

        {/* Histórico */}
        {(order.shipped_at || order.delivered_at) && (
          <div className="rounded p-3 mb-4 text-xs space-y-1" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            {order.shipped_at && (
              <p className="text-zinc-400">
                <Check size={11} className="inline mr-1" style={{ color: '#06b6d4' }} />
                Enviado em {new Date(order.shipped_at).toLocaleString('pt-BR')}
              </p>
            )}
            {order.delivered_at && (
              <p className="text-zinc-400">
                <Check size={11} className="inline mr-1" style={{ color: '#22c55e' }} />
                Entregue em {new Date(order.delivered_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {/* Link público pro cliente */}
        <p className="text-xs text-zinc-500 mb-4">
          <Link href={`/loja/${order.store_slug}/pedido/${order.id}/sucesso`}
            target="_blank" className="hover:underline inline-flex items-center gap-1">
            <ExternalLink size={11} /> Ver página pública do pedido
          </Link>
        </p>

        <div className="flex gap-2 mt-5">
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={saving}
            className="text-sm px-4 py-2 rounded font-medium disabled:opacity-50"
            style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', minHeight: 44 }}>
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-sm px-4 py-2 rounded font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 44 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
