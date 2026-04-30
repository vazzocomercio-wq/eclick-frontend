'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Sparkles, Key, Cpu, BarChart3, Info,
  Save, RotateCcw, ExternalLink, AlertCircle, CheckCircle2,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from 'recharts'
import ApiKeysManager from '@/components/ai/ApiKeysManager'
import { AiModelSelector } from '@/components/ai/AiModelSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ────────────────────────────────────────────────────────────────

type TabKey = 'keys' | 'features' | 'usage' | 'about'
type Provider = 'anthropic' | 'openai'

interface MergedFeatureSetting {
  feature_key:       string
  label:             string
  description:       string
  primary_provider:  Provider
  primary_model:     string
  fallback_provider: Provider | null
  fallback_model:    string | null
  enabled:           boolean
  isDefault:         boolean
}

interface UsageData {
  total: { tokens_input: number; tokens_output: number; cost_usd: number; calls: number; fallback_calls: number }
  by_feature:  Array<{ feature: string; calls: number; tokens_total: number; cost_usd: number }>
  by_provider: Array<{ provider: string; calls: number; cost_usd: number }>
  by_day:      Array<{ date: string; cost_usd: number; by_feature: Record<string, number> }>
}

interface Toast { id: number; message: string; type: 'success' | 'error' }

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtUsd(n: number) { return `$${n.toFixed(4)}` }
function fmtNum(n: number) { return n.toLocaleString('pt-BR') }

const TAB_LABELS: Record<TabKey, { label: string; icon: React.ReactNode }> = {
  keys:     { label: 'Keys',                icon: <Key       size={12} /> },
  features: { label: 'Modelos por feature', icon: <Cpu       size={12} /> },
  usage:    { label: 'Uso',                 icon: <BarChart3 size={12} /> },
  about:    { label: 'Sobre',               icon: <Info      size={12} /> },
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function IaSettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<TabKey>('keys')
  const [toasts, setToasts] = useState<Toast[]>([])

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  function pushToast(message: string, type: Toast['type'] = 'success') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div>
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Configurações</p>
        <h1 className="text-white text-xl font-semibold flex items-center gap-2">
          <Sparkles size={18} style={{ color: '#00E5FF' }} /> Inteligência Artificial
        </h1>
        <p className="text-zinc-500 text-xs mt-0.5">API keys, modelos por feature, uso e custos</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        {(Object.keys(TAB_LABELS) as TabKey[]).map(k => (
          <button key={k} onClick={() => setTab(k)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: tab === k ? '#00E5FF' : 'transparent', color: tab === k ? '#000' : '#a1a1aa' }}>
            {TAB_LABELS[k].icon}{TAB_LABELS[k].label}
          </button>
        ))}
      </div>

      {tab === 'keys'     && <ApiKeysManager />}
      {tab === 'features' && <FeaturesTab getHeaders={getHeaders} onToast={pushToast} />}
      {tab === 'usage'    && <UsageTab    getHeaders={getHeaders} />}
      {tab === 'about'    && <AboutTab />}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{
              background: t.type === 'error' ? '#1a0a0a' : '#111114',
              border: `1px solid ${t.type === 'error' ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'}`,
              color: t.type === 'error' ? '#f87171' : '#4ade80',
            }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Tab 2 — MODELOS POR FEATURE
// ════════════════════════════════════════════════════════════════════════

