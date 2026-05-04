'use client'

import {
  useCallback, useEffect, useMemo, useState,
  type CSSProperties,
} from 'react'
import { createClient } from '@/lib/supabase'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter,
  useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Save, Trash2, GripVertical, ChevronDown, ChevronUp,
  ArrowUp, ArrowDown, Loader2, CheckCircle2, XCircle,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── types ─────────────────────────────────────────────────────────────────────

type TriggerEvent =
  | 'order_paid' | 'order_shipped' | 'order_delivered' | 'order_cancelled'
  | 'post_sale_7d' | 'post_sale_30d' | 'manual' | 'lead_bridge_capture'
  | 'order_created'

type StepTrigger      = 'immediate' | 'status_change_ml' | 'time_offset'
type DelayUnit        = 'minutes' | 'hours' | 'days'
type ChannelPriority  = 'whatsapp_then_email' | 'email_then_whatsapp' | 'whatsapp' | 'email'
type TemplateKind     = 'transactional' | 'marketing' | 'sac' | 'custom'

interface JourneyTemplate {
  id:              string
  organization_id: string
  name:            string
  description:     string | null
  trigger_event:   TriggerEvent
  trigger_channel: string
  is_active:       boolean
  mode:            string
  steps:           PersistedStep[]
  created_at:      string
  updated_at:      string
}

interface PersistedStep {
  step:             number
  trigger:          StepTrigger
  delay_minutes:    number
  template_kind:    TemplateKind | string
  template_name:    string
  channel_priority: ChannelPriority | string
  condition?:       Record<string, unknown>
  offset_from?:     string
}

/** Estado em memória de um step durante edição. _id é estável pra dnd-kit
 * (UUID gerado no client, não persiste). _unit guarda a unidade de display
 * do delay (minutes/hours/days) — convertida de delay_minutes ao carregar.
 * _conditionStr é o JSON em string puro pra editor poder ter estado
 * intermediário inválido enquanto digita. */
interface StepFormState {
  _id:             string
  _unit:           DelayUnit
  _conditionStr:   string
  step:            number
  trigger:         StepTrigger
  delay_minutes:   number
  template_kind:   string
  template_name:   string
  channel_priority: string
  offset_from?:    string
}

interface JourneyFormState {
  id?:             string
  name:            string
  description:     string
  trigger_event:   TriggerEvent
  trigger_channel: string
  is_active:       boolean
  mode:            string
  steps:           StepFormState[]
}

interface TemplateRef { id: string; name: string; channel: string; template_kind: string }

const TRIGGER_EVENTS: TriggerEvent[] = [
  'order_paid', 'order_created', 'order_shipped', 'order_delivered', 'order_cancelled',
  'post_sale_7d', 'post_sale_30d', 'manual', 'lead_bridge_capture',
]

const STEP_TRIGGERS: { value: StepTrigger; label: string; hint: string }[] = [
  { value: 'immediate',        label: 'Imediato',                hint: 'Dispara assim que a jornada começa.' },
  { value: 'status_change_ml', label: 'Mudança de status (ML)',  hint: 'Espera o pedido mudar de status. Use condition pra filtrar (ex: shipping_status=shipped).' },
  { value: 'time_offset',      label: 'Após delay/tempo',         hint: 'Espera N tempo após algo (offset_from). Use delay + offset_from.' },
]

const DELAY_UNITS: { value: DelayUnit; label: string }[] = [
  { value: 'minutes', label: 'minutos' },
  { value: 'hours',   label: 'horas' },
  { value: 'days',    label: 'dias' },
]

const CHANNEL_PRIORITIES: { value: ChannelPriority; label: string }[] = [
  { value: 'whatsapp_then_email', label: 'WhatsApp, depois Email' },
  { value: 'email_then_whatsapp', label: 'Email, depois WhatsApp' },
  { value: 'whatsapp',            label: 'Só WhatsApp' },
  { value: 'email',               label: 'Só Email' },
]

const KIND_OPTIONS: TemplateKind[] = ['transactional', 'marketing', 'sac', 'custom']

const EMPTY_FORM: JourneyFormState = {
  name:            '',
  description:     '',
  trigger_event:   'order_paid',
  trigger_channel: 'whatsapp',
  is_active:       true,
  mode:            'automatic',
  steps:           [],
}

