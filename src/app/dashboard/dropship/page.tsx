'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Truck, Building2, Link2, Package, AlertTriangle, ShoppingCart, Calendar,
  ChevronRight, RefreshCw, FileText, Eye,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface DashboardData {
  kpis: {
    active_partners: number
    active_skus: number
    shipped_today: number
    today_value: number
    today_cmv: number
    today_margin: number
    on_hold_count: number
    out_of_stock_skus: number
  }
  recent_orders: Array<{
    id: string
    marketplace: string
    partner_sku: string
    quantity: number
    sale_price: number | null
    estimated_margin: number | null
    dropship_status: string
    identified_at: string
    suppliers: { name: string } | null
    products: { name: string } | null
  }>
}

export default function DropshipHomePage() {
  const supabase = useMemo(() => createClient(), [])

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch(`${BACKEND}/dropship/dashboard`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch { /* keep stale */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [supabase])

  useEffect(() => { load() }, [load])

  const kpis = data?.kpis

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Dropship Center</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Gerencie parceiros, OCs diárias, devoluções e abatimentos
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors"
          style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* KPIs primários (4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Kpi
          label="Parceiros Ativos"
          value={loading ? '…' : kpis?.active_partners ?? 0}
          icon={<Building2 size={14} />}
        />
        <Kpi
          label="SKUs Dropship"
          value={loading ? '…' : kpis?.active_skus ?? 0}
          icon={<Package size={14} />}
        />
        <Kpi
          label="Despachados Hoje"
          value={loading ? '…' : kpis?.shipped_today ?? 0}
          icon={<Truck size={14} />}
          accent="#22c55e"
        />
        <Kpi
          label="Receita Hoje"
          value={loading ? '…' : fmtBrl(kpis?.today_value ?? 0)}
          icon={<ShoppingCart size={14} />}
        />
      </div>

      {/* KPIs secundários (4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiSmall label="CMV Hoje" value={loading ? '…' : fmtBrl(kpis?.today_cmv ?? 0)} />
        <KpiSmall
          label="Margem Hoje"
          value={loading ? '…' : fmtBrl(kpis?.today_margin ?? 0)}
          accent={(kpis?.today_margin ?? 0) >= 0 ? '#22c55e' : '#f87171'}
        />
        <KpiSmall
          label="Em Hold"
          value={loading ? '…' : kpis?.on_hold_count ?? 0}
          accent={(kpis?.on_hold_count ?? 0) > 0 ? '#fcd34d' : undefined}
        />
        <KpiSmall
          label="Sem Estoque"
          value={loading ? '…' : kpis?.out_of_stock_skus ?? 0}
          accent={(kpis?.out_of_stock_skus ?? 0) > 0 ? '#f87171' : undefined}
        />
      </div>

      {/* alerts */}
      {!loading && (kpis?.on_hold_count ?? 0) > 0 && (
        <Link
          href="/dashboard/dropship/orders?status=on_hold"
          className="block rounded-xl p-3 mb-3 flex items-center gap-3 transition-colors hover:bg-[#1a1a1f]"
          style={{ background: 'rgba(252,211,77,0.05)', border: '1px solid rgba(252,211,77,0.2)' }}
        >
          <AlertTriangle size={18} style={{ color: '#fcd34d' }} />
          <p className="text-sm text-zinc-300 flex-1">
            <strong className="text-white">{kpis?.on_hold_count} pedido{(kpis?.on_hold_count ?? 0) > 1 ? 's' : ''}</strong> em hold — clique pra revisar
          </p>
          <ChevronRight size={14} className="text-zinc-500" />
        </Link>
      )}
      {!loading && (kpis?.out_of_stock_skus ?? 0) > 0 && (
        <div
          className="rounded-xl p-3 mb-3 flex items-center gap-3"
          style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)' }}
        >
          <AlertTriangle size={18} style={{ color: '#f87171' }} />
          <p className="text-sm text-zinc-300 flex-1">
            <strong className="text-white">{kpis?.out_of_stock_skus} SKUs</strong> ativos sem estoque do parceiro — anúncios podem ficar pendurados
          </p>
        </div>
      )}

      {/* Nav cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <NavCard
          href="/dashboard/dropship/partners"
          icon={<Building2 size={18} />}
          title="Parceiros"
          description="Cadastre fornecedores dropship: cutoff, integração, estratégia"
        />
        <NavCard
          href="/dashboard/dropship/account-suppliers"
          icon={<Link2 size={18} />}
          title="Vínculo Contas"
          description="Mapeie qual parceiro despacha pelos pedidos de cada conta"
        />
        <NavCard
          href="/dashboard/dropship/orders"
          icon={<ShoppingCart size={18} />}
          title="Pedidos"
          description="Pedidos identificados como dropship (cron @5min)"
        />
        <NavCard
          href="/dashboard/dropship/orders/today"
          icon={<Calendar size={18} />}
          title="Vendas Hoje"
          description="Resumo do dia agregado por parceiro"
        />
        <NavCard
          href="/dashboard/dropship/oc"
          icon={<FileText size={18} />}
          title="Ordens de Compra"
          description="OCs geradas automaticamente às 22h por parceiro"
        />
        <NavCard
          href="/dashboard/dropship/oc/preview"
          icon={<Eye size={18} />}
          title="Prévia OC"
          description="Visualize quais OCs serão geradas no próximo cron"
        />
      </div>

      {/* Recent orders */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Pedidos Recentes</h2>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1f' }}>
        {loading ? (
          <div className="px-4 py-12 text-center text-zinc-500 text-sm">Carregando...</div>
        ) : !data || data.recent_orders.length === 0 ? (
          <div className="px-4 py-12 text-center text-zinc-500 text-sm">
            Nenhum pedido dropship ainda.{' '}
            <Link href="/dashboard/dropship/account-suppliers" style={{ color: '#00E5FF' }}>
              Verifique os vínculos conta↔parceiro
            </Link>{' '}
            pra começar.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
                {['Quando', 'Parceiro', 'Produto', 'SKU', 'Qtd', 'Preço', 'Margem', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recent_orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                  <td className="px-4 py-2 text-zinc-400 text-xs">{fmtRelative(o.identified_at)}</td>
                  <td className="px-4 py-2 text-zinc-300">{o.suppliers?.name ?? '—'}</td>
                  <td className="px-4 py-2">
                    <p className="text-white text-xs truncate max-w-[280px]">{o.products?.name ?? '—'}</p>
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-zinc-500">{o.partner_sku}</td>
                  <td className="px-4 py-2 text-zinc-300 text-xs">{o.quantity}</td>
                  <td className="px-4 py-2 text-zinc-300 text-xs">{fmtBrl(Number(o.sale_price ?? 0))}</td>
                  <td className="px-4 py-2 text-xs" style={{ color: Number(o.estimated_margin ?? 0) > 0 ? '#22c55e' : '#f87171' }}>
                    {fmtBrl(Number(o.estimated_margin ?? 0))}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-400">{o.dropship_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Components ─────────────────────────────────────────────────────────────────

function Kpi({
  label, value, icon, accent,
}: { label: string; value: string | number; icon?: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-zinc-500">{label}</p>
        {icon && <span className="text-zinc-500">{icon}</span>}
      </div>
      <p className="text-2xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function KpiSmall({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-base font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function NavCard({
  href, icon, title, description,
}: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link href={href}>
      <div
        className="rounded-xl p-4 h-full transition-all cursor-pointer hover:bg-[#1a1a1f]"
        style={{ background: '#111114', border: '1px solid #1a1a1f' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF' }}
          >
            {icon}
          </div>
          <h3 className="font-semibold text-white text-sm">{title}</h3>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
      </div>
    </Link>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtRelative(d: string) {
  const ms = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h`
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
