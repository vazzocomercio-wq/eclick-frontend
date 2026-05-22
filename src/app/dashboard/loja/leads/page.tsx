'use client'

/**
 * Leads — admin UI (AG3).
 *
 * Lista as submissões dos formulários editáveis da Loja Própria. Cada
 * lead foi (ou tenta ser) empurrado pro Active CRM como contato + card
 * no funil escolhido. Quando o push falha ou o bridge está off, o lead
 * fica 'received'/'failed' e o lojista pode reenviar aqui.
 *
 * Endpoints:
 *   GET  /storefront-leads        ?status=
 *   POST /storefront-leads/:id/retry
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Inbox, Loader2, ChevronLeft, AlertCircle, CheckCircle2, Clock, RefreshCcw,
  Phone, Mail, MessageSquare, Filter,
} from 'lucide-react'
import Link from 'next/link'
import { useAlert } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Lead {
  id:                string
  store_slug:        string
  form_title:        string | null
  pipeline_id:       string
  stage_id:          string
  fields:            { name?: string; email?: string; phone?: string; message?: string; custom?: Record<string, string> }
  status:            'received' | 'pushed' | 'failed'
  active_deal_id:    string | null
  push_error:        string | null
  pushed_at:         string | null
  created_at:        string
}

interface Stats { received: number; pushed: number; failed: number }

type StatusFilter = '' | 'received' | 'pushed' | 'failed'

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  received: { label: 'Na fila',     color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',  icon: <Clock size={11} /> },
  pushed:   { label: 'No Active',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  icon: <CheckCircle2 size={11} /> },
  failed:   { label: 'Falhou',      color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: <AlertCircle size={11} /> },
}

const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const showAlert = useAlert()

  const fetchToken = useCallback(async () => {
    const supabase = createClient()
    const { data: session } = await supabase.auth.getSession()
    return session.session?.access_token
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const token = await fetchToken()
      const params = new URLSearchParams({ limit: '100' })
      if (filter) params.set('status', filter)
      const res = await fetch(`${BACKEND}/storefront-leads?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLeads(data.items ?? [])
      setStats(data.stats ?? null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchToken, filter])

  useEffect(() => { void load() }, [load])

  const retry = async (id: string) => {
    setRetrying(id)
    try {
      const token = await fetchToken()
      const res = await fetch(`${BACKEND}/storefront-leads/${id}/retry`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.pushed) {
        await showAlert({ message: '✅ Lead enviado pro Active!', variant: 'info' })
      } else {
        await showAlert({ message: 'Não consegui enviar agora. Verifique se a loja está conectada ao Active CRM.', variant: 'warning' })
      }
      await load()
    } catch (e) {
      await showAlert({ message: (e as Error).message, variant: 'danger' })
    } finally {
      setRetrying(null)
    }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div>
        <Link href="/dashboard/loja" className="text-xs text-zinc-500 hover:text-cyan-400 inline-flex items-center gap-1 mb-2">
          <ChevronLeft size={12} /> Voltar pro hub
        </Link>
        <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
          <Inbox size={24} /> Leads da loja
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Submissões dos formulários da vitrine · viram contato + card no funil do Active
        </p>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Na fila"   value={stats.received} color="#06b6d4" />
          <StatCard label="No Active" value={stats.pushed}   color="#22c55e" />
          <StatCard label="Falharam"  value={stats.failed}   color="#ef4444" />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-zinc-500" />
        <FilterChip label="Todos"    value=""         current={filter} onClick={setFilter} />
        <FilterChip label="Na fila"  value="received" current={filter} onClick={setFilter} count={stats?.received} />
        <FilterChip label="No Active" value="pushed"  current={filter} onClick={setFilter} count={stats?.pushed} />
        <FilterChip label="Falharam" value="failed"   current={filter} onClick={setFilter} count={stats?.failed} />
      </div>

      {error && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400 flex items-center gap-2"><AlertCircle size={14} /> {error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500"><Loader2 className="animate-spin inline-block" size={20} /></div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ background: '#0a0a0e', border: '1px dashed #27272a' }}>
          <Inbox size={32} className="mx-auto text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">{filter ? 'Nenhum lead neste status' : 'Nenhum lead ainda'}</p>
          <p className="text-xs mt-2" style={{ color: '#52525b' }}>
            Adicione uma seção <strong>Formulário (lead)</strong> no Designer da Loja e escolha o funil de destino.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(l => {
            const meta = STATUS_META[l.status] ?? { label: l.status, color: '#a1a1aa', bg: '#27272a', icon: null }
            return (
              <div key={l.id} className="rounded-lg p-4" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="text-sm font-semibold text-white truncate">{l.fields.name ?? 'Lead sem nome'}</span>
                    {l.form_title && <span className="text-xs" style={{ color: '#71717a' }}>· {l.form_title}</span>}
                  </div>
                  <span className="text-xs" style={{ color: '#71717a' }}>{formatDate(l.created_at)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-2 text-xs" style={{ color: '#a1a1aa' }}>
                  {l.fields.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {l.fields.phone}</span>}
                  {l.fields.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {l.fields.email}</span>}
                </div>

                {l.fields.message && (
                  <p className="text-xs mb-2 p-2 rounded inline-flex items-start gap-1.5" style={{ background: '#18181b', color: '#d4d4d8' }}>
                    <MessageSquare size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {l.fields.message}
                  </p>
                )}

                {l.fields.custom && Object.keys(l.fields.custom).length > 0 && (
                  <div className="text-[11px] mb-2" style={{ color: '#71717a' }}>
                    {Object.entries(l.fields.custom).map(([k, v]) => (
                      <span key={k} className="mr-3"><strong style={{ color: '#a1a1aa' }}>{k}:</strong> {v}</span>
                    ))}
                  </div>
                )}

                {l.status === 'failed' && l.push_error && (
                  <p className="text-[11px] mb-2" style={{ color: '#f87171' }}>⚠ {l.push_error}</p>
                )}

                {(l.status === 'failed' || l.status === 'received') && (
                  <button onClick={() => retry(l.id)} disabled={retrying === l.id}
                    className="text-xs font-semibold px-3 py-2 rounded inline-flex items-center gap-1 disabled:opacity-50"
                    style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)', minHeight: 36 }}>
                    {retrying === l.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                    Enviar pro Active
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <p className="text-xs uppercase tracking-wide font-medium" style={{ color: '#71717a' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}

function FilterChip({ label, value, current, onClick, count }: {
  label: string; value: StatusFilter; current: StatusFilter; onClick: (v: StatusFilter) => void; count?: number
}) {
  const active = current === value
  return (
    <button onClick={() => onClick(value)}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
      style={{ background: active ? '#00E5FF' : '#0a0a0e', color: active ? '#0a0a0e' : '#fafafa', border: `1px solid ${active ? '#00E5FF' : '#27272a'}`, minHeight: 36 }}>
      {label}
      {typeof count === 'number' && count > 0 && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: active ? 'rgba(10,10,14,0.2)' : '#27272a', color: active ? '#0a0a0e' : '#fafafa' }}>{count}</span>
      )}
    </button>
  )
}