function FeaturesTab({
  getHeaders, onToast,
}: {
  getHeaders: () => Promise<Record<string, string>>
  onToast: (msg: string, type?: Toast['type']) => void
}) {
  const [features, setFeatures] = useState<MergedFeatureSetting[]>([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ai/feature-settings`, { headers })
      if (res.ok) {
        const v = await res.json()
        setFeatures(Array.isArray(v) ? v : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="text-zinc-600 text-xs text-center py-8">Carregando…</p>

  return (
    <div className="space-y-3">
      <div className="rounded-xl px-4 py-3 text-[11px] flex items-start gap-2"
        style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)', color: '#a5f3fc' }}>
        <AlertCircle size={12} className="mt-0.5 shrink-0" />
        <span>Cada feature usa o modelo configurado abaixo. Se o primário falhar com erro 5xx ou timeout, o fallback assume automaticamente.</span>
      </div>

      {features.map(f => (
        <FeatureCard key={f.feature_key} feature={f} onToast={onToast} onChange={load} getHeaders={getHeaders} />
      ))}
    </div>
  )
}

function FeatureCard({
  feature, onToast, onChange, getHeaders,
}: {
  feature:    MergedFeatureSetting
  onToast:    (msg: string, type?: Toast['type']) => void
  onChange:   () => void
  getHeaders: () => Promise<Record<string, string>>
}) {
  const [primary, setPrimary]   = useState({ provider: feature.primary_provider, model: feature.primary_model })
  const [fallbackOn, setFallbackOn] = useState(!!feature.fallback_provider)
  const [fallback, setFallback] = useState({
    provider: (feature.fallback_provider ?? 'openai') as Provider,
    model:    feature.fallback_model ?? '',
  })
  const [saving, setSaving]   = useState(false)
  const [resetting, setResetting] = useState(false)

  // Sync state when parent reloads (e.g., after reset)
  useEffect(() => {
    setPrimary({ provider: feature.primary_provider, model: feature.primary_model })
    setFallbackOn(!!feature.fallback_provider)
    setFallback({
      provider: (feature.fallback_provider ?? 'openai') as Provider,
      model:    feature.fallback_model ?? '',
    })
  }, [feature])

  async function save() {
    if (!primary.provider || !primary.model) {
      onToast('Selecione provider e modelo primário', 'error')
      return
    }
    if (fallbackOn && (!fallback.provider || !fallback.model)) {
      onToast('Configure o fallback ou desligue o toggle', 'error')
      return
    }
    setSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ai/feature-settings/${feature.feature_key}`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          primary_provider:  primary.provider,
          primary_model:     primary.model,
          fallback_provider: fallbackOn ? fallback.provider : null,
          fallback_model:    fallbackOn ? fallback.model    : null,
          enabled:           true,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onToast(`${feature.label} salvo`, 'success')
      onChange()
    } catch (e) {
      onToast((e as Error).message, 'error')
    } finally { setSaving(false) }
  }

  async function reset() {
    if (!confirm(`Resetar "${feature.label}" pro padrão do sistema?`)) return
    setResetting(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ai/feature-settings/${feature.feature_key}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onToast(`${feature.label} resetado`, 'success')
      onChange()
    } catch (e) {
      onToast((e as Error).message, 'error')
    } finally { setResetting(false) }
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-zinc-100 text-sm font-semibold">{feature.label}</p>
            {feature.isDefault && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{ background: 'rgba(113,113,122,0.15)', color: '#a1a1aa' }}>Padrão do sistema</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">{feature.description}</p>
          <p className="text-[10px] text-zinc-700 font-mono mt-0.5">{feature.feature_key}</p>
        </div>
      </div>

      {/* Primary */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5 block">
          Modelo primário
        </label>
        <AiModelSelector
          value={primary}
          onChange={(v) => setPrimary({ provider: v.provider as Provider, model: v.model })} />
      </div>

      {/* Fallback toggle + selector */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={fallbackOn} onChange={e => setFallbackOn(e.target.checked)}
            className="w-3.5 h-3.5 accent-cyan-400" />
          <span className="text-[11px] text-zinc-300">Habilitar fallback</span>
          <span className="text-[10px] text-zinc-600">— assume automaticamente em caso de erro do primário</span>
        </label>
        {fallbackOn && (
          <AiModelSelector
            value={fallback}
            onChange={(v) => setFallback({ provider: v.provider as Provider, model: v.model })} />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {!feature.isDefault && (
          <button onClick={reset} disabled={resetting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-50"
            style={{ color: '#a1a1aa' }}>
            <RotateCcw size={11} /> {resetting ? 'Resetando…' : 'Resetar pro padrão'}
          </button>
        )}
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-60"
          style={{ background: '#00E5FF', color: '#000' }}>
          <Save size={11} /> {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Tab 3 — USO
// ════════════════════════════════════════════════════════════════════════

function UsageTab({ getHeaders }: { getHeaders: () => Promise<Record<string, string>> }) {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ai/feature-settings/usage?days=${days}`, { headers })
      if (res.ok) setData(await res.json())
    } finally { setLoading(false) }
  }, [getHeaders, days])

  useEffect(() => { load() }, [load])

  // Prepare chart data: stack feature costs per day
  const allFeatures = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    for (const d of data.by_day) for (const k of Object.keys(d.by_feature)) set.add(k)
    return [...set]
  }, [data])
  const chartData = useMemo(() => {
    if (!data) return []
    return data.by_day.map(d => {
      const row: Record<string, string | number> = { date: d.date.slice(5) }
      for (const f of allFeatures) row[f] = d.by_feature[f] ?? 0
      return row
    })
  }, [data, allFeatures])
  const featureColors = ['#00E5FF', '#a78bfa', '#facc15', '#fb923c', '#34d399']

  if (loading || !data) return <p className="text-zinc-600 text-xs text-center py-8">Carregando…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="bg-[#111114] border border-[#27272a] text-zinc-300 text-xs rounded-lg px-2 py-1.5">
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <UsageKpi label="Chamadas"     value={fmtNum(data.total.calls)}     color="#00E5FF" />
        <UsageKpi label="Custo total"  value={fmtUsd(data.total.cost_usd)}  color="#facc15" />
        <UsageKpi label="Tokens"       value={fmtNum(data.total.tokens_input + data.total.tokens_output)} color="#a78bfa" />
        <UsageKpi label="Fallback usado" value={fmtNum(data.total.fallback_calls)} color="#fb923c"
          sub={data.total.calls > 0 ? `${((data.total.fallback_calls / data.total.calls) * 100).toFixed(1)}% das chamadas` : undefined} />
      </div>

      {/* Stacked chart by feature */}
      <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Custo por dia (USD), empilhado por feature</h3>
        <div style={{ width: '100%', height: 240 }}>
          {chartData.length === 0 || allFeatures.length === 0 ? (
            <p className="text-xs text-zinc-600 italic flex items-center justify-center h-full">Sem dados ainda</p>
          ) : (
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" />
                <XAxis dataKey="date" stroke="#52525b" fontSize={10} />
                <YAxis stroke="#52525b" fontSize={10} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                <Tooltip contentStyle={{ background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
                  formatter={(v) => [`$${(Number(v) || 0).toFixed(5)}`, undefined]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {allFeatures.map((f, i) => (
                  <Line key={f} type="monotone" dataKey={f}
                    stroke={featureColors[i % featureColors.length]} strokeWidth={1.5} dot={false} name={f} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table by feature */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="px-5 py-3" style={{ borderBottom: '1px solid #1a1a1f' }}>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Por feature</h3>
        </div>
        <table className="w-full text-sm">
          <thead style={{ background: '#0a0a0e' }}>
            <tr className="text-zinc-500 text-[10px] uppercase tracking-wider">
              <th className="text-left px-4 py-2">Feature</th>
              <th className="text-right px-4 py-2">Chamadas</th>
              <th className="text-right px-4 py-2">Tokens</th>
              <th className="text-right px-4 py-2">Custo (USD)</th>
            </tr>
          </thead>
          <tbody>
            {data.by_feature.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-zinc-600 italic">Sem dados</td></tr>
            ) : data.by_feature.map(f => (
              <tr key={f.feature} className="border-t" style={{ borderColor: '#1e1e24' }}>
                <td className="px-4 py-2.5 text-zinc-200">{f.feature}</td>
                <td className="px-4 py-2.5 text-right text-zinc-400">{fmtNum(f.calls)}</td>
                <td className="px-4 py-2.5 text-right text-zinc-400">{fmtNum(f.tokens_total)}</td>
                <td className="px-4 py-2.5 text-right font-mono" style={{ color: '#facc15' }}>{fmtUsd(f.cost_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UsageKpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1.5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-500">{sub}</p>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Tab 4 — SOBRE
// ════════════════════════════════════════════════════════════════════════

function AboutTab() {
  return (
    <div className="space-y-3 max-w-2xl">
      <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-white text-sm font-semibold flex items-center gap-2">
          <Sparkles size={14} style={{ color: '#00E5FF' }} /> Como funciona
        </h3>
        <ol className="space-y-2 text-sm text-zinc-400 list-decimal list-inside">
          <li>Cada feature de IA (copy de campanha, atendente, embeddings, etc) usa um <strong className="text-zinc-200">modelo configurado</strong> nesta tela.</li>
          <li>Se você não configurar nada, a feature usa o <strong className="text-zinc-200">padrão do sistema</strong> — escolhido pelo nosso time.</li>
          <li>Se o modelo primário falhar com erro de servidor (5xx) ou timeout, o sistema <strong className="text-zinc-200">automaticamente tenta o fallback</strong>.</li>
          <li>Cada chamada é registrada em <code className="text-cyan-400">ai_usage_log</code> com tokens, custo e flag de fallback. Veja na aba <strong className="text-zinc-200">Uso</strong>.</li>
        </ol>
      </div>

      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-white text-sm font-semibold">Recursos externos</h3>
        <div className="space-y-1.5">
          <a href="https://docs.anthropic.com" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
            <ExternalLink size={12} /> Documentação Anthropic
          </a>
          <a href="https://platform.openai.com/docs" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
            <ExternalLink size={12} /> Documentação OpenAI
          </a>
          <a href="https://www.anthropic.com/pricing" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
            <ExternalLink size={12} /> Preços Anthropic (USD por 1M tokens)
          </a>
          <a href="https://openai.com/api/pricing" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
            <ExternalLink size={12} /> Preços OpenAI (USD por 1M tokens)
          </a>
        </div>
      </div>

      <div className="rounded-xl px-4 py-3 text-[11px] flex items-start gap-2"
        style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)', color: '#86efac' }}>
        <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
        <span>As chaves nunca são enviadas pro frontend. Toda chamada de IA passa pelo backend, que usa as chaves criptografadas armazenadas em <code>api_credentials</code>.</span>
      </div>
    </div>
  )
}
