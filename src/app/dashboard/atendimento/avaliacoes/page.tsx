'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, Star, CheckCircle2, X, Send, AlertCircle, Sparkles, MessageSquare, ShieldAlert,
  Settings2, Bot, ClipboardList,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type Review = {
  id:                 string
  platform:           string
  shop_id:            string | null
  external_review_id: string
  item_id:            string | null
  order_sn:           string | null
  buyer_username:     string | null
  rating:             number | null
  comment:            string | null
  media:              { image_url_list?: string[]; video_url_list?: string[] } | null
  reply_text:         string | null
  replied_at:         string | null
  editable:           string | null
  review_create_at:   string | null
  product_title:      string | null
  automation_status:  string | null
  sensitive_terms:    string[] | null
}

type CentralConfig = {
  autopilot_enabled:      boolean
  auto_reply_min_rating:  number
  auto_reply_window_days: number
  max_auto_per_hour:      number
  sensitive_words:        string[]
  notification_phone:     string | null
}

type PlatformFilter = 'all' | 'shopee' | 'mercadolivre'

const PLATFORM_LABEL: Record<string, string> = {
  shopee: 'Shopee', mercadolivre: 'Mercado Livre', tiktok_shop: 'TikTok',
}

type Kpis = {
  total: number
  media: number | null
  respondidas: number
  negativas_pendentes: number
  dist: Record<string, number>
}

