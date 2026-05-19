'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { useConfirm, usePrompt } from '@/components/ui/dialog-provider'
import {
  ArrowLeft, AlertCircle, Search, RefreshCw, Pause, Play, Package,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type DropshipStatus =
  | 'identified' | 'awaiting_shipment' | 'shipped' | 'shipped_confirmed'
  | 'eligible_for_oc' | 'in_oc_draft' | 'in_oc_generated' | 'in_oc_approved'
  | 'in_payable' | 'paid' | 'cancelled' | 'returned' | 'on_hold' | 'excluded'

interface DropshipOrder {
  id: string
  marketplace: string
  ml_order_id: string | null
  shopee_order_id: string | null
  partner_sku: string
  master_sku: string | null
  quantity: number
  cost_at_sale: number | null
  sale_price: number | null
  estimated_cost_at_oc: number | null
  estimated_margin: number | null
  marketplace_status: string | null
  shipping_status: string | null
  payment_status: string | null
  dropship_status: DropshipStatus
  hold_reason: string | null
  identified_at: string
  shipped_at: string | null
  delivered_at: string | null
  oc_id: string | null
  suppliers: { id: string; name: string } | null
  products: { id: string; name: string; sku: string | null; photo_urls: string[] | null } | null
  orders: { id: string; external_order_id: string; buyer_name: string | null; sold_at: string } | null
}

export default function DropshipOrdersPage() {
  const t = useTranslations('dropship.orders')
  const supabase = useMemo(() => createClient(), [])

  const [orders, setOrders] = useState<DropshipOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | DropshipStatus>('all')
  const [search, setSearch] = useState('')
  const [identifying, setIdentifying] = useState(false)
  const confirm = useConfirm()
  const prompt = usePrompt()

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase, t])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`${BACKEND}/dropship/orders?${params}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setOrders(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.loadFailed'))
      setOrders([])
    } finally { setLoading(false) }
  }, [getHeaders, filterStatus, search, t])

  useEffect(() => { load() }, [load])

  async function forceIdentify() {
    setIdentifying(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/orders/identify`, { method: 'POST', headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = await res.json()
      if (r.identified > 0) await load()
      else setErr(t('noNewIdentified', { processed: r.processed, skipped: r.skipped }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.identifyFailed'))
    } finally { setIdentifying(false) }
  }

  async function holdOrder(id: string) {
    const reason = await prompt({
      title: t('holdPrompt.title'),
      message: t('holdPrompt.message'),
      placeholder: t('holdPrompt.placeholder'),
      multiline: true,
      confirmLabel: t('holdPrompt.confirm'),
      variant: 'warning',
    })
    if (!reason?.trim()) return
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/orders/${id}/hold`, {
        method: 'POST', headers, body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.holdFailed'))
    }
  }

  async function releaseOrder(id: string) {
    const ok = await confirm({
      title: t('releaseConfirm.title'),
      message: t('releaseConfirm.message'),
      confirmLabel: t('releaseConfirm.confirm'),
    })
    if (!ok) return
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/orders/${id}/release`, { method: 'POST', headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.releaseFailed'))
    }
  }

  // KPIs
  const total = orders.length
  const onHold = orders.filter(o => o.dropship_status === 'on_hold').length
  const shipped = orders.filter(o => ['shipped', 'shipped_confirmed', 'eligible_for_oc'].includes(o.dropship_status)).length
  const totalValue = orders.reduce((s, o) => s + Number(o.sale_price ?? 0) * Number(o.quantity ?? 0), 0)

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/dropship" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={forceIdentify}
          disabled={identifying}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors"
          style={{ border: '1px solid #27272a', color: '#a1a1aa', opacity: identifying ? 0.6 : 1 }}
        >
          <RefreshCw size={14} className={identifying ? 'animate-spin' : ''} />
          {identifying ? t('identifying') : t('forceIdentify')}
        </button>
      </div>

      {err && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {err}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label={t('kpi.total')} value={total} />
        <Kpi label={t('kpi.shipped')} value={shipped} accent="#22c55e" />
        <Kpi label={t('kpi.onHold')} value={onHold} accent={onHold > 0 ? '#fcd34d' : undefined} />
        <Kpi label={t('kpi.revenue')} value={fmtBrl(totalValue)} />
      </div>

      {/* filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden flex-wrap" style={{ border: '1px solid #27272a' }}>
          {(['all', 'identified', 'shipped', 'eligible_for_oc', 'on_hold', 'returned'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterStatus === s ? '#00E5FF' : 'transparent',
                color: filterStatus === s ? '#09090b' : '#a1a1aa',
              }}
            >
              {s === 'all' ? t('filter.all') : statusLabel(s as DropshipStatus, t)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <Search size={14} />
          </span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none"
            style={{ background: '#111114', border: '1px solid #27272a', color: '#fff' }}
          />
        </div>
      </div>

      {/* table */}
      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #1a1a1f' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
              {[t('table.order'), t('table.marketplace'), t('table.partner'), t('table.product'), t('table.qty'), t('table.price'), t('table.cost'), t('table.margin'), t('table.status'), ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-zinc-500 text-sm">{t('loading')}</td></tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  <Package size={28} className="mx-auto mb-2 text-zinc-700" />
                  {filterStatus !== 'all' ? t('emptyFilter') : t('empty')}
                  <p className="text-xs mt-1">
                    {filterStatus !== 'all' ? t('emptyFilterHint') : t('emptyHint')}
                  </p>
                </td>
              </tr>
            ) : orders.map(o => (
              <tr key={o.id} style={{
                borderBottom: '1px solid #1a1a1f',
                background: o.dropship_status === 'on_hold' ? 'rgba(252,211,77,0.03)' : 'transparent',
              }}>
                <td className="px-4 py-3">
                  <p className="font-mono text-xs text-zinc-300">{o.orders?.external_order_id ?? '—'}</p>
                  <p className="text-xs text-zinc-500">{fmtDateTime(o.identified_at)}</p>
                </td>
                <td className="px-4 py-3"><MarketplacePill marketplace={o.marketplace} /></td>
                <td className="px-4 py-3 text-zinc-300">{o.suppliers?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {o.products?.photo_urls?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.products.photo_urls[0]} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded shrink-0" style={{ background: '#1a1a1f' }} />
                    )}
                    <div className="min-w-0">
                      <p className="text-white text-xs truncate max-w-[200px]">{o.products?.name ?? '—'}</p>
                      <p className="text-xs text-zinc-500 font-mono">{o.partner_sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-300">{o.quantity}</td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(Number(o.sale_price ?? 0))}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{fmtBrl(Number(o.estimated_cost_at_oc ?? 0))}</td>
                <td className="px-4 py-3 text-xs" style={{ color: Number(o.estimated_margin ?? 0) > 0 ? '#22c55e' : '#f87171' }}>
                  {fmtBrl(Number(o.estimated_margin ?? 0))}
                </td>
                <td className="px-4 py-3">
                  <DropshipStatusPill status={o.dropship_status} t={t} />
                  {o.dropship_status === 'on_hold' && o.hold_reason && (
                    <p className="text-xs text-zinc-500 mt-1 max-w-[180px] truncate" title={o.hold_reason}>
                      {o.hold_reason}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {o.dropship_status === 'on_hold' ? (
                    <button onClick={() => releaseOrder(o.id)} className="text-zinc-500 hover:text-white" title={t('release')}>
                      <Play size={14} />
                    </button>
                  ) : !['cancelled', 'returned', 'paid'].includes(o.dropship_status) ? (
                    <button onClick={() => holdOrder(o.id)} className="text-zinc-500 hover:text-yellow-400" title={t('hold')}>
                      <Pause size={14} />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Components ─────────────────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function MarketplacePill({ marketplace }: { marketplace: string }) {
  const colors: Record<string, { bg: string; fg: string; label: string }> = {
    mercado_livre: { bg: 'rgba(255,224,0,0.10)',  fg: '#fde047', label: 'ML' },
    shopee:        { bg: 'rgba(255,107,53,0.10)', fg: '#fb923c', label: 'Shopee' },
    amazon:        { bg: 'rgba(255,153,0,0.10)',  fg: '#fb923c', label: 'Amazon' },
    magalu:        { bg: 'rgba(0,116,255,0.10)',  fg: '#60a5fa', label: 'Magalu' },
  }
  const c = colors[marketplace] ?? { bg: 'rgba(113,113,122,0.10)', fg: '#a1a1aa', label: marketplace }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.fg}33` }}>
      {c.label}
    </span>
  )
}

function DropshipStatusPill({ status, t }: { status: DropshipStatus; t: ReturnType<typeof useTranslations> }) {
  const c: Record<DropshipStatus, { bg: string; fg: string; key: string }> = {
    identified:         { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', key: 'statusPill.identified' },
    awaiting_shipment:  { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', key: 'statusPill.awaitingShipment' },
    shipped:            { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', key: 'statusPill.shipped' },
    shipped_confirmed:  { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', key: 'statusPill.shippedConfirmed' },
    eligible_for_oc:    { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', key: 'statusPill.eligibleForOc' },
    in_oc_draft:        { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', key: 'statusPill.inOcDraft' },
    in_oc_generated:    { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', key: 'statusPill.inOcGenerated' },
    in_oc_approved:     { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', key: 'statusPill.inOcApproved' },
    in_payable:         { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', key: 'statusPill.inPayable' },
    paid:               { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', key: 'statusPill.paid' },
    cancelled:          { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', key: 'statusPill.cancelled' },
    returned:           { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', key: 'statusPill.returned' },
    on_hold:            { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', key: 'statusPill.onHold' },
    excluded:           { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', key: 'statusPill.excluded' },
  }
  const x = c[status]
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {t(x.key)}
    </span>
  )
}

function statusLabel(s: DropshipStatus, t: ReturnType<typeof useTranslations>): string {
  const keys: Record<DropshipStatus, string> = {
    identified: 'filter.identified', awaiting_shipment: 'filter.awaitingShipment', shipped: 'filter.shipped',
    shipped_confirmed: 'filter.shippedConfirmed', eligible_for_oc: 'filter.eligibleForOc', in_oc_draft: 'filter.inOc',
    in_oc_generated: 'filter.inOcGenerated', in_oc_approved: 'filter.inOcApproved', in_payable: 'filter.inPayable',
    paid: 'filter.paid', cancelled: 'filter.cancelled', returned: 'filter.returned', on_hold: 'filter.onHold',
    excluded: 'filter.excluded',
  }
  return keys[s] ? t(keys[s]) : s
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
