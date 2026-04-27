'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Send, Plus, Trash2, MessageCircle, Clock, GitBranch, Save, Sparkles } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Step =
  | { type: 'send_whatsapp'; message: string }
  | { type: 'wait_hours';    hours: number }
  | { type: 'wait_days';     days: number }
  | { type: 'branch_by_engagement'; threshold: number; if_above: number; if_below: number }

type Journey = {
  id: string
  name: string
  trigger_channel: string | null
  is_active: boolean
  steps: Step[]
  created_at: string
}

const TEMPLATES: Array<{ name: string; trigger_channel: string; steps: Step[] }> = [
  {
    name: 'Boas-vindas pós-compra',
    trigger_channel: 'posvenda',
    steps: [
      { type: 'send_whatsapp', message: 'Olá {{first_name}}! Obrigado pela compra 🎉' },
      { type: 'wait_days', days: 3 },
      { type: 'send_whatsapp', message: 'Tudo certo com seu pedido? Conta pra gente!' },
    ],
  },
  {
    name: 'Cupom de retorno',
    trigger_channel: 'garantia',
    steps: [
      { type: 'send_whatsapp', message: 'Oi {{first_name}}! Seu cupom já está ativo 🎁' },
      { type: 'wait_days', days: 30 },
      { type: 'send_whatsapp', message: 'Lembrete: você ainda pode usar seu cupom! ⏰' },
    ],
  },
]

