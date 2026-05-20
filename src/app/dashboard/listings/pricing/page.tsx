'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AccountSelector, { getStoredSellerId } from '@/components/ml/AccountSelector'
import {
  ChevronLeft, RefreshCw, ExternalLink, Check, AlertTriangle, TrendingDown,
  TrendingUp, Award, Eye, Truck, Package, Star, X, Filter,
} from 'lucide-react'
import { useToast, ToastViewport } from '@/hooks/useToast'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type BuyBoxStatus = 'winning' | 'losing' | 'sharing_first_place'

interface Suggestion {
  id: string
  ml_item_id: string
  product_id: string | null
  current_price: number
  suggested_price: number
  price_difference_brl: number
  price_difference_pct: number
  buy_box_status: BuyBoxStatus | null
  visit_share: 'maximum' | 'medium' | 'low' | null
  competitors_sharing: number
  consistent: boolean
  reason: string[]
  catalog_product_id: string | null
  winner_item_id: string | null
  winner_price: number | null
  boosts: Record<string, boolean>
  internal_margin_at_suggested_pct: number | null
  is_below_min_margin: boolean
  is_below_cost: boolean
  fetched_at: string
}

const STATUS_META: Record<BuyBoxStatus, { color: string; bg: string; icon: typeof Award }> = {
  winning:              { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   icon: Award },
  losing:               { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: TrendingDown },
  sharing_first_place:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: TrendingUp },
}

