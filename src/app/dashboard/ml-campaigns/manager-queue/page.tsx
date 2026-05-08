'use client'

/**
 * Fila do gestor — recomendações que o operador tentou aprovar com margem
 * abaixo do mínimo (`min_approval_margin_pct`). Gestor revisa e decide
 * liberar (manager_approve) ou rejeitar (manager_reject).
 *
 * Acessível em /dashboard/ml-campaigns/manager-queue
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ShieldAlert, Loader2, CheckCircle2, XCircle, Clock, ExternalLink,
  AlertTriangle, ArrowRight, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'
import { CopyButton } from '@/components/ui/copy-button'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface QueuedReco {
  id:                       string
  campaign_item_id:         string
  recommended_strategy:     string | null
  recommended_price:        number | null
  recommended_quantity:     number | null
  attempted_margin_pct:     number | null
  gate_threshold_pct:       number | null
  reviewed_by:              string | null
  reviewed_at:              string | null
  recommendation_reason:    string
  warnings:                 Array<{ code: string; severity: string; message: string }>
  cost_breakdown?:          Record<string, number>
  ml_campaign_items?: {
    ml_item_id:      string
    original_price:  number | null
    current_price:   number | null
    thumbnail_url:   string | null
    title:           string | null
  }
  ml_campaigns?: {
    name:               string | null
    ml_promotion_type:  string
    deadline_date:      string | null
  }
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

function brl(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ManagerQueuePage() {
  const { selected: selectedSellerId } = useMlAccount()
  const [items, setItems]     = useState<QueuedReco[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [reasonModal, setReasonModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const [reason, setReason]   = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const sidQ = sid != null ? `?seller_id=${sid}` : ''
      const r = await fetch(`${BACKEND}/ml-campaigns/manager-queue${sidQ}`, { headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const body = await r.json() as { recommendations: QueuedReco[]; total: number }
      setItems(body.recommendations ?? [])
      setTotal(body.total ?? 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load, selectedSellerId])

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id)
    try {
      const t = await getToken()
      const path = action === 'approve' ? 'manager-approve' : 'manager-reject'
      const r = await fetch(`${BACKEND}/ml-campaigns/recommendations/${id}/${path}`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: reason.trim() || undefined }),
      })
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({} as { message?: string }))
        throw new Error(errBody.message ?? `HTTP ${r.status}`)
      }
      setReasonModal(null); setReason('')
      void load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
            <span>/</span>
            <span className="text-zinc-300">Fila do gestor</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <ShieldAlert size={22} className="text-amber-400" />
            Fila do gestor
            {total > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                {total}
              </span>
            )}
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Recomendações que operadores tentaram aprovar com margem abaixo do limite. Você decide liberar ou bloquear.
          </p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      )}

      {loading && (
        <div className="text-zinc-500 text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-300 font-semibold">Fila vazia</p>
          <p className="text-xs text-zinc-500 mt-1">Nenhuma recomendação pendente do seu lado. Operadores estão aprovando dentro dos limites.</p>
        </div>
      )}

      {items.map(it => {
        const margin = it.attempted_margin_pct ?? 0
        const threshold = it.gate_threshold_pct ?? 0
        const gap = (threshold - margin).toFixed(1)
        return (
          <div key={it.id} className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.25)' }}>
            <div className="flex items-start gap-3 flex-wrap">
              {/* Thumbnail */}
              {it.ml_campaign_items?.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.ml_campaign_items.thumbnail_url} alt={it.ml_campaign_items.title ?? ''}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                  style={{ border: '1px solid #1a1a1f' }} />
              ) : (
                <div className="w-14 h-14 rounded-lg flex-shrink-0" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }} />
              )}

              {/* Header info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-mono text-[10px] text-zinc-400">{it.ml_campaign_items?.ml_item_id}</span>
                  <CopyButton value={it.ml_campaign_items?.ml_item_id} size={9} />
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ml-1"
                    style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.4)' }}>
                    {it.ml_campaigns?.ml_promotion_type ?? '—'}
                  </span>
                  {it.ml_campaigns?.deadline_date && (
                    <span className="text-[10px] text-amber-400 inline-flex items-center gap-1">
                      <Clock size={10} /> Aderir até {new Date(it.ml_campaigns.deadline_date).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                {it.ml_campaign_items?.title && (
                  <div className="flex items-start gap-1 mt-0.5">
                    <p className="text-sm text-zinc-200 line-clamp-1 flex-1">{it.ml_campaign_items.title}</p>
                    <CopyButton value={it.ml_campaign_items.title} size={10} />
                  </div>
                )}
                <p className="text-[11px] text-zinc-400 mt-1">
                  Campanha: <strong>{it.ml_campaigns?.name ?? '—'}</strong>
                </p>
              </div>

              {/* Decision metrics */}
              <div className="flex-shrink-0 px-3 py-2 rounded-lg text-right"
                style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)' }}>
                <p className="text-[9px] uppercase tracking-wider text-red-300">Margem tentada</p>
                <p className="text-lg font-bold text-red-400">{margin.toFixed(1)}%</p>
                <p className="text-[9px] text-zinc-500 mt-0.5">limite: {threshold.toFixed(1)}% · faltam {gap}pp</p>
              </div>
            </div>

            {/* Preço + reason */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg p-2" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                <p className="text-[9px] uppercase tracking-wider text-zinc-500">Preço original</p>
                <p className="text-xs text-zinc-300 font-medium">{brl(it.ml_campaign_items?.original_price)}</p>
              </div>
              <div className="rounded-lg p-2" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                <p className="text-[9px] uppercase tracking-wider text-zinc-500">Preço promocional tentado</p>
                <p className="text-xs text-zinc-100 font-medium">{brl(it.recommended_price)}</p>
                {it.recommended_strategy && (
                  <p className="text-[9px] text-zinc-500 mt-0.5">estratégia: {it.recommended_strategy}</p>
                )}
              </div>
              <div className="rounded-lg p-2" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                <p className="text-[9px] uppercase tracking-wider text-zinc-500">Quantidade</p>
                <p className="text-xs text-zinc-300 font-medium">{it.recommended_quantity ?? '—'}</p>
              </div>
            </div>

            {/* Reason */}
            <div className="rounded-lg p-2 text-[11px] text-zinc-400"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <span className="text-zinc-500 uppercase tracking-wider text-[9px]">IA: </span>
              {it.recommendation_reason}
            </div>

            {/* Warnings */}
            {it.warnings && it.warnings.length > 0 && (
              <div className="space-y-1">
                {it.warnings.slice(0, 3).map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px]"
                    style={{ color: w.severity === 'error' ? '#f87171' : w.severity === 'warning' ? '#fbbf24' : '#a1a1aa' }}>
                    <AlertTriangle size={10} className="flex-shrink-0 mt-0.5" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => { setReasonModal({ id: it.id, action: 'approve' }); setReason('') }}
                disabled={busy === it.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ background: '#22c55e', color: '#000' }}>
                <CheckCircle2 size={12} /> Liberar override
              </button>
              <button
                onClick={() => { setReasonModal({ id: it.id, action: 'reject' }); setReason('') }}
                disabled={busy === it.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.4)' }}>
                <XCircle size={12} /> Rejeitar
              </button>
              <Link href={`/dashboard/ml-campaigns/recommendations/${it.id}`}
                className="inline-flex items-center gap-1 ml-auto text-[11px] text-cyan-400 hover:underline">
                Ver detalhe <ChevronRight size={11} />
              </Link>
              {it.reviewed_by && (
                <Link href={`/dashboard/ml-campaigns/audit?operator=${it.reviewed_by}`}
                  className="text-[10px] text-zinc-500 hover:text-amber-300 inline-flex items-center gap-1">
                  Audit operador <ArrowRight size={9} />
                </Link>
              )}
            </div>
          </div>
        )
      })}

      {/* Modal de motivo */}
      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl max-w-md w-full p-5"
            style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <h3 className="text-sm font-semibold mb-2">
              {reasonModal.action === 'approve' ? 'Liberar override' : 'Rejeitar override'}
            </h3>
            <p className="text-[11px] text-zinc-500 mb-3">
              Motivo (opcional, fica no audit log):
            </p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder={reasonModal.action === 'approve'
                ? 'Ex: produto encalhado, vale liquidar mesmo abaixo do mínimo'
                : 'Ex: margem inaceitável, prefiro deixar fora dessa campanha'}
              className="w-full rounded-lg p-2 text-xs outline-none resize-none"
              style={{ background: '#09090b', border: '1px solid #27272a', color: '#fafafa' }} />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                onClick={() => { setReasonModal(null); setReason('') }}
                className="px-3 py-1.5 rounded text-xs text-zinc-400">
                Cancelar
              </button>
              <button
                onClick={() => decide(reasonModal.id, reasonModal.action)}
                disabled={busy === reasonModal.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50"
                style={{
                  background: reasonModal.action === 'approve' ? '#22c55e' : '#f87171',
                  color: '#000',
                }}>
                {busy === reasonModal.id ? <Loader2 size={11} className="animate-spin" /> : null}
                Confirmar {reasonModal.action === 'approve' ? 'liberação' : 'rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
