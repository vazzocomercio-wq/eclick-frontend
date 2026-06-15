'use client'

import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  Gauge, ChevronDown, ChevronUp, AlertTriangle, AlertCircle,
  CheckCircle2, Info, Loader2, RefreshCw, Sparkles,
} from 'lucide-react'
import { CreativeApi } from './api'
import type { CreativeListingSeoResult, SeoIssue, SeoIssueSeverity } from './types'

/**
 * Painel de análise SEO do listing — usado em 2 lugares:
 *
 * - `variant="card"`  no editor (/creative/[productId]/listing/[listingId]):
 *   card vertical com score grande, breakdown title/attrs/pics em barras,
 *   lista de issues acionáveis. Sticky na coluna direita.
 *
 * - `variant="compact"` no /publish/ml: pílula horizontal "Score 78/100" com
 *   resumo, expansível pra ver issues. Funciona como checkpoint antes de
 *   publicar.
 *
 * Auto-refetch quando `listingVersion` muda (debounce 800ms pra coalescer
 * múltiplos saves do editor) e quando `picturesCount` muda. Fail-silent:
 * erro mostra um banner pequeno mas não quebra a página.
 */

interface Props {
  listingId:           string
  variant:             'card' | 'compact'
  /** Conta de imagens aprovadas (passada em /publish/ml). No editor, omit. */
  picturesCount?:      number
  /** Versão do listing — quando muda, dispara refetch. */
  listingVersion?:     number
  /** Callback opcional pra integrar "Ir pro campo" no editor. */
  onJumpToField?:      (field: NonNullable<SeoIssue['fixesField']>) => void
  className?:          string
}

