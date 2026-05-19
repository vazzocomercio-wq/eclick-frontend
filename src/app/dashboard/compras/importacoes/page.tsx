'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  Ship, Package, Clock, AlertTriangle, CheckCircle, Plus, ChevronRight,
  Anchor, Factory, Truck, X, Check, AlignLeft, Ban, GripVertical,
} from 'lucide-react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDroppable, useDraggable,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

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
const KANBAN_STATUSES = ['draft','pending','ordered','in_production','in_transit','customs','cancelled'] as const

type TFn = ReturnType<typeof useTranslations>

const STATUS_LABEL_KEYS: Record<string, string> = {
  draft:'status.draft', pending:'status.pending', ordered:'status.ordered',
  in_production:'status.inProduction', in_transit:'status.inTransit',
  customs:'status.customs', received:'status.received', cancelled:'status.cancelled',
}

function statusLabel(s: string, t: TFn): string {
  return STATUS_LABEL_KEYS[s] ? t(STATUS_LABEL_KEYS[s]) : s
}
const STATUS_COLORS: Record<string, string> = {
  draft:'#6b7280', pending:'#f59e0b', ordered:'#3b82f6',
  in_production:'#8b5cf6', in_transit:'#06b6d4',
  customs:'#f97316', received:'#22c55e', cancelled:'#ef4444',
}
const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <AlignLeft size={13}/>, pending: <Clock size={13}/>, ordered: <Package size={13}/>,
  in_production: <Factory size={13}/>, in_transit: <Truck size={13}/>,
  customs: <Anchor size={13}/>, received: <CheckCircle size={13}/>, cancelled: <Ban size={13}/>,
}
const STATUS_NEXT: Record<string, string> = {
  draft:'pending', pending:'ordered', ordered:'in_production',
  in_production:'in_transit', in_transit:'customs', customs:'received',
}

const FLOW_STATUSES = ['draft','pending','ordered','in_production','in_transit','customs','received']

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

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type = 'success', onDone }: { message: string; type?: 'success'|'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [onDone])
  const color = type === 'success' ? '#22c55e' : '#ef4444'
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl"
      style={{ background: color + '18', border: `1px solid ${color}44`, color, boxShadow:'0 4px 24px rgba(0,0,0,0.4)' }}>
      {type === 'success' ? <Check size={15}/> : <AlertTriangle size={15}/>}
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}

// ── KPI Card (compact) ────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = '#00E5FF' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="rounded-lg px-3 py-2.5 flex items-center gap-3 min-w-0"
      style={{ background:'#111114', border:'1px solid #1a1a1f' }}>
      <span className="shrink-0" style={{ color }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-medium truncate" style={{ color:'#71717a' }}>{label}</p>
        <p className="text-[15px] font-bold leading-tight" style={{ color:'#e4e4e7' }}>{value}</p>
        {sub && <p className="text-[10px] truncate" style={{ color:'#52525b' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: string; t: TFn }) {
  const c = STATUS_COLORS[status] ?? '#6b7280'
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: c + '22', color: c, border: `1px solid ${c}33` }}>
      {STATUS_ICONS[status]}{statusLabel(status, t)}
    </span>
  )
}

// ── PO Card ───────────────────────────────────────────────────────────────────

