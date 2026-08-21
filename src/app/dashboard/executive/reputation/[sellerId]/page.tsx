'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Activity, AlertTriangle, ArrowLeft, Award, BookOpen, Clock, FlaskConical, History, Loader2, RefreshCw,
  ShieldCheck, Sparkles,
} from 'lucide-react'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis,
} from 'recharts'
import { fetchAccount, fetchEvents, fetchHistory, fetchRules, recalcAccount, simulateAccount } from '../_components/api'
import type {
  AccountView, HistoryPoint, ReputationEvent, ReputationResult, RuleSetSummary, SimulationInput,
} from '../_components/types'
import { METRIC_KEYS } from '../_components/types'
import {
  CARD, LEVEL_STYLE, LevelBadge, MetricCard, PeriodChip, ProgressToShort, RiskBadge, RulesModal,
  accountName, fmtDate, fmtDateBr, fmtDateTime, fmtInt, fmtPct, fmtPp, tightestMetric, timeSince, toNum,
  useGentlePolling, useReputationRealtime, type Translator,
} from '../_components/ui'

const RANGES = [7, 30, 60, 90, 365] as const
const OFFICIAL_LEVEL_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  '5_green':       { text: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.40)' },
  '4_light_green': { text: '#84cc16', bg: 'rgba(132,204,22,0.12)',  border: 'rgba(132,204,22,0.40)' },
  '3_yellow':      { text: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.40)' },
  '2_orange':      { text: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.40)' },
  '1_red':         { text: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.40)' },
  '0_red':         { text: '#a1a1aa', bg: 'rgba(113,113,122,0.12)', border: 'rgba(113,113,122,0.30)' },
}
const KNOWN_LEVEL_IDS = new Set(Object.keys(OFFICIAL_LEVEL_STYLE))

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <h2 className="text-[12px] uppercase tracking-wider font-semibold flex items-center gap-2" style={{ color: '#a1a1aa' }}>{icon}{children}</h2>
}

