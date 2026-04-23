'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const PAGE = 20

// ── Types ─────────────────────────────────────────────────────────────────────

type DayPoint = { date: string; count: number; revenue: number }

type KpiData = {
  current_month: { count: number; revenue: number; by_day: DayPoint[] }
  last_month:    { count: number; revenue: number; by_day: DayPoint[] }
}

type VarAttr = { id: string; name: string; value_id: string; value_name: string }

type MOrder = {
  order_id:      number
  status:        string
  status_detail: { code: string; description: string } | null
  date_created:  string
  date_closed:   string | null
  total_amount:  number
  paid_amount:   number
  buyer: { id: number | null; nickname: string | null; first_name: string | null; last_name: string | null }
  order_items: {
    item_id:              string | null
    title:                string | null
    seller_sku:           string | null
    quantity:             number
    unit_price:           number
    full_unit_price:      number
    variation_id:         number | null
    variation_attributes: VarAttr[]
    thumbnail:            string | null
  }[]
  shipping: {
    id:                      number | null
    status:                  string | null
    substatus:               string | null
    logistic_type:           string | null
    date_created:            string | null
    estimated_delivery_date: string | null
    posting_deadline:        string | null
    receiver_address: {
      zip_code:      string | null
      city:          string | null
      state:         string | null
      street_name:   string | null
      street_number: string | null
    }
    base_cost:     number
    receiver_cost: number | null
  }
  payments: { id: number; total_paid_amount: number; installments: number; payment_type: string; status: string }[]
  tags:       string[]
  mediations: unknown[]
  tarifa_ml:      number
  frete_vendedor: number
  lucro_bruto:    number
}

type TabKey = 'abertas' | 'em_preparacao' | 'despachadas' | 'pgto_pendente' | 'flex' | 'encerradas' | 'mediacao'
type Toast  = { id: number; msg: string; type: 'success' | 'error' | 'info' }

// ── Helpers ───────────────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function ago(iso: string) {
  const d    = new Date(iso)
  const diff = Date.now() - d.getTime()
  const h    = Math.floor(diff / 3600000)
  if (h < 1)  return 'agora'
  if (h < 24) return `${h}h atrás`
  const days = Math.floor(h / 24)
  if (days === 1) return 'ontem'
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

function deadlineInfo(deadline: string | null) {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  const h  = ms / 3600000
  if (h < 0)  return { label: 'Atrasado!',         color: '#ef4444', bg: '#2d0a0a' }
  if (h < 4)  return { label: `${Math.ceil(h)}h`,  color: '#ef4444', bg: '#2d0a0a' }
  if (h < 24) return { label: `${Math.floor(h)}h`, color: '#f97316', bg: '#2a1500' }
  return       { label: `${Math.floor(h / 24)}d`,  color: '#fbbf24', bg: '#2a1e00' }
}

const AVATAR_COLORS = [
  '#00E5FF','#a78bfa','#fb923c','#34d399','#f472b6',
  '#60a5fa','#fbbf24','#4ade80','#f87171','#c084fc',
]
function avatarColor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function initials(o: MOrder) {
  const fn = o.buyer.first_name ?? ''
  const ln = o.buyer.last_name  ?? ''
  if (fn || ln) return ((fn[0] ?? '') + (ln[0] ?? '')).toUpperCase()
  return (o.buyer.nickname ?? '?').substring(0, 2).toUpperCase()
}

function buyerDisplay(o: MOrder) {
  const fn = o.buyer.first_name ?? ''
  const ln = o.buyer.last_name  ?? ''
  if (fn || ln) return `${fn} ${ln}`.trim()
  return o.buyer.nickname ?? `#${o.buyer.id}`
}

