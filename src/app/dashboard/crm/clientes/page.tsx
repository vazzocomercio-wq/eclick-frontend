'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Search, RefreshCw, TrendingUp, Users, ShoppingCart,
  MapPin, ChevronDown, ChevronUp, Package,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

// ── types ─────────────────────────────────────────────────────────────────────

type EnrichedOrder = {
  order_id: number
  status: string
  date_created: string
  total_amount: number
  buyer: {
    id: number | null
    nickname: string | null
    first_name: string | null
    last_name: string | null
  }
  order_items: Array<{
    item_id: string | null
    title: string | null
    quantity: number
    unit_price: number
    thumbnail: string | null
  }>
  shipping: {
    status: string | null
    receiver_address: {
      city: string | null
      state: string | null
    }
  }
}

type Customer = {
  buyerId: number | null
  nickname: string
  displayName: string
  orders: EnrichedOrder[]
  totalSpent: number
  orderCount: number
  lastOrderDate: string
  topProducts: string[]
  city: string | null
  state: string | null
}

type SortKey = 'totalSpent' | 'orderCount' | 'lastOrderDate' | 'displayName'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function relTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  const days = Math.floor(d / 86400000)
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 30)  return `${days}d atrás`
  if (days < 365) return `${Math.floor(days / 30)}m atrás`
  return `${Math.floor(days / 365)}a atrás`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f97316','#22c55e','#06b6d4','#f59e0b','#ef4444',
]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// ── CustomerRow ───────────────────────────────────────────────────────────────

