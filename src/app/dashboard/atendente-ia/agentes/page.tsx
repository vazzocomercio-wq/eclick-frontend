'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { AI_PROVIDERS } from '@/lib/ai/config'
import {
  Bot, Plus, Settings, Trash2, ToggleLeft, ToggleRight,
  MessageCircle, Zap, Star, ChevronRight, ChevronLeft,
  X, Check, AlertCircle, Loader2, LayoutTemplate,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

const CHANNELS = [
  { id: 'ml',         label: 'Mercado Livre', group: 'marketplace' },
  { id: 'shopee',     label: 'Shopee',        group: 'marketplace' },
  { id: 'amazon',     label: 'Amazon',        group: 'marketplace' },
  { id: 'magalu',     label: 'Magalu',        group: 'marketplace' },
  { id: 'americanas', label: 'Americanas',    group: 'marketplace' },
  { id: 'whatsapp',   label: 'WhatsApp',      group: 'messenger' },
  { id: 'instagram',  label: 'Instagram',     group: 'messenger' },
  { id: 'tiktok',     label: 'TikTok',        group: 'messenger' },
  { id: 'telegram',   label: 'Telegram',      group: 'messenger' },
  { id: 'website',    label: 'Site Próprio',  group: 'own' },
]

const TONES   = ['professional', 'casual', 'friendly', 'technical']
const TONE_PT: Record<string, string> = { professional: 'Profissional', casual: 'Casual', friendly: 'Amigável', technical: 'Técnico' }
const LANGS   = [{ id: 'pt-BR', label: 'Português BR' }, { id: 'en', label: 'English' }, { id: 'es', label: 'Español' }]
const CATEGORIES = ['preco', 'prazo', 'produto', 'troca', 'tecnico', 'outro']

interface ChannelConfig {
  channel: string
  is_active: boolean
  mode: string
  confidence_threshold: number
  auto_reply_delay_seconds: number
  max_response_length: number
  escalate_keywords: string[]
}

interface Agent {
  id: string
  name: string
  avatar_url?: string
  description?: string
  model_provider: string
  model_id: string
  tone: string
  language: string
  is_active: boolean
  channels: ChannelConfig[]
}

// ── Default wizard state ──────────────────────────────────────────────────────

const defaultChannels = (): Record<string, ChannelConfig> =>
  Object.fromEntries(CHANNELS.map(c => [c.id, {
    channel: c.id,
    is_active: false,
    mode: 'hybrid',
    confidence_threshold: 80,
    auto_reply_delay_seconds: 30,
    max_response_length: 500,
    escalate_keywords: ['reclamação','processo','procon','cancelar','devolução','reembolso','danificado','quebrado','fraude'],
  }]))

// ── Channel card inside wizard ────────────────────────────────────────────────

function ChannelWizardCard({ ch, cfg, onChange }: {
  ch: { id: string; label: string }
  cfg: ChannelConfig
  onChange: (c: ChannelConfig) => void
}) {
  const [newKw, setNewKw] = useState('')

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: cfg.is_active ? 'rgba(0,229,255,0.04)' : '#0d0d10', border: `1px solid ${cfg.is_active ? 'rgba(0,229,255,0.2)' : '#1e1e24'}` }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{ch.label}</span>
        <button onClick={() => onChange({ ...cfg, is_active: !cfg.is_active })} className="transition-colors">
          {cfg.is_active
            ? <ToggleRight size={22} style={{ color: '#00E5FF' }} />
            : <ToggleLeft  size={22} style={{ color: '#52525b' }} />}
        </button>
      </div>

      {cfg.is_active && (
        <div className="space-y-2.5 text-xs">
          {/* Mode */}
          <div>
            <p className="text-zinc-500 mb-1">Modo</p>
            <div className="flex gap-1">
              {['auto','hybrid','human'].map(m => (
                <button key={m}
                  onClick={() => onChange({ ...cfg, mode: m })}
                  className="px-2.5 py-1 rounded-lg capitalize transition-colors"
                  style={{ background: cfg.mode === m ? 'rgba(0,229,255,0.15)' : '#1e1e24', color: cfg.mode === m ? '#00E5FF' : '#a1a1aa', border: `1px solid ${cfg.mode === m ? 'rgba(0,229,255,0.4)' : 'transparent'}` }}>
                  {m === 'auto' ? 'Automático' : m === 'hybrid' ? 'Híbrido' : 'Humano'}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence threshold (hybrid only) */}
          {cfg.mode === 'hybrid' && (
            <div>
              <div className="flex justify-between text-zinc-500 mb-1">
                <span>Confiança mínima</span>
                <span style={{ color: '#00E5FF' }}>{cfg.confidence_threshold}%</span>
              </div>
              <input type="range" min={50} max={99} value={cfg.confidence_threshold}
                onChange={e => onChange({ ...cfg, confidence_threshold: Number(e.target.value) })}
                className="w-full accent-cyan-400" />
            </div>
          )}

          {/* Delay */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 shrink-0">Delay de resposta</span>
            <input type="number" min={0} max={300} value={cfg.auto_reply_delay_seconds}
              onChange={e => onChange({ ...cfg, auto_reply_delay_seconds: Number(e.target.value) })}
              className="w-16 px-2 py-1 rounded text-white text-center text-xs"
              style={{ background: '#1e1e24', border: '1px solid #27272a' }} />
            <span className="text-zinc-500">seg</span>
          </div>

          {/* Escalate keywords */}
          <div>
            <p className="text-zinc-500 mb-1">Palavras que escalam para humano</p>
            <div className="flex flex-wrap gap-1 mb-1">
              {cfg.escalate_keywords.map(kw => (
                <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                  style={{ background: '#27272a', color: '#a1a1aa' }}>
                  {kw}
                  <button onClick={() => onChange({ ...cfg, escalate_keywords: cfg.escalate_keywords.filter(k => k !== kw) })}>
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input value={newKw} onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newKw.trim()) { onChange({ ...cfg, escalate_keywords: [...cfg.escalate_keywords, newKw.trim()] }); setNewKw('') }}}
                placeholder="+ palavra"
                className="flex-1 px-2 py-1 rounded text-xs text-white placeholder-zinc-600"
                style={{ background: '#1e1e24', border: '1px solid #27272a' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Wizard modal ──────────────────────────────────────────────────────────────

function AgentWizard({ onClose, onSaved, editAgent }: {
  onClose: () => void
  onSaved: () => void
  editAgent?: Agent
}) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [name, setName]               = useState(editAgent?.name ?? '')
  const [description, setDescription] = useState(editAgent?.description ?? '')
  const [tone, setTone]               = useState(editAgent?.tone ?? 'professional')
  const [language, setLanguage]       = useState(editAgent?.language ?? 'pt-BR')

  // Step 2
  const [provider, setProvider] = useState(editAgent?.model_provider ?? 'anthropic')
  const [modelId, setModelId]   = useState(editAgent?.model_id ?? 'claude-haiku-4-5-20251001')
  const [sysPrompt, setSysPrompt] = useState((editAgent as (Agent & { system_prompt?: string }) | undefined)?.system_prompt ?? '')

  // Step 3
  const [channels, setChannels] = useState<Record<string, ChannelConfig>>(() => {
    const defaults = defaultChannels()
    if (editAgent?.channels) {
      editAgent.channels.forEach(c => { defaults[c.channel] = c })
    }
    return defaults
  })

  const prov = AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]

  async function save() {
    if (!name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError('')
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const headers = { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }

      const body = { name, description, tone, language, model_provider: provider, model_id: modelId, system_prompt: sysPrompt }

      let agentId = editAgent?.id
      if (agentId) {
        await fetch(`${BACKEND}/atendente-ia/agents/${agentId}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
      } else {
        const res = await fetch(`${BACKEND}/atendente-ia/agents`, { method: 'POST', headers, body: JSON.stringify(body) })
        const data = await res.json()
        agentId = data.id
      }

      // Save active channels
      for (const cfg of Object.values(channels)) {
        await fetch(`${BACKEND}/atendente-ia/agents/${agentId}/channels/${cfg.channel}`, {
          method: 'POST', headers, body: JSON.stringify(cfg),
        })
      }

      onSaved()
    } catch {
      setError('Erro ao salvar agente')
    } finally {
      setSaving(false)
    }
  }

  const steps = [
    { n: 1, label: 'Identidade' },
    { n: 2, label: 'Modelo IA' },
    { n: 3, label: 'Canais' },
    { n: 4, label: 'Revisar' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div>
            <h2 className="text-lg font-bold text-white">{editAgent ? 'Editar Agente' : 'Novo Agente'}</h2>
            <div className="flex gap-3 mt-1">
              {steps.map(s => (
                <button key={s.n} onClick={() => s.n < step && setStep(s.n)}
                  className="flex items-center gap-1 text-[11px] transition-colors"
                  style={{ color: step === s.n ? '#00E5FF' : step > s.n ? '#52525b' : '#52525b' }}>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: step === s.n ? '#00E5FF' : step > s.n ? '#27272a' : '#1e1e24', color: step === s.n ? '#000' : step > s.n ? '#52525b' : '#52525b' }}>
                    {step > s.n ? '✓' : s.n}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Nome do agente *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Sofia - Atendimento Vazzo"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600"
                  style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Descrição do papel</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Atendimento de perguntas no ML e Shopee"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600"
                  style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Tom de comunicação</label>
                <div className="flex gap-2 flex-wrap">
                  {TONES.map(t => (
                    <button key={t} onClick={() => setTone(t)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                      style={{ background: tone === t ? 'rgba(0,229,255,0.15)' : '#1e1e24', color: tone === t ? '#00E5FF' : '#a1a1aa', border: `1px solid ${tone === t ? 'rgba(0,229,255,0.4)' : 'transparent'}` }}>
                      {TONE_PT[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Idioma</label>
                <div className="flex gap-2">
                  {LANGS.map(l => (
                    <button key={l.id} onClick={() => setLanguage(l.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                      style={{ background: language === l.id ? 'rgba(0,229,255,0.15)' : '#1e1e24', color: language === l.id ? '#00E5FF' : '#a1a1aa', border: `1px solid ${language === l.id ? 'rgba(0,229,255,0.4)' : 'transparent'}` }}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Provedor</label>
                <div className="flex gap-2">
                  {Object.entries(AI_PROVIDERS).map(([pid, p]) => (
                    <button key={pid} onClick={() => { setProvider(pid); setModelId(p.models[0].id) }}
                      className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                      style={{ background: provider === pid ? 'rgba(0,229,255,0.12)' : '#1e1e24', color: provider === pid ? '#00E5FF' : '#a1a1aa', border: `1px solid ${provider === pid ? 'rgba(0,229,255,0.35)' : 'transparent'}` }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Modelo</label>
                <div className="space-y-1.5">
                  {prov?.models.map(m => (
                    <button key={m.id} onClick={() => setModelId(m.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-colors text-left"
                      style={{ background: modelId === m.id ? 'rgba(0,229,255,0.06)' : '#0d0d10', border: `1px solid ${modelId === m.id ? 'rgba(0,229,255,0.25)' : '#1e1e24'}` }}>
                      <div>
                        <p className="text-sm font-medium text-white">{m.name}</p>
                        <p className="text-xs text-zinc-500">{m.description}</p>
                      </div>
                      {modelId === m.id && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#00E5FF' }} />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Prompt do sistema <span className="text-zinc-600">(opcional)</span></label>
                <textarea value={sysPrompt} onChange={e => setSysPrompt(e.target.value)} rows={4}
                  placeholder="Ex: Você é Sofia, atendente da Vazzo Comercio. Seja objetiva e cordial. Sempre mencione o prazo de entrega quando relevante."
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 resize-none"
                  style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-3">
              {['marketplace', 'messenger', 'own'].map(group => {
                const groupChannels = CHANNELS.filter(c => c.group === group)
                const groupLabel = group === 'marketplace' ? 'Marketplaces' : group === 'messenger' ? 'Mensageiros' : 'Site Próprio'
                return (
                  <div key={group}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">{groupLabel}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {groupChannels.map(ch => (
                        <ChannelWizardCard
                          key={ch.id}
                          ch={ch}
                          cfg={channels[ch.id]}
                          onChange={cfg => setChannels(p => ({ ...p, [ch.id]: cfg }))}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* STEP 4 — Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 space-y-2" style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Identidade</p>
                <p className="text-white font-semibold">{name}</p>
                <p className="text-zinc-400 text-sm">{description}</p>
                <div className="flex gap-2 flex-wrap mt-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: '#1e1e24', color: '#a1a1aa' }}>{TONE_PT[tone]}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: '#1e1e24', color: '#a1a1aa' }}>{language}</span>
                </div>
              </div>
              <div className="rounded-xl p-4 space-y-2" style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Modelo IA</p>
                <p className="text-white">{AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.name}</p>
                <p className="text-zinc-400 text-sm">{AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.models.find(m => m.id === modelId)?.name}</p>
              </div>
              <div className="rounded-xl p-4 space-y-2" style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Canais ativos</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(channels).filter(c => c.is_active).map(c => (
                    <span key={c.channel} className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                      {CHANNELS.find(ch => ch.id === c.channel)?.label}
                    </span>
                  ))}
                  {!Object.values(channels).some(c => c.is_active) && <p className="text-zinc-500 text-sm">Nenhum canal ativo</p>}
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                  <AlertCircle size={14} />{error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white transition-colors"
            style={{ background: '#1e1e24' }}>
            <ChevronLeft size={15} />{step > 1 ? 'Voltar' : 'Cancelar'}
          </button>
          {step < 4
            ? <button onClick={() => { if (step === 1 && !name.trim()) { setError('Nome é obrigatório'); return } setError(''); setStep(s => s + 1) }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: '#00E5FF', color: '#000' }}>
                Próximo <ChevronRight size={15} />
              </button>
            : <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: '#00E5FF', color: '#000' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editAgent ? 'Salvar' : 'Criar Agente'}
              </button>
          }
        </div>
      </div>
    </div>
  )
}

// ── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({ agent, onToggle, onEdit, onDelete }: {
  agent: Agent
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const prov = AI_PROVIDERS[agent.model_provider as keyof typeof AI_PROVIDERS]
  const mdl  = prov?.models.find(m => m.id === agent.model_id)
  const activeChannels = (agent.channels ?? []).filter(c => c.is_active)

  return (
    <div className="rounded-2xl p-5 space-y-4 transition-colors"
      style={{ background: '#111114', border: `1px solid ${agent.is_active ? 'rgba(0,229,255,0.15)' : '#1e1e24'}` }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
            style={{ background: '#1e1e24' }}>
            {agent.avatar_url ? <img src={agent.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : '🤖'}
          </div>
          <div>
            <p className="font-semibold text-white">{agent.name}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{agent.description || 'Sem descrição'}</p>
          </div>
        </div>
        <button onClick={onToggle} className="transition-colors shrink-0">
          {agent.is_active
            ? <ToggleRight size={24} style={{ color: '#00E5FF' }} />
            : <ToggleLeft  size={24} style={{ color: '#3f3f46' }} />}
        </button>
      </div>

      {/* Model badge */}
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
          style={{ background: '#1e1e24', color: '#71717a' }}>
          {prov?.name ?? agent.model_provider} · {mdl?.name ?? agent.model_id}
        </span>
      </div>

      {/* Active channels */}
      {activeChannels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChannels.map(c => (
            <span key={c.channel} className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.15)' }}>
              {CHANNELS.find(ch => ch.id === c.channel)?.label ?? c.channel}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: <MessageCircle size={12} />, label: 'Hoje', value: '—' },
          { icon: <Zap size={12} />,           label: 'Auto',  value: '—%' },
          { icon: <Star size={12} />,           label: 'CSAT',  value: '—' },
        ].map(s => (
          <div key={s.label} className="rounded-lg px-2 py-2 text-center"
            style={{ background: '#0d0d10' }}>
            <div className="flex items-center justify-center gap-1 text-zinc-500 mb-0.5">{s.icon}<span className="text-[10px]">{s.label}</span></div>
            <p className="text-sm font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors"
          style={{ background: '#1e1e24', color: '#a1a1aa' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}>
          <Settings size={12} /> Configurar
        </button>
        <button onClick={onDelete}
          className="flex items-center justify-center p-2 rounded-xl text-xs transition-colors"
          style={{ background: '#1e1e24', color: '#71717a' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1e1e24'; e.currentTarget.style.color = '#71717a' }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Templates modal ─────────────────────────────────────────────────────────

interface AgentTemplate {
  id: string
  name: string
  emoji: string
  description: string
  default_model: string
  always_escalate: boolean
}

function TemplatesModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [loading,   setLoading]   = useState(true)
  const [creating,  setCreating]  = useState<string | null>(null)
  const [err,       setErr]       = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        const res = await fetch(`${BACKEND}/ai/templates`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        })
        if (res.ok) { const v = await res.json(); setTemplates(Array.isArray(v) ? v : []) }
      } catch (e: any) { setErr(e?.message ?? 'Erro') } finally { setLoading(false) }
    })()
  }, [])

  async function handleCreate(tplId: string) {
    setCreating(tplId); setErr(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/ai/agents/from-template/${tplId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      onCreated()
    } catch (e: any) {
      setErr(e?.message ?? 'Erro ao criar agente')
    } finally { setCreating(null) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2">
            <LayoutTemplate size={15} style={{ color: '#00E5FF' }} />
            <p className="text-sm font-semibold text-white">Criar agente a partir de template</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X size={16} /></button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-zinc-600" />
            </div>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              Nenhum template disponível. Rodou a migration?
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map(t => (
                <button key={t.id} onClick={() => handleCreate(t.id)} disabled={creating !== null}
                  className="text-left p-4 rounded-xl transition-all disabled:opacity-50 hover:scale-[1.02]"
                  style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-3xl">{t.emoji}</div>
                    {creating === t.id && <Loader2 size={14} className="animate-spin text-cyan-400" />}
                  </div>
                  <p className="text-sm font-bold text-white mb-1">{t.name}</p>
                  <p className="text-[11px] text-zinc-500 leading-snug mb-3">{t.description}</p>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                    <Zap size={10} />
                    <span className="font-mono truncate">{t.default_model.replace('claude-', '').replace('-20251001', '')}</span>
                    {t.always_escalate && (
                      <span className="ml-auto px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                        Sempre escala
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {err && <p className="text-[11px] text-red-400 mt-3">{err}</p>}

          <p className="text-[10px] text-zinc-600 mt-4">
            O agente é criado com nome, descrição, prompt e modelo do template.
            Você pode editar tudo depois.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AgentesPage() {
  const [agents, setAgents]         = useState<Agent[]>([])
  const [loading, setLoading]       = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [editAgent, setEditAgent]   = useState<Agent | undefined>()
  const [showTemplates, setShowTemplates] = useState(false)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/atendente-ia/agents`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.ok) { const v = await res.json(); setAgents(Array.isArray(v) ? v : []) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleAgent(id: string) {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    await fetch(`${BACKEND}/atendente-ia/agents/${id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    load()
  }

  async function deleteAgent(id: string) {
    const ok = await confirm({
      title:        'Excluir agente',
      message:      'Excluir este agente?',
      confirmLabel: 'Excluir',
      variant:      'danger',
    })
    if (!ok) return
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    await fetch(`${BACKEND}/atendente-ia/agents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    load()
  }

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot size={22} style={{ color: '#00E5FF' }} /> Agentes de IA
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Configure atendentes virtuais para cada canal</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}>
            <LayoutTemplate size={15} /> Templates
          </button>
          <button onClick={() => { setEditAgent(undefined); setShowWizard(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: '#00E5FF', color: '#000' }}>
            <Plus size={15} /> Novo Agente
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Bot size={40} style={{ color: '#27272a' }} />
          <p className="text-zinc-500">Nenhum agente criado</p>
          <button onClick={() => { setEditAgent(undefined); setShowWizard(true) }}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: '#1e1e24', color: '#a1a1aa' }}>
            Criar primeiro agente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onToggle={() => toggleAgent(agent.id)}
              onEdit={() => { setEditAgent(agent); setShowWizard(true) }}
              onDelete={() => deleteAgent(agent.id)}
            />
          ))}
        </div>
      )}

      {showWizard && (
        <AgentWizard
          editAgent={editAgent}
          onClose={() => setShowWizard(false)}
          onSaved={() => { setShowWizard(false); load() }}
        />
      )}

      {showTemplates && (
        <TemplatesModal
          onClose={() => setShowTemplates(false)}
          onCreated={() => { setShowTemplates(false); load() }}
        />
      )}
    </div>
  )
}
