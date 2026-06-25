'use client'

import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react'
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
  Printer as PrinterIcon, TrendingUp, Gauge, Wifi, Upload,
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
  printer_id: string | null; is_prototype: boolean; estimated_time_minutes: number | null; estimated_filament_g: number | null; created_at: string
  jobs?: Job[]
}
interface Job { id: string; job_number: number; status: string; filament_used_g: number | null; print_time_minutes: number | null; failure_reason: string | null }
interface Input {
  id: string; kind: string; sku: string | null; name: string; description: string | null
  material: string | null; color: string | null; color_hex: string | null; brand: string | null; supplier: string | null
  diameter_mm: number | null; spool_weight_g: number | null; unit: string
  quantity: number; reserved_quantity: number; reorder_threshold: number; cost_per_unit: number; available: number; alert: boolean
}
interface InputMovement { id: string; movement_type: string; quantity: number; unit_cost: number | null; balance_after: number | null; notes: string | null; created_at: string }
interface BomLine { id?: string; kind: string; description: string | null; quantity: number; unit: string; unit_cost: number; waste_pct: number }
interface Quality { id: string; checklist: Array<{ key: string; label: string; ok: boolean }>; approved: boolean; notes: string | null }
interface DevEvent { id: string; event_type: string; payload: Record<string, unknown>; is_auto: boolean; created_at: string }
interface LicenseVerdict { level: 'green' | 'yellow' | 'red'; can_remodel: boolean; can_commercial: boolean; label: string; reason: string }
interface MwPreview {
  source_url: string; external_id: string; title: string; license: string | null; license_title: string | null
  allow_recreation: boolean; is_printable: boolean; cover_url: string | null; creator: string | null
  download_count: number; print_count: number; like_count: number; collection_count: number
  tags: string[]; weight_g: number | null; print_time_minutes: number | null; material_count: number | null
  need_ams: boolean; is_remix: boolean; verdict: LicenseVerdict; already_imported_id: string | null
}
interface Printer {
  id: string; name: string; brand: string | null; model: string | null; build_volume_mm: string | null; nozzle_mm: number | null
  has_ams: boolean; power_watts: number | null; acquisition_cost: number; acquisition_date: string | null
  expected_lifetime_hours: number | null; status: string; notes: string | null
  serial_number: string | null; lan_ip: string | null
  accumulated_contribution: number; paid_pct: number | null; remaining_to_payback: number; paid_off: boolean
  total_units_produced: number; total_print_minutes: number; active_orders: number; depreciation_per_hour: number | null
}
interface ConsumePreview {
  source: 'bom' | 'filament' | 'none'; quantity: number; total_cost: number; all_sufficient: boolean; material?: string | null
  lines: Array<{ input_id: string | null; name: string; unit: string; needed: number; available: number; sufficient: boolean; unit_cost: number; line_cost: number }>
}
interface ProfitRow {
  product_dev_id: string; name: string; category: string | null; print_minutes_unit: number; cost_unit: number; price_unit: number
  contribution_unit: number; profit_per_hour: number | null; units_sold_30d: number; units_produced: number
  revenue_30d: number; realized_profit_30d: number; recommendation: string
}
interface FactoryOverview {
  printers: { count: number; active: number; total_investment: number; total_paid_back: number; payback_pct: number | null; paid_off: number; total_print_hours: number }
  production: { orders_done: number; orders_active: number; units_produced: number; units_30d: number; total_contribution: number; free_profit: number }
  sales: { revenue_30d: number; realized_profit_30d: number; units_sold_30d: number }
  inputs: { low_stock: Array<{ name: string; available: number; unit: string }> }
  top_products: ProfitRow[]
}
interface ProductionPlan {
  capacity_hours: number; active_printers: number; hours_used: number; hours_idle: number; utilization_pct: number; total_contribution: number
  plan: Array<{ product_dev_id: string; name: string; units: number; hours: number; profit_per_hour: number | null; contribution: number }>
}
interface FarmStatus {
  id: string; name: string; config_status: string; bound: boolean; online: boolean; state: string
  job_name: string | null; progress_pct: number | null; layer_current: number | null; layer_total: number | null
  nozzle_temp: number | null; bed_temp: number | null; remaining_minutes: number | null
  ams: Array<{ slot: string; material: string; color: string; remain_pct: number }> | null
  error_code: string | null; error_text: string | null; last_update: string | null
}
interface FarmAgent { id: string; name: string; status: string; version: string | null; last_seen_at: string | null; online: boolean }
interface SchedulerResult {
  idle_printers: number; queued_orders: number
  assignments: Array<{ order_id: string; order_number: number; product_dev_id: string; name: string; quantity: number; printer_id: string; printer_name: string; profit_per_hour: number | null }>
}
interface PrinterAnalytics {
  printer: { id: string; name: string; brand: string | null; model: string | null; status: string; build_volume_mm: string | null; has_ams: boolean; acquisition_cost: number; acquisition_date: string | null }
  performance: { jobs_total: number; jobs_done: number; jobs_failed: number; success_rate_pct: number | null; total_print_hours: number; avg_minutes_per_job: number | null; filament_used_g: number }
  throughput: { units_produced: number; units_30d: number; orders_done: number; orders_active: number }
  economics: { accumulated_contribution: number; paid_pct: number | null; remaining_to_payback: number; paid_off: boolean; revenue_per_hour: number | null; depreciation_per_hour: number | null; days_owned: number | null; utilization_pct: number | null }
  by_product: Array<{ product_dev_id: string; name: string; units: number; hours: number; contribution: number; profit_per_hour: number | null }>
  recent_orders: Array<{ order_number: number; name: string; status: string; quantity: number; contribution_total: number | null; completed_at: string | null }>
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

// sobe o arquivo DIRETO pro storage via URL assinada (não passa pela API)
async function uploadFile(file: File): Promise<string> {
  const meta = await api<{ path: string; token: string; public_url: string }>('/product-os/upload-url', { method: 'POST', body: JSON.stringify({ filename: file.name }) })
  const sb = createClient()
  const { error } = await sb.storage.from('product-os').uploadToSignedUrl(meta.path, meta.token, file)
  if (error) throw new Error(error.message)
  return meta.public_url
}
function fileTypeOf(name: string): string {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  return ['stl', '3mf', 'step', 'obj'].includes(ext) ? ext : 'other'
}

function UploadButton({ label, accept, multiple, onUploaded }: { label: string; accept?: string; multiple?: boolean; onUploaded: (urls: string[], files: File[]) => void }) {
  const [busy, setBusy] = useState(false); const ref = useRef<HTMLInputElement>(null)
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return
    setBusy(true)
    try { const urls: string[] = []; for (const f of files) urls.push(await uploadFile(f)); onUploaded(urls, files) }
    catch (err) { window.alert('Falha no upload: ' + (err instanceof Error ? err.message : 'erro')) }
    finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }
  return (
    <>
      <input ref={ref} type="file" accept={accept} multiple={multiple} onChange={e => void handle(e)} style={{ display: 'none' }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ background: '#111114', border: '1px solid #27272a', color: '#a5f3fc' }}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {label}
      </button>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════
export default function ProductOsPage() {
  const [tab, setTab] = useState<'fabrica' | 'ciclo' | 'producao' | 'impressoras' | 'rentabilidade' | 'insumos'>('fabrica')
  const [items, setItems] = useState<ProductDev[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
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
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#111114', border: '1px solid #27272a', color: '#a5f3fc' }}><Boxes size={12} /> Importar do MakerWorld</button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Plus size={12} /> Novo produto</button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ background: '#111114', border: '1px solid #1a1a1f', width: 'fit-content' }}>
        {([['fabrica', 'Fábrica', <Gauge key="f" size={13} />], ['ciclo', 'Ciclo de vida', <Lightbulb key="a" size={13} />], ['producao', 'Produção', <Factory key="b" size={13} />], ['impressoras', 'Impressoras', <PrinterIcon key="d" size={13} />], ['rentabilidade', 'Rentabilidade', <TrendingUp key="e" size={13} />], ['insumos', 'Insumos', <Boxes key="c" size={13} />]] as const).map(([k, lbl, ic]) => (
          <button key={k} onClick={() => setTab(k)} className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold" style={{ background: tab === k ? 'rgba(0,229,255,0.12)' : 'transparent', color: tab === k ? '#00E5FF' : '#71717a' }}>{ic}{lbl}</button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}><AlertTriangle size={14} className="shrink-0" /> <span className="whitespace-pre-line">{error}</span></div>}

      {tab === 'fabrica' && <FactoryPanel onGoTo={setTab} onOpen={setOpenId} />}
      {tab === 'ciclo' && <LifecycleBoard items={items} loading={loading} onOpen={setOpenId} onChanged={load} setError={setError} />}
      {tab === 'producao' && <ProductionBoard products={items} />}
      {tab === 'impressoras' && <PrintersPanel />}
      {tab === 'rentabilidade' && <ProfitabilityPanel onOpen={setOpenId} />}
      {tab === 'insumos' && <InsumosPanel />}

      {openId && <DetailDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
      {showNew && <NewProductModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); void load() }} />}
      {showImport && <ImportMakerworldModal onClose={() => setShowImport(false)} onImported={id => { setShowImport(false); void load(); setTab('ciclo'); setOpenId(id) }} />}
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

  const [notice, setNotice] = useState('')
  const transition = async (oid: string, status: string) => {
    try { await api(`/product-os/production-orders/${oid}/transition`, { method: 'POST', body: JSON.stringify({ status }) }); void load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }
  const sendToPrinter = async (oid: string) => {
    setErr(''); setNotice('')
    try { await api(`/product-os/farm/orders/${oid}/send`, { method: 'POST' }); setNotice('Job enviado pra impressora (envio experimental — confirme na máquina).') }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  // produto cadastrado → produção; projeto com versão (modelagem+) → protótipo
  const approved = products.filter(p => p.product_id || !['ideia', 'briefing'].includes(p.status))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs" style={{ color: '#a1a1aa' }}>Ordens de produção e fila de impressão.</p>
        <button onClick={() => setShowNew(true)} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Plus size={12} /> Nova ordem</button>
      </div>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {notice && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{notice}</div>}
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
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-bold text-white">#{o.order_number} · {nameOf(o.product_dev_id)}</p>
                        {o.is_prototype && <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd' }}>protótipo</span>}
                      </div>
                      <p className="text-[10px]" style={{ color: '#71717a' }}>{o.quantity} un{o.estimated_filament_g ? ` · ${o.estimated_filament_g} g` : ''}{o.machine ? ` · ${o.machine}` : ''}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(ORDER_NEXT[o.status] ?? []).map(ns => (
                          <button key={ns} onClick={() => void transition(o.id, ns)} className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: ns === 'cancelado' || ns === 'falhou' ? '#0a0a0e' : 'rgba(0,229,255,0.10)', color: ns === 'cancelado' || ns === 'falhou' ? '#71717a' : '#a5f3fc', border: '1px solid #27272a' }}>{ns}</button>
                        ))}
                      </div>
                      {o.printer_id && !['disponivel', 'cancelado'].includes(o.status) && (
                        <button onClick={() => void sendToPrinter(o.id)} className="mt-1 flex w-full items-center justify-center gap-1 rounded px-1.5 py-1 text-[9px] font-bold" style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}><Send size={9} /> Enviar pra impressora</button>
                      )}
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
  const [preview, setPreview] = useState<ConsumePreview | null>(null); const [prevLoading, setPrevLoading] = useState(false)
  useEffect(() => { void (async () => { try { setPrinters(await api<Printer[]>('/product-os/printers')) } catch { /* */ } })() }, [])
  useEffect(() => {
    const n = Number(qty) || 0
    if (!devId || n < 1) { setPreview(null); return }
    let cancel = false; setPrevLoading(true)
    const t = setTimeout(() => { void (async () => {
      try { const p = await api<ConsumePreview>('/product-os/production-orders/preview', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, quantity: n }) }); if (!cancel) setPreview(p) }
      catch { if (!cancel) setPreview(null) }
      finally { if (!cancel) setPrevLoading(false) }
    })() }, 350)
    return () => { cancel = true; clearTimeout(t) }
  }, [devId, qty])
  const create = async () => {
    if (!devId) { setErr('Selecione um produto aprovado'); return }
    setBusy(true); setErr('')
    try { await api('/product-os/production-orders', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, quantity: Number(qty) || 1, printer_id: printerId || undefined, machine: printers.find(p => p.id === printerId)?.name || undefined }) }); onCreated() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <Modal title="Nova ordem de produção" onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {approved.length === 0 ? <p className="text-xs" style={{ color: '#a1a1aa' }}>Nenhum projeto pronto. Avance um projeto pra modelagem pra imprimir protótipo, ou cadastre o produto (&quot;Virar anúncio&quot;) pra produzir unidades de venda.</p> : (
        <div className="space-y-2.5">
          <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Produto</span>
            <select value={devId} onChange={e => setDevId(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
              {approved.map(p => <option key={p.id} value={p.id}>{p.name}{p.product_id ? '' : ' (sem cadastro → protótipo)'}</option>)}
            </select>
          </label>
          {(() => { const sel = approved.find(p => p.id === devId); const isProto = !!sel && !sel.product_id; return <p className="text-[10px]" style={{ color: isProto ? '#c4b5fd' : '#4ade80' }}>{isProto ? '🧪 Protótipo — consome insumo, NÃO vira estoque de venda.' : '📦 Produção — consome insumo e entra no estoque do produto cadastrado.'}</p> })()}
          <div className="grid grid-cols-2 gap-2">
            <Input label="Quantidade" value={qty} onChange={setQty} />
            <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Impressora</span>
              <select value={printerId} onChange={e => setPrinterId(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
                <option value="">— sem impressora —</option>
                {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          {prevLoading && <p className="text-[10px]" style={{ color: '#52525b' }}>Calculando consumo…</p>}
          {preview && preview.lines.length > 0 && (
            <div className="rounded-lg p-2.5" style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Vai consumir do estoque{preview.source === 'filament' ? ' (filamento)' : ''}</span>
                <span className="text-[10px]" style={{ color: '#a5f3fc' }}>≈ R$ {preview.total_cost.toFixed(2)}</span>
              </div>
              <div className="space-y-1">
                {preview.lines.map((l, idx) => (
                  <div key={l.input_id ?? idx} className="flex items-center justify-between text-[11px]">
                    <span className="truncate" style={{ color: '#d4d4d8' }}>{l.name}</span>
                    <span className="ml-2 shrink-0" style={{ color: l.sufficient ? '#4ade80' : '#f87171' }}>{l.needed} {l.unit} <span style={{ color: '#52525b' }}>/ {l.available} disp.</span></span>
                  </div>
                ))}
              </div>
              {!preview.all_sufficient && <p className="mt-1.5 text-[10px]" style={{ color: '#fcd34d' }}>⚠️ Estoque insuficiente em algum insumo — reponha antes de concluir a produção.</p>}
            </div>
          )}
          {preview && preview.lines.length === 0 && preview.source === 'none' && <p className="text-[10px]" style={{ color: '#52525b' }}>Sem composição (BOM) nem peso de versão — nenhum insumo será reservado.</p>}
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
  const [showNew, setShowNew] = useState(false); const [restockItem, setRestockItem] = useState<Input | null>(null); const [openInsumo, setOpenInsumo] = useState<Input | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setList(await api<Input[]>('/product-os/production-inputs')) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

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
            <div key={i.id} onClick={() => setOpenInsumo(i)} className="cursor-pointer rounded-xl p-3 transition-colors hover:border-cyan-700" style={{ background: '#111114', border: `1px solid ${i.alert ? 'rgba(252,211,77,0.4)' : '#27272a'}` }}>
              <div className="flex items-center gap-2">
                {i.color_hex && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: i.color_hex.startsWith('#') ? i.color_hex : `#${i.color_hex}`, border: '1px solid #27272a' }} />}
                <span className="truncate text-xs font-bold text-white">{i.name}</span>
                {i.alert && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'rgba(252,211,77,0.12)', color: '#fcd34d' }}>repor</span>}
                <button onClick={e => { e.stopPropagation(); setRestockItem(i) }} className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: 'rgba(0,229,255,0.10)', color: '#a5f3fc', border: '1px solid #27272a' }}>+ repor</button>
              </div>
              <p className="mt-1 text-[10px]" style={{ color: '#71717a' }}>{[i.sku, i.kind, i.material, i.brand, i.color].filter(Boolean).join(' · ')}{i.diameter_mm ? ` · ${i.diameter_mm}mm` : ''}</p>
              <div className="mt-1.5 flex items-baseline gap-1"><span className="text-lg font-extrabold text-cyan-400">{i.available}</span><span className="text-[10px]" style={{ color: '#52525b' }}>{i.unit} disp. ({i.quantity} − {i.reserved_quantity})</span></div>
              <p className="mt-0.5 text-[10px]" style={{ color: '#71717a' }}>custo médio <b style={{ color: '#a5f3fc' }}>R$ {Number(i.cost_per_unit).toFixed(2)}/{i.unit}</b></p>
            </div>
          ))}
          {list.length === 0 && <p className="text-xs" style={{ color: '#52525b' }}>Nenhum insumo cadastrado.</p>}
        </div>
      )}
      {showNew && <NewInputModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); void load() }} />}
      {restockItem && <RestockModal item={restockItem} onClose={() => setRestockItem(null)} onDone={() => { setRestockItem(null); void load() }} />}
      {openInsumo && <InsumoDetailDrawer item={openInsumo} onClose={() => setOpenInsumo(null)} onChanged={() => { setOpenInsumo(null); void load() }} />}
    </div>
  )
}