function PoCard({ po, onAdvance, onDetails, onCancel, dragHandleProps, isDragOverlay, t }: {
  po: PO
  onAdvance: (po: PO) => void
  onDetails: (po: PO) => void
  onCancel?: (po: PO) => void
  dragHandleProps?: Record<string, unknown>
  isDragOverlay?: boolean
  t: TFn
}) {
  const [confirming, setConfirming] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const days = daysUntil(po.expected_arrival_date)
  const urg  = urgencyStyle(days)
  const next = STATUS_NEXT[po.status]

  const stepIdx  = FLOW_STATUSES.indexOf(po.status)
  const stepPct  = stepIdx >= 0 ? (stepIdx / (FLOW_STATUSES.length - 1)) * 100 : 0
  const stepColor = STATUS_COLORS[po.status] ?? '#6b7280'

  function handleAdvanceClick() {
    if (confirming) {
      clearTimeout(confirmTimer.current)
      setConfirming(false)
      onAdvance(po)
    } else {
      setConfirming(true)
      confirmTimer.current = setTimeout(() => setConfirming(false), 2500)
    }
  }

  useEffect(() => () => clearTimeout(confirmTimer.current), [])

  return (
    <div className="rounded-lg mb-2 overflow-hidden"
      style={{
        background: isDragOverlay ? '#18181b' : '#0e0e11',
        border: `1px solid ${isDragOverlay ? '#27272a' : '#1e1e24'}`,
        boxShadow: isDragOverlay ? '0 8px 32px rgba(0,0,0,0.6)' : undefined,
        cursor: isDragOverlay ? 'grabbing' : 'default',
      }}>

      {/* Progress bar */}
      <div style={{ height: 2, background: '#1e1e24' }}>
        <div style={{ height: '100%', width: `${stepPct}%`, background: stepColor, transition: 'width 0.3s ease' }} />
      </div>

      <div className="p-3">
        {/* Header row */}
        <div className="flex items-start justify-between mb-1.5">
          <span className="text-[11px] font-bold" style={{ color:'#00E5FF' }}>{po.po_number}</span>
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize:14 }}>{countryFlag(po.suppliers?.country)}</span>
            {/* Drag handle */}
            <span {...dragHandleProps}
              className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing transition-colors"
              style={{ touchAction:'none' }}>
              <GripVertical size={13}/>
            </span>
          </div>
        </div>

        <p className="text-[12px] font-medium mb-1 truncate" style={{ color:'#e4e4e7' }}>
          {po.suppliers?.name ?? '—'}
        </p>
        <p className="text-[11px] mb-2" style={{ color:'#a1a1aa' }}>
          {t('productsCount', { count: po.purchase_order_items.length })} · {fmtBRL(po.total_cost)}
        </p>

        {po.expected_arrival_date && (
          <div className="mb-2">
            <p className="text-[10px]" style={{ color:'#a1a1aa' }}>📅 {fmtDate(po.expected_arrival_date)}</p>
            <p className={`text-[11px] font-semibold ${urg.pulse ? 'animate-pulse' : ''}`} style={{ color: urg.color }}>
              ⏱ {days === null ? '—' : days < 0 ? t('daysLate', { days: Math.abs(days) }) : t('daysRemaining', { days })}
            </p>
          </div>
        )}

        {po.status !== 'cancelled' && (
          <div className="flex gap-1.5 mt-2">
            {next && (
              <button onClick={handleAdvanceClick}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-semibold transition-all"
                style={confirming
                  ? { background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e' }
                  : { background:'rgba(0,229,255,0.08)', border:'1px solid rgba(0,229,255,0.18)', color:'#00E5FF' }
                }>
                {confirming ? <><Check size={11}/> {t('confirmQuestion')}</> : <>{t('advance')} <ChevronRight size={11}/></>}
              </button>
            )}
            <button onClick={() => onDetails(po)}
              className="flex-1 py-1.5 rounded-md text-[11px] font-medium"
              style={{ background:'#1e1e24', border:'1px solid #27272a', color:'#71717a' }}>
              {t('details')}
            </button>
            {onCancel && po.status !== 'received' && (
              <button onClick={() => onCancel(po)}
                className="py-1.5 px-2 rounded-md text-[11px]"
                style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', color:'#ef4444' }}
                title={t('cancelPo')}>
                <X size={11}/>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Draggable Card wrapper ────────────────────────────────────────────────────

function DraggablePoCard({ po, onAdvance, onDetails, onCancel, t }: {
  po: PO; onAdvance: (po: PO) => void; onDetails: (po: PO) => void; onCancel: (po: PO) => void; t: TFn
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: po.id,
    data: { po },
  })

  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.3 : 1, transform: CSS.Translate.toString(transform) }}>
      <PoCard
        po={po}
        onAdvance={onAdvance}
        onDetails={onDetails}
        onCancel={onCancel}
        dragHandleProps={{ ...attributes, ...listeners }}
        t={t}
      />
    </div>
  )
}

// ── Droppable Column ──────────────────────────────────────────────────────────

function DroppableColumn({ status, children, count, total, isCancel, t }: {
  status: string
  children: React.ReactNode
  count: number
  total: number
  isCancel?: boolean
  t: TFn
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const c = STATUS_COLORS[status]

  return (
    <div ref={setNodeRef} className="shrink-0 flex flex-col h-full rounded-xl overflow-hidden"
      style={{
        width: 290,
        background: isOver ? (isCancel ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)') : '#111114',
        border: `1px solid ${isOver ? (isCancel ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)') : '#1a1a1f'}`,
        transition: 'background 120ms, border-color 120ms',
      }}>

      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center gap-2 shrink-0" style={{ borderBottom:'1px solid #1a1a1f' }}>
        <span style={{ color: c }}>{STATUS_ICONS[status]}</span>
        <span className="text-[12px] font-semibold flex-1 truncate" style={{ color:'#e4e4e7' }}>{statusLabel(status, t)}</span>
        {count > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: c + '22', color: c }}>
            {count}
          </span>
        )}
      </div>

      {total > 0 && (
        <p className="px-3 pt-1.5 pb-0 text-[10px] shrink-0" style={{ color:'#52525b' }}>{fmtBRL(total)}</p>
      )}

      {/* Scrollable card area */}
      <div className="flex-1 overflow-y-auto px-2 py-2 kanban-scroll" style={{ minHeight: 0 }}>
        {children}
        {count === 0 && (
          <div className="flex items-center justify-center h-16 rounded-lg mt-1"
            style={{ border: `1px dashed ${c}22`, color: '#27272a' }}>
            <span className="text-[11px]">—</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Kanban View ───────────────────────────────────────────────────────────────

function KanbanView({ pos, onAdvance, onDetails, onCancel, onDrop, t }: {
  pos: PO[]
  onAdvance: (po: PO) => void
  onDetails: (po: PO) => void
  onCancel: (po: PO) => void
  onDrop: (poId: string, newStatus: string) => void
  t: TFn
}) {
  const [draggingPo, setDraggingPo] = useState<PO | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 6 },
  }))

  function handleDragStart(e: DragStartEvent) {
    const po = e.active.data.current?.po as PO | undefined
    if (po) setDraggingPo(po)
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingPo(null)
    const { active, over } = e
    if (!over) return
    const newStatus = over.id as string
    const po = active.data.current?.po as PO
    if (!po || po.status === newStatus) return
    onDrop(po.id, newStatus)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 h-full overflow-x-auto pb-2 kanban-scroll-x">
        {KANBAN_STATUSES.map(status => {
          const col   = pos.filter(p => p.status === status)
          const total = col.reduce((s, p) => s + p.total_cost, 0)
          return (
            <DroppableColumn key={status} status={status} count={col.length} total={total} isCancel={status === 'cancelled'} t={t}>
              {col.map(p => (
                <DraggablePoCard key={p.id} po={p} onAdvance={onAdvance} onDetails={onDetails} onCancel={onCancel} t={t} />
              ))}
            </DroppableColumn>
          )
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingPo && (
          <div style={{ width: 290, rotate: '2deg' }}>
            <PoCard po={draggingPo} onAdvance={() => {}} onDetails={() => {}} isDragOverlay t={t} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ── Timeline View (SVG Gantt) ─────────────────────────────────────────────────

function TimelineView({ pos, t }: { pos: PO[]; t: TFn }) {
  const active = pos.filter(p =>
    p.ordered_at && p.expected_arrival_date &&
    !['received','cancelled','draft'].includes(p.status)
  )

  if (active.length === 0) return (
    <div className="rounded-xl flex items-center justify-center h-48" style={{ background:'#111114', border:'1px solid #1a1a1f', color:'#52525b' }}>
      <p className="text-sm">{t('timeline.empty')}</p>
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
        {t('timeline.title')}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display:'block' }}>
          {months.map(m => (
            <g key={m.label}>
              <line x1={m.x} y1={PAD_T - 10} x2={m.x} y2={H - PAD_B} stroke="#1e1e24" strokeWidth={1} />
              <text x={m.x + 4} y={PAD_T - 2} fontSize={10} fill="#3f3f46">{m.label}</text>
            </g>
          ))}
          <line x1={todayX} y1={PAD_T - 10} x2={todayX} y2={H - PAD_B} stroke="#00E5FF" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={todayX + 3} y={PAD_T - 2} fontSize={9} fill="#00E5FF">{t('timeline.today')}</text>
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

function ListaView({ pos, onDetails, t }: { pos: PO[]; onDetails: (po: PO) => void; t: TFn }) {
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
              <Th label={t('list.po')} k="po_number" />
              <Th label={t('list.supplier')} k="supplier_id" />
              <Th label={t('list.status')} k="status" />
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color:'#52525b', background:'#0e0e11' }}>{t('list.products')}</th>
              <Th label={t('list.value')} k="total_cost" />
              <Th label={t('list.created')} k="created_at" />
              <Th label={t('list.arrival')} k="expected_arrival_date" />
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color:'#52525b', background:'#0e0e11' }}>{t('list.days')}</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color:'#52525b', background:'#0e0e11' }}>{t('list.actions')}</th>
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
                  <td className="px-3 py-2.5"><StatusBadge status={po.status} t={t} /></td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color:'#a1a1aa' }}>{t('itemsCount', { count: po.purchase_order_items.length })}</td>
                  <td className="px-3 py-2.5 text-[12px] font-medium" style={{ color:'#e4e4e7' }}>{fmtBRL(po.total_cost)}</td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color:'#a1a1aa' }}>{fmtDate(po.created_at)}</td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color:'#a1a1aa' }}>{fmtDate(po.expected_arrival_date)}</td>
                  <td className="px-3 py-2.5 text-[12px] font-semibold" style={{ color: urg.color }}>
                    {days === null ? '—' : days < 0 ? t('daysLate', { days: Math.abs(days) }) : `${days}d`}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => onDetails(po)}
                      className="text-[11px] px-2 py-1 rounded-md"
                      style={{ background:'#18181b', border:'1px solid #27272a', color:'#71717a' }}>
                      {t('viewButton')}
                    </button>
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color:'#a1a1aa' }}>
                {t('list.empty')}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Receive Modal ─────────────────────────────────────────────────────────────

