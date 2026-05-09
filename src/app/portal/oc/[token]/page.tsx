'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, XCircle, AlertTriangle, Calendar, Clock,
  FileText, Building2, Loader2, Package, Download,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface OC {
  id: string
  oc_number: string
  marketplace: string
  marketplace_account_label: string | null
  reference_date: string
  generation_date: string
  due_date: string
  items_count: number
  units_count: number
  gross_total: number
  total_credits: number
  return_credits: number
  cancellation_credits: number
  warranty_credits: number
  divergence_credits: number
  other_credits: number
  net_total: number
  status: string
  partner_viewed_at: string | null
  partner_approved_at: string | null
  notes: string | null
  suppliers: {
    name: string
    legal_name: string | null
    tax_id: string | null
    payment_terms: string | null
    payment_method: string | null
  } | null
}

interface Item {
  id: string
  partner_sku: string
  master_sku: string | null
  product_name: string
  variation_label: string | null
  quantity: number
  unit_cost: number
  packaging_cost: number
  handling_cost: number
  line_total: number
  marketplace: string
  ml_order_id: string | null
  sale_date: string
  status: string
  products: { name: string; photo_urls: string[] | null } | null
}

interface PortalData {
  oc: OC
  items: Item[]
  session: {
    can_approve: boolean
    can_dispute: boolean
    expires_at: string
    approved_at: string | null
    rejected_at: string | null
  }
}

