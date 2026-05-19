'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, AlertCircle, CreditCard, ExternalLink } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface Credit {
  id: string
  credit_amount: number
  credit_type: string
  status: 'pending' | 'applied' | 'partially_applied' | 'cancelled' | 'expired'
  applied_to_oc_id: string | null
  applied_amount: number
  remaining_amount: number
  applied_at: string | null
  return_id: string | null
  source_oc_id: string | null
  manual_adjustment: boolean
  notes: string | null
  expires_at: string | null
  created_at: string
  suppliers: { id: string; name: string } | null
}

export default function CreditsPage() {
  const t = useTranslations('dropship.credits')
  const supabase = useMemo(() => createClient(), [])

  const [credits, setCredits] = useState<Credit[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filterStatus, setFilterStatus] = useState<'pending_all' | Credit['status'] | 'all'>('pending_all')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
      const params = new URLSearchParams()
      if (filterStatus === 'pending_all') params.set('status', 'pending')
      else if (filterStatus !== 'all') params.set('status', filterStatus)
      const res = await fetch(`${BACKEND}/dropship/credits?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setCredits(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.loadFailed'))
    } finally { setLoading(false) }
  }, [supabase, filterStatus, t])

  useEffect(() => { load() }, [load])

  // KPIs por parceiro
  const bySupplier = useMemo(() => {
    const m = new Map<string, { name: string; pending: number; applied: number; total: number; count: number }>()
    for (const c of credits) {
      const sup = c.suppliers ?? { id: 'unknown', name: '—' }
      if (!m.has(sup.id)) {
        m.set(sup.id, { name: sup.name, pending: 0, applied: 0, total: 0, count: 0 })
      }
      const agg = m.get(sup.id)!
      agg.count++
      agg.total += Number(c.credit_amount ?? 0)
      if (c.status === 'pending') agg.pending += Number(c.remaining_amount ?? 0)
      if (c.status === 'applied' || c.status === 'partially_applied') agg.applied += Number(c.applied_amount ?? 0)
    }
    return Array.from(m.values()).sort((a, b) => b.pending - a.pending)
  }, [credits])

  const totalPending = bySupplier.reduce((s, x) => s + x.pending, 0)

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center gap-3 mb-6">
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

      {err && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {err}
        </div>
      )}

      {/* Saldo total */}
      <div className="rounded-xl p-5 mb-6" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <p className="text-xs text-zinc-500 mb-1">{t('totalPendingBalance')}</p>
        <p className="text-3xl font-bold" style={{ color: '#fcd34d' }}>{fmtBrl(totalPending)}</p>
        <p className="text-xs text-zinc-500 mt-1">{t('partnersWithBalance', { count: bySupplier.length })}</p>
      </div>

      {/* Cards por parceiro */}
      {bySupplier.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">{t('balanceByPartner')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bySupplier.map((s, idx) => (
              <div key={idx} className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
                <p className="font-semibold text-white mb-2">{s.name}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-zinc-500">{t('pending')}</p>
                    <p className="text-base font-semibold" style={{ color: '#fcd34d' }}>{fmtBrl(s.pending)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">{t('alreadyApplied')}</p>
                    <p className="text-base font-semibold" style={{ color: '#22c55e' }}>{fmtBrl(s.applied)}</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-2">{t('creditsCount', { count: s.count })}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden flex-wrap" style={{ border: '1px solid #27272a' }}>
          {(['pending_all', 'applied', 'partially_applied', 'cancelled', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterStatus === s ? '#00E5FF' : 'transparent',
                color: filterStatus === s ? '#09090b' : '#a1a1aa',
              }}
            >
              {s === 'pending_all' ? t('filter.pending') : s === 'applied' ? t('filter.applied') : s === 'partially_applied' ? t('filter.partial') : s === 'cancelled' ? t('filter.cancelled') : t('filter.all')}
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #1a1a1f' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
              {[t('table.createdAt'), t('table.partner'), t('table.type'), t('table.value'), t('table.applied'), t('table.remaining'), t('table.status'), t('table.oc'), ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-500 text-sm">{t('loading')}</td></tr>
            ) : credits.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  <CreditCard size={28} className="mx-auto mb-2 text-zinc-700" />
                  {t('emptyFilter')}
                </td>
              </tr>
            ) : credits.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                <td className="px-4 py-3 text-zinc-400 text-xs">{fmtDateTime(c.created_at)}</td>
                <td className="px-4 py-3 text-zinc-300">{c.suppliers?.name ?? '—'}</td>
                <td className="px-4 py-3"><CreditTypePill type={c.credit_type} t={t} /></td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(c.credit_amount)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: c.applied_amount > 0 ? '#22c55e' : '#71717a' }}>
                  {c.applied_amount > 0 ? fmtBrl(c.applied_amount) : '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-xs" style={{ color: c.remaining_amount > 0 ? '#fcd34d' : '#71717a' }}>
                  {c.remaining_amount > 0 ? fmtBrl(c.remaining_amount) : '—'}
                </td>
                <td className="px-4 py-3"><CreditStatusPill status={c.status} t={t} /></td>
                <td className="px-4 py-3 text-xs">
                  {c.applied_to_oc_id ? (
                    <Link href={`/dashboard/dropship/oc/${c.applied_to_oc_id}`} className="font-mono" style={{ color: '#00E5FF' }}>
                      {t('viewOc')} <ExternalLink size={10} className="inline" />
                    </Link>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CreditTypePill({ type, t }: { type: string; t: (key: string) => string }) {
  const keys: Record<string, string> = {
    return: 'creditType.return', cancellation: 'creditType.cancellation', warranty: 'creditType.warranty',
    divergence: 'creditType.divergence', manual_adjustment: 'creditType.manualAdjustment',
    negotiated_discount: 'creditType.negotiated', previous_payment: 'creditType.previousPayment',
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{ background: 'rgba(113,113,122,0.10)', color: '#a1a1aa', border: '1px solid #27272a' }}>
      {keys[type] ? t(keys[type]) : type}
    </span>
  )
}

function CreditStatusPill({ status, t }: { status: Credit['status']; t: (key: string) => string }) {
  const c: Record<Credit['status'], { bg: string; fg: string; key: string }> = {
    pending:           { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', key: 'creditStatus.pending' },
    partially_applied: { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', key: 'creditStatus.partial' },
    applied:           { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', key: 'creditStatus.applied' },
    cancelled:         { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', key: 'creditStatus.cancelled' },
    expired:           { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', key: 'creditStatus.expired' },
  }
  const x = c[status]
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {t(x.key)}
    </span>
  )
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
