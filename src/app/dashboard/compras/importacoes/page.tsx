'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Ship, Package, Clock, AlertTriangle, CheckCircle, Plus, ChevronRight,
  Anchor, Factory, Truck, X, Check, AlignLeft,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Supplier { id: string; name: string; country?: string; supplier_type?: string; lead_time_days?: number }

interface POItem {
  id: string; product_id: string; quantity: number; unit_cost: number; subtotal: number
  quantity_received: number; expected_arrival_date: string | null; actual_arrival_date: string | null
  products: { id: string; name: string; sku: string; photo_urls?: string[] } | null
}

interface PO {
  id: string; po_number: string; status: string
  expected_arrival_date: string | null; currency: string; exchange_rate: number
  incoterm: string | null; subtotal: number; freight_cost: number; other_costs: number
  total_cost: number; ordered_at: string | null; created_at: string
  tracking_number: string | null; carrier: string | null
  container_number: string | null; bl_number: string | null
  notes: string | null; internal_notes: string | null
  supplier_id: string
  suppliers: Supplier | null
  purchase_order_items: POItem[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = ['draft','pending','ordered','in_production','in_transit','customs','received'] as const

const STATUS_LABELS: Record<string, string> = {
  draft:'Rascunho', pending:'Pendente', ordered:'Pedido',
  in_production:'Em Produção', in_transit:'Em Trânsito',
  customs:'Desembaraço', received:'Recebido', cancelled:'Cancelado',
}
const STATUS_COLORS: Record<string, string> = {
  draft:'#6b7280', pending:'#f59e0b', ordered:'#3b82f6',
  in_production:'#8b5cf6', in_transit:'#06b6d4',
  customs:'#f97316', received:'#22c55e', cancelled:'#ef4444',
}
const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <AlignLeft size={13}/>, pending: <Clock size={13}/>, ordered: <Package size={13}/>,
  in_production: <Factory size={13}/>, in_transit: <Truck size={13}/>,
  customs: <Anchor size={13}/>, received: <CheckCircle size={13}/>, cancelled: <X size={13}/>,
}
const STATUS_NEXT: Record<string, string> = {
  draft:'pending', pending:'ordered', ordered:'in_production',
  in_production:'in_transit', in_transit:'customs', customs:'received',
}

const INCOTERMS = ['FOB','CIF','EXW','DDP','CFR','FCA','DAP']
const CURRENCIES = ['BRL','USD','EUR','CNY','JPY']

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 })

const fmtDate = (s: string | null) =>
  s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—'

const daysUntil = (s: string | null) => {
  if (!s) return null
  return Math.ceil((new Date(s + 'T12:00:00').getTime() - Date.now()) / 86400000)
}

function countryFlag(c?: string | null) {
  const m: Record<string,string> = {
    'China':'🇨🇳','Brasil':'🇧🇷','EUA':'🇺🇸','USA':'🇺🇸','Alemanha':'🇩🇪',
    'Japão':'🇯🇵','Índia':'🇮🇳','Coreia':'🇰🇷','Taiwan':'🇹🇼',
    'Itália':'🇮🇹','Espanha':'🇪🇸','Argentina':'🇦🇷','Portugal':'🇵🇹',
  }
  return c ? (m[c] ?? '🌍') : '🌍'
}

function urgencyStyle(days: number | null) {
  if (days === null) return { color: '#6b7280', pulse: false }
  if (days < 0)   return { color: '#7f1d1d', pulse: true }
  if (days < 15)  return { color: '#ef4444', pulse: true }
  if (days < 30)  return { color: '#f97316', pulse: false }
  if (days < 60)  return { color: '#f59e0b', pulse: false }
  return { color: '#6b7280', pulse: false }
}