export default function ListingSeoPanel({
  listingId, variant, picturesCount, listingVersion, onJumpToField, className,
}: Props) {
  const t = useTranslations('creative.seoPanel')
  const [data, setData]       = useState<CreativeListingSeoResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Fetch + debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    let cancelled = false
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          setLoading(true)
          setError(null)
          const r = await CreativeApi.getListingSeoScore(listingId, picturesCount)
          if (!cancelled) setData(r)
        } catch (e: unknown) {
          if (!cancelled) setError((e as Error).message)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 800)
    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [listingId, listingVersion, picturesCount])

  // ── Compact variant ──────────────────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <div className={`rounded-lg border ${classByScore(data?.scores.structural ?? 50, 'border')} ${classByScore(data?.scores.structural ?? 50, 'bg')} ${className ?? ''}`}>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Gauge size={14} className={classByScore(data?.scores.structural ?? 50, 'text')} />
            <span className="text-xs font-semibold text-zinc-200">{t('heading')}</span>
            {loading && !data ? (
              <Loader2 size={11} className="animate-spin text-zinc-500" />
            ) : data ? (
              <>
                <span className="text-xs">
                  <strong className={classByScore(data.scores.structural, 'text')}>
                    {data.scores.structural}
                  </strong>
                  <span className="text-zinc-500">/100</span>
                </span>
                <span className={`text-[10px] uppercase tracking-wider ${classByScore(data.scores.structural, 'text')}`}>
                  {data.summary.score_label}
                </span>
                {(data.summary.critical_count > 0 || data.summary.high_count > 0) && (
                  <span className="text-[11px] text-zinc-400 truncate">
                    · {t('itemsToFix', { count: data.summary.critical_count + data.summary.high_count })}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-zinc-500">{error ?? t('calculating')}</span>
            )}
          </div>
          {data && data.issues.length > 0 && (
            expanded
              ? <ChevronUp size={14} className="text-zinc-400 shrink-0" />
              : <ChevronDown size={14} className="text-zinc-400 shrink-0" />
          )}
        </button>

        {expanded && data && data.issues.length > 0 && (
          <div className="px-3 pb-2 pt-1 border-t border-zinc-800/60">
            <IssuesList issues={data.issues} onJumpToField={onJumpToField} />
          </div>
        )}
      </div>
    )
  }

  // ── Card variant ─────────────────────────────────────────────────────────
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900/50 ${className ?? ''}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-cyan-400" />
          <h3 className="text-xs font-semibold text-zinc-200">{t('heading')}</h3>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
            {t('prePublishBadge')}
          </span>
        </div>
        {loading && <Loader2 size={11} className="animate-spin text-zinc-500" />}
      </div>

      {error && !data ? (
        <div className="p-3 text-[11px] text-red-300 flex items-start gap-1.5">
          <AlertCircle size={11} className="shrink-0 mt-0.5" />
          {error}
        </div>
      ) : !data ? (
        <div className="p-3 text-[11px] text-zinc-500 flex items-center gap-2">
          <Loader2 size={11} className="animate-spin" /> {t('calculatingScore')}
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {/* Score grande */}
          <div className="flex items-baseline gap-3">
            <div>
              <div className={`text-3xl font-bold ${classByScore(data.scores.structural, 'text')}`}>
                {data.scores.structural}
                <span className="text-base font-normal text-zinc-500">/100</span>
              </div>
              <div className={`text-[10px] uppercase tracking-wider ${classByScore(data.scores.structural, 'text')}`}>
                {data.summary.score_label}
              </div>
            </div>
            <div className="ml-auto text-right text-[10px] text-zinc-500">
              <div>{t('findings', { count: data.issues.length })}</div>
              {data.summary.critical_count > 0 && (
                <div className="text-red-300">⚠ {t('criticalCount', { count: data.summary.critical_count })}</div>
              )}
            </div>
          </div>

          {/* Breakdown bars */}
          <div className="space-y-1.5">
            <ScoreBar label={t('barTitle')}      value={data.scores.title}      weight={40} />
            <ScoreBar label={t('barAttributes')} value={data.scores.attributes} weight={40} />
            <ScoreBar label={t('barPictures')}   value={data.scores.pictures}   weight={20} />
          </div>

          {/* Context summary */}
          <div className="text-[10px] text-zinc-500 leading-relaxed border-t border-zinc-800 pt-2">
            <div>
              {t('titleChars', { count: data.context.title_length })}
              {data.context.has_brand_in_title  && <span className="text-emerald-400"> · {t('brandOk')}</span>}
              {!data.context.has_brand_in_title && <span className="text-amber-400"> · {t('brandMissing')}</span>}
            </div>
            <div>
              {t('attributesFilled', { filled: data.context.attributes_filled, total: data.context.attributes_total || '—' })}
            </div>
            {picturesCount !== undefined && (
              <div>{t('picturesApproved', { count: data.context.pictures_count })}</div>
            )}
          </div>

          {/* Issues acionáveis */}
          {data.issues.length > 0 && (
            <div className="space-y-1 pt-1">
              <IssuesList issues={data.issues} onJumpToField={onJumpToField} />
            </div>
          )}

          {data.issues.length === 0 && (
            <div className="text-[11px] text-emerald-300 flex items-center gap-1.5 pt-1">
              <CheckCircle2 size={11} /> {t('allGood')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-zinc-400">{label} <span className="text-zinc-600">({weight}%)</span></span>
        <span className={`font-mono ${classByScore(value, 'text')}`}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-950 overflow-hidden">
        <div
          className={`h-full transition-all ${classByScore(value, 'bar')}`}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  )
}

function IssuesList({ issues, onJumpToField }: { issues: SeoIssue[]; onJumpToField?: Props['onJumpToField'] }) {
  const t = useTranslations('creative.seoPanel')
  return (
    <ul className="space-y-1">
      {issues.map((issue, idx) => (
        <li
          key={`${issue.code}-${idx}`}
          className={`rounded-md border px-2 py-1.5 ${severityClasses(issue.severity, 'bg')} ${severityClasses(issue.severity, 'border')}`}
        >
          <div className="flex items-start gap-1.5">
            <SeverityIcon severity={issue.severity} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] leading-snug text-zinc-100">{issue.message}</p>
              {issue.fixHint && (
                <p className="text-[10px] text-zinc-400 mt-0.5">💡 {issue.fixHint}</p>
              )}
            </div>
            {issue.fixesField && onJumpToField && (
              <button
                type="button"
                onClick={() => onJumpToField(issue.fixesField!)}
                className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-zinc-800"
                title={t('jumpToFieldTitle', { field: issue.fixesField })}
              >
                {t('jumpButton')}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function SeverityIcon({ severity }: { severity: SeoIssueSeverity }) {
  if (severity === 'critical') return <AlertTriangle size={11} className="text-red-300 shrink-0 mt-0.5" />
  if (severity === 'high')     return <AlertCircle size={11} className="text-amber-300 shrink-0 mt-0.5" />
  if (severity === 'medium')   return <AlertCircle size={11} className="text-amber-400/70 shrink-0 mt-0.5" />
  if (severity === 'low')      return <Info size={11} className="text-zinc-400 shrink-0 mt-0.5" />
  return <Info size={11} className="text-zinc-500 shrink-0 mt-0.5" />
}

// ── Style helpers ──────────────────────────────────────────────────────────

function classByScore(score: number, kind: 'text' | 'bg' | 'border' | 'bar'): string {
  if (score >= 85) return kind === 'text' ? 'text-emerald-300'
                       : kind === 'bg'   ? 'bg-emerald-500/5'
                       : kind === 'border' ? 'border-emerald-500/30'
                       :                   'bg-emerald-400'
  if (score >= 70) return kind === 'text' ? 'text-cyan-300'
                       : kind === 'bg'   ? 'bg-cyan-500/5'
                       : kind === 'border' ? 'border-cyan-500/30'
                       :                   'bg-cyan-400'
  if (score >= 50) return kind === 'text' ? 'text-amber-300'
                       : kind === 'bg'   ? 'bg-amber-500/5'
                       : kind === 'border' ? 'border-amber-500/30'
                       :                   'bg-amber-400'
  if (score >= 30) return kind === 'text' ? 'text-orange-300'
                       : kind === 'bg'   ? 'bg-orange-500/5'
                       : kind === 'border' ? 'border-orange-500/30'
                       :                   'bg-orange-400'
  return kind === 'text' ? 'text-red-300'
       : kind === 'bg'   ? 'bg-red-500/5'
       : kind === 'border' ? 'border-red-500/30'
       :                   'bg-red-400'
}

/**
 * Helper pra navegar até um campo marcado com `data-seo-field`.
 * Usar como `onJumpToField={scrollToSeoField}` no Panel.
 * Procura no DOM atual, faz scrollIntoView smooth, e tenta focar o
 * primeiro input/textarea/button dentro do bloco. No-op se não encontra
 * (ex: campo "pictures" no editor, que vive na outra tela).
 */
export function scrollToSeoField(field: NonNullable<SeoIssue['fixesField']>): void {
  if (typeof document === 'undefined') return
  const el = document.querySelector(`[data-seo-field="${field}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // Tenta focar elemento editável dentro (pequeno delay pra esperar o scroll)
  setTimeout(() => {
    const focusable = el.querySelector<HTMLElement>('input, textarea, select, [tabindex]:not([tabindex="-1"])')
    focusable?.focus()
  }, 300)
}

function severityClasses(severity: SeoIssueSeverity, kind: 'bg' | 'border'): string {
  if (severity === 'critical') return kind === 'bg' ? 'bg-red-500/5' : 'border-red-500/30'
  if (severity === 'high')     return kind === 'bg' ? 'bg-amber-500/5' : 'border-amber-500/30'
  if (severity === 'medium')   return kind === 'bg' ? 'bg-amber-500/[0.03]' : 'border-amber-500/20'
  if (severity === 'low')      return kind === 'bg' ? 'bg-zinc-900/30' : 'border-zinc-800'
  return kind === 'bg' ? 'bg-zinc-900/30' : 'border-zinc-800'
}
