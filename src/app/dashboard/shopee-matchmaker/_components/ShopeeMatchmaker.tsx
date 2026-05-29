'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertCircle, BarChart3, Check, DollarSign, Handshake, Loader2, RefreshCw,
  Search, Store, TrendingUp, Users, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 F4.2 — A Ponte: marketplace dois-lados. Tab Afiliados (vendedor
 *  rankeia + propõe) + tab Propostas (afiliado aceita/recusa). */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN = '#00E5FF'
const SHOPEE = '#EE4D2D'

interface MatchBreakdown {
  score: number
  components: { niche_fit: number; reach: number; channel_fit: number; history: number }
  reasons: string[]
}
interface RankedAffiliate {
  affiliate_id:   string
  display_name:   string | null
  niches:         string[]
  channels:       string[]
  reach_estimate: number
  match:          MatchBreakdown
}
interface MatchOffer {
  id:                      string
  item_id:                 number
  affiliate_name:          string | null
  proposed_commission_pct: number
  match_score:             number
  status:                  string
  created_at:              string
}

type Tab = 'affiliates' | 'offers' | 'metrics'

export default function ShopeeMatchmaker() {
  const t = useTranslations('shopeeMatchmaker')
  const [tab, setTab] = useState<Tab>('affiliates')
  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      <Header t={t} />
      <div className="flex items-center gap-1.5">
        <TabBtn active={tab === 'affiliates'} onClick={() => setTab('affiliates')} icon={<Users size={13} />} label={t('tab.affiliates')} />
        <TabBtn active={tab === 'metrics'} onClick={() => setTab('metrics')} icon={<BarChart3 size={13} />} label={t('tab.metrics')} />
        <TabBtn active={tab === 'offers'}     onClick={() => setTab('offers')}     icon={<Handshake size={13} />} label={t('tab.offers')} />
      </div>
      {tab === 'affiliates' ? <AffiliatesTab t={t} /> : tab === 'metrics' ? <MetricsTab t={t} /> : <OffersTab t={t} />}
    </div>
  )
}

// ── Tab: Métricas da Ponte (north-star) ──────────────────────────────────────

interface PonteMetrics {
  matches:     { total: number; active: number; open: number; active_affiliates: number; avg_match_score: number | null; acceptance_rate: number | null }
  gmv:         { confirmed_cents: number; pending_cents: number; total_cents: number }
  commission:  { confirmed_cents: number; pending_cents: number }
  conversions: { confirmed: number; pending: number }
}

function MetricsTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [m, setM]       = useState<PonteMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/matchmaker/metrics`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setM(await res.json())
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { void load() }, [load])

  if (error) return <Banner msg={t('error', { msg: error })} />
  if (!m) return <Skel />

  return (
    <div className="space-y-5">
      {/* North-star hero */}
      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(238,77,45,0.06))', border: '1px solid #1e2a30' }}>
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">{t('metrics.northStar')}</p>
        <p className="text-4xl font-black mt-1" style={{ color: CYAN }}>{formatBRL(m.gmv.total_cents)}</p>
        <p className="text-xs text-zinc-500 mt-1">{t('metrics.gmvHint', { confirmed: formatBRL(m.gmv.confirmed_cents), pending: formatBRL(m.gmv.pending_cents) })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric icon={<Handshake size={14} />} label={t('metrics.activeMatches')} value={String(m.matches.active)} sub={t('metrics.ofTotal', { n: m.matches.total })} accent="#34d399" />
        <Metric icon={<Users size={14} />} label={t('metrics.activeAffiliates')} value={String(m.matches.active_affiliates)} sub={t('metrics.openOffers', { n: m.matches.open })} accent="#a78bfa" />
        <Metric icon={<DollarSign size={14} />} label={t('metrics.commissionConfirmed')} value={formatBRL(m.commission.confirmed_cents)} sub={t('metrics.pendingComm', { v: formatBRL(m.commission.pending_cents) })} accent="#fbbf24" />
        <Metric icon={<TrendingUp size={14} />} label={t('metrics.avgMatch')} value={m.matches.avg_match_score != null ? String(m.matches.avg_match_score) : '—'} sub={m.matches.acceptance_rate != null ? t('metrics.acceptRate', { p: (m.matches.acceptance_rate * 100).toFixed(0) }) : '—'} accent={CYAN} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric icon={<Check size={14} />} label={t('metrics.convConfirmed')} value={String(m.conversions.confirmed)} sub="" accent="#34d399" />
        <Metric icon={<RefreshCw size={14} />} label={t('metrics.convPending')} value={String(m.conversions.pending)} sub="" accent="#fbbf24" />
      </div>

      <p className="text-[10px] text-zinc-600 text-center">{t('metrics.attributionNote')}</p>
    </div>
  )
}

function Metric({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
        <span style={{ color: accent }}>{icon}</span><span className="truncate">{label}</span>
      </div>
      <p className="text-xl font-black mt-1.5" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function Header({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black"
        style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>SH</div>
      <div>
        <h2 className="text-white text-lg font-semibold">{t('title')}</h2>
        <p className="text-zinc-500 text-xs">{t('subtitle')}</p>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: active ? CYAN + '18' : '#111114', color: active ? CYAN : '#a1a1aa', border: `1px solid ${active ? CYAN + '55' : '#1e1e24'}` }}>
      {icon}{label}
    </button>
  )
}

// ── Tab: Afiliados (vendedor rankeia + propõe) ───────────────────────────────

function AffiliatesTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [niche, setNiche]   = useState('iluminacao')
  const [list, setList]     = useState<RankedAffiliate[] | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [proposeFor, setProposeFor] = useState<RankedAffiliate | null>(null)

  const load = useCallback(async (n: string) => {
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/matchmaker/affiliates?niche=${encodeURIComponent(n)}&category=${encodeURIComponent(n)}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setList(await res.json())
    } catch (e) { setError((e as Error).message); setList([]) }
  }, [])

  useEffect(() => { void load(niche) }, [load, niche])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input value={niche} onChange={e => setNiche(e.target.value)}
            placeholder={t('nichePlaceholder')}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs text-zinc-300 placeholder:text-zinc-600"
            style={{ background: '#111114', border: '1px solid #1e1e24', outline: 'none' }} />
        </div>
        <p className="text-[11px] text-zinc-600">{t('rankHint')}</p>
      </div>

      {error && <Banner msg={t('error', { msg: error })} />}
      {list === null && !error ? <Skel /> : list?.length === 0 ? (
        <Empty t={t} which="affiliates" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list?.map(a => <AffiliateCard key={a.affiliate_id} aff={a} t={t} onPropose={() => setProposeFor(a)} />)}
        </div>
      )}

      {proposeFor && (
        <ProposeModal affiliate={proposeFor} niche={niche} t={t}
          onClose={() => setProposeFor(null)} />
      )}
    </div>
  )
}

function AffiliateCard({ aff, t, onPropose }: { aff: RankedAffiliate; t: ReturnType<typeof useTranslations>; onPropose: () => void }) {
  const m = aff.match
  return (
    <div className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100 truncate">{aff.display_name ?? '—'}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{formatReach(aff.reach_estimate)} · {aff.channels.join(', ')}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t('match')}</p>
          <p className="text-2xl font-black leading-none mt-0.5" style={{ color: matchColor(m.score) }}>{m.score}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {aff.niches.map(n => (
          <span key={n} className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>{n}</span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5 mt-3">
        <Comp label={t('comp.niche')}   v={m.components.niche_fit} />
        <Comp label={t('comp.reach')}   v={m.components.reach} />
        <Comp label={t('comp.channel')} v={m.components.channel_fit} />
        <Comp label={t('comp.history')} v={m.components.history} />
      </div>
      {m.reasons[0] && <p className="text-[11px] text-zinc-400 mt-3 line-clamp-2">{m.reasons[0]}</p>}
      <button onClick={onPropose}
        className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all"
        style={{ background: `${CYAN}15`, color: CYAN, border: `1px solid ${CYAN}40` }}>
        <Handshake size={12} />{t('propose')}
      </button>
    </div>
  )
}

function ProposeModal({ affiliate, niche, t, onClose }: { affiliate: RankedAffiliate; niche: string; t: ReturnType<typeof useTranslations>; onClose: () => void }) {
  const [itemId, setItemId] = useState(1001)
  const [commission, setCommission] = useState(12)
  const [done, setDone]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const submit = async () => {
    setLoading(true); setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/matchmaker/offers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller_shop_id: 999990001, item_id: itemId,
          affiliate_profile_id: affiliate.affiliate_id,
          proposed_commission_pct: commission / 100,
          niche, category: niche,
        }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message ?? `HTTP ${res.status}`) }
      setDone(true)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-sm rounded-2xl p-6" style={{ background: '#0f0f13', border: '1px solid #1e1e24' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-white font-semibold">{t('proposeTitle')}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        {done ? (
          <div className="text-center py-4">
            <Check size={28} className="mx-auto text-emerald-400" />
            <p className="text-sm text-emerald-300 font-semibold mt-2">{t('proposeSent')}</p>
            <p className="text-[11px] text-zinc-500 mt-1">{t('proposeSentHint', { name: affiliate.display_name ?? '' })}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg text-xs border" style={{ borderColor: '#2e2e33', color: '#a1a1aa' }}>{t('done')}</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-zinc-400 mb-3">{t('proposeTo', { name: affiliate.display_name ?? '' })}</p>
            <label className="text-[11px] text-zinc-500">{t('itemId')}</label>
            <input type="number" value={itemId} onChange={e => setItemId(Number(e.target.value) || 0)}
              className="w-full mt-1 mb-3 px-3 py-2 rounded-lg text-sm text-zinc-200" style={{ background: '#0a0a0e', border: '1px solid #1e1e24', outline: 'none' }} />
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-zinc-500">{t('commission')}</label>
              <span className="text-xs font-semibold" style={{ color: CYAN }}>{commission}%</span>
            </div>
            <input type="range" min={1} max={30} value={commission} onChange={e => setCommission(Number(e.target.value))} className="w-full mt-1" style={{ accentColor: CYAN }} />
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            <button onClick={submit} disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: CYAN, color: '#08080a' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Handshake size={14} />}{t('sendPropose')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Tab: Propostas (afiliado responde) ───────────────────────────────────────

function OffersTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [offers, setOffers] = useState<MatchOffer[] | null>(null)
  const [error, setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/matchmaker/offers`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setOffers(await res.json())
    } catch (e) { setError((e as Error).message); setOffers([]) }
  }, [])

  useEffect(() => { void load() }, [load])

  const respond = async (id: string, action: 'accept' | 'decline') => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    await fetch(`${BACKEND}/shopee/matchmaker/offers/${id}/respond`, {
      method: 'POST', headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    void load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-600">{t('offersHint')}</p>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: '#2e2e33', color: '#a1a1aa', background: '#111114' }}>
          <RefreshCw size={12} />{t('refresh')}
        </button>
      </div>
      {error && <Banner msg={t('error', { msg: error })} />}
      {offers === null && !error ? <Skel /> : offers?.length === 0 ? (
        <Empty t={t} which="offers" />
      ) : (
        <div className="space-y-2">
          {offers?.map(o => (
            <div key={o.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="text-center shrink-0">
                <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">{t('match')}</p>
                <p className="text-xl font-black" style={{ color: matchColor(o.match_score) }}>{o.match_score}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate">{o.affiliate_name ?? '—'}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {t('item')} #{o.item_id} · {t('commission')} {(o.proposed_commission_pct * 100).toFixed(0)}%
                </p>
              </div>
              <StatusPill status={o.status} t={t} />
              {o.status === 'open' && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => respond(o.id, 'accept')} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.35)' }}>{t('accept')}</button>
                  <button onClick={() => respond(o.id, 'decline')} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>{t('decline')}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusPill({ status, t }: { status: string; t: ReturnType<typeof useTranslations> }) {
  const c = status === 'accepted' || status === 'active' ? '#34d399' : status === 'declined' ? '#f87171' : status === 'open' ? CYAN : '#71717a'
  return <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${c}1a`, color: c }}>{t(`status.${status}`)}</span>
}

// ── shared ───────────────────────────────────────────────────────────────────

function Comp({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 font-semibold truncate">{label}</p>
      <div className="h-1 rounded-full overflow-hidden mt-1" style={{ background: '#18181b' }}>
        <div className="h-full" style={{ width: `${v}%`, background: matchColor(v) }} />
      </div>
    </div>
  )
}
function Banner({ msg }: { msg: string }) {
  return <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}><AlertCircle size={14} className="text-red-400" /><p className="text-xs text-red-300">{msg}</p></div>
}
function Skel() {
  return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: '#111114', border: '1px solid #1e1e24' }} />)}</div>
}
function Empty({ t, which }: { t: ReturnType<typeof useTranslations>; which: 'affiliates' | 'offers' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 rounded-2xl" style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}>
        {which === 'affiliates' ? <Users size={20} /> : <Store size={20} />}
      </div>
      <p className="text-sm font-semibold text-zinc-300">{t(`empty.${which}.title`)}</p>
      <p className="text-xs text-zinc-500 text-center max-w-md">{t(`empty.${which}.desc`)}</p>
    </div>
  )
}

function matchColor(s: number): string {
  if (s >= 80) return '#34d399'
  if (s >= 60) return CYAN
  if (s >= 40) return '#fbbf24'
  return '#f87171'
}
function formatReach(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(n)
}
function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
