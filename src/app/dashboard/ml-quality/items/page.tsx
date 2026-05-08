'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  Search, Filter, ChevronLeft, ChevronRight, ExternalLink, Loader2,
  ShieldCheck, ShieldAlert, AlertOctagon, X, ArrowUpDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'
import { useMlLabels } from '@/hooks/useMlLabels'
import { CopyButton } from '@/components/ui/copy-button'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

// ────────────────────────────────────────────────────────────────────────
// Types (espelha shape do ml_quality_snapshots)
// ────────────────────────────────────────────────────────────────────────

interface QualityItem {
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
  all_missing_count:          number
  has_exposure_penalty:       boolean
  penalty_reasons:            string[]
  pending_count:              number
  internal_priority_score:    number | null
  estimated_score_after_fix:  number | null
  fix_complexity:             'easy' | 'medium' | 'hard' | 'blocked' | null
  fetched_at:                 string
  seller_id:                  number
}

interface ListResponse { items: QualityItem[]; total: number }

type Level     = '' | 'basic' | 'satisfactory' | 'professional'
type Penalty   = '' | 'true' | 'false'
type SortKey   = 'priority' | 'score_asc' | 'score_desc' | 'recent'

// ────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export default function QualityItemsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-zinc-500 text-sm">Carregando…</div>}>
      <ItemsPageInner />
    </Suspense>
  )
}

