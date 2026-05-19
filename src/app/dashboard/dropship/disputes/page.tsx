'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, AlertCircle, Plus, X, Scale, Gavel,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type DisputeType = 'cost_divergence' | 'responsibility' | 'amount' | 'product_returned' | 'item_inclusion' | 'other'
type DisputeStatus = 'open' | 'in_review' | 'mediation' | 'resolved_partner' | 'resolved_seller' | 'resolved_compromise' | 'escalated' | 'closed'

interface Dispute {
  id: string
  dispute_type: DisputeType
  claimed_by: 'seller' | 'partner'
  claimed_by_name: string | null
  claimed_at: string
  amount_claimed: number | null
  amount_partner_accepts: number | null
  amount_seller_proposes: number | null
  final_resolved_amount: number | null
  reason: string
  status: DisputeStatus
  return_id: string | null
  oc_item_id: string | null
  oc_id: string | null
  resolution: string | null
  resolved_at: string | null
  created_at: string
  suppliers: { id: string; name: string } | null
}

interface SupplierOption {
  supplier_id: string
  suppliers: { id: string; name: string }
}

export default function DisputesPage() {
  const t = useTranslations('dropship.disputes')
  const supabase = useMemo(() => createClient(), [])

  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [partners, setPartners] = useState<SupplierOption[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filterStatus, setFilterStatus] = useState<'open_all' | DisputeStatus | 'all'>('open_all')
  const [showNew, setShowNew] = useState(false)
  const [resolveId, setResolveId] = useState<string | null>(null)

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
      if (filterStatus === 'open_all') params.set('status', 'open,in_review,mediation,escalated')
      else if (filterStatus !== 'all') params.set('status', filterStatus)
      const [dRes, pRes] = await Promise.all([
        fetch(`${BACKEND}/dropship/disputes?${params}`, { headers }),
        fetch(`${BACKEND}/dropship/partners?status=active`, { headers }),
      ])
      if (!dRes.ok) throw new Error(`HTTP ${dRes.status}`)
      setDisputes(await dRes.json())
      if (pRes.ok) setPartners(await pRes.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.loadFailed'))
    } finally { setLoading(false) }
  }, [getHeaders, filterStatus, t])

  useEffect(() => { load() }, [load])

  const total = disputes.length
  const open = disputes.filter(d => ['open', 'in_review', 'mediation'].includes(d.status)).length
  const escalated = disputes.filter(d => d.status === 'escalated').length

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
          {t('openDispute')}
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Kpi label={t('kpi.total')} value={total} />
        <Kpi label={t('kpi.open')} value={open} accent={open > 0 ? '#fcd34d' : undefined} />
        <Kpi label={t('kpi.escalated')} value={escalated} accent={escalated > 0 ? '#f87171' : undefined} />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden flex-wrap" style={{ border: '1px solid #27272a' }}>
          {(['open_all', 'open', 'in_review', 'escalated', 'resolved_partner', 'resolved_seller', 'resolved_compromise', 'all'] as const).map(s => (
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
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #1a1a1f' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
              {[t('table.openedAt'), t('table.partner'), t('table.type'), t('table.openedBy'), t('table.reason'), t('table.value'), t('table.status'), ''].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-500 text-sm">{t('loading')}</td></tr>
            ) : disputes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  <Scale size={28} className="mx-auto mb-2 text-zinc-700" />
                  {t('emptyFilter')}
                </td>
              </tr>
            ) : disputes.map(d => (
              <tr key={d.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                <td className="px-4 py-3 text-zinc-400 text-xs">{fmtDateTime(d.claimed_at)}</td>
                <td className="px-4 py-3 text-zinc-300">{d.suppliers?.name ?? '—'}</td>
                <td className="px-4 py-3"><DisputeTypePill type={d.dispute_type} t={t} /></td>
                <td className="px-4 py-3 text-zinc-300 text-xs">
                  <span className="font-medium" style={{ color: d.claimed_by === 'partner' ? '#fcd34d' : '#60a5fa' }}>
                    {d.claimed_by === 'partner' ? t('claimedBy.partner') : t('claimedBy.seller')}
                  </span>
                  {d.claimed_by_name && <span className="text-zinc-500"> · {d.claimed_by_name}</span>}
                </td>
                <td className="px-4 py-3">
                  <p className="text-white text-xs truncate max-w-[280px]">{d.reason}</p>
                </td>
                <td className="px-4 py-3 text-zinc-300 text-xs">
                  {d.amount_claimed != null ? fmtBrl(d.amount_claimed) : '—'}
                  {d.final_resolved_amount != null && (
                    <p className="text-zinc-500" style={{ fontSize: '10px' }}>
                      {t('finalLabel')}: {fmtBrl(d.final_resolved_amount)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3"><DisputeStatusPill status={d.status} t={t} /></td>
                <td className="px-4 py-3 text-right">
                  {!['resolved_partner', 'resolved_seller', 'resolved_compromise', 'closed'].includes(d.status) && (
                    <button
                      onClick={() => setResolveId(d.id)}
                      className="text-zinc-500 hover:text-green-400"
                      title={t('resolve')}
                    >
                      <Gavel size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewDisputeModal
          partners={partners}
          getHeaders={getHeaders}
          t={t}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
        />
      )}

      {resolveId && (
        <ResolveDisputeModal
          disputeId={resolveId}
          getHeaders={getHeaders}
          t={t}
          onClose={() => setResolveId(null)}
          onResolved={() => { setResolveId(null); load() }}
        />
      )}
    </div>
  )
}

// ── Modals ─────────────────────────────────────────────────────────────────────

type TFn = ReturnType<typeof useTranslations>

function NewDisputeModal({
  partners, getHeaders, t, onClose, onCreated,
}: {
  partners: SupplierOption[]
  getHeaders: () => Promise<Record<string, string>>
  t: TFn
  onClose: () => void
  onCreated: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [disputeType, setDisputeType] = useState<DisputeType>('cost_divergence')
  const [claimedBy, setClaimedBy] = useState<'seller' | 'partner'>('seller')
  const [claimedByName, setClaimedByName] = useState('')
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [amountClaimed, setAmountClaimed] = useState('')
  const [returnId, setReturnId] = useState('')
  const [ocId, setOcId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Listas pra dropdown (filtradas por supplierId)
  const [ocOptions, setOcOptions] = useState<Array<{ id: string; oc_number: string; reference_date: string; net_total: number }>>([])
  const [returnOptions, setReturnOptions] = useState<Array<{ id: string; return_type: string; return_amount: number; opened_at: string }>>([])
  const [loadingRefs, setLoadingRefs] = useState(false)

  // Buscar OCs e Returns do supplier ao mudar
  useEffect(() => {
    if (!supplierId) {
      setOcOptions([])
      setReturnOptions([])
      setOcId('')
      setReturnId('')
      return
    }
    let cancelled = false
    setLoadingRefs(true)
    setOcId('')
    setReturnId('')
    ;(async () => {
      try {
        const headers = await getHeaders()
        const [ocRes, retRes] = await Promise.all([
          fetch(`${BACKEND}/dropship/oc?supplier_id=${supplierId}`, { headers }),
          fetch(`${BACKEND}/dropship/returns?supplier_id=${supplierId}`, { headers }),
        ])
        if (!cancelled) {
          if (ocRes.ok) setOcOptions(await ocRes.json())
          if (retRes.ok) setReturnOptions(await retRes.json())
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoadingRefs(false) }
    })()
    return () => { cancelled = true }
  }, [supplierId, getHeaders])

  async function submit() {
    if (!supplierId) { setErr(t('errors.partnerRequired')); return }
    if (!reason.trim()) { setErr(t('errors.reasonRequired')); return }
    setSaving(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/disputes`, {
        method: 'POST', headers,
        body: JSON.stringify({
          supplier_id: supplierId,
          dispute_type: disputeType,
          claimed_by: claimedBy,
          claimed_by_name: claimedByName || null,
          reason,
          description: description || null,
          amount_claimed: amountClaimed ? Number(amountClaimed) : null,
          return_id: returnId || null,
          oc_id: ocId || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.generic'))
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
          <label className={lbl}>{t('newModal.type')}</label>
          <select value={disputeType} onChange={e => setDisputeType(e.target.value as DisputeType)} className={inp}>
            <option value="cost_divergence">{t('typeOption.costDivergence')}</option>
            <option value="responsibility">{t('typeOption.responsibility')}</option>
            <option value="amount">{t('typeOption.amount')}</option>
            <option value="product_returned">{t('typeOption.productReturned')}</option>
            <option value="item_inclusion">{t('typeOption.itemInclusion')}</option>
            <option value="other">{t('typeOption.other')}</option>
          </select>
        </div>
        <div>
          <label className={lbl}>{t('newModal.openedBy')}</label>
          <select value={claimedBy} onChange={e => setClaimedBy(e.target.value as 'seller' | 'partner')} className={inp}>
            <option value="seller">{t('newModal.openedBySeller')}</option>
            <option value="partner">{t('claimedBy.partner')}</option>
          </select>
        </div>
      </div>
      <div>
        <label className={lbl}>{t('newModal.openerName')}</label>
        <input value={claimedByName} onChange={e => setClaimedByName(e.target.value)} className={inp} />
      </div>
      <div>
        <label className={lbl}>{t('newModal.reason')}</label>
        <input value={reason} onChange={e => setReason(e.target.value)} className={inp} placeholder={t('newModal.reasonPlaceholder')} />
      </div>
      <div>
        <label className={lbl}>{t('newModal.description')}</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inp + ' resize-none'} />
      </div>
      <div>
        <label className={lbl}>{t('newModal.amountClaimed')}</label>
        <input type="number" step="0.01" value={amountClaimed} onChange={e => setAmountClaimed(e.target.value)} className={inp} />
      </div>

      {supplierId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>{t('newModal.linkedOc')}</label>
            {loadingRefs ? (
              <div className={inp + ' text-zinc-500'}>{t('loading')}</div>
            ) : ocOptions.length === 0 ? (
              <div className={inp + ' text-zinc-500'}>{t('newModal.noOcs')}</div>
            ) : (
              <select value={ocId} onChange={e => setOcId(e.target.value)} className={inp}>
                <option value="">{t('newModal.none')}</option>
                {ocOptions.slice(0, 50).map(oc => (
                  <option key={oc.id} value={oc.id}>
                    {oc.oc_number} · {fmtDate(oc.reference_date)} · {fmtBrl(oc.net_total)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className={lbl}>{t('newModal.linkedReturn')}</label>
            {loadingRefs ? (
              <div className={inp + ' text-zinc-500'}>{t('loading')}</div>
            ) : returnOptions.length === 0 ? (
              <div className={inp + ' text-zinc-500'}>{t('newModal.noReturns')}</div>
            ) : (
              <select value={returnId} onChange={e => setReturnId(e.target.value)} className={inp}>
                <option value="">{t('newModal.none')}</option>
                {returnOptions.slice(0, 50).map(r => (
                  <option key={r.id} value={r.id}>
                    {returnTypeLabel(r.return_type, t)} · {fmtDate(r.opened_at)} · {fmtBrl(r.return_amount)}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}
      {err && <ErrBox msg={err} />}
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>{t('cancel')}</button>
        <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold rounded-lg" style={{ background: '#00E5FF', color: '#09090b', opacity: saving ? 0.6 : 1 }}>
          {saving ? t('newModal.opening') : t('openDispute')}
        </button>
      </div>
    </Modal>
  )
}

function ResolveDisputeModal({
  disputeId, getHeaders, t, onClose, onResolved,
}: {
  disputeId: string
  getHeaders: () => Promise<Record<string, string>>
  t: TFn
  onClose: () => void
  onResolved: () => void
}) {
  const [resolutionType, setResolutionType] = useState<'resolved_partner' | 'resolved_seller' | 'resolved_compromise'>('resolved_compromise')
  const [finalAmount, setFinalAmount] = useState('')
  const [resolution, setResolution] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!resolution.trim()) { setErr(t('errors.resolutionRequired')); return }
    setSaving(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/disputes/${disputeId}/resolve`, {
        method: 'POST', headers,
        body: JSON.stringify({
          resolution_type: resolutionType,
          final_resolved_amount: finalAmount ? Number(finalAmount) : null,
          resolution,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      onResolved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.generic'))
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none'

  return (
    <Modal title={t('resolveModal.title')} onClose={() => !saving && onClose()}>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">{t('resolveModal.inFavorOf')}</label>
        <select value={resolutionType} onChange={e => setResolutionType(e.target.value as typeof resolutionType)} className={inp}>
          <option value="resolved_partner">{t('resolveModal.favorPartner')}</option>
          <option value="resolved_seller">{t('resolveModal.favorSeller')}</option>
          <option value="resolved_compromise">{t('resolveModal.favorCompromise')}</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">{t('resolveModal.finalAmount')}</label>
        <input type="number" step="0.01" value={finalAmount} onChange={e => setFinalAmount(e.target.value)} className={inp} placeholder={t('resolveModal.finalAmountPlaceholder')} />
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">{t('resolveModal.resolutionText')}</label>
        <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={4} className={inp + ' resize-none'} placeholder={t('resolveModal.resolutionPlaceholder')} />
      </div>
      {err && <ErrBox msg={err} />}
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={() => !saving && onClose()} disabled={saving} className="px-4 py-2 text-sm rounded-lg text-zinc-400 hover:text-white" style={{ border: '1px solid #27272a' }}>{t('cancel')}</button>
        <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm font-semibold rounded-lg" style={{ background: '#22c55e', color: '#fff', opacity: saving ? 0.6 : 1 }}>
          {saving ? t('resolveModal.resolving') : t('resolveModal.confirm')}
        </button>
      </div>
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

function DisputeTypePill({ type, t }: { type: DisputeType; t: TFn }) {
  const keys: Record<DisputeType, string> = {
    cost_divergence: 'typePill.costDivergence',
    responsibility: 'typePill.responsibility',
    amount: 'typePill.amount',
    product_returned: 'typePill.productReturned',
    item_inclusion: 'typePill.itemInclusion',
    other: 'typePill.other',
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{ background: 'rgba(113,113,122,0.10)', color: '#a1a1aa', border: '1px solid #27272a' }}>
      {t(keys[type])}
    </span>
  )
}

function DisputeStatusPill({ status, t }: { status: DisputeStatus; t: TFn }) {
  const c: Record<DisputeStatus, { bg: string; fg: string; key: string }> = {
    open:                { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', key: 'statusPill.open' },
    in_review:           { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', key: 'statusPill.inReview' },
    mediation:           { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', key: 'statusPill.mediation' },
    resolved_partner:    { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', key: 'statusPill.resolvedPartner' },
    resolved_seller:     { bg: 'rgba(96,165,250,0.10)',  fg: '#60a5fa', key: 'statusPill.resolvedSeller' },
    resolved_compromise: { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', key: 'statusPill.resolvedCompromise' },
    escalated:           { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', key: 'statusPill.escalated' },
    closed:              { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', key: 'statusPill.closed' },
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

function filterLabel(s: string, t: TFn): string {
  return s === 'open_all' ? t('filter.openAll')
    : s === 'open' ? t('filter.open')
    : s === 'in_review' ? t('filter.inReview')
    : s === 'escalated' ? t('filter.escalated')
    : s === 'resolved_partner' ? t('filter.resolvedPartner')
    : s === 'resolved_seller' ? t('filter.resolvedSeller')
    : s === 'resolved_compromise' ? t('filter.resolvedCompromise')
    : t('filter.all')
}

function returnTypeLabel(rt: string, t: TFn): string {
  const keys: Record<string, string> = {
    cancellation: 'returnType.cancellation',
    return_buyer_regret: 'returnType.buyerRegret',
    return_defective: 'returnType.defective',
    return_wrong_item: 'returnType.wrongItem',
    return_damaged: 'returnType.damaged',
    return_not_delivered: 'returnType.notDelivered',
    return_incomplete: 'returnType.incomplete',
    warranty_claim: 'returnType.warranty',
    reclamation_refund: 'returnType.refund',
    chargeback: 'returnType.chargeback',
    partner_negotiated: 'returnType.negotiated',
  }
  return keys[rt] ? t(keys[rt]) : rt
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
