'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Plus, X, AlertTriangle, Calendar, DollarSign, User, Building2,
  GripVertical, Pencil, Trash2, TrendingUp, Target, Trophy, XCircle,
} from 'lucide-react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDroppable, useDraggable, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useConfirm } from '@/components/ui/dialog-provider'

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost'

interface Deal {
  id: string
  organization_id: string
  title: string
  contact_name: string | null
  company: string | null
  value: number
  stage: Stage
  probability: number
  expected_close: string | null
  notes: string | null
  created_at: string
}

// ── Stage config ──────────────────────────────────────────────────────────────

const STAGES: { id: Stage; label: string; color: string; prob: number; icon: React.ReactNode }[] = [
  { id: 'prospecting',   label: 'Prospecção',   color: '#71717a', prob: 25,  icon: <Target size={13} /> },
  { id: 'qualification', label: 'Qualificação', color: '#3b82f6', prob: 40,  icon: <TrendingUp size={13} /> },
  { id: 'proposal',      label: 'Proposta',     color: '#a78bfa', prob: 60,  icon: <DollarSign size={13} /> },
  { id: 'negotiation',   label: 'Negociação',   color: '#f59e0b', prob: 80,  icon: <Building2 size={13} /> },
  { id: 'won',           label: 'Ganho',        color: '#22c55e', prob: 100, icon: <Trophy size={13} /> },
  { id: 'lost',          label: 'Perdido',      color: '#f87171', prob: 0,   icon: <XCircle size={13} /> },
]

const KANBAN_STAGES = STAGES.filter(s => s.id !== 'won' && s.id !== 'lost')

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const CREATE_SQL = `-- Execute no Supabase SQL Editor
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  contact_name TEXT,
  company TEXT,
  value NUMERIC DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'prospecting',
  probability INTEGER DEFAULT 25,
  expected_close DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_deals" ON deals FOR ALL TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));`

// ── Auth/org ──────────────────────────────────────────────────────────────────

async function getOrgId(): Promise<string | null> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle()
  return data?.organization_id ?? null
}

// ── Deal Card ─────────────────────────────────────────────────────────────────

