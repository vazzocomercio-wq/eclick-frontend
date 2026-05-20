'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Loader2, RefreshCw, AlertTriangle, CheckCircle2, ExternalLink,
  TrendingUp, TrendingDown, Package, MessageSquare, BookOpen,
  Sparkles, Copy, Trash2, X,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────

interface ReputationSnapshot {
  id:                       string
  snapshot_date:            string
  level_id:                 string | null
  power_seller_status:      string | null
  total_transactions:       number | null
  claims_rate:              number | null
  cancellations_rate:       number | null
  delayed_handling_rate:    number | null
  positive_ratings:         number | null
  neutral_ratings:          number | null
  negative_ratings:         number | null
}

interface Claim {
  id:               string
  ml_claim_id:      number
  ml_resource_id:   number | null
  type:             string | null
  stage:            string | null
  status:           string | null
  reason_name:      string | null
  date_created:     string
  conversation_id:  string | null
}

interface RemovalCandidate {
  id:                       string
  claim_id:                 string
  conversation_id:          string | null
  trigger_message_id:       string | null
  matched_keywords:         string[]
  llm_confidence:           'low' | 'medium' | 'high' | null
  llm_reason:               string | null
  llm_suggested_action:     string | null
  suggested_request_text:   string | null
  status:                   string
  created_at:               string
}

// ────────────────────────────────────────────────────────────────────────
// API
// ────────────────────────────────────────────────────────────────────────

async function token(): Promise<string> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return session?.access_token ?? ''
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${t}`,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body || res.statusText}`)
  }
  // Resilient JSON parse: backend may return empty body for null results
  // (NestJS serializes null/undefined as empty body in some cases).
  const text = await res.text()
  if (!text || !text.trim()) return null as T
  try {
    return JSON.parse(text) as T
  } catch {
    return null as T
  }
}

// ────────────────────────────────────────────────────────────────────────
// Página
// ────────────────────────────────────────────────────────────────────────

