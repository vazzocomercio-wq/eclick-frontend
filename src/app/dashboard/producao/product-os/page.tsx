'use client'

import { useEffect, useState, useCallback, useRef, useMemo, type CSSProperties } from 'react'
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
  Printer as PrinterIcon, TrendingUp, Gauge, Wifi, Upload, Trophy, Trash2, ExternalLink, Users, Flame, Heart, Download, Search, Layers, Eye, EyeOff, ShieldAlert, Barcode, Palette, Copy, Star,
} from 'lucide-react'
import { usePrompt } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── tipos ────────────────────────────────────────────────────────────
type Status = 'ideia' | 'briefing' | 'modelagem' | 'prototipo' | 'aprovado' | 'publicado' | 'monitorando' | 'arquivado'
interface ReferenceImage { url: string; source_url?: string | null; notes?: string | null }
interface ProductDev {
  id: string; name: string; code?: string | null; category: string | null; description: string | null; status: Status
  production_profile: 'impressao_3d' | 'marca_propria' | 'generico'
  reference_images: ReferenceImage[]; inspiration_url: string | null
  briefing: Record<string, unknown> | null; briefing_text: string | null
  target_marketplaces: string[]; target_price: number | null; estimated_cost: number | null
  product_id: string | null; active_deal_id: string | null; position: number; created_at: string
  source_platform?: string | null; license_status?: LicenseStatus
  mto_enabled?: boolean; mto_mode?: 'suggest' | 'auto'; mto_reorder_point?: number; mto_batch_qty?: number
  sku_linha_id?: string | null; sku_base?: string | null
  catalog_title?: string | null; catalog_description?: string | null; catalog_brand?: string | null
  catalog_bullets?: string[]; catalog_attributes?: Record<string, string>; catalog_tags?: string[]
  catalog_ready?: boolean; enrichment?: Record<string, unknown> | null
  category_ml_id?: string | null; category_ml_path?: Array<{ id: string; name: string }> | null
}
interface Filament { index: number; material: string | null; color: string | null; weight_g: number }
interface Version {
  id: string; version_number: number; changelog: string | null; file_url: string | null; file_type: string | null
  material: string | null; weight_g: number | null; print_time_minutes: number | null; volume_cm3: number | null
  prototype_photo_urls: string[]; status: string; approved: boolean; notes: string | null; created_at: string
  filaments?: Filament[] | null
}
interface DevDetail extends ProductDev { versions: Version[] }
interface Part {
  id: string; product_dev_id: string; name: string; code?: string | null; qty_per_product: number; is_optional: boolean
  stock_qty: number; reserved_qty: number; available: number; sort_order: number; notes: string | null
  width_mm: number | null; depth_mm: number | null; height_mm: number | null
}
interface ProdUnit { id: string; serial: string; seq: number; status: string }
interface PartSuggestion { name: string; qty_per_product: number; is_optional: boolean; width_mm: number | null; depth_mm: number | null; height_mm: number | null; rationale: string }
interface PlatePlan {
  quantity: number; bed: { name: string; x: number; y: number; z: number }; gap_mm: number; total_plates: number; missing_dims: string[]; note: string
  lines: Array<{ part_id: string; name: string; qty_per_product: number; needed: number; width_mm: number | null; depth_mm: number | null; height_mm: number | null; per_plate: number | null; plates: number | null; fit_note: string | null; plate_minutes: number | null; has_dims: boolean }>
}
interface AssemblyOrder { id: string; product_dev_id: string; order_number: number; quantity: number; status: string; created_at: string; completed_at: string | null }
interface AssemblyPreview {
  quantity: number
  parts: Array<{ part_id: string; name: string; needed: number; available: number; unit: string; is_optional: boolean; sufficient: boolean; missing: number }>
  insumos: Array<{ input_id: string; name: string; needed: number; available: number; unit: string; sufficient: boolean; missing: number }>
  all_sufficient: boolean
  missing_parts: Array<{ part_id: string; name: string; missing: number }>
}
interface PartCost {
  cost: { total: number; parts_total: number; insumos_total: number; packaging: number }
  parts: Array<{ part_id: string; name: string; qty_per_product: number; weight_g: number | null; print_minutes: number | null; unit_cost: number; line_cost: number; has_version: boolean }>
  insumos: Array<{ kind: string; description: string | null; quantity: number; unit_cost: number; line_cost: number }>
  missing_versions: string[]
  target_margin_pct: number; suggested_prices: Array<{ channel: string; fee_pct: number; price: number; margin_pct: number }>
}
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
  printer_id: string | null; is_prototype: boolean; estimated_time_minutes: number | null; estimated_filament_g: number | null; actual_filament_g?: number | null; part_id?: string | null; due_at?: string | null; created_at: string
  jobs?: Job[]
}
interface Job { id: string; job_number: number; status: string; filament_used_g: number | null; print_time_minutes: number | null; failure_reason: string | null }
interface Input {
  id: string; kind: string; sku: string | null; barcode: string | null; name: string; description: string | null
  material: string | null; color: string | null; color_hex: string | null; brand: string | null; supplier: string | null
  diameter_mm: number | null; spool_weight_g: number | null; unit: string
  quantity: number; reserved_quantity: number; reorder_threshold: number; cost_per_unit: number; available: number; alert: boolean
}
interface InputMovement { id: string; movement_type: string; quantity: number; unit_cost: number | null; balance_after: number | null; notes: string | null; created_at: string }
interface BomLine { id?: string; kind: string; description: string | null; quantity: number; unit: string; unit_cost: number; waste_pct: number }
interface Quality { id: string; checklist: Array<{ key: string; label: string; ok: boolean }>; approved: boolean; notes: string | null }
interface DevEvent { id: string; event_type: string; payload: Record<string, unknown>; is_auto: boolean; created_at: string }
interface LicenseVerdict { level: 'green' | 'yellow' | 'red'; can_remodel: boolean; can_commercial: boolean; label: string; reason: string }
interface LicenseStatus {
  imported: boolean; platform: string | null; source_url: string | null; license: string | null
  verdict: LicenseVerdict | null; cleared: boolean; cleared_note: string | null; cleared_at: string | null
  blocked: boolean; can_publish: boolean
}
interface RadarItem {
  id: string; platform: string; external_id: string; title: string | null; cover_url: string | null; creator: string | null; source_url: string | null
  license: string | null; verdict: LicenseVerdict
  last_download_count: number; last_print_count: number; last_like_count: number; last_collection_count: number
  downloads_per_week: number | null; prints_per_week: number | null; champion_score: number | null
  velocity_status: 'coletando' | 'ok'; days_tracked: number; snapshots_count: number
  decision: 'observar' | 'comprar' | 'ignorar'
  ai_suggestion: { decision?: string; confidence?: number; rationale?: string } | null
  notes: string | null; first_seen_at: string; last_checked_at: string | null
}
interface ExtModel {
  platform: string; source_url: string; external_id: string; title: string; license: string | null
  cover_url: string | null; creator: string | null; download_count: number; like_count: number
  price: number | null; verdict: LicenseVerdict
}
interface SourceInfo { platform: string; label: string; configured: boolean; can_creator: boolean; can_discover: boolean; can_categories: boolean }
interface TrackedCreator { id: string; platform: string; handle: string; display_name: string | null; last_model_count: number | null }
interface MwPreview {
  platform: string; source_url: string; external_id: string; title: string; license: string | null; license_title: string | null
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
  material?: { filament_g_total: number; filament_g_30d: number; cost_total: number; cost_30d: number }
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
  camera_url?: string | null; camera_at?: string | null; light_on?: boolean | null
  ai_detection_enabled?: boolean; ai_sensitivity?: string; auto_dispatch?: boolean
  open_failure?: { id: string; reason: string | null; detected_at: string } | null
}
interface FarmAgent { id: string; name: string; status: string; version: string | null; last_seen_at: string | null; online: boolean }
interface SchedulePlan {
  now: string; eligible_printers: number; offline_printers: number; queued_orders: number
  scheduled: number; unscheduled_count: number; late_count: number; all_done_at: string | null
  assignments: Array<{ order_id: string; order_number: number; product_dev_id: string; name: string; quantity: number; printer_id: string; printer_name: string; profit_per_hour: number | null; fit: 'exact' | 'material' | 'unknown' | 'none'; duration_minutes: number | null; needs_time: boolean; start_at: string; finish_at: string | null; due_at: string | null; late: boolean }>
  unscheduled: Array<{ order_id: string; order_number: number; name: string; quantity: number; reason: string }>
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
  { key: 'qualidade', label: 'Qualidade' }, { key: 'pronta', label: 'Peça pronta' }, { key: 'montagem', label: 'Montagem' },
  { key: 'embalado', label: 'Embalado' }, { key: 'disponivel', label: 'Disponível' },
]
// produto inteiro (1 peça): qualidade → embalado → disponível
const ORDER_NEXT: Record<string, string[]> = {
  fila: ['imprimindo', 'cancelado'], imprimindo: ['pausado', 'falhou', 'acabamento', 'cancelado'], pausado: ['imprimindo', 'cancelado'],
  falhou: ['reimpressao', 'cancelado'], reimpressao: ['imprimindo', 'cancelado'], acabamento: ['qualidade'], qualidade: ['embalado', 'falhou'],
  embalado: ['disponivel'], disponivel: [], cancelado: [],
}
// OP de PEÇA: qualidade → pronta (vira estoque de peça; não embala)
const PART_ORDER_NEXT: Record<string, string[]> = {
  fila: ['imprimindo', 'cancelado'], imprimindo: ['pausado', 'falhou', 'acabamento', 'cancelado'], pausado: ['imprimindo', 'cancelado'],
  falhou: ['reimpressao', 'cancelado'], reimpressao: ['imprimindo', 'cancelado'], acabamento: ['qualidade'], qualidade: ['pronta', 'falhou'],
  pronta: [], cancelado: [],
}
// montagem: montando → embalado → disponível
const ASSEMBLY_NEXT: Record<string, string[]> = {
  fila: ['montando', 'cancelado'], montando: ['embalado', 'cancelado'], embalado: ['disponivel'], disponivel: [], concluido: [], cancelado: [],
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

// limite de upload = teto global do projeto Supabase (bucket product-os)
const MAX_UPLOAD_MB = 200
function friendlyUploadError(e: unknown): string {
  const m = e instanceof Error ? e.message : 'erro'
  if (/maximum allowed size|payload too large|exceeded|413/i.test(m)) return `Arquivo grande demais (limite ${MAX_UPLOAD_MB} MB). Comprima o modelo (reduza a malha/decimate) ou exporte em menor resolução.`
  return 'Falha no upload: ' + m
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

/** Se o arquivo subido for um .3mf fatiado (Bambu), lê peso/tempo/material de
 *  dentro dele. STL não tem esses dados. Devolve só os campos achados. */
async function fetch3mfMetrics(url: string, filename: string): Promise<{ material?: string; weight_g?: string; print_time_minutes?: string; width_mm?: number; depth_mm?: number; height_mm?: number; filaments?: Filament[] } | null> {
  if (!/\.3mf$/i.test(filename)) return null
  try {
    const r = await api<{ weight_g: number | null; print_time_minutes: number | null; material: string | null; width_mm: number | null; depth_mm: number | null; height_mm: number | null; filaments: Filament[]; found: boolean }>('/product-os/parse-3mf', { method: 'POST', body: JSON.stringify({ url }) })
    if (!r.found) return null
    return {
      material: r.material ?? undefined,
      weight_g: r.weight_g != null ? String(r.weight_g) : undefined,
      print_time_minutes: r.print_time_minutes != null ? String(r.print_time_minutes) : undefined,
      width_mm: r.width_mm ?? undefined, depth_mm: r.depth_mm ?? undefined, height_mm: r.height_mm ?? undefined,
      filaments: Array.isArray(r.filaments) ? r.filaments : undefined,
    }
  } catch { return null }
}

/** Faixa rolável na horizontal SEM barra de rolagem visível: arrasta com o
 *  mouse (clica e puxa) e a roda do mouse rola lateral. Clicar em botão/link
 *  dentro não inicia o arraste. */
function HScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({ down: false, startX: 0, scroll: 0 })
  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current; if (!el) return
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select, [data-card]')) return  // clique/arraste-de-card passam; rola só no vazio
    drag.current = { down: true, startX: e.clientX, scroll: el.scrollLeft }
    el.style.cursor = 'grabbing'; try { el.setPointerCapture(e.pointerId) } catch { /* */ }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || !drag.current.down) return
    el.scrollLeft = drag.current.scroll - (e.clientX - drag.current.startX)
  }
  const end = (e: React.PointerEvent) => { const el = ref.current; if (!el) return; drag.current.down = false; el.style.cursor = 'grab'; try { el.releasePointerCapture(e.pointerId) } catch { /* */ } }
  const onWheel = (e: React.WheelEvent) => { const el = ref.current; if (!el || el.scrollWidth <= el.clientWidth) return; if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY }
  return (
    <>
      <style>{`.os-hscroll::-webkit-scrollbar{display:none}`}</style>
      <div ref={ref} className={`os-hscroll ${className ?? ''}`} style={{ cursor: 'grab', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-y', userSelect: 'none' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={end} onPointerLeave={end} onWheel={onWheel}>
        {children}
      </div>
    </>
  )
}

/** Wrapper que torna o card arrastável (move entre colunas). `data-card` faz o
 *  HScroll ignorar o arraste do card (rola só no vazio). Ghost via DragOverlay. */
function DragWrap({ id, data, children }: { id: string; data: Record<string, unknown>; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} data-card="1" style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab' }}>
      {children}
    </div>
  )
}

/** Campo compacto pra pesar a peça na balança e gravar o peso REAL do
 *  filamento (sobrepõe o estimado no custo quando a OP fecha). */
function DueDateInput({ oid, due, onSaved }: { oid: string; due: string | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const toLocal = (iso: string | null) => { if (!iso) return ''; try { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) } catch { return '' } }
  const [val, setVal] = useState(toLocal(due))
  const [busy, setBusy] = useState(false)
  const save = async (clear?: boolean) => {
    setBusy(true)
    try { await api(`/product-os/production-orders/${oid}`, { method: 'PATCH', body: JSON.stringify({ due_at: clear || !val ? null : new Date(val).toISOString() }) }); setEditing(false); onSaved() }
    catch { /* */ } finally { setBusy(false) }
  }
  if (!editing) return (
    <button onClick={() => setEditing(true)} className="mt-1 flex w-full items-center justify-center gap-1 rounded px-1.5 py-1 text-[9px] font-semibold" style={{ background: '#0a0a0e', color: due ? '#a5f3fc' : '#71717a', border: '1px solid #27272a' }}>
      ⏰ {due ? `prazo ${new Date(due).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : 'definir prazo'}
    </button>
  )
  return (
    <div className="mt-1 flex items-center gap-1">
      <input autoFocus type="datetime-local" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full rounded px-1.5 py-1 text-[10px] text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
      <button onClick={() => void save()} disabled={busy} className="rounded px-1.5 py-1 text-[9px] font-bold" style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>{busy ? '…' : 'ok'}</button>
      {due && <button onClick={() => void save(true)} disabled={busy} className="rounded px-1.5 py-1 text-[9px]" style={{ background: '#0a0a0e', color: '#71717a', border: '1px solid #27272a' }}>×</button>}
    </div>
  )
}
function RealWeightInput({ oid, actual, estimated, onSaved }: { oid: string; actual: number | null; estimated: number | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(actual != null ? String(actual) : '')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try { await api(`/product-os/production-orders/${oid}`, { method: 'PATCH', body: JSON.stringify({ actual_filament_g: val.trim() ? Number(val.replace(',', '.')) : null }) }); setEditing(false); onSaved() }
    catch { /* */ } finally { setBusy(false) }
  }
  if (!editing) return (
    <button onClick={() => setEditing(true)} className="mt-1 flex w-full items-center justify-center gap-1 rounded px-1.5 py-1 text-[9px] font-semibold" style={{ background: '#0a0a0e', color: actual != null ? '#4ade80' : '#71717a', border: '1px solid #27272a' }}>
      ⚖️ {actual != null ? `${actual} g real` : 'pesar peça'}
    </button>
  )
  return (
    <div className="mt-1 flex items-center gap-1">
      <input autoFocus type="text" inputMode="decimal" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false) }}
        placeholder={estimated != null ? `est. ${estimated}` : 'gramas'} className="w-full rounded px-1.5 py-1 text-[10px] text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
      <button onClick={() => void save()} disabled={busy} className="rounded px-1.5 py-1 text-[9px] font-bold" style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>{busy ? '…' : 'ok'}</button>
    </div>
  )
}

/** Mostra os seriais (unidades) de uma OP — cada peça física identificada. */
function UnitsViewer({ oid, qty }: { oid: string; qty: number }) {
  const [open, setOpen] = useState(false); const [units, setUnits] = useState<ProdUnit[] | null>(null)
  const toggle = async () => {
    const next = !open; setOpen(next)
    if (next && units === null) { try { setUnits(await api<ProdUnit[]>(`/product-os/production-orders/${oid}/units`)) } catch { setUnits([]) } }
  }
  const STU: Record<string, string> = { planejada: '#71717a', produzida: '#4ade80', descartada: '#f87171' }
  return (
    <div className="mt-1">
      <button onClick={() => void toggle()} className="flex w-full items-center justify-center gap-1 rounded px-1.5 py-1 text-[9px] font-semibold" style={{ background: '#0a0a0e', color: '#a1a1aa', border: '1px solid #27272a' }}>
        🔖 {qty > 1 ? `${qty} seriais` : 'serial'} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {units === null ? <p className="text-[9px]" style={{ color: '#52525b' }}>carregando…</p>
            : units.length === 0 ? <p className="text-[9px]" style={{ color: '#52525b' }}>sem seriais</p>
            : units.map(u => (
              <div key={u.id} className="flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: STU[u.status] ?? '#71717a' }} />
                <span style={{ color: '#d4d4d8' }}>{u.serial}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function UploadButton({ label, accept, multiple, onUploaded }: { label: string; accept?: string; multiple?: boolean; onUploaded: (urls: string[], files: File[]) => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const ref = useRef<HTMLInputElement>(null)
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); if (!files.length) return
    setErr('')
    const big = files.find(f => f.size > MAX_UPLOAD_MB * 1048576)
    if (big) { setErr(`"${big.name}" tem ${(big.size / 1048576).toFixed(0)} MB e passa do limite de ${MAX_UPLOAD_MB} MB. Comprima o modelo (reduza a malha) ou exporte em menor resolução.`); if (ref.current) ref.current.value = ''; return }
    setBusy(true)
    try { const urls: string[] = []; for (const f of files) urls.push(await uploadFile(f)); onUploaded(urls, files) }
    catch (e2) { setErr(friendlyUploadError(e2)) }
    finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }
  return (
    <div className="inline-flex flex-col gap-1.5">
      <input ref={ref} type="file" accept={accept} multiple={multiple} onChange={e => void handle(e)} style={{ display: 'none' }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ background: '#111114', border: '1px solid #27272a', color: '#a5f3fc' }}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {label}
      </button>
      {err && <div className="rounded-lg p-2 text-[11px] leading-snug" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
export default function ProductOsPage() {
  const [tab, setTab] = useState<'fabrica' | 'monitor' | 'ciclo' | 'producao' | 'impressoras' | 'rentabilidade' | 'radar' | 'insumos' | 'paletas'>('fabrica')
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
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#111114', border: '1px solid #27272a', color: '#a5f3fc' }}><Boxes size={12} /> Importar modelo 3D</button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Plus size={12} /> Novo produto</button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ background: '#111114', border: '1px solid #1a1a1f', width: 'fit-content' }}>
        {([['fabrica', 'Fábrica', <Gauge key="f" size={13} />], ['ciclo', 'Ciclo de vida', <Lightbulb key="a" size={13} />], ['producao', 'Produção', <Factory key="b" size={13} />], ['monitor', 'Ao vivo', <Wifi key="m" size={13} />], ['impressoras', 'Impressoras', <PrinterIcon key="d" size={13} />], ['rentabilidade', 'Rentabilidade', <TrendingUp key="e" size={13} />], ['radar', 'Radar', <Trophy key="r" size={13} />], ['insumos', 'Insumos', <Boxes key="c" size={13} />], ['paletas', 'Paletas', <Palette key="pl" size={13} />]] as const).map(([k, lbl, ic]) => (
          <button key={k} onClick={() => setTab(k)} className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold" style={{ background: tab === k ? 'rgba(0,229,255,0.12)' : 'transparent', color: tab === k ? '#00E5FF' : '#71717a' }}>{ic}{lbl}</button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}><AlertTriangle size={14} className="shrink-0" /> <span className="whitespace-pre-line">{error}</span></div>}

      {tab === 'fabrica' && <FactoryPanel onGoTo={setTab} onOpen={setOpenId} />}
      {tab === 'monitor' && <LiveMonitorPanel />}
      {tab === 'ciclo' && <LifecycleBoard items={items} loading={loading} onOpen={setOpenId} onChanged={load} setError={setError} />}
      {tab === 'producao' && <ProductionBoard products={items} />}
      {tab === 'impressoras' && <PrintersPanel />}
      {tab === 'rentabilidade' && <ProfitabilityPanel onOpen={setOpenId} />}
      {tab === 'radar' && <RadarPanel onImported={id => { void load(); setTab('ciclo'); setOpenId(id) }} />}
      {tab === 'insumos' && <InsumosPanel />}
      {tab === 'paletas' && <PalettesPanel />}

      {openId && <DetailDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
      {showNew && <NewProductModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); void load() }} />}
      {showImport && <ImportMakerworldModal onClose={() => setShowImport(false)} onImported={id => { setShowImport(false); void load(); setTab('ciclo'); setOpenId(id) }} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <ConfirmHost />
    </div>
  )
}

// ── BOARD: ciclo de vida ──────────────────────────────────────────────
function LifecycleBoard({ items, loading, onOpen, onChanged, setError }: { items: ProductDev[]; loading: boolean; onOpen: (id: string) => void; onChanged: () => Promise<void>; setError: (s: string) => void }) {
  const [list, setList] = useState(items)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [imageFor, setImageFor] = useState<ProductDev | null>(null)
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
      <HScroll className="flex gap-3 pb-4">
        {COLUMNS.map(col => <Column key={col.key} id={col.key} label={col.label} count={list.filter(d => d.status === col.key).length}>
          {list.filter(d => d.status === col.key).map(d => <DraggableCard key={d.id} id={d.id} onOpen={() => onOpen(d.id)}><DevCard dev={d} onGenImage={() => setImageFor(d)} /></DraggableCard>)}
        </Column>)}
      </HScroll>
      <DragOverlay>{active ? <DevCard dev={active} dragging /> : null}</DragOverlay>
      {imageFor && <GenerateImageModal dev={imageFor} onClose={() => setImageFor(null)} onSaved={() => { setImageFor(null); void onChanged() }} />}
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
  return <div ref={setNodeRef} {...attributes} {...listeners} data-card="1" onClick={onOpen} style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab' }}>{children}</div>
}
function DevCard({ dev, dragging, onGenImage }: { dev: ProductDev; dragging?: boolean; onGenImage?: () => void }) {
  const cover = dev.reference_images?.[0]?.url
  return (
    <div className="rounded-lg p-2.5" style={{ background: '#111114', border: `1px solid ${dragging ? 'rgba(0,229,255,0.5)' : '#27272a'}`, boxShadow: dragging ? '0 8px 24px rgba(0,229,255,0.15)' : undefined }}>
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <Package size={14} style={{ color: '#3f3f46' }} />}
        </div>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{dev.name}</p><p className="truncate text-[10px]" style={{ color: '#71717a' }}>{dev.category ?? 'sem categoria'}</p></div>
        {onGenImage && <button onClick={e => { e.stopPropagation(); onGenImage() }} onPointerDown={e => e.stopPropagation()} title="Gerar imagem com IA" className="shrink-0 rounded-md p-1" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#c084fc' }}><Palette size={12} /></button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {dev.license_status?.imported && <LicenseBadge st={dev.license_status} compact />}
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
  const [assemblies, setAssemblies] = useState<AssemblyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showNewAsm, setShowNewAsm] = useState(false)
  const nameOf = (devId: string) => products.find(p => p.id === devId)?.name ?? '—'

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true)
    setErr('')
    try {
      const [o, a] = await Promise.all([
        api<Order[]>('/product-os/production-orders'),
        api<AssemblyOrder[]>('/product-os/assemblies').catch(() => [] as AssemblyOrder[]),
      ])
      setOrders(o); setAssemblies(a)
    }
    catch (e) { if (!silent) setErr(e instanceof Error ? e.message : 'Erro') } finally { if (!silent) setLoading(false) }
  }, [])
  // primeiro load + refresh silencioso a cada 5s → cards mudam sozinhos quando a impressora avança o estado
  useEffect(() => { void load(); const it = setInterval(() => void load(true), 5000); return () => clearInterval(it) }, [load])

  const [notice, setNotice] = useState('')
  const transition = async (oid: string, status: string) => {
    if (status === 'cancelado' && !(await confirmDialog({ title: 'Cancelar ordem', message: 'Cancelar esta OP? Libera o filamento reservado. Não dá pra desfazer.', danger: true, confirmLabel: 'Cancelar OP' }))) return
    try { await api(`/product-os/production-orders/${oid}/transition`, { method: 'POST', body: JSON.stringify({ status }) }); void load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }
  const transitionAsm = async (aid: string, status: string) => {
    try { await api(`/product-os/assemblies/${aid}/transition`, { method: 'POST', body: JSON.stringify({ status }) }); void load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }
  // em qual coluna a montagem aparece: fila/montando → Montagem; embalado/disponível na sua; concluído(legado)→Disponível
  const asmCol = (a: AssemblyOrder) => (a.status === 'fila' || a.status === 'montando') ? 'montagem' : (a.status === 'concluido' ? 'disponivel' : a.status)

  // arrastar cards entre colunas (respeita as transições válidas; senão ignora)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeDrag, setActiveDrag] = useState<{ code: string; name: string; color: string } | null>(null)
  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { code?: string; name?: string; kind?: string } | undefined
    if (d) setActiveDrag({ code: d.code ?? '', name: d.name ?? '', color: d.kind === 'asm' ? '#c4b5fd' : '#00E5FF' })
  }
  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null)
    const over = e.over?.id ? String(e.over.id) : null
    const d = e.active.data.current as { kind?: string; id?: string; status?: string; partId?: boolean } | undefined
    if (!over || !d?.id || !d.status) return
    if (d.kind === 'op') {
      const nexts = (d.partId ? PART_ORDER_NEXT : ORDER_NEXT)[d.status] ?? []
      if (nexts.includes(over)) void transition(d.id, over)
    } else {
      const map: Record<string, string> = { montagem: 'montando', embalado: 'embalado', disponivel: 'disponivel' }
      const ts = map[over]; const nexts = ASSEMBLY_NEXT[d.status] ?? []
      if (ts && nexts.includes(ts)) void transitionAsm(d.id, ts)
    }
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
        <p className="text-xs" style={{ color: '#a1a1aa' }}>Ordens de produção, peças e montagem. Peças prontas viram estoque → montam o produto → embalado → disponível.</p>
        <button onClick={() => setShowNewAsm(true)} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.35)', color: '#c4b5fd' }}><Boxes size={12} /> Nova montagem</button>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Plus size={12} /> Nova ordem</button>
      </div>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {notice && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{notice}</div>}
      {loading ? <div className="flex items-center gap-2 p-6 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <HScroll className="flex gap-3 pb-4">
          {ORDER_COLS.map(col => {
            const cards = orders.filter(o => o.status === col.key)
            const asms = assemblies.filter(a => asmCol(a) === col.key)
            return (
              <Column key={col.key} id={col.key} label={col.label} count={cards.length + asms.length}>
                  {cards.map(o => (
                    <DragWrap key={o.id} id={o.id} data={{ kind: 'op', id: o.id, status: o.status, partId: !!o.part_id, code: `OP-${String(o.order_number).padStart(4, '0')}`, name: nameOf(o.product_dev_id) }}>
                    <div className="rounded-lg p-2.5" style={{ background: '#111114', border: '1px solid #27272a' }}>
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 rounded px-1 py-0.5 font-mono text-[9px] font-bold" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>OP-{String(o.order_number).padStart(4, '0')}</span>
                        <p className="truncate text-xs font-bold text-white">{nameOf(o.product_dev_id)}</p>
                        {o.part_id && <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(0,229,255,0.12)', color: '#67e8f9' }}>🧩 peça</span>}
                        {o.is_prototype && <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd' }}>protótipo</span>}
                      </div>
                      <p className="text-[10px]" style={{ color: '#71717a' }}>{o.quantity} un{o.estimated_filament_g ? ` · ${o.estimated_filament_g} g` : ''}{o.machine ? ` · ${o.machine}` : ''}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {((o.part_id ? PART_ORDER_NEXT : ORDER_NEXT)[o.status] ?? []).map(ns => (
                          <button key={ns} onClick={() => void transition(o.id, ns)} className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: ns === 'cancelado' || ns === 'falhou' ? '#0a0a0e' : 'rgba(0,229,255,0.10)', color: ns === 'cancelado' || ns === 'falhou' ? '#71717a' : '#a5f3fc', border: '1px solid #27272a' }}>{ns}</button>
                        ))}
                      </div>
                      {o.printer_id && !['disponivel', 'pronta', 'cancelado'].includes(o.status) && (
                        <button onClick={() => void sendToPrinter(o.id)} className="mt-1 flex w-full items-center justify-center gap-1 rounded px-1.5 py-1 text-[9px] font-bold" style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}><Send size={9} /> Enviar pra impressora</button>
                      )}
                      {['acabamento', 'qualidade', 'embalado'].includes(o.status) && (
                        <RealWeightInput oid={o.id} actual={o.actual_filament_g ?? null} estimated={o.estimated_filament_g} onSaved={() => void load(true)} />
                      )}
                      {o.status === 'fila' && <DueDateInput oid={o.id} due={o.due_at ?? null} onSaved={() => void load(true)} />}
                      {o.status !== 'cancelado' && <UnitsViewer oid={o.id} qty={o.quantity} />}
                    </div>
                    </DragWrap>
                  ))}
                  {asms.map(a => (
                    <DragWrap key={a.id} id={a.id} data={{ kind: 'asm', id: a.id, status: a.status, code: `MT-${String(a.order_number).padStart(4, '0')}`, name: nameOf(a.product_dev_id) }}>
                    <div className="rounded-lg p-2.5" style={{ background: '#111114', border: '1px solid rgba(168,85,247,0.3)' }}>
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 rounded px-1 py-0.5 font-mono text-[9px] font-bold" style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.3)' }}>MT-{String(a.order_number).padStart(4, '0')}</span>
                        <p className="truncate text-xs font-bold text-white">{nameOf(a.product_dev_id)}</p>
                        <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold" style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd' }}>🔧 montagem</span>
                      </div>
                      <p className="text-[10px]" style={{ color: '#71717a' }}>{a.quantity} un · junta as peças no produto</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(ASSEMBLY_NEXT[a.status] ?? []).map(ns => (
                          <button key={ns} onClick={() => void transitionAsm(a.id, ns)} className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: ns === 'cancelado' ? '#0a0a0e' : 'rgba(168,85,247,0.12)', color: ns === 'cancelado' ? '#71717a' : '#d8b4fe', border: '1px solid #27272a' }}>{ns}</button>
                        ))}
                      </div>
                    </div>
                    </DragWrap>
                  ))}
              </Column>
            )
          })}
        </HScroll>
        <DragOverlay>{activeDrag ? (
          <div className="rounded-lg p-2.5" style={{ background: '#111114', border: `1px solid ${activeDrag.color}`, boxShadow: `0 8px 24px ${activeDrag.color}33` }}>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 rounded px-1 py-0.5 font-mono text-[9px] font-bold" style={{ color: activeDrag.color, border: `1px solid ${activeDrag.color}55` }}>{activeDrag.code}</span>
              <span className="truncate text-xs font-bold text-white">{activeDrag.name}</span>
            </div>
          </div>
        ) : null}</DragOverlay>
        </DndContext>
      )}
      {showNew && <NewOrderModal approved={approved} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); void load() }} />}
      {showNewAsm && <NewAssemblyModal products={approved} onClose={() => setShowNewAsm(false)} onCreated={() => { setShowNewAsm(false); void load() }} />}
    </div>
  )
}

function NewAssemblyModal({ products, onClose, onCreated }: { products: ProductDev[]; onClose: () => void; onCreated: () => void }) {
  const [devId, setDevId] = useState(products[0]?.id ?? '')
  const [qty, setQty] = useState('1'); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [preview, setPreview] = useState<AssemblyPreview | null>(null); const [prevLoading, setPrevLoading] = useState(false)
  useEffect(() => {
    const n = Number(qty) || 0
    if (!devId || n < 1) { setPreview(null); return }
    let cancel = false; setPrevLoading(true); setErr('')
    const t = setTimeout(() => { void (async () => {
      try { const p = await api<AssemblyPreview>('/product-os/assemblies/preview', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, quantity: n }) }); if (!cancel) setPreview(p) }
      catch (e) { if (!cancel) { setPreview(null); setErr(e instanceof Error ? e.message : 'Erro') } }
      finally { if (!cancel) setPrevLoading(false) }
    })() }, 350)
    return () => { cancel = true; clearTimeout(t) }
  }, [devId, qty])
  const create = async () => {
    if (!devId) { setErr('Selecione um produto'); return }
    setBusy(true); setErr('')
    try { await api('/product-os/assemblies', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, quantity: Number(qty) || 1 }) }); onCreated() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); setBusy(false) }
  }
  return (
    <Modal title="Nova montagem" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs" style={{ color: '#a1a1aa' }}>Junta as <b style={{ color: '#d8b4fe' }}>peças prontas</b> no produto final. Reserva as peças e os insumos de montagem; ao embalar, consome tudo.</p>
        <label className="block text-xs" style={{ color: '#a1a1aa' }}>Produto
          <select value={devId} onChange={e => setDevId(e.target.value)} className="mt-1 w-full rounded-lg px-2 py-2 text-sm text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
          </select>
        </label>
        <Input label="Quantidade a montar" value={qty} onChange={setQty} />
        {prevLoading && <p className="text-[11px]" style={{ color: '#71717a' }}>Calculando o que precisa…</p>}
        {preview && (
          <div className="rounded-lg p-2.5 space-y-1" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Peças necessárias</p>
            {preview.parts.map(l => (
              <div key={l.part_id} className="flex items-center justify-between text-[11px]">
                <span style={{ color: '#d4d4d8' }}>{l.name}{l.is_optional ? ' (opcional)' : ''}</span>
                <span style={{ color: l.sufficient ? '#4ade80' : '#f87171' }}>{l.available}/{l.needed}{l.sufficient ? ' ✓' : ` (faltam ${l.missing})`}</span>
              </div>
            ))}
            {preview.insumos?.map(l => (
              <div key={l.input_id} className="flex items-center justify-between text-[11px]">
                <span style={{ color: '#d4d4d8' }}>{l.name}</span>
                <span style={{ color: l.sufficient ? '#4ade80' : '#f87171' }}>{l.available}/{l.needed} {l.unit}{l.sufficient ? ' ✓' : ` (faltam ${l.missing})`}</span>
              </div>
            ))}
            {!preview.all_sufficient && <p className="text-[10px]" style={{ color: '#fcd34d' }}>⚠️ Falta estoque — produza as peças que faltam (OP de peça) antes de montar.</p>}
          </div>
        )}
        {err && <div className="whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
        <button onClick={() => void create()} disabled={busy || (preview ? !preview.all_sufficient : false)} className="w-full rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50" style={{ background: 'rgba(168,85,247,0.15)', color: '#d8b4fe', border: '1px solid rgba(168,85,247,0.35)' }}>{busy ? 'Criando…' : 'Criar montagem'}</button>
      </div>
    </Modal>
  )
}

function NewOrderModal({ approved, onClose, onCreated }: { approved: ProductDev[]; onClose: () => void; onCreated: () => void }) {
  const [devId, setDevId] = useState(approved[0]?.id ?? '')
  const [qty, setQty] = useState('1'); const [printerId, setPrinterId] = useState(''); const [loadedInputId, setLoadedInputId] = useState('')
  const [printers, setPrinters] = useState<Printer[]>([])
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [preview, setPreview] = useState<ConsumePreview | null>(null); const [prevLoading, setPrevLoading] = useState(false)
  const [parts, setParts] = useState<Part[]>([])
  const [variants, setVariants] = useState<SkuData['variants']>([]); const [skuVariantId, setSkuVariantId] = useState('')
  useEffect(() => { void (async () => { try { setPrinters(await api<Printer[]>('/product-os/printers')) } catch { /* */ } })() }, [])
  useEffect(() => { setParts([]); if (!devId) return; void (async () => { try { setParts(await api<Part[]>(`/product-os/parts?product_dev_id=${devId}`)) } catch { /* */ } })() }, [devId])
  useEffect(() => { setVariants([]); setSkuVariantId(''); if (!devId) return; void (async () => { try { const s = await api<SkuData>(`/product-os/${devId}/sku`); setVariants(s.variants ?? []) } catch { /* */ } })() }, [devId])
  const hasParts = parts.length > 0
  useEffect(() => {
    const n = Number(qty) || 0
    if (!devId || n < 1 || hasParts) { setPreview(null); return }
    let cancel = false; setPrevLoading(true)
    const t = setTimeout(() => { void (async () => {
      try { const p = await api<ConsumePreview>('/product-os/production-orders/preview', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, quantity: n }) }); if (!cancel) setPreview(p) }
      catch { if (!cancel) setPreview(null) }
      finally { if (!cancel) setPrevLoading(false) }
    })() }, 350)
    return () => { cancel = true; clearTimeout(t) }
  }, [devId, qty, hasParts])
  const create = async () => {
    if (!devId) { setErr('Selecione um produto aprovado'); return }
    if (hasParts) { setErr('Este produto é feito de peças — imprima cada peça pela aba Peças (Imprimir esta peça).'); return }
    setBusy(true); setErr('')
    try { await api('/product-os/production-orders', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, quantity: Number(qty) || 1, printer_id: printerId || undefined, machine: printers.find(p => p.id === printerId)?.name || undefined, loaded_input_id: loadedInputId || undefined, sku_variant_id: skuVariantId || undefined }) }); onCreated() }
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
          {variants.length > 0 && (
            <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Cor a produzir (estoque por cor)</span>
              <select value={skuVariantId} onChange={e => setSkuVariantId(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
                <option value="">— produto inteiro (estoque geral) —</option>
                {variants.map(v => <option key={v.id} value={v.id}>{v.cor?.label ?? 'Cor'} · {v.sku}</option>)}
              </select>
            </label>
          )}
          {hasParts && (
            <div className="rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.25)' }}>
              🧩 Este produto é feito de <b>{parts.length} peça(s)</b> ({parts.map(p => p.name).join(', ')}). A ordem do produto inteiro <b>não se aplica</b> aqui — abra o produto, vá na aba <b>Peças</b> e use <b>“Imprimir esta peça”</b> em cada uma; depois <b>“Montar o produto”</b>.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input label="Quantidade" value={qty} onChange={setQty} />
            <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Impressora</span>
              <select value={printerId} onChange={e => setPrinterId(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
                <option value="">— sem impressora —</option>
                {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          {printerId && !hasParts && <SpoolPicker printerId={printerId} value={loadedInputId} onChange={setLoadedInputId} />}
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
          <div className="flex justify-end"><button onClick={() => void create()} disabled={busy || hasParts} title={hasParts ? 'Produto feito de peças — imprima pela aba Peças' : ''} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Factory size={12} />} Criar ordem</button></div>
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
  const [showNew, setShowNew] = useState(false); const [showNf, setShowNf] = useState(false); const [restockItem, setRestockItem] = useState<Input | null>(null); const [openInsumo, setOpenInsumo] = useState<Input | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null); const [confirmDel, setConfirmDel] = useState<Input | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setList(await api<Input[]>('/product-os/production-inputs')) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const delInput = async (i: Input) => {
    setBusyId(i.id); setErr('')
    try { await api(`/product-os/production-inputs/${i.id}/delete`, { method: 'POST' }); setConfirmDel(null); await load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); setConfirmDel(null) } finally { setBusyId(null) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs" style={{ color: '#a1a1aa' }}>Estoque de filamento, embalagem e etiquetas. A produção reserva e baixa automaticamente.</p>
        <button onClick={() => setShowNf(true)} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: '#111114', border: '1px solid #27272a', color: '#a5f3fc' }}><FileBox size={12} /> Importar NF (XML)</button>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Plus size={12} /> Novo insumo</button>
      </div>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {loading ? <div className="flex items-center gap-2 p-6 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>
        : list.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Nenhum insumo cadastrado.</p> : (
        <div className="overflow-hidden rounded-xl" style={{ border: '1px solid #1a1a1f' }}>
          {list.map((i, idx) => (
            <div key={i.id} onClick={() => setOpenInsumo(i)} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/5" style={{ background: '#111114', borderTop: idx ? '1px solid #1a1a1f' : undefined }}>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: i.color_hex ? (i.color_hex.startsWith('#') ? i.color_hex : `#${i.color_hex}`) : '#27272a', border: '1px solid #27272a' }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-bold text-white">{i.name}</span>
                  {i.alert && <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'rgba(252,211,77,0.12)', color: '#fcd34d' }}>repor</span>}
                </div>
                <p className="truncate text-[10px]" style={{ color: '#71717a' }}>{[i.sku, i.kind, i.material, i.brand, i.color].filter(Boolean).join(' · ')}{i.diameter_mm ? ` · ${i.diameter_mm}mm` : ''}</p>
              </div>
              <div className="hidden shrink-0 text-right sm:block" style={{ width: 110 }}>
                <p className="text-sm font-extrabold leading-tight text-cyan-400">{i.available} <span className="text-[10px] font-normal" style={{ color: '#52525b' }}>{i.unit}</span></p>
                <p className="text-[9px]" style={{ color: '#52525b' }}>disp. ({i.quantity}−{i.reserved_quantity})</p>
              </div>
              <div className="hidden shrink-0 text-right md:block" style={{ width: 120 }}>
                <p className="text-[11px] font-semibold" style={{ color: '#a5f3fc' }}>R$ {Number(i.cost_per_unit).toFixed(Number(i.cost_per_unit) < 1 ? 4 : 2)}</p>
                <p className="text-[9px]" style={{ color: '#52525b' }}>custo médio/{i.unit}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={e => { e.stopPropagation(); setRestockItem(i) }} title="Repor estoque" className="rounded px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(0,229,255,0.10)', color: '#a5f3fc', border: '1px solid #27272a' }}>+ repor</button>
                <button onClick={e => { e.stopPropagation(); setConfirmDel(i) }} disabled={busyId === i.id} title="Excluir insumo" className="rounded p-1 disabled:opacity-50" style={{ background: '#0a0a0e', color: '#f87171', border: '1px solid #27272a' }}>{busyId === i.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirmDel && <ConfirmModal title="Excluir insumo" danger busy={busyId === confirmDel.id} confirmLabel="Excluir" onClose={() => setConfirmDel(null)} onConfirm={() => void delInput(confirmDel)} message={<>Excluir o insumo <b style={{ color: '#fafafa' }}>{confirmDel.name}</b>? Apaga também o histórico de movimentações e <b>não dá pra desfazer</b>.</>} />}
      {showNew && <NewInputModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); void load() }} />}
      {showNf && <ImportNfModal onClose={() => setShowNf(false)} onImported={() => { setShowNf(false); void load() }} />}
      {restockItem && <RestockModal item={restockItem} onClose={() => setRestockItem(null)} onDone={() => { setRestockItem(null); void load() }} />}
      {openInsumo && <InsumoDetailDrawer item={openInsumo} onClose={() => setOpenInsumo(null)} onChanged={() => { setOpenInsumo(null); void load() }} />}
    </div>
  )
}