export default function PortalPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [actionResult, setActionResult] = useState<'approved' | 'rejected' | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const res = await fetch(`${BACKEND}/portal/oc/${token}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090b' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#00E5FF' }} />
      </div>
    )
  }

  if (err || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#09090b' }}>
        <div className="max-w-md w-full rounded-xl p-6 text-center" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <XCircle size={32} className="mx-auto mb-3" style={{ color: '#f87171' }} />
          <h1 className="text-lg font-semibold text-white mb-2">Link inválido ou expirado</h1>
          <p className="text-sm text-zinc-400">{err || 'OC não encontrada'}</p>
          <p className="text-xs text-zinc-500 mt-4">
            Solicite um novo link ao seller que enviou esta OC.
          </p>
        </div>
      </div>
    )
  }

  const { oc, items, session } = data
  const alreadyProcessed = !!session.approved_at || !!session.rejected_at

  return (
    <div className="min-h-screen" style={{ background: '#09090b', color: '#fff' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: '#1a1a1f' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-zinc-500">e-Click · Portal do Parceiro</p>
            <h1 className="text-lg font-semibold text-white font-mono">{oc.oc_number}</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`${BACKEND}/portal/oc/${token}/pdf`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-[#1a1a1f]"
              style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
            >
              <Download size={14} />
              Baixar PDF
            </a>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Link válido até</p>
              <p className="text-sm text-zinc-300">{fmtDateTime(session.expires_at)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Status atual */}
        {actionResult === 'approved' || oc.partner_approved_at ? (
          <div className="rounded-xl p-4 flex items-center gap-3" style={{
            background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)',
          }}>
            <CheckCircle2 size={20} style={{ color: '#22c55e' }} />
            <div>
              <p className="text-sm font-medium text-white">OC aprovada</p>
              <p className="text-xs text-zinc-400">
                {oc.partner_approved_at ? `em ${fmtDateTime(oc.partner_approved_at)}` : 'agora'}
              </p>
            </div>
          </div>
        ) : actionResult === 'rejected' ? (
          <div className="rounded-xl p-4 flex items-center gap-3" style={{
            background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)',
          }}>
            <XCircle size={20} style={{ color: '#f87171' }} />
            <div>
              <p className="text-sm font-medium text-white">OC rejeitada</p>
              <p className="text-xs text-zinc-400">Seller foi notificado</p>
            </div>
          </div>
        ) : null}

        {/* Resumo */}
        <div className="rounded-xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #1a1a1f' }}>
            <Building2 size={16} style={{ color: '#00E5FF' }} />
            <h2 className="text-sm font-semibold text-white">{oc.suppliers?.name ?? 'Parceiro'}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
            <Field label="CNPJ" value={oc.suppliers?.tax_id ?? '—'} />
            <Field label="Razão Social" value={oc.suppliers?.legal_name ?? '—'} />
            <Field label="Marketplace" value={oc.marketplace_account_label ?? oc.marketplace} />
            <Field label="Data ref." value={fmtDate(oc.reference_date)} />
            <Field label="Vencimento" value={fmtDate(oc.due_date)} highlight />
            <Field label="Prazo pgto" value={oc.suppliers?.payment_terms ? `${oc.suppliers.payment_terms} dias` : '—'} />
            <Field label="Método" value={oc.suppliers?.payment_method ?? '—'} />
            <Field label="Itens" value={`${oc.items_count} (${oc.units_count} un.)`} />
          </div>
        </div>

        {/* Totais */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <BigKpi label="Bruto" value={fmtBrl(oc.gross_total)} />
          <BigKpi
            label="Créditos"
            value={oc.total_credits > 0 ? `-${fmtBrl(oc.total_credits)}` : '—'}
            accent={oc.total_credits > 0 ? '#fcd34d' : '#71717a'}
          />
          <BigKpi label="A pagar (líquido)" value={fmtBrl(oc.net_total)} accent="#00E5FF" />
        </div>

        {/* Breakdown créditos */}
        {oc.total_credits > 0 && (
          <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Créditos</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <CreditLine label="Devoluções" value={oc.return_credits} />
              <CreditLine label="Cancelamentos" value={oc.cancellation_credits} />
              <CreditLine label="Garantias" value={oc.warranty_credits} />
              <CreditLine label="Divergências" value={oc.divergence_credits} />
              <CreditLine label="Outros" value={oc.other_credits} />
            </div>
          </div>
        )}

        {/* Items */}
        <div className="rounded-xl overflow-x-auto" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #1a1a1f' }}>
            <Package size={16} style={{ color: '#00E5FF' }} />
            <h2 className="text-sm font-semibold text-white">Itens ({items.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#0d0d10' }}>
                {['Produto', 'SKU', 'Pedido', 'Qtd', 'Custo', 'Embal.', 'Manus.', 'Total'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {it.products?.photo_urls?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.products.photo_urls[0]} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded shrink-0" style={{ background: '#1a1a1f' }} />
                      )}
                      <p className="text-white text-xs truncate max-w-[260px]">{it.product_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 font-mono text-xs">{it.partner_sku}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{it.ml_order_id ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-300">{it.quantity}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(it.unit_cost)}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{it.packaging_cost > 0 ? fmtBrl(it.packaging_cost) : '—'}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{it.handling_cost > 0 ? fmtBrl(it.handling_cost) : '—'}</td>
                  <td className="px-4 py-3 font-semibold text-white text-xs">{fmtBrl(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notas seller (se tiver) */}
        {oc.notes && (
          <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Observações do seller</p>
            <p className="text-sm text-zinc-300">{oc.notes}</p>
          </div>
        )}

        {/* CTAs */}
        {!alreadyProcessed && actionResult === null && (
          <div className="rounded-xl p-5" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <p className="text-sm text-zinc-300 mb-4">
              Confira os itens e valores acima. Se tudo estiver correto, aprove a OC. Caso contrário,
              rejeite explicando o motivo (o seller será notificado).
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setShowApprove(true)}
                disabled={!session.can_approve}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: '#22c55e', color: '#fff', opacity: session.can_approve ? 1 : 0.5 }}
              >
                <CheckCircle2 size={16} />
                Aprovar OC
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-colors"
                style={{ border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
              >
                <XCircle size={16} />
                Rejeitar
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-zinc-600 text-center pt-6">
          Este portal é seguro e o link expira em {fmtRelative(session.expires_at)}.
          <br />
          Em caso de dúvidas, entre em contato com o seller.
        </p>
      </main>

      {/* Modal Aprovar */}
      {showApprove && (
        <ApproveModal
          token={token}
          onClose={() => setShowApprove(false)}
          onSuccess={() => { setShowApprove(false); setActionResult('approved') }}
        />
      )}

      {/* Modal Rejeitar */}
      {showReject && (
        <RejectModal
          token={token}
          onClose={() => setShowReject(false)}
          onSuccess={() => { setShowReject(false); setActionResult('rejected') }}
        />
      )}
    </div>
  )
}

// ── Modals ─────────────────────────────────────────────────────────────────────

function ApproveModal({
  token, onClose, onSuccess,
}: { token: string; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!name.trim()) { setErr('Nome obrigatório'); return }
    if (!email.trim()) { setErr('E-mail obrigatório'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch(`${BACKEND}/portal/oc/${token}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_name: name, approver_email: email, notes: notes || undefined }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao aprovar')
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#22c55e]'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <Modal title="Aprovar OC" iconColor="#22c55e" onClose={() => !saving && onClose()}>
      <div>
        <label className={lbl}>Seu nome *</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="Ex: João Silva" autoFocus />
      </div>
      <div>
        <label className={lbl}>Seu e-mail *</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inp} placeholder="joao@parceiro.com.br" />
      </div>
      <div>
        <label className={lbl}>Observações (opcional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inp + ' resize-none'} placeholder="Ex: Aprovado, mas item X chegou avariado — vai entrar como devolução" />
        <p className="text-xs text-zinc-500 mt-1">Se preenchido, OC fica como &quot;aprovada com ressalvas&quot;</p>
      </div>
      {err && <ErrBox msg={err} />}
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>Cancelar</button>
        <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold rounded-lg" style={{ background: '#22c55e', color: '#fff', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Aprovando...' : 'Confirmar Aprovação'}
        </button>
      </div>
    </Modal>
  )
}

