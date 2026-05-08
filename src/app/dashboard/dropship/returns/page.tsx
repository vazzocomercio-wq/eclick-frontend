'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, AlertCircle, Plus, X, RotateCcw, CheckCircle2,
  XCircle, AlertTriangle, Search,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type ReturnType =
  | 'cancellation' | 'return_buyer_regret' | 'return_defective'
  | 'return_wrong_item' | 'return_damaged' | 'return_not_delivered'
  | 'return_incomplete' | 'warranty_claim' | 'reclamation_refund'
  | 'chargeback' | 'partner_negotiated'

type ReturnStatus =
  | 'opened' | 'in_transit_back' | 'received' | 'analyzed'
  | 'approved' | 'credit_pending' | 'credit_applied'
  | 'disputed' | 'rejected' | 'closed'

type Responsibility = 'partner' | 'seller' | 'shared' | 'buyer' | 'undefined'

interface DropshipReturn {
  id: string
  marketplace: string
  ml_order_id: string | null
  shopee_order_id: string | null
  return_type: ReturnType
  source: string
  return_amount: number
  return_quantity: number
  responsibility: Responsibility | null
  status: ReturnStatus
  credit_strategy: string | null
  credit_amount: number | null
  credit_applied_oc_id: string | null
  credit_applied_at: string | null
  buyer_complaint: string | null
  opened_at: string
  resolved_at: string | null
  original_oc_id: string | null
  identification_id: string | null
  suppliers: { id: string; name: string } | null
}

interface SupplierOption {
  id: string
  supplier_id: string
  suppliers: { id: string; name: string }
}

export default function ReturnsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [returns, setReturns] = useState<DropshipReturn[]>([])
  const [partners, setPartners] = useState<SupplierOption[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filterStatus, setFilterStatus] = useState<'open_all' | ReturnStatus | 'all'>('open_all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionMode, setActionMode] = useState<'approve' | 'reject' | null>(null)

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
      if (filterStatus === 'open_all') params.set('status', 'opened,in_transit_back,received,analyzed,approved,credit_pending,disputed')
      else if (filterStatus !== 'all') params.set('status', filterStatus)
      if (search.trim()) params.set('q', search.trim())

      const [rRes, pRes] = await Promise.all([
        fetch(`${BACKEND}/dropship/returns?${params}`, { headers }),
        fetch(`${BACKEND}/dropship/partners?status=active`, { headers }),
      ])
      if (!rRes.ok) throw new Error(`HTTP ${rRes.status}`)
      setReturns(await rRes.json())
      if (pRes.ok) setPartners(await pRes.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
      setReturns([])
    } finally { setLoading(false) }
  }, [getHeaders, filterStatus, search])

  useEffect(() => { load() }, [load])

  // KPIs
  const total = returns.length
  const opened = returns.filter(r => ['opened', 'in_transit_back', 'received', 'analyzed'].includes(r.status)).length
  const creditPending = returns.filter(r => r.status === 'credit_pending').length
  const totalCreditedThisMonth = returns
    .filter(r => r.status === 'credit_applied' && r.credit_applied_at)
    .filter(r => {
      const d = new Date(r.credit_applied_at!)
      const now = new Date()
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    })
    .reduce((s, r) => s + Number(r.credit_amount ?? 0), 0)

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/dropship" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Devoluções</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Cancelamentos, garantias e reclamações que geram crédito do parceiro
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          disabled={partners.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg"
          style={{ background: '#00E5FF', color: '#09090b', opacity: partners.length === 0 ? 0.5 : 1 }}
        >
          <Plus size={15} />
          Nova Devolução
        </button>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total" value={total} />
        <Kpi label="Em aberto" value={opened} accent={opened > 0 ? '#fcd34d' : undefined} />
        <Kpi label="Aguardando crédito" value={creditPending} accent={creditPending > 0 ? '#60a5fa' : undefined} />
        <Kpi label="Creditado no mês" value={fmtBrl(totalCreditedThisMonth)} accent="#22c55e" />
      </div>

      {/* filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden flex-wrap" style={{ border: '1px solid #27272a' }}>
          {(['open_all', 'opened', 'approved', 'credit_pending', 'credit_applied', 'disputed', 'rejected', 'all'] as const).map(s => (
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
            placeholder="Buscar pedido ML/Shopee..."
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
              {['Aberta em', 'Parceiro', 'Pedido', 'Tipo', 'Qtd', 'Valor', 'Responsabilidade', 'Status', 'Crédito', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-zinc-500 text-sm">Carregando...</td></tr>
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  <RotateCcw size={28} className="mx-auto mb-2 text-zinc-700" />
                  Nenhuma devolução nesse filtro.
                  {partners.length === 0 && (
                    <p className="text-xs mt-2">
                      Cadastre um <Link href="/dashboard/dropship/partners" style={{ color: '#00E5FF' }}>parceiro</Link> primeiro.
                    </p>
                  )}
                </td>
              </tr>
            ) : returns.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                <td className="px-4 py-3 text-zinc-400 text-xs">{fmtDateTime(r.opened_at)}</td>
                <td className="px-4 py-3 text-zinc-300">{r.suppliers?.name ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {r.ml_order_id ?? r.shopee_order_id ?? '—'}
                </td>
                <td className="px-4 py-3"><ReturnTypePill type={r.return_type} /></td>
                <td className="px-4 py-3 text-zinc-300">{r.return_quantity}</td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(r.return_amount)}</td>
                <td className="px-4 py-3"><ResponsibilityPill resp={r.responsibility} /></td>
                <td className="px-4 py-3"><ReturnStatusPill status={r.status} /></td>
                <td className="px-4 py-3 text-xs">
                  {r.credit_amount && r.credit_amount > 0 ? (
                    <div>
                      <p style={{ color: '#22c55e' }}>{fmtBrl(r.credit_amount)}</p>
                      {r.credit_strategy && <p className="text-zinc-500" style={{ fontSize: '10px' }}>{strategyLabel(r.credit_strategy)}</p>}
                    </div>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {['opened', 'in_transit_back', 'received', 'analyzed'].includes(r.status) && (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setActionId(r.id); setActionMode('approve') }}
                        className="text-zinc-500 hover:text-green-400"
                        title="Aprovar (gera crédito)"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button
                        onClick={() => { setActionId(r.id); setActionMode('reject') }}
                        className="text-zinc-500 hover:text-red-400"
                        title="Rejeitar"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nova Devolução */}
      {showNew && (
        <NewReturnModal
          partners={partners}
          getHeaders={getHeaders}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
        />
      )}

      {/* Modal Aprovar/Rejeitar */}
      {actionId && actionMode && (
        <ActionModal
          returnId={actionId}
          mode={actionMode}
          getHeaders={getHeaders}
          onClose={() => { setActionId(null); setActionMode(null) }}
          onDone={() => { setActionId(null); setActionMode(null); load() }}
        />
      )}
    </div>
  )
}

