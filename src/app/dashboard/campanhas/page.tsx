'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Megaphone, Sparkles, Pause, Play, Trash2, Plus, X, Settings as SettingsIcon } from 'lucide-react'
import { AI_PROVIDERS } from '@/constants/ai-models'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ────────────────────────────────────────────────────────────────────

type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
type CampaignChannel = 'whatsapp' | 'email' | 'both'
type SegmentType = 'all' | 'vip' | 'with_cpf' | 'custom'

interface Campaign {
  id:               string
  name:             string
  status:           CampaignStatus
  channel:          CampaignChannel
  segment_type:     SegmentType
  segment_filters:  Record<string, unknown> | null
  estimated_reach:  number | null
  scheduled_at:     string | null
  interval_seconds: number
  interval_jitter:  number
  daily_limit:      number
  ab_enabled:       boolean
  ab_split_pct:     number
  product_ids:      string[] | null
  template_a_id:    string | null
  template_b_id:    string | null
  total_targets:    number
  total_sent:       number
  total_delivered:  number
  total_failed:     number
  started_at:       string | null
  completed_at:     string | null
  created_at:       string
  updated_at:       string
}

interface MessagingTemplate {
  id:           string
  name:         string
  channel:      string
  message_body: string
  is_active:    boolean
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

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

// ── Status pill ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CampaignStatus, { fg: string; bg: string; label: string }> = {
  draft:     { fg: '#a1a1aa', bg: 'rgba(161,161,170,0.10)', label: 'Rascunho' },
  scheduled: { fg: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  label: 'Agendada' },
  running:   { fg: '#34d399', bg: 'rgba(52,211,153,0.10)',  label: 'Em andamento' },
  paused:    { fg: '#fb7185', bg: 'rgba(251,113,133,0.10)', label: 'Pausada' },
  completed: { fg: '#00E5FF', bg: 'rgba(0,229,255,0.08)',   label: 'Concluída' },
  cancelled: { fg: '#71717a', bg: 'rgba(113,113,122,0.10)', label: 'Cancelada' },
}