function InsumoDetailDrawer({ item, onClose, onChanged }: { item: Input; onClose: () => void; onChanged: () => void }) {
  const [f, setF] = useState({
    sku: item.sku ?? '', barcode: item.barcode ?? '', name: item.name, description: item.description ?? '', material: item.material ?? '',
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
        sku: f.sku || null, barcode: f.barcode || null, name: f.name, description: f.description || null, material: f.material || null,
        color: f.color || null, color_hex: f.color_hex || null, brand: f.brand || null, supplier: f.supplier || null,
        diameter_mm: f.diameter_mm ? Number(f.diameter_mm) : null, unit: f.unit, reorder_threshold: Number(f.reorder_threshold) || 0,
      }) })
      setMsg('Insumo atualizado.'); onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  const deactivate = async () => {
    if (!(await confirmDialog({ title: 'Desativar insumo', message: 'Desativar este insumo? Ele some da lista (não é apagado — o histórico fica).', confirmLabel: 'Desativar' }))) return
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
          <Input label="Código de barras (escaneie aqui)" value={f.barcode} onChange={v => set('barcode', v)} placeholder="bipe o código ou digite" />
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

interface NfeItem { code: string | null; ean: string | null; description: string; ncm: string | null; cfop: string | null; unit: string; quantity: number; unit_cost: number; total: number; kind: string; material: string | null; color: string | null; color_hex: string | null; diameter_mm: number | null; spool_weight_g: number | null; raw_unit: string; raw_quantity: number; raw_unit_cost: number; conversion: string | null }
interface NfePreview {
  supplier: { tax_id: string | null; name: string; legal_name: string; ie: string | null; phone: string | null; address: Record<string, string | null> }
  nf: { number: string | null; serie: string | null; date: string | null; access_key: string | null; total: number }
  items: NfeItem[]; supplier_existing_id: string | null; already_imported: boolean
  items_matched: { index: number; input_id: string | null; input_name: string | null }[]
}
type NfRow = NfeItem & { include: boolean; link_input_id: string | null; match_name: string | null }

function ImportNfModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [preview, setPreview] = useState<NfePreview | null>(null)
  const [rows, setRows] = useState<NfRow[]>([])
  const [busy, setBusy] = useState(false); const [committing, setCommitting] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [force, setForce] = useState(false) // reimportar uma NF já carimbada (insumos foram excluídos)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf'
    setBusy(true); setErr(''); setPreview(null)
    try {
      let p: NfePreview
      if (isPdf) {
        const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(new Error('falha ao ler PDF')); r.readAsDataURL(f) })
        p = await api<NfePreview>('/product-os/production-inputs/import-nfe/preview-pdf', { method: 'POST', body: JSON.stringify({ pdf_base64: b64 }) })
      } else {
        const xml = await f.text()
        p = await api<NfePreview>('/product-os/production-inputs/import-nfe/preview', { method: 'POST', body: JSON.stringify({ xml }) })
      }
      setPreview(p)
      setRows(p.items.map((it, i) => { const m = p.items_matched.find(x => x.index === i); return { ...it, include: true, link_input_id: m?.input_id ?? null, match_name: m?.input_name ?? null } }))
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Erro ao ler a NF') } finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const doImport = async () => {
    if (!preview) return
    setCommitting(true); setErr(''); setMsg('')
    try {
      const r = await api<{ created: number; restocked: number }>('/product-os/production-inputs/import-nfe', { method: 'POST', body: JSON.stringify({
        supplier: { ...preview.supplier, use_existing_id: preview.supplier_existing_id },
        nf: { access_key: preview.nf.access_key, number: preview.nf.number, total: preview.nf.total },
        items: rows.map(r => ({ include: r.include, link_input_id: r.link_input_id, name: r.description, sku: r.code, barcode: r.ean, unit: r.unit, quantity: r.quantity, unit_cost: r.unit_cost, kind: r.kind, material: r.material, description: r.description, color: r.color, color_hex: r.color_hex, diameter_mm: r.diameter_mm, spool_weight_g: r.spool_weight_g })),
        force: preview.already_imported && force,
      }) })
      setMsg(`Importado: ${r.created} insumo(s) novo(s), ${r.restocked} abastecido(s). Fornecedor e estoque atualizados.`)
      setTimeout(onImported, 1200)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro ao importar') } finally { setCommitting(false) }
  }
  const KINDS = ['filamento', 'embalagem', 'etiqueta', 'outro']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2"><h3 className="text-sm font-bold text-white">Importar NF de insumo (XML)</h3><button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={16} /></button></div>
        {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
        {msg && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>}

        {!preview ? (
          <div className="space-y-2">
            <p className="text-xs" style={{ color: '#a1a1aa' }}>Suba o <b style={{ color: '#a5f3fc' }}>XML</b> ou o <b style={{ color: '#a5f3fc' }}>PDF (DANFE)</b> da NF-e de compra. O sistema cria o fornecedor e os insumos, e dá entrada no estoque ao custo da nota (recalcula o custo médio). Cada item você revisa antes.</p>
            <input ref={fileRef} type="file" accept=".xml,.pdf,text/xml,application/xml,application/pdf" onChange={e => void onFile(e)} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {busy ? 'Lendo a NF…' : 'Escolher XML ou PDF da NF'}</button>
            <p className="text-[11px]" style={{ color: '#52525b' }}>O <b>XML</b> é mais preciso (dados exatos). O <b>PDF</b> é lido por IA (leva alguns segundos e pode errar — confira os itens antes de importar).</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* fornecedor */}
            <div className="rounded-xl p-3" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#71717a' }}>Fornecedor</span>
                <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: preview.supplier_existing_id ? 'rgba(165,243,252,0.12)' : 'rgba(74,222,128,0.12)', color: preview.supplier_existing_id ? '#a5f3fc' : '#4ade80' }}>{preview.supplier_existing_id ? 'já cadastrado' : 'novo'}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-white">{preview.supplier.name}</p>
              <p className="text-[11px]" style={{ color: '#71717a' }}>{preview.supplier.legal_name}{preview.supplier.tax_id ? ` · CNPJ ${preview.supplier.tax_id}` : ''}{preview.supplier.address?.city ? ` · ${preview.supplier.address.city}/${preview.supplier.address.uf}` : ''}</p>
            </div>

            {preview.already_imported && (
              <div className="rounded-lg p-2.5 text-[11px]" style={{ background: force ? 'rgba(248,113,113,0.10)' : 'rgba(252,211,77,0.10)', color: force ? '#f87171' : '#fcd34d', border: `1px solid ${force ? 'rgba(248,113,113,0.3)' : 'rgba(252,211,77,0.25)'}` }}>
                <p>⚠️ Esta NF (chave {preview.nf.access_key?.slice(0, 10)}…) já foi importada antes. Reimportar dá <b>entrada de estoque de novo</b> — use só se você <b>excluiu os insumos</b> e quer recriá-los.</p>
                <label className="mt-1.5 flex items-center gap-1.5 font-semibold" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
                  Importar mesmo assim (reimportar esta nota)
                </label>
              </div>
            )}

            <p className="text-[11px]" style={{ color: '#71717a' }}>NF {preview.nf.number ?? '—'} · total R$ {Number(preview.nf.total).toFixed(2)} · {rows.length} itens</p>

            {/* itens */}
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded-lg p-2.5" style={{ background: '#0a0a0e', border: `1px solid ${r.include ? '#27272a' : '#1a1a1f'}`, opacity: r.include ? 1 : 0.55 }}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={r.include} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, include: e.target.checked } : x))} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">{r.description}</p>
                      <p className="text-[10px]" style={{ color: '#71717a' }}>NF: {r.raw_quantity} {r.raw_unit} × R$ {r.raw_unit_cost.toFixed(2)} = R$ {r.total.toFixed(2)}{r.code ? ` · cód ${r.code}` : ''}</p>
                      {r.conversion && <p className="text-[10px]" style={{ color: '#a5f3fc' }}>↳ convertido: {r.conversion}</p>}
                      {/* campos que alimentam o sistema — edite se a leitura errou */}
                      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                        {([['quantity', 'Quantidade'], ['unit', 'Unidade'], ['unit_cost', 'Custo/un']] as const).map(([f, lbl]) => (
                          <label key={f} className="block"><span className="block text-[9px] uppercase tracking-wide" style={{ color: '#52525b' }}>{lbl}</span>
                            {f === 'unit'
                              ? <select value={r.unit} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} className="w-full rounded px-1.5 py-0.5 text-[11px] outline-none" style={{ background: '#111114', border: '1px solid #27272a', color: '#fafafa' }}>{['g', 'kg', 'un', 'm'].map(u => <option key={u} value={u}>{u}</option>)}</select>
                              : <input type="number" step={f === 'unit_cost' ? '0.00001' : '1'} value={r[f]} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, [f]: Number(e.target.value) || 0 } : x))} className="w-full rounded px-1.5 py-0.5 text-[11px] outline-none" style={{ background: '#111114', border: '1px solid #27272a', color: '#fafafa' }} />}
                          </label>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <select value={r.kind} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))} className="rounded px-1.5 py-0.5 text-[10px] outline-none" style={{ background: '#111114', border: '1px solid #27272a', color: '#fafafa' }}>
                          {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        {r.material && <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>{r.material}</span>}
                        {r.color && <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>{r.color}</span>}
                        {r.diameter_mm && <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>{r.diameter_mm}mm</span>}
                        {r.spool_weight_g && <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>rolo {r.spool_weight_g}g</span>}
                        {r.match_name ? (
                          <label className="flex items-center gap-1 text-[10px]" style={{ color: '#a5f3fc' }}>
                            <input type="checkbox" checked={!!r.link_input_id} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, link_input_id: e.target.checked ? (preview.items_matched.find(m => m.index === i)?.input_id ?? null) : null } : x))} />
                            {r.link_input_id ? `abastece "${r.match_name}"` : `criar novo`}
                          </label>
                        ) : <span className="text-[10px]" style={{ color: '#4ade80' }}>novo insumo</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end">
              <button onClick={() => void doImport()} disabled={committing || (preview.already_imported && !force) || !rows.some(r => r.include)} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: force ? 'rgba(248,113,113,0.12)' : 'rgba(0,229,255,0.12)', border: `1px solid ${force ? 'rgba(248,113,113,0.35)' : 'rgba(0,229,255,0.35)'}`, color: force ? '#f87171' : '#00E5FF' }}>{committing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} {force ? 'Reimportar' : 'Importar'} {rows.filter(r => r.include).length} item(ns)</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NewInputModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState({ kind: 'filamento', sku: '', barcode: '', name: '', description: '', material: '', color: '', color_hex: '', brand: '', supplier: '', diameter_mm: '', spool_weight_g: '', unit: 'g', quantity: '', reorder_threshold: '', cost_per_unit: '' })
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const set = (k: keyof typeof f, v: string) => setF(s => ({ ...s, [k]: v }))
  const isFil = f.kind === 'filamento'
  const create = async () => {
    if (!f.name.trim()) { setErr('Nome obrigatório'); return }
    setBusy(true); setErr('')
    try {
      await api('/product-os/production-inputs', { method: 'POST', body: JSON.stringify({
        kind: f.kind, sku: f.sku || undefined, barcode: f.barcode || undefined, name: f.name, description: f.description || undefined,
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
        <Input label="Código de barras (escaneie aqui)" value={f.barcode} onChange={v => set('barcode', v)} placeholder="bipe o código ou digite" />
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
type DrawerTab = 'briefing' | 'versoes' | 'pecas' | 'sku' | 'ficha' | 'custo' | 'real' | 'bom' | 'qualidade' | 'reposicao' | 'timeline'
// ── Paletas de cor por categoria (recurso do Product OS, não toca no Creative) ──
interface Palette { id: string; name: string; category_id: string | null; category: { id: string; code: string; label: string } | null; colors: Array<{ hex: string; label?: string }>; is_primary: boolean; notes?: string | null }
function palettePrompt(p: Palette): string {
  const cores = p.colors.map(c => `${c.label ? c.label + ' ' : ''}${c.hex}`).join(', ')
  return `Use exatamente esta paleta de cores na imagem do produto: ${cores}. Fundo e iluminação que valorizem essas cores; produto impresso em 3D, fotografia de catálogo limpa.`
}
function PaletteEditor({ initial, cats, filaments, onSave, onCancel, saving }: { initial: Partial<Palette>; cats: TaxOption[]; filaments: Input[]; onSave: (b: { name: string; category_id: string | null; colors: Array<{ hex: string; label: string; input_id?: string }> }) => void; onCancel: () => void; saving: boolean }) {
  const [name, setName] = useState(initial.name ?? '')
  const [catId, setCatId] = useState(initial.category_id ?? '')
  const [colors, setColors] = useState<Array<{ hex: string; label: string; input_id?: string }>>((initial.colors ?? []).map(c => ({ hex: c.hex, label: c.label ?? '' })))
  const [nh, setNh] = useState('#888888'); const [nl, setNl] = useState('')
  const addColor = () => { if (!/^#[0-9a-fA-F]{6}$/.test(nh)) return; setColors(c => [...c, { hex: nh.toLowerCase(), label: nl.trim() }]); setNl('') }
  const addFilament = (f: Input) => { if (!f.color_hex) return; setColors(c => c.some(x => x.input_id === f.id) ? c : [...c, { hex: f.color_hex!.toLowerCase(), label: f.color || f.name, input_id: f.id }]) }
  const fil = filaments.filter(f => f.color_hex && /^#[0-9a-f]{6}$/i.test(f.color_hex))
  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da paleta (ex: Glam Rosé)" className="rounded-lg px-2.5 py-1.5 text-sm text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
        <select value={catId} onChange={e => setCatId(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-sm text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
          <option value="">— sem categoria (geral) —</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.code} · {c.label}</option>)}
        </select>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {colors.map((c, i) => (
          <span key={i} className="flex items-center gap-1 rounded-full py-0.5 pl-1 pr-2 text-[11px]" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#a1a1aa' }}>
            <span className="h-4 w-4 rounded-full" style={{ background: c.hex, border: '1px solid #3f3f46' }} />{c.label || c.hex}
            <button onClick={() => setColors(cs => cs.filter((_, j) => j !== i))} style={{ color: '#71717a' }}>×</button>
          </span>
        ))}
      </div>
      {fil.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Pegar da cartela de filamentos ({fil.length})</p>
          <div className="flex flex-wrap gap-1" style={{ maxHeight: 76, overflowY: 'auto' }}>
            {fil.map(f => (
              <button key={f.id} onClick={() => addFilament(f)} title={`${f.color || f.name} ${f.color_hex}`} className="h-6 w-6 rounded-full" style={{ background: f.color_hex!, border: colors.some(c => c.input_id === f.id) ? '2px solid #00E5FF' : '1px solid #3f3f46' }} />
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center gap-1.5">
        <input type="color" value={nh} onChange={e => setNh(e.target.value)} className="h-8 w-8 cursor-pointer rounded" style={{ background: 'transparent', border: '1px solid #27272a' }} />
        <input value={nl} onChange={e => setNl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addColor() }} placeholder="nome da cor" className="w-28 rounded-lg px-2 py-1 text-[11px] text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
        <button onClick={addColor} className="rounded-lg px-2 py-1 text-[11px] font-bold" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>+ cor</button>
        <div className="ml-auto flex gap-1.5">
          <button onClick={onCancel} className="rounded-lg px-3 py-1 text-xs font-semibold" style={{ background: '#0a0a0e', color: '#a1a1aa', border: '1px solid #27272a' }}>Cancelar</button>
          <button onClick={() => onSave({ name: name.trim(), category_id: catId || null, colors })} disabled={saving || !name.trim() || !colors.length} className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#0a0a0e' }}>{saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar</button>
        </div>
      </div>
    </div>
  )
}
function PalettesPanel() {
  const [cats, setCats] = useState<TaxOption[]>([]); const [palettes, setPalettes] = useState<Palette[]>([]); const [filaments, setFilaments] = useState<Input[]>([])
  const [filter, setFilter] = useState('all'); const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, p, f] = await Promise.all([api<TaxOption[]>('/product-os/sku/taxonomy?kind=categoria'), api<Palette[]>('/product-os/palettes'), api<Input[]>('/product-os/production-inputs').catch(() => [] as Input[])])
      setCats(c); setPalettes(p); setFilaments(f.filter(x => x.kind === 'filamento'))
    } catch { /* */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const shown = filter === 'all' ? palettes : palettes.filter(p => p.category_id === filter)
  const copyPrompt = (p: Palette) => { try { void navigator.clipboard.writeText(palettePrompt(p)); setMsg(`Prompt de cores de "${p.name}" copiado — cole na geração de imagem.`) } catch { /* */ } }
  const save = async (id: string | 'new', body: { name: string; category_id: string | null; colors: Array<{ hex: string; label: string; input_id?: string }> }) => {
    setBusy(true); setMsg('')
    try { if (id === 'new') await api('/product-os/palettes', { method: 'POST', body: JSON.stringify(body) }); else await api(`/product-os/palettes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); setEditing(null); await load() }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  const setPrimary = async (p: Palette) => { setBusy(true); try { await api(`/product-os/palettes/${p.id}/primary`, { method: 'POST' }); await load() } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) } }
  const del = async (p: Palette) => { if (!(await confirmDialog({ title: 'Excluir paleta', message: `Excluir "${p.name}"?`, danger: true, confirmLabel: 'Excluir' }))) return; setBusy(true); try { await api(`/product-os/palettes/${p.id}/delete`, { method: 'POST' }); await load() } catch { /* */ } finally { setBusy(false) } }

  if (loading) return <div className="flex items-center gap-2 p-6 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>
  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>Cartelas de cor por categoria para a <b className="text-white">geração de imagens</b> dos produtos. Cada categoria pode ter uma paleta <b className="text-white">primária</b> (a escolhida). Use <b className="text-white">copiar prompt de cores</b> e cole onde gerar a imagem. As cores batem com os filamentos que você imprime.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-xs text-white" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <option value="all">Todas as categorias</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button onClick={() => setEditing('new')} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}><Plus size={12} /> Nova paleta</button>
        {msg && <span className="text-[11px]" style={{ color: msg.includes('Erro') ? '#f87171' : '#4ade80' }}>{msg}</span>}
      </div>
      {editing === 'new' && <PaletteEditor initial={{ category_id: filter !== 'all' ? filter : null }} cats={cats} filaments={filaments} saving={busy} onSave={b => void save('new', b)} onCancel={() => setEditing(null)} />}
      {shown.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Nenhuma paleta nesta categoria — clique em Nova paleta para criar.</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map(p => editing === p.id ? (
            <div className="sm:col-span-2" key={p.id}><PaletteEditor initial={p} cats={cats} filaments={filaments} saving={busy} onSave={b => void save(p.id, b)} onCancel={() => setEditing(null)} /></div>
          ) : (
            <div key={p.id} className="rounded-xl p-3" style={{ background: '#111114', border: p.is_primary ? '1px solid rgba(0,229,255,0.35)' : '1px solid #27272a' }}>
              <div className="mb-2 flex items-center gap-2">
                {p.is_primary && <Star size={13} className="shrink-0 fill-cyan-400 text-cyan-400" />}
                <span className="text-sm font-bold text-white">{p.name}</span>
                <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: '#0a0a0e', color: '#71717a', border: '1px solid #1a1a1f' }}>{p.category?.label ?? 'geral'}</span>
              </div>
              <div className="mb-2 flex h-9 overflow-hidden rounded-lg" style={{ border: '1px solid #1a1a1f' }}>
                {p.colors.map((c, i) => <div key={i} className="flex-1" style={{ background: c.hex }} title={`${c.label ?? ''} ${c.hex}`} />)}
              </div>
              <div className="mb-2 flex flex-wrap gap-1">
                {p.colors.map((c, i) => <span key={i} className="font-mono text-[9px]" style={{ color: '#52525b' }}>{c.hex}{i < p.colors.length - 1 ? ' ·' : ''}</span>)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => copyPrompt(p)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}><Copy size={10} /> Copiar prompt de cores</button>
                {!p.is_primary && p.category_id && <button onClick={() => void setPrimary(p)} disabled={busy} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: '#0a0a0e', color: '#a5f3fc', border: '1px solid #27272a' }}><Star size={10} /> Tornar primária</button>}
                <button onClick={() => setEditing(p.id)} className="rounded px-2 py-1 text-[10px] font-semibold" style={{ background: '#0a0a0e', color: '#a1a1aa', border: '1px solid #27272a' }}>Editar</button>
                <button onClick={() => void del(p)} className="rounded px-2 py-1 text-[10px]" style={{ background: '#0a0a0e', color: '#71717a', border: '1px solid #27272a' }}><Trash2 size={10} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function GenerateImageModal({ dev, onClose, onSaved }: { dev: { id: string; name: string; reference_images?: ReferenceImage[]; versions?: Version[] }; onClose: () => void; onSaved: () => void }) {
  const [palettes, setPalettes] = useState<Palette[]>([])
  const [paletteId, setPaletteId] = useState(''); const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [result, setResult] = useState<{ url: string; palette: string | null; colors: Array<{ hex: string }>; provider: string; used_reference?: boolean } | null>(null)
  const [saving, setSaving] = useState(false); const [savedMsg, setSavedMsg] = useState('')
  // imagens disponíveis (fotos do protótipo + reference_images, que inclui as do MakerWorld importado)
  const candidates = useMemo(() => {
    const out: string[] = []
    for (const v of dev.versions ?? []) for (const u of v.prototype_photo_urls ?? []) if (u && !out.includes(u)) out.push(u)
    for (const r of dev.reference_images ?? []) if (r.url && !out.includes(r.url)) out.push(r.url)
    return out
  }, [dev])
  // imagens base subidas na hora (habilita o image-to-image mesmo em produto do zero)
  const [uploaded, setUploaded] = useState<string[]>([])
  const allCandidates = useMemo(() => { const s = new Set<string>([...candidates, ...uploaded]); return [...s] }, [candidates, uploaded])
  const [useRef, setUseRef] = useState(true); const [refUrls, setRefUrls] = useState<string[]>([])
  useEffect(() => { setRefUrls(candidates.slice(0, 1)); setUseRef(candidates.length > 0) }, [candidates])
  const toggleRef = (u: string) => setRefUrls(prev => prev.includes(u) ? prev.filter(x => x !== u) : (prev.length >= 4 ? prev : [...prev, u]))
  const addBaseImage = (u: string) => { if (!u) return; setUploaded(p => p.includes(u) ? p : [...p, u]); setRefUrls(p => p.includes(u) ? p : (p.length >= 4 ? p : [...p, u])); setUseRef(true) }
  useEffect(() => { void (async () => { try { setPalettes(await api<Palette[]>('/product-os/palettes')) } catch { /* */ } })() }, [])
  const gen = async () => {
    setBusy(true); setErr(''); setResult(null); setSavedMsg('')
    try { const r = await api<{ url: string; palette: string | null; colors: Array<{ hex: string }>; provider: string; used_reference?: boolean }>(`/product-os/${dev.id}/generate-image`, { method: 'POST', body: JSON.stringify({ palette_id: paletteId || undefined, extra: extra.trim() || undefined, use_reference: useRef && refUrls.length > 0, reference_urls: useRef && refUrls.length ? refUrls : undefined }) }); setResult(r) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  const saveRef = async () => {
    if (!result) return; setSaving(true); setErr('')
    try { await api(`/product-os/${dev.id}`, { method: 'PATCH', body: JSON.stringify({ reference_images: [...(dev.reference_images ?? []), { url: result.url, notes: `IA · ${result.palette ?? 'paleta'}` }] }) }); setSavedMsg('Salva nas referências do produto ✓'); onSaved() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <Palette size={16} className="text-cyan-400" />
          <h3 className="text-sm font-extrabold text-white">Gerar imagem com paleta — {dev.name}</h3>
          <button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={16} /></button>
        </div>
        <p className="mb-3 text-[11px]" style={{ color: '#71717a' }}>Recurso próprio do Product OS. A IA gera uma foto de catálogo do produto aplicando a paleta escolhida. Consome crédito de IA.</p>
        <label className="mb-1 block text-[10px] font-semibold uppercase" style={{ color: '#71717a' }}>Paleta</label>
        <select value={paletteId} onChange={e => setPaletteId(e.target.value)} className="mb-2 w-full rounded-lg px-2.5 py-1.5 text-sm text-white" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <option value="">Automática (primária da categoria)</option>
          {palettes.map(p => <option key={p.id} value={p.id}>{p.is_primary ? '★ ' : ''}{p.name}{p.category ? ` · ${p.category.label}` : ''}</option>)}
        </select>
        <input value={extra} onChange={e => setExtra(e.target.value)} placeholder="instrução extra (opcional): ex. sobre mesa de mármore" className="mb-3 w-full rounded-lg px-2.5 py-1.5 text-sm text-white" style={{ background: '#111114', border: '1px solid #27272a' }} />
        <div className="mb-3 rounded-lg p-2.5" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[11px] text-white">
              <button type="button" onClick={() => allCandidates.length && setUseRef(v => !v)} disabled={allCandidates.length === 0} className="relative h-4 w-7 rounded-full transition-colors disabled:opacity-40" style={{ background: useRef && allCandidates.length ? '#00E5FF' : '#3f3f46' }}><span className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" style={{ left: useRef && allCandidates.length ? '14px' : '2px' }} /></button>
              Gerar com inspiração numa imagem base
            </label>
            <UploadButton label="Subir imagem base" accept="image/*" onUploaded={urls => addBaseImage(urls[0])} />
          </div>
          {allCandidates.length > 0 ? (useRef && (
            <>
              <p className="mb-1 text-[10px]" style={{ color: '#52525b' }}>Selecione 1 a 4 imagens do MESMO produto ({refUrls.length} selecionada{refUrls.length === 1 ? '' : 's'}) — inclui fotos do MakerWorld e as que você subir.</p>
              <div className="flex flex-wrap gap-1.5">
                {allCandidates.map(u => (
                  <button key={u} onClick={() => toggleRef(u)} className="relative h-12 w-12 overflow-hidden rounded-lg" style={{ border: refUrls.includes(u) ? '2px solid #00E5FF' : '1px solid #27272a' }}>
                    <img src={u} alt="ref" className="h-full w-full object-cover" />
                    {refUrls.includes(u) && <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-bl text-[9px] font-bold" style={{ background: '#00E5FF', color: '#0a0a0e' }}>✓</span>}
                  </button>
                ))}
              </div>
            </>
          )) : (
            <p className="text-[10px]" style={{ color: '#52525b' }}>Produto do zero, sem imagem ainda? Suba uma <span className="text-white">imagem base</span> acima pra gerar com inspiração nela — ou gere só pelo texto/paleta abaixo.</p>
          )}
        </div>
        <button onClick={() => void gen()} disabled={busy} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#0a0a0e' }}>{busy ? <><Loader2 size={13} className="animate-spin" /> Gerando… (~10s)</> : <><Sparkles size={13} /> {useRef && refUrls.length ? `Gerar a partir de ${refUrls.length} foto${refUrls.length > 1 ? 's' : ''}` : 'Gerar imagem'}</>}</button>
        {err && <p className="mt-2 text-[11px]" style={{ color: '#f87171' }}>{err}</p>}
        {result && (
          <div className="mt-3">
            <img src={result.url} alt="prévia" className="w-full rounded-lg" style={{ border: '1px solid #27272a' }} />
            <div className="mt-1 flex items-center gap-1.5">
              {result.colors?.slice(0, 8).map((c, i) => <span key={i} className="h-3 w-3 rounded-full" style={{ background: c.hex, border: '1px solid #3f3f46' }} />)}
              <span className="ml-1 text-[10px]" style={{ color: '#52525b' }}>{result.palette ?? 'sem paleta'} · {result.provider}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => void saveRef()} disabled={saving || !!savedMsg} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.35)' }}>{saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar nas referências</button>
              <button onClick={() => void gen()} disabled={busy} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>Gerar outra</button>
              <a href={result.url} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: '#111114', color: '#a5f3fc', border: '1px solid #27272a' }}>Abrir</a>
            </div>
            {savedMsg && <p className="mt-1.5 text-[11px]" style={{ color: '#4ade80' }}>{savedMsg}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
function PublishModal({ dev, onClose, onDone }: { dev: DevDetail; onClose: () => void; onDone: (msg: string) => void }) {
  const devId = dev.id, devName = dev.name
  const [sku, setSku] = useState<SkuData | null>(null)
  const [mode, setMode] = useState<'single' | 'variable'>('single')
  const [qty, setQty] = useState('0')
  const [rows, setRows] = useState<Record<string, { price: string; stock: string }>>({})
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true)
  // fotos do anúncio: protótipo + reference_images (inclui as IMAGENS GERADAS pela IA e MakerWorld). 1ª = capa.
  const photos = useMemo(() => {
    const out: string[] = []
    for (const v of dev.versions ?? []) for (const u of v.prototype_photo_urls ?? []) if (u && !out.includes(u)) out.push(u)
    for (const r of dev.reference_images ?? []) if (r.url && !out.includes(r.url)) out.push(r.url)
    return out
  }, [dev])
  const [cover, setCover] = useState('')
  useEffect(() => { setCover(photos[0] ?? '') }, [photos])
  useEffect(() => { void (async () => {
    try {
      const d = await api<SkuData>(`/product-os/${devId}/sku`); setSku(d)
      if (d.variants.length) { setMode('variable'); setRows(Object.fromEntries(d.variants.map(v => [v.id, { price: '', stock: '0' }]))) }
    } catch { setSku({ classification: { marca: null, categoria: null, sub: null, linha: null, caracteristica: null }, base: null, variants: [] }) }
    finally { setLoading(false) }
  })() }, [devId])
  const variants = sku?.variants ?? []
  const linhaSet = !!sku?.classification.linha
  const fichaFilled = !!(dev.catalog_title || dev.catalog_description)
  const setRow = (id: string, field: 'price' | 'stock', val: string) => setRows(r => ({ ...r, [id]: { ...(r[id] ?? { price: '', stock: '0' }), [field]: val } }))
  const orderedPhotos = cover ? [cover, ...photos.filter(p => p !== cover)] : photos
  const publish = async () => {
    setBusy(true); setErr('')
    try {
      const base = orderedPhotos.length ? { photo_urls: orderedPhotos } : {}
      const body = mode === 'variable'
        ? { ...base, variation_mode: 'variable' as const, variants: variants.map(v => ({ id: v.id, price: rows[v.id]?.price ? Number(rows[v.id].price.replace(',', '.')) : null, stock: Number(rows[v.id]?.stock || 0) })) }
        : { ...base, variation_mode: 'single' as const, produced_quantity: Number(qty) || 0 }
      const r = await api<{ product_id: string; sku: string | null; mode: string; variants: number }>(`/product-os/${devId}/publish-to-catalog`, { method: 'POST', body: JSON.stringify(body) })
      onDone(`Publicado no catálogo (${r.mode === 'variable' ? `${r.variants} cores` : 'produto único'}${r.sku ? `, SKU ${r.sku}` : ''}). Pronto para enviar às plataformas / loja.`)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <Rocket size={16} className="text-green-400" />
          <h3 className="text-sm font-extrabold text-white">Publicar no catálogo — {devName}</h3>
          <button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={16} /></button>
        </div>
        {loading ? <div className="flex items-center gap-2 p-4 text-sm" style={{ color: '#71717a' }}><Loader2 size={14} className="animate-spin" /> Carregando…</div> : (
          <>
            {!linhaSet && (
              <div className="mb-3 rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(252,211,77,0.08)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>⚠️ <span className="font-bold">Linha de produtos não definida.</span> Defina a linha na aba <span className="text-white">Ficha</span> (ou SKU) antes de publicar — a publicação está bloqueada.</div>
            )}
            {linhaSet && !fichaFilled && (
              <div className="mb-3 rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(0,229,255,0.06)', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.25)' }}>💡 A ficha ainda não foi preenchida — o produto irá com nome/descrição crus. Preencha na aba <span className="text-white">Ficha</span> (título de ML, descrição, atributos) para chegar pronto na IA Criativo.</div>
            )}
            {linhaSet && fichaFilled && (
              <div className="mb-3 rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(74,222,128,0.06)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>✓ Ficha preenchida{dev.catalog_ready ? ' e validada' : ''} — <span className="text-white">{dev.catalog_title}</span></div>
            )}
            {variants.length > 0 ? (
              <div className="mb-3 flex gap-1 rounded-lg p-1" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
                {([['single', 'Produto único', 'um SKU só (cor base)'], ['variable', 'Produto variável', `${variants.length} cores`]] as const).map(([k, lbl, hint]) => (
                  <button key={k} onClick={() => setMode(k)} className="flex-1 rounded px-2 py-1.5 text-left" style={{ background: mode === k ? 'rgba(0,229,255,0.12)' : 'transparent', border: mode === k ? '1px solid rgba(0,229,255,0.35)' : '1px solid transparent' }}>
                    <span className="block text-[11px] font-bold" style={{ color: mode === k ? '#00E5FF' : '#a1a1aa' }}>{lbl}</span>
                    <span className="block text-[9px]" style={{ color: '#52525b' }}>{hint}</span>
                  </button>
                ))}
              </div>
            ) : <p className="mb-3 text-[11px]" style={{ color: '#71717a' }}>Sem variantes de cor — vai como produto único. (Defina cores na aba SKU para publicar como variável.)</p>}

            {mode === 'variable' && variants.length > 0 ? (
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-1 text-[9px] font-semibold uppercase" style={{ color: '#52525b' }}><span>Cor / SKU</span><span>Preço R$</span><span>Estoque</span></div>
                {variants.map(v => (
                  <div key={v.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{v.cor?.label ?? 'Cor'}</p>
                      <p className="truncate font-mono text-[9px]" style={{ color: '#52525b' }}>{v.sku}{v.ean ? ` · EAN ${v.ean}` : ''}</p>
                    </div>
                    <input value={rows[v.id]?.price ?? ''} onChange={e => setRow(v.id, 'price', e.target.value)} placeholder="—" inputMode="decimal" className="w-16 rounded px-1.5 py-1 text-right text-[11px] text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
                    <input value={rows[v.id]?.stock ?? '0'} onChange={e => setRow(v.id, 'stock', e.target.value)} inputMode="numeric" className="w-14 rounded px-1.5 py-1 text-right text-[11px] text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
                  </div>
                ))}
                <p className="text-[10px]" style={{ color: '#fcd34d' }}>⚠️ Estoque por cor é inicial/manual aqui. O crédito automático da produção por cor entra na próxima etapa.</p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase" style={{ color: '#71717a' }}>Unidades já produzidas no estoque agora</label>
                <input value={qty} onChange={e => setQty(e.target.value)} inputMode="numeric" className="w-full rounded-lg px-2.5 py-1.5 text-sm text-white" style={{ background: '#111114', border: '1px solid #27272a' }} />
              </div>
            )}

            {photos.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase" style={{ color: '#71717a' }}>Fotos do anúncio · clique para definir a capa ({photos.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {orderedPhotos.map((u, i) => (
                    <button key={u} onClick={() => setCover(u)} className="relative h-14 w-14 overflow-hidden rounded-lg" style={{ border: i === 0 ? '2px solid #4ade80' : '1px solid #27272a' }}>
                      <img src={u} alt="foto" className="h-full w-full object-cover" />
                      {i === 0 && <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-bold" style={{ background: 'rgba(74,222,128,0.85)', color: '#0a0a0e' }}>capa</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3 text-[10px] leading-relaxed" style={{ color: '#71717a' }}>O produto entra no catálogo com <span className="text-white">SKU e EAN</span> já preenchidos{photos.length ? ' e as fotos escolhidas' : ''}, pronto para a IA Criativo publicar no ML/Shopee/TikTok e para a loja. {mode === 'variable' ? 'Cada cor vira uma variação (modelo do catálogo/ML).' : ''}</p>
            {err && <p className="mt-2 text-[11px]" style={{ color: '#f87171' }}>{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>Cancelar</button>
              <button onClick={() => void publish()} disabled={busy || !linhaSet} title={!linhaSet ? 'Defina a linha de produtos antes de publicar' : ''} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40" style={{ background: '#4ade80', color: '#0a0a0e' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />} Publicar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
function DetailDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [dev, setDev] = useState<DevDetail | null>(null)
  const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [tab, setTab] = useState<DrawerTab>('briefing')
  const [busy, setBusy] = useState<'dispatch' | 'publish' | 'license' | null>(null)
  const [showPublish, setShowPublish] = useState(false)
  const [showImage, setShowImage] = useState(false)
  const prompt = usePrompt()

  const reload = useCallback(async () => { try { setDev(await api<DevDetail>(`/product-os/${id}`)) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } }, [id])
  useEffect(() => { void reload() }, [reload])

  const setClearance = async (cleared: boolean) => {
    let note: string | undefined
    if (cleared) {
      const n = await prompt({
        title: 'Liberar licença',
        message: 'Registre por que esta licença está liberada — fica no histórico do produto como comprovação.',
        placeholder: 'Ex: comprei a licença comercial; autorizado pelo criador em 20/06; arte própria…',
        multiline: true,
        confirmLabel: 'Liberar licença',
        variant: 'warning',
      })
      if (n == null) return
      note = n.trim() || undefined
    }
    setBusy('license'); setErr(''); setMsg('')
    try { await api(`/product-os/${id}/license-clearance`, { method: 'POST', body: JSON.stringify({ cleared, note }) }); setMsg(cleared ? 'Licença marcada como liberada.' : 'Liberação removida.'); void reload(); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(null) }
  }

  const dispatch = async () => {
    setBusy('dispatch'); setErr(''); setMsg('')
    try { const r = await api<{ message?: string }>(`/product-os/${id}/dispatch`, { method: 'POST', body: JSON.stringify({}) }); setMsg(r.message ?? 'Enviado ao Active.'); void reload(); onChanged() }
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
              <button onClick={() => setShowImage(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: '#111114', border: '1px solid #27272a', color: '#c084fc' }}><Palette size={12} /> Gerar imagem</button>
              <button onClick={() => setShowPublish(true)} disabled={busy !== null || !!dev.product_id || dev.status !== 'aprovado' || (dev.license_status?.blocked ?? false)} title={dev.license_status?.blocked ? 'Licença bloqueia a publicação — libere em "Licença & origem"' : dev.status !== 'aprovado' ? 'Aprove uma versão primeiro' : ''} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40" style={{ background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>{<Rocket size={12} />} {dev.product_id ? 'No catálogo ✓' : 'Virar anúncio'}</button>
            </div>
            {showPublish && <PublishModal dev={dev} onClose={() => setShowPublish(false)} onDone={m => { setShowPublish(false); setMsg(m); void reload(); onChanged() }} />}
            {showImage && <GenerateImageModal dev={dev} onClose={() => setShowImage(false)} onSaved={() => { void reload(); onChanged() }} />}

            {dev.license_status && <LicenseOriginBlock st={dev.license_status} onClear={c => void setClearance(c)} busy={busy === 'license'} />}
            {dev.description && <p className="mb-3 text-xs" style={{ color: '#a1a1aa' }}>{dev.description}</p>}
            {err && <div className="mb-3 whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
            {msg && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>}

            <div className="mb-4 flex flex-wrap gap-1 rounded-lg p-1" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
              {([['briefing', 'Briefing', <Sparkles key="a" size={11} />], ['versoes', 'Versões', <FileBox key="b" size={11} />], ['pecas', 'Peças', <Boxes key="p" size={11} />], ['sku', 'SKU', <Barcode key="s" size={11} />], ['ficha', 'Ficha', <ClipboardList key="fi" size={11} />], ['custo', 'Custo', <DollarSign key="c" size={11} />], ['real', 'Custo real', <Gauge key="g" size={11} />], ['bom', 'BOM', <ListChecks key="d" size={11} />], ['qualidade', 'Qualidade', <ClipboardList key="e" size={11} />], ['reposicao', 'Reposição', <RefreshCw key="r" size={11} />], ['timeline', 'Timeline', <History key="f" size={11} />]] as const).map(([k, lbl, ic]) => (
                <button key={k} onClick={() => setTab(k)} className="flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] font-semibold" style={{ background: tab === k ? 'rgba(0,229,255,0.12)' : 'transparent', color: tab === k ? '#00E5FF' : '#71717a' }}>{ic}{lbl}</button>
              ))}
            </div>

            {tab === 'briefing' && <BriefingTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
            {tab === 'versoes' && <VersionsTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
            {tab === 'pecas' && <PartsTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
            {tab === 'sku' && <SkuTab dev={dev} />}
            {tab === 'ficha' && <FichaTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
            {tab === 'custo' && <CostTab dev={dev} onChanged={onChanged} />}
            {tab === 'real' && <CostRealityTab devId={dev.id} />}
            {tab === 'bom' && <BomTab devId={dev.id} />}
            {tab === 'qualidade' && <QualityTab devId={dev.id} />}
            {tab === 'reposicao' && <RestockTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
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
  const removeFormFile = async () => {
    const u = form.file_url; setForm(f => ({ ...f, file_url: '', file_type: '' }))
    if (u) { try { await api('/product-os/delete-file', { method: 'POST', body: JSON.stringify({ url: u }) }) } catch { /* arquivo solto, segue */ } }
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
          <UploadButton label="Subir arquivo (STL/3MF/STEP)" accept=".stl,.3mf,.step,.obj" onUploaded={(urls, files) => { setForm(f => ({ ...f, file_url: urls[0], file_type: fileTypeOf(files[0].name) })); void fetch3mfMetrics(urls[0], files[0].name).then(m => { if (m) setForm(f => ({ ...f, material: m.material ?? f.material, weight_g: m.weight_g ?? f.weight_g, print_time_minutes: m.print_time_minutes ?? f.print_time_minutes })) }) }} />
          {form.file_url && <span className="flex items-center gap-1.5 text-[10px]" style={{ color: '#4ade80' }}>✓ arquivo enviado ({form.file_type}) <button onClick={() => void removeFormFile()} className="flex items-center gap-0.5" style={{ color: '#f87171' }}><Trash2 size={10} /> remover</button></span>}
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
  const removeFile = async () => { if (!(await confirmDialog({ title: 'Excluir arquivo', message: 'Excluir o arquivo do storage? Libera espaço e não dá pra desfazer.', danger: true, confirmLabel: 'Excluir' }))) return; setBusy(true); setErr(''); try { await api(`/product-os/versions/${v.id}/remove-file`, { method: 'POST' }); onChanged() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) } }
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
          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]" style={{ color: '#a1a1aa' }}>{v.material && <span>{v.material}</span>}{v.weight_g != null && <span>{v.weight_g} g</span>}{v.print_time_minutes != null && <span>{v.print_time_minutes} min</span>}{v.volume_cm3 != null && <span>{v.volume_cm3} cm³</span>}{v.file_url && <a href={v.file_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">arquivo</a>}{v.file_url && <button onClick={() => void removeFile()} disabled={busy} className="flex items-center gap-0.5 disabled:opacity-50" style={{ color: '#f87171' }}><Trash2 size={10} /> excluir arquivo</button>}</div>
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

// ── PEÇAS & MONTAGEM ──────────────────────────────────────────────────
function PartsTab({ dev, onChanged }: { dev: DevDetail; onChanged: () => void }) {
  const [parts, setParts] = useState<Part[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState('')
  const [name, setName] = useState(''); const [qpp, setQpp] = useState('1'); const [optional, setOptional] = useState(false); const [adding, setAdding] = useState(false)
  const [dims, setDims] = useState({ w: '', d: '', h: '' })
  const [cost, setCost] = useState<PartCost | null>(null); const [costBusy, setCostBusy] = useState(false); const [margin, setMargin] = useState('30')
  const [suggesting, setSuggesting] = useState(false); const [suggestions, setSuggestions] = useState<PartSuggestion[] | null>(null); const [suggestSource, setSuggestSource] = useState<'briefing' | 'ia'>('ia'); const [picked, setPicked] = useState<Set<number>>(new Set()); const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setParts(await api<Part[]>(`/product-os/parts?product_dev_id=${dev.id}`)) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) }
  }, [dev.id])
  useEffect(() => { void load() }, [load])

  const numOrNull = (s: string) => { const n = Number(s); return s.trim() && Number.isFinite(n) && n > 0 ? n : null }
  const add = async () => {
    if (!name.trim()) { setErr('Dê um nome à peça (ex: Base, Cúpula)'); return }
    setAdding(true); setErr('')
    try { await api('/product-os/parts', { method: 'POST', body: JSON.stringify({ product_dev_id: dev.id, name: name.trim(), qty_per_product: Number(qpp) || 1, is_optional: optional, width_mm: numOrNull(dims.w), depth_mm: numOrNull(dims.d), height_mm: numOrNull(dims.h) }) }); setName(''); setQpp('1'); setOptional(false); setDims({ w: '', d: '', h: '' }); await load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setAdding(false) }
  }
  const computeCost = async () => {
    setCostBusy(true); setErr('')
    try { setCost(await api<PartCost>('/product-os/cost-from-parts', { method: 'POST', body: JSON.stringify({ product_dev_id: dev.id, target_margin_pct: Number(margin) || 30 }) })); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setCostBusy(false) }
  }
  const suggest = async () => {
    setSuggesting(true); setErr(''); setSuggestions(null)
    try { const r = await api<{ source: 'briefing' | 'ia'; suggestions: PartSuggestion[] }>('/product-os/suggest-parts', { method: 'POST', body: JSON.stringify({ product_dev_id: dev.id }) }); setSuggestions(r.suggestions); setSuggestSource(r.source); setPicked(new Set(r.suggestions.map((_, i) => i))) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setSuggesting(false) }
  }
  const createSelected = async () => {
    if (!suggestions) return
    const chosen = suggestions.filter((_, i) => picked.has(i))
    if (!chosen.length) { setErr('Marque ao menos uma peça'); return }
    setCreating(true); setErr('')
    try { await api('/product-os/parts/bulk', { method: 'POST', body: JSON.stringify({ product_dev_id: dev.id, parts: chosen.map(s => ({ name: s.name, qty_per_product: s.qty_per_product, is_optional: s.is_optional, width_mm: s.width_mm, depth_mm: s.depth_mm, height_mm: s.height_mm })) }) }); setSuggestions(null); await load(); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setCreating(false) }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>Um produto pode ser feito de várias <b style={{ color: '#a5f3fc' }}>peças</b> imprimíveis (base, cúpula, conector…). Cada peça tem seus arquivos e pode ser <b style={{ color: '#a5f3fc' }}>produzida sozinha</b>; a <b style={{ color: '#a5f3fc' }}>montagem</b> junta as peças prontas no produto final.</p>
      {dev.code && <p className="text-[11px]" style={{ color: '#71717a' }}>Código do produto: <span className="font-mono font-bold" style={{ color: '#00E5FF' }}>{dev.code}</span> — cada peça é um sub-código sequencial dele.</p>}
      {err && <div className="whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

      {/* nova peça */}
      <div className="rounded-lg p-3 space-y-2" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="flex items-center gap-2"><p className="text-xs font-bold text-white">Nova peça</p>
          <button onClick={() => void suggest()} disabled={suggesting} className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.10)', color: '#a5f3fc', border: '1px solid #27272a' }}>{suggesting ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Sugerir peças com IA</button>
        </div>
        <div className="grid grid-cols-2 gap-2"><Input label="Nome da peça" value={name} onChange={setName} /><Input label="Qtd por produto" value={qpp} onChange={setQpp} /></div>
        <div className="grid grid-cols-3 gap-2"><Input label="Largura (mm)" value={dims.w} onChange={v => setDims(d => ({ ...d, w: v }))} /><Input label="Profund. (mm)" value={dims.d} onChange={v => setDims(d => ({ ...d, d: v }))} /><Input label="Altura (mm)" value={dims.h} onChange={v => setDims(d => ({ ...d, h: v }))} /></div>
        <p className="text-[9px]" style={{ color: '#52525b' }}>Dimensões são opcionais — alimentam o plano de pratos (quantas cabem na mesa).</p>
        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: '#a1a1aa' }}><input type="checkbox" checked={optional} onChange={e => setOptional(e.target.checked)} /> Peça opcional (não trava a montagem)</label>
        <button onClick={() => void add()} disabled={adding} className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Adicionar peça</button>
      </div>

      {/* sugestões da IA */}
      {suggestions && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.2)' }}>
          <p className="text-xs font-bold text-white">{suggestSource === 'briefing' ? '🧩 Peças do briefing' : '🤖 Peças sugeridas pela IA'} <span className="font-normal" style={{ color: '#71717a' }}>— marque as que quer criar</span></p>
          {suggestions.length === 0 && <p className="text-[11px]" style={{ color: '#fcd34d' }}>A IA não sugeriu peças (talvez seja 1 peça só). Cadastre manualmente acima.</p>}
          {suggestions.map((s, i) => (
            <label key={i} className="flex items-start gap-2 rounded p-2 text-[11px]" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f', cursor: 'pointer' }}>
              <input type="checkbox" checked={picked.has(i)} onChange={e => setPicked(p => { const n = new Set(p); if (e.target.checked) n.add(i); else n.delete(i); return n })} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="font-bold text-white">{s.name}</span> <span style={{ color: '#a1a1aa' }}>×{s.qty_per_product}/produto</span>
                {(s.width_mm || s.depth_mm || s.height_mm) && <span style={{ color: '#52525b' }}> · {s.width_mm ?? '?'}×{s.depth_mm ?? '?'}×{s.height_mm ?? '?'}mm</span>}
                {s.rationale && <p style={{ color: '#71717a' }}>{s.rationale}</p>}
              </div>
            </label>
          ))}
          {suggestions.length > 0 && <div className="flex gap-2"><button onClick={() => void createSelected()} disabled={creating} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Criar {picked.size} peça(s)</button><button onClick={() => setSuggestions(null)} className="rounded-lg px-3 py-1.5 text-xs" style={{ background: '#0a0a0e', color: '#71717a', border: '1px solid #27272a' }}>descartar</button></div>}
        </div>
      )}

      {loading ? <p className="text-xs" style={{ color: '#52525b' }}>Carregando peças…</p>
        : parts.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Nenhuma peça ainda. Produto de peça única? Use a aba <b>Versões</b> normalmente.</p>
        : parts.map(p => <PartCard key={p.id} part={p} dev={dev} onChanged={() => { void load(); onChanged() }} />)}

      {/* custo somado */}
      {parts.length > 0 && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
          <div className="flex items-end gap-2">
            <Input label="Margem-alvo (%)" value={margin} onChange={setMargin} />
            <button onClick={() => void computeCost()} disabled={costBusy} className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF', height: 34 }}>{costBusy ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />} Custo (peças + insumos)</button>
          </div>
          {cost && (
            <div className="space-y-2">
              {cost.missing_versions.length > 0 && <p className="text-[10px]" style={{ color: '#fcd34d' }}>⚠️ Sem peso/tempo nas peças: {cost.missing_versions.join(', ')}. Adicione uma versão (com material e peso) pra contar o filamento.</p>}
              <div className="space-y-1">
                {cost.parts.map(l => (
                  <div key={l.part_id} className="flex items-center justify-between text-[11px]"><span style={{ color: '#d4d4d8' }}>{l.name} <span style={{ color: '#52525b' }}>×{l.qty_per_product}{l.weight_g != null ? ` · ${l.weight_g}g` : ''}{l.print_minutes != null ? ` · ${l.print_minutes}min` : ''}</span></span><span style={{ color: '#a1a1aa' }}>R$ {l.line_cost.toFixed(2)}</span></div>
                ))}
                {cost.insumos.map((l, i) => <div key={i} className="flex items-center justify-between text-[11px]"><span style={{ color: '#d4d4d8' }}>{l.description ?? l.kind} <span style={{ color: '#52525b' }}>({l.kind})</span></span><span style={{ color: '#a1a1aa' }}>R$ {l.line_cost.toFixed(2)}</span></div>)}
                {cost.cost.packaging > 0 && <div className="flex items-center justify-between text-[11px]"><span style={{ color: '#d4d4d8' }}>Embalagem</span><span style={{ color: '#a1a1aa' }}>R$ {cost.cost.packaging.toFixed(2)}</span></div>}
              </div>
              <div className="flex items-center justify-between border-t pt-1.5 text-xs font-bold" style={{ borderColor: '#27272a', color: '#fafafa' }}><span>Custo total / produto</span><span style={{ color: '#00E5FF' }}>R$ {cost.cost.total.toFixed(2)}</span></div>
              <div className="grid grid-cols-2 gap-1.5">
                {cost.suggested_prices.map(s => <div key={s.channel} className="rounded p-1.5 text-[10px]" style={{ background: '#111114', border: '1px solid #1a1a1f' }}><span style={{ color: '#71717a' }}>{CHANNEL_LABEL[s.channel] ?? s.channel}</span><div className="font-bold" style={{ color: '#4ade80' }}>R$ {s.price.toFixed(2)}</div><span style={{ color: '#52525b' }}>margem {s.margin_pct}%</span></div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* plano de pratos */}
      {parts.length > 0 && <PlatePlanSection devId={dev.id} />}

      {/* montagem */}
      {parts.length > 0 && <AssemblySection devId={dev.id} onChanged={() => { void load(); onChanged() }} />}
    </div>
  )
}

function PlatePlanSection({ devId }: { devId: string }) {
  const [qty, setQty] = useState('10'); const [plan, setPlan] = useState<PlatePlan | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const compute = async () => {
    setBusy(true); setErr('')
    try { setPlan(await api<PlatePlan>('/product-os/plate-plan', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, quantity: Number(qty) || 1 }) })) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-2"><Layers size={13} style={{ color: '#a5f3fc' }} /><p className="text-xs font-bold text-white">Plano de pratos (aproveitamento da mesa)</p></div>
      <p className="text-[11px]" style={{ color: '#a1a1aa' }}>Estima quantas unidades de cada peça cabem num prato e quantos pratos pra produzir X produtos. Precisa das dimensões da peça (largura/profundidade).</p>
      {err && <div className="rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <div className="flex items-end gap-2">
        <Input label="Qtd de produtos" value={qty} onChange={setQty} />
        <button onClick={() => void compute()} disabled={busy} className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF', height: 34 }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />} Calcular pratos</button>
      </div>
      {plan && (
        <div className="space-y-1.5">
          <p className="text-[10px]" style={{ color: '#71717a' }}>Mesa usada: <b style={{ color: '#a5f3fc' }}>{plan.bed.name}</b> ({plan.bed.x}×{plan.bed.y}×{plan.bed.z}mm) · folga {plan.gap_mm}mm</p>
          {plan.missing_dims.length > 0 && <p className="text-[10px]" style={{ color: '#fcd34d' }}>⚠️ Sem dimensões: {plan.missing_dims.join(', ')} — edite a peça e informe largura/profundidade.</p>}
          {plan.lines.map(l => (
            <div key={l.part_id} className="flex items-center justify-between rounded p-1.5 text-[11px]" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
              <span style={{ color: '#d4d4d8' }}>{l.name} <span style={{ color: '#52525b' }}>· precisa {l.needed}</span></span>
              {l.per_plate == null ? <span style={{ color: '#71717a' }}>{l.fit_note ?? 'sem dimensões'}</span>
                : l.per_plate === 0 ? <span style={{ color: '#f87171' }}>não cabe — {l.fit_note}</span>
                : <span style={{ color: '#4ade80' }}>{l.per_plate}/prato · <b>{l.plates} prato(s)</b>{l.plate_minutes ? <span style={{ color: '#52525b' }}> · ~{Math.round(l.plate_minutes / 60)}h/prato</span> : ''}</span>}
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-1.5 text-xs font-bold" style={{ borderColor: '#27272a', color: '#fafafa' }}><span>Total de pratos</span><span style={{ color: '#00E5FF' }}>{plan.total_plates}</span></div>
          <p className="text-[10px]" style={{ color: '#52525b' }}>{plan.note}</p>
        </div>
      )}
    </div>
  )
}

function PartCard({ part, dev, onChanged }: { part: Part; dev: DevDetail; onChanged: () => void }) {
  const [open, setOpen] = useState(false); const [printing, setPrinting] = useState(false); const [editing, setEditing] = useState(false)
  const [err, setErr] = useState(''); const [name, setName] = useState(part.name); const [qpp, setQpp] = useState(String(part.qty_per_product))
  const [pdims, setPdims] = useState({ w: part.width_mm != null ? String(part.width_mm) : '', d: part.depth_mm != null ? String(part.depth_mm) : '', h: part.height_mm != null ? String(part.height_mm) : '' })
  const prompt = usePrompt()
  const numOrNull = (s: string) => { const n = Number(s); return s.trim() && Number.isFinite(n) && n > 0 ? n : null }

  const save = async () => {
    setErr('')
    try { await api(`/product-os/parts/${part.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim(), qty_per_product: Number(qpp) || 1, width_mm: numOrNull(pdims.w), depth_mm: numOrNull(pdims.d), height_mm: numOrNull(pdims.h) }) }); setEditing(false); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }
  const del = async () => {
    if (!(await confirmDialog({ title: 'Excluir peça', message: `Excluir "${part.name}"? Apaga também as versões/arquivos dela. Não dá pra desfazer.`, danger: true, confirmLabel: 'Excluir' }))) return
    setErr('')
    try { await api(`/product-os/parts/${part.id}/delete`, { method: 'POST' }); onChanged() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }
  const adjust = async () => {
    const v = await prompt({ title: 'Ajustar estoque de peças', message: `Quantas "${part.name}" prontas você tem em mãos? (define o valor absoluto)`, defaultValue: String(part.stock_qty), placeholder: '0', confirmLabel: 'Ajustar' })
    if (v == null) return
    setErr('')
    try { await api(`/product-os/parts/${part.id}/adjust-stock`, { method: 'POST', body: JSON.stringify({ quantity: Number(v) || 0 }) }); onChanged() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }
  const stockOut = async () => {
    const q = await prompt({ title: 'Saída p/ SAC / reposição', message: `Quantas "${part.name}" vão sair do estoque? (disponível: ${part.available})`, placeholder: '1', confirmLabel: 'Continuar' })
    if (q == null) return
    const n = Number(q); if (!Number.isFinite(n) || n <= 0) { setErr('Quantidade inválida'); return }
    const reason = await prompt({ title: 'Motivo da saída', message: 'Pra quê? (ex: reposição SAC pedido #123, peça quebrada, amostra)', placeholder: 'reposição SAC', confirmLabel: 'Dar baixa' })
    setErr('')
    try { await api(`/product-os/parts/${part.id}/stock-out`, { method: 'POST', body: JSON.stringify({ quantity: n, reason: reason ?? 'Saída p/ reposição/SAC' }) }); onChanged() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-2">
        <Boxes size={13} style={{ color: '#a5f3fc' }} />
        {editing ? (
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <input value={name} onChange={e => setName(e.target.value)} className="flex-1 rounded px-1.5 py-0.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
              <input value={qpp} onChange={e => setQpp(e.target.value)} className="w-12 rounded px-1.5 py-0.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} title="qtd/produto" />
              <button onClick={() => void save()} className="text-[10px] font-bold" style={{ color: '#4ade80' }}>salvar</button>
              <button onClick={() => { setEditing(false); setName(part.name); setQpp(String(part.qty_per_product)); setPdims({ w: part.width_mm != null ? String(part.width_mm) : '', d: part.depth_mm != null ? String(part.depth_mm) : '', h: part.height_mm != null ? String(part.height_mm) : '' }) }} className="text-[10px]" style={{ color: '#71717a' }}>cancelar</button>
            </div>
            <div className="flex items-center gap-1.5">
              {(['w', 'd', 'h'] as const).map((k, i) => <input key={k} value={pdims[k]} onChange={e => setPdims(p => ({ ...p, [k]: e.target.value }))} placeholder={['larg', 'prof', 'alt'][i] + ' mm'} className="w-16 rounded px-1.5 py-0.5 text-[10px] outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />)}
            </div>
          </div>
        ) : (
          <>
            {part.code && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold font-mono" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>{part.code}</span>}
            <span className="text-xs font-bold text-white">{part.name}</span>
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: '#1a1a1f', color: '#a1a1aa' }}>×{part.qty_per_product}/produto</span>
            {(part.width_mm || part.depth_mm) && <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: '#1a1a1f', color: '#71717a' }}>{part.width_mm ?? '?'}×{part.depth_mm ?? '?'}{part.height_mm ? `×${part.height_mm}` : ''}mm</span>}
            {part.is_optional && <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: '#1a1a1f', color: '#71717a' }}>opcional</span>}
            <button onClick={() => setEditing(true)} className="ml-auto text-[10px]" style={{ color: '#71717a' }}>editar</button>
            <button onClick={() => void del()} className="flex items-center gap-0.5 text-[10px]" style={{ color: '#f87171' }}><Trash2 size={10} /></button>
          </>
        )}
      </div>
      {err && <p className="mt-1 text-[10px]" style={{ color: '#f87171' }}>{err}</p>}

      {/* estoque de peças prontas */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
        <span className="rounded px-2 py-1 font-bold" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>{part.available} disponíveis</span>
        <span style={{ color: '#71717a' }}>{part.stock_qty} prontas · {part.reserved_qty} reservadas</span>
        <div className="ml-auto flex items-center gap-2">
          {part.available > 0 && <button onClick={() => void stockOut()} className="text-[10px]" style={{ color: '#fcd34d' }}>saída SAC/reposição</button>}
          <button onClick={() => void adjust()} className="text-[10px]" style={{ color: '#a5f3fc' }}>ajustar</button>
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        <button onClick={() => setPrinting(true)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}><Factory size={10} /> Imprimir esta peça</button>
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: '#0a0a0e', color: '#a1a1aa', border: '1px solid #27272a' }}><FileBox size={10} /> Versões/arquivos {open ? '▲' : '▼'}</button>
      </div>

      {open && <PartVersionsEditor partId={part.id} onChanged={onChanged} />}
      {printing && <PartOrderModal part={part} devId={dev.id} onClose={() => setPrinting(false)} onCreated={() => { setPrinting(false); onChanged() }} />}
    </div>
  )
}

function PartVersionsEditor({ partId, onChanged }: { partId: string; onChanged: () => void }) {
  const [versions, setVersions] = useState<Version[]>([]); const [loading, setLoading] = useState(true); const [err, setErr] = useState('')
  const [form, setForm] = useState<{ changelog: string; file_url: string; file_type: string; material: string; weight_g: string; print_time_minutes: string; filaments: Filament[] }>({ changelog: '', file_url: '', file_type: '', material: '', weight_g: '', print_time_minutes: '', filaments: [] }); const [adding, setAdding] = useState(false)
  const [slicer, setSlicer] = useState(''); const [showSlicer, setShowSlicer] = useState(false); const [parsing, setParsing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setVersions(await api<Version[]>(`/product-os/parts/${partId}/versions`)) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) }
  }, [partId])
  useEffect(() => { void load() }, [load])

  const importSlicer = async () => {
    setParsing(true); setErr('')
    try {
      const r = await api<{ weight_g: number | null; print_time_minutes: number | null; material: string | null }>('/product-os/parse-slicer', { method: 'POST', body: JSON.stringify({ text: slicer }) })
      if (r.weight_g == null && r.print_time_minutes == null) { setErr('Não encontrei peso/tempo no texto.'); return }
      setForm(f => ({ ...f, weight_g: r.weight_g != null ? String(r.weight_g) : f.weight_g, print_time_minutes: r.print_time_minutes != null ? String(r.print_time_minutes) : f.print_time_minutes, material: r.material ?? f.material }))
      setShowSlicer(false); setSlicer('')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setParsing(false) }
  }
  const add = async () => {
    setAdding(true); setErr('')
    try { await api(`/product-os/parts/${partId}/versions`, { method: 'POST', body: JSON.stringify({ changelog: form.changelog || undefined, file_url: form.file_url || undefined, file_type: form.file_type || undefined, material: form.material || undefined, weight_g: form.weight_g ? Number(form.weight_g) : undefined, print_time_minutes: form.print_time_minutes ? Number(form.print_time_minutes) : undefined, filaments: form.filaments.length ? form.filaments : undefined }) }); setForm({ changelog: '', file_url: '', file_type: '', material: '', weight_g: '', print_time_minutes: '', filaments: [] }); await load(); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setAdding(false) }
  }

  return (
    <div className="mt-2 rounded-lg p-2.5 space-y-2" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
      {err && <p className="text-[10px]" style={{ color: '#f87171' }}>{err}</p>}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2"><span className="text-[10px] font-bold" style={{ color: '#a1a1aa' }}>Nova versão da peça</span><button onClick={() => setShowSlicer(s => !s)} className="ml-auto text-[10px]" style={{ color: '#a5f3fc' }}>importar do slicer</button></div>
        {showSlicer && (
          <div className="space-y-1.5 rounded p-2" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <textarea value={slicer} onChange={e => setSlicer(e.target.value)} rows={2} placeholder="Cole o resumo do Bambu/Orca (peso, tempo, material)" className="w-full rounded px-2 py-1 text-[10px] outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
            <button onClick={() => void importSlicer()} disabled={parsing || !slicer.trim()} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>{parsing ? <Loader2 size={10} className="animate-spin" /> : <Cpu size={10} />} Extrair</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <UploadButton label="Subir STL/3MF" accept=".stl,.3mf,.step,.obj" onUploaded={(urls, files) => { setForm(f => ({ ...f, file_url: urls[0], file_type: fileTypeOf(files[0].name) })); void fetch3mfMetrics(urls[0], files[0].name).then(async m => { if (!m) return; setForm(f => ({ ...f, material: m.material ?? f.material, weight_g: m.weight_g ?? f.weight_g, print_time_minutes: m.print_time_minutes ?? f.print_time_minutes, filaments: m.filaments ?? [] })); if (m.width_mm || m.depth_mm || m.height_mm) { try { await api(`/product-os/parts/${partId}`, { method: 'PATCH', body: JSON.stringify({ width_mm: m.width_mm ?? null, depth_mm: m.depth_mm ?? null, height_mm: m.height_mm ?? null }) }) } catch { /* dims best-effort; NÃO chama onChanged aqui — recarregaria e fecharia o formulário no meio do upload */ } } }) }} />
          {form.file_url && <span className="text-[10px]" style={{ color: '#4ade80' }}>✓ {form.file_type}</span>}
        </div>
        {form.filaments.length > 1 && (
          <div className="rounded p-1.5 text-[10px]" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', color: '#d8b4fe' }}>
            🎨 {form.filaments.length} cores detectadas: {form.filaments.map(f => `${f.color ? '' : ''}${f.weight_g}g`).join(' + ')} — você escolhe o rolo de cada uma ao imprimir.
          </div>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          <Input label="Material" value={form.material} onChange={v => setForm(f => ({ ...f, material: v }))} />
          <Input label="Peso (g)" value={form.weight_g} onChange={v => setForm(f => ({ ...f, weight_g: v }))} />
          <Input label="Tempo (min)" value={form.print_time_minutes} onChange={v => setForm(f => ({ ...f, print_time_minutes: v }))} />
        </div>
        <button onClick={() => void add()} disabled={adding} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>{adding ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Adicionar versão</button>
      </div>
      {loading ? <p className="text-[10px]" style={{ color: '#52525b' }}>…</p> : versions.map(v => <PartVersionRow key={v.id} v={v} onChanged={load} />)}
    </div>
  )
}

function PartVersionRow({ v, onChanged }: { v: Version; onChanged: () => void | Promise<void> }) {
  const [edit, setEdit] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const [f, setF] = useState({ material: v.material ?? '', weight_g: v.weight_g != null ? String(v.weight_g) : '', print_time_minutes: v.print_time_minutes != null ? String(v.print_time_minutes) : '' })
  const noMetrics = v.weight_g == null
  const setApproval = async (approved: boolean) => { setBusy(true); setErr(''); try { await api(`/product-os/versions/${v.id}/approval`, { method: 'POST', body: JSON.stringify({ approved }) }); await onChanged() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) } }
  const save = async () => {
    setBusy(true); setErr('')
    try { await api(`/product-os/versions/${v.id}`, { method: 'PATCH', body: JSON.stringify({ material: f.material || null, weight_g: f.weight_g ? Number(f.weight_g) : null, print_time_minutes: f.print_time_minutes ? Number(f.print_time_minutes) : null }) }); setEdit(false); await onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <div className="rounded p-1.5 text-[10px]" style={{ background: '#111114', border: `1px solid ${v.approved ? 'rgba(74,222,128,0.35)' : noMetrics ? 'rgba(252,211,77,0.35)' : '#1a1a1f'}` }}>
      <div className="flex items-center gap-2">
        <span className="rounded px-1 py-0.5 font-bold" style={{ background: '#1a1a1f', color: '#a5f3fc' }}>v{v.version_number}</span>
        <span style={{ color: '#a1a1aa' }}>{v.material ?? '—'}{v.weight_g != null ? ` · ${v.weight_g}g` : ''}{v.print_time_minutes != null ? ` · ${v.print_time_minutes}min` : ''}</span>
        {v.file_url && <a href={v.file_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">arquivo</a>}
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setEdit(e => !e)} style={{ color: '#71717a' }}>{edit ? 'cancelar' : 'editar'}</button>
          <button onClick={() => void setApproval(true)} disabled={busy || noMetrics} title={noMetrics ? 'Preencha o peso antes de aprovar' : ''} className="rounded px-1.5 py-0.5 font-semibold disabled:opacity-40" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80' }}>aprovar</button>
          {v.approved && <span style={{ color: '#4ade80' }}>✓</span>}
        </div>
      </div>
      {noMetrics && !edit && <p className="mt-1" style={{ color: '#fcd34d' }}>⚠️ sem peso — clique em “editar” e preencha pra contar o filamento.</p>}
      {err && <p className="mt-1" style={{ color: '#f87171' }}>{err}</p>}
      {edit && (
        <div className="mt-1.5 space-y-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            <Input label="Material" value={f.material} onChange={x => setF(s => ({ ...s, material: x }))} />
            <Input label="Peso (g)" value={f.weight_g} onChange={x => setF(s => ({ ...s, weight_g: x }))} />
            <Input label="Tempo (min)" value={f.print_time_minutes} onChange={x => setF(s => ({ ...s, print_time_minutes: x }))} />
          </div>
          <button onClick={() => void save()} disabled={busy} className="flex items-center gap-1 rounded px-2 py-1 font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>{busy ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Salvar</button>
        </div>
      )}
    </div>
  )
}

function PartOrderModal({ part, devId, onClose, onCreated }: { part: Part; devId: string; onClose: () => void; onCreated: () => void }) {
  const [qty, setQty] = useState('1'); const [printerId, setPrinterId] = useState(''); const [printers, setPrinters] = useState<Printer[]>([])
  const [loadedInputId, setLoadedInputId] = useState('')
  const [filaments, setFilaments] = useState<Filament[]>([]); const [filMap, setFilMap] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [preview, setPreview] = useState<ConsumePreview | null>(null)
  useEffect(() => { void (async () => { try { setPrinters(await api<Printer[]>('/product-os/printers')) } catch { /* */ } })() }, [])
  // pega as cores da versão da peça (aprovada > última com arquivo). Se a versão não
  // tem as cores salvas (versão antiga), relê o .3mf na hora. Multicor = 1 rolo por cor;
  // 1 cor = auto-seleciona o rolo pela cor fatiada.
  useEffect(() => { void (async () => {
    try {
      const vs = await api<Version[]>(`/product-os/parts/${part.id}/versions`)
      const ref = vs.find(v => v.approved) ?? vs.find(v => v.file_url) ?? vs[0]
      let fils = (ref?.filaments && ref.filaments.length) ? ref.filaments : []
      if (!fils.length && ref?.file_url) { const m = await fetch3mfMetrics(ref.file_url, ref.file_url); if (m?.filaments?.length) fils = m.filaments }
      setFilaments(fils)
    } catch { setFilaments([]) }
  })() }, [part.id])
  const multicor = filaments.length > 1
  useEffect(() => {
    const n = Number(qty) || 0; if (n < 1) { setPreview(null); return }
    let cancel = false
    const t = setTimeout(() => { void (async () => {
      try { const p = await api<ConsumePreview>('/product-os/production-orders/preview', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, part_id: part.id, quantity: n }) }); if (!cancel) setPreview(p) } catch { if (!cancel) setPreview(null) }
    })() }, 350)
    return () => { cancel = true; clearTimeout(t) }
  }, [qty, devId, part.id])
  const create = async () => {
    setBusy(true); setErr('')
    try {
      const filament_map = multicor ? filaments.map(f => ({ index: f.index, input_id: filMap[f.index] })).filter(m => m.input_id) : undefined
      await api('/product-os/production-orders', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, part_id: part.id, quantity: Number(qty) || 1, printer_id: printerId || undefined, machine: printers.find(p => p.id === printerId)?.name || undefined, loaded_input_id: !multicor ? (loadedInputId || undefined) : undefined, filament_map }) }); onCreated()
    }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  const noWeight = !!preview && preview.lines.length === 0
  return (
    <Modal title={`Imprimir peça: ${part.name}`} onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <p className="mb-2 text-[11px]" style={{ color: '#a1a1aa' }}>Cria uma ordem de produção só desta peça. Ao concluir, as unidades entram no <b style={{ color: '#a5f3fc' }}>estoque de peças prontas</b> (não no produto — a montagem faz isso depois).</p>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Quantidade" value={qty} onChange={setQty} />
        <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Impressora</span>
          <select value={printerId} onChange={e => setPrinterId(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
            <option value="">— sem impressora —</option>{printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      {printerId && !multicor && <div className="mt-2"><SpoolPicker printerId={printerId} material={filaments[0]?.material} color={filaments[0]?.color} value={loadedInputId} onChange={setLoadedInputId} /></div>}
      {printerId && multicor && (
        <div className="mt-2 space-y-2 rounded-lg p-2.5" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#d8b4fe' }}>🎨 Peça multicor — escolha o rolo de cada cor</p>
          {filaments.map(f => (
            <div key={f.index} className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px]" style={{ color: '#d4d4d8', minWidth: 78 }}>
                {f.color && <span className="h-3 w-3 rounded-full border" style={{ background: f.color.startsWith('#') ? f.color : `#${f.color.slice(0, 6)}`, borderColor: '#3f3f46' }} />}
                Cor {f.index} <span style={{ color: '#52525b' }}>{f.weight_g}g</span>
              </span>
              <div className="flex-1"><SpoolPicker printerId={printerId} material={f.material} color={f.color} value={filMap[f.index] ?? ''} onChange={id => setFilMap(m => ({ ...m, [f.index]: id }))} /></div>
            </div>
          ))}
        </div>
      )}
      {noWeight && !multicor && <div className="mt-2 rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>⚠️ Esta peça está <b>sem peso</b> — nada de filamento será reservado nem custeado. Fatie o arquivo (.3mf) ou informe o peso na versão da peça antes de imprimir.</div>}
      {preview && preview.lines.length > 0 && (
        <div className="mt-2 rounded-lg p-2.5" style={{ background: '#0d0d10', border: '1px solid #27272a' }}>
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Vai consumir de filamento</span>
          {preview.lines.map((l, i) => <div key={i} className="flex items-center justify-between text-[11px]"><span style={{ color: '#d4d4d8' }}>{l.name}</span><span style={{ color: l.sufficient ? '#4ade80' : '#f87171' }}>{l.needed} {l.unit} <span style={{ color: '#52525b' }}>/ {l.available} disp.</span></span></div>)}
          {!preview.all_sufficient && <p className="mt-1 text-[10px]" style={{ color: '#fcd34d' }}>⚠️ Filamento insuficiente — reponha antes de concluir.</p>}
        </div>
      )}
      <div className="mt-3 flex justify-end"><button onClick={() => void create()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Factory size={12} />} Criar ordem da peça</button></div>
    </Modal>
  )
}

function AssemblySection({ devId, onChanged }: { devId: string; onChanged: () => void }) {
  const [qty, setQty] = useState('1'); const [preview, setPreview] = useState<AssemblyPreview | null>(null)
  const [orders, setOrders] = useState<AssemblyOrder[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState('')

  const loadOrders = useCallback(async () => { try { setOrders(await api<AssemblyOrder[]>(`/product-os/assemblies?product_dev_id=${devId}`)) } catch { /* */ } }, [devId])
  useEffect(() => { void loadOrders() }, [loadOrders])
  useEffect(() => {
    const n = Number(qty) || 0; if (n < 1) { setPreview(null); return }
    let cancel = false
    const t = setTimeout(() => { void (async () => {
      try { const p = await api<AssemblyPreview>('/product-os/assemblies/preview', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, quantity: n }) }); if (!cancel) setPreview(p) } catch { if (!cancel) setPreview(null) }
    })() }, 350)
    return () => { cancel = true; clearTimeout(t) }
  }, [qty, devId])

  const create = async () => {
    setBusy(true); setErr(''); setMsg('')
    try { await api('/product-os/assemblies', { method: 'POST', body: JSON.stringify({ product_dev_id: devId, quantity: Number(qty) || 1 }) }); setMsg('Montagem criada — peças e insumos reservados.'); await loadOrders(); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  const transition = async (aid: string, status: string) => {
    setErr('')
    try { await api(`/product-os/assemblies/${aid}/transition`, { method: 'POST', body: JSON.stringify({ status }) }); await loadOrders(); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }
  const nextAction: Record<string, { to: string; label: string } | undefined> = {
    fila: { to: 'montando', label: 'Iniciar montagem' }, montando: { to: 'embalado', label: 'Embalar' }, embalado: { to: 'disponivel', label: 'Disponível p/ venda' },
  }

  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.2)' }}>
      <div className="flex items-center gap-2"><Layers size={13} style={{ color: '#00E5FF' }} /><p className="text-xs font-bold text-white">Montar o produto</p></div>
      <p className="text-[11px]" style={{ color: '#a1a1aa' }}>Junta as peças prontas (+ embalagem/etiqueta) num produto acabado. Se faltar peça, mostro quanto e você gera a OP de impressão dela.</p>
      {err && <div className="whitespace-pre-line rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {msg && <div className="rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>}

      <div className="flex items-end gap-2">
        <Input label="Qtd a montar" value={qty} onChange={setQty} />
        <button onClick={() => void create()} disabled={busy || !preview?.all_sufficient} title={!preview?.all_sufficient ? 'Estoque insuficiente — veja as faltas abaixo' : ''} className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-40" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF', height: 34 }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />} Montar</button>
      </div>

      {preview && (
        <div className="space-y-1">
          {preview.parts.map(l => (
            <div key={l.part_id} className="flex items-center justify-between text-[11px]"><span style={{ color: '#d4d4d8' }}>{l.name}{l.is_optional ? ' (opcional)' : ''}</span><span style={{ color: l.sufficient ? '#4ade80' : '#f87171' }}>{l.needed} {l.unit} <span style={{ color: '#52525b' }}>/ {l.available} prontas</span>{!l.sufficient && !l.is_optional ? ` · faltam ${l.missing}` : ''}</span></div>
          ))}
          {preview.insumos.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]"><span style={{ color: '#d4d4d8' }}>{l.name}</span><span style={{ color: l.sufficient ? '#4ade80' : '#f87171' }}>{l.needed} {l.unit} <span style={{ color: '#52525b' }}>/ {l.available} disp.</span></span></div>
          ))}
          {!preview.all_sufficient && <p className="text-[10px]" style={{ color: '#fcd34d' }}>⚠️ Falta estoque. Gere as OPs de impressão das peças que faltam (botão &quot;Imprimir esta peça&quot; acima) e volte aqui.</p>}
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-1 border-t pt-2" style={{ borderColor: 'rgba(0,229,255,0.15)' }}>
          {orders.map(o => {
            const act = nextAction[o.status]
            return (
              <div key={o.id} className="flex items-center gap-2 text-[11px]">
                <span className="rounded px-1.5 py-0.5 font-bold" style={{ background: '#1a1a1f', color: '#a5f3fc' }}>#{o.order_number}</span>
                <span style={{ color: '#d4d4d8' }}>montar {o.quantity}</span>
                <span className="rounded px-1.5 py-0.5" style={{ background: '#111114', color: o.status === 'concluido' ? '#4ade80' : o.status === 'cancelado' ? '#71717a' : '#fcd34d' }}>{o.status}</span>
                <div className="ml-auto flex gap-1">
                  {act && <button onClick={() => void transition(o.id, act.to)} className="rounded px-2 py-0.5 font-semibold" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{act.label}</button>}
                  {(o.status === 'fila' || o.status === 'montando') && <button onClick={() => void transition(o.id, 'cancelado')} className="rounded px-2 py-0.5" style={{ background: '#0a0a0e', color: '#71717a', border: '1px solid #27272a' }}>cancelar</button>}
                </div>
              </div>
            )
          })}
        </div>
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
interface FailureStats {
  window_days: number
  total: { attempts: number; failures: number; rate: number | null }
  printers: Array<{ printer_id: string; name: string; attempts: number; failures: number; false_positives: number; rate: number | null; last_failure: { reason: string | null; detected_at: string } | null }>
}
interface FarmFailureRow {
  id: string; printer_id: string; printer_name: string; job_name: string | null; reason: string | null
  state: string | null; camera_url: string | null; auto_paused: boolean; acknowledged_at: string | null; false_positive: boolean; detected_at: string; open: boolean
}

/** T1-A: KPI de confiabilidade — taxa de falha por impressora + falhas recentes. */
function ReliabilityCard() {
  const [stats, setStats] = useState<FailureStats | null>(null)
  const [fails, setFails] = useState<FarmFailureRow[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { const [s, f] = await Promise.all([api<FailureStats>('/product-os/farm/failure-stats'), api<FarmFailureRow[]>('/product-os/farm/failures')]); setStats(s); setFails(f) } catch { /* */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const ack = async (id: string, fp: boolean) => { try { await api(`/product-os/farm/failures/${id}/ack`, { method: 'POST', body: JSON.stringify({ false_positive: fp }) }); void load() } catch { /* */ } }
  const rateColor = (r: number | null) => r == null ? '#52525b' : r < 5 ? '#4ade80' : r < 15 ? '#fcd34d' : '#f87171'
  if (loading || !stats || stats.printers.length === 0) return null
  const recent = fails.slice(0, 6)
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert size={14} className="text-cyan-400" />
        <span className="text-xs font-bold text-white">Confiabilidade · taxa de falha</span>
        <span className="text-[10px]" style={{ color: '#52525b' }}>últimos {stats.window_days} dias</span>
        {stats.total.rate != null && <span className="ml-auto text-[11px] font-bold" style={{ color: rateColor(stats.total.rate) }}>{stats.total.rate}% geral · {stats.total.failures}/{stats.total.attempts}</span>}
      </div>
      <div className="space-y-1.5">
        {stats.printers.map(p => (
          <div key={p.printer_id} className="rounded-lg px-2.5 py-1.5" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
            <div className="flex items-center gap-2 text-xs">
              <PrinterIcon size={12} style={{ color: '#71717a' }} />
              <span className="font-semibold text-white">{p.name}</span>
              <span className="ml-auto font-bold" style={{ color: rateColor(p.rate) }}>{p.rate == null ? 'sem dados' : `${p.rate}%`}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: '#18181b' }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, p.rate ?? 0)}%`, background: rateColor(p.rate) }} /></div>
              <span className="whitespace-nowrap text-[10px]" style={{ color: '#52525b' }}>{p.failures} falha(s) / {p.attempts} impr.{p.false_positives ? ` · ${p.false_positives} falso+` : ''}</span>
            </div>
          </div>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Falhas recentes</p>
          <div className="space-y-1">
            {recent.map(f => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: '#0a0a0e', border: `1px solid ${f.open ? 'rgba(239,68,68,0.35)' : '#1a1a1f'}` }}>
                <span style={{ color: f.false_positive ? '#52525b' : '#f87171' }}>{f.false_positive ? '⚪' : '🛑'}</span>
                <span className="truncate" style={{ color: '#d4d4d8' }}>{f.printer_name}{f.job_name ? ` · ${f.job_name}` : ''}{f.reason ? ` — ${f.reason}` : ''}</span>
                <span className="ml-auto whitespace-nowrap text-[10px]" style={{ color: '#52525b' }}>{new Date(f.detected_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                {f.open && <button type="button" onClick={() => void ack(f.id, false)} className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: '#27272a', color: '#e4e4e7' }}>ok</button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

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

      {/* material consumido (real, independe de preço de venda) */}
      {ov.material && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Kpi label="Filamento consumido" value={ov.material.filament_g_total >= 1000 ? `${(ov.material.filament_g_total / 1000).toFixed(2)} kg` : `${ov.material.filament_g_total.toFixed(0)} g`} sub={`${ov.material.filament_g_30d.toFixed(0)} g nos últimos 30d`} accent="#a5f3fc" />
          <Kpi label="Custo de material" value={money(ov.material.cost_total)} sub={`${money(ov.material.cost_30d)} nos últimos 30d`} accent="#fcd34d" />
        </div>
      )}

      {/* vendas reais (fecha o ciclo produzi→vendi→lucrei) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Faturamento (30d)" value={money(ov.sales.revenue_30d)} sub="vendas reais dos produtos publicados" accent="#4ade80" />
        <Kpi label="Lucro real (30d)" value={money(ov.sales.realized_profit_30d)} accent="#4ade80" />
        <Kpi label="Unidades vendidas (30d)" value={String(ov.sales.units_sold_30d)} accent="#a1a1aa" />
      </div>

      <MakeToOrderCard onOpen={onOpen} />
      <ProductionPlanCard onOpen={onOpen} />
      <SchedulerCard />
      <ReliabilityCard />

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

// ── Gerador de SKU ────────────────────────────────────────────────────
interface TaxOption { id: string; kind: string; code: string; label: string; parent_id: string | null }
interface SkuData {
  classification: { marca: TaxOption | null; categoria: TaxOption | null; sub: TaxOption | null; linha: TaxOption | null; caracteristica: TaxOption | null }
  base: string | null
  ean?: string | null
  variants: Array<{ id: string; sku: string; ean?: string | null; product_id: string | null; cor: { id: string; code: string; label: string } | null }>
}
function SegmentPicker({ label, kind, parentId, value, onChange, suggestLabel, alphaCode }: {
  label: string; kind: string; parentId: string | null; value: TaxOption | null
  onChange: (o: TaxOption | null) => void; suggestLabel?: string; alphaCode?: boolean
}) {
  const [opts, setOpts] = useState<TaxOption[]>([])
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState(''); const [newCode, setNewCode] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const topLevel = kind === 'marca' || kind === 'categoria' || kind === 'cor' || kind === 'linha'
  const blocked = !topLevel && !parentId
  const load = useCallback(async () => {
    if (blocked) { setOpts([]); return }
    try { setOpts(await api<TaxOption[]>(`/product-os/sku/taxonomy?kind=${kind}${parentId ? `&parent_id=${parentId}` : ''}`)) } catch { setOpts([]) }
  }, [kind, parentId, blocked])
  useEffect(() => { void load() }, [load])
  const create = async () => {
    if (!newLabel.trim()) return
    setBusy(true); setErr('')
    try {
      const o = await api<TaxOption>('/product-os/sku/taxonomy', { method: 'POST', body: JSON.stringify({ kind, label: newLabel.trim(), parent_id: parentId, code: alphaCode ? newCode.trim() : undefined }) })
      setAdding(false); setNewLabel(''); setNewCode(''); await load(); onChange(o)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  return (
    <div className="rounded-lg p-2" style={{ background: '#0a0a0e', border: '1px solid #27272a', opacity: blocked ? 0.5 : 1 }}>
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>{label}</p>
      {!adding ? (
        <>
          <select disabled={blocked} value={value?.id ?? ''} onChange={e => onChange(opts.find(o => o.id === e.target.value) ?? null)}
            className="w-full rounded px-1.5 py-1 text-[11px] text-white" style={{ background: '#111114', border: '1px solid #27272a' }}>
            <option value="">{blocked ? '(escolha o nível acima)' : '— escolher —'}</option>
            {value && !opts.some(o => o.id === value.id) && <option value={value.id}>{value.code} · {value.label}</option>}
            {opts.map(o => <option key={o.id} value={o.id}>{o.code} · {o.label}</option>)}
          </select>
          {!blocked && <button onClick={() => { setNewLabel(suggestLabel ?? ''); setAdding(true) }} className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-cyan-400"><Plus size={9} /> nova</button>}
        </>
      ) : (
        <div className="space-y-1">
          {alphaCode && <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="cód (VZ)" maxLength={4} className="w-full rounded px-1.5 py-1 text-[11px] text-white" style={{ background: '#111114', border: '1px solid #27272a' }} />}
          <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void create(); if (e.key === 'Escape') setAdding(false) }} placeholder="nome" className="w-full rounded px-1.5 py-1 text-[11px] text-white" style={{ background: '#111114', border: '1px solid #27272a' }} />
          <div className="flex gap-1">
            <button onClick={() => void create()} disabled={busy} className="flex-1 rounded px-1.5 py-1 text-[9px] font-bold" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>{busy ? '…' : 'criar'}</button>
            <button onClick={() => setAdding(false)} className="rounded px-1.5 py-1 text-[9px]" style={{ background: '#111114', color: '#71717a', border: '1px solid #27272a' }}>×</button>
          </div>
          {err && <p className="text-[9px]" style={{ color: '#f87171' }}>{err}</p>}
        </div>
      )}
    </div>
  )
}
function SkuBox({ label, code }: { label: string; code: string | null }) {
  return (
    <div className="flex flex-col items-center">
      <span className="mb-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>{label}</span>
      <div className="flex h-12 w-full min-w-[44px] items-center justify-center rounded-lg text-lg font-extrabold" style={{ background: '#0a0a0e', border: '1px solid #3f3f46', color: code ? '#fafafa' : '#3f3f46' }}>{code ?? '··'}</div>
    </div>
  )
}
function SkuTab({ dev }: { dev: DevDetail }) {
  const [data, setData] = useState<SkuData | null>(null)
  const [marca, setMarca] = useState<TaxOption | null>(null); const [cat, setCat] = useState<TaxOption | null>(null)
  const [sub, setSub] = useState<TaxOption | null>(null); const [linha, setLinha] = useState<TaxOption | null>(null); const [carac, setCarac] = useState<TaxOption | null>(null)
  const [cores, setCores] = useState<TaxOption[]>([]); const [selCor, setSelCor] = useState<string[]>([])
  const [newCor, setNewCor] = useState(''); const [addingCor, setAddingCor] = useState(false)
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api<SkuData>(`/product-os/${dev.id}/sku`); setData(d)
      setMarca(d.classification.marca); setCat(d.classification.categoria); setSub(d.classification.sub); setLinha(d.classification.linha); setCarac(d.classification.caracteristica)
      setSelCor(d.variants.map(v => v.cor?.id).filter(Boolean) as string[])
    } catch { /* */ } finally { setLoading(false) }
  }, [dev.id])
  useEffect(() => { void load() }, [load])
  const loadCores = useCallback(async () => { try { setCores(await api<TaxOption[]>('/product-os/sku/taxonomy?kind=cor')) } catch { /* */ } }, [])
  useEffect(() => { void loadCores() }, [loadCores])

  // Categoria/Sub puxadas da árvore do Mercado Livre (a que espelhamos)
  const [mlPath, setMlPath] = useState<Array<{ id: string; name: string }>>(dev.category_ml_path ?? [])
  const [mlQuery, setMlQuery] = useState(''); const [mlOpts, setMlOpts] = useState<MlCatOption[]>([]); const [mlBusy, setMlBusy] = useState(false)
  const searchMlCat = async () => { if (!mlQuery.trim()) return; setMlBusy(true); try { setMlOpts(await api<MlCatOption[]>(`/product-os/ml-categories/search?q=${encodeURIComponent(mlQuery.trim())}`)) } catch { setMlOpts([]) } finally { setMlBusy(false) } }
  const pickMlCat = async (o: MlCatOption) => {
    setMlBusy(true); setMsg('')
    try {
      const r = await api<{ category_ml_id: string | null; path: Array<{ id: string; name: string }> }>(`/product-os/${dev.id}/ml-category`, { method: 'POST', body: JSON.stringify({ category_id: o.id }) })
      setMlPath(r.path); setMlOpts([]); setMlQuery(''); await load(); setMsg('Categoria e Sub puxadas do Mercado Livre.')
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setMlBusy(false) }
  }

  const allSet = !!(marca && cat && sub && linha && carac)
  const previewBase = allSet ? `${marca!.code}${cat!.code}${sub!.code}${linha!.code}${carac!.code}` : null
  const dirty = previewBase !== (data?.base ?? null)

  const saveClass = async () => {
    if (!allSet) return
    setSaving(true); setMsg('')
    try { const d = await api<SkuData>(`/product-os/${dev.id}/sku`, { method: 'PUT', body: JSON.stringify({ marca_id: marca!.id, categoria_id: cat!.id, sub_id: sub!.id, linha_id: linha!.id, caracteristica_id: carac!.id }) }); setData(d); setMsg('SKU base salvo.') }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setSaving(false) }
  }
  const saveColors = async (ids: string[]) => {
    setSaving(true); setMsg('')
    try { const d = await api<SkuData>(`/product-os/${dev.id}/sku/colors`, { method: 'PUT', body: JSON.stringify({ cor_ids: ids }) }); setData(d); setSelCor(d.variants.map(v => v.cor?.id).filter(Boolean) as string[]); setMsg('Cores e SKUs atualizados.') }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setSaving(false) }
  }
  const createCor = async () => {
    if (!newCor.trim()) return
    setSaving(true)
    try { const o = await api<TaxOption>('/product-os/sku/taxonomy', { method: 'POST', body: JSON.stringify({ kind: 'cor', label: newCor.trim() }) }); setNewCor(''); setAddingCor(false); await loadCores(); if (data?.base) await saveColors([...selCor, o.id]) }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setSaving(false) }
  }
  const corCode = (id: string) => cores.find(c => c.id === id)?.code ?? '??'
  const copy = (t: string) => { try { void navigator.clipboard.writeText(t) } catch { /* */ } }
  const genEan = async () => {
    setSaving(true); setMsg('')
    try { const d = await api<SkuData>(`/product-os/${dev.id}/sku/generate-ean`, { method: 'POST', body: JSON.stringify({}) }); setData(d); setSelCor(d.variants.map(v => v.cor?.id).filter(Boolean) as string[]); setMsg('EAN gerado.') }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setSaving(false) }
  }
  const missingEan = !!data && (data.variants.length ? data.variants.some(v => !v.ean) : !data.ean)

  if (loading) return <div className="flex items-center gap-2 p-4 text-sm" style={{ color: '#71717a' }}><Loader2 size={14} className="animate-spin" /> Carregando…</div>
  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>O SKU é gerado pela taxonomia: <span className="font-mono text-white">MARCA+CATEGORIA+SUB+LINHA+CARACTERÍSTICA-COR</span>. A <span className="text-white">Linha</span> é uma coleção transversal (ex: “Ella”) que reúne produtos de qualquer categoria. A Característica diferencia o modelo dentro da linha. A Cor é a variação — cada cor vira um SKU.</p>

      {/* Categoria/Sub pela ÁRVORE DO MERCADO LIVRE (define os nós internos) */}
      <div className="rounded-lg p-2.5" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="mb-1 flex items-center gap-1.5"><Boxes size={12} className="text-cyan-400" /><span className="text-[11px] font-bold text-white">Categoria pela árvore do Mercado Livre</span></div>
        {mlPath.length > 0 && <p className="mb-1.5 text-[10px]" style={{ color: '#4ade80' }}>✓ {mlPath.map(p => p.name).join(' › ')}</p>}
        <p className="mb-1.5 text-[10px]" style={{ color: '#71717a' }}>Busque a categoria oficial do ML — ela define a <span className="text-white">Categoria</span> e a <span className="text-white">Sub</span> abaixo (cria os nós internos com código). Também dá pra editar na mão.</p>
        <div className="flex gap-1">
          <input value={mlQuery} onChange={e => setMlQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void searchMlCat() }} placeholder="ex: bandeja decorativa, suporte de maquiagem…" className="flex-1 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
          <button onClick={() => void searchMlCat()} disabled={mlBusy || !mlQuery.trim()} className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>{mlBusy ? <Loader2 size={11} className="animate-spin" /> : 'buscar'}</button>
        </div>
        {mlOpts.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {mlOpts.map(o => (
              <button key={o.id} onClick={() => void pickMlCat(o)} className="block w-full rounded px-2 py-1.5 text-left" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
                <p className="text-[11px] font-semibold text-white">{o.name}</p>
                <p className="truncate text-[9px]" style={{ color: '#52525b' }}>{o.path || o.id}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* seletores */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SegmentPicker label="Marca" kind="marca" parentId={null} value={marca} onChange={o => setMarca(o)} alphaCode />
        <SegmentPicker label="Categoria" kind="categoria" parentId={null} value={cat} onChange={o => { setCat(o); setSub(null) }} />
        <SegmentPicker label="Sub-categoria" kind="sub" parentId={cat?.id ?? null} value={sub} onChange={o => setSub(o)} />
        <SegmentPicker label="Linha (coleção)" kind="linha" parentId={null} value={linha} onChange={o => { setLinha(o); setCarac(null) }} />
        <SegmentPicker label="Característica" kind="caracteristica" parentId={linha?.id ?? null} value={carac} onChange={o => setCarac(o)} suggestLabel={dev.name} />
      </div>

      {/* preview estilo cartão */}
      <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="grid grid-cols-6 gap-1.5">
          <SkuBox label="Marca" code={marca?.code ?? null} />
          <SkuBox label="Categ." code={cat?.code ?? null} />
          <SkuBox label="Sub" code={sub?.code ?? null} />
          <SkuBox label="Linha" code={linha?.code ?? null} />
          <SkuBox label="Caract." code={carac?.code ?? null} />
          <SkuBox label="Cor" code={selCor.length ? corCode(selCor[0]) : null} />
        </div>
        <div className="mt-3 rounded-lg p-2.5 text-center" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
          <p className="font-mono text-xl font-extrabold tracking-wide" style={{ color: previewBase ? '#00E5FF' : '#3f3f46' }}>{previewBase ? `${previewBase}${selCor.length ? '-' + corCode(selCor[0]) : '-CC'}` : 'VZ········-··'}</p>
          {allSet && <p className="mt-1 text-[11px]" style={{ color: '#a1a1aa' }}>{[marca!.label, cat!.label, sub!.label, linha!.label, carac!.label].join(', ')}</p>}
        </div>
        <button onClick={() => void saveClass()} disabled={!allSet || saving || !dirty} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-40" style={{ background: '#00E5FF', color: '#0a0a0e' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {data?.base && !dirty ? 'SKU base salvo' : 'Gerar SKU base'}
        </button>
      </div>

      {/* cores → variantes */}
      <div className={data?.base ? '' : 'pointer-events-none opacity-40'}>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Cores do modelo (cada cor = 1 SKU)</p>
        <div className="flex flex-wrap gap-1.5">
          {cores.map(c => {
            const on = selCor.includes(c.id)
            return <button key={c.id} onClick={() => void saveColors(on ? selCor.filter(x => x !== c.id) : [...selCor, c.id])} disabled={saving} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: on ? 'rgba(0,229,255,0.12)' : '#0a0a0e', color: on ? '#00E5FF' : '#a1a1aa', border: on ? '1px solid rgba(0,229,255,0.35)' : '1px solid #27272a' }}>{c.code} · {c.label}</button>
          })}
          {!addingCor ? <button onClick={() => setAddingCor(true)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: '#0a0a0e', color: '#71717a', border: '1px dashed #3f3f46' }}><Plus size={10} /> nova cor</button> : (
            <span className="flex items-center gap-1">
              <input autoFocus value={newCor} onChange={e => setNewCor(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void createCor(); if (e.key === 'Escape') setAddingCor(false) }} placeholder="cor" className="w-24 rounded-full px-2.5 py-1 text-[11px] text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
              <button onClick={() => void createCor()} className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF' }}>ok</button>
            </span>
          )}
        </div>
        {data && data.variants.length > 0 && (
          <div className="mt-2 space-y-1">
            {data.variants.map(v => (
              <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
                <Barcode size={12} className="shrink-0 text-cyan-400" />
                <span className="font-mono font-bold text-white">{v.sku}</span>
                <span style={{ color: '#71717a' }}>{v.cor?.label}</span>
                {v.ean ? (
                  <button onClick={() => copy(v.ean!)} title="copiar EAN" className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold" style={{ background: '#111114', color: '#a5f3fc', border: '1px solid #27272a' }}>EAN {v.ean}</button>
                ) : <span className="ml-auto text-[10px]" style={{ color: '#52525b' }}>sem EAN</span>}
                {v.product_id && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>publicado</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EAN interno (1 clique) */}
      <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="mb-1.5 flex items-center gap-2">
          <Barcode size={14} className="text-cyan-400" />
          <span className="text-xs font-bold text-white">Código de barras (EAN-13)</span>
          {data && (
            <button onClick={() => void genEan()} disabled={saving} className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Barcode size={10} />} {missingEan ? 'Gerar EAN com 1 clique' : 'Gerar faltantes'}
            </button>
          )}
        </div>
        {data && data.variants.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
            <span style={{ color: '#71717a' }}>EAN do produto:</span>
            {data.ean ? <button onClick={() => copy(data.ean!)} title="copiar" className="font-mono font-bold" style={{ color: '#a5f3fc' }}>{data.ean}</button> : <span style={{ color: '#52525b' }}>ainda não gerado</span>}
          </div>
        )}
        <p className="mt-2 text-[10px] leading-relaxed" style={{ color: '#71717a' }}>
          EAN-13 válido com <span className="text-white">prefixo GS1 Brasil (789/790)</span>. Serve como código de barras na <span className="text-white">Shopee, TikTok, loja própria e no estoque/expedição</span>. ⚠️ Como não usa um <span className="text-white">prefixo de empresa GS1 próprio</span>, o restante é gerado por nós — é um código INTERNO, não um GTIN oficial registrado. No <span className="text-white">Mercado Livre</span>, marque “não possui código universal” e use como SKU do vendedor (o ML valida GTIN oficial contra a GS1). Para GTIN 100% oficial, registre um prefixo na GS1 Brasil e cole aqui.
        </p>
      </div>
      {msg && <p className="text-[11px]" style={{ color: msg.includes('Erro') ? '#f87171' : '#4ade80' }}>{msg}</p>}
    </div>
  )
}
interface Suggestion { marca: string | null; marca_code: string | null; categoria: string | null; sub: string | null; linha: string | null; caracteristica: string | null }
interface MlCat { id: string | null; name: string | null; path: string | null }
interface MlCatOption { id: string; name: string; path: string }
interface EnrichResult { ficha: { title: string; description: string; brand: string; bullets: string[]; attributes: Record<string, string>; tags: string[] }; suggestion: Suggestion; ml_category: MlCat; already_ready: boolean }

// Ficha de catálogo — a transição projeto → produto pronto para a IA Criativo.
// A IA preenche a partir da fonte (MakerWorld etc.); o operador revisa/edita, define
// a LINHA de produtos (obrigatória) e marca "pronto". Publicar leva tudo pro catálogo.
function FichaTab({ dev, onChanged }: { dev: DevDetail; onChanged: () => void }) {
  const [title, setTitle] = useState(dev.catalog_title ?? '')
  const [desc, setDesc] = useState(dev.catalog_description ?? '')
  const [brand, setBrand] = useState(dev.catalog_brand ?? '')
  const [bullets, setBullets] = useState<string[]>(dev.catalog_bullets ?? [])
  const [attrs, setAttrs] = useState<Array<[string, string]>>(Object.entries(dev.catalog_attributes ?? {}))
  const [tags, setTags] = useState((dev.catalog_tags ?? []).join(', '))
  const [ready, setReady] = useState(!!dev.catalog_ready)
  const [suggestion, setSuggestion] = useState<Suggestion | null>((dev.enrichment as { suggestion?: Suggestion } | null)?.suggestion ?? null)
  const [sku, setSku] = useState<SkuData | null>(null)
  const [enriching, setEnriching] = useState(false); const [saving, setSaving] = useState(false); const [applying, setApplying] = useState(false)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  // categoria do Mercado Livre (árvore real)
  const initPath = (dev.category_ml_path ?? []).map(p => p.name).join(' › ')
  const [mlCat, setMlCat] = useState<MlCat>({ id: dev.category_ml_id ?? null, name: (dev.category_ml_path ?? []).slice(-1)[0]?.name ?? null, path: initPath || null })
  const [mlQuery, setMlQuery] = useState(''); const [mlOpts, setMlOpts] = useState<MlCatOption[]>([]); const [mlSearching, setMlSearching] = useState(false); const [mlOpen, setMlOpen] = useState(false)

  const searchMl = async () => {
    if (!mlQuery.trim()) return
    setMlSearching(true)
    try { setMlOpts(await api<MlCatOption[]>(`/product-os/ml-categories/search?q=${encodeURIComponent(mlQuery.trim())}`)) } catch { setMlOpts([]) } finally { setMlSearching(false) }
  }
  const pickMl = async (o: MlCatOption | null) => {
    setSaving(true); setErr(''); setMsg('')
    try {
      const r = await api<{ category_ml_id: string | null; path: Array<{ id: string; name: string }> }>(`/product-os/${dev.id}/ml-category`, { method: 'POST', body: JSON.stringify({ category_id: o?.id ?? null }) })
      setMlCat({ id: r.category_ml_id, name: r.path.slice(-1)[0]?.name ?? null, path: r.path.length ? r.path.map(p => p.name).join(' › ') : null })
      setMlOpen(false); setMlOpts([]); setMlQuery(''); setMsg(o ? 'Categoria do ML definida.' : 'Categoria do ML removida.'); onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setSaving(false) }
  }

  const loadSku = useCallback(async () => { try { setSku(await api<SkuData>(`/product-os/${dev.id}/sku`)) } catch { /* */ } }, [dev.id])
  useEffect(() => { void loadSku() }, [loadSku])

  // Linhas (coleções transversais, ex: "Ella") — escolher existente ou criar nova
  const [lines, setLines] = useState<TaxOption[]>([])
  const [newLine, setNewLine] = useState(''); const [assigningLine, setAssigningLine] = useState(false)
  const loadLines = useCallback(async () => { try { setLines(await api<TaxOption[]>('/product-os/lines')) } catch { /* */ } }, [])
  useEffect(() => { void loadLines() }, [loadLines])
  const assignLine = async (body: { line_id?: string; line_name?: string }) => {
    setAssigningLine(true); setErr(''); setMsg('')
    try {
      const d = await api<SkuData>(`/product-os/${dev.id}/line`, { method: 'POST', body: JSON.stringify(body) })
      setSku(d); setNewLine(''); await loadLines()
      setMsg('Linha definida. Categoria/Sub vieram do ML quando disponíveis.'); onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setAssigningLine(false) }
  }

  const enrich = async (force: boolean) => {
    setEnriching(true); setErr(''); setMsg('')
    try {
      const r = await api<EnrichResult>(`/product-os/${dev.id}/enrich`, { method: 'POST', body: JSON.stringify({ force }) })
      setTitle(r.ficha.title); setDesc(r.ficha.description); setBrand(r.ficha.brand)
      setBullets(r.ficha.bullets); setAttrs(Object.entries(r.ficha.attributes)); setTags(r.ficha.tags.join(', '))
      setSuggestion(r.suggestion)
      if (r.ml_category?.id) setMlCat(r.ml_category)
      setMsg(r.already_ready ? 'Ficha já validada — recarregada (use "Refazer com IA" para regerar).' : `Ficha preenchida pela IA.${r.ml_category?.id ? ' Categoria do ML prevista.' : ''} Revise e ajuste antes de publicar.`)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setEnriching(false) }
  }
  const save = async (markReady?: boolean) => {
    setSaving(true); setErr(''); setMsg('')
    try {
      const attributes = Object.fromEntries(attrs.filter(([k, v]) => k.trim() && v.trim()))
      const body: Record<string, unknown> = { title, description: desc, brand, bullets: bullets.filter(b => b.trim()), attributes, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }
      if (typeof markReady === 'boolean') { body.ready = markReady; setReady(markReady) }
      await api(`/product-os/${dev.id}/ficha`, { method: 'PUT', body: JSON.stringify(body) })
      setMsg(markReady === true ? '✓ Ficha validada — pronto para a IA Criativo.' : markReady === false ? 'Marcado como rascunho.' : 'Ficha salva.')
      onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setSaving(false) }
  }
  const applySuggestion = async () => {
    if (!suggestion) return
    setApplying(true); setErr(''); setMsg('')
    try {
      await api(`/product-os/${dev.id}/ficha/apply-classification`, { method: 'POST', body: JSON.stringify(suggestion) })
      await loadSku(); setMsg('Classificação aplicada (linha definida). Se faltava algum nível, criei automaticamente.'); onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setApplying(false) }
  }

  const descLen = desc.trim().length
  const linhaSet = !!sku?.classification.linha
  const canSuggest = !!(suggestion?.categoria && suggestion?.sub && suggestion?.linha)

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>A <span className="text-white">ficha</span> é o que vira o produto no catálogo — título, descrição, marca, atributos e a <span className="text-white">linha de produtos</span>. A IA preenche a partir da fonte (MakerWorld, imagens, briefing). Revise, defina a linha e marque <span className="text-white">pronto para a IA Criativo</span>.</p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => void enrich(false)} disabled={enriching} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{enriching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}{title || desc ? 'Refazer com IA' : 'Preencher com IA'}</button>
        {(title || desc) && <button onClick={() => void save()} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: '#111114', border: '1px solid #27272a', color: '#a1a1aa' }}>{saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar ficha</button>}
      </div>

      {/* Linha de produtos = COLEÇÃO transversal (ex: "Ella") — obrigatória */}
      <div className="rounded-lg p-3" style={{ background: linhaSet ? 'rgba(74,222,128,0.06)' : 'rgba(252,211,77,0.06)', border: `1px solid ${linhaSet ? 'rgba(74,222,128,0.3)' : 'rgba(252,211,77,0.3)'}` }}>
        <div className="flex items-center gap-2">
          <Layers size={13} style={{ color: linhaSet ? '#4ade80' : '#fcd34d' }} />
          <span className="text-xs font-bold text-white">Linha de produtos {linhaSet ? '' : '(obrigatória)'}</span>
          {linhaSet && <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>{sku?.classification.linha?.label}</span>}
        </div>
        <p className="mt-1 text-[10px]" style={{ color: '#71717a' }}>A linha é uma <span className="text-white">coleção de lançamento</span> — vários produtos entram na mesma linha (ex: “Ella”) e compartilham a comunicação. Escolha uma existente ou crie uma nova.</p>

        {/* linhas existentes (chips) */}
        {lines.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lines.map(l => {
              const on = sku?.classification.linha?.id === l.id
              return <button key={l.id} onClick={() => { if (!on) void assignLine({ line_id: l.id }) }} disabled={assigningLine} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: on ? 'rgba(74,222,128,0.15)' : '#0a0a0e', color: on ? '#4ade80' : '#a1a1aa', border: on ? '1px solid rgba(74,222,128,0.4)' : '1px solid #27272a' }}>{on ? '✓ ' : ''}{l.label}</button>
            })}
          </div>
        )}

        {/* criar nova linha */}
        <div className="mt-2 flex gap-1">
          <input value={newLine} onChange={e => setNewLine(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newLine.trim()) void assignLine({ line_name: newLine.trim() }) }} placeholder="+ criar nova linha (ex: Ella, Matelassê…)" className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
          <button onClick={() => { if (newLine.trim()) void assignLine({ line_name: newLine.trim() }) }} disabled={assigningLine || !newLine.trim()} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:opacity-40" style={{ background: '#4ade80', color: '#0a0a0e' }}>{assigningLine ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} criar</button>
        </div>

        {linhaSet && <p className="mt-1.5 text-[10px]" style={{ color: '#71717a' }}>Classificação: <span className="text-white">{[sku?.classification.marca?.label, sku?.classification.categoria?.label, sku?.classification.sub?.label, sku?.classification.linha?.label, sku?.classification.caracteristica?.label].filter(Boolean).join(' › ')}</span> · SKU {sku?.base ?? 'pendente (defina categoria do ML + característica na aba SKU)'}</p>}
        {!linhaSet && canSuggest && <button onClick={() => void applySuggestion()} disabled={applying} className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold disabled:opacity-40" style={{ background: '#111114', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>{applying ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} ou usar a linha sugerida pela IA: {suggestion?.linha}</button>}
      </div>

      {/* Categoria do Mercado Livre — árvore real */}
      <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="flex items-center gap-2">
          <Boxes size={13} className="text-cyan-400" />
          <span className="text-xs font-bold text-white">Categoria do Mercado Livre</span>
          {mlCat.id && <span className="ml-auto rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ background: '#0a0a0e', color: '#a5f3fc', border: '1px solid #27272a' }}>{mlCat.id}</span>}
        </div>
        {mlCat.id ? (
          <div className="mt-1.5 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[11px]" style={{ color: '#a1a1aa' }}>{mlCat.path ?? mlCat.name}</p>
            <button onClick={() => setMlOpen(o => !o)} className="shrink-0 text-[10px] font-semibold text-cyan-400">trocar</button>
            <button onClick={() => void pickMl(null)} className="shrink-0 text-[10px]" style={{ color: '#f87171' }}>remover</button>
          </div>
        ) : (
          <p className="mt-1 text-[10px]" style={{ color: '#71717a' }}>Puxa da árvore oficial do ML (a que já espelhamos). Preencha com IA para prever, ou busque abaixo. Vira <span className="text-white">category_ml_id</span> no anúncio.</p>
        )}
        {(mlOpen || !mlCat.id) && (
          <div className="mt-2 space-y-1.5">
            <div className="flex gap-1">
              <input value={mlQuery} onChange={e => setMlQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void searchMl() }} placeholder="ex: vaso decorativo, suporte de maquiagem…" className="flex-1 rounded px-2 py-1 text-[11px] text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
              <button onClick={() => void searchMl()} disabled={mlSearching || !mlQuery.trim()} className="rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>{mlSearching ? <Loader2 size={11} className="animate-spin" /> : 'buscar'}</button>
            </div>
            {mlOpts.map(o => (
              <button key={o.id} onClick={() => void pickMl(o)} className="block w-full rounded px-2 py-1.5 text-left" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
                <p className="text-[11px] font-semibold text-white">{o.name}</p>
                <p className="truncate text-[9px]" style={{ color: '#52525b' }}>{o.path || o.id}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <Input label="Título de marketplace (≤60)" value={title} onChange={setTitle} />
      <div>
        <div className="mb-1 flex items-center justify-between"><label className="text-[10px] font-semibold uppercase" style={{ color: '#71717a' }}>Descrição</label><span className="text-[10px]" style={{ color: descLen >= 80 ? '#4ade80' : '#fcd34d' }}>{descLen} chars {descLen < 80 ? '(mín. 80)' : '✓'}</span></div>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={5} className="w-full rounded-lg px-2.5 py-2 text-xs text-white outline-none" style={{ background: '#111114', border: '1px solid #27272a' }} />
      </div>
      <Input label="Marca" value={brand} onChange={setBrand} placeholder="Ex: Vazzo" />

      {/* Bullets */}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase" style={{ color: '#71717a' }}>Bullets / benefícios</label>
        <div className="space-y-1">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-1">
              <input value={b} onChange={e => setBullets(bs => bs.map((x, j) => j === i ? e.target.value : x))} className="flex-1 rounded px-2 py-1 text-[11px] text-white" style={{ background: '#111114', border: '1px solid #27272a' }} />
              <button onClick={() => setBullets(bs => bs.filter((_, j) => j !== i))} style={{ color: '#f87171' }}><X size={12} /></button>
            </div>
          ))}
          <button onClick={() => setBullets(bs => [...bs, ''])} className="flex items-center gap-1 text-[10px] font-semibold text-cyan-400"><Plus size={10} /> bullet</button>
        </div>
      </div>

      {/* Atributos */}
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase" style={{ color: '#71717a' }}>Atributos (ficha técnica)</label>
        <div className="space-y-1">
          {attrs.map(([k, v], i) => (
            <div key={i} className="flex items-center gap-1">
              <input value={k} onChange={e => setAttrs(a => a.map((x, j) => j === i ? [e.target.value, x[1]] : x))} placeholder="ex: Material" className="w-1/3 rounded px-2 py-1 text-[11px] text-white" style={{ background: '#111114', border: '1px solid #27272a' }} />
              <input value={v} onChange={e => setAttrs(a => a.map((x, j) => j === i ? [x[0], e.target.value] : x))} placeholder="ex: PLA" className="flex-1 rounded px-2 py-1 text-[11px] text-white" style={{ background: '#111114', border: '1px solid #27272a' }} />
              <button onClick={() => setAttrs(a => a.filter((_, j) => j !== i))} style={{ color: '#f87171' }}><X size={12} /></button>
            </div>
          ))}
          <button onClick={() => setAttrs(a => [...a, ['', '']])} className="flex items-center gap-1 text-[10px] font-semibold text-cyan-400"><Plus size={10} /> atributo</button>
        </div>
      </div>

      <Input label="Tags (separadas por vírgula)" value={tags} onChange={setTags} />

      {/* Pronto para IA Criativo */}
      <div className="rounded-lg p-3" style={{ background: ready ? 'rgba(74,222,128,0.08)' : '#111114', border: `1px solid ${ready ? 'rgba(74,222,128,0.35)' : '#27272a'}` }}>
        <div className="flex items-center gap-2">
          <div className="min-w-0"><p className="text-xs font-bold" style={{ color: ready ? '#4ade80' : '#e4e4e7' }}>{ready ? '✓ Pronto para a IA Criativo' : 'Pronto para a IA Criativo?'}</p><p className="text-[10px]" style={{ color: '#71717a' }}>Marque quando a ficha estiver revisada. Publicar leva tudo pro catálogo.</p></div>
          <button onClick={() => void save(!ready)} disabled={saving} className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:opacity-50" style={{ background: ready ? '#111114' : '#4ade80', color: ready ? '#a1a1aa' : '#0a0a0e', border: ready ? '1px solid #27272a' : 'none' }}>{ready ? 'Voltar a rascunho' : 'Marcar pronto'}</button>
        </div>
      </div>

      {msg && <p className="text-[11px]" style={{ color: '#4ade80' }}>{msg}</p>}
      {err && <p className="whitespace-pre-line text-[11px]" style={{ color: '#f87171' }}>{err}</p>}
    </div>
  )
}
function RestockTab({ dev, onChanged }: { dev: DevDetail; onChanged: () => void }) {
  const [enabled, setEnabled] = useState(!!dev.mto_enabled)
  const [mode, setMode] = useState<'suggest' | 'auto'>(dev.mto_mode === 'auto' ? 'auto' : 'suggest')
  const [point, setPoint] = useState(String(dev.mto_reorder_point ?? 0))
  const [batch, setBatch] = useState(String(dev.mto_batch_qty ?? 0))
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState('')
  const save = async () => {
    setSaving(true); setMsg('')
    try {
      await api(`/product-os/${dev.id}/make-to-order`, { method: 'PATCH', body: JSON.stringify({
        mto_enabled: enabled, mto_mode: mode, mto_reorder_point: Number(point) || 0, mto_batch_qty: Number(batch) || 0,
      }) })
      setMsg('Configuração salva.'); onChanged()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setSaving(false) }
  }
  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>
        Quando um pedido (Mercado Livre, Shopee, TikTok ou loja própria) baixa o estoque deste produto a/abaixo do ponto de reposição, o sistema repõe a produção sozinho — sugerindo, ou criando a ordem direto no modo automático. Fecha o loop <span className="text-white">vendi → produzi → repus</span>.
      </p>
      {!dev.product_id && (
        <div className="flex items-start gap-2 rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Este produto ainda não tem SKU/estoque (não foi publicado no catálogo). A reposição só dispara depois que ele virar anúncio e passar a ter estoque vendável.</span>
        </div>
      )}

      <label className="flex items-center gap-2.5 text-sm text-white">
        <button type="button" onClick={() => setEnabled(v => !v)} className="relative h-5 w-9 rounded-full transition-colors" style={{ background: enabled ? '#00E5FF' : '#3f3f46' }}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: enabled ? '18px' : '2px' }} />
        </button>
        Reposição automática {enabled ? 'ligada' : 'desligada'}
      </label>

      <div className={enabled ? '' : 'pointer-events-none opacity-40'}>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Modo</p>
        <div className="mb-4 flex gap-1 rounded-lg p-1" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          {([['suggest', 'Sugerir', 'só sugere — você confirma'], ['auto', 'Automático', 'cria a ordem sozinho']] as const).map(([k, lbl, hint]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className="flex-1 rounded px-2 py-1.5 text-left" style={{ background: mode === k ? 'rgba(0,229,255,0.12)' : 'transparent', border: mode === k ? '1px solid rgba(0,229,255,0.35)' : '1px solid transparent' }}>
              <span className="block text-[11px] font-bold" style={{ color: mode === k ? '#00E5FF' : '#a1a1aa' }}>{lbl}</span>
              <span className="block text-[9px]" style={{ color: '#52525b' }}>{hint}</span>
            </button>
          ))}
        </div>
        {mode === 'auto' && (
          <div className="mb-4 flex items-start gap-2 rounded-lg p-2.5 text-[11px]" style={{ background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)' }}>
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>No automático a ordem é criada e RESERVA filamento sem confirmação. Use só em produtos com demanda estável.</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Ponto de reposição</label>
            <input type="number" min={0} value={point} onChange={e => setPoint(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-sm text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
            <p className="mt-1 text-[9px]" style={{ color: '#52525b' }}>dispara quando o estoque chega a este nível</p>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Produzir por vez</label>
            <input type="number" min={1} value={batch} onChange={e => setBatch(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-sm text-white" style={{ background: '#0a0a0e', border: '1px solid #27272a' }} />
            <p className="mt-1 text-[9px]" style={{ color: '#52525b' }}>quantas unidades a ordem vai produzir</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => void save()} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: '#00E5FF', color: '#0a0a0e' }}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar
        </button>
        {msg && <span className="text-[11px]" style={{ color: msg === 'Configuração salva.' ? '#4ade80' : '#f87171' }}>{msg}</span>}
      </div>
    </div>
  )
}

interface Suggestion {
  id: string; product_dev_id: string; product_id: string | null; product_name: string | null; product_code: string | null
  reason: string | null; available_at_trigger: number | null; reorder_point: number | null; suggested_qty: number
  mode: string; status: string; source: string; production_order_id: string | null; created_at: string
}
function MakeToOrderCard({ onOpen }: { onOpen: (id: string) => void }) {
  const [list, setList] = useState<Suggestion[] | null>(null); const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string>(''); const [msg, setMsg] = useState('')
  const load = useCallback(async () => { setLoading(true); try { setList(await api<Suggestion[]>('/product-os/make-to-order/suggestions?status=pending')) } catch { setList([]) } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const reconcile = async () => {
    setBusy('reconcile'); setMsg('')
    try { const r = await api<{ evaluated: number; suggested: unknown[]; auto_created: unknown[] }>('/product-os/make-to-order/reconcile', { method: 'POST' }); setMsg(`Verificados ${r.evaluated} produto(s) · ${r.suggested.length} nova(s) sugestão(ões) · ${r.auto_created.length} OP(s) automática(s).`); await load() }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setBusy('') }
  }
  const accept = async (s: Suggestion) => {
    setBusy(s.id); setMsg('')
    try { const r = await api<{ production_order_id: string }>(`/product-os/make-to-order/suggestions/${s.id}/accept`, { method: 'POST', body: JSON.stringify({ quantity: s.suggested_qty }) }); setMsg(`Ordem de produção criada (${s.suggested_qty} un.).`); void r; await load() }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setBusy('') }
  }
  const dismiss = async (s: Suggestion) => {
    setBusy(s.id); setMsg('')
    try { await api(`/product-os/make-to-order/suggestions/${s.id}/dismiss`, { method: 'POST' }); await load() }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setBusy('') }
  }
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="mb-2 flex items-center gap-2">
        <RefreshCw size={14} className="text-cyan-400" />
        <span className="text-xs font-bold text-white">Reposição da produção — pedidos baixaram o estoque</span>
        <button onClick={() => void reconcile()} disabled={busy === 'reconcile'} className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>
          {busy === 'reconcile' ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Verificar agora
        </button>
      </div>
      {loading ? <div className="flex items-center gap-2 text-xs" style={{ color: '#71717a' }}><Loader2 size={12} className="animate-spin" /> Carregando…</div> : !list || list.length === 0 ? (
        <p className="text-xs" style={{ color: '#52525b' }}>Nenhuma reposição pendente. Ligue a reposição automática em cada produto (aba Reposição) — quando o estoque cair, ele aparece aqui.</p>
      ) : (
        <div className="space-y-1.5">
          {list.map(s => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 text-xs" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
              <Package size={12} className="text-cyan-400 shrink-0" />
              <button onClick={() => onOpen(s.product_dev_id)} className="font-semibold text-white hover:underline">{s.product_name ?? s.product_code ?? 'Produto'}</button>
              {s.product_code && <span className="font-mono text-[10px]" style={{ color: '#52525b' }}>{s.product_code}</span>}
              <span className="truncate" style={{ color: '#a1a1aa' }}>{s.reason}</span>
              <div className="ml-auto flex items-center gap-1.5">
                <button onClick={() => void accept(s)} disabled={!!busy} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.35)' }}>
                  {busy === s.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Criar OP ({s.suggested_qty})
                </button>
                <button onClick={() => void dismiss(s)} disabled={!!busy} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50" style={{ background: 'transparent', color: '#71717a', border: '1px solid #27272a' }}>
                  <Ban size={10} /> Dispensar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="mt-2 text-[10px]" style={{ color: '#a5f3fc' }}>{msg}</p>}
    </div>
  )
}

const FIT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  exact: { label: 'cor ✓', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  material: { label: 'só material', color: '#fcd34d', bg: 'rgba(252,211,77,0.12)' },
  unknown: { label: 'rolo montado', color: '#a1a1aa', bg: 'rgba(161,161,170,0.12)' },
  none: { label: '—', color: '#71717a', bg: 'transparent' },
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '—' }
}
function SchedulerCard() {
  const [data, setData] = useState<SchedulePlan | null>(null); const [loading, setLoading] = useState(true); const [msg, setMsg] = useState('')
  const load = useCallback(async () => { setLoading(true); try { setData(await api<SchedulePlan>('/product-os/farm/schedule-plan')) } catch { /* */ } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const [dispatching, setDispatching] = useState(false)
  const apply = async () => {
    if (!data?.assignments.length) return
    setMsg('')
    try { const r = await api<{ assigned: number }>('/product-os/farm/scheduler/apply', { method: 'POST', body: JSON.stringify({ assignments: data.assignments.map(a => ({ order_id: a.order_id, printer_id: a.printer_id })) }) }); setMsg(`${r.assigned} ordem(ns) atribuída(s) às impressoras.`); void load() }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') }
  }
  const dispatch = async () => {
    setDispatching(true); setMsg('')
    try { const r = await api<{ dispatched: Array<{ order_number: number; name: string }> }>('/product-os/farm/auto-dispatch', { method: 'POST' }); setMsg(r.dispatched.length ? `Iniciou ${r.dispatched.length} impressão(ões): ${r.dispatched.map(d => `OP-${String(d.order_number).padStart(4, '0')}`).join(', ')}.` : 'Nada a iniciar — precisa de impressora ociosa com auto-impressão ligada + ordem compatível na fila.'); void load() }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setDispatching(false) }
  }
  const money = (n: number) => `R$ ${n.toFixed(2)}`
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="mb-2 flex items-center gap-2">
        <Wifi size={14} className="text-cyan-400" />
        <span className="text-xs font-bold text-white">Plano de produção — capacidade finita (prazo + filamento)</span>
        {data && data.assignments.length > 0 && <div className="ml-auto flex gap-1.5">
          <button onClick={() => void apply()} className="rounded px-2 py-1 text-[10px] font-bold" style={{ background: '#0a0a0e', color: '#a5f3fc', border: '1px solid #27272a' }}>Atribuir</button>
          <button onClick={() => void dispatch()} disabled={dispatching} title="Inicia agora nas impressoras ociosas com auto-impressão ligada" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>{dispatching ? <Loader2 size={10} className="animate-spin" /> : <Rocket size={10} />} Despachar agora</button>
        </div>}
      </div>
      {loading ? <div className="flex items-center gap-2 text-xs" style={{ color: '#71717a' }}><Loader2 size={12} className="animate-spin" /> Calculando…</div> : !data ? null : (
        <>
          <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]" style={{ color: '#52525b' }}>
            <span>{data.eligible_printers} impressora(s) elegível(eis){data.offline_printers > 0 ? ` · ${data.offline_printers} offline` : ''} · {data.queued_orders} na fila</span>
            {data.all_done_at && <span style={{ color: '#a5f3fc' }}>· tudo pronto até <span className="font-bold">{fmtDateTime(data.all_done_at)}</span></span>}
            {data.late_count > 0 && <span className="font-bold" style={{ color: '#f87171' }}>· {data.late_count} atrasada(s)</span>}
          </p>
          {data.assignments.length === 0 && data.unscheduled.length === 0 ? (
            <p className="text-xs" style={{ color: '#52525b' }}>Nada na fila — crie ordens de produção (status fila) e monte o filamento nas impressoras.</p>
          ) : (
            <div className="space-y-1.5">
              {data.assignments.map(a => {
                const fit = FIT_BADGE[a.fit] ?? FIT_BADGE.none
                return (
                  <div key={a.order_id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: '#0a0a0e', border: a.late ? '1px solid rgba(248,113,113,0.4)' : '1px solid #1a1a1f' }}>
                    <PrinterIcon size={12} className="shrink-0 text-cyan-400" />
                    <span className="font-semibold text-white">{a.printer_name}</span>
                    <span style={{ color: '#52525b' }}>←</span>
                    <span className="truncate" style={{ color: '#a1a1aa' }}>OP-{String(a.order_number).padStart(4, '0')} {a.name} ({a.quantity}un)</span>
                    {a.fit !== 'none' && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: fit.bg, color: fit.color }}>{fit.label}</span>}
                    <span className="ml-auto flex items-center gap-2">
                      {a.needs_time ? <span className="text-[10px]" style={{ color: '#fcd34d' }}>sem tempo na versão</span> : (
                        <span className="text-[10px]" style={{ color: a.late ? '#f87171' : '#71717a' }}>{fmtDateTime(a.start_at)} → {fmtDateTime(a.finish_at)}</span>
                      )}
                      <span className="font-bold" style={{ color: '#00E5FF' }}>{a.profit_per_hour != null ? money(a.profit_per_hour) + '/h' : '—'}</span>
                    </span>
                    {a.late && <span className="w-full text-[10px] font-semibold" style={{ color: '#f87171' }}>⚠ vai passar do prazo ({fmtDateTime(a.due_at)})</span>}
                  </div>
                )
              })}
              {data.unscheduled.map(u => (
                <div key={u.order_id} className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)' }}>
                  <AlertTriangle size={12} className="shrink-0" style={{ color: '#f87171' }} />
                  <span className="truncate" style={{ color: '#a1a1aa' }}>OP-{String(u.order_number).padStart(4, '0')} {u.name} ({u.quantity}un)</span>
                  <span className="ml-auto text-[10px]" style={{ color: '#f87171' }}>{u.reason}</span>
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
// ── MONITOR AO VIVO (um painel por impressora) ─────────────────────────
const STATE_LABEL: Record<string, string> = { printing: 'IMPRIMINDO', paused: 'PAUSADA', error: 'ERRO', offline: 'OFFLINE', idle: 'OCIOSA', sem_dados: 'SEM DADOS' }
function stateColor(lv?: FarmStatus): string {
  if (!lv || !lv.online) return '#52525b'
  return lv.state === 'printing' ? '#00E5FF' : lv.state === 'error' ? '#f87171' : lv.state === 'paused' ? '#fcd34d' : '#4ade80'
}
function LiveMonitorPanel() {
  const [printers, setPrinters] = useState<Printer[]>([]); const [live, setLive] = useState<Record<string, FarmStatus>>({})
  const [loaded, setLoaded] = useState<Record<string, LoadedFilament[]>>({}); const [err, setErr] = useState(''); const [cmdMsg, setCmdMsg] = useState<Record<string, string>>({})
  const [camHidden, setCamHidden] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('product-os:camHidden') || '{}') } catch { return {} } })
  const toggleCam = (pid: string) => setCamHidden(m => { const next = { ...m, [pid]: !m[pid] }; try { localStorage.setItem('product-os:camHidden', JSON.stringify(next)) } catch { /* */ } return next })
  const [lightOpt, setLightOpt] = useState<Record<string, boolean>>({})  // estado otimista da luz até a telemetria confirmar

  useEffect(() => { void (async () => { try { setPrinters(await api<Printer[]>('/product-os/printers')) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } })() }, [])
  // telemetria ao vivo (5s)
  useEffect(() => {
    let alive = true
    const tick = async () => { try { const s = await api<FarmStatus[]>('/product-os/farm/status'); if (!alive) return; setLive(Object.fromEntries(s.map(x => [x.id, x]))); setLightOpt(opt => { const next = { ...opt }; let ch = false; for (const x of s) if (x.id in next && x.light_on != null && next[x.id] === x.light_on) { delete next[x.id]; ch = true }; return ch ? next : opt }) } catch { /* */ } }
    void tick(); const it = setInterval(tick, 5000); return () => { alive = false; clearInterval(it) }
  }, [])
  // filamento montado por impressora (refresca a cada 20s)
  const loadFilaments = useCallback(async (ids: string[]) => {
    const entries = await Promise.all(ids.map(async id => { try { return [id, await api<LoadedFilament[]>(`/product-os/printers/${id}/loaded-filament`)] as const } catch { return [id, []] as const } }))
    setLoaded(Object.fromEntries(entries))
  }, [])
  useEffect(() => { if (!printers.length) return; const ids = printers.map(p => p.id); void loadFilaments(ids); const it = setInterval(() => void loadFilaments(ids), 20000); return () => clearInterval(it) }, [printers, loadFilaments])

  const cmd = async (pid: string, type: string) => {
    if (type === 'stop' && !(await confirmDialog({ title: 'Parar impressão', message: 'Parar a impressão atual? Cancela o job na máquina.', danger: true, confirmLabel: 'Parar' }))) return
    setCmdMsg(m => ({ ...m, [pid]: '' }))
    try { await api(`/product-os/farm/printers/${pid}/command`, { method: 'POST', body: JSON.stringify({ type }) }); setCmdMsg(m => ({ ...m, [pid]: 'Comando enviado.' })) }
    catch (e) { setCmdMsg(m => ({ ...m, [pid]: e instanceof Error ? e.message : 'Erro' })) }
  }
  const ackFail = async (pid: string, id: string, fp: boolean) => {
    try { await api(`/product-os/farm/failures/${id}/ack`, { method: 'POST', body: JSON.stringify({ false_positive: fp }) }); setLive(o => ({ ...o, [pid]: { ...o[pid], open_failure: null } })) } catch { /* */ }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>Acompanhamento ao vivo de cada impressora — estado, progresso, camada, tempo, temperaturas e filamento. Atualiza a cada 5s.</p>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {printers.length === 0 ? <p className="text-xs" style={{ color: '#52525b' }}>Nenhuma impressora cadastrada. Cadastre em <b>Impressoras</b> e conecte o agente (Conectar farm).</p> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {printers.map(p => {
            const lv = live[p.id]; const c = stateColor(lv); const printing = lv?.state === 'printing'; const fil = loaded[p.id] ?? []
            return (
              <div key={p.id} className="rounded-xl p-4" style={{ background: '#111114', border: `1px solid ${printing ? 'rgba(0,229,255,0.35)' : '#27272a'}` }}>
                {/* header */}
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c, boxShadow: printing ? `0 0 8px ${c}` : 'none' }} />
                  <PrinterIcon size={15} className="text-cyan-400" />
                  <span className="text-sm font-bold text-white">{p.name}</span>
                  <span className="ml-auto rounded px-2 py-0.5 text-[10px] font-bold tracking-wide" style={{ background: '#0a0a0e', color: c, border: `1px solid ${c}33` }}>{lv ? (lv.online ? (STATE_LABEL[lv.state] ?? lv.state) : 'OFFLINE') : '—'}</span>
                  {lv?.camera_url && (
                    <button type="button" onClick={() => toggleCam(p.id)} title={camHidden[p.id] ? 'Mostrar câmera' : 'Ocultar câmera (só dados)'} className="rounded p-1 transition-colors hover:bg-white/5" style={{ color: '#71717a' }}>
                      {camHidden[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-[10px]" style={{ color: '#71717a' }}>{[p.brand, p.model, p.build_volume_mm].filter(Boolean).join(' · ') || 'sem detalhes'}{p.has_ams ? ' · AMS' : ''}{lv?.last_update ? ` · atualizado ${new Date(lv.last_update).toLocaleTimeString('pt-BR')}` : ''}</p>

                {!lv?.bound && <p className="mt-2 text-[11px]" style={{ color: '#fcd34d' }}>Sem telemetria — vincule o nº de série e deixe o agente rodando.</p>}

                {/* T1-A: alerta de falha detectada */}
                {lv?.open_failure && (
                  <div className="mt-2 rounded-lg p-2.5" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)' }}>
                    <p className="text-[11px] font-bold" style={{ color: '#fca5a5' }}>🛑 Falha detectada — produção pausada</p>
                    {lv.open_failure.reason && <p className="mt-0.5 text-[10px]" style={{ color: '#f87171' }}>{lv.open_failure.reason} · {new Date(lv.open_failure.detected_at).toLocaleTimeString('pt-BR')}</p>}
                    <div className="mt-1.5 flex gap-1.5">
                      <button type="button" onClick={() => void ackFail(p.id, lv.open_failure!.id, false)} className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#27272a', color: '#e4e4e7' }}>Reconhecer</button>
                      <button type="button" onClick={() => void ackFail(p.id, lv.open_failure!.id, true)} className="rounded px-2 py-0.5 text-[10px]" style={{ color: '#a1a1aa' }}>Falso positivo</button>
                    </div>
                  </div>
                )}

                {/* câmera ao vivo */}
                {lv?.camera_url && !camHidden[p.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${lv.camera_url}?t=${encodeURIComponent(lv.camera_at ?? '')}`} alt="câmera" className="mt-3 w-full rounded-lg" style={{ border: '1px solid #1a1a1f', aspectRatio: '4 / 3', objectFit: 'cover', background: '#0a0a0e' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                )}

                {/* progresso */}
                {printing && (
                  <div className="mt-3">
                    {lv.job_name && <p className="truncate text-[11px]" style={{ color: '#d4d4d8' }}>🖨️ {lv.job_name}</p>}
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}><div className="h-full rounded-full" style={{ width: `${lv.progress_pct ?? 0}%`, background: '#00E5FF' }} /></div>
                      <span className="text-xs font-bold" style={{ color: '#00E5FF' }}>{Math.round(lv.progress_pct ?? 0)}%</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      <Stat label="Camada" value={lv.layer_total ? `${lv.layer_current ?? 0}/${lv.layer_total}` : '—'} />
                      <Stat label="Restante" value={lv.remaining_minutes != null ? (lv.remaining_minutes >= 60 ? `${Math.floor(lv.remaining_minutes / 60)}h${String(lv.remaining_minutes % 60).padStart(2, '0')}` : `${lv.remaining_minutes}min`) : '—'} />
                      <Stat label="Conclusão" value={lv.remaining_minutes != null ? new Date(Date.now() + lv.remaining_minutes * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'} />
                    </div>
                  </div>
                )}

                {/* temperaturas */}
                {lv?.bound && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Stat label="Bico" value={lv.nozzle_temp != null ? `${Math.round(lv.nozzle_temp)}°C` : '—'} />
                    <Stat label="Mesa" value={lv.bed_temp != null ? `${Math.round(lv.bed_temp)}°C` : '—'} />
                  </div>
                )}

                {/* filamento montado (e-Click) */}
                {fil.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Filamento montado</p>
                    {fil.map(f => f.input && (
                      <div key={f.id} className="flex items-center gap-1.5 text-[10px]">
                        {f.input.color_hex && <span className="h-2.5 w-2.5 rounded-full border" style={{ background: f.input.color_hex, borderColor: '#3f3f46' }} />}
                        <span style={{ color: '#d4d4d8' }}>{fil.length > 1 ? `B${f.slot + 1}: ` : ''}{f.input.name}</span>
                        <span style={{ color: '#52525b' }}>· {f.available.toFixed(0)}{f.input.unit} disp.</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* AMS (telemetria) */}
                {lv?.ams && lv.ams.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lv.ams.map((a, i) => <span key={i} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px]" style={{ background: '#0a0a0e', color: '#a1a1aa', border: '1px solid #1a1a1f' }}>{a.color && <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />}{a.material || 'AMS'} {a.remain_pct != null ? `${a.remain_pct}%` : ''}</span>)}
                  </div>
                )}

                {lv?.error_text && <p className="mt-2 text-[10px]" style={{ color: '#f87171' }}>⚠️ {lv.error_code} {lv.error_text}</p>}

                {/* controles */}
                {lv?.online && lv.bound && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {lv.state === 'printing' && <CtrlBtn onClick={() => void cmd(p.id, 'pause')} label="Pausar" />}
                    {lv.state === 'paused' && <CtrlBtn onClick={() => void cmd(p.id, 'resume')} label="Retomar" />}
                    {(lv.state === 'printing' || lv.state === 'paused') && <CtrlBtn onClick={() => void cmd(p.id, 'stop')} label="Parar" danger />}
                    {(() => { const on = lightOpt[p.id] ?? lv.light_on ?? false; return <CtrlBtn onClick={() => { setLightOpt(m => ({ ...m, [p.id]: !on })); void cmd(p.id, on ? 'light_off' : 'light_on') }} label={on ? '💡 Luz: ligada' : '🌙 Luz: apagada'} /> })()}
                  </div>
                )}
                {cmdMsg[p.id] && <p className="mt-1 text-[10px]" style={{ color: '#a5f3fc' }}>{cmdMsg[p.id]}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

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

interface LoadedFilament {
  id: string; slot: number; loaded_at: string; loaded_g: number | null; consumed_g: number; available: number
  input: { id: string; name: string; sku: string | null; barcode: string | null; material: string | null; color: string | null; color_hex: string | null; unit: string; quantity: number; cost_per_unit: number; spool_weight_g: number | null } | null
}

/** hex (#RRGGBB ou RRGGBBAA) → {r,g,b}; null se inválido. */
function hexToRgb(h?: string | null): { r: number; g: number; b: number } | null {
  if (!h) return null
  const s = h.replace('#', '').slice(0, 6)
  if (s.length < 6) return null
  const n = parseInt(s, 16)
  if (Number.isNaN(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
/** distância de cor (euclidiana em RGB) — menor = mais parecida. */
function colorDist(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

/** Seletor do rolo montado na impressora — garante reservar do filamento EXATO
 *  que vai rodar (cor/slot), não um chute por material. Some se a impressora não
 *  tem rolo montado (cai no fallback por material). */
function SpoolPicker({ printerId, material, color, value, onChange }: { printerId: string; material?: string | null; color?: string | null; value: string; onChange: (id: string) => void }) {
  const [rolls, setRolls] = useState<LoadedFilament[]>([])
  useEffect(() => {
    if (!printerId) { setRolls([]); return }
    let alive = true
    void (async () => { try { const r = await api<LoadedFilament[]>(`/product-os/printers/${printerId}/loaded-filament`); if (alive) setRolls(r.filter(x => x.input)) } catch { if (alive) setRolls([]) } })()
    return () => { alive = false }
  }, [printerId])
  useEffect(() => {
    if (!rolls.length) { if (value) onChange(''); return }
    if (value && rolls.some(r => r.input?.id === value)) return
    // prioridade: rolo da COR fatiada mais próxima → mesmo material → 1º
    const rgb = hexToRgb(color)
    let best: LoadedFilament | null = null
    if (rgb) {
      let bestD = 100  // limiar: só casa se for razoavelmente próxima
      for (const r of rolls) { const c = hexToRgb(r.input?.color_hex); if (!c) continue; const d = colorDist(rgb, c); if (d < bestD) { bestD = d; best = r } }
    }
    if (!best && material) best = rolls.find(r => r.input?.material?.toUpperCase() === material.toUpperCase()) ?? null
    onChange((best ?? rolls[0]).input?.id ?? '')
  }, [rolls, material, color]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!printerId || rolls.length === 0) return null
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Rolo na impressora{color ? ' (auto pela cor — pode trocar)' : (rolls.length > 1 ? ' — escolha a cor' : '')}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
        {rolls.map(r => r.input && <option key={r.id} value={r.input.id}>B{r.slot + 1}: {[r.input.color, r.input.material].filter(Boolean).join(' ')} — {r.available.toFixed(0)}{r.input.unit} disp.</option>)}
      </select>
    </label>
  )
}

/** Busca de filamento: digita OU escaneia (nome/SKU/cor/material/código de barras).
 *  Leitor de código de barras = teclado: ele digita o código e dá Enter → casa exato e seleciona. */
function FilamentPicker({ filaments, exclude, placeholder, onPick }: { filaments: Input[]; exclude?: string[]; placeholder?: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const norm = (s: string | null | undefined) => (s ?? '').toLowerCase()
  const list = filaments.filter(f => !(exclude ?? []).includes(f.id))
  const term = q.trim().toLowerCase()
  const matches = term ? list.filter(f => [f.name, f.sku, f.barcode, f.color, f.material].some(v => norm(v).includes(term))) : list
  const submit = () => {
    const exact = list.find(f => norm(f.sku) === term || norm(f.barcode) === term)
    const pick = exact ?? (matches.length === 1 ? matches[0] : null)
    if (pick) { onPick(pick.id); setQ('') }
  }
  return (
    <div>
      <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        placeholder={placeholder ?? 'Escanear ou digitar nome / SKU / código de barras…'}
        className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
      {term && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded-lg" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
          {matches.length === 0 ? <p className="p-2 text-[10px]" style={{ color: '#71717a' }}>Nada encontrado pra “{q}”.</p>
            : matches.slice(0, 25).map(f => (
              <button key={f.id} onClick={() => { onPick(f.id); setQ('') }} className="block w-full px-2 py-1.5 text-left text-[11px]" style={{ borderBottom: '1px solid #1a1a1f', color: '#d4d4d8' }}>
                <span className="font-semibold text-white">{f.name}</span>
                <span style={{ color: '#52525b' }}> · {(Number(f.quantity) - Number(f.reserved_quantity)).toFixed(0)}{f.unit}{f.color ? ` · ${f.color}` : ''}{f.sku ? ` · SKU ${f.sku}` : ''}{f.barcode ? ` · ${f.barcode}` : ''}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

function LoadedFilamentSection({ printerId, onChanged }: { printerId: string; onChanged: () => void }) {
  const [loaded, setLoaded] = useState<LoadedFilament[]>([]); const [filaments, setFilaments] = useState<Input[]>([])
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState('')
  const [swapSlot, setSwapSlot] = useState<number | null>(null); const [adding, setAdding] = useState(false)
  const [usageSlot, setUsageSlot] = useState<number | null>(null); const [usageVal, setUsageVal] = useState('')

  const load = useCallback(async () => {
    try {
      const [l, f] = await Promise.all([
        api<LoadedFilament[]>(`/product-os/printers/${printerId}/loaded-filament`),
        api<Input[]>(`/product-os/production-inputs?kind=filamento`),
      ])
      setLoaded(l); setFilaments(f)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }, [printerId])
  useEffect(() => { void load() }, [load])

  const usedSlots = loaded.map(l => l.slot)
  const nextSlot = usedSlots.length ? Math.max(...usedSlots) + 1 : 0
  const loadedIds = loaded.map(l => l.input?.id).filter(Boolean) as string[]

  const doLoad = async (inputId: string, slot: number) => {
    setBusy(true); setErr(''); setMsg('')
    try { await api(`/product-os/printers/${printerId}/load-filament`, { method: 'POST', body: JSON.stringify({ input_id: inputId, slot }) }); setMsg('Filamento montado — o consumo desta máquina passa a baixar esse rolo.'); setSwapSlot(null); setAdding(false); await load(); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  const unload = async (slot: number, name?: string) => {
    if (!(await confirmDialog({ title: 'Tirar filamento', message: `Tirar "${name ?? ''}" da impressora? A sessão é fechada (o rendimento fica no histórico).`, confirmLabel: 'Tirar' }))) return
    setBusy(true); setErr('')
    try { await api(`/product-os/printers/${printerId}/unload-filament`, { method: 'POST', body: JSON.stringify({ slot }) }); await load(); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }
  const logUsage = async (slot: number) => {
    const g = Number(usageVal) || 0
    if (g <= 0) { setErr('Informe as gramas usadas.'); return }
    setBusy(true); setErr(''); setMsg('')
    try { await api(`/product-os/printers/${printerId}/filament-usage`, { method: 'POST', body: JSON.stringify({ grams: g, slot }) }); setUsageVal(''); setUsageSlot(null); setMsg(`Baixados ${g} g do rolo.`); await load(); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }

  return (
    <div className="mb-3 rounded-lg p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="mb-2 flex items-center gap-2"><Boxes size={13} style={{ color: '#a5f3fc' }} /><span className="text-xs font-bold text-white">Filamento na impressora</span>{loaded.length > 1 && <span className="text-[10px]" style={{ color: '#71717a' }}>{loaded.length} bandejas</span>}</div>
      {err && <p className="mb-1.5 text-[10px]" style={{ color: '#f87171' }}>{err}</p>}
      {msg && <p className="mb-1.5 text-[10px]" style={{ color: '#4ade80' }}>{msg}</p>}

      {loaded.length === 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px]" style={{ color: '#a1a1aa' }}>Nenhum filamento montado. Escaneie/escolha qual rolo está na máquina pro sistema acompanhar custo e uso.</p>
          {filaments.length === 0 ? <p className="text-[10px]" style={{ color: '#fcd34d' }}>Nenhum filamento no estoque. Cadastre em Insumos (ou importe uma NF) primeiro.</p>
            : <FilamentPicker filaments={filaments} onPick={id => void doLoad(id, 0)} />}
        </div>
      )}

      {loaded.map(l => l.input && (
        <div key={l.id} className="mb-2 rounded-lg p-2.5" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
          <div className="flex items-center gap-2">
            {loaded.length > 1 && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: '#1a1a1f', color: '#71717a' }}>bandeja {l.slot + 1}</span>}
            {l.input.color_hex && <span className="h-4 w-4 rounded-full border" style={{ background: l.input.color_hex, borderColor: '#3f3f46' }} />}
            <span className="text-sm font-bold text-white">{l.input.name}</span>
            {l.input.material && <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: '#111114', color: '#a1a1aa' }}>{l.input.material}</span>}
            {l.input.color && <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: '#111114', color: '#a1a1aa' }}>{l.input.color}</span>}
          </div>
          {(l.input.sku || l.input.barcode) && <p className="mt-0.5 text-[9px]" style={{ color: '#52525b' }}>{l.input.sku ? `SKU ${l.input.sku}` : ''}{l.input.sku && l.input.barcode ? ' · ' : ''}{l.input.barcode ? `cód ${l.input.barcode}` : ''}</p>}
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <Stat label="Disponível" value={`${l.available.toFixed(0)} ${l.input.unit}`} />
            <Stat label="Custo/g" value={`R$ ${Number(l.input.cost_per_unit).toFixed(5)}`} />
            <Stat label="Usado neste rolo" value={`${Number(l.consumed_g).toFixed(0)} g`} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button onClick={() => { setUsageSlot(usageSlot === l.slot ? null : l.slot); setUsageVal('') }} className="rounded px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>Registrar uso avulso</button>
            <button onClick={() => setSwapSlot(swapSlot === l.slot ? null : l.slot)} className="rounded px-2 py-1 text-[10px] font-semibold" style={{ background: '#111114', color: '#a5f3fc', border: '1px solid #27272a' }}>↔ Trocar</button>
            <button onClick={() => void unload(l.slot, l.input?.name)} disabled={busy} className="rounded px-2 py-1 text-[10px]" style={{ background: '#111114', color: '#71717a', border: '1px solid #27272a' }}>Tirar</button>
          </div>
          {usageSlot === l.slot && (
            <div className="mt-1.5 flex items-end gap-2 rounded-lg p-2" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
              <Input label="Gramas usadas (impressão fora de ordem)" value={usageVal} onChange={setUsageVal} />
              <button onClick={() => void logUsage(l.slot)} disabled={busy} className="flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF', height: 34 }}>{busy ? <Loader2 size={11} className="animate-spin" /> : 'Baixar'}</button>
            </div>
          )}
          {swapSlot === l.slot && <div className="mt-1.5"><FilamentPicker filaments={filaments} exclude={loadedIds} placeholder="Trocar por… (nome / SKU / código)" onPick={id => void doLoad(id, l.slot)} /></div>}
        </div>
      ))}

      {loaded.length > 0 && (
        adding
          ? <div className="rounded-lg p-2" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
              <div className="mb-1 flex items-center justify-between"><span className="text-[10px] font-semibold" style={{ color: '#a1a1aa' }}>Carregar em outra bandeja (#{nextSlot + 1})</span><button onClick={() => setAdding(false)} className="text-[10px]" style={{ color: '#71717a' }}>cancelar</button></div>
              <FilamentPicker filaments={filaments} exclude={loadedIds} onPick={id => void doLoad(id, nextSlot)} />
            </div>
          : <button onClick={() => setAdding(true)} className="text-[10px] font-semibold" style={{ color: '#a5f3fc' }}>+ Carregar outro rolo (AMS)</button>
      )}
      <p className="mt-2 text-[10px]" style={{ color: '#52525b' }}>Toda impressão concluída nesta máquina baixa o rolo montado (gramas × custo médio). Leitor de código de barras funciona na busca (escaneie → Enter).</p>
    </div>
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
    if (type === 'stop' && !(await confirmDialog({ title: 'Parar impressão', message: 'Parar a impressão atual? Isso cancela o job na máquina.', danger: true, confirmLabel: 'Parar' }))) return
    setCmdMsg('')
    try { await api(`/product-os/farm/printers/${id}/command`, { method: 'POST', body: JSON.stringify({ type }) }); setCmdMsg('Comando enviado à impressora.') }
    catch (e) { setCmdMsg(e instanceof Error ? e.message : 'Erro') }
  }
  const setAi = async (enabled: boolean, sensitivity?: string) => {
    try { await api(`/product-os/farm/printers/${id}/ai-detection`, { method: 'POST', body: JSON.stringify({ enabled, sensitivity }) }); await loadLive() }
    catch (e) { setCmdMsg(e instanceof Error ? e.message : 'Erro') }
  }
  const setAutoDisp = async (enabled: boolean) => {
    if (enabled && !(await confirmDialog({ title: 'Ligar auto-impressão', message: 'Quando esta impressora ficar ociosa, o sistema vai INICIAR sozinho a próxima ordem da fila que ela consegue rodar (filamento certo + .3mf). Confirmar?', confirmLabel: 'Ligar lights-out' }))) return
    try { await api(`/product-os/farm/printers/${id}/auto-dispatch`, { method: 'POST', body: JSON.stringify({ enabled }) }); await loadLive() }
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

            {/* T1-A: vigilância de falha por IA */}
            {live && (
              <div className="mb-3 rounded-lg p-2.5" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                <div className="flex items-center gap-2">
                  <ShieldAlert size={13} style={{ color: live.ai_detection_enabled ? '#4ade80' : '#52525b' }} />
                  <span className="text-[11px] font-bold text-white">Vigilância de falha por IA</span>
                  <button type="button" onClick={() => void setAi(!live.ai_detection_enabled, live.ai_sensitivity)} className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: live.ai_detection_enabled ? 'rgba(74,222,128,0.15)' : '#27272a', color: live.ai_detection_enabled ? '#4ade80' : '#a1a1aa', border: `1px solid ${live.ai_detection_enabled ? 'rgba(74,222,128,0.4)' : '#3f3f46'}` }}>{live.ai_detection_enabled ? 'Ligada' : 'Desligada'}</button>
                </div>
                <p className="mt-1 text-[10px]" style={{ color: '#71717a' }}>A impressora detecta spaghetti / falha na 1ª camada e <b>pausa sozinha</b>; o e-Click registra a falha e avisa no WhatsApp com a foto da câmera.</p>
                {live.ai_detection_enabled && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: '#a1a1aa' }}>Sensibilidade:</span>
                    {(['low', 'medium', 'high'] as const).map(s => {
                      const on = (live.ai_sensitivity || 'medium') === s
                      return <button key={s} type="button" onClick={() => void setAi(true, s)} className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: on ? 'rgba(0,229,255,0.12)' : '#0a0a0e', color: on ? '#00E5FF' : '#71717a', border: `1px solid ${on ? 'rgba(0,229,255,0.35)' : '#27272a'}` }}>{s === 'low' ? 'Baixa' : s === 'medium' ? 'Média' : 'Alta'}</button>
                    })}
                  </div>
                )}
              </div>
            )}

            {/* auto-impressão (lights-out) */}
            {live && (
              <div className="mb-3 rounded-lg p-2.5" style={{ background: '#0c0c10', border: `1px solid ${live.auto_dispatch ? 'rgba(0,229,255,0.3)' : '#1a1a1f'}` }}>
                <div className="flex items-center gap-2">
                  <Rocket size={13} style={{ color: live.auto_dispatch ? '#00E5FF' : '#52525b' }} />
                  <span className="text-[11px] font-bold text-white">Auto-impressão (lights-out)</span>
                  <button type="button" onClick={() => void setAutoDisp(!live.auto_dispatch)} className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: live.auto_dispatch ? 'rgba(0,229,255,0.15)' : '#27272a', color: live.auto_dispatch ? '#00E5FF' : '#a1a1aa', border: `1px solid ${live.auto_dispatch ? 'rgba(0,229,255,0.4)' : '#3f3f46'}` }}>{live.auto_dispatch ? 'Ligada' : 'Desligada'}</button>
                </div>
                <p className="mt-1 text-[10px]" style={{ color: '#71717a' }}>Quando ficar ociosa, inicia <b>sozinha</b> a próxima ordem da fila que consegue rodar (filamento certo + .3mf), pela prioridade R$/hora. ⚠️ ação real na máquina — exige o start remoto da Bambu (Developer Mode).</p>
              </div>
            )}

            {/* filamento carregado */}
            <LoadedFilamentSection printerId={id} onChanged={onChanged} />

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
  // Linha (coleção) — escolher existente ou criar nova já na criação do projeto
  const [lines, setLines] = useState<TaxOption[]>([])
  const [lineId, setLineId] = useState(''); const [newLine, setNewLine] = useState(''); const [creatingLine, setCreatingLine] = useState(false)
  useEffect(() => { void (async () => { try { setLines(await api<TaxOption[]>('/product-os/lines')) } catch { /* */ } })() }, [])
  const create = async () => {
    if (!form.name.trim()) { setErr('Nome é obrigatório'); return }
    setBusy(true); setErr('')
    try {
      const dev = await api<{ id: string }>('/product-os', { method: 'POST', body: JSON.stringify({ name: form.name, category: form.category || undefined, description: form.description || undefined, inspiration_url: form.inspiration_url || undefined, reference_images: form.reference_url ? [{ url: form.reference_url }] : undefined }) })
      const body = creatingLine ? (newLine.trim() ? { line_name: newLine.trim() } : null) : (lineId ? { line_id: lineId } : null)
      if (body) await api(`/product-os/${dev.id}/line`, { method: 'POST', body: JSON.stringify(body) }).catch(() => {})
      onCreated()
    }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); setBusy(false) }
  }
  return (
    <Modal title="Novo produto" onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <div className="space-y-2.5">
        <Input label="Nome *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />

        {/* Linha de produtos (coleção) */}
        <div className="rounded-lg p-2.5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
          <div className="mb-1 flex items-center gap-1.5"><Layers size={12} className="text-cyan-400" /><span className="text-[11px] font-bold text-white">Linha de produtos (coleção)</span></div>
          <p className="mb-1.5 text-[10px]" style={{ color: '#71717a' }}>A qual linha este produto pertence? (ex: “Ella”). Pode definir depois na Ficha.</p>
          {!creatingLine ? (
            <div className="flex gap-1">
              <select value={lineId} onChange={e => setLineId(e.target.value)} className="flex-1 rounded-lg px-2 py-1.5 text-[11px] text-white" style={{ background: '#111114', border: '1px solid #27272a' }}>
                <option value="">— sem linha por enquanto —</option>
                {lines.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <button onClick={() => { setCreatingLine(true); setLineId('') }} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold" style={{ background: '#111114', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}><Plus size={11} /> nova</button>
            </div>
          ) : (
            <div className="flex gap-1">
              <input autoFocus value={newLine} onChange={e => setNewLine(e.target.value)} placeholder="nome da linha (ex: Ella)" className="flex-1 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none" style={{ background: '#111114', border: '1px solid #27272a' }} />
              <button onClick={() => { setCreatingLine(false); setNewLine('') }} className="rounded-lg px-2.5 py-1.5 text-[10px]" style={{ background: '#111114', color: '#71717a', border: '1px solid #27272a' }}>×</button>
            </div>
          )}
        </div>

        <Input label="Categoria" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} />
        <Input label="Descrição / ideia" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
        <Input label="Link de inspiração" value={form.inspiration_url} onChange={v => setForm(f => ({ ...f, inspiration_url: v }))} />
        <div>
          <div className="flex items-center gap-2">
            <UploadButton label="Imagem base / referência" accept="image/*" onUploaded={urls => setForm(f => ({ ...f, reference_url: urls[0] }))} />
            {form.reference_url && <span className="text-[10px]" style={{ color: '#4ade80' }}>✓ imagem enviada</span>}
          </div>
          <p className="mt-1 text-[10px]" style={{ color: '#71717a' }}>Serve de base pra IA gerar a foto de catálogo com inspiração nela. Opcional — dá pra subir depois na hora de gerar a imagem.</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end"><button onClick={() => void create()} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Criar</button></div>
    </Modal>
  )
}

const PLATFORM_LABEL: Record<string, string> = { makerworld: 'MakerWorld', thingiverse: 'Thingiverse', cults3d: 'Cults3D', thangs: 'Thangs', myminifactory: 'MyMiniFactory' }
const platformName = (p?: string) => (p ? PLATFORM_LABEL[p] ?? p : '')

const VERDICT_STYLE: Record<'green' | 'yellow' | 'red', { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  green:  { color: '#4ade80', bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.30)', icon: <CheckCircle2 size={13} /> },
  yellow: { color: '#fcd34d', bg: 'rgba(252,211,77,0.10)', border: 'rgba(252,211,77,0.30)', icon: <AlertTriangle size={13} /> },
  red:    { color: '#f87171', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)', icon: <Ban size={13} /> },
}

function LicenseBadge({ st, compact }: { st: LicenseStatus; compact?: boolean }) {
  if (!st.imported || !st.verdict) return null
  if (st.cleared) {
    const s = VERDICT_STYLE.green
    return <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}><CheckCircle2 size={9} /> licença liberada</span>
  }
  const s = VERDICT_STYLE[st.verdict.level]
  const label = compact ? (st.verdict.level === 'green' ? 'licença OK' : st.verdict.level === 'yellow' ? 'não comercial' : 'bloqueado') : st.verdict.label
  return <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.icon}{st.license ? <span className="font-mono">{st.license}</span> : label}</span>
}

/** Bloco "Licença & origem" no drawer — porteiro da Peça 2. */
function LicenseOriginBlock({ st, onClear, busy }: { st: LicenseStatus; onClear: (cleared: boolean) => void; busy: boolean }) {
  if (!st.imported || !st.verdict) return null
  const v = st.cleared ? VERDICT_STYLE.green : VERDICT_STYLE[st.verdict.level]
  return (
    <div className="mb-3 rounded-xl p-3" style={{ background: '#0a0a0e', border: `1px solid ${v.border}` }}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#71717a' }}>Licença &amp; origem</span>
        <LicenseBadge st={st} />
        {st.source_url && <a href={st.source_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] underline" style={{ color: '#71717a' }}>Ver origem ↗</a>}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug" style={{ color: '#a1a1aa' }}>{st.verdict.reason}</p>

      {st.cleared ? (
        <div className="mt-2 rounded-lg p-2" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
          <p className="text-[11px] font-semibold" style={{ color: '#4ade80' }}>✓ Licença liberada{st.cleared_at ? ` em ${new Date(st.cleared_at).toLocaleDateString('pt-BR')}` : ''}</p>
          {st.cleared_note && <p className="mt-0.5 text-[11px]" style={{ color: '#a1a1aa' }}>{st.cleared_note}</p>}
          <button onClick={() => onClear(false)} disabled={busy} className="mt-1.5 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50" style={{ background: '#111114', border: '1px solid #27272a', color: '#a1a1aa' }}>{busy ? <Loader2 size={10} className="animate-spin" /> : <Ban size={10} />} Remover liberação</button>
        </div>
      ) : st.blocked ? (
        <div className="mt-2 rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <p className="text-[11px] font-semibold" style={{ color: '#f87171' }}>Publicação bloqueada — a licença não permite remodelar e vender.</p>
          <p className="mt-0.5 text-[11px]" style={{ color: '#a1a1aa' }}>Se você adquiriu licença comercial ou foi autorizado pelo criador, registre a liberação.</p>
          <button onClick={() => onClear(true)} disabled={busy} className="mt-1.5 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} Marcar licença liberada</button>
        </div>
      ) : null}
    </div>
  )
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
    <Modal title="Importar modelo 3D" onClose={onClose}>
      {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <p className="mb-3 text-xs" style={{ color: '#a1a1aa' }}>Cole o link do modelo — <span style={{ color: '#a5f3fc' }}>MakerWorld</span>, <span style={{ color: '#a5f3fc' }}>Thingiverse</span> e mais. Lemos capa, métricas, licença e (quando houver) peso/tempo/material.</p>
      <div className="flex items-end gap-2">
        <div className="flex-1"><Input label="Link ou ID do modelo" value={url} onChange={setUrl} placeholder="makerworld.com/models/… ou thingiverse.com/thing:…" /></div>
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
              <p className="mt-0.5 text-[11px]" style={{ color: '#71717a' }}>{platformName(preview.platform)} · {preview.creator ?? 'criador desconhecido'}{preview.is_remix && ' · remix'}</p>
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

function RadarPanel({ onImported }: { onImported: (id: string) => void }) {
  const [mode, setMode] = useState<'radar' | 'criadores' | 'emalta'>('radar')
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg p-1" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f', width: 'fit-content' }}>
        {([['radar', 'Meu radar', <Trophy key="1" size={12} />], ['criadores', 'Criadores', <Users key="2" size={12} />], ['emalta', 'Em alta', <Flame key="3" size={12} />]] as const).map(([k, lbl, ic]) => (
          <button key={k} onClick={() => setMode(k)} className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold" style={{ background: mode === k ? 'rgba(0,229,255,0.12)' : 'transparent', color: mode === k ? '#00E5FF' : '#71717a' }}>{ic}{lbl}</button>
        ))}
      </div>
      {mode === 'radar' && <RadarWatchlist onImported={onImported} />}
      {mode === 'criadores' && <CreatorsView onImported={onImported} />}
      {mode === 'emalta' && <DiscoverView onImported={onImported} />}
    </div>
  )
}

function RadarWatchlist({ onImported }: { onImported: (id: string) => void }) {
  const [items, setItems] = useState<RadarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState(''); const [adding, setAdding] = useState(false); const [refreshing, setRefreshing] = useState(false)
  const [err, setErr] = useState(''); const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try { setItems(await api<RadarItem[]>('/product-os/radar')) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const add = async () => {
    if (!url.trim()) return
    setAdding(true); setErr('')
    try { await api('/product-os/radar', { method: 'POST', body: JSON.stringify({ url }) }); setUrl(''); await load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setAdding(false) }
  }
  const refreshAll = async () => { setRefreshing(true); setErr(''); try { await api('/product-os/radar/refresh', { method: 'POST' }); await load() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setRefreshing(false) } }
  const act = async (id: string, fn: () => Promise<unknown>) => { setBusyId(id); setErr(''); try { await fn(); await load() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusyId(null) } }
  const setDecision = (id: string, decision: string) => void act(id, () => api(`/product-os/radar/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) }))
  const refreshOne = (id: string) => void act(id, () => api(`/product-os/radar/${id}/refresh`, { method: 'POST' }))
  const aiSuggest = (id: string) => void act(id, () => api(`/product-os/radar/${id}/ai-suggest`, { method: 'POST' }))
  const remove = async (id: string) => { if (await confirmDialog({ title: 'Remover do radar', message: 'Remover este item do radar?', danger: true, confirmLabel: 'Remover' })) void act(id, () => api(`/product-os/radar/${id}/remove`, { method: 'POST' })) }
  const importIt = async (it: RadarItem) => {
    setBusyId(it.id); setErr('')
    try { const r = await api<{ product_dev: { id: string } }>('/product-os/import/makerworld', { method: 'POST', body: JSON.stringify({ url: it.source_url || it.external_id }) }); onImported(r.product_dev.id) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); setBusyId(null) }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1"><Input label="Adicionar ao radar (link MakerWorld, Thingiverse…)" value={url} onChange={setUrl} placeholder="makerworld.com/models/… ou thingiverse.com/thing:…" /></div>
          <button onClick={() => void add()} disabled={adding || !url.trim()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Observar</button>
          <button onClick={() => void refreshAll()} disabled={refreshing || !items.length} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#a1a1aa' }}>{refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Atualizar tudo</button>
        </div>
        <p className="mt-2 text-[11px]" style={{ color: '#71717a' }}>O ranking é por <span style={{ color: '#a5f3fc' }}>velocidade</span> (downloads/prints ganhos por semana), não pelo total. Modelos novos sobem conforme o sistema os fotografa ao longo dos dias (1×/dia automático).</p>
      </div>

      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

      {loading ? <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}><Loader2 size={14} className="animate-spin" /> Carregando…</div>
        : !items.length ? <p className="text-xs" style={{ color: '#a1a1aa' }}>Radar vazio. Cole o link de um modelo do MakerWorld que você quer acompanhar.</p>
        : <div className="space-y-2">{items.map((it, idx) => <RadarCard key={it.id} it={it} rank={idx + 1} busy={busyId === it.id} onDecision={setDecision} onRefresh={refreshOne} onAi={aiSuggest} onRemove={remove} onImport={importIt} />)}</div>}
    </div>
  )
}

function RadarCard({ it, rank, busy, onDecision, onRefresh, onAi, onRemove, onImport }: {
  it: RadarItem; rank: number; busy: boolean
  onDecision: (id: string, d: string) => void; onRefresh: (id: string) => void; onAi: (id: string) => void; onRemove: (id: string) => void; onImport: (it: RadarItem) => void
}) {
  const v = VERDICT_STYLE[it.verdict.level]
  const coleta = it.velocity_status === 'coletando'
  const DEC: Array<[string, string, string]> = [['comprar', 'Comprar', '#4ade80'], ['observar', 'Observar', '#a5f3fc'], ['ignorar', 'Ignorar', '#71717a']]
  return (
    <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold" style={{ color: '#52525b' }}>#{rank}</span>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {it.cover_url ? <img src={it.cover_url} alt="" className="h-full w-full object-cover" /> : <Package size={18} style={{ color: '#3f3f46' }} />}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{it.title ?? `MakerWorld ${it.external_id}`}</p>
              <p className="truncate text-[11px]" style={{ color: '#71717a' }}>{platformName(it.platform)} · {it.creator ?? 'criador desconhecido'}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: v.bg, color: v.color, border: `1px solid ${v.border}` }}>{v.icon}{it.license ?? it.verdict.label}</span>
          </div>

          {/* métricas */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="text-center"><p className="text-base font-extrabold leading-none" style={{ color: coleta ? '#52525b' : '#00E5FF' }}>{coleta ? '—' : it.champion_score}</p><p className="text-[9px] uppercase" style={{ color: '#52525b' }}>score</p></div>
            <div className="text-center"><p className="text-sm font-bold leading-none text-white">{coleta ? '—' : `+${it.downloads_per_week}`}</p><p className="text-[9px]" style={{ color: '#52525b' }}>downloads/sem</p></div>
            <div className="text-center"><p className="text-sm font-bold leading-none text-white">{coleta ? '—' : `+${it.prints_per_week}`}</p><p className="text-[9px]" style={{ color: '#52525b' }}>prints/sem</p></div>
            <div className="text-center"><p className="text-xs font-semibold leading-none" style={{ color: '#a1a1aa' }}>{it.last_download_count} · {it.last_print_count}</p><p className="text-[9px]" style={{ color: '#52525b' }}>tot. down · print</p></div>
            {coleta && <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.25)' }}>coletando ({it.days_tracked}d)</span>}
          </div>

          {it.ai_suggestion?.rationale && (
            <div className="mt-2 rounded-lg p-2 text-[11px]" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.18)', color: '#a5f3fc' }}>
              <span className="font-bold">IA: {it.ai_suggestion.decision}</span>{typeof it.ai_suggestion.confidence === 'number' && <span style={{ color: '#71717a' }}> ({Math.round(it.ai_suggestion.confidence * 100)}%)</span>} — <span style={{ color: '#a1a1aa' }}>{it.ai_suggestion.rationale}</span>
            </div>
          )}

          {/* decisão + ações */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {DEC.map(([key, lbl, color]) => (
              <button key={key} onClick={() => onDecision(it.id, key)} disabled={busy} className="rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: it.decision === key ? `${color}22` : 'transparent', color: it.decision === key ? color : '#52525b', border: `1px solid ${it.decision === key ? color + '55' : '#27272a'}` }}>{lbl}</button>
            ))}
            <span className="mx-1 h-4 w-px" style={{ background: '#27272a' }} />
            <button onClick={() => onImport(it)} disabled={busy} title="Importar como produto" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}><Rocket size={11} /> Importar</button>
            <button onClick={() => onAi(it.id)} disabled={busy} title="Sugestão da IA" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#a5f3fc' }}><Sparkles size={11} /> IA</button>
            <button onClick={() => onRefresh(it.id)} disabled={busy} title="Atualizar métricas" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#a1a1aa' }}>{busy ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}</button>
            {it.source_url && <a href={it.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#71717a' }}><ExternalLink size={11} /></a>}
            <button onClick={() => onRemove(it.id)} disabled={busy} title="Remover do radar" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#f87171' }}><Trash2 size={11} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Criadores (Fase E) ────────────────────────────────────────────
function CreatorsView({ onImported }: { onImported: (id: string) => void }) {
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [creators, setCreators] = useState<TrackedCreator[]>([])
  const [platform, setPlatform] = useState(''); const [handle, setHandle] = useState('')
  const [adding, setAdding] = useState(false); const [err, setErr] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [models, setModels] = useState<ExtModel[]>([]); const [loadingModels, setLoadingModels] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api<SourceInfo[]>('/product-os/sources'), api<TrackedCreator[]>('/product-os/creators')])
      const creatorSources = s.filter(x => x.configured && x.can_creator)
      setSources(creatorSources); setCreators(c)
      if (!platform && creatorSources[0]) setPlatform(creatorSources[0].platform)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }, [platform])
  useEffect(() => { void loadAll() }, [loadAll])

  const openCreator = async (c: TrackedCreator) => {
    setSelected(c.id); setLoadingModels(true); setErr(''); setModels([])
    try { setModels(await api<ExtModel[]>(`/product-os/creators/${c.id}/models`)) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoadingModels(false) }
  }
  const add = async () => {
    if (!platform || !handle.trim()) return
    setAdding(true); setErr('')
    try { const r = await api<{ creator: TrackedCreator; models: ExtModel[] }>('/product-os/creators', { method: 'POST', body: JSON.stringify({ platform, handle }) }); setHandle(''); await loadAll(); setSelected(r.creator.id); setModels(r.models) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setAdding(false) }
  }
  const remove = async (id: string) => { if (!(await confirmDialog({ title: 'Deixar de seguir', message: 'Deixar de seguir este criador?', confirmLabel: 'Deixar de seguir' }))) return; try { await api(`/product-os/creators/${id}/remove`, { method: 'POST' }); if (selected === id) { setSelected(null); setModels([]) } await loadAll() } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } }

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Plataforma</span>
            <select value={platform} onChange={e => setPlatform(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
              {sources.map(s => <option key={s.platform} value={s.platform}>{s.label}</option>)}
            </select></label>
          <div className="min-w-[180px] flex-1"><Input label="Nick do criador" value={handle} onChange={setHandle} placeholder="ex: CreativeTools" /></div>
          <button onClick={() => void add()} disabled={adding || !handle.trim()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Seguir</button>
        </div>
        {!sources.length && <p className="mt-2 text-[11px]" style={{ color: '#fcd34d' }}>Nenhuma fonte com busca por criador configurada (Thingiverse/Cults3D).</p>}
      </div>

      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

      {creators.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {creators.map(c => (
            <button key={c.id} onClick={() => void openCreator(c)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold" style={{ background: selected === c.id ? 'rgba(0,229,255,0.12)' : '#111114', border: `1px solid ${selected === c.id ? 'rgba(0,229,255,0.35)' : '#27272a'}`, color: selected === c.id ? '#00E5FF' : '#a1a1aa' }}>
              <Users size={11} />{c.display_name || c.handle}<span style={{ color: '#52525b' }}>· {platformName(c.platform)}</span>
              <span onClick={e => { e.stopPropagation(); void remove(c.id) }} style={{ color: '#52525b' }}><Trash2 size={11} /></span>
            </button>
          ))}
        </div>
      )}

      {loadingModels ? <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}><Loader2 size={14} className="animate-spin" /> Carregando modelos…</div>
        : selected && !models.length ? <p className="text-xs" style={{ color: '#a1a1aa' }}>Nenhum modelo encontrado.</p>
        : models.length > 0 ? <ExtModelGrid models={models} onImported={onImported} /> : !creators.length ? <p className="text-xs" style={{ color: '#a1a1aa' }}>Siga um criador pra ver e ranquear os modelos dele.</p> : <p className="text-xs" style={{ color: '#71717a' }}>Clique num criador acima pra ver os modelos.</p>}
    </div>
  )
}

// ── Em alta / descoberta (Fase D) ─────────────────────────────────
function DiscoverView({ onImported }: { onImported: (id: string) => void }) {
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [platform, setPlatform] = useState(''); const [commercial, setCommercial] = useState(true)
  const [cats, setCats] = useState<{ slug: string; name: string }[]>([]); const [category, setCategory] = useState('')
  const [query, setQuery] = useState(''); const [submittedQuery, setSubmittedQuery] = useState('')
  const [sort, setSort] = useState<'downloads' | 'recent'>('downloads')
  const [models, setModels] = useState<ExtModel[]>([]); const [loading, setLoading] = useState(false); const [err, setErr] = useState('')

  useEffect(() => { void (async () => {
    try { const s = await api<SourceInfo[]>('/product-os/sources'); const d = s.filter(x => x.configured && x.can_discover); setSources(d); if (d[0]) setPlatform(d[0].platform) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  })() }, [])

  // carrega categorias quando troca de plataforma (se a fonte expuser)
  useEffect(() => {
    const src = sources.find(s => s.platform === platform); setCategory(''); setCats([])
    if (!src?.can_categories) return
    void (async () => { try { setCats(await api<{ slug: string; name: string }[]>(`/product-os/categories?platform=${platform}`)) } catch { /* sem categorias */ } })()
  }, [platform, sources])

  const load = useCallback(async () => {
    if (!platform) return
    setLoading(true); setErr('')
    const qs = submittedQuery ? `&q=${encodeURIComponent(submittedQuery)}` : `${category ? `&category=${encodeURIComponent(category)}` : ''}&sort=${sort}`
    try { setModels(await api<ExtModel[]>(`/product-os/discover?platform=${platform}&commercial=${commercial ? '1' : '0'}${qs}`)) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setLoading(false) }
  }, [platform, commercial, category, submittedQuery, sort])
  useEffect(() => { void load() }, [load])
  const doSearch = () => setSubmittedQuery(query.trim())
  const clearSearch = () => { setQuery(''); setSubmittedQuery('') }

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        {!sources.length ? <p className="text-[11px]" style={{ color: '#fcd34d' }}>Nenhuma fonte com feed de descoberta configurada (Cults3D).</p> : (
          <div className="flex flex-wrap items-end gap-3">
            {/* busca por palavra-chave (linha própria) */}
            <div className="flex w-full items-center gap-2">
              <Search size={14} style={{ color: '#52525b' }} />
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doSearch() }} placeholder="Buscar por palavra (ex: vaso ondulado, luminária lua, organizador)…" className="flex-1 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-cyan-500" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
              <button onClick={doSearch} disabled={loading || !query.trim()} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Buscar</button>
              {submittedQuery && <button onClick={clearSearch} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#a1a1aa' }}>limpar</button>}
            </div>
            <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Plataforma</span>
              <select value={platform} onChange={e => setPlatform(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
                {sources.map(s => <option key={s.platform} value={s.platform}>{s.label}</option>)}
              </select></label>
            {cats.length > 0 && (
              <label className="block" style={{ opacity: submittedQuery ? 0.4 : 1 }}><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#71717a' }}>Categoria{submittedQuery ? ' (ignorada na busca)' : ''}</span>
                <select value={category} onChange={e => setCategory(e.target.value)} disabled={!!submittedQuery} className="max-w-[220px] rounded-lg px-2.5 py-1.5 text-xs outline-none" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }}>
                  <option value="">Todas as categorias</option>
                  {cats.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select></label>
            )}
            <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-xs" style={{ color: '#a1a1aa' }}>
              <input type="checkbox" checked={commercial} onChange={e => setCommercial(e.target.checked)} /> Só vendáveis
            </label>
            {!submittedQuery && (
              <div className="flex items-center gap-1 pb-1 rounded-lg p-0.5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
                {([['downloads', 'Mais baixados'], ['recent', 'Recentes']] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setSort(k)} className="rounded px-2 py-1 text-[10px] font-semibold" style={{ background: sort === k ? 'rgba(0,229,255,0.12)' : 'transparent', color: sort === k ? '#00E5FF' : '#71717a' }}>{lbl}</button>
                ))}
              </div>
            )}
            <button onClick={() => void load()} disabled={loading} className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#a1a1aa' }}>{loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Atualizar</button>
          </div>
        )}
        <p className="mt-2 text-[11px]" style={{ color: '#71717a' }}>{submittedQuery ? <>Resultados de <span style={{ color: '#a5f3fc' }}>“{submittedQuery}”</span> por downloads.</> : <>Campeões por downloads — <span style={{ color: '#a5f3fc' }}>busque por palavra</span> ou filtre por categoria.</>} Só os <span style={{ color: '#4ade80' }}>vendáveis</span> com o filtro ligado; o veredito flagra os sem-derivados (vermelho).</p>
      </div>
      {err && <div className="rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      {loading ? <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}><Loader2 size={14} className="animate-spin" /> Carregando…</div>
        : <ExtModelGrid models={models} onImported={onImported} />}
    </div>
  )
}

// grid compartilhado de modelos externos (criadores + em alta)
function ExtModelGrid({ models, onImported }: { models: ExtModel[]; onImported: (id: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  const imp = async (m: ExtModel) => { setBusy(m.source_url); setErr(''); try { const r = await api<{ product_dev: { id: string } }>('/product-os/import/makerworld', { method: 'POST', body: JSON.stringify({ url: m.source_url }) }); onImported(r.product_dev.id) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro'); setBusy(null) } }
  const obs = async (m: ExtModel) => { setBusy(m.source_url + ':o'); setErr(''); setMsg('') ; try { await api('/product-os/radar', { method: 'POST', body: JSON.stringify({ url: m.source_url }) }); setMsg(`Adicionado ao radar: ${m.title}`) } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') } finally { setBusy(null) } }
  if (!models.length) return null
  return (
    <div className="space-y-2">
      {msg && <div className="rounded-lg p-2 text-[11px]" style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>{msg}</div>}
      {err && <div className="rounded-lg p-2 text-[11px]" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {models.map(m => <ExtModelCard key={m.platform + m.external_id} m={m} busy={busy === m.source_url} busyObs={busy === m.source_url + ':o'} onImport={() => void imp(m)} onObserve={() => void obs(m)} />)}
      </div>
    </div>
  )
}

function ExtModelCard({ m, busy, busyObs, onImport, onObserve }: { m: ExtModel; busy: boolean; busyObs: boolean; onImport: () => void; onObserve: () => void }) {
  const v = VERDICT_STYLE[m.verdict.level]
  return (
    <div className="flex flex-col rounded-xl p-2.5" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="flex gap-2.5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {m.cover_url ? <img src={m.cover_url} alt="" className="h-full w-full object-cover" /> : <Package size={18} style={{ color: '#3f3f46' }} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-xs font-bold leading-tight text-white">{m.title}</p>
          <p className="mt-0.5 truncate text-[10px]" style={{ color: '#71717a' }}>{platformName(m.platform)} · {m.creator ?? '—'}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]" style={{ color: '#a1a1aa' }}>
            <span className="flex items-center gap-0.5"><Download size={10} />{m.download_count}</span>
            <span className="flex items-center gap-0.5"><Heart size={10} />{m.like_count}</span>
            {m.price ? <span style={{ color: '#fcd34d' }}>${m.price.toFixed(2)}</span> : null}
          </div>
        </div>
      </div>
      <span className="mt-2 flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: v.bg, color: v.color, border: `1px solid ${v.border}` }}>{v.icon}{m.license ?? m.verdict.label}</span>
      <div className="mt-2 flex items-center gap-1.5">
        <button onClick={onImport} disabled={busy} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold disabled:opacity-50" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>{busy ? <Loader2 size={11} className="animate-spin" /> : <Rocket size={11} />} Importar</button>
        <button onClick={onObserve} disabled={busyObs} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold disabled:opacity-50" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#a5f3fc' }}>{busyObs ? <Loader2 size={11} className="animate-spin" /> : <Trophy size={11} />} + Radar</button>
        <a href={m.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#71717a' }}><ExternalLink size={11} /></a>
      </div>
    </div>
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

function ConfirmModal({ title, message, confirmLabel = 'Confirmar', danger, busy, onConfirm, onClose }: { title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  const c = danger ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', color: '#f87171' } : { bg: 'rgba(0,229,255,0.12)', border: 'rgba(0,229,255,0.35)', color: '#00E5FF' }
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#a1a1aa' }}>Cancelar</button>
        <button onClick={onConfirm} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>{busy ? <Loader2 size={12} className="animate-spin" /> : danger ? <Trash2 size={12} /> : <CheckCircle2 size={12} />} {confirmLabel}</button>
      </div>
    </Modal>
  )
}

// confirm imperativo (substitui window.confirm) — renderizado pelo ConfirmHost
type ConfirmOpts = { title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean }
let _confirm: ((o: ConfirmOpts) => Promise<boolean>) | null = null
function confirmDialog(o: ConfirmOpts): Promise<boolean> { return _confirm ? _confirm(o) : Promise.resolve(true) }
function ConfirmHost() {
  const [st, setSt] = useState<{ o: ConfirmOpts; resolve: (v: boolean) => void } | null>(null)
  useEffect(() => { _confirm = o => new Promise<boolean>(res => setSt({ o, resolve: res })); return () => { _confirm = null } }, [])
  if (!st) return null
  const done = (v: boolean) => { st.resolve(v); setSt(null) }
  return <ConfirmModal title={st.o.title} message={st.o.message} confirmLabel={st.o.confirmLabel} danger={st.o.danger} onConfirm={() => done(true)} onClose={() => done(false)} />
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
