'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, Minus, RefreshCw,
  TrendingUp, Tag, Truck, Star,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 F1.5 — Radar Shopee (READ-ONLY).
 *  3 seções: tendências, preço benchmark líder, FBS adoption por categoria. */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN   = '#00E5FF'
const SHOPEE = '#EE4D2D'

type SignalType = 'trending' | 'price_benchmark' | 'fbs_adoption'

interface Signal {
  id:               string
  signal_type:      SignalType
  category_id:      number
  category_name:    string | null
  item_id:          number | null
  metric_value:     number
  payload: {
    summary?: string
    trend?:   'up' | 'down' | 'flat'
    delta?:   number
    leader?: {
      shop_id?:    number
      title?:      string
      price_cents: number
      rating?:     number | null
      is_fbs?:     boolean
    }
    fbs?:  { count: number; total: number }
    top?:  Array<{ item_id?: number; title?: string; estimated_sales_7d?: number }>
  }
  captured_at:      string
}

interface RadarData {
  trending:        Signal[]
  price_benchmark: Signal[]
  fbs_adoption:    Signal[]
}

export default function ShopeeRadar() {
  const t = useTranslations('shopeeRadar')
  const [data, setData]   = useState<RadarData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/radar/signals`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError((e as Error).message)
      setData({ trending: [], price_benchmark: [], fbs_adoption: [] })
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>
      <Header onRefresh={load} t={t} />
      {error && <ErrorBanner error={error} onRetry={load} t={t} />}
      {data === null && !error ? (
        <LoadingState />
      ) : isEmpty(data) ? (
        <EmptyState t={t} />
      ) : (
        <div className="space-y-6">
          <Section title={t('section.trending')} icon={<TrendingUp size={14} />} accent={CYAN}>
            {data!.trending.length === 0 ? (
              <SectionEmpty t={t} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {data!.trending.map(s => <TrendingCard key={s.id} signal={s} t={t} />)}
              </div>
            )}
          </Section>

          <Section title={t('section.price_benchmark')} icon={<Tag size={14} />} accent="#fbbf24">
            {data!.price_benchmark.length === 0 ? (
              <SectionEmpty t={t} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {data!.price_benchmark.map(s => <PriceBenchmarkCard key={s.id} signal={s} t={t} />)}
              </div>
            )}
          </Section>

          <Section title={t('section.fbs_adoption')} icon={<Truck size={14} />} accent="#34d399">
            {data!.fbs_adoption.length === 0 ? (
              <SectionEmpty t={t} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {data!.fbs_adoption.map(s => <FbsCard key={s.id} signal={s} t={t} />)}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

function isEmpty(d: RadarData | null): boolean {
  if (!d) return false
  return d.trending.length === 0 && d.price_benchmark.length === 0 && d.fbs_adoption.length === 0
}

// ── Header ─────────────────────────────────────────────────────────────────

function Header({ onRefresh, t }: { onRefresh: () => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-zinc-500 text-xs">{t('breadcrumb')}</p>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <div>
        <h2 className="text-white text-lg font-semibold">{t('title')}</h2>
        <p className="text-zinc-500 text-xs">{t('subtitle')}</p>
      </div>
      <button
        onClick={onRefresh}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
        style={{ borderColor: '#2e2e33', color: '#a1a1aa', background: '#111114' }}
      >
        <RefreshCw size={12} />
        {t('refresh')}
      </button>
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────

function Section({ title, icon, accent, children }: {
  title:    string
  icon:     React.ReactNode
  accent:   string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}15`, color: accent }}>{icon}</div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function SectionEmpty({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
      <p className="text-[11px] text-zinc-600">{t('sectionEmpty')}</p>
    </div>
  )
}

// ── Trending Card ──────────────────────────────────────────────────────────

