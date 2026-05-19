'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  Sparkles, Key, Cpu, BarChart3, Info, Image as ImageIcon,
  Save, RotateCcw, ExternalLink, AlertCircle, CheckCircle2,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from 'recharts'
import ApiKeysManager from '@/components/ai/ApiKeysManager'
import { AiModelSelector } from '@/components/ai/AiModelSelector'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ────────────────────────────────────────────────────────────────

type TabKey = 'keys' | 'features' | 'images' | 'usage' | 'about'
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

const TAB_ICONS: Record<TabKey, React.ReactNode> = {
  keys:     <Key       size={12} />,
  features: <Cpu       size={12} />,
  images:   <ImageIcon size={12} />,
  usage:    <BarChart3 size={12} />,
  about:    <Info      size={12} />,
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function IaSettingsPage() {
  const t = useTranslations('configuracoes')
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
    <div className="p-6 space-y-5 min-h-full" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div>
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">{t('ia.breadcrumb')}</p>
        <h1 className="text-white text-xl font-semibold flex items-center gap-2">
          <Sparkles size={18} style={{ color: '#00E5FF' }} /> {t('ia.title')}
        </h1>
        <p className="text-zinc-500 text-xs mt-0.5">{t('ia.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        {(Object.keys(TAB_ICONS) as TabKey[]).map(k => (
          <button key={k} onClick={() => setTab(k)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: tab === k ? '#00E5FF' : 'transparent', color: tab === k ? '#000' : '#a1a1aa' }}>
            {TAB_ICONS[k]}{t(`ia.tab_${k}` as 'ia.tab_keys')}
          </button>
        ))}
      </div>

      {tab === 'keys'     && <ApiKeysManager />}
      {tab === 'features' && <FeaturesTab getHeaders={getHeaders} onToast={pushToast} />}
      {tab === 'images'   && <ImagesTab   getHeaders={getHeaders} onToast={pushToast} />}
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
  const t = useTranslations('configuracoes')
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

  if (loading) return <p className="text-zinc-600 text-xs text-center py-8">{t('ia.loading')}</p>

  return (
    <div className="space-y-3">
      <div className="rounded-xl px-4 py-3 text-[11px] flex items-start gap-2"
        style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)', color: '#a5f3fc' }}>
        <AlertCircle size={12} className="mt-0.5 shrink-0" />
        <span>{t('ia.featuresHint')}</span>
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
  const t = useTranslations('configuracoes')
  const [primary, setPrimary]   = useState({ provider: feature.primary_provider, model: feature.primary_model })
  const [fallbackOn, setFallbackOn] = useState(!!feature.fallback_provider)
  const [fallback, setFallback] = useState({
    provider: (feature.fallback_provider ?? 'openai') as Provider,
    model:    feature.fallback_model ?? '',
  })
  const [saving, setSaving]   = useState(false)
  const [resetting, setResetting] = useState(false)
  const confirm = useConfirm()

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
      onToast(t('ia.selectPrimary'), 'error')
      return
    }
    if (fallbackOn && (!fallback.provider || !fallback.model)) {
      onToast(t('ia.configureFallback'), 'error')
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
      onToast(t('ia.featureSaved', { label: feature.label }), 'success')
      onChange()
    } catch (e) {
      onToast((e as Error).message, 'error')
    } finally { setSaving(false) }
  }

  async function reset() {
    const ok = await confirm({
      title:        t('ia.resetTitle'),
      message:      t('ia.resetMessage', { label: feature.label }),
      confirmLabel: t('ia.resetConfirm'),
      variant:      'warning',
    })
    if (!ok) return
    setResetting(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ai/feature-settings/${feature.feature_key}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onToast(t('ia.featureReset', { label: feature.label }), 'success')
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
                style={{ background: 'rgba(113,113,122,0.15)', color: '#a1a1aa' }}>{t('ia.systemDefault')}</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">{feature.description}</p>
          <p className="text-[10px] text-zinc-700 font-mono mt-0.5">{feature.feature_key}</p>
        </div>
      </div>

      {/* Primary */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5 block">
          {t('ia.primaryModel')}
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
          <span className="text-[11px] text-zinc-300">{t('ia.enableFallback')}</span>
          <span className="text-[10px] text-zinc-600">{t('ia.fallbackHint')}</span>
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
            <RotateCcw size={11} /> {resetting ? t('ia.resetting') : t('ia.resetToDefault')}
          </button>
        )}
        <button onClick={save} disabled={saving}
          className="glow-rainbow flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-60"
          style={{ background: '#00E5FF', color: '#000' }}>
          <Save size={11} /> {saving ? t('ia.saving') : t('ia.save')}
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Tab 3 — USO
// ════════════════════════════════════════════════════════════════════════

function UsageTab({ getHeaders }: { getHeaders: () => Promise<Record<string, string>> }) {
  const t = useTranslations('configuracoes')
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

  if (loading || !data) return <p className="text-zinc-600 text-xs text-center py-8">{t('ia.loading')}</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="bg-[#111114] border border-[#27272a] text-zinc-300 text-xs rounded-lg px-2 py-1.5">
          <option value={7}>{t('ia.last7days')}</option>
          <option value={30}>{t('ia.last30days')}</option>
          <option value={90}>{t('ia.last90days')}</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <UsageKpi label={t('ia.kpiCalls')}     value={fmtNum(data.total.calls)}     color="#00E5FF" />
        <UsageKpi label={t('ia.kpiTotalCost')}  value={fmtUsd(data.total.cost_usd)}  color="#facc15" />
        <UsageKpi label={t('ia.kpiTokens')}       value={fmtNum(data.total.tokens_input + data.total.tokens_output)} color="#a78bfa" />
        <UsageKpi label={t('ia.kpiFallbackUsed')} value={fmtNum(data.total.fallback_calls)} color="#fb923c"
          sub={data.total.calls > 0 ? t('ia.percentOfCalls', { pct: ((data.total.fallback_calls / data.total.calls) * 100).toFixed(1) }) : undefined} />
      </div>

      {/* Stacked chart by feature */}
      <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">{t('ia.costPerDayChart')}</h3>
        <div style={{ width: '100%', height: 240 }}>
          {chartData.length === 0 || allFeatures.length === 0 ? (
            <p className="text-xs text-zinc-600 italic flex items-center justify-center h-full">{t('ia.noDataYet')}</p>
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
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{t('ia.byFeature')}</h3>
        </div>
        <table className="w-full text-sm">
          <thead style={{ background: '#0a0a0e' }}>
            <tr className="text-zinc-500 text-[10px] uppercase tracking-wider">
              <th className="text-left px-4 py-2">{t('ia.colFeature')}</th>
              <th className="text-right px-4 py-2">{t('ia.colCalls')}</th>
              <th className="text-right px-4 py-2">{t('ia.colTokens')}</th>
              <th className="text-right px-4 py-2">{t('ia.colCostUsd')}</th>
            </tr>
          </thead>
          <tbody>
            {data.by_feature.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-zinc-600 italic">{t('ia.noData')}</td></tr>
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
  const t = useTranslations('configuracoes')
  const strong = (chunks: React.ReactNode) => <strong className="text-zinc-200">{chunks}</strong>
  const code = (chunks: React.ReactNode) => <code className="text-cyan-400">{chunks}</code>
  return (
    <div className="space-y-3 max-w-2xl">
      <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-white text-sm font-semibold flex items-center gap-2">
          <Sparkles size={14} style={{ color: '#00E5FF' }} /> {t('ia.howItWorks')}
        </h3>
        <ol className="space-y-2 text-sm text-zinc-400 list-decimal list-inside">
          <li>{t.rich('ia.howStep1', { strong })}</li>
          <li>{t.rich('ia.howStep2', { strong })}</li>
          <li>{t.rich('ia.howStep3', { strong })}</li>
          <li>{t.rich('ia.howStep4', { strong, code })}</li>
        </ol>
      </div>

      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-white text-sm font-semibold">{t('ia.externalResources')}</h3>
        <div className="space-y-1.5">
          <a href="https://docs.anthropic.com" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
            <ExternalLink size={12} /> {t('ia.docsAnthropic')}
          </a>
          <a href="https://platform.openai.com/docs" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
            <ExternalLink size={12} /> {t('ia.docsOpenai')}
          </a>
          <a href="https://www.anthropic.com/pricing" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
            <ExternalLink size={12} /> {t('ia.pricingAnthropic')}
          </a>
          <a href="https://openai.com/api/pricing" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 text-sm text-cyan-400 hover:underline">
            <ExternalLink size={12} /> {t('ia.pricingOpenai')}
          </a>
        </div>
      </div>

      <div className="rounded-xl px-4 py-3 text-[11px] flex items-start gap-2"
        style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)', color: '#86efac' }}>
        <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
        <span>{t.rich('ia.keysSecurityNote', { code: (chunks) => <code>{chunks}</code> })}</span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Tab — IMAGENS (campaign_card + Canva + custos)
// ════════════════════════════════════════════════════════════════════════

interface CanvaStatus {
  connected:   boolean
  configured:  boolean
  expires_at?: string | null
}

function ImagesTab({
  getHeaders, onToast,
}: {
  getHeaders: () => Promise<Record<string, string>>
  onToast: (msg: string, type?: Toast['type']) => void
}) {
  const t = useTranslations('configuracoes')
  const [feature, setFeature] = useState<MergedFeatureSetting | null>(null)
  const [canva, setCanva]     = useState<CanvaStatus | null>(null)
  const [usage, setUsage]     = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const [fRes, cRes, uRes] = await Promise.all([
        fetch(`${BACKEND}/ai/feature-settings`, { headers }),
        fetch(`${BACKEND}/canva/oauth/status`, { headers }),
        fetch(`${BACKEND}/ai/feature-settings/usage?days=30`, { headers }),
      ])
      if (fRes.ok) {
        const list = await fRes.json() as MergedFeatureSetting[]
        setFeature(list.find(f => f.feature_key === 'campaign_card') ?? null)
      }
      if (cRes.ok) setCanva(await cRes.json() as CanvaStatus)
      if (uRes.ok) setUsage(await uRes.json() as UsageData)
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { loadAll() }, [loadAll])

  async function connectCanva() {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/canva/oauth/start`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { authorize_url?: string }
      if (data.authorize_url) window.location.href = data.authorize_url
      else throw new Error(t('ia.authorizeUrlMissing'))
    } catch (e) {
      onToast((e as Error).message, 'error')
    }
  }

  if (loading) return <p className="text-zinc-600 text-xs text-center py-8">{t('ia.loading')}</p>

  // ── Custos da feature campaign_card (filter client-side) ─────────────────
  const cardUsage = usage?.by_feature.find(f => f.feature === 'campaign_card')
  const lastDayWithCardCost = usage?.by_day
    .slice()
    .reverse()
    .find(d => (d.by_feature['campaign_card'] ?? 0) > 0)
  const lastGenLabel = lastDayWithCardCost
    ? relativeDays(lastDayWithCardCost.date, t)
    : t('ia.never')

  return (
    <div className="space-y-3">
      {/* Card 1 — Feature settings campaign_card */}
      <div className="rounded-xl px-4 py-3 text-[11px] flex items-start gap-2"
        style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)', color: '#a5f3fc' }}>
        <AlertCircle size={12} className="mt-0.5 shrink-0" />
        <span>{t.rich('ia.imagesHint', { strong: (c) => <strong>{c}</strong>, code: (c) => <code>{c}</code> })}</span>
      </div>

      {feature ? (
        <FeatureCard feature={feature} onToast={onToast} onChange={loadAll} getHeaders={getHeaders} />
      ) : (
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <p className="text-zinc-500 text-xs">{t.rich('ia.featureNotFound', { code: (c) => <code>{c}</code> })}</p>
        </div>
      )}

      {/* Card 2 — Conexão Canva */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div>
          <p className="text-zinc-100 text-sm font-semibold flex items-center gap-2">
            <ExternalLink size={14} style={{ color: '#a78bfa' }} /> {t('ia.canvaConnection')}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{t('ia.canvaConnectionDesc')}</p>
        </div>

        {!canva?.configured && (
          <div className="rounded-xl px-3 py-2 text-[11px] flex items-start gap-2"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fcd34d' }}>
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{t('ia.canvaUnavailable')}</span>
          </div>
        )}

        {canva?.configured && !canva.connected && (
          <button onClick={connectCanva}
            className="px-4 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
            style={{ background: '#00E5FF', color: '#000' }}>
            <ExternalLink size={11} /> {t('ia.connectCanva')}
          </button>
        )}

        {canva?.connected && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide flex items-center gap-1"
                style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                <CheckCircle2 size={10} /> {t('ia.connected')}
              </span>
              {canva.expires_at && (
                <span className="text-[10px] text-zinc-500">
                  {t('ia.tokenExpiresAutoRenew', { when: relativeFromNow(canva.expires_at, t) })}
                </span>
              )}
            </div>
            <button disabled
              className="px-3 py-1 rounded-lg text-[10px] font-medium opacity-40 cursor-not-allowed"
              style={{ color: '#a1a1aa', border: '1px solid #27272a' }}>
              {t('ia.disconnectSoon')}
            </button>
          </div>
        )}
      </div>

      {/* Card 3 — Custos da feature de imagens */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div>
          <p className="text-zinc-100 text-sm font-semibold flex items-center gap-2">
            <BarChart3 size={14} style={{ color: '#facc15' }} /> {t('ia.costsLast30days')}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{t.rich('ia.costsImagesNote', { strong: (c) => <strong>{c}</strong>, code: (c) => <code>{c}</code> })}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <UsageKpi label={t('ia.imagesGenerated')} value={fmtNum(cardUsage?.calls ?? 0)} color="#00E5FF" />
          <UsageKpi label={t('ia.kpiTotalCost')}     value={fmtUsd(cardUsage?.cost_usd ?? 0)} color="#facc15" />
          <UsageKpi label={t('ia.lastGeneration')}  value={lastGenLabel} color="#a78bfa" />
        </div>
      </div>
    </div>
  )
}

// ── Helpers compartilhados pela aba Imagens ─────────────────────────────────

type Translate = (key: string, values?: Record<string, string | number>) => string

function relativeDays(dateStr: string, t: Translate): string {
  const d = new Date(dateStr)
  const ms = Date.now() - d.getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days <= 0) return t('ia.relToday')
  if (days === 1) return t('ia.relYesterday')
  if (days < 30) return t('ia.relDaysAgo', { days })
  if (days < 365) return t('ia.relMonthsAgo', { months: Math.floor(days / 30) })
  return t('ia.relYearsAgo', { years: Math.floor(days / 365) })
}

function relativeFromNow(iso: string, t: Translate): string {
  const ms = new Date(iso).getTime() - Date.now()
  const mins = Math.round(ms / 60_000)
  if (mins <= 0) return t('ia.relExpired')
  if (mins < 60) return t('ia.relInMinutes', { mins })
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return t('ia.relInHours', { hrs })
  return t('ia.relInDays', { days: Math.round(hrs / 24) })
}
