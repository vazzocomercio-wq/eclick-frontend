'use client'

/**
 * F4 (sessão 2026-05-14) — Operação de Cadastro.
 *
 * Tela do GESTOR pra:
 *   1. Ver produtos pendentes (com tag cadastro_pendente) + campos faltando
 *   2. Selecionar N em massa
 *   3. Despachar pro operador (config Active: pipeline + stage + due_date)
 *   4. Acompanhar assignments OPEN/IN_PROGRESS
 *
 * Backend: GET /products/completeness-summary + POST /products/dispatch-to-operator
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getAuthToken(): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

type IncompleteProduct = {
  id:      string
  sku:     string | null
  name:    string
  missing: string[]
  stock:   number | null
}

type SortMode = 'stock_desc' | 'stock_asc' | 'name' | ''

type CompletenessSummary = {
  total:             number
  incomplete_count:  number
  by_missing:        Record<string, number>
  sample_incomplete: IncompleteProduct[]
}

type Assignment = {
  id:                       string
  product_id:               string
  operator_user_id:         string
  active_deal_id:           string | null
  active_task_id:           string | null
  due_date:                 string | null
  status:                   'open' | 'in_progress' | 'completed' | 'cancelled' | 'failed'
  missing_fields_snapshot:  Array<{ label: string; type: string }>
  created_at:               string
  completed_at:             string | null
  products?: {
    id:         string
    name:       string
    sku:        string | null
    photo_urls: string[] | null
  } | null
}

type DispatchConfig = {
  operator_user_id: string
  pipeline_id:      string
  stage_id:         string
  due_date:         string
  priority:         'low' | 'normal' | 'high' | 'urgent'
  notes:            string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function plusDays(days: number): string {
  const d = new Date(Date.now() + days * 24 * 3600_000)
  return d.toISOString().slice(0, 10)
}

const STATUS_PILL: Record<Assignment['status'], { bg: string; color: string }> = {
  open:        { bg: 'rgba(0,229,255,0.12)',   color: '#67e8f9' },
  in_progress: { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  completed:   { bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
  cancelled:   { bg: 'rgba(113,113,122,0.15)', color: '#71717a' },
  failed:      { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
}

// ── main page ───────────────────────────────────────────────────────────────

export default function OperacaoCadastroPage() {
  const t = useTranslations('produtos')
  const [summary, setSummary] = useState<CompletenessSummary | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [tab, setTab] = useState<'pending' | 'assignments' | 'coverage'>('pending')
  const [dispatching, setDispatching] = useState(false)
  const [dispatchResult, setDispatchResult] = useState<{ dispatched: number; skipped_existing: number; errors: Array<{ product_id: string; message: string }> } | null>(null)

  // Filtros (2026-05-14) — gestor precisa priorizar quem tem estoque alto
  const [stockMin, setStockMin] = useState('')
  const [stockMax, setStockMax] = useState('')
  const [search,   setSearch]   = useState('')
  const [sort,     setSort]     = useState<SortMode>('stock_desc')
  // Debounce inputs pra não martelar o backend
  const [debounced, setDebounced] = useState({ stockMin: '', stockMax: '', search: '' })
  useEffect(() => {
    const t = setTimeout(() => setDebounced({ stockMin, stockMax, search }), 400)
    return () => clearTimeout(t)
  }, [stockMin, stockMax, search])

  // ── load data ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error(t('ops.sessionExpired'))

      const qs = new URLSearchParams({ limit: '500', sample_size: '200' })
      if (debounced.stockMin.trim() && Number.isFinite(Number(debounced.stockMin))) qs.set('stock_min', String(parseInt(debounced.stockMin, 10)))
      if (debounced.stockMax.trim() && Number.isFinite(Number(debounced.stockMax))) qs.set('stock_max', String(parseInt(debounced.stockMax, 10)))
      if (debounced.search.trim()) qs.set('search', debounced.search.trim())
      if (sort) qs.set('sort', sort)

      const [sumRes, assignRes] = await Promise.all([
        fetch(`${BACKEND}/products/completeness-summary?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${BACKEND}/products/operator-assignments?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const sumBody = await sumRes.json().catch(() => null)
      const assignBody = await assignRes.json().catch(() => [])

      if (sumRes.ok && sumBody) setSummary(sumBody as CompletenessSummary)
      if (assignRes.ok && Array.isArray(assignBody)) setAssignments(assignBody as Assignment[])

      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [debounced, sort, t])

  useEffect(() => { void load() }, [load])

  // ── selection ────────────────────────────────────────────────────────────

  const toggleAll = useCallback(() => {
    if (!summary) return
    if (selected.size === summary.sample_incomplete.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(summary.sample_incomplete.map(p => p.id)))
    }
  }, [summary, selected.size])

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  // ── dispatch ─────────────────────────────────────────────────────────────

  const handleDispatch = useCallback(async (config: DispatchConfig) => {
    if (selected.size === 0) return
    setDispatching(true)
    setDispatchResult(null)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error(t('ops.sessionExpired'))

      const res = await fetch(`${BACKEND}/products/dispatch-to-operator`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          product_ids:      [...selected],
          operator_user_id: config.operator_user_id,
          pipeline_id:      config.pipeline_id,
          stage_id:         config.stage_id,
          due_date:         config.due_date ? new Date(config.due_date + 'T18:00:00').toISOString() : undefined,
          task_priority:    config.priority,
          notes:            config.notes || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`)

      setDispatchResult({
        dispatched:       body.dispatched ?? 0,
        skipped_existing: body.skipped_existing ?? 0,
        errors:           body.errors ?? [],
      })
      setSelected(new Set())
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDispatching(false)
    }
  }, [selected, load, t])

  // ── KPIs ────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const open = assignments.filter(a => a.status === 'open').length
    const inProgress = assignments.filter(a => a.status === 'in_progress').length
    const completed7d = assignments.filter(a => a.status === 'completed' &&
      a.completed_at &&
      new Date(a.completed_at).getTime() > Date.now() - 7 * 24 * 3600_000).length
    return {
      pendentes:    summary?.incomplete_count ?? 0,
      em_andamento: inProgress,
      em_fila:      open,
      concluidos_7d: completed7d,
    }
  }, [summary, assignments])

  // ── UI ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-white" style={{ background: '#0a0a0c' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
              <Link href="/dashboard/produtos" className="hover:text-zinc-300">{t('ops.breadcrumbProducts')}</Link>
              <span>›</span>
              <span>{t('ops.breadcrumb')}</span>
            </div>
            <h1 className="text-2xl font-bold">{t('ops.title')}</h1>
            <p className="text-sm text-zinc-400 mt-1">
              {t('ops.subtitle')}
            </p>
          </div>
          <Link href="/dashboard/produtos/importar"
            className="px-3 py-2 rounded-lg text-[13px] font-medium border transition-all hover:border-cyan-500/40 hover:text-cyan-400"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            {t('ops.importSheet')}
          </Link>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm border"
            style={{ background: '#1a0a0a', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label={t('ops.kpi.pending')} value={kpis.pendentes} color="amber" />
          <Kpi label={t('ops.kpi.inProgress')} value={kpis.em_andamento} color="cyan" />
          <Kpi label={t('ops.kpi.queued')} value={kpis.em_fila} />
          <Kpi label={t('ops.kpi.completed7d')} value={kpis.concluidos_7d} color="emerald" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: '#27272a' }}>
          <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')}
            label={t('ops.tab.pending')} count={summary?.incomplete_count ?? 0} />
          <TabBtn active={tab === 'assignments'} onClick={() => setTab('assignments')}
            label={t('ops.tab.dispatched')} count={assignments.filter(a => a.status !== 'completed').length} />
          <TabBtn active={tab === 'coverage'} onClick={() => setTab('coverage')}
            label="Sem anúncio" count={0} />
        </div>

        {/* PENDING tab */}
        {tab === 'pending' && (
          <>
            {/* Filtros — sempre visíveis pra gestor refinar mesmo quando tem 0 pendentes
                após filtro aplicado (mostra estado "vazio com filtro" decentemente) */}
            <div className="mb-3 flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: '#111114', border: '1px solid #27272a' }}>
              <div className="flex-1 min-w-[200px] max-w-sm">
                <input type="text" placeholder={t('ops.searchPlaceholder')}
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-zinc-600 border outline-none transition-all focus:border-cyan-500/60"
                  style={{ background: '#0a0a0c', borderColor: '#27272a' }} />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className="font-medium">{t('ops.stock')}</span>
                <input type="number" inputMode="numeric" placeholder={t('ops.min')}
                  value={stockMin} onChange={e => setStockMin(e.target.value)}
                  className="w-16 px-2 py-1.5 rounded-md text-[12px] text-white border outline-none focus:border-cyan-500/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ background: '#0a0a0c', borderColor: '#27272a' }} />
                <span className="text-zinc-600">–</span>
                <input type="number" inputMode="numeric" placeholder={t('ops.max')}
                  value={stockMax} onChange={e => setStockMax(e.target.value)}
                  className="w-16 px-2 py-1.5 rounded-md text-[12px] text-white border outline-none focus:border-cyan-500/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ background: '#0a0a0c', borderColor: '#27272a' }} />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className="font-medium">{t('ops.sortBy')}</span>
                <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
                  className="px-2 py-1.5 rounded-md text-[12px] text-white border outline-none cursor-pointer"
                  style={{ background: '#0a0a0c', borderColor: '#27272a' }}>
                  <option value="stock_desc">{t('ops.sortStockDesc')}</option>
                  <option value="stock_asc">{t('ops.sortStockAsc')}</option>
                  <option value="name">{t('ops.sortName')}</option>
                  <option value="">{t('ops.sortRecent')}</option>
                </select>
              </div>
              {(stockMin || stockMax || search) && (
                <button onClick={() => { setStockMin(''); setStockMax(''); setSearch('') }}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5">
                  {t('ops.clearFilters')}
                </button>
              )}
            </div>

            {loading ? (
            <div className="text-center py-12 text-zinc-500">{t('ops.loading')}</div>
          ) : !summary || summary.incomplete_count === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <div className="text-5xl mb-3">{(stockMin || stockMax || search) ? '🔍' : '🎉'}</div>
              <div className="text-lg font-semibold">
                {(stockMin || stockMax || search) ? t('ops.emptyFiltered') : t('ops.emptyNone')}
              </div>
              <div className="text-sm text-zinc-400 mt-1">
                {(stockMin || stockMax || search) ? t('ops.emptyFilteredHint') : t('ops.emptyNoneHint')}
              </div>
            </div>
          ) : (
            <>
              {/* Top missing fields breakdown */}
              <div className="mb-4 p-4 rounded-xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">{t('ops.topMissingFields')}</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.by_missing)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 12)
                    .map(([field, count]) => (
                      <span key={field}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border"
                        style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' }}>
                        <span className="text-zinc-300">{field}</span>
                        <span className="text-amber-400 font-bold">{count}</span>
                      </span>
                    ))}
                </div>
              </div>

              {/* Bulk action bar */}
              {selected.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3 text-sm"
                  style={{ background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.2)' }}>
                  <span className="font-semibold text-cyan-400">{t('ops.selectedCount', { count: selected.size })}</span>
                  <button onClick={() => setShowDispatchModal(true)}
                    className="ml-auto px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                    style={{ background: '#00E5FF', color: '#000' }}>
                    {t('ops.dispatchToOperator')}
                  </button>
                  <button onClick={() => setSelected(new Set())}
                    className="text-zinc-500 hover:text-zinc-300 text-xs">
                    {t('ops.clear')}
                  </button>
                </div>
              )}

              {/* Pending list */}
              <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #27272a' }}>
                <table className="w-full text-sm">
                  <thead style={{ background: '#0d0d10' }}>
                    <tr className="text-[11px] text-zinc-500 uppercase tracking-wider">
                      <th className="px-3 py-3 text-left w-10">
                        <input type="checkbox"
                          checked={summary.sample_incomplete.length > 0 && selected.size === summary.sample_incomplete.length}
                          onChange={toggleAll}
                          className="w-4 h-4 cursor-pointer accent-cyan-400" />
                      </th>
                      <th className="px-3 py-3 text-left">SKU</th>
                      <th className="px-3 py-3 text-left">{t('ops.col.name')}</th>
                      <th className="px-3 py-3 text-right w-24">{t('ops.col.stock')}</th>
                      <th className="px-3 py-3 text-left">{t('ops.col.missingFields')}</th>
                      <th className="px-3 py-3 text-right w-32">{t('ops.col.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sample_incomplete.map(p => {
                      const stock = p.stock ?? 0
                      const stockColor = stock === 0 ? '#71717a' : stock <= 5 ? '#facc15' : stock <= 20 ? '#a1a1aa' : '#34d399'
                      return (
                      <tr key={p.id} className="border-t hover:bg-white/[0.02] transition-colors"
                        style={{ borderColor: '#27272a' }}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleOne(p.id)}
                            className="w-4 h-4 cursor-pointer accent-cyan-400" />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-zinc-300">{p.sku || '—'}</td>
                        <td className="px-3 py-2.5 max-w-xs truncate">{p.name}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="text-[12px] font-semibold tabular-nums" style={{ color: stockColor }}>
                            {p.stock == null ? '—' : stock.toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {p.missing.slice(0, 4).map(m => (
                              <span key={m} className="px-1.5 py-0.5 rounded text-[10px]"
                                style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{m}</span>
                            ))}
                            {p.missing.length > 4 && (
                              <span className="text-[10px] text-zinc-500">+{p.missing.length - 4}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Link href={`/dashboard/produtos/${p.id}/editar`}
                            className="text-[11px] text-cyan-400 hover:text-cyan-300">
                            {t('ops.edit')} →
                          </Link>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
                {summary.incomplete_count > summary.sample_incomplete.length && (
                  <div className="px-4 py-3 text-center text-xs text-zinc-500"
                    style={{ borderTop: '1px solid #27272a' }}>
                    {t('ops.showingOf', { shown: summary.sample_incomplete.length, total: summary.incomplete_count })}
                  </div>
                )}
              </div>
            </>
          )}
          </>
        )}

        {/* ASSIGNMENTS tab */}
        {tab === 'assignments' && (
          assignments.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <div className="text-4xl mb-2">📋</div>
              <div className="text-base font-semibold">{t('ops.noDispatches')}</div>
              <div className="text-sm text-zinc-500 mt-1">{t('ops.noDispatchesHint')}</div>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <table className="w-full text-sm">
                <thead style={{ background: '#0d0d10' }}>
                  <tr className="text-[11px] text-zinc-500 uppercase tracking-wider">
                    <th className="px-3 py-3 text-left">{t('ops.col.product')}</th>
                    <th className="px-3 py-3 text-left">{t('ops.col.status')}</th>
                    <th className="px-3 py-3 text-left">{t('ops.col.missing')}</th>
                    <th className="px-3 py-3 text-left">{t('ops.col.deadline')}</th>
                    <th className="px-3 py-3 text-left">{t('ops.col.dispatchedAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id} className="border-t" style={{ borderColor: '#27272a' }}>
                      <td className="px-3 py-2.5">
                        <div className="text-sm font-medium">{a.products?.name ?? '—'}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">{a.products?.sku ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: STATUS_PILL[a.status].bg, color: STATUS_PILL[a.status].color }}>
                          {t(`ops.status.${a.status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-[11px] text-zinc-400">
                          {a.missing_fields_snapshot.slice(0, 3).map(m => m.label).join(' • ')}
                          {a.missing_fields_snapshot.length > 3 && ` +${a.missing_fields_snapshot.length - 3}`}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-zinc-400">{fmtDate(a.due_date)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-zinc-400">{fmtDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* COVERAGE tab — produtos sem anúncio / cobertura parcial */}
        {tab === 'coverage' && <CoverageTab />}

        {/* Dispatch result */}
        {dispatchResult && (() => {
          const hasErrors    = dispatchResult.errors.length > 0
          const hasSuccess   = dispatchResult.dispatched > 0
          const borderColor  = hasErrors && !hasSuccess ? 'rgba(239,68,68,0.4)' : 'rgba(52,211,153,0.3)'
          return (
            <div className="fixed bottom-6 right-6 z-50 max-w-xl p-4 rounded-xl shadow-2xl"
              style={{ background: '#111114', border: `1px solid ${borderColor}` }}>
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">{hasErrors && !hasSuccess ? '❌' : '✅'}</div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold ${hasSuccess ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t('ops.cardsCreated', { count: dispatchResult.dispatched })}
                  </div>
                  {dispatchResult.skipped_existing > 0 && (
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {t('ops.alreadyHadCard', { count: dispatchResult.skipped_existing })}
                    </div>
                  )}
                  {hasErrors && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-red-400 font-medium">
                        {t('ops.errorsLabel', { count: dispatchResult.errors.length })}
                      </div>
                      <ul className="text-[11px] text-red-300/90 space-y-0.5 max-h-40 overflow-y-auto">
                        {dispatchResult.errors.map((err, i) => (
                          <li key={i} className="rounded bg-red-500/10 border border-red-500/20 px-2 py-1">
                            <span className="font-mono text-[10px] text-red-400/70 block">
                              {err.product_id.slice(0, 8)}…
                            </span>
                            <span className="break-words">{err.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <button onClick={() => setDispatchResult(null)} className="text-zinc-500 hover:text-zinc-300 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })()}

        {/* Dispatch modal */}
        {showDispatchModal && (
          <DispatchModal
            count={selected.size}
            onClose={() => setShowDispatchModal(false)}
            onConfirm={async (config) => {
              setShowDispatchModal(false)
              await handleDispatch(config)
            }}
            loading={dispatching}
          />
        )}
      </div>
    </div>
  )
}

// ── components ──────────────────────────────────────────────────────────────

function Kpi({ label, value, color }: { label: string; value: number; color?: 'amber' | 'cyan' | 'emerald' }) {
  const C = {
    amber:   { bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.2)',  text: '#f59e0b' },
    cyan:    { bg: 'rgba(0,229,255,0.06)',    border: 'rgba(0,229,255,0.2)',    text: '#67e8f9' },
    emerald: { bg: 'rgba(52,211,153,0.06)',   border: 'rgba(52,211,153,0.2)',   text: '#34d399' },
  } as const
  const c = color ? C[color] : { bg: '#111114', border: '#27272a', text: '#e4e4e7' }
  return (
    <div className="p-4 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: c.text }}>{value}</div>
    </div>
  )
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-all ${active ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
      {label}
      {count > 0 && (
        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]"
          style={{ background: active ? 'rgba(0,229,255,0.15)' : '#27272a' }}>
          {count}
        </span>
      )}
    </button>
  )
}

type ActiveAgent    = { member_id: string; user_id: string; display_name: string | null; role: string; status: string }
type ActivePipeline = { id: string; name: string; is_default: boolean; description: string | null; template_key: string | null }
type ActiveStage    = { id: string; pipeline_id: string; name: string; position: number; color: string | null; is_won: boolean; is_lost: boolean }

function DispatchModal({ count, onClose, onConfirm, loading, mode = 'cadastro' }: {
  count:     number
  onClose:   () => void
  onConfirm: (config: DispatchConfig) => Promise<void> | void
  loading:   boolean
  /** 'cadastro' = completar cadastro · 'publish' = funil de Anúncios */
  mode?:     'cadastro' | 'publish'
}) {
  const t = useTranslations('produtos')
  const [operator, setOperator] = useState('')
  const [pipeline, setPipeline] = useState('')
  const [stage, setStage] = useState('')
  const [dueDate, setDueDate] = useState(plusDays(3))
  const [priority, setPriority] = useState<DispatchConfig['priority']>('normal')
  const [notes, setNotes] = useState('')

  // Dropdowns Active
  const [agents, setAgents]       = useState<ActiveAgent[]>([])
  const [pipelines, setPipelines] = useState<ActivePipeline[]>([])
  const [stages, setStages]       = useState<ActiveStage[]>([])
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [configError, setConfigError]     = useState<string | null>(null)

  // Fetch agentes + pipelines no mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingConfig(true)
      setConfigError(null)
      try {
        const token = await getAuthToken()
        if (!token) throw new Error(t('ops.notAuthenticated'))
        const headers = { 'Authorization': `Bearer ${token}` }
        const [agentsRes, pipelinesRes] = await Promise.all([
          fetch(`${BACKEND}/products/active-config/agents`, { headers }),
          fetch(`${BACKEND}/products/active-config/pipelines`, { headers }),
        ])
        if (!agentsRes.ok) throw new Error(t('ops.loadAgentsError'))
        if (!pipelinesRes.ok) throw new Error(t('ops.loadPipelinesError'))
        const agentsData    = await agentsRes.json() as ActiveAgent[]
        const pipelinesData = await pipelinesRes.json() as ActivePipeline[]
        if (cancelled) return
        setAgents(agentsData)
        setPipelines(pipelinesData)

        // Auto-seleciona o pipeline conforme o modo:
        //  - publish  → funil cujo nome casa /anúncio/i (funil de Anúncios)
        //  - cadastro → pipeline com template_key='operacao_cadastro'
        const preferred = mode === 'publish'
          ? (pipelinesData.find(p => /an[úu]ncio/i.test(p.name))
             ?? pipelinesData.find(p => p.is_default)
             ?? pipelinesData[0])
          : (pipelinesData.find(p => p.template_key === 'operacao_cadastro')
             ?? pipelinesData.find(p => p.is_default)
             ?? pipelinesData[0])
        if (preferred) setPipeline(preferred.id)
      } catch (e) {
        if (!cancelled) setConfigError((e as Error).message)
      } finally {
        if (!cancelled) setLoadingConfig(false)
      }
    })()
    return () => { cancelled = true }
  }, [t, mode])

  // Fetch stages sempre que pipeline muda
  useEffect(() => {
    if (!pipeline) { setStages([]); setStage(''); return }
    let cancelled = false
    void (async () => {
      try {
        const token = await getAuthToken()
        const res = await fetch(`${BACKEND}/products/active-config/pipelines/${pipeline}/stages`, {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(t('ops.loadStagesError'))
        const data = await res.json() as ActiveStage[]
        if (cancelled) return
        setStages(data)
        // Auto-seleciona o primeiro stage (position 0 = "A Fazer" por convenção)
        const first = data[0]
        if (first) setStage(first.id)
      } catch (e) {
        if (!cancelled) setConfigError((e as Error).message)
      }
    })()
    return () => { cancelled = true }
  }, [pipeline, t])

  const canSubmit = operator.trim() && pipeline.trim() && stage.trim()
  const selectStyle = {
    background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: '#0d0d10', border: '1px solid #27272a' }}
        onClick={e => e.stopPropagation()}>
        <div className="mb-4">
          <h2 className="text-lg font-bold">
            {mode === 'publish'
              ? `Despachar ${count} produto${count > 1 ? 's' : ''} pra anunciar`
              : t('ops.modal.title', { count })}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {mode === 'publish'
              ? 'Cria um card no funil de Anúncios do Active por produto — o operador cria/vincula o anúncio.'
              : t('ops.modal.subtitle')}
          </p>
        </div>

        {configError && (
          <div className="mb-3 rounded-lg p-2.5 text-xs"
            style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            ⚠ {configError}
          </div>
        )}

        <div className="space-y-3">
          <Field label={t('ops.modal.operator')} hint={loadingConfig ? t('ops.modal.loadingAgents') : t('ops.modal.agentsAvailable', { count: agents.length })}>
            <select
              value={operator}
              onChange={e => setOperator(e.target.value)}
              disabled={loadingConfig || agents.length === 0}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none disabled:opacity-50"
              style={selectStyle}
            >
              <option value="">{t('ops.modal.selectAgent')}</option>
              {agents.map(a => (
                <option key={a.user_id} value={a.user_id}>
                  {a.display_name ?? a.user_id.slice(0, 8)}
                  {a.role !== 'agent' ? ` (${a.role})` : ''}
                  {a.status === 'invited' ? ` · ${t('ops.modal.invited')}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('ops.modal.pipeline')} hint={loadingConfig ? t('ops.modal.loading') : t('ops.modal.pipelinesAvailable', { count: pipelines.length })}>
            <select
              value={pipeline}
              onChange={e => setPipeline(e.target.value)}
              disabled={loadingConfig || pipelines.length === 0}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none disabled:opacity-50"
              style={selectStyle}
            >
              <option value="">{t('ops.modal.selectPipeline')}</option>
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.template_key === 'operacao_cadastro' ? ` ${t('ops.modal.recommended')}` : ''}
                  {p.is_default ? ` · ${t('ops.modal.default')}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('ops.modal.initialStage')} hint={pipeline ? t('ops.modal.stagesInPipeline', { count: stages.length }) : t('ops.modal.choosePipelineFirst')}>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              disabled={!pipeline || stages.length === 0}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none disabled:opacity-50"
              style={selectStyle}
            >
              <option value="">{t('ops.modal.selectStage')}</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>
                  {s.position + 1}. {s.name}
                  {s.is_won ? ' ✓' : s.is_lost ? ' ✗' : ''}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('ops.modal.deadline')}>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={selectStyle} />
            </Field>

            <Field label={t('ops.modal.priority')}>
              <select value={priority} onChange={e => setPriority(e.target.value as DispatchConfig['priority'])}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={selectStyle}>
                <option value="low">{t('ops.modal.priorityLow')}</option>
                <option value="normal">{t('ops.modal.priorityNormal')}</option>
                <option value="high">{t('ops.modal.priorityHigh')}</option>
                <option value="urgent">{t('ops.modal.priorityUrgent')}</option>
              </select>
            </Field>
          </div>

          <Field label={t('ops.modal.notes')}>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder={t('ops.modal.notesPlaceholder')}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
              style={selectStyle} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            {t('ops.modal.cancel')}
          </button>
          <button onClick={() => void onConfirm({
            operator_user_id: operator.trim(),
            pipeline_id:      pipeline.trim(),
            stage_id:         stage.trim(),
            due_date:         dueDate,
            priority,
            notes,
          })}
            disabled={!canSubmit || loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #00E5FF 0%, #0091EA 100%)', color: '#000' }}>
            {loading
              ? (mode === 'publish' ? 'Despachando…' : t('ops.modal.dispatching'))
              : (mode === 'publish' ? `Despachar ${count} →` : t('ops.modal.dispatchBtn', { count }))}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-zinc-600 mt-1">{hint}</div>}
    </div>
  )
}

// ── Aba "Sem anúncio" — cobertura multi-canal × multi-conta ───────────────────

type CoverageDestino = { key: string; channel: string; accountId: string | null; label: string }

type CoverageProduct = {
  id:                string
  sku:               string | null
  name:              string
  stock:             number | null
  cadastro_completo: boolean
  na_loja:           boolean
  covered:           string[]
  missing:           string[]
  status:            'sem_anuncio' | 'parcial' | 'completo'
}

type CoverageData = {
  destinos: CoverageDestino[]
  summary:  {
    total:                         number
    sem_anuncio:                   number
    parcial:                       number
    completo:                      number
    cadastro_completo_sem_anuncio: number
  }
  sample: CoverageProduct[]
}

const CHANNEL_LABEL: Record<string, string> = {
  mercadolivre: 'ML', shopee: 'Shopee', amazon: 'Amazon', magalu: 'Magalu',
}

function destinoLabel(d: CoverageDestino): string {
  const ch = CHANNEL_LABEL[d.channel] ?? d.channel
  return `${ch} · ${d.label}`
}

const COV_STATUS: Record<CoverageProduct['status'], { label: string; bg: string; color: string }> = {
  sem_anuncio: { label: 'Sem anúncio', bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
  parcial:     { label: 'Parcial',     bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  completo:    { label: 'Completo',    bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
}

function CoverageTab() {
  const [data, setData]       = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [search, setSearch]             = useState('')
  const [stockMin, setStockMin]         = useState('')
  const [stockMax, setStockMax]         = useState('')
  const [coverage, setCoverage]         = useState<'all' | 'sem' | 'parcial'>('all')
  const [onlyComplete, setOnlyComplete] = useState(false)
  const [sort, setSort]                 = useState<'stock_desc' | 'stock_asc' | 'name'>('stock_desc')

  const [debounced, setDebounced] = useState({ search: '', stockMin: '', stockMax: '' })
  useEffect(() => {
    const tm = setTimeout(() => setDebounced({ search, stockMin, stockMax }), 400)
    return () => clearTimeout(tm)
  }, [search, stockMin, stockMax])

  // Seleção + despacho pro funil de Anúncios
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [showModal, setShowModal]     = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [result, setResult]           = useState<{ dispatched: number; errors: Array<{ product_id: string; message: string }> } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Sessão expirada — recarregue a página')
      const qs = new URLSearchParams({ sample_size: '300', sort })
      if (coverage !== 'all') qs.set('coverage', coverage)
      if (onlyComplete) qs.set('only_complete', 'true')
      if (debounced.search.trim()) qs.set('search', debounced.search.trim())
      if (debounced.stockMin.trim() && Number.isFinite(Number(debounced.stockMin))) {
        qs.set('stock_min', String(parseInt(debounced.stockMin, 10)))
      }
      if (debounced.stockMax.trim() && Number.isFinite(Number(debounced.stockMax))) {
        qs.set('stock_max', String(parseInt(debounced.stockMax, 10)))
      }
      const res  = await fetch(`${BACKEND}/products/listing-coverage?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`)
      setData(body as CoverageData)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [debounced, coverage, onlyComplete, sort])

  useEffect(() => { void load() }, [load])

  const hasFilters = !!(search || stockMin || stockMax || coverage !== 'all' || onlyComplete)

  function toggleAll() {
    const ids = data?.sample.map(p => p.id) ?? []
    setSelected(prev => (prev.size === ids.length && ids.length > 0) ? new Set() : new Set(ids))
  }
  function toggleOne(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  async function handleDispatch(config: DispatchConfig) {
    if (selected.size === 0) return
    setDispatching(true)
    setResult(null)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Sessão expirada — recarregue a página')
      const res = await fetch(`${BACKEND}/products/dispatch-to-publish`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          product_ids:      [...selected],
          operator_user_id: config.operator_user_id,
          pipeline_id:      config.pipeline_id,
          stage_id:         config.stage_id,
          due_date:         config.due_date ? new Date(config.due_date + 'T18:00:00').toISOString() : undefined,
          task_priority:    config.priority,
          notes:            config.notes || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`)
      setResult({ dispatched: body.dispatched ?? 0, errors: body.errors ?? [] })
      setSelected(new Set())
      void load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDispatching(false)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-3 px-4 py-3 rounded-xl text-sm border"
          style={{ background: '#1a0a0a', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {result && (
        <div className="mb-3 px-4 py-3 rounded-xl text-sm border flex items-center gap-2"
          style={{ background: '#0d140d', borderColor: 'rgba(52,211,153,0.3)', color: '#34d399' }}>
          <span>✅ {result.dispatched} card(s) criado(s) no funil de Anúncios do Active.</span>
          {result.errors.length > 0 && (
            <span className="text-red-400">{result.errors.length} com erro.</span>
          )}
          <button onClick={() => setResult(null)} className="ml-auto text-zinc-500 hover:text-zinc-300 text-xs">fechar</button>
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <CovCard label="Sem anúncio nenhum" value={data?.summary.sem_anuncio ?? 0} color="#f87171" />
        <CovCard label="Cobertura parcial" value={data?.summary.parcial ?? 0} color="#f59e0b" />
        <CovCard label="Prontos p/ anunciar" value={data?.summary.cadastro_completo_sem_anuncio ?? 0} color="#67e8f9"
          hint="cadastro completo, mas sem anúncio" />
        <CovCard label="Anunciados em todos" value={data?.summary.completo ?? 0} color="#34d399" />
      </div>

      {/* Destinos da org */}
      {data && (
        <div className="mb-3 px-4 py-2.5 rounded-xl text-[11px]"
          style={{ background: '#111114', border: '1px solid #27272a' }}>
          <span className="text-zinc-500 uppercase tracking-wider mr-2">Destinos conectados:</span>
          {data.destinos.length === 0 ? (
            <span className="text-amber-400">nenhum marketplace conectado — conecte uma conta pra ver a cobertura</span>
          ) : (
            data.destinos.map(d => (
              <span key={d.key} className="inline-block mr-2 text-zinc-300">{destinoLabel(d)}</span>
            ))
          )}
          <span className="text-zinc-600 ml-1">· Loja própria (informativo)</span>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: '#111114', border: '1px solid #27272a' }}>
        <div className="flex-1 min-w-[200px] max-w-sm">
          <input type="text" placeholder="Buscar nome ou SKU…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-zinc-600 border outline-none transition-all focus:border-cyan-500/60"
            style={{ background: '#0a0a0c', borderColor: '#27272a' }} />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className="font-medium">Estoque</span>
          <input type="number" inputMode="numeric" placeholder="min"
            value={stockMin} onChange={e => setStockMin(e.target.value)}
            className="w-16 px-2 py-1.5 rounded-md text-[12px] text-white border outline-none focus:border-cyan-500/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ background: '#0a0a0c', borderColor: '#27272a' }} />
          <span className="text-zinc-600">–</span>
          <input type="number" inputMode="numeric" placeholder="max"
            value={stockMax} onChange={e => setStockMax(e.target.value)}
            className="w-16 px-2 py-1.5 rounded-md text-[12px] text-white border outline-none focus:border-cyan-500/60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ background: '#0a0a0c', borderColor: '#27272a' }} />
        </div>
        <select value={coverage} onChange={e => setCoverage(e.target.value as 'all' | 'sem' | 'parcial')}
          className="px-2 py-1.5 rounded-md text-[12px] text-white border outline-none cursor-pointer"
          style={{ background: '#0a0a0c', borderColor: '#27272a' }}>
          <option value="all">Sem anúncio + parcial</option>
          <option value="sem">Só sem anúncio nenhum</option>
          <option value="parcial">Só cobertura parcial</option>
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as 'stock_desc' | 'stock_asc' | 'name')}
          className="px-2 py-1.5 rounded-md text-[12px] text-white border outline-none cursor-pointer"
          style={{ background: '#0a0a0c', borderColor: '#27272a' }}>
          <option value="stock_desc">Estoque ↓ (maior primeiro)</option>
          <option value="stock_asc">Estoque ↑ (menor primeiro)</option>
          <option value="name">Nome (A-Z)</option>
        </select>
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
          <input type="checkbox" checked={onlyComplete} onChange={e => setOnlyComplete(e.target.checked)}
            className="w-3.5 h-3.5 cursor-pointer accent-cyan-400" />
          Só cadastro completo
        </label>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setStockMin(''); setStockMax(''); setCoverage('all'); setOnlyComplete(false) }}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5">
            Limpar filtros
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3 text-sm"
          style={{ background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.2)' }}>
          <span className="font-semibold text-cyan-400">{selected.size} produto(s) selecionado(s)</span>
          <button onClick={() => setShowModal(true)}
            className="ml-auto px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: '#00E5FF', color: '#000' }}>
            Despachar pra anunciar →
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-zinc-500 hover:text-zinc-300 text-xs">Limpar</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Carregando cobertura…</div>
      ) : !data || data.sample.length === 0 ? (
        <div className="text-center py-12 rounded-2xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <div className="text-5xl mb-3">{hasFilters ? '🔍' : '🎉'}</div>
          <div className="text-lg font-semibold">
            {hasFilters ? 'Nenhum produto com esse filtro' : 'Tudo anunciado'}
          </div>
          <div className="text-sm text-zinc-400 mt-1">
            {hasFilters ? 'Ajuste os filtros acima.' : 'Todos os produtos estão anunciados em todos os destinos conectados.'}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #27272a' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#0d0d10' }}>
              <tr className="text-[11px] text-zinc-500 uppercase tracking-wider">
                <th className="px-3 py-3 text-left w-10">
                  <input type="checkbox"
                    checked={data.sample.length > 0 && selected.size === data.sample.length}
                    onChange={toggleAll}
                    className="w-4 h-4 cursor-pointer accent-cyan-400" />
                </th>
                <th className="px-3 py-3 text-left">SKU</th>
                <th className="px-3 py-3 text-left">Nome</th>
                <th className="px-3 py-3 text-right w-24">Estoque</th>
                <th className="px-3 py-3 text-left w-32">Cadastro</th>
                <th className="px-3 py-3 text-left">Cobertura de anúncios</th>
                <th className="px-3 py-3 text-right w-28">Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.sample.map(p => {
                const stock = p.stock ?? 0
                const stockColor = stock === 0 ? '#71717a' : stock <= 5 ? '#facc15' : stock <= 20 ? '#a1a1aa' : '#34d399'
                const st = COV_STATUS[p.status]
                return (
                  <tr key={p.id} className="border-t hover:bg-white/[0.02] transition-colors"
                    style={{ borderColor: '#27272a' }}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleOne(p.id)}
                        className="w-4 h-4 cursor-pointer accent-cyan-400" />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-zinc-300">{p.sku || '—'}</td>
                    <td className="px-3 py-2.5 max-w-xs truncate">{p.name}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: stockColor }}>
                        {p.stock == null ? '—' : stock.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={p.cadastro_completo
                          ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' }
                          : { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                        {p.cadastro_completo ? '✓ Completo' : 'Incompleto'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1"
                          style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        {(data.destinos).map(d => {
                          const ok = p.covered.includes(d.key)
                          return (
                            <span key={d.key} title={destinoLabel(d)}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={ok
                                ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' }
                                : { background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                              {ok ? '✓' : '✗'} {destinoLabel(d)}
                            </span>
                          )
                        })}
                        <span title="Loja própria (informativo)"
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]"
                          style={p.na_loja
                            ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' }
                            : { background: '#1a1a1f', color: '#52525b' }}>
                          {p.na_loja ? '✓' : '·'} Loja
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={`/dashboard/produtos/${p.id}/editar`}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300">
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 text-center text-xs text-zinc-500" style={{ borderTop: '1px solid #27272a' }}>
            Exibindo {data.sample.length} de {data.summary.sem_anuncio + data.summary.parcial} produto(s) sem cobertura total
          </div>
        </div>
      )}

      {showModal && (
        <DispatchModal
          mode="publish"
          count={selected.size}
          loading={dispatching}
          onClose={() => setShowModal(false)}
          onConfirm={async (config) => {
            setShowModal(false)
            await handleDispatch(config)
          }}
        />
      )}
    </>
  )
}

function CovCard({ label, value, color, hint }: { label: string; value: number; color: string; hint?: string }) {
  return (
    <div className="p-4 rounded-xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>{value.toLocaleString('pt-BR')}</div>
      {hint && <div className="text-[10px] text-zinc-600 mt-0.5">{hint}</div>}
    </div>
  )
}
