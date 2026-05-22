'use client'

/**
 * Analytics da Vitrine — admin UI (AI).
 *
 * Funil de conversão (visitas → produto → carrinho → checkout → pedido → pago),
 * receita/AOV, top produtos (vistos × vendidos), origem do tráfego, tendência
 * diária e carrinhos abandonados/recuperados.
 *
 * GET /storefront-analytics?days=
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  BarChart3, Loader2, ChevronLeft, AlertCircle, Eye, ShoppingCart, CreditCard,
  DollarSign, TrendingUp, Users, Package, Compass, RotateCcw,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Overview {
  rangeDays: number
  funnel:    { visits: number; productViews: number; addToCart: number; beginCheckout: number; orders: number; paid: number }
  conversion: { viewRate: number; cartRate: number; checkoutRate: number; paidRate: number; overall: number }
  revenue:   { paidRevenue: number; paidCount: number; ordersCount: number; aov: number }
  topViewed: Array<{ productId: string; name: string; views: number }>
  topSold:   Array<{ productId: string; name: string; qty: number; revenue: number }>
  sources:   Array<{ source: string; sessions: number }>
  trend:     Array<{ date: string; visits: number; orders: number; revenue: number }>
  carts:     { abandoned: number; recovered: number; recoveryRate: number }
}

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()
      const res = await fetch(`${BACKEND}/storefront-analytics?days=${days}`, {
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [days])

  useEffect(() => { void load() }, [load])

  const f = data?.funnel
  const c = data?.conversion
  const maxTrendV = Math.max(1, ...(data?.trend ?? []).map(t => t.visits))
  const maxTrendR = Math.max(1, ...(data?.trend ?? []).map(t => t.revenue))

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
            <ChevronLeft size={12} /> Voltar pro hub
          </Link>
          <h1 className="text-white text-3xl font-semibold flex items-center gap-2"><BarChart3 size={24} /> Analytics da vitrine</h1>
          <p className="text-xs text-zinc-500 mt-1">Funil de conversão · receita · produtos · origem do tráfego</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
          {[7, 30, 90].map(n => (
            <button key={n} onClick={() => setDays(n)}
              className="text-xs px-3 py-1.5 rounded font-medium"
              style={{ background: days === n ? '#00E5FF' : 'transparent', color: days === n ? '#0a0a0e' : '#a1a1aa', minHeight: 32 }}>
              {n} dias
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400 flex items-center gap-2"><AlertCircle size={14} /> {error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500"><Loader2 className="animate-spin inline-block" size={20} /></div>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Kpi icon={<Users size={16} />}      label="Visitas"          value={String(f?.visits ?? 0)}            color="#06b6d4" />
            <Kpi icon={<DollarSign size={16} />}  label="Receita (paga)"   value={BRL(data.revenue.paidRevenue)}     color="#22c55e" />
            <Kpi icon={<CreditCard size={16} />}  label="Ticket médio"     value={BRL(data.revenue.aov)}             color="#a78bfa" />
            <Kpi icon={<TrendingUp size={16} />}  label="Conversão geral"  value={`${c?.overall ?? 0}%`}             color="#f472b6" hint="visitas → pago" />
          </div>

          {/* Funil */}
          <div className="rounded-lg p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            <h2 className="text-white font-semibold mb-4">Funil de conversão</h2>
            <div className="space-y-2.5">
              <FunnelStep icon={<Users size={14} />}        label="Visitas"            value={f?.visits ?? 0}        max={f?.visits ?? 1} color="#06b6d4" />
              <FunnelStep icon={<Eye size={14} />}          label="Viram um produto"   value={f?.productViews ?? 0}  max={f?.visits ?? 1} color="#3b82f6" rate={c?.viewRate} />
              <FunnelStep icon={<ShoppingCart size={14} />} label="Add ao carrinho"    value={f?.addToCart ?? 0}     max={f?.visits ?? 1} color="#6366f1" rate={c?.cartRate} />
              <FunnelStep icon={<CreditCard size={14} />}   label="Iniciaram checkout" value={f?.beginCheckout ?? 0} max={f?.visits ?? 1} color="#a855f7" rate={c?.checkoutRate} />
              <FunnelStep icon={<Package size={14} />}      label="Pedidos"            value={f?.orders ?? 0}        max={f?.visits ?? 1} color="#eab308" />
              <FunnelStep icon={<DollarSign size={14} />}   label="Pagos"              value={f?.paid ?? 0}          max={f?.visits ?? 1} color="#22c55e" rate={c?.paidRate} />
            </div>
            <p className="text-[11px] mt-3" style={{ color: '#52525b' }}>
              Visitas/views/carrinho/checkout vêm do comportamento na vitrine; pedidos/pagos vêm dos pedidos reais. O % é a taxa de passagem pra etapa.
            </p>
          </div>

          {/* Top produtos */}
          <div className="grid gap-3 md:grid-cols-2">
            <ListCard title="Mais vistos" icon={<Eye size={15} />} empty="Sem visualizações ainda."
              rows={data.topViewed.map(p => ({ key: p.productId, name: p.name, right: `${p.views} views`, bar: p.views }))} />
            <ListCard title="Mais vendidos" icon={<Package size={15} />} empty="Sem vendas ainda."
              rows={data.topSold.map(p => ({ key: p.productId, name: p.name, right: `${p.qty}un · ${BRL(p.revenue)}`, bar: p.qty }))} />
          </div>

          {/* Origem + carrinhos */}
          <div className="grid gap-3 md:grid-cols-2">
            <ListCard title="Origem do tráfego" icon={<Compass size={15} />} empty="Sem dados de origem ainda."
              rows={data.sources.map(s => ({ key: s.source, name: s.source, right: `${s.sessions}`, bar: s.sessions }))} />
            <div className="rounded-lg p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
              <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><RotateCcw size={15} /> Carrinhos</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Mini label="Abandonados" value={String(data.carts.abandoned)} />
                <Mini label="Recuperados" value={String(data.carts.recovered)} color="#22c55e" />
                <Mini label="Taxa" value={`${data.carts.recoveryRate}%`} color="#06b6d4" />
              </div>
            </div>
          </div>

          {/* Tendência */}
          <div className="rounded-lg p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            <h2 className="text-white font-semibold mb-4">Tendência diária</h2>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {data.trend.map(t => (
                <div key={t.date} className="flex-1 flex flex-col justify-end items-center gap-px" title={`${t.date} · ${t.visits} visitas · ${BRL(t.revenue)}`}>
                  <div style={{ width: '100%', maxWidth: 14, height: `${(t.revenue / maxTrendR) * 60}%`, background: '#22c55e', borderRadius: '2px 2px 0 0', minHeight: t.revenue > 0 ? 2 : 0 }} />
                  <div style={{ width: '100%', maxWidth: 14, height: `${(t.visits / maxTrendV) * 50}%`, background: '#06b6d4', borderRadius: '2px 2px 0 0', minHeight: t.visits > 0 ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ color: '#71717a' }}>
              <span className="inline-flex items-center gap-1"><span style={{ width: 10, height: 10, background: '#06b6d4', display: 'inline-block', borderRadius: 2 }} /> Visitas</span>
              <span className="inline-flex items-center gap-1"><span style={{ width: 10, height: 10, background: '#22c55e', display: 'inline-block', borderRadius: 2 }} /> Receita</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Kpi({ icon, label, value, color, hint }: { icon: React.ReactNode; label: string; value: string; color: string; hint?: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <p className="text-xs uppercase tracking-wide font-medium flex items-center gap-1.5" style={{ color: '#71717a' }}>
        <span style={{ color }}>{icon}</span> {label}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      {hint && <p className="text-[10px] mt-0.5" style={{ color: '#52525b' }}>{hint}</p>}
    </div>
  )
}

