'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  BarChart, Bar, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { Competitor, PM, priceDiff, brl, relativeTime } from '../types'
import AddCompetitorModal from '../_components/AddCompetitorModal'

const SCRAPER  = process.env.NEXT_PUBLIC_SCRAPER_URL ?? 'https://price-scraper-production-2e7c.up.railway.app'
const BACKEND  = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const COLORS   = ['#f87171', '#fb923c', '#a78bfa', '#34d399', '#60a5fa']

// ── local types ───────────────────────────────────────────────────────────────

type CompHistory = { id: string; competitor_id: string; price: number; checked_at: string }

type CompAlert = {
  id: string
  competitor_id: string
  alert_type: 'below' | 'above'
  price_threshold: number
  active: boolean
}

type Product = {
  id: string
  name: string
  price: number | null
  photo_urls: string[] | null
  platforms: string[] | null
  ml_listing_type: string | null
  ml_free_shipping: boolean | null
  stock: number | null
}

type ChartPoint = { date: string; ourPrice: number; [key: string]: number | string }

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function sellerDisplay(c: Competitor): string {
  if (c.seller) return c.seller
  try {
    const tail = new URL(c.url).pathname.replace(/\/$/, '').slice(-4).toUpperCase()
    return `Vendedor …${tail}`
  } catch {
    return 'Vendedor'
  }
}

function buildLineData(
  top5: Competitor[],
  histMap: Map<string, CompHistory[]>,
  myPrice: number | null,
): { data: ChartPoint[]; series: Array<{ id: string; label: string; color: string }> } {
  const allDates = new Set<string>()
  for (const c of top5) {
    for (const h of (histMap.get(c.id) ?? [])) allDates.add(fmtDate(h.checked_at))
  }
  const dates = [...allDates].sort()
  if (!dates.length) return { data: [], series: [] }

  const data = dates.map(date => {
    const pt: ChartPoint = { date, ourPrice: myPrice ?? 0 }
    for (const c of top5) {
      const rel = (histMap.get(c.id) ?? []).filter(h => fmtDate(h.checked_at) <= date)
      if (rel.length) pt[`c_${c.id}`] = rel[rel.length - 1].price
    }
    return pt
  })

  const series = top5.map((c, i) => ({
    id: c.id,
    label: c.seller ?? c.title?.slice(0, 20) ?? `Conc. ${i + 1}`,
    color: COLORS[i],
  }))

  return { data, series }
}

// ── recharts tooltips (named components avoid ContentType error) ──────────────

function BarTip({ active, payload }: {
  active?: boolean
  payload?: Array<{ value: number; payload: { seller: string; diffPct: number | null } }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{ background: '#18181b', border: '1px solid #2e2e33', borderRadius: 8, padding: '8px 12px', minWidth: 130 }}>
      <p style={{ color: '#a1a1aa', fontSize: 11, marginBottom: 4 }}>{p.payload.seller}</p>
      <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{brl(p.value)}</p>
      {p.payload.diffPct != null && (
        <p style={{ fontSize: 11, color: p.payload.diffPct < 0 ? '#f87171' : '#34d399', marginTop: 2 }}>
          {p.payload.diffPct > 0 ? '+' : ''}{p.payload.diffPct.toFixed(1)}% vs meu preço
        </p>
      )}
    </div>
  )
}

function LineTip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#18181b', border: '1px solid #2e2e33', borderRadius: 8, padding: '8px 12px', minWidth: 140 }}>
      <p style={{ color: '#71717a', fontSize: 10, marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 12, fontWeight: 600 }}>{p.name}: {brl(p.value)}</p>
      ))}
    </div>
  )
}

function MiniTip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#18181b', border: '1px solid #2e2e33', borderRadius: 6, padding: '4px 8px' }}>
      <p style={{ color: '#71717a', fontSize: 10 }}>{label}</p>
      <p style={{ color: '#00E5FF', fontSize: 12, fontWeight: 700 }}>{brl(payload[0].value)}</p>
    </div>
  )
}

// ── AlertModal ────────────────────────────────────────────────────────────────

