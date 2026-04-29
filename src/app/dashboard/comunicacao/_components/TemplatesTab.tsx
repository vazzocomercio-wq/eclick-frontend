'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, Save, Trash2, CheckCircle2, XCircle } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── types ─────────────────────────────────────────────────────────────────────

type Channel       = 'whatsapp' | 'email' | 'instagram' | 'tiktok'
type TemplateKind  = 'transactional' | 'marketing' | 'sac' | 'custom'
type TriggerEvent  =
  | 'order_paid' | 'order_shipped' | 'order_delivered' | 'order_cancelled'
  | 'post_sale_7d' | 'post_sale_30d' | 'manual' | 'lead_bridge_capture'

interface Template {
  id:              string
  organization_id: string
  name:            string
  channel:         Channel
  trigger_event:   TriggerEvent
  message_body:    string
  variables:       string[]
  is_active:       boolean
  template_kind:   TemplateKind
  subject:         string | null
  description:     string | null
  tags:            string[]
  created_at:      string
  updated_at:      string
}

const KIND_META: Record<TemplateKind, { icon: string; label: string }> = {
  transactional: { icon: '📨', label: 'transactional' },
  marketing:     { icon: '🎯', label: 'marketing'     },
  sac:           { icon: '💬', label: 'sac'           },
  custom:        { icon: '⚙️', label: 'custom'        },
}

const CHANNELS: Channel[]      = ['whatsapp', 'email', 'instagram', 'tiktok']
const KINDS:    TemplateKind[] = ['transactional', 'marketing', 'sac', 'custom']
const TRIGGERS: TriggerEvent[] = [
  'order_paid', 'order_shipped', 'order_delivered', 'order_cancelled',
  'post_sale_7d', 'post_sale_30d', 'manual', 'lead_bridge_capture',
]

/** Valores mock pro preview WhatsApp. Variáveis não mapeadas viram
 * [VAR_NAME] em vermelho — destaque pra autor identificar typos. */
const MOCK_VARS: Record<string, string> = {
  first_name:        'Silvio',
  last_name:         'Junior',
  full_name:         'Silvio Junior',
  product_title:     'Lustre Cristal Vazzo K9',
  external_order_id: '200001234567',
  brand_name:        'Vazzo',
  tracking_code:     'BR123456789BR',
  delivery_date:     '30/04/2026',
  total_amount:      'R$ 459,90',
}

const EMPTY_FORM: Partial<Template> = {
  name:           '',
  channel:        'whatsapp',
  template_kind:  'transactional',
  trigger_event:  'order_paid',
  message_body:   '',
  subject:        '',
  description:    '',
  tags:           [],
}

interface Props {
  onToast?: (msg: string, type?: 'success' | 'error') => void
}

// ── component ─────────────────────────────────────────────────────────────────