function FunnelStep({ icon, label, value, max, color, rate }: {
  icon: React.ReactNode; label: string; value: number; max: number; color: string; rate?: number
}) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 2
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 shrink-0" style={{ width: 160, color: '#a1a1aa', fontSize: 13 }}>
        <span style={{ color }}>{icon}</span> {label}
      </div>
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: '#18181b', height: 22 }}>
        <div style={{ width: `${w}%`, height: '100%', background: color, opacity: 0.85, transition: 'width 300ms' }} />
      </div>
      <div className="shrink-0 text-right" style={{ width: 110 }}>
        <span className="text-white font-semibold text-sm">{value.toLocaleString('pt-BR')}</span>
        {typeof rate === 'number' && <span className="text-[11px] ml-1.5" style={{ color: '#52525b' }}>{rate}%</span>}
      </div>
    </div>
  )
}

function ListCard({ title, icon, rows, empty }: {
  title: string; icon: React.ReactNode; empty: string
  rows: Array<{ key: string; name: string; right: string; bar: number }>
}) {
  const max = Math.max(1, ...rows.map(r => r.bar))
  return (
    <div className="rounded-lg p-5" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <h2 className="text-white font-semibold mb-3 flex items-center gap-2">{icon} {title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.key}>
              <div className="flex items-center justify-between gap-2 text-xs mb-0.5">
                <span className="text-white truncate" style={{ maxWidth: '70%' }}>{r.name}</span>
                <span style={{ color: '#a1a1aa' }}>{r.right}</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ background: '#18181b', height: 6 }}>
                <div style={{ width: `${(r.bar / max) * 100}%`, height: '100%', background: '#00E5FF', opacity: 0.7 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Mini({ label, value, color = '#fafafa' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded p-2" style={{ background: '#18181b' }}>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px]" style={{ color: '#71717a' }}>{label}</p>
    </div>
  )
}
