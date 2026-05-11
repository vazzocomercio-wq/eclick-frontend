'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, CheckCircle2, ExternalLink,
  Clock, ShieldAlert, X, MessageSquare, Send, AlertCircle,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type ClaimPlayer = { role: string; user_id: number; available_actions?: string[] }

type Claim = {
  id:             string | number
  resource_id?:   string | number
  reason?:        { id?: string; label?: string } | null
  reason_id?:     string | null
  reason_name?:   string | null
  status?:        string
  type?:          string
  stage?:         string
  date_created?:  string
  last_updated?:  string
  players?:       ClaimPlayer[]
  resolution?:    { reason?: string } | null
}

type ClaimDetail = {
  due_date?:           string | null
  action_responsible?: string | null
  title?:              string | null
  description?:        string | null
  problem?:            string | null
} | null

type ClaimMessage = {
  id?:              string | number
  sender_role?:     string
  receiver_role?:   string
  message?:         string
  text?:            string
  date_created?:    string
  date?:            string
  attachments?:     Array<{ name?: string; url?: string }>
  stage?:           string
}

type FilterKey = 'all' | 'opened' | 'closed'

// ── Helpers ───────────────────────────────────────────────────────────────────

const REASON_LABEL: Record<string, string> = {
  PNR:  'Produto não recebido',
  PDD:  'Produto danificado/defeituoso',
  PNDA: 'Produto não conforme com o anúncio',
  WP:   'Produto errado enviado',
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  opened:   { label: 'Aberta',    color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  closed:   { label: 'Fechada',   color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  resolved: { label: 'Resolvida', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  appealed: { label: 'Apelada',   color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
}

const TYPE_LABEL: Record<string, string> = {
  mediations: 'Mediação',
  return:     'Devolução',
  returns:    'Devolução',
  fulfillment: 'Fulfillment',
  ml_case:    'Caso ML',
  cancel_sale: 'Cancelamento (venda)',
  cancel_purchase: 'Cancelamento (compra)',
  change:     'Troca',
}

const STAGE_LABEL: Record<string, string> = {
  claim:      'Reclamação',
  dispute:    'Disputa',
  mediation:  'Mediação',
}

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  complainant: { label: 'Comprador', color: '#60a5fa' },
  respondent:  { label: 'Você',      color: '#4ade80' },
  mediator:    { label: 'ML',         color: '#facc15' },
  meli:        { label: 'ML',         color: '#facc15' },
}

function getStatusCfg(s?: string) {
  return STATUS_CFG[s ?? ''] ?? { label: s ?? '—', color: '#a1a1aa', bg: 'rgba(161,161,170,0.1)' }
}

function getReasonLabel(claim: Claim): string {
  const id = claim.reason_id ?? claim.reason?.id ?? ''
  // Tenta match exato ou prefixo (PDD9549 → PDD)
  if (REASON_LABEL[id]) return REASON_LABEL[id]
  const prefix = id.match(/^[A-Z]+/)?.[0]
  if (prefix && REASON_LABEL[prefix]) return REASON_LABEL[prefix]
  return claim.reason_name ?? claim.reason?.label ?? id ?? 'Reclamação'
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(s?: string | null) {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function dueDateColor(due?: string | null): string {
  if (!due) return '#71717a'
  const diff = new Date(due).getTime() - Date.now()
  if (diff <= 0)              return '#f87171'   // vencido
  if (diff < 24*60*60*1000)   return '#facc15'   // <24h
  if (diff < 72*60*60*1000)   return '#fb923c'   // <3d
  return '#a1a1aa'
}

// ── Claim card ────────────────────────────────────────────────────────────────

function ClaimCard({ claim, onOpen }: { claim: Claim; onOpen: () => void }) {
  const reasonLbl = getReasonLabel(claim)
  const stCfg     = getStatusCfg(claim.status)
  const buyer     = (claim.players ?? []).find(p => p.role === 'complainant')
  const typeLbl   = claim.type ? (TYPE_LABEL[claim.type] ?? claim.type) : ''
  const stageLbl  = claim.stage ? (STAGE_LABEL[claim.stage] ?? claim.stage) : ''

  return (
    <button onClick={onOpen}
      className="text-left rounded-2xl p-4 space-y-3 transition-all hover:border-zinc-700"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500">#{claim.id}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: stCfg.bg, color: stCfg.color }}>
            {stCfg.label}
          </span>
        </div>
        <span className="text-[10px] text-zinc-600">{timeAgo(claim.last_updated ?? claim.date_created)}</span>
      </div>

      <p className="text-sm text-zinc-200 font-medium leading-tight">{reasonLbl}</p>

      <div className="flex items-center gap-2 flex-wrap text-[10px] text-zinc-500">
        {typeLbl  && <span className="px-1.5 py-0.5 rounded bg-zinc-900">{typeLbl}</span>}
        {stageLbl && <span className="px-1.5 py-0.5 rounded bg-zinc-900">{stageLbl}</span>}
        {buyer && <span>Comprador #{buyer.user_id}</span>}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
        <span className="text-[10px] text-zinc-600">{fmtDate(claim.date_created)}</span>
        <span className="text-[10px] text-[#00E5FF] flex items-center gap-1">
          ver detalhes <MessageSquare size={10} />
        </span>
      </div>
    </button>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function ClaimDrawer({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const [detail,   setDetail]   = useState<ClaimDetail>(null)
  const [messages, setMessages] = useState<ClaimMessage[]>([])
  const [loading,  setLoading]  = useState(true)
  const [reply,    setReply]    = useState('')
  const [sending,  setSending]  = useState(false)
  const [error,    setError]    = useState('')
  const [sent,     setSent]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setLoading(false); return }
    const h = { Authorization: `Bearer ${session.access_token}` }
    try {
      const [dRes, mRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/claims/${claim.id}/detail`, { headers: h }),
        fetch(`${BACKEND}/ml/claims/${claim.id}/messages`, { headers: h }),
      ])
      if (dRes.status === 'fulfilled' && dRes.value.ok) {
        const d = await dRes.value.json()
        setDetail(d as ClaimDetail)
      }
      if (mRes.status === 'fulfilled' && mRes.value.ok) {
        const d = await mRes.value.json()
        setMessages(d?.messages ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [claim.id])

  useEffect(() => { load() }, [load])

  const send = async () => {
    if (!reply.trim() || reply.length < 5) {
      setError('Mensagem precisa ter ao menos 5 caracteres')
      return
    }
    setSending(true)
    setError('')
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const h = { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
      const res = await fetch(`${BACKEND}/ml/claims/${claim.id}/messages`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ receiver_role: 'complainant', message: reply.trim() }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t.slice(0, 200) || `HTTP ${res.status}`)
      }
      setSent(true)
      setReply('')
      // Reload messages
      setTimeout(() => { setSent(false); load() }, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }

  const stCfg     = getStatusCfg(claim.status)
  const reasonLbl = getReasonLabel(claim)
  const typeLbl   = claim.type ? (TYPE_LABEL[claim.type] ?? claim.type) : ''
  const stageLbl  = claim.stage ? (STAGE_LABEL[claim.stage] ?? claim.stage) : ''
  const mlUrl     = claim.resource_id
    ? `https://www.mercadolivre.com.br/vendas/${claim.resource_id}/detalhe`
    : null

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        className="fixed inset-0 bg-black/60 z-40" />
      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[640px] bg-[#0a0a0c] border-l border-[#1e1e24] flex flex-col"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1e1e24] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-mono text-zinc-500">#{claim.id}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: stCfg.bg, color: stCfg.color }}>
                {stCfg.label}
              </span>
              {typeLbl && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">{typeLbl}</span>}
              {stageLbl && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">{stageLbl}</span>}
            </div>
            <p className="text-base font-semibold text-white">{reasonLbl}</p>
            <p className="text-xs text-zinc-500 mt-1">
              Aberta em {fmtDate(claim.date_created)} · Atualizada {timeAgo(claim.last_updated)}
            </p>
            {mlUrl && (
              <a href={mlUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#00E5FF] hover:underline mt-2">
                Abrir venda no ML <ExternalLink size={10} />
              </a>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && <p className="text-xs text-zinc-600 text-center py-8">Carregando…</p>}

          {!loading && detail && (detail.due_date || detail.action_responsible || detail.title || detail.description || detail.problem) && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#0e0e11', border: '1px solid #1e1e24' }}>
              {detail.title && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">Caso</p>
                  <p className="text-sm text-white mt-1">{detail.title}</p>
                </div>
              )}
              {detail.problem && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">Problema</p>
                  <p className="text-sm text-zinc-300 mt-1">{detail.problem}</p>
                </div>
              )}
              {detail.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">Descrição</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600 flex items-center gap-1">
                    <Clock size={9} /> Prazo
                  </p>
                  <p className="text-xs font-semibold mt-1" style={{ color: dueDateColor(detail.due_date) }}>
                    {fmtDate(detail.due_date)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">Responsável</p>
                  <p className="text-xs text-zinc-300 mt-1 capitalize">{detail.action_responsible ?? '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Messages thread */}
          {!loading && (
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">
                Mensagens ({messages.length})
              </p>
              {messages.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">Sem mensagens nesta reclamação ainda.</p>
              ) : (
                messages.map((m, i) => {
                  const role = ROLE_LABEL[m.sender_role ?? ''] ?? { label: m.sender_role ?? '?', color: '#71717a' }
                  const text = m.message ?? m.text ?? ''
                  const date = m.date_created ?? m.date
                  return (
                    <div key={m.id ?? i} className="rounded-lg p-3"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[10px] font-semibold" style={{ color: role.color }}>
                          {role.label}
                        </span>
                        <span className="text-[10px] text-zinc-600">{timeAgo(date)}</span>
                        {m.stage && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500">{STAGE_LABEL[m.stage] ?? m.stage}</span>}
                      </div>
                      <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{text}</p>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.attachments.map((a, j) => (
                            <a key={j} href={a.url ?? '#'} target="_blank" rel="noreferrer"
                              className="text-[10px] text-[#00E5FF] hover:underline px-2 py-0.5 rounded bg-[#00E5FF11]">
                              📎 {a.name ?? 'anexo'}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Send reply (só se aberta) */}
        {(claim.status === 'opened' || !claim.status) && (
          <div className="p-4 border-t border-[#1e1e24] flex-shrink-0 space-y-2">
            <textarea
              value={reply}
              onChange={e => { setReply(e.target.value); setError('') }}
              placeholder="Digite sua resposta ao comprador…"
              maxLength={500}
              disabled={sending || sent}
              className="w-full bg-[#09090b] border border-[#1e1e24] rounded-lg p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E5FF44] resize-y min-h-[80px] disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px]">
                {error && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle size={11} /> {error}
                  </span>
                )}
                {sent && (
                  <span className="flex items-center gap-1 text-green-400">
                    <CheckCircle2 size={11} /> Enviada
                  </span>
                )}
                <span className="text-zinc-600">{reply.length}/500</span>
              </div>
              <button onClick={send} disabled={sending || sent || !reply.trim() || reply.length < 5}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: sending || sent ? '#1e1e24' : 'linear-gradient(135deg, #00E5FF 0%, #00b8cc 100%)',
                  color:      sending || sent ? '#71717a' : '#000',
                }}>
                <Send size={13} />
                {sending ? 'Enviando…' : 'Responder'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReclamacoesPage() {
  const [claims,   setClaims]   = useState<Claim[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<FilterKey>('opened')
  const [selected, setSelected] = useState<Claim | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setLoading(false); return }
    const h = { Authorization: `Bearer ${session.access_token}` }
    try {
      const res = await fetch(`${BACKEND}/ml/claims`, { headers: h })
      if (res.ok) {
        const d = await res.json()
        setClaims(d?.data ?? d ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = claims.filter(c => {
    if (filter === 'all')    return true
    if (filter === 'opened') return (c.status ?? 'opened') === 'opened'
    return (c.status ?? '') !== 'opened'
  })

  const openCount   = claims.filter(c => (c.status ?? 'opened') === 'opened').length
  const closedCount = claims.length - openCount

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: 'var(--background)' }}>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Atendimento</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Reclamações</h2>
          <p className="text-zinc-500 text-xs mt-1">Gerencie reclamações de pós-compra do Mercado Livre.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',    value: claims.length,  color: '#a1a1aa' },
          { label: 'Abertas',  value: openCount,       color: openCount > 0 ? '#f87171' : '#4ade80' },
          { label: 'Fechadas', value: closedCount,     color: '#71717a' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4 space-y-1" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{loading ? '…' : value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {(['all', 'opened', 'closed'] as FilterKey[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              background: filter === f ? 'rgba(0,229,255,0.1)' : 'transparent',
              color:      filter === f ? '#00E5FF' : '#52525b',
              border:     `1px solid ${filter === f ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
            }}>
            {{ all: 'Todas', opened: 'Abertas', closed: 'Fechadas' }[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600 text-xs">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <CheckCircle2 size={32} className="text-green-500" />
          <p className="text-sm text-zinc-400">
            {filter === 'opened' ? 'Nenhuma reclamação aberta' : 'Nenhuma reclamação'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(c => <ClaimCard key={c.id} claim={c} onOpen={() => setSelected(c)} />)}
        </div>
      )}

      {!loading && openCount > 0 && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.12)' }}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={13} className="text-red-400" />
            <p className="text-xs font-semibold text-zinc-300">Dicas para resolução</p>
          </div>
          <ul className="space-y-1 pl-2">
            {[
              'Responda dentro de 48h para evitar penalização na reputação.',
              'Ofereça reembolso ou reenvio antes que o ML intervenha.',
              'Registre o número de protocolo de cada caso resolvido.',
            ].map(tip => (
              <li key={tip} className="text-[11px] text-zinc-500 flex items-start gap-1.5">
                <span className="text-zinc-700 mt-0.5">•</span>{tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && <ClaimDrawer claim={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
