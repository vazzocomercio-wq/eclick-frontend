'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Competitor, priceDiff, brl, relativeTime } from './types'
import AddCompetitorModal from './_components/AddCompetitorModal'

const SCRAPER = process.env.NEXT_PUBLIC_SCRAPER_URL ?? 'https://price-scraper-production-2e7c.up.railway.app'

type Toast = { id: number; msg: string; type: 'success' | 'error' | 'info' }
type ProductGroup = { productId: string; productName: string; competitors: Competitor[] }

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

// ── ProductSummaryCard ────────────────────────────────────────────────────────

function ProductSummaryCard({ group }: { group: ProductGroup }) {
  const myPrice = group.competitors[0]?.my_price ?? null
  const withPrice = group.competitors.filter(c => c.current_price != null)
  const sorted = [...withPrice].sort((a, b) => a.current_price! - b.current_price!)
  const lowestPrice = sorted[0]?.current_price ?? null
  const cheaperN = myPrice != null ? sorted.filter(c => c.current_price! < myPrice).length : 0
  const isLeading = cheaperN === 0
  const diff = priceDiff(lowestPrice, myPrice)
  const lastUpdated = group.competitors.map(c => c.last_checked).filter(Boolean).sort().pop() ?? null
  const photo = group.competitors[0]?.product_photo_urls?.[0] ?? null

  return (
    <Link href={`/dashboard/concorrentes/${group.productId}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:border-zinc-600 active:scale-[0.99]"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ background: '#0d0d10', borderBottom: '1px solid #1e1e24' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, overflow: 'hidden',
            border: '1px solid #2e2e33', background: '#1c1c1f',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {photo
              ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <svg width="22" height="22" fill="none" stroke="#52525b" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{group.productName}</p>
            <p className="text-white text-lg font-bold leading-tight">{brl(myPrice)}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF' }}>
              {group.competitors.length} conc.
            </span>
            <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Position banner */}
        <div
          className="px-5 py-2.5 flex items-center gap-2"
          style={{
            background: isLeading ? 'rgba(34,197,94,0.06)' : 'rgba(234,88,12,0.07)',
            borderBottom: '1px solid #1e1e24',
          }}
        >
          <span style={{ fontSize: 14 }}>{isLeading ? '🏆' : '⚠️'}</span>
          <p className="text-[12px] font-semibold" style={{ color: isLeading ? '#4ade80' : '#fb923c' }}>
            {isLeading
              ? 'Liderando o preço'
              : `${cheaperN} concorrente${cheaperN !== 1 ? 's' : ''} mais barato${cheaperN !== 1 ? 's' : ''}`
            }
          </p>
          {!isLeading && lowestPrice != null && (
            <span className="ml-auto text-[11px] font-bold" style={{ color: '#fb923c' }}>
              Menor: {brl(lowestPrice)}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px" style={{ background: '#1e1e24' }}>
          <div className="px-4 py-3" style={{ background: '#111114' }}>
            <p className="text-zinc-600 text-[10px] mb-0.5">Menor preço</p>
            <p className="text-white text-sm font-bold">{brl(lowestPrice)}</p>
          </div>
          <div className="px-4 py-3" style={{ background: '#111114' }}>
            <p className="text-zinc-600 text-[10px] mb-0.5">Diferença</p>
            <p className="text-sm font-bold"
              style={{ color: diff == null ? '#52525b' : diff < 0 ? '#f87171' : '#34d399' }}>
              {diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`}
            </p>
          </div>
          <div className="px-4 py-3" style={{ background: '#111114' }}>
            <p className="text-zinc-600 text-[10px] mb-0.5">Atualizado</p>
            <p className="text-zinc-400 text-[11px] font-medium">{relativeTime(lastUpdated)}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConcorrentesPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
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
    const { data: member } = await supabase.from('organization_members').select('organization_id').maybeSingle()
    if (!member) { setLoading(false); return }
    setOrgId(member.organization_id)

    const { data } = await supabase
      .from('competitors')
      .select('id, product_id, organization_id, platform, url, title, seller, current_price, my_price, photo_url, status, last_checked, created_at, products(name, photo_urls)')
      .eq('organization_id', member.organization_id)
      .order('created_at', { ascending: false })

    setCompetitors(
      (data ?? []).map((c: Record<string, unknown>) => {
        const prod = c.products as { name: string; photo_urls: string[] | null } | null
        return { ...(c as Competitor), product_name: prod?.name ?? '—', product_photo_urls: prod?.photo_urls ?? null }
      })
    )
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const groups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>()
    for (const c of competitors) {
      if (!map.has(c.product_id)) map.set(c.product_id, { productId: c.product_id, productName: c.product_name ?? '—', competitors: [] })
      map.get(c.product_id)!.competitors.push(c)
    }
    return [...map.values()]
  }, [competitors])

  const competitorCounts = useMemo(() => {
    const map: Record<string, number> = {}
    competitors.forEach(c => { map[c.product_id] = (map[c.product_id] ?? 0) + 1 })
    return map
  }, [competitors])

  const active = competitors.filter(c => c.status === 'active')
  const cheaper = competitors.filter(c => { const d = priceDiff(c.current_price, c.my_price); return d != null && d < 0 })
  const lastChecked = competitors.map(c => c.last_checked).filter(Boolean).sort().pop()

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

  return (
    <>
      <div className="flex flex-col h-full" style={{ background: '#09090b' }}>

        {/* Top bar */}
        <div className="shrink-0 px-6 pt-6 pb-5" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-lg font-semibold">Monitor de Preços</h1>
              <p className="text-zinc-500 text-sm mt-0.5">
                {loading ? 'Carregando…' : `${groups.length} produto${groups.length !== 1 ? 's' : ''} monitorados`}
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
                Adicionar
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-6">

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Produtos monitorados" value={groups.length} />
              <MetricCard label="Concorrentes totais" value={competitors.length} />
              <MetricCard
                label="Mais baratos que eu"
                value={cheaper.length}
                sub="concorrentes com preço menor"
                accent={cheaper.length > 0 ? '#f87171' : undefined}
              />
              <MetricCard
                label="Última atualização"
                value={relativeTime(lastChecked ?? null)}
                sub={`${active.length} ativo${active.length !== 1 ? 's' : ''}`}
              />
            </div>

            {/* Loading skeleton */}
            {loading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden animate-pulse h-48"
                    style={{ background: '#111114', border: '1px solid #1e1e24' }} />
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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

            {/* Product grid */}
            {!loading && groups.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {groups.map(group => (
                  <ProductSummaryCard key={group.productId} group={group} />
                ))}
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