function CustomerRow({ customer }: { customer: Customer }) {
  const [expanded, setExpanded] = useState(false)
  const color = avatarColor(customer.displayName)
  const ltv = customer.totalSpent
  const ticketMedio = ltv / customer.orderCount

  return (
    <>
      <tr
        className="border-b border-zinc-800/60 hover:bg-zinc-900/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        {/* customer */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
              {initials(customer.displayName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate max-w-[180px]">{customer.displayName}</p>
              {customer.nickname !== customer.displayName && (
                <p className="text-[10px] text-zinc-500">{customer.nickname}</p>
              )}
            </div>
          </div>
        </td>

        {/* location */}
        <td className="py-3 px-4 text-sm text-zinc-400">
          {customer.city && customer.state
            ? <span className="flex items-center gap-1"><MapPin size={11} />{customer.city}, {customer.state}</span>
            : <span className="text-zinc-700">—</span>
          }
        </td>

        {/* orders */}
        <td className="py-3 px-4 text-sm text-center tabular-nums text-zinc-300">{customer.orderCount}</td>

        {/* total spent */}
        <td className="py-3 px-4 text-sm font-semibold text-white tabular-nums">{brl(ltv)}</td>

        {/* ticket médio */}
        <td className="py-3 px-4 text-sm text-zinc-400 tabular-nums">{brl(ticketMedio)}</td>

        {/* last order */}
        <td className="py-3 px-4 text-sm text-zinc-400">
          <span title={fmtDate(customer.lastOrderDate)}>{relTime(customer.lastOrderDate)}</span>
        </td>

        {/* expand */}
        <td className="py-3 px-4 text-zinc-600">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>

      {/* Expanded order history */}
      {expanded && (
        <tr className="border-b border-zinc-800/40">
          <td colSpan={7} className="px-4 pb-3 pt-1">
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide px-3 pt-2 pb-1">
                Histórico de pedidos
              </p>
              <table className="w-full">
                <tbody>
                  {customer.orders.slice(0, 10).map(o => (
                    <tr key={o.order_id} className="border-t border-zinc-800/40">
                      <td className="py-1.5 px-3">
                        {o.order_items[0]?.thumbnail && (
                          <img src={o.order_items[0].thumbnail} alt="" className="w-7 h-7 rounded object-cover inline-block mr-2 align-middle" />
                        )}
                        <span className="text-xs text-zinc-300 align-middle">
                          {o.order_items[0]?.title ?? '—'}
                          {o.order_items.length > 1 && <span className="text-zinc-600 ml-1">+{o.order_items.length - 1}</span>}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-xs text-zinc-500 whitespace-nowrap">{fmtDate(o.date_created)}</td>
                      <td className="py-1.5 px-3 text-xs font-semibold text-white tabular-nums whitespace-nowrap text-right">{brl(o.total_amount)}</td>
                      <td className="py-1.5 px-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{
                            background: o.status === 'paid' ? 'rgba(34,197,94,0.1)' : 'rgba(113,113,122,0.15)',
                            color: o.status === 'paid' ? '#34d399' : '#71717a',
                          }}>
                          {o.status === 'paid' ? 'Pago' : o.status === 'cancelled' ? 'Cancelado' : o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const [orders,   setOrders]   = useState<EnrichedOrder[]>([])
  const [loading,  setLoading]  = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total,    setTotal]    = useState(0)
  const [offset,   setOffset]   = useState(0)
  const [search,   setSearch]   = useState('')
  const [sortKey,  setSortKey]  = useState<SortKey>('totalSpent')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc')

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

  // Aggregate customers from orders
  const customers = useMemo<Customer[]>(() => {
    const map = new Map<string, Customer>()
    const paidOrders = orders.filter(o => o.status !== 'cancelled')

    for (const o of paidOrders) {
      const key = o.buyer?.id != null ? String(o.buyer.id) : (o.buyer?.nickname ?? 'unknown')
      const parts = [o.buyer?.first_name, o.buyer?.last_name].filter(Boolean)
      const displayName = parts.length > 0
        ? parts.join(' ')
        : (o.buyer?.nickname ?? 'Comprador desconhecido')

      if (!map.has(key)) {
        map.set(key, {
          buyerId:       o.buyer?.id ?? null,
          nickname:      o.buyer?.nickname ?? '—',
          displayName,
          orders:        [],
          totalSpent:    0,
          orderCount:    0,
          lastOrderDate: o.date_created,
          topProducts:   [],
          city:          o.shipping?.receiver_address?.city ?? null,
          state:         o.shipping?.receiver_address?.state ?? null,
        })
      }
      const c = map.get(key)!
      c.orders.push(o)
      c.totalSpent    += o.total_amount
      c.orderCount++
      if (o.date_created > c.lastOrderDate) {
        c.lastOrderDate = o.date_created
        c.city  = o.shipping?.receiver_address?.city ?? c.city
        c.state = o.shipping?.receiver_address?.state ?? c.state
      }
      for (const item of o.order_items) {
        if (item.title && !c.topProducts.includes(item.title)) c.topProducts.push(item.title)
      }
    }

    return [...map.values()]
  }, [orders])

  // Filter + sort
  const filtered = useMemo(() => {
    let r = customers
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(c =>
        c.displayName.toLowerCase().includes(q) ||
        c.nickname.toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q)
      )
    }
    return [...r].sort((a, b) => {
      let va: string | number = 0, vb: string | number = 0
      switch (sortKey) {
        case 'totalSpent':     va = a.totalSpent;    vb = b.totalSpent;    break
        case 'orderCount':     va = a.orderCount;    vb = b.orderCount;    break
        case 'lastOrderDate':  va = a.lastOrderDate; vb = b.lastOrderDate; break
        case 'displayName':    va = a.displayName;   vb = b.displayName;   break
      }
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [customers, search, sortKey, sortDir])

  function handleSort(k: SortKey) {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('desc') }
  }

  // KPIs
  const totalLTV   = customers.reduce((s, c) => s + c.totalSpent, 0)
  const avgLTV     = customers.length ? totalLTV / customers.length : 0
  const repeat     = customers.filter(c => c.orderCount > 1).length
  const repeatRate = customers.length ? (repeat / customers.length) * 100 : 0

  function SortTh({ label, k }: { label: string; k: SortKey }) {
    const active = k === sortKey
    return (
      <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide cursor-pointer select-none hover:text-zinc-300 transition-colors whitespace-nowrap"
        onClick={() => handleSort(k)}>
        <span className="flex items-center gap-1">
          {label}
          {active
            ? sortDir === 'asc' ? <ChevronUp size={11} className="text-cyan-400" /> : <ChevronDown size={11} className="text-cyan-400" />
            : <ChevronUp size={11} className="opacity-20" />}
        </span>
      </th>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ color: '#e4e4e7' }}>
      {/* header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Clientes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {loading ? 'Carregando…' : `${customers.length} clientes de ${orders.filter(o => o.status !== 'cancelled').length} pedidos`}
          </p>
        </div>
        <button onClick={() => fetchOrders(0)} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* KPIs */}
      {!loading && customers.length > 0 && (
        <div className="flex-shrink-0 px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total de clientes',  value: String(customers.length), icon: <Users size={16} /> },
            { label: 'LTV médio',          value: brl(avgLTV),              icon: <TrendingUp size={16} /> },
            { label: 'Recompra',           value: `${repeatRate.toFixed(0)}%`, icon: <ShoppingCart size={16} /> },
            { label: 'Pedidos carregados', value: `${orders.length}/${total}`, icon: <Package size={16} /> },
          ].map(k => (
            <div key={k.label} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <span className="text-cyan-500">{k.icon}</span>
              <div>
                <p className="text-[10px] text-zinc-500">{k.label}</p>
                <p className="text-lg font-bold text-white leading-tight">{k.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* search */}
      <div className="flex-shrink-0 px-6 pb-3 flex items-center gap-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente ou cidade…"
            className="pl-8 pr-3 py-1.5 rounded-lg text-sm bg-zinc-800/60 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-600"
            style={{ width: 240 }}
          />
        </div>
        <span className="text-xs text-zinc-600 ml-auto">{filtered.length} clientes</span>
      </div>

      {/* table */}
      <div className="flex-1 overflow-auto px-6 pb-6 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-zinc-600 text-sm gap-2">
            <RefreshCw size={14} className="animate-spin" /> Carregando pedidos…
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-600 gap-2">
            <Users size={24} />
            <span className="text-sm">Nenhum cliente encontrado</span>
          </div>
        ) : (
          <>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(9,9,11,0.95)' }}>
                <tr className="border-b border-zinc-800">
                  <SortTh label="Cliente"      k="displayName" />
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Localização</th>
                  <SortTh label="Pedidos"      k="orderCount" />
                  <SortTh label="Total gasto"  k="totalSpent" />
                  <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Ticket médio</th>
                  <SortTh label="Último pedido" k="lastOrderDate" />
                  <th className="py-2.5 px-4 w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => <CustomerRow key={c.buyerId ?? c.nickname} customer={c} />)}
              </tbody>
            </table>

            {/* load more */}
            {offset < total && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => fetchOrders(offset, true)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#a1a1aa' }}
                >
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