async function authHeaders(): Promise<Record<string, string>> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = '#00E5FF' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background:'#111114', border:'1px solid #1a1a1f' }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color:'#52525b' }}>{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color:'#e4e4e7' }}>{value}</p>
      {sub && <p className="text-[11px]" style={{ color:'#52525b' }}>{sub}</p>}
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? '#6b7280'
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c + '22', color: c, border: `1px solid ${c}33` }}>
      {STATUS_ICONS[status]}{STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── PO Card ───────────────────────────────────────────────────────────────────

function PoCard({ po, onAdvance, onDetails }: {
  po: PO; onAdvance: (po: PO) => void; onDetails: (po: PO) => void
}) {
  const days = daysUntil(po.expected_arrival_date)
  const urg  = urgencyStyle(days)
  const next = STATUS_NEXT[po.status]

  return (
    <div className="rounded-lg p-3 mb-2" style={{ background:'#0e0e11', border:'1px solid #1e1e24' }}>
      <div className="flex items-start justify-between mb-1.5">
        <span className="text-[11px] font-bold" style={{ color:'#00E5FF' }}>{po.po_number}</span>
        <span style={{ fontSize:16 }}>{countryFlag(po.suppliers?.country)}</span>
      </div>
      <p className="text-[12px] font-medium mb-1 truncate" style={{ color:'#e4e4e7' }}>
        {po.suppliers?.name ?? '—'}
      </p>
      <p className="text-[11px] mb-2" style={{ color:'#52525b' }}>
        {po.purchase_order_items.length} produto{po.purchase_order_items.length !== 1 ? 's' : ''} · {fmtBRL(po.total_cost)}
      </p>
      {po.expected_arrival_date && (
        <div className="mb-2">
          <p className="text-[10px]" style={{ color:'#52525b' }}>📅 {fmtDate(po.expected_arrival_date)}</p>
          <p className={`text-[11px] font-semibold ${urg.pulse ? 'animate-pulse' : ''}`} style={{ color: urg.color }}>
            ⏱ {days === null ? '—' : days < 0 ? `${Math.abs(days)}d atrasado` : `${days}d restantes`}
          </p>
        </div>
      )}
      <div className="flex gap-1.5 mt-2">
        {next && po.status !== 'cancelled' && (
          <button onClick={() => onAdvance(po)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-semibold"
            style={{ background:'rgba(0,229,255,0.1)', border:'1px solid rgba(0,229,255,0.2)', color:'#00E5FF' }}>
            Avançar <ChevronRight size={11} />
          </button>
        )}
        <button onClick={() => onDetails(po)}
          className="flex-1 py-1.5 rounded-md text-[11px] font-medium"
          style={{ background:'#1e1e24', border:'1px solid #27272a', color:'#71717a' }}>
          Detalhes
        </button>
      </div>
    </div>
  )
}

// ── Kanban View ───────────────────────────────────────────────────────────────

function KanbanView({ pos, onAdvance, onDetails }: {
  pos: PO[]; onAdvance: (po: PO) => void; onDetails: (po: PO) => void
}) {
  const cols = STATUSES.filter(s => s !== 'received')
  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 380 }}>
      {cols.map(status => {
        const col = pos.filter(p => p.status === status)
        const total = col.reduce((s, p) => s + p.total_cost, 0)
        const c = STATUS_COLORS[status]
        return (
          <div key={status} className="shrink-0 rounded-xl flex flex-col" style={{ width: 220, background:'#111114', border:'1px solid #1a1a1f' }}>
            <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom:'1px solid #1a1a1f' }}>
              <span style={{ color: c }}>{STATUS_ICONS[status]}</span>
              <span className="text-[12px] font-semibold flex-1" style={{ color:'#e4e4e7' }}>{STATUS_LABELS[status]}</span>
              {col.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: c + '22', color: c }}>{col.length}</span>
              )}
            </div>
            {total > 0 && <p className="px-3 pt-1 text-[10px]" style={{ color:'#52525b' }}>{fmtBRL(total)}</p>}
            <div className="flex-1 px-2 py-2 overflow-y-auto" style={{ maxHeight: 560 }}>
              {col.length === 0
                ? <p className="text-[11px] text-center py-6" style={{ color:'#27272a' }}>—</p>
                : col.map(p => <PoCard key={p.id} po={p} onAdvance={onAdvance} onDetails={onDetails} />)
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Timeline View (SVG Gantt) ─────────────────────────────────────────────────

function TimelineView({ pos }: { pos: PO[] }) {
  const active = pos.filter(p =>
    p.ordered_at && p.expected_arrival_date &&
    !['received','cancelled','draft'].includes(p.status)
  )

  if (active.length === 0) return (
    <div className="rounded-xl flex items-center justify-center h-48" style={{ background:'#111114', border:'1px solid #1a1a1f', color:'#52525b' }}>
      <p className="text-sm">Nenhuma PO ativa com datas definidas</p>
    </div>
  )

  const today = new Date(); today.setHours(0,0,0,0)
  const endDate = new Date(today.getTime() + 180 * 86400000)
  const TOTAL_DAYS = 180
  const ROW_H = 30, PAD_L = 110, PAD_R = 20, PAD_T = 30, PAD_B = 24
  const W = 860
  const cW = W - PAD_L - PAD_R
  const H  = PAD_T + active.length * ROW_H + PAD_B

  const toX = (d: Date) => PAD_L + Math.max(0, Math.min(1, (d.getTime() - today.getTime()) / (TOTAL_DAYS * 86400000))) * cW

  const months: { label: string; x: number }[] = []
  let cur = new Date(today.getFullYear(), today.getMonth(), 1)
  while (cur <= endDate) {
    months.push({ label: cur.toLocaleDateString('pt-BR', { month:'short' }), x: toX(cur) })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }

  const todayX = toX(today)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background:'#111114', border:'1px solid #1a1a1f' }}>
      <div className="px-4 py-2.5 text-sm font-semibold" style={{ color:'#e4e4e7', borderBottom:'1px solid #1a1a1f' }}>
        Cronograma — próximos 6 meses
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display:'block' }}>
          {months.map(m => (
            <g key={m.label}>
              <line x1={m.x} y1={PAD_T - 10} x2={m.x} y2={H - PAD_B} stroke="#1e1e24" strokeWidth={1} />
              <text x={m.x + 4} y={PAD_T - 2} fontSize={10} fill="#3f3f46">{m.label}</text>
            </g>
          ))}

          {/* Today line */}
          <line x1={todayX} y1={PAD_T - 10} x2={todayX} y2={H - PAD_B} stroke="#00E5FF" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={todayX + 3} y={PAD_T - 2} fontSize={9} fill="#00E5FF">Hoje</text>

          {active.map((po, i) => {
            const y = PAD_T + i * ROW_H
            const s = new Date(po.ordered_at!)
            const e = new Date(po.expected_arrival_date! + 'T12:00:00')
            const x1 = toX(s < today ? today : s)
            const x2 = toX(e)
            const bw = Math.max(4, x2 - x1)
            const c  = STATUS_COLORS[po.status] ?? '#6b7280'
            const days = daysUntil(po.expected_arrival_date)
            const urg  = urgencyStyle(days)

            return (
              <g key={po.id}>
                <rect x={0} y={y} width={W} height={ROW_H} fill={i % 2 === 0 ? '#0e0e11' : 'transparent'} />
                <text x={PAD_L - 6} y={y + ROW_H / 2 + 4} fontSize={10} fill="#71717a" textAnchor="end">{po.po_number}</text>
                <rect x={x1} y={y + 7} width={bw} height={ROW_H - 14} rx={3} fill={c} fillOpacity={0.65} />
                {x2 >= PAD_L && x2 <= W - PAD_R && (
                  <>
                    <circle cx={x2} cy={y + ROW_H / 2} r={4} fill={urg.color} />
                    <text x={x2 + 6} y={y + ROW_H / 2 + 4} fontSize={9} fill={urg.color}>
                      {fmtDate(po.expected_arrival_date).slice(0, 5)}
                    </text>
                  </>
                )}
              </g>
            )
          })}

          <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#1e1e24" strokeWidth={1} />
        </svg>
      </div>
    </div>
  )
}

