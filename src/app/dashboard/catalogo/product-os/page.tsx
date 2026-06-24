'use client'

import { useEffect, useState, useCallback, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCorners,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import {
  Lightbulb, Loader2, Plus, X, Sparkles, Cpu, DollarSign, Settings2,
  AlertTriangle, CheckCircle2, FileBox, RefreshCw, Check, Ban, Package,
  Factory, Boxes, Send, Rocket, ListChecks, History, ClipboardList,
  Printer as PrinterIcon, TrendingUp, Gauge,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── tipos ────────────────────────────────────────────────────────────
type Status = 'ideia' | 'briefing' | 'modelagem' | 'prototipo' | 'aprovado' | 'publicado' | 'monitorando' | 'arquivado'
interface ReferenceImage { url: string; source_url?: string | null; notes?: string | null }
interface ProductDev {
  id: string; name: string; category: string | null; description: string | null; status: Status
  production_profile: 'impressao_3d' | 'marca_propria' | 'generico'
  reference_images: ReferenceImage[]; inspiration_url: string | null
  briefing: Record<string, unknown> | null; briefing_text: string | null
  target_marketplaces: string[]; target_price: number | null; estimated_cost: number | null
  product_id: string | null; active_deal_id: string | null; position: number; created_at: string
}
interface Version {
  id: string; version_number: number; changelog: string | null; file_url: string | null; file_type: string | null
  material: string | null; weight_g: number | null; print_time_minutes: number | null; volume_cm3: number | null
  prototype_photo_urls: string[]; status: string; approved: boolean; notes: string | null; created_at: string
}
interface DevDetail extends ProductDev { versions: Version[] }
interface CostResult {
  cost: { filament: number; energy: number; labor: number; packaging: number; waste: number; total: number }
  inputs: { weight_g: number; print_time_minutes: number; material: string; cost_per_kg: number }
  target_margin_pct: number; suggested_prices: Array<{ channel: string; fee_pct: number; price: number; margin_pct: number }>
}
interface Settings {
  filament_cost_per_kg: Record<string, number>; energy_cost_per_hour: number; labor_cost_per_hour: number
  packaging_cost: number; default_waste_pct: number; machines: Array<{ name: string; model?: string; bed_mm?: number[] }>
}
interface Order {
  id: string; product_dev_id: string; order_number: number; quantity: number; machine: string | null; status: string
  estimated_time_minutes: number | null; estimated_filament_g: number | null; created_at: string
  jobs?: Job[]
}
interface Job { id: string; job_number: number; status: string; filament_used_g: number | null; print_time_minutes: number | null; failure_reason: string | null }
interface Input { id: string; kind: string; name: string; material: string | null; color: string | null; unit: string; quantity: number; reserved_quantity: number; reorder_threshold: number; cost_per_unit: number; available: number; alert: boolean }
interface BomLine { id?: string; kind: string; description: string | null; quantity: number; unit: string; unit_cost: number; waste_pct: number }
interface Quality { id: string; checklist: Array<{ key: string; label: string; ok: boolean }>; approved: boolean; notes: string | null }
interface DevEvent { id: string; event_type: string; payload: Record<string, unknown>; is_auto: boolean; created_at: string }
interface Printer {
  id: string; name: string; brand: string | null; model: string | null; build_volume_mm: string | null; nozzle_mm: number | null
  has_ams: boolean; power_watts: number | null; acquisition_cost: number; acquisition_date: string | null
  expected_lifetime_hours: number | null; status: string; notes: string | null
  accumulated_contribution: number; paid_pct: number | null; remaining_to_payback: number; paid_off: boolean
  total_units_produced: number; total_print_minutes: number; active_orders: number; depreciation_per_hour: number | null
}
interface ProfitRow {
  product_dev_id: string; name: string; category: string | null; print_minutes_unit: number; cost_unit: number; price_unit: number
  contribution_unit: number; profit_per_hour: number | null; units_sold_30d: number; units_produced: number; recommendation: string
}

const COLUMNS: { key: Status; label: string }[] = [
  { key: 'ideia', label: 'Ideia' }, { key: 'briefing', label: 'Briefing' }, { key: 'modelagem', label: 'Modelagem' },
  { key: 'prototipo', label: 'Protótipo' }, { key: 'aprovado', label: 'Aprovado' }, { key: 'publicado', label: 'Publicado' },
  { key: 'monitorando', label: 'Monitorando' },
]
const ORDER_COLS: { key: string; label: string }[] = [
  { key: 'fila', label: 'Fila' }, { key: 'imprimindo', label: 'Imprimindo' }, { key: 'acabamento', label: 'Acabamento' },
  { key: 'qualidade', label: 'Qualidade' }, { key: 'embalado', label: 'Embalado' }, { key: 'disponivel', label: 'Disponível' },
]
const ORDER_NEXT: Record<string, string[]> = {
  fila: ['imprimindo', 'cancelado'], imprimindo: ['pausado', 'falhou', 'acabamento'], pausado: ['imprimindo'],
  falhou: ['reimpressao'], reimpressao: ['imprimindo'], acabamento: ['qualidade'], qualidade: ['embalado', 'falhou'],
  embalado: ['disponivel'], disponivel: [], cancelado: [],
}
const CHANNEL_LABEL: Record<string, string> = { mercado_livre: 'Mercado Livre', shopee: 'Shopee', tiktok: 'TikTok', loja: 'Loja própria' }
const DEFAULT_QC: Array<{ key: string; label: string; ok: boolean }> = [
  { key: 'estavel', label: 'Peça estável', ok: false }, { key: 'suporta_peso', label: 'Suporta o peso esperado', ok: false },
  { key: 'encaixes', label: 'Encaixes funcionam', ok: false }, { key: 'acabamento', label: 'Acabamento bom', ok: false },
  { key: 'sem_quebra', label: 'Não quebrou em nenhum ponto', ok: false }, { key: 'fotografa', label: 'Fotografa bem', ok: false },
]

// ── helpers de API ────────────────────────────────────────────────────
async function token(): Promise<string | null> { const sb = createClient(); const { data } = await sb.auth.getSession(); return data.session?.access_token ?? null }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init?.headers ?? {}) } })
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(`[${res.status}] ${(body as { message?: string }).message ?? 'erro'}`) }
  return (await res.json()) as T
}