function classifyOrder(o: MOrder): TabKey {
  if ((o.mediations?.length ?? 0) > 0 || o.tags?.includes('mediation_in_progress')) return 'mediacao'
  if (o.status === 'payment_required' || o.status === 'payment_in_process')          return 'pgto_pendente'
  if (o.status === 'cancelled')                                                       return 'encerradas'
  const ss = o.shipping?.status ?? ''
  if (ss === 'delivered' || ss === 'not_delivered')                                   return 'encerradas'
  const lt = o.shipping?.logistic_type ?? ''
  if (lt === 'self_service')                                                          return 'flex'
  if (ss === 'shipped' || ss === 'in_transit')                                        return 'despachadas'
  if (ss === 'handling' || ss === 'ready_to_ship')                                    return 'em_preparacao'
  return 'abertas'
}

const LOGISTIC: Record<string, { text: string; color: string; bg: string }> = {
  fulfillment:   { text: 'FULL',   color: '#00E5FF', bg: '#0a1f2e' },
  drop_off:      { text: 'Coleta', color: '#71717a', bg: '#1a1a1f' },
  xd_drop_off:   { text: 'XD',     color: '#a78bfa', bg: '#1a0e33' },
  self_service:  { text: 'Flex',   color: '#fb923c', bg: '#2a1500' },
}

const PAY_ICON: Record<string, string> = {
  credit_card: '💳', debit_card: '💳', account_money: '🏦', ticket: '🎟️', pix: '⚡',
}

// ── Mini bar chart ────────────────────────────────────────────────────────────

