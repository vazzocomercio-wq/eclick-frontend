'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X, RefreshCw, ExternalLink, Send as SendIcon, CheckCircle2, Eye,
  XCircle, Clock, AlertTriangle, MessageCircle, Package, User as UserIcon,
  ShieldCheck, ShieldOff, ArrowRight,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Tipos ──────────────────────────────────────────────────────────────

interface OrderBlock {
  id:                string
  external_order_id: string
  buyer_name:        string | null
  buyer_doc_number:  string | null
  buyer_doc_type:    string | null
  buyer_email:       string | null
  buyer_phone:       string | null
  product_title:     string | null
  sale_price:        number | null
  sold_at:           string | null
  shipping_status:   string | null
  shipping_id:       string | null
  payment_status:    string | null
}

interface CustomerBlock {
  id:                  string
  display_name:        string | null
  cpf:                 string | null
  phone:               string | null
  email:               string | null
  validated_whatsapp:  boolean
  city:                string | null
  state:               string | null
  enrichment_status:   string | null
  enrichment_quality:  string | null
  enriched_at:         string | null
  enrichment_provider: string | null
}

interface MessageBlock {
  step:            number | null
  template_name:   string | null
  template_kind:   string | null
  channel:         string
  status:          string
  sent_at:         string | null
  delivered_at:    string | null
  read_at:         string | null
  error:           string | null
  message_preview: string
}

interface CommunicationBlock {
  journey_id:         string
  journey_name:       string | null
  ocj_state:          string
  ocj_stopped_reason: string | null
  ocj_last_error:     string | null
  current_step:       number | null
  total_steps:        number | null
  steps_summary: Array<{
    step:          number
    template_name: string | null
    trigger:       string | null
  }>
  messages: MessageBlock[]
}

interface FullDetail {
  order:         OrderBlock
  customer:      CustomerBlock | null
  communication: CommunicationBlock | null
}

// ── Helpers ────────────────────────────────────────────────────────────