// ── Lista View ────────────────────────────────────────────────────────────────

function ListaView({ pos, onDetails }: { pos: PO[]; onDetails: (po: PO) => void }) {
  const [sortKey, setSortKey] = useState('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => [...pos].sort((a, b) => {
    let va: string | number = ''
    let vb: string | number = ''
    switch (sortKey) {
      case 'po_number':            va = a.po_number;            vb = b.po_number;            break
      case 'supplier_id':          va = a.suppliers?.name ?? ''; vb = b.suppliers?.name ?? ''; break
      case 'status':               va = a.status;               vb = b.status;               break
      case 'total_cost':           va = a.total_cost;           vb = b.total_cost;           break
      case 'created_at':           va = a.created_at;           vb = b.created_at;           break
      case 'expected_arrival_date':va = a.expected_arrival_date ?? ''; vb = b.expected_arrival_date ?? ''; break
    }
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
  }), [pos, sortKey, sortAsc])

  const Th = ({ label, k }: { label: string; k: string }) => (
    <th onClick={() => { setSortKey(k); if (sortKey === k) setSortAsc(a => !a) }}
      className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer"
      style={{ color: sortKey === k ? '#00E5FF' : '#52525b', background:'#0e0e11', whiteSpace:'nowrap' }}>
      {label}{sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="rounded-xl overflow-hidden" style={{ border:'1px solid #1a1a1f' }}>
      <div style={{ overflowX:'auto' }}>
        <table className="w-full" style={{ minWidth: 860 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #1a1a1f' }}>
              <Th label="PO" k="po_number" />
              <Th label="Fornecedor" k="supplier_id" />
              <Th label="Status" k="status" />
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color:'#52525b', background:'#0e0e11' }}>Produtos</th>
              <Th label="Valor" k="total_cost" />
              <Th label="Criado" k="created_at" />
              <Th label="Chegada" k="expected_arrival_date" />
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color:'#52525b', background:'#0e0e11' }}>Dias</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color:'#52525b', background:'#0e0e11' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(po => {
              const days = daysUntil(po.expected_arrival_date)
              const urg  = urgencyStyle(days)
              return (
                <tr key={po.id} style={{ borderBottom:'1px solid #1a1a1f' }}
                  onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                  <td className="px-3 py-2.5 text-[12px] font-bold" style={{ color:'#00E5FF' }}>{po.po_number}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-[12px] font-medium" style={{ color:'#e4e4e7' }}>
                      {countryFlag(po.suppliers?.country)} {po.suppliers?.name ?? '—'}
                    </p>
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={po.status} /></td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color:'#a1a1aa' }}>{po.purchase_order_items.length} itens</td>
                  <td className="px-3 py-2.5 text-[12px] font-medium" style={{ color:'#e4e4e7' }}>{fmtBRL(po.total_cost)}</td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color:'#71717a' }}>{fmtDate(po.created_at)}</td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color:'#71717a' }}>{fmtDate(po.expected_arrival_date)}</td>
                  <td className="px-3 py-2.5 text-[12px] font-semibold" style={{ color: urg.color }}>
                    {days === null ? '—' : days < 0 ? `${Math.abs(days)}d atrasado` : `${days}d`}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => onDetails(po)}
                      className="text-[11px] px-2 py-1 rounded-md"
                      style={{ background:'#18181b', border:'1px solid #27272a', color:'#71717a' }}>
                      Ver
                    </button>
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color:'#52525b' }}>
                Nenhuma ordem de compra encontrada
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Receive Modal ─────────────────────────────────────────────────────────────

