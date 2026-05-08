'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, AlertCircle, Calendar, TrendingUp } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface SupplierAggregate {
  supplier_id: string
  supplier_name: string
  orders_count: number
  units: number
  gross_total: number
  cmv: number
  margin: number
}

interface TodayOrder {
  id: string
  marketplace: string
  partner_sku: string
  quantity: number
  sale_price: number | null
  estimated_cost_at_oc: number | null
  estimated_margin: number | null
  dropship_status: string
  identified_at: string
  shipped_at: string | null
  suppliers: { id: string; name: string } | null
  products: { id: string; name: string; photo_urls: string[] | null } | null
}

interface TodayResponse {
  orders: TodayOrder[]
  by_supplier: SupplierAggregate[]
}

export default function TodayPage() {
  const supabase = useMemo(() => createClient(), [])

  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Não autenticado')
      const res = await fetch(`${BACKEND}/dropship/today`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
      setData(null)
    } finally { setLoading(false) }
  }, [supabase])

  useEffect(() => { load() }, [load])

  const orders = data?.orders ?? []
  const bySupplier = data?.by_supplier ?? []
  const totalOrders = orders.length
  const totalUnits = orders.reduce((s, o) => s + Number(o.quantity ?? 0), 0)
  const totalGross = bySupplier.reduce((s, b) => s + b.gross_total, 0)
  const totalCmv = bySupplier.reduce((s, b) => s + b.cmv, 0)
  const totalMargin = bySupplier.reduce((s, b) => s + b.margin, 0)

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/dropship" className="text-zinc-500 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">Vendas Dropship Hoje</h1>
          <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-1.5">
            <Calendar size={12} />
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
      </div>

      {err && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {err}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi label="Pedidos" value={loading ? '…' : totalOrders} />
        <Kpi label="Unidades" value={loading ? '…' : totalUnits} />
        <Kpi label="Receita" value={loading ? '…' : fmtBrl(totalGross)} />
        <Kpi label="CMV" value={loading ? '…' : fmtBrl(totalCmv)} accent="#a1a1aa" />
        <Kpi
          label="Margem"
          value={loading ? '…' : fmtBrl(totalMargin)}
          accent={totalMargin >= 0 ? '#22c55e' : '#f87171'}
        />
      </div>

      {/* Por parceiro */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Por Parceiro</h2>
      {loading ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          Carregando...
        </div>
      ) : bySupplier.length === 0 ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <TrendingUp size={28} className="mx-auto mb-2 text-zinc-700" />
          Nenhuma venda dropship hoje ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {bySupplier.map(b => (
            <SupplierCard key={b.supplier_id} agg={b} />
          ))}
        </div>
      )}

      {/* Lista de pedidos */}
      {orders.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 mt-6">
            Pedidos do Dia ({orders.length})
          </h2>
          <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #1a1a1f' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
                  {['Hora', 'Parceiro', 'Produto', 'SKU', 'Qtd', 'Preço', 'Margem', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {new Date(o.identified_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{o.suppliers?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-white text-xs truncate max-w-[300px]">{o.products?.name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-zinc-400">{o.partner_sku}</td>
                    <td className="px-4 py-3 text-zinc-300">{o.quantity}</td>
                    <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(Number(o.sale_price ?? 0))}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: Number(o.estimated_margin ?? 0) > 0 ? '#22c55e' : '#f87171' }}>
                      {fmtBrl(Number(o.estimated_margin ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{o.dropship_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function SupplierCard({ agg }: { agg: SupplierAggregate }) {
  const marginPct = agg.gross_total > 0 ? (agg.margin / agg.gross_total) * 100 : 0
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-white">{agg.supplier_name}</p>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: 'rgba(0,229,255,0.10)',
            color: '#00E5FF',
            border: '1px solid rgba(0,229,255,0.3)',
          }}>
          {agg.orders_count} pedido{agg.orders_count !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-xs text-zinc-500">Receita</p>
          <p className="text-sm font-semibold text-white">{fmtBrl(agg.gross_total)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">CMV</p>
          <p className="text-sm font-semibold text-zinc-400">{fmtBrl(agg.cmv)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Margem</p>
          <p className="text-sm font-semibold" style={{ color: agg.margin >= 0 ? '#22c55e' : '#f87171' }}>
            {fmtBrl(agg.margin)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">{agg.units} {agg.units === 1 ? 'unidade' : 'unidades'}</span>
        <span style={{ color: marginPct > 0 ? '#22c55e' : '#f87171' }}>
          {marginPct.toFixed(1)}% margem
        </span>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
