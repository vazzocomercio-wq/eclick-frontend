'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  RefreshCw, Megaphone, AlertCircle, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, MousePointerClick, Eye, DollarSign, Target, Activity,
  Download, Clock, ArrowRight, Pause, Play, Edit2, Check, X, Package,
  Filter, Sparkles, AlertTriangle,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { InsightsBanner } from '@/components/ads-ai/InsightsBanner'
import { AdsAIChat } from '@/components/ads-ai/AdsAIChat'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type Campaign = {
  id: string
  name: string | null
  status: string | null
  daily_budget: number | null
  type: string | null
  synced_at?: string | null
  clicks: number
  impressions: number
  spend: number
  conversions: number
  revenue: number
  ctr: number
  roas: number
  acos: number
}

type SeriesPoint = {
  date: string
  clicks: number
  impressions: number
  spend: number
  conversions: number
  revenue: number
  ctr: number
  roas: number
  acos: number
}

type Totals = {
  clicks: number; impressions: number; spend: number
  conversions: number; revenue: number
  ctr: number; roas: number; acos: number
}

type SummaryResp = {
  totals:    Totals
  series:    SeriesPoint[]
  previous?: { from: string; to: string; totals: Totals }
}

type BySkuRow = {
  item_id:        string
  product_id?:    string
  product_name?:  string
  sku?:           string
  campaign_count: number
  campaign_names: string[]
  spend:          number
  revenue:        number
  clicks:         number
  impressions:    number
  conversions:    number
  ctr:            number
  roas:           number
  acos:           number
}

type AdsSignal = {
  id:             string
  category:       string
  severity:       'critical' | 'warning' | 'info'
  score:          number
  entity_id:      string | null
  entity_name:    string | null
  summary_pt:     string
  suggestion_pt:  string | null
  status:         string
  created_at:     string
}

type Translator = ReturnType<typeof useTranslations<'ads'>>