export default function LeadBridgeJourneysPage() {
  const supabase = useMemo(() => createClient(), [])
  const [list, setList] = useState<Journey[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Journey | null>(null)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/lead-bridge/journeys`, { headers })
      if (res.ok) {
        const v = await res.json()
        setList(Array.isArray(v) ? v : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  function newDraft(): Journey {
    return { id: '', name: 'Nova jornada', trigger_channel: 'posvenda', is_active: true, steps: [], created_at: '' }
  }

  function newFromTemplate(t: typeof TEMPLATES[number]) {
    setEditing({ id: '', name: t.name, trigger_channel: t.trigger_channel, is_active: true, steps: t.steps, created_at: '' })
  }

  async function save() {
    if (!editing) return
    const headers = await getHeaders()
    if (editing.id) {
      await fetch(`${BACKEND}/lead-bridge/journeys/${editing.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          name: editing.name, trigger_channel: editing.trigger_channel,
          is_active: editing.is_active, steps: editing.steps,
        }),
      })
    } else {
      await fetch(`${BACKEND}/lead-bridge/journeys`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: editing.name, trigger_channel: editing.trigger_channel, steps: editing.steps }),
      })
    }
    setEditing(null)
    await load()
  }

  function addStep(type: Step['type']) {
    if (!editing) return
    const step: Step = type === 'send_whatsapp' ? { type, message: '' }
                     : type === 'wait_hours'    ? { type, hours: 1 }
                     : type === 'wait_days'     ? { type, days: 1 }
                     :                            { type: 'branch_by_engagement', threshold: 1, if_above: 1, if_below: 2 }
    setEditing({ ...editing, steps: [...editing.steps, step] })
  }

  function removeStep(idx: number) {
    if (!editing) return
    setEditing({ ...editing, steps: editing.steps.filter((_, i) => i !== idx) })
  }

  function updateStep(idx: number, patch: Partial<Step>) {
    if (!editing) return
    const next = [...editing.steps]
    next[idx] = { ...(next[idx] as Step), ...(patch as Step) } as Step
    setEditing({ ...editing, steps: next })
  }

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Lead Bridge</p>
          <h1 className="text-white text-xl font-semibold flex items-center gap-2"><Send size={18} /> Jornadas</h1>
          <p className="text-zinc-500 text-xs mt-0.5">Sequências automáticas de WhatsApp por canal</p>
        </div>
        <button onClick={() => setEditing(newDraft())}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold"
          style={{ background: '#00E5FF', color: '#000' }}>
          <Plus size={12} /> Nova jornada
        </button>
      </div>

      {/* Templates */}
      <div className="rounded-2xl p-4 space-y-2" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-violet-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Templates</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TEMPLATES.map(t => (
            <button key={t.name} onClick={() => newFromTemplate(t)}
              className="rounded-lg p-3 text-left transition-colors hover:bg-[#161618]"
              style={{ background: '#18181b', border: '1px solid #27272a' }}>
              <p className="text-zinc-200 text-xs font-semibold">{t.name}</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">Canal: {t.trigger_channel} · {t.steps.length} steps</p>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1a1a1f' }}>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Jornadas ativas</h3>
          <span className="text-[11px] text-zinc-600">{list.length} jornada(s)</span>
        </div>
        <div className="divide-y divide-[#1a1a1f]">
          {loading ? (
            <div className="px-5 py-8 text-center text-xs text-zinc-600">Carregando…</div>
          ) : list.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-zinc-600 italic">Nenhuma jornada criada ainda.</div>
          ) : list.map(j => (
            <button key={j.id} onClick={() => setEditing(j)}
              className="w-full px-5 py-3 text-left flex items-center justify-between hover:bg-[#161618] transition-colors">
              <div>
                <p className="text-zinc-200 text-sm font-medium">{j.name}</p>
                <p className="text-zinc-500 text-[11px]">
                  {j.trigger_channel ?? 'qualquer canal'} · {j.steps.length} steps
                  {!j.is_active && ' · pausada'}
                </p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{ color: j.is_active ? '#4ade80' : '#71717a', background: j.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(113,113,122,0.1)' }}>
                {j.is_active ? 'Ativa' : 'Pausada'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setEditing(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-4"
            style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-white text-base font-semibold">{editing.id ? 'Editar jornada' : 'Nova jornada'}</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-[11px] text-zinc-400">{editing.is_active ? 'Ativa' : 'Pausada'}</span>
                <button onClick={() => setEditing({ ...editing, is_active: !editing.is_active })} type="button"
                  className="relative w-9 h-5 rounded-full transition-colors"
                  style={{ background: editing.is_active ? '#4ade80' : '#27272a' }}>
                  <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform"
                    style={{ left: editing.is_active ? 18 : 2 }} />
                </button>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="Nome da jornada"
                className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2" />
              <select value={editing.trigger_channel ?? ''} onChange={e => setEditing({ ...editing, trigger_channel: e.target.value || null })}
                className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2">
                <option value="">Qualquer canal</option>
                <option value="rastreio">Rastreio</option>
                <option value="garantia">Garantia</option>
                <option value="posvenda">Pós-venda</option>
              </select>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-zinc-400">Steps</p>
              {editing.steps.length === 0 && (
                <p className="text-[11px] text-zinc-600 italic">Nenhum step ainda. Adicione abaixo.</p>
              )}
              {editing.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg" style={{ background: '#18181b', border: '1px solid #27272a' }}>
                  <span className="text-[10px] font-bold text-zinc-500 mt-1 w-5">{i + 1}.</span>
                  <div className="flex-1 space-y-2">
                    {s.type === 'send_whatsapp' && (
                      <>
                        <p className="text-[10px] text-emerald-400 flex items-center gap-1"><MessageCircle size={10} /> ENVIAR WHATSAPP</p>
                        <textarea value={s.message} onChange={e => updateStep(i, { message: e.target.value })}
                          placeholder="Mensagem (suporta {{first_name}})"
                          className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-xs rounded px-2 py-1.5 min-h-[60px] resize-y" />
                      </>
                    )}
                    {s.type === 'wait_hours' && (
                      <>
                        <p className="text-[10px] text-blue-400 flex items-center gap-1"><Clock size={10} /> AGUARDAR HORAS</p>
                        <input type="number" value={s.hours} onChange={e => updateStep(i, { hours: Number(e.target.value) || 0 })}
                          className="w-24 bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-xs rounded px-2 py-1 tabular-nums" />
                      </>
                    )}
                    {s.type === 'wait_days' && (
                      <>
                        <p className="text-[10px] text-blue-400 flex items-center gap-1"><Clock size={10} /> AGUARDAR DIAS</p>
                        <input type="number" value={s.days} onChange={e => updateStep(i, { days: Number(e.target.value) || 0 })}
                          className="w-24 bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-xs rounded px-2 py-1 tabular-nums" />
                      </>
                    )}
                    {s.type === 'branch_by_engagement' && (
                      <>
                        <p className="text-[10px] text-violet-400 flex items-center gap-1"><GitBranch size={10} /> RAMIFICAR POR ENGAJAMENTO</p>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="text-[10px] text-zinc-500">Threshold msgs
                            <input type="number" value={s.threshold} onChange={e => updateStep(i, { threshold: Number(e.target.value) || 0 })}
                              className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-xs rounded px-2 py-1 tabular-nums" />
                          </label>
                          <label className="text-[10px] text-zinc-500">Se acima → +N
                            <input type="number" value={s.if_above} onChange={e => updateStep(i, { if_above: Number(e.target.value) || 1 })}
                              className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-xs rounded px-2 py-1 tabular-nums" />
                          </label>
                          <label className="text-[10px] text-zinc-500">Se abaixo → +N
                            <input type="number" value={s.if_below} onChange={e => updateStep(i, { if_below: Number(e.target.value) || 1 })}
                              className="w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-xs rounded px-2 py-1 tabular-nums" />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={() => removeStep(i)} className="p-1 text-zinc-600 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => addStep('send_whatsapp')} className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">+ WhatsApp</button>
                <button onClick={() => addStep('wait_hours')}    className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">+ Aguardar horas</button>
                <button onClick={() => addStep('wait_days')}     className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">+ Aguardar dias</button>
                <button onClick={() => addStep('branch_by_engagement')} className="text-[10px] px-2 py-1 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">+ Ramificar</button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg text-xs text-zinc-400 hover:text-white transition-colors"
                style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>Cancelar</button>
              <button onClick={save} className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                style={{ background: '#00E5FF', color: '#000' }}>
                <Save size={11} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
