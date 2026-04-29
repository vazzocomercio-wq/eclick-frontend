'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Database, BarChart3, Settings as SettingsIcon, Route as RouteIcon,
  Send, MessageCircle, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Save, Sparkles, Zap, Play, Pause, Clock, DollarSign,
  Users, Target, TrendingUp,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from 'recharts'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Provider catalog (copy of constants from old page) ────────────────────

const PROVIDER_META: Record<string, { label: string; strength: string; key_format: string; cost_brl: string; uses_secret: boolean }> = {
  bigdatacorp: { label: 'Big Data Corp',      strength: 'Sociodemográficos, score, vínculos.',  key_format: 'AccessToken:TokenId', cost_brl: '~R$ 0,30', uses_secret: false },
  directdata:  { label: 'Direct Data',        strength: '300+ fontes, foco compliance/KYC.',    key_format: 'token único',         cost_brl: '~R$ 0,40', uses_secret: false },
  datastone:   { label: 'Data Stone',         strength: 'Telefone/WhatsApp atualizado.',         key_format: 'Bearer JWT',          cost_brl: '~R$ 0,50', uses_secret: false },
  assertiva:   { label: 'Assertiva Soluções', strength: 'Localização, telefone, endereço.',      key_format: 'client_id:client_secret', cost_brl: '~R$ 0,35', uses_secret: false },
  hubdev:      { label: 'Hub do Desenvolvedor', strength: 'Mais barato, ideal pra fallback.',  key_format: 'token único',         cost_brl: '~R$ 0,15', uses_secret: false },
  viacep:      { label: 'ViaCEP',             strength: 'Grátis, oficial Correios. Só CEP.',   key_format: '— sem auth',          cost_brl: 'Grátis',   uses_secret: false },
}
const PROVIDER_ORDER = ['bigdatacorp', 'directdata', 'datastone', 'assertiva', 'hubdev', 'viacep']
const QUERY_TYPES = ['cpf', 'cnpj', 'phone', 'whatsapp', 'email', 'cep'] as const
type QueryType = typeof QUERY_TYPES[number]

// ── Types ────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'providers' | 'routing' | 'batch' | 'templates'

interface Provider {
  id?: string
  organization_id: string
  provider_code: string
  display_name: string
  is_enabled: boolean
  api_key: string | null
  api_secret: string | null
  base_url: string | null
  cost_per_query_cents: number
  monthly_budget_brl: number | null
  monthly_spent_brl: number
}

interface Routing {
  query_type:       QueryType
  primary_provider: string
  fallback_1:       string | null
  fallback_2:       string | null
  fallback_3:       string | null
  cache_ttl_days:   number
  max_retries:      number
}

interface Kpis {
  enriched_full:    number
  enriched_partial: number
  total:            number
  success_rate_30d: number
  cost_mtd_brl:     number
  budget_total_brl: number
  pending_count:    number
}

interface TimeseriesPoint {
  date:        string
  success:     number
  failed:      number
  by_provider: Record<string, number>
}

interface RecentFailure {
  log_id:        string
  customer_id:   string | null
  customer_name: string | null
  cpf:           string | null
  provider:      string | null
  final_status:  string
  error_reason:  string
  last_error:    string
  created_at:    string
}

interface QueueStats {
  pending:        number
  failed:         number
  total_eligible: number
  estimated_cost: number
}

interface Settings {
  auto_enrichment_enabled:   boolean
  post_enrich_delay_minutes: number
}