function TrendingCard({ signal, t }: { signal: Signal; t: ReturnType<typeof useTranslations> }) {
  const trend = signal.payload.trend ?? 'flat'
  const delta = signal.payload.delta
  const tColor = trend === 'up' ? '#34d399' : trend === 'down' ? '#f87171' : '#71717a'
  const TIcon  = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus
  return (
    <div className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">{t('label.category')}</p>
          <p className="text-sm font-semibold text-zinc-100 truncate mt-0.5">{signal.category_name ?? `#${signal.category_id}`}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t('label.score')}</p>
          <p className="text-xl font-black leading-none mt-0.5" style={{ color: CYAN }}>{Math.round(signal.metric_value)}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        <TIcon size={12} style={{ color: tColor }} />
        <span className="text-xs font-semibold" style={{ color: tColor }}>
          {delta != null ? `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(0)}%` : '—'}
        </span>
        <span className="text-[10px] text-zinc-500">{t('label.vs7d')}</span>
      </div>

      {signal.payload.summary && (
        <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{signal.payload.summary}</p>
      )}

      {signal.payload.top && signal.payload.top.length > 0 && (
        <div className="mt-3 pt-3 space-y-1.5 border-t" style={{ borderColor: '#1e1e24' }}>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t('label.topItems')}</p>
          {signal.payload.top.slice(0, 3).map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 w-3">{i + 1}.</span>
              <p className="text-[11px] text-zinc-300 flex-1 truncate">{it.title}</p>
              {it.estimated_sales_7d != null && (
                <span className="text-[10px] text-zinc-500 shrink-0">{it.estimated_sales_7d}<span className="text-zinc-600">/7d</span></span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Price Benchmark Card ───────────────────────────────────────────────────

function PriceBenchmarkCard({ signal, t }: { signal: Signal; t: ReturnType<typeof useTranslations> }) {
  const leader = signal.payload.leader
  return (
    <div className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">{t('label.category')}</p>
          <p className="text-sm font-semibold text-zinc-100 truncate mt-0.5">{signal.category_name ?? `#${signal.category_id}`}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t('label.leaderPrice')}</p>
          <p className="text-xl font-black leading-none mt-0.5" style={{ color: '#fbbf24' }}>{formatBRL(signal.metric_value)}</p>
        </div>
      </div>
      {leader && (
        <div className="rounded-lg p-2.5" style={{ background: '#18181b', border: '1px solid #27272a' }}>
          {leader.title && (
            <p className="text-[11px] text-zinc-300 truncate mb-1">{leader.title}</p>
          )}
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            {leader.rating != null && (
              <span className="flex items-center gap-1">
                <Star size={10} className="text-amber-400 fill-amber-400" />
                {leader.rating.toFixed(1)}
              </span>
            )}
            {leader.is_fbs && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>
                FBS
              </span>
            )}
            {leader.shop_id && <span className="text-zinc-600 truncate">shop #{leader.shop_id}</span>}
          </div>
        </div>
      )}
      {signal.payload.summary && (
        <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{signal.payload.summary}</p>
      )}
    </div>
  )
}

// ── FBS Adoption Card ──────────────────────────────────────────────────────

function FbsCard({ signal, t }: { signal: Signal; t: ReturnType<typeof useTranslations> }) {
  const pct  = signal.metric_value
  const fbs  = signal.payload.fbs
  const aColor = pct >= 0.6 ? '#34d399' : pct >= 0.4 ? '#fbbf24' : '#71717a'
  return (
    <div className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">{t('label.category')}</p>
      <p className="text-sm font-semibold text-zinc-100 truncate mt-0.5">{signal.category_name ?? `#${signal.category_id}`}</p>
      <div className="flex items-end gap-2 mt-3">
        <p className="text-3xl font-black leading-none" style={{ color: aColor }}>{(pct * 100).toFixed(0)}%</p>
        {fbs && (
          <p className="text-[10px] text-zinc-500 mb-1">{fbs.count}/{fbs.total} top sellers</p>
        )}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: '#18181b' }}>
        <div className="h-full transition-all" style={{ width: `${pct * 100}%`, background: aColor }} />
      </div>
      {signal.payload.summary && (
        <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{signal.payload.summary}</p>
      )}
    </div>
  )
}

// ── States ─────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="h-5 w-32 rounded animate-pulse mb-3" style={{ background: '#18181b' }} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-32 rounded-2xl animate-pulse"
                style={{ background: '#111114', border: '1px solid #1e1e24' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 rounded-2xl"
      style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <p className="text-sm font-semibold text-zinc-300">{t('empty.title')}</p>
      <p className="text-xs text-zinc-500 text-center max-w-md">{t('empty.desc')}</p>
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

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
