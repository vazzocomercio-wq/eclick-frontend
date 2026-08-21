'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Activity, AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Clock, Loader2, RefreshCw, Search,
  ShieldAlert, ShieldCheck, TrendingDown, Users, FlaskConical,
} from 'lucide-react'
import { fetchDashboard, fetchEvents, recalcAll } from './_components/api'
import type { AccountView, DashboardView, LevelOrUnknown, MetricKey, ReputationResult } from './_components/types'
import {
  CARD, LEVEL_STYLE, LevelBadge, MetricCell, PeriodChip, ProgressToShort, RiskBadge, RulesModal,
  accountName, attentionScore, fmtDateBr, fmtInt, fmtPct, fmtPp, levelRank, riskRank, tightestMetric, timeSince,
  useGentlePolling, useReputationRealtime, type Translator,
} from './_components/ui'

type StatusFilter = 'all' | LevelOrUnknown
type PeriodFilter = 'all' | 'short' | 'long'
type FlagFilter   = 'all' | 'near68' | 'alerts'
type SortKey      = 'risk' | 'worst' | 'salesDesc' | 'salesAsc' | 'near68' | 'cancellations' | 'claims' | 'incorrectShipments'

function KpiCard({ label, value, color, icon, sub }: { label: string; value: string; color: string; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        <div style={{ color }}>{icon}</div>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-500 mt-1">{sub}</p>}
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) {
  const active = value !== 'all' && value !== 'risk'
  return (
    <label className="flex items-center gap-1">
      <span className="text-zinc-500 text-[10px] uppercase tracking-wider">{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)} className="rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer"
        style={{ background: active ? 'rgba(0,229,255,0.08)' : '#09090b', border: `1px solid ${active ? 'rgba(0,229,255,0.3)' : '#1a1a1f'}`, color: active ? '#67e8f9' : '#fafafa' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

/** Central de atenção — quem precisa de ação primeiro. */
function AttentionCenter({ accounts, view, t }: { accounts: AccountView[]; view: (a: AccountView) => ReputationResult | null; t: Translator }) {
  const items = accounts
    .map(a => ({ a, r: view(a) }))
    .filter((x): x is { a: AccountView; r: ReputationResult } => !!x.r)
    .filter(x => x.r.overallLevel !== 'green' || riskRank(x.r.riskLevel) >= riskRank('high'))
    .sort((x, y) => attentionScore(y.r) - attentionScore(x.r))
  return (
    <section style={{ ...CARD, padding: '16px 18px' }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#fafafa' }}>
          <ShieldAlert size={15} className="text-amber-400" /> {t('attention.title')}
        </h2>
        <span className="text-[11px] text-zinc-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-zinc-400"><CheckCircle2 size={14} className="text-green-500" /> {t('attention.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {items.slice(0, 9).map(({ a, r }) => {
            const m = tightestMetric(r)
            const s = LEVEL_STYLE[r.overallLevel]
            return (
              <Link key={a.seller_id} href={`/dashboard/executive/reputation/${a.seller_id}`}
                className="rounded-lg p-3 transition-colors hover:bg-white/[0.03]" style={{ border: `1px solid ${s.border}`, background: s.bg }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate" style={{ color: '#fafafa' }}>{accountName(a, t)}</span>
                  <RiskBadge risk={r.riskLevel} t={t} size="sm" />
                </div>
                {m && m.percentage != null && (
                  <div className="mt-1.5 text-[12px]" style={{ color: '#d4d4d8' }}>
                    {t('attention.line', { metric: t(`metricShort.${m.key}`), pct: fmtPct(m.percentage), level: m.currentLimit != null ? t(`level.${m.level}`).toLowerCase() : t('level.orange').toLowerCase(), limit: fmtPct(m.currentLimit ?? m.orangeLimit) })}
                    <div className="text-[11px] mt-0.5" style={{ color: m.distancePercentagePoints != null && m.distancePercentagePoints >= 0 ? '#a1a1aa' : '#ef4444' }}>
                      {m.distancePercentagePoints != null ? t('attention.margin', { pp: fmtPp(m.distancePercentagePoints) }) : t('card.exceeded', { limit: fmtPct(m.orangeLimit) })}
                    </div>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2"><LevelBadge level={r.overallLevel} t={t} size="sm" /><PeriodChip r={r} t={t} /></div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function ReputationDashboardPage() {
  const t = useTranslations('mlReputation')
  const [data, setData]       = useState<DashboardView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [rulesOpen, setRulesOpen]   = useState(false)
  const [simulate, setSimulate]     = useState(false)
  const [alertIds, setAlertIds]     = useState<Set<number>>(new Set())

  const [status, setStatus] = useState<StatusFilter>('all')
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [flag, setFlag]     = useState<FlagFilter>('all')
  const [sort, setSort]     = useState<SortKey>('risk')
  const [query, setQuery]   = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [d, ev] = await Promise.all([fetchDashboard(), fetchEvents(null, 100).catch(() => ({ events: [] }))])
      setData(d)
      setAlertIds(new Set(ev.events.filter(e => e.severity !== 'info').map(e => Number(e.seller_id))))
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useReputationRealtime(() => { void load(true) })
  const tick = useGentlePolling(() => { void load(true) })

  // Contas "pendentes" (1º cálculo em background): re-checa em 15s sem flash.
  useEffect(() => {
    if (!data || data.summary.pending === 0) return
    const id = setTimeout(() => { void load(true) }, 15_000)
    return () => clearTimeout(id)
  }, [data, load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try { await recalcAll(); await load(true) }
    catch (err) { setError((err as Error).message) }
    finally { setRefreshing(false) }
  }, [load])

  const canSimulate = !!data?.rules.upcoming
  const view = useCallback((a: AccountView): ReputationResult | null =>
    (simulate && canSimulate ? a.upcoming : a.active) ?? a.active, [simulate, canSimulate])

  const threshold = (simulate && data?.rules.upcoming ? data.rules.upcoming : data?.rules.active)?.config.measurement.minimumSalesForShortPeriod ?? 68

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const metricPct = (r: ReputationResult | null, k: MetricKey) => r?.metrics[k].percentage ?? -1
    const list = data.accounts.filter(a => {
      const r = view(a)
      if (q && !(a.nickname ?? '').toLowerCase().includes(q) && !String(a.seller_id).includes(q)) return false
      if (status !== 'all' && (r?.overallLevel ?? 'unknown') !== status) return false
      if (period !== 'all' && r && ((period === 'short') !== (r.measurementPeriod === r.shortPeriodDays))) return false
      if (flag === 'near68' && !(r && ((r.salesUntilShortPeriod > 0 && r.salesUntilShortPeriod <= 10) || r.periodForecast?.kind === 'may_drop_to_long'))) return false
      if (flag === 'alerts' && !alertIds.has(a.seller_id)) return false
      return true
    })
    const cmp: Record<SortKey, (x: AccountView, y: AccountView) => number> = {
      risk:      (x, y) => attentionScore(view(y)) - attentionScore(view(x)),
      worst:     (x, y) => levelRank(view(y)?.overallLevel ?? 'unknown') - levelRank(view(x)?.overallLevel ?? 'unknown'),
      salesDesc: (x, y) => (view(y)?.salesLast60Days ?? -1) - (view(x)?.salesLast60Days ?? -1),
      salesAsc:  (x, y) => (view(x)?.salesLast60Days ?? 1e9) - (view(y)?.salesLast60Days ?? 1e9),
      near68:    (x, y) => Math.abs((view(x)?.salesLast60Days ?? 1e9) - threshold) - Math.abs((view(y)?.salesLast60Days ?? 1e9) - threshold),
      cancellations:      (x, y) => metricPct(view(y), 'cancellations') - metricPct(view(x), 'cancellations'),
      claims:             (x, y) => metricPct(view(y), 'claims') - metricPct(view(x), 'claims'),
      incorrectShipments: (x, y) => metricPct(view(y), 'incorrectShipments') - metricPct(view(x), 'incorrectShipments'),
    }
    return [...list].sort(cmp[sort])
  }, [data, query, status, period, flag, sort, view, alertIds, threshold])

  const lastCalc = useMemo(() => {
    const times = (data?.accounts ?? []).map(a => a.calculated_at).filter((x): x is string => !!x).sort()
    return times.length ? times[times.length - 1] : null
  }, [data])
  void tick

  // Modal "Entenda as regras": mostra a metodologia NOVA quando ela existe
  // (com a data de vigência e a nota da regra anterior); senão, a vigente.
  const ruleForModal   = data?.rules.upcoming ?? data?.rules.active ?? null
  const legacyForModal = data?.rules.upcoming ? data.rules.active : null

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-widest">{t('eyebrow')}</p>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2"><ShieldCheck size={22} className="text-cyan-400" />{t('title')}</h1>
          <p className="text-[12px] text-zinc-500 mt-1">{t('subtitle')}</p>
          <p className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5"><Activity size={11} />{t('updatedAt', { when: timeSince(lastCalc, t) })}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canSimulate && data?.rules.upcoming && (
            <button onClick={() => setSimulate(v => !v)} aria-pressed={simulate}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: simulate ? 'rgba(0,229,255,0.12)' : 'transparent', border: `1px solid ${simulate ? 'rgba(0,229,255,0.4)' : '#27272a'}`, color: simulate ? '#00E5FF' : '#a1a1aa' }}>
              <FlaskConical size={12} /> {t('simToggle', { date: fmtDateBr(data.rules.upcoming.effectiveFrom) })}
            </button>
          )}
          <button onClick={() => setRulesOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ border: '1px solid #27272a', color: '#d4d4d8', background: 'transparent' }}>
            <BookOpen size={12} /> {t('rulesButton')}
          </button>
          <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold">
            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {refreshing ? t('refreshing') : t('refresh')}
          </button>
        </div>
      </div>

      {simulate && data?.rules.upcoming && (
        <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.25)', color: '#a5f3fc' }}>
          <FlaskConical size={14} className="shrink-0 mt-0.5" />
          <span>{t('simActiveBanner', { date: fmtDateBr(data.rules.upcoming.effectiveFrom), name: data.rules.active.name })}</span>
        </div>
      )}
      {!simulate && data?.rules.upcoming && (
        <p className="text-[11px] text-zinc-500">{t('ruleActiveLabel', { name: data.rules.active.name })} · {t('ruleUpcomingLabel', { date: fmtDateBr(data.rules.upcoming.effectiveFrom) })}</p>
      )}

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {loading && !data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-zinc-900/50 animate-pulse" />)}
          </div>
          <div className="h-40 rounded-xl bg-zinc-900/50 animate-pulse" />
          <div className="h-64 rounded-xl bg-zinc-900/50 animate-pulse" />
        </>
      )}

      {data && data.accounts.length === 0 && !loading && (
        <div className="rounded-xl p-8 text-center" style={CARD}>
          <Users size={48} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-300 font-medium">{t('empty.title')}</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">{t('empty.desc')}</p>
          <Link href="/dashboard/configuracoes/integracoes" className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-cyan-400">{t('empty.cta')} <ArrowRight size={12} /></Link>
        </div>
      )}

      {data && data.accounts.length > 0 && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard label={t('kpi.total')}      value={fmtInt(data.summary.total)}              color="#00E5FF" icon={<Users size={14} />} />
            <KpiCard label={t('kpi.healthy')}    value={fmtInt(data.summary.healthy)}            color="#22c55e" icon={<CheckCircle2 size={14} />} />
            <KpiCard label={t('kpi.attention')}  value={fmtInt(data.summary.attention)}          color="#eab308" icon={<AlertTriangle size={14} />} />
            <KpiCard label={t('kpi.critical')}   value={fmtInt(data.summary.critical)}           color="#ef4444" icon={<ShieldAlert size={14} />} />
            <KpiCard label={t('kpi.nearSwitch')} value={fmtInt(data.summary.near_period_switch)} color="#a5b4fc" icon={<Clock size={14} />} />
            <KpiCard label={t('kpi.worsened')}   value={fmtInt(data.summary.worsened_recently)}  color="#f97316" icon={<TrendingDown size={14} />} sub={data.summary.pending > 0 ? t('kpi.pending') + `: ${data.summary.pending}` : undefined} />
          </div>

          {data.summary.pending > 0 && (
            <div className="rounded-lg p-3 text-xs flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a1f', color: '#a1a1aa' }}>
              <Loader2 size={13} className="animate-spin" /> {t('pendingBanner', { n: data.summary.pending })}
            </div>
          )}

          <AttentionCenter accounts={data.accounts} view={view} t={t} />

          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: '#09090b', border: '1px solid #1a1a1f', minWidth: 220 }}>
              <Search size={13} className="text-zinc-500" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('filters.search')} aria-label={t('filters.search')}
                className="bg-transparent outline-none text-xs w-full" style={{ color: '#fafafa' }} />
            </div>
            <FilterSelect label={t('filters.status')} value={status} onChange={v => setStatus(v as StatusFilter)} options={[
              { value: 'all', label: t('filters.all') }, { value: 'green', label: t('level.green') }, { value: 'yellow', label: t('level.yellow') },
              { value: 'orange', label: t('level.orange') }, { value: 'red', label: t('level.red') },
            ]} />
            <FilterSelect label={t('filters.period')} value={period} onChange={v => setPeriod(v as PeriodFilter)} options={[
              { value: 'all', label: t('filters.all') }, { value: 'short', label: t('period.days', { days: 60 }) }, { value: 'long', label: t('period.days', { days: 365 }) },
            ]} />
            <FilterSelect label={t('filters.flag')} value={flag} onChange={v => setFlag(v as FlagFilter)} options={[
              { value: 'all', label: t('filters.all') }, { value: 'near68', label: t('filters.near68', { threshold }) }, { value: 'alerts', label: t('filters.withAlerts') },
            ]} />
            <FilterSelect label={t('filters.sort')} value={sort} onChange={v => setSort(v as SortKey)} options={[
              { value: 'risk', label: t('filters.sortRisk') }, { value: 'worst', label: t('filters.sortWorst') },
              { value: 'salesDesc', label: t('filters.sortSalesDesc') }, { value: 'salesAsc', label: t('filters.sortSalesAsc') },
              { value: 'near68', label: t('filters.sortNear68', { threshold }) },
              { value: 'cancellations', label: t('filters.sortCancel') }, { value: 'claims', label: t('filters.sortClaims') }, { value: 'incorrectShipments', label: t('filters.sortShip') },
            ]} />
          </div>

          {/* Tabela multicontas */}
          <div className="rounded-xl overflow-x-auto" style={CARD}>
            <table className="w-full" style={{ minWidth: 1040 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1f' }}>
                  {[t('table.account'), t('table.sales60'), t('table.sales365'), t('table.period'), t('metricShort.cancellations'), t('metricShort.incorrectShipments'), t('metricShort.claims'), t('table.risk'), ''].map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#52525b', background: '#0e0e11' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-xs text-zinc-500">{t('filters.noResults')}</td></tr>
                )}
                {filtered.map(a => {
                  const r = view(a)
                  return (
                    <tr key={a.seller_id} style={{ borderBottom: '1px solid #1a1a1f', transition: 'background 100ms' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td className="px-3 py-3">
                        <Link href={`/dashboard/executive/reputation/${a.seller_id}`} className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(255,230,0,0.12)', color: '#FFE600' }}>
                            {accountName(a, t).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate" style={{ color: '#fafafa' }}>{accountName(a, t)}</div>
                            <div className="text-[10px] text-zinc-500">{t('table.id', { id: a.seller_id })}{r?.official?.levelId ? ` · ${t(`detail.level.${r.official.levelId}`)}` : ''}</div>
                          </div>
                        </Link>
                      </td>
                      {!r ? (
                        <td colSpan={7} className="px-3 py-3 text-xs" style={{ color: a.status === 'error' ? '#f87171' : '#71717a' }}>
                          {a.status === 'error' ? `${t('table.error')}: ${a.last_error ?? ''}` : <span className="inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> {t('table.pending')}</span>}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-3 text-sm font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {fmtInt(r.salesLast60Days)}
                            {r.measurementPeriod === r.longPeriodDays && (
                              <div style={{ width: 120, marginTop: 4 }}><ProgressToShort r={r} t={t} compact /></div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm" style={{ fontVariantNumeric: 'tabular-nums', color: '#a1a1aa' }}>{fmtInt(r.salesLast365Days)}</td>
                          <td className="px-3 py-3"><PeriodChip r={r} t={t} /></td>
                          <td className="px-3 py-3"><MetricCell m={r.metrics.cancellations} t={t} /></td>
                          <td className="px-3 py-3"><MetricCell m={r.metrics.incorrectShipments} t={t} /></td>
                          <td className="px-3 py-3"><MetricCell m={r.metrics.claims} t={t} /></td>
                          <td className="px-3 py-3"><RiskBadge risk={r.riskLevel} t={t} /></td>
                        </>
                      )}
                      <td className="px-3 py-3 text-right">
                        <Link href={`/dashboard/executive/reputation/${a.seller_id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 whitespace-nowrap">
                          {t('table.details')} <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} rule={ruleForModal} legacy={legacyForModal} t={t} />
    </div>
  )
}