function ReceiveModal({ po, onConfirm, onClose }: {
  po: PO; onConfirm: (qtys: Record<string, number>) => Promise<void>; onClose: () => void
}) {
  const [qtys, setQtys] = useState<Record<string, number>>(
    () => Object.fromEntries(po.purchase_order_items.map(it => [it.id, it.quantity]))
  )
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background:'rgba(0,0,0,0.7)' }}>
      <div className="rounded-xl w-full max-w-lg mx-4" style={{ background:'#111114', border:'1px solid #1a1a1f' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid #1a1a1f' }}>
          <p className="text-[13px] font-semibold" style={{ color:'#e4e4e7' }}>Confirmar recebimento — {po.po_number}</p>
          <button onClick={onClose} style={{ color:'#52525b' }}><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
          {po.purchase_order_items.map(it => (
            <div key={it.id} className="flex items-center gap-3">
              {it.products?.photo_urls?.[0]
                ? <img src={it.products.photo_urls[0]} className="w-9 h-9 rounded object-cover shrink-0" />
                : <div className="w-9 h-9 rounded shrink-0" style={{ background:'#1e1e24' }} />}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate" style={{ color:'#e4e4e7' }}>{it.products?.name ?? it.product_id}</p>
                <p className="text-[10px]" style={{ color:'#52525b' }}>Pedido: {it.quantity} un</p>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <label className="text-[10px]" style={{ color:'#52525b' }}>Recebido</label>
                <input type="number" min={0} max={it.quantity} value={qtys[it.id] ?? it.quantity}
                  onChange={e => setQtys(q => ({ ...q, [it.id]: Number(e.target.value) }))}
                  className="w-20 text-center text-[12px] rounded-md"
                  style={{ background:'#18181b', border:'1px solid #27272a', color:'#e4e4e7', padding:'4px 8px' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 px-5 py-4" style={{ borderTop:'1px solid #1a1a1f' }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm"
            style={{ background:'#18181b', border:'1px solid #27272a', color:'#71717a' }}>
            Cancelar
          </button>
          <button disabled={saving}
            onClick={async () => { setSaving(true); await onConfirm(qtys); setSaving(false) }}
            className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{ background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e' }}>
            {saving ? 'Salvando…' : '✓ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PO Drawer ─────────────────────────────────────────────────────────────────

function PoDrawer({ po, onClose, onRefresh }: { po: PO; onClose: () => void; onRefresh: () => void }) {
  const [visible, setVisible] = useState(false)
  const [tab, setTab] = useState<'resumo'|'itens'|'rastreamento'|'financeiro'>('resumo')
  const [tracking, setTracking] = useState({
    tracking_number:  po.tracking_number  ?? '',
    carrier:          po.carrier          ?? '',
    container_number: po.container_number ?? '',
    bl_number:        po.bl_number        ?? '',
  })
  const [savingTrack, setSavingTrack] = useState(false)

  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const saveTracking = async () => {
    setSavingTrack(true)
    const h = await authHeaders()
    await fetch(`${BACKEND}/purchase-orders/${po.id}`, {
      method: 'PATCH',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify(tracking),
    })
    setSavingTrack(false)
    onRefresh()
  }

  const kanbanStatuses = STATUSES.filter((s): s is Exclude<typeof STATUSES[number], 'received'> => s !== 'received')
  const currentIdx = kanbanStatuses.indexOf(po.status as Exclude<typeof STATUSES[number], 'received'>)

  const tabs = [
    { key: 'resumo',        label: 'Resumo' },
    { key: 'itens',         label: 'Itens' },
    { key: 'rastreamento',  label: 'Rastreamento' },
    { key: 'financeiro',    label: 'Financeiro' },
  ] as const

  const inputStyle: React.CSSProperties = { background:'#18181b', border:'1px solid #27272a', borderRadius:8, color:'#e4e4e7', fontSize:13, padding:'8px 12px', outline:'none', width:'100%' }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:40, opacity:visible?1:0, transition:'opacity 200ms ease' }} />
      <div style={{ position:'fixed', top:0, right:0, height:'100dvh', width:480, background:'#111114', borderLeft:'1px solid #1a1a1f', zIndex:50, overflowY:'auto', transform:visible?'translateX(0)':'translateX(100%)', transition:'transform 200ms ease' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid #1a1a1f', position:'sticky', top:0, background:'#111114', zIndex:1 }}>
          <div>
            <p className="text-[13px] font-bold" style={{ color:'#00E5FF' }}>{po.po_number}</p>
            <p className="text-[11px]" style={{ color:'#52525b' }}>{countryFlag(po.suppliers?.country)} {po.suppliers?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={po.status} />
            <button onClick={onClose} style={{ color:'#52525b' }}><X size={18} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 gap-0" style={{ borderBottom:'1px solid #1a1a1f' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-2.5 text-[12px] font-medium transition-colors"
              style={{ color: tab === t.key ? '#00E5FF' : '#71717a', borderBottom: tab === t.key ? '2px solid #00E5FF' : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-5 py-4">

          {tab === 'resumo' && (
            <div className="space-y-4">
              {/* Status progress */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color:'#52525b' }}>Progresso</p>
                <div className="flex items-center">
                  {kanbanStatuses.map((s, i) => {
                    const done = i <= currentIdx
                    const c    = STATUS_COLORS[s]
                    return (
                      <div key={s} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: done ? c + '33' : '#1e1e24', border: `2px solid ${done ? c : '#27272a'}` }}>
                            {done && <div className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />}
                          </div>
                          <span className="text-[8px] text-center leading-tight" style={{ color: done ? c : '#3f3f46', maxWidth:36 }}>
                            {STATUS_LABELS[s]}
                          </span>
                        </div>
                        {i < kanbanStatuses.length - 1 && (
                          <div className="flex-1 h-0.5 mb-4" style={{ background: i < currentIdx ? '#27272a' : '#1e1e24' }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label:'Fornecedor',    value: po.suppliers?.name ?? '—' },
                  { label:'País',          value: `${countryFlag(po.suppliers?.country)} ${po.suppliers?.country ?? '—'}` },
                  { label:'Incoterm',      value: po.incoterm ?? '—' },
                  { label:'Moeda',         value: `${po.currency} ×${po.exchange_rate}` },
                  { label:'Chegada prev.', value: fmtDate(po.expected_arrival_date) },
                  { label:'Pedido em',     value: fmtDate(po.ordered_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg p-3" style={{ background:'#0e0e11', border:'1px solid #1a1a1f' }}>
                    <p className="text-[10px] mb-1" style={{ color:'#52525b' }}>{label}</p>
                    <p className="text-[12px] font-medium" style={{ color:'#e4e4e7' }}>{value}</p>
                  </div>
                ))}
              </div>

              {po.notes && (
                <div className="rounded-lg p-3" style={{ background:'#0e0e11', border:'1px solid #1a1a1f' }}>
                  <p className="text-[10px] mb-1" style={{ color:'#52525b' }}>Notas</p>
                  <p className="text-[12px]" style={{ color:'#a1a1aa' }}>{po.notes}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'itens' && (
            <div className="space-y-2">
              {po.purchase_order_items.map(it => (
                <div key={it.id} className="flex items-center gap-3 rounded-lg p-3" style={{ background:'#0e0e11', border:'1px solid #1a1a1f' }}>
                  {it.products?.photo_urls?.[0]
                    ? <img src={it.products.photo_urls[0]} className="w-10 h-10 rounded object-cover shrink-0" />
                    : <div className="w-10 h-10 rounded shrink-0" style={{ background:'#1e1e24' }} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color:'#e4e4e7' }}>{it.products?.name ?? it.product_id}</p>
                    <p className="text-[10px]" style={{ color:'#52525b' }}>{it.products?.sku ?? '—'}</p>
                    <p className="text-[11px]" style={{ color:'#71717a' }}>
                      {it.quantity} un · {fmtBRL(it.unit_cost)}/un · {fmtBRL(it.subtotal)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px]" style={{ color:'#52525b' }}>Recebido</p>
                    <p className="text-[13px] font-bold" style={{ color: it.quantity_received >= it.quantity ? '#22c55e' : '#f59e0b' }}>
                      {it.quantity_received}/{it.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'rastreamento' && (
            <div className="space-y-3">
              {([
                ['tracking_number', 'Nº Rastreamento', 'Ex: MSKU1234567'],
                ['carrier',         'Transportadora',  'Ex: Maersk, MSC'],
                ['container_number','Container',        'Ex: MSCU1234567'],
                ['bl_number',       'BL Number',        'Ex: MAEU1234567'],
              ] as const).map(([key, label, ph]) => (
                <div key={key}>
                  <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>{label}</label>
                  <input value={tracking[key]} onChange={e => setTracking(t => ({ ...t, [key]: e.target.value }))}
                    placeholder={ph} style={inputStyle} />
                </div>
              ))}
              <button disabled={savingTrack} onClick={saveTracking}
                className="w-full py-2 rounded-lg text-sm font-semibold mt-2"
                style={{ background:'rgba(0,229,255,0.1)', border:'1px solid rgba(0,229,255,0.2)', color:'#00E5FF' }}>
                {savingTrack ? 'Salvando…' : 'Salvar rastreamento'}
              </button>
            </div>
          )}

          {tab === 'financeiro' && (
            <div className="space-y-0">
              {[
                { label:'Subtotal produtos', value: fmtBRL(po.subtotal), hi: false },
                { label:'Frete',             value: fmtBRL(po.freight_cost ?? 0), hi: false },
                { label:'Outros custos',     value: fmtBRL(po.other_costs ?? 0), hi: false },
                { label:'Total',             value: fmtBRL(po.total_cost), hi: true },
                ...(po.currency !== 'BRL' ? [{ label:`Em ${po.currency}`, value: `${(po.total_cost / po.exchange_rate).toLocaleString('pt-BR',{maximumFractionDigits:2})} ${po.currency}`, hi: false }] : []),
                { label:'Taxa de câmbio',    value: po.currency !== 'BRL' ? `1 ${po.currency} = R$ ${po.exchange_rate}` : 'BRL', hi: false },
              ].map(({ label, value, hi }) => (
                <div key={label} className="flex items-center justify-between py-2.5" style={{ borderBottom:'1px solid #1e1e24' }}>
                  <span className="text-[12px]" style={{ color: hi ? '#e4e4e7' : '#71717a' }}>{label}</span>
                  <span className="text-[13px] font-semibold" style={{ color: hi ? '#00E5FF' : '#a1a1aa' }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── New PO Modal ──────────────────────────────────────────────────────────────

interface NewPOState {
  supplier_id: string; expected_arrival_date: string; incoterm: string
  currency: string; exchange_rate: number; freight_cost: string; other_costs: string
  notes: string; internal_notes: string
  items: Array<{ product_id: string; name: string; sku: string; photo?: string; quantity: number; unit_cost: number }>
}

function NewPoModal({ suppliers, onClose, onCreated }: {
  suppliers: Supplier[]; onClose: () => void; onCreated: () => void
}) {
  const [step, setStep]                   = useState(1)
  const [saving, setSaving]               = useState(false)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Array<{ id:string; name:string; sku:string; photo_urls?:string[]; cost_price?:number }>>([])
  const [form, setForm] = useState<NewPOState>({
    supplier_id:'', expected_arrival_date:'', incoterm:'FOB',
    currency:'USD', exchange_rate:5.5, freight_cost:'0', other_costs:'0',
    notes:'', internal_notes:'', items:[],
  })

  const selectedSupplier = suppliers.find(s => s.id === form.supplier_id)

  useEffect(() => {
    if (selectedSupplier?.lead_time_days) {
      const d = new Date(Date.now() + selectedSupplier.lead_time_days * 86400000)
      setForm(f => ({ ...f, expected_arrival_date: d.toISOString().slice(0,10) }))
    }
  }, [form.supplier_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return }
    const t = setTimeout(async () => {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      const { data } = await sb.from('products')
        .select('id, name, sku, photo_urls, cost_price')
        .or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`)
        .limit(8)
      setProductResults(data ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [productSearch])

  const addProduct = (p: typeof productResults[number]) => {
    if (form.items.some(it => it.product_id === p.id)) return
    setForm(f => ({ ...f, items: [...f.items, {
      product_id: p.id, name: p.name, sku: p.sku,
      photo: p.photo_urls?.[0], quantity: 1, unit_cost: Number(p.cost_price ?? 0),
    }]}))
    setProductSearch(''); setProductResults([])
  }

  const updateItem = (i: number, field: 'quantity' | 'unit_cost', val: number) =>
    setForm(f => ({ ...f, items: f.items.map((x,j) => j===i ? {...x, [field]: val} : x) }))

  const removeItem = (i: number) =>
    setForm(f => ({ ...f, items: f.items.filter((_,j) => j !== i) }))

  const subtotal = form.items.reduce((s, it) => s + it.quantity * it.unit_cost, 0)
  const total    = subtotal + Number(form.freight_cost || 0) + Number(form.other_costs || 0)

  const submit = async (asDraft: boolean) => {
    setSaving(true)
    try {
      const h = await authHeaders()
      const body = {
        supplier_id: form.supplier_id,
        expected_arrival_date: form.expected_arrival_date || undefined,
        incoterm: form.incoterm, currency: form.currency, exchange_rate: form.exchange_rate,
        freight_cost: Number(form.freight_cost || 0), other_costs: Number(form.other_costs || 0),
        notes: form.notes || undefined, internal_notes: form.internal_notes || undefined,
        items: form.items.map(it => ({ product_id: it.product_id, quantity: it.quantity, unit_cost: it.unit_cost })),
      }
      const res = await fetch(`${BACKEND}/purchase-orders`, {
        method:'POST', headers:{...h,'Content-Type':'application/json'}, body: JSON.stringify(body),
      })
      if (res.ok && !asDraft) {
        const po = await res.json()
        await fetch(`${BACKEND}/purchase-orders/${po.id}/status`, {
          method:'PATCH', headers:{...h,'Content-Type':'application/json'}, body: JSON.stringify({ status:'pending' }),
        })
      }
      onCreated()
    } finally { setSaving(false) }
  }

  const filteredSuppliers = suppliers.filter(s =>
    !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  const iStyle: React.CSSProperties = { background:'#18181b', border:'1px solid #27272a', borderRadius:8, color:'#e4e4e7', fontSize:12, padding:'8px 12px', outline:'none', width:'100%' }
  const sStyle: React.CSSProperties = { ...iStyle }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4" style={{ background:'rgba(0,0,0,0.7)' }}>
      <div className="rounded-xl w-full" style={{ maxWidth:540, background:'#111114', border:'1px solid #1a1a1f', maxHeight:'90vh', overflowY:'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ borderBottom:'1px solid #1a1a1f', background:'#111114' }}>
          <div>
            <p className="text-[14px] font-bold" style={{ color:'#e4e4e7' }}>Nova Ordem de Compra</p>
            <p className="text-[11px]" style={{ color:'#52525b' }}>Etapa {step} de 3 — {['Fornecedor','Produtos','Revisão'][step-1]}</p>
          </div>
          <button onClick={onClose} style={{ color:'#52525b' }}><X size={18} /></button>
        </div>

        {/* Steps */}
        <div className="flex items-center px-5 py-3 gap-2">
          {[1,2,3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background: s <= step ? 'rgba(0,229,255,0.2)' : '#18181b', color: s <= step ? '#00E5FF' : '#52525b', border:`1px solid ${s <= step ? 'rgba(0,229,255,0.4)' : '#27272a'}` }}>
                {s < step ? <Check size={11}/> : s}
              </div>
              {s < 3 && <div className="flex-1 h-px" style={{ background: s < step ? '#00E5FF33' : '#27272a' }} />}
            </div>
          ))}
        </div>

        <div className="px-5 pb-5 space-y-4">

          {/* Step 1 */}
          {step === 1 && <>
            <div>
              <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>Fornecedor</label>
              <input value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}
                placeholder="Buscar fornecedor por nome…" style={iStyle} />
              {filteredSuppliers.length > 0 && supplierSearch && (
                <div className="mt-1 rounded-lg overflow-hidden" style={{ border:'1px solid #27272a', background:'#18181b', maxHeight:160, overflowY:'auto' }}>
                  {filteredSuppliers.slice(0,5).map(s => (
                    <button key={s.id}
                      onClick={() => { setForm(f => ({ ...f, supplier_id: s.id })); setSupplierSearch(s.name) }}
                      className="w-full text-left px-3 py-2 text-[12px] transition-colors"
                      style={{ color:'#e4e4e7', borderBottom:'1px solid #27272a' }}
                      onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                      {countryFlag(s.country)} {s.name}
                      {s.lead_time_days && <span style={{ color:'#52525b', fontSize:10, marginLeft:6 }}>{s.lead_time_days}d lead</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedSupplier && <p className="text-[11px] mt-1" style={{ color:'#22c55e' }}>✓ {selectedSupplier.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>Data estimada de chegada</label>
                <input type="date" value={form.expected_arrival_date} onChange={e => setForm(f => ({ ...f, expected_arrival_date: e.target.value }))} style={iStyle} />
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>Incoterm</label>
                <select value={form.incoterm} onChange={e => setForm(f => ({ ...f, incoterm: e.target.value }))} style={sStyle}>
                  {INCOTERMS.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>Moeda</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={sStyle}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>Taxa de câmbio</label>
                <input type="number" step="0.01" value={form.exchange_rate} onChange={e => setForm(f => ({ ...f, exchange_rate: Number(e.target.value) }))} style={iStyle} />
              </div>
            </div>
          </>}

          {/* Step 2 */}
          {step === 2 && <>
            <div className="relative">
              <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>Adicionar produto</label>
              <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                placeholder="Buscar por nome ou SKU…" style={iStyle} />
              {productResults.length > 0 && (
                <div className="absolute top-full mt-1 w-full rounded-lg overflow-hidden z-10" style={{ border:'1px solid #27272a', background:'#18181b' }}>
                  {productResults.map(p => (
                    <button key={p.id} onClick={() => addProduct(p)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px]"
                      style={{ borderBottom:'1px solid #27272a', color:'#e4e4e7' }}
                      onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                      {p.photo_urls?.[0]
                        ? <img src={p.photo_urls[0]} className="w-7 h-7 rounded object-cover shrink-0" />
                        : <div className="w-7 h-7 rounded shrink-0" style={{ background:'#27272a' }} />}
                      <div className="min-w-0">
                        <p className="truncate max-w-xs">{p.name}</p>
                        <p style={{ fontSize:10, color:'#52525b' }}>{p.sku}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {form.items.length > 0 && (
              <div className="space-y-2">
                {form.items.map((it, i) => (
                  <div key={it.product_id} className="flex items-center gap-2 rounded-lg p-2.5" style={{ background:'#0e0e11', border:'1px solid #1a1a1f' }}>
                    {it.photo
                      ? <img src={it.photo} className="w-8 h-8 rounded object-cover shrink-0" />
                      : <div className="w-8 h-8 rounded shrink-0" style={{ background:'#1e1e24' }} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate" style={{ color:'#e4e4e7' }}>{it.name}</p>
                      <p className="text-[10px]" style={{ color:'#52525b' }}>{it.sku}</p>
                    </div>
                    <input type="number" min={1} value={it.quantity}
                      onChange={e => updateItem(i, 'quantity', Number(e.target.value))}
                      className="w-16 text-center text-[12px] rounded"
                      style={{ background:'#18181b', border:'1px solid #27272a', color:'#e4e4e7', padding:'3px 4px' }} />
                    <span style={{ color:'#52525b', fontSize:11 }}>×</span>
                    <input type="number" min={0} step="0.01" value={it.unit_cost}
                      onChange={e => updateItem(i, 'unit_cost', Number(e.target.value))}
                      className="w-20 text-center text-[12px] rounded"
                      style={{ background:'#18181b', border:'1px solid #27272a', color:'#e4e4e7', padding:'3px 4px' }} />
                    <span className="text-[11px] font-medium w-20 text-right shrink-0" style={{ color:'#a1a1aa' }}>
                      {fmtBRL(it.quantity * it.unit_cost)}
                    </span>
                    <button onClick={() => removeItem(i)} style={{ color:'#52525b' }}><X size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>Frete estimado</label>
                <input type="number" min={0} value={form.freight_cost} onChange={e => setForm(f => ({ ...f, freight_cost: e.target.value }))} style={iStyle} />
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>Outros custos</label>
                <input type="number" min={0} value={form.other_costs} onChange={e => setForm(f => ({ ...f, other_costs: e.target.value }))} style={iStyle} />
              </div>
            </div>

            <div className="rounded-lg p-3" style={{ background:'rgba(0,229,255,0.05)', border:'1px solid rgba(0,229,255,0.12)' }}>
              <div className="flex justify-between text-[12px] mb-1">
                <span style={{ color:'#71717a' }}>Subtotal</span>
                <span style={{ color:'#a1a1aa' }}>{fmtBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13px] font-bold">
                <span style={{ color:'#e4e4e7' }}>Total estimado</span>
                <span style={{ color:'#00E5FF' }}>{fmtBRL(total)}</span>
              </div>
              {form.currency !== 'BRL' && form.exchange_rate > 0 && (
                <p className="text-[11px] mt-1" style={{ color:'#52525b' }}>
                  ≈ {(total / form.exchange_rate).toLocaleString('pt-BR', { maximumFractionDigits:2 })} {form.currency}
                </p>
              )}
            </div>
          </>}

          {/* Step 3 */}
          {step === 3 && <>
            <div className="rounded-lg p-3 space-y-2" style={{ background:'#0e0e11', border:'1px solid #1a1a1f' }}>
              {[
                { label:'Fornecedor',     value: selectedSupplier?.name ?? '—' },
                { label:'Chegada prev.',  value: form.expected_arrival_date ? fmtDate(form.expected_arrival_date) : '—' },
                { label:'Incoterm',       value: form.incoterm },
                { label:'Moeda',          value: `${form.currency} ×${form.exchange_rate}` },
                { label:'Itens',          value: `${form.items.length} produtos` },
                { label:'Total',          value: fmtBRL(total) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-[12px]">
                  <span style={{ color:'#71717a' }}>{label}</span>
                  <span style={{ color:'#e4e4e7' }}>{value}</span>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>Notas para fornecedor</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} style={{ ...iStyle, resize:'none' }} placeholder="Instruções de embalagem, prazo…" />
            </div>
            <div>
              <label className="block text-[11px] mb-1.5" style={{ color:'#71717a' }}>Notas internas</label>
              <textarea value={form.internal_notes} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                rows={2} style={{ ...iStyle, resize:'none' }} placeholder="Observações da equipe" />
            </div>
          </>}

          {/* Navigation buttons */}
          <div className="flex gap-2 pt-1">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background:'#18181b', border:'1px solid #27272a', color:'#71717a' }}>
                ← Voltar
              </button>
            )}
            {step < 3 && (
              <button
                disabled={(step === 1 && !form.supplier_id) || (step === 2 && form.items.length === 0)}
                onClick={() => setStep(s => s + 1)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background:'rgba(0,229,255,0.1)', border:'1px solid rgba(0,229,255,0.2)', color:'#00E5FF' }}>
                Próximo →
              </button>
            )}
            {step === 3 && <>
              <button disabled={saving} onClick={() => submit(true)}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background:'#18181b', border:'1px solid #27272a', color:'#a1a1aa' }}>
                Salvar rascunho
              </button>
              <button disabled={saving} onClick={() => submit(false)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold"
                style={{ background:'rgba(0,229,255,0.12)', border:'1px solid rgba(0,229,255,0.25)', color:'#00E5FF' }}>
                {saving ? 'Criando…' : 'Criar e enviar'}
              </button>
            </>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ImportacoesPage() {
  const [pos, setPos]             = useState<PO[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<'kanban'|'timeline'|'lista'>('kanban')
  const [drawerPo, setDrawerPo]   = useState<PO | null>(null)
  const [showNew, setShowNew]     = useState(false)
  const [receivePo, setReceivePo] = useState<PO | null>(null)

  const fetchPos = useCallback(async () => {
    setLoading(true)
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/purchase-orders`, { headers: h })
      if (res.ok) setPos(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const h = await authHeaders()
      const res = await fetch(`${BACKEND}/suppliers`, { headers: h })
      if (res.ok) setSuppliers(await res.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchPos(); fetchSuppliers() }, [fetchPos, fetchSuppliers])

  const handleAdvance = async (po: PO) => {
    const next = STATUS_NEXT[po.status]
    if (!next) return
    if (next === 'received') { setReceivePo(po); return }
    const h = await authHeaders()
    await fetch(`${BACKEND}/purchase-orders/${po.id}/status`, {
      method:'PATCH', headers:{...h,'Content-Type':'application/json'}, body: JSON.stringify({ status: next }),
    })
    await fetchPos()
  }

  const handleReceive = async (po: PO, qtys: Record<string, number>) => {
    const h = await authHeaders()
    await Promise.all(po.purchase_order_items.map(it =>
      fetch(`${BACKEND}/purchase-orders/${po.id}/items/${it.id}`, {
        method:'PATCH', headers:{...h,'Content-Type':'application/json'},
        body: JSON.stringify({ quantity_received: qtys[it.id] ?? it.quantity }),
      })
    ))
    await fetch(`${BACKEND}/purchase-orders/${po.id}/status`, {
      method:'PATCH', headers:{...h,'Content-Type':'application/json'}, body: JSON.stringify({ status:'received' }),
    })
    setReceivePo(null)
    await fetchPos()
  }

  const active         = pos.filter(p => !['received','cancelled'].includes(p.status))
  const inTransit      = pos.filter(p => p.status === 'in_transit')
  const upcoming       = pos.filter(p => { const d = daysUntil(p.expected_arrival_date); return d !== null && d >= 0 && d <= 15 && !['received','cancelled'].includes(p.status) })
  const overdue        = pos.filter(p => { const d = daysUntil(p.expected_arrival_date); return d !== null && d < 0 && !['received','cancelled'].includes(p.status) })
  const capitalTransit = inTransit.reduce((s, p) => s + p.total_cost, 0)

  return (
    <div style={{ background:'#09090b', minHeight:'100vh', padding:24 }}>

      {/* Overlays */}
      {showNew && (
        <NewPoModal suppliers={suppliers} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); fetchPos() }} />
      )}
      {receivePo && (
        <ReceiveModal po={receivePo} onClose={() => setReceivePo(null)} onConfirm={qtys => handleReceive(receivePo, qtys)} />
      )}
      {drawerPo && (
        <PoDrawer po={drawerPo} onClose={() => setDrawerPo(null)} onRefresh={fetchPos} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Ship size={20} color="#00E5FF" />
            <h1 className="text-lg font-bold" style={{ color:'#e4e4e7' }}>Importações</h1>
          </div>
          <p className="text-xs" style={{ color:'#52525b' }}>
            Kanban de planejamento · {active.length} POs ativas{loading ? ' · carregando…' : ''}
          </p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background:'rgba(0,229,255,0.12)', border:'1px solid rgba(0,229,255,0.25)', color:'#00E5FF' }}>
          <Plus size={15} /> Nova PO
        </button>
      </div>

      {/* Alert banners */}
      {overdue.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 mb-3 text-sm"
          style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>
          <AlertTriangle size={15} />
          {overdue.length} PO{overdue.length > 1 ? 's' : ''} atrasada{overdue.length > 1 ? 's' : ''} — verifique o status imediatamente
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg px-4 py-2.5 mb-3 text-sm"
          style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b' }}>
          <Clock size={15} />
          {upcoming.length} PO{upcoming.length > 1 ? 's' : ''} chegam nos próximos 15 dias — prepare o recebimento
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={<Ship size={16}/>}         label="POs ativas"          value={String(active.length)}   sub="não recebidas"            color="#00E5FF" />
        <KpiCard icon={<Truck size={16}/>}         label="Capital em trânsito" value={fmtBRL(capitalTransit)} sub={`${inTransit.length} POs`} color="#06b6d4" />
        <KpiCard icon={<Clock size={16}/>}         label="Chegam em 15 dias"   value={String(upcoming.length)} sub="próximos 15 dias"          color="#f59e0b" />
        <KpiCard icon={<AlertTriangle size={16}/>} label="Atrasadas"           value={String(overdue.length)}  sub="passou da data prevista"  color={overdue.length > 0 ? '#ef4444' : '#6b7280'} />
      </div>

      {/* View toggle */}
      <div className="flex items-center mb-4">
        <div className="flex rounded-lg overflow-hidden" style={{ border:'1px solid #27272a' }}>
          {([['kanban','📋 Kanban'],['timeline','📅 Timeline'],['lista','📊 Lista']] as const).map(([v,label]) => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: view === v ? 'rgba(0,229,255,0.12)' : '#18181b', color: view === v ? '#00E5FF' : '#71717a' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Views */}
      {view === 'kanban'   && <KanbanView   pos={pos} onAdvance={handleAdvance} onDetails={setDrawerPo} />}
      {view === 'timeline' && <TimelineView pos={pos} />}
      {view === 'lista'    && <ListaView    pos={pos} onDetails={setDrawerPo} />}
    </div>
  )
}
