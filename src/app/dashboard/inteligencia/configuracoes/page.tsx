'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Power, Save, RefreshCw, AlertCircle, Moon, Bell, Brain,
  Sparkles, Zap, Plus,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type AnalyzerName = 'compras' | 'preco' | 'estoque' | 'margem' | 'ads'
type Department = 'compras' | 'comercial' | 'marketing' | 'logistica' | 'diretoria'

interface AnalyzerCfg { enabled?: boolean; cron?: string; min_score?: number }

interface HubConfig {
  organization_id:                string
  enabled:                        boolean
  analyzers_config:               Record<AnalyzerName, AnalyzerCfg>
  digest_config:                  { morning?: string; afternoon?: string; evening?: string; timezone?: string }
  quiet_hours:                    { enabled?: boolean; start?: string; end?: string }
  cross_intel_enabled:            boolean
  max_alerts_per_manager_per_day: number
  min_interval_minutes:           number
  learning_enabled:               boolean
  learning_decay_days:            number
}

interface RoutingRule {
  id:         string
  department: Department
  analyzer:   AnalyzerName | '*'
  categories: string[]
  min_score:  number
  enabled:    boolean
}

const ANALYZERS: { key: AnalyzerName; label: string; icon: string; color: string }[] = [
  { key: 'estoque', label: 'Estoque',  icon: '📦', color: '#a78bfa' },
  { key: 'compras', label: 'Compras',  icon: '🏭', color: '#60a5fa' },
  { key: 'preco',   label: 'Preço',    icon: '💰', color: '#f59e0b' },
  { key: 'margem',  label: 'Margem',   icon: '📊', color: '#4ade80' },
  { key: 'ads',     label: 'Ads',      icon: '📣', color: '#f472b6' },
]

const DEPTS: { value: Department; label: string; color: string }[] = [
  { value: 'compras',   label: 'Compras',    color: '#a78bfa' },
  { value: 'comercial', label: 'Comercial',  color: '#4ade80' },
  { value: 'marketing', label: 'Marketing',  color: '#f472b6' },
  { value: 'logistica', label: 'Logística',  color: '#60a5fa' },
  { value: 'diretoria', label: 'Diretoria',  color: '#FFE600' },
]

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
    throw new Error(err.message ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return null as T
  return res.json()
}

