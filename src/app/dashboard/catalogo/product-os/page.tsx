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
  AlertTriangle, CheckCircle2, FileBox, RefreshCw,
  Check, Ban, Package,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── tipos (espelho do backend) ─────────────────────────────────────
type Status =
  | 'ideia' | 'briefing' | 'modelagem' | 'prototipo'
  | 'aprovado' | 'publicado' | 'monitorando' | 'arquivado'

interface ReferenceImage { url: string; source_url?: string | null; notes?: string | null }

interface ProductDev {
  id: string
  name: string
  category: string | null
  description: string | null
  status: Status
  production_profile: 'impressao_3d' | 'marca_propria' | 'generico'
  reference_images: ReferenceImage[]
  inspiration_url: string | null
  briefing: Record<string, unknown> | null
  briefing_text: string | null
  target_marketplaces: string[]
  target_price: number | null
  estimated_cost: number | null
  position: number
  created_at: string
}

interface Version {
  id: string
  version_number: number
  changelog: string | null
  file_url: string | null
  file_type: string | null
  material: string | null
  weight_g: number | null
  print_time_minutes: number | null
  volume_cm3: number | null
  prototype_photo_urls: string[]
  status: 'rascunho' | 'impressao' | 'aprovado' | 'reprovado'
  approved: boolean
  notes: string | null
  created_at: string
}

interface DevDetail extends ProductDev { versions: Version[] }

interface CostResult {
  cost: { filament: number; energy: number; labor: number; packaging: number; waste: number; total: number }
  inputs: { weight_g: number; print_time_minutes: number; material: string; cost_per_kg: number }
  target_margin_pct: number
  suggested_prices: Array<{ channel: string; fee_pct: number; price: number; margin_pct: number }>
}

interface Settings {
  filament_cost_per_kg: Record<string, number>
  energy_cost_per_hour: number
  labor_cost_per_hour: number
  packaging_cost: number
  default_waste_pct: number
  machines: Array<{ name: string; model?: string; bed_mm?: number[] }>
}

const COLUMNS: { key: Status; label: string }[] = [
  { key: 'ideia',       label: 'Ideia' },
  { key: 'briefing',    label: 'Briefing' },
  { key: 'modelagem',   label: 'Modelagem' },
  { key: 'prototipo',   label: 'Protótipo' },
  { key: 'aprovado',    label: 'Aprovado' },
  { key: 'publicado',   label: 'Publicado' },
  { key: 'monitorando', label: 'Monitorando' },
]

const CHANNEL_LABEL: Record<string, string> = {
  mercado_livre: 'Mercado Livre', shopee: 'Shopee', tiktok: 'TikTok', loja: 'Loja própria',
}

// ── helpers de API ──────────────────────────────────────────────────
async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`[${res.status}] ${(body as { message?: string }).message ?? 'erro'}`)
  }
  return (await res.json()) as T
}

// ════════════════════════════════════════════════════════════════════
export default function ProductOsPage() {
  const [items, setItems] = useState<ProductDev[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await api<ProductDev[]>('/product-os')
      setItems(data.filter(d => d.status !== 'arquivado'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null)
    const id = String(e.active.id)
    const overCol = e.over?.id ? String(e.over.id) as Status : null
    if (!overCol) return
    const dev = items.find(d => d.id === id)
    if (!dev || dev.status === overCol) return
    // otimista
    setItems(prev => prev.map(d => d.id === id ? { ...d, status: overCol } : d))
    try { await api(`/product-os/${id}/move`, { method: 'POST', body: JSON.stringify({ status: overCol }) }) }
    catch (err) { setError(err instanceof Error ? err.message : 'Erro ao mover'); void load() }
  }

  const active = activeId ? items.find(d => d.id === activeId) ?? null : null

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.3)' }}>
          <Lightbulb size={18} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-white">Product OS</h1>
          <p className="text-xs" style={{ color: '#a1a1aa' }}>Da ideia ao produto vendido — crie, modele, custe e publique produtos próprios.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ background: '#111114', border: '1px solid #27272a', color: '#a1a1aa' }}>
            <RefreshCw size={12} /> Atualizar
          </button>
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ background: '#111114', border: '1px solid #27272a', color: '#a1a1aa' }}>
            <Settings2 size={12} /> Fabricação
          </button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
            style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
            <Plus size={12} /> Novo produto
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg p-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={14} className="shrink-0" /> <span className="whitespace-pre-line">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-sm" style={{ color: '#71717a' }}>
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {COLUMNS.map(col => (
              <Column key={col.key} col={col} items={items.filter(d => d.status === col.key)} onOpen={setOpenId} />
            ))}
          </div>
          <DragOverlay>{active ? <Card dev={active} dragging /> : null}</DragOverlay>
        </DndContext>
      )}

      {openId && <DetailDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
      {showNew && <NewProductModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); void load() }} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

