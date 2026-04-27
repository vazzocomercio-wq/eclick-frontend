'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Sparkles, AlertTriangle, AlertCircle, Info, Flame, Check, X, RefreshCw,
  Save, MessageSquare, Settings, Brain, Zap,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Insight = {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  campaign_id: string | null
  campaign_name: string | null
  title: string
  description: string
  recommendation: string
  estimated_impact: string | null
  data_snapshot: Record<string, unknown>
  status: string
  created_at: string
}

type Conversation = { id: string; title: string | null; updated_at: string; total_tokens: number; model_used: string | null }

type Settings = {
  model_provider: string
  model_id: string
  acos_alert_threshold: number
  roas_min_threshold: number
  ctr_drop_threshold: number
  budget_burn_threshold: number
  stock_critical_days: number
  whatsapp_alerts_enabled: boolean
  whatsapp_alert_phone: string | null
  whatsapp_alert_severity: string
  auto_detect_enabled: boolean
  detect_cron_minutes: number
}

type Model = {
  provider: string; id: string; label: string; tier: string
  input_cost_per_1m_usd: number; output_cost_per_1m_usd: number
  notes?: string
}

const SEV: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  critical: { color: '#f87171', bg: 'rgba(248,113,113,0.10)', icon: <Flame size={14} />,         label: 'Crítico' },
  high:     { color: '#facc15', bg: 'rgba(250,204,21,0.10)', icon: <AlertTriangle size={14} />, label: 'Alto'    },
  medium:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', icon: <AlertCircle size={14} />,    label: 'Médio'   },
  low:      { color: '#a1a1aa', bg: 'rgba(161,161,170,0.10)', icon: <Info size={14} />,           label: 'Info'    },
}

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function AdsAiInteligenciaPage() {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<'insights' | 'conversas' | 'config'>('insights')

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,229,255,0.12)' }}>
            <Sparkles size={18} style={{ color: '#00E5FF' }} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Ads</p>
            <h1 className="text-white text-xl font-semibold">Inteligência de Ads</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        {([
          { k: 'insights',  l: 'Insights',     icon: <AlertTriangle size={12} /> },
          { k: 'conversas', l: 'Conversas',    icon: <MessageSquare size={12} /> },
          { k: 'config',    l: 'Configurações', icon: <Settings size={12} /> },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: tab === t.k ? '#00E5FF' : 'transparent', color: tab === t.k ? '#000' : '#a1a1aa' }}>
            {t.icon}{t.l}
          </button>
        ))}
      </div>

      {tab === 'insights'  && <InsightsTab  getHeaders={getHeaders} />}
      {tab === 'conversas' && <ConversasTab getHeaders={getHeaders} />}
      {tab === 'config'    && <ConfigTab    getHeaders={getHeaders} />}
    </div>
  )
}

// ── Insights Tab ──────────────────────────────────────────────────────────────