const SIGNAL_SEVERITY: Record<AdsSignal['severity'], { icon: typeof AlertCircle; color: string; bg: string }> = {
  critical: { icon: AlertCircle,   color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  warning:  { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  info:     { icon: Sparkles,      color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
}

function humanizeCategory(c: string) { return c.replace(/_/g, ' ') }

type CampaignDayRow = SeriesPoint

type CampaignItem = {
  item_id:       string
  product_id?:   string
  product_name?: string
  sku?:          string
}

type Preset = '7d' | '30d' | 'custom'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) =>
  (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtNum = (n: number) => (n ?? 0).toLocaleString('pt-BR')
const fmtPct = (n: number) => `${((n ?? 0) * 100).toFixed(2)}%`
const fmtRoas = (n: number) => `${(n ?? 0).toFixed(2)}x`
const shortDate = (d: string) => {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
}

function timeAgoBR(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'agora mesmo'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function acosColor(acos: number) {
  if (acos < 0.33) return '#4ade80'
  if (acos <= 1)   return '#facc15'
  return '#f87171'
}
function roasColor(roas: number) {
  if (roas > 3) return '#4ade80'
  if (roas >= 1) return '#facc15'
  return '#f87171'
}
function statusBadge(t: Translator, s: string | null) {
  const v = (s ?? '').toLowerCase()
  if (v === 'active' || v === 'enabled' || v === 'ativo')
    return { label: t('mercadolivre.status.active'),    color: '#4ade80', bg: 'rgba(74,222,128,0.12)' }
  if (v === 'paused' || v === 'pausado')
    return { label: t('mercadolivre.status.paused'),  color: '#facc15', bg: 'rgba(250,204,21,0.12)' }
  if (v === 'ended' || v === 'finished' || v === 'finalizado')
    return { label: t('mercadolivre.status.ended'), color: '#71717a', bg: 'rgba(113,113,122,0.12)' }
  return { label: s ?? '—', color: '#a1a1aa', bg: 'rgba(161,161,170,0.10)' }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color = '#a1a1aa', subColor, delta, invertDelta }: {
  label:        string
  value:        string
  sub?:         string
  icon:         React.ReactNode
  color?:       string
  subColor?:    string
  delta?:       number | null  // % change vs prev period (null = sem comparativo)
  invertDelta?: boolean        // true se queda é positivo (ex: ACoS menor é melhor)
}) {
  const showDelta = delta != null && Number.isFinite(delta)
  const positive  = showDelta ? (invertDelta ? delta < 0 : delta > 0) : false
  const negative  = showDelta ? (invertDelta ? delta > 0 : delta < 0) : false
  const deltaColor = positive ? '#4ade80' : negative ? '#f87171' : '#71717a'

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 min-h-[110px] justify-between"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
        <div className="flex items-center gap-2 mt-1">
          {showDelta && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold"
              style={{ color: deltaColor }}>
              {delta! >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {delta! >= 0 ? '+' : ''}{delta!.toFixed(1)}%
            </span>
          )}
          {sub && <span className="text-[11px]" style={{ color: subColor ?? '#52525b' }}>{sub}</span>}
        </div>
      </div>
    </div>
  )
}

function deltaPct(cur: number, prev: number): number | null {
  if (!prev || !Number.isFinite(prev)) return null
  return ((cur - prev) / prev) * 100
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2 text-xs space-y-1"
      style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <p className="font-semibold text-zinc-300">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-400">{p.name ?? p.dataKey}:</span>
          <span className="font-medium text-zinc-200">
            {p.dataKey === 'spend' || p.dataKey === 'revenue' ? fmtBRL(p.value)
             : p.dataKey === 'roas' ? fmtRoas(p.value)
             : fmtNum(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function CampaignRow({
  c, expanded, onToggle, onTogglePause, onEditBudget, getHeaders, dateFrom, dateTo, busy, signals,
}: {
  c: Campaign
  expanded: boolean
  onToggle: () => void
  onTogglePause: (c: Campaign) => Promise<void>
  onEditBudget: (c: Campaign, newBudget: number) => Promise<void>
  getHeaders: () => Promise<Record<string, string>>
  dateFrom: string
  dateTo: string
  busy: boolean
  signals: AdsSignal[]
}) {
  const t = useTranslations('ads')
  const sb = statusBadge(t, c.status)
  const [days, setDays] = useState<CampaignDayRow[]>([])
  const [items, setItems] = useState<CampaignItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState(String(c.daily_budget ?? ''))

  // Re-fetch days + items quando abre ou o range muda
  useEffect(() => {
    if (!expanded) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const headers = await getHeaders()
        const [daysRes, itemsRes] = await Promise.all([
          fetch(`${BACKEND}/ml-ads/reports/campaign/${c.id}?from=${dateFrom}&to=${dateTo}`, { headers }),
          fetch(`${BACKEND}/ml-ads/campaigns/${c.id}/items`, { headers }),
        ])
        if (cancelled) return
        if (daysRes.ok) {
          const v = await daysRes.json()
          setDays(Array.isArray(v) ? v : [])
        }
        if (itemsRes.ok) {
          const v = await itemsRes.json()
          setItems(Array.isArray(v) ? v : [])
        }
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, c.id, dateFrom, dateTo])

  const isPaused = (c.status ?? '').toLowerCase() === 'paused'
  const isActive = (c.status ?? '').toLowerCase() === 'active'

  async function commitBudget() {
    const v = parseFloat(budgetInput.replace(',', '.'))
    if (!Number.isFinite(v) || v < 0) {
      setBudgetInput(String(c.daily_budget ?? ''))
      setEditingBudget(false)
      return
    }
    if (v === c.daily_budget) { setEditingBudget(false); return }
    await onEditBudget(c, v)
    setEditingBudget(false)
  }
  function cancelBudget() {
    setBudgetInput(String(c.daily_budget ?? ''))
    setEditingBudget(false)
  }

  return (
    <>
      <tr className="hover:bg-[#161618] transition-colors">
        <td className="px-3 py-3 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-medium text-zinc-200 truncate max-w-[300px]">{c.name || t('mercadolivre.noName')}</p>
                {signals.length > 0 && (() => {
                  const worst = signals[0].severity   // já ordenado por score desc
                  const meta = SIGNAL_SEVERITY[worst]
                  return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}
                      title={t('mercadolivre.aiSuggestionsCount', { count: signals.length })}>
                      <Sparkles size={9} />
                      {signals.length}
                    </span>
                  )
                })()}
              </div>
              {c.id && <p className="text-[10px] text-zinc-600 font-mono">{c.id}</p>}
              {c.type && <p className="text-[10px] text-zinc-600">{c.type}</p>}
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ color: sb.color, background: sb.bg }}>{sb.label}</span>
        </td>
        <td className="px-3 py-3 text-right">
          {editingBudget ? (
            <div className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <span className="text-[10px] text-zinc-600">R$</span>
              <input type="text" autoFocus value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); void commitBudget() }
                  if (e.key === 'Escape') { e.preventDefault(); cancelBudget() }
                }}
                className="w-20 px-2 py-0.5 rounded text-xs text-white outline-none text-right font-mono"
                style={{ background: '#18181b', border: '1px solid #00E5FF' }} />
              <button onClick={commitBudget} disabled={busy}
                className="p-0.5 rounded transition-colors disabled:opacity-40"
                style={{ color: '#4ade80' }} title={t('mercadolivre.saveEnter')}>
                <Check size={11} />
              </button>
              <button onClick={cancelBudget}
                className="p-0.5 rounded transition-colors"
                style={{ color: '#71717a' }} title={t('mercadolivre.cancelEsc')}>
                <X size={11} />
              </button>
            </div>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setEditingBudget(true) }}
              className="text-xs text-zinc-300 tabular-nums hover:text-white transition-colors inline-flex items-center gap-1"
              title={t('mercadolivre.clickToEdit')}>
              {c.daily_budget != null ? fmtBRL(c.daily_budget) : '—'}
              <Edit2 size={9} className="opacity-30" />
            </button>
          )}
        </td>
        <td className="px-3 py-3 text-right text-xs text-zinc-300 tabular-nums cursor-pointer" onClick={onToggle}>{fmtBRL(c.spend)}</td>
        <td className="px-3 py-3 text-right text-xs text-zinc-300 tabular-nums cursor-pointer" onClick={onToggle}>{fmtBRL(c.revenue)}</td>
        <td className="px-3 py-3 text-right text-xs font-semibold tabular-nums cursor-pointer" onClick={onToggle} style={{ color: roasColor(c.roas) }}>
          {fmtRoas(c.roas)}
        </td>
        <td className="px-3 py-3 text-right text-xs text-zinc-300 tabular-nums cursor-pointer" onClick={onToggle}>{fmtNum(c.clicks)}</td>
        <td className="px-3 py-3 text-right text-xs text-zinc-400 tabular-nums cursor-pointer" onClick={onToggle}>{fmtPct(c.ctr)}</td>
        <td className="px-3 py-3 text-right">
          {(isActive || isPaused) && (
            <button onClick={(e) => { e.stopPropagation(); void onTogglePause(c) }}
              disabled={busy}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{
                background: isPaused ? 'rgba(74,222,128,0.1)' : 'rgba(245,158,11,0.1)',
                color:      isPaused ? '#4ade80' : '#f59e0b',
                border:     `1px solid ${isPaused ? 'rgba(74,222,128,0.25)' : 'rgba(245,158,11,0.25)'}`,
              }}
              title={isPaused ? t('mercadolivre.reactivateCampaign') : t('mercadolivre.pauseCampaign')}>
              {isPaused ? <Play size={11} /> : <Pause size={11} />}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="px-3 py-4 space-y-4" style={{ background: '#0c0c0f', borderTop: '1px solid #1a1a1f' }}>
            {/* Sugestões da IA (signals do Intelligence Hub) */}
            {signals.length > 0 && (
              <div className="px-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold mb-1.5 inline-flex items-center gap-1">
                  <Sparkles size={10} style={{ color: '#a78bfa' }} /> {t('mercadolivre.aiSuggestions', { count: signals.length })}
                </p>
                <div className="space-y-2">
                  {signals.map(s => {
                    const meta = SIGNAL_SEVERITY[s.severity]
                    return (
                      <div key={s.id} className="rounded-lg p-3 space-y-1.5"
                        style={{ background: '#18181b', border: `1px solid ${meta.color}33` }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <meta.icon size={11} style={{ color: meta.color }} />
                          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: meta.color }}>
                            {humanizeCategory(s.category)}
                          </span>
                          <span className="text-[10px] text-zinc-600">·</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{t('mercadolivre.score', { score: s.score })}</span>
                          <span className="ml-auto text-[10px] text-zinc-600">{s.status}</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{s.summary_pt}</p>
                        {s.suggestion_pt && (
                          <p className="text-[11px] text-zinc-400 leading-relaxed pl-3 border-l-2" style={{ borderColor: meta.color }}>
                            💡 {s.suggestion_pt}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Items / SKUs vinculados */}
            {items.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold mb-1.5 inline-flex items-center gap-1 px-3">
                  <Package size={10} /> {t('mercadolivre.linkedListings', { count: items.length })}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 px-3">
                  {items.map(it => (
                    <div key={it.item_id} className="text-[10px] px-2 py-1.5 rounded-lg flex items-center gap-2"
                      style={{ background: '#18181b', border: '1px solid #27272a' }}>
                      <Package size={10} className="text-zinc-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {it.product_name ? (
                          <>
                            <p className="text-zinc-300 truncate">{it.product_name}</p>
                            <p className="text-zinc-600 font-mono">{it.sku ?? it.item_id}</p>
                          </>
                        ) : (
                          <p className="text-zinc-500 font-mono truncate" title={it.item_id}>{it.item_id}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily metrics */}
            {loading ? (
              <p className="text-xs text-zinc-500 px-3">{t('mercadolivre.loadingDays')}</p>
            ) : days.length === 0 ? (
              <p className="text-xs text-zinc-600 px-3 italic">{t('mercadolivre.noMetrics')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600">
                      <th className="px-3 py-1.5">{t('mercadolivre.dayTable.date')}</th>
                      <th className="px-3 py-1.5 text-right">{t('mercadolivre.dayTable.impressions')}</th>
                      <th className="px-3 py-1.5 text-right">{t('mercadolivre.dayTable.clicks')}</th>
                      <th className="px-3 py-1.5 text-right">CTR</th>
                      <th className="px-3 py-1.5 text-right">{t('mercadolivre.dayTable.spend')}</th>
                      <th className="px-3 py-1.5 text-right">{t('mercadolivre.dayTable.revenue')}</th>
                      <th className="px-3 py-1.5 text-right">ROAS</th>
                      <th className="px-3 py-1.5 text-right">ACoS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(d => (
                      <tr key={d.date} className="text-zinc-300 tabular-nums">
                        <td className="px-3 py-1">{shortDate(d.date)}</td>
                        <td className="px-3 py-1 text-right">{fmtNum(d.impressions)}</td>
                        <td className="px-3 py-1 text-right">{fmtNum(d.clicks)}</td>
                        <td className="px-3 py-1 text-right text-zinc-500">{fmtPct(d.ctr)}</td>
                        <td className="px-3 py-1 text-right">{fmtBRL(d.spend)}</td>
                        <td className="px-3 py-1 text-right">{fmtBRL(d.revenue)}</td>
                        <td className="px-3 py-1 text-right" style={{ color: roasColor(d.roas) }}>{fmtRoas(d.roas)}</td>
                        <td className="px-3 py-1 text-right" style={{ color: acosColor(d.acos) }}>{fmtPct(d.acos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MlAdsPage() {
  const t = useTranslations('ads')
  const supabase = useMemo(() => createClient(), [])

  const [preset, setPreset] = useState<Preset>('30d')
  const [customFrom, setCustomFrom] = useState(daysAgoISO(30))
  const [customTo, setCustomTo]     = useState(todayISO())

  const [summary, setSummary]   = useState<SummaryResp | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastSyncMsg, setLastSyncMsg] = useState<string | null>(null)
  const [mlConnected, setMlConnected] = useState<boolean | null>(null)
  const [campaignBusy, setCampaignBusy] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [bySkuRows, setBySkuRows] = useState<BySkuRow[]>([])
  const [showBySku, setShowBySku] = useState(false)
  const [signalsByCampaign, setSignalsByCampaign] = useState<Map<string, AdsSignal[]>>(new Map())

  // Última sincronização derivada do max(synced_at) entre campaigns
  const lastSync = useMemo(() => {
    if (campaigns.length === 0) return null
    const maxT = campaigns.reduce((max, c) => {
      if (!c.synced_at) return max
      const t = new Date(c.synced_at).getTime()
      return t > max ? t : max
    }, 0)
    return maxT > 0 ? new Date(maxT).toISOString() : null
  }, [campaigns])

  const range = useMemo(() => {
    if (preset === '7d')  return { from: daysAgoISO(7),  to: todayISO() }
    if (preset === '30d') return { from: daysAgoISO(30), to: todayISO() }
    return { from: customFrom, to: customTo }
  }, [preset, customFrom, customTo])

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('mercadolivre.notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}` }
  }, [supabase, t])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getHeaders()
      const [sumRes, campRes, skuRes, sigRes] = await Promise.all([
        fetch(`${BACKEND}/ml-ads/reports/summary?from=${range.from}&to=${range.to}&compare=1`, { headers }),
        fetch(`${BACKEND}/ml-ads/campaigns?from=${range.from}&to=${range.to}`, { headers }),
        fetch(`${BACKEND}/ml-ads/reports/by-sku?from=${range.from}&to=${range.to}`, { headers }),
        fetch(`${BACKEND}/alert-signals?analyzer=ads&limit=200`, { headers }),
      ])

      if (sumRes.status === 401) {
        setError('token-expired')
        return
      }

      if (sumRes.ok) {
        const v = await sumRes.json()
        setSummary({
          totals:    v?.totals ?? { clicks: 0, impressions: 0, spend: 0, conversions: 0, revenue: 0, ctr: 0, roas: 0, acos: 0 },
          series:    Array.isArray(v?.series) ? v.series : [],
          previous:  v?.previous ?? undefined,
        })
      }
      if (campRes.ok) {
        const v = await campRes.json()
        setCampaigns(Array.isArray(v) ? v : [])
      }
      if (skuRes.ok) {
        const v = await skuRes.json()
        setBySkuRows(Array.isArray(v) ? v : [])
      }
      if (sigRes.ok) {
        const v = await sigRes.json() as AdsSignal[]
        // Filtra só pendentes de ação (descarta acted/ignored/expired)
        const pending = (Array.isArray(v) ? v : [])
          .filter(s => ['new', 'dispatched', 'delivered'].includes(s.status))
        const map = new Map<string, AdsSignal[]>()
        for (const s of pending) {
          if (!s.entity_id) continue
          const arr = map.get(s.entity_id) ?? []
          arr.push(s)
          map.set(s.entity_id, arr)
        }
        // Ordena cada bucket por score desc
        for (const [k, arr] of map) {
          arr.sort((a, b) => b.score - a.score)
          map.set(k, arr)
        }
        setSignalsByCampaign(map)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('mercadolivre.loadError'))
    } finally {
      setLoading(false)
    }
  }, [getHeaders, range.from, range.to, t])

  // Depend on the primitive range strings (and supabase, which is stable),
  // NOT on `load` — the callback identity can churn and trigger refetch loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [range.from, range.to])

  // Detecta se ML está conectado (1 fetch leve no mount). Se não, empty state
  // muda pra CTA "conectar ML" em vez de "sincronizar".
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(`${BACKEND}/ml/connections`, { headers })
        if (!res.ok) { if (!cancelled) setMlConnected(false); return }
        const list = await res.json()
        if (cancelled) return
        setMlConnected(Array.isArray(list) && list.length > 0)
      } catch {
        if (!cancelled) setMlConnected(false)
      }
    })()
    return () => { cancelled = true }
  }, [getHeaders])

  async function patchCampaign(c: Campaign, body: { status?: 'active' | 'paused'; daily_budget?: number }) {
    setCampaignBusy(prev => { const n = new Set(prev); n.add(c.id); return n })
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml-ads/campaigns/${c.id}`, {
        method:  'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message ?? `HTTP ${res.status}`)
      }
      const updated = await res.json() as { id: string; status: string | null; daily_budget: number | null }
      setCampaigns(prev => prev.map(x => x.id === c.id
        ? { ...x, status: updated.status ?? x.status, daily_budget: updated.daily_budget ?? x.daily_budget }
        : x,
      ))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mercadolivre.campaignUpdateError'))
    } finally {
      setCampaignBusy(prev => { const n = new Set(prev); n.delete(c.id); return n })
    }
  }

  async function handleTogglePause(c: Campaign) {
    const cur = (c.status ?? '').toLowerCase()
    const next: 'active' | 'paused' = cur === 'paused' ? 'active' : 'paused'
    await patchCampaign(c, { status: next })
  }

  async function handleEditBudget(c: Campaign, daily_budget: number) {
    await patchCampaign(c, { daily_budget })
  }

  function exportCSV() {
    if (campaigns.length === 0) return
    const lines: string[] = []
    lines.push(t('mercadolivre.csvHeader'))
    for (const c of campaigns) {
      lines.push([
        csvEscape(c.name ?? t('mercadolivre.noName')),
        c.status ?? '',
        c.type ?? '',
        c.daily_budget ?? '',
        c.clicks,
        c.impressions,
        ((c.ctr ?? 0) * 100).toFixed(2),
        (c.spend ?? 0).toFixed(2),
        c.conversions,
        (c.revenue ?? 0).toFixed(2),
        (c.roas ?? 0).toFixed(2),
        ((c.acos ?? 0) * 100).toFixed(2),
      ].join(','))
    }
    const csv = '﻿' + lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
    a.href     = url
    a.download = `ml-ads-campaigns-${range.from}_${range.to}-${stamp}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function sync() {
    setSyncing(true)
    setError(null)
    setLastSyncMsg(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml-ads/sync`, { method: 'POST', headers })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) { setError('token-expired'); return }
        throw new Error(d?.message ?? `HTTP ${res.status}`)
      }
      if (d?.ok === false && d?.message) {
        setLastSyncMsg(d.message)
      } else {
        setLastSyncMsg(t('mercadolivre.syncResult', { campaigns: d?.campaigns ?? 0, reports: d?.reports ?? 0 }))
      }
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('mercadolivre.syncError'))
    } finally {
      setSyncing(false)
    }
  }

  const totals = summary?.totals
  const prevTotals = summary?.previous?.totals
  const series = (summary?.series ?? []).map(d => ({ ...d, label: shortDate(d.date) }))

  const filteredCampaigns = useMemo(() => {
    if (statusFilter === 'all') return campaigns
    return campaigns.filter(c => (c.status ?? '').toLowerCase() === statusFilter)
  }, [campaigns, statusFilter])

  const top5 = useMemo(() => {
    return [...campaigns]
      .filter(c => c.spend > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5)
  }, [campaigns])

  const totalSpendForBars = top5.reduce((s, c) => s + c.spend, 0) || 1

  // Empty state: never synced (no campaigns in DB)
  const isEmpty = !loading && campaigns.length === 0 && (totals?.spend ?? 0) === 0

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: 'var(--background)' }}>

      <InsightsBanner />
      <AdsAIChat />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,230,0,0.12)' }}>
            <Megaphone size={18} style={{ color: '#FFE600' }} />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">{t('mercadolivre.eyebrow')}</p>
            <h1 className="text-white text-xl font-semibold">{t('mercadolivre.pageTitle')}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period presets */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            {(['7d', '30d', 'custom'] as const).map(p => (
              <button key={p} onClick={() => setPreset(p)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: preset === p ? '#FFE600' : 'transparent',
                  color:      preset === p ? '#000'    : '#a1a1aa',
                }}>
                {t(`mercadolivre.preset.${p}`)}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-1 text-[11px]">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-[#111114] border border-[#27272a] text-zinc-300" />
              <span className="text-zinc-600">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-[#111114] border border-[#27272a] text-zinc-300" />
            </div>
          )}

          {campaigns.length > 0 && (
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all border"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
              title={t('mercadolivre.exportCsv')}>
              <Download size={12} />
              <span className="hidden sm:inline">CSV</span>
            </button>
          )}
          <button onClick={sync} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-60"
            style={{ background: '#FFE600', color: '#000' }}>
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? t('mercadolivre.syncing') : t('mercadolivre.sync')}
          </button>
        </div>
      </div>

      {lastSync && (
        <p className="text-[10px] text-zinc-600 inline-flex items-center gap-1">
          <Clock size={10} /> {t('mercadolivre.lastSync', { time: timeAgoBR(lastSync) })}
        </p>
      )}

      {lastSyncMsg && (
        <div className="px-4 py-2 rounded-xl text-[11px] text-emerald-400"
          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)' }}>
          {lastSyncMsg}
        </div>
      )}

      {error === 'token-expired' && (
        <div className="px-4 py-3 rounded-xl text-xs text-amber-400 flex items-center gap-2"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertCircle size={14} />
          <span>{t.rich('mercadolivre.tokenExpired', {
            link: (chunks) => <a href="/dashboard/configuracoes/integracoes" className="underline font-semibold">{chunks}</a>,
          })}</span>
        </div>
      )}

      {error && error !== 'token-expired' && (
        <div className="px-4 py-3 rounded-xl text-xs text-red-400"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          {error}
        </div>
      )}

      {/* Empty state — diferencia "ML não conectado" vs "ainda não sincronizou" */}
      {isEmpty && !error ? (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center gap-4"
          style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,230,0,0.10)' }}>
            <Megaphone size={24} style={{ color: '#FFE600' }} />
          </div>
          {mlConnected === false ? (
            <>
              <div>
                <h2 className="text-white text-base font-semibold">{t('mercadolivre.notConnectedTitle')}</h2>
                <p className="text-zinc-500 text-xs mt-1 max-w-md">
                  {t('mercadolivre.notConnectedText')}
                </p>
              </div>
              <Link href="/dashboard/configuracoes/integracoes"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: '#FFE600', color: '#000' }}>
                {t('mercadolivre.connectMl')}
                <ArrowRight size={13} />
              </Link>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-white text-base font-semibold">{t('mercadolivre.noDataTitle')}</h2>
                <p className="text-zinc-500 text-xs mt-1 max-w-md">
                  {t('mercadolivre.noDataText')}
                </p>
              </div>
              <button onClick={sync} disabled={syncing}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
                style={{ background: '#FFE600', color: '#000' }}>
                <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                {syncing ? t('mercadolivre.syncing') : t('mercadolivre.syncWithMlAds')}
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* KPIs com delta vs período anterior */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label={t('mercadolivre.kpi.totalSpend')}   value={loading ? '…' : fmtBRL(totals?.spend ?? 0)}
              delta={prevTotals ? deltaPct(totals?.spend ?? 0, prevTotals.spend) : null}
              invertDelta
              icon={<DollarSign size={13} />} color="#f87171" />
            <KpiCard label={t('mercadolivre.kpi.revenue')}       value={loading ? '…' : fmtBRL(totals?.revenue ?? 0)}
              delta={prevTotals ? deltaPct(totals?.revenue ?? 0, prevTotals.revenue) : null}
              icon={<TrendingUp size={13} />} color="#4ade80" />
            <KpiCard label="ROAS"          value={loading ? '…' : fmtRoas(totals?.roas ?? 0)}
              delta={prevTotals ? deltaPct(totals?.roas ?? 0, prevTotals.roas) : null}
              icon={<Target size={13} />}     color={roasColor(totals?.roas ?? 0)} />
            <KpiCard label={t('mercadolivre.kpi.clicks')}       value={loading ? '…' : fmtNum(totals?.clicks ?? 0)}
              delta={prevTotals ? deltaPct(totals?.clicks ?? 0, prevTotals.clicks) : null}
              icon={<MousePointerClick size={13} />} color="#60a5fa" />
            <KpiCard label="CTR"           value={loading ? '…' : fmtPct(totals?.ctr ?? 0)}
              delta={prevTotals ? deltaPct(totals?.ctr ?? 0, prevTotals.ctr) : null}
              icon={<Eye size={13} />}        color="#a78bfa" sub={t('mercadolivre.kpi.impressionsSub', { count: fmtNum(totals?.impressions ?? 0) })} />
            <KpiCard label="ACoS"          value={loading ? '…' : fmtPct(totals?.acos ?? 0)}
              delta={prevTotals ? deltaPct(totals?.acos ?? 0, prevTotals.acos) : null}
              invertDelta
              icon={<Activity size={13} />}   color={acosColor(totals?.acos ?? 0)} />
          </div>
          {prevTotals && summary?.previous && (
            <p className="text-[10px] text-zinc-700 -mt-2">
              {t('mercadolivre.deltaInfo', { from: summary.previous.from, to: summary.previous.to, spend: fmtBRL(prevTotals.spend), roas: fmtRoas(prevTotals.roas) })}
            </p>
          )}

          {/* Top 5 campaigns por gasto */}
          {top5.length > 0 && (
            <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 inline-flex items-center gap-1">
                <Target size={11} /> {t('mercadolivre.top5Campaigns')}
              </h3>
              <div className="space-y-2">
                {top5.map(c => {
                  const pct = (c.spend / totalSpendForBars) * 100
                  return (
                    <div key={c.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-[11px]">
                        <span className="text-zinc-300 truncate">{c.name || t('mercadolivre.noName')}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-zinc-400 tabular-nums">{fmtBRL(c.spend)}</span>
                          <span className="text-zinc-500 tabular-nums">{fmtRoas(c.roas)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1e24' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: roasColor(c.roas) }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Chart: Spend vs Revenue vs ROAS */}
          {series.length > 0 && (
            <div className="rounded-2xl p-5 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex items-center gap-2">
                <TrendingUp size={13} className="text-emerald-400" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{t('mercadolivre.chartTitle')}</h3>
              </div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis yAxisId="brl"  tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={55}
                      tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="roas" orientation="right" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={40}
                      tickFormatter={v => `${v.toFixed(1)}x`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} iconSize={10} />
                    <Line yAxisId="brl"  type="monotone" dataKey="spend"   name={t('mercadolivre.chart.spend')}   stroke="#f87171" strokeWidth={1.5} dot={false} />
                    <Line yAxisId="brl"  type="monotone" dataKey="revenue" name={t('mercadolivre.chart.revenue')} stroke="#4ade80" strokeWidth={1.5} dot={false} />
                    <Line yAxisId="roas" type="monotone" dataKey="roas"    name="ROAS"    stroke="#FFE600" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Campaigns table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-2" style={{ borderBottom: '1px solid #1a1a1f' }}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{t('mercadolivre.campaigns')}</h3>
              <div className="flex items-center gap-2">
                {/* Filtros */}
                <span className="text-[10px] text-zinc-700 inline-flex items-center gap-1">
                  <Filter size={10} />
                </span>
                {(['all', 'active', 'paused'] as const).map(s => {
                  const active = statusFilter === s
                  const label = s === 'all' ? t('mercadolivre.filter.all', { count: campaigns.length })
                    : s === 'active' ? t('mercadolivre.filter.active', { count: campaigns.filter(c => (c.status ?? '').toLowerCase() === 'active').length })
                    : t('mercadolivre.filter.paused', { count: campaigns.filter(c => (c.status ?? '').toLowerCase() === 'paused').length })
                  return (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
                      style={{
                        background: active ? 'rgba(0,229,255,0.1)' : 'transparent',
                        color:      active ? '#00E5FF' : '#a1a1aa',
                        border:     `1px solid ${active ? 'rgba(0,229,255,0.3)' : '#27272a'}`,
                      }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600"
                    style={{ borderBottom: '1px solid #1a1a1f' }}>
                    <th className="px-3 py-2 font-semibold">{t('mercadolivre.table.campaign')}</th>
                    <th className="px-3 py-2 font-semibold">{t('mercadolivre.table.status')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('mercadolivre.table.dailyBudget')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('mercadolivre.table.spend')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('mercadolivre.table.revenue')}</th>
                    <th className="px-3 py-2 font-semibold text-right">ROAS</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('mercadolivre.table.clicks')}</th>
                    <th className="px-3 py-2 font-semibold text-right">CTR</th>
                    <th className="px-3 py-2 font-semibold text-right w-[1%]"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-xs text-zinc-600">{t('mercadolivre.loading')}</td></tr>
                  ) : filteredCampaigns.length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-xs text-zinc-600 italic">
                      {campaigns.length === 0 ? t('mercadolivre.noCampaigns') : statusFilter === 'active' ? t('mercadolivre.noActiveCampaigns') : t('mercadolivre.noPausedCampaigns')}
                    </td></tr>
                  ) : filteredCampaigns.map(c => (
                    <CampaignRow
                      key={c.id}
                      c={c}
                      expanded={expandedId === c.id}
                      onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      onTogglePause={handleTogglePause}
                      onEditBudget={handleEditBudget}
                      busy={campaignBusy.has(c.id)}
                      getHeaders={getHeaders}
                      dateFrom={range.from}
                      dateTo={range.to}
                      signals={signalsByCampaign.get(c.id) ?? []}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* By SKU report (toggleable) */}
          {bySkuRows.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <button onClick={() => setShowBySku(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3"
                style={{ borderBottom: showBySku ? '1px solid #1a1a1f' : 'none' }}>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 inline-flex items-center gap-1">
                  <Package size={11} /> {t('mercadolivre.bySku', { count: bySkuRows.length })}
                </h3>
                <span className="text-[10px] text-zinc-600 inline-flex items-center gap-1">
                  {showBySku ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </span>
              </button>
              {showBySku && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600"
                        style={{ borderBottom: '1px solid #1a1a1f' }}>
                        <th className="px-3 py-2 font-semibold">{t('mercadolivre.skuTable.listing')}</th>
                        <th className="px-3 py-2 font-semibold text-right">{t('mercadolivre.skuTable.campaigns')}</th>
                        <th className="px-3 py-2 font-semibold text-right">{t('mercadolivre.skuTable.spend')}</th>
                        <th className="px-3 py-2 font-semibold text-right">{t('mercadolivre.skuTable.revenue')}</th>
                        <th className="px-3 py-2 font-semibold text-right">ROAS</th>
                        <th className="px-3 py-2 font-semibold text-right">{t('mercadolivre.skuTable.clicks')}</th>
                        <th className="px-3 py-2 font-semibold text-right">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bySkuRows.slice(0, 50).map(r => (
                        <tr key={r.item_id} className="hover:bg-[#161618] transition-colors">
                          <td className="px-3 py-2.5">
                            <div>
                              <p className="text-[12px] font-medium text-zinc-200 truncate max-w-[300px]">
                                {r.product_name ?? r.item_id}
                              </p>
                              <p className="text-[10px] text-zinc-600 font-mono">
                                {r.sku ?? r.item_id}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-zinc-300 tabular-nums" title={r.campaign_names.join(', ')}>
                            {r.campaign_count}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-zinc-300 tabular-nums">{fmtBRL(r.spend)}</td>
                          <td className="px-3 py-2.5 text-right text-xs text-zinc-300 tabular-nums">{fmtBRL(r.revenue)}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums" style={{ color: roasColor(r.roas) }}>
                            {fmtRoas(r.roas)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-zinc-300 tabular-nums">{fmtNum(r.clicks)}</td>
                          <td className="px-3 py-2.5 text-right text-xs text-zinc-400 tabular-nums">{fmtPct(r.ctr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[9px] text-zinc-700 px-5 py-2 italic" style={{ borderTop: '1px solid #1a1a1f' }}>
                    {t('mercadolivre.skuFootnote')}
                    {bySkuRows.length > 50 && ` ${t('mercadolivre.skuTop50')}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
