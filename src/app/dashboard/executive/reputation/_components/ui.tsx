'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'
import { getSocket } from '@/lib/socket'
import type {
  AccountView, LevelOrUnknown, MetricKey, MetricResult, MetricThresholds, ReputationResult, RiskOrUnknown, RuleSetSummary,
} from './types'

// ── Formatação (pt-BR) ────────────────────────────────────────────────────
// Tudo que chega já vem classificado pelo backend com o valor real; aqui só
// arredondamos pra apresentação (2 casas).

export type Translator = (key: string, values?: Record<string, string | number | Date>) => string

export const fmtPct = (v: number | null | undefined, digits = 2): string =>
  v == null || !Number.isFinite(v) ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`

export const fmtPp = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`

export const fmtInt = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('pt-BR')

export const fmtDateTime = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export const fmtDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const fmtDateBr = (ymd: string | null | undefined): string => {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

export const toNum = (v: number | string | null | undefined): number | null => {
  if (v == null) return null
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

// ── Paleta das faixas / riscos ────────────────────────────────────────────

export const LEVEL_STYLE: Record<LevelOrUnknown, { text: string; bg: string; border: string; dot: string }> = {
  green:   { text: '#22c55e', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.35)',   dot: '#22c55e' },
  yellow:  { text: '#eab308', bg: 'rgba(234,179,8,0.10)',   border: 'rgba(234,179,8,0.35)',   dot: '#eab308' },
  orange:  { text: '#f97316', bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.35)',  dot: '#f97316' },
  red:     { text: '#ef4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.35)',   dot: '#ef4444' },
  unknown: { text: '#71717a', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.10)', dot: '#52525b' },
}

export const RISK_STYLE: Record<RiskOrUnknown, { text: string; bg: string; border: string }> = {
  safe:      { text: '#22c55e', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.30)'   },
  attention: { text: '#eab308', bg: 'rgba(234,179,8,0.10)',   border: 'rgba(234,179,8,0.30)'   },
  high:      { text: '#f97316', bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.30)'  },
  critical:  { text: '#ef4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.30)'   },
  unknown:   { text: '#71717a', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.10)' },
}

export const CARD: React.CSSProperties = {
  background: '#0c0c10', border: '1px solid #1a1a1f', borderRadius: 12,
}

const LEVEL_ORDER: LevelOrUnknown[] = ['unknown', 'green', 'yellow', 'orange', 'red']
const RISK_ORDER:  RiskOrUnknown[]  = ['unknown', 'safe', 'attention', 'high', 'critical']
export const levelRank = (l: LevelOrUnknown) => LEVEL_ORDER.indexOf(l)
export const riskRank  = (r: RiskOrUnknown)  => RISK_ORDER.indexOf(r)

/** Prioridade de atenção: vermelho → laranja → amarelo → verde perto do limite → resto. */
export function attentionScore(r: ReputationResult | null): number {
  if (!r) return -1
  return levelRank(r.overallLevel) * 10 + riskRank(r.riskLevel)
}

/** Métrica com menos margem (a que merece olhar primeiro). */
export function tightestMetric(r: ReputationResult): MetricResult | null {
  const ms = (['cancellations', 'incorrectShipments', 'claims'] as MetricKey[]).map(k => r.metrics[k]).filter(m => m.level !== 'unknown')
  if (ms.length === 0) return null
  return ms.reduce((best, m) => {
    if (levelRank(m.level) !== levelRank(best.level)) return levelRank(m.level) > levelRank(best.level) ? m : best
    return (m.marginUsedRatio ?? 0) > (best.marginUsedRatio ?? 0) ? m : best
  }, ms[0])
}

export const accountName = (a: Pick<AccountView, 'nickname' | 'seller_id'>, t: Translator) =>
  a.nickname ?? t('table.accountFallback', { id: a.seller_id })

// ── Átomos ────────────────────────────────────────────────────────────────

/** Faixa SEMPRE com texto (não só cor) — acessibilidade. */
export function LevelBadge({ level, t, size = 'md' }: { level: LevelOrUnknown; t: Translator; size?: 'sm' | 'md' | 'lg' }) {
  const s = LEVEL_STYLE[level]
  const pad = size === 'lg' ? '6px 12px' : size === 'sm' ? '1px 7px' : '3px 9px'
  const font = size === 'lg' ? 13 : size === 'sm' ? 10 : 11
  return (
    <span role="status" aria-label={t('a11y.level', { level: t(`level.${level}`) })}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: pad, borderRadius: 999, fontSize: font, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: s.text, background: s.bg, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
      {t(`level.${level}`)}
    </span>
  )
}

export function RiskBadge({ risk, t, size = 'md' }: { risk: RiskOrUnknown; t: Translator; size?: 'sm' | 'md' }) {
  const s = RISK_STYLE[risk]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: size === 'sm' ? '1px 7px' : '3px 9px', borderRadius: 6, fontSize: size === 'sm' ? 10 : 11, fontWeight: 600, color: s.text, background: s.bg, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {(risk === 'high' || risk === 'critical') && <AlertTriangle size={11} aria-hidden />}
      {t(`risk.${risk}`)}
    </span>
  )
}

export function TooltipInfo({ text, children }: { text: string; children?: ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button type="button" aria-label={text} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)} onClick={() => setShow(v => !v)}
        style={{ width: 16, height: 16, borderRadius: 999, border: 'none', background: '#27272a', color: '#a1a1aa', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', padding: 0 }}>
        {children ?? <Info size={10} />}
      </button>
      {show && (
        <div role="tooltip" style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 50, width: 280, padding: '10px 12px', borderRadius: 10, fontSize: 11, lineHeight: 1.5, background: '#18181b', border: '1px solid #27272a', color: '#d4d4d8', boxShadow: '0 12px 30px rgba(0,0,0,0.45)' }}>
          {text}
        </div>
      )}
    </span>
  )
}

