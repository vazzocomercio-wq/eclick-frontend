'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { brl, PM } from '../types'
import { isAIEnabled, getAIPreference } from '@/lib/ai/config'
import { AISelector, AIBadge } from '@/components/ai/AISelector'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  ArrowLeft, RefreshCw, Sparkles, TrendingDown, TrendingUp,
  Star, Eye, Package, Truck, ExternalLink, X, BarChart2, Loader2,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricePoint { price: number; available_quantity: number; sold_quantity: number; checked_at: string }

interface SellerReputation {
  level_id: string | null
  power_seller_status: string | null
  transactions?: { total: number; ratings?: { positive: number; negative: number; neutral: number } }
}

interface MlSeller {
  id: number
  nickname: string
  registration_date?: string
  seller_reputation?: SellerReputation
}

interface MlData {
  id?: string
  title?: string
  price?: number
  available_quantity?: number
  sold_quantity?: number
  thumbnail?: string
  pictures?: Array<{ url: string; secure_url?: string }>
  seller?: MlSeller
  shipping?: { free_shipping: boolean; tags?: string[] }
  listing_type_id?: string
  permalink?: string
  date_created?: string
  visits_30d?: number
  description?: string
  rating?: number
  reviews_total?: number
  enriched_at?: string
}

interface Competitor {
  id: string
  product_id: string
  platform: string
  url: string
  listing_id: string | null
  title: string | null
  seller: string | null
  seller_nickname: string | null
  seller_reputation: string | null
  current_price: number | null
  my_price: number | null
  photo_url: string | null
  status: 'active' | 'paused'
  last_checked: string | null
  enriched_at: string | null
  created_at: string
  // fields saved on every refresh
  available_quantity: number | null
  sold_quantity: number | null
  rating: number | null
  reviews_total: number | null
  visits_30d: number | null
  listing_type: string | null
  free_shipping: boolean | null
  price_history: PricePoint[]
  ml_data?: MlData
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await createClient().auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

function pct(a: number | null, b: number | null): number | null {
  if (!a || !b || b === 0) return null
  return ((a - b) / b) * 100
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function reputationLabel(levelId: string | null | undefined): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    '1_red':         { label: 'Vermelho',    color: '#ef4444' },
    '2_orange':      { label: 'Laranja',     color: '#f97316' },
    '3_yellow':      { label: 'Amarelo',     color: '#f59e0b' },
    '4_light_green': { label: 'Verde claro', color: '#84cc16' },
    '5_green':       { label: 'Verde',       color: '#22c55e' },
  }
  return map[levelId ?? ''] ?? { label: 'Sem dados', color: '#6b7280' }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = '#a1a1aa' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] uppercase tracking-wider font-medium truncate" style={{ color: '#71717a' }}>{label}</span>
      </div>
      <p className="text-[15px] font-bold leading-tight" style={{ color: '#e4e4e7' }}>{value}</p>
      {sub && <p className="text-[10px] truncate" style={{ color: '#52525b' }}>{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#52525b' }}>{title}</p>
      {children}
    </div>
  )
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)' }} onClick={onClose}>
      <button className="absolute top-4 right-4 p-2 rounded-full" style={{ background: '#1a1a1f', color: '#a1a1aa' }}>
        <X size={18} />
      </button>
      <img src={src} alt="" className="max-w-3xl max-h-[85vh] rounded-xl object-contain"
        onClick={e => e.stopPropagation()} />
    </div>
  )
}

