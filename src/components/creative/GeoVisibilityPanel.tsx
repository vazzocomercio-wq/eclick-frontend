'use client'

/**
 * Painel "Visibilidade em IA (GEO)" no editor de anúncio (Creative).
 * Complementa o ListingSeoPanel (que mede busca interna do ML): este mede o
 * quanto o RASCUNHO seria citado por ChatGPT/Perplexity/Gemini, ANTES de
 * publicar. Pontua o rascunho + simula o ranking vs concorrentes. Read-only —
 * não toca em atributos nem na publicação do ML.
 */

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, Loader2, Swords, TrendingUp, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { scoreBand, dimensionLabel, dimensionColor } from '@/components/ai-visibility/geo-labels'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface Dim { name: string; score: number; weight: number; reasoning?: string }
interface ScoreRes { geoScore: number; dimensions: Dim[] }
interface SimRes { avg_rank: number | null; candidate_count: number; candidate_source: string | null; queries: Array<{ query: string; rank: number | null }>; note: string | null }

async function post<T>(path: string, body: unknown): Promise<T> {
  const { data } = await createClient().auth.getSession()
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { message?: string })?.message || 'erro')
  return res.json() as Promise<T>
}

export default function GeoVisibilityPanel({ listingId, listingVersion }: { listingId: string; listingVersion: number }) {
  const t = useTranslations('creative.geoPanel')
  const sourceLabel: Record<string, string> = {
    radar: t('sourceRadar'), synthetic: t('sourceSynthetic'), catalog: t('sourceCatalog'),
  }
  const [score, setScore] = useState<ScoreRes | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [sim, setSim] = useState<SimRes | null>(null)
  const [simBusy, setSimBusy] = useState(false)
  const [simErr, setSimErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null); setSim(null); setSimErr(null); setExpanded(false)
    post<ScoreRes>('/ai-visibility/optimize/score-draft', { listingId })
      .then(r => { if (alive) { setScore(r); setLoading(false) } })
      .catch(e => { if (alive) { setErr((e as Error).message); setLoading(false) } })
    return () => { alive = false }
  }, [listingId, listingVersion])

  const runSim = useCallback(async () => {
    setSimBusy(true); setSimErr(null); setSim(null)
    try { setSim(await post<SimRes>('/ai-visibility/optimize/simulate-draft', { listingId })) }
    catch (e) { setSimErr((e as Error).message) }
    finally { setSimBusy(false) }
  }, [listingId])

  // dimensões mais fracas primeiro (gap = peso × (10-score))
  const weak = (score?.dimensions ?? []).slice().sort((a, b) => b.weight * (10 - b.score) - a.weight * (10 - a.score)).slice(0, expanded ? 8 : 3)
  const band = score ? scoreBand(score.geoScore) : null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          <Sparkles size={11} className="text-cyan-400" /> {t('title')}
        </h4>
        {score && band && (
          <span className="text-xs font-bold tabular-nums" style={{ color: band.color }}>{score.geoScore}/100</span>
        )}
      </div>

      {loading && <div className="flex items-center gap-2 text-xs text-zinc-500 py-2"><Loader2 size={13} className="animate-spin text-cyan-400" /> {t('evaluating')}</div>}
      {err && <div className="text-xs text-red-300 py-1">{t('scoreError', { error: err })}</div>}

      {score && band && (
        <>
          <p className="text-[11px] text-zinc-400 mb-2">
            {t('intro')} <span style={{ color: band.color }}>{band.label}.</span>
          </p>
          <div className="space-y-1.5">
            {weak.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-300">{dimensionLabel(d.name)}</span>
                  <span className="tabular-nums font-semibold" style={{ color: dimensionColor(d.score) }}>{d.score}/10</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full overflow-hidden bg-zinc-800">
                  <div className="h-full rounded-full" style={{ width: `${d.score * 10}%`, background: dimensionColor(d.score) }} />
                </div>
              </div>
            ))}
          </div>
          {(score.dimensions?.length ?? 0) > 3 && (
            <button onClick={() => setExpanded(v => !v)} className="mt-2 inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-cyan-300">
              <ChevronDown size={11} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} /> {expanded ? t('showLess') : t('showAllDimensions')}
            </button>
          )}

          {/* Rank Simulator */}
          <div className="mt-3 pt-3 border-t border-zinc-800">
            {!sim && (
              <button onClick={runSim} disabled={simBusy}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-cyan-400/30 hover:border-cyan-400/60 text-cyan-300 text-xs transition-all disabled:opacity-60">
                {simBusy ? <Loader2 size={12} className="animate-spin" /> : <Swords size={12} />}
                {simBusy ? t('simulating') : t('testRanking')}
              </button>
            )}
            {simErr && <div className="text-xs text-red-300 py-1">{simErr}</div>}
            {sim && (
              sim.note ? (
                <p className="text-[11px] text-zinc-500">{t('simUnavailable', { note: sim.note })}</p>
              ) : (
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <TrendingUp size={13} className="text-cyan-400" />
                    <span className="text-zinc-200">{t.rich('avgRank', {
                      rank: sim.avg_rank ?? '—',
                      count: sim.candidate_count,
                      b: (chunks) => <b className="tabular-nums">{chunks}</b>,
                    })}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{t('matchup', { source: sourceLabel[sim.candidate_source ?? ''] ?? sim.candidate_source ?? '' })}</p>
                  <div className="mt-2 space-y-1">
                    {sim.queries.map((q, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 text-[11px]">
                        <span className="text-zinc-400">“{q.query}”</span>
                        <span className="tabular-nums whitespace-nowrap text-zinc-300">{q.rank ?? '—'}º</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={runSim} disabled={simBusy} className="mt-2 text-[10px] text-zinc-500 hover:text-cyan-300">{t('testAgain')}</button>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