/** Chip "60 dias"/"365 dias" + ícone de informação com o porquê. */
export function PeriodChip({ r, t }: { r: ReputationResult; t: Translator }) {
  const isShort = r.measurementPeriod === r.shortPeriodDays
  const tip = isShort
    ? t('period.tooltip60',  { threshold: r.nextMeasurementThreshold, short: r.shortPeriodDays })
    : t('period.tooltip365', { threshold: r.nextMeasurementThreshold, short: r.shortPeriodDays, long: r.longPeriodDays })
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: isShort ? '#00E5FF' : '#a5b4fc', background: isShort ? 'rgba(0,229,255,0.08)' : 'rgba(165,180,252,0.08)', border: `1px solid ${isShort ? 'rgba(0,229,255,0.30)' : 'rgba(165,180,252,0.30)'}` }}>
        {t('period.days', { days: r.measurementPeriod })}
      </span>
      <TooltipInfo text={tip} />
    </span>
  )
}

/** Barra X/68 com a frase "Faltam N vendas…" ou "avaliada pelos últimos 60 dias". */
export function ProgressToShort({ r, t, compact = false }: { r: ReputationResult; t: Translator; compact?: boolean }) {
  const threshold = r.nextMeasurementThreshold
  const sales = r.salesLast60Days
  const pct = Math.min(100, (sales / Math.max(1, threshold)) * 100)
  const reached = sales >= threshold
  return (
    <div title={compact && !reached ? t('period.missing', { n: r.salesUntilShortPeriod, short: r.shortPeriodDays }) : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: '#a1a1aa', marginBottom: 4, whiteSpace: 'nowrap' }}>
        <span>{t('period.progress', { sales: fmtInt(sales), threshold })}</span>
        {/* No modo compacto (célula da tabela) a frase "Faltam N vendas…" vai no title — não cabe na coluna. */}
        {!reached && !compact && <span style={{ color: '#fafafa', fontWeight: 600 }}>{t('period.missing', { n: r.salesUntilShortPeriod, short: r.shortPeriodDays })}</span>}
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={threshold} aria-valuenow={Math.min(sales, threshold)}
        style={{ height: compact ? 5 : 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: reached ? '#00E5FF' : 'linear-gradient(90deg, #0891b2, #00E5FF)', transition: 'width 300ms' }} />
      </div>
      {!compact && (
        <div style={{ fontSize: 12, color: '#d4d4d8', marginTop: 8 }}>
          {reached
            ? t('period.inShort', { short: r.shortPeriodDays })
            : t('period.salesLine365', { sales: fmtInt(sales) })}
        </div>
      )}
      {!compact && r.periodForecast && (
        <div style={{ fontSize: 12, marginTop: 6, color: r.periodForecast.kind === 'may_drop_to_long' ? '#f59e0b' : '#71717a', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          {r.periodForecast.kind === 'may_drop_to_long' && <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />}
          <span>
            {r.periodForecast.kind === 'may_drop_to_long'
              ? t('period.mayDrop', { long: r.longPeriodDays, days: (r.periodForecast.dropInDays ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }), exits: r.periodForecast.exitsInHorizon, horizon: r.periodForecast.horizonDays })
              : t('period.stable', { horizon: r.periodForecast.horizonDays, exits: r.periodForecast.exitsInHorizon })}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Barra das faixas: 0% ─ verde ─ amarelo ─ laranja ─ vermelho, com o marcador
 * exatamente onde a conta está. Escala vai até 1,25× o limite laranja pra
 * sobrar espaço pro vermelho.
 */
export function BandBar({ m, t }: { m: MetricResult; t: Translator }) {
  const max = m.orangeLimit * 1.25
  const x = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
  const pos = m.percentage == null ? null : Math.min(100, Math.max(0, (m.percentage / max) * 100))
  const labelStyle: React.CSSProperties = { position: 'absolute', top: 14, transform: 'translateX(-50%)', fontSize: 10, color: '#71717a', whiteSpace: 'nowrap' }
  return (
    <div aria-label={pos == null ? undefined : t('a11y.position', { pct: fmtPct(m.percentage) })} style={{ position: 'relative', height: 34, marginTop: 6 }}>
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 8, borderRadius: 999, overflow: 'hidden', display: 'flex', background: LEVEL_STYLE.red.text }}>
        <div style={{ width: x(m.greenLimit), background: LEVEL_STYLE.green.text }} />
        <div style={{ width: `calc(${x(m.yellowLimit)} - ${x(m.greenLimit)})`, background: LEVEL_STYLE.yellow.text }} />
        <div style={{ width: `calc(${x(m.orangeLimit)} - ${x(m.yellowLimit)})`, background: LEVEL_STYLE.orange.text }} />
      </div>
      <span style={{ ...labelStyle, left: 0, transform: 'none' }}>0%</span>
      <span style={{ ...labelStyle, left: x(m.greenLimit) }}>{fmtPct(m.greenLimit, m.greenLimit % 1 === 0 ? 0 : 1)}</span>
      <span style={{ ...labelStyle, left: x(m.yellowLimit) }}>{fmtPct(m.yellowLimit, m.yellowLimit % 1 === 0 ? 0 : 1)}</span>
      <span style={{ ...labelStyle, left: x(m.orangeLimit) }}>{fmtPct(m.orangeLimit, m.orangeLimit % 1 === 0 ? 0 : 1)}</span>
      {pos != null && (
        <div aria-hidden style={{ position: 'absolute', top: -4, left: `${pos}%`, transform: 'translateX(-50%)', width: 3, height: 16, borderRadius: 2, background: '#fafafa', boxShadow: '0 0 0 2px #0c0c10' }} />
      )}
    </div>
  )
}

/** Célula compacta da tabela: • 1,80% Verde */
export function MetricCell({ m, t }: { m: MetricResult; t: Translator }) {
  const s = LEVEL_STYLE[m.level]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: s.dot }} />
      <span style={{ fontWeight: 600, color: m.level === 'unknown' ? '#71717a' : '#fafafa', fontVariantNumeric: 'tabular-nums' }}>{fmtPct(m.percentage)}</span>
      <span style={{ fontSize: 10, color: s.text, textTransform: 'uppercase', letterSpacing: 0.3 }}>{t(`level.${m.level}`)}</span>
      {(m.riskLevel === 'high' || m.riskLevel === 'critical') && m.level !== 'red' && <AlertTriangle size={11} color={RISK_STYLE[m.riskLevel].text} aria-label={t(`risk.${m.riskLevel}`)} />}
    </span>
  )
}

