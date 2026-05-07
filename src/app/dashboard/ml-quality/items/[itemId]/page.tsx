'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, Loader2, AlertOctagon, ShieldCheck, ShieldAlert,
  Activity, Calendar, Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getStoredSellerId, useMlAccount } from '@/components/ml/AccountSelector'
import { useMlLabels } from '@/hooks/useMlLabels'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface ItemSnapshot {
  id:                         string
  ml_item_id:                 string
  ml_user_product_id:         string | null
  ml_domain_id:               string | null
  ml_score:                   number | null
  ml_level:                   'basic' | 'satisfactory' | 'professional' | null
  pi_complete:                boolean
  pi_filled_count:            number
  pi_missing_count:           number
  pi_missing_attributes:      string[]
  ft_complete:                boolean
  ft_filled_count:            number
  ft_missing_count:           number
  ft_missing_attributes:      string[]
  all_complete:               boolean
  all_filled_count:           number
  all_missing_count:          number
  all_missing_attributes:     string[]
  ml_tags:                    string[]
  has_exposure_penalty:       boolean
  penalty_reasons:            string[]
  pending_actions:            Array<{ type: string; label?: string; severity?: string }>
  pending_count:              number
  internal_priority_score:    number | null
  estimated_score_after_fix:  number | null
  fix_complexity:             'easy' | 'medium' | 'hard' | 'blocked' | null
  fetched_at:                 string
  seller_id:                  number
}

interface ItemHistory {
  captured_at:   string
  ml_score:      number | null
  ml_level:      string | null
  pi_complete:   boolean
  ft_complete:   boolean
  all_complete:  boolean
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export default function ItemDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = use(params)
  const { selected: selectedSellerId } = useMlAccount()
  const { domainName, attributeName } = useMlLabels()

  const [item, setItem]       = useState<ItemSnapshot | null>(null)
  const [history, setHistory] = useState<ItemHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t   = await getToken()
      const sid = getStoredSellerId()
      const sidQ = sid != null ? `?seller_id=${sid}` : ''
      const sidQAmp = sid != null ? `&seller_id=${sid}` : ''

