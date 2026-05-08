'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, AlertCircle, CheckCircle2, DollarSign, Building2,
  Calendar, FileText, Ban, ExternalLink,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

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
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  payment_method: string | null
  payment_reference: string | null
  payment_proof_url: string | null
  category: string | null
  cost_center: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  suppliers: { id: string; name: string; legal_name: string | null; tax_id: string | null } | null
}

export default function PayableDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [payable, setPayable] = useState<Payable | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showPay, setShowPay] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/financeiro/payables/${id}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPayable(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [getHeaders, id])

  useEffect(() => { load() }, [load])

  async function handleCancel() {
    const reason = prompt('Motivo do cancelamento:')
    if (!reason?.trim()) return
    setCancelling(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/financeiro/payables/${id}`, {
        method: 'DELETE', headers, body: JSON.stringify({ reason }),
      })
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
      router.push('/dashboard/financeiro/contas-a-pagar')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao cancelar')
    } finally { setCancelling(false) }
  }

  if (loading) return <div className="min-h-screen p-6 text-zinc-500" style={{ background: 'var(--background)' }}>Carregando...</div>
  if (!payable) {
    return (
      <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
        <div className="rounded-lg p-3 text-sm" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          Conta não encontrada. {err && `(${err})`}{' '}
          <Link href="/dashboard/financeiro/contas-a-pagar" style={{ color: '#00E5FF' }}>Voltar</Link>
        </div>
      </div>
    )
  }

  const canPay = !['paid', 'cancelled'].includes(payable.status)
  const canCancel = !['paid', 'cancelled'].includes(payable.status)
  const ocId = payable.source_type === 'dropship_oc' ? payable.source_id : null

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      {/* header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/financeiro/contas-a-pagar" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white font-mono">{payable.payable_number}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{payable.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {ocId && (
            <Link
              href={`/dashboard/dropship/oc/${ocId}`}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
              style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
            >
              <ExternalLink size={14} />
              Ver OC
            </Link>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
              style={{ border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            >
              <Ban size={14} />
              Cancelar
            </button>
          )}
          {canPay && (
            <button
              onClick={() => setShowPay(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg"
              style={{ background: '#22c55e', color: '#fff' }}
            >
              <DollarSign size={14} />
              Pagar
            </button>
          )}
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

      {payable.status === 'paid' && payable.paid_at && (
        <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{
          background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <CheckCircle2 size={20} style={{ color: '#22c55e' }} />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              Paga em {fmtDateTime(payable.paid_at)}
            </p>
            <p className="text-xs text-zinc-400">
              {payable.payment_method?.toUpperCase()} · {fmtBrl(payable.paid_amount)}
              {payable.payment_reference && ` · Ref: ${payable.payment_reference}`}
            </p>
          </div>
          {payable.payment_proof_url && (
            <a
              href={payable.payment_proof_url}
              target="_blank"
              rel="noopener"
              className="text-xs px-3 py-1 rounded-lg"
              style={{ border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}
            >
              <FileText size={12} className="inline mr-1" />
              Comprovante
            </a>
          )}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Valor total" value={fmtBrl(payable.amount)} />
        <Kpi label="Pago" value={fmtBrl(payable.paid_amount)} accent="#22c55e" />
        <Kpi
          label="Restante"
          value={fmtBrl(payable.remaining_amount)}
          accent={payable.remaining_amount > 0 ? '#fcd34d' : '#71717a'}
        />
        <Kpi
          label="Vencimento"
          value={fmtDate(payable.due_date)}
          accent={payable.status === 'overdue' ? '#f87171' : undefined}
        />
      </div>

      {/* Beneficiário */}
      <div className="rounded-xl p-4 mb-6" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Building2 size={12} />
          Beneficiário
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Field label="Nome" value={payable.beneficiary_name} />
          <Field label="Documento" value={payable.beneficiary_doc ?? '—'} />
          <Field label="Razão social" value={payable.suppliers?.legal_name ?? '—'} />
          {payable.category && <Field label="Categoria" value={payable.category} />}
          {payable.cost_center && <Field label="Centro de custo" value={payable.cost_center} />}
          <Field label="Origem" value={sourceLabel(payable.source_type)} />
        </div>
      </div>

      {/* Datas */}
      <div className="rounded-xl p-4 mb-6" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Calendar size={12} />
          Datas
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Field label="Emissão" value={fmtDate(payable.issue_date)} />
          <Field label="Vencimento" value={fmtDate(payable.due_date)} />
          <Field label="Criada em" value={fmtDateTime(payable.created_at)} />
        </div>
      </div>

      {/* Notas */}
      {payable.notes && (
        <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Observações</p>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{payable.notes}</p>
        </div>
      )}

      {/* Modal Pagar */}
      {showPay && (
        <PayModal
          payable={payable}
          getHeaders={getHeaders}
          onClose={() => setShowPay(false)}
          onPaid={() => { setShowPay(false); load() }}
        />
      )}
    </div>
  )
}

// ── Pay Modal ──────────────────────────────────────────────────────────────────

function PayModal({
  payable, getHeaders, onClose, onPaid,
}: {
  payable: Payable
  getHeaders: () => Promise<Record<string, string>>
  onClose: () => void
  onPaid: () => void
}) {
  const [paidAmount, setPaidAmount] = useState(String(payable.remaining_amount))
  const [paymentMethod, setPaymentMethod] = useState<string>('pix')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentProofUrl, setPaymentProofUrl] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 16))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    const amt = Number(paidAmount)
    if (!amt || amt <= 0) { setErr('Valor inválido'); return }
    if (amt > payable.remaining_amount + 0.001) {
      setErr(`Valor maior que restante (${fmtBrl(payable.remaining_amount)})`)
      return
    }
    if (!paymentMethod) { setErr('Método obrigatório'); return }
    setSaving(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/financeiro/payables/${payable.id}/pay`, {
        method: 'POST', headers,
        body: JSON.stringify({
          paid_amount: amt,
          payment_method: paymentMethod,
          payment_reference: paymentReference || null,
          payment_proof_url: paymentProofUrl || null,
          paid_at: paidAt ? new Date(paidAt).toISOString() : null,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      onPaid()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao pagar')
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#22c55e]'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={() => !saving && onClose()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          style={{ background: '#111114', border: '1px solid rgba(34,197,94,0.3)' }}>
          <div className="flex items-center gap-2">
            <DollarSign size={18} style={{ color: '#22c55e' }} />
            <h2 className="text-lg font-semibold text-white">Registrar Pagamento</h2>
          </div>

          <div className="rounded-lg p-3 text-xs" style={{ background: '#0f0f12', border: '1px solid #1e1e24' }}>
            <p className="text-zinc-400">{payable.beneficiary_name}</p>
            <p className="text-zinc-500 mt-0.5">Restante: <strong className="text-white">{fmtBrl(payable.remaining_amount)}</strong></p>
          </div>

          <div>
            <label className={lbl}>Valor pago (R$) *</label>
            <input
              type="number" step="0.01" min="0.01" max={payable.remaining_amount}
              value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
              className={inp} autoFocus
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setPaidAmount(String(payable.remaining_amount))}
                className="text-xs" style={{ color: '#00E5FF' }}
              >
                Pagar total
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Método *</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inp}>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="transfer">Transferência</option>
                <option value="check">Cheque</option>
                <option value="cash">Dinheiro</option>
                <option value="credit_card">Cartão crédito</option>
                <option value="debit_card">Cartão débito</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Data/hora</label>
              <input type="datetime-local" value={paidAt} onChange={e => setPaidAt(e.target.value)} className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>Referência (ID PIX, n° boleto, etc.)</label>
            <input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} className={inp} />
          </div>

          <div>
            <label className={lbl}>URL do comprovante (opcional)</label>
            <input
              type="url"
              value={paymentProofUrl}
              onChange={e => setPaymentProofUrl(e.target.value)}
              className={inp}
              placeholder="https://..."
            />
            <p className="text-xs text-zinc-500 mt-1">Faça upload do comprovante em outro lugar e cole o link aqui</p>
          </div>

          <div>
            <label className={lbl}>Notas (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp + ' resize-none'} />
          </div>

          {err && (
            <div className="rounded-lg p-2 text-xs" style={{
              background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
            }}>{err}</div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>Cancelar</button>
            <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold rounded-lg" style={{ background: '#22c55e', color: '#fff', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Registrando...' : 'Confirmar Pagamento'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Components ─────────────────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm text-white truncate">{value}</p>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────

function sourceLabel(t: string): string {
  const m: Record<string, string> = {
    dropship_oc: 'OC Dropship', purchase_order: 'Importação', manual: 'Manual',
    service: 'Serviço', rent: 'Aluguel', tax: 'Imposto', salary: 'Folha',
    utility: 'Utilities', other: 'Outro',
  }
  return m[t] ?? t
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
