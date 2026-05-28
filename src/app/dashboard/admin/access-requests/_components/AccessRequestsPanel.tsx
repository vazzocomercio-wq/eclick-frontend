'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, CheckCircle2, XCircle, RefreshCw, Mail, Phone, Building2,
  MessageCircle, Tag, Clock, AlertCircle, ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface AccessRequest {
  id:                     string
  name:                   string
  email:                  string
  phone:                  string | null
  company:                string | null
  message:                string | null
  requested_plan_key:     string | null
  status:                 'pending' | 'approved' | 'rejected' | 'paid' | 'provisioned' | 'cancelled'
  payment_provider:       string | null
  paid_at:                string | null
  reviewed_at:            string | null
  rejection_reason:       string | null
  provisioned_user_id:    string | null
  provisioned_org_id:     string | null
  created_at:             string
}

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'provisioned' | 'all'

const STATUS_CFG: Record<AccessRequest['status'], { color: string; bg: string; label: string }> = {
  pending:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  label: 'Pendente' },
  approved:    { color: '#a5f3fc', bg: 'rgba(165,243,252,0.10)', label: 'Aprovado' },
  paid:        { color: '#a5f3fc', bg: 'rgba(165,243,252,0.10)', label: 'Pago' },
  rejected:    { color: '#f87171', bg: 'rgba(248,113,113,0.10)', label: 'Rejeitado' },
  provisioned: { color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  label: 'Provisionado' },
  cancelled:   { color: '#71717a', bg: 'rgba(113,113,122,0.15)', label: 'Cancelado' },
}

export function AccessRequestsPanel() {
  const [items, setItems]     = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<StatusFilter>('pending')
  const [working, setWorking] = useState<string | null>(null)
  const confirm = useConfirm()

  const getHeaders = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const headers = await getHeaders()
      const qs = filter === 'all' ? '' : `?status=${filter}`
      const res = await fetch(`${BACKEND}/access/admin/requests${qs}`, { headers })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      setItems(await res.json())
    } catch (e) {
      setError((e as Error).message ?? 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [filter, getHeaders])

  useEffect(() => { load() }, [load])

  async function approve(req: AccessRequest) {
    const ok = await confirm({
      title:        'Aprovar pedido',
      message:      `Provisionar acesso pra ${req.name} (${req.email}) com plano ${req.requested_plan_key ?? '— sem plano'}? Vai criar a conta e enviar e-mail de convite.`,
      confirmLabel: 'Aprovar',
      variant:      'default',
    })
    if (!ok) return
    if (!req.requested_plan_key) {
      alert('Pedido sem plano selecionado — peça pro contato escolher um plano antes de aprovar.')
      return
    }
    setWorking(req.id)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/access/admin/requests/${req.id}/approve`, {
        method: 'POST', headers,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message ?? `HTTP ${res.status}`)
      }
      await load()
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally { setWorking(null) }
  }

  async function reject(req: AccessRequest) {
    const reason = prompt(`Rejeitar pedido de ${req.email}. Motivo (opcional, vai pro histórico):`)
    if (reason === null) return
    setWorking(req.id)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/access/admin/requests/${req.id}/reject`, {
        method: 'POST', headers, body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally { setWorking(null) }
  }

  const counts: Record<StatusFilter, number> = {
    pending:     items.filter(i => i.status === 'pending').length,
    approved:    items.filter(i => i.status === 'approved' || i.status === 'paid').length,
    rejected:    items.filter(i => i.status === 'rejected').length,
    provisioned: items.filter(i => i.status === 'provisioned').length,
    all:         items.length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-zinc-500 text-xs">Admin · Plataforma</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Pedidos de acesso</h2>
          <p className="text-zinc-500 text-xs mt-1">
            Cadastros via /solicitar-acesso. Aprovar cria a conta + envia e-mail de convite pra definir senha.
          </p>
        </div>
        <button onClick={load} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
                style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'provisioned', 'all'] as StatusFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
                  style={{
                    background:  filter === f ? '#00E5FF' : '#111114',
                    color:       filter === f ? '#000'    : '#a1a1aa',
                    borderColor: filter === f ? '#00E5FF' : '#1e1e24',
                  }}>
            {f === 'pending' && 'Pendentes'}
            {f === 'approved' && 'Aprovados'}
            {f === 'rejected' && 'Rejeitados'}
            {f === 'provisioned' && 'Provisionados'}
            {f === 'all' && 'Todos'}
            {' '}<span className="opacity-60">({counts[f] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg p-3 text-sm"
             style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.30)' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-zinc-500 text-sm">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg p-8 text-center text-sm text-zinc-500"
             style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          Nenhum pedido {filter !== 'all' ? `com status "${filter}"` : ''} agora.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(r => (
            <RequestCard
              key={r.id} req={r}
              onApprove={() => approve(r)}
              onReject={() => reject(r)}
              working={working === r.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestCard({ req, onApprove, onReject, working }: {
  req: AccessRequest
  onApprove: () => void
  onReject: () => void
  working: boolean
}) {
  const cfg  = STATUS_CFG[req.status] ?? STATUS_CFG.pending
  const when = new Date(req.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const canApprove = req.status === 'pending' || req.status === 'approved' || req.status === 'paid'
  const canReject  = req.status !== 'rejected' && req.status !== 'provisioned'

  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white text-sm font-semibold truncate">{req.name}</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400">
            <a href={`mailto:${req.email}`}
               className="flex items-center gap-1 hover:text-white transition-colors">
              <Mail size={11} /> {req.email}
            </a>
            {req.phone && (
              <a href={`https://wa.me/${req.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                 className="flex items-center gap-1 hover:text-green-400 transition-colors">
                <Phone size={11} /> {req.phone}
              </a>
            )}
            {req.company && (
              <span className="flex items-center gap-1">
                <Building2 size={11} /> {req.company}
              </span>
            )}
            {req.requested_plan_key && (
              <span className="flex items-center gap-1" style={{ color: '#00E5FF' }}>
                <Tag size={11} /> {req.requested_plan_key}
              </span>
            )}
            <span className="flex items-center gap-1 text-zinc-600">
              <Clock size={11} /> {when}
            </span>
          </div>
        </div>
      </div>

      {req.message && (
        <div className="flex gap-2 px-3 py-2 rounded-lg text-xs text-zinc-300 mb-3"
             style={{ background: '#0d0d10' }}>
          <MessageCircle size={13} className="shrink-0 mt-0.5 text-zinc-600" />
          <p className="whitespace-pre-wrap leading-relaxed">{req.message}</p>
        </div>
      )}

      {req.rejection_reason && (
        <p className="text-[11px] text-zinc-500 mb-3"><strong>Motivo:</strong> {req.rejection_reason}</p>
      )}

      {req.status === 'provisioned' && req.provisioned_user_id && (
        <p className="text-[11px] text-zinc-500 mb-3 flex items-center gap-1">
          <ExternalLink size={11} /> User <code className="font-mono text-zinc-400">{req.provisioned_user_id.slice(0, 8)}</code>
          {' / Org '}<code className="font-mono text-zinc-400">{(req.provisioned_org_id ?? '').slice(0, 8)}</code>
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {canApprove && (
          <button onClick={onApprove} disabled={working}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.30)' }}>
            {working ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
            Aprovar e provisionar
          </button>
        )}
        {canReject && (
          <button onClick={onReject} disabled={working}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.30)' }}>
            <XCircle size={11} /> Rejeitar
          </button>
        )}
      </div>
    </div>
  )
}