function StatusPill({ s }: { s: CampaignStatus }) {
  const c = STATUS_COLORS[s]
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ color: c.fg, background: c.bg, border: `1px solid ${c.fg}33` }}>
      {c.label}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [editing,    setEditing]    = useState<Campaign | null>(null)
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; type: 'success'|'error' }>>([])

  function pushToast(msg: string, type: 'success'|'error' = 'success') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await api<Campaign[]>('/campaigns')
      setCampaigns(data)
    } catch (e) {
      console.error('[campanhas] load falhou:', e)
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleLaunch(c: Campaign) {
    if (!confirm(`Lançar campanha "${c.name}"? Os disparos serão agendados imediatamente.`)) return
    try {
      const res = await api<{ targets: number; first_at: string | null }>(`/campaigns/${c.id}/launch`, { method: 'POST' })
      pushToast(`Lançada — ${res.targets} alvos agendados`, 'success')
      await load()
    } catch (e) {
      pushToast((e as Error).message, 'error')
    }
  }

  async function handlePause(c: Campaign) {
    try {
      await api(`/campaigns/${c.id}/pause`, { method: 'POST' })
      pushToast('Campanha pausada', 'success')
      await load()
    } catch (e) {
      pushToast((e as Error).message, 'error')
    }
  }

  async function handleResume(c: Campaign) {
    try {
      await api(`/campaigns/${c.id}/resume`, { method: 'POST' })
      pushToast('Campanha retomada', 'success')
      await load()
    } catch (e) {
      pushToast((e as Error).message, 'error')
    }
  }

  async function handleDelete(c: Campaign) {
    if (!confirm(`Deletar campanha "${c.name}"? Os targets também serão removidos.`)) return
    try {
      await api(`/campaigns/${c.id}`, { method: 'DELETE' })
      pushToast('Deletada', 'success')
      await load()
    } catch (e) {
      pushToast((e as Error).message, 'error')
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-lg font-semibold flex items-center gap-2">
              <Megaphone size={18} style={{ color: '#00E5FF' }} />
              Campanhas
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Disparo em massa com agendamento, A/B test e anti-detecção (jitter + rate limit + daily cap).
            </p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowWizard(true) }}
            className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
            style={{ background: '#00E5FF', color: '#08323b' }}
          >
            <Plus size={14} />
            Nova campanha
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {error && (
          <div className="rounded-lg p-3 text-sm mb-4"
            style={{ background:'rgba(239,68,68,0.10)', color:'#f87171', border:'1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-zinc-500 text-sm">Carregando…</div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl px-8 py-16 text-center"
            style={{ background: '#111114', border: '1px dashed #27272a' }}>
            <Megaphone size={32} className="mx-auto mb-3" style={{ color: '#52525b' }} />
            <p className="text-white font-medium mb-1">Nenhuma campanha ainda</p>
            <p className="text-zinc-500 text-sm mb-4">Crie sua primeira campanha pra disparar mensagens em massa.</p>
            <button
              onClick={() => { setEditing(null); setShowWizard(true) }}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: '#00E5FF', color: '#08323b' }}
            >
              Criar campanha
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map(c => (
              <CampaignCard
                key={c.id}
                c={c}
                onLaunch={() => handleLaunch(c)}
                onPause={() => handlePause(c)}
                onResume={() => handleResume(c)}
                onEdit={() => { setEditing(c); setShowWizard(true) }}
                onDelete={() => handleDelete(c)}
              />
            ))}
          </div>
        )}
      </div>

      {showWizard && (
        <CampaignWizard
          editing={editing}
          onClose={() => setShowWizard(false)}
          onSaved={async () => { setShowWizard(false); await load() }}
          onError={msg => pushToast(msg, 'error')}
        />
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{
              background: t.type === 'success' ? '#111114' : '#1a0a0a',
              border: `1px solid ${t.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              color:  t.type === 'success' ? '#34d399' : '#f87171',
            }}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function CampaignCard({
  c, onLaunch, onPause, onResume, onEdit, onDelete,
}: {
  c: Campaign
  onLaunch: () => void
  onPause: () => void
  onResume: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const sentPct  = c.total_targets > 0 ? Math.round((c.total_sent / c.total_targets) * 100) : 0
  const failedPct = c.total_targets > 0 ? Math.round((c.total_failed / c.total_targets) * 100) : 0

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-white font-semibold truncate">{c.name}</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {c.channel === 'whatsapp' ? 'WhatsApp' : c.channel} ·{' '}
            {c.segment_type === 'all' ? 'Todos' : c.segment_type === 'vip' ? 'VIP' : c.segment_type === 'with_cpf' ? 'Com CPF' : 'Custom'}
            {c.ab_enabled ? ' · A/B' : ''}
          </p>
        </div>
        <StatusPill s={c.status} />
      </div>

      {c.total_targets > 0 && (
        <div>
          <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
            <span>{c.total_sent}/{c.total_targets} enviados</span>
            <span>{sentPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1e24' }}>
            <div className="h-full" style={{ width: `${sentPct}%`, background: '#34d399' }} />
          </div>
          {failedPct > 0 && (
            <p className="text-[11px] mt-1" style={{ color: '#f87171' }}>{c.total_failed} falhas</p>
          )}
        </div>
      )}

      {c.scheduled_at && (
        <p className="text-[11px] text-zinc-500">
          Início: {new Date(c.scheduled_at).toLocaleString('pt-BR')}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-1">
        {c.status === 'draft' && (
          <>
            <button onClick={onLaunch}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
              style={{ background: '#00E5FF', color: '#08323b' }}>
              <Play size={12} /> Lançar
            </button>
            <button onClick={onEdit}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>
              Editar
            </button>
            <button onClick={onDelete}
              className="px-2 py-1.5 rounded-lg text-xs font-medium"
              style={{ color: '#f87171' }}
              title="Deletar">
              <Trash2 size={12} />
            </button>
          </>
        )}
        {(c.status === 'scheduled' || c.status === 'running') && (
          <button onClick={onPause}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1"
            style={{ borderColor: '#fb7185', color: '#fb7185' }}>
            <Pause size={12} /> Pausar
          </button>
        )}
        {c.status === 'paused' && (
          <button onClick={onResume}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
            style={{ background: '#34d399', color: '#053b2f' }}>
            <Play size={12} /> Retomar
          </button>
        )}
        {c.status !== 'running' && c.status !== 'draft' && (
          <button onClick={onDelete}
            className="px-2 py-1.5 rounded-lg text-xs font-medium ml-auto"
            style={{ color: '#f87171' }}
            title="Deletar">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Wizard ───────────────────────────────────────────────────────────────────

interface WizardState {
  name:             string
  channel:          CampaignChannel
  // Step 1: produto + conteúdo
  product_name:     string  // só pra IA, não persiste
  objective:        string  // só pra IA
  tone:             'amigavel' | 'profissional' | 'urgente'
  template_a_id:    string | null
  template_a_body:  string  // pra criar template novo se não escolher um
  template_b_id:    string | null
  template_b_body:  string
  // Step 2: audiência
  segment_type:     SegmentType
  segment_filters:  Record<string, unknown>
  // Step 3: agendamento
  scheduled_at:     string  // ISO local-input ('YYYY-MM-DDTHH:mm')
  interval_seconds: number
  interval_jitter:  number
  daily_limit:      number
  // Step 4: A/B
  ab_enabled:       boolean
  ab_split_pct:     number
}

const DEFAULT_STATE: WizardState = {
  name:             '',
  channel:          'whatsapp',
  product_name:     '',
  objective:        '',
  tone:             'amigavel',
  template_a_id:    null,
  template_a_body:  '',
  template_b_id:    null,
  template_b_body:  '',
  segment_type:     'all',
  segment_filters:  {},
  scheduled_at:     '',
  interval_seconds: 60,
  interval_jitter:  30,
  daily_limit:      200,
  ab_enabled:       false,
  ab_split_pct:     50,
}

function CampaignWizard({
  editing, onClose, onSaved, onError,
}: {
  editing: Campaign | null
  onClose: () => void
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [step, setStep] = useState(1)
  const [state, setState] = useState<WizardState>(() => {
    if (!editing) return DEFAULT_STATE
    return {
      ...DEFAULT_STATE,
      name:             editing.name,
      channel:          editing.channel,
      template_a_id:    editing.template_a_id,
      template_b_id:    editing.template_b_id,
      segment_type:     editing.segment_type,
      segment_filters:  (editing.segment_filters ?? {}) as Record<string, unknown>,
      scheduled_at:     editing.scheduled_at ? editing.scheduled_at.slice(0, 16) : '',
      interval_seconds: editing.interval_seconds,
      interval_jitter:  editing.interval_jitter,
      daily_limit:      editing.daily_limit,
      ab_enabled:       editing.ab_enabled,
      ab_split_pct:     editing.ab_split_pct,
    }
  })
  const [templates, setTemplates] = useState<MessagingTemplate[]>([])
  const [generating, setGenerating] = useState(false)
  const [reach, setReach] = useState<number | null>(null)
  const [reachLoad, setReachLoad] = useState(false)
  const [saving, setSaving] = useState(false)
  // AI-ABS-1: override de modelo na hora da geração. null = usa default
  // (ai_feature_settings[campaign_copy] ou registry default).
  const [aiOverride, setAiOverride] = useState<{ provider: 'anthropic' | 'openai'; model: string } | null>(null)
  const [defaultAi, setDefaultAi]   = useState<{ provider: 'anthropic' | 'openai'; model: string } | null>(null)

  useEffect(() => {
    api<MessagingTemplate[]>('/messaging/templates')
      .then(setTemplates)
      .catch(e => onError((e as Error).message))
    // Busca o default de campaign_copy pra mostrar como pre-selected no dropdown
    api<Array<{ feature_key: string; primary_provider: 'anthropic' | 'openai'; primary_model: string }>>('/ai/feature-settings')
      .then(list => {
        const f = list.find(x => x.feature_key === 'campaign_copy')
        if (f) setDefaultAi({ provider: f.primary_provider, model: f.primary_model })
      })
      .catch(() => { /* silent: usa fallback hardcoded no dropdown */ })
  }, [onError])

  // Estimate reach when segment changes
  const refreshReach = useCallback(async () => {
    setReachLoad(true)
    try {
      const res = await api<{ reach: number }>('/campaigns/estimate-reach', {
        method: 'POST',
        body: JSON.stringify({
          segment_type:    state.segment_type,
          segment_filters: state.segment_type === 'custom' ? state.segment_filters : null,
        }),
      })
      setReach(res.reach)
    } catch { setReach(null) }
    setReachLoad(false)
  }, [state.segment_type, state.segment_filters])

  useEffect(() => { if (step === 2) refreshReach() }, [step, refreshReach])

  function patch(p: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...p }))
  }

  async function generateAi(forB = false) {
    if (!state.objective) return onError('Descreva o objetivo da campanha primeiro')
    setGenerating(true)
    try {
      const res = await api<{ variants: Array<{ title: string; body: string }> }>(
        '/campaigns/generate-content',
        {
          method: 'POST',
          body: JSON.stringify({
            objective:        state.objective,
            product_name:     state.product_name || undefined,
            tone:             state.tone,
            ab_variants:      state.ab_enabled,
            providerOverride: aiOverride ?? undefined,
          }),
        },
      )
      if (state.ab_enabled && res.variants.length >= 2) {
        patch({ template_a_body: res.variants[0].body, template_b_body: res.variants[1].body })
      } else if (forB) {
        patch({ template_b_body: res.variants[0]?.body ?? '' })
      } else {
        patch({ template_a_body: res.variants[0]?.body ?? '' })
      }
    } catch (e) {
      onError((e as Error).message)
    }
    setGenerating(false)
  }

  /** Cria template ad-hoc se o usuário digitou body e não escolheu um existente. */
  async function ensureTemplateId(label: 'A' | 'B', body: string, existing: string | null): Promise<string | null> {
    if (existing) return existing
    if (!body.trim()) return null
    try {
      const tpl = await api<MessagingTemplate>('/messaging/templates', {
        method: 'POST',
        body: JSON.stringify({
          name:          `${state.name || 'Campanha'} — variante ${label}`,
          channel:       'whatsapp',
          trigger_event: 'manual',
          message_body:  body,
          is_active:     true,
        }),
      })
      return tpl.id
    } catch (e) {
      onError(`Falha ao criar template ${label}: ${(e as Error).message}`)
      return null
    }
  }

  async function save() {
    if (!state.name) return onError('Nome obrigatório')
    setSaving(true)
    try {
      const tplA = await ensureTemplateId('A', state.template_a_body, state.template_a_id)
      if (!tplA) { setSaving(false); return }
      let tplB: string | null = null
      if (state.ab_enabled) {
        tplB = await ensureTemplateId('B', state.template_b_body, state.template_b_id)
        if (!tplB) { setSaving(false); return }
      }

      const payload: Partial<Campaign> = {
        name:             state.name,
        channel:          state.channel,
        segment_type:     state.segment_type,
        segment_filters:  state.segment_type === 'custom' ? state.segment_filters : null,
        scheduled_at:     state.scheduled_at ? new Date(state.scheduled_at).toISOString() : null,
        interval_seconds: state.interval_seconds,
        interval_jitter:  state.interval_jitter,
        daily_limit:      state.daily_limit,
        ab_enabled:       state.ab_enabled,
        ab_split_pct:     state.ab_split_pct,
        template_a_id:    tplA,
        template_b_id:    tplB,
      }

      if (editing) {
        await api(`/campaigns/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        await api('/campaigns', { method: 'POST', body: JSON.stringify(payload) })
      }
      onSaved()
    } catch (e) {
      onError((e as Error).message)
    }
    setSaving(false)
  }

  const stepLabels = ['Conteúdo', 'Audiência', 'Agendamento', 'A/B test']
  const canNext = useMemo(() => {
    if (step === 1) return state.name.trim().length > 0 && (state.template_a_id || state.template_a_body.trim().length > 0)
    if (step === 2) return reach === null || reach > 0
    return true
  }, [step, state, reach])

  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl flex flex-col max-h-full"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div>
            <p className="text-white font-semibold">{editing ? 'Editar campanha' : 'Nova campanha'}</p>
            <p className="text-zinc-500 text-xs mt-0.5">Passo {step} de 4 — {stepLabels[step - 1]}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Stepper */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex gap-1">
            {stepLabels.map((label, i) => (
              <div key={i} className="flex-1">
                <div className="h-1 rounded-full"
                  style={{ background: i + 1 <= step ? '#00E5FF' : '#27272a' }} />
                <p className="text-[10px] mt-1 uppercase tracking-wider"
                  style={{ color: i + 1 === step ? '#00E5FF' : '#52525b' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === 1 && (
            <>
              <Field label="Nome da campanha">
                <input className="cm-input" value={state.name} onChange={e => patch({ name: e.target.value })}
                  placeholder="Ex: Black Friday 2026 — abandonadores" />
              </Field>

              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Produto (opcional)">
                  <input className="cm-input" value={state.product_name} onChange={e => patch({ product_name: e.target.value })}
                    placeholder="Ex: Tênis Nike Air Max" />
                </Field>
                <Field label="Tom da mensagem">
                  <select className="cm-input" value={state.tone} onChange={e => patch({ tone: e.target.value as 'amigavel'|'profissional'|'urgente' })}>
                    <option value="amigavel">Amigável</option>
                    <option value="profissional">Profissional</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </Field>
              </div>

              <Field label="Objetivo (pra IA gerar a mensagem)">
                <textarea className="cm-input font-mono text-xs" rows={2} value={state.objective}
                  onChange={e => patch({ objective: e.target.value })}
                  placeholder="Ex: Reativar clientes que abandonaram o carrinho nos últimos 7 dias" />
              </Field>

              <Field label="Template existente (opcional)">
                <select className="cm-input" value={state.template_a_id ?? ''}
                  onChange={e => patch({ template_a_id: e.target.value || null, template_a_body: e.target.value ? '' : state.template_a_body })}>
                  <option value="">— criar novo template a partir do texto abaixo —</option>
                  {templates.filter(t => t.is_active && t.channel === 'whatsapp').map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>

              {!state.template_a_id && (
                <Field label="Mensagem (variante A)">
                  <AiOverrideRow value={aiOverride} fallback={defaultAi} onChange={setAiOverride} />
                  <div className="flex gap-2 mb-2 mt-2">
                    <button onClick={() => generateAi(false)} disabled={generating || !state.objective}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                      style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
                      <Sparkles size={12} />
                      {generating ? 'Gerando…' : 'Gerar com IA'}
                    </button>
                  </div>
                  <textarea className="cm-input font-mono text-xs" rows={5} value={state.template_a_body}
                    onChange={e => patch({ template_a_body: e.target.value })}
                    placeholder="Olá {{nome}}! Vim te lembrar que..." />
                </Field>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Segmento">
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { k: 'all',      label: 'Todos com WhatsApp' },
                    { k: 'with_cpf', label: 'Com CPF validado' },
                    { k: 'vip',      label: 'VIP' },
                    { k: 'custom',   label: 'Filtro customizado' },
                  ] as const).map(s => (
                    <button key={s.k} onClick={() => patch({ segment_type: s.k })}
                      className="px-3 py-2 rounded-lg text-xs font-medium border text-left"
                      style={{
                        borderColor: state.segment_type === s.k ? '#00E5FF' : '#27272a',
                        color:       state.segment_type === s.k ? '#00E5FF' : '#e4e4e7',
                        background:  state.segment_type === s.k ? 'rgba(0,229,255,0.05)' : 'transparent',
                      }}>{s.label}</button>
                  ))}
                </div>
              </Field>

              {state.segment_type === 'custom' && (
                <div className="rounded-lg p-3 space-y-2"
                  style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
                  <p className="text-zinc-400 text-xs font-medium">Filtros (todos AND)</p>
                  <Field label="Tags (separadas por vírgula)">
                    <input className="cm-input"
                      value={Array.isArray(state.segment_filters.tags) ? (state.segment_filters.tags as string[]).join(', ') : ''}
                      onChange={e => patch({ segment_filters: { ...state.segment_filters, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                      placeholder="vip, frequente" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Compras min (R$)">
                      <input type="number" className="cm-input"
                        value={(state.segment_filters.min_purchases as number | undefined) ?? ''}
                        onChange={e => patch({ segment_filters: { ...state.segment_filters, min_purchases: e.target.value ? Number(e.target.value) : undefined } })} />
                    </Field>
                    <Field label="Compras max (R$)">
                      <input type="number" className="cm-input"
                        value={(state.segment_filters.max_purchases as number | undefined) ?? ''}
                        onChange={e => patch({ segment_filters: { ...state.segment_filters, max_purchases: e.target.value ? Number(e.target.value) : undefined } })} />
                    </Field>
                  </div>
                </div>
              )}

              <div className="rounded-lg px-4 py-3 flex items-center justify-between"
                style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
                <div>
                  <p className="text-zinc-400 text-xs">Audiência estimada</p>
                  <p className="text-2xl font-bold text-white mt-0.5">
                    {reachLoad ? '…' : reach === null ? '?' : reach}
                    <span className="text-sm text-zinc-500 ml-2 font-normal">cliente{reach === 1 ? '' : 's'}</span>
                  </p>
                </div>
                <button onClick={refreshReach} disabled={reachLoad}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                  style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
                  Recalcular
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Início agendado (vazio = imediato após lançar)">
                <input type="datetime-local" className="cm-input"
                  value={state.scheduled_at}
                  onChange={e => patch({ scheduled_at: e.target.value })} />
              </Field>

              <div className="rounded-lg p-3 space-y-3"
                style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
                <p className="text-zinc-400 text-xs font-medium">Anti-detecção</p>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Intervalo entre disparos</span>
                    <span className="text-white font-mono">{state.interval_seconds}s</span>
                  </div>
                  <input type="range" min={15} max={600} step={5} className="w-full"
                    value={state.interval_seconds}
                    onChange={e => patch({ interval_seconds: Number(e.target.value) })} />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Variação aleatória (jitter)</span>
                    <span className="text-white font-mono">±{state.interval_jitter}s</span>
                  </div>
                  <input type="range" min={0} max={120} step={5} className="w-full"
                    value={state.interval_jitter}
                    onChange={e => patch({ interval_jitter: Number(e.target.value) })} />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Limite diário</span>
                    <span className="text-white font-mono">{state.daily_limit} msgs/dia</span>
                  </div>
                  <input type="range" min={50} max={2000} step={50} className="w-full"
                    value={state.daily_limit}
                    onChange={e => patch({ daily_limit: Number(e.target.value) })} />
                </div>

                <p className="text-[11px]" style={{ color: '#71717a' }}>
                  Com {state.interval_seconds}s ± {state.interval_jitter}s entre disparos, o WhatsApp não detecta padrão.
                  Cap de {state.daily_limit}/dia evita ban.
                </p>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={state.ab_enabled}
                  onChange={e => patch({ ab_enabled: e.target.checked })}
                  className="w-4 h-4" />
                <div>
                  <p className="text-white text-sm font-medium">Ativar A/B test</p>
                  <p className="text-zinc-500 text-xs">Divide a audiência entre 2 variantes pra comparar performance</p>
                </div>
              </label>

              {state.ab_enabled && (
                <>
                  <div className="rounded-lg p-3"
                    style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">Variante A: {state.ab_split_pct}%</span>
                      <span className="text-zinc-400">Variante B: {100 - state.ab_split_pct}%</span>
                    </div>
                    <input type="range" min={10} max={90} step={5} className="w-full"
                      value={state.ab_split_pct}
                      onChange={e => patch({ ab_split_pct: Number(e.target.value) })} />
                  </div>

                  <Field label="Template B (existente — opcional)">
                    <select className="cm-input" value={state.template_b_id ?? ''}
                      onChange={e => patch({ template_b_id: e.target.value || null, template_b_body: e.target.value ? '' : state.template_b_body })}>
                      <option value="">— criar novo template a partir do texto abaixo —</option>
                      {templates.filter(t => t.is_active && t.channel === 'whatsapp').map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </Field>

                  {!state.template_b_id && (
                    <Field label="Mensagem (variante B)">
                      <AiOverrideRow value={aiOverride} fallback={defaultAi} onChange={setAiOverride} />
                      <div className="flex gap-2 mb-2 mt-2">
                        <button onClick={() => generateAi(true)} disabled={generating || !state.objective}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                          style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
                          <Sparkles size={12} />
                          {generating ? 'Gerando…' : 'Gerar variante B'}
                        </button>
                      </div>
                      <textarea className="cm-input font-mono text-xs" rows={5} value={state.template_b_body}
                        onChange={e => patch({ template_b_body: e.target.value })}
                        placeholder="Versão alternativa da mensagem..." />
                    </Field>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-30"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Voltar
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#08323b' }}>
              Próximo
            </button>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#08323b' }}>
              {saving ? 'Salvando…' : (editing ? 'Salvar alterações' : 'Salvar como rascunho')}
            </button>
          )}
        </div>

        <style jsx>{`
          .cm-input { width: 100%; padding: 0.5rem 0.75rem; background: #0a0a0e; border: 1px solid #27272a; border-radius: 0.5rem; color: #fafafa; font-size: 0.875rem; outline: none; }
          .cm-input:focus { border-color: #00E5FF; }
        `}</style>
      </div>
    </div>,
    document.body,
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-zinc-400 text-xs mb-1">{label}</p>{children}</div>
}

// ── AI override row ────────────────────────────────────────────────────────
// Linha discreta acima do botão "Gerar com IA" pra escolher modelo na hora.
// Default vem de /ai/feature-settings (campaign_copy.primary). User pode trocar e o
// valor entra como providerOverride no POST /campaigns/generate-content.
// Lista vem de @/constants/ai-models — fonte única de verdade.

const AI_MODELS = AI_PROVIDERS.flatMap(p =>
  p.models
    .filter(m => !m.supports_embedding)  // não mostra embeddings no copy
    .map(m => ({
      provider: p.id,
      id:       m.id,
      label:    `${p.name.split(' ')[0]} ${m.name}`,
    })),
)

function AiOverrideRow({
  value, fallback, onChange,
}: {
  value:    { provider: 'anthropic' | 'openai'; model: string } | null
  fallback: { provider: 'anthropic' | 'openai'; model: string } | null
  onChange: (v: { provider: 'anthropic' | 'openai'; model: string } | null) => void
}) {
  const effective = value ?? fallback
  const currentModel = effective?.model ?? ''
  const currentLabel = AI_MODELS.find(m => m.id === currentModel)?.label ?? currentModel

  return (
    <div className="flex items-center gap-2 text-[11px]" style={{ color: '#71717a' }}>
      <span>Usar:</span>
      <select
        value={currentModel}
        onChange={e => {
          const next = e.target.value
          if (!next) { onChange(null); return }
          const m = AI_MODELS.find(x => x.id === next)
          if (m) onChange({ provider: m.provider, model: m.id })
        }}
        className="rounded px-2 py-0.5"
        style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#e4e4e7' }}>
        {/* Se o currentModel não está em AI_MODELS (id custom do registry), mostra como opção pra não ficar órfão */}
        {currentModel && !AI_MODELS.find(m => m.id === currentModel) && (
          <option value={currentModel}>{currentLabel}</option>
        )}
        {AI_MODELS.map(m => (
          <option key={`${m.provider}/${m.id}`} value={m.id}>{m.label}</option>
        ))}
      </select>
      <Link href="/dashboard/configuracoes/ia"
        className="flex items-center gap-1 hover:underline"
        style={{ color: '#00E5FF' }}>
        <SettingsIcon size={10} /> Configurar padrão
      </Link>
    </div>
  )
}
