'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle, ChevronRight, RefreshCw, Search, Sparkles, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 F1.2 — Listing Center Shopee.
 *  Consome GET /shopee/listings/scores (backend) e mostra grid + drawer
 *  de detalhe com Algorithm Score 4 pilares + issues priorizadas. */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN   = '#00E5FF'
const SHOPEE = '#EE4D2D'

type Pillar = 'relevance' | 'performance' | 'seller_quality' | 'price_marketing'
type Severity = 'high' | 'medium' | 'low'

interface Issue {
  pillar:              Pillar
  code:                string
  severity:            Severity
  description:         string
  recommended_action:  string
  current_value?:      number | string
  target_value?:       number | string
}

interface ListingCard {
  shop_id:         number
  item_id:         number
  product_id:      string | null
  title:           string | null
  main_image_url:  string | null
  score:           number
  pillars: {
    relevance:        number
    performance:      number
    seller_quality:   number
    price_marketing:  number
  }
  top_issues:      Issue[]
  total_issues:    number
  computed_at:     string
}

export default function ShopeeListingsCenter() {
  const t = useTranslations('catalogo.shopeeListingCenter')
  const [items, setItems]       = useState<ListingCard[] | null>(null)
  const [total, setTotal]       = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<ListingCard | null>(null)
  const [query, setQuery]       = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/listings/scores?limit=50`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json() as { items: ListingCard[]; total: number }
      setItems(body.items ?? [])
      setTotal(body.total ?? 0)
    } catch (e) {
      setError((e as Error).message)
      setItems([])
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = (items ?? []).filter(it =>
    !query || (it.title ?? '').toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>
      <Header total={total} onRefresh={load} />
      <Toolbar query={query} onQuery={setQuery} t={t} />
      {error && <ErrorBanner error={error} onRetry={load} t={t} />}
      {items === null && !error ? (
        <LoadingState t={t} />
      ) : filtered.length === 0 ? (
        <EmptyState t={t} hasQuery={!!query} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(it => (
            <Card key={`${it.shop_id}:${it.item_id}`} card={it} onClick={() => setSelected(it)} t={t} />
          ))}
        </div>
      )}
      {selected && (
        <Drawer card={selected} onClose={() => setSelected(null)} t={t} />
      )}
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function Header({ total, onRefresh }: { total: number; onRefresh: () => void }) {
  const t = useTranslations('catalogo.shopeeListingCenter')
  return (
    <div className="flex items-center gap-3">
      <p className="text-zinc-500 text-xs">{t('breadcrumb')}</p>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <div>
        <h2 className="text-white text-lg font-semibold">{t('title')}</h2>
        <p className="text-zinc-500 text-xs">{t('subtitle', { total })}</p>
      </div>
      <button
        onClick={onRefresh}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
        style={{ borderColor: '#2e2e33', color: '#a1a1aa', background: '#111114' }}
        aria-label={t('refresh')}
      >
        <RefreshCw size={12} />
        {t('refresh')}
      </button>
    </div>
  )
}

function Toolbar({ query, onQuery, t }: { query: string; onQuery: (s: string) => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
        <input
          type="text"
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full pl-9 pr-3 py-2 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600"
          style={{ background: '#111114', border: '1px solid #1e1e24', outline: 'none' }}
        />
      </div>
    </div>
  )
}

function Card({ card, onClick, t }: { card: ListingCard; onClick: () => void; t: ReturnType<typeof useTranslations> }) {
  const sColor = scoreColor(card.score)
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl p-4 transition-all hover:bg-[#15151a]"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}
    >
      <div className="flex gap-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0"
          style={{ background: '#18181b', border: '1px solid #27272a' }}>
          {card.main_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.main_image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">SH</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-zinc-600">#{card.item_id}</p>
          <p className="text-sm font-semibold text-zinc-200 line-clamp-2 leading-tight mt-0.5">
            {card.title ?? `Item ${card.item_id}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t('score')}</p>
          <p className="text-2xl font-black leading-none mt-1" style={{ color: sColor }}>
            {card.score}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-3">
        <PillarBar value={card.pillars.relevance}        label={t('pillar.relevance.short')}        weight={40} />
        <PillarBar value={card.pillars.performance}      label={t('pillar.performance.short')}      weight={30} />
        <PillarBar value={card.pillars.seller_quality}   label={t('pillar.seller_quality.short')}   weight={20} />
        <PillarBar value={card.pillars.price_marketing}  label={t('pillar.price_marketing.short')}  weight={10} />
      </div>
      {card.top_issues.length > 0 && (
        <div className="mt-3 pt-3 border-t flex items-start gap-2" style={{ borderColor: '#1e1e24' }}>
          <AlertCircle size={12} style={{ color: severityColor(card.top_issues[0].severity) }} className="mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-zinc-400 line-clamp-1">{card.top_issues[0].description}</p>
            {card.total_issues > 1 && (
              <p className="text-[10px] text-zinc-600 mt-0.5">
                {t('moreIssues', { n: card.total_issues - 1 })}
              </p>
            )}
          </div>
          <ChevronRight size={14} className="text-zinc-600 shrink-0" />
        </div>
      )}
    </button>
  )
}

function PillarBar({ value, label, weight }: { value: number; label: string; weight: number }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{label}</span>
        <span className="text-[9px] text-zinc-500">{weight}%</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: '#18181b' }}>
        <div className="h-full transition-all" style={{
          width: `${value}%`,
          background: scoreColor(value),
        }} />
      </div>
      <p className="text-[10px] text-zinc-400 mt-0.5">{value}</p>
    </div>
  )
}