interface PostEnrichTemplate {
  id:            string | null
  name:          string
  message_body:  string
  is_active:     boolean
  delay_minutes: number
}

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtBRL(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%` }
function fmtNum(n: number) { return n.toLocaleString('pt-BR') }
function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const REASON_LABEL: Record<string, { label: string; color: string }> = {
  no_consent:   { label: 'Sem consent',    color: '#a78bfa' },
  no_credit:    { label: 'Sem crédito',    color: '#f59e0b' },
  rate_limited: { label: 'Rate limit',     color: '#fb923c' },
  not_found:    { label: 'Não encontrado', color: '#71717a' },
  api_error:    { label: 'Erro da API',    color: '#f87171' },
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function EnriquecimentoPage() {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<TabKey>('overview')
  const [settings, setSettings] = useState<Settings>({ auto_enrichment_enabled: true, post_enrich_delay_minutes: 5 })
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
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // Load settings on mount
  useEffect(() => {
    (async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(`${BACKEND}/enrichment/auto-enabled`, { headers })
        if (res.ok) setSettings(await res.json())
      } catch { /* silent */ }
    })()
  }, [getHeaders])

  async function toggleAuto() {
    const next = !settings.auto_enrichment_enabled
    setSettings(s => ({ ...s, auto_enrichment_enabled: next }))
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/auto-enabled`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ auto_enrichment_enabled: next }),
      })
      if (!res.ok) throw new Error('Falha ao salvar')
      pushToast(next ? 'Enriquecimento automático ativado' : 'Enriquecimento automático desativado', 'success')
    } catch (e) {
      // Revert on error
      setSettings(s => ({ ...s, auto_enrichment_enabled: !next }))
      pushToast((e as Error).message, 'error')
    }
  }

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">CRM</p>
          <h1 className="text-white text-xl font-semibold flex items-center gap-2">
            <Database size={18} style={{ color: '#00E5FF' }} /> Enriquecimento de Dados
          </h1>
          <p className="text-zinc-500 text-xs mt-0.5">Identidade, telefone e WhatsApp dos seus clientes</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleAuto}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: settings.auto_enrichment_enabled ? 'rgba(74,222,128,0.10)' : '#111114',
              border: `1px solid ${settings.auto_enrichment_enabled ? 'rgba(74,222,128,0.4)' : '#27272a'}`,
              color: settings.auto_enrichment_enabled ? '#4ade80' : '#a1a1aa',
            }}>
            <span className="relative inline-flex h-4 w-7 rounded-full transition-colors"
              style={{ background: settings.auto_enrichment_enabled ? '#4ade80' : '#3f3f46' }}>
              <span className="inline-block h-3 w-3 rounded-full bg-white shadow-md transition-transform"
                style={{ transform: settings.auto_enrichment_enabled ? 'translateX(14px)' : 'translateX(2px)', marginTop: '2px' }} />
            </span>
            Enriquecimento automático: {settings.auto_enrichment_enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        {([
          { k: 'overview',  l: 'Visão geral',     icon: <BarChart3 size={12} /> },
          { k: 'providers', l: 'Provedores',      icon: <SettingsIcon size={12} /> },
          { k: 'routing',   l: 'Roteamento',      icon: <RouteIcon size={12} /> },
          { k: 'batch',     l: 'Disparo em massa', icon: <Send size={12} /> },
          { k: 'templates', l: 'Templates',       icon: <MessageCircle size={12} /> },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: tab === t.k ? '#00E5FF' : 'transparent', color: tab === t.k ? '#000' : '#a1a1aa' }}>
            {t.icon}{t.l}
          </button>
        ))}
      </div>

      {tab === 'overview'  && <OverviewTab  getHeaders={getHeaders} onToast={pushToast} />}
      {tab === 'providers' && <ProvidersTab getHeaders={getHeaders} />}
      {tab === 'routing'   && <RoutingTab   getHeaders={getHeaders} />}
      {tab === 'batch'     && <BatchTab     getHeaders={getHeaders} onToast={pushToast} />}
      {tab === 'templates' && <TemplatesTab getHeaders={getHeaders} onToast={pushToast} />}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{
              background: t.type === 'error' ? '#1a0a0a' : '#111114',
              border: `1px solid ${t.type === 'error' ? 'rgba(248,113,113,0.3)' : t.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(0,229,255,0.3)'}`,
              color: t.type === 'error' ? '#f87171' : t.type === 'success' ? '#4ade80' : '#00E5FF',
            }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Tab 1 — VISÃO GERAL
// ════════════════════════════════════════════════════════════════════════

