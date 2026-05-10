// v2 - pedidos completo
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { getSocket } from '@/lib/socket'
import {
  MoreHorizontal, Truck, Printer, Send, AlertOctagon, Megaphone, Ban,
  Headphones, BarChart2, Eye,
} from 'lucide-react'
import { ToastViewport, todoToast } from '@/hooks/useToast'
import { ensurePulseStyles, pulseClass, PulsingButton } from '@/components/ui/pulsing-button'
import { CopyButton } from '@/components/ui/copy-button'
import { PedidosTable } from './_components/PedidosTable'
import { OrderDetailDrawer } from './_components/OrderDetailDrawer'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const PAGE_SIZE_LS_KEY = 'eclick.pedidos.page_size'
const DEFAULT_PAGE_SIZE = 10

// ── Types ─────────────────────────────────────────────────────────────────────

type DayPoint = { date: string; count: number; revenue: number }

type KpiAggregate = {
  count:             number
  revenue:           number
  pending_shipment?: number
  in_transit?:       number
  delivered?:        number
  by_day:            DayPoint[]
}
type KpiData = {
  today?:        KpiAggregate
  current_month: KpiAggregate
  last_month:    KpiAggregate
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
  buyer: {
    id:                  number | null
    nickname:            string | null
    first_name:          string | null
    last_name:           string | null
    doc_type:            string | null
    doc_number:          string | null
    full_name:           string | null
    billing_last_name:   string | null
    billing_info_id:     string | null
    billing_address: {
      country_id?:    string | null
      state?:         { id?: string | null; name?: string | null } | null
      // ML retorna city_name como STRING direta (não objeto aninhado)
      city_name?:     string | null
      // Compat: orders antigos podem ter city aninhado
      city?:          { id?: string | null; name?: string | null } | null
      zip_code?:      string | null
      street_name?:   string | null
      street_number?: string | null
      comment?:       string | null
      neighborhood?:  { id?: string | null; name?: string | null } | null
    } | null
    billing_country:     string | null
    email:               string | null
    phone:               string | null
    billing_fetched_at:  string | null
  }
  order_items: {
    item_id:              string | null
    item?:                { id: string | null }
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
      neighborhood:  string | null
      complement:    string | null
      address_line:  string | null
    }
    base_cost:     number
    receiver_cost: number | null
  }
  payments: { id: number; total_paid_amount: number; installments: number; payment_type: string; status: string }[]
  tags:       string[]
  mediations: unknown[]
  tarifa_ml:           number
  frete_vendedor:      number
  frete_comprador?:    number
  lucro_bruto:         number
  cost_price:          number | null
  tax_amount:          number | null
  contribution_margin: number | null
  contribution_margin_pct: number | null
  shipping_breakdown?: {
    buyer_paid:  number
    ml_refund:   number
    seller_paid: number
    gross:       number
  }
}

type TabKey = 'abertas' | 'em_preparacao' | 'despachadas' | 'pgto_pendente' | 'flex' | 'encerradas' | 'mediacao'
type Toast  = { id: number; msg: string; type: 'success' | 'error' | 'info' }

// ── Helpers ───────────────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function maskDoc(v: string | null, type: string | null): string | null {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  return type ? `${type} ${d}` : d
}