function Drawer({ card, onClose, t }: { card: ListingCard; onClose: () => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-md h-full overflow-y-auto"
        style={{ background: '#0f0f13', borderLeft: '1px solid #1e1e24' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">{t('drawer.eyebrow')}</p>
              <h3 className="text-white font-semibold mt-1 leading-tight">{card.title ?? `Item ${card.item_id}`}</h3>
              <p className="text-xs text-zinc-500 mt-1">#{card.item_id} · {t('drawer.shop')} {card.shop_id}</p>
            </div>
            <button onClick={onClose} aria-label={t('drawer.close')} className="text-zinc-500 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {card.main_image_url && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#18181b', border: '1px solid #27272a' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.main_image_url} alt="" className="w-full aspect-square object-cover" />
            </div>
          )}

          <div className="rounded-2xl p-5 text-center" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">{t('drawer.totalScore')}</p>
            <p className="text-5xl font-black mt-1" style={{ color: scoreColor(card.score) }}>{card.score}</p>
            <p className="text-[10px] text-zinc-500 mt-1">/100</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">{t('drawer.pillars')}</h4>
            {(['relevance','performance','seller_quality','price_marketing'] as Pillar[]).map(p => (
              <PillarRow
                key={p}
                value={card.pillars[p]}
                label={t(`pillar.${p}.label`)}
                desc={t(`pillar.${p}.desc`)}
                weight={pillarWeight(p)}
              />
            ))}
          </div>

          {card.top_issues.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                {t('drawer.issues', { n: card.total_issues })}
              </h4>
              {card.top_issues.map((iss, i) => (
                <IssueCard key={`${iss.code}-${i}`} issue={iss} t={t} />
              ))}
              {card.total_issues > card.top_issues.length && (
                <p className="text-[10px] text-zinc-600 text-center pt-1">
                  {t('drawer.moreHidden', { n: card.total_issues - card.top_issues.length })}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl p-5 text-center" style={{ background: '#0d1812', border: '1px solid #1a2e22' }}>
              <Sparkles size={16} className="mx-auto" style={{ color: '#34d399' }} />
              <p className="text-xs font-semibold text-emerald-300 mt-2">{t('drawer.noIssues')}</p>
              <p className="text-[10px] text-emerald-500 mt-0.5">{t('drawer.noIssuesHint')}</p>
            </div>
          )}

          <p className="text-[10px] text-zinc-600 text-center">
            {t('drawer.computedAt', { d: new Date(card.computed_at).toLocaleString('pt-BR') })}
          </p>
        </div>
      </div>
    </div>
  )
}

function PillarRow({ value, label, desc, weight }: { value: number; label: string; desc: string; weight: number }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-zinc-200">{label}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{desc}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black leading-none" style={{ color: scoreColor(value) }}>{value}</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">{weight}%</p>
        </div>
      </div>
      <div className="h-1 rounded-full overflow-hidden mt-2" style={{ background: '#0d0d10' }}>
        <div className="h-full transition-all" style={{ width: `${value}%`, background: scoreColor(value) }} />
      </div>
    </div>
  )
}

function IssueCard({ issue, t }: { issue: Issue; t: ReturnType<typeof useTranslations> }) {
  const color = severityColor(issue.severity)
  return (
    <div className="rounded-xl p-3" style={{ background: '#18181b', border: `1px solid ${color}33` }}>
      <div className="flex items-start gap-2">
        <AlertCircle size={14} style={{ color }} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
              style={{ background: `${color}1a`, color }}>{t(`severity.${issue.severity}`)}</span>
            <span className="text-[10px] text-zinc-500">{t(`pillar.${issue.pillar}.short`)}</span>
          </div>
          <p className="text-xs text-zinc-200 mt-1.5">{issue.description}</p>
          <p className="text-[11px] text-zinc-400 mt-1.5">
            <span className="text-zinc-500">{t('drawer.action')}: </span>
            {issue.recommended_action}
          </p>
          {issue.current_value != null && issue.target_value != null && (
            <p className="text-[10px] text-zinc-600 mt-1">
              {t('drawer.current')}: <span className="text-zinc-400">{issue.current_value}</span> · {t('drawer.target')}: <span className="text-zinc-400">{issue.target_value}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl p-4 h-40 animate-pulse"
          style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <p className="sr-only">{t('loading')}</p>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ t, hasQuery }: { t: ReturnType<typeof useTranslations>; hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 rounded-2xl"
      style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <p className="text-sm font-semibold text-zinc-300">
        {hasQuery ? t('empty.searchTitle') : t('empty.title')}
      </p>
      <p className="text-xs text-zinc-500 text-center max-w-md">
        {hasQuery ? t('empty.searchDesc') : t('empty.desc')}
      </p>
    </div>
  )
}

function ErrorBanner({ error, onRetry, t }: { error: string; onRetry: () => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
      <AlertCircle size={14} className="text-red-400" />
      <p className="text-xs text-red-300 flex-1">{t('error', { msg: error })}</p>
      <button onClick={onRetry} className="text-xs text-red-300 underline">{t('retry')}</button>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 80) return '#34d399'  // emerald
  if (s >= 60) return CYAN        // cyan = "ok"
  if (s >= 40) return '#fbbf24'  // amber
  return '#f87171'                // red
}

function severityColor(sev: Severity): string {
  if (sev === 'high')   return '#f87171'
  if (sev === 'medium') return '#fbbf24'
  return '#71717a'
}

function pillarWeight(p: Pillar): number {
  if (p === 'relevance')        return 40
  if (p === 'performance')      return 30
  if (p === 'seller_quality')   return 20
  return 10
}