function fmtDateTime(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function ago(iso: string | null): string {
  if (!iso) return ''
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1)  return 'agora'
  if (diffMin < 60) return `há ${diffMin}min`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d}d`
  return `há ${Math.floor(d / 30)}m`
}

function fmtCpfMasked(c: string | null): string {
  if (!c) return '—'
  const x = c.replace(/\D/g, '')
  if (x.length !== 11) return c
  return `${x.slice(0, 3)}.***.***-${x.slice(9, 11)}`
}

function fmtPhone(p: string | null): string {
  if (!p) return '—'
  const x = p.replace(/\D/g, '')
  if (x.length === 13 && x.startsWith('55')) return `+55 (${x.slice(2, 4)}) ${x.slice(4, 9)}-${x.slice(9)}`
  if (x.length === 11) return `(${x.slice(0, 2)}) ${x.slice(2, 7)}-${x.slice(7)}`
  return p
}

function fmtBRL(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const OCJ_BADGES: Record<string, { fg: string; label: string }> = {
  pending:            { fg: '#fbbf24', label: 'Pendente' },
  active:             { fg: '#22c55e', label: 'Ativa' },
  blocked_consent:    { fg: '#f97316', label: 'Sem consentimento' },
  blocked_no_contact: { fg: '#ef4444', label: 'Sem contato' },
  paused:             { fg: '#fbbf24', label: 'Pausada' },
  stopped:            { fg: '#f87171', label: 'Parada' },
  completed:          { fg: '#00E5FF', label: 'Concluída' },
  failed:             { fg: '#dc2626', label: 'Falhou' },
}

const PAYMENT_BADGES: Record<string, { fg: string; label: string }> = {
  approved:    { fg: '#22c55e', label: 'Aprovado' },
  pending:     { fg: '#fbbf24', label: 'Pendente' },
  in_process:  { fg: '#fbbf24', label: 'Processando' },
  cancelled:   { fg: '#ef4444', label: 'Cancelado' },
  refunded:    { fg: '#a1a1aa', label: 'Reembolsado' },
  rejected:    { fg: '#ef4444', label: 'Rejeitado' },
}

const SHIPPING_BADGES: Record<string, { fg: string; label: string }> = {
  pending:        { fg: '#fbbf24', label: 'Pendente' },
  ready_to_ship:  { fg: '#00E5FF', label: 'Pronto p/ enviar' },
  shipped:        { fg: '#00E5FF', label: 'Enviado' },
  delivered:      { fg: '#22c55e', label: 'Entregue' },
  cancelled:      { fg: '#ef4444', label: 'Cancelado' },
  not_delivered:  { fg: '#ef4444', label: 'Não entregue' },
}

function badge(map: Record<string, { fg: string; label: string }>, key: string | null) {
  if (!key) return null
  return map[key] ?? { fg: '#a1a1aa', label: key }
}

function StatusIcon({ status }: { status: string }) {
  const sz = 12
  switch (status) {
    case 'sent':      return <SendIcon     size={sz} style={{ color: '#a1a1aa' }} />
    case 'delivered': return <CheckCircle2 size={sz} style={{ color: '#22c55e' }} />
    case 'read':      return <Eye          size={sz} style={{ color: '#00E5FF' }} />
    case 'failed':    return <XCircle      size={sz} style={{ color: '#ef4444' }} />
    case 'pending':   return <Clock        size={sz} style={{ color: '#fbbf24' }} />
    default:          return <Clock        size={sz} style={{ color: '#71717a' }} />
  }
}

function statusLabel(s: string): string {
  return ({ sent: 'enviado', delivered: 'entregue', read: 'lida', failed: 'falhou', pending: 'pendente' } as Record<string, string>)[s] ?? s
}

function triggerLabel(t: string | null): string {
  if (!t) return 'sem gatilho'
  return ({
    immediate:        'imediato',
    status_change_ml: 'quando ML mudar status',
    time_offset:      'após delay',
    delay:            'após delay',
  } as Record<string, string>)[t] ?? t
}

// ── Skeleton (loading) ─────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl p-5 animate-pulse" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
      <div className="h-3 w-32 rounded bg-zinc-800 mb-3" />
      <div className="h-3 w-full rounded bg-zinc-800/70 mb-2" />
      <div className="h-3 w-5/6 rounded bg-zinc-800/70 mb-2" />
      <div className="h-3 w-3/5 rounded bg-zinc-800/70" />
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────

export interface OrderDetailDrawerProps {
  /** External order id. `null` mantém o drawer fechado. */
  externalOrderId: string | null
  onClose:         () => void
  getHeaders:      () => Promise<Record<string, string>>
}

/** Drawer lateral premium pra detalhe de pedido. Slide-in 480px da direita
 * (100vw mobile), backdrop blur, ESC fecha, focus trap, body scroll lock,
 * restore focus on close. Fetch /ml/orders/:id/full-detail e renderiza
 * 3 cards: Comunicação (timeline cruzando steps_summary × messages),
 * Pedido (resumo) e Cliente (unificado). Read-only — edição continua
 * no OrderCard inline do modo cards view. */
export function OrderDetailDrawer({ externalOrderId, onClose, getHeaders }: OrderDetailDrawerProps) {
  const [data,    setData]    = useState<FullDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null) // 'not_found' | mensagem livre
  const [mounted, setMounted] = useState(false)
  const [exiting, setExiting] = useState(false)

  const drawerRef     = useRef<HTMLElement | null>(null)
  const closeBtnRef   = useRef<HTMLButtonElement | null>(null)
  const lastActiveRef = useRef<Element | null>(null)
  const titleId       = 'eclick-order-drawer-title'

  // Mount + slide-in / unmount + slide-out coreografados
  useEffect(() => {
    if (externalOrderId) {
      lastActiveRef.current = document.activeElement
      setMounted(true)
      setExiting(false)
      // Focus inicial no botão fechar após render
      requestAnimationFrame(() => closeBtnRef.current?.focus())
    } else if (mounted) {
      setExiting(true)
      const t = setTimeout(() => {
        setMounted(false)
        setExiting(false)
        if (lastActiveRef.current instanceof HTMLElement) {
          lastActiveRef.current.focus()
        }
      }, 200)
      return () => clearTimeout(t)
    }
  }, [externalOrderId, mounted])

  // Body scroll lock
  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mounted])

  // ESC fecha + focus trap (Tab / Shift+Tab dentro do drawer)
  useEffect(() => {
    if (!mounted) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab') return
      const root = drawerRef.current
      if (!root) return
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first  = focusable[0]
      const last   = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      const isInside = !!active && root.contains(active)
      if (!isInside) {
        e.preventDefault()
        first.focus()
        return
      }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mounted, onClose])

  const load = useCallback(async () => {
    if (!externalOrderId) return
    setLoading(true)
    setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(
        `${BACKEND}/ml/orders/${encodeURIComponent(externalOrderId)}/full-detail`,
        { headers },
      )
      if (res.status === 404) { setError('not_found'); setData(null); return }
      if (!res.ok)             throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json as FullDetail)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [externalOrderId, getHeaders])

  useEffect(() => {
    if (externalOrderId) load()
    else { setData(null); setError(null) }
  }, [externalOrderId, load])

  if (!mounted || typeof document === 'undefined') return null

  const order         = data?.order ?? null
  const customer      = data?.customer ?? null
  const communication = data?.communication ?? null

  const messagesByStep = new Map<number, MessageBlock>()
  if (communication) {
    for (const m of communication.messages) {
      if (m.step != null) messagesByStep.set(m.step, m)
    }
  }
  const ocjB     = communication ? badge(OCJ_BADGES, communication.ocj_state) : null
  const payB     = order        ? badge(PAYMENT_BADGES,  order.payment_status)  : null
  const shipB    = order        ? badge(SHIPPING_BADGES, order.shipping_status) : null
  const headerTitle = order ? `Pedido #${order.external_order_id}` : (externalOrderId ? `Pedido #${externalOrderId}` : 'Pedido')

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 transition-opacity"
        style={{
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          opacity: exiting ? 0 : 1,
          transitionDuration: exiting ? '200ms' : '250ms',
          transitionTimingFunction: exiting ? 'ease-in' : 'ease-out',
        }}
      />

      {/* Panel */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        className="absolute top-0 right-0 bottom-0 flex flex-col"
        style={{
          width: '480px',
          maxWidth: '100vw',
          background: '#0a0a0c',
          borderLeft: '1px solid #1a1a1f',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.55)',
          transform: exiting ? 'translateX(100%)' : 'translateX(0)',
          opacity:   exiting ? 0 : 1,
          transition: exiting
            ? 'transform 200ms ease-in, opacity 200ms ease-in'
            : 'transform 250ms ease-out, opacity 250ms ease-out',
          animation: exiting ? undefined : 'eclick-drawer-in 250ms ease-out',
        }}
      >
        {/* Header sticky */}
        <header className="shrink-0 px-4 pt-3 pb-3"
          style={{ background: '#0a0a0c', borderBottom: '1px solid #1a1a1f' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p id={titleId} className="text-sm font-mono text-zinc-100 truncate">{headerTitle}</p>
              {order?.buyer_name && (
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{order.buyer_name}</p>
              )}
              {ocjB && (
                <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{ background: `${ocjB.fg}1a`, color: ocjB.fg, border: `1px solid ${ocjB.fg}33` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ocjB.fg }} />
                  {ocjB.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={load} disabled={loading} aria-label="Recarregar"
                className="p-1.5 rounded-md transition-colors disabled:opacity-40"
                style={{ color: '#a1a1aa' }}
                onMouseOver={e => (e.currentTarget.style.color = '#00E5FF')}
                onMouseOut={e => (e.currentTarget.style.color = '#a1a1aa')}
                title="Recarregar">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button ref={closeBtnRef} onClick={onClose} aria-label="Fechar (Esc)"
                className="p-1.5 rounded-md transition-colors"
                style={{ color: '#a1a1aa' }}
                onMouseOver={e => (e.currentTarget.style.color = '#fff')}
                onMouseOut={e => (e.currentTarget.style.color = '#a1a1aa')}
                title="Fechar (Esc)">
                <X size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
          {loading && (
            <>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </>
          )}

          {!loading && error === 'not_found' && (
            <div className="rounded-xl p-5" style={{ background: '#1a0a0a', border: '1px solid rgba(248,113,113,0.3)' }}>
              <p className="text-sm text-zinc-100 font-medium">Pedido não encontrado</p>
              <p className="text-xs text-zinc-500 mt-1">O pedido pode ter sido removido ou nunca foi sincronizado.</p>
            </div>
          )}

          {!loading && error && error !== 'not_found' && (
            <div className="rounded-xl p-5" style={{ background: '#1a0a0a', border: '1px solid rgba(248,113,113,0.3)' }}>
              <p className="text-sm" style={{ color: '#f87171' }}>Falha ao carregar: {error}</p>
              <button onClick={load} className="mt-2 text-xs underline" style={{ color: '#f87171' }}>
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* ── 📨 Comunicação ─────────────────────────── */}
              <section>
                <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <MessageCircle size={11} style={{ color: '#00E5FF' }} /> Comunicação
                </h2>

                {!communication ? (
                  <div className="rounded-xl p-5" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                    <p className="text-sm text-zinc-500">Sem jornada de comunicação ativa.</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {customer ? 'OCJ é criado pelo CC-1 quando o cliente é enriquecido.'
                                : 'Aguardando unificação do cliente via CPF.'}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl p-5 space-y-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                    <div>
                      <p className="text-sm text-zinc-100 font-medium truncate">{communication.journey_name ?? 'Jornada'}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Progresso: <span className="text-zinc-200 font-mono">
                          {communication.current_step ?? 0} / {communication.total_steps ?? '—'}
                        </span>
                      </p>
                      {communication.total_steps && communication.total_steps > 0 && (
                        <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: '#1a1a1f' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, ((communication.current_step ?? 0) / communication.total_steps) * 100)}%`,
                              background: '#00E5FF',
                            }} />
                        </div>
                      )}
                    </div>

                    {communication.ocj_stopped_reason && (
                      <div className="rounded p-2 text-[11px] flex items-start gap-1.5"
                        style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                        <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                        <span>{communication.ocj_stopped_reason}</span>
                      </div>
                    )}

                    {communication.ocj_last_error && (
                      <div className="rounded p-2 text-[11px]"
                        style={{ background: 'rgba(220,38,38,0.08)', color: '#fca5a5', border: '1px solid rgba(220,38,38,0.3)' }}>
                        <span className="font-semibold">Último erro:</span> {communication.ocj_last_error}
                      </div>
                    )}

                    {/* Timeline vertical */}
                    <ol className="relative" style={{ paddingLeft: '14px' }}>
                      {communication.steps_summary.map((s, idx) => {
                        const msg       = messagesByStep.get(s.step)
                        const isCurrent = communication.current_step === s.step && !msg
                        const isLast    = idx === communication.steps_summary.length - 1
                        const dotColor =
                          msg?.status === 'failed'    ? '#ef4444' :
                          msg?.status === 'pending'   ? '#fbbf24' :
                          msg                          ? '#00E5FF' :
                          isCurrent                    ? 'transparent' :
                                                         '#27272a'
                        const dotBorder = isCurrent ? '2px solid #00E5FF' : 'none'
                        const sentAt = msg?.read_at ?? msg?.delivered_at ?? msg?.sent_at ?? null
                        return (
                          <li key={s.step} className="relative pl-4 pb-3 last:pb-0">
                            {!isLast && (
                              <span className="absolute top-3 bottom-0 left-1 w-px" style={{ background: '#1f1f24' }} />
                            )}
                            <span className="absolute left-0 top-1.5 w-3 h-3 rounded-full"
                              style={{ background: dotColor, border: dotBorder, boxSizing: 'border-box' }} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs text-zinc-100 font-medium truncate">
                                  {s.template_name ?? '(sem template)'}
                                  {msg && <span className="text-zinc-500 font-normal"> ({msg.channel})</span>}
                                </p>
                                {msg && <StatusIcon status={msg.status} />}
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-0.5">
                                {msg
                                  ? <>{statusLabel(msg.status)}{sentAt && ` · ${ago(sentAt)}`}</>
                                  : <>— aguardando trigger: {triggerLabel(s.trigger)}</>}
                              </p>
                              {msg?.message_preview && (
                                <p className="text-[11px] text-zinc-400 mt-1 italic line-clamp-2">
                                  &ldquo;{msg.message_preview}{msg.message_preview.length >= 100 && '…'}&rdquo;
                                </p>
                              )}
                              {msg?.error && (
                                <p className="text-[10px] mt-1" style={{ color: '#fca5a5' }}>
                                  Erro: {msg.error}
                                </p>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                )}
              </section>

              {/* ── 📦 Pedido ──────────────────────────────── */}
              {order && (
                <section>
                  <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Package size={11} style={{ color: '#00E5FF' }} /> Pedido
                  </h2>
                  <div className="rounded-xl p-5 space-y-2" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                    <div>
                      <p className="text-sm text-zinc-100 line-clamp-2">{order.product_title ?? '—'}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 font-mono">{fmtBRL(order.sale_price)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] pt-2"
                      style={{ borderTop: '1px solid #1a1a1f' }}>
                      <div>
                        <p className="text-zinc-500">Vendido em</p>
                        <p className="text-zinc-200">{fmtDateTime(order.sold_at)}</p>
                        {order.sold_at && <p className="text-zinc-600 text-[10px]">{ago(order.sold_at)}</p>}
                      </div>
                      <div>
                        <p className="text-zinc-500">Pagamento</p>
                        {payB ? (
                          <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: `${payB.fg}1a`, color: payB.fg, border: `1px solid ${payB.fg}33` }}>
                            {payB.label}
                          </span>
                        ) : <p className="text-zinc-500">—</p>}
                      </div>
                      <div>
                        <p className="text-zinc-500">Entrega</p>
                        {shipB ? (
                          <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: `${shipB.fg}1a`, color: shipB.fg, border: `1px solid ${shipB.fg}33` }}>
                            {shipB.label}
                          </span>
                        ) : <p className="text-zinc-500">—</p>}
                      </div>
                      <div>
                        <p className="text-zinc-500">Rastreio</p>
                        <p className="text-zinc-200 font-mono text-[10px]">{order.shipping_id ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ── 👤 Cliente ─────────────────────────────── */}
              <section>
                <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <UserIcon size={11} style={{ color: '#00E5FF' }} /> Cliente
                </h2>
                {!customer ? (
                  <div className="rounded-xl p-5" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                    <p className="text-sm text-zinc-500">Cliente ainda não unificado.</p>
                    <p className="text-xs text-zinc-600 mt-1">A unificação ocorre via CPF após o enrichment.</p>
                  </div>
                ) : (
                  <div className="rounded-xl p-5 space-y-2" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                    <p className="text-sm text-zinc-100 font-medium">{customer.display_name ?? '—'}</p>
                    <div className="text-[11px] space-y-1">
                      <p>
                        <span className="text-zinc-500">CPF: </span>
                        <span className="text-zinc-200 font-mono">{fmtCpfMasked(customer.cpf)}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <span className="text-zinc-500">WhatsApp: </span>
                        <span className="text-zinc-200 font-mono">{fmtPhone(customer.phone)}</span>
                        {customer.phone && (
                          customer.validated_whatsapp
                            ? <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: '#22c55e' }}>
                                <ShieldCheck size={11} /> validado
                              </span>
                            : <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: '#71717a' }}>
                                <ShieldOff size={11} /> não é WA
                              </span>
                        )}
                      </p>
                      <p>
                        <span className="text-zinc-500">Email: </span>
                        <span className="text-zinc-200 truncate">{customer.email ?? '—'}</span>
                      </p>
                      <p>
                        <span className="text-zinc-500">Localização: </span>
                        <span className="text-zinc-200">
                          {customer.city || customer.state
                            ? `${customer.city ?? ''}${customer.city && customer.state ? ', ' : ''}${customer.state ?? ''}`
                            : '—'}
                        </span>
                      </p>
                      <p>
                        <span className="text-zinc-500">Enriquecimento: </span>
                        <span className="text-zinc-200">
                          {customer.enrichment_status ?? '—'}
                          {customer.enrichment_quality && <span className="text-zinc-500"> · {customer.enrichment_quality}</span>}
                          {customer.enrichment_provider && <span className="text-zinc-500"> · {customer.enrichment_provider}</span>}
                        </span>
                        {customer.enriched_at && (
                          <span className="text-zinc-600 ml-1">{ago(customer.enriched_at)}</span>
                        )}
                      </p>
                    </div>
                    <a href={`/dashboard/crm/clientes/${customer.id}`}
                      className="inline-flex items-center gap-1 text-[11px] mt-2"
                      style={{ color: '#00E5FF' }}>
                      Ver perfil completo <ArrowRight size={11} />
                    </a>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Footer sticky */}
        <footer className="shrink-0 px-4 py-3 flex items-center justify-between gap-2"
          style={{ background: '#0a0a0c', borderTop: '1px solid #1a1a1f' }}>
          {order ? (
            <a href={`https://www.mercadolibre.com.br/orders/${order.external_order_id}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#00E5FF' }}>
              Ver no ML <ExternalLink size={11} />
            </a>
          ) : <span />}
          <button disabled
            className="text-xs px-3 py-1.5 rounded-md cursor-not-allowed"
            style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#52525b' }}
            title="Em breve">
            Reenviar última
          </button>
        </footer>
      </aside>

      <style>{`
        @keyframes eclick-drawer-in {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