interface Props {
  onToast?: (msg: string, type?: 'success' | 'error') => void
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** UUID com fallback pra Safari < 15.4 e Edge legacy. */
const stepId = (): string =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `step_${Date.now()}_${Math.random().toString(36).slice(2)}`

function minutesToUnit(min: number): { value: number; unit: DelayUnit } {
  if (!min || min <= 0)   return { value: 0,             unit: 'minutes' }
  if (min % 1440 === 0)   return { value: min / 1440,    unit: 'days' }
  if (min % 60 === 0)     return { value: min / 60,      unit: 'hours' }
  return { value: min, unit: 'minutes' }
}

function unitToMinutes(value: number, unit: DelayUnit): number {
  if (unit === 'days')  return Math.floor(value) * 1440
  if (unit === 'hours') return Math.floor(value) * 60
  return Math.floor(value)
}

/** JSON.parse com mensagem amigável. {} se string vazia. */
function tryParseJSON(s: string): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  const t = s.trim()
  if (!t) return { ok: true, value: null }
  try {
    const v = JSON.parse(t) as unknown
    if (typeof v !== 'object' || Array.isArray(v) || v === null) {
      return { ok: false, error: 'Use um objeto JSON, ex: {"shipping_status":"shipped"}' }
    }
    return { ok: true, value: v as Record<string, unknown> }
  } catch (e) {
    return { ok: false, error: (e as Error).message.replace(/^.*JSON.parse:?\s*/, '') }
  }
}

function persistedToFormSteps(steps: PersistedStep[]): StepFormState[] {
  return steps.map(s => {
    const { value: dValue, unit } = minutesToUnit(s.delay_minutes)
    const condStr = s.condition ? JSON.stringify(s.condition, null, 2) : ''
    return {
      _id:             stepId(),
      _unit:           unit,
      _conditionStr:   condStr,
      step:            s.step,
      trigger:         s.trigger,
      delay_minutes:   unitToMinutes(dValue, unit),
      template_kind:   s.template_kind,
      template_name:   s.template_name,
      channel_priority: s.channel_priority,
      offset_from:     s.offset_from,
    }
  })
}

function formToPersistedSteps(steps: StepFormState[]): PersistedStep[] {
  return steps.map((s, i) => {
    const cond = tryParseJSON(s._conditionStr)
    const out: PersistedStep = {
      step:            i + 1,
      trigger:         s.trigger,
      delay_minutes:   s.delay_minutes,
      template_kind:   s.template_kind,
      template_name:   s.template_name,
      channel_priority: s.channel_priority,
    }
    if (cond.ok && cond.value)        out.condition  = cond.value
    if (s.offset_from?.trim())        out.offset_from = s.offset_from.trim()
    return out
  })
}

// ── SortableStepCard ──────────────────────────────────────────────────────────

interface StepCardProps {
  step:        StepFormState
  index:       number
  isFirst:     boolean
  isLast:      boolean
  expanded:    boolean
  templates:   TemplateRef[]
  onToggle:    () => void
  onChange:    (patch: Partial<StepFormState>) => void
  onRemove:    () => void
  onMoveUp:    () => void
  onMoveDown:  () => void
}

