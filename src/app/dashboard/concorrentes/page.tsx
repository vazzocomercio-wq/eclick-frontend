'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Competitor, PM, priceDiff, brl, relativeTime } from './types'
import AddCompetitorModal from './_components/AddCompetitorModal'

const SCRAPER = process.env.NEXT_PUBLIC_SCRAPER_URL ?? 'https://price-scraper-production-2e7c.up.railway.app'
const COLORS = ['#f87171', '#fb923c', '#a78bfa', '#34d399', '#60a5fa']

// ── local types ───────────────────────────────────────────────────────────────

type Toast = { id: number; msg: string; type: 'success' | 'error' | 'info' }

type CompHistory = { id: string; competitor_id: string; price: number; checked_at: string }

type CompAlert = {
  id: string
  competitor_id: string
  alert_type: 'below' | 'above'
  price_threshold: number
  active: boolean
}

type ProductGroup = { productId: string; productName: string; competitors: Competitor[] }

type ChartPoint = { date: string; ourPrice: number; [key: string]: number | string }

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildChartData(
  competitors: Competitor[],
  histMap: Map<string, CompHistory[]>,
  myPrice: number | null,
): { data: ChartPoint[]; series: Array<{ id: string; label: string; color: string }> } {
  const top5 = [...competitors]
    .filter(c => c.current_price != null)
    .sort((a, b) => a.current_price! - b.current_price!)
    .slice(0, 5)

  const allDates = new Set<string>()
  for (const c of top5) {
    for (const h of (histMap.get(c.id) ?? [])) allDates.add(fmt(h.checked_at))
  }
  const dates = [...allDates].sort()
  if (dates.length === 0) return { data: [], series: [] }

  const data = dates.map(date => {
    const pt: ChartPoint = { date, ourPrice: myPrice ?? 0 }
    for (const c of top5) {
      const rel = (histMap.get(c.id) ?? []).filter(h => fmt(h.checked_at) <= date)
      if (rel.length) pt[`c_${c.id}`] = rel[rel.length - 1].price
    }
    return pt
  })

  const series = top5.map((c, i) => ({
    id: c.id,
    label: c.seller ?? c.title?.slice(0, 22) ?? `Conc. ${i + 1}`,
    color: COLORS[i],
  }))

  return { data, series }
}

function computeInsights(competitors: Competitor[], histMap: Map<string, CompHistory[]>) {
  let topCount = { comp: null as Competitor | null, n: 0 }
  let topSwing = { comp: null as Competitor | null, pct: 0 }
  for (const c of competitors) {
    const h = histMap.get(c.id) ?? []
    if (h.length < 2) continue
    let changes = 0, maxPct = 0
    for (let i = 1; i < h.length; i++) {
      if (h[i].price !== h[i - 1].price) changes++
      const p = Math.abs((h[i].price - h[i - 1].price) / h[i - 1].price) * 100
      if (p > maxPct) maxPct = p
    }
    if (changes > topCount.n) topCount = { comp: c, n: changes }
    if (maxPct > topSwing.pct) topSwing = { comp: c, pct: maxPct }
  }
  return { topCount, topSwing }
}

// ── Toasts ────────────────────────────────────────────────────────────────────

function Toasts({ toasts }: { toasts: Toast[] }) {
  const colors: Record<Toast['type'], { bg: string; border: string; color: string }> = {
    success: { bg: '#111114', border: 'rgba(52,211,153,0.3)',  color: '#34d399' },
    error:   { bg: '#1a0a0a', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
    info:    { bg: '#111114', border: 'rgba(0,229,255,0.3)',    color: '#00E5FF' },
  }
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const c = colors[t.type]
        return (
          <div key={t.id} className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
            style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
            {t.msg}
          </div>
        )
      })}
    </div>
  )
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="rounded-2xl px-5 py-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <p className="text-zinc-500 text-xs mb-2">{label}</p>
      <p className="text-white text-2xl font-bold" style={accent ? { color: accent } : undefined}>{value}</p>
      {sub && <p className="text-zinc-600 text-xs mt-1">{sub}</p>}
    </div>
  )
}

// ── PlatformThumb ─────────────────────────────────────────────────────────────