/** Card completo de um indicador (página da conta). */
export function MetricCard({ m, period, t, highlight = false }: { m: MetricResult; period: number; t: Translator; highlight?: boolean }) {
  const s = LEVEL_STYLE[m.level]
  const nextLabel = m.nextLevel ? t(`level.${m.nextLevel}`) : ''
  return (
    <div style={{ ...CARD, border: `1px solid ${s.border}`, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 140, height: 140, background: `radial-gradient(circle at top right, ${s.bg}, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>{t(`metric.${m.key}`)}</div>
          {highlight && m.level !== 'unknown' && (
            <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={10} /> {t('card.nearestLimit')}</div>
          )}
        </div>
        <LevelBadge level={m.level} t={t} />
      </div>

      {m.level === 'unknown' ? (
        <div style={{ fontSize: 12, color: '#71717a', padding: '8px 0' }}>{t('card.noSales')}</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 34, fontWeight: 600, color: s.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fmtPct(m.percentage)}</div>
            <div style={{ fontSize: 12, color: '#a1a1aa' }}>{t('card.ofSales', { affected: fmtInt(m.affectedSales), total: fmtInt(m.totalSales) })}</div>
          </div>

          <BandBar m={m} t={t} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginTop: 12, fontSize: 12 }}>
            <div style={{ color: '#a1a1aa' }}>
              {m.currentLimit != null
                ? t('card.limitCurrent', { level: t(`level.${m.level}`), limit: fmtPct(m.currentLimit) })
                : t('card.exceeded', { limit: fmtPct(m.orangeLimit) })}
            </div>
            <div style={{ color: m.distancePercentagePoints != null && m.distancePercentagePoints < 0.5 ? '#f59e0b' : '#d4d4d8', textAlign: 'right' }}>
              {m.distancePercentagePoints != null ? t('card.margin', { pp: fmtPp(m.distancePercentagePoints) }) : ''}
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#d4d4d8' }}>
            {m.currentLimit != null && m.remainingOccurrencesStatic != null && (
              m.remainingOccurrencesStatic > 0
                ? <div>{t('card.remainingStatic', { n: m.remainingOccurrencesStatic, level: nextLabel })}</div>
                : <div style={{ color: '#f59e0b' }}>{t('card.remainingZero', { level: nextLabel })}</div>
            )}
            {m.currentLimit != null && m.remainingOccurrencesDynamic != null && m.remainingOccurrencesDynamic !== m.remainingOccurrencesStatic && (
              <div style={{ color: '#a1a1aa' }}>{t('card.remainingDynamic', { n: m.remainingOccurrencesDynamic })}</div>
            )}
            {m.level !== 'green' && m.salesToRecoverGreen != null && m.salesToRecoverGreen > 0 && (
              <div style={{ color: '#fafafa' }}>{t('card.recover', { n: fmtInt(m.salesToRecoverGreen) })}</div>
            )}
            <div style={{ fontSize: 10, color: '#52525b' }}>{t('card.estimateNote')}</div>
          </div>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#71717a', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(255,230,0,0.12)', color: '#FFE600', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>ML</span>
              {m.official?.percentage != null
                ? t('card.official', { pct: fmtPct(m.official.percentage), count: fmtInt(m.official.count), period: m.official.period ?? '—' })
                : t('card.officialMissing')}
            </div>
            {m.divergence?.significant && (
              <div style={{ color: '#f59e0b', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{t('card.divergence', { delta: m.divergence.deltaPercentagePoints.toLocaleString('pt-BR', { maximumFractionDigits: 2, signDisplay: 'always' }) })}</span>
              </div>
            )}
          </div>
        </>
      )}
      <span style={{ position: 'absolute', right: 14, bottom: 10, fontSize: 10, color: '#3f3f46' }}>{t('period.days', { days: period })}</span>
    </div>
  )
}

// ── Modal "Entenda as regras" ─────────────────────────────────────────────

function RuleTable({ title, t, short, long, singleColumn }: {
  title: string; t: Translator; short: MetricThresholds; long: MetricThresholds; singleColumn?: boolean
}) {
  const rows: Array<[LevelOrUnknown, (th: MetricThresholds) => string]> = [
    ['green',  th => t('rules.upTo',    { v: fmtPct(th.green,  th.green  % 1 === 0 ? 0 : 1) })],
    ['yellow', th => t('rules.between', { a: fmtPct(th.green,  th.green  % 1 === 0 ? 0 : 1), b: fmtPct(th.yellow, th.yellow % 1 === 0 ? 0 : 1) })],
    ['orange', th => t('rules.between', { a: fmtPct(th.yellow, th.yellow % 1 === 0 ? 0 : 1), b: fmtPct(th.orange, th.orange % 1 === 0 ? 0 : 1) })],
    ['red',    th => t('rules.above',   { v: fmtPct(th.orange, th.orange % 1 === 0 ? 0 : 1) })],
  ]
  const th: React.CSSProperties = { textAlign: 'right', padding: '6px 10px', fontSize: 11, color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }
  const td: React.CSSProperties = { textAlign: 'right', padding: '6px 10px', fontSize: 13, color: '#e4e4e7', fontVariantNumeric: 'tabular-nums' }
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', margin: '0 0 6px' }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #27272a' }}>
              <th style={{ ...th, textAlign: 'left' }}>{t('rules.status')}</th>
              {singleColumn ? <th style={th}>{t('rules.colPct')}</th> : <><th style={th}>{t('rules.col60')}</th><th style={th}>{t('rules.col365')}</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map(([level, fn]) => (
              <tr key={level} style={{ borderBottom: '1px solid #1a1a1f' }}>
                <td style={{ ...td, textAlign: 'left' }}><LevelBadge level={level} t={t} size="sm" /></td>
                {singleColumn ? <td style={td}>{fn(short)}</td> : <><td style={td}>{fn(short)}</td><td style={td}>{fn(long)}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function RulesModal({ open, onClose, rule, legacy, t }: {
  open: boolean; onClose: () => void; rule: RuleSetSummary | null; legacy?: RuleSetSummary | null; t: Translator
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open || !rule) return null
  const c = rule.config
  const S = String(c.measurement.shortPeriodDays)
  const L = String(c.measurement.longPeriodDays)
  const claimsSame = JSON.stringify(c.metrics.claims[S]) === JSON.stringify(c.metrics.claims[L])
  return (
    <div role="dialog" aria-modal="true" aria-label={t('rules.title')} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', background: '#111114', border: '1px solid #27272a', borderRadius: 16, padding: '20px 22px', boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fafafa', margin: 0 }}>{t('rules.title')}</h2>
          <button onClick={onClose} aria-label={t('rules.close')} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>
        {rule.effectiveFrom && (
          <div style={{ fontSize: 13, color: '#00E5FF', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
            {t('rules.effective', { date: fmtDateBr(rule.effectiveFrom) })}
          </div>
        )}
        <p style={{ fontSize: 12, color: '#a1a1aa', margin: '0 0 14px', lineHeight: 1.5 }}>
          {t('rules.periodRule', { threshold: c.measurement.minimumSalesForShortPeriod, short: c.measurement.shortPeriodDays, long: c.measurement.longPeriodDays })}
        </p>
        <RuleTable title={t('metric.cancellations')}      t={t} short={c.metrics.cancellations[S]}      long={c.metrics.cancellations[L]} />
        <RuleTable title={t('metric.incorrectShipments')} t={t} short={c.metrics.incorrectShipments[S]} long={c.metrics.incorrectShipments[L]} />
        <RuleTable title={t('metric.claims')}             t={t} short={c.metrics.claims[S]}             long={c.metrics.claims[L]} singleColumn={claimsSame} />
        <p style={{ fontSize: 11, color: '#71717a', margin: '0 0 8px', lineHeight: 1.5 }}>{t('rules.claimsNote')}</p>
        <p style={{ fontSize: 11, color: '#71717a', margin: '0 0 8px', lineHeight: 1.5 }}>
          {t('rules.riskRule', { attention: Math.round(c.risk.attentionAt * 100), high: Math.round(c.risk.highAt * 100), critical: Math.round(c.risk.criticalAt * 100) })}
        </p>
        {legacy && rule.effectiveFrom && (
          <p style={{ fontSize: 11, color: '#52525b', margin: 0 }}>{t('rules.legacyNote', { date: fmtDateBr(rule.effectiveFrom), name: legacy.name })}</p>
        )}
      </div>
    </div>
  )
}

// ── Realtime ──────────────────────────────────────────────────────────────

/**
 * Escuta `reputation:updated` (Socket.IO, room da org) e chama onUpdate com
 * debounce. Sem socket, o caller faz polling leve — nunca polling agressivo.
 */
export function useReputationRealtime(onUpdate: (sellerId: number | null) => void, debounceMs = 1500): void {
  const cb = useRef(onUpdate)
  cb.current = onUpdate
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let handler: ((p: { seller_id?: number }) => void) | null = null
    let sock: Awaited<ReturnType<typeof getSocket>> | null = null
    ;(async () => {
      try {
        sock = await getSocket()
        handler = (p: { seller_id?: number }) => {
          if (!active) return
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => cb.current(p?.seller_id ?? null), debounceMs)
        }
        sock.on('reputation:updated', handler)
      } catch (err) {
        console.warn('[reputation] socket indisponível:', (err as Error).message)
      }
    })()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      if (sock && handler) sock.off('reputation:updated', handler)
    }
  }, [debounceMs])
}

/** Relógio de 30s pra "há X min" e polling leve (5 min) só com a aba visível. */
export function useGentlePolling(reload: () => void, intervalMs = 5 * 60_000): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const clock = setInterval(() => setTick(x => x + 1), 30_000)
    const poll = setInterval(() => { if (document.visibilityState === 'visible') reload() }, intervalMs)
    return () => { clearInterval(clock); clearInterval(poll) }
  }, [reload, intervalMs])
  return tick
}

export function timeSince(iso: string | null | undefined, t: Translator): string {
  if (!iso) return t('neverCalculated')
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 1)  return t('timeNow')
  if (m < 60) return t('timeMinutesAgo', { m })
  const h = Math.round(m / 60)
  return h < 24 ? t('timeHoursAgo', { h }) : t('timeDaysAgo', { d: Math.round(h / 24) })
}