// ════════════════════════════════════════════════════════════════════
export default function ProductOsPage() {
  const [tab, setTab] = useState<'ciclo' | 'producao' | 'impressoras' | 'rentabilidade' | 'insumos'>('ciclo')
  const [items, setItems] = useState<ProductDev[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const data = await api<ProductDev[]>('/product-os'); setItems(data.filter(d => d.status !== 'arquivado')) }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)' }}>
          <Lightbulb size={18} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-white">Product OS</h1>
          <p className="text-xs" style={{ color: '#a1a1aa' }}>Da ideia ao produto vendido — crie, modele, produza, custe e publique produtos próprios.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#111114', border: '1px solid #27272a', color: '#a1a1aa' }}><RefreshCw size={12} /> Atualizar</button>
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#111114', border: '1px solid #27272a', color: '#a1a1aa' }}><Settings2 size={12} /> Fabricação</button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Plus size={12} /> Novo produto</button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ background: '#111114', border: '1px solid #1a1a1f', width: 'fit-content' }}>
        {([['ciclo', 'Ciclo de vida', <Lightbulb key="a" size={13} />], ['producao', 'Produção', <Factory key="b" size={13} />], ['impressoras', 'Impressoras', <PrinterIcon key="d" size={13} />], ['rentabilidade', 'Rentabilidade', <TrendingUp key="e" size={13} />], ['insumos', 'Insumos', <Boxes key="c" size={13} />]] as const).map(([k, lbl, ic]) => (
          <button key={k} onClick={() => setTab(k)} className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold" style={{ background: tab === k ? 'rgba(0,229,255,0.12)' : 'transparent', color: tab === k ? '#00E5FF' : '#71717a' }}>{ic}{lbl}</button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}><AlertTriangle size={14} className="shrink-0" /> <span className="whitespace-pre-line">{error}</span></div>}

      {tab === 'ciclo' && <LifecycleBoard items={items} loading={loading} onOpen={setOpenId} onChanged={load} setError={setError} />}
      {tab === 'producao' && <ProductionBoard products={items} />}
      {tab === 'impressoras' && <PrintersPanel />}
      {tab === 'rentabilidade' && <ProfitabilityPanel onOpen={setOpenId} />}
      {tab === 'insumos' && <InsumosPanel />}

      {openId && <DetailDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
      {showNew && <NewProductModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); void load() }} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

// ── BOARD: ciclo de vida ──────────────────────────────────────────────
function LifecycleBoard({ items, loading, onOpen, onChanged, setError }: { items: ProductDev[]; loading: boolean; onOpen: (id: string) => void; onChanged: () => Promise<void>; setError: (s: string) => void }) {
  const [list, setList] = useState(items)
  const [activeId, setActiveId] = useState<string | null>(null)
  useEffect(() => setList(items), [items])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null)
    const id = String(e.active.id); const overCol = e.over?.id ? String(e.over.id) as Status : null
    if (!overCol) return
    const dev = list.find(d => d.id === id); if (!dev || dev.status === overCol) return
    setList(prev => prev.map(d => d.id === id ? { ...d, status: overCol } : d))
    try { await api(`/product-os/${id}/move`, { method: 'POST', body: JSON.stringify({ status: overCol }) }) }
    catch (err) { setError(err instanceof Error ? err.message : 'Erro ao mover'); void onChanged() }
  }
  const active = activeId ? list.find(d => d.id === activeId) ?? null : null

  if (loading) return <div className="flex items-center gap-2 p-8 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map(col => <Column key={col.key} id={col.key} label={col.label} count={list.filter(d => d.status === col.key).length}>
          {list.filter(d => d.status === col.key).map(d => <DraggableCard key={d.id} id={d.id} onOpen={() => onOpen(d.id)}><DevCard dev={d} /></DraggableCard>)}
        </Column>)}
      </div>
      <DragOverlay>{active ? <DevCard dev={active} dragging /> : null}</DragOverlay>
    </DndContext>
  )
}

function Column({ id, label, count, children }: { id: string; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className="flex w-64 shrink-0 flex-col rounded-xl" style={{ background: isOver ? 'rgba(0,229,255,0.05)' : '#0c0c10', border: `1px solid ${isOver ? 'rgba(0,229,255,0.4)' : '#1a1a1f'}` }}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#a1a1aa' }}>{label}</span>
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#1a1a1f', color: '#71717a' }}>{count}</span>
      </div>
      <div className="flex flex-col gap-2 px-2 pb-2" style={{ minHeight: 80 }}>{children}</div>
    </div>
  )
}
function DraggableCard({ id, onOpen, children }: { id: string; onOpen: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return <div ref={setNodeRef} {...attributes} {...listeners} onClick={onOpen} style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab' }}>{children}</div>
}
function DevCard({ dev, dragging }: { dev: ProductDev; dragging?: boolean }) {
  const cover = dev.reference_images?.[0]?.url
  return (
    <div className="rounded-lg p-2.5" style={{ background: '#111114', border: `1px solid ${dragging ? 'rgba(0,229,255,0.5)' : '#27272a'}`, boxShadow: dragging ? '0 8px 24px rgba(0,229,255,0.15)' : undefined }}>
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <Package size={14} style={{ color: '#3f3f46' }} />}
        </div>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{dev.name}</p><p className="truncate text-[10px]" style={{ color: '#71717a' }}>{dev.category ?? 'sem categoria'}</p></div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {dev.briefing && <Pill icon={<Sparkles size={9} />} label="briefing" />}
        {dev.estimated_cost != null && <Pill icon={<DollarSign size={9} />} label={`R$ ${dev.estimated_cost.toFixed(2)}`} />}
        {dev.product_id && <Pill icon={<Rocket size={9} />} label="no catálogo" />}
        {dev.active_deal_id && <Pill icon={<Send size={9} />} label="no Active" />}
      </div>
    </div>
  )
}
function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: 'rgba(0,229,255,0.08)', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.2)' }}>{icon}{label}</span>
}

