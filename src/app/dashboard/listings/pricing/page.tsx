'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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

const STATUS_META: Record<BuyBoxStatus, { label: string; color: string; bg: string; icon: typeof Award }> = {
  winning:              { label: 'Ganhando',          color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   icon: Award },
  losing:               { label: 'Perdendo',          color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: TrendingDown },
  sharing_first_place:  { label: 'Compartilhando',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: TrendingUp },
}

const VISIT_META: Record<string, { label: string; color: string }> = {
  maximum: { label: 'Máximo',  color: '#22c55e' },
  medium:  { label: 'Médio',   color: '#f59e0b' },
  low:     { label: 'Baixo',   color: '#ef4444' },
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function PricingPage() {
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
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

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
      toast({ message: e instanceof Error ? e.message : 'Erro ao carregar', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [getHeaders, filterStatus, minDiffPct, toast])

  useEffect(() => { load() }, [load])

  const runScan = async () => {
    const sellerId = getStoredSellerId()
    if (sellerId == null) {
      toast({ message: 'Selecione uma conta ML primeiro', tone: 'error' })
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
      toast({ message: `Scan pricing · ${result.items_scanned} anúncios analisados, +${result.tasks_created} tarefas`, tone: 'success' })
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro', tone: 'error' })
    } finally {
      setScanning(false)
    }
  }

  const bulkApply = async (mode: 'safe' | 'best_effort' | 'dry_run' = 'safe') => {
    const sellerId = getStoredSellerId()
    if (sellerId == null) { toast({ message: 'Selecione uma conta ML', tone: 'error' }); return }
    if (selected.size === 0) { toast({ message: 'Selecione pelo menos 1 anúncio', tone: 'warn' }); return }
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
          ? `Dry-run de ${selected.size} anúncios iniciado · ver progresso em /bulk`
          : `Aplicação em lote de ${selected.size} anúncios iniciada · ver progresso em /bulk`,
        tone: 'success',
      })
      setSelected(new Set())
      // Refresh em 5s pra capturar os primeiros aplicados
      setTimeout(() => { void load() }, 5000)
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro', tone: 'error' })
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
      toast({ message: 'Selecione uma conta', tone: 'error' })
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
            ? 'Preço abaixo do custo · use mode=force pra forçar'
            : body.skipped_reason === 'below_min_margin'
              ? 'Margem ficaria abaixo do mínimo · use mode=force'
              : `Aplicação pulada: ${body.skipped_reason}`,
          tone: 'warn',
        })
      } else {
        toast({ message: `Preço aplicado: ${brl(body.new_price)}`, tone: 'success' })
        await load()
      }
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro', tone: 'error' })
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
          <ChevronLeft size={12} /> Voltar para Listing Center
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Listing Center · Pricing IA</p>
            <h1 className="text-white text-3xl font-semibold">Inteligência de preço</h1>
            <p className="text-xs text-zinc-600 mt-1">
              {total > 0
                ? `${total} anúncio${total !== 1 ? 's' : ''} com sugestão`
                : 'Sem sugestões em cache. Rode o scan.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AccountSelector compact hideWhenEmpty />
            <button onClick={runScan} disabled={scanning}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#0d0d10' }}>
              <RefreshCw size={11} className={scanning ? 'animate-spin' : ''} /> Rodar scan pricing
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <section className="rounded-xl p-3 flex items-center gap-2 flex-wrap"
        style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <Filter size={12} className="text-zinc-500" />
        <span className="text-[11px] text-zinc-500 mr-1">Status Buy Box:</span>
        <FilterChip label="Todos"          active={filterStatus === ''}                    onClick={() => setFilterStatus('')} />
        <FilterChip label="Perdendo"        active={filterStatus === 'losing'}              onClick={() => setFilterStatus(filterStatus === 'losing' ? '' : 'losing')} color="#ef4444" />
        <FilterChip label="Compartilhando"  active={filterStatus === 'sharing_first_place'} onClick={() => setFilterStatus(filterStatus === 'sharing_first_place' ? '' : 'sharing_first_place')} color="#f59e0b" />
        <FilterChip label="Ganhando"        active={filterStatus === 'winning'}             onClick={() => setFilterStatus(filterStatus === 'winning' ? '' : 'winning')} color="#22c55e" />
        <span className="ml-3 text-[11px] text-zinc-500">Diferença ≥</span>
        <select value={minDiffPct} onChange={e => setMinDiffPct(Number(e.target.value))}
          className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-200">
          <option value={0}>Qualquer</option>
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
            Selecionar todos os elegíveis ({suggestions.filter(s => !s.is_below_cost).length})
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-xs text-cyan-400 font-bold">{selected.size} selecionado{selected.size !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={() => bulkApply('dry_run')} disabled={bulkApplying}
                  className="text-[11px] px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
                  Simular (dry-run)
                </button>
                <Link href="/dashboard/listings/bulk"
                  className="text-[11px] px-2.5 py-1.5 rounded-lg flex items-center"
                  style={{ background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
                  Histórico
                </Link>
                <button onClick={() => bulkApply('safe')} disabled={bulkApplying}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: '#00E5FF', color: '#0d0d10' }}>
                  {bulkApplying ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                  Aplicar em lote (mode=safe)
                </button>
              </div>
            </>
          )}
          {selected.size === 0 && (
            <Link href="/dashboard/listings/bulk"
              className="ml-auto text-[11px] px-2.5 py-1.5 rounded-lg flex items-center"
              style={{ background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
              Ver histórico de bulk
            </Link>
          )}
        </section>
      )}

      {/* Lista */}
      {loading ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-xs"
          style={{ background: '#111114', border: '1px solid #1a1a1f' }}>Carregando…</div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <Award size={32} className="text-zinc-700 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">Sem sugestões com esses filtros</p>
          <p className="text-zinc-600 text-xs mt-1">Tente rodar o scan ou limpar filtros</p>
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
  const status = s.buy_box_status ? STATUS_META[s.buy_box_status] : null
  const StatusIcon = status?.icon ?? Award
  const visit = s.visit_share ? VISIT_META[s.visit_share] : null
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
            title={s.is_below_cost ? 'Abaixo do custo — não selecionável' : 'Selecionar pra bulk apply'}
          />
        </label>

        {/* Status pill */}
        <div className="shrink-0 mt-0.5">
          {status && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest"
              style={{ background: status.bg, color: status.color, border: `1px solid ${status.color}40` }}>
              <StatusIcon size={11} />
              {status.label}
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
                <Star size={9} /> Catálogo {s.catalog_product_id}
              </span>
            )}
          </div>

          {/* Preços */}
          <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">Atual</span>
              <p className="text-zinc-100 font-bold text-base">{brl(s.current_price)}</p>
            </div>
            <span className="text-zinc-700">→</span>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">Sugerido</span>
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
            {visit && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ color: visit.color, background: `${visit.color}10`, border: `1px solid ${visit.color}30` }}>
                <Eye size={9} /> {visit.label}
              </span>
            )}
            {s.competitors_sharing > 0 && (
              <span className="text-amber-400">⚔ {s.competitors_sharing} competidor{s.competitors_sharing > 1 ? 'es' : ''}</span>
            )}
            {s.winner_item_id && s.winner_item_id !== s.ml_item_id && s.winner_price != null && (
              <span className="text-zinc-500">
                Vencedor: <span className="font-mono text-zinc-400">{s.winner_item_id}</span> {brl(s.winner_price)}
              </span>
            )}
            {s.internal_margin_at_suggested_pct != null && (
              <span className={s.is_below_min_margin ? 'text-amber-400' : 'text-zinc-500'}>
                Margem ao sugerido: {s.internal_margin_at_suggested_pct.toFixed(1)}%
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
              {s.boosts.fulfillment    && <BoostChip icon={<Package size={9} />}  label="Full" />}
              {s.boosts.free_shipping  && <BoostChip icon={<Truck size={9} />}    label="Frete grátis" />}
              {s.boosts.cross_docking  && <BoostChip icon={<Truck size={9} />}    label="Cross-docking" />}
              {s.boosts.same_day_shipping && <BoostChip icon={<Truck size={9} />} label="Same-day" />}
              {s.boosts.free_installments && <BoostChip icon={<Star size={9} />}  label="Sem juros" />}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="shrink-0 flex flex-col gap-1">
          <button
            onClick={() => onApply(s)}
            disabled={applying || s.is_below_cost}
            title={s.is_below_cost ? 'Sugestão abaixo do custo — usar Forçar' : 'Aplicar sugestão (mode=safe)'}
            className="text-[10px] px-2.5 py-1.5 rounded font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#00E5FF', color: '#0d0d10' }}>
            {applying ? <RefreshCw size={10} className="animate-spin" /> : <Check size={10} />}
            Aplicar
          </button>
          {s.is_below_cost && (
            <button
              onClick={() => onApply(s, 'force')}
              disabled={applying}
              title="Aplicar mesmo abaixo do custo"
              className="text-[10px] px-2 py-1 rounded text-amber-400 hover:bg-zinc-800 transition-colors flex items-center gap-1">
              <AlertTriangle size={9} /> Forçar
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