function ItemsPageInner() {
  const sp       = useSearchParams()
  const router   = useRouter()
  const pathname = usePathname()
  const { selected: selectedSellerId } = useMlAccount()

  // Filtros via URL (deep-linkable)
  const level         = (sp.get('level')         ?? '')         as Level
  const domainId      = sp.get('domain_id')      ?? ''
  const penalty       = (sp.get('penalty')       ?? '')         as Penalty
  const minScore      = sp.get('min_score')      ?? ''
  const maxScore      = sp.get('max_score')      ?? ''
  const listingStatus = sp.get('listing_status') ?? ''
  const catalog       = sp.get('catalog')        ?? ''
  const q             = sp.get('q')              ?? ''
  const sort          = (sp.get('sort')          ?? 'priority') as SortKey
  const offset        = Number(sp.get('offset') ?? '0')
  const LIMIT         = 50

  // Estado local de busca (separado pra debounce)
  const [searchInput, setSearchInput] = useState(q)
  useEffect(() => { setSearchInput(q) }, [q])

  const [items, setItems]     = useState<QualityItem[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const updateFilter = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else                        next.set(k, v)
    }
    // Resetar offset ao mudar qualquer filtro (exceto o próprio offset)
    if (!('offset' in patch)) next.delete('offset')
    router.replace(`${pathname}?${next.toString()}`)
  }, [sp, router, pathname])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t   = await getToken()
      const sid = getStoredSellerId()
      const params = new URLSearchParams()
      if (sid != null)     params.set('seller_id', String(sid))
      if (level)           params.set('level', level)
      if (domainId)        params.set('domain_id', domainId)
      if (penalty)         params.set('penalty', penalty)
      if (minScore)        params.set('min_score', minScore)
      if (maxScore)        params.set('max_score', maxScore)
      if (listingStatus)   params.set('listing_status', listingStatus)
      if (catalog)         params.set('catalog', catalog)
      if (q)               params.set('q', q)
      if (sort)            params.set('sort', sort)
      params.set('limit',  String(LIMIT))
      params.set('offset', String(offset))

      const r = await fetch(`${BACKEND}/ml-quality/items?${params.toString()}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      const body = (await r.json()) as ListResponse
      setItems(body.items)
      setTotal(body.total)
    } catch (e) {
      setError((e as Error).message)
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [level, domainId, penalty, minScore, maxScore, listingStatus, catalog, q, sort, offset])

  useEffect(() => { void load() }, [load, selectedSellerId])

  // Debounce busca
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== q) updateFilter({ q: searchInput || null })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const hasActiveFilters = useMemo(
    () => Boolean(level || domainId || penalty || minScore || maxScore || q),
    [level, domainId, penalty, minScore, maxScore, q],
  )

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const currentPage = Math.floor(offset / LIMIT) + 1

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-quality" className="hover:text-cyan-400 transition-colors">
              Quality Center
            </Link>
            <span>/</span>
            <span className="text-zinc-300">Anúncios</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">Anúncios — Diagnóstico</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {loading ? 'Carregando…' : `${total.toLocaleString('pt-BR')} anúncio${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {/* Toolbar de filtros */}
      <div className="rounded-xl p-3 space-y-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        {/* Linha 1: busca + sort */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por MLB ID…"
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg outline-none focus:border-cyan-400/50 transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs">
            <ArrowUpDown size={12} className="text-zinc-500" />
            <select
              value={sort}
              onChange={e => updateFilter({ sort: e.target.value })}
              className="rounded-lg px-2 py-2 text-xs outline-none cursor-pointer"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <option value="priority">Maior prioridade</option>
              <option value="score_asc">Score ↑</option>
              <option value="score_desc">Score ↓</option>
              <option value="recent">Mais recentes</option>
            </select>
          </div>
        </div>

        {/* Linha 2: chips de filtro */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FilterChip
            label="Nível"
            value={level}
            options={[
              { value: '',              label: 'Todos' },
              { value: 'basic',         label: 'Básico' },
              { value: 'satisfactory',  label: 'Satisfatório' },
              { value: 'professional',  label: 'Profissional' },
            ]}
            onChange={v => updateFilter({ level: v || null })}
          />
          <FilterChip
            label="Penalidade"
            value={penalty}
            options={[
              { value: '',      label: 'Todos' },
              { value: 'true',  label: 'Com penalidade' },
              { value: 'false', label: 'Sem penalidade' },
            ]}
            onChange={v => updateFilter({ penalty: v || null })}
          />

          <FilterChip
            label="Anúncio"
            value={catalog === 'true' ? 'catalog' : listingStatus}
            options={[
              { value: '',         label: 'Todos' },
              { value: 'active',   label: 'Ativos' },
              { value: 'paused',   label: 'Pausados' },
              { value: 'closed',   label: 'Fechados' },
              { value: 'catalog',  label: 'Catálogo' },
            ]}
            onChange={v => {
              if (v === 'catalog') {
                updateFilter({ catalog: 'true', listing_status: null })
              } else {
                updateFilter({ catalog: null, listing_status: v || null })
              }
            }}
          />

          <ScoreRangeFilter
            min={minScore}
            max={maxScore}
            onChange={(min, max) => updateFilter({ min_score: min || null, max_score: max || null })}
          />

          {domainId && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', color: '#67e8f9' }}
            >
              <Filter size={10} />
              <span className="font-mono text-[10px]">{domainId}</span>
              <button
                onClick={() => updateFilter({ domain_id: null })}
                className="ml-0.5 hover:text-white"
              >
                <X size={10} />
              </button>
            </span>
          )}

          {hasActiveFilters && (
            <button
              onClick={() => router.replace(pathname)}
              className="ml-auto text-zinc-500 hover:text-red-400 transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && items.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-zinc-900/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Vazio */}
      {!loading && items.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <ShieldCheck size={48} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-300 font-medium">Nenhum anúncio encontrado</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
            {hasActiveFilters
              ? 'Tenta ajustar os filtros, ou limpa todos pra ver tudo.'
              : 'Roda um sync no dashboard pra puxar os anúncios.'}
          </p>
        </div>
      )}

      {/* Lista de items */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => <ItemRow key={item.id} item={item} />)}
        </div>
      )}

      {/* Paginação */}
      {total > LIMIT && (
        <div className="flex items-center justify-between text-xs text-zinc-400 pt-2">
          <span>
            Página {currentPage} de {totalPages} · {offset + 1}–{Math.min(offset + LIMIT, total)} de {total.toLocaleString('pt-BR')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateFilter({ offset: String(Math.max(0, offset - LIMIT)) })}
              disabled={offset === 0 || loading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg disabled:opacity-30"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#a1a1aa' }}
            >
              <ChevronLeft size={12} /> Anterior
            </button>
            <button
              onClick={() => updateFilter({ offset: String(offset + LIMIT) })}
              disabled={offset + LIMIT >= total || loading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg disabled:opacity-30"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#a1a1aa' }}
            >
              Próxima <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Item row
// ────────────────────────────────────────────────────────────────────────

function ItemRow({ item }: { item: QualityItem }) {
  const { domainName, attributeName } = useMlLabels()
  const score      = item.ml_score ?? 0
  const color      = scoreColor(score)
  const missingTot = (item.pi_missing_count || 0) + (item.ft_missing_count || 0) + (item.all_missing_count || 0)

  return (
    <Link
      href={`/dashboard/ml-quality/items/${item.ml_item_id}`}
      className="block rounded-lg p-3 transition-all hover:border-cyan-400/30"
      style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}
    >
      <div className="flex items-start gap-3">
        {/* Score circle */}
        <div
          className="flex-shrink-0 rounded-lg w-14 h-14 flex flex-col items-center justify-center font-bold"
          style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}
        >
          <span className="text-lg leading-none">{item.ml_score ?? '—'}</span>
          <span className="text-[8px] mt-0.5 opacity-70">/100</span>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs text-zinc-200">{item.ml_item_id}</span>
            <CopyButton value={item.ml_item_id} size={11} />
            <LevelBadge level={item.ml_level} />
            {item.has_exposure_penalty && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <AlertOctagon size={9} /> Penalizado
              </span>
            )}
            {item.estimated_score_after_fix != null && item.estimated_score_after_fix > score && (
              <span className="text-[10px] text-cyan-400">
                +{item.estimated_score_after_fix - score} pts potenciais
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1 flex-wrap">
            {item.ml_domain_id && (
              <span>{domainName(item.ml_domain_id)}</span>
            )}
            {missingTot > 0 && (
              <span>
                <strong className="text-zinc-300">{missingTot}</strong> atributos faltando
              </span>
            )}
            {item.pending_count > 0 && (
              <span>
                <strong className="text-amber-400">{item.pending_count}</strong> ações
              </span>
            )}
            <span>seller {item.seller_id}</span>
          </div>

          {/* Missing attrs preview */}
          {(item.pi_missing_attributes?.length ?? 0) + (item.ft_missing_attributes?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {[...(item.pi_missing_attributes ?? []), ...(item.ft_missing_attributes ?? [])]
                .slice(0, 6)
                .map(attr => (
                  <span
                    key={attr}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(251,191,36,0.06)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
                  >
                    {attributeName(attr)}
                  </span>
                ))}
              {([...(item.pi_missing_attributes ?? []), ...(item.ft_missing_attributes ?? [])].length > 6) && (
                <span className="text-[10px] text-zinc-500">
                  +{[...(item.pi_missing_attributes ?? []), ...(item.ft_missing_attributes ?? [])].length - 6}
                </span>
              )}
            </div>
          )}
        </div>

        <ChevronRight size={14} className="text-zinc-600 flex-shrink-0 mt-1" />
      </div>
    </Link>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Filter chip (selectable)
// ────────────────────────────────────────────────────────────────────────

function FilterChip({ label, value, options, onChange }: {
  label:   string
  value:   string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-zinc-500 text-[10px] uppercase tracking-wider">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer"
        style={{
          background: value ? 'rgba(0,229,255,0.08)' : '#09090b',
          border: `1px solid ${value ? 'rgba(0,229,255,0.3)' : '#1a1a1f'}`,
          color: value ? '#67e8f9' : '#fafafa',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function ScoreRangeFilter({ min, max, onChange }: {
  min: string; max: string;
  onChange: (min: string, max: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Score:</span>
      <input
        type="number" min="0" max="100" placeholder="0"
        value={min}
        onChange={e => onChange(e.target.value, max)}
        className="w-14 rounded px-1.5 py-1 text-xs text-center outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      />
      <span className="text-zinc-600 text-xs">–</span>
      <input
        type="number" min="0" max="100" placeholder="100"
        value={max}
        onChange={e => onChange(min, e.target.value)}
        className="w-14 rounded px-1.5 py-1 text-xs text-center outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      />
    </div>
  )
}

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
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}
    >
      {level === 'professional' ? <ShieldCheck size={9} /> : <ShieldAlert size={9} />}
      {m.label}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 85) return '#22c55e'
  if (s >= 60) return '#fbbf24'
  if (s > 0)   return '#ef4444'
  return '#52525b'
}