function PlatformThumb({ platform, photoUrl, size = 48 }: {
  platform: string; photoUrl: string | null; size?: number
}) {
  const pm = PM[platform]
  const sz = `${size}px`
  if (photoUrl) return (
    <div style={{ width: sz, height: sz, borderRadius: 10, overflow: 'hidden', border: '1px solid #2e2e33', flexShrink: 0 }}>
      <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
  if (pm) return (
    <div style={{
      width: sz, height: sz, borderRadius: 10, background: pm.bg, color: pm.fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 900, flexShrink: 0,
    }}>{platform.toUpperCase().slice(0, 2)}</div>
  )
  return (
    <div style={{
      width: sz, height: sz, borderRadius: 10, background: '#1c1c1f', border: '1px solid #2e2e33',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="20" height="20" fill="none" stroke="#52525b" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
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
          <p className="text-zinc-500 text-[12px] truncate">{competitor.title ?? competitor.url}</p>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Alertar quando preço <span style={{ color: '#f87171' }}>BAIXAR</span> abaixo de</label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm">R$</span>
              <input type="text" inputMode="decimal" placeholder="0,00" value={below}
                onChange={e => setBelow(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-zinc-600 border outline-none"
                style={{ background: '#1c1c1f', borderColor: below ? '#f87171' : '#3f3f46' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Alertar quando preço <span style={{ color: '#34d399' }}>SUBIR</span> acima de</label>
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

// ── tooltip helpers ───────────────────────────────────────────────────────────

function MiniTooltip({ active, payload, label }: {
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

function MultiLineTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#18181b', border: '1px solid #2e2e33', borderRadius: 8, padding: '8px 12px', minWidth: 140 }}>
      <p style={{ color: '#71717a', fontSize: 10, marginBottom: 5 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 12, fontWeight: 600 }}>
          {p.name}: {brl(p.value)}
        </p>
      ))}
    </div>
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
      Histórico insuficiente. Atualize o preço para construir o gráfico.
    </p>
  )

  const data = history.map(h => ({ date: fmt(h.checked_at), price: h.price }))
  const prices = history.map(h => h.price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const pad = (maxP - minP) * 0.15 || 10

  return (
    <ResponsiveContainer width="100%" height={90}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" hide />
        <YAxis hide domain={[minP - pad, maxP + pad]} />
        <Tooltip content={<MiniTooltip />} />
        <Line type="monotone" dataKey="price" stroke="#00E5FF" dot={false} strokeWidth={1.5} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── CompetitorItem ────────────────────────────────────────────────────────────

function CompetitorItem({
  competitor, rank, isLowest, lowestPrice, myPrice,
  onVerify, onDelete, onToggle, onBell,
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
  const pm = PM[competitor.platform]
  const diffVsMine = priceDiff(competitor.current_price, myPrice)

  const vsLowest = (
    competitor.current_price != null && lowestPrice != null &&
    lowestPrice > 0 && !isLowest
  ) ? ((competitor.current_price - lowestPrice) / lowestPrice) * 100 : null

  async function handleVerify() {
    setVerifying(true)
    await onVerify()
    setVerifying(false)
  }

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{ background: '#0e0e11', border: `1px solid ${isLowest ? 'rgba(251,191,36,0.3)' : '#1e1e24'}` }}>
      <div className="flex items-start gap-3 p-3">
        {/* Rank */}
        <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-1.5"
          style={{
            background: isLowest ? 'rgba(251,191,36,0.15)' : '#1c1c1f',
            color: isLowest ? '#fbbf24' : '#52525b',
            fontSize: 9, fontWeight: 800,
          }}>{rank}</div>

        {/* Thumbnail */}
        <PlatformThumb platform={competitor.platform} photoUrl={competitor.photo_url} size={48} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            {/* Seller + title */}
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-bold truncate leading-tight">{competitor.seller ?? '—'}</p>
              <p className="text-zinc-500 text-[12px] truncate leading-snug mt-0.5">{competitor.title ?? competitor.url}</p>
            </div>
            {/* Price block */}
            <div className="text-right shrink-0">
              <p className="text-white text-base font-bold leading-none">{brl(competitor.current_price)}</p>
              {pm && (
                <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded mt-1"
                  style={{ background: pm.bg, color: pm.fg }}>{pm.label}</span>
              )}
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
                  : { background: 'rgba(113,113,122,0.12)', color: '#71717a' }
                }>
                {diffVsMine < 0
                  ? `${diffVsMine.toFixed(1)}% vs meu preço`
                  : diffVsMine > 0
                  ? `+${diffVsMine.toFixed(1)}% vs meu preço`
                  : '= meu preço'
                }
              </span>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2.5 mt-2 flex-wrap">
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
                  : { background: 'rgba(113,113,122,0.15)', color: '#71717a' }
                }>
                {competitor.status === 'active' ? 'Ativo' : 'Pausado'}
              </button>
              <button onClick={onDelete} className="text-zinc-600 hover:text-red-400 transition-colors" title="Excluir">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inline history */}
      {histOpen && (
        <div className="px-3 pb-3">
          <div className="rounded-lg p-3" style={{ background: '#080809', border: '1px solid #1e1e24' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Histórico de preços
              </p>
              <a href={`/dashboard/concorrentes/${competitor.id}`}
                className="text-[10px] text-zinc-500 hover:text-cyan-400 transition-colors">
                Ver completo →
              </a>
            </div>
            <InlineHistoryChart competitorId={competitor.id} myPrice={myPrice} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── ProductPriceChart ─────────────────────────────────────────────────────────

function ProductPriceChart({
  competitors, histMap, myPrice,
}: {
  competitors: Competitor[]
  histMap: Map<string, CompHistory[]>
  myPrice: number | null
}) {
  const { data, series } = buildChartData(competitors, histMap, myPrice)
  if (data.length < 2) return null

  return (
    <div className="rounded-xl p-4 mt-1" style={{ background: '#080809', border: '1px solid #1e1e24' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-4">
        Top 5 menores preços — Evolução
      </p>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1a1a1e" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10 }} stroke="#2e2e33" tickLine={false} />
          <YAxis
            tick={{ fill: '#52525b', fontSize: 10 }}
            stroke="transparent" tickLine={false} width={80}
            tickFormatter={v => brl(v as number)}
          />
          <Tooltip content={<MultiLineTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#71717a', paddingTop: 10 }} />
          {series.map(s => (
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
  )
}

// ── InsightCards ──────────────────────────────────────────────────────────────

function InsightCards({ competitors, histMap }: {
  competitors: Competitor[]
  histMap: Map<string, CompHistory[]>
}) {
  const { topCount, topSwing } = computeInsights(competitors, histMap)
  if (!topCount.comp && !topSwing.comp) return null
  return (
    <div className="grid grid-cols-2 gap-3 mt-1">
      <div className="rounded-xl p-4" style={{ background: '#080809', border: '1px solid #1e1e24' }}>
        <p className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
          Mais alterações de preço
        </p>
        {topCount.comp ? (
          <>
            <p className="text-white text-sm font-semibold truncate">{topCount.comp.seller ?? topCount.comp.title}</p>
            <p className="text-cyan-400 text-xs font-bold mt-0.5">{topCount.n} alterações registradas</p>
          </>
        ) : (
          <p className="text-zinc-500 text-xs">Dados insuficientes</p>
        )}
      </div>
      <div className="rounded-xl p-4" style={{ background: '#080809', border: '1px solid #1e1e24' }}>
        <p className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
          Maior variação de preço
        </p>
        {topSwing.comp ? (
          <>
            <p className="text-white text-sm font-semibold truncate">{topSwing.comp.seller ?? topSwing.comp.title}</p>
            <p className="text-orange-400 text-xs font-bold mt-0.5">{topSwing.pct.toFixed(1)}% variação máxima</p>
          </>
        ) : (
          <p className="text-zinc-500 text-xs">Dados insuficientes</p>
        )}
      </div>
    </div>
  )
}

// ── ProductCard ───────────────────────────────────────────────────────────────

function ProductCard({
  group, onVerify, onDelete, onToggleStatus, onBell,
}: {
  group: ProductGroup
  onVerify: (c: Competitor) => Promise<void>
  onDelete: (id: string) => void
  onToggleStatus: (c: Competitor) => void
  onBell: (c: Competitor) => void
}) {
  const [histMap, setHistMap] = useState<Map<string, CompHistory[]>>(new Map())
  const [chartLoading, setChartLoading] = useState(true)

  const sorted = useMemo(() => [...group.competitors].sort((a, b) => {
    if (a.current_price == null) return 1
    if (b.current_price == null) return -1
    return a.current_price - b.current_price
  }), [group.competitors])

  const myPrice = group.competitors[0]?.my_price ?? null
  const lowestPrice = sorted.find(c => c.current_price != null)?.current_price ?? null
  const weAreLosing = lowestPrice != null && myPrice != null && lowestPrice < myPrice
  const productPhoto = group.competitors[0]?.product_photo_urls?.[0] ?? null

  useEffect(() => {
    const ids = sorted.filter(c => c.current_price != null).slice(0, 5).map(c => c.id)
    if (!ids.length) { setChartLoading(false); return }
    createClient()
      .from('price_history')
      .select('id, competitor_id, price, checked_at')
      .in('competitor_id', ids)
      .order('checked_at', { ascending: true })
      .then(({ data }) => {
        const map = new Map<string, CompHistory[]>()
        for (const h of (data ?? [])) {
          if (!map.has(h.competitor_id)) map.set(h.competitor_id, [])
          map.get(h.competitor_id)!.push(h as CompHistory)
        }
        setHistMap(map)
        setChartLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.productId, group.competitors.length])

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      {/* Card header */}
      <div className="flex items-center gap-4 px-5 py-4" style={{ background: '#0d0d10', borderBottom: '1px solid #1e1e24' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, overflow: 'hidden',
          border: '1px solid #2e2e33', background: '#1c1c1f',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {productPhoto
            ? <img src={productPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <svg width="20" height="20" fill="none" stroke="#52525b" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-base truncate">{group.productName}</p>
          <p className="text-zinc-400 text-sm font-bold">{brl(myPrice)}</p>
        </div>
        <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full shrink-0"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}>
          {group.competitors.length} concorrente{group.competitors.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Price banner */}
      {sorted.length > 0 && (
        <div className="px-5 py-2.5 flex items-center gap-2"
          style={{
            background: weAreLosing ? 'rgba(234,88,12,0.07)' : 'rgba(34,197,94,0.07)',
            borderBottom: '1px solid #1e1e24',
          }}>
          {weAreLosing ? (
            <>
              <span>⚠️</span>
              <p className="text-[13px] font-semibold" style={{ color: '#fb923c' }}>
                Concorrente mais barato!{' '}
                <span className="font-bold">Menor: {brl(lowestPrice)}</span>
                {sorted[0].seller ? ` — ${sorted[0].seller}` : ''}
              </p>
            </>
          ) : (
            <>
              <span>✅</span>
              <p className="text-[13px] font-semibold" style={{ color: '#4ade80' }}>
                Você está liderando o preço!
              </p>
            </>
          )}
        </div>
      )}

      {/* Competitor list */}
      <div className="p-4 space-y-2">
        {sorted.map((comp, idx) => (
          <CompetitorItem
            key={comp.id}
            competitor={comp}
            rank={idx + 1}
            isLowest={idx === 0 && comp.current_price != null}
            lowestPrice={lowestPrice}
            myPrice={myPrice}
            onVerify={() => onVerify(comp)}
            onDelete={() => onDelete(comp.id)}
            onToggle={() => onToggleStatus(comp)}
            onBell={() => onBell(comp)}
          />
        ))}
      </div>

      {/* Chart + insights */}
      {!chartLoading && (
        <div className="px-4 pb-4 space-y-3">
          <ProductPriceChart competitors={sorted} histMap={histMap} myPrice={myPrice} />
          <InsightCards competitors={sorted} histMap={histMap} />
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConcorrentesPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [alertTarget, setAlertTarget] = useState<Competitor | null>(null)

  const [filterProduct, setFilterProduct] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [updating, setUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<{ done: number; total: number } | null>(null)

  const toast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: member } = await supabase
      .from('organization_members').select('organization_id').maybeSingle()
    if (!member) { setLoading(false); return }
    setOrgId(member.organization_id)

    const { data } = await supabase
      .from('competitors')
      .select(`
        id, product_id, organization_id, platform, url, title, seller,
        current_price, my_price, photo_url, status, last_checked, created_at,
        products(name, photo_urls)
      `)
      .eq('organization_id', member.organization_id)
      .order('created_at', { ascending: false })

    setCompetitors(
      (data ?? []).map((c: Record<string, unknown>) => {
        const prod = c.products as { name: string; photo_urls: string[] | null } | null
        return {
          ...(c as Competitor),
          product_name: prod?.name ?? '—',
          product_photo_urls: prod?.photo_urls ?? null,
        }
      })
    )
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const active = competitors.filter(c => c.status === 'active')
  const cheaper = competitors.filter(c => { const d = priceDiff(c.current_price, c.my_price); return d != null && d < 0 })
  const expensive = competitors.filter(c => { const d = priceDiff(c.current_price, c.my_price); return d != null && d > 0 })
  const lastChecked = competitors.map(c => c.last_checked).filter(Boolean).sort().pop()

  const uniqueProducts = useMemo(
    () => [...new Map(competitors.map(c => [c.product_id, c.product_name])).entries()],
    [competitors]
  )

  const filtered = useMemo(() => competitors.filter(c => {
    if (filterProduct !== 'all' && c.product_id !== filterProduct) return false
    if (filterPlatform !== 'all' && c.platform !== filterPlatform) return false
    return true
  }), [competitors, filterProduct, filterPlatform])

  const groups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>()
    for (const c of filtered) {
      if (!map.has(c.product_id)) map.set(c.product_id, { productId: c.product_id, productName: c.product_name ?? '—', competitors: [] })
      map.get(c.product_id)!.competitors.push(c)
    }
    return [...map.values()]
  }, [filtered])

  const competitorCounts = useMemo(() => {
    const map: Record<string, number> = {}
    competitors.forEach(c => { map[c.product_id] = (map[c.product_id] ?? 0) + 1 })
    return map
  }, [competitors])

  const verifySingle = useCallback(async (c: Competitor) => {
    const supabase = createClient()
    try {
      const res = await fetch(`${SCRAPER}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: c.url }),
      })
      if (!res.ok) throw new Error()
      const { price } = await res.json()
      if (!price) throw new Error()
      const now = new Date().toISOString()
      await Promise.all([
        supabase.from('competitors').update({ current_price: price, last_checked: now }).eq('id', c.id),
        supabase.from('price_history').insert({ competitor_id: c.id, price }),
      ])
      setCompetitors(prev => prev.map(x => x.id === c.id ? { ...x, current_price: price, last_checked: now } : x))
      toast(`${c.seller ?? c.title ?? 'Concorrente'} atualizado — ${brl(price)}`)
    } catch {
      toast('Falha ao verificar preço.', 'error')
    }
  }, [toast])

  async function updateAll() {
    const targets = competitors.filter(c => c.status === 'active')
    if (!targets.length) { toast('Nenhum concorrente ativo.', 'info'); return }
    setUpdating(true)
    setUpdateProgress({ done: 0, total: targets.length })
    const supabase = createClient()
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i]
      try {
        const res = await fetch(`${SCRAPER}/scrape`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: c.url }),
        })
        if (res.ok) {
          const { price } = await res.json()
          if (price) {
            const now = new Date().toISOString()
            await Promise.all([
              supabase.from('competitors').update({ current_price: price, last_checked: now }).eq('id', c.id),
              supabase.from('price_history').insert({ competitor_id: c.id, price }),
            ])
            setCompetitors(prev => prev.map(x => x.id === c.id ? { ...x, current_price: price, last_checked: now } : x))
          }
        }
      } catch { /* skip */ }
      setUpdateProgress({ done: i + 1, total: targets.length })
    }
    setUpdating(false)
    setUpdateProgress(null)
    toast(`${targets.length} concorrente${targets.length !== 1 ? 's' : ''} atualizados!`)
  }

  async function deleteCompetitor(id: string) {
    await createClient().from('competitors').delete().eq('id', id)
    setCompetitors(prev => prev.filter(c => c.id !== id))
    toast('Concorrente removido.')
  }

  async function toggleStatus(c: Competitor) {
    const next = c.status === 'active' ? 'paused' : 'active'
    await createClient().from('competitors').update({ status: next }).eq('id', c.id)
    setCompetitors(prev => prev.map(x => x.id === c.id ? { ...x, status: next } : x))
  }

  return (
    <>
      <div className="flex flex-col h-full" style={{ background: '#09090b' }}>

        {/* Top bar */}
        <div className="shrink-0 px-6 pt-6 pb-5" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-lg font-semibold">Monitor de Preços</h1>
              <p className="text-zinc-500 text-sm mt-0.5">
                {loading ? 'Carregando…' : `${competitors.length} concorrente${competitors.length !== 1 ? 's' : ''} monitorados`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {updateProgress && (
                <span className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}>
                  {updateProgress.done}/{updateProgress.total}
                </span>
              )}
              <button onClick={updateAll} disabled={updating || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50"
                style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
                {updating
                  ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                }
                {updating ? 'Atualizando…' : 'Atualizar todos'}
              </button>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
                style={{ background: '#00E5FF', color: '#000' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Adicionar Concorrente
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-6">

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Total monitorados" value={competitors.length} />
              <MetricCard label="Mais baratos que eu" value={cheaper.length}
                sub="concorrentes com preço menor" accent={cheaper.length > 0 ? '#f87171' : undefined} />
              <MetricCard label="Mais caros que eu" value={expensive.length}
                sub="concorrentes com preço maior" accent={expensive.length > 0 ? '#34d399' : undefined} />
              <MetricCard label="Última atualização" value={relativeTime(lastChecked ?? null)}
                sub={`${active.length} ativo${active.length !== 1 ? 's' : ''}`} />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-[13px] border outline-none"
                style={{ background: '#111114', borderColor: '#3f3f46', color: '#a1a1aa' }}>
                <option value="all">Todos os produtos</option>
                {uniqueProducts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-[13px] border outline-none"
                style={{ background: '#111114', borderColor: '#3f3f46', color: '#a1a1aa' }}>
                <option value="all">Todas as plataformas</option>
                {Object.entries(PM).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-5">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden animate-pulse"
                    style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                    <div className="h-16 px-5" style={{ background: '#0d0d10' }} />
                    <div className="p-4 space-y-2">
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="h-20 rounded-xl" style={{ background: '#0e0e11' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && competitors.length === 0 && (
              <div className="rounded-2xl border flex flex-col items-center justify-center py-20"
                style={{ background: '#111114', borderColor: '#1e1e24' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(0,229,255,0.08)' }}>
                  <svg className="w-7 h-7" fill="none" stroke="#00E5FF" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-white font-semibold text-base mb-1">Nenhum concorrente cadastrado</p>
                <p className="text-zinc-500 text-sm mb-6 text-center max-w-xs">
                  Adicione URLs de concorrentes para monitorar preços automaticamente.
                </p>
                <button onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ background: '#00E5FF', color: '#000' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar primeiro concorrente
                </button>
              </div>
            )}

            {!loading && filtered.length === 0 && competitors.length > 0 && (
              <div className="rounded-2xl border flex items-center justify-center py-12"
                style={{ background: '#111114', borderColor: '#1e1e24' }}>
                <p className="text-zinc-500 text-sm">Nenhum concorrente com os filtros selecionados.</p>
              </div>
            )}

            {/* Product cards */}
            {!loading && groups.map(group => (
              <ProductCard
                key={group.productId}
                group={group}
                onVerify={verifySingle}
                onDelete={deleteCompetitor}
                onToggleStatus={toggleStatus}
                onBell={setAlertTarget}
              />
            ))}

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
            toast('Concorrente adicionado com sucesso!')
          }}
        />
      )}

      {alertTarget && (
        <AlertModal competitor={alertTarget} onClose={() => setAlertTarget(null)} />
      )}

      <Toasts toasts={toasts} />
    </>
  )
}
