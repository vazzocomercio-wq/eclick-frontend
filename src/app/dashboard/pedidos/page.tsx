// v2 - pedidos completo
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import {
  MoreHorizontal, Truck, Printer, Send, AlertOctagon, Megaphone, Ban,
  Headphones, BarChart2, Eye,
} from 'lucide-react'
import { ToastViewport, todoToast } from '@/hooks/useToast'
import { ensurePulseStyles, pulseClass } from '@/components/ui/pulsing-button'

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
  lucro_bruto:         number
  cost_price:          number | null
  tax_amount:          number | null
  contribution_margin: number | null
  contribution_margin_pct: number | null
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

  const trackingUrl = order.shipping?.id ? `https://www.mercadolibre.com.br/envios/${order.shipping.id}` : null

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

function OrderCard({
  order, itemId, vinculos, onSalvar, onCriarProduto, onToast, getHeaders,
}: {
  order: MOrder
  itemId: string | null
  vinculos: VinculoItem[]
  onSalvar: (productId: string, custo: number, imposto: number) => Promise<void>
  onCriarProduto: (itemId: string) => Promise<void>
  onToast: (msg: string, type: Toast['type']) => void
  getHeaders: () => Promise<Record<string, string>>
}) {
  const [buyerOverride, setBuyerOverride] = useState<MOrder['buyer'] | null>(null)
  const [refetching, setRefetching] = useState(false)
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

  const moreItems  = order.order_items.length - 1
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
    <div className="rounded-xl transition-colors relative" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      {/* Floating row actions kebab — top-right of every order card. */}
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
              {order.buyer.nickname && buyer !== order.buyer.nickname && (
                <p className="text-zinc-500 text-[10px]">@{order.buyer.nickname}</p>
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
            tooltip="Valor pago pelo comprador" />
          <FinRow icon="🚚" label="Frete vendedor"
            value={order.frete_vendedor ? `-${brl(order.frete_vendedor)}` : brl(0)} color="#f87171"
            tooltip={`Frete comprador: ${order.shipping.receiver_cost != null ? brl(order.shipping.receiver_cost) : '—'} / Vendedor: ${brl(order.frete_vendedor)}`} />
          <FinRow icon="🏪" label="Tarifa ML"           value={`-${brl(order.tarifa_ml)}`} color="#f87171"
            tooltip="Tarifa do Mercado Livre (~11,5%)" />
          <div className="border-t my-1.5" style={{ borderColor: '#1e1e24' }} />
          <FinRow icon="💰" label="Lucro bruto"         value={brl(order.lucro_bruto)}
            color={order.lucro_bruto >= 0 ? '#4ade80' : '#f87171'}
            tooltip="Lucro bruto: valor − tarifa − frete" />
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
            return (
              <Tip text={cm != null ? `Margem de contribuição: ${cm.margemPct}%` : 'Configure custo no produto para ver a margem'}>
                <div className="flex items-center justify-between gap-2 py-0.5 cursor-default">
                  <span className="text-sm">🟢</span>
                  <span className="flex-1 text-xs font-semibold text-zinc-300 leading-tight">Margem contrib.</span>
                  {cm != null
                    ? <span className="text-sm font-bold tabular-nums" style={{ color: mc }}>
                        {brl(cm.margem)}
                        <span className="text-xs font-semibold opacity-80 ml-1">({cm.margemPct}%)</span>
                      </span>
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

              {(liveBuyer.full_name || liveBuyer.first_name || liveBuyer.last_name) && (
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
                    {(liveBuyer.doc_type ?? '').toUpperCase().includes('CNPJ') ? 'CNPJ' : 'CPF'}
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

              {liveBuyer.nickname && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-14 shrink-0">@usuário</span>
                  <span className="text-[11px] text-zinc-300 font-mono">@{liveBuyer.nickname}</span>
                </div>
              )}

              {liveBuyer.id && (
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
              {order.payments.length === 0
                ? <span className="text-[11px] text-zinc-700">Nenhum pagamento</span>
                : order.payments.map((pay, i) => {
                    const ps = PAY_STATUS[pay.status]
                    return (
                      <div key={pay.id}>
                        {order.payments.length > 1 && (
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
                        {i < order.payments.length - 1 && (
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
              {order.shipping.receiver_address.street_name ? (
                <>
                  <div className="flex items-start gap-1.5">
                    <span className="text-[11px] text-zinc-600 w-14 shrink-0">Rua</span>
                    <span className="text-[11px] text-zinc-200 leading-tight">
                      {order.shipping.receiver_address.street_name}
                      {order.shipping.receiver_address.street_number ? `, ${order.shipping.receiver_address.street_number}` : ''}
                    </span>
                  </div>
                  {order.shipping.receiver_address.complement && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">Compl.</span>
                      <span className="text-[11px] text-zinc-300">{order.shipping.receiver_address.complement}</span>
                    </div>
                  )}
                  {order.shipping.receiver_address.neighborhood && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">Bairro</span>
                      <span className="text-[11px] text-zinc-300">{order.shipping.receiver_address.neighborhood}</span>
                    </div>
                  )}
                  {order.shipping.receiver_address.city && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">Cidade</span>
                      <span className="text-[11px] text-zinc-300">
                        {order.shipping.receiver_address.city}
                        {order.shipping.receiver_address.state ? ` / ${order.shipping.receiver_address.state}` : ''}
                      </span>
                    </div>
                  )}
                  {order.shipping.receiver_address.zip_code && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">CEP</span>
                      <span className="text-[11px] text-zinc-300 font-mono">{order.shipping.receiver_address.zip_code}</span>
                    </div>
                  )}
                  {order.shipping.receiver_address.address_line && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[11px] text-zinc-600 w-14 shrink-0">Linha</span>
                      <span className="text-[11px] text-zinc-500 italic">{order.shipping.receiver_address.address_line}</span>
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
              {order.shipping.id && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">ID Envio</span>
                  <a href={`https://www.mercadolivre.com.br/envios/${order.shipping.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[11px] font-mono text-cyan-500 hover:text-cyan-300 transition-colors">
                    {order.shipping.id}
                  </a>
                </div>
              )}
              {order.shipping.logistic_type && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Logística</span>
                  <span className="text-[11px] font-semibold"
                    style={{ color: (LOGISTIC[order.shipping.logistic_type] ?? { color: '#71717a' }).color }}>
                    {(LOGISTIC[order.shipping.logistic_type] ?? { text: order.shipping.logistic_type }).text}
                  </span>
                </div>
              )}
              {order.shipping.status && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Status</span>
                  <span className="text-[11px] font-semibold"
                    style={{ color: (SHIPPING_STATUS_MAP[order.shipping.status] ?? { color: '#71717a' }).color }}>
                    {(SHIPPING_STATUS_MAP[order.shipping.status] ?? { label: order.shipping.status }).label}
                  </span>
                </div>
              )}
              {order.shipping.substatus && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Substatus</span>
                  <span className="text-[11px] text-zinc-400">{order.shipping.substatus}</span>
                </div>
              )}
              {order.shipping.date_created && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Criado em</span>
                  <span className="text-[11px] text-zinc-400">{fmtDate(order.shipping.date_created)}</span>
                </div>
              )}
              {order.shipping.posting_deadline && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Pr. postagem</span>
                  <span className="text-[11px] text-zinc-400">{fmtDate(order.shipping.posting_deadline)}</span>
                </div>
              )}
              {order.shipping.estimated_delivery_date && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-600 w-20 shrink-0">Prev. entrega</span>
                  <span className="text-[11px] text-zinc-400">{fmtDate(order.shipping.estimated_delivery_date)}</span>
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
  const [vinculosPorListing, setVinculosPorListing] = useState<Record<string, VinculoItem[]>>({})
  const [lastUpdate,  setLastUpdate]  = useState<Date>(new Date())
  const [minsSince,   setMinsSince]   = useState(0)
  const tid = useRef(0)
  const pageRef = useRef(0)
  const qRef    = useRef('')

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
      setLastUpdate(new Date())
      setMinsSince(0)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao carregar pedidos', 'error')
      setOrders([])
    } finally { setLoading(false) }
  }, [getHeaders])

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
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/ml/products/from-listing`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_ids: [itemId] }),
    })
    const data = await res.json()
    const results: CreateResult[] = data.results ?? []
    const created = results.find(r => r.status === 'created')
    const skipped = results.find(r => r.status === 'skipped')
    if (!created && !skipped) {
      throw new Error(results[0]?.reason ?? data.message ?? `HTTP ${res.status}`)
    }
    toast(created ? 'Produto criado com sucesso!' : 'Produto já existe no catálogo', created ? 'success' : 'info')

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
  }, [getHeaders, supabase])

  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { qRef.current = q      }, [q])

  useEffect(() => { loadKpis()          }, [loadKpis])
  useEffect(() => { loadOrders(page, q) }, [page, loadOrders])

  // Polling: refetch de 2 em 2 min
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[pedidos] refetch automático de status')
      loadOrders(pageRef.current, qRef.current)
    }, 120_000)
    return () => clearInterval(interval)
  }, [loadOrders])

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

  const filtered = useMemo(() => orders.filter(o => classifyOrder(o) === tab), [orders, tab])

  const cur  = kpis?.current_month
  const prev = kpis?.last_month
  const num  = (v: number) => v.toLocaleString('pt-BR')

  return (
    <div style={{ background: '#09090b', minHeight: '100vh' }} className="p-6 max-w-[1400px] space-y-5">
      <ToastViewport />
      <Toasts list={toasts} />

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Dashboard · Vendas</p>
          <h1 className="text-white text-2xl font-semibold">Pedidos</h1>
        </div>
        <p className="text-xs text-zinc-600 pb-1">
          {minsSince === 0 ? 'Atualizado agora' : `Atualizado há ${minsSince}min`}
          {' · '}atualiza a cada 2min
        </p>
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
      <div className="flex gap-1 overflow-x-auto no-scrollbar" style={{ borderBottom: '1px solid #1a1a1f' }}>
        {TABS.map(t => {
          const count  = tabCounts[t.key] ?? 0
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-sm font-medium transition-colors relative shrink-0"
              style={active ? { color: '#00E5FF', borderBottom: '2px solid #00E5FF', marginBottom: -1 } : { color: '#a1a1aa' }}>
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
                return (
                  <OrderCard
                    key={order.order_id}
                    order={order}
                    itemId={itemId}
                    vinculos={vinculos}
                    onSalvar={salvar}
                    onCriarProduto={criarProduto}
                    onToast={toast}
                    getHeaders={getHeaders}
                  />
                )
              })
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