export default function TemplatesTab({ onToast }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [templates,    setTemplates]    = useState<Template[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<string | null>(null)
  const [creating,     setCreating]     = useState(false)
  const [form,         setForm]         = useState<Partial<Template>>(EMPTY_FORM)
  const [originalForm, setOriginalForm] = useState<Partial<Template>>(EMPTY_FORM)
  const [tagInput,     setTagInput]     = useState('')
  const [errors,       setErrors]       = useState<{ name?: string; message_body?: string }>({})
  const [saving,       setSaving]       = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isDirty   = JSON.stringify(form) !== JSON.stringify(originalForm)
  const isEditing = selected !== null && !creating

  const headers = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization:  `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h = await headers()
      const res = await fetch(`${BACKEND}/communication/templates`, { headers: h })
      if (!res.ok) {
        onToast?.('Falha ao carregar templates', 'error')
        return
      }
      const body = await res.json() as Template[]
      setTemplates(Array.isArray(body) ? body : [])
    } catch {
      onToast?.('Erro de rede', 'error')
    } finally {
      setLoading(false)
    }
  }, [headers, onToast])

  useEffect(() => { void load() }, [load])

  // ── selection / form lifecycle ───────────────────────────────────────────────
  const selectTemplate = useCallback((id: string) => {
    if (isDirty && !confirm('Descartar mudanças?')) return
    const t = templates.find(x => x.id === id)
    if (!t) return
    setSelected(id)
    setCreating(false)
    setForm(t)
    setOriginalForm(t)
    setErrors({})
    setTagInput('')
  }, [isDirty, templates])

  const newTemplate = useCallback(() => {
    if (isDirty && !confirm('Descartar mudanças?')) return
    setSelected(null)
    setCreating(true)
    setForm(EMPTY_FORM)
    setOriginalForm(EMPTY_FORM)
    setErrors({})
    setTagInput('')
  }, [isDirty])

  const cancelEdit = useCallback(() => {
    if (isDirty && !confirm('Descartar mudanças?')) return
    setForm(originalForm)
    setErrors({})
    setTagInput('')
  }, [isDirty, originalForm])

  // ── validation ───────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: { name?: string; message_body?: string } = {}
    const name = (form.name ?? '').trim()
    if (!name)                  errs.name = 'Nome obrigatório'
    else if (name.length < 3)   errs.name = 'Min 3 caracteres'
    else {
      const dupe = templates.find(t => t.name === name && t.id !== selected)
      if (dupe) errs.name = 'Já existe template com esse nome'
    }
    const msg = (form.message_body ?? '').trim()
    if (!msg)                   errs.message_body = 'Mensagem obrigatória'
    else if (msg.length < 10)   errs.message_body = 'Min 10 caracteres'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── save / delete ────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const h = await headers()
      const body = {
        name:           form.name?.trim(),
        channel:        form.channel,
        template_kind:  form.template_kind,
        trigger_event:  form.trigger_event,
        message_body:   form.message_body,
        subject:        form.subject?.trim() || null,
        description:    form.description?.trim() || null,
        tags:           form.tags ?? [],
      }
      const url    = creating
        ? `${BACKEND}/communication/templates`
        : `${BACKEND}/communication/templates/${selected}`
      const method = creating ? 'POST' : 'PATCH'
      const res = await fetch(url, { method, headers: h, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { message?: string } | null
        onToast?.(err?.message ?? `Falha ao salvar (${res.status})`, 'error')
        return
      }
      const saved = await res.json() as Template
      onToast?.(creating ? 'Template criado' : 'Template atualizado', 'success')
      await load()
      setSelected(saved.id)
      setCreating(false)
      setForm(saved)
      setOriginalForm(saved)
      setTagInput('')
    } catch {
      onToast?.('Erro de rede', 'error')
    } finally {
      setSaving(false)
    }
    // validate is intentionally outside deps — reads form/templates which are deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, creating, selected, templates, headers, load, onToast])

  const deactivate = useCallback(async () => {
    if (!selected || creating) return
    if (!confirm('Desativar template? Histórico preservado.')) return
    try {
      const h = await headers()
      const res = await fetch(`${BACKEND}/communication/templates/${selected}`, {
        method: 'DELETE', headers: h,
      })
      if (!res.ok) {
        onToast?.(`Falha ao desativar (${res.status})`, 'error')
        return
      }
      onToast?.('Template desativado, histórico preservado', 'success')
      setSelected(null)
      setCreating(false)
      setForm(EMPTY_FORM)
      setOriginalForm(EMPTY_FORM)
      await load()
    } catch {
      onToast?.('Erro de rede', 'error')
    }
  }, [selected, creating, headers, load, onToast])

  // ── variables auto-extracted ─────────────────────────────────────────────────
  const messageVars = useMemo(() => {
    const set = new Set<string>()
    for (const m of (form.message_body ?? '').matchAll(/\{\{([a-z_]+)\}\}/g)) {
      set.add(m[1])
    }
    return [...set]
  }, [form.message_body])

  const insertVarAtCursor = useCallback((varName: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const before = ta.value.slice(0, start)
    const after  = ta.value.slice(end)
    const insert = `{{${varName}}}`
    const next   = before + insert + after
    setForm(f => ({ ...f, message_body: next }))
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + insert.length, start + insert.length)
    }, 0)
  }, [])

  // ── preview render (alterna texto puro com spans vermelhos) ──────────────────
  const previewParts = useMemo<ReactNode[]>(() => {
    const msg = form.message_body ?? ''
    const parts: ReactNode[] = []
    let lastIdx = 0
    let key     = 0
    for (const m of msg.matchAll(/\{\{([a-z_]+)\}\}/g)) {
      if (m.index === undefined) continue
      if (m.index > lastIdx) parts.push(msg.slice(lastIdx, m.index))
      const v = MOCK_VARS[m[1]]
      if (v) {
        parts.push(v)
      } else {
        parts.push(
          <span key={`v${key++}`} style={{ color: '#dc2626', fontWeight: 600 }}>
            [{m[1].toUpperCase()}]
          </span>,
        )
      }
      lastIdx = m.index + m[0].length
    }
    if (lastIdx < msg.length) parts.push(msg.slice(lastIdx))
    return parts
  }, [form.message_body])

  // ── tags ─────────────────────────────────────────────────────────────────────
  const addTag = useCallback(() => {
    const t = tagInput.trim()
    if (!t) return
    setForm(f => ({ ...f, tags: [...new Set([...(f.tags ?? []), t])] }))
    setTagInput('')
  }, [tagInput])

  const removeTag = useCallback((tag: string) => {
    setForm(f => ({ ...f, tags: (f.tags ?? []).filter(x => x !== tag) }))
  }, [])

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* LIST (esquerda) */}
      <div className="lg:col-span-1 rounded-xl p-3 self-start"
        style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-zinc-200 text-sm font-semibold">Templates</h3>
          <button onClick={newTemplate}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.30)' }}>
            <Plus size={11} /> Novo template
          </button>
        </div>
        {loading ? (
          <p className="text-zinc-600 text-[11px] text-center py-6">Carregando…</p>
        ) : templates.length === 0 ? (
          <p className="text-zinc-500 text-[11px] text-center py-6">
            Nenhum template — clique em + Novo template
          </p>
        ) : (
          <div className="space-y-1.5">
            {templates.map(t => {
              const meta  = KIND_META[t.template_kind] ?? KIND_META.custom
              const isSel = t.id === selected
              return (
                <button key={t.id} onClick={() => selectTemplate(t.id)}
                  className="w-full text-left rounded-lg px-3 py-2.5 transition-colors"
                  style={{
                    background: isSel ? 'rgba(0,229,255,0.08)' : '#070709',
                    border: `1px solid ${isSel ? 'rgba(0,229,255,0.40)' : '#1a1a1f'}`,
                  }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-base shrink-0">{meta.icon}</span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-zinc-100 truncate">{t.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{meta.label} · {t.channel}</p>
                      </div>
                    </div>
                    {t.is_active
                      ? <CheckCircle2 size={11} style={{ color: '#4ade80' }} className="shrink-0 mt-0.5" />
                      : <XCircle      size={11} style={{ color: '#71717a' }} className="shrink-0 mt-0.5" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* RIGHT (editor + preview) */}
      <div className="lg:col-span-2">
        {!isEditing && !creating ? (
          <div className="rounded-xl p-12 text-center"
            style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
            <p className="text-zinc-500 text-sm">
              Selecione um template ou clique em <span className="text-cyan-400">+ Novo template</span> pra começar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* EDITOR */}
            <div className="rounded-xl p-4 space-y-3"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <h3 className="text-zinc-200 text-sm font-semibold">
                {creating ? 'Novo template' : 'Editar template'}
              </h3>

              {/* Nome */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500">Nome</label>
                <input value={form.name ?? ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] text-zinc-200 outline-none"
                  style={{ border: `1px solid ${errors.name ? '#dc2626' : '#27272a'}` }} />
                {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Canal + Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">Canal</label>
                  <select value={form.channel ?? 'whatsapp'}
                    onChange={e => setForm(f => ({ ...f, channel: e.target.value as Channel }))}
                    className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none">
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">Tipo</label>
                  <select value={form.template_kind ?? 'transactional'}
                    onChange={e => setForm(f => ({ ...f, template_kind: e.target.value as TemplateKind }))}
                    className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none">
                    {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              </div>

              {/* Disparo */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500">Disparo</label>
                <select value={form.trigger_event ?? 'order_paid'}
                  onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value as TriggerEvent }))}
                  className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none">
                  {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500">Assunto (opcional)</label>
                <input value={form.subject ?? ''}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none" />
              </div>

              {/* Descrição */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500">Descrição (opcional)</label>
                <textarea value={form.description ?? ''} rows={2}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none resize-none" />
              </div>

              {/* Tags */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500">Tags</label>
                <div className="flex gap-1 flex-wrap mt-1 mb-1.5">
                  {(form.tags ?? []).map(tag => (
                    <span key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                      style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:opacity-70" type="button">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <input value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="Digite e pressione Enter"
                  className="w-full px-3 py-2 text-[12px] rounded-lg bg-[#070709] border border-[#27272a] text-zinc-200 outline-none" />
              </div>

              {/* Mensagem */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500">Mensagem</label>
                <textarea ref={textareaRef} value={form.message_body ?? ''} rows={12}
                  onChange={e => setForm(f => ({ ...f, message_body: e.target.value }))}
                  placeholder="Olá {{first_name}}, ..."
                  className="w-full mt-1 px-3 py-2 text-[12px] font-mono rounded-lg bg-[#070709] text-zinc-200 outline-none resize-y"
                  style={{ border: `1px solid ${errors.message_body ? '#dc2626' : '#27272a'}` }} />
                {errors.message_body && <p className="text-[10px] text-red-500 mt-1">{errors.message_body}</p>}
              </div>

              {/* Variáveis (clicáveis pra inserir no cursor) */}
              {messageVars.length > 0 && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500">Variáveis</label>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {messageVars.map(v => (
                      <button key={v} onClick={() => insertVarAtCursor(v)} type="button"
                        className="px-2 py-0.5 rounded text-[10px] font-mono hover:opacity-80"
                        style={{ background: 'rgba(96,165,250,0.10)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

            {/* PREVIEW WhatsApp */}
            <div className="rounded-xl p-3 self-start"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <h3 className="text-zinc-200 text-sm font-semibold mb-3">Preview WhatsApp</h3>
              <div className="rounded-lg overflow-hidden"
                style={{ background: '#ECE5DD', minHeight: '420px', padding: '16px 12px' }}>
                <div className="rounded-lg shadow-sm relative"
                  style={{
                    background: '#DCF8C6',
                    padding: '8px 10px 18px',
                    maxWidth: '85%',
                    marginLeft: 'auto',
                  }}>
                  <div className="text-[12px] leading-relaxed whitespace-pre-wrap"
                    style={{ color: '#000', wordBreak: 'break-word' }}>
                    {previewParts.length > 0 ? previewParts : <span className="italic text-zinc-500">(sem mensagem)</span>}
                  </div>
                  <span className="absolute bottom-1 right-2 text-[9px]"
                    style={{ color: 'rgba(0,0,0,0.45)' }}>19:30 ✓✓</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-600 mt-2">
                Variáveis conhecidas usam valores mock; desconhecidas aparecem em <span style={{ color: '#dc2626' }}>vermelho</span>.
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