// ── BOARD: produção ───────────────────────────────────────────────────
function ProductionBoard({ products }: { products: ProductDev[] }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showNew, setShowNew] = useState(false)
  const nameOf = (devId: string) => products.find(p => p.id === devId)?.name ?? '—'

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setOrders(await api<Order[]>('/product-os/production-orders')) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const transition = async (oid: string, status: string) => {
    try { await api(`/product-os/production-orders/${oid}/transition`, { method: 'POST', body: JSON.stringify({ status }) }); void load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  const approved = products.filter(p => ['aprovado', 'publicado', 'monitorando'].includes(p.status))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs" style={{ color: '#a1a1aa' }}>Ordens de produção e fila de impressão.</p>
        <button onClick={() => setShowNew(true)} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Plus size={12} /> Nova ordem</button>
      </div>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {loading ? <div className="flex items-center gap-2 p-6 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ORDER_COLS.map(col => {
            const cards = orders.filter(o => o.status === col.key)
            return (
              <div key={col.key} className="flex w-60 shrink-0 flex-col rounded-xl" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                <div className="flex items-center justify-between px-3 py-2.5"><span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#a1a1aa' }}>{col.label}</span><span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#1a1a1f', color: '#71717a' }}>{cards.length}</span></div>
                <div className="flex flex-col gap-2 px-2 pb-2" style={{ minHeight: 60 }}>
                  {cards.map(o => (
                    <div key={o.id} className="rounded-lg p-2.5" style={{ background: '#111114', border: '1px solid #27272a' }}>
                      <p className="text-xs font-bold text-white">#{o.order_number} · {nameOf(o.product_dev_id)}</p>
                      <p className="text-[10px]" style={{ color: '#71717a' }}>{o.quantity} un{o.estimated_filament_g ? ` · ${o.estimated_filament_g} g` : ''}{o.machine ? ` · ${o.machine}` : ''}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(ORDER_NEXT[o.status] ?? []).map(ns => (
                          <button key={ns} onClick={() => void transition(o.id, ns)} className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: ns === 'cancelado' || ns === 'falhou' ? '#0a0a0e' : 'rgba(0,229,255,0.10)', color: ns === 'cancelado' || ns === 'falhou' ? '#71717a' : '#a5f3fc', border: '1px solid #27272a' }}>{ns}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {showNew && <NewOrderModal approved={approved} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); void load() }} />}
    </div>
  )
}

function NewOrderModal({ approved, onClose, onCreated }: { approved: ProductDev[]; onClose: () => void; onCreated: () => void }) {
  const [devId, setDevId] = useState(approved[0]?.id ?? '')
  const [qty, setQty] = useState('1'); const [printerId, setPrinterId] = useState('')
  const [printers, setPrinters] = useState<Printer[]>([])
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => { void (async () => { try { setPrinters(await api<Printer[]>('/product-os/printers')) } catch { /* */ } })() }, [])
  const create = async () => {
    if (!devId) { setErr('Selecione um produto aprovado'); return }
    setBusy(true); setErr('')
    try { await api('/product-os/production-orders', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, quantity: Number(qty) || 1, printer_id: printerId || undefined, machine: printers.find(p => p.id === printerId)?.name || undefined }) }); onCreated() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <Modal title="Nova ordem de produção" onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {approved.length === 0 ? <p className="text-xs" style={{ color: '#a1a1aa' }}>Nenhum produto aprovado ainda. Aprove uma versão no Ciclo de vida primeiro.</p> : (
        <div className="space-y-2.5">
          <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Produto</span>
            <select value={devId} onChange={e => setDevId(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
              {approved.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Quantidade" value={qty} onChange={setQty} />
            <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Impressora</span>
              <select value={printerId} onChange={e => setPrinterId(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
                <option value="">— sem impressora —</option>
                {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex justify-end"><button onClick={() => void create()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Factory size={12} />} Criar ordem</button></div>
        </div>
      )}
    </Modal>
  )
}

// ── INSUMOS ───────────────────────────────────────────────────────────
function InsumosPanel() {
  const [list, setList] = useState<Input[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showNew, setShowNew] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setList(await api<Input[]>('/product-os/production-inputs')) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const restock = async (id: string) => {
    const v = window.prompt('Quantidade a adicionar:'); if (!v) return
    try { await api(`/product-os/production-inputs/${id}/movement`, { method: 'POST', body: JSON.stringify({ type: 'in', quantity: Number(v) || 0 }) }); void load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs" style={{ color: '#a1a1aa' }}>Estoque de filamento, embalagem e etiquetas. A produção reserva e baixa automaticamente.</p>
        <button onClick={() => setShowNew(true)} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Plus size={12} /> Novo insumo</button>
      </div>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {loading ? <div className="flex items-center gap-2 p-6 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(i => (
            <div key={i.id} className="rounded-xl p-3" style={{ background: '#111114', border: `1px solid ${i.alert ? 'rgba(252,211,77,0.4)' : '#27272a'}` }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{i.name}</span>
                {i.alert && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'rgba(252,211,77,0.12)', color: '#fcd34d' }}>repor</span>}
                <button onClick={() => void restock(i.id)} className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: 'rgba(0,229,255,0.10)', color: '#a5f3fc', border: '1px solid #27272a' }}>+ repor</button>
              </div>
              <p className="mt-1 text-[10px]" style={{ color: '#71717a' }}>{i.kind}{i.material ? ` · ${i.material}` : ''}{i.color ? ` · ${i.color}` : ''}</p>
              <div className="mt-1.5 flex items-baseline gap-1"><span className="text-lg font-extrabold text-cyan-400">{i.available}</span><span className="text-[10px]" style={{ color: '#52525b' }}>{i.unit} disp. ({i.quantity} − {i.reserved_quantity} reserv.)</span></div>
            </div>
          ))}
          {list.length === 0 && <p className="text-xs" style={{ color: '#52525b' }}>Nenhum insumo cadastrado.</p>}
        </div>
      )}
      {showNew && <NewInputModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); void load() }} />}
    </div>
  )
}

function NewInputModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ kind: 'filamento', name: '', material: '', color: '', unit: 'g', quantity: '', reorder_threshold: '', cost_per_unit: '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const create = async () => {
    if (!f.name.trim()) { setErr('Nome obrigatório'); return }
    setBusy(true); setErr('')
    try {
      await api('/product-os/production-inputs', { method: 'POST', body: JSON.stringify({ kind: f.kind, name: f.name, material: f.material || undefined, color: f.color || undefined, unit: f.unit, quantity: Number(f.quantity) || 0, reorder_threshold: Number(f.reorder_threshold) || 0, cost_per_unit: Number(f.cost_per_unit) || 0 }) })
      onCreated()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <Modal title="Novo insumo" onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Tipo</span>
            <select value={f.kind} onChange={e => setF(s => ({ ...s, kind: e.target.value }))} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
              <option value="filamento">Filamento</option><option value="embalagem">Embalagem</option><option value="etiqueta">Etiqueta</option><option value="outro">Outro</option>
            </select></label>
          <Input label="Unidade" value={f.unit} onChange={v => setF(s => ({ ...s, unit: v }))} />
        </div>
        <Input label="Nome" value={f.name} onChange={v => setF(s => ({ ...s, name: v }))} />
        <div className="grid grid-cols-2 gap-2"><Input label="Material (PLA/PETG)" value={f.material} onChange={v => setF(s => ({ ...s, material: v }))} /><Input label="Cor" value={f.color} onChange={v => setF(s => ({ ...s, color: v }))} /></div>
        <div className="grid grid-cols-3 gap-2"><Input label="Qtd inicial" value={f.quantity} onChange={v => setF(s => ({ ...s, quantity: v }))} /><Input label="Alerta abaixo de" value={f.reorder_threshold} onChange={v => setF(s => ({ ...s, reorder_threshold: v }))} /><Input label="Custo/un" value={f.cost_per_unit} onChange={v => setF(s => ({ ...s, cost_per_unit: v }))} /></div>
        <div className="flex justify-end"><button onClick={() => void create()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Criar</button></div>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════
// DRAWER de detalhe
// ════════════════════════════════════════════════════════════════════
type DrawerTab = 'briefing' | 'versoes' | 'custo' | 'bom' | 'qualidade' | 'timeline'
function DetailDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [dev, setDev] = useState<DevDetail | null>(null)
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [tab, setTab] = useState<DrawerTab>('briefing')
  const [busy, setBusy] = useState<'dispatch' | 'publish' | null>(null)

  const reload = useCallback(async () => { try { setDev(await api<DevDetail>(`/product-os/${id}`)) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } }, [id])
  useEffect(() => { void reload() }, [reload])

  const dispatch = async () => {
    setBusy('dispatch'); setErr(''); setMsg('')
    try { const r = await api<{ message?: string }>(`/product-os/${id}/dispatch`, { method: 'POST', body: JSON.stringify({}) }); setMsg(r.message ?? 'Enviado ao Active.'); void reload(); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(null) }
  }
  const publish = async () => {
    const q = window.prompt('Quantas unidades já produzidas para entrar no estoque? (0 se nenhuma)', '0')
    if (q == null) return
    setBusy('publish'); setErr(''); setMsg('')
    try { const r = await api<{ product_id: string }>(`/product-os/${id}/publish-to-catalog`, { method: 'POST', body: JSON.stringify({ produced_quantity: Number(q) || 0 }) }); setMsg(`Publicado no catálogo (produto ${r.product_id.slice(0, 8)}). Gere o anúncio na IA Criativo.`); void reload(); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto p-5" style={{ background: '#0a0a0e', borderLeft: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        {!dev ? <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
          <>
            <div className="mb-3 flex items-start gap-2">
              <div><h2 className="text-base font-extrabold text-white">{dev.name}</h2><p className="text-xs" style={{ color: '#71717a' }}>{dev.category ?? 'sem categoria'} · {dev.status}</p></div>
              <button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={18} /></button>
            </div>

            {/* ações */}
            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={() => void dispatch()} disabled={busy !== null} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ background: '#111114', border: '1px solid #27272a', color: '#a5f3fc' }}>{busy === 'dispatch' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Despachar pro time</button>
              <button onClick={() => void publish()} disabled={busy !== null || dev.status !== 'aprovado'} title={dev.status !== 'aprovado' ? 'Aprove uma versão primeiro' : ''} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40" style={{ background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>{busy === 'publish' ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />} {dev.product_id ? 'No catálogo ✓' : 'Virar anúncio'}</button>
            </div>

            {dev.description && <p className="mb-3 text-xs" style={{ color: '#a1a1aa' }}>{dev.description}</p>}
            {err && <div className="mb-3 whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
            {msg && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>}

            <div className="mb-4 flex flex-wrap gap-1 rounded-lg p-1" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
              {([['briefing', 'Briefing', <Sparkles key="a" size={11} />], ['versoes', 'Versões', <FileBox key="b" size={11} />], ['custo', 'Custo', <DollarSign key="c" size={11} />], ['bom', 'BOM', <ListChecks key="d" size={11} />], ['qualidade', 'Qualidade', <ClipboardList key="e" size={11} />], ['timeline', 'Timeline', <History key="f" size={11} />]] as const).map(([k, lbl, ic]) => (
                <button key={k} onClick={() => setTab(k)} className="flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] font-semibold" style={{ background: tab === k ? 'rgba(0,229,255,0.12)' : 'transparent', color: tab === k ? '#00E5FF' : '#71717a' }}>{ic}{lbl}</button>
              ))}
            </div>

            {tab === 'briefing' && <BriefingTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
            {tab === 'versoes' && <VersionsTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
            {tab === 'custo' && <CostTab dev={dev} onChanged={onChanged} />}
            {tab === 'bom' && <BomTab devId={dev.id} />}
            {tab === 'qualidade' && <QualityTab devId={dev.id} />}
            {tab === 'timeline' && <TimelineTab devId={dev.id} />}
          </>
        )}
      </div>
    </div>
  )
}

function BriefingTab({ dev, onChanged }: { dev: DevDetail; onChanged: () => void }) {
  const [gen, setGen] = useState(false); const [err, setErr] = useState('')
  const [dims, setDims] = useState({ width_mm: '', depth_mm: '', height_mm: '' })
  const [material, setMaterial] = useState(''); const [wall, setWall] = useState(''); const [notes, setNotes] = useState('')
  const generate = async () => {
    setGen(true); setErr('')
    try {
      await api(`/product-os/${dev.id}/briefing`, { method: 'POST', body: JSON.stringify({ dimensions: { width_mm: dims.width_mm ? Number(dims.width_mm) : undefined, depth_mm: dims.depth_mm ? Number(dims.depth_mm) : undefined, height_mm: dims.height_mm ? Number(dims.height_mm) : undefined }, material: material || undefined, wall_thickness_mm: wall ? Number(wall) : undefined, notes: notes || undefined }) })
      onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setGen(false) }
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2"><Input label="Largura (mm)" value={dims.width_mm} onChange={v => setDims(d => ({ ...d, width_mm: v }))} /><Input label="Profund. (mm)" value={dims.depth_mm} onChange={v => setDims(d => ({ ...d, depth_mm: v }))} /><Input label="Altura (mm)" value={dims.height_mm} onChange={v => setDims(d => ({ ...d, height_mm: v }))} /></div>
      <div className="grid grid-cols-2 gap-2"><Input label="Material" placeholder="PLA / PETG / ABS" value={material} onChange={setMaterial} /><Input label="Parede (mm)" value={wall} onChange={setWall} /></div>
      <Input label="Observações" value={notes} onChange={setNotes} />
      <button onClick={() => void generate()} disabled={gen} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{gen ? <Loader2 size={13} className="animate-spin" /> : <Cpu size={13} />}{dev.briefing ? 'Regerar briefing técnico' : 'Gerar briefing técnico'}</button>
      {err && <div className="whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {dev.briefing_text && <div className="rounded-lg p-3 text-xs" style={{ background: '#111114', border: '1px solid #27272a', color: '#d4d4d8', whiteSpace: 'pre-wrap' }}>{dev.briefing_text}</div>}
    </div>
  )
}

function VersionsTab({ dev, onChanged }: { dev: DevDetail; onChanged: () => void }) {
  const [adding, setAdding] = useState(false); const [err, setErr] = useState('')
  const [form, setForm] = useState({ changelog: '', file_url: '', material: '', weight_g: '', print_time_minutes: '', volume_cm3: '' })
  const add = async () => {
    setAdding(true); setErr('')
    try {
      await api(`/product-os/${dev.id}/versions`, { method: 'POST', body: JSON.stringify({ changelog: form.changelog || undefined, file_url: form.file_url || undefined, material: form.material || undefined, weight_g: form.weight_g ? Number(form.weight_g) : undefined, print_time_minutes: form.print_time_minutes ? Number(form.print_time_minutes) : undefined, volume_cm3: form.volume_cm3 ? Number(form.volume_cm3) : undefined }) })
      setForm({ changelog: '', file_url: '', material: '', weight_g: '', print_time_minutes: '', volume_cm3: '' }); onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setAdding(false) }
  }
  const setApproval = async (vid: string, approved: boolean) => { try { await api(`/product-os/versions/${vid}/approval`, { method: 'POST', body: JSON.stringify({ approved }) }); onChanged() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } }
  return (
    <div className="space-y-3">
      <div className="rounded-lg p-3 space-y-2" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <p className="text-xs font-bold text-white">Nova versão</p>
        <Input label="Changelog" value={form.changelog} onChange={v => setForm(f => ({ ...f, changelog: v }))} />
        <Input label="URL do arquivo (STL/3MF)" value={form.file_url} onChange={v => setForm(f => ({ ...f, file_url: v }))} />
        <div className="grid grid-cols-2 gap-2"><Input label="Material" value={form.material} onChange={v => setForm(f => ({ ...f, material: v }))} /><Input label="Peso (g)" value={form.weight_g} onChange={v => setForm(f => ({ ...f, weight_g: v }))} /></div>
        <div className="grid grid-cols-2 gap-2"><Input label="Tempo impressão (min)" value={form.print_time_minutes} onChange={v => setForm(f => ({ ...f, print_time_minutes: v }))} /><Input label="Volume (cm³)" value={form.volume_cm3} onChange={v => setForm(f => ({ ...f, volume_cm3: v }))} /></div>
        <button onClick={() => void add()} disabled={adding} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Adicionar versão</button>
      </div>
      {err && <div className="whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {dev.versions.map(v => (
        <div key={v.id} className="rounded-lg p-3" style={{ background: '#111114', border: `1px solid ${v.approved ? 'rgba(74,222,128,0.35)' : '#27272a'}` }}>
          <div className="flex items-center gap-2"><span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#1a1a1f', color: '#a5f3fc' }}>v{v.version_number}</span><span className="text-xs font-semibold text-white">{v.changelog ?? 'sem changelog'}</span><span className="ml-auto text-[10px]" style={{ color: '#71717a' }}>{v.status}</span></div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]" style={{ color: '#a1a1aa' }}>{v.material && <span>{v.material}</span>}{v.weight_g != null && <span>{v.weight_g} g</span>}{v.print_time_minutes != null && <span>{v.print_time_minutes} min</span>}{v.volume_cm3 != null && <span>{v.volume_cm3} cm³</span>}{v.file_url && <a href={v.file_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">arquivo</a>}</div>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => void setApproval(v.id, true)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}><Check size={10} /> Aprovar</button>
            <button onClick={() => void setApproval(v.id, false)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: '#0a0a0e', color: '#71717a', border: '1px solid #27272a' }}><Ban size={10} /> Reprovar</button>
          </div>
        </div>
      ))}
      {dev.versions.length === 0 && <p className="text-xs" style={{ color: '#52525b' }}>Nenhuma versão ainda.</p>}
    </div>
  )
}