type StarFilter = 0 | 1 | 2 | 3 | 4 | 5

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function Stars({ n, size = 13 }: { n: number | null; size?: number }) {
  const v = n ?? 0
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size}
          fill={i <= v ? (v <= 2 ? '#f87171' : v === 3 ? '#fcd34d' : '#fbbf24') : 'none'}
          color={i <= v ? (v <= 2 ? '#f87171' : v === 3 ? '#fcd34d' : '#fbbf24') : '#3f3f46'} />
      ))}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AvaliacoesPage() {
  const t = useTranslations('atendimento')
  const [reviews,   setReviews]   = useState<Review[]>([])
  const [kpis,      setKpis]      = useState<Kpis | null>(null)
  const [shops,     setShops]     = useState<Array<{ shop_id: string; nickname: string }>>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [syncing,   setSyncing]   = useState(false)
  const [starF,     setStarF]     = useState<StarFilter>(0)
  const [unreplied, setUnreplied] = useState(false)
  const [shopF,     setShopF]     = useState<string>('')
  const [platF,     setPlatF]     = useState<PlatformFilter>('all')
  const [selected,  setSelected]  = useState<Review | null>(null)
  const [configOpen, setConfigOpen] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  const getHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h = await getHeaders()
      if (!h) return
      const qs = new URLSearchParams()
      if (starF)     qs.set('rating', String(starF))
      if (unreplied) qs.set('unreplied', 'true')
      if (shopF)     qs.set('shop_id', shopF)
      if (platF !== 'all') qs.set('platform', platF)
      const res = await fetch(`${BACKEND}/shopee/reviews?${qs}`, { headers: h })
      if (res.ok) {
        const d = await res.json()
        setReviews(d?.reviews ?? [])
        setKpis(d?.kpis ?? null)
        setShops(d?.shops ?? [])
        setTotal(d?.total ?? 0)
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [getHeaders, starF, unreplied, shopF, platF])

  useEffect(() => { load() }, [load])

  const sync = async () => {
    setSyncing(true)
    try {
      const h = await getHeaders()
      if (!h) return
      await Promise.allSettled([
        fetch(`${BACKEND}/shopee/reviews/sync`, { method: 'POST', headers: h, body: JSON.stringify({}) }),
        fetch(`${BACKEND}/reviews/central/sync-ml`, { method: 'POST', headers: h }),
      ])
      await load()
    } catch { /* silent */ } finally {
      setSyncing(false)
    }
  }

  const shopName = useCallback((shopId: string | null) =>
    shops.find(s => s.shop_id === shopId)?.nickname ?? 'Shopee', [shops])

  const pctRespondidas = kpis && kpis.total > 0 ? Math.round((kpis.respondidas / kpis.total) * 100) : 0

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: 'var(--background)' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">{t('avaliacoes.eyebrow')}</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">{t('avaliacoes.pageTitle')}</h2>
          <p className="text-zinc-500 text-xs mt-1">{t('avaliacoes.pageSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all"
            style={{ borderColor: 'rgba(192,132,252,0.35)', color: '#c084fc' }}>
            <Bot size={13} />
            {t('avaliacoes.autopilot')}
          </button>
          <button onClick={sync} disabled={syncing || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
            style={{ borderColor: 'rgba(0,229,255,0.3)', color: '#00E5FF' }}>
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? t('avaliacoes.syncing') : t('avaliacoes.sync')}
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {t('avaliacoes.refresh')}
          </button>
        </div>
      </div>

      {/* Plataforma */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {([
          { key: 'all' as PlatformFilter,          label: t('avaliacoes.allPlatforms') },
          { key: 'shopee' as PlatformFilter,       label: 'Shopee' },
          { key: 'mercadolivre' as PlatformFilter, label: 'Mercado Livre' },
        ]).map(({ key, label }) => (
          <button key={key} onClick={() => { setPlatF(key); setShopF('') }}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              background: platF === key ? 'rgba(0,229,255,0.1)' : 'transparent',
              color:      platF === key ? '#00E5FF' : '#52525b',
              border:     `1px solid ${platF === key ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
            }}>
            {label}
          </button>
        ))}
        <span className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
          style={{ color: '#3f3f46', border: '1px dashed #1e1e24' }}>
          TikTok · {t('avaliacoes.comingSoon')}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 space-y-1" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{t('avaliacoes.kpi.media')}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold" style={{ color: '#fbbf24' }}>{loading ? '…' : (kpis?.media ?? '—')}</p>
            {!loading && kpis?.media != null && <Stars n={Math.round(kpis.media)} size={14} />}
          </div>
        </div>
        <div className="rounded-2xl p-4 space-y-1" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{t('avaliacoes.kpi.total')}</p>
          <p className="text-2xl font-bold text-zinc-300">{loading ? '…' : (kpis?.total ?? 0)}</p>
        </div>
        <div className="rounded-2xl p-4 space-y-1" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{t('avaliacoes.kpi.respondidas')}</p>
          <p className="text-2xl font-bold" style={{ color: pctRespondidas >= 50 ? '#4ade80' : '#a1a1aa' }}>
            {loading ? '…' : `${pctRespondidas}%`}
          </p>
        </div>
        <div className="rounded-2xl p-4 space-y-1" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{t('avaliacoes.kpi.negativasPendentes')}</p>
          <p className="text-2xl font-bold" style={{ color: (kpis?.negativas_pendentes ?? 0) > 0 ? '#f87171' : '#4ade80' }}>
            {loading ? '…' : (kpis?.negativas_pendentes ?? 0)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {([0, 5, 4, 3, 2, 1] as StarFilter[]).map(s => (
          <button key={s} onClick={() => setStarF(s)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1"
            style={{
              background: starF === s ? 'rgba(0,229,255,0.1)' : 'transparent',
              color:      starF === s ? '#00E5FF' : '#52525b',
              border:     `1px solid ${starF === s ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
            }}>
            {s === 0 ? t('avaliacoes.filter.all') : <>{s} <Star size={10} fill="currentColor" /></>}
            {s !== 0 && kpis?.dist?.[String(s)] != null && (
              <span className="text-[9px] opacity-70">({kpis.dist[String(s)]})</span>
            )}
          </button>
        ))}
        <span className="w-px h-5 bg-zinc-800 mx-1" />
        <button onClick={() => setUnreplied(v => !v)}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={{
            background: unreplied ? 'rgba(248,113,113,0.1)' : 'transparent',
            color:      unreplied ? '#f87171' : '#52525b',
            border:     `1px solid ${unreplied ? 'rgba(248,113,113,0.25)' : '#1e1e24'}`,
          }}>
          {t('avaliacoes.filter.unreplied')}
        </button>
        {shops.length > 1 && (
          <>
            <span className="w-px h-5 bg-zinc-800 mx-1" />
            <button onClick={() => setShopF('')}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                background: shopF === '' ? 'rgba(0,229,255,0.1)' : 'transparent',
                color:      shopF === '' ? '#00E5FF' : '#52525b',
                border:     `1px solid ${shopF === '' ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
              }}>
              {t('avaliacoes.filter.allShops')}
            </button>
            {shops.map(s => (
              <button key={s.shop_id} onClick={() => setShopF(s.shop_id)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: shopF === s.shop_id ? 'rgba(0,229,255,0.1)' : 'transparent',
                  color:      shopF === s.shop_id ? '#00E5FF' : '#52525b',
                  border:     `1px solid ${shopF === s.shop_id ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
                }}>
                🏬 {s.nickname}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600 text-xs">{t('avaliacoes.loading')}</div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Star size={32} className="text-zinc-700" />
          <p className="text-sm text-zinc-400">{t('avaliacoes.empty')}</p>
          <p className="text-xs text-zinc-600">{t('avaliacoes.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-600">{t('avaliacoes.showing', { n: reviews.length, total })}</p>
          {reviews.map(r => {
            const needsReply = !r.reply_text && (r.rating ?? 5) <= 3 && r.editable === 'EDITABLE'
            return (
              <button key={r.id} onClick={() => setSelected(r)}
                className="w-full text-left rounded-2xl p-4 transition-all hover:border-zinc-700 flex items-start gap-4"
                style={{
                  background: '#111114',
                  border: `1px solid ${needsReply ? 'rgba(248,113,113,0.3)' : '#1e1e24'}`,
                }}>
                <div className="flex-shrink-0 pt-0.5"><Stars n={r.rating} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 leading-snug truncate">
                    {r.comment ? `“${r.comment}”` : <span className="text-zinc-600 italic">{t('avaliacoes.noText')}</span>}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1 truncate">
                    {r.buyer_username ?? (r.platform === 'mercadolivre' ? t('avaliacoes.anonymous') : '—')}
                    {' · '}
                    {r.platform === 'shopee' ? <>🏬 {shopName(r.shop_id)}</> : (PLATFORM_LABEL[r.platform] ?? r.platform)}
                    {r.product_title && <> · {r.product_title}</>}
                  </p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <span className="text-[10px] text-zinc-600">{fmtDate(r.review_create_at)}</span>
                  {(r.sensitive_terms?.length ?? 0) > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(252,211,77,0.1)', color: '#fcd34d' }}>
                      ⚠️ {t('avaliacoes.sensitive')}
                    </span>
                  )}
                  {r.automation_status === 'auto_replied' ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                      style={{ background: 'rgba(192,132,252,0.1)', color: '#c084fc' }}>
                      <Bot size={9} /> {t('avaliacoes.autoReplied')}
                    </span>
                  ) : r.automation_status === 'task_created' ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                      style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>
                      <ClipboardList size={9} /> {t('avaliacoes.inFunnel')}
                    </span>
                  ) : null}
                  {r.reply_text ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                      {t('avaliacoes.replied')}
                    </span>
                  ) : needsReply ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                      {t('avaliacoes.needsReply')}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#00E5FF] flex items-center gap-1">
                      {t('avaliacoes.open')} <MessageSquare size={10} />
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <ReviewDrawer review={selected}
          shopName={selected.platform === 'shopee' ? shopName(selected.shop_id) : (PLATFORM_LABEL[selected.platform] ?? selected.platform)}
          onClose={() => setSelected(null)}
          onReplied={() => { setSelected(null); load() }}
          getHeaders={getHeaders} />
      )}
      {configOpen && (
        <ConfigDrawer onClose={() => setConfigOpen(false)} getHeaders={getHeaders} />
      )}
    </div>
  )
}

// ── Config do piloto automático ───────────────────────────────────────────────

function ConfigDrawer({ onClose, getHeaders }: {
  onClose: () => void
  getHeaders: () => Promise<Record<string, string> | null>
}) {
  const t = useTranslations('atendimento')
  const [cfg,     setCfg]     = useState<CentralConfig | null>(null)
  const [words,   setWords]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    (async () => {
      const h = await getHeaders()
      if (!h) return
      try {
        const res = await fetch(`${BACKEND}/reviews/central/config`, { headers: h })
        if (res.ok) {
          const d = await res.json()
          setCfg(d)
          setWords((d?.sensitive_words ?? []).join(', '))
        }
      } catch { /* silent */ }
    })()
  }, [getHeaders])

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    setError('')
    try {
      const h = await getHeaders()
      if (!h) return
      const res = await fetch(`${BACKEND}/reviews/central/config`, {
        method: 'PUT', headers: h,
        body: JSON.stringify({
          ...cfg,
          sensitive_words: words.split(',').map(w => w.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/60 z-40" />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[520px] bg-[#0a0a0c] border-l border-[#1e1e24] flex flex-col"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' }}>
        <div className="px-5 py-4 border-b border-[#1e1e24] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-[#c084fc]" />
            <p className="text-base font-semibold text-white">{t('avaliacoes.config.title')}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1"><X size={18} /></button>
        </div>

        {!cfg ? (
          <div className="flex-1 flex items-center justify-center text-xs text-zinc-600">{t('avaliacoes.loading')}</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Liga/desliga */}
            <button onClick={() => setCfg({ ...cfg, autopilot_enabled: !cfg.autopilot_enabled })}
              className="w-full rounded-xl p-4 flex items-center justify-between transition-all"
              style={{
                background: cfg.autopilot_enabled ? 'rgba(192,132,252,0.08)' : '#111114',
                border: `1px solid ${cfg.autopilot_enabled ? 'rgba(192,132,252,0.4)' : '#1e1e24'}`,
              }}>
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: cfg.autopilot_enabled ? '#c084fc' : '#a1a1aa' }}>
                  {t('avaliacoes.config.autopilot')}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{t('avaliacoes.config.autopilotHint')}</p>
              </div>
              <div className="w-10 h-5.5 rounded-full relative flex-shrink-0 transition-all"
                style={{ background: cfg.autopilot_enabled ? '#c084fc' : '#27272a', height: 22 }}>
                <div className="absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all"
                  style={{ width: 18, height: 18, left: cfg.autopilot_enabled ? 20 : 2 }} />
              </div>
            </button>

            {/* Regras */}
            <div className="rounded-xl p-4 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{t('avaliacoes.config.positiveRules')}</p>
              <div>
                <p className="text-xs text-zinc-400 mb-1.5">{t('avaliacoes.config.minRating')}</p>
                <div className="flex gap-1.5">
                  {[4, 5].map(n => (
                    <button key={n} onClick={() => setCfg({ ...cfg, auto_reply_min_rating: n })}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                      style={{
                        background: cfg.auto_reply_min_rating === n ? 'rgba(0,229,255,0.1)' : 'transparent',
                        color: cfg.auto_reply_min_rating === n ? '#00E5FF' : '#52525b',
                        border: `1px solid ${cfg.auto_reply_min_rating === n ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
                      }}>
                      ≥ {n} <Star size={10} fill="currentColor" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-400 mb-1.5">{t('avaliacoes.config.windowDays')}</p>
                  <input type="number" min={1} max={90} value={cfg.auto_reply_window_days}
                    onChange={e => setCfg({ ...cfg, auto_reply_window_days: Number(e.target.value) })}
                    className="w-full bg-[#09090b] border border-[#1e1e24] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-[#00E5FF44]" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1.5">{t('avaliacoes.config.maxPerHour')}</p>
                  <input type="number" min={1} max={100} value={cfg.max_auto_per_hour}
                    onChange={e => setCfg({ ...cfg, max_auto_per_hour: Number(e.target.value) })}
                    className="w-full bg-[#09090b] border border-[#1e1e24] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-[#00E5FF44]" />
                </div>
              </div>
            </div>

            {/* Negativas */}
            <div className="rounded-xl p-4 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{t('avaliacoes.config.negativeRules')}</p>
              <p className="text-[11px] text-zinc-500">{t('avaliacoes.config.negativeHint')}</p>
              <div>
                <p className="text-xs text-zinc-400 mb-1.5">{t('avaliacoes.config.phone')}</p>
                <input type="text" placeholder="+55 11 99999-9999" value={cfg.notification_phone ?? ''}
                  onChange={e => setCfg({ ...cfg, notification_phone: e.target.value })}
                  className="w-full bg-[#09090b] border border-[#1e1e24] rounded-lg p-2 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-[#00E5FF44]" />
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1.5">{t('avaliacoes.config.sensitiveWords')}</p>
                <textarea value={words} onChange={e => setWords(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#1e1e24] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF44] resize-y min-h-[70px]" />
                <p className="text-[10px] text-zinc-600 mt-1">{t('avaliacoes.config.sensitiveHint')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-[#1e1e24] flex items-center justify-between flex-shrink-0">
          <div className="text-[10px]">
            {error && <span className="text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {error}</span>}
            {saved && <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={11} /> {t('avaliacoes.config.saved')}</span>}
          </div>
          <button onClick={save} disabled={saving || !cfg}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #00E5FF 0%, #00b8cc 100%)', color: '#000' }}>
            {saving ? t('avaliacoes.config.saving') : t('avaliacoes.config.save')}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function ReviewDrawer({ review, shopName, onClose, onReplied, getHeaders }: {
  review: Review
  shopName: string
  onClose: () => void
  onReplied: () => void
  getHeaders: () => Promise<Record<string, string> | null>
}) {
  const t = useTranslations('atendimento')
  const [reply,      setReply]      = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [sending,    setSending]    = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error,      setError]      = useState('')

  const photos = review.media?.image_url_list ?? []
  const canReply = review.platform === 'shopee' && !review.reply_text && review.editable === 'EDITABLE'

  const suggest = async () => {
    setSuggesting(true)
    setError('')
    try {
      const h = await getHeaders()
      if (!h) return
      const res = await fetch(`${BACKEND}/shopee/reviews/${review.id}/suggest`, { method: 'POST', headers: h })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      if (d?.text) setReply(d.text)
    } catch {
      setError(t('avaliacoes.suggestFailed'))
    } finally {
      setSuggesting(false)
    }
  }

  const send = async () => {
    if (!confirming) { setConfirming(true); return }
    setSending(true)
    setError('')
    try {
      const h = await getHeaders()
      if (!h) return
      const res = await fetch(`${BACKEND}/shopee/reviews/${review.id}/reply`, {
        method: 'POST', headers: h, body: JSON.stringify({ text: reply.trim() }),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt.slice(0, 180) || `HTTP ${res.status}`)
      }
      onReplied()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('avaliacoes.replyFailed'))
      setConfirming(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/60 z-40" />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[600px] bg-[#0a0a0c] border-l border-[#1e1e24] flex flex-col"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1e1e24] flex items-start justify-between gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Stars n={review.rating} size={16} />
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">🏬 {shopName}</span>
              {review.editable !== 'EDITABLE' && !review.reply_text && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(161,161,170,0.1)', color: '#a1a1aa' }}>
                  {t('avaliacoes.expired')}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400">
              {review.buyer_username ?? '—'} · {fmtDate(review.review_create_at)}
              {review.order_sn && <> · {review.order_sn}</>}
            </p>
            {review.product_title && <p className="text-xs text-zinc-500 mt-1 truncate">{review.product_title}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="rounded-xl p-4" style={{ background: '#0e0e11', border: '1px solid #1e1e24' }}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('avaliacoes.buyerSaid')}</p>
            <p className="text-sm text-zinc-200 mt-2 leading-relaxed whitespace-pre-wrap">
              {review.comment ? `“${review.comment}”` : <span className="text-zinc-600 italic">{t('avaliacoes.noText')}</span>}
            </p>
          </div>

          {photos.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">{t('avaliacoes.photos')}</p>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full aspect-square rounded-lg object-cover border border-zinc-800 hover:border-zinc-600 transition-all" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {review.reply_text && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.25)' }}>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: '#4ade80' }}>{t('avaliacoes.yourReply')}</p>
              <p className="text-sm text-zinc-200 mt-2 leading-relaxed whitespace-pre-wrap">{review.reply_text}</p>
            </div>
          )}

          {review.platform === 'mercadolivre' && (
            <div className="rounded-xl p-3 text-[11px] text-zinc-500" style={{ background: '#0e0e11', border: '1px solid #1e1e24' }}>
              {t('avaliacoes.mlNoReply')}
            </div>
          )}
        </div>

        {/* Composer */}
        {canReply && (
          <div className="p-4 border-t border-[#1e1e24] flex-shrink-0 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <ShieldAlert size={11} className="text-amber-400" />
              {t('avaliacoes.publicWarning')}
            </div>
            <textarea
              value={reply}
              onChange={e => { setReply(e.target.value); setError(''); setConfirming(false) }}
              placeholder={t('avaliacoes.replyPlaceholder')}
              maxLength={500}
              disabled={sending}
              className="w-full bg-[#09090b] border border-[#1e1e24] rounded-lg p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#00E5FF44] resize-y min-h-[90px] disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px]">
                {error && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertCircle size={11} /> {error}
                  </span>
                )}
                <span className="text-zinc-600">{reply.length}/500</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={suggest} disabled={suggesting || sending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-40"
                  style={{ borderColor: 'rgba(0,229,255,0.3)', color: '#00E5FF' }}>
                  <Sparkles size={12} className={suggesting ? 'animate-pulse' : ''} />
                  {suggesting ? t('avaliacoes.suggesting') : t('avaliacoes.suggest')}
                </button>
                <button onClick={send} disabled={sending || !reply.trim() || reply.length < 5}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: confirming
                      ? 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, #00E5FF 0%, #00b8cc 100%)',
                    color: confirming ? '#fff' : '#000',
                  }}>
                  {sending ? <RefreshCw size={13} className="animate-spin" /> : confirming ? <CheckCircle2 size={13} /> : <Send size={13} />}
                  {sending ? t('avaliacoes.publishing') : confirming ? t('avaliacoes.confirmPublish') : t('avaliacoes.publish')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
