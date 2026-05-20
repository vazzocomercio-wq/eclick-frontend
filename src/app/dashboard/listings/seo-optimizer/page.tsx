'use client'

/**
 * e-Otimizer IA MVP 4 — UI de otimização de anúncios EXISTENTES.
 *
 * Fluxo: user cola MLB ID (ou URL ML) → backend analisa → mostra sugestões
 * respeitando zonas 🟢🟡🔴 → user aplica ou ignora.
 */

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import {
  Search, Sparkles, Loader2, AlertCircle, CheckCircle2, Copy, ExternalLink,
  Lock, AlertTriangle, Send, History, RotateCw, TrendingUp, Eye, Award, Activity,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useToast, ToastViewport } from '@/hooks/useToast'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types (espelham backend) ───────────────────────────────────────────────

type EditMode = 'free' | 'restricted' | 'locked'

interface Permissions {
  mlb_id:                 string
  sold_quantity:          number
  listing_type_id:        string
  catalog_listing:        boolean
  title:                  EditMode
  description:            EditMode
  pictures:               EditMode
  category:               EditMode
  listing_type:           EditMode
  attributes_overall:     EditMode
  attributes_locked_keys: string[]
  rationale:              string[]
}

interface OptimizationAnalysis {
  optimization_id: string
  mlb_id:          string
  current: {
    title:           string
    description:     string
    sold_quantity:   number
    listing_type_id: string
    catalog_listing: boolean
    price:           number
    pictures_count:  number
    attributes:      Array<{ id: string; name: string; value_name: string | null }>
  }
  permissions: Permissions
  seo_score: {
    current: number
    breakdown: {
      title:       { score: number; issues: string[] }
      description: { score: number; issues: string[] }
      attributes:  { score: number; missing_required: string[]; missing_recommended: string[] }
      pictures:    { score: number; issues: string[] }
    }
  }
  suggestions: {
    title?:       { value: string; rationale: string }
    clone_title?: { value: string; rationale: string }
    description?: { value: string; rationale: string }
    attributes?:  {
      missing_to_fill: Array<{ id: string; name: string; suggested_value: string; required: boolean }>
    }
  }
  research_summary: {
    category_ml_id:     string
    category_name:      string
    competitors_count:  number
    top_keywords_count: number
  }
}

interface HistoryItem {
  id:               string
  mlb_id:           string
  seo_score_before: number | null
  seo_score_after:  number | null
  applied_at:       string | null
  applied_fields:   string[] | null
  before_snapshot:  { title?: string }
  created_at:       string
}

interface FeedbackSummary {
  total_optimizations:        number
  total_applied:              number
  total_with_metrics:         number
  avg_score_before:           number | null
  avg_score_after:            number | null
  score_uplift_avg:           number | null
  total_sold_delta_t7d:       number
  total_sold_delta_t14d:      number
  total_sold_delta_t30d:      number
  total_visits_t7d:           number
  top_winners: Array<{
    optimization_id: string
    mlb_id:          string
    title:           string
    score_before:    number | null
    score_after:     number | null
    sold_delta_t30d: number | null
    applied_fields:  string[]
    applied_at:      string
  }>
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractMlbId(input: string): string | null {
  const m = input.match(/MLB[-]?\d+/i)
  return m ? m[0].toUpperCase().replace('-', '') : null
}

const MODE_BADGE: Record<EditMode, { cls: string; icon: typeof Lock }> = {
  free:       { cls: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30', icon: CheckCircle2 },
  restricted: { cls: 'bg-amber-400/15 text-amber-300 border-amber-400/30',       icon: AlertTriangle },
  locked:     { cls: 'bg-red-400/15 text-red-300 border-red-400/30',             icon: Lock },
}

// ── Main page ──────────────────────────────────────────────────────────────

function SuspenseFallback() {
  const t = useTranslations('listings.seoOptimizer')
  return <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6 text-sm text-zinc-500">{t('loading')}</div>
}

export default function SeoOptimizerPage() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <SeoOptimizerPageInner />
    </Suspense>
  )
}

