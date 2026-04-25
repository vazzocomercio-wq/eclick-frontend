'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { RefreshCw, Search, Package, Truck, CheckCircle2, Clock, AlertTriangle, MapPin, ChevronDown } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

// ── types ─────────────────────────────────────────────────────────────────────

type ShipmentStatus =
  | 'pending' | 'handling' | 'ready_to_ship' | 'shipped'
  | 'delivered' | 'not_delivered' | 'cancelled' | string

type EnrichedOrder = {
  order_id: number
  status: string
  date_created: string
  total_amount: number
  buyer: { nickname: string | null; first_name: string | null; last_name: string | null }
  order_items: Array<{ title: string | null; quantity: number; thumbnail: string | null }>
  shipping: {
    id: number | null
    status: ShipmentStatus | null
    substatus: string | null
    logistic_type: string | null
    estimated_delivery_date: string | null
    posting_deadline: string | null
    receiver_address: {
      city: string | null
      state: string | null
      street_name: string | null
      street_number: string | null
      zip_code: string | null
    }
    base_cost: number
  }
}

// ── status config ─────────────────────────────────────────────────────────────

type StatusCfg = { label: string; color: string; bg: string; icon: React.ReactNode }

const STATUS_CFG: Record<string, StatusCfg> = {
  pending:       { label: 'Pendente',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: <Clock size={13} /> },
  handling:      { label: 'Preparando',    color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  icon: <Package size={13} /> },
  ready_to_ship: { label: 'Pronto p/ envio', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', icon: <Package size={13} /> },
  shipped:       { label: 'Enviado',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: <Truck size={13} /> },
  delivered:     { label: 'Entregue',      color: '#34d399', bg: 'rgba(52,211,153,0.1)', icon: <CheckCircle2 size={13} /> },
  not_delivered: { label: 'Não entregue',  color: '#f43f5e', bg: 'rgba(244,63,94,0.1)',  icon: <AlertTriangle size={13} /> },
  cancelled:     { label: 'Cancelado',     color: '#71717a', bg: 'rgba(113,113,122,0.1)',icon: <AlertTriangle size={13} /> },
}

function statusCfg(s: string | null): StatusCfg {
  return STATUS_CFG[s ?? ''] ?? { label: s ?? '—', color: '#71717a', bg: 'rgba(113,113,122,0.1)', icon: <Clock size={13} /> }
}

function logisticLabel(t: string | null) {
  const map: Record<string, string> = {
    fulfillment: 'Full',
    xd_drop_off: 'Flex',
    drop_off:    'Agência',
    cross_docking: 'Coleta',
    self_service: 'Self',
  }
  return map[t ?? ''] ?? (t ?? '—')
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000)
}

// ── filter keys ───────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'active' | 'delivered' | 'problem'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'Todos'         },
  { key: 'active',    label: 'Em andamento'  },
  { key: 'delivered', label: 'Entregues'     },
  { key: 'problem',   label: 'Atenção'       },
]

// ── OrderRow ──────────────────────────────────────────────────────────────────