      const [itemRes, histRes] = await Promise.all([
        fetch(`${BACKEND}/ml-quality/items/${itemId}${sidQ}`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${BACKEND}/ml-quality/items/${itemId}/history?days=90${sidQAmp}`, { headers: { Authorization: `Bearer ${t}` } }),
      ])
      if (!itemRes.ok) {
        const body = await itemRes.text().catch(() => '')
        throw new Error(`HTTP ${itemRes.status}: ${body || itemRes.statusText}`)
      }
      const text = await itemRes.text()
      setItem(text ? JSON.parse(text) : null)
      if (histRes.ok) setHistory(await histRes.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [itemId])

  useEffect(() => { void load() }, [load, selectedSellerId])

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto" style={{ background: '#09090b', minHeight: '100vh', color: '#fafafa' }}>
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="p-6 max-w-5xl mx-auto" style={{ background: '#09090b', minHeight: '100vh', color: '#fafafa' }}>
        <Link href="/dashboard/ml-quality/items" className="inline-flex items-center gap-1 text-cyan-400 text-xs mb-3 hover:underline">
          <ArrowLeft size={12} /> Voltar pra lista
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error || 'Anúncio não encontrado.'}
        </div>
      </div>
    )
  }

  const score = item.ml_score ?? 0
  const color = scoreColor(score)
  const allMissing = [
    ...(item.pi_missing_attributes ?? []),
    ...(item.ft_missing_attributes ?? []),
    ...(item.all_missing_attributes ?? []),
  ]
  const dedupedMissing = Array.from(new Set(allMissing))

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto" style={{ background: '#09090b', minHeight: '100vh', color: '#fafafa' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/ml-quality" className="hover:text-cyan-400 transition-colors">
          Quality Center
        </Link>
        <span>/</span>
        <Link href="/dashboard/ml-quality/items" className="hover:text-cyan-400 transition-colors">
          Anúncios
        </Link>
        <span>/</span>
        <span className="text-zinc-300 font-mono">{item.ml_item_id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <div
          className="flex-shrink-0 rounded-xl w-24 h-24 flex flex-col items-center justify-center font-bold"
          style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}
        >
          <span className="text-4xl leading-none">{item.ml_score ?? '—'}</span>
          <span className="text-[10px] mt-1 opacity-70">/100</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold font-mono">{item.ml_item_id}</h1>
            <a
              href={`https://www.mercadolivre.com.br/${item.ml_item_id}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-cyan-400 text-xs hover:underline"
            >
              <ExternalLink size={11} /> Abrir no ML
            </a>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <LevelBadge level={item.ml_level} />
            {item.has_exposure_penalty && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <AlertOctagon size={10} /> Penalizado
              </span>
            )}
            {item.fix_complexity && <ComplexityBadge c={item.fix_complexity} />}
            {item.estimated_score_after_fix != null && item.estimated_score_after_fix > score && (
              <span className="inline-flex items-center gap-1 text-[11px] text-cyan-400">
                <Sparkles size={10} /> Potencial: {item.estimated_score_after_fix}/100 (+{item.estimated_score_after_fix - score} pts)
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-[11px] text-zinc-500 mt-2 flex-wrap">
            {item.ml_domain_id && <span>{domainName(item.ml_domain_id)}</span>}
            <span>seller {item.seller_id}</span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={10} /> Última leitura: {formatDate(item.fetched_at)}
            </span>
          </div>
        </div>
      </div>

      {/* History sparkline */}
      {history.length >= 2 && (
        <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Evolução do score (90 dias)
            </h2>
            <span className="text-[10px] text-zinc-500">{history.length} medições</span>
          </div>
          <ScoreChart history={history} />
        </div>
      )}

      {/* 3 dimensoes (PI / FT / ALL) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <DimensionCard
          title="PI — Identificação do produto"
          weight={25}
          complete={item.pi_complete}
          filled={item.pi_filled_count}
          missing={item.pi_missing_count}
          missingAttrs={item.pi_missing_attributes}
          attributeName={attributeName}
          color="#a78bfa"
        />
        <DimensionCard
          title="FT — Ficha técnica"
          weight={60}
          complete={item.ft_complete}
          filled={item.ft_filled_count}
          missing={item.ft_missing_count}
          missingAttrs={item.ft_missing_attributes}
          attributeName={attributeName}
          color="#00E5FF"
        />
        <DimensionCard
          title="ALL — Todos atributos"
          weight={15}
          complete={item.all_complete}
          filled={item.all_filled_count}
          missing={item.all_missing_count}
          missingAttrs={item.all_missing_attributes}
          attributeName={attributeName}
          color="#22c55e"
        />
      </div>

      {/* Penalty reasons */}
      {item.penalty_reasons && item.penalty_reasons.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid rgba(239,68,68,0.25)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-1.5">
            <AlertOctagon size={12} /> Motivos da penalização
          </h2>
          <div className="space-y-1">
            {item.penalty_reasons.map(r => (
              <div
                key={r}
                className="font-mono text-[11px] px-3 py-1.5 rounded"
                style={{ background: 'rgba(239,68,68,0.06)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {r}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags ML */}
      {item.ml_tags && item.ml_tags.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            Tags do anúncio (ML)
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {item.ml_tags.map(t => (
              <span
                key={t}
                className="font-mono text-[10px] px-2 py-0.5 rounded"
                style={{ background: 'rgba(167,139,250,0.06)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.2)' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pending actions (preview da Camada 2/3) */}
      {item.pending_count > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid rgba(0,229,255,0.25)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-1.5">
            <Activity size={12} /> Ações sugeridas ({item.pending_count})
          </h2>
          {Array.isArray(item.pending_actions) && item.pending_actions.length > 0 ? (
            <div className="space-y-1.5">
              {item.pending_actions.map((a, i) => (
                <div
                  key={i}
                  className="text-xs px-3 py-2 rounded"
                  style={{ background: 'rgba(0,229,255,0.06)', color: '#a5f3fc', border: '1px solid rgba(0,229,255,0.2)' }}
                >
                  {a.label ?? a.type}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              Sugestões IA serão exibidas aqui quando a Camada 2 (sugestão automática) for ativada.
              Por enquanto, preencher os atributos faltantes acima geralmente resolve.
            </p>
          )}
        </div>
      )}

      {/* Resumo de atributos faltantes */}
      {dedupedMissing.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            Todos atributos faltantes ({dedupedMissing.length})
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {dedupedMissing.map(a => (
              <span
                key={a}
                className="text-[11px] px-2 py-1 rounded"
                style={{ background: 'rgba(251,191,36,0.06)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
              >
                {attributeName(a)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Dimension card
// ────────────────────────────────────────────────────────────────────────

function DimensionCard({ title, weight, complete, filled, missing, missingAttrs, attributeName, color }: {
  title:         string
  weight:        number
  complete:      boolean
  filled:        number
  missing:       number
  missingAttrs:  string[]
  attributeName: (id: string) => string
  color:         string
}) {
  const total = filled + missing
  const pct   = total > 0 ? Math.round((filled / total) * 100) : 0
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
      <div>
        <div className="flex items-start justify-between">
          <h3 className="text-xs font-semibold text-zinc-300">{title}</h3>
          <span className="text-[10px] text-zinc-500 flex-shrink-0">peso {weight}%</span>
        </div>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-2xl font-bold" style={{ color: complete ? '#22c55e' : color }}>{pct}%</span>
          {complete ? (
            <ShieldCheck size={14} className="text-emerald-400 mb-1" />
          ) : (
            <ShieldAlert size={14} className="text-amber-400 mb-1" />
          )}
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">
          {filled} de {total} atributos preenchidos
        </p>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a1f' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: complete ? '#22c55e' : color }} />
      </div>

      {missingAttrs.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Faltando:</p>
          <div className="flex flex-wrap gap-1">
            {missingAttrs.slice(0, 8).map(a => (
              <span
                key={a}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(251,191,36,0.06)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
              >
                {attributeName(a)}
              </span>
            ))}
            {missingAttrs.length > 8 && (
              <span className="text-[10px] text-zinc-500">+{missingAttrs.length - 8}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Score chart
// ────────────────────────────────────────────────────────────────────────

function ScoreChart({ history }: { history: ItemHistory[] }) {
  if (history.length < 2) return null
  const w = 600
  const h = 80
  const scores = history.map(p => p.ml_score ?? 0)
  const min = Math.max(0, Math.min(...scores) - 5)
  const max = Math.min(100, Math.max(...scores) + 5)
  const span = Math.max(1, max - min)

  const stepX = w / (history.length - 1)
  const points = history.map((p, i) => {
    const x = i * stepX
    const y = h - ((p.ml_score ?? 0) - min) / span * h
    return `${x},${y}`
  })

  const last = scores[scores.length - 1] ?? 0
  const first = scores[0] ?? 0
  const delta = last - first
  const deltaColor = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#a1a1aa'

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
        <line x1={0} y1={h} x2={w} y2={h} stroke="#1a1a1f" strokeWidth="0.5" />
        <polyline
          fill="none"
          stroke="#00E5FF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.join(' ')}
        />
      </svg>
      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-zinc-500">{formatDate(history[0]!.captured_at)}</span>
        <span style={{ color: deltaColor }}>
          {delta > 0 ? '+' : ''}{delta} pts em {history.length} pontos
        </span>
        <span className="text-zinc-500">{formatDate(history[history.length - 1]!.captured_at)}</span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Badges + helpers
// ────────────────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: 'basic' | 'satisfactory' | 'professional' | null }) {
  if (!level) return null
  const map = {
    basic:        { label: 'Básico',       color: '#ef4444' },
    satisfactory: { label: 'Satisfatório', color: '#fbbf24' },
    professional: { label: 'Profissional', color: '#22c55e' },
  } as const
  const m = map[level]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}
    >
      {level === 'professional' ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
      {m.label}
    </span>
  )
}

function ComplexityBadge({ c }: { c: 'easy' | 'medium' | 'hard' | 'blocked' }) {
  const map = {
    easy:    { label: 'Fácil',    color: '#22c55e' },
    medium:  { label: 'Médio',    color: '#fbbf24' },
    hard:    { label: 'Difícil',  color: '#f97316' },
    blocked: { label: 'Bloqueado',color: '#ef4444' },
  } as const
  const m = map[c]
  return (
    <span
      className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}
    >
      {m.label} de corrigir
    </span>
  )
}

function scoreColor(s: number): string {
  if (s >= 85) return '#22c55e'
  if (s >= 60) return '#fbbf24'
  if (s > 0)   return '#ef4444'
  return '#52525b'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
