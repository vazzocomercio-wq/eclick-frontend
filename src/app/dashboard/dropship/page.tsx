'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  Truck, Building2, Link2, Package, AlertTriangle, ShoppingCart, Calendar,
  ChevronRight, RefreshCw, FileText, Eye, Mail, MessageSquare, Settings,
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

interface SetupStatus {
  has_partners: boolean
  has_active_partners: boolean
  has_email_config: boolean
  has_whatsapp_config: boolean
  has_account_links: boolean
  blockers: string[]
}

export default function DropshipHomePage() {
  const t = useTranslations('dropship.home')
  const supabase = useMemo(() => createClient(), [])

  const [data, setData] = useState<DashboardData | null>(null)
  const [setup, setSetup] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [dashRes, setupRes] = await Promise.all([
        fetch(`${BACKEND}/dropship/dashboard`, { headers }),
        fetch(`${BACKEND}/dropship/setup-status`, { headers }),
      ])
      if (dashRes.ok) setData(await dashRes.json())
      if (setupRes.ok) setSetup(await setupRes.json())
    } catch { /* keep stale */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [supabase])

  useEffect(() => { load() }, [load])

  const kpis = data?.kpis

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors"
          style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {t('refresh')}
        </button>
      </div>

      {/* KPIs primários (4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Kpi
          label={t('kpi.activePartners')}
          value={loading ? '…' : kpis?.active_partners ?? 0}
          icon={<Building2 size={14} />}
        />
        <Kpi
          label={t('kpi.dropshipSkus')}
          value={loading ? '…' : kpis?.active_skus ?? 0}
          icon={<Package size={14} />}
        />
        <Kpi
          label={t('kpi.shippedToday')}
          value={loading ? '…' : kpis?.shipped_today ?? 0}
          icon={<Truck size={14} />}
          accent="#22c55e"
        />
        <Kpi
          label={t('kpi.revenueToday')}
          value={loading ? '…' : fmtBrl(kpis?.today_value ?? 0)}
          icon={<ShoppingCart size={14} />}
        />
      </div>

      {/* KPIs secundários (4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiSmall label={t('kpi.cmvToday')} value={loading ? '…' : fmtBrl(kpis?.today_cmv ?? 0)} />
        <KpiSmall
          label={t('kpi.marginToday')}
          value={loading ? '…' : fmtBrl(kpis?.today_margin ?? 0)}
          accent={(kpis?.today_margin ?? 0) >= 0 ? '#22c55e' : '#f87171'}
        />
        <KpiSmall
          label={t('kpi.onHold')}
          value={loading ? '…' : kpis?.on_hold_count ?? 0}
          accent={(kpis?.on_hold_count ?? 0) > 0 ? '#fcd34d' : undefined}
        />
        <KpiSmall
          label={t('kpi.outOfStock')}
          value={loading ? '…' : kpis?.out_of_stock_skus ?? 0}
          accent={(kpis?.out_of_stock_skus ?? 0) > 0 ? '#f87171' : undefined}
        />
      </div>

      {/* Onboarding checklist (se ainda faltando passos críticos) */}
      {!loading && setup && setup.blockers.length > 0 && (
        <OnboardingChecklist setup={setup} />
      )}

      {/* alerts */}
      {!loading && (kpis?.on_hold_count ?? 0) > 0 && (
        <Link
          href="/dashboard/dropship/orders?status=on_hold"
          className="block rounded-xl p-3 mb-3 flex items-center gap-3 transition-colors hover:bg-[#1a1a1f]"
          style={{ background: 'rgba(252,211,77,0.05)', border: '1px solid rgba(252,211,77,0.2)' }}
        >
          <AlertTriangle size={18} style={{ color: '#fcd34d' }} />
          <p className="text-sm text-zinc-300 flex-1">
            {t.rich('alert.onHold', {
              count: kpis?.on_hold_count ?? 0,
              strong: (chunks) => <strong className="text-white">{chunks}</strong>,
            })}
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
            {t.rich('alert.outOfStock', {
              count: kpis?.out_of_stock_skus ?? 0,
              strong: (chunks) => <strong className="text-white">{chunks}</strong>,
            })}
          </p>
        </div>
      )}

      {/* Nav cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <NavCard
          href="/dashboard/dropship/partners"
          icon={<Building2 size={18} />}
          title={t('nav.partners.title')}
          description={t('nav.partners.description')}
        />
        <NavCard
          href="/dashboard/dropship/account-suppliers"
          icon={<Link2 size={18} />}
          title={t('nav.accountLinks.title')}
          description={t('nav.accountLinks.description')}
        />
        <NavCard
          href="/dashboard/dropship/orders"
          icon={<ShoppingCart size={18} />}
          title={t('nav.orders.title')}
          description={t('nav.orders.description')}
        />
        <NavCard
          href="/dashboard/dropship/orders/today"
          icon={<Calendar size={18} />}
          title={t('nav.salesToday.title')}
          description={t('nav.salesToday.description')}
        />
        <NavCard
          href="/dashboard/dropship/oc"
          icon={<FileText size={18} />}
          title={t('nav.purchaseOrders.title')}
          description={t('nav.purchaseOrders.description')}
        />
        <NavCard
          href="/dashboard/dropship/oc/preview"
          icon={<Eye size={18} />}
          title={t('nav.ocPreview.title')}
          description={t('nav.ocPreview.description')}
        />
      </div>

      {/* Recent orders */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">{t('recentOrders')}</h2>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1f' }}>
        {loading ? (
          <div className="px-4 py-12 text-center text-zinc-500 text-sm">{t('loading')}</div>
        ) : !data || data.recent_orders.length === 0 ? (
          <div className="px-4 py-12 text-center text-zinc-500 text-sm">
            {t('empty.text')}{' '}
            <Link href="/dashboard/dropship/account-suppliers" style={{ color: '#00E5FF' }}>
              {t('empty.link')}
            </Link>{' '}
            {t('empty.suffix')}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
                {[t('table.when'), t('table.partner'), t('table.product'), t('table.sku'), t('table.qty'), t('table.price'), t('table.margin'), t('table.status')].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recent_orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                  <td className="px-4 py-2 text-zinc-400 text-xs">{fmtRelative(o.identified_at, t)}</td>
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

function OnboardingChecklist({ setup }: { setup: SetupStatus }) {
  const t = useTranslations('dropship.home.onboarding')
  const isCriticalBlocker = !setup.has_partners || !setup.has_account_links
  const isWarning = setup.has_partners && setup.has_account_links

  const steps = [
    {
      done: setup.has_partners,
      title: t('step1.title'),
      desc: t('step1.desc'),
      href: '/dashboard/dropship/partners',
      icon: <Building2 size={14} />,
    },
    {
      done: setup.has_account_links,
      title: t('step2.title'),
      desc: t('step2.desc'),
      href: '/dashboard/dropship/account-suppliers',
      icon: <Link2 size={14} />,
      requiresPrev: !setup.has_partners,
    },
    {
      done: setup.has_email_config,
      title: t('step3.title'),
      desc: t('step3.desc'),
      href: '/dashboard/configuracoes/integracoes',
      icon: <Mail size={14} />,
      optional: true,
    },
    {
      done: setup.has_whatsapp_config,
      title: t('step4.title'),
      desc: t('step4.desc'),
      href: '/dashboard/configuracoes/integracoes',
      icon: <MessageSquare size={14} />,
      optional: true,
    },
  ]

  return (
    <div
      className="rounded-xl p-5 mb-6"
      style={{
        background: isCriticalBlocker ? 'rgba(252,211,77,0.05)' : 'rgba(0,229,255,0.03)',
        border: isCriticalBlocker
          ? '1px solid rgba(252,211,77,0.2)'
          : '1px solid rgba(0,229,255,0.15)',
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <Settings size={20} style={{ color: isCriticalBlocker ? '#fcd34d' : '#00E5FF' }} />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">
            {isCriticalBlocker ? t('criticalTitle') : t('recommendedTitle')}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {isCriticalBlocker
              ? t('criticalDesc')
              : isWarning
              ? t('recommendedDesc')
              : ''}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((s, idx) => (
          <Link
            key={idx}
            href={s.href}
            className="flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-[#1a1a1f]"
            style={{
              background: s.done ? 'rgba(34,197,94,0.05)' : '#0f0f12',
              border: s.done ? '1px solid rgba(34,197,94,0.2)' : '1px solid #1a1a1f',
              opacity: s.requiresPrev ? 0.5 : 1,
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: s.done ? 'rgba(34,197,94,0.15)' : 'rgba(0,229,255,0.10)',
                color: s.done ? '#22c55e' : '#00E5FF',
              }}
            >
              {s.done ? '✓' : s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium" style={{ color: s.done ? '#a1a1aa' : '#fff' }}>
                  {s.title}
                </p>
                {s.optional && !s.done && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(113,113,122,0.10)', color: '#71717a' }}
                  >
                    {t('optional')}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{s.desc}</p>
            </div>
            {!s.done && <ChevronRight size={14} className="text-zinc-500 shrink-0 mt-1" />}
          </Link>
        ))}
      </div>
    </div>
  )
}

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

function fmtRelative(d: string, t: (key: string, values?: Record<string, string | number>) => string) {
  const ms = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return t('relative.now')
  if (min < 60) return t('relative.minutes', { min })
  const hours = Math.floor(min / 60)
  if (hours < 24) return t('relative.hours', { hours })
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