function OrderRow({ o }: { o: EnrichedOrder }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = statusCfg(o.shipping?.status)
  const buyerName = [o.buyer?.first_name, o.buyer?.last_name].filter(Boolean).join(' ') || o.buyer?.nickname || '—'
  const item = o.order_items[0]
  const delivDays = daysUntil(o.shipping?.estimated_delivery_date)
  const isLate = delivDays !== null && delivDays < 0 && o.shipping?.status !== 'delivered'

  return (
    <>
      <tr
        className="border-b border-zinc-800/60 hover:bg-zinc-900/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        {/* item */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2.5">
            {item?.thumbnail
              ? <img src={item.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" style={{ border: '1px solid #2e2e33' }} />
              : <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ background: '#1c1c1f', border: '1px solid #2e2e33' }}>
                  <Package size={14} className="text-zinc-600" />
                </div>
            }
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate max-w-[200px]">{item?.title ?? '—'}</p>
              {o.order_items.length > 1 && (
                <p className="text-[10px] text-zinc-600">+{o.order_items.length - 1} item(s)</p>
              )}
            </div>
          </div>
        </td>

        {/* buyer */}
        <td className="py-3 px-4 text-sm text-zinc-400 max-w-[140px] truncate">{buyerName}</td>

        {/* status */}
        <td className="py-3 px-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full"
            style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.icon}{cfg.label}
          </span>
        </td>

        {/* logistic type */}
        <td className="py-3 px-4 text-xs text-zinc-500">{logisticLabel(o.shipping?.logistic_type)}</td>

        {/* estimated delivery */}
        <td className="py-3 px-4 text-sm">
          {o.shipping?.estimated_delivery_date ? (
            <span className={isLate ? 'text-red-400 font-semibold' : 'text-zinc-400'}>
              {fmtDate(o.shipping.estimated_delivery_date)}
              {delivDays !== null && o.shipping?.status !== 'delivered' && (
                <span className="ml-1 text-[10px]">
                  {isLate ? `${Math.abs(delivDays)}d atraso` : delivDays === 0 ? 'Hoje' : `${delivDays}d`}
                </span>
              )}
            </span>
          ) : <span className="text-zinc-700">—</span>}
        </td>

        {/* destination */}
        <td className="py-3 px-4 text-sm text-zinc-400">
          {o.shipping?.receiver_address?.city
            ? <span className="flex items-center gap-1"><MapPin size={11} />{o.shipping.receiver_address.city}/{o.shipping.receiver_address.state}</span>
            : <span className="text-zinc-700">—</span>}
        </td>

        {/* value */}
        <td className="py-3 px-4 text-sm font-semibold text-white tabular-nums text-right">{brl(o.total_amount)}</td>

        <td className="py-3 px-4 text-zinc-600"><ChevronDown size={13} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} /></td>
      </tr>

      {expanded && (
        <tr className="border-b border-zinc-800/40">
          <td colSpan={8} className="px-4 pb-3 pt-1">
            <div className="rounded-xl px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <p className="text-zinc-600 mb-0.5">Pedido #</p>
                <p className="text-zinc-300 font-semibold">{o.order_id}</p>
              </div>
              <div>
                <p className="text-zinc-600 mb-0.5">Data do pedido</p>
                <p className="text-zinc-300">{fmtDate(o.date_created)}</p>
              </div>
              <div>
                <p className="text-zinc-600 mb-0.5">Substatus</p>
                <p className="text-zinc-300">{o.shipping?.substatus ?? '—'}</p>
              </div>
              <div>
                <p className="text-zinc-600 mb-0.5">Prazo postagem</p>
                <p className="text-zinc-300">{fmtDate(o.shipping?.posting_deadline ?? null)}</p>
              </div>
              {o.shipping?.receiver_address?.zip_code && (
                <div className="col-span-2">
                  <p className="text-zinc-600 mb-0.5">Endereço</p>
                  <p className="text-zinc-300">
                    {[o.shipping.receiver_address.street_name, o.shipping.receiver_address.street_number,
                      o.shipping.receiver_address.city, o.shipping.receiver_address.state,
                      o.shipping.receiver_address.zip_code].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-zinc-600 mb-0.5">Frete cobrado</p>
                <p className="text-zinc-300">{brl(o.shipping?.base_cost ?? 0)}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function LogisticaPage() {
  const [orders,      setOrders]      = useState<EnrichedOrder[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total,       setTotal]       = useState(0)
  const [offset,      setOffset]      = useState(0)
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState<FilterKey>('all')

  const PAGE = 50

  const fetchOrders = useCallback(async (off: number, append = false) => {
    const token = await getToken()
    if (!token) return
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ offset: String(off), limit: String(PAGE) })
      const res = await fetch(`${BACKEND}/ml/orders/enriched?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const body: { orders: EnrichedOrder[]; total: number } = await res.json()
      setTotal(body.total)
      setOrders(prev => append ? [...prev, ...body.orders] : body.orders)
      setOffset(off + body.orders.length)
    } catch { /* non-fatal */ }
    finally { setLoading(false); setLoadingMore(false) }
  }, [])

  useEffect(() => { fetchOrders(0) }, [fetchOrders])

  // counts for filter pills
  const counts = useMemo(() => ({
    all:       orders.length,
    active:    orders.filter(o => ['pending','handling','ready_to_ship','shipped'].includes(o.shipping?.status ?? '')).length,
    delivered: orders.filter(o => o.shipping?.status === 'delivered').length,
    problem:   orders.filter(o => o.shipping?.status === 'not_delivered' || (daysUntil(o.shipping?.estimated_delivery_date) ?? 0) < 0 && o.shipping?.status !== 'delivered').length,
  }), [orders])

  const filtered = useMemo(() => {
    let r = orders
    switch (filter) {
      case 'active':    r = r.filter(o => ['pending','handling','ready_to_ship','shipped'].includes(o.shipping?.status ?? '')); break
      case 'delivered': r = r.filter(o => o.shipping?.status === 'delivered'); break
      case 'problem':   r = r.filter(o => o.shipping?.status === 'not_delivered' || ((daysUntil(o.shipping?.estimated_delivery_date) ?? 0) < 0 && o.shipping?.status !== 'delivered')); break
    }
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(o =>
        o.order_items.some(i => (i.title ?? '').toLowerCase().includes(q)) ||
        (o.buyer?.nickname ?? '').toLowerCase().includes(q) ||
        (o.shipping?.receiver_address?.city ?? '').toLowerCase().includes(q) ||
        String(o.order_id).includes(q)
      )
    }
    return r
  }, [orders, filter, search])

  // status breakdown KPIs
  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of orders) {
      const s = o.shipping?.status ?? 'unknown'
      map[s] = (map[s] ?? 0) + 1
    }
    return map
  }, [orders])

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: '#e4e4e7' }}>
      {/* header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Logística</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Rastreamento e status de envio dos pedidos</p>
        </div>
        <button onClick={() => fetchOrders(0)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* status breakdown pills */}
      {!loading && Object.keys(statusBreakdown).length > 0 && (
        <div className="flex-shrink-0 px-6 pb-4 flex gap-2 flex-wrap">
          {Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]).map(([s, n]) => {
            const cfg = statusCfg(s)
            return (
              <div key={s} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}>
                {cfg.icon}
                {cfg.label} <span className="ml-0.5 opacity-75">({n})</span>
              </div>
            )
          })}
        </div>
      )}

      {/* filters + search */}
      <div className="flex-shrink-0 px-6 pb-3 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pedido, produto, comprador…"
            className="pl-8 pr-3 py-1.5 rounded-lg text-sm bg-zinc-800/60 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-600"
            style={{ width: 230 }}
          />
        </div>
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={filter === f.key
                ? { background: 'rgba(0,229,255,0.15)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }
                : { background: 'rgba(255,255,255,0.04)', color: '#71717a', border: '1px solid rgba(255,255,255,0.07)' }
              }>
              {f.label}
              {counts[f.key] > 0 && (
                <span className="ml-1 text-[9px] opacity-70">{counts[f.key]}</span>
              )}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-600 ml-auto">{filtered.length} pedidos</span>
      </div>

      {/* table */}
      <div className="flex-1 overflow-auto px-6 pb-6 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-zinc-600 text-sm gap-2">
            <RefreshCw size={14} className="animate-spin" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-600 gap-2">
            <Truck size={24} />
            <span className="text-sm">Nenhum pedido encontrado</span>
          </div>
        ) : (
          <>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(9,9,11,0.95)' }}>
                <tr className="border-b border-zinc-800">
                  {['Produto','Comprador','Status','Logística','Previsão','Destino','Valor',''].map(h => (
                    <th key={h} className="py-2.5 px-4 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => <OrderRow key={o.order_id} o={o} />)}
              </tbody>
            </table>

            {offset < total && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => fetchOrders(offset, true)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}>
                  {loadingMore ? <RefreshCw size={13} className="animate-spin" /> : <ChevronDown size={13} />}
                  Carregar mais ({total - offset} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
