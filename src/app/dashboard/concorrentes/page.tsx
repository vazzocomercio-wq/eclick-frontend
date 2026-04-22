'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Competitor, PM, priceDiff, brl, relativeTime } from './types'
import AddCompetitorModal from './_components/AddCompetitorModal'

const SCRAPER = process.env.NEXT_PUBLIC_SCRAPER_URL ?? 'https://price-scraper-production-2e7c.up.railway.app'

// ── toast ─────────────────────────────────────────────────────────────────────

type Toast = { id: number; msg: string; type: 'success' | 'error' | 'info' }

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

// ── diff badge ────────────────────────────────────────────────────────────────

function DiffBadge({ diff }: { diff: number | null }) {
  if (diff == null) return <span className="text-zinc-600 text-xs">—</span>
  const cheaper = diff < 0
  const color = cheaper ? '#f87171' : diff > 0 ? '#34d399' : '#71717a'
  const sign = diff > 0 ? '+' : ''
  return (
    <span className="text-xs font-semibold" style={{ color }}>
      {sign}{diff.toFixed(1)}%
    </span>
  )
}

// ── metric card ───────────────────────────────────────────────────────────────

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

// ── platform thumbnail ────────────────────────────────────────────────────────

function PlatformThumb({ platform, photoUrl, size = 48 }: {
  platform: string
  photoUrl: string | null
  size?: number
}) {
  const pm = PM[platform]
  const sz = `${size}px`
  const radius = 10

  if (photoUrl) {
    return (
      <div style={{ width: sz, height: sz, borderRadius: radius, overflow: 'hidden', border: '1px solid #2e2e33', flexShrink: 0 }}>
        <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  if (pm) {
    return (
      <div style={{
        width: sz, height: sz, borderRadius: radius,
        background: pm.bg, color: pm.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 900, flexShrink: 0,
      }}>
        {platform.toUpperCase().slice(0, 2)}
      </div>
    )
  }
  return (
    <div style={{
      width: sz, height: sz, borderRadius: radius,
      background: '#1c1c1f', border: '1px solid #2e2e33',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="20" height="20" fill="none" stroke="#52525b" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  )
}

// ── product group (tbody) ─────────────────────────────────────────────────────

type ProductGroup = {
  productId: string
  productName: string
  competitors: Competitor[]
}

function ProductGroupBody({
  group, expanded, onToggle, onVerify, onDetail, onDelete, onToggleStatus,
}: {
  group: ProductGroup
  expanded: boolean
  onToggle: () => void
  onVerify: (c: Competitor) => Promise<void>
  onDetail: (id: string) => void
  onDelete: (id: string) => void
  onToggleStatus: (c: Competitor) => void
}) {
  const myPrice = group.competitors[0]?.my_price ?? null
  const activePrices = group.competitors
    .filter(c => c.current_price != null)
    .map(c => c.current_price as number)
    .sort((a, b) => a - b)
  const minCompPrice = activePrices[0] ?? null
  const maxCompPrice = activePrices[activePrices.length - 1] ?? null
  const cheaperCount = myPrice != null ? activePrices.filter(p => p < myPrice).length : null
  const position = cheaperCount != null ? cheaperCount + 1 : null
  const diffToCheapest = priceDiff(minCompPrice, myPrice)
  const productPhoto = group.competitors[0]?.product_photo_urls?.[0] ?? null

  return (
    <tbody>
      {/* Product header row */}
      <tr
        onClick={onToggle}
        style={{
          background: '#0d0d10',
          borderBottom: '1px solid #2e2e33',
          cursor: 'pointer',
        }}
      >
        <td colSpan={7} className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div style={{
              width: 40, height: 40, borderRadius: 10, overflow: 'hidden',
              border: '1px solid #2e2e33', flexShrink: 0,
              background: '#1c1c1f', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {productPhoto
                ? <img src={productPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <svg width="18" height="18" fill="none" stroke="#52525b" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{group.productName}</p>
              <p className="text-zinc-500 text-[11px]">{brl(myPrice)}</p>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}>
              {group.competitors.length} concorrente{group.competitors.length !== 1 ? 's' : ''}
            </span>
            <svg
              style={{
                width: 16, height: 16, color: '#52525b', flexShrink: 0,
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </td>
      </tr>

      {expanded && (
        <>
          {/* Summary bar */}
          <tr style={{ background: '#0a0a0d', borderBottom: '1px solid #1e1e24' }}>
            <td colSpan={7} className="px-6 py-2.5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px]">
                {minCompPrice != null && (
                  <span className="text-zinc-400">
                    Mais barato: <span className="text-white font-semibold">{brl(minCompPrice)}</span>
                  </span>
                )}
                {maxCompPrice != null && (
                  <span className="text-zinc-400">
                    Mais caro: <span className="text-white font-semibold">{brl(maxCompPrice)}</span>
                  </span>
                )}
                {position != null && (
                  <span className="text-zinc-400">
                    Nossa posição: <span className="text-white font-semibold">{position}º mais barato</span>
                  </span>
                )}
                {diffToCheapest != null && (
                  <span className="text-zinc-400 flex items-center gap-1">
                    Diff p/ mais barato: <DiffBadge diff={diffToCheapest} />
                  </span>
                )}
              </div>
            </td>
          </tr>

          {group.competitors.map(c => (
            <CompetitorRow
              key={c.id}
              c={c}
              onVerify={() => onVerify(c)}
              onDetail={() => onDetail(c.id)}
              onDelete={() => onDelete(c.id)}
              onToggle={() => onToggleStatus(c)}
            />
          ))}
        </>
      )}
    </tbody>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function ConcorrentesPage() {
  const router = useRouter()
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // filters
  const [filterProduct, setFilterProduct] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterPrice, setFilterPrice] = useState<'all' | 'cheaper' | 'expensive' | 'equal'>('all')

  // bulk update
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

    const mapped = (data ?? []).map((c: Record<string, unknown>) => {
      const prod = c.products as { name: string; photo_urls: string[] | null } | null
      return {
        ...(c as Competitor),
        product_name: prod?.name ?? '—',
        product_photo_urls: prod?.photo_urls ?? null,
      }
    })

    setCompetitors(mapped)
    setExpanded(new Set(mapped.map(c => c.product_id)))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── metrics ────────────────────────────────────────────────────────────────

  const active = competitors.filter(c => c.status === 'active')
  const cheaper = competitors.filter(c => {
    const d = priceDiff(c.current_price, c.my_price)
    return d != null && d < 0
  })
  const expensive = competitors.filter(c => {
    const d = priceDiff(c.current_price, c.my_price)
    return d != null && d > 0
  })
  const lastChecked = competitors
    .map(c => c.last_checked)
    .filter(Boolean)
    .sort()
    .pop()

  // ── filter & group ────────────────────────────────────────────────────────

  const uniqueProducts = useMemo(
    () => [...new Map(competitors.map(c => [c.product_id, c.product_name])).entries()],
    [competitors]
  )

  const filtered = useMemo(() => competitors.filter(c => {
    if (filterProduct !== 'all' && c.product_id !== filterProduct) return false
    if (filterPlatform !== 'all' && c.platform !== filterPlatform) return false
    if (filterPrice !== 'all') {
      const d = priceDiff(c.current_price, c.my_price)
      if (filterPrice === 'cheaper' && !(d != null && d < 0)) return false
      if (filterPrice === 'expensive' && !(d != null && d > 0)) return false
      if (filterPrice === 'equal' && !(d != null && Math.abs(d) < 0.5)) return false
    }
    return true
  }), [competitors, filterProduct, filterPlatform, filterPrice])

  const groups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>()
    for (const c of filtered) {
      if (!map.has(c.product_id)) {
        map.set(c.product_id, { productId: c.product_id, productName: c.product_name ?? '—', competitors: [] })
      }
      map.get(c.product_id)!.competitors.push(c)
    }
    return [...map.values()]
  }, [filtered])

  const competitorCounts = useMemo(() => {
    const map: Record<string, number> = {}
    competitors.forEach(c => { map[c.product_id] = (map[c.product_id] ?? 0) + 1 })
    return map
  }, [competitors])

  function toggleExpanded(productId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(productId) ? next.delete(productId) : next.add(productId)
      return next
    })
  }

  // ── single verify ─────────────────────────────────────────────────────────

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
      toast(`${c.title ?? 'Concorrente'} atualizado — ${brl(price)}`)
    } catch {
      toast('Falha ao verificar preço.', 'error')
    }
  }, [toast])

  // ── update all ────────────────────────────────────────────────────────────

  async function updateAll() {
    const targets = competitors.filter(c => c.status === 'active')
    if (targets.length === 0) { toast('Nenhum concorrente ativo.', 'info'); return }
    setUpdating(true)
    setUpdateProgress({ done: 0, total: targets.length })
    const supabase = createClient()

    for (let i = 0; i < targets.length; i++) {
      const c = targets[i]
      try {
        const res = await fetch(`${SCRAPER}/scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

  // ── delete ────────────────────────────────────────────────────────────────

  async function deleteCompetitor(id: string) {
    const supabase = createClient()
    await supabase.from('competitors').delete().eq('id', id)
    setCompetitors(prev => prev.filter(c => c.id !== id))
    toast('Concorrente removido.')
  }

  // ── toggle status ─────────────────────────────────────────────────────────

  async function toggleStatus(c: Competitor) {
    const next = c.status === 'active' ? 'paused' : 'active'
    const supabase = createClient()
    await supabase.from('competitors').update({ status: next }).eq('id', c.id)
    setCompetitors(prev => prev.map(x => x.id === c.id ? { ...x, status: next } : x))
  }

  // ── render ────────────────────────────────────────────────────────────────

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
                <span className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}>
                  {updateProgress.done}/{updateProgress.total} atualizados
                </span>
              )}
              <button
                onClick={updateAll}
                disabled={updating || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50"
                style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
                {updating
                  ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                }
                {updating ? 'Atualizando…' : 'Atualizar todos'}
              </button>
              <button
                onClick={() => setShowAdd(true)}
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

            {/* Metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Total monitorados" value={competitors.length} />
              <MetricCard
                label="Mais baratos que eu"
                value={cheaper.length}
                sub="concorrentes com preço menor"
                accent={cheaper.length > 0 ? '#f87171' : undefined}
              />
              <MetricCard
                label="Mais caros que eu"
                value={expensive.length}
                sub="concorrentes com preço maior"
                accent={expensive.length > 0 ? '#34d399' : undefined}
              />
              <MetricCard
                label="Última atualização"
                value={relativeTime(lastChecked ?? null)}
                sub={`${active.length} ativo${active.length !== 1 ? 's' : ''}`}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-[13px] border outline-none transition-all"
                style={{ background: '#111114', borderColor: '#3f3f46', color: '#a1a1aa' }}>
                <option value="all">Todos os produtos</option>
                {uniqueProducts.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>

              <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-[13px] border outline-none transition-all"
                style={{ background: '#111114', borderColor: '#3f3f46', color: '#a1a1aa' }}>
                <option value="all">Todas as plataformas</option>
                {Object.entries(PM).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>

              {(['all', 'cheaper', 'expensive', 'equal'] as const).map(f => {
                const labels = { all: 'Todos', cheaper: 'Mais baratos', expensive: 'Mais caros', equal: 'Preço igual' }
                const isActive = filterPrice === f
                return (
                  <button key={f} onClick={() => setFilterPrice(f)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all"
                    style={{
                      background: isActive ? 'rgba(0,229,255,0.08)' : 'transparent',
                      borderColor: isActive ? '#00E5FF' : '#3f3f46',
                      color: isActive ? '#00E5FF' : '#71717a',
                    }}>
                    {labels[f]}
                  </button>
                )
              })}
            </div>

            {/* Empty state */}
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

            {/* Grouped accordion table */}
            {(loading || groups.length > 0) && (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1e1e24' }}>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse" style={{ minWidth: 760 }}>
                    <thead>
                      <tr style={{ background: '#0c0c0f', borderBottom: '1px solid #1e1e24' }}>
                        {['CONCORRENTE', 'PREÇO DELES', 'NOSSO PREÇO', 'DIFERENÇA', 'ÚLTIMA VER.', 'STATUS', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                            style={{ color: '#52525b' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    {loading
                      ? <tbody>
                          {[...Array(4)].map((_, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #1e1e24' }}>
                              {[...Array(7)].map((_, j) => (
                                <td key={j} className="px-4 py-4">
                                  <div className="h-3 rounded animate-pulse w-3/4" style={{ background: '#1e1e24' }} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      : groups.map(group => (
                          <ProductGroupBody
                            key={group.productId}
                            group={group}
                            expanded={expanded.has(group.productId)}
                            onToggle={() => toggleExpanded(group.productId)}
                            onVerify={verifySingle}
                            onDetail={id => router.push(`/dashboard/concorrentes/${id}`)}
                            onDelete={deleteCompetitor}
                            onToggleStatus={toggleStatus}
                          />
                        ))
                    }
                  </table>
                </div>
              </div>
            )}

            {!loading && filtered.length === 0 && competitors.length > 0 && (
              <div className="rounded-2xl border flex items-center justify-center py-12"
                style={{ background: '#111114', borderColor: '#1e1e24' }}>
                <p className="text-zinc-500 text-sm">Nenhum concorrente com os filtros selecionados.</p>
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
            toast('Concorrente adicionado com sucesso!')
          }}
        />
      )}

      <Toasts toasts={toasts} />
    </>
  )
}

// ── table row component ───────────────────────────────────────────────────────

function CompetitorRow({ c, onVerify, onDetail, onDelete, onToggle }: {
  c: Competitor
  onVerify: () => Promise<void>
  onDetail: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const [hover, setHover] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const pm = PM[c.platform]
  const diff = priceDiff(c.current_price, c.my_price)

  async function handleVerify() {
    setVerifying(true)
    await onVerify()
    setVerifying(false)
  }

  return (
    <tr
      style={{
        background: hover ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderBottom: '1px solid #1e1e24',
        transition: 'background 0.15s',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Concorrente with photo thumbnail */}
      <td className="px-4 py-3 max-w-[280px]">
        <div className="flex items-center gap-2.5 pl-2">
          <PlatformThumb platform={c.platform} photoUrl={c.photo_url} size={48} />
          <div className="min-w-0">
            {pm && (
              <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded mb-0.5"
                style={{ background: pm.bg, color: pm.fg }}>
                {pm.label}
              </span>
            )}
            <p className="text-white text-[13px] truncate leading-tight">{c.title ?? c.url}</p>
            {c.seller && <p className="text-zinc-500 text-[11px] truncate">{c.seller}</p>}
          </div>
        </div>
      </td>

      {/* Preço deles */}
      <td className="px-4 py-3">
        <p className="text-white font-bold">{brl(c.current_price)}</p>
      </td>

      {/* Nosso preço */}
      <td className="px-4 py-3">
        <p className="text-zinc-400 font-medium">{brl(c.my_price)}</p>
      </td>

      {/* Diferença */}
      <td className="px-4 py-3">
        <DiffBadge diff={diff} />
      </td>

      {/* Última verificação */}
      <td className="px-4 py-3">
        <p className="text-zinc-500 text-[12px]">{relativeTime(c.last_checked)}</p>
      </td>

      {/* Status toggle */}
      <td className="px-4 py-3">
        <button onClick={onToggle}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all"
          style={c.status === 'active'
            ? { background: 'rgba(52,211,153,0.1)', color: '#34d399' }
            : { background: 'rgba(113,113,122,0.15)', color: '#71717a' }
          }>
          {c.status === 'active' ? 'Ativo' : 'Pausado'}
        </button>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={handleVerify} disabled={verifying} title="Verificar agora"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40"
            style={{ color: '#52525b' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#00E5FF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}>
            {verifying
              ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            }
          </button>
          <button onClick={onDetail} title="Ver histórico"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#52525b' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a1a1aa')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button onClick={onDelete} title="Excluir"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#52525b' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}
