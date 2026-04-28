'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import { WhatsappBubble } from './WhatsappBubble'
import { MessagingTemplate } from './types'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`[${res.status}] ${body?.message ?? body?.error ?? 'erro'}`)
  }
  return (await res.json()) as T
}

type SendStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read'

interface MessagingSend {
  id:              string
  organization_id: string
  template_id:     string | null
  channel:         string
  phone:           string
  customer_id:     string | null
  order_id:        string | null
  message_body:    string
  status:          SendStatus
  sent_at:         string | null
  delivered_at:    string | null
  read_at:         string | null
  error:           string | null
  created_at:      string
}

const STATUS_LABEL: Record<SendStatus, string> = {
  pending:   'Pendente',
  sent:      'Enviado',
  delivered: 'Entregue',
  read:      'Lido',
  failed:    'Falhou',
}
const STATUS_COLOR: Record<SendStatus, { bg: string; fg: string }> = {
  pending:   { bg: 'rgba(161,161,170,0.1)', fg: '#a1a1aa' },
  sent:      { bg: 'rgba(96,165,250,0.1)',  fg: '#60a5fa' },
  delivered: { bg: 'rgba(52,211,153,0.1)',  fg: '#34d399' },
  read:      { bg: 'rgba(0,229,255,0.1)',   fg: '#00E5FF' },
  failed:    { bg: 'rgba(248,113,113,0.1)', fg: '#f87171' },
}

const PAGE_SIZE = 25