// ── Components ────────────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, color = '#a1a1aa' }: {
  title: string
  icon: typeof Bell
  children: React.ReactNode
  color?: string
}) {
  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color}1a`, border: `1px solid ${color}33` }}>
          <Icon size={13} style={{ color }} />
        </span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{label}</p>
        {sub && <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative w-9 h-5 rounded-full transition-colors shrink-0"
        style={{ background: checked ? '#00E5FF' : '#27272a' }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ left: checked ? '18px' : '2px' }} />
      </button>
    </label>
  )
}

function NumberInput({ value, onChange, min, max, step, suffix }: {
  value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number; suffix?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="number"
        value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        className="w-20 px-2 py-1.5 rounded-lg text-xs text-white outline-none transition-colors text-center font-mono"
        style={{ background: '#18181b', border: '1px solid #27272a' }}
        onFocus={e => (e.currentTarget.style.borderColor = '#00E5FF')}
        onBlur={e => (e.currentTarget.style.borderColor = '#27272a')} />
      {suffix && <span className="text-[10px] text-zinc-500">{suffix}</span>}
    </div>
  )
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input type="time"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      className="px-2 py-1.5 rounded-lg text-xs text-white outline-none transition-colors font-mono"
      style={{ background: '#18181b', border: '1px solid #27272a', colorScheme: 'dark' }}
      onFocus={e => (e.currentTarget.style.borderColor = '#00E5FF')}
      onBlur={e => (e.currentTarget.style.borderColor = '#27272a')} />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const [config, setConfig]       = useState<HubConfig | null>(null)
  const [rules, setRules]         = useState<RoutingRule[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [savedAt, setSavedAt]     = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, r] = await Promise.all([
        api<HubConfig>('/alert-hub/config'),
        api<RoutingRule[]>('/alert-hub/routing-rules'),
      ])
      setConfig(c)
      setRules(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function patch<K extends keyof HubConfig>(key: K, value: HubConfig[K]) {
    setConfig(c => c ? { ...c, [key]: value } : c)
  }

  function patchAnalyzer(name: AnalyzerName, key: keyof AnalyzerCfg, value: unknown) {
    setConfig(c => c ? {
      ...c,
      analyzers_config: {
        ...c.analyzers_config,
        [name]: { ...c.analyzers_config[name], [key]: value },
      },
    } : c)
  }

  async function save() {
    if (!config) return
    setSaving(true)
    setError(null)
    try {
      const updated = await api<HubConfig>('/alert-hub/config', {
        method: 'PATCH',
        body: JSON.stringify({
          analyzers_config:               config.analyzers_config,
          digest_config:                  config.digest_config,
          quiet_hours:                    config.quiet_hours,
          cross_intel_enabled:            config.cross_intel_enabled,
          max_alerts_per_manager_per_day: config.max_alerts_per_manager_per_day,
          min_interval_minutes:           config.min_interval_minutes,
          learning_enabled:               config.learning_enabled,
          learning_decay_days:            config.learning_decay_days,
        }),
      })
      setConfig(updated)
      setSavedAt(Date.now())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEnable() {
    if (!config) return
    setSaving(true)
    setError(null)
    try {
      const path = config.enabled ? '/alert-hub/disable' : '/alert-hub/enable'
      const res = await api<{ config?: HubConfig } | HubConfig>(path, { method: 'POST' })
      const newCfg = (res as { config?: HubConfig }).config ?? (res as HubConfig)
      setConfig(newCfg)
      // Recarrega rules — enable cria os defaults
      const r = await api<RoutingRule[]>('/alert-hub/routing-rules')
      setRules(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  async function toggleRule(rule: RoutingRule) {
    try {
      const updated = await api<RoutingRule>(`/alert-hub/routing-rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !rule.enabled }),
      })
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function patchRuleScore(rule: RoutingRule, min_score: number) {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, min_score } : r))
    try {
      await api(`/alert-hub/routing-rules/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ min_score }),
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro')
    }
  }

  if (loading || !config) {
    return (
      <div className="p-4 sm:p-6 space-y-4 min-h-full" style={{ background: '#09090b' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-zinc-500 text-xs">Inteligência</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Configurações</h2>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && Date.now() - savedAt < 3000 && (
            <span className="text-[10px] text-zinc-500 inline-flex items-center gap-1">
              <Save size={11} /> salvo
            </span>
          )}
          <button onClick={load} disabled={loading || saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
            <Save size={13} />
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Master toggle */}
      <div className="rounded-2xl p-5 flex items-center justify-between gap-4"
        style={{
          background: config.enabled ? 'linear-gradient(135deg, rgba(74,222,128,0.05), #111114)' : '#111114',
          border: `1px solid ${config.enabled ? 'rgba(74,222,128,0.25)' : '#27272a'}`,
        }}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: config.enabled ? 'rgba(74,222,128,0.12)' : '#18181b', border: `1px solid ${config.enabled ? 'rgba(74,222,128,0.25)' : '#27272a'}` }}>
            <Power size={16} style={{ color: config.enabled ? '#4ade80' : '#71717a' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm">
              Intelligence Hub {config.enabled
                ? <span className="text-[10px] font-bold ml-2 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>ATIVO</span>
                : <span className="text-[10px] font-bold ml-2 px-2 py-0.5 rounded-full"
                    style={{ background: '#27272a', color: '#71717a' }}>INATIVO</span>}
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {config.enabled
                ? 'Analyzers rodando, alertas sendo enviados aos gestores conforme regras de roteamento.'
                : 'Todos os analyzers e a entrega estão pausados. Ativar cria as 7 regras de roteamento default.'}
            </p>
          </div>
        </div>
        <button onClick={toggleEnable} disabled={saving}
          className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 shrink-0"
          style={{
            background: config.enabled ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.12)',
            color:      config.enabled ? '#f87171' : '#4ade80',
            border:     `1px solid ${config.enabled ? 'rgba(248,113,113,0.25)' : 'rgba(74,222,128,0.3)'}`,
          }}>
          {config.enabled ? 'Pausar' : 'Ativar Hub'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Analyzers */}
        <SectionCard title="Analyzers" icon={Brain} color="#a78bfa">
          <p className="text-[11px] text-zinc-500 mb-2">
            Cada analyzer roda automaticamente a cada 15 minutos. Score mínimo
            descarta sinais fracos antes do roteamento.
          </p>
          <div className="space-y-3">
            {ANALYZERS.map(a => {
              const cfg = config.analyzers_config?.[a.key] ?? {}
              const enabled = cfg.enabled !== false
              return (
                <div key={a.key} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: '#18181b', border: '1px solid #27272a' }}>
                  <span className="text-base shrink-0">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium" style={{ color: enabled ? '#fff' : '#71717a' }}>
                      {a.label}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      Min. score: {cfg.min_score ?? 20}
                    </p>
                  </div>
                  <NumberInput value={cfg.min_score ?? 20}
                    onChange={v => patchAnalyzer(a.key, 'min_score', Math.max(0, Math.min(100, v)))}
                    min={0} max={100} step={5} />
                  <Toggle checked={enabled}
                    onChange={v => patchAnalyzer(a.key, 'enabled', v)}
                    label="" />
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* Digest */}
        <SectionCard title="Digests" icon={Bell} color="#FFE600">
          <p className="text-[11px] text-zinc-500 mb-2">
            Alertas de severity warning/info são compilados em digests nestes horários
            (timezone: {config.digest_config?.timezone ?? 'America/Sao_Paulo'}).
          </p>
          <div className="space-y-2">
            {(['morning', 'afternoon', 'evening'] as const).map(window => (
              <div key={window} className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-300 capitalize">
                  {window === 'morning' ? 'Manhã' : window === 'afternoon' ? 'Tarde' : 'Noite'}
                </span>
                <TimeInput value={config.digest_config?.[window] ?? ''}
                  onChange={v => patch('digest_config', { ...config.digest_config, [window]: v })} />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Quiet hours */}
        <SectionCard title="Quiet hours" icon={Moon} color="#60a5fa">
          <p className="text-[11px] text-zinc-500 mb-2">
            Durante esse intervalo só alertas críticos passam. Atenções e infos esperam o digest.
          </p>
          <Toggle checked={config.quiet_hours?.enabled ?? false}
            onChange={v => patch('quiet_hours', { ...config.quiet_hours, enabled: v })}
            label="Ativar quiet hours" />
          {config.quiet_hours?.enabled && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">Início</span>
                <TimeInput value={config.quiet_hours?.start ?? ''}
                  onChange={v => patch('quiet_hours', { ...config.quiet_hours, start: v })} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">Fim</span>
                <TimeInput value={config.quiet_hours?.end ?? ''}
                  onChange={v => patch('quiet_hours', { ...config.quiet_hours, end: v })} />
              </div>
            </div>
          )}
        </SectionCard>

        {/* Anti-spam */}
        <SectionCard title="Limites anti-spam" icon={Zap} color="#f59e0b">
          <p className="text-[11px] text-zinc-500 mb-2">
            Previne fadiga de alertas — cada gestor tem teto de mensagens por dia
            e intervalo mínimo entre envios.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-zinc-300 flex-1">Máx. alertas por gestor/dia</span>
              <NumberInput value={config.max_alerts_per_manager_per_day}
                onChange={v => patch('max_alerts_per_manager_per_day', Math.max(1, Math.min(100, v)))}
                min={1} max={100} step={5} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-zinc-300 flex-1">Intervalo mín. entre alertas</span>
              <NumberInput value={config.min_interval_minutes}
                onChange={v => patch('min_interval_minutes', Math.max(1, Math.min(180, v)))}
                min={1} max={180} step={5} suffix="min" />
            </div>
          </div>
        </SectionCard>

        {/* Cross-intel */}
        <SectionCard title="Cross-intelligence" icon={Sparkles} color="#a78bfa">
          <Toggle checked={config.cross_intel_enabled}
            onChange={v => patch('cross_intel_enabled', v)}
            label="Ativar cruzamento de sinais"
            sub="Combina 2+ signals da mesma entidade (ex: ruptura + PO atrasada) num insight enriquecido. Roda a cada 30 minutos." />
        </SectionCard>

        {/* Learning */}
        <SectionCard title="Aprendizado adaptativo" icon={Brain} color="#4ade80">
          <Toggle checked={config.learning_enabled}
            onChange={v => patch('learning_enabled', v)}
            label="Ativar learning"
            sub="Calcula action_rate por gestor/categoria diariamente (03h). Os dados aparecem em Relatórios." />
          {config.learning_enabled && (
            <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t" style={{ borderColor: '#1e1e24' }}>
              <span className="text-sm text-zinc-300 flex-1">Janela de análise</span>
              <NumberInput value={config.learning_decay_days}
                onChange={v => patch('learning_decay_days', Math.max(7, Math.min(180, v)))}
                min={7} max={180} step={7} suffix="dias" />
            </div>
          )}
        </SectionCard>
      </div>

      {/* Routing rules */}
      <SectionCard title="Regras de roteamento" icon={Plus} color="#00E5FF">
        <p className="text-[11px] text-zinc-500 mb-2">
          Define qual departamento recebe qual tipo de alerta. Cada regra cobre
          um par (departamento × analyzer). Score mínimo filtra severity.
        </p>
        {rules.length === 0 ? (
          <div className="rounded-xl p-6 text-center">
            <AlertCircle size={20} className="mx-auto mb-2" style={{ color: '#71717a' }} />
            <p className="text-xs text-zinc-500">
              Nenhuma regra configurada. Ative o hub pra criar as 7 regras default automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {rules.map(rule => {
              const dept = DEPTS.find(d => d.value === rule.department)
              const analyzer = rule.analyzer === '*' ? 'Todos' : rule.analyzer
              const color = dept?.color ?? '#a1a1aa'
              return (
                <div key={rule.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                  style={{ background: '#18181b', border: '1px solid #27272a' }}>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${color}1a`, color, border: `1px solid ${color}33` }}>
                    {dept?.label ?? rule.department}
                  </span>
                  <span className="text-[11px] text-zinc-600">←</span>
                  <span className="text-xs text-zinc-300 capitalize flex-1">{analyzer}</span>
                  {rule.categories.length > 0 && (
                    <span className="text-[9px] text-zinc-600 hidden sm:inline">
                      {rule.categories.length} categoria{rule.categories.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500">score ≥</span>
                  <NumberInput value={rule.min_score}
                    onChange={v => patchRuleScore(rule, Math.max(0, Math.min(100, v)))}
                    min={0} max={100} step={5} />
                  <Toggle checked={rule.enabled}
                    onChange={() => toggleRule(rule)}
                    label="" />
                </div>
              )
            })}
          </div>
        )}
        <p className="text-[10px] text-zinc-700 leading-relaxed pt-2">
          Edição avançada de regras (categorias específicas, criar custom)
          <span style={{ opacity: 0.5 }}> em breve</span>. Por agora dá pra ajustar score
          mínimo e ligar/desligar regras.
        </p>
      </SectionCard>

      <p className="text-[10px] text-zinc-700 leading-relaxed pt-2">
        Mudanças aqui são aplicadas no próximo ciclo de cron (analyzers a cada 15min,
        digest na próxima janela configurada). Toggle de analyzer e min_score são
        respeitados em runtime; quiet_hours/anti-spam afetam todas as próximas
        entregas.
      </p>
    </div>
  )
}

