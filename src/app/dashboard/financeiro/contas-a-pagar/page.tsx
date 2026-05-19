'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, AlertCircle, Search, Plus, ChevronRight, AlertTriangle, Calendar,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type PayableStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'

interface Payable {
  id: string
  payable_number: string
  description: string
  source_type: string
  source_id: string | null
  beneficiary_name: string
  beneficiary_doc: string | null
  amount: number
  paid_amount: number
  remaining_amount: number
  issue_date: string
  due_date: string
  paid_at: string | null
  status: PayableStatus
  payment_method: string | null
  payment_reference: string | null
  payment_proof_url: string | null
  category: string | null
  cost_center: string | null
  notes: string | null
  suppliers: { id: string; name: string } | null
}

interface Summary {
  total_pending: number
  overdue_count: number
  overdue_value: number
  next_7d_value: number
  next_30d_value: number
  paid_this_month: number
  pending_count: number
}

type Translator = ReturnType<typeof useTranslations>

export default function ContasAPagarPage() {
  const t = useTranslations('financeiro')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [payables, setPayables] = useState<Payable[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filterStatus, setFilterStatus] = useState<'pending_all' | PayableStatus | 'all'>('pending_all')
  const [search, setSearch] = useState('')

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('payables.notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase, t])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (filterStatus === 'pending_all') params.set('status', 'pending,partial,overdue')
      else if (filterStatus !== 'all') params.set('status', filterStatus)
      if (search.trim()) params.set('q', search.trim())
      const [pRes, sRes] = await Promise.all([
        fetch(`${BACKEND}/financeiro/payables?${params}`, { headers }),
        fetch(`${BACKEND}/financeiro/payables/summary`, { headers }),
      ])
      if (!pRes.ok) throw new Error(`Lista HTTP ${pRes.status}`)
      if (!sRes.ok) throw new Error(`Summary HTTP ${sRes.status}`)
      setPayables(await pRes.json())
      setSummary(await sRes.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('payables.loadError'))
      setPayables([])
    } finally { setLoading(false) }
  }, [getHeaders, filterStatus, search, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/financeiro" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">{t('payables.title')}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {t('payables.subtitle')}
            </p>
          </div>
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

      {/* alert overdue */}
      {summary && summary.overdue_count > 0 && (
        <div className="rounded-xl p-4 mb-4 flex items-center gap-3" style={{
          background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)',
        }}>
          <AlertTriangle size={18} style={{ color: '#f87171' }} />
          <p className="text-sm text-zinc-300 flex-1">
            {t.rich('payables.overdueAlert', {
              count: summary.overdue_count,
              value: fmtBrl(summary.overdue_value),
              s1: (chunks) => <strong className="text-white">{chunks}</strong>,
              s2: (chunks) => <strong style={{ color: '#f87171' }}>{chunks}</strong>,
            })}
          </p>
          <button
            onClick={() => setFilterStatus('overdue')}
            className="text-xs px-3 py-1 rounded-lg"
            style={{ border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
          >
            {t('payables.filterOverdue')}
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi
          label={t('payables.kpiOpen')}
          value={summary ? fmtBrl(summary.total_pending) : '…'}
          sub={summary ? t('payables.kpiBillsCount', { count: summary.pending_count }) : undefined}
        />
        <Kpi
          label={t('payables.kpiOverdue')}
          value={summary ? fmtBrl(summary.overdue_value) : '…'}
          accent={summary && summary.overdue_value > 0 ? '#f87171' : undefined}
          sub={summary ? t('payables.kpiBillsCount', { count: summary.overdue_count }) : undefined}
        />
        <Kpi
          label={t('payables.kpiNext7d')}
          value={summary ? fmtBrl(summary.next_7d_value) : '…'}
          accent={summary && summary.next_7d_value > 0 ? '#fcd34d' : undefined}
        />
        <Kpi
          label={t('payables.kpiNext30d')}
          value={summary ? fmtBrl(summary.next_30d_value) : '…'}
        />
        <Kpi
          label={t('payables.kpiPaidThisMonth')}
          value={summary ? fmtBrl(summary.paid_this_month) : '…'}
          accent="#22c55e"
        />
      </div>

      {/* filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden flex-wrap" style={{ border: '1px solid #27272a' }}>
          {(['pending_all', 'overdue', 'pending', 'partial', 'paid', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterStatus === s ? '#00E5FF' : 'transparent',
                color: filterStatus === s ? '#09090b' : '#a1a1aa',
              }}
            >
              {filterLabel(s, t)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <Search size={14} />
          </span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('payables.searchPlaceholder')}
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
              {[
                t('payables.colNumber'), t('payables.colDescription'), t('payables.colBeneficiary'),
                t('payables.colSource'), t('payables.colDueDate'), t('payables.colAmount'),
                t('payables.colPaid'), t('payables.colRemaining'), t('payables.colStatus'), '',
              ].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-zinc-500 text-sm">{t('payables.loadingRow')}</td></tr>
            ) : payables.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  {t('payables.emptyRow')}
                </td>
              </tr>
            ) : payables.map(p => (
              <tr
                key={p.id}
                onClick={() => router.push(`/dashboard/financeiro/contas-a-pagar/${p.id}`)}
                className="cursor-pointer transition-colors"
                style={{
                  borderBottom: '1px solid #1a1a1f',
                  background: p.status === 'overdue' ? 'rgba(248,113,113,0.03)' : 'transparent',
                }}
                onMouseEnter={e => {
                  if (p.status !== 'overdue') (e.currentTarget as HTMLElement).style.background = '#111114'
                }}
                onMouseLeave={e => {
                  if (p.status !== 'overdue') (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">{p.payable_number}</td>
                <td className="px-4 py-3">
                  <p className="text-white text-xs truncate max-w-[280px]">{p.description}</p>
                  {p.category && <p className="text-xs text-zinc-500">{p.category}</p>}
                </td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{p.beneficiary_name}</td>
                <td className="px-4 py-3"><SourcePill type={p.source_type} t={t} /></td>
                <td className="px-4 py-3">
                  <p className="text-xs text-zinc-300">{fmtDate(p.due_date)}</p>
                  <p className="text-xs" style={{ color: p.status === 'overdue' ? '#f87171' : '#71717a' }}>
                    {fmtRelativeDue(p.due_date, p.status, t)}
                  </p>
                </td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(p.amount)}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">
                  {p.paid_amount > 0 ? fmtBrl(p.paid_amount) : '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-white text-xs">
                  {p.status === 'paid' ? '—' : fmtBrl(p.remaining_amount)}
                </td>
                <td className="px-4 py-3"><PayableStatusPill status={p.status} t={t} /></td>
                <td className="px-4 py-3 text-right">
                  <ChevronRight size={14} className="inline text-zinc-600" />
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

function Kpi({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-lg font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function PayableStatusPill({ status, t }: { status: PayableStatus; t: Translator }) {
  const c: Record<PayableStatus, { bg: string; fg: string }> = {
    pending:   { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d' },
    partial:   { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa' },
    paid:      { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e' },
    overdue:   { bg: 'rgba(248,113,113,0.10)', fg: '#f87171' },
    cancelled: { bg: 'rgba(113,113,122,0.10)', fg: '#71717a' },
  }
  const x = c[status]
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {t(`payables.status.${status}`)}
    </span>
  )
}

const SOURCE_KEYS = ['dropship_oc', 'purchase_order', 'manual', 'service', 'rent', 'tax', 'salary', 'utility', 'other'] as const

function SourcePill({ type, t }: { type: string; t: Translator }) {
  const colors: Record<string, string> = {
    dropship_oc:    '#00E5FF',
    purchase_order: '#60a5fa',
    manual:         '#a1a1aa',
    service:        '#fcd34d',
    rent:           '#fcd34d',
    tax:            '#f87171',
    salary:         '#fb923c',
    utility:        '#a1a1aa',
    other:          '#71717a',
  }
  const color = colors[type] ?? colors.other
  const key = (SOURCE_KEYS as readonly string[]).includes(type) ? type : 'other'
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{ background: `${color}1A`, color, border: `1px solid ${color}33` }}>
      {t(`payables.source.${key}`)}
    </span>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────

function filterLabel(s: string, t: Translator): string {
  return s === 'pending_all' ? t('payables.filter.pendingAll')
    : s === 'overdue' ? t('payables.filter.overdue')
    : s === 'pending' ? t('payables.filter.pending')
    : s === 'partial' ? t('payables.filter.partial')
    : s === 'paid' ? t('payables.filter.paid')
    : t('payables.filter.all')
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtRelativeDue(d: string, status: PayableStatus, t: Translator): string {
  if (status === 'paid' || status === 'cancelled') return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(d)
  due.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return t('payables.dueOverdue', { days: Math.abs(days) })
  if (days === 0) return t('payables.dueToday')
  if (days === 1) return t('payables.dueTomorrow')
  return t('payables.dueInDays', { days })
}