// ── Modals ─────────────────────────────────────────────────────────────────────

function NewReturnModal({
  partners, getHeaders, onClose, onCreated,
}: {
  partners: SupplierOption[]
  getHeaders: () => Promise<Record<string, string>>
  onClose: () => void
  onCreated: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [identificationId, setIdentificationId] = useState('')
  const [marketplace, setMarketplace] = useState<'mercado_livre' | 'shopee' | 'amazon' | 'magalu'>('mercado_livre')
  const [returnType, setReturnType] = useState<ReturnType>('return_defective')
  const [returnAmount, setReturnAmount] = useState('')
  const [returnQuantity, setReturnQuantity] = useState('1')
  const [responsibility, setResponsibility] = useState<Responsibility>('partner')
  const [mlOrderId, setMlOrderId] = useState('')
  const [buyerComplaint, setBuyerComplaint] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!supplierId) { setErr('Parceiro obrigatório'); return }
    if (!returnAmount || Number(returnAmount) < 0) { setErr('Valor inválido'); return }
    if (!returnQuantity || Number(returnQuantity) <= 0) { setErr('Quantidade inválida'); return }
    setSaving(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/returns`, {
        method: 'POST', headers,
        body: JSON.stringify({
          supplier_id: supplierId,
          identification_id: identificationId || null,
          marketplace,
          return_type: returnType,
          return_amount: Number(returnAmount),
          return_quantity: Number(returnQuantity),
          responsibility,
          ml_order_id: mlOrderId || null,
          buyer_complaint: buyerComplaint || null,
          internal_notes: internalNotes || null,
          source: 'manual',
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <Modal title="Nova Devolução" onClose={() => !saving && onClose()}>
      <div>
        <label className={lbl}>Parceiro *</label>
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inp}>
          <option value="">— Selecione —</option>
          {partners.map(p => (
            <option key={p.supplier_id} value={p.supplier_id}>{p.suppliers?.name ?? p.supplier_id}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Marketplace *</label>
          <select value={marketplace} onChange={e => setMarketplace(e.target.value as typeof marketplace)} className={inp}>
            <option value="mercado_livre">Mercado Livre</option>
            <option value="shopee">Shopee</option>
            <option value="amazon">Amazon</option>
            <option value="magalu">Magalu</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Pedido ID</label>
          <input value={mlOrderId} onChange={e => setMlOrderId(e.target.value)} className={inp} placeholder="ex: 2000016160896694" />
        </div>
      </div>

      <div>
        <label className={lbl}>Tipo de devolução *</label>
        <select value={returnType} onChange={e => {
          setReturnType(e.target.value as ReturnType)
          // Auto-set responsibility default
          if (e.target.value === 'return_buyer_regret') setResponsibility('buyer')
          else setResponsibility('partner')
        }} className={inp}>
          <option value="cancellation">Cancelamento</option>
          <option value="return_buyer_regret">Arrependimento do comprador</option>
          <option value="return_defective">Produto com defeito</option>
          <option value="return_wrong_item">Item errado enviado</option>
          <option value="return_damaged">Avariado no transporte</option>
          <option value="return_not_delivered">Não entregue</option>
          <option value="return_incomplete">Item incompleto</option>
          <option value="warranty_claim">Garantia</option>
          <option value="reclamation_refund">Reclamação com reembolso</option>
          <option value="chargeback">Chargeback</option>
          <option value="partner_negotiated">Desconto negociado</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Quantidade *</label>
          <input type="number" min="1" value={returnQuantity} onChange={e => setReturnQuantity(e.target.value)} className={inp} />
        </div>
        <div className="col-span-2">
          <label className={lbl}>Valor (R$) *</label>
          <input type="number" step="0.01" min="0" value={returnAmount} onChange={e => setReturnAmount(e.target.value)} className={inp} placeholder="Custo do item × quantidade" />
        </div>
      </div>

      <div>
        <label className={lbl}>Responsabilidade</label>
        <select value={responsibility} onChange={e => setResponsibility(e.target.value as Responsibility)} className={inp}>
          <option value="partner">Parceiro (gera crédito)</option>
          <option value="seller">Seller (você absorve)</option>
          <option value="shared">Dividido (50/50)</option>
          <option value="buyer">Comprador (arrependimento)</option>
          <option value="undefined">Indefinido</option>
        </select>
        <p className="text-xs text-zinc-500 mt-1">
          Apenas &quot;parceiro&quot; ou &quot;dividido&quot; geram crédito ao aprovar
        </p>
      </div>

      <div>
        <label className={lbl}>Reclamação do comprador (opcional)</label>
        <textarea value={buyerComplaint} onChange={e => setBuyerComplaint(e.target.value)} rows={2} className={inp + ' resize-none'} />
      </div>

      <div>
        <label className={lbl}>Notas internas (opcional)</label>
        <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={2} className={inp + ' resize-none'} />
      </div>

      <div>
        <label className={lbl}>ID da identificação dropship (opcional)</label>
        <input value={identificationId} onChange={e => setIdentificationId(e.target.value)} className={inp} placeholder="UUID da dropship_order_identifications" />
        <p className="text-xs text-zinc-500 mt-1">
          Se vincular a um pedido dropship existente, o sistema identifica automaticamente a OC original
        </p>
      </div>

      {err && <ErrBox msg={err} />}
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>Cancelar</button>
        <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold rounded-lg" style={{ background: '#00E5FF', color: '#09090b', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Salvando...' : 'Criar Devolução'}
        </button>
      </div>
    </Modal>
  )
}

function ActionModal({
  returnId, mode, getHeaders, onClose, onDone,
}: {
  returnId: string
  mode: 'approve' | 'reject'
  getHeaders: () => Promise<Record<string, string>>
  onClose: () => void
  onDone: () => void
}) {
  const [responsibility, setResponsibility] = useState<Responsibility>('partner')
  const [reason, setReason] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<{ scenario: string; amount: number } | null>(null)

  async function submit() {
    if (mode === 'reject' && !reason.trim()) { setErr('Motivo obrigatório'); return }
    setSaving(true); setErr('')
    try {
      const headers = await getHeaders()
      const url = mode === 'approve'
        ? `${BACKEND}/dropship/returns/${returnId}/approve`
        : `${BACKEND}/dropship/returns/${returnId}/reject`
      const body = mode === 'approve'
        ? JSON.stringify({ responsibility, resolution_notes: resolutionNotes || undefined })
        : JSON.stringify({ reason })
      const res = await fetch(url, { method: 'POST', headers, body })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      const r = await res.json()
      if (mode === 'approve' && r.scenario) {
        setResult({ scenario: r.scenario, amount: r.amount ?? 0 })
        setTimeout(onDone, 2000)
      } else {
        onDone()
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro')
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none'

  return (
    <Modal
      title={mode === 'approve' ? 'Aprovar Devolução' : 'Rejeitar Devolução'}
      onClose={() => !saving && onClose()}
    >
      {result ? (
        <div className="rounded-lg p-4 space-y-2" style={{
          background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
            Aprovado · cenário <strong>{strategyLabel(result.scenario)}</strong>
          </p>
          {result.amount > 0 && (
            <p className="text-xs text-zinc-300">Crédito gerado: <strong>{fmtBrl(result.amount)}</strong></p>
          )}
        </div>
      ) : mode === 'approve' ? (
        <>
          <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{
            background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)',
          }}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: '#00E5FF' }} />
            <span className="text-zinc-300">
              Sistema vai identificar automaticamente o cenário (mesma OC não paga / OC paga / disputa)
              e gerar crédito conforme régua.
            </span>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Responsabilidade</label>
            <select value={responsibility} onChange={e => setResponsibility(e.target.value as Responsibility)} className={inp}>
              <option value="partner">Parceiro (100% crédito)</option>
              <option value="shared">Dividido (50/50)</option>
              <option value="seller">Seller (sem crédito)</option>
              <option value="buyer">Comprador (sem crédito)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Notas (opcional)</label>
            <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={2} className={inp + ' resize-none'} />
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{
            background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)',
          }}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>Rejeitar marca como &quot;rejected&quot; sem gerar crédito (ex: comprador errado, fora do prazo, etc.)</span>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Motivo *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className={inp + ' resize-none'} placeholder="Ex: Comprador abriu reclamação fora do prazo de 7 dias" />
          </div>
        </>
      )}
      {err && <ErrBox msg={err} />}
      {!result && (
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>Cancelar</button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold rounded-lg"
            style={{
              background: mode === 'approve' ? '#22c55e' : '#f87171',
              color: '#fff', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Processando...' : mode === 'approve' ? 'Aprovar' : 'Rejeitar'}
          </button>
        </div>
      )}
    </Modal>
  )
}

// ── Components ─────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          style={{ background: '#111114', border: '1px solid #27272a' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function ReturnTypePill({ type }: { type: ReturnType }) {
  const m: Record<ReturnType, string> = {
    cancellation: 'Cancel.',
    return_buyer_regret: 'Arrep.',
    return_defective: 'Defeito',
    return_wrong_item: 'Item errado',
    return_damaged: 'Avariado',
    return_not_delivered: 'Não entreg.',
    return_incomplete: 'Incompleto',
    warranty_claim: 'Garantia',
    reclamation_refund: 'Reembolso',
    chargeback: 'Chargeback',
    partner_negotiated: 'Negociado',
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{ background: 'rgba(113,113,122,0.10)', color: '#a1a1aa', border: '1px solid #27272a' }}>
      {m[type]}
    </span>
  )
}

function ResponsibilityPill({ resp }: { resp: Responsibility | null }) {
  if (!resp) return <span className="text-zinc-600 text-xs">—</span>
  const c: Record<Responsibility, { bg: string; fg: string; label: string }> = {
    partner:   { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', label: 'Parceiro' },
    seller:    { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'Seller' },
    shared:    { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: '50/50' },
    buyer:     { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Comprador' },
    undefined: { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Indef.' },
  }
  const x = c[resp]
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.label}
    </span>
  )
}

function ReturnStatusPill({ status }: { status: ReturnStatus }) {
  const c: Record<ReturnStatus, { bg: string; fg: string; label: string }> = {
    opened:           { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Aberta' },
    in_transit_back:  { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'Em trânsito' },
    received:         { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', label: 'Recebido' },
    analyzed:         { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', label: 'Analisado' },
    approved:         { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Aprovada' },
    credit_pending:   { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', label: 'Crédito pendente' },
    credit_applied:   { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Crédito aplicado' },
    disputed:         { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', label: 'Em disputa' },
    rejected:         { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Rejeitada' },
    closed:           { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Fechada' },
  }
  const x = c[status]
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.label}
    </span>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg p-3 text-sm" style={{
      background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
    }}>
      <AlertCircle size={14} className="inline mr-2" />
      {msg}
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────

function filterLabel(s: string): string {
  return s === 'open_all' ? 'Em aberto'
    : s === 'opened' ? 'Abertas'
    : s === 'approved' ? 'Aprovadas'
    : s === 'credit_pending' ? 'Aguard. crédito'
    : s === 'credit_applied' ? 'Creditadas'
    : s === 'disputed' ? 'Disputas'
    : s === 'rejected' ? 'Rejeitadas'
    : 'Todas'
}

function strategyLabel(s: string): string {
  const m: Record<string, string> = {
    same_oc_unpaid: 'mesma OC não paga',
    same_oc_approved_unpaid: 'crédito na OC',
    next_oc_credit: 'próxima OC',
    pending_dispute: 'em disputa',
  }
  return m[s] ?? s
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