function AlertModal({ competitor, onClose }: { competitor: Competitor; onClose: () => void }) {
  const [below, setBelow] = useState('')
  const [above, setAbove] = useState('')
  const [existing, setExisting] = useState<CompAlert[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    createClient()
      .from('competitor_alerts')
      .select('id, competitor_id, alert_type, price_threshold, active')
      .eq('competitor_id', competitor.id)
      .eq('active', true)
      .then(({ data }) => {
        setExisting(data ?? [])
        const bl = (data ?? []).find((a: CompAlert) => a.alert_type === 'below')
        const ab = (data ?? []).find((a: CompAlert) => a.alert_type === 'above')
        if (bl) setBelow(String(bl.price_threshold))
        if (ab) setAbove(String(ab.price_threshold))
      })
  }, [competitor.id])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    if (existing.length > 0) {
      await supabase.from('competitor_alerts').update({ active: false }).in('id', existing.map(a => a.id))
    }
    const inserts = []
    const bv = parseFloat(below.replace(',', '.'))
    const av = parseFloat(above.replace(',', '.'))
    if (below && !isNaN(bv)) inserts.push({ competitor_id: competitor.id, alert_type: 'below', price_threshold: bv, active: true })
    if (above && !isNaN(av)) inserts.push({ competitor_id: competitor.id, alert_type: 'above', price_threshold: av, active: true })
    if (inserts.length) await supabase.from('competitor_alerts').insert(inserts)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2">
            <span>🔔</span>
            <p className="text-white font-semibold text-sm">Configurar Alerta</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-zinc-500 text-[12px] truncate">{competitor.seller ?? competitor.title ?? competitor.url}</p>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Alertar quando preço <span style={{ color: '#f87171' }}>BAIXAR</span> abaixo de
            </label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm">R$</span>
              <input type="text" inputMode="decimal" placeholder="0,00" value={below}
                onChange={e => setBelow(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-zinc-600 border outline-none"
                style={{ background: '#1c1c1f', borderColor: below ? '#f87171' : '#3f3f46' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Alertar quando preço <span style={{ color: '#34d399' }}>SUBIR</span> acima de
            </label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm">R$</span>
              <input type="text" inputMode="decimal" placeholder="0,00" value={above}
                onChange={e => setAbove(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-zinc-600 border outline-none"
                style={{ background: '#1c1c1f', borderColor: above ? '#34d399' : '#3f3f46' }} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving ? 'Salvando…' : 'Salvar alerta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PlatformBadge ─────────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string }) {
  const pm = PM[platform]
  if (!pm) return null
  return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
      style={{ background: pm.bg, color: pm.fg }}>
      {pm.label}
    </span>
  )
}

// ── InlineHistoryChart ────────────────────────────────────────────────────────

function InlineHistoryChart({ competitorId, myPrice }: { competitorId: string; myPrice: number | null }) {
  const [history, setHistory] = useState<CompHistory[] | null>(null)

  useEffect(() => {
    createClient()
      .from('price_history')
      .select('id, competitor_id, price, checked_at')
      .eq('competitor_id', competitorId)
      .order('checked_at', { ascending: true })
      .limit(30)
      .then(({ data }) => setHistory(data ?? []))
  }, [competitorId])

  if (history === null) return (
    <div className="flex items-center justify-center h-16">
      <svg className="w-4 h-4 animate-spin text-zinc-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )

  if (history.length < 2) return (
    <p className="text-zinc-500 text-[12px] text-center py-4">
      Histórico insuficiente — verifique o preço algumas vezes.
    </p>
  )

  const data = history.map(h => ({ date: fmtDate(h.checked_at), price: h.price }))
  const prices = history.map(h => h.price)
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const pad = (maxP - minP) * 0.15 || 10

  return (
    <ResponsiveContainer width="100%" height={90}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" hide />
        <YAxis hide domain={[minP - pad, maxP + pad]} />
        <Tooltip content={<MiniTip />} />
        <Line type="monotone" dataKey="price" stroke="#00E5FF" dot={false} strokeWidth={1.5} />
        {myPrice != null && (
          <ReferenceLine y={myPrice} stroke="#00E5FF" strokeDasharray="4 3" strokeOpacity={0.4} />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── CompetitorRow (Section 3) ─────────────────────────────────────────────────

function CompetitorRow({
  competitor, rank, isLowest, lowestPrice, myPrice, onVerify, onDelete, onToggle, onBell,
}: {
  competitor: Competitor
  rank: number
  isLowest: boolean
  lowestPrice: number | null
  myPrice: number | null
  onVerify: () => Promise<void>
  onDelete: () => void
  onToggle: () => void
  onBell: () => void
}) {
  const [verifying, setVerifying] = useState(false)
  const [histOpen, setHistOpen] = useState(false)
  const diffVsMine = priceDiff(competitor.current_price, myPrice)
  const vsLowest = (competitor.current_price != null && lowestPrice != null && !isLowest && lowestPrice > 0)
    ? ((competitor.current_price - lowestPrice) / lowestPrice) * 100 : null

  async function handleVerify() {
    setVerifying(true)
    await onVerify()
    setVerifying(false)
  }

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: '#0e0e11', border: `1px solid ${isLowest ? 'rgba(251,191,36,0.25)' : '#1e1e24'}` }}>
      <div className="flex items-start gap-3 p-3.5">
        {/* Rank */}
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: isLowest ? 'rgba(251,191,36,0.15)' : '#1c1c1f',
            color: isLowest ? '#fbbf24' : '#52525b',
            fontSize: 9, fontWeight: 800,
          }}>
          {rank}
        </div>

        {/* Thumbnail */}
        <div style={{
          width: 44, height: 44, borderRadius: 8, overflow: 'hidden',
          border: '1px solid #2e2e33', background: '#1c1c1f',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {competitor.photo_url
            ? <img src={competitor.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (() => { const pm = PM[competitor.platform]; return pm
                ? <div style={{ width: '100%', height: '100%', background: pm.bg, color: pm.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>{competitor.platform.toUpperCase().slice(0, 2)}</div>
                : <svg width="16" height="16" fill="none" stroke="#52525b" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              })()
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-bold truncate">{sellerDisplay(competitor)}</p>
              <p className="text-zinc-500 text-[11px] truncate mt-0.5">{competitor.title ?? competitor.url}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white text-base font-bold leading-none">{brl(competitor.current_price)}</p>
              <PlatformBadge platform={competitor.platform} />
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {isLowest && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                🏆 Mais barato
              </span>
            )}
            {vsLowest != null && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(113,113,122,0.12)', color: '#a1a1aa' }}>
                +{vsLowest.toFixed(1)}% vs menor
              </span>
            )}
            {diffVsMine != null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={diffVsMine < 0
                  ? { background: 'rgba(248,113,113,0.12)', color: '#f87171' }
                  : diffVsMine > 0
                  ? { background: 'rgba(52,211,153,0.12)', color: '#34d399' }
                  : { background: 'rgba(113,113,122,0.12)', color: '#71717a' }}>
                {diffVsMine < 0
                  ? `${diffVsMine.toFixed(1)}% vs meu preço`
                  : diffVsMine > 0
                  ? `+${diffVsMine.toFixed(1)}% vs meu preço`
                  : '= meu preço'}
              </span>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-zinc-600 text-[11px]">{relativeTime(competitor.last_checked)}</span>
            <span className="text-zinc-700 text-xs">·</span>

            <button onClick={handleVerify} disabled={verifying}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-cyan-400 transition-colors disabled:opacity-40">
              {verifying
                ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              }
              Atualizar
            </button>
            <span className="text-zinc-700 text-xs">·</span>

            <button onClick={() => setHistOpen(v => !v)}
              className="text-[11px] font-medium transition-colors"
              style={{ color: histOpen ? '#00E5FF' : '#71717a' }}>
              📊 Histórico
            </button>
            <span className="text-zinc-700 text-xs">·</span>

            <a href={competitor.url} target="_blank" rel="noopener noreferrer"
              className="text-zinc-500 hover:text-white transition-colors" title="Abrir anúncio">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <span className="text-zinc-700 text-xs">·</span>

            <button onClick={onBell} title="Configurar alerta"
              className="text-zinc-500 hover:text-yellow-400 transition-colors text-sm leading-none">
              🔔
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button onClick={onToggle}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all"
                style={competitor.status === 'active'
                  ? { background: 'rgba(52,211,153,0.1)', color: '#34d399' }
                  : { background: 'rgba(113,113,122,0.15)', color: '#71717a' }}>
                {competitor.status === 'active' ? 'Ativo' : 'Pausado'}
              </button>
              <button onClick={onDelete} className="text-zinc-600 hover:text-red-400 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {histOpen && (
        <div className="px-3.5 pb-3.5">
          <div className="rounded-lg p-3" style={{ background: '#080809', border: '1px solid #1e1e24' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
              Histórico de preços
            </p>
            <InlineHistoryChart competitorId={competitor.id} myPrice={myPrice} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { id: productId } = useParams<{ id: string }>()
  const router = useRouter()

  const [product, setProduct] = useState<Product | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [histMap, setHistMap] = useState<Map<string, CompHistory[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [alertTarget, setAlertTarget] = useState<Competitor | null>(null)
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: member } = await supabase.from('organization_members').select('organization_id').maybeSingle()
    setOrgId(member?.organization_id ?? null)

    const [{ data: prodData }, { data: compData }] = await Promise.all([
      supabase.from('products').select('id, name, price, photo_urls, platforms, ml_listing_type, ml_free_shipping, stock').eq('id', productId).maybeSingle(),
      supabase.from('competitors').select('id, product_id, organization_id, platform, url, title, seller, current_price, my_price, photo_url, status, last_checked, created_at').eq('product_id', productId).order('created_at', { ascending: false }),
    ])

    setProduct(prodData ?? null)
    const comps: Competitor[] = (compData ?? []).map((c: Record<string, unknown>) => ({
      ...(c as Competitor),
      product_name: prodData?.name ?? '—',
      product_photo_urls: prodData?.photo_urls ?? null,
    }))
    setCompetitors(comps)

    // Load price history for ALL competitors (needed for insights + charts)
    const allIds = comps.map(c => c.id)

    if (allIds.length) {
      const { data: histData } = await supabase
        .from('price_history')
        .select('id, competitor_id, price, checked_at')
        .in('competitor_id', allIds)
        .order('checked_at', { ascending: true })

      const map = new Map<string, CompHistory[]>()
      for (const h of (histData ?? [])) {
        if (!map.has(h.competitor_id)) map.set(h.competitor_id, [])
        map.get(h.competitor_id)!.push(h as CompHistory)
      }
      setHistMap(map)
    }
    setLoading(false)
  }, [productId])

  useEffect(() => { load() }, [load])

  const myPrice = competitors[0]?.my_price ?? null

  const sorted = useMemo(() =>
    [...competitors].sort((a, b) => {
      if (a.current_price == null) return 1
      if (b.current_price == null) return -1
      return a.current_price - b.current_price
    }), [competitors])

  const top5 = useMemo(() => sorted.filter(c => c.current_price != null).slice(0, 5), [sorted])
  const lowestPrice = top5[0]?.current_price ?? null
  const cheaperN = myPrice != null ? top5.filter(c => c.current_price! < myPrice).length : 0
  const isLeading = cheaperN === 0

  // Bar chart data
  const barData = useMemo(() => top5.map((c, i) => ({
    seller: (c.seller ?? `Conc. ${i + 1}`).slice(0, 18),
    price: c.current_price!,
    diffPct: priceDiff(c.current_price, myPrice),
    fill: COLORS[i],
  })), [top5, myPrice])

  // Line chart data
  const { data: lineData, series: lineSeries } = useMemo(
    () => buildLineData(top5, histMap, myPrice),
    [top5, histMap, myPrice]
  )

  // Insights
  const insights = useMemo(() => {
    const withPrice = competitors.filter(c => c.current_price != null)
    const avgPrice = withPrice.length
      ? withPrice.reduce((s, c) => s + c.current_price!, 0) / withPrice.length
      : null

    let topCount = { comp: null as Competitor | null, n: 0 }
    let topSwing = { comp: null as Competitor | null, pct: 0 }
    for (const c of competitors) {
      const h = histMap.get(c.id) ?? []
      if (!h.length) continue
      // Most updates = total history entries
      if (h.length > topCount.n) topCount = { comp: c, n: h.length }
      if (h.length < 2) continue
      const prices = h.map(x => x.price)
      const minP = Math.min(...prices), maxP = Math.max(...prices)
      const pctSwing = minP > 0 ? ((maxP - minP) / minP) * 100 : 0
      if (pctSwing > topSwing.pct) topSwing = { comp: c, pct: pctSwing }
    }

    const vsAvg = avgPrice != null && myPrice != null && myPrice > 0
      ? ((myPrice - avgPrice) / avgPrice) * 100 : null

    return { topCount, topSwing, avgPrice, vsAvg }
  }, [competitors, histMap, myPrice])

  async function verifySingle(c: Competitor) {
    const isMl = c.url.includes('mercadolivre') || c.url.includes('mercadolibre')
    try {
      const supabase = createClient()
      let price: number | null = null
      let seller: string | null = c.seller

      if (isMl) {
        const { data: sess } = await supabase.auth.getSession()
        const token = sess.session?.access_token
        if (!token) throw new Error('Sessão expirada.')
        const res = await fetch(`${BACKEND}/ml/item-info?url=${encodeURIComponent(c.url)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        price = data.price ?? null
        if (data.seller) seller = data.seller
      } else {
        const res = await fetch(`${SCRAPER}/scrape`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: c.url }),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        price = data.price ?? null
      }

      if (!price) throw new Error('Preço não encontrado.')
      const now = new Date().toISOString()
      const updates: Record<string, unknown> = { current_price: price, last_checked: now }
      if (seller && seller !== c.seller) updates.seller = seller

      await Promise.all([
        supabase.from('competitors').update(updates).eq('id', c.id),
        supabase.from('price_history').insert({ competitor_id: c.id, price }),
      ])
      setCompetitors(prev => prev.map(x =>
        x.id === c.id ? { ...x, current_price: price!, last_checked: now, ...(seller ? { seller } : {}) } : x
      ))
      showToast(`${seller ?? c.seller ?? 'Concorrente'} — ${brl(price)}`)
    } catch {
      showToast('Falha ao verificar preço.', 'error')
    }
  }

  async function updateAll() {
    const targets = competitors.filter(c => c.status === 'active')
    if (!targets.length) { showToast('Nenhum ativo.', 'error'); return }
    setUpdating(true)
    for (const c of targets) {
      try {
        const res = await fetch(`${SCRAPER}/scrape`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: c.url }),
        })
        if (res.ok) {
          const { price } = await res.json()
          if (price) {
            const now = new Date().toISOString()
            const supabase = createClient()
            await Promise.all([
              supabase.from('competitors').update({ current_price: price, last_checked: now }).eq('id', c.id),
              supabase.from('price_history').insert({ competitor_id: c.id, price }),
            ])
            setCompetitors(prev => prev.map(x => x.id === c.id ? { ...x, current_price: price, last_checked: now } : x))
          }
        }
      } catch { /* skip */ }
    }
    setUpdating(false)
    showToast(`${targets.length} concorrentes atualizados!`)
  }

  async function deleteCompetitor(id: string) {
    await createClient().from('competitors').delete().eq('id', id)
    setCompetitors(prev => prev.filter(c => c.id !== id))
    showToast('Concorrente removido.')
  }

  async function toggleStatus(c: Competitor) {
    const next = c.status === 'active' ? 'paused' : 'active'
    await createClient().from('competitors').update({ status: next }).eq('id', c.id)
    setCompetitors(prev => prev.map(x => x.id === c.id ? { ...x, status: next } : x))
  }

  const competitorCounts = useMemo(() => ({ [productId]: competitors.length }), [productId, competitors.length])

  const productPhoto = product?.photo_urls?.[0] ?? null
  const productName = product?.name ?? '—'

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ background: '#09090b' }}>
      <svg className="w-7 h-7 animate-spin" style={{ color: '#00E5FF' }} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col h-full" style={{ background: '#09090b' }}>

        {/* Top bar */}
        <div className="shrink-0 px-6 pt-5 pb-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[12px] text-zinc-500 mb-4">
            <Link href="/dashboard/concorrentes" className="hover:text-white transition-colors">
              Concorrentes
            </Link>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-zinc-300 truncate max-w-[200px]">{productName}</span>
          </div>

          {/* Product header */}
          <div className="flex items-center justify-between gap-4 pb-5">
            <div className="flex items-center gap-4 min-w-0">
              {/* Back */}
              <button onClick={() => router.push('/dashboard/concorrentes')}
                className="text-zinc-500 hover:text-white transition-colors shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Photo */}
              <div style={{
                width: 52, height: 52, borderRadius: 12, overflow: 'hidden',
                border: '1px solid #2e2e33', background: '#1c1c1f',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {productPhoto
                  ? <img src={productPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <svg width="20" height="20" fill="none" stroke="#52525b" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                }
              </div>

              {/* Info */}
              <div className="min-w-0">
                <p className="text-white font-semibold text-base truncate">{productName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-white text-lg font-bold leading-none">{brl(myPrice)}</p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={isLeading
                      ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80' }
                      : { background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}>
                    {isLeading ? '🏆 Liderando' : `⚠️ ${cheaperN} mais barato${cheaperN !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={updateAll} disabled={updating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all disabled:opacity-50"
                style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
                {updating
                  ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                }
                {updating ? 'Atualizando…' : 'Atualizar todos'}
              </button>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{ background: '#00E5FF', color: '#000' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

            {competitors.length === 0 && (
              <div className="rounded-2xl border flex flex-col items-center justify-center py-16"
                style={{ background: '#111114', borderColor: '#1e1e24' }}>
                <p className="text-zinc-400 text-sm mb-3">Nenhum concorrente cadastrado para este produto.</p>
                <button onClick={() => setShowAdd(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#00E5FF', color: '#000' }}>
                  Adicionar concorrente
                </button>
              </div>
            )}

            {/* ── Section 1: Price Evolution Line Chart ─────────────────── */}
            {lineData.length >= 2 && (
              <div className="rounded-2xl px-6 py-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <p className="text-white text-sm font-semibold mb-1">Evolução de preços</p>
                <p className="text-zinc-500 text-xs mb-5">Histórico dos 5 concorrentes mais baratos</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={lineData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#1a1a1e" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#52525b', fontSize: 10 }}
                      tickFormatter={v => brl(v as number)}
                      axisLine={false} tickLine={false} width={90}
                    />
                    <Tooltip content={<LineTip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#71717a', paddingTop: 10 }} />
                    {lineSeries.map(s => (
                      <Line key={s.id} dataKey={`c_${s.id}`} stroke={s.color} name={s.label}
                        dot={false} strokeWidth={2} connectNulls />
                    ))}
                    {myPrice != null && (
                      <Line dataKey="ourPrice" stroke="#00E5FF" strokeDasharray="6 3"
                        name="Nosso preço" dot={false} strokeWidth={2} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Section 2: Top 5 Bar Chart ────────────────────────────── */}
            {barData.length > 0 && (
              <div className="rounded-2xl px-6 py-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <p className="text-white text-sm font-semibold mb-1">Top 5 menores preços</p>
                <p className="text-zinc-500 text-xs mb-5">Comparação direta com o seu preço</p>
                <ResponsiveContainer width="100%" height={barData.length * 52 + 24}>
                  <BarChart
                    layout="vertical"
                    data={barData}
                    margin={{ top: 0, right: 60, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e1e24" />
                    <XAxis
                      type="number"
                      tick={{ fill: '#52525b', fontSize: 10 }}
                      tickFormatter={v => `R$${(v as number).toFixed(0)}`}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="seller"
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      width={120}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    {myPrice != null && (
                      <ReferenceLine
                        x={myPrice}
                        stroke="#00E5FF"
                        strokeDasharray="5 3"
                        strokeWidth={1.5}
                        label={{ value: 'Meu preço', fill: '#00E5FF', fontSize: 10, position: 'top' }}
                      />
                    )}
                    <Bar dataKey="price" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {barData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Section 3: Competitor List ────────────────────────────── */}
            {sorted.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: '1px solid #1e1e24', background: '#0d0d10' }}>
                  <p className="text-white text-sm font-semibold">Concorrentes</p>
                  <span className="text-zinc-500 text-xs">{sorted.length} monitorado{sorted.length !== 1 ? 's' : ''} · ordenado por menor preço</span>
                </div>
                <div className="p-4 space-y-2">
                  {sorted.map((comp, idx) => (
                    <CompetitorRow
                      key={comp.id}
                      competitor={comp}
                      rank={idx + 1}
                      isLowest={idx === 0 && comp.current_price != null}
                      lowestPrice={lowestPrice}
                      myPrice={myPrice}
                      onVerify={() => verifySingle(comp)}
                      onDelete={() => deleteCompetitor(comp.id)}
                      onToggle={() => toggleStatus(comp)}
                      onBell={() => setAlertTarget(comp)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Section 4: Insights ───────────────────────────────────── */}
            {competitors.length > 0 && (
              <div>
                <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-semibold mb-3">Insights</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

                  {/* Most changes */}
                  <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                      Mais alterações
                    </p>
                    {insights.topCount.comp ? (
                      <>
                        <p className="text-white text-sm font-semibold truncate">{insights.topCount.comp.seller ?? insights.topCount.comp.title}</p>
                        <p className="text-cyan-400 text-xs font-bold mt-0.5">{insights.topCount.n} alterações</p>
                      </>
                    ) : <p className="text-zinc-600 text-xs">Sem dados</p>}
                  </div>

                  {/* Biggest swing */}
                  <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                      Maior variação
                    </p>
                    {insights.topSwing.comp ? (
                      <>
                        <p className="text-white text-sm font-semibold truncate">{insights.topSwing.comp.seller ?? insights.topSwing.comp.title}</p>
                        <p className="text-orange-400 text-xs font-bold mt-0.5">{insights.topSwing.pct.toFixed(1)}% variação</p>
                      </>
                    ) : <p className="text-zinc-600 text-xs">Sem dados</p>}
                  </div>

                  {/* Average price */}
                  <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                      Média concorrentes
                    </p>
                    <p className="text-white text-base font-bold">{brl(insights.avgPrice)}</p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">preço médio</p>
                  </div>

                  {/* My price vs average */}
                  <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
                      Eu vs média
                    </p>
                    {insights.vsAvg != null ? (
                      <>
                        <p className="text-base font-bold"
                          style={{ color: insights.vsAvg < 0 ? '#34d399' : insights.vsAvg > 0 ? '#f87171' : '#71717a' }}>
                          {insights.vsAvg > 0 ? '+' : ''}{insights.vsAvg.toFixed(1)}%
                        </p>
                        <p className="text-zinc-500 text-[10px] mt-0.5">
                          {insights.vsAvg < 0 ? 'abaixo da média' : insights.vsAvg > 0 ? 'acima da média' : 'igual à média'}
                        </p>
                      </>
                    ) : <p className="text-zinc-600 text-xs">Sem dados</p>}
                  </div>

                </div>
              </div>
            )}

            {/* ── Section 5: ML Metrics ─────────────────────────────────── */}
            {product && product.platforms?.includes('mercadolivre') && (
              <div>
                <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-semibold mb-3">Métricas Mercado Livre</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Preço cadastrado', value: brl(product.price) },
                    { label: 'Estoque', value: product.stock != null ? String(product.stock) : '—' },
                    { label: 'Tipo de anúncio', value: product.ml_listing_type ?? '—' },
                    { label: 'Frete grátis', value: product.ml_free_shipping ? 'Sim' : product.ml_free_shipping === false ? 'Não' : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl px-4 py-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                      <p className="text-zinc-500 text-[10px] mb-1">{label}</p>
                      <p className="text-white text-sm font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {showAdd && orgId && (
        <AddCompetitorModal
          orgId={orgId}
          competitorCounts={competitorCounts}
          onClose={() => setShowAdd(false)}
          onSaved={async () => {
            setShowAdd(false)
            await load()
            showToast('Concorrente adicionado!')
          }}
        />
      )}

      {alertTarget && (
        <AlertModal competitor={alertTarget} onClose={() => setAlertTarget(null)} />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl"
          style={{
            background: toast.type === 'success' ? '#111114' : '#1a0a0a',
            border: `1px solid ${toast.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: toast.type === 'success' ? '#34d399' : '#f87171',
          }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
