'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useConfirm, useAlert } from '@/components/ui/dialog-provider'
import {
  Phone, Bell, Megaphone, ShieldCheck, Lock, Sparkles, ArrowRight,
  RefreshCw, Check, X, AlertCircle, Wifi, Users, Brain, Send,
  Trash2, Settings, Info, ExternalLink,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type WaPurpose = 'internal_alert' | 'manager_verification' | 'customer_journey' | 'customer_campaign' | 'auth_2fa'
type ChannelKind = 'baileys' | 'cloud_api'

interface AvailableChannel {
  kind:   ChannelKind
  id:     string
  name:   string
  phone:  string | null
  status: string
  detail: string | null
}

interface Assignment {
  id:                 string
  organization_id:    string
  purpose:            WaPurpose
  baileys_channel_id: string | null
  whatsapp_config_id: string | null
  notes:              string | null
  created_at:         string
  updated_at:         string
}

// ── Purposes catalog (UI metadata) ────────────────────────────────────────────

const PURPOSES: Array<{
  key:      WaPurpose
  title:    string
  category: 'internal' | 'customer' | 'security'
  icon:     typeof Bell
  desc:     string
  example:  string
  fallbackPref: ChannelKind  // canal preferido quando não há assignment
}> = [
  {
    key:      'internal_alert',
    title:    'Alertas internos',
    category: 'internal',
    icon:     Brain,
    desc:     'Alertas IA do Intelligence Hub, ads-ai e pricing pra equipe interna',
    example:  'Ruptura iminente de SKU · ROAS baixo · margem crítica · digest diário',
    fallbackPref: 'baileys',
  },
  {
    key:      'manager_verification',
    title:    'Verificação de gestor',
    category: 'security',
    icon:     ShieldCheck,
    desc:     'Código WA de 6 dígitos quando você cadastra um novo gestor IH',
    example:  'Olá Maria! Seu código é: 123456',
    fallbackPref: 'baileys',
  },
  {
    key:      'customer_journey',
    title:    'Jornadas pós-venda',
    category: 'customer',
    icon:     Send,
    desc:     'Mensagens automáticas baseadas em status do pedido (enviado, entregue, etc)',
    example:  'Pedido enviado · Pedido entregue · Pesquisa NPS',
    fallbackPref: 'cloud_api',
  },
  {
    key:      'customer_campaign',
    title:    'Campanhas marketing',
    category: 'customer',
    icon:     Megaphone,
    desc:     'Broadcasts em massa pra clientes (segmentos VIP, churn, novos lançamentos)',
    example:  'Promoção Black Friday · Reativação inativos 90d',
    fallbackPref: 'cloud_api',
  },
  {
    key:      'auth_2fa',
    title:    'Autenticação 2FA',
    category: 'security',
    icon:     Lock,
    desc:     'Códigos de 2 fatores via WhatsApp (sprint futuro)',
    example:  '(em breve)',
    fallbackPref: 'cloud_api',
  },
]

const CATEGORY_META: Record<'internal' | 'customer' | 'security', { color: string; label: string }> = {
  internal: { color: '#a78bfa', label: 'Interno' },
  customer: { color: '#4ade80', label: 'Cliente' },
  security: { color: '#f59e0b', label: 'Segurança' },
}

// ── API ───────────────────────────────────────────────────────────────────────

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
  if (res.status === 204) return null as T
  return res.json()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPhone(p: string | null): string {
  if (!p) return ''
  const d = p.replace(/\D/g, '')
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
  if (d.length === 12) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,8)}-${d.slice(8)}`
  return p
}

function statusColor(status: string) {
  if (['active', 'verified'].includes(status)) return '#4ade80'
  if (status === 'inactive') return '#71717a'
  return '#f59e0b'
}

function channelKindIcon(kind: ChannelKind, size = 11) {
  return kind === 'baileys' ? <Wifi size={size} /> : <ShieldCheck size={size} />
}

function channelKindBadge(kind: ChannelKind) {
  if (kind === 'baileys') return { color: '#60a5fa', label: 'Baileys', bg: 'rgba(96,165,250,0.1)' }
  return { color: '#4ade80', label: 'Cloud API', bg: 'rgba(74,222,128,0.1)' }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WhatsAppRotasPage() {
  const [channels, setChannels]       = useState<AvailableChannel[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [busyPurpose, setBusyPurpose] = useState<WaPurpose | null>(null)
  const confirm = useConfirm()
  const alert   = useAlert()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ch, as] = await Promise.all([
        api<AvailableChannel[]>('/wa-router/assignments/channels'),
        api<Assignment[]>('/wa-router/assignments'),
      ])
      setChannels(ch)
      setAssignments(as)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const assignmentByPurpose = useMemo(() => {
    const m = new Map<WaPurpose, Assignment>()
    for (const a of assignments) m.set(a.purpose, a)
    return m
  }, [assignments])

  // Conta quantos propósitos cada canal está atendendo (pra mostrar nos cards)
  const usageByChannel = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of assignments) {
      const ref = a.baileys_channel_id ?? a.whatsapp_config_id
      if (ref) m.set(ref, (m.get(ref) ?? 0) + 1)
    }
    return m
  }, [assignments])

  async function setRoute(purpose: WaPurpose, channel: AvailableChannel | null) {
    setBusyPurpose(purpose)
    setError(null)
    try {
      if (channel == null) {
        // Clear → DELETE
        await api(`/wa-router/assignments/${purpose}`, { method: 'DELETE' })
        setAssignments(prev => prev.filter(a => a.purpose !== purpose))
      } else {
        const body = channel.kind === 'baileys'
          ? { purpose, baileys_channel_id: channel.id }
          : { purpose, whatsapp_config_id: channel.id }
        const updated = await api<Assignment>('/wa-router/assignments', {
          method: 'POST',
          body: JSON.stringify(body),
        })
        setAssignments(prev => {
          const idx = prev.findIndex(a => a.purpose === purpose)
          if (idx >= 0) {
            const copy = [...prev]; copy[idx] = updated; return copy
          }
          return [...prev, updated]
        })
      }
    } catch (e) {
      await alert({
        title:   'Erro ao salvar rota',
        message: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'danger',
      })
    } finally {
      setBusyPurpose(null)
    }
  }

  async function handleClear(purpose: WaPurpose) {
    const meta = PURPOSES.find(p => p.key === purpose)!
    const ok = await confirm({
      title:        'Limpar rota?',
      message:      `Voltar "${meta.title}" pro fallback automático? O sistema vai escolher um canal disponível conforme a categoria.`,
      confirmLabel: 'Limpar rota',
      variant:      'warning',
    })
    if (!ok) return
    await setRoute(purpose, null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 min-h-full" style={{ background: '#09090b' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        ))}
      </div>
    )
  }

  const noChannels = channels.length === 0

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-zinc-500 text-xs">Configurações</p>
          <h2 className="text-white text-lg font-semibold mt-0.5 inline-flex items-center gap-2">
            <Phone size={16} style={{ color: '#00E5FF' }} />
            Rotas de WhatsApp
          </h2>
          <p className="text-[11px] text-zinc-600 mt-1 max-w-2xl leading-relaxed">
            Configure qual canal WhatsApp envia cada tipo de mensagem.
            Sem rota explícita, o sistema escolhe automaticamente conforme a categoria
            (interno → Baileys gratuito · cliente → Cloud API oficial).
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Empty state — sem canal nenhum */}
      {noChannels && (
        <div className="rounded-2xl p-6 flex items-start gap-3"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertCircle size={18} style={{ color: '#f59e0b', marginTop: 2 }} />
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm">Nenhum canal WhatsApp conectado</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Você precisa conectar pelo menos um canal antes de configurar rotas.
              Tem 2 opções:
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Link href="/dashboard/canais"
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
                style={{ background: 'rgba(96,165,250,0.08)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                <span className="flex items-center gap-1.5"><Wifi size={11} /> Conectar Baileys (grátis)</span>
                <ArrowRight size={11} />
              </Link>
              <Link href="/dashboard/configuracoes/integracoes"
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
                style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                <span className="flex items-center gap-1.5"><ShieldCheck size={11} /> Conectar Cloud API</span>
                <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Status overview */}
      {!noChannels && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatusCard label="Canais conectados" value={channels.length} icon={Wifi} color="#00E5FF" />
          <StatusCard label="Rotas configuradas" value={assignments.length} sub={`de ${PURPOSES.length} propósitos`} icon={Settings} color="#a78bfa" />
          <StatusCard
            label="Baileys (grátis)"
            value={channels.filter(c => c.kind === 'baileys').length}
            icon={Wifi}
            color="#60a5fa"
          />
          <StatusCard
            label="Cloud API (oficial)"
            value={channels.filter(c => c.kind === 'cloud_api').length}
            icon={ShieldCheck}
            color="#4ade80"
          />
        </div>
      )}

      {/* Layout: tabela de propósitos (esquerda) + canais disponíveis (direita) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Propósitos */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Propósitos</h3>
            <div className="flex-1 h-px" style={{ background: '#1e1e24' }} />
          </div>

          {PURPOSES.map(p => {
            const assignment = assignmentByPurpose.get(p.key)
            const channel = assignment
              ? channels.find(c => assignment.baileys_channel_id === c.id || assignment.whatsapp_config_id === c.id)
              : null
            const fallbackChannel = !assignment
              ? channels.find(c => c.kind === p.fallbackPref) ?? channels.find(c => c.status === 'active' || c.status === 'verified')
              : null
            const catMeta = CATEGORY_META[p.category]
            const isLocked = p.key === 'auth_2fa'  // sprint futuro

            return (
              <div key={p.key} className="rounded-2xl p-4 transition-colors"
                style={{ background: '#111114', border: `1px solid ${assignment ? catMeta.color + '33' : '#1e1e24'}` }}>

                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                    style={{ background: `${catMeta.color}1a`, border: `1px solid ${catMeta.color}33` }}>
                    <p.icon size={15} style={{ color: catMeta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-white font-semibold text-sm">{p.title}</h4>
                      <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${catMeta.color}1a`, color: catMeta.color, border: `1px solid ${catMeta.color}33` }}>
                        {catMeta.label}
                      </span>
                      {isLocked && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{ background: '#27272a', color: '#71717a' }}>
                          Em breve
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{p.desc}</p>
                    <p className="text-[10px] text-zinc-700 mt-1 italic">Ex: {p.example}</p>
                  </div>
                </div>

                {/* Channel picker */}
                <div className="space-y-2">
                  {/* Currently assigned ou fallback */}
                  {assignment && channel ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: `${catMeta.color}0d`, border: `1px solid ${catMeta.color}33` }}>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: channelKindBadge(channel.kind).bg, color: channelKindBadge(channel.kind).color }}>
                        {channelKindIcon(channel.kind, 9)}
                        {channelKindBadge(channel.kind).label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-medium truncate">{channel.name}</p>
                        {channel.phone && <p className="text-[10px] text-zinc-500 font-mono">{fmtPhone(channel.phone)}</p>}
                      </div>
                      <button onClick={() => handleClear(p.key)} disabled={busyPurpose === p.key}
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                        style={{ color: '#71717a' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
                        title="Voltar pro fallback automático">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : fallbackChannel ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: '#18181b', border: '1px dashed #27272a' }}>
                      <Sparkles size={11} style={{ color: '#71717a' }} />
                      <p className="text-[11px] text-zinc-500 flex-1">
                        Fallback automático →
                        <span className="text-zinc-300 font-medium ml-1">{fallbackChannel.name}</span>
                        <span className="text-zinc-600 ml-1">({channelKindBadge(fallbackChannel.kind).label})</span>
                      </p>
                    </div>
                  ) : (
                    <div className="px-3 py-2 rounded-lg text-[11px] text-rose-400"
                      style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                      Sem canal disponível pra fallback. Conecte um canal acima.
                    </div>
                  )}

                  {/* Channel options */}
                  {channels.length > 0 && !isLocked && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {channels.map(c => {
                        const isActive = channel?.id === c.id
                        const kbadge = channelKindBadge(c.kind)
                        return (
                          <button key={`${c.kind}-${c.id}`} onClick={() => setRoute(p.key, c)}
                            disabled={busyPurpose === p.key || isActive}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-all disabled:opacity-50"
                            style={{
                              background: isActive ? `${catMeta.color}1a` : '#18181b',
                              color:      isActive ? catMeta.color : '#a1a1aa',
                              border:     `1px solid ${isActive ? catMeta.color + '55' : '#27272a'}`,
                              cursor:     isActive ? 'default' : 'pointer',
                            }}>
                            <span className="inline-flex items-center gap-0.5"
                              style={{ color: kbadge.color }}>
                              {channelKindIcon(c.kind, 10)}
                            </span>
                            <span className="flex-1 truncate text-left font-medium">
                              {c.name}
                            </span>
                            {isActive && <Check size={11} />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Sidebar: canais disponíveis */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Canais disponíveis</h3>
            <div className="flex-1 h-px" style={{ background: '#1e1e24' }} />
          </div>

          {channels.length === 0 ? (
            <div className="rounded-2xl px-4 py-6 text-center text-xs text-zinc-500"
              style={{ background: '#111114', border: '1px dashed #27272a' }}>
              Nenhum canal conectado.
            </div>
          ) : (
            channels.map(c => {
              const usage = usageByChannel.get(c.id) ?? 0
              const kbadge = channelKindBadge(c.kind)
              return (
                <div key={`${c.kind}-${c.id}`} className="rounded-2xl p-4"
                  style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: kbadge.bg, color: kbadge.color, border: `1px solid ${kbadge.color}33` }}>
                      {channelKindIcon(c.kind, 9)}
                      {kbadge.label}
                    </span>
                    <span className="ml-auto text-[10px] font-semibold inline-flex items-center gap-1"
                      style={{ color: statusColor(c.status) }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(c.status) }} />
                      {c.status}
                    </span>
                  </div>
                  <h4 className="text-white text-sm font-semibold truncate">{c.name}</h4>
                  {c.phone && (
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{fmtPhone(c.phone)}</p>
                  )}
                  {c.detail && (
                    <p className="text-[10px] text-zinc-700 mt-1.5">{c.detail}</p>
                  )}
                  <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid #1e1e24' }}>
                    <Users size={10} style={{ color: '#71717a' }} />
                    <span className="text-[10px] text-zinc-600">
                      {usage > 0 ? `${usage} propósito${usage !== 1 ? 's' : ''}` : 'Não atribuído'}
                    </span>
                  </div>
                </div>
              )
            })
          )}

          {/* Help card */}
          <div className="rounded-2xl p-4 space-y-2"
            style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)' }}>
            <h4 className="text-white text-xs font-semibold inline-flex items-center gap-1.5">
              <Info size={11} style={{ color: '#00E5FF' }} />
              Como funciona
            </h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              <strong>Baileys</strong> é grátis (gera QR no canal) mas é não-oficial — risco de banimento se usado pra spam.
              Bom pra alertas internos baixo volume.
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              <strong>Cloud API</strong> é oficial Meta (paga, ~R$ 0,10-0,80/mensagem) — tier verde,
              templates aprovados, escala bem pra marketing massivo.
            </p>
            <p className="text-[10px] text-zinc-600 leading-relaxed pt-1">
              Sem rota explícita, o sistema usa fallback baseado na categoria do propósito.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── StatusCard ────────────────────────────────────────────────────────────────

function StatusCard({ label, value, sub, icon: Icon, color }: {
  label: string
  value: number
  sub?:  string
  icon:  typeof Bell
  color: string
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
        style={{ background: `${color}1a`, border: `1px solid ${color}33` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-zinc-500 truncate">{label}</p>
        <p className="text-xl font-bold mt-0.5" style={{ color }}>{value}</p>
        {sub && <p className="text-[9px] text-zinc-600 truncate">{sub}</p>}
      </div>
    </div>
  )
}
