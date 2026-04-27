'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Database, Settings as SettingsIcon, RouteIcon, BarChart3, History,
  CheckCircle2, XCircle, Save, Zap, AlertCircle, Sparkles,
} from 'lucide-react'

// Type-only re-export so we don't import server-only code into the client.
type Provider = {
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
type Routing = {
  query_type: 'cpf' | 'cnpj' | 'phone' | 'whatsapp' | 'email' | 'cep'
  primary_provider: string
  fallback_1: string | null
  fallback_2: string | null
  fallback_3: string | null
  cache_ttl_days: number
  max_retries: number
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const PROVIDER_META: Record<string, { label: string; strength: string; key_format: string; cost_brl: string; uses_secret: boolean }> = {
  bigdatacorp: { label: 'Big Data Corp',      strength: 'Sociodemográficos, score, vínculos.',     key_format: 'AccessToken:TokenId', cost_brl: '~R$ 0,30',  uses_secret: false },
  directdata:  { label: 'Direct Data',        strength: '300+ fontes, foco compliance/KYC.',       key_format: 'token único',         cost_brl: '~R$ 0,40',  uses_secret: false },
  datastone:   { label: 'Data Stone',         strength: 'Telefone/WhatsApp atualizado.',           key_format: 'Bearer JWT',          cost_brl: '~R$ 0,50',  uses_secret: false },
  assertiva:   { label: 'Assertiva Soluções', strength: 'Localização, telefone, endereço.',         key_format: 'client_id:client_secret', cost_brl: '~R$ 0,35', uses_secret: false },
  hubdev:      { label: 'Hub do Desenvolvedor', strength: 'Mais barato, ideal pra fallback.',     key_format: 'token único',         cost_brl: '~R$ 0,15',  uses_secret: false },
  viacep:      { label: 'ViaCEP',             strength: 'Grátis, oficial Correios. Só CEP.',      key_format: '— sem auth',          cost_brl: 'Grátis',    uses_secret: false },
}

const PROVIDER_ORDER = ['bigdatacorp', 'directdata', 'datastone', 'assertiva', 'hubdev', 'viacep']
const QUERY_TYPES: Routing['query_type'][] = ['cpf', 'cnpj', 'phone', 'whatsapp', 'email', 'cep']

export default function EnrichmentConfigPage() {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<'providers' | 'routing' | 'stats' | 'log'>('providers')

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      <div>
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Configurações</p>
        <h1 className="text-white text-xl font-semibold flex items-center gap-2"><Database size={18} /> Enriquecimento de Dados</h1>
        <p className="text-zinc-500 text-xs mt-0.5">Provedores, roteamento, estatísticas e histórico de consultas</p>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        {([
          { k: 'providers', l: 'Provedores',     icon: <SettingsIcon size={12} /> },
          { k: 'routing',   l: 'Roteamento',     icon: <RouteIcon size={12} /> },
          { k: 'stats',     l: 'Estatísticas',   icon: <BarChart3 size={12} /> },
          { k: 'log',       l: 'Histórico',      icon: <History size={12} /> },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: tab === t.k ? '#00E5FF' : 'transparent', color: tab === t.k ? '#000' : '#a1a1aa' }}>
            {t.icon}{t.l}
          </button>
        ))}
      </div>

      {tab === 'providers' && <ProvidersTab getHeaders={getHeaders} />}
      {tab === 'routing'   && <RoutingTab   getHeaders={getHeaders} />}
      {tab === 'stats'     && <StatsTab     getHeaders={getHeaders} />}
      {tab === 'log'       && <LogTab       getHeaders={getHeaders} />}
    </div>
  )
}

