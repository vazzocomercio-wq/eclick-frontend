'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import {
  MessagingTemplate, MessagingJourney, JourneyStep,
  TriggerEvent, JourneyMode, StepType,
  TRIGGER_LABELS, MODE_LABELS, STEP_TYPE_LABELS,
} from './types'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`[${res.status}] ${body?.message ?? body?.error ?? 'erro'}`)
  }
  return (await res.json()) as T
}

const TRIGGERS: TriggerEvent[] = [
  'order_paid','order_shipped','order_delivered','order_cancelled',
  'post_sale_7d','post_sale_30d','manual','lead_bridge_capture',
]
const MODES: JourneyMode[] = ['automatic','manual','campaign']

export function JourneysTab({ onToast }: { onToast: (m: string, type?: 'success'|'error') => void }) {
  const [list, setList]               = useState<MessagingJourney[]>([])
  const [templates, setTemplates]     = useState<MessagingTemplate[]>([])
  const [loading, setLoading]         = useState(true)
  const [editing, setEditing]         = useState<MessagingJourney | 'new' | null>(null)
  const [triggering, setTriggering]   = useState<MessagingJourney | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [j, t] = await Promise.all([
        api<MessagingJourney[]>('/messaging/journeys'),
        api<MessagingTemplate[]>('/messaging/templates'),
      ])
      setList(j); setTemplates(t)
    } catch (e) { onToast((e as Error).message, 'error') }
    setLoading(false)
  }, [onToast])

  useEffect(() => { load() }, [load])

  async function toggleActive(j: MessagingJourney) {
    try {
      const updated = await api<MessagingJourney>(`/messaging/journeys/${j.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !j.is_active }),
      })
      setList(prev => prev.map(x => x.id === j.id ? updated : x))
    } catch (e) { onToast((e as Error).message, 'error') }
  }

  async function remove(id: string) {
    if (!confirm('Excluir jornada? Runs ativas continuarão (mas sem nova execução).')) return
    try {
      await api(`/messaging/journeys/${id}`, { method: 'DELETE' })
      setList(prev => prev.filter(x => x.id !== id))
      onToast('Jornada excluída', 'success')
    } catch (e) { onToast((e as Error).message, 'error') }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-zinc-400 text-sm">Jornadas multi-step com automático/manual/campanha. Engine cron a cada 5 min processa runs ativas.</p>
        <button
          onClick={() => setEditing('new')}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition"
          style={{ background: '#00E5FF', color: '#08323b' }}
        >+ Nova jornada</button>
      </div>

      {loading
        ? <div className="h-32 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        : list.length === 0
          ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500" style={{ background: '#111114', border: '1px dashed #27272a' }}>
              Nenhuma jornada ainda. Comece com um template-só (1 step) e evolua a partir daí.
            </div>
          : <div className="grid gap-3">
              {list.map(j => (
                <JourneyCard
                  key={j.id} j={j} templates={templates}
                  onEdit={() => setEditing(j)}
                  onToggle={() => toggleActive(j)}
                  onDelete={() => remove(j.id)}
                  onTrigger={() => setTriggering(j)}
                />
              ))}
            </div>}

      {editing && (
        <JourneyEditor
          initial={editing === 'new' ? null : editing}
          templates={templates}
          onClose={() => setEditing(null)}
          onSaved={(j) => {
            setEditing(null)
            setList(prev => {
              const idx = prev.findIndex(x => x.id === j.id)
              return idx >= 0 ? prev.map(x => x.id === j.id ? j : x) : [j, ...prev]
            })
            onToast('Jornada salva', 'success')
          }}
          onError={(m) => onToast(m, 'error')}
        />
      )}

      {triggering && (
        <TriggerModal
          journey={triggering}
          onClose={() => setTriggering(null)}
          onDone={(msg) => { setTriggering(null); onToast(msg, 'success') }}
          onError={(m) => onToast(m, 'error')}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function JourneyCard({
  j, templates, onEdit, onToggle, onDelete, onTrigger,
}: {
  j: MessagingJourney
  templates: MessagingTemplate[]
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onTrigger: () => void
}) {
  const tplMap = new Map(templates.map(t => [t.id, t.name]))
  return (
    <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <p className="text-white text-sm font-semibold truncate">{j.name}</p>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={j.is_active
                ? { background: 'rgba(52,211,153,0.1)', color: '#34d399' }
                : { background: 'rgba(161,161,170,0.1)', color: '#a1a1aa' }}>
              {j.is_active ? 'Ativa' : 'Inativa'}
            </span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>
              {MODE_LABELS[j.mode]}
            </span>
          </div>
          {j.description && <p className="text-zinc-500 text-xs mb-2">{j.description}</p>}
          <p className="text-zinc-500 text-xs">Trigger: <span className="text-zinc-300">{TRIGGER_LABELS[j.trigger_event]}</span></p>
          <p className="text-zinc-500 text-xs mt-1">{j.steps.length} step{j.steps.length === 1 ? '' : 's'}</p>

          {j.steps.length > 0 && (
            <div className="mt-3 space-y-1">
              {j.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span className="font-mono text-cyan-400">{i + 1}.</span>
                  <span>{STEP_TYPE_LABELS[s.type]}</span>
                  {s.type === 'send_message' && s.template_id && (
                    <span className="text-zinc-500">— {tplMap.get(s.template_id) ?? s.template_id.slice(0,8)}</span>
                  )}
                  {s.type === 'wait' && (
                    <span className="text-zinc-500">— {s.delay_days ? `${s.delay_days}d` : ''}{s.delay_hours ? `${s.delay_hours}h` : ''}</span>
                  )}
                  {s.type === 'condition' && s.condition_field && (
                    <span className="text-zinc-500">— se {s.condition_field} = {String(s.condition_value)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={onEdit} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>Editar</button>
          <button onClick={onToggle} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>{j.is_active ? 'Desativar' : 'Ativar'}</button>
          <button onClick={onTrigger} disabled={!j.is_active} className="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-40" style={{ borderColor: '#00E5FF', color: '#00E5FF' }}>Disparar</button>
          <button onClick={onDelete} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#f87171' }}>Excluir</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function JourneyEditor({
  initial, templates, onClose, onSaved, onError,
}: {
  initial:   MessagingJourney | null
  templates: MessagingTemplate[]
  onClose: () => void
  onSaved: (j: MessagingJourney) => void
  onError: (m: string) => void
}) {
  const [name, setName]             = useState(initial?.name ?? '')
  const [description, setDesc]      = useState(initial?.description ?? '')
  const [trigger, setTrigger]       = useState<TriggerEvent>(initial?.trigger_event ?? 'order_paid')
  const [mode, setMode]             = useState<JourneyMode>(initial?.mode ?? 'automatic')
  const [active, setActive]         = useState(initial?.is_active ?? true)
  const [steps, setSteps]           = useState<JourneyStep[]>(initial?.steps ?? [])
  const [saving, setSaving]         = useState(false)

  function addStep(type: StepType) {
    const next: JourneyStep = { order: steps.length, type }
    if (type === 'send_message') next.template_id = templates[0]?.id
    if (type === 'wait')         next.delay_hours = 1
    setSteps([...steps, next])
  }

  function updateStep(i: number, patch: Partial<JourneyStep>) {
    setSteps(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }

  function removeStep(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx })))
  }

  function moveStep(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    const copy = [...steps]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    setSteps(copy.map((s, idx) => ({ ...s, order: idx })))
  }

  async function save() {
    if (!name.trim()) return onError('Nome obrigatório')
    setSaving(true)
    try {
      const payload = {
        name: name.trim(), description: description.trim() || null,
        trigger_event: trigger, mode, is_active: active, steps,
      }
      const j = initial
        ? await api<MessagingJourney>(`/messaging/journeys/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api<MessagingJourney>('/messaging/journeys', { method: 'POST', body: JSON.stringify(payload) })
      onSaved(j)
    } catch (e) {
      onError((e as Error).message)
      setSaving(false)
    }
  }

  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl my-auto" style={{ background: '#111114', border: '1px solid #1e1e24' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-white font-semibold">{initial ? 'Editar jornada' : 'Nova jornada'}</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-zinc-400 text-xs mb-1">Nome</p>
              <input className="je-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pós-venda automático" />
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Trigger</p>
              <select className="je-input" value={trigger} onChange={e => setTrigger(e.target.value as TriggerEvent)}>
                {TRIGGERS.map(t => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Modo</p>
              <select className="je-input" value={mode} onChange={e => setMode(e.target.value as JourneyMode)}>
                {MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300 mt-5">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              Jornada ativa
            </label>
          </div>

          <div>
            <p className="text-zinc-400 text-xs mb-1">Descrição (opcional)</p>
            <textarea className="je-input" rows={2} value={description ?? ''} onChange={e => setDesc(e.target.value)} />
          </div>

          {/* Steps timeline */}
          <div>
            <p className="text-zinc-300 text-sm font-semibold mb-3">Steps</p>
            {steps.length === 0 && (
              <div className="rounded-xl px-4 py-6 text-center text-zinc-500 text-sm" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
                Nenhum step. Adicione o primeiro abaixo.
              </div>
            )}
            <div className="space-y-2">
              {steps.map((s, i) => (
                <StepRow
                  key={i}
                  step={s}
                  index={i}
                  templates={templates}
                  onChange={(patch) => updateStep(i, patch)}
                  onMove={(dir) => moveStep(i, dir)}
                  onRemove={() => removeStep(i)}
                  canMoveUp={i > 0}
                  canMoveDown={i < steps.length - 1}
                />
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => addStep('send_message')} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>+ Enviar mensagem</button>
              <button onClick={() => addStep('wait')} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>+ Aguardar</button>
              <button onClick={() => addStep('condition')} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>+ Condição</button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: '#00E5FF', color: '#08323b' }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .je-input {
          width: 100%; padding: 0.5rem 0.75rem; background: #0a0a0e;
          border: 1px solid #27272a; border-radius: 0.5rem; color: #fafafa;
          font-size: 0.875rem; outline: none;
        }
        .je-input:focus { border-color: #00E5FF; }
      `}</style>
    </div>,
    document.body,
  )
}

function StepRow({
  step, index, templates, onChange, onMove, onRemove, canMoveUp, canMoveDown,
}: {
  step:        JourneyStep
  index:       number
  templates:   MessagingTemplate[]
  onChange:    (patch: Partial<JourneyStep>) => void
  onMove:      (dir: -1 | 1) => void
  onRemove:    () => void
  canMoveUp:   boolean
  canMoveDown: boolean
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-cyan-400 text-xs">{index + 1}.</span>
        <span className="text-zinc-300 text-xs font-medium">{STEP_TYPE_LABELS[step.type]}</span>
        <div className="ml-auto flex gap-1">
          <button onClick={() => onMove(-1)} disabled={!canMoveUp}  className="px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-30">↑</button>
          <button onClick={() => onMove(1)}  disabled={!canMoveDown} className="px-2 py-0.5 text-xs text-zinc-400 disabled:opacity-30">↓</button>
          <button onClick={onRemove} className="px-2 py-0.5 text-xs text-red-400">✕</button>
        </div>
      </div>

      {step.type === 'send_message' && (
        <select
          className="step-input"
          value={step.template_id ?? ''}
          onChange={e => onChange({ template_id: e.target.value })}
        >
          <option value="">— escolher template —</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      {step.type === 'wait' && (
        <div className="flex gap-2">
          <label className="flex-1">
            <p className="text-zinc-500 text-[10px] mb-0.5">Horas</p>
            <input type="number" min="0" className="step-input" value={step.delay_hours ?? 0} onChange={e => onChange({ delay_hours: Number(e.target.value) || 0 })} />
          </label>
          <label className="flex-1">
            <p className="text-zinc-500 text-[10px] mb-0.5">Dias</p>
            <input type="number" min="0" className="step-input" value={step.delay_days ?? 0} onChange={e => onChange({ delay_days: Number(e.target.value) || 0 })} />
          </label>
        </div>
      )}
      {step.type === 'condition' && (
        <div className="flex gap-2">
          <label className="flex-1">
            <p className="text-zinc-500 text-[10px] mb-0.5">Campo do contexto</p>
            <input className="step-input" value={step.condition_field ?? ''} onChange={e => onChange({ condition_field: e.target.value })} placeholder="ex: nome" />
          </label>
          <label className="flex-1">
            <p className="text-zinc-500 text-[10px] mb-0.5">Valor esperado</p>
            <input className="step-input" value={String(step.condition_value ?? '')} onChange={e => onChange({ condition_value: e.target.value })} />
          </label>
        </div>
      )}
      <style jsx>{`
        .step-input {
          width: 100%; padding: 0.4rem 0.6rem; background: #18181b;
          border: 1px solid #27272a; border-radius: 0.375rem; color: #fafafa;
          font-size: 0.8125rem; outline: none;
        }
        .step-input:focus { border-color: #00E5FF; }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function TriggerModal({
  journey, onClose, onDone, onError,
}: {
  journey: MessagingJourney
  onClose: () => void
  onDone: (msg: string) => void
  onError: (m: string) => void
}) {
  const [phone, setPhone]     = useState('')
  const [orderId, setOrderId] = useState('')
  const [ctx, setCtx]         = useState(JSON.stringify({ nome: '', pedido: '', produto: '', loja: 'Vazzo' }, null, 2))
  const [sending, setSending] = useState(false)

  async function fire() {
    if (!phone.trim()) return onError('Phone obrigatório')
    setSending(true)
    try {
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(ctx) } catch { onError('JSON inválido em context'); setSending(false); return }
      const res = await api<{ run_id: string }>(`/messaging/journeys/${journey.id}/trigger`, {
        method: 'POST',
        body: JSON.stringify({
          phone: phone.trim(),
          order_id: orderId.trim() || undefined,
          context: parsed,
        }),
      })
      onDone(`Run criada: ${res.run_id.slice(0, 8)}…`)
    } catch (e) { onError((e as Error).message) }
    setSending(false)
  }

  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }} onClick={(e) => e.stopPropagation()}>
        <p className="text-white font-semibold">Disparar &quot;{journey.name}&quot;</p>
        <p className="text-zinc-500 text-xs">Cria 1 run com next_step_at=now. Engine processa em até 5 min.</p>
        <label className="block">
          <p className="text-zinc-400 text-xs mb-1">Phone (com DDI)</p>
          <input className="tg-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="5511999998888" />
        </label>
        <label className="block">
          <p className="text-zinc-400 text-xs mb-1">Order ID (opcional)</p>
          <input className="tg-input" value={orderId} onChange={e => setOrderId(e.target.value)} />
        </label>
        <label className="block">
          <p className="text-zinc-400 text-xs mb-1">Context (JSON)</p>
          <textarea className="tg-input font-mono text-xs" rows={6} value={ctx} onChange={e => setCtx(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>Cancelar</button>
          <button onClick={fire} disabled={sending} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: '#00E5FF', color: '#08323b' }}>
            {sending ? 'Disparando…' : 'Disparar'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .tg-input {
          width: 100%; padding: 0.5rem 0.75rem; background: #0a0a0e;
          border: 1px solid #27272a; border-radius: 0.5rem; color: #fafafa;
          font-size: 0.875rem; outline: none;
        }
        .tg-input:focus { border-color: #00E5FF; }
      `}</style>
    </div>,
    document.body,
  )
}