export function SendsTab({ onToast }: { onToast: (m: string, type?: 'success'|'error') => void }) {
  const [list, setList]           = useState<MessagingSend[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [loading, setLoading]     = useState(true)
  const [templates, setTemplates] = useState<MessagingTemplate[]>([])
  const [filterStatus, setFilterStatus] = useState<SendStatus | ''>('')
  const [filterTpl, setFilterTpl]       = useState('')
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')
  const [drawer, setDrawer]             = useState<MessagingSend | null>(null)

  useEffect(() => {
    api<MessagingTemplate[]>('/messaging/templates').then(setTemplates).catch(() => { /* ignore */ })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
      if (filterStatus) params.set('status', filterStatus)
      if (filterFrom)   params.set('from', new Date(filterFrom).toISOString())
      if (filterTo)     params.set('to', new Date(filterTo + 'T23:59:59').toISOString())
      const res = await api<{ items: MessagingSend[]; total: number }>(`/messaging/sends?${params.toString()}`)
      let items = res.items ?? []
      // Filtro de template é frontend-side (backend só aceita journey_id)
      if (filterTpl) items = items.filter(s => s.template_id === filterTpl)
      setList(items)
      setTotal(res.total ?? 0)
    } catch (e) { onToast((e as Error).message, 'error') }
    setLoading(false)
  }, [page, filterStatus, filterFrom, filterTo, filterTpl, onToast])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tplMap = new Map(templates.map(t => [t.id, t.name]))

  return (
    <>
      <p className="text-zinc-400 text-sm mb-4">Histórico de todos os envios. Click na linha pra ver detalhes.</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as SendStatus | ''); setPage(0) }} className="se-input">
          <option value="">Todos status</option>
          {(Object.keys(STATUS_LABEL) as SendStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={filterTpl} onChange={e => { setFilterTpl(e.target.value); setPage(0) }} className="se-input">
          <option value="">Todos templates</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(0) }} className="se-input" />
        <input type="date" value={filterTo}   onChange={e => { setFilterTo(e.target.value); setPage(0) }}   className="se-input" />
        {(filterStatus || filterTpl || filterFrom || filterTo) && (
          <button onClick={() => { setFilterStatus(''); setFilterTpl(''); setFilterFrom(''); setFilterTo(''); setPage(0) }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      {loading
        ? <div className="h-48 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        : list.length === 0
          ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px dashed #27272a' }}>Nenhum envio.</div>
          : <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <table className="w-full text-sm">
                <thead style={{ background: '#0a0a0e' }}>
                  <tr className="text-zinc-500 text-[11px] uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5">Data</th>
                    <th className="text-left px-4 py-2.5">Cliente</th>
                    <th className="text-left px-4 py-2.5">Telefone</th>
                    <th className="text-left px-4 py-2.5">Template</th>
                    <th className="text-left px-4 py-2.5">Canal</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(s => {
                    const c = STATUS_COLOR[s.status]
                    return (
                      <tr key={s.id} onClick={() => setDrawer(s)}
                        className="border-t cursor-pointer hover:bg-zinc-900"
                        style={{ borderColor: '#1e1e24' }}>
                        <td className="px-4 py-2.5 text-zinc-400">{fmtDate(s.created_at)}</td>
                        <td className="px-4 py-2.5 text-zinc-300">{s.customer_id ? s.customer_id.slice(0, 8) + '…' : '—'}</td>
                        <td className="px-4 py-2.5 text-zinc-300 font-mono text-xs">{s.phone}</td>
                        <td className="px-4 py-2.5 text-white">{s.template_id ? (tplMap.get(s.template_id) ?? '?') : '—'}</td>
                        <td className="px-4 py-2.5 text-zinc-400">{s.channel}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.fg }}>
                            {STATUS_LABEL[s.status]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>}

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-zinc-500 text-xs">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </p>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-40"
              style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>Anterior</button>
            <span className="px-3 py-1.5 text-zinc-500 text-xs">{page + 1} / {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-40"
              style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>Próxima</button>
          </div>
        </div>
      )}

      {drawer && <SendDrawer send={drawer} onClose={() => setDrawer(null)} tplName={drawer.template_id ? tplMap.get(drawer.template_id) ?? null : null} />}

      <style jsx>{`
        .se-input {
          padding: 0.4rem 0.7rem; background: #0a0a0e; border: 1px solid #27272a;
          border-radius: 0.5rem; color: #fafafa; font-size: 0.8125rem; outline: none;
        }
        .se-input:focus { border-color: #00E5FF; }
      `}</style>
    </>
  )
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// ─────────────────────────────────────────────────────────────────────────────

function SendDrawer({ send, onClose, tplName }: { send: MessagingSend; onClose: () => void; tplName: string | null }) {
  if (typeof window === 'undefined') return null
  const c = STATUS_COLOR[send.status]
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md h-full overflow-y-auto p-6 space-y-4" style={{ background: '#0a0a0e', borderLeft: '1px solid #1e1e24' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-white font-semibold">Detalhes do envio</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.fg }}>
            {STATUS_LABEL[send.status]}
          </span>
          <span className="text-zinc-500 text-xs">{send.channel}</span>
        </div>

        <Section label="Mensagem">
          <WhatsappBubble message={send.message_body} />
        </Section>

        <Section label="Telefone">
          <p className="text-white text-sm font-mono">{send.phone}</p>
        </Section>

        {send.customer_id && (
          <Section label="Cliente">
            <a href={`/dashboard/atendente-ia/clientes?id=${send.customer_id}`} className="text-cyan-400 text-sm underline">
              {send.customer_id}
            </a>
          </Section>
        )}

        {send.order_id && (
          <Section label="Pedido">
            <p className="text-zinc-300 text-sm font-mono">{send.order_id}</p>
          </Section>
        )}

        {tplName && (
          <Section label="Template">
            <p className="text-zinc-300 text-sm">{tplName}</p>
          </Section>
        )}

        <div className="space-y-2">
          <Stamp label="Criado em"   value={send.created_at} />
          <Stamp label="Enviado em"  value={send.sent_at} />
          <Stamp label="Entregue em" value={send.delivered_at} />
          <Stamp label="Lido em"     value={send.read_at} />
        </div>

        {send.error && (
          <Section label="Erro">
            <div className="rounded-lg p-3 text-red-400 text-xs font-mono" style={{ background: '#1a0a0a', border: '1px solid rgba(248,113,113,0.3)' }}>
              {send.error}
            </div>
          </Section>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-zinc-500 text-[11px] uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  )
}

function Stamp({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300 font-mono">{value ? fmtDate(value) : '—'}</span>
    </div>
  )
}