function SeoOptimizerPageInner() {
  const t = useTranslations('listings.seoOptimizer')
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const searchParams = useSearchParams()

  const [mlbInput, setMlbInput]       = useState('')
  const [analysis, setAnalysis]       = useState<OptimizationAnalysis | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [history, setHistory]         = useState<HistoryItem[]>([])
  const [feedback, setFeedback]       = useState<FeedbackSummary | null>(null)

  // Pra não disparar analyze() 2x em StrictMode dev ou em re-renders rápidos
  const autoRanRef = useRef(false)

  async function getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
    return { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }

  async function loadHistory() {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND}/e-otimizer/listings/optimizations/history?limit=20`, { headers })
      if (res.ok) setHistory(await res.json())
    } catch (e) { /* silent */ }
  }

  async function loadFeedback() {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND}/e-otimizer/feedback/summary`, { headers })
      if (res.ok) setFeedback(await res.json())
    } catch (e) { /* silent */ }
  }

  useEffect(() => {
    void loadHistory()
    void loadFeedback()
  }, [])

  async function analyze(overrideId?: string) {
    setError(null)
    const mlbId = overrideId ?? extractMlbId(mlbInput)
    if (!mlbId) {
      setError(t('errors.invalidMlbId'))
      return
    }
    setLoading(true)
    setAnalysis(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${BACKEND}/e-otimizer/listings/${mlbId}/analyze`, { method: 'POST', headers })
      if (!res.ok) throw new Error((await res.json())?.message ?? `HTTP ${res.status}`)
      const data = await res.json()
      setAnalysis(data as OptimizationAnalysis)
      await loadHistory()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-analyze quando vem com ?mlbId= na URL (deeplink do card de anúncio)
  useEffect(() => {
    if (autoRanRef.current) return
    const fromUrl = searchParams.get('mlbId')
    if (!fromUrl) return
    const cleaned = extractMlbId(fromUrl)
    if (!cleaned) return
    autoRanRef.current = true
    setMlbInput(cleaned)
    void analyze(cleaned)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <ToastViewport />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-cyan-400" />
            <h1 className="text-xl font-semibold">{t('title')}</h1>
          </div>
          <p className="text-sm text-zinc-400">
            {t('subtitle')}
          </p>
        </header>

        {/* Feedback Summary Cards */}
        {feedback && feedback.total_applied > 0 && (
          <section className="mb-6">
            <h2 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
              <Activity size={12} /> {t('roiTitle')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={<Sparkles size={14} />}
                label={t('stat.appliedOptimizations')}
                value={feedback.total_applied.toString()}
                hint={t('stat.withMetricsHint', { count: feedback.total_with_metrics })}
                color="cyan"
              />
              <StatCard
                icon={<Award size={14} />}
                label={t('stat.avgScoreUplift')}
                value={feedback.score_uplift_avg != null ? `+${feedback.score_uplift_avg}` : '—'}
                hint={feedback.avg_score_before != null && feedback.avg_score_after != null
                  ? `${feedback.avg_score_before} → ${feedback.avg_score_after}`
                  : t('stat.noData')}
                color="emerald"
              />
              <StatCard
                icon={<TrendingUp size={14} />}
                label={t('stat.salesDelta30d')}
                value={`+${feedback.total_sold_delta_t30d}`}
                hint={t('stat.salesDeltaHint', { t7: feedback.total_sold_delta_t7d, t14: feedback.total_sold_delta_t14d })}
                color="emerald"
              />
              <StatCard
                icon={<Eye size={14} />}
                label={t('stat.visits7d')}
                value={feedback.total_visits_t7d.toLocaleString('pt-BR')}
                hint={t('stat.visitsHint')}
                color="cyan"
              />
            </div>
            {feedback.top_winners.length > 0 && (
              <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
                <h3 className="text-[11px] uppercase tracking-wider text-emerald-300/80 mb-2 flex items-center gap-1.5">
                  <Award size={12} /> {t('topWinnersTitle')}
                </h3>
                <ul className="space-y-1">
                  {feedback.top_winners.slice(0, 5).map(w => (
                    <li key={w.optimization_id} className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-300 font-bold w-12 shrink-0">{t('salesDeltaShort', { count: w.sold_delta_t30d ?? 0 })}</span>
                      <span className="font-mono text-zinc-500 w-32 shrink-0 truncate">{w.mlb_id}</span>
                      <span className="text-zinc-300 truncate flex-1" title={w.title}>{w.title}</span>
                      {w.score_before != null && w.score_after != null && (
                        <span className="text-[10px] text-zinc-500 shrink-0">{w.score_before} → {w.score_after}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* MAIN */}
          <div className="space-y-5">
            {/* Search */}
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <label className="block text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                {t('inputLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mlbInput}
                  onChange={e => setMlbInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void analyze() }}
                  placeholder={t('inputPlaceholder')}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-400 placeholder:text-zinc-600"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => void analyze()}
                  disabled={loading || !mlbInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-sm font-semibold"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  {t('analyze')}
                </button>
              </div>
              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}
              {loading && (
                <p className="mt-2 text-[11px] text-zinc-500">
                  {t('analyzingHint')}
                </p>
              )}
            </section>

            {/* Analysis result */}
            {analysis && (
              <AnalysisView
                analysis={analysis}
                onRefresh={async () => {
                  setMlbInput(analysis.mlb_id)
                  await analyze()
                }}
                onApplied={async () => {
                  toast({ message: t('listingUpdated'), tone: 'success' })
                  await loadHistory()
                  await loadFeedback()
                }}
              />
            )}
          </div>

          {/* History sidebar */}
          <aside className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              <History size={12} /> {t('historyTitle')}
            </h3>
            {history.length === 0 ? (
              <p className="text-[11px] text-zinc-600 italic">{t('noHistory')}</p>
            ) : (
              <ul className="space-y-1.5">
                {history.map(h => (
                  <li key={h.id} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-zinc-500">{h.mlb_id}</span>
                      {h.applied_at ? (
                        <span className="text-[10px] text-emerald-400">{t('historyApplied')}</span>
                      ) : (
                        <span className="text-[10px] text-zinc-500">{t('historyAnalysisOnly')}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-300 truncate" title={h.before_snapshot?.title ?? ''}>
                      {h.before_snapshot?.title ?? '—'}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                      <span>{t('scoreLabel')}: {h.seo_score_before ?? '?'}{h.seo_score_after != null && ` → ${h.seo_score_after}`}</span>
                      {h.applied_fields && h.applied_fields.length > 0 && (
                        <span className="text-cyan-400">{h.applied_fields.join(', ')}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

// ── AnalysisView ───────────────────────────────────────────────────────────

function AnalysisView({ analysis, onRefresh, onApplied }: {
  analysis: OptimizationAnalysis
  onRefresh: () => void | Promise<void>
  onApplied: () => void | Promise<void>
}) {
  const t = useTranslations('listings.seoOptimizer')
  const supabase = useMemo(() => createClient(), [])
  const { current, permissions, seo_score, suggestions, research_summary } = analysis

  const [titleEdit, setTitleEdit]               = useState(suggestions.title?.value ?? '')
  const [descriptionEdit, setDescriptionEdit]   = useState(suggestions.description?.value ?? '')
  const [applying, setApplying]                 = useState(false)
  const [applyError, setApplyError]             = useState<string | null>(null)
  const [appliedFields, setAppliedFields]       = useState<string[] | null>(null)

  const [applyTitleChecked, setApplyTitleChecked]             = useState(true)
  const [applyDescriptionChecked, setApplyDescriptionChecked] = useState(true)
  const [applyAttributesChecked, setApplyAttributesChecked]   = useState(true)

  async function apply() {
    setApplyError(null)
    setApplying(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers = {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type':  'application/json',
      }
      const res = await fetch(`${BACKEND}/e-otimizer/listings/optimizations/${analysis.optimization_id}/apply`, {
        method:  'POST',
        headers,
        body:    JSON.stringify({
          apply_title:        permissions.title !== 'locked' && applyTitleChecked && !!suggestions.title,
          apply_description:  permissions.description !== 'locked' && applyDescriptionChecked && !!suggestions.description,
          apply_attributes:   applyAttributesChecked && !!suggestions.attributes?.missing_to_fill.length,
          custom_title:       titleEdit !== suggestions.title?.value ? titleEdit : undefined,
          custom_description: descriptionEdit !== suggestions.description?.value ? descriptionEdit : undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json())?.message ?? `HTTP ${res.status}`)
      const data = await res.json()
      setAppliedFields(data.applied_fields)
      await onApplied()
    } catch (e: unknown) {
      setApplyError((e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Score header */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <a
              href={`https://produto.mercadolivre.com.br/${analysis.mlb_id}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
            >
              {analysis.mlb_id} <ExternalLink size={12} />
            </a>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {t('soldCount', { count: current.sold_quantity })} · R$ {current.price.toFixed(2)} · {current.listing_type_id}
              {current.catalog_listing && ` · ${t('catalog')}`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">{t('seoScore')}</div>
            <div className={`text-3xl font-bold ${
              seo_score.current >= 70 ? 'text-emerald-300' :
              seo_score.current >= 40 ? 'text-amber-300' : 'text-red-300'
            }`}>{seo_score.current}<span className="text-sm text-zinc-500">/100</span></div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ScoreCard label={t('breakdown.title')} score={seo_score.breakdown.title.score} issues={seo_score.breakdown.title.issues} />
          <ScoreCard label={t('breakdown.description')} score={seo_score.breakdown.description.score} issues={seo_score.breakdown.description.issues} />
          <ScoreCard label={t('breakdown.attributes')} score={seo_score.breakdown.attributes.score} issues={[
            ...(seo_score.breakdown.attributes.missing_required.length > 0 ? [t('missingRequired', { list: seo_score.breakdown.attributes.missing_required.join(', ') })] : []),
            ...(seo_score.breakdown.attributes.missing_recommended.length > 0 ? [t('missingRecommended', { list: seo_score.breakdown.attributes.missing_recommended.slice(0, 3).join(', ') })] : []),
          ]} />
          <ScoreCard label={t('breakdown.pictures')} score={seo_score.breakdown.pictures.score} issues={seo_score.breakdown.pictures.issues} />
        </div>
      </section>

      {/* Permissions rationale */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">{t('editPermissions')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <PermBadge label={t('field.title')} mode={permissions.title} />
          <PermBadge label={t('field.description')} mode={permissions.description} />
          <PermBadge label={t('field.pictures')} mode={permissions.pictures} />
          <PermBadge label={t('field.attributes')} mode={permissions.attributes_overall} />
        </div>
        <ul className="text-[11px] text-zinc-400 space-y-0.5">
          {permissions.rationale.map((r, i) => <li key={i}>• {r}</li>)}
        </ul>
      </section>

      {/* Title — applicable OR clone */}
      <Section title={t('field.title')} badge={<PermBadge label="" mode={permissions.title} />}>
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{t('current')}</div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
            {current.title} <span className="text-[10px] text-zinc-600">({current.title.length}/60)</span>
          </div>
        </div>

        {permissions.title === 'locked' && suggestions.clone_title && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-semibold mb-1.5">
              <Copy size={12} /> {t('cloneSuggestion')}
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 mb-2">
              {suggestions.clone_title.value} <span className="text-[10px] text-zinc-600">({suggestions.clone_title.value.length}/60)</span>
            </div>
            <p className="text-[11px] text-zinc-500 mb-2">{suggestions.clone_title.rationale}</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(suggestions.clone_title!.value)
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            >
              <Copy size={11} /> {t('copyTitle')}
            </button>
          </div>
        )}

        {permissions.title !== 'locked' && suggestions.title && (
          <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-semibold">
                <Sparkles size={12} /> {t('applicableSuggestion')}
              </div>
              <label className="flex items-center gap-1 text-[11px] text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={applyTitleChecked} onChange={e => setApplyTitleChecked(e.target.checked)} className="accent-cyan-400" />
                {t('apply')}
              </label>
            </div>
            <textarea
              value={titleEdit}
              onChange={e => setTitleEdit(e.target.value)}
              rows={2}
              maxLength={60}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400 resize-none"
            />
            <p className="text-[10px] text-zinc-500 mt-1">{titleEdit.length}/60 · {suggestions.title.rationale}</p>
          </div>
        )}
      </Section>

      {/* Description */}
      <Section title={t('field.description')} badge={<PermBadge label="" mode={permissions.description} />}>
        {suggestions.description && permissions.description !== 'locked' ? (
          <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-semibold">
                <Sparkles size={12} /> {t('optimizedDescription')}
              </div>
              <label className="flex items-center gap-1 text-[11px] text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={applyDescriptionChecked} onChange={e => setApplyDescriptionChecked(e.target.checked)} className="accent-cyan-400" />
                {t('apply')}
              </label>
            </div>
            <textarea
              value={descriptionEdit}
              onChange={e => setDescriptionEdit(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[12px] text-zinc-100 outline-none focus:border-cyan-400"
            />
            <p className="text-[10px] text-zinc-500 mt-1">{t('charsCount', { count: descriptionEdit.length })} · {suggestions.description.rationale}</p>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">{permissions.description === 'locked' ? t('lockedCatalog') : t('noSuggestion')}</p>
        )}
      </Section>

      {/* Attributes to fill */}
      {suggestions.attributes && suggestions.attributes.missing_to_fill.length > 0 && (
        <Section title={t('missingAttributesTitle')} badge={<PermBadge label="" mode={permissions.attributes_overall} />}>
          <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-semibold">
                <Sparkles size={12} /> {t('suggestedAttributesCount', { count: suggestions.attributes.missing_to_fill.length })}
              </div>
              <label className="flex items-center gap-1 text-[11px] text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={applyAttributesChecked} onChange={e => setApplyAttributesChecked(e.target.checked)} className="accent-cyan-400" />
                {t('apply')}
              </label>
            </div>
            <ul className="space-y-1">
              {suggestions.attributes.missing_to_fill.map(attr => (
                <li key={attr.id} className="flex items-center gap-2 text-[12px]">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${attr.required ? 'bg-red-400/15 text-red-300' : 'bg-zinc-800 text-zinc-400'}`}>
                    {attr.required ? t('required') : t('recommended')}
                  </span>
                  <span className="text-zinc-300 min-w-[150px]">{attr.name}</span>
                  <span className="text-zinc-100">"{attr.suggested_value}"</span>
                  {permissions.attributes_locked_keys.includes(attr.id) && (
                    <span className="text-[10px] text-amber-400">{t('attrCriticalWarning')}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* Apply button */}
      <section className="sticky bottom-4 rounded-xl border border-zinc-700 bg-zinc-900/90 backdrop-blur p-3 flex items-center justify-between">
        <div className="text-[11px] text-zinc-400">
          {t('researchSummary', { competitors: research_summary.competitors_count, keywords: research_summary.top_keywords_count })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={applying}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs"
            title={t('reanalyzeTitle')}
          >
            <RotateCw size={12} /> {t('reanalyze')}
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={applying || (permissions.title === 'locked' && permissions.description === 'locked' && !suggestions.attributes?.missing_to_fill.length)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold"
          >
            {applying ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {t('applySelected')}
          </button>
        </div>
      </section>

      {applyError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-start gap-2">
          <AlertCircle size={12} className="shrink-0 mt-0.5" /> {applyError}
        </div>
      )}
      {appliedFields && appliedFields.length > 0 && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 size={14} /> {t('appliedLabel')}: <strong>{appliedFields.join(', ')}</strong>
        </div>
      )}
    </div>
  )
}

// ── Atoms ──────────────────────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        {badge}
      </div>
      {children}
    </section>
  )
}

function ScoreCard({ label, score, issues }: { label: string; score: number; issues: string[] }) {
  const color = score >= 70 ? 'text-emerald-300' : score >= 40 ? 'text-amber-300' : 'text-red-300'
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
        <span className={`text-sm font-bold ${color}`}>{score}</span>
      </div>
      {issues.length > 0 && (
        <div className="mt-1 text-[10px] text-zinc-500 line-clamp-2" title={issues.join(' | ')}>
          {issues[0]}
        </div>
      )}
    </div>
  )
}

function PermBadge({ label, mode }: { label: string; mode: EditMode }) {
  const t = useTranslations('listings.seoOptimizer')
  const cfg = MODE_BADGE[mode]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${cfg.cls}`}>
      {label ? `${label}: ` : ''}{t(`mode.${mode}`)}
    </span>
  )
}

function StatCard({ icon, label, value, hint, color }: {
  icon:  React.ReactNode
  label: string
  value: string
  hint?: string
  color: 'cyan' | 'emerald' | 'amber'
}) {
  const colorMap = {
    cyan:    'border-cyan-400/20 bg-cyan-400/5 text-cyan-300',
    emerald: 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300',
    amber:   'border-amber-400/20 bg-amber-400/5 text-amber-300',
  }
  return (
    <div className={`rounded-xl border p-3 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
        <span className="opacity-70">{icon}</span>
      </div>
      <div className="text-xl font-bold text-zinc-100">{value}</div>
      {hint && <div className="text-[10px] text-zinc-500 mt-0.5">{hint}</div>}
    </div>
  )
}