function InsumoDetailDrawer({ item, onClose, onChanged }: { item: Input; onClose: () => void; onChanged: () => void }) {
  const [f, setF] = useState({
    sku: item.sku ?? '', name: item.name, description: item.description ?? '', material: item.material ?? '',
    color: item.color ?? '', color_hex: item.color_hex ?? '', brand: item.brand ?? '', supplier: item.supplier ?? '',
    diameter_mm: item.diameter_mm != null ? String(item.diameter_mm) : '', unit: item.unit,
    reorder_threshold: String(item.reorder_threshold ?? ''),
  })
  const set = (k: keyof typeof f, v: string) => setF(s => ({ ...s, [k]: v }))
  const [movs, setMovs] = useState<InputMovement[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  useEffect(() => { void (async () => { try { setMovs(await api<InputMovement[]>(`/product-os/production-inputs/${item.id}/movements`)) } catch { /* */ } })() }, [item.id])
  const save = async () => {
    setBusy(true); setErr(''); setMsg('')
    try {
      await api(`/product-os/production-inputs/${item.id}`, { method: 'PATCH', body: JSON.stringify({
        sku: f.sku || null, name: f.name, description: f.description || null, material: f.material || null,
        color: f.color || null, color_hex: f.color_hex || null, brand: f.brand || null, supplier: f.supplier || null,
        diameter_mm: f.diameter_mm ? Number(f.diameter_mm) : null, unit: f.unit, reorder_threshold: Number(f.reorder_threshold) || 0,
      }) })
      setMsg('Insumo atualizado.'); onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  const deactivate = async () => {
    if (!window.confirm('Desativar este insumo? Ele some da lista (não é apagado).')) return
    try { await api(`/product-os/production-inputs/${item.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: false }) }); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }
  const MOV: Record<string, string> = { in: 'Entrada', adjust: 'Ajuste', reserve: 'Reserva', release: 'Liberação', consume: 'Consumo' }
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto p-5" style={{ background: '#0a0a0e', borderLeft: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-2">
          {item.color_hex && <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: item.color_hex.startsWith('#') ? item.color_hex : `#${item.color_hex}`, border: '1px solid #27272a' }} />}
          <div><h2 className="text-base font-extrabold text-white">{item.name}</h2><p className="text-xs" style={{ color: '#71717a' }}>{item.kind}{item.sku ? ` · ${item.sku}` : ''}</p></div>
          <button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={18} /></button>
        </div>

        {/* estoque */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Stat label={`Disponível (${item.unit})`} value={String(item.available)} />
          <Stat label="Reservado" value={String(item.reserved_quantity)} />
          <Stat label="Custo médio" value={`R$ ${Number(item.cost_per_unit).toFixed(2)}`} />
        </div>

        {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
        {msg && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>}

        {/* edição */}
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#71717a' }}>Dados do insumo</p>
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2"><Input label="SKU" value={f.sku} onChange={v => set('sku', v)} /><Input label="Tipo/Material" value={f.material} onChange={v => set('material', v)} /></div>
          <Input label="Nome" value={f.name} onChange={v => set('name', v)} />
          <Input label="Descrição" value={f.description} onChange={v => set('description', v)} />
          <div className="grid grid-cols-3 gap-2"><Input label="Cor" value={f.color} onChange={v => set('color', v)} /><Input label="Cor (hex)" value={f.color_hex} onChange={v => set('color_hex', v)} /><Input label="Marca" value={f.brand} onChange={v => set('brand', v)} /></div>
          <div className="grid grid-cols-3 gap-2"><Input label="Fornecedor" value={f.supplier} onChange={v => set('supplier', v)} /><Input label="Diâmetro (mm)" value={f.diameter_mm} onChange={v => set('diameter_mm', v)} /><Input label="Alerta abaixo de" value={f.reorder_threshold} onChange={v => set('reorder_threshold', v)} /></div>
          <div className="flex items-center gap-2">
            <button onClick={() => void deactivate()} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#71717a' }}>Desativar</button>
            <button onClick={() => void save()} disabled={busy} className="ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Salvar</button>
          </div>
        </div>

        {/* histórico */}
        <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#71717a' }}>Movimentações</p>
        {movs.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Sem movimentações.</p> : (
          <div className="space-y-1">
            {movs.map(m => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
                <span className="font-semibold" style={{ color: m.movement_type === 'in' ? '#4ade80' : m.movement_type === 'consume' ? '#f87171' : '#a1a1aa' }}>{MOV[m.movement_type] ?? m.movement_type}</span>
                <span style={{ color: '#a1a1aa' }}>{m.quantity} {item.unit}</span>
                {m.unit_cost != null && <span style={{ color: '#a5f3fc' }}>@ R$ {Number(m.unit_cost).toFixed(2)}</span>}
                {m.balance_after != null && <span style={{ color: '#52525b' }}>→ {m.balance_after}</span>}
                <span className="ml-auto text-[9px]" style={{ color: '#52525b' }}>{new Date(m.created_at).toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RestockModal({ item, onClose, onDone }: { item: Input; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState(''); const [unitCost, setUnitCost] = useState(String(item.cost_per_unit ?? ''))
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const q = Number(qty) || 0, c = Number(unitCost) || 0
  // prévia do novo custo médio ponderado
  const newAvg = (q > 0) ? ((Number(item.quantity) * Number(item.cost_per_unit) + q * c) / (Number(item.quantity) + q)) : Number(item.cost_per_unit)
  const save = async () => {
    if (q <= 0) { setErr('Informe a quantidade'); return }
    setBusy(true); setErr('')
    try { await api(`/product-os/production-inputs/${item.id}/movement`, { method: 'POST', body: JSON.stringify({ type: 'in', quantity: q, unit_cost: unitCost ? c : undefined }) }); onDone() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <Modal title={`Repor — ${item.name}`} onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <p className="mb-3 text-xs" style={{ color: '#a1a1aa' }}>Estoque atual: {item.quantity} {item.unit} · custo médio R$ {Number(item.cost_per_unit).toFixed(2)}/{item.unit}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input label={`Entrada (${item.unit})`} value={qty} onChange={setQty} />
        <Input label={`Preço da entrada (R$/${item.unit})`} value={unitCost} onChange={setUnitCost} />
      </div>
      <div className="mt-3 rounded-lg p-2.5 text-xs" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
        <div className="flex justify-between" style={{ color: '#a1a1aa' }}><span>Novo estoque</span><span className="font-bold text-white">{Number(item.quantity) + q} {item.unit}</span></div>
        <div className="flex justify-between" style={{ color: '#a1a1aa' }}><span>Novo custo médio ponderado</span><span className="font-bold text-cyan-400">R$ {newAvg.toFixed(2)}/{item.unit}</span></div>
      </div>
      <div className="mt-4 flex justify-end"><button onClick={() => void save()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Dar entrada</button></div>
    </Modal>
  )
}

function NewInputModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ kind: 'filamento', sku: '', name: '', description: '', material: '', color: '', color_hex: '', brand: '', supplier: '', diameter_mm: '', spool_weight_g: '', unit: 'g', quantity: '', reorder_threshold: '', cost_per_unit: '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const set = (k: keyof typeof f, v: string) => setF(s => ({ ...s, [k]: v }))
  const isFil = f.kind === 'filamento'
  const create = async () => {
    if (!f.name.trim()) { setErr('Nome obrigatório'); return }
    setBusy(true); setErr('')
    try {
      await api('/product-os/production-inputs', { method: 'POST', body: JSON.stringify({
        kind: f.kind, sku: f.sku || undefined, name: f.name, description: f.description || undefined,
        material: f.material || undefined, color: f.color || undefined, color_hex: f.color_hex || undefined,
        brand: f.brand || undefined, supplier: f.supplier || undefined,
        diameter_mm: f.diameter_mm ? Number(f.diameter_mm) : undefined, spool_weight_g: f.spool_weight_g ? Number(f.spool_weight_g) : undefined,
        unit: f.unit, quantity: Number(f.quantity) || 0, reorder_threshold: Number(f.reorder_threshold) || 0, cost_per_unit: Number(f.cost_per_unit) || 0,
      }) })
      onCreated()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <Modal title="Novo insumo" onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Categoria</span>
            <select value={f.kind} onChange={e => set('kind', e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
              <option value="filamento">Filamento</option><option value="embalagem">Embalagem</option><option value="etiqueta">Etiqueta</option><option value="outro">Outro</option>
            </select></label>
          <Input label="SKU" value={f.sku} onChange={v => set('sku', v)} />
        </div>
        <Input label="Nome *" value={f.name} onChange={v => set('name', v)} />
        <Input label="Descrição" value={f.description} onChange={v => set('description', v)} />
        <div className="grid grid-cols-2 gap-2">
          <Input label={isFil ? 'Tipo (PLA/PETG/ABS)' : 'Tipo/Material'} value={f.material} onChange={v => set('material', v)} />
          <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Unidade de medida</span>
            <select value={f.unit} onChange={e => set('unit', e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
              <option value="g">grama (g)</option><option value="kg">quilo (kg)</option><option value="un">unidade (un)</option><option value="m">metro (m)</option>
            </select></label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Input label="Cor" value={f.color} onChange={v => set('color', v)} />
          <Input label="Cor (hex)" value={f.color_hex} onChange={v => set('color_hex', v)} placeholder="#FFFFFF" />
          <Input label="Marca" value={f.brand} onChange={v => set('brand', v)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Fornecedor" value={f.supplier} onChange={v => set('supplier', v)} />
          {isFil ? <Input label="Diâmetro (mm)" value={f.diameter_mm} onChange={v => set('diameter_mm', v)} placeholder="1.75" /> : <Input label="Peso do rolo (g)" value={f.spool_weight_g} onChange={v => set('spool_weight_g', v)} />}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#71717a' }}>Estoque inicial</p>
        <div className="grid grid-cols-3 gap-2">
          <Input label={`Qtd (${f.unit})`} value={f.quantity} onChange={v => set('quantity', v)} />
          <Input label={`Preço (R$/${f.unit})`} value={f.cost_per_unit} onChange={v => set('cost_per_unit', v)} />
          <Input label="Alerta abaixo de" value={f.reorder_threshold} onChange={v => set('reorder_threshold', v)} />
        </div>
        <div className="flex justify-end"><button onClick={() => void create()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Cadastrar</button></div>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════════════════
// DRAWER de detalhe
// ════════════════════════════════════════════════════════════════════
interface CostReality {
  estimated_unit_cost: number; real_unit_cost_avg: number; variance_pct: number | null
  total_units_produced: number; total_estimated: number; total_real: number
  orders: Array<{ order_number: number; is_prototype: boolean; quantity: number; real_time_min: number; material_cost: number; real_unit_cost: number; estimated_unit_cost: number; real_total: number }>
  consumption: Array<{ name: string; unit: string; qty: number; cost: number }>
}
type DrawerTab = 'briefing' | 'versoes' | 'custo' | 'real' | 'bom' | 'qualidade' | 'timeline'
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
              {([['briefing', 'Briefing', <Sparkles key="a" size={11} />], ['versoes', 'Versões', <FileBox key="b" size={11} />], ['custo', 'Custo', <DollarSign key="c" size={11} />], ['real', 'Custo real', <Gauge key="g" size={11} />], ['bom', 'BOM', <ListChecks key="d" size={11} />], ['qualidade', 'Qualidade', <ClipboardList key="e" size={11} />], ['timeline', 'Timeline', <History key="f" size={11} />]] as const).map(([k, lbl, ic]) => (
                <button key={k} onClick={() => setTab(k)} className="flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] font-semibold" style={{ background: tab === k ? 'rgba(0,229,255,0.12)' : 'transparent', color: tab === k ? '#00E5FF' : '#71717a' }}>{ic}{lbl}</button>
              ))}
            </div>

            {tab === 'briefing' && <BriefingTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
            {tab === 'versoes' && <VersionsTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
            {tab === 'custo' && <CostTab dev={dev} onChanged={onChanged} />}
            {tab === 'real' && <CostRealityTab devId={dev.id} />}
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
  const [form, setForm] = useState({ changelog: '', file_url: '', file_type: '', material: '', weight_g: '', print_time_minutes: '', volume_cm3: '' })
  const [photos, setPhotos] = useState<string[]>([])
  const [slicer, setSlicer] = useState(''); const [parsing, setParsing] = useState(false); const [showSlicer, setShowSlicer] = useState(false)
  const importSlicer = async () => {
    setParsing(true); setErr('')
    try {
      const r = await api<{ weight_g: number | null; print_time_minutes: number | null; material: string | null }>('/product-os/parse-slicer', { method: 'POST', body: JSON.stringify({ text: slicer }) })
      if (r.weight_g == null && r.print_time_minutes == null) { setErr('Não encontrei peso/tempo no texto. Cole o resumo do slicer ou o cabeçalho do G-code.'); return }
      setForm(f => ({ ...f, weight_g: r.weight_g != null ? String(r.weight_g) : f.weight_g, print_time_minutes: r.print_time_minutes != null ? String(r.print_time_minutes) : f.print_time_minutes, material: r.material ?? f.material }))
      setShowSlicer(false); setSlicer('')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setParsing(false) }
  }
  const add = async () => {
    setAdding(true); setErr('')
    try {
      await api(`/product-os/${dev.id}/versions`, { method: 'POST', body: JSON.stringify({ changelog: form.changelog || undefined, file_url: form.file_url || undefined, file_type: form.file_type || undefined, material: form.material || undefined, weight_g: form.weight_g ? Number(form.weight_g) : undefined, print_time_minutes: form.print_time_minutes ? Number(form.print_time_minutes) : undefined, volume_cm3: form.volume_cm3 ? Number(form.volume_cm3) : undefined, prototype_photo_urls: photos.length ? photos : undefined }) })
      setForm({ changelog: '', file_url: '', file_type: '', material: '', weight_g: '', print_time_minutes: '', volume_cm3: '' }); setPhotos([]); onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setAdding(false) }
  }
  return (
    <div className="space-y-3">
      <div className="rounded-lg p-3 space-y-2" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="flex items-center gap-2"><p className="text-xs font-bold text-white">Nova versão</p>
          <button onClick={() => setShowSlicer(s => !s)} className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(0,229,255,0.10)', color: '#a5f3fc', border: '1px solid #27272a' }}><FileBox size={10} /> Importar do slicer</button>
        </div>
        {showSlicer && (
          <div className="space-y-1.5 rounded-lg p-2" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
            <p className="text-[10px]" style={{ color: '#71717a' }}>Cole o resumo do Bambu Studio/Orca (ou o cabeçalho do .gcode). Extraio peso, tempo e material.</p>
            <textarea value={slicer} onChange={e => setSlicer(e.target.value)} rows={3} placeholder="Ex: Total time: 1h 32m · Total filament: 145.2 g · PLA" className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none" style={{ background: '#111114', border: '1px solid #27272a', color: '#fafafa' }} />
            <button onClick={() => void importSlicer()} disabled={parsing || !slicer.trim()} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{parsing ? <Loader2 size={10} className="animate-spin" /> : <Cpu size={10} />} Extrair</button>
          </div>
        )}
        <Input label="Changelog" value={form.changelog} onChange={v => setForm(f => ({ ...f, changelog: v }))} />
        <div className="flex items-center gap-2">
          <UploadButton label="Subir arquivo (STL/3MF/STEP)" accept=".stl,.3mf,.step,.obj" onUploaded={(urls, files) => setForm(f => ({ ...f, file_url: urls[0], file_type: fileTypeOf(files[0].name) }))} />
          {form.file_url && <span className="text-[10px]" style={{ color: '#4ade80' }}>✓ arquivo enviado ({form.file_type})</span>}
        </div>
        <div className="grid grid-cols-2 gap-2"><Input label="Material" value={form.material} onChange={v => setForm(f => ({ ...f, material: v }))} /><Input label="Peso (g)" value={form.weight_g} onChange={v => setForm(f => ({ ...f, weight_g: v }))} /></div>
        <div className="grid grid-cols-2 gap-2"><Input label="Tempo impressão (min)" value={form.print_time_minutes} onChange={v => setForm(f => ({ ...f, print_time_minutes: v }))} /><Input label="Volume (cm³)" value={form.volume_cm3} onChange={v => setForm(f => ({ ...f, volume_cm3: v }))} /></div>
        <div className="flex items-center gap-2">
          <UploadButton label="Fotos do protótipo" accept="image/*" multiple onUploaded={urls => setPhotos(p => [...p, ...urls])} />
          {photos.length > 0 && <span className="text-[10px]" style={{ color: '#4ade80' }}>{photos.length} foto(s)</span>}
        </div>
        {photos.length > 0 && <div className="flex flex-wrap gap-1">{photos.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={u} alt="" className="h-10 w-10 rounded object-cover" style={{ border: '1px solid #27272a' }} />
        ))}</div>}
        <button onClick={() => void add()} disabled={adding} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Adicionar versão</button>
      </div>
      {err && <div className="whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {dev.versions.map(v => <VersionCard key={v.id} v={v} onChanged={onChanged} />)}
      {dev.versions.length === 0 && <p className="text-xs" style={{ color: '#52525b' }}>Nenhuma versão ainda.</p>}
    </div>
  )
}

function VersionCard({ v, onChanged }: { v: Version; onChanged: () => void }) {
  const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [f, setF] = useState({ changelog: v.changelog ?? '', material: v.material ?? '', weight_g: v.weight_g != null ? String(v.weight_g) : '', print_time_minutes: v.print_time_minutes != null ? String(v.print_time_minutes) : '', volume_cm3: v.volume_cm3 != null ? String(v.volume_cm3) : '' })
  const setApproval = async (approved: boolean) => { try { await api(`/product-os/versions/${v.id}/approval`, { method: 'POST', body: JSON.stringify({ approved }) }); onChanged() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } }
  const save = async () => {
    setBusy(true); setErr('')
    try { await api(`/product-os/versions/${v.id}`, { method: 'PATCH', body: JSON.stringify({ changelog: f.changelog || null, material: f.material || null, weight_g: f.weight_g ? Number(f.weight_g) : null, print_time_minutes: f.print_time_minutes ? Number(f.print_time_minutes) : null, volume_cm3: f.volume_cm3 ? Number(f.volume_cm3) : null }) }); setEditing(false); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <div className="rounded-lg p-3" style={{ background: '#111114', border: `1px solid ${v.approved ? 'rgba(74,222,128,0.35)' : '#27272a'}` }}>
      <div className="flex items-center gap-2">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#1a1a1f', color: '#a5f3fc' }}>v{v.version_number}</span>
        <span className="truncate text-xs font-semibold text-white">{v.changelog ?? 'sem changelog'}</span>
        <button onClick={() => setEditing(e => !e)} className="ml-auto text-[10px]" style={{ color: '#71717a' }}>{editing ? 'cancelar' : 'editar'}</button>
        <span className="text-[10px]" style={{ color: '#71717a' }}>{v.status}</span>
      </div>
      {err && <p className="mt-1 text-[10px]" style={{ color: '#f87171' }}>{err}</p>}
      {editing ? (
        <div className="mt-2 space-y-2">
          <Input label="Changelog" value={f.changelog} onChange={x => setF(s => ({ ...s, changelog: x }))} />
          <div className="grid grid-cols-2 gap-2"><Input label="Material" value={f.material} onChange={x => setF(s => ({ ...s, material: x }))} /><Input label="Peso (g)" value={f.weight_g} onChange={x => setF(s => ({ ...s, weight_g: x }))} /></div>
          <div className="grid grid-cols-2 gap-2"><Input label="Tempo (min)" value={f.print_time_minutes} onChange={x => setF(s => ({ ...s, print_time_minutes: x }))} /><Input label="Volume (cm³)" value={f.volume_cm3} onChange={x => setF(s => ({ ...s, volume_cm3: x }))} /></div>
          <button onClick={() => void save()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Salvar versão</button>
        </div>
      ) : (
        <>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]" style={{ color: '#a1a1aa' }}>{v.material && <span>{v.material}</span>}{v.weight_g != null && <span>{v.weight_g} g</span>}{v.print_time_minutes != null && <span>{v.print_time_minutes} min</span>}{v.volume_cm3 != null && <span>{v.volume_cm3} cm³</span>}{v.file_url && <a href={v.file_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">arquivo</a>}</div>
          {v.prototype_photo_urls && v.prototype_photo_urls.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{v.prototype_photo_urls.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" className="h-8 w-8 rounded object-cover" style={{ border: '1px solid #27272a' }} />
          ))}</div>}
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => void setApproval(true)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}><Check size={10} /> Aprovar</button>
            <button onClick={() => void setApproval(false)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: '#0a0a0e', color: '#71717a', border: '1px solid #27272a' }}><Ban size={10} /> Reprovar</button>
          </div>
        </>
      )}
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

function CostRealityTab({ devId }: { devId: string }) {
  const [d, setD] = useState<CostReality | null>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState('')
  useEffect(() => { void (async () => { try { setD(await api<CostReality>(`/product-os/${devId}/cost-reality`)) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) } })() }, [devId])
  const money = (n: number) => `R$ ${n.toFixed(2)}`
  if (loading) return <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}><Loader2 size={14} className="animate-spin" /> Carregando…</div>
  if (err) return <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>
  if (!d) return null
  if (d.total_units_produced === 0) return <p className="text-xs" style={{ color: '#52525b' }}>Nenhuma produção concluída ainda. O custo real aparece quando uma ordem chega em &quot;Disponível&quot;.</p>
  const v = d.variance_pct
  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>Quanto você <b>achou</b> que custava × quanto <b>custou de verdade</b> (material consumido + tempo real).</p>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Estimado/un" value={money(d.estimated_unit_cost)} />
        <Stat label="REAL/un" value={money(d.real_unit_cost_avg)} />
        <div className="rounded-lg py-1.5 text-center" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
          <p className="text-sm font-bold" style={{ color: v == null ? '#a1a1aa' : v > 0 ? '#f87171' : '#4ade80' }}>{v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'}</p>
          <p className="text-[9px]" style={{ color: '#52525b' }}>variância</p>
        </div>
      </div>
      <p className="text-[10px]" style={{ color: '#52525b' }}>{d.total_units_produced} un produzidas · estimado {money(d.total_estimated)} × real {money(d.total_real)}</p>

      <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <p className="mb-2 text-xs font-bold text-white">Insumos consumidos</p>
        {d.consumption.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Sem consumo registrado (vincule um insumo ao material da versão).</p> : d.consumption.map((c, i) => (
          <div key={i} className="flex items-center justify-between py-0.5 text-xs"><span style={{ color: '#a1a1aa' }}>{c.name}</span><span style={{ color: '#71717a' }}>{c.qty} {c.unit} · <b className="text-cyan-400">{money(c.cost)}</b></span></div>
        ))}
      </div>

      <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <p className="mb-2 text-xs font-bold text-white">Por ordem concluída</p>
        {d.orders.map(o => (
          <div key={o.order_number} className="flex items-center gap-2 py-1 text-[11px]" style={{ color: '#a1a1aa' }}>
            <span className="font-bold" style={{ color: '#52525b' }}>#{o.order_number}</span>
            {o.is_prototype && <span className="rounded px-1 text-[8px] font-bold" style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd' }}>prot</span>}
            <span>{o.quantity}un · {o.real_time_min}min</span>
            <span className="ml-auto">real <b className="text-white">{money(o.real_unit_cost)}</b>/un</span>
            <span style={{ color: '#52525b' }}>est {money(o.estimated_unit_cost)}</span>
          </div>
        ))}
      </div>
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

// ── PAINEL DA FÁBRICA ─────────────────────────────────────────────────
function FactoryPanel({ onGoTo, onOpen }: { onGoTo: (t: 'impressoras' | 'rentabilidade' | 'insumos' | 'producao') => void; onOpen: (id: string) => void }) {
  const [ov, setOv] = useState<FactoryOverview | null>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState('')
  useEffect(() => { void (async () => { try { setOv(await api<FactoryOverview>('/product-os/factory-overview')) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) } })() }, [])
  const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (loading) return <div className="flex items-center gap-2 p-6 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>
  if (err) return <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>
  if (!ov) return null
  const pk = ov.printers, pr = ov.production
  return (
    <div className="space-y-4">
      {/* KPIs principais */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Investido em máquinas" value={money(pk.total_investment)} sub={`${pk.count} impressora(s) · ${pk.paid_off} já paga(s)`} accent="#a5f3fc" onClick={() => onGoTo('impressoras')} />
        <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Payback geral</p>
          <p className="mt-1 text-2xl font-extrabold text-white">{pk.payback_pct == null ? '—' : `${pk.payback_pct.toFixed(0)}%`}</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, pk.payback_pct ?? 0)}%`, background: '#00E5FF' }} />
          </div>
          <p className="mt-1 text-[10px]" style={{ color: '#52525b' }}>{money(pk.total_paid_back)} de {money(pk.total_investment)} quitado</p>
        </div>
        <Kpi label="Lucro livre" value={money(pr.free_profit)} sub="contribuição após pagar as máquinas" accent="#4ade80" />
        <Kpi label="Produção (30d)" value={String(pr.units_30d)} sub={`${pr.units_produced} unidades no total`} accent="#fafafa" onClick={() => onGoTo('producao')} />
      </div>

      {/* KPIs secundários */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Horas impressas" value={`${pk.total_print_hours.toFixed(0)}h`} accent="#a1a1aa" />
        <Kpi label="Ordens em produção" value={String(pr.orders_active)} accent="#a1a1aa" onClick={() => onGoTo('producao')} />
        <Kpi label="Ordens concluídas" value={String(pr.orders_done)} accent="#a1a1aa" />
        <Kpi label="Contribuição gerada" value={money(pr.total_contribution)} accent="#a1a1aa" />
      </div>

      {/* vendas reais (fecha o ciclo produzi→vendi→lucrei) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Faturamento (30d)" value={money(ov.sales.revenue_30d)} sub="vendas reais dos produtos publicados" accent="#4ade80" />
        <Kpi label="Lucro real (30d)" value={money(ov.sales.realized_profit_30d)} accent="#4ade80" />
        <Kpi label="Unidades vendidas (30d)" value={String(ov.sales.units_sold_30d)} accent="#a1a1aa" />
      </div>

      <ProductionPlanCard onOpen={onOpen} />
      <SchedulerCard />

      <div className="grid gap-3 lg:grid-cols-2">
        {/* top produtos */}
        <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <div className="mb-2 flex items-center gap-2"><TrendingUp size={14} className="text-cyan-400" /><span className="text-xs font-bold text-white">Mais rentáveis (R$/hora de máquina)</span><button onClick={() => onGoTo('rentabilidade')} className="ml-auto text-[10px] font-semibold text-cyan-400">ver tudo →</button></div>
          {ov.top_products.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Sem produtos com tempo de impressão ainda.</p> : (
            <div className="space-y-1.5">
              {ov.top_products.map((p, i) => (
                <button key={p.product_dev_id} onClick={() => onOpen(p.product_dev_id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
                  <span className="font-bold" style={{ color: '#52525b' }}>{i + 1}</span>
                  <span className="truncate font-semibold text-white">{p.name}</span>
                  <span className="ml-auto font-bold" style={{ color: p.profit_per_hour && p.profit_per_hour > 0 ? '#00E5FF' : '#f87171' }}>{p.profit_per_hour == null ? '—' : money(p.profit_per_hour) + '/h'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* insumos em alerta */}
        <div className="rounded-xl p-4" style={{ background: '#111114', border: `1px solid ${ov.inputs.low_stock.length ? 'rgba(252,211,77,0.4)' : '#27272a'}` }}>
          <div className="mb-2 flex items-center gap-2"><AlertTriangle size={14} style={{ color: ov.inputs.low_stock.length ? '#fcd34d' : '#52525b' }} /><span className="text-xs font-bold text-white">Insumos para repor</span><button onClick={() => onGoTo('insumos')} className="ml-auto text-[10px] font-semibold text-cyan-400">gerenciar →</button></div>
          {ov.inputs.low_stock.length === 0 ? <p className="text-xs" style={{ color: '#4ade80' }}>✓ Tudo abastecido.</p> : (
            <div className="space-y-1.5">
              {ov.inputs.low_stock.map((i, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
                  <span className="font-semibold text-white">{i.name}</span>
                  <span className="ml-auto font-bold" style={{ color: '#fcd34d' }}>{i.available} {i.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
function Kpi({ label, value, sub, accent, onClick }: { label: string; value: string; sub?: string; accent: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`rounded-xl p-4 ${onClick ? 'cursor-pointer' : ''}`} style={{ background: '#111114', border: '1px solid #27272a' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>{label}</p>
      <p className="mt-1 text-2xl font-extrabold" style={{ color: accent }}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px]" style={{ color: '#52525b' }}>{sub}</p>}
    </div>
  )
}

function ProductionPlanCard({ onOpen }: { onOpen: (id: string) => void }) {
  const [plan, setPlan] = useState<ProductionPlan | null>(null); const [loading, setLoading] = useState(true); const [hours, setHours] = useState('')
  const load = useCallback(async (h?: string) => { setLoading(true); try { setPlan(await api<ProductionPlan>(`/product-os/production-plan${h ? `?hours=${h}` : ''}`)) } catch { /* */ } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Factory size={14} className="text-cyan-400" />
        <span className="text-xs font-bold text-white">Plano de produção sugerido</span>
        <span className="text-[10px]" style={{ color: '#52525b' }}>maximiza R$/hora do parque, limitado pela demanda</span>
        <div className="ml-auto flex items-center gap-1">
          <input value={hours} onChange={e => setHours(e.target.value)} placeholder="horas" className="w-16 rounded px-2 py-1 text-[10px] outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
          <button onClick={() => void load(hours || undefined)} className="rounded px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(0,229,255,0.10)', color: '#a5f3fc', border: '1px solid #27272a' }}>recalcular</button>
        </div>
      </div>
      {loading ? <div className="flex items-center gap-2 text-xs" style={{ color: '#71717a' }}><Loader2 size={12} className="animate-spin" /> Calculando…</div> : !plan ? null : (
        <>
          <div className="mb-2 flex flex-wrap gap-3 text-[11px]" style={{ color: '#a1a1aa' }}>
            <span>{plan.active_printers} máquina(s) · capacidade {plan.capacity_hours}h</span>
            <span>utilização <b style={{ color: '#00E5FF' }}>{plan.utilization_pct}%</b></span>
            <span>ociosas {plan.hours_idle}h</span>
            <span>contribuição prevista <b style={{ color: '#4ade80' }}>{money(plan.total_contribution)}</b></span>
          </div>
          {plan.plan.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Sem produtos que vendam + tenham tempo de impressão pra planejar. Publique produtos e registre tempo/vendas.</p> : (
            <div className="space-y-1.5">
              {plan.plan.map(p => (
                <button key={p.product_dev_id} onClick={() => onOpen(p.product_dev_id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
                  <span className="truncate font-semibold text-white">{p.name}</span>
                  <span className="ml-auto" style={{ color: '#a5f3fc' }}>{p.units} un · {p.hours}h</span>
                  <span className="font-bold" style={{ color: '#4ade80' }}>{money(p.contribution)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SchedulerCard() {
  const [data, setData] = useState<SchedulerResult | null>(null); const [loading, setLoading] = useState(true); const [msg, setMsg] = useState('')
  const load = useCallback(async () => { setLoading(true); try { setData(await api<SchedulerResult>('/product-os/farm/scheduler')) } catch { /* */ } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const apply = async () => {
    if (!data?.assignments.length) return
    setMsg('')
    try { const r = await api<{ assigned: number }>('/product-os/farm/scheduler/apply', { method: 'POST', body: JSON.stringify({ assignments: data.assignments.map(a => ({ order_id: a.order_id, printer_id: a.printer_id })) }) }); setMsg(`${r.assigned} ordem(ns) atribuída(s).`); void load() }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') }
  }
  const money = (n: number) => `R$ ${n.toFixed(2)}`
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="mb-2 flex items-center gap-2">
        <Wifi size={14} className="text-cyan-400" />
        <span className="text-xs font-bold text-white">Scheduler — o que pôr em cada impressora ociosa</span>
        {data && data.assignments.length > 0 && <button onClick={() => void apply()} className="ml-auto rounded px-2 py-1 text-[10px] font-bold" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>Atribuir tudo</button>}
      </div>
      {loading ? <div className="flex items-center gap-2 text-xs" style={{ color: '#71717a' }}><Loader2 size={12} className="animate-spin" /> Calculando…</div> : !data ? null : (
        <>
          <p className="mb-2 text-[11px]" style={{ color: '#52525b' }}>{data.idle_printers} impressora(s) ociosa(s) · {data.queued_orders} ordem(ns) na fila</p>
          {data.assignments.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Nada a sugerir — precisa de impressora ociosa online + ordem na fila com R$/hora.</p> : (
            <div className="space-y-1.5">
              {data.assignments.map(a => (
                <div key={a.order_id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
                  <PrinterIcon size={12} className="text-cyan-400" />
                  <span className="font-semibold text-white">{a.printer_name}</span>
                  <span style={{ color: '#52525b' }}>←</span>
                  <span className="truncate" style={{ color: '#a1a1aa' }}>#{a.order_number} {a.name} ({a.quantity}un)</span>
                  <span className="ml-auto font-bold" style={{ color: '#00E5FF' }}>{a.profit_per_hour != null ? money(a.profit_per_hour) + '/h' : '—'}</span>
                </div>
              ))}
            </div>
          )}
          {msg && <p className="mt-2 text-[10px]" style={{ color: '#a5f3fc' }}>{msg}</p>}
        </>
      )}
    </div>
  )
}

// ── IMPRESSORAS ───────────────────────────────────────────────────────
function PrintersPanel() {
  const [list, setList] = useState<Printer[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [showNew, setShowNew] = useState(false); const [openPrinter, setOpenPrinter] = useState<Printer | null>(null)
  const [live, setLive] = useState<Record<string, FarmStatus>>({}); const [showConnect, setShowConnect] = useState(false)
  const load = useCallback(async () => { setLoading(true); setErr(''); try { setList(await api<Printer[]>('/product-os/printers')) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  // estado ao vivo: poll a cada 5s
  useEffect(() => {
    let alive = true
    const tick = async () => { try { const s = await api<FarmStatus[]>('/product-os/farm/status'); if (alive) setLive(Object.fromEntries(s.map(x => [x.id, x]))) } catch { /* */ } }
    void tick(); const it = setInterval(tick, 5000)
    return () => { alive = false; clearInterval(it) }
  }, [])
  const fmt = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs" style={{ color: '#a1a1aa' }}>Cada impressora tem um custo de aquisição que o lucro da produção vai quitando.</p>
        <button onClick={() => setShowConnect(true)} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: '#111114', border: '1px solid #27272a', color: '#a5f3fc' }}><Wifi size={12} /> Conectar farm</button>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Plus size={12} /> Nova impressora</button>
      </div>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {loading ? <div className="flex items-center gap-2 p-6 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(p => (
            <div key={p.id} onClick={() => setOpenPrinter(p)} className="cursor-pointer rounded-xl p-4 transition-colors hover:border-cyan-700" style={{ background: '#111114', border: `1px solid ${p.paid_off ? 'rgba(74,222,128,0.4)' : '#27272a'}` }}>
              <div className="flex items-center gap-2">
                <PrinterIcon size={15} className="text-cyan-400" />
                <span className="text-sm font-bold text-white">{p.name}</span>
                {p.status !== 'ativa' && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: '#1a1a1f', color: '#fcd34d' }}>{p.status}</span>}
              </div>
              <p className="mt-0.5 text-[10px]" style={{ color: '#71717a' }}>{[p.brand, p.model, p.build_volume_mm].filter(Boolean).join(' · ') || 'sem detalhes'}{p.has_ams ? ' · AMS' : ''}</p>
              <LiveBadge lv={live[p.id]} />

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
      {openPrinter && <PrinterDetailDrawer printer={openPrinter} onClose={() => setOpenPrinter(null)} onChanged={() => void load()} />}
      {showConnect && <ConnectFarmModal onClose={() => setShowConnect(false)} />}
    </div>
  )
}

function LiveBadge({ lv }: { lv?: FarmStatus }) {
  if (!lv || !lv.bound) return <p className="mt-1 text-[9px]" style={{ color: '#3f3f46' }}>sem telemetria (vincule o nº de série)</p>
  const label: Record<string, string> = { printing: 'imprimindo', paused: 'pausada', error: 'erro', offline: 'offline', idle: 'ociosa', sem_dados: 'sem dados' }
  const color = lv.state === 'printing' ? '#00E5FF' : lv.state === 'error' ? '#f87171' : lv.state === 'offline' ? '#52525b' : lv.online ? '#4ade80' : '#52525b'
  return (
    <div className="mt-1.5" onClick={e => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        <span style={{ color: '#a1a1aa' }}>{label[lv.state] ?? lv.state}</span>
        {lv.nozzle_temp != null && <span style={{ color: '#52525b' }}>· bico {Math.round(lv.nozzle_temp)}°</span>}
        {lv.state === 'printing' && lv.remaining_minutes != null && <span style={{ color: '#52525b' }}>· {lv.remaining_minutes}min</span>}
      </div>
      {lv.state === 'printing' && lv.progress_pct != null && (
        <div className="mt-1 flex items-center gap-1.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: '#0a0a0e' }}><div className="h-full rounded-full" style={{ width: `${lv.progress_pct}%`, background: '#00E5FF' }} /></div>
          <span className="text-[9px]" style={{ color: '#a5f3fc' }}>{Math.round(lv.progress_pct)}%</span>
        </div>
      )}
      {lv.job_name && lv.state === 'printing' && <p className="mt-0.5 truncate text-[9px]" style={{ color: '#52525b' }}>{lv.job_name}</p>}
      {lv.error_text && <p className="mt-0.5 text-[9px]" style={{ color: '#f87171' }}>{lv.error_code} {lv.error_text}</p>}
    </div>
  )
}

function ConnectFarmModal({ onClose }: { onClose: () => void }) {
  const [agents, setAgents] = useState<FarmAgent[]>([]); const [token, setToken] = useState<{ name: string; token: string } | null>(null)
  const [name, setName] = useState('Agente da fábrica'); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [copied, setCopied] = useState(false)
  const load = useCallback(async () => { try { setAgents(await api<FarmAgent[]>('/product-os/farm/agents')) } catch { /* */ } }, [])
  useEffect(() => { void load() }, [load])
  const create = async () => { setBusy(true); setErr(''); try { setToken(await api<{ name: string; token: string }>('/product-os/farm/agents', { method: 'POST', body: JSON.stringify({ name }) })); void load() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) } }
  return (
    <Modal title="Conectar a farm" onClose={onClose}>
      <p className="mb-3 text-xs" style={{ color: '#a1a1aa' }}>Rode o <b>e-Click Farm Agent</b> num PC sempre ligado na fábrica. Gere um token, cole no <code>config.json</code> do agente e cadastre o nº de série de cada impressora no cadastro dela.</p>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {token ? (
        <div className="mb-3 rounded-lg p-3" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)' }}>
          <p className="text-xs font-bold" style={{ color: '#4ade80' }}>Token gerado — copie agora (aparece só uma vez):</p>
          <code className="mt-1.5 block break-all rounded p-2 text-[10px]" style={{ background: '#0a0a0e', color: '#a5f3fc' }}>{token.token}</code>
          <button onClick={() => { void navigator.clipboard.writeText(token.token); setCopied(true) }} className="mt-1.5 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(0,229,255,0.10)', color: '#a5f3fc', border: '1px solid #27272a' }}>{copied ? 'copiado ✓' : 'copiar'}</button>
        </div>
      ) : (
        <div className="mb-3 flex items-end gap-2">
          <div className="flex-1"><Input label="Nome do agente" value={name} onChange={setName} /></div>
          <button onClick={() => void create()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF', height: 34 }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Gerar</button>
        </div>
      )}
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#71717a' }}>Agentes</p>
      {agents.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Nenhum agente ainda.</p> : (
        <div className="space-y-1.5">
          {agents.map(a => (
            <div key={a.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.online ? '#4ade80' : '#52525b' }} />
              <span className="font-semibold text-white">{a.name}</span>
              {a.version && <span className="text-[9px]" style={{ color: '#52525b' }}>v{a.version}</span>}
              <span className="ml-auto text-[9px]" style={{ color: '#52525b' }}>{a.online ? 'online' : a.last_seen_at ? `visto ${new Date(a.last_seen_at).toLocaleString('pt-BR')}` : 'nunca conectou'}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function PrinterDetailDrawer({ printer, onClose, onChanged }: { printer: Printer; onClose: () => void; onChanged: () => void }) {
  const id = printer.id
  const [a, setA] = useState<PrinterAnalytics | null>(null); const [err, setErr] = useState('')
  const [live, setLive] = useState<FarmStatus | null>(null); const [cmdMsg, setCmdMsg] = useState('')
  const [editing, setEditing] = useState(false); const [savingEdit, setSavingEdit] = useState(false)
  const [ef, setEf] = useState({ name: printer.name, brand: printer.brand ?? '', model: printer.model ?? '', build_volume_mm: printer.build_volume_mm ?? '', acquisition_cost: String(printer.acquisition_cost ?? ''), expected_lifetime_hours: printer.expected_lifetime_hours != null ? String(printer.expected_lifetime_hours) : '', status: printer.status, serial_number: printer.serial_number ?? '', lan_ip: printer.lan_ip ?? '' })
  const setE = (k: keyof typeof ef, v: string) => setEf(s => ({ ...s, [k]: v }))
  const saveEdit = async () => {
    setSavingEdit(true); setErr('')
    try { await api(`/product-os/printers/${id}`, { method: 'PATCH', body: JSON.stringify({ name: ef.name, brand: ef.brand || null, model: ef.model || null, build_volume_mm: ef.build_volume_mm || null, acquisition_cost: Number(ef.acquisition_cost) || 0, expected_lifetime_hours: ef.expected_lifetime_hours ? Number(ef.expected_lifetime_hours) : null, status: ef.status, serial_number: ef.serial_number || null, lan_ip: ef.lan_ip || null }) }); onChanged(); onClose() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setSavingEdit(false) }
  }
  useEffect(() => { void (async () => { try { setA(await api<PrinterAnalytics>(`/product-os/printers/${id}/analytics`)) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } })() }, [id])
  const loadLive = useCallback(async () => { try { const s = await api<FarmStatus[]>('/product-os/farm/status'); setLive(s.find(x => x.id === id) ?? null) } catch { /* */ } }, [id])
  useEffect(() => { void loadLive(); const it = setInterval(() => void loadLive(), 5000); return () => clearInterval(it) }, [loadLive])
  const cmd = async (type: string) => {
    if (type === 'stop' && !window.confirm('Parar a impressão atual? Isso cancela o job na máquina.')) return
    setCmdMsg('')
    try { await api(`/product-os/farm/printers/${id}/command`, { method: 'POST', body: JSON.stringify({ type }) }); setCmdMsg('Comando enviado à impressora.') }
    catch (e) { setCmdMsg(e instanceof Error ? e.message : 'Erro') }
  }
  const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto p-5" style={{ background: '#0a0a0e', borderLeft: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        {!a ? <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}>{err ? <span style={{ color: '#f87171' }}>{err}</span> : <><Loader2 size={16} className="animate-spin" /> Carregando…</>}</div> : (
          <>
            <div className="mb-4 flex items-start gap-2">
              <PrinterIcon size={18} className="mt-0.5 text-cyan-400" />
              <div>
                <h2 className="text-base font-extrabold text-white">{a.printer.name}</h2>
                <p className="text-xs" style={{ color: '#71717a' }}>{[a.printer.brand, a.printer.model, a.printer.build_volume_mm].filter(Boolean).join(' · ') || 'sem detalhes'}{a.printer.has_ams ? ' · AMS' : ''} · {a.printer.status}</p>
              </div>
              <button onClick={() => setEditing(e => !e)} className="ml-auto text-[11px] font-semibold" style={{ color: '#a5f3fc' }}>{editing ? 'cancelar' : 'editar'}</button>
              <button onClick={onClose} style={{ color: '#71717a' }}><X size={18} /></button>
            </div>

            {editing && (
              <div className="mb-3 space-y-2 rounded-lg p-3" style={{ background: '#111114', border: '1px solid rgba(0,229,255,0.25)' }}>
                <Input label="Nome" value={ef.name} onChange={v => setE('name', v)} />
                <div className="grid grid-cols-2 gap-2"><Input label="Marca" value={ef.brand} onChange={v => setE('brand', v)} /><Input label="Modelo" value={ef.model} onChange={v => setE('model', v)} /></div>
                <div className="grid grid-cols-2 gap-2"><Input label="Volume (mm)" value={ef.build_volume_mm} onChange={v => setE('build_volume_mm', v)} /><Input label="Custo de aquisição (R$)" value={ef.acquisition_cost} onChange={v => setE('acquisition_cost', v)} /></div>
                <div className="grid grid-cols-2 gap-2"><Input label="Nº de série" value={ef.serial_number} onChange={v => setE('serial_number', v)} /><Input label="IP na rede" value={ef.lan_ip} onChange={v => setE('lan_ip', v)} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Vida útil (h)" value={ef.expected_lifetime_hours} onChange={v => setE('expected_lifetime_hours', v)} />
                  <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Status</span>
                    <select value={ef.status} onChange={e => setE('status', e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
                      <option value="ativa">Ativa</option><option value="manutencao">Manutenção</option><option value="aposentada">Aposentada</option>
                    </select></label>
                </div>
                <button onClick={() => void saveEdit()} disabled={savingEdit} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{savingEdit ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Salvar impressora</button>
              </div>
            )}

            {/* controle ao vivo */}
            {live && (
              <div className="mb-3 rounded-lg p-2.5" style={{ background: live.online ? 'rgba(0,229,255,0.05)' : '#0c0c10', border: `1px solid ${live.online ? 'rgba(0,229,255,0.25)' : '#1a1a1f'}` }}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: live.online ? (live.state === 'printing' ? '#00E5FF' : live.state === 'error' ? '#f87171' : '#4ade80') : '#52525b' }} />
                  <span className="text-[11px] font-semibold" style={{ color: '#a1a1aa' }}>{live.online ? live.state : 'offline'}</span>
                  {live.state === 'printing' && live.progress_pct != null && <span className="text-[11px]" style={{ color: '#a5f3fc' }}>{Math.round(live.progress_pct)}%{live.remaining_minutes != null ? ` · ${live.remaining_minutes}min` : ''}</span>}
                  {live.online && (
                    <div className="ml-auto flex gap-1">
                      {live.state === 'printing' && <CtrlBtn onClick={() => void cmd('pause')} label="Pausar" />}
                      {live.state === 'paused' && <CtrlBtn onClick={() => void cmd('resume')} label="Retomar" />}
                      {(live.state === 'printing' || live.state === 'paused') && <CtrlBtn onClick={() => void cmd('stop')} label="Parar" danger />}
                      <CtrlBtn onClick={() => void cmd('light_on')} label="Luz" />
                      <CtrlBtn onClick={() => void cmd('light_off')} label="Off" />
                    </div>
                  )}
                </div>
                {cmdMsg && <p className="mt-1 text-[10px]" style={{ color: '#a5f3fc' }}>{cmdMsg}</p>}
                {!live.online && <p className="mt-1 text-[10px]" style={{ color: '#52525b' }}>Offline — sem controle. Verifique o agente na fábrica.</p>}
              </div>
            )}

            {/* payback */}
            <div className="mb-3 rounded-xl p-4" style={{ background: '#111114', border: `1px solid ${a.economics.paid_off ? 'rgba(74,222,128,0.4)' : '#27272a'}` }}>
              <div className="mb-1 flex items-center justify-between text-[11px]"><span style={{ color: '#a1a1aa' }}>Investimento {money(a.printer.acquisition_cost)}</span><span className="font-bold" style={{ color: a.economics.paid_off ? '#4ade80' : '#00E5FF' }}>{a.economics.paid_off ? '✓ Se pagou' : `${(a.economics.paid_pct ?? 0).toFixed(0)}% quitado`}</span></div>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, a.economics.paid_pct ?? 0)}%`, background: a.economics.paid_off ? '#4ade80' : '#00E5FF' }} /></div>
              <div className="mt-1 flex justify-between text-[10px]" style={{ color: '#71717a' }}><span>lucro gerado {money(a.economics.accumulated_contribution)}</span><span>{a.economics.paid_off ? 'lucro livre' : `falta ${money(a.economics.remaining_to_payback)}`}</span></div>
            </div>

            {/* KPIs */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Stat label="R$/hora real" value={a.economics.revenue_per_hour != null ? money(a.economics.revenue_per_hour) : '—'} />
              <Stat label="Horas impressas" value={`${a.performance.total_print_hours.toFixed(0)}h`} />
              <Stat label="Taxa de sucesso" value={a.performance.success_rate_pct != null ? `${a.performance.success_rate_pct.toFixed(0)}%` : '—'} />
              <Stat label="Unidades" value={String(a.throughput.units_produced)} />
              <Stat label="Filamento usado" value={`${(a.performance.filament_used_g / 1000).toFixed(2)} kg`} />
              <Stat label="Utilização" value={a.economics.utilization_pct != null ? `${a.economics.utilization_pct.toFixed(0)}%` : '—'} />
            </div>

            {/* confiabilidade */}
            <div className="mb-3 rounded-xl p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <p className="mb-1.5 text-xs font-bold text-white">Confiabilidade</p>
              <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: '#a1a1aa' }}>
                <span>{a.performance.jobs_done} jobs OK</span>
                <span style={{ color: a.performance.jobs_failed > 0 ? '#f87171' : '#52525b' }}>{a.performance.jobs_failed} falhas</span>
                <span>média {a.performance.avg_minutes_per_job != null ? `${a.performance.avg_minutes_per_job.toFixed(0)} min/job` : '—'}</span>
                <span>{a.throughput.orders_active} ordem(ns) ativa(s)</span>
              </div>
            </div>

            {/* por produto */}
            <div className="mb-3 rounded-xl p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <p className="mb-2 text-xs font-bold text-white">O que ela mais produz (R$/hora)</p>
              {a.by_product.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Nenhuma produção concluída ainda.</p> : (
                <div className="space-y-1.5">
                  {a.by_product.map(p => (
                    <div key={p.product_dev_id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
                      <span className="truncate font-semibold text-white">{p.name}</span>
                      <span className="ml-auto text-[10px]" style={{ color: '#71717a' }}>{p.units} un · {p.hours}h</span>
                      <span className="font-bold" style={{ color: '#00E5FF' }}>{p.profit_per_hour != null ? money(p.profit_per_hour) + '/h' : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ordens recentes */}
            <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <p className="mb-2 text-xs font-bold text-white">Ordens recentes</p>
              {a.recent_orders.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Sem ordens.</p> : (
                <div className="space-y-1">
                  {a.recent_orders.map(o => (
                    <div key={o.order_number} className="flex items-center gap-2 text-[11px]" style={{ color: '#a1a1aa' }}>
                      <span className="font-bold" style={{ color: '#52525b' }}>#{o.order_number}</span>
                      <span className="truncate text-white">{o.name}</span>
                      <span className="ml-auto">{o.quantity} un</span>
                      <span style={{ color: o.status === 'disponivel' ? '#4ade80' : o.status === 'cancelado' ? '#52525b' : '#fcd34d', width: 70, textAlign: 'right' }}>{o.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg py-1.5" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}><p className="text-sm font-bold text-white">{value}</p><p className="text-[9px]" style={{ color: '#52525b' }}>{label}</p></div>
}
function CtrlBtn({ onClick, label, danger }: { onClick: () => void; label: string; danger?: boolean }) {
  return <button onClick={onClick} className="rounded px-2 py-1 text-[10px] font-semibold" style={{ background: danger ? 'rgba(239,68,68,0.10)' : 'rgba(0,229,255,0.10)', color: danger ? '#f87171' : '#a5f3fc', border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : '#27272a'}` }}>{label}</button>
}

function NewPrinterModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ name: '', brand: '', model: '', build_volume_mm: '', nozzle_mm: '', has_ams: false, power_watts: '', acquisition_cost: '', acquisition_date: '', expected_lifetime_hours: '', serial_number: '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const set = (k: keyof typeof f, v: string | boolean) => setF(s => ({ ...s, [k]: v }))
  const create = async () => {
    if (!f.name.trim()) { setErr('Nome obrigatório'); return }
    setBusy(true); setErr('')
    try {
      await api('/product-os/printers', { method: 'POST', body: JSON.stringify({ name: f.name, brand: f.brand || undefined, model: f.model || undefined, build_volume_mm: f.build_volume_mm || undefined, nozzle_mm: f.nozzle_mm ? Number(f.nozzle_mm) : undefined, has_ams: f.has_ams, power_watts: f.power_watts ? Number(f.power_watts) : undefined, acquisition_cost: Number(f.acquisition_cost) || 0, acquisition_date: f.acquisition_date || undefined, expected_lifetime_hours: f.expected_lifetime_hours ? Number(f.expected_lifetime_hours) : undefined, serial_number: f.serial_number || undefined }) })
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
        <Input label="Nº de série (p/ telemetria ao vivo)" value={f.serial_number} onChange={v => set('serial_number', v)} placeholder="01PXXXXXXXXXXXX" />
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
              {['Produto', 'R$/hora', 'Contrib./un', 'Tempo/un', 'Custo', 'Preço', 'Vendas 30d', 'Lucro 30d', 'Ação'].map((h, i) => <th key={h} className={`px-3 py-2 font-semibold ${i === 0 ? 'text-left' : 'text-right'} ${h === 'Ação' ? 'text-center' : ''}`}>{h}</th>)}
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
                    <td className="px-3 py-2 text-right" style={{ color: r.realized_profit_30d > 0 ? '#4ade80' : '#52525b' }}>{r.realized_profit_30d > 0 ? money(r.realized_profit_30d) : '—'}</td>
                    <td className="px-3 py-2 text-center"><span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: rec.bg, color: rec.color }}>{rec.label}</span></td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-xs" style={{ color: '#52525b' }}>Sem produtos com dados de tempo de impressão ainda.</td></tr>}
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
        <div className="flex items-center gap-2">
          <UploadButton label="Imagem de referência" accept="image/*" onUploaded={urls => setForm(f => ({ ...f, reference_url: urls[0] }))} />
          {form.reference_url && <span className="text-[10px]" style={{ color: '#4ade80' }}>✓ imagem enviada</span>}
        </div>
      </div>
      <div className="mt-4 flex justify-end"><button onClick={() => void create()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Criar</button></div>
    </Modal>
  )
}

const VERDICT_STYLE: Record<'green' | 'yellow' | 'red', { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  green:  { color: '#4ade80', bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.30)', icon: <CheckCircle2 size={13} /> },
  yellow: { color: '#fcd34d', bg: 'rgba(252,211,77,0.10)', border: 'rgba(252,211,77,0.30)', icon: <AlertTriangle size={13} /> },
  red:    { color: '#f87171', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)', icon: <Ban size={13} /> },
}

function ImportMakerworldModal({ onClose, onImported }: { onClose: () => void; onImported: (id: string) => void }) {
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<MwPreview | null>(null)
  const [busy, setBusy] = useState(false); const [importing, setImporting] = useState(false); const [err, setErr] = useState('')

  const fetchPreview = async () => {
    if (!url.trim()) { setErr('Cole o link do modelo MakerWorld.'); return }
    setBusy(true); setErr(''); setPreview(null)
    try { setPreview(await api<MwPreview>('/product-os/import/makerworld/preview', { method: 'POST', body: JSON.stringify({ url }) })) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao ler o MakerWorld') } finally { setBusy(false) }
  }
  const doImport = async () => {
    setImporting(true); setErr('')
    try { const r = await api<{ product_dev: { id: string } }>('/product-os/import/makerworld', { method: 'POST', body: JSON.stringify({ url }) }); onImported(r.product_dev.id) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao importar') } finally { setImporting(false) }
  }
  const fmtTime = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}min`
  const v = preview ? VERDICT_STYLE[preview.verdict.level] : null

  return (
    <Modal title="Importar do MakerWorld" onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <p className="mb-3 text-xs" style={{ color: '#a1a1aa' }}>Cole o link do modelo (ex: <span style={{ color: '#a5f3fc' }}>makerworld.com/en/models/1234567</span>) ou só o ID. Lemos peso, tempo, material, capa e a licença.</p>
      <div className="flex items-end gap-2">
        <div className="flex-1"><Input label="Link ou ID do MakerWorld" value={url} onChange={setUrl} placeholder="https://makerworld.com/en/models/…" /></div>
        <button onClick={() => void fetchPreview()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: '#111114', border: '1px solid #27272a', color: '#a5f3fc' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Buscar</button>
      </div>

      {preview && v && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-3 rounded-xl p-3" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: '#111114', border: '1px solid #27272a' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview.cover_url ? <img src={preview.cover_url} alt="" className="h-full w-full object-cover" /> : <Package size={20} style={{ color: '#3f3f46' }} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight text-white">{preview.title}</p>
              <p className="mt-0.5 text-[11px]" style={{ color: '#71717a' }}>{preview.creator ?? 'criador desconhecido'}{preview.is_remix && ' · remix'}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]" style={{ color: '#a1a1aa' }}>
                {preview.weight_g != null && <span className="rounded px-1.5 py-0.5" style={{ background: '#111114', border: '1px solid #27272a' }}>⚖ {preview.weight_g} g</span>}
                {preview.print_time_minutes != null && <span className="rounded px-1.5 py-0.5" style={{ background: '#111114', border: '1px solid #27272a' }}>⏱ {fmtTime(preview.print_time_minutes)}</span>}
                {preview.material_count != null && <span className="rounded px-1.5 py-0.5" style={{ background: '#111114', border: '1px solid #27272a' }}>{preview.need_ams ? '🎨 multicor (AMS)' : '1 material'}</span>}
                <span className="rounded px-1.5 py-0.5" style={{ background: '#111114', border: '1px solid #27272a' }}>⬇ {preview.download_count} · 🖨 {preview.print_count}</span>
              </div>
            </div>
          </div>

          {/* selo de licença — só informa, não bloqueia (bloqueio é a Peça 2) */}
          <div className="rounded-xl p-3" style={{ background: v.bg, border: `1px solid ${v.border}` }}>
            <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: v.color }}>{v.icon} {preview.verdict.label}{preview.license && <span className="ml-1 font-mono text-[10px] font-normal opacity-80">({preview.license})</span>}</div>
            <p className="mt-1 text-[11px] leading-snug" style={{ color: '#a1a1aa' }}>{preview.verdict.reason}</p>
          </div>

          {preview.already_imported_id && (
            <div className="rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(252,211,77,0.08)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.25)' }}>Este modelo já foi importado antes. Importar de novo cria um produto duplicado.</div>
          )}

          <div className="flex items-center justify-between">
            <a href={preview.source_url} target="_blank" rel="noopener noreferrer" className="text-[11px] underline" style={{ color: '#71717a' }}>Ver no MakerWorld ↗</a>
            <button onClick={() => void doImport()} disabled={importing} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{importing ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />} Importar como produto</button>
          </div>
        </div>
      )}
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