export default function IntelligenceMlPage() {
  const t = useTranslations('inteligencia')
  const [latest, setLatest]         = useState<ReputationSnapshot | null>(null)
  const [history, setHistory]       = useState<ReputationSnapshot[]>([])
  const [claims, setClaims]         = useState<Claim[]>([])
  const [candidates, setCandidates] = useState<RemovalCandidate[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const results = await Promise.allSettled([
      api<ReputationSnapshot | null>('/intelligence/ml/reputation/latest'),
      api<ReputationSnapshot[] | null>('/intelligence/ml/reputation/history?days=30'),
      api<Claim[] | null>('/intelligence/ml/claims?limit=50'),
      api<RemovalCandidate[] | null>('/intelligence/ml/claim-removals?status=pending&limit=20'),
    ])
    const [latRes, histRes, clsRes, cndRes] = results
    setLatest(latRes.status === 'fulfilled' ? (latRes.value ?? null) : null)
    setHistory(histRes.status === 'fulfilled' ? (histRes.value ?? []) : [])
    setClaims(clsRes.status === 'fulfilled' ? (clsRes.value ?? []) : [])
    setCandidates(cndRes.status === 'fulfilled' ? (cndRes.value ?? []) : [])

    const failureLabels = [
      t('ml.failure.reputation'),
      t('ml.failure.history'),
      t('ml.failure.claims'),
      t('ml.failure.candidates'),
    ]
    const failures = results
      .map((r, i) => ({ r, label: failureLabels[i]! }))
      .filter(({ r }) => r.status === 'rejected')
      .map(({ r, label }) => `${label}: ${(r as PromiseRejectedResult).reason instanceof Error ? ((r as PromiseRejectedResult).reason as Error).message : String((r as PromiseRejectedResult).reason)}`)
    setError(failures.length > 0 ? failures.join(' · ') : null)
    setLoading(false)
  }, [t])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <div className="p-6 space-y-6" style={{ background: 'var(--background)', color: 'var(--text)', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{t('ml.pageTitle')}</h1>
          <p className="text-xs mt-0.5" style={{ color: '#a1a1aa' }}>
            {t('ml.pageSubtitle')}
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded transition disabled:opacity-50"
          style={{ background: '#1e1e24', color: '#a1a1aa' }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {t('ml.refresh')}
        </button>
      </div>

      {error && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </div>
        </div>
      )}

      {/* Reputation overview */}
      <ReputationOverview latest={latest} history={history} />

      {/* Two-column: Claims | Removal candidates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClaimsPanel claims={claims} />
        <RemovalCandidatesPanel candidates={candidates} onRefresh={refresh} onError={setError} />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Reputation Overview
// ────────────────────────────────────────────────────────────────────────

function ReputationOverview({ latest, history }: {
  latest:   ReputationSnapshot | null
  history:  ReputationSnapshot[]
}) {
  const t = useTranslations('inteligencia')
  if (!latest) {
    return (
      <div
        className="rounded-lg p-6 text-center text-sm"
        style={{ background: '#111114', border: '1px solid #1e1e24', color: '#a1a1aa' }}
      >
        {t('ml.noSnapshot')}
      </div>
    )
  }

  const levelColor = levelColorOf(latest.level_id)
  return (
    <div className="rounded-lg p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: levelColor }}
          />
          <div>
            <div className="text-xs" style={{ color: '#52525b' }}>{t('ml.currentLevel')}</div>
            <div className="text-lg font-semibold" style={{ color: levelColor }}>
              {latest.level_id ?? t('ml.unknown')}
            </div>
          </div>
        </div>
        <div className="text-xs text-right" style={{ color: '#a1a1aa' }}>
          {t('ml.snapshot', { date: new Date(latest.snapshot_date).toLocaleDateString('pt-BR') })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard
          label={t('ml.kpi.claims')}
          value={pct(latest.claims_rate)}
          sparkline={history.map(h => h.claims_rate ?? 0)}
          warning={0.015}
          critical={0.025}
          current={latest.claims_rate ?? 0}
        />
        <KpiCard
          label={t('ml.kpi.cancellations')}
          value={pct(latest.cancellations_rate)}
          sparkline={history.map(h => h.cancellations_rate ?? 0)}
          warning={0.010}
          critical={0.015}
          current={latest.cancellations_rate ?? 0}
        />
        <KpiCard
          label={t('ml.kpi.shippingDelay')}
          value={pct(latest.delayed_handling_rate)}
          sparkline={history.map(h => h.delayed_handling_rate ?? 0)}
          warning={0.07}
          critical={0.10}
          current={latest.delayed_handling_rate ?? 0}
        />
      </div>
    </div>
  )
}

function KpiCard({ label, value, sparkline, warning, critical, current }: {
  label:     string
  value:     string
  sparkline: number[]
  warning:   number
  critical:  number
  current:   number
}) {
  const t = useTranslations('inteligencia')
  const color =
    current >= critical ? '#ef4444'
      : current >= warning ? '#fbbf24'
        : '#4ade80'

  // Trend (último vs antepenúltimo)
  const len = sparkline.length
  const trend = len >= 2
    ? sparkline[len - 1]! - sparkline[len - 2]!
    : 0
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : null

  return (
    <div className="rounded p-3" style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: '#52525b' }}>
          {label}
        </div>
        {TrendIcon && (
          <TrendIcon size={12} style={{ color: trend > 0 ? '#f87171' : '#4ade80' }} />
        )}
      </div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      <Sparkline values={sparkline} color={color} warning={warning} critical={critical} />
      <div className="flex justify-between text-[9px] mt-1" style={{ color: '#52525b' }}>
        <span>{t('ml.warningLabel', { value: pct(warning) })}</span>
        <span>{t('ml.criticalLabel', { value: pct(critical) })}</span>
      </div>
    </div>
  )
}

function Sparkline({ values, color, warning, critical }: {
  values:   number[]
  color:    string
  warning:  number
  critical: number
}) {
  if (values.length === 0) return <div className="h-8" />
  const w = 200
  const h = 32
  const max = Math.max(critical * 1.3, ...values, 0.001)
  const stepX = values.length > 1 ? w / (values.length - 1) : 0
  const points = values.map((v, i) => {
    const x = i * stepX
    const y = h - (v / max) * h
    return `${x},${y}`
  }).join(' ')

  const yWarning = h - (warning / max) * h
  const yCritical = h - (critical / max) * h

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8 mt-1">
      <line x1={0} y1={yWarning} x2={w} y2={yWarning} stroke="#fbbf2455" strokeDasharray="2,2" strokeWidth="0.5" />
      <line x1={0} y1={yCritical} x2={w} y2={yCritical} stroke="#ef444455" strokeDasharray="2,2" strokeWidth="0.5" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Claims
// ────────────────────────────────────────────────────────────────────────

function ClaimsPanel({ claims }: { claims: Claim[] }) {
  const t = useTranslations('inteligencia')
  const open = claims.filter(c => c.status !== 'closed')
  return (
    <div className="rounded-lg p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2 mb-3 text-sm font-medium" style={{ color: '#f87171' }}>
        <AlertTriangle size={14} /> {t('ml.openClaims', { count: open.length })}
      </div>

      {open.length === 0 && (
        <div className="text-center py-6 text-xs" style={{ color: '#52525b' }}>
          {t('ml.noOpenClaims')}
        </div>
      )}

      <div className="space-y-2">
        {open.slice(0, 10).map(c => (
          <div
            key={c.id}
            className="rounded p-2 text-xs flex items-start gap-2"
            style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}
          >
            <Package size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#a5f3fc' }} />
            <div className="flex-1 min-w-0">
              <div className="font-medium" style={{ color: 'var(--text)' }}>
                {c.reason_name ?? c.type ?? t('ml.claimFallback')}
                {c.stage === 'mediation' && (
                  <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#ef444422', color: '#f87171' }}>
                    {t('ml.mediation')}
                  </span>
                )}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: '#a1a1aa' }}>
                #{c.ml_claim_id} · {new Date(c.date_created).toLocaleDateString('pt-BR')} · {c.status}
              </div>
            </div>
            {c.conversation_id && (
              <Link
                href={`/dashboard/ml-postsale?conv=${c.conversation_id}`}
                className="text-[10px] flex items-center gap-0.5 flex-shrink-0"
                style={{ color: '#00E5FF' }}
              >
                {t('ml.inbox')} <ExternalLink size={10} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Removal candidates
// ────────────────────────────────────────────────────────────────────────

function RemovalCandidatesPanel({ candidates, onRefresh, onError }: {
  candidates:  RemovalCandidate[]
  onRefresh:   () => Promise<void>
  onError:     (msg: string) => void
}) {
  const t = useTranslations('inteligencia')
  const [busy, setBusy] = useState<string | null>(null)

  const dismiss = useCallback(async (id: string) => {
    setBusy(id)
    try {
      await api(`/intelligence/ml/claim-removals/${id}/dismiss`, { method: 'POST' })
      await onRefresh()
    } catch (e) { onError((e as Error).message) } finally { setBusy(null) }
  }, [onRefresh, onError])

  const proceed = useCallback(async (id: string) => {
    setBusy(id)
    try {
      const r = await api<{ ok: true; suggested_request_text: string | null }>(
        `/intelligence/ml/claim-removals/${id}/proceed`, { method: 'POST' },
      )
      if (r.suggested_request_text) {
        try {
          await navigator.clipboard.writeText(r.suggested_request_text)
        } catch { /* ignora */ }
      }
      await onRefresh()
    } catch (e) { onError((e as Error).message) } finally { setBusy(null) }
  }, [onRefresh, onError])

  const regenerate = useCallback(async (id: string) => {
    setBusy(id)
    try {
      await api(`/intelligence/ml/claim-removals/${id}/regenerate-text`, { method: 'POST' })
      await onRefresh()
    } catch (e) { onError((e as Error).message) } finally { setBusy(null) }
  }, [onRefresh, onError])

  return (
    <div className="rounded-lg p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2 mb-3 text-sm font-medium" style={{ color: '#fbbf24' }}>
        <Sparkles size={14} /> {t('ml.removalCandidates', { count: candidates.length })}
      </div>

      {candidates.length === 0 && (
        <div className="text-center py-6 text-xs" style={{ color: '#52525b' }}>
          {t('ml.noCandidates')}
        </div>
      )}

      <div className="space-y-3">
        {candidates.map(c => (
          <div
            key={c.id}
            className="rounded p-3"
            style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <ConfidenceBadge confidence={c.llm_confidence} />
              <span className="text-[10px]" style={{ color: '#52525b' }}>
                {new Date(c.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
            <div className="text-xs mb-1" style={{ color: 'var(--text)' }}>{c.llm_reason}</div>
            {c.llm_suggested_action && (
              <div className="text-[11px] mt-1" style={{ color: '#a1a1aa' }}>
                {t('ml.action', { action: c.llm_suggested_action })}
              </div>
            )}
            {c.suggested_request_text && (
              <div
                className="text-[11px] p-2 rounded mt-2"
                style={{ background: 'rgba(0,229,255,0.06)', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.2)' }}
              >
                {c.suggested_request_text}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button
                onClick={() => void proceed(c.id)}
                disabled={busy === c.id}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition disabled:opacity-50"
                style={{ background: '#00E5FF', color: '#09090b' }}
              >
                {busy === c.id ? <Loader2 size={10} className="animate-spin" /> : <Copy size={10} />}
                {t('ml.confirmCopy')}
              </button>
              <button
                onClick={() => void regenerate(c.id)}
                disabled={busy === c.id}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded transition disabled:opacity-50"
                style={{ background: '#1e1e24', color: '#a1a1aa' }}
              >
                <RefreshCw size={10} /> {t('ml.regenerateText')}
              </button>
              <button
                onClick={() => void dismiss(c.id)}
                disabled={busy === c.id}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded transition disabled:opacity-50"
                style={{ background: '#1e1e24', color: '#f87171' }}
              >
                <Trash2 size={10} /> {t('ml.falsePositive')}
              </button>
              {c.conversation_id && (
                <Link
                  href={`/dashboard/ml-postsale?conv=${c.conversation_id}`}
                  className="flex items-center gap-1 ml-auto text-[11px]"
                  style={{ color: '#00E5FF' }}
                >
                  <MessageSquare size={10} /> {t('ml.viewConversation')}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: 'low' | 'medium' | 'high' | null }) {
  const t = useTranslations('inteligencia')
  const colorMap = {
    high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
    medium: { color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
    low:    { color: '#52525b', bg: 'rgba(82,82,91,0.10)' },
  }
  const conf = confidence ?? 'low'
  const m = colorMap[conf]
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}66` }}
    >
      {t(`ml.confidence.${conf}`)}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function pct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${(v * 100).toFixed(2)}%`
}

function levelColorOf(levelId: string | null): string {
  if (!levelId) return '#52525b'
  if (levelId.startsWith('5_'))      return '#22c55e' // green
  if (levelId.startsWith('4_'))      return '#84cc16' // light_green
  if (levelId.startsWith('3_'))      return '#eab308' // yellow
  if (levelId.startsWith('2_'))      return '#f97316' // orange
  if (levelId.startsWith('1_'))      return '#ef4444' // red
  return '#52525b'
}