function ReceiveModal({ po, onConfirm, onClose, t }: {
  po: PO; onConfirm: (qtys: Record<string, number>) => Promise<void>; onClose: () => void; t: TFn
}) {
  const [qtys, setQtys] = useState<Record<string, number>>(
    () => Object.fromEntries(po.purchase_order_items.map(it => [it.id, it.quantity]))
  )
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background:'rgba(0,0,0,0.7)' }}>
      <div className="rounded-xl w-full max-w-lg mx-4" style={{ background:'#111114', border:'1px solid #1a1a1f' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid #1a1a1f' }}>
          <p className="text-[13px] font-semibold" style={{ color:'#e4e4e7' }}>{t('receiveModal.title', { poNumber: po.po_number })}</p>
          <button onClick={onClose} style={{ color:'#a1a1aa' }}><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
          {po.purchase_order_items.map(it => (
            <div key={it.id} className="flex items-center gap-3">
              {it.products?.photo_urls?.[0]
                ? <img src={it.products.photo_urls[0]} className="w-9 h-9 rounded object-cover shrink-0" alt="" />
                : <div className="w-9 h-9 rounded shrink-0" style={{ background:'#1e1e24' }} />}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate" style={{ color:'#e4e4e7' }}>{it.products?.name ?? it.product_id}</p>
                <p className="text-[10px]" style={{ color:'#a1a1aa' }}>{t('receiveModal.ordered', { qty: it.quantity })}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <label className="text-[10px]" style={{ color:'#a1a1aa' }}>{t('receiveModal.received')}</label>
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
            {t('cancel')}
          </button>
          <button disabled={saving}
            onClick={async () => { setSaving(true); await onConfirm(qtys); setSaving(false) }}
            className="submit-glow flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{ background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e' }}>
            {saving ? t('saving') : t('receiveModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Cancel Confirm Modal ──────────────────────────────────────────────────────

function CancelModal({ po, onConfirm, onClose, t }: {
  po: PO; onConfirm: () => Promise<void>; onClose: () => void; t: TFn
}) {
  const [saving, setSaving] = useState(false)
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background:'rgba(0,0,0,0.7)' }}>
      <div className="rounded-xl w-full max-w-sm mx-4" style={{ background:'#111114', border:'1px solid #1a1a1f' }}>
        <div className="px-5 py-5 text-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background:'rgba(239,68,68,0.12)' }}>
            <Ban size={18} color="#ef4444" />
          </div>
          <p className="text-[14px] font-semibold mb-1" style={{ color:'#e4e4e7' }}>{t('cancelModal.title', { poNumber: po.po_number })}</p>
          <p className="text-[12px]" style={{ color:'#71717a' }}>{t('cancelModal.warning')}</p>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm"
            style={{ background:'#18181b', border:'1px solid #27272a', color:'#71717a' }}>
            {t('cancelModal.keep')}
          </button>
          <button disabled={saving}
            onClick={async () => { setSaving(true); await onConfirm(); setSaving(false) }}
            className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.25)', color:'#ef4444' }}>
            {saving ? t('cancelModal.cancelling') : t('cancelModal.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PO Drawer ─────────────────────────────────────────────────────────────────

function PoDrawer({ po, onClose, onRefresh, t }: { po: PO; onClose: () => void; onRefresh: () => void; t: TFn }) {
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
    { key: 'resumo',        label: t('drawer.tabSummary') },
    { key: 'itens',         label: t('drawer.tabItems') },
    { key: 'rastreamento',  label: t('drawer.tabTracking') },
    { key: 'financeiro',    label: t('drawer.tabFinance') },
  ] as const

  const inputStyle: React.CSSProperties = { background:'#18181b', border:'1px solid #27272a', borderRadius:8, color:'#e4e4e7', fontSize:13, padding:'8px 12px', outline:'none', width:'100%' }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:40, opacity:visible?1:0, transition:'opacity 200ms ease' }} />
      <div style={{ position:'fixed', top:0, right:0, height:'100dvh', width:480, background:'#111114', borderLeft:'1px solid #1a1a1f', zIndex:50, overflowY:'auto', transform:visible?'translateX(0)':'translateX(100%)', transition:'transform 200ms ease' }}>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid #1a1a1f', position:'sticky', top:0, background:'#111114', zIndex:1 }}>
          <div>
            <p className="text-[13px] font-bold" style={{ color:'#00E5FF' }}>{po.po_number}</p>
            <p className="text-[11px]" style={{ color:'#a1a1aa' }}>{countryFlag(po.suppliers?.country)} {po.suppliers?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={po.status} t={t} />
            <button onClick={onClose} style={{ color:'#a1a1aa' }}><X size={18} /></button>
          </div>
        </div>

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
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color:'#a1a1aa' }}>{t('drawer.progress')}</p>
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
                            {statusLabel(s, t)}
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
                  { label: t('drawer.supplier'),    value: po.suppliers?.name ?? '—' },
                  { label: t('drawer.country'),     value: `${countryFlag(po.suppliers?.country)} ${po.suppliers?.country ?? '—'}` },
                  { label: t('drawer.incoterm'),    value: po.incoterm ?? '—' },
                  { label: t('drawer.currency'),    value: `${po.currency} ×${po.exchange_rate}` },
                  { label: t('drawer.expectedArrival'), value: fmtDate(po.expected_arrival_date) },
                  { label: t('drawer.orderedAt'),   value: fmtDate(po.ordered_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg p-3" style={{ background:'#0e0e11', border:'1px solid #1a1a1f' }}>
                    <p className="text-[10px] mb-1" style={{ color:'#a1a1aa' }}>{label}</p>
                    <p className="text-[12px] font-medium" style={{ color:'#e4e4e7' }}>{value}</p>
                  </div>
                ))}
              </div>

              {po.notes && (
                <div className="rounded-lg p-3" style={{ background:'#0e0e11', border:'1px solid #1a1a1f' }}>
                  <p className="text-[10px] mb-1" style={{ color:'#a1a1aa' }}>{t('drawer.notes')}</p>
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
                    ? <img src={it.products.photo_urls[0]} className="w-10 h-10 rounded object-cover shrink-0" alt="" />
                    : <div className="w-10 h-10 rounded shrink-0" style={{ background:'#1e1e24' }} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color:'#e4e4e7' }}>{it.products?.name ?? it.product_id}</p>
                    <p className="text-[10px]" style={{ color:'#a1a1aa' }}>{it.products?.sku ?? '—'}</p>
                    <p className="text-[11px]" style={{ color:'#a1a1aa' }}>
                      {it.quantity} un · {fmtBRL(it.unit_cost)}/un · {fmtBRL(it.subtotal)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px]" style={{ color:'#a1a1aa' }}>{t('receiveModal.received')}</p>
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
                ['tracking_number', t('drawer.trackingNumber'), 'Ex: MSKU1234567'],
                ['carrier',         t('drawer.carrier'),        'Ex: Maersk, MSC'],
                ['container_number',t('drawer.container'),       'Ex: MSCU1234567'],
                ['bl_number',       'BL Number',        'Ex: MAEU1234567'],
              ] as const).map(([key, label, ph]) => (
                <div key={key}>
                  <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{label}</label>
                  <input value={tracking[key]} onChange={e => setTracking(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={ph} style={inputStyle} />
                </div>
              ))}
              <button disabled={savingTrack} onClick={saveTracking}
                className="submit-glow w-full py-2 rounded-lg text-sm font-semibold mt-2"
                style={{ background:'rgba(0,229,255,0.1)', border:'1px solid rgba(0,229,255,0.2)', color:'#00E5FF' }}>
                {savingTrack ? t('saving') : t('drawer.saveTracking')}
              </button>
            </div>
          )}

          {tab === 'financeiro' && (
            <div className="space-y-0">
              {[
                { label: t('drawer.subtotalProducts'), value: fmtBRL(po.subtotal), hi: false },
                { label: t('drawer.freight'),          value: fmtBRL(po.freight_cost ?? 0), hi: false },
                { label: t('drawer.otherCosts'),       value: fmtBRL(po.other_costs ?? 0), hi: false },
                { label: t('drawer.total'),            value: fmtBRL(po.total_cost), hi: true },
                ...(po.currency !== 'BRL' ? [{ label: t('drawer.inCurrency', { currency: po.currency }), value: `${(po.total_cost / po.exchange_rate).toLocaleString('pt-BR',{maximumFractionDigits:2})} ${po.currency}`, hi: false }] : []),
                { label: t('drawer.exchangeRate'),     value: po.currency !== 'BRL' ? `1 ${po.currency} = R$ ${po.exchange_rate}` : 'BRL', hi: false },
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

function NewPoModal({ suppliers, onClose, onCreated, t }: {
  suppliers: Supplier[]; onClose: () => void; onCreated: () => void; t: TFn
}) {
  const [step, setStep]                     = useState(1)
  const [saving, setSaving]                 = useState(false)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [productSearch, setProductSearch]   = useState('')
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
        <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ borderBottom:'1px solid #1a1a1f', background:'#111114' }}>
          <div>
            <p className="text-[14px] font-bold" style={{ color:'#e4e4e7' }}>{t('newPo.title')}</p>
            <p className="text-[11px]" style={{ color:'#a1a1aa' }}>{t('newPo.step', { step, name: [t('newPo.stepSupplier'), t('newPo.stepProducts'), t('newPo.stepReview')][step-1] })}</p>
          </div>
          <button onClick={onClose} style={{ color:'#a1a1aa' }}><X size={18} /></button>
        </div>

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
          {step === 1 && <>
            <div>
              <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{t('newPo.supplier')}</label>
              <input value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}
                placeholder={t('newPo.supplierSearchPlaceholder')} style={iStyle} />
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
                      {s.lead_time_days && <span style={{ color:'#a1a1aa', fontSize:10, marginLeft:6 }}>{t('newPo.leadDays', { days: s.lead_time_days })}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedSupplier && <p className="text-[11px] mt-1" style={{ color:'#22c55e' }}>✓ {selectedSupplier.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{t('newPo.estimatedArrival')}</label>
                <input type="date" value={form.expected_arrival_date} onChange={e => setForm(f => ({ ...f, expected_arrival_date: e.target.value }))} style={iStyle} />
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{t('newPo.incoterm')}</label>
                <select value={form.incoterm} onChange={e => setForm(f => ({ ...f, incoterm: e.target.value }))} style={sStyle}>
                  {INCOTERMS.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{t('newPo.currency')}</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={sStyle}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{t('newPo.exchangeRate')}</label>
                <input type="number" step="0.01" value={form.exchange_rate} onChange={e => setForm(f => ({ ...f, exchange_rate: Number(e.target.value) }))} style={iStyle} />
              </div>
            </div>
          </>}

          {step === 2 && <>
            <div className="relative">
              <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{t('newPo.addProduct')}</label>
              <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                placeholder={t('newPo.productSearchPlaceholder')} style={iStyle} />
              {productResults.length > 0 && (
                <div className="absolute top-full mt-1 w-full rounded-lg overflow-hidden z-10" style={{ border:'1px solid #27272a', background:'#18181b' }}>
                  {productResults.map(p => (
                    <button key={p.id} onClick={() => addProduct(p)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px]"
                      style={{ borderBottom:'1px solid #27272a', color:'#e4e4e7' }}
                      onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                      {p.photo_urls?.[0]
                        ? <img src={p.photo_urls[0]} className="w-7 h-7 rounded object-cover shrink-0" alt="" />
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
                      ? <img src={it.photo} className="w-8 h-8 rounded object-cover shrink-0" alt="" />
                      : <div className="w-8 h-8 rounded shrink-0" style={{ background:'#1e1e24' }} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate" style={{ color:'#e4e4e7' }}>{it.name}</p>
                      <p className="text-[10px]" style={{ color:'#a1a1aa' }}>{it.sku}</p>
                    </div>
                    <input type="number" min={1} value={it.quantity}
                      onChange={e => updateItem(i, 'quantity', Number(e.target.value))}
                      className="w-16 text-center text-[12px] rounded"
                      style={{ background:'#18181b', border:'1px solid #27272a', color:'#e4e4e7', padding:'3px 4px' }} />
                    <span style={{ color:'#a1a1aa', fontSize:11 }}>×</span>
                    <input type="number" min={0} step="0.01" value={it.unit_cost}
                      onChange={e => updateItem(i, 'unit_cost', Number(e.target.value))}
                      className="w-20 text-center text-[12px] rounded"
                      style={{ background:'#18181b', border:'1px solid #27272a', color:'#e4e4e7', padding:'3px 4px' }} />
                    <span className="text-[11px] font-medium w-20 text-right shrink-0" style={{ color:'#a1a1aa' }}>
                      {fmtBRL(it.quantity * it.unit_cost)}
                    </span>
                    <button onClick={() => removeItem(i)} style={{ color:'#a1a1aa' }}><X size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{t('newPo.estimatedFreight')}</label>
                <input type="number" min={0} value={form.freight_cost} onChange={e => setForm(f => ({ ...f, freight_cost: e.target.value }))} style={iStyle} />
              </div>
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{t('newPo.otherCosts')}</label>
                <input type="number" min={0} value={form.other_costs} onChange={e => setForm(f => ({ ...f, other_costs: e.target.value }))} style={iStyle} />
              </div>
            </div>

            <div className="rounded-lg p-3" style={{ background:'rgba(0,229,255,0.05)', border:'1px solid rgba(0,229,255,0.12)' }}>
              <div className="flex justify-between text-[12px] mb-1">
                <span style={{ color:'#a1a1aa' }}>{t('newPo.subtotal')}</span>
                <span style={{ color:'#a1a1aa' }}>{fmtBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13px] font-bold">
                <span style={{ color:'#e4e4e7' }}>{t('newPo.estimatedTotal')}</span>
                <span style={{ color:'#00E5FF' }}>{fmtBRL(total)}</span>
              </div>
              {form.currency !== 'BRL' && form.exchange_rate > 0 && (
                <p className="text-[11px] mt-1" style={{ color:'#a1a1aa' }}>
                  ≈ {(total / form.exchange_rate).toLocaleString('pt-BR', { maximumFractionDigits:2 })} {form.currency}
                </p>
              )}
            </div>
          </>}

          {step === 3 && <>
            <div className="rounded-lg p-3 space-y-2" style={{ background:'#0e0e11', border:'1px solid #1a1a1f' }}>
              {[
                { label: t('newPo.supplier'),         value: selectedSupplier?.name ?? '—' },
                { label: t('drawer.expectedArrival'), value: form.expected_arrival_date ? fmtDate(form.expected_arrival_date) : '—' },
                { label: t('newPo.incoterm'),         value: form.incoterm },
                { label: t('newPo.currency'),         value: `${form.currency} ×${form.exchange_rate}` },
                { label: t('newPo.itemsLabel'),       value: t('newPo.productsCount', { count: form.items.length }) },
                { label: t('drawer.total'),           value: fmtBRL(total) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-[12px]">
                  <span style={{ color:'#a1a1aa' }}>{label}</span>
                  <span style={{ color:'#e4e4e7' }}>{value}</span>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{t('newPo.supplierNotes')}</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} style={{ ...iStyle, resize:'none' }} placeholder={t('newPo.supplierNotesPlaceholder')} />
            </div>
            <div>
              <label className="block text-[11px] mb-1.5" style={{ color:'#a1a1aa' }}>{t('newPo.internalNotes')}</label>
              <textarea value={form.internal_notes} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                rows={2} style={{ ...iStyle, resize:'none' }} placeholder={t('newPo.internalNotesPlaceholder')} />
            </div>
          </>}

          <div className="flex gap-2 pt-1">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background:'#18181b', border:'1px solid #27272a', color:'#71717a' }}>
                {t('newPo.back')}
              </button>
            )}
            {step < 3 && (
              <button
                disabled={(step === 1 && !form.supplier_id) || (step === 2 && form.items.length === 0)}
                onClick={() => setStep(s => s + 1)}
                className="submit-glow flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background:'rgba(0,229,255,0.1)', border:'1px solid rgba(0,229,255,0.2)', color:'#00E5FF' }}>
                {t('newPo.next')}
              </button>
            )}
            {step === 3 && <>
              <button disabled={saving} onClick={() => submit(true)}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background:'#18181b', border:'1px solid #27272a', color:'#a1a1aa' }}>
                {t('newPo.saveDraft')}
              </button>
              <button disabled={saving} onClick={() => submit(false)}
                className="submit-glow flex-1 py-2 rounded-lg text-sm font-semibold"
                style={{ background:'rgba(0,229,255,0.12)', border:'1px solid rgba(0,229,255,0.25)', color:'#00E5FF' }}>
                {saving ? t('newPo.creating') : t('newPo.createAndSend')}
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
  const t = useTranslations('compras.importacoes')
  const [pos, setPos]             = useState<PO[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<'kanban'|'timeline'|'lista'>('kanban')
  const [drawerPo, setDrawerPo]   = useState<PO | null>(null)
  const [showNew, setShowNew]     = useState(false)
  const [receivePo, setReceivePo] = useState<PO | null>(null)
  const [cancelPo, setCancelPo]   = useState<PO | null>(null)
  const [toast, setToast]         = useState<{ message: string; type?: 'success'|'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success'|'error' = 'success') => {
    setToast({ message, type })
  }, [])

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
    showToast(`${po.po_number} → ${statusLabel(next, t)}`)
    await fetchPos()
  }

  const handleDrop = async (poId: string, newStatus: string) => {
    const po = pos.find(p => p.id === poId)
    if (!po) return
    if (newStatus === 'received') { setReceivePo(po); return }
    if (newStatus === 'cancelled') { setCancelPo(po); return }
    const h = await authHeaders()
    await fetch(`${BACKEND}/purchase-orders/${poId}/status`, {
      method:'PATCH', headers:{...h,'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus }),
    })
    showToast(`${po.po_number} → ${statusLabel(newStatus, t)}`)
    await fetchPos()
  }

  const handleCancel = async (po: PO) => {
    setCancelPo(po)
  }

  const confirmCancel = async () => {
    if (!cancelPo) return
    const h = await authHeaders()
    await fetch(`${BACKEND}/purchase-orders/${cancelPo.id}/status`, {
      method:'PATCH', headers:{...h,'Content-Type':'application/json'}, body: JSON.stringify({ status: 'cancelled' }),
    })
    showToast(t('toast.cancelled', { poNumber: cancelPo.po_number }), 'error')
    setCancelPo(null)
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
    showToast(t('toast.received', { poNumber: po.po_number }))
    setReceivePo(null)
    await fetchPos()
  }

  const active         = pos.filter(p => !['received','cancelled'].includes(p.status))
  const inTransit      = pos.filter(p => p.status === 'in_transit')
  const upcoming       = pos.filter(p => { const d = daysUntil(p.expected_arrival_date); return d !== null && d >= 0 && d <= 15 && !['received','cancelled'].includes(p.status) })
  const overdue        = pos.filter(p => { const d = daysUntil(p.expected_arrival_date); return d !== null && d < 0 && !['received','cancelled'].includes(p.status) })
  const capitalTransit = inTransit.reduce((s, p) => s + p.total_cost, 0)

  return (
    <>
      {/* scrollbars .kanban-scroll/.kanban-scroll-x herdam o estilo global
          definido em src/app/globals.css (thin, dark, hover cyan). */}

      {/* Overlays */}
      {showNew    && <NewPoModal suppliers={suppliers} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); fetchPos() }} t={t} />}
      {receivePo  && <ReceiveModal po={receivePo} onClose={() => setReceivePo(null)} onConfirm={qtys => handleReceive(receivePo, qtys)} t={t} />}
      {cancelPo   && <CancelModal po={cancelPo} onClose={() => setCancelPo(null)} onConfirm={confirmCancel} t={t} />}
      {drawerPo   && <PoDrawer po={drawerPo} onClose={() => setDrawerPo(null)} onRefresh={fetchPos} t={t} />}
      {toast      && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <div className="flex flex-col h-full overflow-hidden" style={{ background:'#09090b', padding:'16px 20px 0' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <Ship size={18} color="#00E5FF" />
              <h1 className="text-[15px] font-bold" style={{ color:'#e4e4e7' }}>{t('title')}</h1>
            </div>
            <p className="text-[11px]" style={{ color:'#71717a' }}>
              {t('activePosCount', { count: active.length })}{loading ? ` · ${t('loadingSuffix')}` : ''}
            </p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background:'rgba(0,229,255,0.12)', border:'1px solid rgba(0,229,255,0.25)', color:'#00E5FF' }}>
            <Plus size={13}/> {t('newPoButton')}
          </button>
        </div>

        {/* Alert banners */}
        {overdue.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2 text-[12px] shrink-0"
            style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', color:'#ef4444' }}>
            <AlertTriangle size={13}/>
            {t('overdueAlert', { count: overdue.length })}
          </div>
        )}
        {upcoming.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2 text-[12px] shrink-0"
            style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.18)', color:'#f59e0b' }}>
            <Clock size={13}/>
            {t('upcomingAlert', { count: upcoming.length })}
          </div>
        )}

        {/* KPIs — compact single row */}
        <div className="grid grid-cols-4 gap-2 mb-3 shrink-0">
          <KpiCard icon={<Ship size={14}/>}         label={t('kpi.activePos')}        value={String(active.length)}   sub={t('kpi.notReceived')}     color="#00E5FF" />
          <KpiCard icon={<Truck size={14}/>}         label={t('kpi.capitalInTransit')} value={fmtBRL(capitalTransit)} sub={t('kpi.posCount', { count: inTransit.length })} color="#06b6d4" />
          <KpiCard icon={<Clock size={14}/>}         label={t('kpi.arrivingIn15')}     value={String(upcoming.length)} sub={t('kpi.next15Days')}      color="#f59e0b" />
          <KpiCard icon={<AlertTriangle size={14}/>} label={t('kpi.overdue')}          value={String(overdue.length)}  sub={t('kpi.pastDate')}        color={overdue.length > 0 ? '#ef4444' : '#6b7280'} />
        </div>

        {/* View toggle — pill style */}
        <div className="flex items-center mb-3 shrink-0">
          <div className="flex rounded-full p-0.5" style={{ background:'#111114', border:'1px solid #1a1a1f' }}>
            {([['kanban', t('view.kanban')],['timeline', t('view.timeline')],['lista', t('view.list')]] as const).map(([v,label]) => (
              <button key={v} onClick={() => setView(v as 'kanban'|'timeline'|'lista')}
                className="px-3 py-1 text-[11px] font-medium rounded-full transition-all"
                style={{
                  background: view === v ? 'rgba(0,229,255,0.15)' : 'transparent',
                  color: view === v ? '#00E5FF' : '#71717a',
                  border: view === v ? '1px solid rgba(0,229,255,0.25)' : '1px solid transparent',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content — flex-1 fills remaining height */}
        <div className="flex-1 min-h-0 pb-4">
          {view === 'kanban'   && <KanbanView   pos={pos} onAdvance={handleAdvance} onDetails={setDrawerPo} onCancel={handleCancel} onDrop={handleDrop} t={t} />}
          {view === 'timeline' && <div className="overflow-y-auto h-full kanban-scroll"><TimelineView pos={pos} t={t} /></div>}
          {view === 'lista'    && <div className="overflow-y-auto h-full kanban-scroll"><ListaView    pos={pos} onDetails={setDrawerPo} t={t} /></div>}
        </div>
      </div>
    </>
  )
}