// ── coluna droppable ────────────────────────────────────────────────
function Column({ col, items, onOpen }: { col: { key: Status; label: string }; items: ProductDev[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })
  return (
    <div ref={setNodeRef} className="flex w-64 shrink-0 flex-col rounded-xl"
      style={{ background: isOver ? 'rgba(0,229,255,0.05)' : '#0c0c10', border: `1px solid ${isOver ? 'rgba(0,229,255,0.4)' : '#1a1a1f'}` }}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#a1a1aa' }}>{col.label}</span>
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#1a1a1f', color: '#71717a' }}>{items.length}</span>
      </div>
      <div className="flex flex-col gap-2 px-2 pb-2" style={{ minHeight: 80 }}>
        {items.map(d => <DraggableCard key={d.id} dev={d} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

function DraggableCard({ dev, onOpen }: { dev: ProductDev; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dev.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      onClick={() => onOpen(dev.id)}
      style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab' }}>
      <Card dev={dev} />
    </div>
  )
}

function Card({ dev, dragging }: { dev: ProductDev; dragging?: boolean }) {
  const cover = dev.reference_images?.[0]?.url
  return (
    <div className="rounded-lg p-2.5"
      style={{ background: '#111114', border: `1px solid ${dragging ? 'rgba(0,229,255,0.5)' : '#27272a'}`, boxShadow: dragging ? '0 8px 24px rgba(0,229,255,0.15)' : undefined }}>
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md" style={{ background: '#0a0a0e', border: '1px solid #1a1a1f' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <Package size={14} style={{ color: '#3f3f46' }} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white">{dev.name}</p>
          <p className="truncate text-[10px]" style={{ color: '#71717a' }}>{dev.category ?? 'sem categoria'}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {dev.briefing && <Pill icon={<Sparkles size={9} />} label="briefing" />}
        {dev.estimated_cost != null && <Pill icon={<DollarSign size={9} />} label={`R$ ${dev.estimated_cost.toFixed(2)}`} />}
      </div>
    </div>
  )
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold"
      style={{ background: 'rgba(0,229,255,0.08)', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.2)' }}>
      {icon}{label}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════
// DRAWER de detalhe — info + briefing IA + versões + custo
// ════════════════════════════════════════════════════════════════════
function DetailDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [dev, setDev] = useState<DevDetail | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'briefing' | 'versoes' | 'custo'>('briefing')

  const reload = useCallback(async () => {
    try { setDev(await api<DevDetail>(`/product-os/${id}`)) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }, [id])
  useEffect(() => { void reload() }, [reload])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto p-5" style={{ background: '#0a0a0e', borderLeft: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        {!dev ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-2">
              <div>
                <h2 className="text-base font-extrabold text-white">{dev.name}</h2>
                <p className="text-xs" style={{ color: '#71717a' }}>{dev.category ?? 'sem categoria'} · {dev.status}</p>
              </div>
              <button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={18} /></button>
            </div>

            {dev.description && <p className="mb-4 text-xs" style={{ color: '#a1a1aa' }}>{dev.description}</p>}

            {err && <div className="mb-3 whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

            {/* tabs */}
            <div className="mb-4 flex gap-1 rounded-lg p-1" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
              {([['briefing', 'Briefing IA', <Sparkles key="a" size={12} />], ['versoes', 'Versões', <FileBox key="b" size={12} />], ['custo', 'Custo & Preço', <DollarSign key="c" size={12} />]] as const).map(([k, lbl, ic]) => (
                <button key={k} onClick={() => setTab(k)} className="flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold"
                  style={{ background: tab === k ? 'rgba(0,229,255,0.12)' : 'transparent', color: tab === k ? '#00E5FF' : '#71717a' }}>
                  {ic}{lbl}
                </button>
              ))}
            </div>

            {tab === 'briefing' && <BriefingTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
            {tab === 'versoes' && <VersionsTab dev={dev} onChanged={() => { void reload(); onChanged() }} />}
            {tab === 'custo' && <CostTab dev={dev} onChanged={onChanged} />}
          </>
        )}
      </div>
    </div>
  )
}

function BriefingTab({ dev, onChanged }: { dev: DevDetail; onChanged: () => void }) {
  const [gen, setGen] = useState(false)
  const [err, setErr] = useState('')
  const [dims, setDims] = useState({ width_mm: '', depth_mm: '', height_mm: '' })
  const [material, setMaterial] = useState('')
  const [wall, setWall] = useState('')
  const [notes, setNotes] = useState('')

  const generate = async () => {
    setGen(true); setErr('')
    try {
      await api(`/product-os/${dev.id}/briefing`, {
        method: 'POST',
        body: JSON.stringify({
          dimensions: {
            width_mm: dims.width_mm ? Number(dims.width_mm) : undefined,
            depth_mm: dims.depth_mm ? Number(dims.depth_mm) : undefined,
            height_mm: dims.height_mm ? Number(dims.height_mm) : undefined,
          },
          material: material || undefined,
          wall_thickness_mm: wall ? Number(wall) : undefined,
          notes: notes || undefined,
        }),
      })
      onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    finally { setGen(false) }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Input label="Largura (mm)" value={dims.width_mm} onChange={v => setDims(d => ({ ...d, width_mm: v }))} />
        <Input label="Profund. (mm)" value={dims.depth_mm} onChange={v => setDims(d => ({ ...d, depth_mm: v }))} />
        <Input label="Altura (mm)" value={dims.height_mm} onChange={v => setDims(d => ({ ...d, height_mm: v }))} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Material" placeholder="PLA / PETG / ABS" value={material} onChange={setMaterial} />
        <Input label="Parede (mm)" value={wall} onChange={setWall} />
      </div>
      <Input label="Observações" value={notes} onChange={setNotes} />

      <button onClick={() => void generate()} disabled={gen}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold disabled:opacity-50"
        style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
        {gen ? <Loader2 size={13} className="animate-spin" /> : <Cpu size={13} />}
        {dev.briefing ? 'Regerar briefing técnico' : 'Gerar briefing técnico'}
      </button>

      {err && <div className="whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

      {dev.briefing_text && (
        <div className="rounded-lg p-3 text-xs" style={{ background: '#111114', border: '1px solid #27272a', color: '#d4d4d8', whiteSpace: 'pre-wrap' }}>
          {dev.briefing_text}
        </div>
      )}
    </div>
  )
}

function VersionsTab({ dev, onChanged }: { dev: DevDetail; onChanged: () => void }) {
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ changelog: '', file_url: '', material: '', weight_g: '', print_time_minutes: '', volume_cm3: '' })

  const add = async () => {
    setAdding(true); setErr('')
    try {
      await api(`/product-os/${dev.id}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          changelog: form.changelog || undefined,
          file_url: form.file_url || undefined,
          material: form.material || undefined,
          weight_g: form.weight_g ? Number(form.weight_g) : undefined,
          print_time_minutes: form.print_time_minutes ? Number(form.print_time_minutes) : undefined,
          volume_cm3: form.volume_cm3 ? Number(form.volume_cm3) : undefined,
        }),
      })
      setForm({ changelog: '', file_url: '', material: '', weight_g: '', print_time_minutes: '', volume_cm3: '' })
      onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    finally { setAdding(false) }
  }

  const setApproval = async (vid: string, approved: boolean) => {
    try { await api(`/product-os/versions/${vid}/approval`, { method: 'POST', body: JSON.stringify({ approved }) }); onChanged() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
  }

  return (
    <div className="space-y-3">
      {/* add form */}
      <div className="rounded-lg p-3 space-y-2" style={{ background: '#111114', border: '1px solid #27272a' }}>
        <p className="text-xs font-bold text-white">Nova versão</p>
        <Input label="Changelog" value={form.changelog} onChange={v => setForm(f => ({ ...f, changelog: v }))} />
        <Input label="URL do arquivo (STL/3MF)" value={form.file_url} onChange={v => setForm(f => ({ ...f, file_url: v }))} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Material" value={form.material} onChange={v => setForm(f => ({ ...f, material: v }))} />
          <Input label="Peso (g)" value={form.weight_g} onChange={v => setForm(f => ({ ...f, weight_g: v }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Tempo impressão (min)" value={form.print_time_minutes} onChange={v => setForm(f => ({ ...f, print_time_minutes: v }))} />
          <Input label="Volume (cm³)" value={form.volume_cm3} onChange={v => setForm(f => ({ ...f, volume_cm3: v }))} />
        </div>
        <button onClick={() => void add()} disabled={adding}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50"
          style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
          {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Adicionar versão
        </button>
      </div>

      {err && <div className="whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

      {/* list */}
      {dev.versions.map(v => (
        <div key={v.id} className="rounded-lg p-3" style={{ background: '#111114', border: `1px solid ${v.approved ? 'rgba(74,222,128,0.35)' : '#27272a'}` }}>
          <div className="flex items-center gap-2">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#1a1a1f', color: '#a5f3fc' }}>v{v.version_number}</span>
            <span className="text-xs font-semibold text-white">{v.changelog ?? 'sem changelog'}</span>
            <span className="ml-auto text-[10px]" style={{ color: '#71717a' }}>{v.status}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]" style={{ color: '#a1a1aa' }}>
            {v.material && <span>{v.material}</span>}
            {v.weight_g != null && <span>{v.weight_g} g</span>}
            {v.print_time_minutes != null && <span>{v.print_time_minutes} min</span>}
            {v.volume_cm3 != null && <span>{v.volume_cm3} cm³</span>}
            {v.file_url && <a href={v.file_url} target="_blank" rel="noreferrer" className="text-cyan-400 underline">arquivo</a>}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => void setApproval(v.id, true)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold"
              style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
              <Check size={10} /> Aprovar
            </button>
            <button onClick={() => void setApproval(v.id, false)} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold"
              style={{ background: '#0a0a0e', color: '#71717a', border: '1px solid #27272a' }}>
              <Ban size={10} /> Reprovar
            </button>
          </div>
        </div>
      ))}
      {dev.versions.length === 0 && <p className="text-xs" style={{ color: '#52525b' }}>Nenhuma versão ainda.</p>}
    </div>
  )
}

function CostTab({ dev, onChanged }: { dev: DevDetail; onChanged: () => void }) {
  const [res, setRes] = useState<CostResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [margin, setMargin] = useState('30')

  const compute = async () => {
    setBusy(true); setErr('')
    try {
      const r = await api<CostResult>(`/product-os/${dev.id}/cost`, { method: 'POST', body: JSON.stringify({ target_margin_pct: Number(margin) || 30 }) })
      setRes(r); onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: '#a1a1aa' }}>
        Usa o peso/tempo/material da versão aprovada (ou a última) + as constantes de fabricação da sua org.
      </p>
      <div className="flex items-end gap-2">
        <Input label="Margem-alvo (%)" value={margin} onChange={setMargin} />
        <button onClick={() => void compute()} disabled={busy}
          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50"
          style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF', height: 34 }}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />} Calcular
        </button>
      </div>

      {err && <div className="whitespace-pre-line rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}

      {res && (
        <>
          <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
            <p className="mb-2 text-xs font-bold text-white">Custo de fabricação</p>
            {([['Filamento', res.cost.filament], ['Energia', res.cost.energy], ['Mão de obra', res.cost.labor], ['Embalagem', res.cost.packaging], ['Perda técnica', res.cost.waste]] as const).map(([l, v]) => (
              <div key={l} className="flex justify-between py-0.5 text-xs" style={{ color: '#a1a1aa' }}><span>{l}</span><span>R$ {v.toFixed(2)}</span></div>
            ))}
            <div className="mt-1 flex justify-between border-t pt-1.5 text-xs font-bold text-white" style={{ borderColor: '#27272a' }}>
              <span>Total</span><span className="text-cyan-400">R$ {res.cost.total.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-[10px]" style={{ color: '#52525b' }}>{res.inputs.weight_g} g · {res.inputs.print_time_minutes} min · {res.inputs.material} (R$ {res.inputs.cost_per_kg}/kg)</p>
          </div>

          <div className="rounded-lg p-3" style={{ background: '#111114', border: '1px solid #27272a' }}>
            <p className="mb-2 text-xs font-bold text-white">Preço sugerido por canal (margem {res.target_margin_pct}%)</p>
            {res.suggested_prices.map(s => (
              <div key={s.channel} className="flex items-center justify-between py-1 text-xs">
                <span style={{ color: '#a1a1aa' }}>{CHANNEL_LABEL[s.channel] ?? s.channel} <span style={{ color: '#52525b' }}>· taxa {s.fee_pct}%</span></span>
                <span className="font-bold text-white">{s.price > 0 ? `R$ ${s.price.toFixed(2)}` : '—'}</span>
              </div>
            ))}
            <p className="mt-1 text-[10px]" style={{ color: '#52525b' }}>Taxas all-in estimadas (auditoria de faturas). Ajuste fino vem do módulo financeiro.</p>
          </div>
        </>
      )}
    </div>
  )
}

// ── modais ──────────────────────────────────────────────────────────
function NewProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', category: '', description: '', inspiration_url: '', reference_url: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const create = async () => {
    if (!form.name.trim()) { setErr('Nome é obrigatório'); return }
    setBusy(true); setErr('')
    try {
      await api('/product-os', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, category: form.category || undefined, description: form.description || undefined,
          inspiration_url: form.inspiration_url || undefined,
          reference_images: form.reference_url ? [{ url: form.reference_url }] : undefined,
        }),
      })
      onCreated()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    finally { setBusy(false) }
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
      <div className="mt-4 flex justify-end">
        <button onClick={() => void create()} disabled={busy}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
          style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Criar
        </button>
      </div>
    </Modal>
  )
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pla, setPla] = useState(''); const [petg, setPetg] = useState(''); const [abs, setAbs] = useState('')
  const [energy, setEnergy] = useState(''); const [labor, setLabor] = useState(''); const [pkg, setPkg] = useState(''); const [waste, setWaste] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const r = await api<Settings>('/product-os/settings')
        setS(r)
        setPla(String(r.filament_cost_per_kg?.PLA ?? '')); setPetg(String(r.filament_cost_per_kg?.PETG ?? '')); setAbs(String(r.filament_cost_per_kg?.ABS ?? ''))
        setEnergy(String(r.energy_cost_per_hour ?? '')); setLabor(String(r.labor_cost_per_hour ?? '')); setPkg(String(r.packaging_cost ?? '')); setWaste(String(r.default_waste_pct ?? ''))
      } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    })()
  }, [])

  const save = async () => {
    setBusy(true); setErr('')
    try {
      await api('/product-os/settings', {
        method: 'PUT',
        body: JSON.stringify({
          filament_cost_per_kg: { PLA: Number(pla) || 0, PETG: Number(petg) || 0, ABS: Number(abs) || 0 },
          energy_cost_per_hour: Number(energy) || 0,
          labor_cost_per_hour: Number(labor) || 0,
          packaging_cost: Number(pkg) || 0,
          default_waste_pct: Number(waste) || 0,
        }),
      })
      onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro') }
    finally { setBusy(false) }
  }

  return (
    <Modal title="Constantes de fabricação" onClose={onClose}>
      {!s ? <div className="flex items-center gap-2 text-sm" style={{ color: '#71717a' }}><Loader2 size={14} className="animate-spin" /> Carregando…</div> : (
        <>
          {err && <div className="mb-3 rounded-lg p-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>{err}</div>}
          <p className="mb-3 text-xs" style={{ color: '#a1a1aa' }}>Valores da sua operação — usados pra calcular o custo de fabricação.</p>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: '#71717a' }}>Filamento (R$/kg)</p>
          <div className="grid grid-cols-3 gap-2">
            <Input label="PLA" value={pla} onChange={setPla} />
            <Input label="PETG" value={petg} onChange={setPetg} />
            <Input label="ABS" value={abs} onChange={setAbs} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Input label="Energia (R$/h)" value={energy} onChange={setEnergy} />
            <Input label="Mão de obra (R$/h)" value={labor} onChange={setLabor} />
            <Input label="Embalagem (R$/un)" value={pkg} onChange={setPkg} />
            <Input label="Perda técnica (%)" value={waste} onChange={setWaste} />
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={() => void save()} disabled={busy}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
              style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.35)', color: '#00E5FF' }}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Salvar
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

// ── primitivos ──────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} className="ml-auto" style={{ color: '#71717a' }}><X size={16} /></button>
        </div>
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
      <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-cyan-500" style={style} />
    </label>
  )
}