function OverviewTab({
  getHeaders, onToast,
}: {
  getHeaders: () => Promise<Record<string, string>>
  onToast: (msg: string, type?: Toast['type']) => void
}) {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [series, setSeries] = useState<TimeseriesPoint[]>([])
  const [failures, setFailures] = useState<RecentFailure[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [retrying, setRetrying] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const [kRes, tRes, fRes] = await Promise.all([
        fetch(`${BACKEND}/enrichment/dashboard/kpis`,        { headers }),
        fetch(`${BACKEND}/enrichment/dashboard/timeseries?days=30`, { headers }),
        fetch(`${BACKEND}/enrichment/recent-failures?limit=20`, { headers }),
      ])
      if (kRes.ok) setKpis(await kRes.json())
      if (tRes.ok) {
        const v = await tRes.json()
        setSeries(Array.isArray(v) ? v : [])
      }
      if (fRes.ok) {
        const v = await fRes.json()
        setFailures(Array.isArray(v) ? v : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  async function retry(id: string) {
    setRetrying(id)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/retry/${id}`, { method: 'POST', headers })
      const v = await res.json().catch(() => ({}))
      onToast(v?.status === 'full' || v?.status === 'partial' ? 'Cliente enriquecido' : 'Tentativa falhou de novo', v?.status === 'full' || v?.status === 'partial' ? 'success' : 'error')
      await load()
    } finally { setRetrying(null) }
  }

  async function processPending() {
    if (!kpis || kpis.pending_count === 0) return
    setRunning(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/batch`, {
        method: 'POST', headers,
        body: JSON.stringify({ limit: 50, status_filter: 'pending' }),
      })
      const v = await res.json().catch(() => ({}))
      onToast(`Processados ${v?.processed ?? 0}: full=${v?.full ?? 0} partial=${v?.partial ?? 0} failed=${v?.failed ?? 0}`, 'info')
      await load()
    } finally { setRunning(false) }
  }

  const filteredFailures = filter ? failures.filter(f => f.error_reason === filter) : failures
  const successPct = kpis && kpis.total > 0 ? ((kpis.enriched_full + kpis.enriched_partial) / kpis.total) : 0
  const budgetPct = kpis && kpis.budget_total_brl > 0 ? (kpis.cost_mtd_brl / kpis.budget_total_brl) : 0

  // Recharts data: prepara provider stack
  const allProviders = useMemo(() => {
    const set = new Set<string>()
    for (const p of series) for (const k of Object.keys(p.by_provider)) set.add(k)
    return [...set].slice(0, 4)
  }, [series])
  const providerColors = ['#00E5FF', '#a78bfa', '#facc15', '#fb923c']

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Clientes enriquecidos" icon={<Users size={13} />} color="#4ade80"
          value={loading || !kpis ? '…' : `${kpis.enriched_full + kpis.enriched_partial}`}
          sub={kpis && kpis.total > 0 ? `${fmtPct(successPct)} de ${fmtNum(kpis.total)}` : 'sem dados'}
          progressPct={successPct * 100} progressColor="#4ade80" />

        <KpiCard label="Taxa de sucesso (30d)" icon={<Target size={13} />} color="#00E5FF"
          value={loading || !kpis ? '…' : fmtPct(kpis.success_rate_30d)}
          sub="das chamadas no período" />

        <KpiCard label="Custo do mês" icon={<DollarSign size={13} />} color={budgetPct > 0.9 ? '#f87171' : '#facc15'}
          value={loading || !kpis ? '…' : fmtBRL(kpis.cost_mtd_brl)}
          sub={kpis && kpis.budget_total_brl > 0 ? `de ${fmtBRL(kpis.budget_total_brl)} (${(budgetPct * 100).toFixed(0)}%)` : 'sem budget'}
          progressPct={budgetPct * 100} progressColor={budgetPct > 0.9 ? '#f87171' : budgetPct > 0.7 ? '#facc15' : '#4ade80'} />

        <KpiCardWithAction label="Pendentes" icon={<Clock size={13} />} color="#fb923c"
          value={loading || !kpis ? '…' : fmtNum(kpis.pending_count)}
          sub="aguardando processamento"
          actionLabel={running ? 'Processando…' : 'Enriquecer agora'}
          onAction={processPending}
          disabled={running || !kpis || kpis.pending_count === 0} />
      </div>

      {/* Timeseries chart */}
      <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={13} className="text-cyan-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Chamadas por dia (30d)</h3>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium border"
            style={{ borderColor: '#27272a', color: '#a1a1aa' }}>
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
        <div style={{ width: '100%', height: 220 }}>
          {series.length === 0 ? (
            <p className="text-xs text-zinc-600 italic flex items-center justify-center h-full">Sem dados ainda</p>
          ) : (
            <ResponsiveContainer>
              <LineChart data={series} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" />
                <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis stroke="#52525b" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0a0a0e', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="success" stroke="#4ade80" strokeWidth={2} dot={false} name="Sucesso" />
                <Line type="monotone" dataKey="failed"  stroke="#f87171" strokeWidth={2} dot={false} name="Falha" />
                {allProviders.map((p, i) => (
                  <Line key={p} type="monotone"
                    dataKey={(d: TimeseriesPoint) => d.by_provider[p] ?? 0}
                    stroke={providerColors[i]} strokeWidth={1} strokeDasharray="2 2" dot={false}
                    name={PROVIDER_META[p]?.label ?? p} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent failures */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #1a1a1f' }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={13} className="text-red-400" />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Falhas recentes</h3>
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="text-[10px] bg-[#0a0a0e] border border-[#27272a] text-zinc-300 rounded-lg px-2 py-1">
            <option value="">Todos motivos</option>
            {Object.entries(REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600" style={{ borderBottom: '1px solid #1a1a1f' }}>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">CPF</th>
                <th className="px-3 py-2 font-semibold">Provider</th>
                <th className="px-3 py-2 font-semibold">Motivo</th>
                <th className="px-3 py-2 font-semibold text-right">Quando</th>
                <th className="px-3 py-2 font-semibold text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-zinc-600">Carregando…</td></tr>
              ) : filteredFailures.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-zinc-600 italic">Nenhuma falha — show!</td></tr>
              ) : filteredFailures.map(f => {
                const r = REASON_LABEL[f.error_reason] ?? { label: f.error_reason, color: '#a1a1aa' }
                return (
                  <tr key={f.log_id} className="hover:bg-[#161618]">
                    <td className="px-3 py-2.5 text-xs text-zinc-200 truncate max-w-[180px]">{f.customer_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-zinc-500 font-mono">{f.cpf ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[11px] text-zinc-400">{f.provider ? (PROVIDER_META[f.provider]?.label ?? f.provider) : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{ color: r.color, background: r.color + '15' }}>{r.label}</span>
                      {f.last_error && <p className="text-[9px] text-zinc-600 truncate max-w-[200px] mt-0.5">{f.last_error}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[10px] text-zinc-500">{ago(f.created_at)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {f.customer_id && (
                        <button onClick={() => retry(f.customer_id!)} disabled={retrying === f.customer_id}
                          className="text-[10px] px-2 py-1 rounded-md font-semibold disabled:opacity-50"
                          style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
                          {retrying === f.customer_id ? '…' : 'Tentar de novo'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label, icon, color, value, sub, progressPct, progressColor,
}: {
  label: string; icon: React.ReactNode; color: string; value: string; sub?: string;
  progressPct?: number; progressColor?: string
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 min-h-[120px] justify-between"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-500">{sub}</p>}
      {progressPct != null && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: '#18181b' }}>
          <div className="h-full transition-all" style={{ width: `${Math.min(100, progressPct)}%`, background: progressColor ?? color }} />
        </div>
      )}
    </div>
  )
}

function KpiCardWithAction({
  label, icon, color, value, sub, actionLabel, onAction, disabled,
}: {
  label: string; icon: React.ReactNode; color: string; value: string; sub?: string;
  actionLabel: string; onAction: () => void; disabled?: boolean
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 min-h-[120px] justify-between"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-500">{sub}</p>}
      <button onClick={onAction} disabled={disabled}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold disabled:opacity-40"
        style={{ background: color + '15', color, border: `1px solid ${color}33` }}>
        <Zap size={10} /> {actionLabel}
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Tab 2 — PROVEDORES (port da UI antiga)
// ════════════════════════════════════════════════════════════════════════

function ProvidersTab({ getHeaders }: { getHeaders: () => Promise<Record<string, string>> }) {
  const [list, setList] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/providers`, { headers })
      if (res.ok) {
        const v = await res.json()
        setList(Array.isArray(v) ? v : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders])
  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-zinc-600 text-xs text-center py-8">Carregando…</p>
      ) : PROVIDER_ORDER.map(code => {
        const meta = PROVIDER_META[code]
        const existing = list.find(p => p.provider_code === code)
        const seed: Provider = existing ?? {
          organization_id: '', provider_code: code, display_name: meta.label,
          is_enabled: false, api_key: null, api_secret: null, base_url: null,
          cost_per_query_cents: 0, monthly_budget_brl: null, monthly_spent_brl: 0,
        }
        return <ProviderCard key={code} meta={meta} initial={seed} onChange={load} getHeaders={getHeaders} />
      })}
    </div>
  )
}

function ProviderCard({
  meta, initial, onChange, getHeaders,
}: {
  meta: { label: string; strength: string; key_format: string; cost_brl: string; uses_secret: boolean }
  initial: Provider
  onChange: () => void
  getHeaders: () => Promise<Record<string, string>>
}) {
  const [p, setP] = useState<Provider>(initial)
  useEffect(() => { setP(initial) }, [initial])
  const [saving, setSaving]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [testRes, setTestRes] = useState<{ ok: boolean; message: string } | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const spentPct = p.monthly_budget_brl && p.monthly_budget_brl > 0
    ? Math.min(100, (Number(p.monthly_spent_brl) / Number(p.monthly_budget_brl)) * 100)
    : 0

  const inp = 'w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'

  async function save() {
    setSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/providers/${p.provider_code}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          display_name: p.display_name,
          is_enabled: p.is_enabled,
          api_key: p.api_key,
          api_secret: p.api_secret,
          base_url: p.base_url,
          monthly_budget_brl: p.monthly_budget_brl,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || body === null) return
      setSavedAt(Date.now())
      onChange()
    } finally { setSaving(false) }
  }

  async function test() {
    setTesting(true); setTestRes(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/providers/${p.provider_code}/test`, { method: 'POST', headers })
      const v = await res.json().catch(() => ({}))
      setTestRes(v && typeof v.ok === 'boolean' ? v : { ok: false, message: 'Erro' })
    } finally { setTesting(false) }
  }

  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>
            <Sparkles size={15} />
          </div>
          <div>
            <p className="text-zinc-100 text-sm font-semibold">{meta.label}</p>
            <p className="text-[11px] text-zinc-500">{meta.strength} · {meta.cost_brl}</p>
          </div>
        </div>
        <Toggle label={p.is_enabled ? 'Habilitado' : 'Desabilitado'} value={p.is_enabled} onChange={v => setP({ ...p, is_enabled: v })} />
      </div>

      {p.provider_code !== 'viacep' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400">API Key</label>
            <input type="password" className={inp + ' font-mono'}
              value={p.api_key ?? ''}
              onChange={e => setP({ ...p, api_key: e.target.value })}
              placeholder={meta.key_format} />
            <p className="text-[10px] text-zinc-600">Formato: {meta.key_format}</p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-zinc-400">Orçamento mensal (R$)</label>
            <input type="number" className={inp + ' tabular-nums'}
              value={p.monthly_budget_brl ?? ''}
              onChange={e => setP({ ...p, monthly_budget_brl: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="ex: 100" />
            {p.monthly_budget_brl != null && (
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>R$ {Number(p.monthly_spent_brl).toFixed(2)} / R$ {Number(p.monthly_budget_brl).toFixed(2)}</span>
                  <span>{spentPct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#18181b' }}>
                  <div className="h-full transition-all"
                    style={{ width: `${spentPct}%`, background: spentPct > 90 ? '#f87171' : spentPct > 70 ? '#facc15' : '#4ade80' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        <div className="flex items-center gap-2">
          {savedAt ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400"><CheckCircle2 size={12} /> Salvo</div>
          ) : testRes ? (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: testRes.ok ? '#4ade80' : '#f87171' }}>
              {testRes.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              <span className="truncate max-w-xs">{testRes.message}</span>
            </div>
          ) : p.is_enabled ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ativo</span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-zinc-600"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> Desabilitado</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {p.provider_code !== 'viacep' && (
            <button onClick={test} disabled={testing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-60"
              style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
              <Zap size={11} /> {testing ? 'Testando…' : 'Testar'}
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-60"
            style={{ background: '#00E5FF', color: '#000' }}>
            <Save size={11} /> {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium"
      style={{ background: value ? 'rgba(74,222,128,0.10)' : '#18181b', color: value ? '#4ade80' : '#a1a1aa', border: `1px solid ${value ? 'rgba(74,222,128,0.3)' : '#27272a'}` }}>
      <span className="relative inline-flex h-3 w-6 rounded-full" style={{ background: value ? '#4ade80' : '#3f3f46' }}>
        <span className="inline-block h-2 w-2 rounded-full bg-white" style={{ transform: value ? 'translateX(14px)' : 'translateX(2px)', marginTop: '2px' }} />
      </span>
      {label}
    </button>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Tab 3 — ROTEAMENTO
// ════════════════════════════════════════════════════════════════════════

function RoutingTab({ getHeaders }: { getHeaders: () => Promise<Record<string, string>> }) {
  const [rows, setRows] = useState<Routing[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/routing`, { headers })
      if (res.ok) {
        const v = await res.json()
        setRows(Array.isArray(v) ? v : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders])
  useEffect(() => { load() }, [load])

  function update(qt: QueryType, patch: Partial<Routing>) {
    setRows(prev => prev.map(r => r.query_type === qt ? { ...r, ...patch } : r))
  }
  async function save(qt: QueryType) {
    const r = rows.find(x => x.query_type === qt)
    if (!r) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/enrichment/routing/${qt}`, { method: 'PATCH', headers, body: JSON.stringify(r) })
    await load()
  }

  if (loading) return <p className="text-zinc-600 text-xs text-center py-8">Carregando…</p>

  const inp = 'w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-xs rounded-lg px-2 py-1.5'

  return (
    <div className="space-y-3">
      <div className="rounded-xl px-4 py-3 text-[11px] flex items-start gap-2"
        style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)', color: '#a5f3fc' }}>
        <AlertCircle size={12} className="mt-0.5 shrink-0" />
        <span>DirectData é mais barato para CPF (~R$0,40), DataStone tem maior cobertura de WhatsApp (~R$0,50). Ajuste o cascade conforme prioridade da query.</span>
      </div>

      {QUERY_TYPES.map(qt => {
        const r = rows.find(x => x.query_type === qt)
        if (!r) return null
        const cascade = [r.primary_provider, r.fallback_1, r.fallback_2, r.fallback_3].filter(Boolean) as string[]
        return (
          <div key={qt} className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{qt.toUpperCase()}</p>
              <button onClick={() => save(qt)}
                className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-lg font-semibold"
                style={{ background: '#00E5FF', color: '#000' }}>
                <Save size={10} /> Salvar
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              {(['primary_provider', 'fallback_1', 'fallback_2', 'fallback_3'] as const).map((slot, i) => (
                <div key={slot} className="space-y-0.5">
                  <label className="text-[10px] text-zinc-500">{i === 0 ? 'Primário' : `Fallback ${i}`}</label>
                  <select className={inp} value={r[slot] ?? ''}
                    onChange={e => update(qt, { [slot]: e.target.value || null } as Partial<Routing>)}>
                    <option value="">— nenhum —</option>
                    {PROVIDER_ORDER.map(c => <option key={c} value={c}>{PROVIDER_META[c].label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-[10px] text-zinc-500 shrink-0">Cache (dias)</label>
                <input type="range" min={1} max={365} value={r.cache_ttl_days}
                  onChange={e => update(qt, { cache_ttl_days: Number(e.target.value) })}
                  className="flex-1 accent-cyan-400" />
                <span className="text-[11px] text-zinc-400 tabular-nums w-10 text-right">{r.cache_ttl_days}d</span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Cascade: {cascade.map(c => PROVIDER_META[c]?.label ?? c).join(' → ') || 'nenhum'}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Tab 4 — DISPARO EM MASSA
// ════════════════════════════════════════════════════════════════════════

function BatchTab({
  getHeaders, onToast,
}: {
  getHeaders: () => Promise<Record<string, string>>
  onToast: (msg: string, type?: Toast['type']) => void
}) {
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'failed' | 'all'>('pending')
  const [segment, setSegment] = useState<'' | 'vip' | 'recent_30d'>('')
  const [quantity, setQuantity] = useState(50)
  const [progress, setProgress] = useState<{ processed: number; full: number; partial: number; failed: number; skipped: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/queue-stats`, { headers })
      if (res.ok) setStats(await res.json())
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  // Poll while running
  useEffect(() => {
    if (!running) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [running, load])

  const eligible = useMemo(() => {
    if (!stats) return 0
    if (statusFilter === 'pending') return stats.pending
    if (statusFilter === 'failed')  return stats.failed
    return stats.total_eligible
  }, [stats, statusFilter])

  // Cost estimate is proportional: estimated_cost / total_eligible × quantity
  const costEstimate = useMemo(() => {
    if (!stats || stats.total_eligible === 0) return 0
    const perQuery = stats.estimated_cost / stats.total_eligible
    return perQuery * Math.min(quantity, eligible)
  }, [stats, quantity, eligible])

  // Time estimate: 600ms entre sends + ~1s média de provider call ≈ 1.6s/cliente
  const timeMinutes = Math.ceil((Math.min(quantity, eligible) * 1.6) / 60)

  async function fire() {
    setRunning(true); setProgress(null)
    try {
      const headers = await getHeaders()
      const body: Record<string, unknown> = { limit: quantity, status_filter: statusFilter }
      if (segment) body.segment = segment
      const res = await fetch(`${BACKEND}/enrichment/batch`, { method: 'POST', headers, body: JSON.stringify(body) })
      const v = await res.json().catch(() => ({}))
      setProgress({
        processed: v?.processed ?? 0, full: v?.full ?? 0, partial: v?.partial ?? 0,
        failed: v?.failed ?? 0, skipped: v?.skipped ?? 0,
      })
      onToast(`Batch concluído: ${v?.processed ?? 0} processados`, 'success')
      await load()
    } catch (e) {
      onToast((e as Error).message, 'error')
    } finally { setRunning(false) }
  }

  return (
    <div className="space-y-4">
      {/* Counter card */}
      <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Fila atual</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3" style={{ background: '#18181b', border: '1px solid #27272a' }}>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Pendentes</p>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: '#fb923c' }}>{loading ? '…' : fmtNum(stats?.pending ?? 0)}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">sem phone, com CPF</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: '#18181b', border: '1px solid #27272a' }}>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Failed</p>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: '#f87171' }}>{loading ? '…' : fmtNum(stats?.failed ?? 0)}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">tentaram e falharam</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: '#18181b', border: '1px solid #27272a' }}>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Total elegível</p>
            <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: '#00E5FF' }}>{loading ? '…' : fmtNum(stats?.total_eligible ?? 0)}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">na fila</p>
          </div>
        </div>
      </div>

      {/* Filters + slider + fire */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Configuração do disparo</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-zinc-400 mb-1 block">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'pending' | 'failed' | 'all')}
              className="w-full bg-[#0a0a0e] border border-[#27272a] text-zinc-300 text-xs rounded-lg px-3 py-2">
              <option value="pending">Apenas pendentes</option>
              <option value="failed">Apenas failed (retry)</option>
              <option value="all">Todos</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-zinc-400 mb-1 block">Segmento</label>
            <select value={segment} onChange={e => setSegment(e.target.value as '' | 'vip' | 'recent_30d')}
              className="w-full bg-[#0a0a0e] border border-[#27272a] text-zinc-300 text-xs rounded-lg px-3 py-2">
              <option value="">Todos os clientes</option>
              <option value="vip">Apenas VIP</option>
              <option value="recent_30d">Pedido nos últimos 30 dias</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-zinc-400">Quantidade a processar agora</label>
            <span className="text-sm font-bold text-cyan-400 tabular-nums">{quantity}</span>
          </div>
          <input type="range" min={10} max={500} step={10} value={quantity}
            onChange={e => setQuantity(Number(e.target.value))}
            className="w-full accent-cyan-400" />
          <div className="flex items-center justify-between text-[10px] text-zinc-600 mt-1">
            <span>10</span><span>500</span>
          </div>
        </div>

        <div className="rounded-lg px-4 py-3 flex items-center justify-between"
          style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Custo estimado</p>
              <p className="text-lg font-bold text-yellow-400 tabular-nums">{fmtBRL(costEstimate)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Tempo estimado</p>
              <p className="text-lg font-bold text-cyan-400 tabular-nums">~{timeMinutes}min</p>
            </div>
          </div>
          <button onClick={fire} disabled={running || eligible === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#000' }}>
            {running ? <><Pause size={14} /> Processando…</> : <><Play size={14} /> Disparar batch</>}
          </button>
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Resultado do último batch</h3>
          <div className="grid grid-cols-5 gap-2">
            <ProgressTile label="Processados" value={progress.processed} color="#00E5FF" />
            <ProgressTile label="Full"        value={progress.full}      color="#4ade80" />
            <ProgressTile label="Partial"     value={progress.partial}   color="#facc15" />
            <ProgressTile label="Failed"      value={progress.failed}    color="#f87171" />
            <ProgressTile label="Skipped"     value={progress.skipped}   color="#71717a" />
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg p-3 text-center" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase mt-0.5">{label}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// Tab 5 — TEMPLATES & AUTOMAÇÃO
// ════════════════════════════════════════════════════════════════════════

function TemplatesTab({
  getHeaders, onToast,
}: {
  getHeaders: () => Promise<Record<string, string>>
  onToast: (msg: string, type?: Toast['type']) => void
}) {
  const [tpl, setTpl] = useState<PostEnrichTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/post-enrich-template`, { headers })
      if (res.ok) setTpl(await res.json())
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!tpl) return
    if (!tpl.message_body.trim()) {
      onToast('Mensagem não pode ficar vazia', 'error')
      return
    }
    setSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/post-enrich-template`, {
        method: 'POST', headers,
        body: JSON.stringify({
          message_body:  tpl.message_body,
          is_active:     tpl.is_active,
          delay_minutes: tpl.delay_minutes,
        }),
      })
      const v = await res.json().catch(() => ({}))
      if (!res.ok || !v?.id) throw new Error('Falha ao salvar')
      setTpl(v)
      onToast('Template salvo', 'success')
    } catch (e) {
      onToast((e as Error).message, 'error')
    } finally { setSaving(false) }
  }

  if (loading || !tpl) return <p className="text-zinc-600 text-xs text-center py-8">Carregando…</p>

  // Render preview substituindo {{nome}}, {{first_name}}, {{phone}} por sample
  const SAMPLE: Record<string, string> = { nome: 'João', first_name: 'João', phone: '11 99999-0000', loja: 'Vazzo' }
  const preview = tpl.message_body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => SAMPLE[k] ?? m)

  return (
    <div className="space-y-4">
      {/* Template editor */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle size={13} className="text-cyan-400" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Mensagem automática pós-enriquecimento</h3>
          </div>
          <Toggle label={tpl.is_active ? 'Ativada' : 'Desativada'}
            value={tpl.is_active} onChange={v => setTpl({ ...tpl, is_active: v })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] text-zinc-400 mb-1 block">Editor</label>
            <textarea value={tpl.message_body}
              onChange={e => setTpl({ ...tpl, message_body: e.target.value })}
              rows={7}
              className="w-full bg-[#0a0a0e] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2 font-mono outline-none focus:border-[#00E5FF]"
              placeholder="Olá {{nome}}, recebemos seus dados..." />
            <p className="text-[10px] text-zinc-600 mt-1">
              Variáveis disponíveis: <span className="font-mono text-cyan-400">{'{{nome}}'}</span> · <span className="font-mono text-cyan-400">{'{{first_name}}'}</span> · <span className="font-mono text-cyan-400">{'{{phone}}'}</span> · <span className="font-mono text-cyan-400">{'{{loja}}'}</span>
            </p>
          </div>
          <div>
            <label className="text-[11px] text-zinc-400 mb-1 block">Preview</label>
            <div className="rounded-xl p-3 min-h-[160px]" style={{ background: '#0a3a35', border: '1px solid #134e48' }}>
              <p className="text-[10px] text-emerald-300/70">12:34</p>
              <p className="text-white text-sm whitespace-pre-wrap leading-relaxed mt-1">{preview || '(vazio)'}</p>
              <p className="text-[10px] text-emerald-300/60 text-right mt-2">✓✓ 12:34</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delay slider */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-cyan-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Tempo de envio (jitter humano)</h3>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] text-zinc-400">Aguardar antes de enviar</label>
            <span className="text-sm font-bold text-cyan-400 tabular-nums">{tpl.delay_minutes}min</span>
          </div>
          <input type="range" min={0} max={60} step={1} value={tpl.delay_minutes}
            onChange={e => setTpl({ ...tpl, delay_minutes: Number(e.target.value) })}
            className="w-full accent-cyan-400" />
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
            <span>0min (imediato)</span><span>60min</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Evita parecer bot ao enviar imediatamente após capturar o telefone. 5–15 minutos é o sweet spot.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ background: '#00E5FF', color: '#000' }}>
          <Save size={14} /> {saving ? 'Salvando…' : 'Salvar template'}
        </button>
      </div>
    </div>
  )
}