function fmtPhone(v: string | null): string | null {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  if (d.length < 10) return v
  const cc = d.length > 11 ? d.slice(0, 2) : '55'
  const rest = d.length > 11 ? d.slice(2) : d
  const ddd = rest.slice(0, 2)
  const num = rest.slice(2)
  return `+${cc} (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

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

/** Data + hora exata do pedido — usado no card e no drawer header.
 *  Operação precisa saber QUANDO o pedido entrou (não "ontem" relativo). */
function orderDateTime(iso: string) {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

// ── Order actions menu (kebab) ────────────────────────────────────────────────

function OrderActionsMenu({ order }: { order: MOrder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const trackingUrl = order.shipping?.id ? `https://www.mercadolibre.com.br/envios/${order.shipping?.id}` : null

  const items: Array<{ key: string; label: string; icon: React.ReactNode; tone?: string; onClick: () => void }> = [
    { key: 'rastreio',  label: 'Acompanhar rastreio',     icon: <Truck size={12} />,
      onClick: () => { trackingUrl ? window.open(trackingUrl, '_blank') : todoToast('Rastreio sem ID de envio') } },
    { key: 'etiqueta',  label: 'Reimprimir etiqueta',     icon: <Printer size={12} />,    onClick: () => todoToast('Reimpressão de etiqueta') },
    { key: 'wa',        label: 'Disparar WhatsApp',       icon: <Send size={12} />,       onClick: () => todoToast('Mensagem WhatsApp ao comprador') },
    { key: 'problema',  label: 'Marcar problema',         icon: <AlertOctagon size={12} />, tone: 'warn',  onClick: () => todoToast('Marcação de reclamação') },
    { key: 'posvenda',  label: 'Iniciar pós-venda',       icon: <Megaphone size={12} />,  onClick: () => todoToast('Campanha pós-venda') },
    { key: 'cancelar',  label: 'Cancelar / reembolsar',   icon: <Ban size={12} />,  tone: 'danger', onClick: () => todoToast('Cancelamento ML') },
    { key: 'sac',       label: 'Vincular ao SAC',         icon: <Headphones size={12} />, onClick: () => todoToast('Bridge SAC ↔ Atendente IA') },
    { key: 'margem',    label: 'Análise de margem',       icon: <BarChart2 size={12} />,  onClick: () => todoToast('Drill-down de margem') },
    { key: 'detalhes',  label: 'Ver detalhes (ML)',       icon: <Eye size={12} />,
      onClick: () => window.open(`https://www.mercadolibre.com.br/orders/${order.order_id}`, '_blank') },
  ]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
        title="Ações">
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute z-40 right-0 mt-1 min-w-[220px] rounded-xl py-1 shadow-2xl"
          style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          {items.map(it => {
            const tone =
              it.tone === 'danger' ? '#f87171' :
              it.tone === 'warn'   ? '#facc15' : '#e4e4e7'
            return (
              <button key={it.key}
                onClick={() => { it.onClick(); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left hover:bg-zinc-900/70"
                style={{ color: tone }}>
                <span className="shrink-0 w-4 flex items-center justify-center">{it.icon}</span>
                <span>{it.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
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
  const fn = String(o.buyer.first_name ?? '')
  const ln = String(o.buyer.last_name  ?? '')
  if (fn || ln) return ((fn[0] ?? '') + (ln[0] ?? '')).toUpperCase()
  return String(o.buyer.nickname ?? '?').substring(0, 2).toUpperCase()
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

const PAY_LABEL: Record<string, string> = {
  credit_card: 'Cartão crédito', debit_card: 'Cartão débito',
  account_money: 'Saldo ML', ticket: 'Boleto', pix: 'PIX',
}

const PAY_STATUS: Record<string, { label: string; color: string }> = {
  approved:   { label: 'Aprovado',     color: '#22c55e' },
  pending:    { label: 'Pendente',     color: '#f59e0b' },
  rejected:   { label: 'Rejeitado',   color: '#ef4444' },
  cancelled:  { label: 'Cancelado',   color: '#ef4444' },
  in_process: { label: 'Processando', color: '#f59e0b' },
  refunded:   { label: 'Reembolsado', color: '#a78bfa' },
}

const SHIPPING_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:       { label: 'Aguardando envio', color: '#f59e0b' },
  handling:      { label: 'Em preparação',    color: '#f59e0b' },
  ready_to_ship: { label: 'Pronto p/ envio',  color: '#00E5FF' },
  shipped:       { label: 'Despachado',       color: '#3b82f6' },
  in_transit:    { label: 'Em trânsito',      color: '#3b82f6' },
  delivered:     { label: 'Entregue',         color: '#22c55e' },
  not_delivered: { label: 'Não entregue',     color: '#ef4444' },
  cancelled:     { label: 'Cancelado',        color: '#ef4444' },
  returned:      { label: 'Devolvido',        color: '#f59e0b' },
}

const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed:           { label: 'Confirmado',         color: '#00E5FF' },
  payment_required:    { label: 'Aguarda pgto.',       color: '#f59e0b' },
  payment_in_process:  { label: 'Pgto. processando',  color: '#f59e0b' },
  paid:                { label: 'Pago',                color: '#22c55e' },
  shipped:             { label: 'Enviado',             color: '#3b82f6' },
  delivered:           { label: 'Entregue',            color: '#22c55e' },
  cancelled:           { label: 'Cancelado',           color: '#ef4444' },
  invalid:             { label: 'Inválido',            color: '#ef4444' },
  pending:             { label: 'Pendente',            color: '#6b7280' },
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
        <span className="flex-1 text-xs text-zinc-500 leading-tight">{label}</span>
        {value != null
          ? <span className="text-xs font-semibold tabular-nums" style={{ color: color ?? '#e4e4e7' }}>{value}</span>
          : <span className="text-xs text-zinc-700">—</span>
        }
      </div>
    </Tip>
  )
}

// ── Order Card ────────────────────────────────────────────────────────────────

type VinculoProd = {
  id: string
  sku: string | null
  name: string | null
  cost_price: number | null
  tax_percentage: number | null
}

type VinculoItem = {
  listing_id: string
  quantity_per_unit: number
  product: VinculoProd | null
}

type CreateResult = {
  listing_id: string; status: 'created' | 'skipped' | 'error'; product_id?: string; reason?: string
}

/** Modal "Vincular Anúncio ao Produto"
 *
 *  Aberto quando user clica em "Vincular" num card de pedido. Mostra:
 *  - SKU de origem (do anúncio clicado)
 *  - Lista de produtos do catálogo com o mesmo SKU (radio — escolhe 1)
 *  - Lista de OUTROS anúncios na conta com mesmo SKU (checkboxes —
 *    user pode vincular vários ao mesmo produto numa só ação)
 *
 *  Salvar dispara N chamadas POST /products/vinculos (uma por listing).
 */
function VincularModal({
  listingId, listingTitle, thumbnail, sellerSku, candidates,
  allOrders, vinculosPorListing,
  onSave, onClose, onToast,
}: {
  listingId:           string
  listingTitle:        string
  thumbnail:           string | null
  sellerSku:           string
  candidates:          Array<{ id: string; name: string; sku: string }>
  allOrders:           MOrder[]
  vinculosPorListing:  Record<string, VinculoItem[]>
  onSave:              (productId: string, listings: Array<{ listing_id: string; listing_title: string; thumbnail: string | null }>) => Promise<{ created: number; failed: number; errors: string[] }>
  onClose:             () => void
  onToast:             (msg: string, type: Toast['type']) => void
}) {
  // Pré-seleciona o primeiro produto candidato
  const [pickedProductId, setPickedProductId] = useState<string>(
    candidates[0]?.id ?? ''
  )

  // Outros anúncios com mesmo SKU (não-vinculados ainda)
  const otherListings = useMemo(() => {
    // Coerção defensiva: ML às vezes retorna seller_sku como number
    const sellerSkuKey = String(sellerSku ?? '').trim().toUpperCase()
    const seen = new Set<string>([listingId])
    const out: Array<{ listing_id: string; title: string; thumbnail: string | null; isLinked: boolean }> = []
    for (const order of allOrders) {
      for (const oi of order.order_items) {
        const skuKey = String(oi.seller_sku ?? '').trim().toUpperCase()
        if (skuKey !== sellerSkuKey) continue
        const lid = oi.item_id ?? oi.item?.id
        if (!lid || seen.has(lid)) continue
        seen.add(lid)
        out.push({
          listing_id: lid,
          title:      oi.title ?? `Anúncio ${lid}`,
          thumbnail:  oi.thumbnail ?? null,
          isLinked:   (vinculosPorListing[lid] ?? []).length > 0,
        })
      }
    }
    return out
  }, [allOrders, listingId, sellerSku, vinculosPorListing])

  // Pré-seleciona o anúncio clicado + os outros com mesmo SKU não-vinculados
  const [pickedListingIds, setPickedListingIds] = useState<Set<string>>(() => {
    const s = new Set<string>([listingId])
    for (const o of otherListings) {
      if (!o.isLinked) s.add(o.listing_id)
    }
    return s
  })

  const [saving, setSaving] = useState(false)

  const togglePicked = (lid: string) => {
    setPickedListingIds(prev => {
      const next = new Set(prev)
      if (next.has(lid)) next.delete(lid)
      else next.add(lid)
      return next
    })
  }

  const allSelectableListings = useMemo(() => [
    { listing_id: listingId, title: listingTitle, thumbnail, isLinked: false, isOrigin: true },
    ...otherListings.map(o => ({ ...o, isOrigin: false })),
  ], [listingId, listingTitle, thumbnail, otherListings])

  const handleSave = async () => {
    if (!pickedProductId || pickedListingIds.size === 0) return
    setSaving(true)
    try {
      const toLink = allSelectableListings
        .filter(l => pickedListingIds.has(l.listing_id) && !l.isLinked)
        .map(l => ({ listing_id: l.listing_id, listing_title: l.title, thumbnail: l.thumbnail }))
      if (toLink.length === 0) {
        onToast('Nenhum anúncio novo selecionado pra vincular', 'info')
        setSaving(false)
        return
      }
      const r = await onSave(pickedProductId, toLink)
      const picked = candidates.find(c => c.id === pickedProductId)
      if (r.failed === 0) {
        onToast(`✓ ${r.created} ${r.created === 1 ? 'anúncio vinculado' : 'anúncios vinculados'} a "${picked?.name ?? ''}"`, 'success')
        onClose()
      } else {
        onToast(`${r.created} sucessos · ${r.failed} falhas. ${r.errors[0] ?? ''}`, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const newCount = allSelectableListings.filter(l => pickedListingIds.has(l.listing_id) && !l.isLinked).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-zinc-100 text-base font-semibold">Vincular Anúncio ao Produto</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              SKU de origem: <span className="font-mono text-cyan-300">{sellerSku}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-lg leading-none p-1"
          >×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Section: Produto */}
          <section>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              Produto do catálogo {candidates.length > 1 && `(${candidates.length} candidatos)`}
            </p>
            <div className="space-y-1.5">
              {candidates.map(p => (
                <label
                  key={p.id}
                  className={[
                    'flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors',
                    pickedProductId === p.id
                      ? 'border-cyan-400/60 bg-cyan-400/[0.05]'
                      : 'border-zinc-800 hover:border-zinc-700',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="vinc-product"
                    value={p.id}
                    checked={pickedProductId === p.id}
                    onChange={() => setPickedProductId(p.id)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{p.name}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">SKU {p.sku}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Section: Anúncios pra vincular */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Anúncios com este SKU ({allSelectableListings.length})
              </p>
              <p className="text-[10px] text-zinc-600">
                Marque quais conectar a este produto.
              </p>
            </div>
            <div className="space-y-1.5">
              {allSelectableListings.map(l => {
                const checked = pickedListingIds.has(l.listing_id)
                return (
                  <label
                    key={l.listing_id}
                    className={[
                      'flex items-center gap-3 px-3 py-2 rounded border transition-colors',
                      l.isLinked
                        ? 'border-zinc-800 bg-zinc-900/40 opacity-60 cursor-not-allowed'
                        : checked
                          ? 'border-emerald-400/40 bg-emerald-400/[0.05] cursor-pointer'
                          : 'border-zinc-800 hover:border-zinc-700 cursor-pointer',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={l.isLinked}
                      onChange={() => togglePicked(l.listing_id)}
                      className="w-4 h-4 accent-emerald-400"
                    />
                    {l.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.thumbnail} alt="" className="w-10 h-10 rounded object-cover bg-zinc-900 border border-zinc-800 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-800 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {l.isOrigin && (
                          <span className="text-[9px] uppercase font-mono text-cyan-300 bg-cyan-400/10 border border-cyan-400/30 rounded px-1 py-0.5">
                            origem
                          </span>
                        )}
                        {l.isLinked && (
                          <span className="text-[9px] uppercase font-mono text-zinc-500 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5">
                            já vinculado
                          </span>
                        )}
                        <p className="text-xs text-zinc-200 truncate">{l.title}</p>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono">{l.listing_id}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-500">
            {newCount > 0
              ? `${newCount} ${newCount === 1 ? 'anúncio será vinculado' : 'anúncios serão vinculados'}`
              : 'Selecione ao menos 1 anúncio não-vinculado'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-zinc-300 border border-zinc-800 hover:border-zinc-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !pickedProductId || newCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-black"
            >
              {saving ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              )}
              {saving ? 'Vinculando…' : 'Vincular'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Botão "Vincular" — fica acima do "Venda #X" no card.
 *  ATIVO  → anúncio sem vínculo + há produto(s) no catálogo com mesmo SKU
 *  HIDDEN → anúncio já vinculado (não polui a UI quando não há ação)
 *  Click → abre modal pra user revisar candidatos e confirmar vínculo. */
function VincularButton({
  hasExistingLink, skuMatchProducts, onClick,
}: {
  hasExistingLink:    boolean
  skuMatchProducts:   Array<{ id: string; name: string; sku: string }>
  onClick:            () => void
}) {
  if (hasExistingLink) return null

  const canLink = skuMatchProducts.length > 0
  const tooltip = canLink
    ? `${skuMatchProducts.length} produto${skuMatchProducts.length > 1 ? 's' : ''} no catálogo com este SKU. Click pra escolher.`
    : 'Sem produto no catálogo com mesmo SKU. Use "Criar Produto" pra criar um novo.'

  return (
    <button
      type="button"
      onClick={canLink ? onClick : undefined}
      disabled={!canLink}
      title={tooltip}
      className={[
        'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded transition-all',
        canLink
          ? 'bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 cursor-pointer'
          : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-60',
      ].join(' ')}
    >
      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      Vincular{canLink && skuMatchProducts.length > 1 ? ` (${skuMatchProducts.length})` : ''}
    </button>
  )
}

function OrderCard({
  order, itemId, vinculos, sellerSku, skuMatchProducts,
  onSalvar, onCriarProduto, onOpenVincularModal,
  onToast, getHeaders, onOpenDetail,
}: {
  order: MOrder
  itemId: string | null
  vinculos: VinculoItem[]
  sellerSku: string | null
  skuMatchProducts: Array<{ id: string; name: string; sku: string }>
  onSalvar: (productId: string, custo: number, imposto: number) => Promise<void>
  onCriarProduto: (itemId: string) => Promise<void>
  onOpenVincularModal: (payload: {
    listingId:    string
    listingTitle: string
    thumbnail:    string | null
    sellerSku:    string
    candidates:   Array<{ id: string; name: string; sku: string }>
  }) => void
  onToast: (msg: string, type: Toast['type']) => void
  getHeaders: () => Promise<Record<string, string>>
  onOpenDetail: (externalOrderId: string) => void
}) {
  const [buyerOverride, setBuyerOverride] = useState<MOrder['buyer'] | null>(null)
  const [refetching, setRefetching] = useState(false)
  const autoTriedRef = useRef(false)
  const liveBuyer = buyerOverride ?? order.buyer
  useEffect(ensurePulseStyles, [])

  const refetchBilling = useCallback(async () => {
    if (refetching) return
    setRefetching(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/orders/${order.order_id}/refetch-billing`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
      const body = await res.json().catch(() => null) as
        | {
            ok: boolean
            buyer: {
              doc_type:        string | null
              doc_number:      string | null
              email:           string | null
              phone:           string | null
              name:            string | null
              last_name:       string | null
              billing_info_id: string | null
              billing_address: MOrder['buyer']['billing_address']
            } | null
            log?: string[]
            message?: string
          }
        | null
      if (!res.ok || !body?.ok || !body.buyer) {
        onToast(body?.message ?? 'Falha ao buscar dados do comprador', 'error')
      } else {
        setBuyerOverride({
          ...liveBuyer,
          doc_type:           body.buyer.doc_type,
          doc_number:         body.buyer.doc_number,
          full_name:          body.buyer.name,
          billing_last_name:  body.buyer.last_name,
          billing_info_id:    body.buyer.billing_info_id,
          billing_address:    body.buyer.billing_address,
          billing_country:    body.buyer.billing_address?.country_id ?? 'BR',
          email:              body.buyer.email,
          phone:              body.buyer.phone,
          billing_fetched_at: new Date().toISOString(),
        })
        if (body.buyer.doc_number) onToast(`✓ CPF/CNPJ encontrado: ${maskDoc(body.buyer.doc_number, body.buyer.doc_type) ?? ''}`, 'success')
        else                       onToast('ML respondeu sem CPF (LGPD) — use enriquecimento via Direct Data', 'info')
      }
    } catch {
      onToast('Erro de rede ao buscar dados', 'error')
    } finally {
      setRefetching(false)
    }
  }, [refetching, getHeaders, order.order_id, onToast, liveBuyer])

  const [expanded,    setExpanded]    = useState(false)

  /** Auto-refetch billing quando o card é expandido pela primeira vez E
   * o pedido ainda não tem buyer_billing_fetched_at no banco. Elimina
   * 90% dos cliques no botão "Buscar dados" — pedidos que chegaram pelo
   * proxy live antes do cron das :17 são preenchidos transparentemente
   * em background. autoTriedRef garante 1 tentativa por sessão. */
  useEffect(() => {
    if (!expanded) return
    if (liveBuyer.billing_fetched_at) return
    if (autoTriedRef.current) return
    autoTriedRef.current = true
    // 100ms delay pra permitir que o skeleton renderize antes do request
    const t = setTimeout(() => { void refetchBilling() }, 100)
    return () => clearTimeout(t)
  }, [expanded, liveBuyer.billing_fetched_at, refetchBilling])

  const [criando,     setCriando]     = useState(false)
  const [editando,    setEditando]    = useState(true)
  const [salvando,    setSalvando]    = useState(false)
  const [custoEdit,   setCustoEdit]   = useState('')
  const [impostoEdit, setImpostoEdit] = useState('')
  const [margemOverride, setMargemOverride] = useState<{ margem: number; margemPct: number } | null>(null)
  const initialized = useRef(false)

  const isKit        = vinculos.length > 1
  const firstVincProd = vinculos[0]?.product ?? null
  const item         = order.order_items[0]
  const quantidade   = item?.quantity ?? 1
  const custoTotalKit = vinculos.reduce((sum: number, v: VinculoItem) => {
    const cp  = v.product?.cost_price ?? 0
    const qpu = Number(v.quantity_per_unit) || 1
    return sum + cp * qpu * quantidade
  }, 0)

  useEffect(() => {
    if (!initialized.current && vinculos.length > 0) {
      initialized.current = true
      const cp = firstVincProd?.cost_price
      const tp = firstVincProd?.tax_percentage
      setCustoEdit(cp != null && cp !== 0 ? String(cp).replace('.', ',') : '')
      setImpostoEdit(tp != null && tp !== 0 ? String(tp).replace('.', ',') : '')
      if (cp != null && cp > 0 && tp != null && tp > 0) setEditando(false)
      if (cp != null && cp > 0) {
        const valorPago = order.total_amount || 0
        const imposto   = valorPago * ((tp ?? 0) / 100)
        const margem    = (order.lucro_bruto || 0) - custoTotalKit - imposto
        const margemPct = valorPago > 0 ? Math.round((margem / valorPago) * 1000) / 10 : 0
        setMargemOverride({ margem, margemPct })
      }
    }
  }, [vinculos]) // eslint-disable-line react-hooks/exhaustive-deps

  function recalcularMargem(custoVal: string, impostoVal: string) {
    const valorPago   = order.total_amount || 0
    const qty         = order.order_items[0]?.quantity ?? 1
    const custoUnit0  = parseFloat(custoVal.replace(',', '.')) || 0
    const custoKit    = vinculos.reduce((sum: number, v: VinculoItem, i: number) => {
      const cp  = i === 0 ? custoUnit0 : (v.product?.cost_price ?? 0)
      const qpu = Number(v.quantity_per_unit) || 1
      return sum + cp * qpu * qty
    }, 0)
    const impostoRate = parseFloat(impostoVal.replace(',', '.')) || 0
    const imposto     = valorPago * (impostoRate / 100)
    const margem      = (order.lucro_bruto || 0) - custoKit - imposto
    const margemPct   = valorPago > 0 ? Math.round((margem / valorPago) * 1000) / 10 : 0
    setMargemOverride({ margem, margemPct })
  }

  async function handleSalvar() {
    if (!firstVincProd) return
    const custo   = parseFloat(custoEdit.replace(',', '.'))
    const imposto = parseFloat(impostoEdit.replace(',', '.'))
    setSalvando(true)
    try {
      await onSalvar(firstVincProd.id, isNaN(custo) ? 0 : custo, isNaN(imposto) ? 0 : imposto)
      setEditando(false)
      recalcularMargem(custoEdit, impostoEdit)
    } catch {
      onToast('Erro ao salvar', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const moreItems  = (order.order_items?.length ?? 1) - 1
  const color     = avatarColor(order.buyer?.nickname ?? String(order.order_id))
  const ini       = initials(order)
  const buyer     = buyerDisplay(order)
  const lt        = order.shipping?.logistic_type
  const lbadge    = LOGISTIC[lt ?? ''] ?? { text: lt ?? 'Normal', color: '#52525b', bg: '#111114' }
  const deadline  = deadlineInfo(order.shipping?.posting_deadline)
  const estDel    = order.shipping?.estimated_delivery_date
    ? new Date(order.shipping?.estimated_delivery_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null
  const payment   = order.payments?.[0]
  const payIcon   = PAY_ICON[payment?.payment_type ?? ''] ?? '💳'

  const vars = (item?.variation_attributes ?? [])
    .filter(v => v.value_name)
    .map(v => `${v.name}: ${v.value_name}`)
    .join(' · ')

  return (
    <div className="rounded-xl transition-colors relative" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      {/* Kebab — top-right, sem o botão detalhe (movido pra rodapé do
          card, ao lado do link "Venda #X" — UI-1.1). */}
      <div className="absolute top-2 right-2 z-10">
        <OrderActionsMenu order={order} />
      </div>
      <div className="grid gap-0" style={{ gridTemplateColumns: '200px 1fr 210px' }}>

        {/* ── Buyer ── */}
        <div className="p-4 flex flex-col gap-2 justify-between" style={{ borderRight: '1px solid #1a1a1f' }}>
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: color, color: '#000' }}>
              {ini}
            </div>
            <div className="min-w-0">
              <p className="text-zinc-100 text-xs font-semibold leading-tight truncate">{buyer}</p>
              {order.buyer?.nickname && buyer !== order.buyer?.nickname && (
                <p className="text-zinc-500 text-[10px]">@{order.buyer?.nickname}</p>
              )}
              {(() => {
                const ss = order.shipping?.status
                const si = ss ? SHIPPING_STATUS_MAP[ss] : ORDER_STATUS_MAP[order.status]
                if (!si) return null
                return (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ color: si.color, background: `${si.color}18`, border: `1px solid ${si.color}33` }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: si.color }} />
                    {si.label}
                  </span>
                )
              })()}
            </div>
          </div>
          <div className="space-y-0.5">
            {/* Vincular por SKU — só ativo quando anúncio NÃO tem vínculo
                E existe produto(s) no catálogo com o mesmo SKU do anúncio.
                Click abre modal pra escolher e confirmar. */}
            {itemId && sellerSku && (
              <VincularButton
                hasExistingLink={vinculos.length > 0}
                skuMatchProducts={skuMatchProducts}
                onClick={() => onOpenVincularModal({
                  listingId:    itemId,
                  listingTitle: item?.title ?? `Anúncio ${itemId}`,
                  thumbnail:    item?.thumbnail ?? null,
                  sellerSku,
                  candidates:   skuMatchProducts,
                })}
              />
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <a href={`https://www.mercadolivre.com.br/vendas/${order.order_id}`} target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors">
                Venda #{order.order_id}
              </a>
              <button
                onClick={() => onOpenDetail(String(order.order_id))}
                title="Ver detalhe completo (Cliente + Comunicação)"
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors hover:bg-[rgba(0,229,255,0.08)]"
                style={{ background: 'transparent', border: '1px solid #00E5FF', color: '#00E5FF' }}>
                <Eye size={11} />
                Ver detalhe
              </button>
            </div>
            {(order as unknown as { pack_id?: number | string | null }).pack_id && (
              <p className="text-[10px] font-mono text-zinc-500">
                Carrinho #{(order as unknown as { pack_id: number | string }).pack_id}
              </p>
            )}
            {order.shipping?.receiver_address?.zip_code && (
              <p className="text-[10px] text-zinc-500">
                CEP {order.shipping?.receiver_address?.zip_code}
                {order.shipping?.receiver_address?.city ? ` · ${order.shipping?.receiver_address?.city}` : ''}
              </p>
            )}
            <p className="text-[10px] text-zinc-500" title={`Pedido criado em ${new Date(order.date_created).toLocaleString('pt-BR')}`}>
              {orderDateTime(order.date_created)}
            </p>
          </div>
        </div>

        {/* ── Product ── */}
        <div className="p-4 flex flex-col gap-2" style={{ borderRight: '1px solid #1a1a1f' }}>
          {item && (
            <>
              <div className="flex items-start gap-3">
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center shadow-lg shadow-black/40"
                  style={{ border: '1px solid #1a1a1f' }}>
                  {item.thumbnail
                    ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                    : <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#3f3f46" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                      </svg>
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-100 text-xs font-medium line-clamp-2 leading-snug">
                    <span className="text-zinc-400 font-bold">{item.quantity}x </span>{item.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 mt-1 text-[10px] text-zinc-500">
                    {item.seller_sku && (
                      <span className="inline-flex items-center gap-0.5">
                        SKU: <span className="text-zinc-400 font-mono">{item.seller_sku}</span>
                        <CopyButton value={String(item.seller_sku)} size={10} label="SKU copiado" />
                      </span>
                    )}
                    {item.item_id && (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="font-mono text-zinc-600">{item.item_id}</span>
                        <CopyButton value={item.item_id} size={10} label="MLB copiado" />
                      </span>
                    )}
                  </div>
                  {vars && <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{vars}</p>}
                  {(item as unknown as { available_quantity?: number | null }).available_quantity != null && (
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {(item as unknown as { available_quantity: number }).available_quantity} disponíveis após esta venda
                    </p>
                  )}
                </div>
              </div>

              {moreItems > 0 && (
                <p className="text-[10px] text-zinc-600">+{moreItems} produto{moreItems > 1 ? 's' : ''}</p>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-100">{brl(item.unit_price)}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: lbadge.bg, color: lbadge.color }}>{lbadge.text}</span>
                {isKit && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                    Kit {vinculos.length} itens
                  </span>
                )}
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
                {(order as unknown as { coupon?: { amount?: number } | null }).coupon?.amount != null && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                    🎟️ Cupom -{brl((order as unknown as { coupon: { amount: number } }).coupon.amount)}
                  </span>
                )}
                {(order as unknown as { context?: { channel?: string; flows?: string[] } | null }).context?.flows?.includes('publicidade') && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}>
                    📣 Publicidade
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
        <div className="p-4 pr-5 flex flex-col gap-0.5">
          <FinRow icon={payIcon} label="Valor pago"     value={brl(order.total_amount)}
            tooltip={`Valor pago pelo comprador (produtos + frete)\n* ID pgto: ${order.payments?.[0]?.id ?? '—'}\n* Modo: ${order.payments?.[0]?.payment_type ?? '—'}`} />

          {/* Reembolso ML do frete — só renderiza se houve */}
          {(order.shipping_breakdown?.ml_refund ?? 0) > 0 && (
            <FinRow icon="🔄" label="Reembolso ML frete"
              value={brl(order.shipping_breakdown!.ml_refund)} color="#4ade80"
              tooltip="Valor reembolsado pelo Mercado Livre pra esse tipo de frete" />
          )}

          <FinRow icon="🏪" label="Tarifa ML"           value={`-${brl(order.tarifa_ml)}`} color="#f87171"
            tooltip={`Tarifa do ML: ${brl(order.tarifa_ml)} (~${order.total_amount > 0 ? Math.round((order.tarifa_ml / order.total_amount) * 1000) / 10 : 0}%)`} />

          <FinRow icon="🚚" label="Frete vendedor"
            value={order.frete_vendedor ? `-${brl(order.frete_vendedor)}` : brl(0)} color={order.frete_vendedor > 0 ? '#f87171' : '#71717a'}
            tooltip={`Frete Comprador: ${brl(order.shipping_breakdown?.buyer_paid ?? order.frete_comprador ?? 0)}\nReembolso ML: ${brl(order.shipping_breakdown?.ml_refund ?? 0)}\nFrete Vendedor: ${brl(order.frete_vendedor)}`} />
          <div className="border-t my-1.5" style={{ borderColor: '#1e1e24' }} />
          <FinRow icon="💰" label="Lucro bruto"
            value={
              order.total_amount > 0
                ? `${brl(order.lucro_bruto)} (${((order.lucro_bruto / order.total_amount) * 100).toFixed(1)}%)`
                : brl(order.lucro_bruto)
            }
            color={order.lucro_bruto >= 0 ? '#4ade80' : '#f87171'}
            tooltip={`Lucro Bruto da Venda — ${order.total_amount > 0 ? ((order.lucro_bruto / order.total_amount) * 100).toFixed(2) : 0}% do valor do anúncio\n(valor − tarifa − frete vendedor)`} />
          {/* Custo / Imposto — 3 estados: vinculado | sem produto (criar) | sem item_id */}
          {vinculos.length > 0 ? (
            <>
              {/* Custo row */}
              <div className="flex items-center justify-between gap-1 py-0.5">
                <span className="text-xs shrink-0">📦</span>
                <span className="flex-1 text-xs text-zinc-500 leading-tight">{isKit ? 'Custo kit' : 'Custo (CMV)'}</span>
                {editando ? (
                  <div className="shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-600">R$</span>
                      <input
                        type="text" inputMode="decimal" placeholder="0,00"
                        value={custoEdit}
                        onChange={e => { setCustoEdit(e.target.value.replace(/[^\d,\.]/g, '')); recalcularMargem(e.target.value, impostoEdit) }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#00E5FF'; e.currentTarget.select() }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#2a2a3f' }}
                        onWheel={e => e.currentTarget.blur()}
                        className="pedidos-number-input w-16 bg-[#0d0d10] rounded px-1.5 py-0.5 text-xs text-white text-right outline-none transition-colors placeholder:text-zinc-700"
                        style={{ border: '1px solid #2a2a3f' }}
                      />
                    </div>
                    {isKit && (
                      <p className="text-[10px] text-violet-500 text-right mt-0.5">
                        {isKit ? `1º produto do kit` : ''}
                      </p>
                    )}
                    {!isKit && quantidade > 1 && custoEdit && (
                      <p className="text-xs text-zinc-600 text-right mt-0.5">
                        Total: {brl((parseFloat(custoEdit.replace(',', '.')) || 0) * quantidade)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-right shrink-0">
                    {custoTotalKit > 0 ? (
                      <>
                        <div className="text-xs font-semibold tabular-nums text-zinc-200">{brl(custoTotalKit)}</div>
                        {isKit && (
                          <div className="text-[10px] text-violet-500">{vinculos.length} produtos</div>
                        )}
                        {!isKit && quantidade > 1 && (
                          <div className="text-xs text-zinc-600">{quantidade} × {brl(firstVincProd?.cost_price ?? 0)}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                  </div>
                )}
              </div>
              {/* Imposto row */}
              <div className="flex items-center justify-between gap-1 py-0.5">
                <span className="text-xs shrink-0">⚖️</span>
                <span className="flex-1 text-xs text-zinc-500 leading-tight">Imposto</span>
                {editando ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="text" inputMode="decimal" placeholder="0"
                      value={impostoEdit}
                      onChange={e => { setImpostoEdit(e.target.value.replace(/[^\d,\.]/g, '')); recalcularMargem(custoEdit, e.target.value) }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#00E5FF'; e.currentTarget.select() }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#2a2a3f' }}
                      onWheel={e => e.currentTarget.blur()}
                      className="pedidos-number-input w-12 bg-[#0d0d10] rounded px-1.5 py-0.5 text-xs text-white text-right outline-none transition-colors placeholder:text-zinc-700"
                      style={{ border: '1px solid #2a2a3f' }}
                    />
                    <span className="text-xs text-zinc-600">%</span>
                  </div>
                ) : (
                  <div className="text-right shrink-0">
                    {firstVincProd?.tax_percentage != null && firstVincProd.tax_percentage > 0 ? (
                      <>
                        <div className="text-xs font-semibold tabular-nums text-zinc-200">
                          {brl(order.total_amount * (firstVincProd.tax_percentage / 100))}
                        </div>
                        <div className="text-xs text-zinc-600">
                          {firstVincProd.tax_percentage}% de {brl(order.total_amount)}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                  </div>
                )}
              </div>
              {/* Action buttons */}
              {editando ? (
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  {(firstVincProd?.cost_price != null || firstVincProd?.tax_percentage != null) && (
                    <button
                      type="button"
                      onClick={() => {
                        const cp = firstVincProd?.cost_price
                        const tp = firstVincProd?.tax_percentage
                        setCustoEdit(cp != null && cp !== 0 ? String(cp).replace('.', ',') : '')
                        setImpostoEdit(tp != null && tp !== 0 ? String(tp).replace('.', ',') : '')
                        setEditando(false)
                      }}
                      className="text-[10px] px-2 py-0.5 rounded transition-colors hover:text-zinc-300"
                      style={{ color: '#a1a1aa' }}>
                      Cancelar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={handleSalvar}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded font-semibold transition-all disabled:opacity-60"
                    style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                    {salvando ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {salvando ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              ) : (
                <div className="flex justify-end mt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const cp = firstVincProd?.cost_price
                      const tp = firstVincProd?.tax_percentage
                      setCustoEdit(cp != null && cp !== 0 ? String(cp).replace('.', ',') : '')
                      setImpostoEdit(tp != null && tp !== 0 ? String(tp).replace('.', ',') : '')
                      setEditando(true)
                    }}
                    className="flex items-center gap-1 text-[10px] text-cyan-600 hover:text-cyan-400 transition-colors">
                    <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Alterar
                  </button>
                </div>
              )}
            </>
          ) : itemId ? (
            <>
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-xs shrink-0">📦</span>
                <span className="flex-1 text-xs text-zinc-500 leading-tight">Custo (CMV)</span>
                <button
                  type="button"
                  disabled={criando}
                  onClick={() => {
                    setCriando(true)
                    onCriarProduto(itemId).finally(() => setCriando(false))
                  }}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold transition-all disabled:opacity-60 shrink-0"
                  style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}
                >
                  {criando ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  )}
                  {criando ? 'Criando…' : 'Criar Produto'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-xs shrink-0">⚖️</span>
                <span className="flex-1 text-xs text-zinc-500 leading-tight">Imposto</span>
                <span className="text-[11px] text-zinc-700">—</span>
              </div>
              <p className="text-[10px] text-zinc-700 text-right mt-0.5">Anúncio não vinculado a produto</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-xs shrink-0">📦</span>
                <span className="flex-1 text-xs text-zinc-500 leading-tight">Custo (CMV)</span>
                <span className="text-[11px] text-zinc-700">—</span>
              </div>
              <div className="flex items-center justify-between gap-2 py-0.5">
                <span className="text-xs shrink-0">⚖️</span>
                <span className="flex-1 text-xs text-zinc-500 leading-tight">Imposto</span>
                <span className="text-[11px] text-zinc-700">—</span>
              </div>
            </>
          )}
          <div className="border-t my-1.5" style={{ borderColor: '#1e1e24' }} />
          {(() => {
            const cm = margemOverride ?? (order.contribution_margin != null
              ? { margem: order.contribution_margin, margemPct: order.contribution_margin_pct ?? 0 }
              : null)
            const mc = cm != null ? (cm.margem >= 0 ? '#4ade80' : '#f87171') : '#4ade80'
            // % sobre o custo (ROI direto sobre CMV) — mais útil pra
            // entender retorno do que % sobre anúncio.
            const custoBase = order.cost_price ?? 0
            const pctSobreCusto = cm != null && custoBase > 0
              ? (cm.margem / custoBase) * 100
              : null
            return (
              <Tip text={cm != null
                ? `Margem de Contribuição da Venda\n${cm.margemPct}% do valor do anúncio${pctSobreCusto != null ? `\n${pctSobreCusto.toFixed(2)}% do valor do custo` : ''}`
                : 'Configure custo no produto para ver a margem'}>
                <div className="flex items-center justify-between gap-2 py-0.5 cursor-default">
                  <span className="text-sm">🟢</span>
                  <span className="flex-1 text-xs font-semibold text-zinc-300 leading-tight">Margem contrib.</span>
                  {cm != null
                    ? <div className="flex flex-col items-end">
                        <span className="text-sm font-bold tabular-nums" style={{ color: mc }}>
                          {brl(cm.margem)}
                          <span className="text-xs font-semibold opacity-80 ml-1">({cm.margemPct}%)</span>
                        </span>
                        {pctSobreCusto != null && (
                          <span className="text-[10px] text-zinc-500 tabular-nums">
                            {pctSobreCusto.toFixed(1)}% do custo
                          </span>
                        )}
                      </div>
                    : <span className="text-xs text-zinc-700">—</span>
                  }
                </div>
              </Tip>
            )
          })()}
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
        <div className="px-4 pb-5 pt-4 space-y-3" style={{ borderTop: '1px solid #1a1a1f' }}>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>

            {/* Comprador */}
            <div className="p-3 rounded-xl space-y-1.5" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Comprador</p>
                <div className="flex items-center gap-1.5">
                  {/* Botão "📥 Buscar dados" só quando billing nunca foi tentado.
                      Se já tentou e voltou sem CPF (ML 404 / LGPD), nada de
                      botão amarelo — vira o banner abaixo. */}
                  {!liveBuyer.billing_fetched_at && (
                    <button onClick={refetchBilling} disabled={refetching}
                      aria-busy={refetching || undefined}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-opacity disabled:opacity-50 ${pulseClass(refetching)}`}
                      style={{ background: 'rgba(250,204,21,0.10)', color: '#facc15', border: '1px solid rgba(250,204,21,0.30)' }}>
                      📥 Buscar dados de faturamento
                    </button>
                  )}
                  {liveBuyer.billing_fetched_at && (
                    <button onClick={refetchBilling} disabled={refetching}
                      aria-busy={refetching || undefined}
                      className={`text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-50 px-1.5 ${pulseClass(refetching)}`}
                      title="Re-consultar billing_info">
                      ↻
                    </button>
                  )}
                </div>
              </div>

              {/* Banner: ML respondeu mas não veio CPF (vendas pré-LGPD ou
                  buyer optou por não compartilhar). Próximo passo: enrichment
                  cascade via /enrichment/customer/:id na tela /clientes. */}
              {liveBuyer.billing_fetched_at && !liveBuyer.doc_number && (
                <div className="rounded-md px-2 py-1.5 mb-1 text-[10px] leading-snug"
                  style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)', color: '#93c5fd' }}>
                  ⓘ ML não retornou CPF para este pedido (404 ou LGPD). Use o enriquecimento via Direct Data com o cliente em <span className="font-mono">/clientes</span>.
                </div>
              )}

              {/* Skeleton durante auto-refetch (Bloco UX: refetch em background
                  ao expandir card pela 1ª vez se billing_fetched_at IS NULL).
                  3 linhas pulsantes simulam Nome / CPF / Endereço. */}
              {refetching && !liveBuyer.doc_number && !liveBuyer.full_name && (
                <>
                  <div className="space-y-1.5 animate-pulse">
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">Nome</span>
                      <div className="h-3 rounded w-32" style={{ background: '#1a1a1f' }} />
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">CPF</span>
                      <div className="h-3 rounded w-28" style={{ background: '#1a1a1f' }} />
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">End. fiscal</span>
                      <div className="space-y-1 flex-1">
                        <div className="h-3 rounded w-40" style={{ background: '#1a1a1f' }} />
                        <div className="h-3 rounded w-24" style={{ background: '#1a1a1f' }} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {!(refetching && !liveBuyer.doc_number && !liveBuyer.full_name) && (liveBuyer.full_name || liveBuyer.first_name || liveBuyer.last_name) && (
                <div className="flex items-start gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-14 shrink-0">Nome</span>
                  <span className="text-[11px] text-zinc-200 font-medium leading-tight">
                    {liveBuyer.full_name ?? [liveBuyer.first_name, liveBuyer.last_name].filter(Boolean).join(' ')}
                  </span>
                </div>
              )}

              {liveBuyer.doc_number && (
                <div className="flex items-start gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-14 shrink-0">
                    {String(liveBuyer.doc_type ?? '').toUpperCase().includes('CNPJ') ? 'CNPJ' : 'CPF'}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: '#4ade80' }}>
                    {maskDoc(liveBuyer.doc_number, liveBuyer.doc_type)}
                  </span>
                </div>
              )}

              {liveBuyer.billing_address && (() => {
                const a   = liveBuyer.billing_address!
                const lin = [a.street_name, a.street_number].filter(Boolean).join(', ')
                const cityName = a.city_name ?? a.city?.name ?? null
                const lin2 = [a.neighborhood?.name, cityName, a.state?.name].filter(Boolean).join(' · ')
                return (
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px] text-zinc-600 w-14 shrink-0">End. fiscal</span>
                    <div className="text-[11px] text-zinc-300 leading-tight">
                      {lin && <p>{lin}{a.comment ? `, ${a.comment}` : ''}</p>}
                      {lin2 && <p className="text-zinc-500">{lin2}</p>}
                      {a.zip_code && <p className="text-zinc-600 font-mono">CEP {a.zip_code}</p>}
                    </div>
                  </div>
                )
              })()}

              {liveBuyer.email
                ? (
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px] text-zinc-600 w-14 shrink-0">Email</span>
                    <span className="text-[11px] text-zinc-300 break-all">{liveBuyer.email}</span>
                  </div>
                )
                : liveBuyer.doc_number ? (
                  <div className="flex items-start gap-1.5"
                    title="ML não fornece email via API (LGPD). Use o enriquecimento via Direct Data com o CPF.">
                    <span className="text-[11px] text-zinc-600 w-14 shrink-0">Email</span>
                    <span className="text-[11px] text-zinc-700">— (vem do enriquecimento)</span>
                  </div>
                ) : null}

              {liveBuyer.phone && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-14 shrink-0">Telefone</span>
                  <span className="text-[11px] text-zinc-300 font-mono">{fmtPhone(liveBuyer.phone)}</span>
                </div>
              )}

              {!(refetching && !liveBuyer.doc_number && !liveBuyer.full_name) && liveBuyer.nickname && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-14 shrink-0">@usuário</span>
                  <span className="text-[11px] text-zinc-300 font-mono">@{liveBuyer.nickname}</span>
                </div>
              )}

              {!(refetching && !liveBuyer.doc_number && !liveBuyer.full_name) && liveBuyer.id && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-14 shrink-0">ID</span>
                  <span className="text-[11px] text-zinc-600 font-mono">{liveBuyer.id}</span>
                </div>
              )}

              {!liveBuyer.doc_number && liveBuyer.billing_fetched_at && (
                <p className="text-[10px] text-zinc-600 mt-2 leading-tight">
                  ⓘ ML não liberou CPF/email para este pedido (LGPD).
                  Use o enriquecimento via Direct Data com o CPF para resolver telefones/emails completos.
                </p>
              )}
            </div>

            {/* Pagamento */}
            <div className="p-3 rounded-xl space-y-1.5" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Pagamento</p>
              {order.payments?.length === 0
                ? <span className="text-[11px] text-zinc-700">Nenhum pagamento</span>
                : order.payments?.map((pay, i) => {
                    const ps = PAY_STATUS[pay.status]
                    return (
                      <div key={pay.id}>
                        {order.payments?.length > 1 && (
                          <p className="text-[10px] text-zinc-600 mb-1">Pgto. {i + 1}</p>
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-zinc-600 w-14 shrink-0">Tipo</span>
                            <span className="text-[11px] text-zinc-300">
                              {PAY_ICON[pay.payment_type] ?? '💳'} {PAY_LABEL[pay.payment_type] ?? pay.payment_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-zinc-600 w-14 shrink-0">Status</span>
                            <span className="text-[11px] font-semibold" style={{ color: ps?.color ?? '#71717a' }}>
                              {ps?.label ?? pay.status}
                            </span>
                          </div>
                          {pay.installments > 1 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-zinc-600 w-14 shrink-0">Parcelas</span>
                              <span className="text-[11px] text-zinc-300">{pay.installments}x</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-zinc-600 w-14 shrink-0">Valor</span>
                            <span className="text-[11px] font-semibold text-zinc-200 tabular-nums">{brl(pay.total_paid_amount)}</span>
                          </div>
                        </div>
                        {i < order.payments?.length - 1 && (
                          <div className="border-t mt-2 mb-1" style={{ borderColor: '#1e1e24' }} />
                        )}
                      </div>
                    )
                  })
              }
            </div>

            {/* Endereço */}
            <div className="p-3 rounded-xl space-y-1.5" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Endereço de entrega</p>
              {order.shipping?.receiver_address?.street_name ? (
                <>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px] text-zinc-600 w-14 shrink-0">Rua</span>
                    <span className="text-[11px] text-zinc-200 leading-tight">
                      {order.shipping?.receiver_address?.street_name}
                      {order.shipping?.receiver_address?.street_number ? `, ${order.shipping?.receiver_address?.street_number}` : ''}
                    </span>
                  </div>
                  {order.shipping?.receiver_address?.complement && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">Compl.</span>
                      <span className="text-[11px] text-zinc-300">{order.shipping?.receiver_address?.complement}</span>
                    </div>
                  )}
                  {order.shipping?.receiver_address?.neighborhood && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">Bairro</span>
                      <span className="text-[11px] text-zinc-300">{order.shipping?.receiver_address?.neighborhood}</span>
                    </div>
                  )}
                  {order.shipping?.receiver_address?.city && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">Cidade</span>
                      <span className="text-[11px] text-zinc-300">
                        {order.shipping?.receiver_address?.city}
                        {order.shipping?.receiver_address?.state ? ` / ${order.shipping?.receiver_address?.state}` : ''}
                      </span>
                    </div>
                  )}
                  {order.shipping?.receiver_address?.zip_code && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">CEP</span>
                      <span className="text-[11px] text-zinc-300 font-mono">{order.shipping?.receiver_address?.zip_code}</span>
                    </div>
                  )}
                  {order.shipping?.receiver_address?.address_line && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">Linha</span>
                      <span className="text-[11px] text-zinc-500 italic">{order.shipping?.receiver_address?.address_line}</span>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[11px] text-zinc-700">Endereço não disponível</span>
              )}
            </div>

            {/* Envio */}
            <div className="p-3 rounded-xl space-y-1.5" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Envio</p>
              {order.shipping?.id && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">ID Envio</span>
                  <a href={`https://www.mercadolivre.com.br/envios/${order.shipping?.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[11px] font-mono text-cyan-500 hover:text-cyan-300 transition-colors">
                    {order.shipping?.id}
                  </a>
                </div>
              )}
              {order.shipping?.logistic_type && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Logística</span>
                  <span className="text-[11px] font-semibold"
                    style={{ color: (LOGISTIC[order.shipping?.logistic_type] ?? { color: '#71717a' }).color }}>
                    {(LOGISTIC[order.shipping?.logistic_type] ?? { text: order.shipping?.logistic_type }).text}
                  </span>
                </div>
              )}
              {order.shipping?.status && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Status</span>
                  <span className="text-[11px] font-semibold"
                    style={{ color: (SHIPPING_STATUS_MAP[order.shipping?.status] ?? { color: '#71717a' }).color }}>
                    {(SHIPPING_STATUS_MAP[order.shipping?.status] ?? { label: order.shipping?.status }).label}
                  </span>
                </div>
              )}
              {order.shipping?.substatus && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Substatus</span>
                  <span className="text-[11px] text-zinc-400">{order.shipping?.substatus}</span>
                </div>
              )}
              {order.shipping?.date_created && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Criado em</span>
                  <span className="text-[11px] text-zinc-400">{fmtDate(order.shipping?.date_created)}</span>
                </div>
              )}
              {order.shipping?.posting_deadline && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Pr. postagem</span>
                  <span className="text-[11px] text-zinc-400">{fmtDate(order.shipping?.posting_deadline)}</span>
                </div>
              )}
              {order.shipping?.estimated_delivery_date && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Prev. entrega</span>
                  <span className="text-[11px] text-zinc-400">{fmtDate(order.shipping?.estimated_delivery_date)}</span>
                </div>
              )}
              {(order.shipping as unknown as { receiver_name?: string | null })?.receiver_name && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Quem recebe</span>
                  <span className="text-[11px] text-zinc-400">{(order.shipping as unknown as { receiver_name: string }).receiver_name}</span>
                </div>
              )}
              {(order.shipping as unknown as { tracking_number?: string | null })?.tracking_number && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Rastreio</span>
                  <span className="text-[11px] font-mono text-cyan-500">
                    {(order.shipping as unknown as { tracking_number: string }).tracking_number}
                  </span>
                </div>
              )}
              {(order.shipping as unknown as { delivery_type?: string | null })?.delivery_type && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Tipo entrega</span>
                  <span className="text-[11px] text-zinc-400">
                    {(order.shipping as unknown as { delivery_type: string }).delivery_type}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Itens do pedido (apenas se múltiplos) */}
          {order.order_items.length > 1 && (
            <div className="p-3 rounded-xl" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Itens do pedido</p>
              <div className="space-y-1.5">
                {order.order_items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-zinc-300 w-6 shrink-0">{it.quantity}x</span>
                    <span className="text-[11px] text-zinc-400 flex-1 truncate">{it.title}</span>
                    <span className="text-[11px] font-semibold text-zinc-200 shrink-0 tabular-nums">{brl(it.unit_price * it.quantity)}</span>
                  </div>
                ))}
              </div>
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
                style={p === page ? { background: '#00E5FF', color: '#000' } : { color: '#a1a1aa' }}>
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

// ── Active filter chip (filtros avançados de pedidos) ────────────────────────

function ChipPed({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
      style={{ background: 'rgba(0,229,255,0.06)', borderColor: 'rgba(0,229,255,0.25)', color: '#67e8f9' }}>
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors -mr-0.5"
        aria-label={`Remover filtro ${label}`}>
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}

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
  const [pageSize,   setPageSizeRaw] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE
    const raw = window.localStorage.getItem(PAGE_SIZE_LS_KEY)
    const n = raw ? Number(raw) : DEFAULT_PAGE_SIZE
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE
  })
  const setPageSize = useCallback((n: number) => {
    setPageSizeRaw(n)
    setPage(0)
    try { window.localStorage.setItem(PAGE_SIZE_LS_KEY, String(n)) } catch { /* noop */ }
  }, [])
  const [q,          setQ]          = useState('')
  const [modal,      setModal]      = useState(false)
  const [toasts,     setToasts]     = useState<Toast[]>([])
  const [vinculosPorListing, setVinculosPorListing] = useState<Record<string, VinculoItem[]>>({})
  const [lastUpdate,  setLastUpdate]  = useState<Date>(new Date())
  const [minsSince,   setMinsSince]   = useState(0)
  // Sprint B bloco 1 — terceira opção de view (DataTable beta opt-in).
  // Default 'cards' = comportamento atual. 'table' renderiza <PedidosTable>.
  const [view,        setView]        = useState<'cards' | 'table'>('cards')
  // Sprint B bloco 2 — drawer detail aberto por click numa linha da tabela
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  // Modal de vínculo por SKU (opens quando user clica em "Vincular" no card)
  const [vincularModal, setVincularModal] = useState<{
    listingId:    string
    listingTitle: string
    thumbnail:    string | null
    sellerSku:    string
    candidates:   Array<{ id: string; name: string; sku: string }>
  } | null>(null)
  // UI-1.1 — header consolidado (state que vivia no PedidosToolsPanel)
  const [billingPending, setBillingPending] = useState<number | null>(null)
  const [syncing,        setSyncing]        = useState(false)
  // Inicialização vinda de query params do dashboard ("Atualizar →"
  // dispara /pedidos?missing_cost=1&period=today). Lemos UMA vez de
  // window.location pra evitar Suspense boundary do useSearchParams.
  // useMemo([]) garante que rodará só na 1ª render — re-renders não
  // re-leem a URL (filtros viram state local depois).
  const initFromQs = useMemo(() => {
    if (typeof window === 'undefined') return { missingCost: false, period: 'all' as const }
    const sp = new URLSearchParams(window.location.search)
    const p = sp.get('period')
    return {
      missingCost: sp.get('missing_cost') === '1',
      period:      (p === 'today' || p === '7d' || p === '30d' ? p : 'all') as 'all' | 'today' | '7d' | '30d',
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filtros avançados
  const [advOpen, setAdvOpen]               = useState<boolean>(initFromQs.missingCost)
  const [filterUFs, setFilterUFs]           = useState<Set<string>>(new Set())
  const [filterPeriod, setFilterPeriod]     = useState<'all' | 'today' | '7d' | '30d'>(initFromQs.period)
  const [filterValueMin, setFilterValueMin] = useState<string>('')
  const [filterValueMax, setFilterValueMax] = useState<string>('')
  const [filterFlags, setFilterFlags]       = useState({
    noLink:     false,
    noCost:     initFromQs.missingCost,
    noCampaign: false,
    noTracking: false,
    recurring:  false,
  })
  // Modo cross-tab: ignora filtro de aba (backend retorna todos os
  // pedidos do periodo). Acionado automaticamente quando vem com
  // ?missing_cost=1 do dashboard, porque os pedidos sem custo podem
  // estar em qualquer aba (despachadas, encerradas, etc).
  // User troca de aba manualmente -> sai do modo cross-tab.
  const [crossTabMode, setCrossTabMode] = useState<boolean>(initFromQs.missingCost)
  const [adItems, setAdItems] = useState<Set<string>>(new Set())
  const tid = useRef(0)
  const pageRef = useRef(0)
  const qRef    = useRef('')
  const tabRef  = useRef<TabKey>('abertas')

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
      // /orders/list/kpis agrega SQL — instantaneo, sem ML calls.
      const sellerId = getStoredSellerId()
      const url = sellerId != null
        ? `${BACKEND}/orders/list/kpis?seller_id=${sellerId}`
        : `${BACKEND}/orders/list/kpis`
      const res = await fetch(url, { headers })
      if (res.ok) setKpis(await res.json())
    } catch { /* silent */ }
    finally { setKpiLoad(false) }
  }, [getHeaders])

  // UI-1.1 — billingPending count + sync (movidos do PedidosToolsPanel deletado)
  const loadPending = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res  = await fetch(`${BACKEND}/ml/orders/billing-pending-count`, { headers })
      const body = await res.json().catch(() => null) as { count?: number } | null
      setBillingPending(typeof body?.count === 'number' ? body.count : 0)
    } catch { setBillingPending(0) }
  }, [getHeaders])

  const sync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const headers = await getHeaders()
      // Endpoint Supabase-auth (JWT do usuário). NÃO usamos /admin/sync-now
      // do browser pra não expor ADMIN_SECRET no cliente — esse fica
      // reservado pra GitHub Action / cron OS sem session token.
      const res = await fetch(`${BACKEND}/sales-aggregator/sync-now`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      })
      const body = await res.json().catch(() => null) as { runId?: string; message?: string } | null
      if (!res.ok || !body?.runId) toast(body?.message ?? 'Falha ao sincronizar', 'error')
      else toast(`✓ Sync de 7 dias iniciado (runId ${body.runId.slice(0, 8)}…)`, 'success')
      setTimeout(loadPending, 30_000)
    } catch { toast('Erro de rede ao sincronizar', 'error') }
    finally { setSyncing(false) }
  }, [syncing, getHeaders, loadPending])

  const loadOrders = useCallback(async (currentPage: number, query: string, currentTab: TabKey | null) => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      // Em cross-tab mode pedimos mais por pagina (200 max do backend) pra
      // o filtro local ter chance de achar os matchs em uma carga
      const effectiveLimit = currentTab === null ? Math.max(pageSize, 200) : pageSize
      const params  = new URLSearchParams({ offset: String(currentPage * effectiveLimit), limit: String(effectiveLimit) })
      if (query.trim())  params.set('q', query.trim())
      const sellerId = getStoredSellerId()
      if (sellerId != null) params.set('seller_id', String(sellerId))
      // Filtro por tab no servidor — evita reduzir N por pagina quando
      // a aba ativa nao bate com a maioria dos pedidos retornados.
      // Cross-tab mode: nao passa tab, backend retorna todos.
      if (currentTab !== null) params.set('tab', currentTab)
      const res  = await fetch(`${BACKEND}/orders/list?${params}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      setOrders(body.orders ?? [])
      setTotal(body.total   ?? 0)
      setLastUpdate(new Date())
      setMinsSince(0)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao carregar pedidos', 'error')
      setOrders([])
    } finally { setLoading(false) }
  }, [getHeaders, pageSize])

  // Busca todos os vínculos uma vez — matching feito localmente em memória
  useEffect(() => {
    supabase
      .from('product_listings')
      .select('listing_id, quantity_per_unit, product:products(id, sku, name, cost_price, tax_percentage)')
      .eq('is_active', true)
      .eq('platform', 'mercadolivre')
      .limit(5000)
      .then(({ data, error }) => {
        if (error) console.error('[pedidos] erro query product_listings:', error)
        const rows = (data ?? []) as unknown as VinculoItem[]
        const map: Record<string, VinculoItem[]> = {}
        for (const v of rows) {
          if (!v.product?.id) continue
          const lid = v.listing_id
          if (!map[lid]) map[lid] = []
          map[lid].push(v)
        }
        setVinculosPorListing(map)
      })
  }, [supabase])

  // Source #2: products com ml_listing_id direto (mesma fonte que o
  // dashboard usa pra contar "X pedidos sem custo"). Sem isso o filtro
  // 'Sem custo' sub-conta porque ignora produtos vinculados via sync
  // automático (não pela UI manual de /catalogo/vinculos).
  const [produtosPorMlListingId, setProdutosPorMlListingId] = useState<Record<string, Array<{ cost_price: number | null; tax_percentage: number | null }>>>({})
  useEffect(() => {
    supabase
      .from('products')
      .select('ml_listing_id, cost_price, tax_percentage')
      .not('ml_listing_id', 'is', null)
      .limit(10000)
      .then(({ data, error }) => {
        if (error) { console.error('[pedidos] erro query products by ml_listing_id:', error); return }
        const map: Record<string, Array<{ cost_price: number | null; tax_percentage: number | null }>> = {}
        for (const p of (data ?? []) as Array<{ ml_listing_id: string; cost_price: number | null; tax_percentage: number | null }>) {
          if (!p.ml_listing_id) continue
          if (!map[p.ml_listing_id]) map[p.ml_listing_id] = []
          map[p.ml_listing_id].push({ cost_price: p.cost_price, tax_percentage: p.tax_percentage })
        }
        setProdutosPorMlListingId(map)
      })
  }, [supabase])

  // Catálogo: products com SKU preenchido — pra detectar matching com
  // anúncios não-vinculados e habilitar botão "Vincular".
  // Mapa SKU normalizado → ARRAY de produtos (pode haver mais de 1 com
  // mesmo SKU; user escolhe no modal).
  const [skuToProducts, setSkuToProducts] = useState<Record<string, Array<{ id: string; name: string; sku: string }>>>({})
  useEffect(() => {
    supabase
      .from('products')
      .select('id, sku, name')
      .not('sku', 'is', null)
      .neq('sku', '')
      .neq('status', 'archived')
      .limit(10_000)
      .then(({ data, error }) => {
        if (error) { console.error('[pedidos] erro query products SKU:', error); return }
        const map: Record<string, Array<{ id: string; name: string; sku: string }>> = {}
        for (const p of (data ?? []) as Array<{ id: string; sku: string | null; name: string }>) {
          if (!p.sku) continue
          const key = String(p.sku).trim().toUpperCase()
          if (!key) continue
          if (!map[key]) map[key] = []
          map[key].push({ id: p.id, name: p.name, sku: p.sku })
        }
        setSkuToProducts(map)
      })
  }, [supabase])

  /** Cria vínculo via backend (POST /products/vinculos — endpoint robusto
   *  já usado pela tela /catalogo/vinculos). Aceita N listings → 1 produto. */
  const vincularPorSku = useCallback(async (
    productId: string,
    listings: Array<{
      listing_id:    string
      listing_title: string
      thumbnail:     string | null
    }>,
  ): Promise<{ created: number; failed: number; errors: string[] }> => {
    const headers = await getHeaders()
    let created = 0, failed = 0
    const errors: string[] = []

    for (const lst of listings) {
      try {
        const res = await fetch(`${BACKEND}/products/vinculos`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id:        productId,
            platform:          'mercadolivre',
            listing_id:        lst.listing_id,
            quantity_per_unit: 1,
            listing_title:     lst.listing_title,
            listing_thumbnail: lst.thumbnail,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          failed++
          errors.push(`${lst.listing_id}: ${data.message ?? `HTTP ${res.status}`}`)
        } else {
          created++
        }
      } catch (e) {
        failed++
        errors.push(`${lst.listing_id}: ${(e as Error).message}`)
      }
    }

    // Atualiza vinculos locais sem refetch
    if (created > 0) {
      const { data: prod } = await supabase
        .from('products')
        .select('id, sku, name, cost_price, tax_percentage')
        .eq('id', productId)
        .maybeSingle()
      if (prod) {
        setVinculosPorListing(prev => {
          const next = { ...prev }
          for (const lst of listings) {
            next[lst.listing_id] = [{
              listing_id:        lst.listing_id,
              quantity_per_unit: 1,
              product:           prod as VinculoItem['product'],
            } as VinculoItem]
          }
          return next
        })
      }
    }

    return { created, failed, errors }
  }, [getHeaders, supabase])

  const salvar = useCallback(async (productId: string, custo: number, imposto: number) => {
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/products/${productId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost_price: custo, tax_percentage: imposto }),
    })
    const rawText = await res.text()
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(rawText) } catch { data = { raw: rawText } }
    if (!res.ok) throw new Error((data?.message as string) ?? (data?.error as string) ?? `HTTP ${res.status}`)
    setVinculosPorListing(prev => {
      const next: Record<string, VinculoItem[]> = {}
      for (const lid of Object.keys(prev)) {
        next[lid] = prev[lid].map(v =>
          v.product?.id === productId
            ? { ...v, product: { ...v.product, cost_price: custo, tax_percentage: imposto } }
            : v
        )
      }
      return next
    })
    toast('Valores salvos!', 'success')
  }, [getHeaders])

  const criarProduto = useCallback(async (itemId: string) => {
    try {
      const headers = await getHeaders()
      // Multi-conta: passa seller_id selecionado pra backend usar token
      // certo. Sem isso, ML retorna 404 quando o anúncio é da outra conta.
      const sellerId = getStoredSellerId()
      const res = await fetch(`${BACKEND}/ml/products/from-listing`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_ids: [itemId],
          ...(sellerId != null ? { seller_id: sellerId } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      const results: CreateResult[] = data.results ?? []
      const created = results.find(r => r.status === 'created')
      const skipped = results.find(r => r.status === 'skipped')
      const errored = results.find(r => r.status === 'error')
      if (!created && !skipped) {
        const reason = errored?.reason ?? results[0]?.reason ?? (data as { message?: string }).message ?? `HTTP ${res.status}`
        toast(`Erro ao criar produto: ${reason}`, 'error')
        return
      }
      toast(created ? 'Produto criado e vinculado!' : 'Produto já existe no catálogo', created ? 'success' : 'info')

      // Atualiza vinculos local pra habilitar campos CMV/Imposto sem F5
      const { data: allVinculos } = await supabase
        .from('product_listings')
        .select('listing_id, quantity_per_unit, product:products(id, sku, name, cost_price, tax_percentage)')
        .eq('is_active', true)
        .eq('platform', 'mercadolivre')
      if (allVinculos && allVinculos.length > 0) {
        const rows = allVinculos as unknown as VinculoItem[]
        const map: Record<string, VinculoItem[]> = {}
        for (const v of rows) {
          if (!v.product?.id) continue
          const lid = v.listing_id
          if (!map[lid]) map[lid] = []
          map[lid].push(v)
        }
        setVinculosPorListing(map)
      }
    } catch (e) {
      toast(`Erro ao criar produto: ${(e as Error).message}`, 'error')
    }
  }, [getHeaders, supabase])

  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { qRef.current = q      }, [q])
  useEffect(() => { tabRef.current = tab  }, [tab])

  // Helper: tab efetivo levando em conta crossTabMode
  const effectiveTab = (t: TabKey): TabKey | null => crossTabMode ? null : t

  useEffect(() => { loadKpis()                  }, [loadKpis])
  // Refetch quando page, tab ou loadOrders mudam (loadOrders muda com pageSize).
  useEffect(() => { loadOrders(page, q, effectiveTab(tab)) }, [page, tab, loadOrders, crossTabMode])

  // Reseta pra pagina 1 ao trocar tab (UX coerente com filtros)
  useEffect(() => { setPage(0) }, [tab])

  // Refetch ao trocar conta ML selecionada (reseta pagina pra 1).
  // Inclui KPIs E pending pra todos os 3 datasets respeitarem a conta atual.
  const { selected: _mlSelected } = useMlAccount()
  useEffect(() => {
    setPage(0)
    loadOrders(0, q, effectiveTab(tabRef.current))
    loadKpis()
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_mlSelected])
  useEffect(() => { loadPending() }, [loadPending])

  // Polling: refetch de 2 em 2 min (fallback se Socket.IO falhar)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[pedidos] refetch automático de status')
      loadOrders(pageRef.current, qRef.current, effectiveTab(tabRef.current))
    }, 120_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOrders, crossTabMode])

  // Realtime: webhook ML → dispatcher emite 'order:invalidate' pro org →
  // refresh imediato. Debounced 1.5s pra evitar storm de refresh quando
  // ML manda 5 webhooks em 2s pro mesmo pedido (status changes).
  useEffect(() => {
    let active = true
    let debounceTimer: NodeJS.Timeout | null = null
    const handler = (payload: { external_order_id?: string | null; seller_id?: number; topic?: string }) => {
      console.log('[pedidos] realtime invalidate:', payload)
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!active) return
        loadOrders(pageRef.current, qRef.current, effectiveTab(tabRef.current))
      }, 1500)
    }
    void (async () => {
      try {
        const socket = await getSocket()
        if (!active) return
        socket.on('order:invalidate', handler)
      } catch (e) {
        console.warn('[pedidos] socket falhou — fallback no polling:', (e as Error).message)
      }
    })()
    return () => {
      active = false
      if (debounceTimer) clearTimeout(debounceTimer)
      void (async () => {
        try {
          const socket = await getSocket()
          socket.off('order:invalidate', handler)
        } catch { /* ignore */ }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOrders, crossTabMode])

  // Itens em campanhas ML Ads ativas — pra filtro "sem campanha"
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('ml_ads_campaigns')
        .select('items')
        .eq('status', 'active')
      const items = new Set<string>()
      for (const c of (data ?? []) as Array<{ items: string[] | null }>) {
        for (const i of c.items ?? []) items.add(i)
      }
      setAdItems(items)
    })()
  }, [supabase])

  // Contador de minutos desde última atualização
  useEffect(() => {
    const tick = setInterval(() => {
      setMinsSince(Math.floor((Date.now() - lastUpdate.getTime()) / 60_000))
    }, 30_000)
    return () => clearInterval(tick)
  }, [lastUpdate])

  const tabCounts = useMemo<Record<TabKey, number>>(() => {
    const c: Record<string, number> = {}
    for (const o of orders) { const k = classifyOrder(o); c[k] = (c[k] ?? 0) + 1 }
    return c as Record<TabKey, number>
  }, [orders])

  // Buyer counts pra filtro "Cliente recorrente" — calc sobre orders carregados
  const buyerCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const o of orders) {
      const id = String(o.buyer.id ?? o.buyer.nickname ?? '')
      if (!id) continue
      m[id] = (m[id] ?? 0) + 1
    }
    return m
  }, [orders])

  // Servidor já filtra pelo tab via /orders/list?tab=. Mantemos o filter
  // client-side como guard contra dessincronia (caso o servidor retorne
  // edge cases que classifyOrder reclassificaria) + aplica filtros avançados.
  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (classifyOrder(o) !== tab) return false

      // UF de destino (multi-select)
      // ML às vezes retorna state como object {id, name} em vez de string
      if (filterUFs.size > 0) {
        const stateRaw = o.shipping?.receiver_address?.state as unknown
        const stateStr = typeof stateRaw === 'string'
          ? stateRaw
          : (stateRaw && typeof stateRaw === 'object'
              ? String((stateRaw as { id?: unknown; name?: unknown }).id ?? (stateRaw as { name?: unknown }).name ?? '')
              : String(stateRaw ?? ''))
        const uf = stateStr.toUpperCase()
        if (!uf || !filterUFs.has(uf)) return false
      }

      // Período
      if (filterPeriod !== 'all') {
        const created = new Date(o.date_created).getTime()
        const now = Date.now()
        const day = 86400_000
        if (filterPeriod === 'today' && (now - created) > day) return false
        if (filterPeriod === '7d'    && (now - created) > 7  * day) return false
        if (filterPeriod === '30d'   && (now - created) > 30 * day) return false
      }

      // Valor R$
      const min = filterValueMin ? Number(filterValueMin) : null
      const max = filterValueMax ? Number(filterValueMax) : null
      if (min != null && o.total_amount < min) return false
      if (max != null && o.total_amount > max) return false

      // Sem vínculo / sem custo — considera AMBAS fontes pra alinhar com
      // o "X pedidos sem custo" do dashboard (que usa products.ml_listing_id).
      const oi = o.order_items[0]
      const itemId = oi?.item_id ?? oi?.item?.id ?? null
      const vinculos = itemId ? (vinculosPorListing[itemId] ?? []) : []
      // Source 1: vínculo manual via product_listings
      const linkedCost = vinculos[0]?.product?.cost_price     ?? 0
      const linkedTax  = vinculos[0]?.product?.tax_percentage ?? 0
      // Source 2: produtos com ml_listing_id direto (sync ML)
      const directProds = itemId ? (produtosPorMlListingId[itemId] ?? []) : []
      const directCost  = directProds.reduce((s, p) => s + (p.cost_price ?? 0), 0)
      const directTax   = directProds[0]?.tax_percentage ?? 0
      // Tem dados de custo se qualquer fonte preenche
      const hasCostData = (linkedCost > 0) || (linkedTax > 0) || (directCost > 0) || (directTax > 0)
      const isLinked    = vinculos.length > 0 || directProds.length > 0

      if (filterFlags.noLink && isLinked)    return false
      if (filterFlags.noCost && hasCostData) return false

      // Sem campanha ativa
      if (filterFlags.noCampaign && itemId && adItems.has(itemId)) return false

      // Sem rastreio (campo às vezes vem fora do tipo declarado — cast defensivo)
      const tracking = (o.shipping as unknown as { tracking_number?: string | null })?.tracking_number
      if (filterFlags.noTracking && tracking) return false

      // Cliente recorrente (2+ pedidos no recorte atual)
      if (filterFlags.recurring) {
        const id = String(o.buyer.id ?? o.buyer.nickname ?? '')
        if (!id || (buyerCounts[id] ?? 1) < 2) return false
      }

      return true
    })
  }, [orders, tab, filterUFs, filterPeriod, filterValueMin, filterValueMax, filterFlags, vinculosPorListing, produtosPorMlListingId, adItems, buyerCounts])

  // Lista de UFs disponíveis no recorte atual (das que aparecem em pelo menos 1 pedido)
  const availableUFs = useMemo(() => {
    const set = new Set<string>()
    for (const o of orders) {
      // ML às vezes retorna state como object {id, name} — coerção defensiva
      const stateRaw = o.shipping?.receiver_address?.state as unknown
      const stateStr = typeof stateRaw === 'string'
        ? stateRaw
        : (stateRaw && typeof stateRaw === 'object'
            ? String((stateRaw as { id?: unknown; name?: unknown }).id ?? (stateRaw as { name?: unknown }).name ?? '')
            : String(stateRaw ?? ''))
      const uf = stateStr.toUpperCase()
      if (uf && uf.length <= 3) set.add(uf)
    }
    return [...set].sort()
  }, [orders])

  // Contadores das flags pra mostrar ao lado de cada toggle (sobre orders na tab atual).
  // Em crossTabMode (vindo de ?missing_cost=1), ignora classify — usa orders inteiros.
  const tabOrders = useMemo(
    () => crossTabMode ? orders : orders.filter(o => classifyOrder(o) === tab),
    [orders, tab, crossTabMode],
  )
  const flagCounts = useMemo(() => ({
    noLink:     tabOrders.filter(o => {
      const id = o.order_items[0]?.item_id ?? o.order_items[0]?.item?.id ?? null
      if (!id) return false
      // Sem vínculo em NENHUMA das 2 fontes
      const hasManual = (vinculosPorListing[id] ?? []).length > 0
      const hasDirect = (produtosPorMlListingId[id] ?? []).length > 0
      return !hasManual && !hasDirect
    }).length,
    noCost:     tabOrders.filter(o => {
      const id = o.order_items[0]?.item_id ?? o.order_items[0]?.item?.id ?? null
      if (!id) return false
      const v = vinculosPorListing[id] ?? []
      const linkedCost = v[0]?.product?.cost_price     ?? 0
      const linkedTax  = v[0]?.product?.tax_percentage ?? 0
      const direct     = produtosPorMlListingId[id] ?? []
      const directCost = direct.reduce((s, p) => s + (p.cost_price ?? 0), 0)
      const directTax  = direct[0]?.tax_percentage ?? 0
      // Sem custo se nenhuma fonte tem cost ou tax
      return !(linkedCost > 0 || linkedTax > 0 || directCost > 0 || directTax > 0)
    }).length,
    noCampaign: tabOrders.filter(o => {
      const id = o.order_items[0]?.item_id ?? o.order_items[0]?.item?.id ?? null
      return id ? !adItems.has(id) : false
    }).length,
    noTracking: tabOrders.filter(o => !(o.shipping as unknown as { tracking_number?: string | null })?.tracking_number).length,
    recurring:  tabOrders.filter(o => {
      const id = String(o.buyer.id ?? o.buyer.nickname ?? '')
      return id && (buyerCounts[id] ?? 1) >= 2
    }).length,
  }), [tabOrders, vinculosPorListing, produtosPorMlListingId, adItems, buyerCounts])

  const advCount =
    (filterUFs.size > 0 ? 1 : 0) +
    (filterPeriod !== 'all' ? 1 : 0) +
    (filterValueMin || filterValueMax ? 1 : 0) +
    Object.values(filterFlags).filter(Boolean).length

  function clearAdv() {
    setFilterUFs(new Set())
    setFilterPeriod('all')
    setFilterValueMin('')
    setFilterValueMax('')
    setFilterFlags({ noLink: false, noCost: false, noCampaign: false, noTracking: false, recurring: false })
  }

  const cur  = kpis?.current_month
  const prev = kpis?.last_month
  const num  = (v: number) => v.toLocaleString('pt-BR')

  // UI-1.1 — KPIs "hoje". Prefere kpis.today do backend (cobre tudo).
  // Fallback: agrega current_month.by_day pra hoje + filtra orders carregados.
  const { todayCount, todayRev, pendentesEnvio, emTransito } = useMemo(() => {
    if (kpis?.today) {
      return {
        todayCount:     kpis.today.count,
        todayRev:       kpis.today.revenue,
        // pendentes/transito vêm do mês corrente (mais inclusivo) com fallback no today
        pendentesEnvio: kpis.current_month?.pending_shipment ?? kpis.today.pending_shipment ?? 0,
        emTransito:     kpis.current_month?.in_transit       ?? kpis.today.in_transit       ?? 0,
      }
    }
    // Fallback legado (kpis sem today/shipping fields)
    const now = new Date()
    const isToday = (iso: string | null) => {
      if (!iso) return false
      const d = new Date(iso)
      return d.getUTCDate() === now.getUTCDate()
        && d.getUTCMonth() === now.getUTCMonth()
        && d.getUTCFullYear() === now.getUTCFullYear()
    }
    const tp = kpis?.current_month?.by_day?.find(p => isToday(p.date))
    return {
      todayCount:     tp?.count ?? 0,
      todayRev:       tp?.revenue ?? 0,
      pendentesEnvio: orders.filter(o => o.shipping?.status === 'ready_to_ship' || o.shipping?.status === 'pending').length,
      emTransito:     orders.filter(o => {
        const ss = o.shipping?.status
        return ss === 'shipped' || ss === 'in_transit' || ss === 'handling'
      }).length,
    }
  }, [kpis, orders])

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }} className="p-6 max-w-[1400px] space-y-5">
      <ToastViewport />
      <Toasts list={toasts} />

      {/* Header consolidado (UI-1.1) — título + ações + linha "atualizado" + KPIs hoje. */}
      <div>
        <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Dashboard · Vendas</p>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-white text-3xl font-semibold">Pedidos</h1>
          <div className="flex items-center gap-2">
            <AccountSelector compact hideWhenEmpty />
            <PulsingButton
              onClick={sync}
              loading={syncing}
              icon={<Truck size={11} />}
              label="Sincronizar"
              badge={billingPending && billingPending > 0 ? billingPending : undefined}
              variant="cyan"
            />
            <button onClick={() => todoToast('Exportar relatório de pedidos')}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: '#18181b', color: 'var(--text)', border: '1px solid #27272a' }}>
              <BarChart2 size={12} /> Relatório
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-600 mt-1">
          {minsSince === 0 ? 'Atualizado agora' : `Atualizado há ${minsSince}min`}
          {' · '}atualiza a cada 2min
        </p>

        {/* KPI strip — uma linha, separadores · entre KPIs. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400 mt-3 pt-3"
          style={{ borderTop: '1px solid #1a1a1f' }}>
          <span>
            <span className="font-bold tabular-nums" style={{ color: '#00E5FF' }}>{brl(todayRev)}</span>
            <span className="ml-1.5">vendas hoje</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span>
            <span className="font-bold tabular-nums text-zinc-100">{num(todayCount)}</span>
            <span className="ml-1.5">pedidos hoje</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span>
            <span className="font-bold tabular-nums" style={{ color: pendentesEnvio > 0 ? '#fbbf24' : '#a1a1aa' }}>
              {num(pendentesEnvio)}
            </span>
            <span className="ml-1.5">pendentes envio</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span>
            <span className="font-bold tabular-nums" style={{ color: emTransito > 0 ? '#a78bfa' : '#a1a1aa' }}>
              {num(emTransito)}
            </span>
            <span className="ml-1.5">em trânsito</span>
          </span>
        </div>
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
            onKeyDown={e => e.key === 'Enter' && (setPage(0), loadOrders(0, q, tab))}
            placeholder="Buscar por comprador, produto..."
            className="text-sm px-4 py-2 rounded-xl text-zinc-200 placeholder-zinc-600 outline-none w-72"
            style={{ background: '#111114', border: '1px solid #27272a' }} />
          <button onClick={() => { setPage(0); loadOrders(0, q, tab) }}
            className="text-sm px-5 py-2 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            style={{ background: '#00E5FF', color: '#000' }}>
            Buscar
          </button>
          {q && (
            <button onClick={() => { setQ(''); loadOrders(0, '', tab) }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2">
              Limpar
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAdvOpen(v => !v)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-all"
            style={{
              background: advCount > 0 ? 'rgba(0,229,255,0.08)' : '#111114',
              border: `1px solid ${advCount > 0 || advOpen ? '#00E5FF' : '#27272a'}`,
              color: advCount > 0 || advOpen ? '#00E5FF' : '#e4e4e7',
            }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtros
            {advCount > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ background: '#00E5FF', color: '#000' }}>{advCount}</span>}
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition-all"
            style={{ background: '#1a1a1f', border: '1px solid #27272a', color: '#e4e4e7' }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nova Venda Manual
          </button>
        </div>
      </div>

      {/* Painel de filtros avançados (collapsible) */}
      {advOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl"
          style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          {/* UF destino */}
          <div className="md:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">UF destino</p>
            <div className="flex flex-wrap gap-1">
              {availableUFs.length === 0 ? (
                <span className="text-[11px] text-zinc-600">Sem dado de UF nos pedidos da aba</span>
              ) : availableUFs.map(uf => {
                const active = filterUFs.has(uf)
                return (
                  <button key={uf}
                    onClick={() => setFilterUFs(prev => { const n = new Set(prev); n.has(uf) ? n.delete(uf) : n.add(uf); return n })}
                    className="px-2 py-1 rounded-md text-[11px] font-medium border transition-all"
                    style={{
                      background: active ? 'rgba(0,229,255,0.08)' : 'transparent',
                      borderColor: active ? '#00E5FF' : '#27272a',
                      color: active ? '#00E5FF' : '#a1a1aa',
                    }}>
                    {uf}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Período + Valor */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Período</p>
            <div className="flex flex-wrap gap-1">
              {([
                { v: 'all',   label: 'Todos' },
                { v: 'today', label: 'Hoje' },
                { v: '7d',    label: '7 dias' },
                { v: '30d',   label: '30 dias' },
              ] as const).map(o => (
                <button key={o.v} onClick={() => setFilterPeriod(o.v)}
                  className="px-2 py-1 rounded-md text-[11px] font-medium border transition-all"
                  style={{
                    background: filterPeriod === o.v ? 'rgba(0,229,255,0.08)' : 'transparent',
                    borderColor: filterPeriod === o.v ? '#00E5FF' : '#27272a',
                    color: filterPeriod === o.v ? '#00E5FF' : '#a1a1aa',
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 mt-3">Valor (R$)</p>
            <div className="flex items-center gap-1.5">
              <input type="number" min="0" placeholder="Min"
                value={filterValueMin} onChange={e => setFilterValueMin(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md text-[11px] text-white placeholder-zinc-600 border outline-none focus:border-[#00E5FF]"
                style={{ background: '#070709', borderColor: '#27272a' }} />
              <span className="text-zinc-600 text-[11px]">—</span>
              <input type="number" min="0" placeholder="Máx"
                value={filterValueMax} onChange={e => setFilterValueMax(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md text-[11px] text-white placeholder-zinc-600 border outline-none focus:border-[#00E5FF]"
                style={{ background: '#070709', borderColor: '#27272a' }} />
            </div>
          </div>

          {/* Saneamento */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Saneamento</p>
            <div className="flex flex-col gap-1">
              {([
                { k: 'noLink',     label: 'Sem vínculo',          count: flagCounts.noLink,     accent: '#f59e0b' },
                { k: 'noCost',     label: 'Sem custo',            count: flagCounts.noCost,     accent: '#f59e0b' },
                { k: 'noCampaign', label: 'Sem campanha ativa',   count: flagCounts.noCampaign, accent: '#f59e0b' },
                { k: 'noTracking', label: 'Sem rastreio',         count: flagCounts.noTracking, accent: '#f87171' },
                { k: 'recurring',  label: 'Cliente recorrente',   count: flagCounts.recurring,  accent: '#22c55e' },
              ] as const).map(o => {
                const active = filterFlags[o.k]
                return (
                  <button key={o.k}
                    onClick={() => setFilterFlags(p => ({ ...p, [o.k]: !p[o.k] }))}
                    className="flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-medium border transition-all"
                    style={{
                      background: active ? `${o.accent}14` : 'transparent',
                      borderColor: active ? o.accent : '#27272a',
                      color: active ? o.accent : '#a1a1aa',
                    }}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded border flex items-center justify-center"
                        style={{ borderColor: active ? o.accent : '#3f3f46', background: active ? o.accent : 'transparent' }}>
                        {active && <svg className="w-2 h-2" fill="none" stroke="#000" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      {o.label}
                    </span>
                    <span className="text-[10px] opacity-70">{o.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active chips */}
      {advCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-zinc-500 font-medium">Ativos:</span>
          {[...filterUFs].map(uf => (
            <ChipPed key={uf} label={uf} onRemove={() => setFilterUFs(prev => { const n = new Set(prev); n.delete(uf); return n })} />
          ))}
          {filterPeriod !== 'all' && (
            <ChipPed label={`Período: ${({ today: 'Hoje', '7d': '7 dias', '30d': '30 dias' } as const)[filterPeriod]}`} onRemove={() => setFilterPeriod('all')} />
          )}
          {(filterValueMin || filterValueMax) && (
            <ChipPed label={`R$ ${filterValueMin || '0'} — ${filterValueMax || '∞'}`} onRemove={() => { setFilterValueMin(''); setFilterValueMax('') }} />
          )}
          {filterFlags.noLink     && <ChipPed label="Sem vínculo"         onRemove={() => setFilterFlags(p => ({ ...p, noLink: false }))} />}
          {filterFlags.noCost     && <ChipPed label="Sem custo"           onRemove={() => setFilterFlags(p => ({ ...p, noCost: false }))} />}
          {filterFlags.noCampaign && <ChipPed label="Sem campanha"        onRemove={() => setFilterFlags(p => ({ ...p, noCampaign: false }))} />}
          {filterFlags.noTracking && <ChipPed label="Sem rastreio"        onRemove={() => setFilterFlags(p => ({ ...p, noTracking: false }))} />}
          {filterFlags.recurring  && <ChipPed label="Cliente recorrente"  onRemove={() => setFilterFlags(p => ({ ...p, recurring: false }))} />}
          <button onClick={clearAdv}
            className="ml-1 px-2 py-0.5 text-[10px] font-medium rounded transition-colors"
            style={{ color: '#71717a' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#71717a' }}>
            Limpar tudo
          </button>
        </div>
      )}

      {/* Cross-tab banner — quando vem do dashboard com filtro de saneamento */}
      {crossTabMode && (
        <div className="mb-3 px-3 py-2 rounded-lg flex items-center justify-between gap-3 flex-wrap"
          style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.25)' }}>
          <span className="text-[11px] text-cyan-300">
            ⓘ Mostrando pedidos de <strong>todas as abas</strong> (filtro de saneamento ativo). Trocar de aba volta ao modo normal.
          </span>
          <button onClick={() => setCrossTabMode(false)}
            className="text-[10px] text-zinc-400 hover:text-cyan-300 underline">
            Voltar pra aba {tab}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar" style={{ borderBottom: '1px solid #1a1a1f' }}>
        {TABS.map(t => {
          const count  = tabCounts[t.key] ?? 0
          const active = tab === t.key
          return (
            <button key={t.key}
              onClick={() => { setTab(t.key); if (crossTabMode) setCrossTabMode(false) }}
              className="px-4 py-2.5 text-sm font-medium transition-colors relative shrink-0"
              style={active && !crossTabMode ? { color: '#00E5FF', borderBottom: '2px solid #00E5FF', marginBottom: -1 } : { color: '#a1a1aa' }}>
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
      {/* View toggle (cards default | table beta — Sprint B bloco 1) */}
      <div className="flex items-center justify-end mb-2 gap-1 px-1">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 mr-1">View</span>
        {([
          { v: 'cards', path: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
          { v: 'table', path: 'M3 5h18M3 10h18M3 15h18M5 5v14M19 5v14' },
        ] as const).map(({ v, path }) => (
          <button key={v} onClick={() => setView(v)}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-all"
            style={{
              background: view === v ? 'rgba(0,229,255,0.10)' : 'transparent',
              color:      view === v ? '#00E5FF' : '#52525b',
            }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d={path} />
            </svg>
          </button>
        ))}
      </div>

      {/* TABLE VIEW (BETA — Sprint B). Click em row abre OrderDetailDrawer
          com OrderCard intacto dentro (Bloco 2). Bulk actions (Bloco 3): CSV
          fretes, marcar problema (POST backend), reimprimir etiquetas (stub).
          Bloco 4: pagination + search controlados pelo parent — server-side
          via /ml/orders/enriched. Quick filter continua client-side (filtra
          os 20 da página atual; spec atual do endpoint não aceita status). */}
      {view === 'table' && (
        <PedidosTable
          orders={filtered}
          loading={loading}
          onRefresh={() => loadOrders(pageRef.current, qRef.current, tabRef.current)}
          onViewDetails={(o) => setOpenOrderId(String(o.order_id))}
          controlledPagination={{
            page:    page + 1,                              // parent: 0-indexed → DataTable: 1-indexed
            perPage: pageSize,
            total:   total,
            onPageChange: (p) => setPage(p - 1),            // DataTable → parent (re-fetch via useEffect)
          }}
          controlledSearch={{
            value:    q,
            onChange: setQ,                                 // parent debounced re-fetch já existe
          }}
          onBulkMarkProblem={async (ids, note, severity) => {
            try {
              const headers = await getHeaders()
              const res = await fetch(`${BACKEND}/ml/orders/bulk-mark-problem`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_ids: ids, note, severity }),
              })
              const body = await res.json().catch(() => null) as { marked?: number; message?: string } | null
              if (!res.ok || typeof body?.marked !== 'number') {
                toast(body?.message ?? 'Falha ao marcar problema', 'error')
              } else {
                const sevLabel = ({ low: 'baixa', medium: 'média', high: 'alta', critical: 'crítica' } as const)[severity]
                toast(`${body.marked} pedido${body.marked === 1 ? '' : 's'} marcado${body.marked === 1 ? '' : 's'} (severidade ${sevLabel})`, 'success')
              }
            } catch { toast('Erro de rede', 'error') }
          }}
        />
      )}

      {/* CARDS VIEW (default — comportamento original intacto) */}
      {view === 'cards' && (
        <div className="space-y-2 pedidos-scroll overflow-y-auto">
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
              : filtered.map(order => {
                  const oi     = order.order_items[0]
                  const itemId = oi?.item_id ?? oi?.item?.id ?? null
                  const vinculos = itemId ? (vinculosPorListing[itemId] ?? []) : []
                  // Match de SKU pra botão "Vincular" — só ativa quando
                  // anúncio tem SKU E há produto(s) no catálogo com mesmo SKU.
                  // ML às vezes retorna seller_sku como number — coerção defensiva
                  const rawSku = oi?.seller_sku
                  const sellerSku = rawSku != null ? String(rawSku).trim() : null
                  const sellerSkuKey = sellerSku ? sellerSku.toUpperCase() : null
                  const skuMatchProducts = sellerSkuKey ? (skuToProducts[sellerSkuKey] ?? []) : []
                  return (
                    <OrderCard
                      key={order.order_id}
                      order={order}
                      itemId={itemId}
                      vinculos={vinculos}
                      sellerSku={sellerSku}
                      skuMatchProducts={skuMatchProducts}
                      onSalvar={salvar}
                      onCriarProduto={criarProduto}
                      onOpenVincularModal={(payload) => setVincularModal(payload)}
                      onToast={toast}
                      getHeaders={getHeaders}
                      onOpenDetail={setOpenOrderId}
                    />
                  )
                })
          }
        </div>
      )}

      {/* Pagination + page size selector */}
      {!loading && (
        <div className="flex items-center justify-between flex-wrap gap-3 pt-5">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-xs">Mostrar</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-200 outline-none focus:border-cyan-400 cursor-pointer"
            >
              {PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-zinc-500 text-xs">por página</span>
          </div>
          <Pagination page={page} total={total} size={pageSize}
            onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ManualSaleModal
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); toast('Venda registrada com sucesso!', 'success') }}
          getHeaders={getHeaders}
        />
      )}

      {/* Modal de vínculo por SKU (popup acima da página de pedidos) */}
      {vincularModal && (
        <VincularModal
          listingId={vincularModal.listingId}
          listingTitle={vincularModal.listingTitle}
          thumbnail={vincularModal.thumbnail}
          sellerSku={vincularModal.sellerSku}
          candidates={vincularModal.candidates}
          allOrders={orders}
          vinculosPorListing={vinculosPorListing}
          onSave={vincularPorSku}
          onClose={() => setVincularModal(null)}
          onToast={toast}
        />
      )}

      {/* Sprint UI-1: drawer premium self-contained — fetch /ml/orders/:id/full-detail
          e renderiza Comunicação (timeline) + Pedido + Cliente. Read-only: edição
          de custo/imposto/NF-e continua no OrderCard inline do modo cards view. */}
      <OrderDetailDrawer
        externalOrderId={openOrderId}
        onClose={() => setOpenOrderId(null)}
        getHeaders={getHeaders}
      />
    </div>
  )
}
