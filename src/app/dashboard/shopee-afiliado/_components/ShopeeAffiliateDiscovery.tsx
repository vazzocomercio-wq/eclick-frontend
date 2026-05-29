'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle, Ban, Link2, RefreshCw, Star, TrendingUp, Store, Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 F2.3 — Discovery do lado Afiliado.
 *  Ofertas ranqueadas por Opportunity Score (comissão × conversão ×
 *  reputação × trend). Excluídas (nota<4.5 / seller fraco) ficam visíveis
 *  só com toggle, marcadas como armadilha. */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const SHOPEE = '#EE4D2D'
const CYAN   = '#00E5FF'

interface OpportunityBreakdown {
  score:    number
  components: { commission: number; conversion: number; seller: number; trend: number }
  excluded: boolean
  exclude_reason: string | null
  conv_estimate: number
}

interface Offer {
  item_id:         number
  shop_id:         number | null
  name:            string | null
  category:        string | null
  price_cents:     number | null
  commission_rate: number
  rating:          number | null
  sales_volume:    number | null
  seller_score:    number | null
  opportunity:     OpportunityBreakdown
  fetched_at:      string
}

export default function ShopeeAffiliateDiscovery() {
  const t = useTranslations('shopeeAffiliate')
  const [offers, setOffers]   = useState<Offer[] | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [showExcluded, setShowExcluded] = useState(false)

  const load = useCallback(async (includeExcluded: boolean) => {
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(
        `${BACKEND}/shopee-affiliate/offers?include_excluded=${includeExcluded}&limit=100`,
        { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json() as { items: Offer[]; total: number }
      setOffers(body.items ?? [])
    } catch (e) {
      setError((e as Error).message)
      setOffers([])
    }
  }, [])

  useEffect(() => { void load(showExcluded) }, [load, showExcluded])

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      <Header t={t} onRefresh={() => load(showExcluded)} />
      <Toolbar t={t} showExcluded={showExcluded} onToggleExcluded={setShowExcluded} />
      {error && <ErrorBanner error={error} onRetry={() => load(showExcluded)} t={t} />}
      {offers === null && !error ? (
        <LoadingState />
      ) : offers?.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {offers?.map(o => <OfferCard key={o.item_id} offer={o} t={t} />)}
        </div>
      )}
    </div>
  )
}

// ── Header / Toolbar ─────────────────────────────────────────────────────

function Header({ t, onRefresh }: { t: ReturnType<typeof useTranslations>; onRefresh: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-zinc-500 text-xs">{t('breadcrumb')}</p>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <div>
        <h2 className="text-white text-lg font-semibold">{t('title')}</h2>
        <p className="text-zinc-500 text-xs">{t('subtitle')}</p>
      </div>
      <button onClick={onRefresh}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
        style={{ borderColor: '#2e2e33', color: '#a1a1aa', background: '#111114' }}>
        <RefreshCw size={12} />{t('refresh')}
      </button>
    </div>
  )
}

function Toolbar({ t, showExcluded, onToggleExcluded }: {
  t: ReturnType<typeof useTranslations>; showExcluded: boolean; onToggleExcluded: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onToggleExcluded(!showExcluded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{
          background: showExcluded ? 'rgba(248,113,113,0.12)' : '#111114',
          color:      showExcluded ? '#f87171' : '#a1a1aa',
          border:     `1px solid ${showExcluded ? 'rgba(248,113,113,0.3)' : '#1e1e24'}`,
        }}>
        <Ban size={12} />
        {t('toggleExcluded')}
      </button>
      <p className="text-[11px] text-zinc-600">{t('rankHint')}</p>
    </div>
  )
}

// ── Offer Card ─────────────────────────────────────────────────────────────