const VISIT_COLORS: Record<string, string> = {
  maximum: '#22c55e',
  medium:  '#f59e0b',
  low:     '#ef4444',
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function PricingPage() {
  const t = useTranslations('listings.pricing')
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [applying, setApplying] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<BuyBoxStatus | ''>('')
  const [minDiffPct, setMinDiffPct] = useState<number>(0)
  // Sprint 8 — seleção em lote
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkApplying, setBulkApplying] = useState(false)

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase, t])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const sellerId = getStoredSellerId()
      const sellerQs = sellerId != null ? `&seller_id=${sellerId}` : ''
      const filterQs = [
        filterStatus ? `&buy_box_status=${filterStatus}` : '',
        minDiffPct > 0 ? `&min_diff_pct=${minDiffPct}` : '',
      ].join('')
      const res = await fetch(
        `${BACKEND}/listings/pricing/suggestions?limit=100${sellerQs}${filterQs}`,
        { headers },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      setSuggestions(body.suggestions ?? [])
      setTotal(body.total ?? 0)
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.loadFailed'), tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [getHeaders, filterStatus, minDiffPct, toast, t])

  useEffect(() => { load() }, [load])

  const runScan = async () => {
    const sellerId = getStoredSellerId()
    if (sellerId == null) {
      toast({ message: t('errors.selectAccount'), tone: 'error' })
      return
    }
    setScanning(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/scan/pricing`, {
        method: 'POST', headers, body: JSON.stringify({ seller_id: sellerId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      toast({ message: t('scanDone', { items: result.items_scanned, tasks: result.tasks_created }), tone: 'success' })
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.generic'), tone: 'error' })
    } finally {
      setScanning(false)
    }
  }

  const bulkApply = async (mode: 'safe' | 'best_effort' | 'dry_run' = 'safe') => {
    const sellerId = getStoredSellerId()
    if (sellerId == null) { toast({ message: t('errors.selectAccount'), tone: 'error' }); return }
    if (selected.size === 0) { toast({ message: t('errors.selectAtLeastOne'), tone: 'warn' }); return }
    setBulkApplying(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/bulk/apply-prices`, {
        method: 'POST', headers,
        body: JSON.stringify({
          seller_id: sellerId,
          item_ids: Array.from(selected),
          apply_mode: mode,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`)
      toast({
        message: mode === 'dry_run'
          ? t('bulkDryRunStarted', { count: selected.size })
          : t('bulkApplyStarted', { count: selected.size }),
        tone: 'success',
      })
      setSelected(new Set())
      // Refresh em 5s pra capturar os primeiros aplicados
      setTimeout(() => { void load() }, 5000)
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.generic'), tone: 'error' })
    } finally {
      setBulkApplying(false)
    }
  }

  const toggleSelect = (itemId: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(itemId)) n.delete(itemId); else n.add(itemId)
      return n
    })
  }

  const selectAll = () => {
    if (selected.size === suggestions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(suggestions.filter(s => !s.is_below_cost).map(s => s.ml_item_id)))
    }
  }

  const applyPrice = async (s: Suggestion, mode: 'safe' | 'force' = 'safe') => {
    const sellerId = getStoredSellerId()
    if (sellerId == null) {
      toast({ message: t('errors.selectAccountShort'), tone: 'error' })
      return
    }
    setApplying(prev => new Set(prev).add(s.ml_item_id))
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/pricing/apply/${s.ml_item_id}`, {
        method: 'POST', headers,
        body: JSON.stringify({ seller_id: sellerId, mode }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`)
      if (body.skipped_reason) {
        toast({
          message: body.skipped_reason === 'price_below_cost'
            ? t('skipped.belowCost')
            : body.skipped_reason === 'below_min_margin'
              ? t('skipped.belowMinMargin')
              : t('skipped.generic', { reason: body.skipped_reason }),
          tone: 'warn',
        })
      } else {
        toast({ message: t('priceApplied', { price: brl(body.new_price) }), tone: 'success' })
        await load()
      }
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.generic'), tone: 'error' })
    } finally {
      setApplying(prev => { const n = new Set(prev); n.delete(s.ml_item_id); return n })
    }
  }

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }} className="p-6 max-w-[1400px] space-y-5">
      <ToastViewport />

      {/* Header */}
      <div>
        <Link href="/dashboard/listings"
          className="text-zinc-500 hover:text-cyan-400 text-xs flex items-center gap-1 mb-2 transition-colors">
          <ChevronLeft size={12} /> {t('backToCenter')}
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">{t('eyebrow')}</p>
            <h1 className="text-white text-3xl font-semibold">{t('title')}</h1>
            <p className="text-xs text-zinc-600 mt-1">
              {total > 0
                ? t('summary', { count: total })
                : t('summaryEmpty')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AccountSelector compact hideWhenEmpty />
            <button onClick={runScan} disabled={scanning}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#0d0d10' }}>
              <RefreshCw size={11} className={scanning ? 'animate-spin' : ''} /> {t('runScan')}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <section className="rounded-xl p-3 flex items-center gap-2 flex-wrap"
        style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <Filter size={12} className="text-zinc-500" />
        <span className="text-[11px] text-zinc-500 mr-1">{t('buyBoxStatus')}:</span>
        <FilterChip label={t('status.all')}          active={filterStatus === ''}                    onClick={() => setFilterStatus('')} />
        <FilterChip label={t('status.losing')}        active={filterStatus === 'losing'}              onClick={() => setFilterStatus(filterStatus === 'losing' ? '' : 'losing')} color="#ef4444" />
        <FilterChip label={t('status.sharing_first_place')}  active={filterStatus === 'sharing_first_place'} onClick={() => setFilterStatus(filterStatus === 'sharing_first_place' ? '' : 'sharing_first_place')} color="#f59e0b" />
        <FilterChip label={t('status.winning')}        active={filterStatus === 'winning'}             onClick={() => setFilterStatus(filterStatus === 'winning' ? '' : 'winning')} color="#22c55e" />
        <span className="ml-3 text-[11px] text-zinc-500">{t('diffAtLeast')}</span>
        <select value={minDiffPct} onChange={e => setMinDiffPct(Number(e.target.value))}
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200">
          <option value={0}>{t('diffAny')}</option>
          <option value={5}>5%</option>
          <option value={10}>10%</option>
          <option value={20}>20%</option>
        </select>
      </section>

      {/* Bulk bar — só aparece quando tem suggestions */}
      {!loading && suggestions.length > 0 && (
        <section className="rounded-xl p-3 flex items-center gap-3 flex-wrap"
          style={{ background: selected.size > 0 ? 'rgba(0,229,255,0.06)' : '#111114', border: `1px solid ${selected.size > 0 ? 'rgba(0,229,255,0.3)' : '#1a1a1f'}` }}>
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === suggestions.filter(s => !s.is_below_cost).length}
              onChange={selectAll}
              className="accent-cyan-400"
            />
            {t('selectAllEligible', { count: suggestions.filter(s => !s.is_below_cost).length })}
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-xs text-cyan-400 font-bold">{t('selectedCount', { count: selected.size })}</span>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={() => bulkApply('dry_run')} disabled={bulkApplying}
                  className="text-[11px] px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
                  {t('simulateDryRun')}
                </button>
                <Link href="/dashboard/listings/bulk"
                  className="text-[11px] px-2.5 py-1.5 rounded-lg flex items-center"
                  style={{ background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
                  {t('history')}
                </Link>
                <button onClick={() => bulkApply('safe')} disabled={bulkApplying}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: '#00E5FF', color: '#0d0d10' }}>
                  {bulkApplying ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                  {t('bulkApplySafe')}
                </button>
              </div>
            </>
          )}
          {selected.size === 0 && (
            <Link href="/dashboard/listings/bulk"
              className="ml-auto text-[11px] px-2.5 py-1.5 rounded-lg flex items-center"
              style={{ background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
              {t('viewBulkHistory')}
            </Link>
          )}
        </section>
      )}

      {/* Lista */}
      {loading ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-xs"
          style={{ background: '#111114', border: '1px solid #1a1a1f' }}>{t('loading')}</div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <Award size={32} className="text-zinc-700 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">{t('empty.title')}</p>
          <p className="text-zinc-600 text-xs mt-1">{t('empty.desc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map(s => (
            <SuggestionCard
              key={s.id}
              s={s}
              applying={applying.has(s.ml_item_id)}
              selected={selected.has(s.ml_item_id)}
              onToggleSelect={() => toggleSelect(s.ml_item_id)}
              onApply={applyPrice}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
      style={active
        ? { background: color ? `${color}20` : 'rgba(0,229,255,0.15)', border: `1px solid ${color ?? '#00E5FF'}40`, color: color ?? '#00E5FF' }
        : { background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
      {label}
    </button>
  )
}

function SuggestionCard({ s, applying, selected, onToggleSelect, onApply }: {
  s: Suggestion
  applying: boolean
  selected: boolean
  onToggleSelect: () => void
  onApply: (s: Suggestion, mode?: 'safe' | 'force') => void
}) {
  const t = useTranslations('listings.pricing')
  const status = s.buy_box_status ? STATUS_META[s.buy_box_status] : null
  const StatusIcon = status?.icon ?? Award
  const visitColor = s.visit_share ? VISIT_COLORS[s.visit_share] : null
  const diffSign = s.price_difference_pct >= 0 ? '+' : ''

  return (
    <div className="rounded-xl p-4"
      style={{
        background: '#111114',
        border: '1px solid #1a1a1f',
        borderLeft: status ? `3px solid ${status.color}` : '3px solid #27272a',
      }}>
      <div className="flex items-start gap-3">
        {/* Checkbox de seleção */}
        <label className="shrink-0 mt-1 cursor-pointer" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            disabled={s.is_below_cost}
            className="accent-cyan-400 w-3.5 h-3.5"
            title={s.is_below_cost ? t('card.belowCostNotSelectable') : t('card.selectForBulk')}
          />
        </label>

        {/* Status pill */}
        <div className="shrink-0 mt-0.5">
          {status && s.buy_box_status && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest"
              style={{ background: status.bg, color: status.color, border: `1px solid ${status.color}40` }}>
              <StatusIcon size={11} />
              {t(`status.${s.buy_box_status}`)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Item ID + ML link */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <Link href={`/dashboard/listings/items/${s.ml_item_id}`}
              className="font-mono text-zinc-200 font-semibold text-sm hover:text-cyan-400 transition-colors">
              {s.ml_item_id}
            </Link>
            <a href={`https://www.mercadolivre.com.br/${s.ml_item_id}`} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-zinc-500 hover:text-cyan-400 flex items-center gap-1">
              ML <ExternalLink size={9} />
            </a>
            {s.catalog_product_id && (
              <span className="text-[9px] text-purple-400 px-1.5 py-0.5 rounded border border-purple-400/30 flex items-center gap-1">
                <Star size={9} /> {t('card.catalog', { id: s.catalog_product_id })}
              </span>
            )}
          </div>

          {/* Preços */}
          <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">{t('card.current')}</span>
              <p className="text-zinc-100 font-bold text-base">{brl(s.current_price)}</p>
            </div>
            <span className="text-zinc-700">→</span>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">{t('card.suggested')}</span>
              <p className={`font-bold text-base ${s.is_below_cost ? 'text-rose-400' : 'text-emerald-400'}`}>
                {brl(s.suggested_price)}
              </p>
            </div>
            <span className={`text-xs font-bold ${s.price_difference_pct >= 5 ? 'text-amber-400' : 'text-zinc-500'}`}>
              {diffSign}{s.price_difference_pct.toFixed(1)}% ({brl(s.price_difference_brl)})
            </span>
          </div>

          {/* Métricas */}
          <div className="flex items-center gap-3 mt-2 text-[10px] flex-wrap">
            {visitColor && s.visit_share && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ color: visitColor, background: `${visitColor}10`, border: `1px solid ${visitColor}30` }}>
                <Eye size={9} /> {t(`visit.${s.visit_share}`)}
              </span>
            )}
            {s.competitors_sharing > 0 && (
              <span className="text-amber-400">⚔ {t('card.competitors', { count: s.competitors_sharing })}</span>
            )}
            {s.winner_item_id && s.winner_item_id !== s.ml_item_id && s.winner_price != null && (
              <span className="text-zinc-500">
                {t('card.winner')}: <span className="font-mono text-zinc-400">{s.winner_item_id}</span> {brl(s.winner_price)}
              </span>
            )}
            {s.internal_margin_at_suggested_pct != null && (
              <span className={s.is_below_min_margin ? 'text-amber-400' : 'text-zinc-500'}>
                {t('card.marginAtSuggested', { pct: s.internal_margin_at_suggested_pct.toFixed(1) })}
              </span>
            )}
          </div>

          {/* Razões */}
          {s.reason.length > 0 && (
            <p className="text-[10px] text-zinc-500 mt-1.5 italic">→ {s.reason.join(' · ')}</p>
          )}

          {/* Boosts */}
          {Object.values(s.boosts).some(Boolean) && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {s.boosts.fulfillment    && <BoostChip icon={<Package size={9} />}  label={t('boost.full')} />}
              {s.boosts.free_shipping  && <BoostChip icon={<Truck size={9} />}    label={t('boost.freeShipping')} />}
              {s.boosts.cross_docking  && <BoostChip icon={<Truck size={9} />}    label={t('boost.crossDocking')} />}
              {s.boosts.same_day_shipping && <BoostChip icon={<Truck size={9} />} label={t('boost.sameDay')} />}
              {s.boosts.free_installments && <BoostChip icon={<Star size={9} />}  label={t('boost.freeInstallments')} />}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="shrink-0 flex flex-col gap-1">
          <button
            onClick={() => onApply(s)}
            disabled={applying || s.is_below_cost}
            title={s.is_below_cost ? t('card.applyTitleBelowCost') : t('card.applyTitleSafe')}
            className="text-[10px] px-2.5 py-1.5 rounded font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#00E5FF', color: '#0d0d10' }}>
            {applying ? <RefreshCw size={10} className="animate-spin" /> : <Check size={10} />}
            {t('card.apply')}
          </button>
          {s.is_below_cost && (
            <button
              onClick={() => onApply(s, 'force')}
              disabled={applying}
              title={t('card.forceTitle')}
              className="text-[10px] px-2 py-1 rounded text-amber-400 hover:bg-zinc-800 transition-colors flex items-center gap-1">
              <AlertTriangle size={9} /> {t('card.force')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function BoostChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 text-cyan-300/80"
      style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
      {icon} {label}
    </span>
  )
}
