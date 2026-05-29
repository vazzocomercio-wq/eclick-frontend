'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle, CheckCircle2, Clock, RefreshCw, Wallet, XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 F2.5 — Dashboard de Comissões do Afiliado.
 *  Pending vs confirmed por canal + taxa de confirmação + saque mínimo R$30. */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const SHOPEE = '#EE4D2D'
const CYAN   = '#00E5FF'

interface ChannelAgg {
  channel:          string
  clicks:           number
  conversions:      number
  pending_cents:    number
  confirmed_cents:  number
  cancelled_cents:  number
  gmv_cents:        number
  conversion_rate:  number | null
}

interface Summary {
  totals: {
    pending_cents:     number
    confirmed_cents:   number
    cancelled_cents:   number
    pending_count:     number
    confirmed_count:   number
    cancelled_count:   number
    confirmation_rate: number | null
    withdrawable:      boolean
  }
  by_channel:         ChannelAgg[]
  min_withdraw_cents: number
}

export default function ShopeeCommissions() {
  const t = useTranslations('shopeeCommissions')
  const [data, setData]   = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee-affiliate/conversions/summary`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>
      <Header t={t} onRefresh={load} />
      {error && <ErrorBanner error={error} onRetry={load} t={t} />}
      {data === null && !error ? (
        <LoadingState />
      ) : !data || isEmpty(data) ? (
        <EmptyState t={t} />
      ) : (
        <>
          <SummaryCards data={data} t={t} />
          <ChannelTable channels={data.by_channel} t={t} />
        </>
      )}
    </div>
  )
}

function isEmpty(d: Summary): boolean {
  return d.totals.pending_count === 0 && d.totals.confirmed_count === 0 && d.totals.cancelled_count === 0
}

// ── Header ─────────────────────────────────────────────────────────────────

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

// ── Summary cards ──────────────────────────────────────────────────────────

function SummaryCards({ data, t }: { data: Summary; t: ReturnType<typeof useTranslations> }) {
  const tot = data.totals
  const rate = tot.confirmation_rate
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <BigCard icon={<Clock size={14} />} label={t('pending')} value={formatBRL(tot.pending_cents)} sub={t('nConv', { n: tot.pending_count })} accent="#fbbf24" />
      <BigCard icon={<CheckCircle2 size={14} />} label={t('confirmed')} value={formatBRL(tot.confirmed_cents)} sub={t('nConv', { n: tot.confirmed_count })} accent="#34d399" />
      <BigCard icon={<XCircle size={14} />} label={t('cancelled')} value={formatBRL(tot.cancelled_cents)} sub={t('nConv', { n: tot.cancelled_count })} accent="#f87171" />
      <BigCard
        icon={<Wallet size={14} />}
        label={t('confirmRate')}
        value={rate != null ? `${(rate * 100).toFixed(0)}%` : '—'}
        sub={tot.withdrawable ? t('withdrawable') : t('belowMin', { v: formatBRL(data.min_withdraw_cents) })}
        accent={CYAN}
        subColor={tot.withdrawable ? '#34d399' : '#a1a1aa'}
      />
    </div>
  )
}

function BigCard({ icon, label, value, sub, accent, subColor }: {
  icon: React.ReactNode; label: string; value: string; sub: string; accent: string; subColor?: string
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
        <span style={{ color: accent }}>{icon}</span>{label}
      </div>
      <p className="text-2xl font-black mt-1.5" style={{ color: accent }}>{value}</p>
      <p className="text-[10px] mt-1" style={{ color: subColor ?? '#52525b' }}>{sub}</p>
    </div>
  )
}

// ── Channel table ──────────────────────────────────────────────────────────

function ChannelTable({ channels, t }: { channels: ChannelAgg[]; t: ReturnType<typeof useTranslations> }) {
  if (channels.length === 0) return null
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="px-5 py-3 border-b" style={{ borderColor: '#1e1e24' }}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t('byChannel')}</h3>
      </div>
      <div className="divide-y" style={{ borderColor: '#1e1e24' }}>
        {/* header */}
        <div className="grid grid-cols-6 gap-2 px-5 py-2 text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">
          <span>{t('col.channel')}</span>
          <span className="text-right">{t('col.clicks')}</span>
          <span className="text-right">{t('col.conv')}</span>
          <span className="text-right">{t('col.rate')}</span>
          <span className="text-right">{t('col.pending')}</span>
          <span className="text-right">{t('col.confirmed')}</span>
        </div>
        {channels.map(c => (
          <div key={c.channel} className="grid grid-cols-6 gap-2 px-5 py-3 items-center" style={{ borderColor: '#1e1e24' }}>
            <span className="text-xs font-medium text-zinc-200 capitalize">{c.channel.replace('_', ' ')}</span>
            <span className="text-xs text-zinc-400 text-right">{c.clicks}</span>
            <span className="text-xs text-zinc-400 text-right">{c.conversions}</span>
            <span className="text-xs text-right" style={{ color: c.conversion_rate != null && c.conversion_rate > 0 ? CYAN : '#52525b' }}>
              {c.conversion_rate != null ? `${(c.conversion_rate * 100).toFixed(1)}%` : '—'}
            </span>
            <span className="text-xs text-right" style={{ color: c.pending_cents > 0 ? '#fbbf24' : '#52525b' }}>{formatBRL(c.pending_cents)}</span>
            <span className="text-xs font-semibold text-right" style={{ color: c.confirmed_cents > 0 ? '#34d399' : '#52525b' }}>{formatBRL(c.confirmed_cents)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── States ─────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: '#111114', border: '1px solid #1e1e24' }} />
        ))}
      </div>
      <div className="h-48 rounded-2xl animate-pulse" style={{ background: '#111114', border: '1px solid #1e1e24' }} />
    </div>
  )
}

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 rounded-2xl" style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>
        <Wallet size={20} />
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

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
