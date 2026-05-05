'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  X, Phone, Mail, ShoppingBag, MessageSquare, Star, Edit3, ExternalLink,
  Tag, Clock, AlertCircle, DollarSign, Repeat, Calendar,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UnifiedCustomer {
  id:               string
  display_name:     string | null
  phone:            string | null
  email:            string | null
  whatsapp_id:      string | null
  ml_buyer_id:      string | null
  shopee_buyer_id:  string | null
  city:             string | null
  state:            string | null
  tags:             string[]
  notes:            string | null
  total_purchases:  number
  total_conversations: number
  first_contact_at: string
  last_contact_at:  string
  last_channel:     string | null
  // Métricas vindas do customer-hub (algumas tabs já têm parcial)
  ltv_score?:        number | null
  avg_ticket?:       number | null
  abc_curve?:        'A' | 'B' | 'C' | null
  churn_risk?:       'low' | 'medium' | 'high' | 'critical' | null
  rfm_score?:        number | null
  rfm_recency_days?: number | null
  last_purchase_at?: string | null
}

const CHURN_META: Record<NonNullable<UnifiedCustomer['churn_risk']>, { color: string; label: string }> = {
  low:      { color: '#34d399', label: 'Baixo' },
  medium:   { color: '#facc15', label: 'Médio' },
  high:     { color: '#f97316', label: 'Alto' },
  critical: { color: '#f87171', label: 'Crítico' },
}