function CostTab({ dev, onChanged }: { dev: DevDetail; onChanged: () => void }) {
  const [res, setRes] = useState<CostResult | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [margin, setMargin] = useState('30')
  const compute = async () => {
    setBusy(true); setErr('')
    try { setRes(await api<CostResult>(`/product-os/${dev.id}/cost`, { method: 'POST', body: JSON.stringify({ target_margin_pct: Number(margin) || 30 }) })); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>Usa peso/tempo/material da versão aprovada (ou a última) + as constantes de fabricação da org.</p>
      <div className="flex items-end gap-2"><Input label="Margem-alvo (%)" value={margin} onChange={setMargin} /><button onClick={() => void compute()} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF', height: 34 }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />} Calcular</button></div>
      {err && <div className="whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {res && <>
        <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <p className="mb-2 text-xs font-bold text-white">Custo de fabricação</p>
          {([['Filamento', res.cost.filament], ['Energia', res.cost.energy], ['Mão de obra', res.cost.labor], ['Embalagem', res.cost.packaging], ['Perda técnica', res.cost.waste]] as const).map(([l, v]) => <div key={l} className="flex justify-between py-0.5 text-xs" style={{ color: '#a1a1aa' }}><span>{l}</span><span>R$ {v.toFixed(2)}</span></div>)}
          <div className="mt-1 flex justify-between border-t pt-1.5 text-xs font-bold text-white" style={{ borderColor: '#27272a' }}><span>Total</span><span className="text-cyan-400">R$ {res.cost.total.toFixed(2)}</span></div>
        </div>
        <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <p className="mb-2 text-xs font-bold text-white">Preço sugerido por canal (margem {res.target_margin_pct}%)</p>
          {res.suggested_prices.map(s => <div key={s.channel} className="flex items-center justify-between py-1 text-xs"><span style={{ color: '#a1a1aa' }}>{CHANNEL_LABEL[s.channel] ?? s.channel} <span style={{ color: '#52525b' }}>· taxa {s.fee_pct}%</span></span><span className="font-bold text-white">{s.price > 0 ? `R$ ${s.price.toFixed(2)}` : '—'}</span></div>)}
        </div>
      </>}
    </div>
  )
}

function BomTab({ devId }: { devId: string }) {
  const [lines, setLines] = useState<BomLine[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [saved, setSaved] = useState(false)
  const load = useCallback(async () => { try { setLines(await api<BomLine[]>(`/product-os/${devId}/bom`)) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } }, [devId])
  useEffect(() => { void load() }, [load])
  const addLine = () => setLines(l => [...l, { kind: 'filamento', description: '', quantity: 0, unit: 'g', unit_cost: 0, waste_pct: 0 }])
  const upd = (i: number, patch: Partial<BomLine>) => setLines(l => l.map((x, idx) => idx === i ? { ...x, ...patch } : x))
  const save = async () => {
    setBusy(true); setErr(''); setSaved(false)
    try { await api(`/product-os/${devId}/bom`, { method: 'PUT', body: JSON.stringify({ lines: lines.map(l => ({ kind: l.kind, description: l.description, quantity: Number(l.quantity) || 0, unit: l.unit, unit_cost: Number(l.unit_cost) || 0, waste_pct: Number(l.waste_pct) || 0 })) }) }); setSaved(true); void load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  const total = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_cost) * (1 + Number(l.waste_pct) / 100), 0)
  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>Lista de materiais detalhada — substitui o custo estimado quando preenchida.</p>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {saved && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>BOM salvo. Custo total R$ {total.toFixed(2)}.</div>}
      {lines.map((l, i) => (
        <div key={i} className="rounded-lg p-2.5 space-y-2" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Tipo</span>
              <select value={l.kind} onChange={e => upd(i, { kind: e.target.value })} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
                <option value="filamento">Filamento</option><option value="embalagem">Embalagem</option><option value="etiqueta">Etiqueta</option><option value="mao_de_obra">Mão de obra</option><option value="outro">Outro</option>
              </select></label>
            <Input label="Descrição" value={l.description ?? ''} onChange={v => upd(i, { description: v })} />
          </div>
          <div className="grid grid-cols-4 gap-2"><Input label="Qtd" value={String(l.quantity)} onChange={v => upd(i, { quantity: Number(v) || 0 })} /><Input label="Un" value={l.unit} onChange={v => upd(i, { unit: v })} /><Input label="Custo/un" value={String(l.unit_cost)} onChange={v => upd(i, { unit_cost: Number(v) || 0 })} /><Input label="Perda %" value={String(l.waste_pct)} onChange={v => upd(i, { waste_pct: Number(v) || 0 })} /></div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button onClick={addLine} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#111114', border: '1px solid #27272a', color: '#a1a1aa' }}><Plus size={12} /> Linha</button>
        <span className="text-xs font-bold text-cyan-400">Total: R$ {total.toFixed(2)}</span>
        <button onClick={() => void save()} disabled={busy} className="ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Salvar BOM</button>
      </div>
    </div>
  )
}

function QualityTab({ devId }: { devId: string }) {
  const [checklist, setChecklist] = useState(DEFAULT_QC)
  const [approved, setApproved] = useState(false); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [saved, setSaved] = useState(false)
  useEffect(() => { void (async () => { try { const q = await api<Quality | null>(`/product-os/${devId}/quality`); if (q) { setChecklist(q.checklist?.length ? q.checklist : DEFAULT_QC); setApproved(q.approved); setNotes(q.notes ?? '') } } catch { /* novo */ } })() }, [devId])
  const toggle = (i: number) => setChecklist(c => c.map((x, idx) => idx === i ? { ...x, ok: !x.ok } : x))
  const save = async () => {
    setBusy(true); setErr(''); setSaved(false)
    try { await api(`/product-os/${devId}/quality`, { method: 'PUT', body: JSON.stringify({ checklist, approved, notes: notes || undefined }) }); setSaved(true) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>Checklist antes de publicar. Aprovar libera o botão "Virar anúncio".</p>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {saved && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>Checklist salvo.</div>}
      <div className="space-y-1.5">
        {checklist.map((c, i) => (
          <button key={c.key} onClick={() => toggle(i)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#111114', border: '1px solid #27272a', color: c.ok ? '#4ade80' : '#a1a1aa' }}>
            {c.ok ? <CheckCircle2 size={14} /> : <div className="h-3.5 w-3.5 rounded-full" style={{ border: '1px solid #52525b' }} />}{c.label}
          </button>
        ))}
      </div>
      <Input label="Observações" value={notes} onChange={setNotes} />
      <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: approved ? '#4ade80' : '#a1a1aa' }}>
        <input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} /> Qualidade aprovada
      </label>
      <button onClick={() => void save()} disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Salvar qualidade</button>
    </div>
  )
}

function TimelineTab({ devId }: { devId: string }) {
  const [events, setEvents] = useState<DevEvent[]>([]); const [loading, setLoading] = useState(true)
  useEffect(() => { void (async () => { try { setEvents(await api<DevEvent[]>(`/product-os/${devId}/events`)) } catch { /* */ } finally { setLoading(false) } })() }, [devId])
  const LABEL: Record<string, string> = { created: 'Produto criado', status_changed: 'Status alterado', version_added: 'Versão adicionada', version_approved: 'Versão aprovada', version_rejected: 'Versão reprovada', briefing_generated: 'Briefing gerado', cost_computed: 'Custo calculado', dispatched: 'Despachado ao Active', production_order_created: 'Ordem de produção criada', production_completed: 'Produção concluída', quality_checked: 'Qualidade verificada', published: 'Publicado no catálogo', archived: 'Arquivado' }
  if (loading) return <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}><Loader2 size={14} className="animate-spin" /> Carregando…</div>
  if (!events.length) return <p className="text-xs" style={{ color: '#52525b' }}>Sem eventos ainda.</p>
  return (
    <div className="space-y-2">
      {events.map(ev => (
        <div key={ev.id} className="flex items-start gap-2 rounded-lg p-2.5" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: '#00E5FF' }} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white">{LABEL[ev.event_type] ?? ev.event_type}{ev.is_auto && <span className="ml-1.5 rounded px-1 py-0.5 text-[8px] font-bold" style={{ background: '#1a1a1f', color: '#52525b' }}>auto</span>}</p>
            <p className="text-[10px]" style={{ color: '#52525b' }}>{new Date(ev.created_at).toLocaleString('pt-BR')}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── IMPRESSORAS ───────────────────────────────────────────────────────
function PrintersPanel() {
  const [list, setList] = useState<Printer[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [showNew, setShowNew] = useState(false)
  const load = useCallback(async () => { setLoading(true); setErr(''); try { setList(await api<Printer[]>('/product-os/printers')) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const fmt = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs" style={{ color: '#a1a1aa' }}>Cada impressora tem um custo de aquisição que o lucro da produção vai quitando.</p>
        <button onClick={() => setShowNew(true)} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Plus size={12} /> Nova impressora</button>
      </div>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {loading ? <div className="flex items-center gap-2 p-6 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(p => (
            <div key={p.id} className="rounded-xl p-4" style={{ background: '#111114', border: `1px solid ${p.paid_off ? 'rgba(74,222,128,0.4)' : '#27272a'}` }}>
              <div className="flex items-center gap-2">
                <PrinterIcon size={15} className="text-cyan-400" />
                <span className="text-sm font-bold text-white">{p.name}</span>
                {p.status !== 'ativa' && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: '#1a1a1f', color: '#fcd34d' }}>{p.status}</span>}
              </div>
              <p className="mt-0.5 text-[10px]" style={{ color: '#71717a' }}>{[p.brand, p.model, p.build_volume_mm].filter(Boolean).join(' · ') || 'sem detalhes'}{p.has_ams ? ' · AMS' : ''}</p>

              {/* payback */}
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[10px]"><span style={{ color: '#a1a1aa' }}>Investimento</span><span className="font-bold text-white">{fmt(p.acquisition_cost)}</span></div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.paid_pct ?? 0)}%`, background: p.paid_off ? '#4ade80' : '#00E5FF' }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span style={{ color: '#4ade80' }}>{p.paid_off ? '✓ Se pagou' : `${(p.paid_pct ?? 0).toFixed(0)}% quitado`}</span>
                  <span style={{ color: '#71717a' }}>{p.paid_off ? `lucro livre ${fmt(p.accumulated_contribution)}` : `falta ${fmt(p.remaining_to_payback)}`}</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Horas" value={`${(p.total_print_minutes / 60).toFixed(0)}h`} />
                <Stat label="Produzidas" value={String(p.total_units_produced)} />
                <Stat label="Em produção" value={String(p.active_orders)} />
              </div>
              {p.depreciation_per_hour != null && <p className="mt-2 text-[9px]" style={{ color: '#52525b' }}>Depreciação ~{fmt(p.depreciation_per_hour)}/h (vida útil estimada)</p>}
            </div>
          ))}
          {list.length === 0 && <p className="text-xs" style={{ color: '#52525b' }}>Nenhuma impressora cadastrada.</p>}
        </div>
      )}
      {showNew && <NewPrinterModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); void load() }} />}
    </div>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg py-1.5" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}><p className="text-sm font-bold text-white">{value}</p><p className="text-[9px]" style={{ color: '#52525b' }}>{label}</p></div>
}

function NewPrinterModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: '', brand: '', model: '', build_volume_mm: '', nozzle_mm: '', has_ams: false, power_watts: '', acquisition_cost: '', acquisition_date: '', expected_lifetime_hours: '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const set = (k: keyof typeof f, v: string | boolean) => setF(s => ({ ...s, [k]: v }))
  const create = async () => {
    if (!f.name.trim()) { setErr('Nome obrigatório'); return }
    setBusy(true); setErr('')
    try {
      await api('/product-os/printers', { method: 'POST', body: JSON.stringify({ name: f.name, brand: f.brand || undefined, model: f.model || undefined, build_volume_mm: f.build_volume_mm || undefined, nozzle_mm: f.nozzle_mm ? Number(f.nozzle_mm) : undefined, has_ams: f.has_ams, power_watts: f.power_watts ? Number(f.power_watts) : undefined, acquisition_cost: Number(f.acquisition_cost) || 0, acquisition_date: f.acquisition_date || undefined, expected_lifetime_hours: f.expected_lifetime_hours ? Number(f.expected_lifetime_hours) : undefined }) })
      onCreated()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <Modal title="Nova impressora" onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <div className="space-y-2.5">
        <Input label="Nome *" value={f.name} onChange={v => set('name', v)} />
        <div className="grid grid-cols-2 gap-2"><Input label="Marca" value={f.brand} onChange={v => set('brand', v)} /><Input label="Modelo" value={f.model} onChange={v => set('model', v)} /></div>
        <div className="grid grid-cols-2 gap-2"><Input label="Volume (LxLxA mm)" value={f.build_volume_mm} onChange={v => set('build_volume_mm', v)} /><Input label="Bico (mm)" value={f.nozzle_mm} onChange={v => set('nozzle_mm', v)} /></div>
        <div className="grid grid-cols-2 gap-2"><Input label="Custo de aquisição (R$) *" value={f.acquisition_cost} onChange={v => set('acquisition_cost', v)} /><Input label="Data de compra" value={f.acquisition_date} onChange={v => set('acquisition_date', v)} placeholder="2026-01-15" /></div>
        <div className="grid grid-cols-2 gap-2"><Input label="Vida útil (horas)" value={f.expected_lifetime_hours} onChange={v => set('expected_lifetime_hours', v)} /><Input label="Consumo (W)" value={f.power_watts} onChange={v => set('power_watts', v)} /></div>
        <label className="flex items-center gap-2 text-xs" style={{ color: '#a1a1aa' }}><input type="checkbox" checked={f.has_ams} onChange={e => set('has_ams', e.target.checked)} /> Tem AMS (multi-cor)</label>
        <div className="flex justify-end"><button onClick={() => void create()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Cadastrar</button></div>
      </div>
    </Modal>
  )
}

// ── RENTABILIDADE ─────────────────────────────────────────────────────
const REC_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  priorizar: { label: 'Priorizar', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  validar_demanda: { label: 'Validar demanda', color: '#fcd34d', bg: 'rgba(252,211,77,0.12)' },
  reavaliar: { label: 'Reavaliar', color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
  faltam_dados: { label: 'Faltam dados', color: '#71717a', bg: '#1a1a1f' },
}
function ProfitabilityPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<ProfitRow[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState('')
  useEffect(() => { void (async () => { try { setRows(await api<ProfitRow[]>('/product-os/profitability')) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) } })() }, [])
  const money = (n: number) => `R$ ${n.toFixed(2)}`
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)' }}>
        <Gauge size={15} className="mt-0.5 shrink-0 text-cyan-400" />
        <p className="text-xs" style={{ color: '#a5f3fc' }}>Numa fábrica de impressão o gargalo é o <b>tempo de máquina</b>. O ranking abaixo prioriza por <b>lucro por hora de impressora</b> — não por margem absoluta. Cruzamos custo de produção, preço e vendas reais dos últimos 30 dias.</p>
      </div>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {loading ? <div className="flex items-center gap-2 p-6 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Calculando…</div> : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #27272a' }}>
          <table className="w-full text-xs">
            <thead><tr style={{ background: '#0c0c10', color: '#71717a' }}>
              {['Produto', 'R$/hora', 'Contrib./un', 'Tempo/un', 'Custo', 'Preço', 'Vendas 30d', 'Ação'].map((h, i) => <th key={h} className={`px-3 py-2 font-semibold ${i === 0 ? 'text-left' : 'text-right'} ${h === 'Ação' ? 'text-center' : ''}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const rec = REC_STYLE[r.recommendation] ?? REC_STYLE.faltam_dados
                return (
                  <tr key={r.product_dev_id} onClick={() => onOpen(r.product_dev_id)} className="cursor-pointer" style={{ borderTop: '1px solid #1a1a1f' }}>
                    <td className="px-3 py-2"><p className="font-semibold text-white">{r.name}</p><p className="text-[10px]" style={{ color: '#52525b' }}>{r.category ?? '—'}</p></td>
                    <td className="px-3 py-2 text-right font-bold" style={{ color: r.profit_per_hour == null ? '#52525b' : r.profit_per_hour > 0 ? '#00E5FF' : '#f87171' }}>{r.profit_per_hour == null ? '—' : money(r.profit_per_hour)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: '#a1a1aa' }}>{money(r.contribution_unit)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: '#a1a1aa' }}>{r.print_minutes_unit ? `${r.print_minutes_unit} min` : '—'}</td>
                    <td className="px-3 py-2 text-right" style={{ color: '#71717a' }}>{money(r.cost_unit)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: '#71717a' }}>{r.price_unit ? money(r.price_unit) : '—'}</td>
                    <td className="px-3 py-2 text-right" style={{ color: r.units_sold_30d > 0 ? '#4ade80' : '#52525b' }}>{r.units_sold_30d}</td>
                    <td className="px-3 py-2 text-center"><span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: rec.bg, color: rec.color }}>{rec.label}</span></td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-xs" style={{ color: '#52525b' }}>Sem produtos com dados de tempo de impressão ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── modais base ───────────────────────────────────────────────────────
function NewProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', category: '', description: '', inspiration_url: '', reference_url: '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const create = async () => {
    if (!form.name.trim()) { setErr('Nome é obrigatório'); return }
    setBusy(true); setErr('')
    try { await api('/product-os', { method: 'POST', body: JSON.stringify({ name: form.name, category: form.category || undefined, description: form.description || undefined, inspiration_url: form.inspiration_url || undefined, reference_images: form.reference_url ? [{ url: form.reference_url }] : undefined }) }); onCreated() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <Modal title="Novo produto" onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <div className="space-y-2.5">
        <Input label="Nome *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
        <Input label="Categoria" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} />
        <Input label="Descrição / ideia" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
        <Input label="Link de inspiração" value={form.inspiration_url} onChange={v => setForm(f => ({ ...f, inspiration_url: v }))} />
        <Input label="URL imagem de referência" value={form.reference_url} onChange={v => setForm(f => ({ ...f, reference_url: v }))} />
      </div>
      <div className="mt-4 flex justify-end"><button onClick={() => void create()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Criar</button></div>
    </Modal>
  )
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<Settings | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [pla, setPla] = useState(''); const [petg, setPetg] = useState(''); const [abs, setAbs] = useState('')
  const [energy, setEnergy] = useState(''); const [labor, setLabor] = useState(''); const [pkg, setPkg] = useState(''); const [waste, setWaste] = useState('')
  useEffect(() => { void (async () => { try { const r = await api<Settings>('/product-os/settings'); setS(r); setPla(String(r.filament_cost_per_kg?.PLA ?? '')); setPetg(String(r.filament_cost_per_kg?.PETG ?? '')); setAbs(String(r.filament_cost_per_kg?.ABS ?? '')); setEnergy(String(r.energy_cost_per_hour ?? '')); setLabor(String(r.labor_cost_per_hour ?? '')); setPkg(String(r.packaging_cost ?? '')); setWaste(String(r.default_waste_pct ?? '')) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } })() }, [])
  const save = async () => {
    setBusy(true); setErr('')
    try { await api('/product-os/settings', { method: 'PUT', body: JSON.stringify({ filament_cost_per_kg: { PLA: Number(pla) || 0, PETG: Number(petg) || 0, ABS: Number(abs) || 0 }, energy_cost_per_hour: Number(energy) || 0, labor_cost_per_hour: Number(labor) || 0, packaging_cost: Number(pkg) || 0, default_waste_pct: Number(waste) || 0 }) }); onClose() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <Modal title="Constantes de fabricação" onClose={onClose}>
      {!s ? <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}><Loader2 size={14} className="animate-spin" /> Carregando…</div> : <>
        {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
        <p className="mb-3 text-xs" style={{ color: '#a1a1aa' }}>Valores da sua operação — usados pra calcular o custo de fabricação.</p>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: '#71717a' }}>Filamento (R$/kg)</p>
        <div className="grid grid-cols-3 gap-2"><Input label="PLA" value={pla} onChange={setPla} /><Input label="PETG" value={petg} onChange={setPetg} /><Input label="ABS" value={abs} onChange={setAbs} /></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><Input label="Energia (R$/h)" value={energy} onChange={setEnergy} /><Input label="Mão de obra (R$/h)" value={labor} onChange={setLabor} /><Input label="Embalagem (R$/un)" value={pkg} onChange={setPkg} /><Input label="Perda técnica (%)" value={waste} onChange={setWaste} /></div>
        <div className="mt-4 flex justify-end"><button onClick={() => void save()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Salvar</button></div>
      </>}
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2"><h3 className="text-sm font-bold text-white">{title}</h3><button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={16} /></button></div>
        {children}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const style: CSSProperties = { background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>{label}</span>
      <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-cyan-500" style={style} />
    </label>
  )
}