function MiniBar({ data, color, valueKey = 'count' }: {
  data: DayPoint[]; color: string; valueKey?: 'count' | 'revenue'
}) {
  if (!data.length) return <div style={{ width: 72, height: 28 }} />
  const vals = data.map(d => d[valueKey] as number)
  const max  = Math.max(...vals, 1)
  const W = 72, H = 28
  const bw  = Math.max(2, W / data.length - 1)
  return (
    <svg width={W} height={H} className="overflow-visible shrink-0">
      {data.map((d, i) => {
        const h = Math.max(2, ((d[valueKey] as number) / max) * H)
        return <rect key={d.date} x={i * (W / data.length)} y={H - h} width={bw} height={h} rx={1} fill={color} opacity={0.75} />
      })}
    </svg>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, data, valueKey, color }: {
  label: string; value: string; sub?: string
  data: DayPoint[]; valueKey: 'count' | 'revenue'; color: string
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-zinc-500 text-xs mb-1">{label}</p>
          <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
          {sub && <p className="text-zinc-600 text-xs mt-1">{sub}</p>}
        </div>
        <MiniBar data={data} color={color} valueKey={valueKey} />
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toasts({ list }: { list: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {list.map(t => (
        <div key={t.id} className="px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
          style={{
            background: t.type === 'error' ? '#1f0d0d' : '#111114',
            border: `1px solid ${t.type === 'error' ? 'rgba(248,113,113,.3)' : t.type === 'success' ? 'rgba(34,197,94,.3)' : 'rgba(0,229,255,.2)'}`,
            color: t.type === 'error' ? '#f87171' : t.type === 'success' ? '#4ade80' : '#00E5FF',
          }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap text-[10px] px-2 py-1 rounded-lg z-50 pointer-events-none"
          style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa' }}>
          {text}
        </span>
      )}
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="rounded-xl p-4 animate-pulse flex gap-4" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 w-1/3 bg-zinc-800 rounded" />
        <div className="h-3 w-1/2 bg-zinc-800 rounded" />
        <div className="h-3 w-1/4 bg-zinc-800 rounded" />
      </div>
      <div className="w-40 space-y-2 py-1">
        <div className="h-4 w-full bg-zinc-800 rounded" />
        <div className="h-3 w-3/4 bg-zinc-800 rounded" />
      </div>
      <div className="w-32 space-y-2 py-1">
        <div className="h-4 w-full bg-zinc-800 rounded" />
        <div className="h-3 w-2/3 bg-zinc-800 rounded" />
        <div className="h-3 w-3/4 bg-zinc-800 rounded" />
      </div>
    </div>
  )
}

// ── Financial row ─────────────────────────────────────────────────────────────

function FinRow({ icon, label, value, color, tooltip }: {
  icon: string; label: string; value: string | null; color?: string; tooltip: string
}) {
  return (
    <Tip text={tooltip}>
      <div className="flex items-center justify-between gap-2 py-0.5 cursor-default group">
        <span className="text-xs">{icon}</span>
        <span className="flex-1 text-[11px] text-zinc-500 leading-tight">{label}</span>
        {value != null
          ? <span className="text-[11px] font-semibold tabular-nums" style={{ color: color ?? '#e4e4e7' }}>{value}</span>
          : <span className="text-[11px] text-zinc-700">—</span>
        }
      </div>
    </Tip>
  )
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: MOrder }) {
  const [expanded, setExpanded] = useState(false)
  const item      = order.order_items[0]
  const moreItems = order.order_items.length - 1
  const color     = avatarColor(order.buyer.nickname ?? String(order.order_id))
  const ini       = initials(order)
  const buyer     = buyerDisplay(order)
  const lt        = order.shipping.logistic_type
  const lbadge    = LOGISTIC[lt ?? ''] ?? { text: lt ?? 'Normal', color: '#52525b', bg: '#111114' }
  const deadline  = deadlineInfo(order.shipping.posting_deadline)
  const estDel    = order.shipping.estimated_delivery_date
    ? new Date(order.shipping.estimated_delivery_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null
  const payment   = order.payments[0]
  const payIcon   = PAY_ICON[payment?.payment_type ?? ''] ?? '💳'

  const vars = (item?.variation_attributes ?? [])
    .filter(v => v.value_name)
    .map(v => `${v.name}: ${v.value_name}`)
    .join(' · ')

  return (
    <div className="rounded-xl transition-colors" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      <div className="grid gap-0" style={{ gridTemplateColumns: '200px 1fr 188px' }}>

        {/* ── Buyer ── */}
        <div className="p-4 flex flex-col gap-2 justify-between" style={{ borderRight: '1px solid #1a1a1f' }}>
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: color, color: '#000' }}>
              {ini}
            </div>
            <div className="min-w-0">
              <p className="text-zinc-100 text-xs font-semibold leading-tight truncate">{buyer}</p>
              {order.buyer.nickname && buyer !== order.buyer.nickname && (
                <p className="text-zinc-500 text-[10px]">@{order.buyer.nickname}</p>
              )}
            </div>
          </div>
          <div className="space-y-0.5">
            <a href={`https://www.mercadolivre.com.br/vendas/${order.order_id}`} target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors block">
              Venda #{order.order_id}
            </a>
            {order.shipping.receiver_address.zip_code && (
              <p className="text-[10px] text-zinc-500">
                CEP {order.shipping.receiver_address.zip_code}
                {order.shipping.receiver_address.city ? ` · ${order.shipping.receiver_address.city}` : ''}
              </p>
            )}
            <p className="text-[10px] text-zinc-600">{ago(order.date_created)}</p>
          </div>
        </div>

        {/* ── Product ── */}
        <div className="p-4 flex flex-col gap-2" style={{ borderRight: '1px solid #1a1a1f' }}>
          {item && (
            <>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center">
                  {item.thumbnail
                    ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                    : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3f3f46" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                      </svg>
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-100 text-xs font-medium line-clamp-2 leading-snug">
                    <span className="text-zinc-400 font-bold">{item.quantity}x </span>{item.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 mt-1 text-[10px] text-zinc-500">
                    {item.seller_sku && <span>SKU: <span className="text-zinc-400 font-mono">{item.seller_sku}</span></span>}
                    {item.item_id    && <span className="font-mono text-zinc-600">{item.item_id}</span>}
                  </div>
                  {vars && <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{vars}</p>}
                </div>
              </div>

              {moreItems > 0 && (
                <p className="text-[10px] text-zinc-600">+{moreItems} produto{moreItems > 1 ? 's' : ''}</p>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-100">{brl(item.unit_price)}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: lbadge.bg, color: lbadge.color }}>{lbadge.text}</span>
                {deadline && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: deadline.bg, color: deadline.color }}>
                    ⏱ Limite: {deadline.label}
                  </span>
                )}
                {estDel && (
                  <span className="text-[10px] text-zinc-500">
                    Entrega: <span className="text-zinc-300">{estDel}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                {[{ label: 'Etiqueta', icon: '🖨️' }, { label: 'NF-e', icon: '📄' }].map(b => (
                  <button key={b.label}
                    className="text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors hover:bg-zinc-800"
                    style={{ background: '#1a1a1f', color: '#71717a', border: '1px solid #27272a' }}>
                    {b.icon} {b.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Financial ── */}
        <div className="p-4 flex flex-col gap-0.5">
          <FinRow icon={payIcon} label="Valor pago"     value={brl(order.total_amount)}
            tooltip="Valor pago pelo comprador" />
          <FinRow icon="🚚" label="Frete vendedor"
            value={order.frete_vendedor ? `-${brl(order.frete_vendedor)}` : brl(0)} color="#f87171"
            tooltip={`Frete comprador: ${order.shipping.receiver_cost != null ? brl(order.shipping.receiver_cost) : '—'} / Vendedor: ${brl(order.frete_vendedor)}`} />
          <FinRow icon="🏪" label="Tarifa ML"           value={`-${brl(order.tarifa_ml)}`} color="#f87171"
            tooltip="Tarifa do Mercado Livre (~11,5%)" />
          <div className="border-t my-1.5" style={{ borderColor: '#1e1e24' }} />
          <FinRow icon="💰" label="Lucro bruto"         value={brl(order.lucro_bruto)}
            color={order.lucro_bruto >= 0 ? '#4ade80' : '#f87171'}
            tooltip={`Lucro bruto: valor − tarifa − frete`} />
          <FinRow icon="📦" label="Custo produto"       value={null} tooltip="Vincule um produto para calcular" />
          <FinRow icon="⚖️" label="Imposto"             value={null} tooltip="Configure tributos no produto" />
          <div className="border-t my-1.5" style={{ borderColor: '#1e1e24' }} />
          <FinRow icon="🟢" label="Margem contrib."     value={null} color="#4ade80"
            tooltip="Vincule produto para ver a margem de contribuição" />
          {payment?.installments > 1 && (
            <p className="text-[9px] text-zinc-600 mt-1 text-right">{payment.installments}x no cartão</p>
          )}
        </div>
      </div>

      {/* Expand */}
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
        style={{ borderTop: '1px solid #1a1a1f' }}>
        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          style={{ transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        {expanded ? 'Menos detalhes' : 'Mais detalhes'}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #1a1a1f' }}>
          {order.order_items.length > 1 && (
            <div className="pt-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Itens do pedido</p>
              <div className="space-y-1">
                {order.order_items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="font-bold text-zinc-300">{it.quantity}x</span>
                    <span className="truncate flex-1">{it.title}</span>
                    <span className="font-semibold text-zinc-200 shrink-0">{brl(it.unit_price * it.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {order.shipping.receiver_address.street_name && (
            <div className="pt-1">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Endereço de entrega</p>
              <p className="text-xs text-zinc-300">
                {order.shipping.receiver_address.street_name}, {order.shipping.receiver_address.street_number}
                {order.shipping.receiver_address.city ? ` — ${order.shipping.receiver_address.city}, ${order.shipping.receiver_address.state}` : ''}
                {order.shipping.receiver_address.zip_code ? ` — CEP ${order.shipping.receiver_address.zip_code}` : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, total, size, onChange }: {
  page: number; total: number; size: number; onChange: (p: number) => void
}) {
  const last = Math.max(0, Math.ceil(total / size) - 1)
  if (last === 0) return null
  const pages: (number | '…')[] = []
  if (last < 7) for (let i = 0; i <= last; i++) pages.push(i)
  else {
    pages.push(0)
    if (page > 2) pages.push('…')
    for (let i = Math.max(1, page - 1); i <= Math.min(last - 1, page + 1); i++) pages.push(i)
    if (page < last - 2) pages.push('…')
    pages.push(last)
  }
  const btn = (label: string, p: number, disabled: boolean) => (
    <button onClick={() => onChange(p)} disabled={disabled}
      className="px-2 py-1.5 rounded-lg text-xs text-zinc-400 disabled:opacity-25 hover:text-white hover:bg-zinc-800 transition-colors">
      {label}
    </button>
  )
  return (
    <div className="flex items-center justify-between pt-5">
      <p className="text-zinc-600 text-xs">{total.toLocaleString('pt-BR')} pedido{total !== 1 ? 's' : ''}</p>
      <div className="flex items-center gap-1">
        {btn('«', 0, page === 0)}{btn('‹', page - 1, page === 0)}
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="text-zinc-700 text-xs px-1">…</span>
            : <button key={p} onClick={() => onChange(p as number)}
                className="w-7 h-7 rounded-lg text-xs font-medium transition-colors"
                style={p === page ? { background: '#00E5FF', color: '#000' } : { color: '#71717a' }}>
                {(p as number) + 1}
              </button>
        )}
        {btn('›', page + 1, page === last)}{btn('»', last, page === last)}
      </div>
    </div>
  )
}

// ── Manual Sale Modal ─────────────────────────────────────────────────────────

function ManualSaleModal({ onClose, onSaved, getHeaders }: {
  onClose:    () => void
  onSaved:    () => void
  getHeaders: () => Promise<Record<string, string>>
}) {
  const [form, setForm] = useState({
    platform: 'manual', product_title: '', sku: '', quantity: '1',
    sale_price: '', cost_price: '', buyer_name: '', buyer_phone: '',
    shipping_address: '', payment_method: 'pix', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.product_title.trim() || !form.buyer_name.trim() || !form.sale_price) {
      setError('Preencha: produto, comprador e preço de venda.')
      return
    }
    setSaving(true); setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/orders/manual`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform:         form.platform,
          product_title:    form.product_title.trim(),
          sku:              form.sku.trim() || undefined,
          quantity:         Number(form.quantity) || 1,
          sale_price:       Number(form.sale_price),
          cost_price:       form.cost_price ? Number(form.cost_price) : undefined,
          buyer_name:       form.buyer_name.trim(),
          buyer_phone:      form.buyer_phone.trim() || undefined,
          shipping_address: form.shipping_address.trim() || undefined,
          payment_method:   form.payment_method,
          notes:            form.notes.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const inp = 'w-full text-sm px-3 py-2 rounded-lg text-zinc-200 placeholder-zinc-600 outline-none'
  const sty = { background: '#0f0f12', border: '1px solid #27272a' }
  const lbl = 'text-zinc-400 text-xs mb-1 block'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.75)' }}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <h2 className="text-white text-base font-semibold">Nova Venda Manual</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto">
          <div className="px-6 py-5 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Plataforma</label>
              <select value={form.platform} onChange={e => set('platform', e.target.value)} className={inp} style={sty}>
                {[['ml','Mercado Livre'],['shopee','Shopee'],['whatsapp','WhatsApp'],['loja_fisica','Loja Física'],['outro','Outro']].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Produto *</label>
              <input value={form.product_title} onChange={e => set('product_title', e.target.value)}
                placeholder="Nome do produto" className={inp} style={sty} />
            </div>
            <div>
              <label className={lbl}>SKU</label>
              <input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="SKU" className={inp} style={sty} />
            </div>
            <div>
              <label className={lbl}>Quantidade</label>
              <input type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} className={inp} style={sty} />
            </div>
            <div>
              <label className={lbl}>Preço de venda (R$) *</label>
              <input type="number" step="0.01" value={form.sale_price} onChange={e => set('sale_price', e.target.value)}
                placeholder="0,00" className={inp} style={sty} />
            </div>
            <div>
              <label className={lbl}>Custo do produto (R$)</label>
              <input type="number" step="0.01" value={form.cost_price} onChange={e => set('cost_price', e.target.value)}
                placeholder="0,00" className={inp} style={sty} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Nome do comprador *</label>
              <input value={form.buyer_name} onChange={e => set('buyer_name', e.target.value)}
                placeholder="Nome completo" className={inp} style={sty} />
            </div>
            <div>
              <label className={lbl}>Telefone</label>
              <input value={form.buyer_phone} onChange={e => set('buyer_phone', e.target.value)}
                placeholder="(11) 99999-9999" className={inp} style={sty} />
            </div>
            <div>
              <label className={lbl}>Forma de pagamento</label>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className={inp} style={sty}>
                {[['pix','PIX'],['credit_card','Cartão de crédito'],['debit_card','Cartão de débito'],['cash','Dinheiro'],['boleto','Boleto']].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Endereço de entrega</label>
              <input value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)}
                placeholder="Rua, número, cidade, CEP" className={inp} style={sty} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Observações</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={2} placeholder="Anotações internas..." className={`${inp} resize-none`} style={sty} />
            </div>
          </div>

          {error && (
            <p className="mx-6 mb-3 text-xs text-red-400 px-3 py-2 rounded-lg" style={{ background: '#2d0a0a' }}>{error}</p>
          )}

          <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid #1e1e24' }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
              style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#000' }}>
              {saving ? 'Salvando…' : 'Registrar Venda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'abertas',       label: 'Abertas'        },
  { key: 'em_preparacao', label: 'Em Preparação'  },
  { key: 'despachadas',   label: 'Despachadas'    },
  { key: 'pgto_pendente', label: 'Pgto. Pendente' },
  { key: 'flex',          label: 'Flex'           },
  { key: 'encerradas',    label: 'Encerradas'     },
  { key: 'mediacao',      label: 'Mediação'       },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  const supabase = useMemo(() => createClient(), [])

  const [kpis,       setKpis]       = useState<KpiData | null>(null)
  const [orders,     setOrders]     = useState<MOrder[]>([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [kpiLoad,    setKpiLoad]    = useState(true)
  const [tab,        setTab]        = useState<TabKey>('abertas')
  const [page,       setPage]       = useState(0)
  const [q,          setQ]          = useState('')
  const [modal,      setModal]      = useState(false)
  const [toasts,     setToasts]     = useState<Toast[]>([])
  const tid = useRef(0)

  function toast(msg: string, type: Toast['type'] = 'info') {
    const id = ++tid.current
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}` }
  }, [supabase])

  const loadKpis = useCallback(async () => {
    setKpiLoad(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/orders/kpis`, { headers })
      if (res.ok) setKpis(await res.json())
    } catch { /* silent */ }
    finally { setKpiLoad(false) }
  }, [getHeaders])

  const loadOrders = useCallback(async (currentPage: number, query: string) => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const params  = new URLSearchParams({ offset: String(currentPage * PAGE), limit: String(PAGE) })
      if (query.trim()) params.set('q', query.trim())
      const res  = await fetch(`${BACKEND}/ml/orders/enriched?${params}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      setOrders(body.orders ?? [])
      setTotal(body.total   ?? 0)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao carregar pedidos', 'error')
      setOrders([])
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { loadKpis()              }, [loadKpis])
  useEffect(() => { loadOrders(page, q)     }, [page, loadOrders])

  const tabCounts = useMemo<Record<TabKey, number>>(() => {
    const c: Record<string, number> = {}
    for (const o of orders) { const k = classifyOrder(o); c[k] = (c[k] ?? 0) + 1 }
    return c as Record<TabKey, number>
  }, [orders])

  const filtered = useMemo(() => orders.filter(o => classifyOrder(o) === tab), [orders, tab])

  const cur  = kpis?.current_month
  const prev = kpis?.last_month
  const num  = (v: number) => v.toLocaleString('pt-BR')

  return (
    <div style={{ background: '#09090b', minHeight: '100vh' }} className="p-6 max-w-[1400px] space-y-5">
      <Toasts list={toasts} />

      {/* Header */}
      <div>
        <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Dashboard · Vendas</p>
        <h1 className="text-white text-2xl font-semibold">Pedidos</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiLoad
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
            ))
          : <>
              <KpiCard label="Vendas mês passado"   value={num(prev?.count   ?? 0)} sub="aprovadas"    data={prev?.by_day ?? []} valueKey="count"   color="#71717a" />
              <KpiCard label="Vendas mês atual"     value={num(cur?.count    ?? 0)} sub="aprovadas"    data={cur?.by_day  ?? []} valueKey="count"   color="#00E5FF" />
              <KpiCard label="Faturamento anterior" value={brl(prev?.revenue ?? 0)} sub="mês passado"  data={prev?.by_day ?? []} valueKey="revenue" color="#71717a" />
              <KpiCard label="Faturamento atual"    value={brl(cur?.revenue  ?? 0)} sub="mês corrente" data={cur?.by_day  ?? []} valueKey="revenue" color="#22c55e" />
            </>
        }
      </div>

      {/* Search + action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <input value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (setPage(0), loadOrders(0, q))}
            placeholder="Buscar por comprador, produto..."
            className="text-sm px-4 py-2 rounded-xl text-zinc-200 placeholder-zinc-600 outline-none w-72"
            style={{ background: '#111114', border: '1px solid #27272a' }} />
          <button onClick={() => { setPage(0); loadOrders(0, q) }}
            className="text-sm px-5 py-2 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            style={{ background: '#00E5FF', color: '#000' }}>
            Buscar
          </button>
          {q && (
            <button onClick={() => { setQ(''); loadOrders(0, '') }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2">
              Limpar
            </button>
          )}
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition-all"
          style={{ background: '#1a1a1f', border: '1px solid #27272a', color: '#e4e4e7' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nova Venda Manual
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto" style={{ borderBottom: '1px solid #1a1a1f' }}>
        {TABS.map(t => {
          const count  = tabCounts[t.key] ?? 0
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-sm font-medium transition-colors relative shrink-0"
              style={active ? { color: '#00E5FF', borderBottom: '2px solid #00E5FF', marginBottom: -1 } : { color: '#52525b' }}>
              {t.label}
              {count > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={active ? { background: '#00E5FF1a', color: '#00E5FF' } : { background: '#1a1a1f', color: '#3f3f46' }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Order list */}
      <div className="space-y-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          : filtered.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}
                  className="mb-4 opacity-25">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-medium text-zinc-500 mb-1">Nenhum pedido nesta aba</p>
                <p className="text-xs text-zinc-600">
                  {tab === 'abertas' ? 'Sem pedidos abertos no momento' : `Sem pedidos "${TABS.find(t => t.key === tab)?.label}"`}
                </p>
              </div>
            )
            : filtered.map(order => <OrderCard key={order.order_id} order={order} />)
        }
      </div>

      {/* Pagination */}
      {!loading && (
        <Pagination page={page} total={total} size={PAGE}
          onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
      )}

      {/* Modal */}
      {modal && (
        <ManualSaleModal
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); toast('Venda registrada com sucesso!', 'success') }}
          getHeaders={getHeaders}
        />
      )}
    </div>
  )
}
