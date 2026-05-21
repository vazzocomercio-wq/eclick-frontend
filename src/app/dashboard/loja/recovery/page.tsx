'use client'

/**
 * Recovery de Carrinho — admin UI (AB1).
 *
 * Lista os carrinhos abandonados rastreados pelo backend. Cada row
 * mostra cliente + itens + status + ações. Cron envia WhatsApp via
 * Active bridge depois de N minutos (configurável). Settings:
 *   - enabled (liga/desliga)
 *   - minutes_after (quando dispara)
 *   - ttl_hours (após quanto tempo expira sem enviar)
 *   - message_template (custom — opcional)
 *
 * Endpoints:
 *   GET    /cart-recovery               ?status=
 *   GET    /cart-recovery/settings
 *   PUT    /cart-recovery/settings
 *   POST   /cart-recovery/:id/send-now
 *   POST   /cart-recovery/:id/dismiss
 *   POST   /cart-recovery/run-tick      (debug — dispara cron)
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  ShoppingCart, Loader2, ChevronLeft, Send, X, Settings, AlertCircle,
  Phone, Mail, Clock, CheckCircle2, RefreshCcw, Trash2, Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useConfirm, useAlert } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Cart {
  id:                 string
  store_slug:         string
  customer_id:        string | null
  customer_phone:     string | null
  customer_email:     string | null
  customer_name:      string | null
  items:              Array<{ productId: string; name: string; price: number; qty: number; imageUrl?: string }>
  subtotal:           number
  items_count:        number
  status:             'active' | 'sent_reminder' | 'recovered' | 'expired' | 'dismissed'
  last_activity_at:   string
  reminder_sent_at:   string | null
  recovered_order_id: string | null
  recovered_at:       string | null
  created_at:         string
  updated_at:         string
}

interface Stats {
  active:        number
  sent_reminder: number
  recovered:     number
  expired:       number
  recovery_rate: number
}

interface Settings {
  enabled:           boolean
  minutes_after:     number
  ttl_hours:         number
  message_template:  string
}

type StatusFilter = '' | 'active' | 'sent_reminder' | 'recovered' | 'expired' | 'dismissed'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:        { label: 'Aguardando',  color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  sent_reminder: { label: 'Lembrete enviado', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  recovered:     { label: 'Recuperado',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  expired:       { label: 'Expirado',     color: '#71717a', bg: 'rgba(113,113,122,0.1)' },
  dismissed:     { label: 'Descartado',   color: '#52525b', bg: 'rgba(82,82,91,0.1)' },
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatRel = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

export default function RecoveryPage() {
  const [carts, setCarts] = useState<Cart[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const confirm = useConfirm()
  const showAlert = useAlert()

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
      const [listRes, setRes] = await Promise.all([
        fetch(`${BACKEND}/cart-recovery?${params}`, { headers }),
        fetch(`${BACKEND}/cart-recovery/settings`, { headers }),
      ])
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`)
      const list = await listRes.json()
      setCarts(list.items ?? [])
      setStats(list.stats ?? null)
      if (setRes.ok) setSettings(await setRes.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchToken, filter])

  useEffect(() => { void load() }, [load])

  const sendNow = async (cartId: string) => {
    const ok = await confirm({
      title:        'Enviar lembrete agora',
      message:      'Vou disparar WhatsApp pra este cliente agora mesmo, sem esperar o cron. Útil pra recuperar pedidos quentes.',
      confirmLabel: 'Enviar',
    })
    if (!ok) return
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/cart-recovery/${cartId}/send-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.sent) {
        await showAlert({ message: '✅ WhatsApp enviado!', variant: 'info' })
      } else {
        await showAlert({
          message: `Não consegui enviar: ${data.reason ?? 'erro desconhecido'}.`
                 + (data.reason === 'bridge_not_configured' ? ' Configure a integração Active primeiro.' : ''),
          variant: 'warning',
        })
      }
      await load()
    } catch (e) {
      await showAlert({ message: (e as Error).message, variant: 'danger' })
    }
  }

  const dismiss = async (cartId: string) => {
    const ok = await confirm({
      title:        'Descartar carrinho',
      message:      'Marca o carrinho como descartado — não vai mais aparecer na fila nem receber lembrete. O cliente pode criar um novo a qualquer momento.',
      confirmLabel: 'Descartar',
      variant:      'warning',
    })
    if (!ok) return
    try {
      const token = await fetchToken()
      await fetch(`${BACKEND}/cart-recovery/${cartId}/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      await load()
    } catch (e) {
      await showAlert({ message: (e as Error).message, variant: 'danger' })
    }
  }

  const runTick = async () => {
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/cart-recovery/run-tick`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      await showAlert({
        title: 'Cron executado',
        message: `Enviados: ${data.sent}, expirados: ${data.expired}, ignorados: ${data.skipped}`,
        variant: 'info',
      })
      await load()
    } catch (e) {
      await showAlert({ message: (e as Error).message, variant: 'danger' })
    }
  }

  const saveSettings = async (next: Settings) => {
    const token = await fetchToken()
    const res = await fetch(`${BACKEND}/cart-recovery/settings`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
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
              <ShoppingCart size={24} /> Recovery de carrinho
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Clientes que deixaram itens no carrinho recebem WhatsApp pra finalizar
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={runTick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a', minHeight: 44 }}
              title="Roda o cron agora pra debug">
              <RefreshCcw size={14} /> Rodar agora
            </button>
            <button onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#18181b', color: '#fafafa', border: '1px solid #27272a', minHeight: 44 }}>
              <Settings size={14} /> Configurações
            </button>
          </div>
        </div>
      </div>

      {/* Banner se está desabilitado */}
      {settings && !settings.enabled && (
        <div className="p-4 rounded-lg flex items-start gap-3"
          style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <AlertCircle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Recovery está desligado</p>
            <p className="text-xs mt-1" style={{ color: '#a1a1aa' }}>
              Carrinhos estão sendo rastreados, mas nenhum WhatsApp será enviado até você habilitar.
            </p>
          </div>
          <button onClick={() => setShowSettings(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded"
            style={{ background: '#f59e0b', color: '#000', minHeight: 36 }}>
            Habilitar
          </button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Aguardando"    value={stats.active} color="#06b6d4" />
          <StatCard label="Lembrete enviado" value={stats.sent_reminder} color="#f59e0b" />
          <StatCard label="Recuperados"   value={stats.recovered} color="#22c55e" />
          <StatCard label="Expirados"     value={stats.expired} color="#71717a" />
          <StatCard label="Taxa de recuperação" value={`${stats.recovery_rate}%`} color="#a78bfa" />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip label="Todos"        value=""              current={filter} onClick={setFilter} />
        <FilterChip label="Aguardando"   value="active"        current={filter} onClick={setFilter} count={stats?.active} />
        <FilterChip label="Lembrete"     value="sent_reminder" current={filter} onClick={setFilter} count={stats?.sent_reminder} />
        <FilterChip label="Recuperados"  value="recovered"     current={filter} onClick={setFilter} count={stats?.recovered} />
        <FilterChip label="Expirados"    value="expired"       current={filter} onClick={setFilter} count={stats?.expired} />
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
      ) : carts.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <ShoppingCart size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">
            {filter ? 'Nenhum carrinho neste status' : 'Nenhum carrinho abandonado ainda'}
          </p>
          <p className="text-xs mt-2" style={{ color: '#52525b' }}>
            O tracking acontece quando o cliente preenche telefone ou email no checkout.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {carts.map(c => (
            <CartRow key={c.id} cart={c} onSendNow={sendNow} onDismiss={dismiss} />
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

function CartRow({ cart, onSendNow, onDismiss }: {
  cart: Cart
  onSendNow: (id: string) => Promise<void>
  onDismiss: (id: string) => Promise<void>
}) {
  const meta = STATUS_META[cart.status] ?? { label: cart.status, color: '#a1a1aa', bg: '#27272a' }
  return (
    <div className="rounded-lg p-4"
      style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}>
            {meta.label}
          </span>
          <span className="text-sm font-semibold text-white truncate">
            {cart.customer_name ?? 'Cliente'}
          </span>
        </div>
        <span className="text-xs" style={{ color: '#71717a' }}>
          Atualizado {formatRel(cart.updated_at)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3 text-xs" style={{ color: '#a1a1aa' }}>
        {cart.customer_phone && (
          <span className="inline-flex items-center gap-1"><Phone size={11} /> {cart.customer_phone}</span>
        )}
        {cart.customer_email && (
          <span className="inline-flex items-center gap-1"><Mail size={11} /> {cart.customer_email}</span>
        )}
      </div>

      {/* Items */}
      <div className="rounded p-3 mb-3" style={{ background: '#18181b' }}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs font-semibold uppercase" style={{ color: '#71717a' }}>
            {cart.items_count} {cart.items_count === 1 ? 'item' : 'itens'}
          </span>
          <span className="text-base font-bold" style={{ color: '#00E5FF' }}>{brl(cart.subtotal)}</span>
        </div>
        <ul className="space-y-1 text-xs" style={{ color: '#d4d4d8' }}>
          {cart.items.slice(0, 5).map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="font-mono" style={{ color: '#71717a' }}>{it.qty}×</span>
              <span className="truncate flex-1">{it.name}</span>
              <span style={{ color: '#a1a1aa' }}>{brl(it.price * it.qty)}</span>
            </li>
          ))}
          {cart.items.length > 5 && (
            <li className="text-[11px]" style={{ color: '#71717a' }}>...e mais {cart.items.length - 5}</li>
          )}
        </ul>
      </div>

      {/* Timeline */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px]" style={{ color: '#71717a' }}>
        <span className="inline-flex items-center gap-1">
          <Clock size={10} /> Carrinho de {formatRel(cart.last_activity_at)}
        </span>
        {cart.reminder_sent_at && (
          <span className="inline-flex items-center gap-1" style={{ color: '#f59e0b' }}>
            <Send size={10} /> Lembrete {formatRel(cart.reminder_sent_at)}
          </span>
        )}
        {cart.recovered_at && (
          <span className="inline-flex items-center gap-1" style={{ color: '#22c55e' }}>
            <CheckCircle2 size={10} /> Recuperado {formatRel(cart.recovered_at)}
          </span>
        )}
      </div>

      {/* Ações */}
      {(cart.status === 'active' || cart.status === 'sent_reminder') && cart.customer_phone && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onSendNow(cart.id)}
            className="text-xs font-semibold px-3 py-2 rounded inline-flex items-center gap-1"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', minHeight: 36 }}>
            <Send size={12} /> {cart.status === 'sent_reminder' ? 'Enviar de novo' : 'Enviar agora'}
          </button>
          <button onClick={() => onDismiss(cart.id)}
            className="text-xs px-3 py-2 rounded inline-flex items-center gap-1"
            style={{ background: 'transparent', color: '#71717a', border: '1px solid #27272a', minHeight: 36 }}>
            <X size={12} /> Descartar
          </button>
        </div>
      )}
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

  const insertTemplate = (tpl: string) => setDraft(d => ({ ...d, message_template: tpl }))

  const DEFAULT_PREVIEW = [
    'Oi, Maria! 👋',
    '',
    'Vimos que você deixou alguns produtos no carrinho da *Loja XYZ*:',
    '',
    '• 2× Vestido Floral',
    '• 1× Sapato Preto',
    '',
    '💰 Total: *R$ 247,90*',
    '',
    'Que tal finalizar? 🛒',
    'https://eclick.app.br/loja/...',
  ].join('\n')

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: '#0d0d10', border: '1px solid #27272a', borderRadius: 12,
          width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto',
        }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#27272a' }}>
          <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2">
            <Settings size={14} /> Recovery de carrinho
          </h2>
          <button onClick={onClose} aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: 4, minWidth: 32, minHeight: 32 }}>
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <ToggleField label="Habilitar recovery automático"
            hint="Quando ligado, o WhatsApp é enviado pelo cron a cada 15 min."
            value={draft.enabled}
            onChange={v => setDraft(d => ({ ...d, enabled: v }))} />

          <NumberField label="Esperar quantos minutos depois do último update do carrinho"
            min={5} max={1440} step={5}
            value={draft.minutes_after}
            onChange={v => setDraft(d => ({ ...d, minutes_after: v }))}
            hint="Mínimo 5 min, máximo 24h. Padrão 30 min." />

          <NumberField label="Expirar carrinho depois de quantas horas"
            min={1} max={720}
            value={draft.ttl_hours}
            onChange={v => setDraft(d => ({ ...d, ttl_hours: v }))}
            hint="Carrinhos antigos viram 'expired' sem enviar. Padrão 72h." />

          <div>
            <label className="block text-sm font-medium text-white mb-1">Mensagem custom (opcional)</label>
            <textarea value={draft.message_template} onChange={e => setDraft(d => ({ ...d, message_template: e.target.value }))}
              rows={6} placeholder="Deixe vazio pra usar a mensagem padrão (mostrada abaixo)"
              style={{
                width: '100%', padding: '8px 10px', minHeight: 120,
                background: '#18181b', color: '#fafafa',
                border: '1px solid #27272a', borderRadius: 6,
                fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
              }} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => insertTemplate('')}
                className="text-[11px] px-2 py-1 rounded"
                style={{ background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46', minHeight: 28 }}>
                Usar padrão
              </button>
              <button type="button" onClick={() => insertTemplate(DEFAULT_PREVIEW)}
                className="text-[11px] px-2 py-1 rounded inline-flex items-center gap-1"
                style={{ background: 'rgba(0,229,255,0.05)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)', minHeight: 28 }}>
                <Sparkles size={10} /> Copiar padrão pra editar
              </button>
            </div>
            <p className="text-[11px] mt-2" style={{ color: '#71717a' }}>
              Placeholders disponíveis: <code style={{ color: '#00E5FF' }}>{'{{name}}'}</code>{' '}
              <code style={{ color: '#00E5FF' }}>{'{{store}}'}</code>{' '}
              <code style={{ color: '#00E5FF' }}>{'{{items}}'}</code>{' '}
              <code style={{ color: '#00E5FF' }}>{'{{subtotal}}'}</code>{' '}
              <code style={{ color: '#00E5FF' }}>{'{{link}}'}</code>
            </p>
          </div>

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

function NumberField({ label, hint, value, min, max, step, onChange }: { label: string; hint?: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1">{label}</label>
      <input type="number" value={value} min={min} max={max} step={step ?? 1}
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