function SortableStepCard(p: StepCardProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: p.step._id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: '#0c0c10',
    border: `1px solid ${isDragging ? 'rgba(0,229,255,0.60)' : '#1a1a1f'}`,
    borderStyle: isDragging ? 'dashed' : 'solid',
    boxShadow: isDragging ? '0 8px 24px rgba(0,229,255,0.15)' : undefined,
    transformOrigin: '0 0',
  }

  const condErr = useMemo(() => {
    const r = tryParseJSON(p.step._conditionStr)
    return r.ok ? null : r.error
  }, [p.step._conditionStr])

  const dValue = useMemo(() => {
    const { value } = minutesToUnit(p.step.delay_minutes)
    return value
  }, [p.step.delay_minutes])

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl">
      {/* Header (sempre visível) */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 shrink-0"
          aria-label={`Arrastar step ${p.index + 1}`}
          type="button">
          <GripVertical size={14} />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-zinc-200 font-medium truncate">
            <span className="text-zinc-600 mr-1.5">Step {p.index + 1}</span>
            {p.step.template_name || <span className="italic text-zinc-600">(sem template)</span>}
          </p>
          <p className="text-[10px] text-zinc-500 truncate">
            {STEP_TRIGGERS.find(t => t.value === p.step.trigger)?.label ?? p.step.trigger}
            {p.step.delay_minutes > 0 && ` · ${dValue} ${minutesToUnit(p.step.delay_minutes).unit}`}
            {p.step.channel_priority && ` · ${p.step.channel_priority}`}
          </p>
        </div>

        <button onClick={p.onMoveUp} disabled={p.isFirst} type="button"
          className="p-1 text-zinc-600 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Mover pra cima"><ArrowUp size={12} /></button>
        <button onClick={p.onMoveDown} disabled={p.isLast} type="button"
          className="p-1 text-zinc-600 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Mover pra baixo"><ArrowDown size={12} /></button>
        <button onClick={p.onRemove} type="button"
          className="p-1 text-zinc-600 hover:text-red-400" title="Remover step">
          <Trash2 size={12} />
        </button>
        <button onClick={p.onToggle} type="button" className="p-1 text-zinc-600 hover:text-zinc-200">
          {p.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Body (expandido) */}
      {p.expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3" style={{ borderTop: '1px solid #1a1a1f' }}>
          {/* Template */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500">Template</label>
            <select value={p.step.template_name}
              onChange={e => p.onChange({ template_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none">
              <option value="">(selecione)</option>
              {p.templates.map(t => (
                <option key={t.id} value={t.name}>{t.name} ({t.template_kind} · {t.channel})</option>
              ))}
            </select>
          </div>

          {/* Trigger + template_kind */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zinc-500">Trigger do step</label>
              <select value={p.step.trigger}
                onChange={e => p.onChange({ trigger: e.target.value as StepTrigger })}
                className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none">
                {STEP_TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="text-[10px] text-zinc-600 mt-1">
                {STEP_TRIGGERS.find(t => t.value === p.step.trigger)?.hint}
              </p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zinc-500">Tipo</label>
              <select value={p.step.template_kind}
                onChange={e => p.onChange({ template_kind: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none">
                {KIND_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          {/* Delay + unit */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500">Delay após trigger</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" min={0}
                value={dValue}
                onChange={e => p.onChange({ delay_minutes: unitToMinutes(Number(e.target.value), p.step._unit) })}
                className="w-24 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none" />
              <select value={p.step._unit}
                onChange={e => {
                  const newUnit = e.target.value as DelayUnit
                  // Mantém o "valor visível", recalcula minutes
                  p.onChange({
                    _unit: newUnit,
                    delay_minutes: unitToMinutes(dValue, newUnit),
                  })
                }}
                className="px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none">
                {DELAY_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>

          {/* Channel priority */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500">Canal preferencial</label>
            <select value={p.step.channel_priority}
              onChange={e => p.onChange({ channel_priority: e.target.value })}
              className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none">
              {CHANNEL_PRIORITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* offset_from — só pra time_offset */}
          {p.step.trigger === 'time_offset' && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zinc-500">A partir de (offset_from)</label>
              <input value={p.step.offset_from ?? ''}
                onChange={e => p.onChange({ offset_from: e.target.value })}
                placeholder="ex: delivered, paid"
                className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none" />
              <p className="text-[10px] text-zinc-600 mt-1">
                Evento âncora pra calcular o delay (delivered = N tempo após entrega).
              </p>
            </div>
          )}

          {/* Condition (JSON) */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500">Condition (JSON, opcional)</label>
            <textarea value={p.step._conditionStr}
              onChange={e => p.onChange({ _conditionStr: e.target.value })}
              rows={3}
              placeholder='ex: {"shipping_status":"shipped"}'
              className="w-full mt-1 px-3 py-2 text-[11px] font-mono rounded-lg bg-[#070709] text-zinc-200 outline-none resize-y"
              style={{ border: `1px solid ${condErr ? '#dc2626' : '#27272a'}` }} />
            {condErr
              ? <p className="text-[10px] text-red-500 mt-1">{condErr}</p>
              : <p className="text-[10px] text-zinc-600 mt-1">
                  Vazio = sempre executa. Avançado — exemplos: {'{"shipping_status":"shipped"}'}, {'{"order_value_min":100}'}.
                </p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function ModelosJornadasTab({ onToast }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [journeys,     setJourneys]     = useState<JourneyTemplate[]>([])
  const [templates,    setTemplates]    = useState<TemplateRef[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<string | null>(null)
  const [creating,     setCreating]     = useState(false)
  const [form,         setForm]         = useState<JourneyFormState>(EMPTY_FORM)
  const [originalForm, setOriginalForm] = useState<JourneyFormState>(EMPTY_FORM)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [errors,       setErrors]       = useState<{ name?: string; steps?: string }>({})
  const [saving,       setSaving]       = useState(false)
  const confirm = useConfirm()

  const isDirty   = JSON.stringify(form) !== JSON.stringify(originalForm)
  const isEditing = selected !== null && !creating

  const headers = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization:  `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  // ── lifecycle: carrega journeys + templates em paralelo ─────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h = await headers()
      const [jRes, tRes] = await Promise.all([
        fetch(`${BACKEND}/communication/journeys-templates`, { headers: h }),
        fetch(`${BACKEND}/communication/templates`,          { headers: h }),
      ])
      if (jRes.ok) setJourneys(await jRes.json() as JourneyTemplate[])
      else         onToast?.('Falha ao carregar modelos', 'error')
      if (tRes.ok) {
        const ts = (await tRes.json() as Array<{ id: string; name: string; channel: string; template_kind: string }>)
        setTemplates(ts.map(t => ({ id: t.id, name: t.name, channel: t.channel, template_kind: t.template_kind })))
      }
    } catch {
      onToast?.('Erro de rede', 'error')
    } finally {
      setLoading(false)
    }
  }, [headers, onToast])

  useEffect(() => { void load() }, [load])

  // ── selection ──────────────────────────────────────────────────────────────
  const selectJourney = useCallback(async (id: string) => {
    if (isDirty) {
      const ok = await confirm({
        title:        'Descartar mudanças',
        message:      'Descartar mudanças?',
        confirmLabel: 'Descartar',
        variant:      'warning',
      })
      if (!ok) return
    }
    const j = journeys.find(x => x.id === id)
    if (!j) return
    const f: JourneyFormState = {
      id:              j.id,
      name:            j.name,
      description:     j.description ?? '',
      trigger_event:   j.trigger_event,
      trigger_channel: j.trigger_channel,
      is_active:       j.is_active,
      mode:            j.mode,
      steps:           persistedToFormSteps(j.steps ?? []),
    }
    setSelected(id)
    setCreating(false)
    setForm(f); setOriginalForm(f)
    setExpandedStep(null); setErrors({})
  }, [isDirty, journeys, confirm])

  const newJourney = useCallback(async () => {
    if (isDirty) {
      const ok = await confirm({
        title:        'Descartar mudanças',
        message:      'Descartar mudanças?',
        confirmLabel: 'Descartar',
        variant:      'warning',
      })
      if (!ok) return
    }
    setSelected(null); setCreating(true)
    setForm(EMPTY_FORM); setOriginalForm(EMPTY_FORM)
    setExpandedStep(null); setErrors({})
  }, [isDirty, confirm])

  const cancelEdit = useCallback(async () => {
    if (isDirty) {
      const ok = await confirm({
        title:        'Descartar mudanças',
        message:      'Descartar mudanças?',
        confirmLabel: 'Descartar',
        variant:      'warning',
      })
      if (!ok) return
    }
    setForm(originalForm)
    setExpandedStep(null); setErrors({})
  }, [isDirty, originalForm, confirm])

  // ── step manipulators ──────────────────────────────────────────────────────
  const addStep = useCallback(() => {
    const newStep: StepFormState = {
      _id:             stepId(),
      _unit:           'minutes',
      _conditionStr:   '',
      step:            form.steps.length + 1,
      trigger:         'immediate',
      delay_minutes:   0,
      template_kind:   'transactional',
      template_name:   '',
      channel_priority: 'whatsapp_then_email',
    }
    setForm(f => ({ ...f, steps: [...f.steps, newStep] }))
    setExpandedStep(newStep._id)
  }, [form.steps.length])

  const removeStep = useCallback(async (id: string) => {
    const ok = await confirm({
      title:        'Remover step',
      message:      'Remover este step?',
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
    setForm(f => ({ ...f, steps: f.steps.filter(s => s._id !== id) }))
    if (expandedStep === id) setExpandedStep(null)
  }, [expandedStep, confirm])

  const updateStep = useCallback((id: string, patch: Partial<StepFormState>) => {
    setForm(f => ({
      ...f,
      steps: f.steps.map(s => s._id === id ? { ...s, ...patch } : s),
    }))
  }, [])

  const moveStep = useCallback((id: string, dir: -1 | 1) => {
    setForm(f => {
      const idx = f.steps.findIndex(s => s._id === id)
      if (idx < 0) return f
      const next = idx + dir
      if (next < 0 || next >= f.steps.length) return f
      const arr = [...f.steps]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return { ...f, steps: arr }
    })
  }, [])

  // ── DnD ─────────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setForm(f => {
      const oldIdx = f.steps.findIndex(s => s._id === active.id)
      const newIdx = f.steps.findIndex(s => s._id === over.id)
      if (oldIdx < 0 || newIdx < 0) return f
      const arr = [...f.steps]
      const [moved] = arr.splice(oldIdx, 1)
      arr.splice(newIdx, 0, moved)
      return { ...f, steps: arr }
    })
  }, [])

  // ── validation + save ──────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: { name?: string; steps?: string } = {}
    const name = form.name.trim()
    if (!name)               errs.name = 'Nome obrigatório'
    else if (name.length < 3) errs.name = 'Min 3 caracteres'
    else {
      const dupe = journeys.find(j => j.name === name && j.id !== selected)
      if (dupe) errs.name = 'Já existe modelo com esse nome'
    }
    if (form.steps.length === 0) errs.steps = 'Adicione pelo menos 1 step'
    else {
      for (let i = 0; i < form.steps.length; i++) {
        const s = form.steps[i]
        if (!s.template_name) { errs.steps = `Step ${i + 1}: selecione um template`;     break }
        if (s.delay_minutes < 0) { errs.steps = `Step ${i + 1}: delay não pode ser negativo`; break }
        const cond = tryParseJSON(s._conditionStr)
        if (!cond.ok)        { errs.steps = `Step ${i + 1}: condition JSON inválida`;     break }
        if (s.trigger === 'time_offset' && !s.offset_from?.trim()) {
          errs.steps = `Step ${i + 1}: offset_from obrigatório pra time_offset`; break
        }
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const save = useCallback(async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const h = await headers()
      const body = {
        name:            form.name.trim(),
        description:     form.description.trim() || null,
        trigger_event:   form.trigger_event,
        trigger_channel: form.trigger_channel,
        is_active:       form.is_active,
        mode:            form.mode,
        steps:           formToPersistedSteps(form.steps),
      }
      const url    = creating
        ? `${BACKEND}/communication/journeys-templates`
        : `${BACKEND}/communication/journeys-templates/${selected}`
      const method = creating ? 'POST' : 'PATCH'
      const res = await fetch(url, { method, headers: h, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { message?: string } | null
        onToast?.(err?.message ?? `Falha ao salvar (${res.status})`, 'error')
        return
      }
      const saved = await res.json() as JourneyTemplate
      onToast?.(creating ? 'Modelo criado' : 'Modelo atualizado', 'success')
      await load()
      // Recarrega o form com os dados recém-salvos (preserva _id estável dos steps
      // recém-salvos pra não confundir o dnd-kit).
      const fNew: JourneyFormState = {
        id:              saved.id,
        name:            saved.name,
        description:     saved.description ?? '',
        trigger_event:   saved.trigger_event,
        trigger_channel: saved.trigger_channel,
        is_active:       saved.is_active,
        mode:            saved.mode,
        steps:           persistedToFormSteps(saved.steps ?? []),
      }
      setSelected(saved.id); setCreating(false)
      setForm(fNew); setOriginalForm(fNew)
      setErrors({}); setExpandedStep(null)
    } catch {
      onToast?.('Erro de rede', 'error')
    } finally {
      setSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, creating, selected, journeys, headers, load, onToast])

  const deactivate = useCallback(async () => {
    if (!selected || creating) return
    const ok = await confirm({
      title:        'Desativar modelo',
      message:      'Desativar modelo? Runs históricas ficam preservadas.',
      confirmLabel: 'Desativar',
      variant:      'danger',
    })
    if (!ok) return
    try {
      const h = await headers()
      const res = await fetch(`${BACKEND}/communication/journeys-templates/${selected}`, {
        method: 'DELETE', headers: h,
      })
      if (!res.ok) { onToast?.(`Falha ao desativar (${res.status})`, 'error'); return }
      onToast?.('Modelo desativado, runs históricas preservadas', 'success')
      setSelected(null); setCreating(false)
      setForm(EMPTY_FORM); setOriginalForm(EMPTY_FORM)
      setExpandedStep(null)
      await load()
    } catch {
      onToast?.('Erro de rede', 'error')
    }
  }, [selected, creating, headers, load, onToast, confirm])

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* LIST */}
      <div className="lg:col-span-1 rounded-xl p-3 self-start"
        style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-zinc-200 text-sm font-semibold">Modelos de jornada</h3>
          <button onClick={newJourney}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.30)' }}>
            <Plus size={11} /> Novo modelo
          </button>
        </div>
        {loading ? (
          <div className="py-6 text-center">
            <Loader2 size={14} className="inline animate-spin text-zinc-500" />
            <p className="text-zinc-600 text-[11px] mt-2">Carregando…</p>
          </div>
        ) : journeys.length === 0 ? (
          <p className="text-zinc-500 text-[11px] text-center py-6">
            Nenhum modelo — clique em + Novo modelo
          </p>
        ) : (
          <div className="space-y-1.5">
            {journeys.map(j => {
              const isSel = j.id === selected
              return (
                <button key={j.id} onClick={() => selectJourney(j.id)}
                  className="w-full text-left rounded-lg px-3 py-2.5 transition-colors"
                  style={{
                    background: isSel ? 'rgba(0,229,255,0.08)' : '#070709',
                    border: `1px solid ${isSel ? 'rgba(0,229,255,0.40)' : '#1a1a1f'}`,
                  }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-zinc-100 truncate">{j.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {(j.steps?.length ?? 0)} step{j.steps?.length === 1 ? '' : 's'} · {j.trigger_event}
                      </p>
                    </div>
                    {j.is_active
                      ? <CheckCircle2 size={11} style={{ color: '#4ade80' }} className="shrink-0 mt-0.5" />
                      : <XCircle      size={11} style={{ color: '#71717a' }} className="shrink-0 mt-0.5" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* RIGHT: editor ou empty */}
      <div className="lg:col-span-2">
        {!isEditing && !creating ? (
          <div className="rounded-xl p-12 text-center"
            style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
            <p className="text-zinc-500 text-sm">
              Selecione um modelo ou clique em <span className="text-cyan-400">+ Novo modelo</span> pra começar.
            </p>
          </div>
        ) : (
          <div className="rounded-xl p-4 space-y-4"
            style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
            <h3 className="text-zinc-200 text-sm font-semibold">
              {creating ? 'Novo modelo' : 'Editar modelo'}
            </h3>

            {/* Header form */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500">Nome</label>
                <input value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] text-zinc-200 outline-none"
                  style={{ border: `1px solid ${errors.name ? '#dc2626' : '#27272a'}` }} />
                {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">Trigger da jornada</label>
                  <select value={form.trigger_event}
                    onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value as TriggerEvent }))}
                    className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none">
                    {TRIGGER_EVENTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Quando a jornada inteira começa (ex: order_paid = pedido pago).
                  </p>
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="accent-cyan-400" />
                    <span className="text-[12px] text-zinc-300">Ativo</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500">Descrição (opcional)</label>
                <textarea value={form.description} rows={2}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none resize-none" />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-semibold text-zinc-200">Steps da jornada</h4>
                <button onClick={addStep} type="button"
                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.30)' }}>
                  <Plus size={11} /> Adicionar step
                </button>
              </div>
              {errors.steps && <p className="text-[11px] text-red-500">{errors.steps}</p>}

              {form.steps.length === 0 ? (
                <p className="text-zinc-600 text-[11px] text-center py-4">
                  Nenhum step ainda — adicione o primeiro.
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={form.steps.map(s => s._id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {form.steps.map((s, i) => (
                        <SortableStepCard
                          key={s._id}
                          step={s}
                          index={i}
                          isFirst={i === 0}
                          isLast={i === form.steps.length - 1}
                          expanded={expandedStep === s._id}
                          templates={templates}
                          onToggle={() => setExpandedStep(prev => prev === s._id ? null : s._id)}
                          onChange={patch => updateStep(s._id, patch)}
                          onRemove={() => removeStep(s._id)}
                          onMoveUp={() => moveStep(s._id, -1)}
                          onMoveDown={() => moveStep(s._id, 1)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Botões */}
            <div className="flex items-center justify-end gap-2 pt-3"
              style={{ borderTop: '1px solid #1a1a1f' }}>
              {!creating && (
                <button onClick={deactivate} type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg"
                  style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.30)' }}>
                  <Trash2 size={11} /> Desativar
                </button>
              )}
              <button onClick={cancelEdit} type="button"
                className="px-3 py-1.5 text-[12px] rounded-lg text-zinc-300 border border-zinc-800 hover:bg-zinc-900/50">
                Cancelar
              </button>
              <button onClick={save} disabled={saving} type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg disabled:opacity-50"
                style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.30)' }}>
                <Save size={11} /> {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
