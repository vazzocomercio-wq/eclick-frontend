'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import { WhatsappBubble } from './WhatsappBubble'
import {
  MessagingTemplate, Channel, TriggerEvent,
  CHANNEL_LABELS, SAMPLE_CONTEXT,
} from './types'
import { useConfirm } from '@/components/ui/dialog-provider'

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

export function TemplatesTab({ onToast }: { onToast: (m: string, type?: 'success'|'error') => void }) {
  const t = useTranslations('messaging.templates')
  const [list, setList]       = useState<MessagingTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<MessagingTemplate | 'new' | null>(null)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<MessagingTemplate[]>('/messaging/templates')
      setList(data)
    } catch (e) { onToast((e as Error).message, 'error') }
    setLoading(false)
  }, [onToast])

  useEffect(() => { load() }, [load])

  async function toggleActive(t: MessagingTemplate) {
    try {
      const updated = await api<MessagingTemplate>(`/messaging/templates/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !t.is_active }),
      })
      setList(prev => prev.map(x => x.id === t.id ? updated : x))
    } catch (e) { onToast((e as Error).message, 'error') }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title:        t('confirm.deleteTitle'),
      message:      t('confirm.deleteMessage'),
      confirmLabel: t('confirm.deleteConfirm'),
      variant:      'danger',
    })
    if (!ok) return
    try {
      await api(`/messaging/templates/${id}`, { method: 'DELETE' })
      setList(prev => prev.filter(x => x.id !== id))
      onToast(t('toast.deleted'), 'success')
    } catch (e) { onToast((e as Error).message, 'error') }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-zinc-400 text-sm">{t('intro')}</p>
        <button
          onClick={() => setEditing('new')}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition"
          style={{ background: '#00E5FF', color: '#08323b' }}
        >{t('newTemplate')}</button>
      </div>

      {loading
        ? <div className="h-32 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        : list.length === 0
          ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500" style={{ background: '#111114', border: '1px dashed #27272a' }}>
              {t('empty')}
            </div>
          : <div className="grid gap-3">
              {list.map(tpl => (
                <TemplateCard key={tpl.id} t={tpl} onEdit={() => setEditing(tpl)} onToggle={() => toggleActive(tpl)} onDelete={() => remove(tpl.id)} />
              ))}
            </div>}

      {editing && (
        <TemplateModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            setList(prev => {
              const idx = prev.findIndex(x => x.id === saved.id)
              return idx >= 0 ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev]
            })
            onToast(t('toast.saved'), 'success')
          }}
          onError={(m) => onToast(m, 'error')}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function TemplateCard({
  t: tpl, onEdit, onToggle, onDelete,
}: {
  t: MessagingTemplate
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const t = useTranslations('messaging.templates')
  return (
    <div className="rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-white text-sm font-semibold">{tpl.name}</p>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={tpl.is_active
              ? { background: 'rgba(52,211,153,0.1)', color: '#34d399' }
              : { background: 'rgba(161,161,170,0.1)', color: '#a1a1aa' }}>
            {tpl.is_active ? t('statusActive') : t('statusInactive')}
          </span>
        </div>
        <p className="text-zinc-500 text-xs mb-1">{t('channelLabel')} <span className="text-zinc-300">{t(`channels.${tpl.channel}`)}</span></p>
        <p className="text-zinc-500 text-xs mb-1">{t('triggerLabel')} <span className="text-zinc-300">{t(`triggers.${tpl.trigger_event}`)}</span></p>
        <p className="text-zinc-500 text-xs">{t('variablesLabel')} {tpl.variables.length === 0 ? '—' : tpl.variables.map(v => `{{${v}}}`).join(' ')}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onEdit} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>{t('edit')}</button>
          <button onClick={onToggle} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>{tpl.is_active ? t('deactivate') : t('activate')}</button>
          <button onClick={onDelete} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#f87171' }}>{t('delete')}</button>
        </div>
      </div>
      <WhatsappBubble message={tpl.message_body} context={SAMPLE_CONTEXT} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const TRIGGERS: TriggerEvent[] = [
  'order_paid','order_shipped','order_delivered','order_cancelled',
  'post_sale_7d','post_sale_30d','manual','lead_bridge_capture',
]

function TemplateModal({
  initial, onClose, onSaved, onError,
}: {
  initial: MessagingTemplate | null
  onClose: () => void
  onSaved: (t: MessagingTemplate) => void
  onError: (m: string) => void
}) {
  const t = useTranslations('messaging.templates')
  const [name, setName]                 = useState(initial?.name ?? '')
  const [channel, setChannel]           = useState<Channel>(initial?.channel ?? 'whatsapp')
  const [trigger, setTrigger]           = useState<TriggerEvent>(initial?.trigger_event ?? 'order_paid')
  const [body, setBody]                 = useState(initial?.message_body ?? '')
  const [active, setActive]             = useState(initial?.is_active ?? true)
  const [saving, setSaving]             = useState(false)

  // Send test
  const [testOpen, setTestOpen]   = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testCtx, setTestCtx]     = useState(JSON.stringify(SAMPLE_CONTEXT, null, 2))
  const [sending, setSending]     = useState(false)

  async function save() {
    if (!name.trim()) return onError(t('errors.nameRequired'))
    if (!body.trim()) return onError(t('errors.messageRequired'))
    setSaving(true)
    try {
      const payload = { name: name.trim(), channel, trigger_event: trigger, message_body: body, is_active: active }
      const t = initial
        ? await api<MessagingTemplate>(`/messaging/templates/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api<MessagingTemplate>('/messaging/templates', { method: 'POST', body: JSON.stringify(payload) })
      onSaved(t)
    } catch (e) {
      onError((e as Error).message)
      setSaving(false)
    }
  }

  async function sendTest() {
    if (!initial) return onError(t('errors.saveBeforeTest'))
    if (!testPhone.trim()) return onError(t('errors.phoneRequired'))
    setSending(true)
    try {
      let ctx: Record<string, unknown>
      try { ctx = JSON.parse(testCtx) } catch { onError(t('errors.invalidJson')); setSending(false); return }
      const res = await api<{ ok: boolean; rendered: string; error?: string }>(`/messaging/templates/${initial.id}/preview`, {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone.trim(), context: ctx }),
      })
      if (res.ok) onSaved({ ...initial }) // reaproveita callback (toast)
      else        onError(res.error ?? t('errors.testFailed'))
      setTestOpen(false)
    } catch (e) { onError((e as Error).message) }
    setSending(false)
  }

  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ background: '#111114', border: '1px solid #1e1e24' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-white font-semibold">{initial ? t('editTemplate') : t('newTemplateTitle')}</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-5">
          <div className="space-y-4">
            <Field label={t('fields.name')}>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder={t('fields.namePlaceholder')} />
            </Field>
            <Field label={t('fields.channel')}>
              <select className="input" value={channel} onChange={e => setChannel(e.target.value as Channel)}>
                {(Object.keys(CHANNEL_LABELS) as Channel[]).map(c => <option key={c} value={c}>{t(`channels.${c}`)}</option>)}
              </select>
            </Field>
            <Field label={t('fields.triggerEvent')}>
              <select className="input" value={trigger} onChange={e => setTrigger(e.target.value as TriggerEvent)}>
                {TRIGGERS.map(tr => <option key={tr} value={tr}>{t(`triggers.${tr}`)}</option>)}
              </select>
            </Field>
            <Field label={t('fields.message')}>
              <textarea
                className="input font-mono text-xs"
                rows={8}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={t('fields.messagePlaceholder')}
              />
              <p className="text-zinc-500 text-[11px] mt-1">
                {t('fields.variablesHint')} <span className="font-mono text-cyan-400">{'{{nome}} {{pedido}} {{produto}} {{rastreio}} {{loja}} {{cupom}} {{valor}}'}</span>
              </p>
            </Field>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              {t('fields.templateActive')}
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-zinc-500 text-[11px] uppercase tracking-widest">{t('previewSample')}</p>
            <WhatsappBubble message={body || t('emptyBody')} context={SAMPLE_CONTEXT} />
            <p className="text-zinc-500 text-[11px] uppercase tracking-widest pt-2">{t('previewEditor')}</p>
            <WhatsappBubble message={body || t('emptyBody')} highlightVars />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button
            onClick={() => setTestOpen(true)}
            disabled={!initial}
            className="px-3 py-2 rounded-lg text-xs font-medium border disabled:opacity-50"
            style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}
          >{t('sendTest')}</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>{t('cancel')}</button>
            <button onClick={save} disabled={saving} className="glow-rainbow px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: '#00E5FF', color: '#08323b' }}>
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>

        {testOpen && (
          <div className="absolute inset-0 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <p className="text-white font-semibold">{t('testModalTitle')}</p>
              <Field label={t('fields.testPhone')}>
                <input className="input" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="5511999998888" />
              </Field>
              <Field label={t('fields.testContext')}>
                <textarea className="input font-mono text-xs" rows={6} value={testCtx} onChange={e => setTestCtx(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2">
                <button onClick={() => setTestOpen(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>{t('cancel')}</button>
                <button onClick={sendTest} disabled={sending} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: '#00E5FF', color: '#08323b' }}>
                  {sending ? t('sendingTest') : t('sendTestSubmit')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: #0a0a0e;
          border: 1px solid #27272a;
          border-radius: 0.5rem;
          color: #fafafa;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { border-color: #00E5FF; }
      `}</style>
    </div>,
    document.body,
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-zinc-400 text-xs mb-1">{label}</p>
      {children}
    </div>
  )
}
