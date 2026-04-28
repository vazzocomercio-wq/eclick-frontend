'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import { WhatsappBubble } from './WhatsappBubble'
import { MessagingTemplate, SAMPLE_CONTEXT } from './types'

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
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`[${res.status}] ${body?.message ?? body?.error ?? 'erro'}`)
  }
  return (await res.json()) as T
}

type Segment = 'all' | 'with_cpf' | 'vip' | 'custom'
type Customer = { id: string; display_name: string | null; phone: string | null; cpf: string | null }
type CampaignBatch = {
  bucket:    string  // ISO truncado pra hora
  template:  string
  total:     number
  sent:      number
  delivered: number
  failed:    number
}

const SEGMENT_LABELS: Record<Segment, string> = {
  all:      'Todos com WhatsApp',
  with_cpf: 'Com CPF validado',
  vip:      'VIP',
  custom:   'Selecionar clientes',
}

export function CampaignsTab({ onToast }: { onToast: (m: string, type?: 'success'|'error') => void }) {
  const [templates, setTemplates]     = useState<MessagingTemplate[]>([])
  const [tplId, setTplId]             = useState<string>('')
  const [segment, setSegment]         = useState<Segment>('all')
  const [override, setOverride]       = useState('')
  const [count, setCount]             = useState<number | null>(null)
  const [countLoad, setCountLoad]     = useState(false)
  const [picked, setPicked]           = useState<Customer[]>([])
  const [showCustom, setShowCustom]   = useState(false)
  const [confirm, setConfirm]         = useState(false)
  const [sending, setSending]         = useState(false)
  const [history, setHistory]         = useState<CampaignBatch[]>([])

  const tpl = templates.find(t => t.id === tplId)

  // Carrega templates
  useEffect(() => {
    api<MessagingTemplate[]>('/messaging/templates')
      .then(d => {
        setTemplates(d)
        if (d.length > 0 && !tplId) setTplId(d[0].id)
      })
      .catch(e => onToast((e as Error).message, 'error'))
  }, [onToast, tplId])

  // Atualiza contador ao mudar segment/picked
  const refreshCount = useCallback(async () => {
    setCountLoad(true)
    try {
      if (segment === 'custom') {
        setCount(picked.length)
      } else {
        const params = new URLSearchParams({ per_page: '1', has_phone: '1' })
        if (segment === 'with_cpf') params.set('has_cpf', '1')
        if (segment === 'vip')      params.set('is_vip', '1')
        const res = await api<{ total: number }>(`/customers?${params.toString()}`)
        setCount(res.total)
      }
    } catch (e) { onToast((e as Error).message, 'error'); setCount(null) }
    setCountLoad(false)
  }, [segment, picked, onToast])

  useEffect(() => { refreshCount() }, [refreshCount])

  // Carrega histórico (sends agrupados por hora + template)
  const loadHistory = useCallback(async () => {
    try {
      const res = await api<{ items: Array<{ template_id: string | null; status: string; created_at: string }> }>('/messaging/sends?limit=500')
      // bucket por hora + template_id
      const map = new Map<string, CampaignBatch>()
      const tplMap = new Map(templates.map(t => [t.id, t.name]))
      for (const s of res.items) {
        if (!s.template_id) continue
        const hour = s.created_at.slice(0, 13) // YYYY-MM-DDTHH
        const key  = `${hour}|${s.template_id}`
        const cur  = map.get(key) ?? { bucket: hour, template: tplMap.get(s.template_id) ?? '?', total: 0, sent: 0, delivered: 0, failed: 0 }
        cur.total++
        if (s.status === 'sent' || s.status === 'delivered' || s.status === 'read') cur.sent++
        if (s.status === 'delivered' || s.status === 'read')                         cur.delivered++
        if (s.status === 'failed')                                                   cur.failed++
        map.set(key, cur)
      }
      setHistory([...map.values()].sort((a, b) => b.bucket.localeCompare(a.bucket)).slice(0, 20))
    } catch (e) { onToast((e as Error).message, 'error') }
  }, [templates, onToast])

  useEffect(() => { if (templates.length > 0) loadHistory() }, [templates, loadHistory])

  async function fire() {
    if (!tplId) return onToast('Selecione um template', 'error')
    if (segment === 'custom' && picked.length === 0) return onToast('Selecione ao menos 1 cliente', 'error')
    setSending(true)
    try {
      const payload: Record<string, unknown> = {
        template_id:      tplId,
        segment,
        message_override: override.trim() || undefined,
      }
      if (segment === 'custom') payload.customer_ids = picked.map(c => c.id)
      const res = await api<{ total: number; sent: number; failed: number }>('/messaging/campaigns/send', {
        method: 'POST',
        body:   JSON.stringify(payload),
      })
      onToast(`Campanha disparada: ${res.sent}/${res.total} enviados, ${res.failed} falhas`, 'success')
      setConfirm(false)
      await loadHistory()
    } catch (e) { onToast((e as Error).message, 'error') }
    setSending(false)
  }

  return (
    <>
      <p className="text-zinc-400 text-sm mb-5">Disparo em massa via segmento. Cap 500/call (50s @ 100ms/send). Histórico abaixo é agrupado por hora+template.</p>

      <div className="rounded-2xl p-5 grid md:grid-cols-2 gap-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="space-y-4">
          <Field label="Template">
            <select className="cm-input" value={tplId} onChange={e => setTplId(e.target.value)}>
              <option value="">— escolher —</option>
              {templates.filter(t => t.is_active && t.channel === 'whatsapp').map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Segmento">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SEGMENT_LABELS) as Segment[]).map(s => (
                <button
                  key={s}
                  onClick={() => { setSegment(s); if (s === 'custom') setShowCustom(true) }}
                  className="px-3 py-2 rounded-lg text-xs font-medium border text-left"
                  style={{
                    borderColor: segment === s ? '#00E5FF' : '#27272a',
                    color:       segment === s ? '#00E5FF' : '#e4e4e7',
                    background:  segment === s ? 'rgba(0,229,255,0.05)' : 'transparent',
                  }}
                >{SEGMENT_LABELS[s]}</button>
              ))}
            </div>
            {segment === 'custom' && (
              <button onClick={() => setShowCustom(true)} className="mt-2 text-xs text-cyan-400 underline">
                {picked.length} cliente{picked.length === 1 ? '' : 's'} selecionado{picked.length === 1 ? '' : 's'} — editar
              </button>
            )}
          </Field>

          <Field label="Mensagem (opcional — sobrescreve template)">
            <textarea className="cm-input font-mono text-xs" rows={4} value={override} onChange={e => setOverride(e.target.value)} placeholder="Deixe em branco pra usar o template como está." />
          </Field>

          <div className="rounded-lg px-4 py-3" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            <p className="text-zinc-400 text-xs">Impacto previsto</p>
            <p className="text-2xl font-bold text-white mt-1">
              {countLoad ? '…' : count === null ? '?' : count}
              <span className="text-sm text-zinc-500 ml-2 font-normal">cliente{count === 1 ? '' : 's'}</span>
            </p>
            <p className="text-zinc-500 text-[11px] mt-1">Cap por chamada: 500. Maiores → divida em batches.</p>
          </div>

          <button
            onClick={() => setConfirm(true)}
            disabled={!tpl || count === 0 || count === null}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#08323b' }}
          >Enviar campanha</button>
        </div>

        <div>
          <p className="text-zinc-500 text-[11px] uppercase tracking-widest mb-2">Preview</p>
          {tpl
            ? <WhatsappBubble message={override.trim() || tpl.message_body} context={SAMPLE_CONTEXT} />
            : <div className="rounded-xl px-4 py-8 text-center text-zinc-500 text-xs" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>Selecione um template</div>
          }
        </div>
      </div>

      <div className="mt-8">
        <p className="text-zinc-300 text-sm font-semibold mb-3">Histórico recente</p>
        {history.length === 0
          ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px dashed #27272a' }}>Nenhuma campanha disparada ainda.</div>
          : <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <table className="w-full text-sm">
                <thead style={{ background: '#0a0a0e' }}>
                  <tr className="text-zinc-500 text-[11px] uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5">Hora</th>
                    <th className="text-left px-4 py-2.5">Template</th>
                    <th className="text-right px-4 py-2.5">Total</th>
                    <th className="text-right px-4 py-2.5">Enviados</th>
                    <th className="text-right px-4 py-2.5">Entregues</th>
                    <th className="text-right px-4 py-2.5">Falhas</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((b, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: '#1e1e24' }}>
                      <td className="px-4 py-2.5 text-zinc-400">{b.bucket.replace('T', ' ')}h</td>
                      <td className="px-4 py-2.5 text-white">{b.template}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-300">{b.total}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400">{b.sent}</td>
                      <td className="px-4 py-2.5 text-right text-cyan-400">{b.delivered}</td>
                      <td className="px-4 py-2.5 text-right text-red-400">{b.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>

      {showCustom && (
        <CustomerPicker
          initial={picked}
          onClose={() => setShowCustom(false)}
          onSave={(c) => { setPicked(c); setShowCustom(false) }}
          onError={(m) => onToast(m, 'error')}
        />
      )}

      {confirm && tpl && (
        <ConfirmDialog
          template={tpl}
          override={override}
          count={count ?? 0}
          sending={sending}
          onCancel={() => setConfirm(false)}
          onConfirm={fire}
        />
      )}

      <style jsx>{`
        .cm-input { width: 100%; padding: 0.5rem 0.75rem; background: #0a0a0e; border: 1px solid #27272a; border-radius: 0.5rem; color: #fafafa; font-size: 0.875rem; outline: none; }
        .cm-input:focus { border-color: #00E5FF; }
      `}</style>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-zinc-400 text-xs mb-1">{label}</p>{children}</div>
}

// ─────────────────────────────────────────────────────────────────────────────

function CustomerPicker({
  initial, onClose, onSave, onError,
}: {
  initial: Customer[]
  onClose: () => void
  onSave: (c: Customer[]) => void
  onError: (m: string) => void
}) {
  const [search, setSearch]   = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked]   = useState<Customer[]>(initial)

  const doSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '20', has_phone: '1' })
      if (q.trim()) params.set('search', q.trim())
      const res = await api<{ data: Customer[] }>(`/customers?${params.toString()}`)
      setResults(res.data ?? [])
    } catch (e) { onError((e as Error).message); setResults([]) }
    setLoading(false)
  }, [onError])

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 250)
    return () => clearTimeout(t)
  }, [search, doSearch])

  function toggle(c: Customer) {
    setPicked(prev => prev.find(p => p.id === c.id) ? prev.filter(p => p.id !== c.id) : [...prev, c])
  }

  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[80vh]" style={{ background: '#111114', border: '1px solid #1e1e24' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-white font-semibold">Selecionar clientes</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>
        <div className="px-6 py-3" style={{ borderBottom: '1px solid #1e1e24' }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nome, phone, CPF..."
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa', outline: 'none' }}
          />
          <p className="text-zinc-500 text-[11px] mt-2">{picked.length} selecionado{picked.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading
            ? <div className="px-4 py-8 text-center text-zinc-500 text-sm">Buscando…</div>
            : results.length === 0
              ? <div className="px-4 py-8 text-center text-zinc-500 text-sm">Nenhum cliente encontrado.</div>
              : results.map(c => {
                  const isP = !!picked.find(p => p.id === c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(c)}
                      className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 hover:bg-zinc-900"
                      style={{ background: isP ? 'rgba(0,229,255,0.05)' : 'transparent' }}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px]`}
                           style={{ borderColor: isP ? '#00E5FF' : '#52525b', background: isP ? '#00E5FF' : 'transparent' }}>
                        {isP && <span style={{ color: '#08323b' }}>✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{c.display_name ?? c.phone}</p>
                        <p className="text-zinc-500 text-xs truncate">{c.phone} {c.cpf && `· ${c.cpf}`}</p>
                      </div>
                    </button>
                  )
                })}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>Cancelar</button>
          <button onClick={() => onSave(picked)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#00E5FF', color: '#08323b' }}>Confirmar ({picked.length})</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ConfirmDialog({
  template, override, count, sending, onCancel, onConfirm,
}: {
  template: MessagingTemplate
  override: string
  count:    number
  sending:  boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <p className="text-white font-semibold">Confirmar envio</p>
        <p className="text-zinc-400 text-sm">
          <span className="text-cyan-400 font-semibold">{count}</span> cliente{count === 1 ? '' : 's'} receberão a mensagem do template <span className="text-white">{template.name}</span>:
        </p>
        <WhatsappBubble message={override.trim() || template.message_body} context={SAMPLE_CONTEXT} />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} disabled={sending} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>Cancelar</button>
          <button onClick={onConfirm} disabled={sending} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: '#00E5FF', color: '#08323b' }}>
            {sending ? 'Enviando…' : `Enviar para ${count}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