// ── Providers Tab ─────────────────────────────────────────────────────────────

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

  const findExisting = (code: string) => list.find(p => p.provider_code === code) ?? null

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-zinc-600 text-xs text-center py-8">Carregando…</p>
      ) : PROVIDER_ORDER.map(code => {
        const meta = PROVIDER_META[code]
        const existing = findExisting(code)
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

  const spentPct = p.monthly_budget_brl && p.monthly_budget_brl > 0
    ? Math.min(100, (Number(p.monthly_spent_brl) / Number(p.monthly_budget_brl)) * 100)
    : 0

  const inp = 'w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'

  async function save() {
    setSaving(true)
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/enrichment/providers/${p.provider_code}`, {
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
      onChange()
    } finally { setSaving(false) }
  }
  async function test() {
    setTesting(true)
    setTestRes(null)
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
        <Toggle label={p.is_enabled ? 'Habilitado' : 'Desabilitado'}
          value={p.is_enabled} onChange={v => setP({ ...p, is_enabled: v })} />
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
          {testRes ? (
            <div className="flex items-center gap-1.5 text-[11px]"
              style={{ color: testRes.ok ? '#4ade80' : '#f87171' }}>
              {testRes.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              <span className="truncate max-w-xs">{testRes.message}</span>
            </div>
          ) : p.is_enabled ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ativo
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-zinc-600">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> Desabilitado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {p.provider_code !== 'viacep' && (
            <button onClick={test} disabled={testing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-60"
              style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
              <Zap size={11} /> {testing ? 'Testando…' : 'Testar'}
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-60"
            style={{ background: '#00E5FF', color: '#000' }}>
            <Save size={11} /> {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Routing Tab ───────────────────────────────────────────────────────────────

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

  function update(qt: Routing['query_type'], patch: Partial<Routing>) {
    setRows(prev => prev.map(r => r.query_type === qt ? { ...r, ...patch } : r))
  }
  async function save(qt: Routing['query_type']) {
    const r = rows.find(x => x.query_type === qt)
    if (!r) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/enrichment/routing/${qt}`, {
      method: 'PATCH', headers, body: JSON.stringify(r),
    })
    await load()
  }

  if (loading) return <p className="text-zinc-600 text-xs text-center py-8">Carregando…</p>

  const inp = 'w-full bg-[#0c0c10] border border-[#27272a] text-zinc-200 text-xs rounded-lg px-2 py-1.5'

  return (
    <div className="space-y-3">
      {QUERY_TYPES.map(qt => {
        const r = rows.find(x => x.query_type === qt)
        if (!r) return null
        const cascade = [r.primary_provider, r.fallback_1, r.fallback_2, r.fallback_3].filter(Boolean)
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
                    {PROVIDER_ORDER.map(c => (
                      <option key={c} value={c}>{PROVIDER_META[c].label}</option>
                    ))}
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
                Cascade: {cascade.map(c => (c ? (PROVIDER_META[c]?.label ?? c) : '')).filter(Boolean).join(' → ') || 'nenhum'}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────

type Stats = {
  totals: { queries: number; cache_hits: number; cache_hit_rate: number; cost_brl: number }
  by_provider: Record<string, { queries: number; success: number; cost_cents: number }>
  by_type:     Record<string, { queries: number; success: number }>
  by_day: Array<{ date: string; count: number }>
}

function StatsTab({ getHeaders }: { getHeaders: () => Promise<Record<string, string>> }) {
  const [s, setS] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(`${BACKEND}/enrichment/stats`, { headers })
        if (res.ok) setS(await res.json())
      } finally { setLoading(false) }
    })()
  }, [getHeaders])

  if (loading) return <p className="text-zinc-600 text-xs text-center py-8">Carregando…</p>
  if (!s) return <p className="text-zinc-600 text-xs text-center py-8 italic">Sem dados ainda.</p>

  const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`
  const maxDay = Math.max(1, ...s.by_day.map(d => d.count))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Consultas (30d)"    value={s.totals.queries.toLocaleString('pt-BR')} color="#00E5FF" />
        <Kpi label="Cache hits"         value={s.totals.cache_hits.toLocaleString('pt-BR')} color="#60a5fa" />
        <Kpi label="Cache hit rate"     value={fmtPct(s.totals.cache_hit_rate)} color="#a78bfa" />
        <Kpi label="Custo no mês"       value={fmtBRL(s.totals.cost_brl)} color="#f87171" />
      </div>

      {/* Daily sparkline */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Consultas por dia (30d)</h3>
        <div className="flex items-end gap-0.5 h-24">
          {s.by_day.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">Sem dados</p>
          ) : s.by_day.map(d => (
            <div key={d.date} className="flex-1 transition-all hover:opacity-80"
              title={`${d.date}: ${d.count}`}
              style={{ height: `${(d.count / maxDay) * 100}%`, background: '#00E5FF', minHeight: 1, borderRadius: 2 }} />
          ))}
        </div>
      </div>

      {/* By provider + by type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DistTable title="Por provedor" rows={Object.entries(s.by_provider).map(([k, v]) => ({
          label: PROVIDER_META[k]?.label ?? k,
          queries: v.queries,
          success: v.success,
          extra:   `${fmtBRL(v.cost_cents / 100)}`,
        }))} />
        <DistTable title="Por tipo" rows={Object.entries(s.by_type).map(([k, v]) => ({
          label: k.toUpperCase(),
          queries: v.queries,
          success: v.success,
        }))} />
      </div>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 min-h-[100px] justify-between"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  )
}

function DistTable({ title, rows }: { title: string; rows: Array<{ label: string; queries: number; success: number; extra?: string }> }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-600 italic">Sem dados</p>
      ) : (
        <div className="space-y-1.5">
          {rows.sort((a, b) => b.queries - a.queries).map(r => {
            const succRate = r.queries > 0 ? r.success / r.queries : 0
            return (
              <div key={r.label} className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 truncate flex-1">{r.label}</span>
                <span className="text-zinc-500 w-16 text-right tabular-nums">{r.queries}</span>
                <span className="text-zinc-500 w-12 text-right tabular-nums" style={{ color: succRate > 0.7 ? '#4ade80' : succRate > 0.3 ? '#facc15' : '#f87171' }}>
                  {(succRate * 100).toFixed(0)}%
                </span>
                {r.extra && <span className="text-zinc-500 w-20 text-right tabular-nums">{r.extra}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Log Tab ───────────────────────────────────────────────────────────────────

type LogRow = {
  id: string
  query_type: string
  query_value_masked: string
  trigger_source: string
  final_provider: string | null
  final_status: string
  duration_ms: number
  cost_cents: number
  cache_hit: boolean
  customer_id: string | null
  created_at: string
}

function LogTab({ getHeaders }: { getHeaders: () => Promise<Record<string, string>> }) {
  const [list, setList] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/enrichment/log`, { headers })
      if (res.ok) {
        const v = await res.json()
        setList(Array.isArray(v) ? v : [])
      }
    } finally { setLoading(false) }
  }, [getHeaders])
  useEffect(() => { load() }, [load])

  function exportCsv() {
    const head = 'created_at,type,value_masked,provider,status,duration_ms,cost_cents,cache_hit\n'
    const rows = list.map(r => [
      r.created_at, r.query_type, r.query_value_masked,
      r.final_provider ?? '', r.final_status, r.duration_ms,
      r.cost_cents, r.cache_hit ? 'sim' : 'não',
    ].join(',')).join('\n')
    const blob = new Blob([head + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `enrichment-log-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = filterType ? list.filter(r => r.query_type === filterType) : list

  const STATUS_COLOR: Record<string, string> = {
    success: '#4ade80', partial: '#facc15', cached: '#60a5fa',
    failed:  '#f87171', no_credit: '#f59e0b', rate_limited: '#a78bfa',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-[11px] bg-[#111114] border border-[#27272a] text-zinc-300 rounded-lg px-2 py-1.5">
          <option value="">Todos os tipos</option>
          {QUERY_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <button onClick={exportCsv} disabled={filtered.length === 0}
          className="text-[11px] px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: '#111114', color: '#a1a1aa', border: '1px solid #27272a' }}>
          Exportar CSV
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600" style={{ borderBottom: '1px solid #1a1a1f' }}>
              <th className="px-3 py-2 font-semibold">Data</th>
              <th className="px-3 py-2 font-semibold">Tipo</th>
              <th className="px-3 py-2 font-semibold">Valor (mascarado)</th>
              <th className="px-3 py-2 font-semibold">Provedor</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold text-right">ms</th>
              <th className="px-3 py-2 font-semibold text-right">R$</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-600">Carregando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-zinc-600 italic">Sem registros.</td></tr>
            ) : filtered.slice(0, 200).map(r => (
              <tr key={r.id} className="hover:bg-[#161618] transition-colors">
                <td className="px-3 py-2 text-zinc-500 text-[10px] tabular-nums">{r.created_at?.slice(0, 19).replace('T', ' ')}</td>
                <td className="px-3 py-2 text-zinc-300 uppercase tracking-wide text-[10px]">{r.query_type}</td>
                <td className="px-3 py-2 text-zinc-400 font-mono text-[11px]">{r.query_value_masked}{r.cache_hit && <span className="ml-1 text-[9px] text-blue-400">cached</span>}</td>
                <td className="px-3 py-2 text-zinc-400">{r.final_provider ? (PROVIDER_META[r.final_provider]?.label ?? r.final_provider) : '—'}</td>
                <td className="px-3 py-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{ color: STATUS_COLOR[r.final_status] ?? '#a1a1aa', background: (STATUS_COLOR[r.final_status] ?? '#a1a1aa') + '15' }}>
                    {r.final_status}
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-500 text-right tabular-nums">{r.duration_ms}</td>
                <td className="px-3 py-2 text-zinc-500 text-right tabular-nums">{(r.cost_cents / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <button onClick={() => onChange(!value)} type="button"
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{ background: value ? '#00E5FF' : '#27272a' }}>
        <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform"
          style={{ left: value ? 18 : 2 }} />
      </button>
    </label>
  )
}