function RejectModal({
  token, onClose, onSuccess,
}: { token: string; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!reason.trim()) { setErr('Motivo da rejeição é obrigatório'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch(`${BACKEND}/portal/oc/${token}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_name: name, approver_email: email, reason }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao rejeitar')
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#f87171]'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <Modal title="Rejeitar OC" iconColor="#f87171" onClose={() => !saving && onClose()}>
      <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{
        background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)',
      }}>
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>O seller será notificado e poderá ajustar a OC ou cancelar.</span>
      </div>
      <div>
        <label className={lbl}>Motivo da rejeição *</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} className={inp + ' resize-none'} placeholder="Ex: Item ABC-001 com custo divergente do combinado, aguardando ajuste" autoFocus />
      </div>
      <div>
        <label className={lbl}>Seu nome (opcional)</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inp} />
      </div>
      <div>
        <label className={lbl}>Seu e-mail (opcional)</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inp} />
      </div>
      {err && <ErrBox msg={err} />}
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>Cancelar</button>
        <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold rounded-lg" style={{ background: '#f87171', color: '#09090b', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Rejeitando...' : 'Confirmar Rejeição'}
        </button>
      </div>
    </Modal>
  )
}

// ── Components ─────────────────────────────────────────────────────────────────

function Modal({
  title, iconColor, children, onClose,
}: { title: string; iconColor: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          style={{ background: '#111114', border: `1px solid ${iconColor}33` }}>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {children}
        </div>
      </div>
    </>
  )
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className={`text-sm truncate ${highlight ? 'text-cyan-400 font-semibold' : 'text-white'}`}>
        {value}
      </p>
    </div>
  )
}

function BigKpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function CreditLine({ label, value }: { label: string; value: number }) {
  if (value <= 0) return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-zinc-700 text-sm">—</p>
    </div>
  )
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold" style={{ color: '#fcd34d' }}>-{fmtBrl(value)}</p>
    </div>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg p-3 text-sm" style={{
      background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
    }}>
      <AlertTriangle size={14} className="inline mr-2" />
      {msg}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtRelative(d: string) {
  const ms = new Date(d).getTime() - Date.now()
  if (ms < 0) return 'expirado'
  const hours = Math.floor(ms / 3600000)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days} dia${days !== 1 ? 's' : ''}`
}