function OfferCard({ offer, t }: { offer: Offer; t: ReturnType<typeof useTranslations> }) {
  const opp = offer.opportunity
  const excluded = opp.excluded
  return (
    <div className="rounded-2xl p-4 flex flex-col" style={{
      background: '#111114',
      border: `1px solid ${excluded ? 'rgba(248,113,113,0.25)' : '#1e1e24'}`,
      opacity: excluded ? 0.85 : 1,
    }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">{offer.category ?? '—'}</p>
          <p className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-tight mt-0.5">
            {offer.name ?? `Item ${offer.item_id}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t('opportunity')}</p>
          {excluded ? (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
              <Ban size={10} />{t('excluded')}
            </span>
          ) : (
            <p className="text-2xl font-black leading-none mt-0.5" style={{ color: oppColor(opp.score) }}>{opp.score}</p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Stat icon={<Zap size={11} />}   label={t('commission')} value={`${(offer.commission_rate * 100).toFixed(0)}%`} color="#a78bfa" />
        <Stat icon={<Star size={11} />}  label={t('rating')}     value={offer.rating != null ? offer.rating.toFixed(1) : '—'} color="#fbbf24" />
        <Stat icon={<Store size={11} />} label={t('seller')}     value={offer.seller_score != null ? String(offer.seller_score) : '—'} color={CYAN} />
      </div>

      {/* Components (só se não excluída) */}
      {!excluded && (
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          <CompBar label={t('comp.commission')} value={opp.components.commission} />
          <CompBar label={t('comp.conversion')} value={opp.components.conversion} />
          <CompBar label={t('comp.seller')}     value={opp.components.seller} />
          <CompBar label={t('comp.trend')}      value={opp.components.trend} />
        </div>
      )}

      {/* Exclude reason */}
      {excluded && opp.exclude_reason && (
        <div className="mt-3 rounded-lg p-2.5 flex items-start gap-2"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-red-200 leading-relaxed">{opp.exclude_reason}</p>
        </div>
      )}

      {/* Footer: link button (Link Studio F2.4 — stub por ora) */}
      <div className="mt-auto pt-3">
        <button
          disabled={excluded}
          title={excluded ? t('cantLink') : t('genLinkSoon')}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: excluded ? '#18181b' : `${CYAN}15`, color: excluded ? '#52525b' : CYAN, border: `1px solid ${excluded ? '#27272a' : CYAN + '40'}` }}>
          <Link2 size={12} />
          {t('genLink')}
        </button>
      </div>
    </div>
  )
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
        <span style={{ color }}>{icon}</span><span className="truncate">{label}</span>
      </div>
      <p className="text-sm font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  )
}

function CompBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 font-semibold truncate">{label}</p>
      <div className="h-1 rounded-full overflow-hidden mt-1" style={{ background: '#18181b' }}>
        <div className="h-full" style={{ width: `${value}%`, background: oppColor(value) }} />
      </div>
      <p className="text-[9px] text-zinc-500 mt-0.5">{value}</p>
    </div>
  )
}

// ── States ─────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-52 rounded-2xl animate-pulse" style={{ background: '#111114', border: '1px solid #1e1e24' }} />
      ))}
    </div>
  )
}

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 rounded-2xl" style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>
        <TrendingUp size={20} />
      </div>
      <p className="text-sm font-semibold text-zinc-300">{t('empty.title')}</p>
      <p className="text-xs text-zinc-500 text-center max-w-md">{t('empty.desc')}</p>
    </div>
  )
}

function ErrorBanner({ error, onRetry, t }: { error: string; onRetry: () => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
      <AlertCircle size={14} className="text-red-400" />
      <p className="text-xs text-red-300 flex-1">{t('error', { msg: error })}</p>
      <button onClick={onRetry} className="text-xs text-red-300 underline">{t('retry')}</button>
    </div>
  )
}

function oppColor(s: number): string {
  if (s >= 80) return '#34d399'
  if (s >= 60) return CYAN
  if (s >= 40) return '#fbbf24'
  return '#f87171'
}