function HistoryChart({ history, t }: { history: HistoryPoint[]; t: Translator }) {
  const data = history.map(h => ({
    date:   fmtDate(h.snapshot_date + 'T12:00:00'),
    cancel: toNum(h.cancellation_pct), ship: toNum(h.shipping_issue_pct), claims: toNum(h.claim_pct),
    oCancel: toNum(h.official_cancellation_pct), oShip: toNum(h.official_delayed_pct), oClaims: toNum(h.official_claims_pct),
    period: h.measurement_period,
  }))
  if (data.length === 0) return <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.10)', borderRadius: 12, padding: 20, color: '#71717a', fontSize: 13 }}>{t('detail.historyEmpty')}</div>
  const label = (k: string) => ({
    cancel: `${t('metricShort.cancellations')} · ${t('detail.historyLocal')}`, ship: `${t('metricShort.incorrectShipments')} · ${t('detail.historyLocal')}`, claims: `${t('metricShort.claims')} · ${t('detail.historyLocal')}`,
    oCancel: `${t('metricShort.cancellations')} · ${t('detail.historyOfficial')}`, oShip: `${t('metricShort.incorrectShipments')} · ${t('detail.historyOfficial')}`, oClaims: `${t('metricShort.claims')} · ${t('detail.historyOfficial')}`,
  })[k] ?? k
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#1f1f25" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
          <ReTooltip content={({ active, payload, label: lbl }) => {
            if (!active || !payload?.length) return null
            return (
              <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
                <div style={{ color: '#a1a1aa', marginBottom: 4 }}>{String(lbl)} · {t('period.days', { days: (payload[0].payload as { period: number }).period })}</div>
                {payload.map(p => <div key={String(p.dataKey)} style={{ color: p.color as string }}>{label(String(p.dataKey))}: {fmtPct(p.value as number)}</div>)}
              </div>
            )
          }} />
          <Legend wrapperStyle={{ fontSize: 10, color: '#a1a1aa' }} formatter={(v: string) => label(v)} />
          <Line type="monotone" dataKey="cancel"  stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="ship"    stroke="#eab308" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="claims"  stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="oCancel" stroke="#f97316" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls opacity={0.6} />
          <Line type="monotone" dataKey="oShip"   stroke="#eab308" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls opacity={0.6} />
          <Line type="monotone" dataKey="oClaims" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls opacity={0.6} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Simulator({ sellerId, ruleName, t }: { sellerId: number; ruleName: string | undefined; t: Translator }) {
  const [form, setForm] = useState<{ cancellations: number; incorrectShipments: number; claims: number; sales: number; addSales: boolean }>({ cancellations: 0, incorrectShipments: 0, claims: 0, sales: 0, addSales: true })
  const [result, setResult] = useState<{ base: ReputationResult; simulated: ReputationResult } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const run = useCallback(async () => {
    setBusy(true); setErr(null)
    try {
      const body: SimulationInput = {
        extraOccurrences: { cancellations: form.cancellations, incorrectShipments: form.incorrectShipments, claims: form.claims },
        extraSales: form.sales, occurrencesAddSales: form.addSales, rule_set: ruleName,
      }
      setResult(await simulateAccount(sellerId, body))
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }, [form, sellerId, ruleName])

  const num = (k: 'cancellations' | 'incorrectShipments' | 'claims' | 'sales') => (
    <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
      {t(`sim.${k}`)}
      <input type="number" min={0} step={1} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
        className="rounded-lg px-2.5 py-1.5 text-sm outline-none w-full" style={{ background: '#09090b', border: '1px solid #1a1a1f', color: '#fafafa' }} />
    </label>
  )

  return (
    <section style={{ ...CARD, padding: '16px 18px' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <SectionTitle icon={<FlaskConical size={13} />}>{t('sim.title')}</SectionTitle>
          <p className="text-[11px] text-zinc-500 mt-1">{t('sim.desc')}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        {num('cancellations')}{num('incorrectShipments')}{num('claims')}{num('sales')}
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
          <input type="checkbox" checked={form.addSales} onChange={e => setForm(f => ({ ...f, addSales: e.target.checked }))} /> {t('sim.addSales')}
        </label>
        <div className="flex-1" />
        <button onClick={() => { setForm({ cancellations: 0, incorrectShipments: 0, claims: 0, sales: 0, addSales: true }); setResult(null) }} className="px-3 py-1.5 rounded-lg text-xs" style={{ border: '1px solid #27272a', color: '#a1a1aa' }}>{t('sim.reset')}</button>
        <button onClick={run} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {busy ? t('sim.running') : t('sim.run')}
        </button>
      </div>
      {err && <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{err}</div>}
      {result && (
        <div className="mt-4">
          <div className="text-[11px] text-zinc-500 mb-2">{t('sim.result')} · {t('sim.periodNote', { days: result.simulated.measurementPeriod })}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {METRIC_KEYS.map(k => {
              const b = result.base.metrics[k]; const s = result.simulated.metrics[k]
              const st = LEVEL_STYLE[s.level]
              return (
                <div key={k} className="rounded-lg p-3" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">{t(`metric.${k}`)}</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold" style={{ color: st.text }}>{fmtPct(s.percentage)}</span>
                    <span className="text-[11px] text-zinc-500">{t('sim.from', { pct: fmtPct(b.percentage) })}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    <LevelBadge level={s.level} t={t} size="sm" />
                    <span style={{ color: '#a1a1aa' }}>{b.level !== s.level ? t('sim.levelChange', { from: t(`level.${b.level}`), to: t(`level.${s.level}`) }) : t('sim.same', { level: t(`level.${s.level}`) })}</span>
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: '#d4d4d8' }}>{s.distancePercentagePoints != null ? t('card.margin', { pp: fmtPp(s.distancePercentagePoints) }) : t('card.exceeded', { limit: fmtPct(s.orangeLimit) })} · {t('card.ofSales', { affected: fmtInt(s.affectedSales), total: fmtInt(s.totalSales) })}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function EventLine({ e, t }: { e: ReputationEvent; t: Translator }) {
  const color = e.severity === 'critical' ? '#ef4444' : e.severity === 'warning' ? '#f59e0b' : '#a1a1aa'
  const metric = e.metric ? t(`metricShort.${e.metric}`) : ''
  const lv = (v: string | null) => (v && ['green', 'yellow', 'orange', 'red'].includes(v)) ? t(`level.${v}`) : (v && ['safe', 'attention', 'high', 'critical'].includes(v) ? t(`risk.${v}`) : (v ?? '—'))
  const text = e.event_type === 'period_changed'
    ? t('events.period_changed', { from: e.from_value ?? '—', to: e.to_value ?? '—' })
    : t(`events.${e.event_type}`, { metric, from: lv(e.from_value), to: lv(e.to_value) })
  return (
    <li className="flex items-start gap-2 text-[12px] py-1.5" style={{ borderBottom: '1px solid #1a1a1f' }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: color, marginTop: 6, flexShrink: 0 }} />
      <span style={{ color: '#d4d4d8', flex: 1 }}>{text}</span>
      <span style={{ color: '#52525b', whiteSpace: 'nowrap' }}>{fmtDateTime(e.created_at)}</span>
    </li>
  )
}

export default function ReputationAccountPage() {
  const t = useTranslations('mlReputation')
  const params = useParams<{ sellerId: string }>()
  const sellerId = Number(params?.sellerId)

  const [account, setAccount] = useState<AccountView | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [events, setEvents]   = useState<ReputationEvent[]>([])
  const [rules, setRules]     = useState<RuleSetSummary[]>([])
  const [range, setRange]     = useState<(typeof RANGES)[number]>(30)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [rulesOpen, setRulesOpen]   = useState(false)
  const [simulate, setSimulate]     = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!Number.isFinite(sellerId)) return
    if (!silent) setLoading(true)
    try {
      const [a, h, ev, ru] = await Promise.all([
        fetchAccount(sellerId), fetchHistory(sellerId, range), fetchEvents(sellerId, 30).catch(() => ({ events: [] })), fetchRules().catch(() => ({ rules: [] })),
      ])
      setAccount(a); setHistory(h.history); setEvents(ev.events); setRules(ru.rules); setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [sellerId, range])

  useEffect(() => { void load() }, [load])
  useReputationRealtime(id => { if (id == null || id === sellerId) void load(true) })
  const tick = useGentlePolling(() => { void load(true) })
  void tick

  useEffect(() => {
    if (account?.status !== 'pending') return
    const id = setTimeout(() => { void load(true) }, 10_000)
    return () => clearTimeout(id)
  }, [account, load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try { await recalcAccount(sellerId, { sync_official: true }); await load(true) }
    catch (err) { setError((err as Error).message) }
    finally { setRefreshing(false) }
  }, [sellerId, load])

  const r: ReputationResult | null = (simulate && account?.upcoming ? account.upcoming : account?.active) ?? null
  const upcomingRule = useMemo(() => account?.upcoming ? rules.find(x => x.name === account.upcoming?.ruleSet.name) ?? null : null, [rules, account])
  const activeRule   = useMemo(() => r ? rules.find(x => x.name === r.ruleSet.name) ?? null : null, [rules, r])
  const legacyRule   = useMemo(() => account?.active ? rules.find(x => x.name === account.active?.ruleSet.name) ?? null : null, [rules, account])
  const tightest = r ? tightestMetric(r) : null
  const official = r?.official ?? account?.active?.official ?? null
  const officialStyle = official?.levelId && OFFICIAL_LEVEL_STYLE[official.levelId] ? OFFICIAL_LEVEL_STYLE[official.levelId] : OFFICIAL_LEVEL_STYLE['0_red']
  const divergent = r ? METRIC_KEYS.filter(k => r.metrics[k].divergence?.significant) : []

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      <Link href="/dashboard/executive/reputation" className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-cyan-400"><ArrowLeft size={12} /> {t('detail.back')}</Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(255,230,0,0.12)', color: '#FFE600' }}>
            {account ? accountName(account, t).charAt(0).toUpperCase() : '…'}
          </div>
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-widest">{t('eyebrow')} · {t('table.id', { id: sellerId })}</p>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck size={20} className="text-cyan-400" />{account ? accountName(account, t) : t('loading')}</h1>
            <p className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5"><Activity size={11} />{t('updatedAt', { when: timeSince(account?.calculated_at, t) })}{account?.calculated_at ? ` · ${fmtDateTime(account.calculated_at)}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {account?.upcoming && upcomingRule && (
            <button onClick={() => setSimulate(v => !v)} aria-pressed={simulate} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: simulate ? 'rgba(0,229,255,0.12)' : 'transparent', border: `1px solid ${simulate ? 'rgba(0,229,255,0.4)' : '#27272a'}`, color: simulate ? '#00E5FF' : '#a1a1aa' }}>
              <FlaskConical size={12} /> {t('simToggle', { date: fmtDateBr(upcomingRule.effectiveFrom) })}
            </button>
          )}
          <button onClick={() => setRulesOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ border: '1px solid #27272a', color: '#d4d4d8' }}><BookOpen size={12} /> {t('rulesButton')}</button>
          <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold">
            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {refreshing ? t('refreshing') : t('refresh')}
          </button>
        </div>
      </div>

      {simulate && upcomingRule && (
        <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.25)', color: '#a5f3fc' }}>
          <FlaskConical size={14} className="shrink-0 mt-0.5" /><span>{t('simActiveBanner', { date: fmtDateBr(upcomingRule.effectiveFrom), name: account?.active?.ruleSet.name ?? '' })}</span>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {loading && !account && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 rounded-xl bg-zinc-900/50 animate-pulse" />)}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 rounded-xl bg-zinc-900/50 animate-pulse" />)}</div>
        </>
      )}

      {account && !r && (
        <div className="rounded-xl p-8 text-center" style={CARD}>
          {account.status === 'error'
            ? <><AlertTriangle size={40} className="mx-auto text-red-400 mb-3" /><p className="text-zinc-300 font-medium">{t('table.error')}</p><p className="text-xs text-zinc-500 mt-2">{account.last_error}</p></>
            : <><Loader2 size={40} className="mx-auto text-zinc-600 mb-3 animate-spin" /><p className="text-zinc-300 font-medium">{t('table.pending')}</p><p className="text-xs text-zinc-500 mt-2">{t('pendingBanner', { n: 1 })}</p></>}
        </div>
      )}

      {r && (
        <>
          {/* Resumo: oficial · interno · período */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl p-4" style={{ background: officialStyle.bg, border: `1px solid ${officialStyle.border}` }}>
              <div className="flex items-center justify-between">
                <SectionTitle icon={<span className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center" style={{ background: 'rgba(255,230,0,0.15)', color: '#FFE600' }}>ML</span>}>{t('detail.officialTitle')}</SectionTitle>
              </div>
              {official ? (
                <>
                  <div className="flex items-center gap-3 mt-3">
                    <Award size={34} color={officialStyle.text} />
                    <div>
                      <div className="text-lg font-semibold leading-tight" style={{ color: officialStyle.text }}>
                        {official.levelId && KNOWN_LEVEL_IDS.has(official.levelId) ? t(`detail.level.${official.levelId}`) : t('detail.level.unknown')}
                      </div>
                      <div className="text-[11px] text-zinc-400">{official.powerSellerStatus ?? ''}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-3">{t('detail.transactions', { completed: fmtInt(official.completedTransactions), total: fmtInt(official.totalTransactions) })}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">{t('detail.officialDesc')} · {t('detail.officialSynced', { when: timeSince(official.syncedAt, t) })}</div>
                </>
              ) : <p className="text-xs text-zinc-500 mt-3">{t('detail.officialNone')}</p>}
            </div>

            <div className="rounded-xl p-4" style={{ ...CARD, border: `1px solid ${LEVEL_STYLE[r.overallLevel].border}` }}>
              <SectionTitle icon={<ShieldCheck size={13} />}>{t('detail.internalTitle')}</SectionTitle>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{t('detail.overallLevel')}</div>
                  <LevelBadge level={r.overallLevel} t={t} size="lg" />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{t('detail.risk')}</div>
                  <RiskBadge risk={r.riskLevel} t={t} />
                </div>
              </div>
              {tightest && tightest.level !== 'unknown' && (
                <div className="text-[12px] mt-3" style={{ color: '#d4d4d8' }}>
                  ⚠ {t(`metricShort.${tightest.key}`)} — {fmtPct(tightest.percentage)} · {tightest.currentLimit != null ? t('card.limitCurrent', { level: t(`level.${tightest.level}`), limit: fmtPct(tightest.currentLimit) }) : t('card.exceeded', { limit: fmtPct(tightest.orangeLimit) })}
                </div>
              )}
              <div className="text-[10px] text-zinc-500 mt-2">{t('detail.internalDesc')}</div>
            </div>

            <div className="rounded-xl p-4" style={CARD}>
              <div className="flex items-center justify-between">
                <SectionTitle icon={<Clock size={13} />}>{t('period.title')}</SectionTitle>
                <PeriodChip r={r} t={t} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-[10px] text-zinc-500 uppercase">{t('period.sales60')}</div>
                  <div className="text-xl font-bold" style={{ color: '#fafafa' }}>{fmtInt(r.salesLast60Days)}</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-[10px] text-zinc-500 uppercase">{t('period.sales365')}</div>
                  <div className="text-xl font-bold" style={{ color: '#fafafa' }}>{fmtInt(r.salesLast365Days)}</div>
                </div>
              </div>
              <div className="mt-3"><ProgressToShort r={r} t={t} /></div>
              <div className="text-[10px] text-zinc-500 mt-2">{t('period.considered')}: {fmtInt(r.salesConsidered)}</div>
            </div>
          </div>

          {(r.warnings.length > 0 || divergent.length > 0) && (
            <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d' }}>
              <div className="font-semibold flex items-center gap-1.5 mb-1"><AlertTriangle size={13} /> {divergent.length > 0 ? t('detail.divergenceTitle') : t('detail.warningsTitle')}</div>
              <ul className="list-disc pl-5 space-y-0.5" style={{ color: '#e4e4e7' }}>
                {divergent.length > 0 && <li>{t('detail.divergenceDesc')}</li>}
                {r.warnings.map(w => (
                  <li key={w}>{t(`warnings.${w}`, {
                    since: fmtDate(w.startsWith('claims') ? r.coverage?.claimsSince : r.coverage?.delaysSince),
                    with: fmtInt(r.coverage?.cancelledWithDetail ?? 0), total: fmtInt(r.coverage?.cancelledTotal ?? 0),
                  })}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Indicadores */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {METRIC_KEYS.map(k => <MetricCard key={k} m={r.metrics[k]} period={r.measurementPeriod} t={t} highlight={tightest?.key === k} />)}
          </div>

          {/* Histórico */}
          <section style={{ ...CARD, padding: '16px 18px' }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <SectionTitle icon={<History size={13} />}>{t('detail.historyTitle')}</SectionTitle>
              <div className="flex items-center gap-1">
                {RANGES.map(d => (
                  <button key={d} onClick={() => setRange(d)} className="px-2.5 py-1 rounded-md text-[11px] font-semibold"
                    style={{ background: range === d ? 'rgba(0,229,255,0.10)' : 'transparent', border: `1px solid ${range === d ? 'rgba(0,229,255,0.3)' : '#27272a'}`, color: range === d ? '#00E5FF' : '#a1a1aa' }}>
                    {t('detail.range', { days: d })}
                  </button>
                ))}
              </div>
            </div>
            <HistoryChart history={history} t={t} />
          </section>

          <Simulator sellerId={sellerId} ruleName={simulate ? account?.upcoming?.ruleSet.name : undefined} t={t} />

          {/* Eventos + auditoria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <section style={{ ...CARD, padding: '16px 18px' }}>
              <SectionTitle icon={<AlertTriangle size={13} />}>{t('detail.eventsTitle')}</SectionTitle>
              {events.length === 0 ? <p className="text-xs text-zinc-500 mt-3">{t('detail.eventsEmpty')}</p> : (
                <ul className="mt-2">{events.map(e => <EventLine key={e.id} e={e} t={t} />)}</ul>
              )}
            </section>
            <section style={{ ...CARD, padding: '16px 18px' }}>
              <SectionTitle icon={<Activity size={13} />}>{t('audit.title')}</SectionTitle>
              <ul className="mt-2 text-[12px] space-y-1" style={{ color: '#a1a1aa' }}>
                <li>{t('audit.calculatedAt', { when: fmtDateTime(r.calculatedAt) })}</li>
                <li>{t('audit.dataAsOf', { when: fmtDateTime(r.dataAsOf) })}</li>
                <li>{t('audit.rule', { name: r.ruleSet.name })}{r.ruleSet.effectiveFrom ? ` (${fmtDateBr(r.ruleSet.effectiveFrom)}${r.ruleSet.effectiveUntil ? ` → ${fmtDateBr(r.ruleSet.effectiveUntil)}` : ' →'})` : ''}</li>
                <li>{t('audit.period', { days: r.measurementPeriod })}</li>
                <li>{t('audit.sales', { n: fmtInt(r.salesConsidered) })}</li>
                <li>{t('audit.counts', { c: fmtInt(r.metrics.cancellations.affectedSales), s: fmtInt(r.metrics.incorrectShipments.affectedSales), q: fmtInt(r.metrics.claims.affectedSales) })}</li>
                {METRIC_KEYS.map(k => <li key={k}>{t(`metricShort.${k}`)}: {fmtPct(r.metrics[k].percentage, 4)}</li>)}
              </ul>
            </section>
          </div>
        </>
      )}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} rule={upcomingRule ?? activeRule} legacy={upcomingRule ? legacyRule : null} t={t} />
    </div>
  )
}