function ChartTooltipContent({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: '#111114', border: '1px solid #27272a' }}>
      <p className="text-[11px] mb-1.5" style={{ color: '#71717a' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-[12px] font-medium" style={{ color: p.color }}>
          {p.name}: {brl(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompetitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const [competitor, setCompetitor] = useState<Competitor | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lightbox, setLightbox]     = useState<string | null>(null)
  const [period, setPeriod]         = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [iaText, setIaText]         = useState<string | null>(null)
  const [iaProvider, setIaProvider] = useState(() => getAIPreference().provider)
  const [iaModel,    setIaModel]    = useState(() => getAIPreference().model)
  const [iaBadge,    setIaBadge]    = useState<{ provider: string; model: string } | null>(null)
  const [loadingIA, setLoadingIA]   = useState(false)
  const [aiEnabled]                 = useState(() => isAIEnabled('analise_concorrencia'))

  const load = useCallback(async (withRefresh = false): Promise<Competitor | null> => {
    if (withRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const h = await authHeaders()
      const endpoint = withRefresh
        ? `${BACKEND}/competitors/${id}/refresh`
        : `${BACKEND}/competitors/${id}`
      console.log('[competitor-detail] fetching', endpoint)
      const res = await fetch(endpoint, { headers: h })
      console.log('[competitor-detail] status', res.status)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[competitor-detail] error body', body)
        throw new Error(`HTTP ${res.status}`)
      }
      const data: Competitor = await res.json()
      console.log('[competitor-detail] loaded id', data.id)
      setCompetitor(data)
      return data
    } catch (e) { console.error('[competitor-detail]', e); return null }
    finally { setLoading(false); setRefreshing(false) }
  }, [id])

  useEffect(() => {
    const init = async () => {
      const data = await load(false)
      if (!data) return
      const stale = !data.enriched_at ||
        (Date.now() - new Date(data.enriched_at).getTime()) > 6 * 60 * 60 * 1000
      if (stale) load(true)
    }
    init()
  }, [load])

  // ── Derived ───────────────────────────────────────────────────────────────

  // Merge stored-enriched fields with live ml_data (ml_data takes precedence)
  const ml: MlData = {
    available_quantity: competitor?.available_quantity ?? undefined,
    sold_quantity:      competitor?.sold_quantity ?? undefined,
    rating:             competitor?.rating ?? undefined,
    reviews_total:      competitor?.reviews_total ?? undefined,
    visits_30d:         competitor?.visits_30d ?? undefined,
    listing_type_id:    competitor?.listing_type ?? undefined,
    shipping:           competitor?.free_shipping != null
      ? { free_shipping: competitor.free_shipping }
      : undefined,
    ...competitor?.ml_data,
  }
  const history = competitor?.price_history ?? []

  const filteredHistory = (() => {
    if (period === 'all') return history
    const ms: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
    const cutoff = Date.now() - (ms[period] ?? 30) * 86400000
    return history.filter(h => new Date(h.checked_at).getTime() >= cutoff)
  })()

  const chartData = [...filteredHistory]
    .sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
    .map(h => ({
      date:        fmtShort(h.checked_at),
      concorrente: h.price,
      meuPreco:    competitor?.my_price ?? 0,
    }))

  const currentPrice = competitor?.current_price ?? ml.price ?? null
  const myPrice      = competitor?.my_price ?? null
  const diffPct      = pct(currentPrice, myPrice)
  const diffAbs      = currentPrice != null && myPrice != null ? currentPrice - myPrice : null

  const daysSince = ml.date_created
    ? Math.max(1, (Date.now() - new Date(ml.date_created).getTime()) / 86400000) : 30
  const estimatedMonthlySales = Math.round(((ml.sold_quantity ?? 0) / daysSince) * 30)

  const priceMin = history.length ? Math.min(...history.map(h => h.price)) : currentPrice
  const priceMax = history.length ? Math.max(...history.map(h => h.price)) : currentPrice

  const sortedHistory = [...history].sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())
  const priceChanges  = sortedHistory.map((h, i) => {
    const prev      = sortedHistory[i + 1]
    const change    = prev ? h.price - prev.price : 0
    const changePct = prev ? (change / prev.price) * 100 : 0
    return { ...h, change, changePct }
  })

  const insights: string[] = []
  if (diffPct !== null) {
    if (diffPct < 0) insights.push(`📉 Concorrente ${Math.abs(diffPct).toFixed(1)}% mais barato que você`)
    else             insights.push(`💚 Você está ${diffPct.toFixed(1)}% mais barato que este concorrente`)
  }
  const weekAgo = sortedHistory.find(h => new Date(h.checked_at).getTime() < Date.now() - 7 * 86400000)
  if (weekAgo && currentPrice) {
    const wkChg = ((currentPrice - weekAgo.price) / weekAgo.price) * 100
    if (Math.abs(wkChg) > 0.5)
      insights.push(`${wkChg < 0 ? '📉' : '📈'} Preço ${wkChg < 0 ? 'caiu' : 'subiu'} ${Math.abs(wkChg).toFixed(1)}% esta semana`)
  }
  if ((ml.available_quantity ?? 0) > 50)  insights.push('📦 Estoque alto — sem pressão de ruptura')
  else if ((ml.available_quantity ?? 0) > 0) insights.push('⚠️ Estoque baixo — possível ruptura em breve')
  if ((ml.rating ?? 0) >= 4.5)            insights.push(`⭐ Avaliação ${ml.rating?.toFixed(1)} — acima da média`)
  else if ((ml.rating ?? 0) > 0)          insights.push(`⭐ Avaliação ${ml.rating?.toFixed(1)} — abaixo da média`)
  if ((ml.visits_30d ?? 0) > 0)           insights.push(`👁 ${ml.visits_30d} visitas nos últimos 30 dias`)
  if (ml.shipping?.free_shipping)         insights.push('🚚 Frete grátis — vantagem competitiva importante')

  // ── AI ────────────────────────────────────────────────────────────────────

  const generateIA = async () => {
    if (!competitor) return
    setLoadingIA(true)
    try {
      const prompt = `
Analise este concorrente no Mercado Livre e forneça insights estratégicos:

Produto concorrente: ${competitor.title ?? ml.title ?? 'N/A'}
Preço atual: R$ ${currentPrice?.toFixed(2) ?? 'N/A'}
Meu preço: R$ ${myPrice?.toFixed(2) ?? 'N/A'}
Diferença: ${diffAbs != null ? `R$ ${diffAbs.toFixed(2)} (${diffPct?.toFixed(1)}%)` : 'N/A'}
Estoque: ${ml.available_quantity ?? 'N/A'} unidades
Vendas estimadas/mês: ${estimatedMonthlySales}
Avaliação: ${ml.rating?.toFixed(1) ?? 'N/A'}/5 (${ml.reviews_total ?? 0} avaliações)
Visitas 30d: ${ml.visits_30d ?? 0}
Frete grátis: ${ml.shipping?.free_shipping ? 'Sim' : 'Não'}
Tipo de anúncio: ${ml.listing_type_id ?? 'N/A'}
Variação de preço: de R$ ${priceMin?.toFixed(2) ?? 'N/A'} até R$ ${priceMax?.toFixed(2) ?? 'N/A'}

Forneça:
1. Avaliação da posição competitiva (estou ganhando ou perdendo?)
2. Estratégia de preço recomendada
3. Pontos fortes e fracos do concorrente
4. Oportunidades detectadas
5. Ações recomendadas para os próximos 7 dias

Seja direto, prático e específico para o mercado brasileiro de e-commerce.
Máximo 350 palavras, use emojis para facilitar a leitura.`

      const res = await fetch('/api/ia/completar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature:      'analise_concorrencia',
          prompt,
          systemPrompt: 'Você é um especialista em estratégia competitiva para e-commerce no Brasil, especialmente Mercado Livre e Shopee.',
          provider:     iaProvider,
          model:        iaModel,
        }),
      })
      const data = await res.json() as { content?: string; error?: string; provider?: string; model?: string }
      setIaText(data.content ?? `Erro: ${data.error ?? 'Resposta vazia'}`)
      if (data.provider && data.model) setIaBadge({ provider: data.provider, model: data.model })
    } finally { setLoadingIA(false) }
  }

  // ── Skeleton / not found ──────────────────────────────────────────────────

  if (loading && !competitor) {
    return (
      <div className="p-6 space-y-4 animate-pulse" style={{ background: '#09090b', minHeight: '100%' }}>
        <div className="h-5 w-36 rounded" style={{ background: '#111114' }} />
        <div className="h-32 rounded-2xl" style={{ background: '#111114' }} />
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl" style={{ background: '#111114' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!competitor) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-full" style={{ background: '#09090b' }}>
        <p className="text-sm" style={{ color: '#a1a1aa' }}>Concorrente não encontrado</p>
        <Link href="/dashboard/concorrentes" className="text-[13px] font-medium" style={{ color: '#00E5FF' }}>
          ← Voltar
        </Link>
      </div>
    )
  }

  const pm  = PM[competitor.platform] ?? { label: competitor.platform, bg: '#27272a', fg: '#a1a1aa' }
  const rep = reputationLabel(ml.seller?.seller_reputation?.level_id ?? competitor.seller_reputation)

  return (
    <div style={{ background: '#09090b', minHeight: '100%', padding: '20px 24px 40px' }}>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* Back + actions */}
      <div className="flex items-center justify-between mb-5">
        <Link href="/dashboard/concorrentes" className="flex items-center gap-1.5 text-[13px]"
          style={{ color: '#71717a' }}>
          <ArrowLeft size={14} /> Concorrentes
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
            style={{ background: '#111114', border: '1px solid #1a1a1f', color: '#a1a1aa' }}>
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando…' : 'Atualizar dados'}
          </button>
          {aiEnabled && (
            <AISelector compact onSelect={(p, m) => { setIaProvider(p); setIaModel(m) }} />
          )}
          <button onClick={generateIA} disabled={loadingIA}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF' }}>
            {loadingIA ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {loadingIA ? 'Analisando…' : 'Analisar com IA'}
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <div className="flex gap-4">
          <button
            className="shrink-0 w-20 h-20 rounded-xl overflow-hidden"
            style={{ background: '#18181b', border: '1px solid #1a1a1f' }}
            onClick={() => {
              const src = ml.pictures?.[0]?.secure_url ?? ml.pictures?.[0]?.url ?? competitor.photo_url
              if (src) setLightbox(src)
            }}>
            {(competitor.photo_url ?? ml.thumbnail) && (
              <img src={competitor.photo_url ?? ml.thumbnail} alt="" className="w-full h-full object-cover" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: pm.bg, color: pm.fg }}>{pm.label}</span>
              {ml.shipping?.free_shipping && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
                  Frete grátis
                </span>
              )}
              {ml.listing_type_id === 'gold_pro' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.2)', color: '#eab308' }}>
                  Premium
                </span>
              )}
            </div>

            <h1 className="text-[14px] font-semibold leading-snug mb-3 line-clamp-2" style={{ color: '#e4e4e7' }}>
              {competitor.title ?? ml.title ?? '—'}
            </h1>

            <div className="flex items-end gap-6 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#71717a' }}>Preço concorrente</p>
                <p className="text-[22px] font-bold" style={{ color: '#00E5FF' }}>{brl(currentPrice)}</p>
              </div>
              {myPrice != null && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#71717a' }}>Meu preço</p>
                  <p className="text-[22px] font-bold" style={{ color: '#e4e4e7' }}>{brl(myPrice)}</p>
                </div>
              )}
              {diffPct !== null && (
                <div className="pb-0.5">
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#71717a' }}>Diferença</p>
                  <div className="flex items-center gap-1.5">
                    {diffPct > 0
                      ? <TrendingDown size={14} color="#22c55e" />
                      : <TrendingUp size={14} color="#ef4444" />}
                    <span className="text-[15px] font-bold" style={{ color: diffPct > 0 ? '#22c55e' : '#ef4444' }}>
                      {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                    </span>
                    <span className="text-[12px]" style={{ color: '#71717a' }}>
                      ({diffAbs != null && diffAbs > 0 ? '+' : ''}{brl(diffAbs)})
                    </span>
                  </div>
                </div>
              )}
              {ml.permalink && (
                <a href={ml.permalink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] pb-1"
                  style={{ color: '#52525b' }}>
                  <ExternalLink size={11} /> Ver anúncio
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        <KpiCard icon={<BarChart2 size={14}/>}   label="Preço atual"       value={brl(currentPrice)}               color="#00E5FF" />
        <KpiCard icon={<TrendingUp size={14}/>}  label="Vendas/mês est."   value={String(estimatedMonthlySales)}   sub={`${ml.sold_quantity ?? 0} totais`} color="#22c55e" />
        <KpiCard icon={<Package size={14}/>}     label="Estoque"           value={`${ml.available_quantity ?? '—'} un`} color="#8b5cf6" />
        <KpiCard icon={<Eye size={14}/>}         label="Visitas 30d"       value={ml.visits_30d ? String(ml.visits_30d) : '—'} color="#06b6d4" />
        <KpiCard icon={<Star size={14}/>}        label="Avaliação"         value={ml.rating ? `${ml.rating.toFixed(1)} ⭐` : '—'} sub={`${ml.reviews_total ?? 0} avaliações`} color="#f59e0b" />
        <KpiCard icon={<Truck size={14}/>}       label="Entrega"           value={ml.shipping?.free_shipping ? 'Grátis' : 'Pago'} sub={ml.listing_type_id === 'gold_pro' ? 'Premium' : 'Clássico'} color="#f97316" />
      </div>

      {/* Price chart */}
      <Section title="Histórico de preços">
        <div className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold" style={{ color: '#e4e4e7' }}>Concorrente vs. meu preço</p>
            <div className="flex rounded-full p-0.5" style={{ background: '#0e0e11', border: '1px solid #1a1a1f' }}>
              {(['7d','30d','90d','all'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
                  style={{
                    background: period === p ? 'rgba(0,229,255,0.12)' : 'transparent',
                    color:      period === p ? '#00E5FF' : '#52525b',
                    border:     period === p ? '1px solid rgba(0,229,255,0.2)' : '1px solid transparent',
                  }}>
                  {p === 'all' ? 'Tudo' : p}
                </button>
              ))}
            </div>
          </div>

          {chartData.length < 2 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <BarChart2 size={28} style={{ color: '#27272a' }} />
              <p className="text-[13px] text-center" style={{ color: '#52525b' }}>
                Histórico sendo coletado — dados disponíveis em 24h
              </p>
              {currentPrice && (
                <p className="text-[11px]" style={{ color: '#3f3f46' }}>Ponto atual: {brl(currentPrice)}</p>
              )}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1f" />
                <XAxis dataKey="date" stroke="#1a1a1f" tick={{ fontSize: 10, fill: '#52525b' }} />
                <YAxis stroke="#1a1a1f" tick={{ fontSize: 10, fill: '#52525b' }} width={64}
                  tickFormatter={v => `R$${(v as number).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`} />
                <Tooltip content={<ChartTooltipContent />} />
                {myPrice != null && myPrice > 0 && (
                  <ReferenceLine y={myPrice} stroke="rgba(255,255,255,0.12)"
                    strokeDasharray="4 4"
                    label={{ value: 'Meu preço', fontSize: 9, fill: '#52525b', position: 'insideTopRight' }} />
                )}
                <Line type="monotone" dataKey="concorrente" name="Concorrente"
                  stroke="#00E5FF" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                {myPrice != null && myPrice > 0 && (
                  <Line type="monotone" dataKey="meuPreco" name="Meu preço"
                    stroke="rgba(255,255,255,0.25)" strokeWidth={1}
                    strokeDasharray="4 4" dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Section>

      {/* 2-col: price changes + seller */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

        {/* Price change table */}
        <Section title="Variações de preço">
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1f' }}>
            {priceChanges.length === 0 ? (
              <div className="py-8 text-center text-[12px]" style={{ color: '#52525b', background: '#111114' }}>
                Nenhuma variação registrada ainda
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#0e0e11', borderBottom: '1px solid #1a1a1f' }}>
                    {['Data','Preço','Variação','Tend.'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: '#52525b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {priceChanges.slice(0, 20).map((row, i) => {
                    const isBase = i === priceChanges.length - 1 && row.change === 0
                    const color  = isBase ? '#71717a' : row.change < 0 ? '#22c55e' : row.change > 0 ? '#ef4444' : '#71717a'
                    return (
                      <tr key={row.checked_at} style={{ borderBottom: '1px solid #18181b' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#0e0e11')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td className="px-3 py-2 text-[11px]" style={{ color: '#71717a' }}>{fmtDate(row.checked_at)}</td>
                        <td className="px-3 py-2 text-[12px] font-semibold" style={{ color: '#e4e4e7' }}>{brl(row.price)}</td>
                        <td className="px-3 py-2 text-[11px] font-medium" style={{ color }}>
                          {isBase ? 'Base' : `${row.change > 0 ? '+' : ''}${brl(row.change)}`}
                        </td>
                        <td className="px-3 py-2 text-[11px] font-semibold" style={{ color }}>
                          {isBase ? '—' : row.change < 0 ? `↓ ${Math.abs(row.changePct).toFixed(1)}%` : row.change > 0 ? `↑ +${row.changePct.toFixed(1)}%` : '→ 0%'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Section>

        {/* Seller + insights */}
        <div className="flex flex-col gap-4">
          <Section title="Intel do vendedor">
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
              {ml.seller ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: '#e4e4e7' }}>{ml.seller.nickname}</p>
                      {ml.seller.registration_date && (
                        <p className="text-[11px]" style={{ color: '#71717a' }}>
                          Na plataforma desde {new Date(ml.seller.registration_date).getFullYear()}
                        </p>
                      )}
                    </div>
                    {ml.seller.seller_reputation?.power_seller_status && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                        style={{ background: 'rgba(234,179,8,0.12)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}>
                        MercadoLíder {ml.seller.seller_reputation.power_seller_status.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: '#71717a' }}>Reputação</p>
                      <span className="text-[11px] font-semibold" style={{ color: rep.color }}>{rep.label}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a1f' }}>
                      {(() => {
                        const lvl: Record<string, number> = {
                          '1_red': 20, '2_orange': 40, '3_yellow': 60, '4_light_green': 80, '5_green': 100,
                        }
                        const w = lvl[ml.seller?.seller_reputation?.level_id ?? ''] ?? 0
                        return <div style={{ width: `${w}%`, height: '100%', background: rep.color, borderRadius: 4, transition: 'width 0.4s' }} />
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-center">
                      <p className="text-[14px] font-bold" style={{ color: '#e4e4e7' }}>
                        {ml.seller.seller_reputation?.transactions?.total?.toLocaleString('pt-BR') ?? '—'}
                      </p>
                      <p className="text-[10px]" style={{ color: '#71717a' }}>Vendas totais</p>
                    </div>
                    {(ml.reviews_total ?? 0) > 0 && (
                      <div className="text-center">
                        <p className="text-[14px] font-bold" style={{ color: '#e4e4e7' }}>
                          {ml.rating?.toFixed(1)} ⭐
                        </p>
                        <p className="text-[10px]" style={{ color: '#71717a' }}>{ml.reviews_total} avaliações</p>
                      </div>
                    )}
                    {ml.permalink && (
                      <a href={ml.permalink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg"
                        style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa' }}>
                        <ExternalLink size={11} /> Ver no ML
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[12px] py-2" style={{ color: '#52525b' }}>
                  Dados disponíveis após atualização
                </p>
              )}
            </div>
          </Section>

          <Section title="Insights automáticos">
            <div className="rounded-xl p-4 space-y-2" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
              {insights.length > 0 ? insights.map((ins, i) => (
                <p key={i} className="text-[12px] leading-relaxed" style={{ color: '#a1a1aa' }}>{ins}</p>
              )) : (
                <p className="text-[12px]" style={{ color: '#52525b' }}>Atualize os dados para ver insights</p>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* AI Panel */}
      <Section title="Análise com IA">
        <div className="rounded-2xl p-6"
          style={{ background: 'linear-gradient(135deg,#070d18 0%,#0d1117 100%)', border: '1px solid rgba(0,229,255,0.15)' }}>
          {iaText ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} style={{ color: '#00E5FF' }} />
                  <span className="text-[12px] font-semibold" style={{ color: '#00E5FF' }}>Análise gerada</span>
                </div>
                <button onClick={generateIA} disabled={loadingIA}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)', color: '#52525b' }}>
                  <RefreshCw size={10} className={loadingIA ? 'animate-spin' : ''} /> Regenerar
                </button>
              </div>
              <p className="text-[13px] leading-relaxed whitespace-pre-line" style={{ color: '#a1a1aa' }}>{iaText}</p>
              {iaBadge && <div className="mt-3"><AIBadge provider={iaBadge.provider} model={iaBadge.model} /></div>}
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.12)' }}>
                <Sparkles size={22} style={{ color: '#00E5FF', opacity: 0.7 }} />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold mb-1" style={{ color: '#e4e4e7' }}>Análise estratégica com IA</p>
                <p className="text-[12px]" style={{ color: '#71717a' }}>
                  Insights sobre posição competitiva, estratégia de preço e oportunidades
                </p>
              </div>
              <button onClick={generateIA} disabled={loadingIA}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-opacity"
                style={{
                  background: loadingIA ? 'rgba(0,229,255,0.08)' : '#00E5FF',
                  color:      loadingIA ? '#00E5FF' : '#000',
                  border:     loadingIA ? '1px solid rgba(0,229,255,0.2)' : 'none',
                }}>
                {loadingIA ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {loadingIA ? 'Analisando…' : 'Analisar com IA'}
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* Photo gallery */}
      {(ml.pictures?.length ?? 0) > 0 && (
        <Section title="Fotos do anúncio">
          <div className="grid grid-cols-6 gap-2">
            {ml.pictures?.slice(0, 6).map((pic, i) => (
              <button key={i} onClick={() => setLightbox(pic.secure_url ?? pic.url)}
                className="aspect-square rounded-xl overflow-hidden transition-all"
                style={{ border: '1px solid #1a1a1f' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#00E5FF')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1a1a1f')}>
                <img src={pic.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Description */}
      {ml.description && (
        <Section title="Descrição do anúncio">
          <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <p className="text-[12px] leading-relaxed whitespace-pre-line" style={{ color: '#71717a' }}>
              {ml.description.length > 800 ? ml.description.slice(0, 800) + '…' : ml.description}
            </p>
          </div>
        </Section>
      )}

    </div>
  )
}
