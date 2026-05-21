'use client'

/**
 * Avaliações — admin UI da Loja Própria (Z3).
 *
 * Fila de moderação de reviews. 3 status: pendente / aprovada / rejeitada.
 * Cada review tem:
 *   - estrelas + título + texto + fotos
 *   - identificação do cliente + produto
 *   - botões aprovar / rejeitar / responder / remover
 *
 * Settings drawer: auto_approve, min_body_chars, max_photos,
 * hide_customer_full_name.
 *
 * Endpoints:
 *   GET    /reviews?status=&productId=
 *   GET    /reviews/stats
 *   GET    /reviews/settings
 *   PUT    /reviews/settings
 *   PUT    /reviews/:id/approve
 *   PUT    /reviews/:id/reject  { reason? }
 *   PUT    /reviews/:id/reply   { text }
 *   DELETE /reviews/:id
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  MessageSquare, Loader2, ChevronLeft, Star, Check, X, Trash2,
  AlertCircle, Settings, Reply, Filter,
} from 'lucide-react'
import Link from 'next/link'
import { useAlert } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Review {
  id:               string
  product_id:       string
  customer_id:      string
  order_id:         string | null
  rating:           number
  title:            string | null
  body:             string
  photos:           Array<{ url: string }>
  status:           'pending' | 'approved' | 'rejected'
  store_reply:      string | null
  store_reply_at:   string | null
  helpful_count:    number
  approved_at:      string | null
  rejected_at:      string | null
  rejection_reason: string | null
  auto_approved:    boolean
  created_at:       string
  product?:         { id: string; name: string; photo_urls: string[] | null }
  customer?:        { id: string; name: string; email: string }
}

interface Stats {
  pending:    number
  approved:   number
  rejected:   number
  total:      number
  avg_overall: number | null
}

interface Settings {
  auto_approve:            boolean
  min_body_chars:          number
  max_photos:              number
  ask_after_days:          number
  hide_customer_full_name: boolean
  invite_enabled:          boolean
}

type StatusFilter = '' | 'pending' | 'approved' | 'rejected'

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pendente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  approved: { label: 'Aprovada',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  rejected: { label: 'Rejeitada', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats]     = useState<Stats | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [filter, setFilter]   = useState<StatusFilter>('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const headers = { Authorization: `Bearer ${token}` }
      const params = new URLSearchParams({ limit: '100' })
      if (filter) params.set('status', filter)
      const [listRes, statsRes, setRes] = await Promise.all([
        fetch(`${BACKEND}/reviews?${params}`, { headers }),
        fetch(`${BACKEND}/reviews/stats`, { headers }),
        fetch(`${BACKEND}/reviews/settings`, { headers }),
      ])
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`)
      const list = await listRes.json()
      setReviews(list.items ?? [])
      if (statsRes.ok) setStats(await statsRes.json())
      if (setRes.ok)   setSettings(await setRes.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchToken, filter])

  useEffect(() => { void load() }, [load])

  const callAction = async (id: string, action: 'approve' | 'reject' | 'reply' | 'delete', payload?: Record<string, unknown>) => {
    const token = await fetchToken()
    const url = action === 'delete' ? `${BACKEND}/reviews/${id}` : `${BACKEND}/reviews/${id}/${action}`
    const init: RequestInit = {
      method: action === 'delete' ? 'DELETE' : 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    }
    const res = await fetch(url, init)
    if (!res.ok) {
      const e = await res.json().catch(() => null)
      throw new Error(e?.message ?? `HTTP ${res.status}`)
    }
    await load()
  }

  const saveSettings = async (next: Settings) => {
    const token = await fetchToken()
    const res = await fetch(`${BACKEND}/reviews/settings`, {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(next),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => null)
      throw new Error(e?.message ?? `HTTP ${res.status}`)
    }
    setSettings(await res.json())
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
              <MessageSquare size={24} /> Avaliações
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Modere as avaliações dos seus clientes · responda em público pra mostrar atenção
            </p>
          </div>
          <button onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: '#18181b', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}>
            <Settings size={14} /> Configurações
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pendentes" value={stats.pending} color="#f59e0b" />
          <StatCard label="Aprovadas" value={stats.approved} color="#22c55e" />
          <StatCard label="Rejeitadas" value={stats.rejected} color="#ef4444" />
          <StatCard label="Média geral" value={stats.avg_overall ? `${stats.avg_overall.toFixed(2)}★` : '–'} color="#fbbf24" />
        </div>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-zinc-500" />
        <FilterChip label="Todas"      value=""          current={filter} onClick={setFilter} />
        <FilterChip label="Pendentes"  value="pending"   current={filter} onClick={setFilter} count={stats?.pending} />
        <FilterChip label="Aprovadas"  value="approved"  current={filter} onClick={setFilter} count={stats?.approved} />
        <FilterChip label="Rejeitadas" value="rejected"  current={filter} onClick={setFilter} count={stats?.rejected} />
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </p>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">
          <Loader2 className="animate-spin inline-block" size={20} />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <MessageSquare size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">
            {filter ? `Nenhuma avaliação ${STATUS_LABEL[filter]?.label.toLowerCase() ?? filter}` : 'Nenhuma avaliação ainda'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <ReviewRow key={r.id} review={r} onAction={callAction} />
          ))}
        </div>
      )}

      {showSettings && settings && (
        <SettingsDrawer
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={async (next) => { await saveSettings(next); setShowSettings(false) }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg p-4"
      style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <p className="text-xs uppercase tracking-wide font-medium" style={{ color: '#71717a' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}

function FilterChip({ label, value, current, onClick, count }: {
  label: string; value: StatusFilter; current: StatusFilter; onClick: (v: StatusFilter) => void; count?: number
}) {
  const active = current === value
  return (
    <button onClick={() => onClick(value)}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
      style={{
        background: active ? '#00E5FF' : '#0a0a0e',
        color: active ? '#0a0a0e' : '#fafafa',
        border: `1px solid ${active ? '#00E5FF' : '#27272a'}`,
        minHeight: 36,
      }}>
      {label}
      {typeof count === 'number' && count > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{
            background: active ? 'rgba(10,10,14,0.2)' : '#27272a',
            color: active ? '#0a0a0e' : '#fafafa',
          }}>{count}</span>
      )}
    </button>
  )
}

function ReviewRow({ review, onAction }: {
  review: Review
  onAction: (id: string, action: 'approve' | 'reject' | 'reply' | 'delete', payload?: Record<string, unknown>) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState(review.store_reply ?? '')
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const showAlert = useAlert()

  const wrap = (action: string, fn: () => Promise<void>) => async () => {
    setBusy(action)
    try {
      await fn()
    } catch (e) {
      await showAlert({ title: 'Não deu certo', message: (e as Error).message, variant: 'danger' })
    } finally {
      setBusy(null)
    }
  }

  const status = STATUS_LABEL[review.status] ?? { label: review.status, color: '#a1a1aa', bg: '#27272a' }

  return (
    <div className="rounded-lg p-4"
      style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <div className="flex items-start gap-3">
        {/* Foto do produto */}
        {review.product?.photo_urls?.[0] && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={review.product.photo_urls[0]} alt=""
            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
        )}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: status.bg, color: status.color, border: `1px solid ${status.color}40` }}>
                {status.label}
              </span>
              {review.auto_approved && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ background: '#27272a', color: '#a1a1aa' }}>auto</span>
              )}
              <span className="text-xs" style={{ color: '#71717a' }}>
                {new Date(review.created_at).toLocaleDateString('pt-BR')} ·{' '}
                {review.customer?.name ?? 'Cliente'} ({review.customer?.email})
              </span>
            </div>
          </div>

          {/* Produto */}
          {review.product && (
            <p className="text-xs mb-2" style={{ color: '#a1a1aa' }}>
              Produto: <strong style={{ color: '#fafafa' }}>{review.product.name}</strong>
            </p>
          )}

          {/* Conteúdo */}
          <div className="flex items-center gap-1 mb-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={14}
                fill={i < review.rating ? '#fbbf24' : 'none'}
                stroke={i < review.rating ? '#fbbf24' : '#52525b'} />
            ))}
            <span className="text-xs ml-1" style={{ color: '#a1a1aa' }}>{review.rating}/5</span>
          </div>
          {review.title && (
            <h3 className="text-sm font-bold mb-1" style={{ color: '#fafafa' }}>{review.title}</h3>
          )}
          <p className="text-sm mb-2 whitespace-pre-wrap" style={{ color: '#d4d4d8', lineHeight: 1.5 }}>
            {review.body}
          </p>
          {review.photos.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {review.photos.map((p, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} src={p.url} alt=""
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, border: '1px solid #27272a' }} />
              ))}
            </div>
          )}

          {/* Resposta existente */}
          {review.store_reply && !replying && (
            <div className="mt-3 p-3 rounded"
              style={{ background: 'rgba(0,229,255,0.05)', borderLeft: '3px solid #00E5FF' }}>
              <div className="text-[10px] uppercase font-bold mb-1" style={{ color: '#00E5FF' }}>
                Sua resposta · {review.store_reply_at && new Date(review.store_reply_at).toLocaleDateString('pt-BR')}
              </div>
              <p className="text-xs whitespace-pre-wrap" style={{ color: '#fafafa' }}>{review.store_reply}</p>
            </div>
          )}

          {/* Form resposta */}
          {replying && (
            <div className="mt-3 space-y-2">
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                rows={3} placeholder="Sua resposta (visível na vitrine)"
                style={{
                  width: '100%', padding: '8px 10px', minHeight: 72,
                  background: '#18181b', color: '#fafafa',
                  border: '1px solid #27272a', borderRadius: 6,
                  fontSize: 13, resize: 'vertical',
                }} />
              <div className="flex gap-2">
                <button onClick={wrap('reply', async () => { await onAction(review.id, 'reply', { text: replyText }); setReplying(false) })}
                  disabled={!replyText.trim() || busy === 'reply'}
                  className="text-xs font-semibold px-3 py-2 rounded inline-flex items-center gap-1 disabled:opacity-50"
                  style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 36 }}>
                  {busy === 'reply' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Enviar
                </button>
                <button onClick={() => setReplying(false)}
                  className="text-xs px-3 py-2 rounded"
                  style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', minHeight: 36 }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Form rejeitar */}
          {rejectMode && (
            <div className="mt-3 space-y-2 p-3 rounded"
              style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                rows={2} placeholder="Motivo (opcional, interno)"
                style={{
                  width: '100%', padding: '8px 10px', minHeight: 56,
                  background: '#0a0a0e', color: '#fafafa',
                  border: '1px solid #27272a', borderRadius: 6,
                  fontSize: 12, resize: 'vertical',
                }} />
              <div className="flex gap-2">
                <button onClick={wrap('reject', async () => { await onAction(review.id, 'reject', { reason: rejectReason }); setRejectMode(false); setRejectReason('') })}
                  disabled={busy === 'reject'}
                  className="text-xs font-semibold px-3 py-2 rounded inline-flex items-center gap-1 disabled:opacity-50"
                  style={{ background: '#ef4444', color: '#fff', minHeight: 36 }}>
                  {busy === 'reject' ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                  Confirmar rejeitar
                </button>
                <button onClick={() => { setRejectMode(false); setRejectReason('') }}
                  className="text-xs px-3 py-2 rounded"
                  style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', minHeight: 36 }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Ações */}
          {!replying && !rejectMode && (
            <div className="flex flex-wrap gap-2 mt-3">
              {review.status !== 'approved' && (
                <button onClick={wrap('approve', () => onAction(review.id, 'approve'))} disabled={busy !== null}
                  className="text-xs font-semibold px-3 py-2 rounded inline-flex items-center gap-1 disabled:opacity-50"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', minHeight: 36 }}>
                  {busy === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Aprovar
                </button>
              )}
              {review.status !== 'rejected' && (
                <button onClick={() => setRejectMode(true)} disabled={busy !== null}
                  className="text-xs font-semibold px-3 py-2 rounded inline-flex items-center gap-1 disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.05)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', minHeight: 36 }}>
                  <X size={12} />
                  Rejeitar
                </button>
              )}
              <button onClick={() => { setReplying(true); setReplyText(review.store_reply ?? '') }}
                disabled={busy !== null}
                className="text-xs font-semibold px-3 py-2 rounded inline-flex items-center gap-1 disabled:opacity-50"
                style={{ background: '#18181b', color: '#fafafa', border: '1px solid #27272a', minHeight: 36 }}>
                <Reply size={12} />
                {review.store_reply ? 'Editar resposta' : 'Responder'}
              </button>
              <button onClick={wrap('delete', () => onAction(review.id, 'delete'))} disabled={busy !== null}
                className="text-xs font-semibold px-3 py-2 rounded inline-flex items-center gap-1 disabled:opacity-50"
                style={{ background: 'transparent', color: '#71717a', border: '1px solid #27272a', minHeight: 36 }}>
                {busy === 'delete' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Remover
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingsDrawer({ settings, onClose, onSave }: {
  settings: Settings
  onClose: () => void
  onSave: (next: Settings) => Promise<void>
}) {
  const [draft, setDraft] = useState<Settings>(settings)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setBusy(true); setErr(null)
    try { await onSave(draft) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#0d0d10', border: '1px solid #27272a', borderRadius: 12,
          width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto',
        }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#27272a' }}>
          <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2">
            <Settings size={14} /> Configurações de avaliações
          </h2>
          <button onClick={onClose} aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: 4, minWidth: 32, minHeight: 32 }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <ToggleField label="Aprovar automaticamente" hint="Novas avaliações ficam visíveis na hora, sem moderação."
            value={draft.auto_approve}
            onChange={v => setDraft(d => ({ ...d, auto_approve: v }))} />

          <ToggleField label="Esconder sobrenome do cliente" hint='Mostra "Maria S." em vez do nome completo (LGPD-friendly).'
            value={draft.hide_customer_full_name}
            onChange={v => setDraft(d => ({ ...d, hide_customer_full_name: v }))} />

          <NumberField label="Mínimo de caracteres no texto" min={0} max={500}
            value={draft.min_body_chars}
            onChange={v => setDraft(d => ({ ...d, min_body_chars: v }))} />

          <NumberField label="Máximo de fotos por avaliação" min={0} max={10}
            value={draft.max_photos}
            onChange={v => setDraft(d => ({ ...d, max_photos: v }))} />

          <ToggleField label="Convidar cliente a avaliar (WhatsApp pós-entrega)"
            hint="Cron diário (11h) manda WhatsApp depois de N dias da entrega convidando pra avaliar."
            value={draft.invite_enabled}
            onChange={v => setDraft(d => ({ ...d, invite_enabled: v }))} />

          <NumberField label="Enviar o convite quantos dias após a entrega" min={0} max={60}
            hint="Tempo de espera depois que o pedido vira 'entregue'. Padrão 3 dias."
            value={draft.ask_after_days}
            onChange={v => setDraft(d => ({ ...d, ask_after_days: v }))} />

          {err && (
            <p className="text-xs" style={{ color: '#f87171' }}>⚠ {err}</p>
          )}
        </div>
        <div className="p-4 border-t flex gap-2 justify-end" style={{ borderColor: '#27272a' }}>
          <button onClick={onClose}
            className="text-sm px-4 py-2 rounded"
            style={{ background: 'transparent', color: '#a1a1aa', border: '1px solid #27272a', minHeight: 40 }}>
            Cancelar
          </button>
          <button onClick={save} disabled={busy}
            className="text-sm font-semibold px-4 py-2 rounded inline-flex items-center gap-2 disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#0a0a0e', minHeight: 40 }}>
            {busy && <Loader2 size={12} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function ToggleField({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        {hint && <p className="text-[11px] mt-0.5" style={{ color: '#71717a' }}>{hint}</p>}
      </div>
      <button onClick={() => onChange(!value)}
        role="switch" aria-checked={value}
        style={{
          width: 44, height: 24, borderRadius: 12,
          background: value ? '#00E5FF' : '#27272a',
          border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
          transition: 'background 150ms',
        }}>
        <span style={{
          position: 'absolute', top: 2,
          left: value ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fafafa', transition: 'left 150ms', display: 'block',
        }} />
      </button>
    </div>
  )
}

function NumberField({ label, hint, value, min, max, onChange }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1">{label}</label>
      <input type="number" value={value} min={min} max={max}
        onChange={e => onChange(parseInt(e.target.value, 10) || 0)}
        style={{
          width: '100%', padding: '8px 12px', minHeight: 40,
          background: '#18181b', color: '#fafafa',
          border: '1px solid #27272a', borderRadius: 6,
          fontSize: 14,
        }} />
      {hint && <p className="text-[11px] mt-1" style={{ color: '#71717a' }}>{hint}</p>}
    </div>
  )
}