function InsightsTab({ getHeaders }: { getHeaders: () => Promise<Record<string, string>> }) {
  const [list, setList] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [filter, setFilter] = useState<{ status: string; severity: string }>({ status: 'open', severity: '' })
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const qs = new URLSearchParams()
      if (filter.status)   qs.set('status', filter.status)
      if (filter.severity) qs.set('severity', filter.severity)
      const res = await fetch(`${BACKEND}/ads-ai/insights?${qs}`, { headers })
      if (res.ok) {
        const v = await res.json()
        setList(Array.isArray(v) ? v : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders, filter])
  useEffect(() => { load() }, [load])

  async function detect() {
    setDetecting(true)
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/ads-ai/insights/detect`, { method: 'POST', headers })
      await load()
    } finally { setDetecting(false) }
  }
  async function action(id: string, kind: 'dismiss' | 'resolve') {
    const headers = await getHeaders()
    await fetch(`${BACKEND}/ads-ai/insights/${id}/${kind}`, { method: 'PATCH', headers })
    setList(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}
            className="text-[11px] bg-[#111114] border border-[#27272a] text-zinc-300 rounded-lg px-2 py-1.5">
            <option value="open">Abertos</option>
            <option value="resolved">Resolvidos</option>
            <option value="dismissed">Dispensados</option>
            <option value="">Todos</option>
          </select>
          <select value={filter.severity} onChange={e => setFilter({ ...filter, severity: e.target.value })}
            className="text-[11px] bg-[#111114] border border-[#27272a] text-zinc-300 rounded-lg px-2 py-1.5">
            <option value="">Toda severidade</option>
            <option value="critical">Crítico</option>
            <option value="high">Alto</option>
            <option value="medium">Médio</option>
            <option value="low">Info</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={detect} disabled={detecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-60"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}>
            <Zap size={11} /> {detecting ? 'Detectando…' : 'Rodar detecção agora'}
          </button>
          <button onClick={load}
            className="p-1.5 rounded-lg" style={{ background: '#111114', border: '1px solid #27272a' }}>
            <RefreshCw size={11} className={`text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-xs text-zinc-600 text-center py-8">Carregando…</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-8 italic">Nenhum insight {filter.status || 'em qualquer status'}.</p>
        ) : list.map(ins => {
          const meta = SEV[ins.severity] ?? SEV.low
          const isOpen = expanded === ins.id
          return (
            <div key={ins.id} id={`i-${ins.id}`}
              className="rounded-xl overflow-hidden"
              style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <button onClick={() => setExpanded(isOpen ? null : ins.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#161618] transition-colors">
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: meta.bg, color: meta.color }}>
                  {meta.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-100 text-sm font-medium truncate">{ins.title}</p>
                  <p className="text-zinc-500 text-[11px] truncate">{ins.description}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0"
                  style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                <span className="text-[10px] text-zinc-600 shrink-0 w-10 text-right">{ago(ins.created_at)}</span>
              </button>
              {isOpen && (
                <div className="px-4 py-3 space-y-3 border-t border-[#1a1a1f]">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Recomendação</p>
                    <p className="text-zinc-300 text-xs leading-relaxed">💡 {ins.recommendation}</p>
                  </div>
                  {ins.estimated_impact && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Impacto estimado</p>
                      <p className="text-zinc-300 text-xs">📊 {ins.estimated_impact}</p>
                    </div>
                  )}
                  {ins.campaign_name && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Campanha</p>
                      <p className="text-zinc-300 text-xs">{ins.campaign_name}</p>
                    </div>
                  )}
                  {ins.status === 'open' && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => action(ins.id, 'dismiss')}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors"
                        style={{ background: '#1a1a1f', color: '#a1a1aa', border: '1px solid #27272a' }}>
                        <X size={11} /> Dispensar
                      </button>
                      <button onClick={() => action(ins.id, 'resolve')}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors"
                        style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                        <Check size={11} /> Marcar como resolvido
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Conversas Tab ─────────────────────────────────────────────────────────────

function ConversasTab({ getHeaders }: { getHeaders: () => Promise<Record<string, string>> }) {
  const [list, setList] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(`${BACKEND}/ads-ai/conversations`, { headers })
        if (res.ok) {
          const v = await res.json()
          setList(Array.isArray(v) ? v : [])
        }
      } finally { setLoading(false) }
    })()
  }, [getHeaders])

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-xs text-zinc-600 text-center py-8">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-8 italic">Nenhuma conversa ainda. Use o chat na página de ML Ads.</p>
      ) : list.map(c => (
        <div key={c.id} className="px-4 py-3 rounded-xl flex items-center justify-between"
          style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div>
            <p className="text-zinc-200 text-sm font-medium">{c.title ?? '(sem título)'}</p>
            <p className="text-zinc-500 text-[11px]">{ago(c.updated_at)} · {c.model_used ?? '—'} · {c.total_tokens.toLocaleString('pt-BR')} tokens</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Config Tab ────────────────────────────────────────────────────────────────

function ConfigTab({ getHeaders }: { getHeaders: () => Promise<Record<string, string>> }) {
  const [s, setS] = useState<Settings | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(0)

  useEffect(() => {
    (async () => {
      const headers = await getHeaders()
      const [s1, s2] = await Promise.all([
        fetch(`${BACKEND}/ads-ai/settings`,         { headers }),
        fetch(`${BACKEND}/ads-ai/models/available`, { headers }),
      ])
      if (s1.ok) setS(await s1.json())
      if (s2.ok) {
        const v = await s2.json()
        setModels(Array.isArray(v) ? v : [])
      }
    })()
  }, [getHeaders])

  async function save() {
    if (!s) return
    setSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ads-ai/settings`, {
        method: 'PATCH', headers, body: JSON.stringify(s),
      })
      if (res.ok) setSavedAt(Date.now())
    } finally { setSaving(false) }
  }

  if (!s) return <p className="text-xs text-zinc-600 text-center py-8">Carregando…</p>

  const inp = 'w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2'

  return (
    <div className="space-y-5">
      {/* Model picker */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-cyan-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Modelo de IA</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {models.map(m => {
            const selected = m.id === s.model_id
            return (
              <button key={m.id} onClick={() => setS({ ...s, model_id: m.id, model_provider: m.provider })}
                className="text-left rounded-xl p-3 space-y-2 transition-all"
                style={{
                  background: selected ? 'rgba(0,229,255,0.08)' : '#18181b',
                  border: '1px solid ' + (selected ? '#00E5FF' : '#27272a'),
                }}>
                <div className="flex items-center justify-between">
                  <p className="text-zinc-100 text-sm font-semibold">{m.label}</p>
                  <span className="text-[9px] uppercase tracking-widest"
                    style={{ color: m.tier === 'fast' ? '#4ade80' : m.tier === 'balanced' ? '#facc15' : '#f87171' }}>
                    {m.tier}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500">{m.notes}</p>
                <p className="text-[10px] text-zinc-600 font-mono">
                  ${m.input_cost_per_1m_usd.toFixed(2)}in / ${m.output_cost_per_1m_usd.toFixed(2)}out
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Thresholds */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-cyan-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Thresholds de detecção</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="ACoS limite (%)">
            <input type="number" className={inp + ' tabular-nums'} value={s.acos_alert_threshold}
              onChange={e => setS({ ...s, acos_alert_threshold: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="ROAS mínimo (x)">
            <input type="number" step="0.1" className={inp + ' tabular-nums'} value={s.roas_min_threshold}
              onChange={e => setS({ ...s, roas_min_threshold: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Queda de CTR (%)">
            <input type="number" className={inp + ' tabular-nums'} value={s.ctr_drop_threshold}
              onChange={e => setS({ ...s, ctr_drop_threshold: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Burn de budget (%)">
            <input type="number" className={inp + ' tabular-nums'} value={s.budget_burn_threshold}
              onChange={e => setS({ ...s, budget_burn_threshold: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Estoque crítico (dias)">
            <input type="number" className={inp + ' tabular-nums'} value={s.stock_critical_days}
              onChange={e => setS({ ...s, stock_critical_days: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Frequência detecção (min)">
            <input type="number" className={inp + ' tabular-nums'} value={s.detect_cron_minutes}
              onChange={e => setS({ ...s, detect_cron_minutes: Number(e.target.value) || 60 })} />
          </Field>
        </div>
        <Toggle label="Detecção automática (cron)" value={s.auto_detect_enabled}
          onChange={v => setS({ ...s, auto_detect_enabled: v })} />
      </div>

      {/* WhatsApp alerts */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-cyan-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Alertas WhatsApp</h3>
        </div>
        <Toggle label="Enviar alertas via WhatsApp" value={s.whatsapp_alerts_enabled}
          onChange={v => setS({ ...s, whatsapp_alerts_enabled: v })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Telefone destino">
            <input className={inp + ' font-mono'} placeholder="+55 11 99999-9999"
              value={s.whatsapp_alert_phone ?? ''}
              onChange={e => setS({ ...s, whatsapp_alert_phone: e.target.value })} />
          </Field>
          <Field label="Severidade mínima">
            <select className={inp} value={s.whatsapp_alert_severity}
              onChange={e => setS({ ...s, whatsapp_alert_severity: e.target.value })}>
              <option value="critical">Apenas crítico</option>
              <option value="high">Alto e acima</option>
              <option value="medium">Médio e acima</option>
              <option value="low">Tudo</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
          style={{ background: '#00E5FF', color: '#000' }}>
          <Save size={12} /> {saving ? 'Salvando…' : savedAt ? 'Salvo ✓' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-xs text-zinc-300">{label}</span>
      <button onClick={() => onChange(!value)} type="button"
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{ background: value ? '#00E5FF' : '#27272a' }}>
        <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform"
          style={{ left: value ? 18 : 2 }} />
      </button>
    </label>
  )
}