const CURVE_META: Record<'A' | 'B' | 'C', { color: string }> = {
  A: { color: '#34d399' },
  B: { color: '#facc15' },
  C: { color: '#a1a1aa' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()
  if (!token) throw new Error('Sessão expirada')
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`)
  }
  return res.json()
}

function fmtBRL(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtPhoneBR(p: string | null | undefined) {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
  if (d.length === 12) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  return p
}
function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d}d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

// ── Drawer ────────────────────────────────────────────────────────────────────

/**
 * Drawer reusável de detalhes de cliente. Pode ser aberto a partir de
 * qualquer tab do Customer Hub passando o customerId. O drawer faz fetch
 * dos detalhes completos via /customers/:id e mescla com `seed` (o subset
 * já em mãos, ex: ChurnRiskCustomer) pra renderização imediata enquanto o
 * fetch completa.
 *
 * Ações disponíveis:
 *   - Toggle VIP (PATCH /customers/bulk pra reusar bulk endpoint)
 *   - Reativar via WhatsApp (deeplink /messaging com phone do customer)
 *   - Ver pedidos (deeplink /pedidos com customer_id)
 *   - Editar perfil (deeplink /crm/clientes pra view full)
 */
export default function CustomerDetailDrawer({
  customerId,
  seed,
  onClose,
  onChange,
}: {
  customerId: string
  seed?: Partial<UnifiedCustomer>
  onClose: () => void
  onChange?: (c: Partial<UnifiedCustomer>) => void
}) {
  const router = useRouter()
  const [customer, setCustomer] = useState<Partial<UnifiedCustomer> | null>(seed ?? null)
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const full = await api<UnifiedCustomer>(`/customers/${customerId}`)
        if (cancelled) return
        // Merge: prioriza dados do fetch (mais frescos), mas mantém seed
        // pros campos que /customers/:id não retorna (ltv_score, rfm, etc)
        setCustomer(prev => ({ ...prev, ...full }))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [customerId])

  // ESC fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function toggleVip() {
    if (!customer) return
    setBusy(true)
    setError(null)
    const newVip = !customer.tags?.includes('vip')
    try {
      await api(`/customers/bulk`, {
        method: 'PATCH',
        body: JSON.stringify({ customer_ids: [customerId], is_vip: newVip }),
      })
      const newTags = newVip
        ? [...(customer.tags ?? []), 'vip']
        : (customer.tags ?? []).filter(t => t !== 'vip')
      setCustomer(prev => prev ? { ...prev, tags: newTags } : prev)
      onChange?.({ tags: newTags })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar VIP')
    } finally {
      setBusy(false)
    }
  }

  function handleReativacao() {
    const phone = customer?.phone
    router.push(`/dashboard/messaging${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`)
  }

  if (!customer) {
    return (
      <div className="fixed inset-0 z-50 flex" onClick={onClose}>
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />
        <div className="absolute right-0 top-0 h-full w-full sm:w-[480px] flex items-center justify-center"
          style={{ background: '#0c0c0e', borderLeft: '1px solid #27272a' }}>
          <div className="text-zinc-500 text-sm">Carregando…</div>
        </div>
      </div>
    )
  }

  const isVip = customer.tags?.includes('vip') ?? false
  const churnMeta = customer.churn_risk ? CHURN_META[customer.churn_risk] : null
  const curveMeta = customer.abc_curve ? CURVE_META[customer.abc_curve] : null

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />
      <div className="absolute top-0 right-0 h-full w-full sm:w-[480px] overflow-y-auto"
        style={{ background: '#0c0c0e', borderLeft: '1px solid #27272a' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true">

        {/* Header sticky */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-start gap-3"
          style={{ background: '#0c0c0e', borderBottom: '1px solid #1e1e24' }}>
          <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-base font-bold"
            style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
            {(customer.display_name ?? customer.phone ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-base truncate">
              {customer.display_name ?? '(sem nome)'}
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
              ID {customerId.slice(0, 8)}
              {isVip && <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full"
                style={{ background: 'rgba(250,204,21,0.12)', color: '#facc15' }}>
                <Star size={9} fill="currentColor" /> VIP
              </span>}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg transition-colors shrink-0"
            style={{ color: '#71717a' }}
            aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="px-3 py-2 rounded-lg text-xs"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Contato */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">Contato</p>
            <div className="rounded-lg overflow-hidden" style={{ background: '#18181b', border: '1px solid #27272a' }}>
              <DetailRow icon={Phone} label="Telefone" value={fmtPhoneBR(customer.phone)} />
              {customer.email && <DetailRow icon={Mail} label="Email" value={customer.email} />}
              {customer.last_channel && <DetailRow icon={MessageSquare} label="Último canal" value={customer.last_channel} />}
              {(customer.city || customer.state) && (
                <DetailRow icon={ExternalLink} label="Localização" value={[customer.city, customer.state].filter(Boolean).join(' · ')} />
              )}
            </div>
          </div>

          {/* Métricas (se vier do hub) */}
          {(customer.ltv_score != null || customer.abc_curve || customer.churn_risk) && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">Métricas</p>
              <div className="grid grid-cols-2 gap-2">
                {customer.ltv_score != null && (
                  <Stat icon={DollarSign} label="LTV" value={fmtBRL(customer.ltv_score)} color="#00E5FF" />
                )}
                {customer.avg_ticket != null && (
                  <Stat icon={ShoppingBag} label="Ticket médio" value={fmtBRL(customer.avg_ticket)} color="#34d399" />
                )}
                {curveMeta && (
                  <Stat icon={Tag} label="Curva ABC" value={customer.abc_curve!} color={curveMeta.color} />
                )}
                {churnMeta && (
                  <Stat icon={AlertCircle} label="Churn risk" value={churnMeta.label} color={churnMeta.color} />
                )}
              </div>
            </div>
          )}

          {/* Atividade */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">Atividade</p>
            <div className="rounded-lg overflow-hidden" style={{ background: '#18181b', border: '1px solid #27272a' }}>
              <DetailRow icon={Repeat}   label="Pedidos totais"  value={String(customer.total_purchases ?? 0)} />
              <DetailRow icon={Calendar} label="Último pedido"   value={customer.last_purchase_at ? timeAgo(customer.last_purchase_at) : '—'} />
              {customer.rfm_recency_days != null && (
                <DetailRow icon={Clock}  label="Sem comprar há"  value={`${customer.rfm_recency_days}d`} />
              )}
              <DetailRow icon={MessageSquare} label="Conversas"  value={String(customer.total_conversations ?? 0)} />
            </div>
          </div>

          {/* Tags */}
          {customer.tags && customer.tags.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {customer.tags.map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                    style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {customer.notes && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">Notas</p>
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap"
                style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: 10 }}>
                {customer.notes}
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid #1e1e24' }}>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1 mt-2">Ações</p>
            <button onClick={toggleVip} disabled={busy}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
              style={{
                background: isVip ? 'rgba(250,204,21,0.08)' : '#18181b',
                color:      isVip ? '#facc15' : '#a1a1aa',
                border:     `1px solid ${isVip ? 'rgba(250,204,21,0.3)' : '#27272a'}`,
              }}>
              <Star size={12} fill={isVip ? 'currentColor' : 'none'} />
              {isVip ? 'Remover VIP' : 'Marcar como VIP'}
            </button>
            <button onClick={handleReativacao}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
              <MessageSquare size={12} />
              Iniciar conversa no WhatsApp
            </button>
            <Link href={`/dashboard/crm/clientes?id=${customerId}`}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
              <Edit3 size={12} />
              Editar no CRM
            </Link>
            <Link href={`/dashboard/pedidos?customer_id=${customerId}`}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
              <ShoppingBag size={12} />
              Ver pedidos
            </Link>
          </div>

          {loading && (
            <p className="text-[10px] text-zinc-700 text-center pt-2">Carregando dados completos…</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailRow({ icon: Icon, label, value }: {
  icon: typeof Phone; label: string; value: string
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 text-xs">
      <Icon size={11} className="text-zinc-600 shrink-0" />
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="ml-auto text-zinc-200 truncate max-w-[60%] text-right">{value}</span>
    </div>
  )
}

function Stat({ icon: Icon, label, value, color }: {
  icon: typeof Phone; label: string; value: string; color: string
}) {
  return (
    <div className="rounded-lg p-2.5"
      style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-1.5">
        <Icon size={10} style={{ color }} />
        <span className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</span>
      </div>
      <p className="text-sm font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  )
}
