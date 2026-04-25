'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, AlertTriangle, CheckCircle2, ExternalLink,
  Clock, ShieldAlert,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type ClaimPlayer = { role: string; user_id: number; available_actions?: string[] }
type Claim = {
  id: string | number
  resource_id?: string | number
  reason?: { id?: string; label?: string }
  status?: string
  type?: string
  stage?: string
  date_created?: string
  last_updated?: string
  players?: ClaimPlayer[]
  resolution?: { reason?: string } | null
}

type FilterKey = 'all' | 'opened' | 'closed'

// ── Helpers ───────────────────────────────────────────────────────────────────

const REASON_LABEL: Record<string, string> = {
  PNR:  'Produto não recebido',
  PDD:  'Produto danificado/defeituoso',
  PNDA: 'Produto não conforme com o anúncio',
  WP:   'Produto errado enviado',
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  opened:   { label: 'Aberta',    color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  closed:   { label: 'Fechada',   color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  resolved: { label: 'Resolvida', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  appealed: { label: 'Apelada',   color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
}

function getStatusCfg(s?: string) {
  return STATUS_CFG[s ?? ''] ?? { label: s ?? '—', color: '#a1a1aa', bg: 'rgba(161,161,170,0.1)' }
}

function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(s?: string) {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

// ── Claim card ────────────────────────────────────────────────────────────────

function ClaimCard({ claim }: { claim: Claim }) {
  const reasonId  = claim.reason?.id ?? ''
  const reasonLbl = REASON_LABEL[reasonId] ?? claim.reason?.label ?? reasonId ?? 'Reclamação'
  const stCfg     = getStatusCfg(claim.status)
  const buyer     = (claim.players ?? []).find(p => p.role === 'complainant')
  const mlUrl     = claim.resource_id
    ? `https://www.mercadolivre.com.br/vendas/${claim.resource_id}/detalhe`
    : null

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-zinc-200">{reasonLbl}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Pedido #{claim.resource_id ?? claim.id}
              {buyer && ` · Comprador #${buyer.user_id}`}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: stCfg.bg, color: stCfg.color }}>
          {stCfg.label}
        </span>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-zinc-600">
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>Aberta {timeAgo(claim.date_created)}</span>
        </div>
        {claim.last_updated && <span>Atualizada {fmtDate(claim.last_updated)}</span>}
        {claim.stage && <span className="capitalize">{claim.stage}</span>}
      </div>

      {claim.resolution?.reason && (
        <p className="text-[10px] text-zinc-500 px-2.5 py-1.5 rounded-lg" style={{ background: '#18181b' }}>
          Resolução: {claim.resolution.reason}
        </p>
      )}

      {mlUrl && (
        <a href={mlUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-[11px] font-semibold"
          style={{ color: '#00E5FF' }}>
          <ExternalLink size={11} />
          Ver no Mercado Livre
        </a>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReclamacoesPage() {
  const [claims,  setClaims]  = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<FilterKey>('opened')

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setLoading(false); return }
    const h = { Authorization: `Bearer ${session.access_token}` }
    try {
      const res = await fetch(`${BACKEND}/ml/claims`, { headers: h })
      if (res.ok) {
        const d = await res.json()
        setClaims(d?.data ?? d ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = claims.filter(c => {
    if (filter === 'all')    return true
    if (filter === 'opened') return (c.status ?? 'opened') === 'opened'
    return (c.status ?? '') !== 'opened'
  })

  const openCount   = claims.filter(c => (c.status ?? 'opened') === 'opened').length
  const closedCount = claims.length - openCount

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: '#09090b' }}>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Atendimento</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Reclamações</h2>
          <p className="text-zinc-500 text-xs mt-1">Gerencie reclamações de pós-compra do Mercado Livre.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',    value: claims.length,  color: '#a1a1aa' },
          { label: 'Abertas',  value: openCount,       color: openCount > 0 ? '#f87171' : '#4ade80' },
          { label: 'Fechadas', value: closedCount,     color: '#71717a' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4 space-y-1" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{loading ? '…' : value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {(['all', 'opened', 'closed'] as FilterKey[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              background: filter === f ? 'rgba(0,229,255,0.1)' : 'transparent',
              color:      filter === f ? '#00E5FF' : '#52525b',
              border:     `1px solid ${filter === f ? 'rgba(0,229,255,0.25)' : '#1e1e24'}`,
            }}>
            {{ all: 'Todas', opened: 'Abertas', closed: 'Fechadas' }[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600 text-xs">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <CheckCircle2 size={32} className="text-green-500" />
          <p className="text-sm text-zinc-400">
            {filter === 'opened' ? 'Nenhuma reclamação aberta' : 'Nenhuma reclamação'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(c => <ClaimCard key={c.id} claim={c} />)}
        </div>
      )}

      {!loading && openCount > 0 && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.12)' }}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={13} className="text-red-400" />
            <p className="text-xs font-semibold text-zinc-300">Dicas para resolução</p>
          </div>
          <ul className="space-y-1 pl-2">
            {[
              'Responda dentro de 48h para evitar penalização na reputação.',
              'Ofereça reembolso ou reenvio antes que o ML intervenha.',
              'Registre o número de protocolo de cada caso resolvido.',
            ].map(tip => (
              <li key={tip} className="text-[11px] text-zinc-500 flex items-start gap-1.5">
                <span className="text-zinc-700 mt-0.5">•</span>{tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
