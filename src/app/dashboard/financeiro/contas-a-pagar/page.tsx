'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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

export default function ContasAPagarPage() {
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
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

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
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
      setPayables([])
    } finally { setLoading(false) }
  }, [getHeaders, filterStatus, search])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/financeiro" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Contas a Pagar</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              OCs aprovadas + lançamentos manuais + outras dívidas
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
            <strong className="text-white">{summary.overdue_count} contas vencidas</strong> totalizando{' '}
            <strong style={{ color: '#f87171' }}>{fmtBrl(summary.overdue_value)}</strong>
          </p>
          <button
            onClick={() => setFilterStatus('overdue')}
            className="text-xs px-3 py-1 rounded-lg"
            style={{ border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
          >
            Filtrar vencidas
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi
          label="Em aberto"
          value={summary ? fmtBrl(summary.total_pending) : '…'}
          sub={summary ? `${summary.pending_count} contas` : undefined}
        />
        <Kpi
          label="Vencidas"
          value={summary ? fmtBrl(summary.overdue_value) : '…'}
          accent={summary && summary.overdue_value > 0 ? '#f87171' : undefined}
          sub={summary ? `${summary.overdue_count} contas` : undefined}
        />
        <Kpi
          label="Próximos 7d"
          value={summary ? fmtBrl(summary.next_7d_value) : '…'}
          accent={summary && summary.next_7d_value > 0 ? '#fcd34d' : undefined}
        />
        <Kpi
          label="Próximos 30d"
          value={summary ? fmtBrl(summary.next_30d_value) : '…'}
        />
        <Kpi
          label="Pago no mês"
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
              {filterLabel(s)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <Search size={14} />
          </span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por descrição, beneficiário ou número..."
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
              {['Número', 'Descrição', 'Beneficiário', 'Origem', 'Vencimento', 'Valor', 'Pago', 'Restante', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-zinc-500 text-sm">Carregando...</td></tr>
            ) : payables.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  Nenhuma conta a pagar nesse filtro.
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
                <td className="px-4 py-3"><SourcePill type={p.source_type} /></td>
                <td className="px-4 py-3">
                  <p className="text-xs text-zinc-300">{fmtDate(p.due_date)}</p>
                  <p className="text-xs" style={{ color: p.status === 'overdue' ? '#f87171' : '#71717a' }}>
                    {fmtRelativeDue(p.due_date, p.status)}
                  </p>
                </td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(p.amount)}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">
                  {p.paid_amount > 0 ? fmtBrl(p.paid_amount) : '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-white text-xs">
                  {p.status === 'paid' ? '—' : fmtBrl(p.remaining_amount)}
                </td>
                <td className="px-4 py-3"><PayableStatusPill status={p.status} /></td>
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

function PayableStatusPill({ status }: { status: PayableStatus }) {
  const c: Record<PayableStatus, { bg: string; fg: string; label: string }> = {
    pending:   { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Pendente' },
    partial:   { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'Parcial' },
    paid:      { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Pago' },
    overdue:   { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', label: 'Vencida' },
    cancelled: { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Cancelada' },
  }
  const x = c[status]
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.label}
    </span>
  )
}

function SourcePill({ type }: { type: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    dropship_oc:    { label: 'OC Dropship',  color: '#00E5FF' },
    purchase_order: { label: 'Importação',   color: '#60a5fa' },
    manual:         { label: 'Manual',       color: '#a1a1aa' },
    service:        { label: 'Serviço',      color: '#fcd34d' },
    rent:           { label: 'Aluguel',      color: '#fcd34d' },
    tax:            { label: 'Imposto',      color: '#f87171' },
    salary:         { label: 'Folha',        color: '#fb923c' },
    utility:        { label: 'Utilities',    color: '#a1a1aa' },
    other:          { label: 'Outro',        color: '#71717a' },
  }
  const t = labels[type] ?? labels.other
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{ background: `${t.color}1A`, color: t.color, border: `1px solid ${t.color}33` }}>
      {t.label}
    </span>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────

function filterLabel(s: string): string {
  return s === 'pending_all' ? 'Em aberto'
    : s === 'overdue' ? 'Vencidas'
    : s === 'pending' ? 'Pendentes'
    : s === 'partial' ? 'Parciais'
    : s === 'paid' ? 'Pagas'
    : 'Todas'
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtRelativeDue(d: string, status: PayableStatus): string {
  if (status === 'paid' || status === 'cancelled') return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(d)
  due.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return `vencida há ${Math.abs(days)}d`
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  if (days <= 7) return `em ${days}d`
  return `em ${days}d`
}
