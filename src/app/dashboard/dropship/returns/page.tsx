'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, AlertCircle, Plus, X, RotateCcw, CheckCircle2,
  XCircle, AlertTriangle, Search,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type ReturnKind =
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
  return_type: ReturnKind
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
  const t = useTranslations('dropship.returns')
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
    if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase, t])

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
      setErr(e instanceof Error ? e.message : t('errors.loadFailed'))
      setReturns([])
    } finally { setLoading(false) }
  }, [getHeaders, filterStatus, search, t])

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
            <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {t('subtitle')}
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
          {t('newReturn')}
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
        <Kpi label={t('kpi.total')} value={total} />
        <Kpi label={t('kpi.open')} value={opened} accent={opened > 0 ? '#fcd34d' : undefined} />
        <Kpi label={t('kpi.awaitingCredit')} value={creditPending} accent={creditPending > 0 ? '#60a5fa' : undefined} />
        <Kpi label={t('kpi.creditedThisMonth')} value={fmtBrl(totalCreditedThisMonth)} accent="#22c55e" />
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
              {[t('table.openedAt'), t('table.partner'), t('table.order'), t('table.type'), t('table.qty'), t('table.value'), t('table.responsibility'), t('table.status'), t('table.credit'), ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-zinc-500 text-sm">{t('loading')}</td></tr>
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  <RotateCcw size={28} className="mx-auto mb-2 text-zinc-700" />
                  {t('emptyFilter')}
                  {partners.length === 0 && (
                    <p className="text-xs mt-2">
                      {t.rich('needPartner', {
                        link: (chunks) => <Link href="/dashboard/dropship/partners" style={{ color: '#00E5FF' }}>{chunks}</Link>,
                      })}
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
                <td className="px-4 py-3"><ReturnTypePill type={r.return_type} t={t} /></td>
                <td className="px-4 py-3 text-zinc-300">{r.return_quantity}</td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtBrl(r.return_amount)}</td>
                <td className="px-4 py-3"><ResponsibilityPill resp={r.responsibility} t={t} /></td>
                <td className="px-4 py-3"><ReturnStatusPill status={r.status} t={t} /></td>
                <td className="px-4 py-3 text-xs">
                  {r.credit_amount && r.credit_amount > 0 ? (
                    <div>
                      <p style={{ color: '#22c55e' }}>{fmtBrl(r.credit_amount)}</p>
                      {r.credit_strategy && <p className="text-zinc-500" style={{ fontSize: '10px' }}>{strategyLabel(r.credit_strategy, t)}</p>}
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
                        title={t('approveTooltip')}
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button
                        onClick={() => { setActionId(r.id); setActionMode('reject') }}
                        className="text-zinc-500 hover:text-red-400"
                        title={t('reject')}
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
          t={t}
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
          t={t}
          onClose={() => { setActionId(null); setActionMode(null) }}
          onDone={() => { setActionId(null); setActionMode(null); load() }}
        />
      )}
    </div>
  )
}

// ── Modals ─────────────────────────────────────────────────────────────────────

type TFn = ReturnType<typeof useTranslations>

function NewReturnModal({
  partners, getHeaders, t, onClose, onCreated,
}: {
  partners: SupplierOption[]
  getHeaders: () => Promise<Record<string, string>>
  t: TFn
  onClose: () => void
  onCreated: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [identificationId, setIdentificationId] = useState('')
  const [marketplace, setMarketplace] = useState<'mercado_livre' | 'shopee' | 'amazon' | 'magalu'>('mercado_livre')
  const [returnType, setReturnType] = useState<ReturnKind>('return_defective')
  const [returnAmount, setReturnAmount] = useState('')
  const [returnQuantity, setReturnQuantity] = useState('1')
  const [responsibility, setResponsibility] = useState<Responsibility>('partner')
  const [mlOrderId, setMlOrderId] = useState('')
  const [buyerComplaint, setBuyerComplaint] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!supplierId) { setErr(t('errors.partnerRequired')); return }
    if (!returnAmount || Number(returnAmount) < 0) { setErr(t('errors.invalidValue')); return }
    if (!returnQuantity || Number(returnQuantity) <= 0) { setErr(t('errors.invalidQuantity')); return }
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
      setErr(e instanceof Error ? e.message : t('errors.saveFailed'))
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <Modal title={t('newModal.title')} onClose={() => !saving && onClose()}>
      <div>
        <label className={lbl}>{t('newModal.partner')}</label>
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inp}>
          <option value="">{t('selectPlaceholder')}</option>
          {partners.map(p => (
            <option key={p.supplier_id} value={p.supplier_id}>{p.suppliers?.name ?? p.supplier_id}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>{t('newModal.marketplace')}</label>
          <select value={marketplace} onChange={e => setMarketplace(e.target.value as typeof marketplace)} className={inp}>
            <option value="mercado_livre">Mercado Livre</option>
            <option value="shopee">Shopee</option>
            <option value="amazon">Amazon</option>
            <option value="magalu">Magalu</option>
          </select>
        </div>
        <div>
          <label className={lbl}>{t('newModal.orderId')}</label>
          <input value={mlOrderId} onChange={e => setMlOrderId(e.target.value)} className={inp} placeholder="ex: 2000016160896694" />
        </div>
      </div>

      <div>
        <label className={lbl}>{t('newModal.returnType')}</label>
        <select value={returnType} onChange={e => {
          setReturnType(e.target.value as ReturnKind)
          // Auto-set responsibility default
          if (e.target.value === 'return_buyer_regret') setResponsibility('buyer')
          else setResponsibility('partner')
        }} className={inp}>
          <option value="cancellation">{t('typeOption.cancellation')}</option>
          <option value="return_buyer_regret">{t('typeOption.buyerRegret')}</option>
          <option value="return_defective">{t('typeOption.defective')}</option>
          <option value="return_wrong_item">{t('typeOption.wrongItem')}</option>
          <option value="return_damaged">{t('typeOption.damaged')}</option>
          <option value="return_not_delivered">{t('typeOption.notDelivered')}</option>
          <option value="return_incomplete">{t('typeOption.incomplete')}</option>
          <option value="warranty_claim">{t('typeOption.warranty')}</option>
          <option value="reclamation_refund">{t('typeOption.refund')}</option>
          <option value="chargeback">{t('typeOption.chargeback')}</option>
          <option value="partner_negotiated">{t('typeOption.negotiated')}</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>{t('newModal.quantity')}</label>
          <input type="number" min="1" value={returnQuantity} onChange={e => setReturnQuantity(e.target.value)} className={inp} />
        </div>
        <div className="col-span-2">
          <label className={lbl}>{t('newModal.value')}</label>
          <input type="number" step="0.01" min="0" value={returnAmount} onChange={e => setReturnAmount(e.target.value)} className={inp} placeholder={t('newModal.valuePlaceholder')} />
        </div>
      </div>

      <div>
        <label className={lbl}>{t('newModal.responsibility')}</label>
        <select value={responsibility} onChange={e => setResponsibility(e.target.value as Responsibility)} className={inp}>
          <option value="partner">{t('respOption.partnerCredit')}</option>
          <option value="seller">{t('respOption.sellerAbsorb')}</option>
          <option value="shared">{t('respOption.shared')}</option>
          <option value="buyer">{t('respOption.buyer')}</option>
          <option value="undefined">{t('respOption.undefined')}</option>
        </select>
        <p className="text-xs text-zinc-500 mt-1">
          {t('newModal.responsibilityHint')}
        </p>
      </div>

      <div>
        <label className={lbl}>{t('newModal.buyerComplaint')}</label>
        <textarea value={buyerComplaint} onChange={e => setBuyerComplaint(e.target.value)} rows={2} className={inp + ' resize-none'} />
      </div>

      <div>
        <label className={lbl}>{t('newModal.internalNotes')}</label>
        <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={2} className={inp + ' resize-none'} />
      </div>

      <div>
        <label className={lbl}>{t('newModal.identificationId')}</label>
        <input value={identificationId} onChange={e => setIdentificationId(e.target.value)} className={inp} placeholder={t('newModal.identificationIdPlaceholder')} />
        <p className="text-xs text-zinc-500 mt-1">
          {t('newModal.identificationIdHint')}
        </p>
      </div>

      {err && <ErrBox msg={err} />}
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>{t('cancel')}</button>
        <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold rounded-lg" style={{ background: '#00E5FF', color: '#09090b', opacity: saving ? 0.6 : 1 }}>
          {saving ? t('saving') : t('createReturn')}
        </button>
      </div>
    </Modal>
  )
}

function ActionModal({
  returnId, mode, getHeaders, t, onClose, onDone,
}: {
  returnId: string
  mode: 'approve' | 'reject'
  getHeaders: () => Promise<Record<string, string>>
  t: TFn
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
    if (mode === 'reject' && !reason.trim()) { setErr(t('errors.reasonRequired')); return }
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
      setErr(e instanceof Error ? e.message : t('errors.generic'))
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none'

  return (
    <Modal
      title={mode === 'approve' ? t('actionModal.approveTitle') : t('actionModal.rejectTitle')}
      onClose={() => !saving && onClose()}
    >
      {result ? (
        <div className="rounded-lg p-4 space-y-2" style={{
          background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
            {t.rich('actionModal.approvedScenario', { scenario: strategyLabel(result.scenario, t), strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
          {result.amount > 0 && (
            <p className="text-xs text-zinc-300">{t.rich('actionModal.creditGenerated', { amount: fmtBrl(result.amount), strong: (chunks) => <strong>{chunks}</strong> })}</p>
          )}
        </div>
      ) : mode === 'approve' ? (
        <>
          <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{
            background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)',
          }}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: '#00E5FF' }} />
            <span className="text-zinc-300">
              {t('actionModal.approveHint')}
            </span>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">{t('newModal.responsibility')}</label>
            <select value={responsibility} onChange={e => setResponsibility(e.target.value as Responsibility)} className={inp}>
              <option value="partner">{t('approveResp.partner')}</option>
              <option value="shared">{t('approveResp.shared')}</option>
              <option value="seller">{t('approveResp.seller')}</option>
              <option value="buyer">{t('approveResp.buyer')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">{t('actionModal.notes')}</label>
            <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={2} className={inp + ' resize-none'} />
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg p-3 text-xs flex items-start gap-2" style={{
            background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)',
          }}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{t('actionModal.rejectHint')}</span>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">{t('actionModal.reason')}</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className={inp + ' resize-none'} placeholder={t('actionModal.reasonPlaceholder')} />
          </div>
        </>
      )}
      {err && <ErrBox msg={err} />}
      {!result && (
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>{t('cancel')}</button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold rounded-lg"
            style={{
              background: mode === 'approve' ? '#22c55e' : '#f87171',
              color: '#fff', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? t('actionModal.processing') : mode === 'approve' ? t('approve') : t('reject')}
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

function ReturnTypePill({ type, t }: { type: ReturnKind; t: TFn }) {
  const keys: Record<ReturnKind, string> = {
    cancellation: 'typePill.cancellation',
    return_buyer_regret: 'typePill.buyerRegret',
    return_defective: 'typePill.defective',
    return_wrong_item: 'typePill.wrongItem',
    return_damaged: 'typePill.damaged',
    return_not_delivered: 'typePill.notDelivered',
    return_incomplete: 'typePill.incomplete',
    warranty_claim: 'typePill.warranty',
    reclamation_refund: 'typePill.refund',
    chargeback: 'typePill.chargeback',
    partner_negotiated: 'typePill.negotiated',
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{ background: 'rgba(113,113,122,0.10)', color: '#a1a1aa', border: '1px solid #27272a' }}>
      {t(keys[type])}
    </span>
  )
}

function ResponsibilityPill({ resp, t }: { resp: Responsibility | null; t: TFn }) {
  if (!resp) return <span className="text-zinc-600 text-xs">—</span>
  const c: Record<Responsibility, { bg: string; fg: string; key: string }> = {
    partner:   { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', key: 'respPill.partner' },
    seller:    { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', key: 'respPill.seller' },
    shared:    { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', key: 'respPill.shared' },
    buyer:     { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', key: 'respPill.buyer' },
    undefined: { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', key: 'respPill.undefined' },
  }
  const x = c[resp]
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {t(x.key)}
    </span>
  )
}

function ReturnStatusPill({ status, t }: { status: ReturnStatus; t: TFn }) {
  const c: Record<ReturnStatus, { bg: string; fg: string; key: string }> = {
    opened:           { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', key: 'statusPill.opened' },
    in_transit_back:  { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', key: 'statusPill.inTransit' },
    received:         { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', key: 'statusPill.received' },
    analyzed:         { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', key: 'statusPill.analyzed' },
    approved:         { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', key: 'statusPill.approved' },
    credit_pending:   { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', key: 'statusPill.creditPending' },
    credit_applied:   { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', key: 'statusPill.creditApplied' },
    disputed:         { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', key: 'statusPill.disputed' },
    rejected:         { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', key: 'statusPill.rejected' },
    closed:           { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', key: 'statusPill.closed' },
  }
  const x = c[status]
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {t(x.key)}
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

function filterLabel(s: string, t: TFn): string {
  return s === 'open_all' ? t('filter.openAll')
    : s === 'opened' ? t('filter.opened')
    : s === 'approved' ? t('filter.approved')
    : s === 'credit_pending' ? t('filter.creditPending')
    : s === 'credit_applied' ? t('filter.creditApplied')
    : s === 'disputed' ? t('filter.disputed')
    : s === 'rejected' ? t('filter.rejected')
    : t('filter.all')
}

function strategyLabel(s: string, t: TFn): string {
  const keys: Record<string, string> = {
    same_oc_unpaid: 'strategy.sameOcUnpaid',
    same_oc_approved_unpaid: 'strategy.creditInOc',
    next_oc_credit: 'strategy.nextOc',
    pending_dispute: 'strategy.inDispute',
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