function DealCard({ deal, onEdit, onDelete, overlay = false }: {
  deal: Deal; onEdit: (d: Deal) => void; onDelete: (id: string) => void; overlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })
  const stageCfg = STAGES.find(s => s.id === deal.stage)!
  const isOverdue = deal.expected_close && deal.stage !== 'won' && deal.stage !== 'lost' &&
    new Date(deal.expected_close + 'T23:59:59') < new Date()

  const cardStyle = overlay
    ? { background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 240, opacity: 1 }
    : { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1, background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 12 }

  return (
    <div ref={setNodeRef} style={cardStyle} className="group space-y-2.5 cursor-default select-none">
      {/* Header */}
      <div className="flex items-start gap-2">
        <button {...(overlay ? {} : { ...listeners, ...attributes })}
          className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 transition-colors">
          <GripVertical size={13} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-200 leading-snug truncate">{deal.title}</p>
          {deal.company && <p className="text-[10px] text-zinc-500 truncate mt-0.5">{deal.company}</p>}
        </div>
        {!overlay && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => onEdit(deal)} className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors"><Pencil size={11} /></button>
            <button onClick={() => onDelete(deal.id)} className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
          </div>
        )}
      </div>

      {/* Value + probability */}
      <div className="flex items-center justify-between ml-5">
        <span className="text-sm font-black" style={{ color: stageCfg.color }}>{brl(deal.value)}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: `${stageCfg.color}18`, color: stageCfg.color }}>
          {deal.probability}%
        </span>
      </div>

      {/* Footer */}
      {(deal.contact_name || deal.expected_close) && (
        <div className="flex items-center gap-3 ml-5">
          {deal.contact_name && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-600 truncate">
              <User size={9} />{deal.contact_name}
            </span>
          )}
          {deal.expected_close && (
            <span className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: isOverdue ? '#f87171' : '#71717a' }}>
              <Calendar size={9} />
              {new Date(deal.expected_close + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
        </div>
      )}

      {/* Probability bar */}
      <div className="ml-5 h-1 rounded-full overflow-hidden" style={{ background: '#27272a' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${deal.probability}%`, background: stageCfg.color }} />
      </div>
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function PipelineColumn({ stage, deals, onAdd, onEdit, onDelete }: {
  stage: typeof STAGES[0]; deals: Deal[]
  onAdd: (s: Stage) => void; onEdit: (d: Deal) => void; onDelete: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const total = deals.reduce((s, d) => s + d.value, 0)
  const weighted = deals.reduce((s, d) => s + d.value * (d.probability / 100), 0)

  return (
    <div className="flex flex-col min-w-[240px] max-w-[280px] flex-1">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span style={{ color: stage.color }}>{stage.icon}</span>
          <span className="text-xs font-semibold text-zinc-300">{stage.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a' }}>{deals.length}</span>
        </div>
        <button onClick={() => onAdd(stage.id)} className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all">
          <Plus size={12} />
        </button>
      </div>

      {/* Value strip */}
      {deals.length > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-[10px] text-zinc-600">{brl(total)}</span>
          <span className="text-[10px] text-zinc-700">·</span>
          <span className="text-[10px]" style={{ color: stage.color }}>{brl(weighted)} pond.</span>
        </div>
      )}

      <div ref={setNodeRef} className="flex-1 rounded-2xl p-2 space-y-2 transition-colors"
        style={{ background: isOver ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isOver ? stage.color + '40' : '#1e1e24'}`, minHeight: 100 }}>
        {deals.map(d => <DealCard key={d.id} deal={d} onEdit={onEdit} onDelete={onDelete} />)}
        {deals.length === 0 && (
          <div className="flex items-center justify-center h-16">
            <p className="text-[11px] text-zinc-700">Sem negócios</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Deal Modal ────────────────────────────────────────────────────────────────

type DealForm = { title: string; contact_name: string; company: string; value: string; stage: Stage; probability: string; expected_close: string; notes: string }

function DealModal({ initial, defaultStage, onSave, onClose }: {
  initial?: Deal; defaultStage: Stage; onSave: (f: DealForm) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState<DealForm>({
    title:          initial?.title          ?? '',
    contact_name:   initial?.contact_name   ?? '',
    company:        initial?.company        ?? '',
    value:          String(initial?.value   ?? ''),
    stage:          initial?.stage          ?? defaultStage,
    probability:    String(initial?.probability ?? STAGES.find(s => s.id === defaultStage)?.prob ?? 25),
    expected_close: initial?.expected_close ?? '',
    notes:          initial?.notes          ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  function set<K extends keyof DealForm>(k: K, v: DealForm[K]) {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'stage') next.probability = String(STAGES.find(s => s.id === v)?.prob ?? f.probability)
      return next
    })
  }

  async function submit() {
    if (!form.title.trim()) { setErr('Título é obrigatório'); return }
    setSaving(true); setErr(null)
    try { await onSave(form) }
    catch (e: any) { setErr(e.message); setSaving(false) }
  }

  const inp = 'w-full rounded-lg px-3 py-2 text-xs text-white outline-none transition-all'
  const is  = { background: '#1c1c1f', border: '1px solid #3f3f46' }
  const lbl = 'block text-[10px] font-medium text-zinc-500 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh]" style={{ background: '#111114', border: '1px solid #2e2e33' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">{initial ? 'Editar Negócio' : 'Novo Negócio'}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div>
          <label className={lbl}>Título *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} className={inp} style={is} placeholder="Nome do negócio ou oportunidade"
            onFocus={e => (e.target.style.borderColor = '#00E5FF')} onBlur={e => (e.target.style.borderColor = '#3f3f46')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Contato</label>
            <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className={inp} style={is} placeholder="Nome do contato"
              onFocus={e => (e.target.style.borderColor = '#00E5FF')} onBlur={e => (e.target.style.borderColor = '#3f3f46')} />
          </div>
          <div>
            <label className={lbl}>Empresa</label>
            <input value={form.company} onChange={e => set('company', e.target.value)} className={inp} style={is} placeholder="Empresa"
              onFocus={e => (e.target.style.borderColor = '#00E5FF')} onBlur={e => (e.target.style.borderColor = '#3f3f46')} />
          </div>
          <div>
            <label className={lbl}>Valor (R$)</label>
            <input type="number" min={0} value={form.value} onChange={e => set('value', e.target.value)} className={inp} style={is} placeholder="0"
              onFocus={e => (e.target.style.borderColor = '#00E5FF')} onBlur={e => (e.target.style.borderColor = '#3f3f46')} />
          </div>
          <div>
            <label className={lbl}>Previsão de fechamento</label>
            <input type="date" value={form.expected_close} onChange={e => set('expected_close', e.target.value)} className={inp} style={is}
              onFocus={e => (e.target.style.borderColor = '#00E5FF')} onBlur={e => (e.target.style.borderColor = '#3f3f46')} />
          </div>
          <div>
            <label className={lbl}>Estágio</label>
            <select value={form.stage} onChange={e => set('stage', e.target.value as Stage)} className={inp + ' cursor-pointer'} style={is}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Probabilidade (%)</label>
            <input type="number" min={0} max={100} value={form.probability} onChange={e => set('probability', e.target.value)} className={inp} style={is}
              onFocus={e => (e.target.style.borderColor = '#00E5FF')} onBlur={e => (e.target.style.borderColor = '#3f3f46')} />
          </div>
        </div>

        <div>
          <label className={lbl}>Notas</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className={inp} style={{ ...is, resize: 'none' }} rows={2} placeholder="Observações…"
            onFocus={e => (e.target.style.borderColor = '#00E5FF')} onBlur={e => (e.target.style.borderColor = '#3f3f46')} />
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-semibold text-zinc-400 border border-zinc-800">Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving ? 'Salvando…' : (initial ? 'Salvar' : 'Criar negócio')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [deals, setDeals]       = useState<Deal[]>([])
  const [loading, setLoading]   = useState(true)
  const [noTable, setNoTable]   = useState(false)
  const [orgId, setOrgId]       = useState<string | null>(null)
  const [modal, setModal]       = useState<{ open: boolean; deal?: Deal; defaultStage: Stage }>({ open: false, defaultStage: 'prospecting' })
  const [dragging, setDragging] = useState<Deal | null>(null)
  const [copied, setCopied]     = useState(false)
  const [view, setView]         = useState<'kanban' | 'list'>('kanban')
  const confirm = useConfirm()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(async () => {
    setLoading(true)
    const sb  = createClient()
    const oid = await getOrgId()
    setOrgId(oid)
    if (!oid) { setLoading(false); return }
    const { data, error } = await sb.from('deals').select('*').eq('organization_id', oid).order('created_at', { ascending: false })
    if (error) {
      if (error.code === '42P01') setNoTable(true)
      setLoading(false); return
    }
    setDeals((data ?? []) as Deal[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── KPIs ─────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const active   = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost')
    const won      = deals.filter(d => d.stage === 'won')
    const pipeline = active.reduce((s, d) => s + d.value, 0)
    const weighted = active.reduce((s, d) => s + d.value * (d.probability / 100), 0)
    const total    = deals.filter(d => d.stage === 'won' || d.stage === 'lost').length
    const winRate  = total > 0 ? Math.round((won.length / total) * 100) : 0
    const wonTotal = won.reduce((s, d) => s + d.value, 0)
    return { pipeline, weighted, active: active.length, wonTotal, winRate }
  }, [deals])

  // ── By stage ─────────────────────────────────────────────────────────────────

  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGES.map(s => [s.id, [] as Deal[]])) as Record<Stage, Deal[]>
    for (const d of deals) map[d.stage]?.push(d)
    return map
  }, [deals])

  // ── DnD ──────────────────────────────────────────────────────────────────────

  function onDragStart(e: DragStartEvent) { setDragging(deals.find(d => d.id === e.active.id) ?? null) }

  async function onDragEnd(e: DragEndEvent) {
    setDragging(null)
    const { active, over } = e
    if (!over) return
    const deal    = deals.find(d => d.id === active.id)
    const newStage = over.id as Stage
    if (!deal || deal.stage === newStage) return
    const prob = STAGES.find(s => s.id === newStage)?.prob ?? deal.probability
    setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, stage: newStage, probability: prob } : d))
    const sb = createClient()
    await sb.from('deals').update({ stage: newStage, probability: prob, updated_at: new Date().toISOString() }).eq('id', deal.id)
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async function saveDeal(form: DealForm) {
    const sb = createClient()
    const payload = {
      title:          form.title,
      contact_name:   form.contact_name   || null,
      company:        form.company        || null,
      value:          parseFloat(form.value)    || 0,
      stage:          form.stage,
      probability:    parseInt(form.probability) || 0,
      expected_close: form.expected_close || null,
      notes:          form.notes          || null,
      updated_at:     new Date().toISOString(),
    }
    if (modal.deal) {
      const { error } = await sb.from('deals').update(payload).eq('id', modal.deal.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await sb.from('deals').insert({ ...payload, organization_id: orgId })
      if (error) throw new Error(error.message)
    }
    setModal({ open: false, defaultStage: 'prospecting' })
    load()
  }

  async function deleteDeal(id: string) {
    const ok = await confirm({
      title:        'Excluir negócio',
      message:      'Excluir este negócio?',
      confirmLabel: 'Excluir',
      variant:      'danger',
    })
    if (!ok) return
    const sb = createClient()
    await sb.from('deals').delete().eq('id', id)
    setDeals(ds => ds.filter(d => d.id !== id))
  }

  // ── No table ──────────────────────────────────────────────────────────────────

  if (noTable) return (
    <div className="p-6 space-y-4 min-h-full" style={{ background: '#09090b' }}>
      <div><p className="text-zinc-500 text-xs">CRM</p><h2 className="text-white text-lg font-semibold mt-0.5">Pipeline</h2></div>
      <div className="rounded-2xl p-5 space-y-4 max-w-2xl" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle size={16} /><p className="text-sm font-semibold">Tabela <code className="font-mono">deals</code> não encontrada</p>
        </div>
        <p className="text-xs text-zinc-400">Execute o SQL abaixo no Supabase SQL Editor:</p>
        <pre className="text-[10px] font-mono p-4 rounded-xl overflow-x-auto leading-relaxed"
          style={{ background: '#0a0a0d', border: '1px solid #1e1e24', color: '#a1a1aa' }}>{CREATE_SQL}</pre>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(CREATE_SQL); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(0,229,255,0.1)', color: copied ? '#22c55e' : '#00E5FF', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(0,229,255,0.2)'}` }}>
            {copied ? 'Copiado!' : 'Copiar SQL'}
          </button>
          <button onClick={load} className="px-4 py-2 rounded-lg text-xs font-semibold border border-zinc-800 text-zinc-400">Verificar novamente</button>
        </div>
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><p className="text-zinc-500 text-xs">CRM</p><h2 className="text-white text-lg font-semibold mt-0.5">Pipeline de Vendas</h2></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #2e2e33' }}>
            {(['kanban', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 text-xs font-semibold transition-all"
                style={{ background: view === v ? 'rgba(0,229,255,0.12)' : 'transparent', color: view === v ? '#00E5FF' : '#71717a' }}>
                {v === 'kanban' ? 'Kanban' : 'Lista'}
              </button>
            ))}
          </div>
          <button onClick={() => setModal({ open: true, defaultStage: 'prospecting' })}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: '#00E5FF', color: '#000' }}>
            <Plus size={14} /> Novo Negócio
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pipeline total',    value: brl(kpis.pipeline), color: '#00E5FF' },
            { label: 'Receita ponderada', value: brl(kpis.weighted), color: '#a78bfa' },
            { label: 'Negócios ativos',   value: kpis.active,        color: '#f59e0b' },
            { label: 'Taxa de conversão', value: `${kpis.winRate}%`, color: '#22c55e' },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <p className="text-zinc-500 text-[11px] font-medium">{k.label}</p>
              <p className="text-xl font-black mt-1" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stage funnel bar */}
      {!loading && deals.length > 0 && (
        <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
          {KANBAN_STAGES.map(s => byStage[s.id].length > 0 && (
            <div key={s.id} title={`${s.label}: ${byStage[s.id].length}`}
              className="rounded-sm transition-all"
              style={{ background: s.color, flex: byStage[s.id].length }} />
          ))}
        </div>
      )}

      {/* Kanban / List */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_STAGES.map(s => (
            <div key={s.id} className="min-w-[240px] space-y-3">
              <div className="h-5 w-28 rounded animate-pulse" style={{ background: '#1e1e24' }} />
              {[1, 2].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: '#111114' }} />)}
            </div>
          ))}
        </div>
      ) : view === 'kanban' ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-6">
            {KANBAN_STAGES.map(s => (
              <PipelineColumn key={s.id} stage={s} deals={byStage[s.id]}
                onAdd={stage => setModal({ open: true, defaultStage: stage })}
                onEdit={d => setModal({ open: true, deal: d, defaultStage: d.stage })}
                onDelete={deleteDeal} />
            ))}
          </div>
          <DragOverlay>
            {dragging && <DealCard deal={dragging} onEdit={() => {}} onDelete={() => {}} overlay />}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List view */
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <table className="w-full" style={{ minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#0a0a0d', borderBottom: '1px solid #1e1e24' }}>
                {['Negócio', 'Contato', 'Estágio', 'Valor', 'Prob.', 'Fechamento', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-600 text-sm">Nenhum negócio cadastrado.</td></tr>
              ) : deals.map(d => {
                const s = STAGES.find(st => st.id === d.stage)!
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #1a1a1f' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-semibold text-zinc-200">{d.title}</p>
                      {d.company && <p className="text-[10px] text-zinc-600">{d.company}</p>}
                    </td>
                    <td className="px-3 py-2.5"><span className="text-[11px] text-zinc-400">{d.contact_name ?? '—'}</span></td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit"
                        style={{ background: `${s.color}18`, color: s.color }}>
                        {s.icon} {s.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-xs font-bold" style={{ color: s.color }}>{brl(d.value)}</span></td>
                    <td className="px-3 py-2.5"><span className="text-[11px] text-zinc-400">{d.probability}%</span></td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] text-zinc-400">
                        {d.expected_close ? new Date(d.expected_close + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setModal({ open: true, deal: d, defaultStage: d.stage })} className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors"><Pencil size={12} /></button>
                        <button onClick={() => deleteDeal(d.id)} className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Won / Lost summary */}
      {!loading && (byStage.won.length > 0 || byStage.lost.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {[STAGES.find(s => s.id === 'won')!, STAGES.find(s => s.id === 'lost')!].map(s => (
            <div key={s.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#111114', border: `1px solid ${s.color}20` }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <div>
                <p className="text-[11px] font-semibold" style={{ color: s.color }}>{s.label}</p>
                <p className="text-xs font-black" style={{ color: s.color }}>
                  {byStage[s.id].length} negócio{byStage[s.id].length !== 1 ? 's' : ''} · {brl(byStage[s.id].reduce((sum, d) => sum + d.value, 0))}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <DealModal initial={modal.deal} defaultStage={modal.defaultStage} onSave={saveDeal}
          onClose={() => setModal({ open: false, defaultStage: 'prospecting' })} />
      )}
    </div>
  )
}
