'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
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
  const supabase = useMemo(() => createClient(), [])

  const [credits, setCredits] = useState<Credit[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filterStatus, setFilterStatus] = useState<'pending_all' | Credit['status'] | 'all'>('pending_all')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Não autenticado')
      const params = new URLSearchParams()
      if (filterStatus === 'pending_all') params.set('status', 'pending')
      else if (filterStatus !== 'all') params.set('status', filterStatus)
      const res = await fetch(`${BACKEND}/dropship/credits?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setCredits(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [supabase, filterStatus])

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
          <h1 className="text-xl font-semibold text-white">Créditos do Parceiro</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Saldo de créditos de devoluções a abater na próxima OC do parceiro
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
        <p className="text-xs text-zinc-500 mb-1">Saldo total pendente</p>
        <p className="text-3xl font-bold" style={{ color: '#fcd34d' }}>{fmtBrl(totalPending)}</p>
        <p className="text-xs text-zinc-500 mt-1">{bySupplier.length} parceiro{bySupplier.length !== 1 ? 's' : ''} com saldo</p>
      </div>

      {/* Cards por parceiro */}
      {bySupplier.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Saldo por parceiro</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bySupplier.map((s, idx) => (
              <div key={idx} className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
                <p className="font-semibold text-white mb-2">{s.name}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-zinc-500">Pendente</p>
                    <p className="text-base font-semibold" style={{ color: '#fcd34d' }}>{fmtBrl(s.pending)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Já aplicado</p>
                    <p className="text-base font-semibold" style={{ color: '#22c55e' }}>{fmtBrl(s.applied)}</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-2">{s.count} crédito{s.count !== 1 ? 's' : ''}</p>
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
              {s === 'pending_all' ? 'Pendentes' : s === 'applied' ? 'Aplicados' : s === 'partially_applied' ? 'Parciais' : s === 'cancelled' ? 'Cancelados' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #1a1a1f' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
              {['Criado em', 'Parceiro', 'Tipo', 'Valor', 'Aplicado', 'Restante', 'Status', 'OC', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-500 text-sm">Carregando...</td></tr>
            ) : credits.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  <CreditCard size={28} className="mx-auto mb-2 text-zinc-700" />
                  Nenhum crédito nesse filtro.
                </td>
              </tr>
            ) : credits.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                <td className="px-4 py-3 text-zinc-400 text-xs">{fmtDateTime(c.created_at)}</td>
                <td className="px-4 py-3 text-zinc-300">{c.suppliers?.name ?? '—'}</td>
                <td className="px-4 py-3"><CreditTypePill type={c.credit_type} /></td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(c.credit_amount)}</td>
                <td className="px-4 py-3 text-xs" style={{ color: c.applied_amount > 0 ? '#22c55e' : '#71717a' }}>
                  {c.applied_amount > 0 ? fmtBrl(c.applied_amount) : '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-xs" style={{ color: c.remaining_amount > 0 ? '#fcd34d' : '#71717a' }}>
                  {c.remaining_amount > 0 ? fmtBrl(c.remaining_amount) : '—'}
                </td>
                <td className="px-4 py-3"><CreditStatusPill status={c.status} /></td>
                <td className="px-4 py-3 text-xs">
                  {c.applied_to_oc_id ? (
                    <Link href={`/dashboard/dropship/oc/${c.applied_to_oc_id}`} className="font-mono" style={{ color: '#00E5FF' }}>
                      Ver OC <ExternalLink size={10} className="inline" />
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

function CreditTypePill({ type }: { type: string }) {
  const m: Record<string, string> = {
    return: 'Devolução', cancellation: 'Cancel.', warranty: 'Garantia',
    divergence: 'Divergência', manual_adjustment: 'Ajuste manual',
    negotiated_discount: 'Negociado', previous_payment: 'Pgto anterior',
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{ background: 'rgba(113,113,122,0.10)', color: '#a1a1aa', border: '1px solid #27272a' }}>
      {m[type] ?? type}
    </span>
  )
}

function CreditStatusPill({ status }: { status: Credit['status'] }) {
  const c: Record<Credit['status'], { bg: string; fg: string; label: string }> = {
    pending:           { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Pendente' },
    partially_applied: { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'Parcial' },
    applied:           { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Aplicado' },
    cancelled:         { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Cancelado' },
    expired:           { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', label: 'Expirado' },
  }
  const x = c[status]
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.label}
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
