'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  History, Loader2, Check, X, ExternalLink, Filter,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface AuditEntry {
  id:                    string
  ml_item_id:            string
  ml_campaign_id:        string
  ml_promotion_type:     string
  ml_offer_id_after:     string | null
  operation:             string
  action:                string
  values_before:         Record<string, unknown> | null
  values_after:          Record<string, unknown>
  applied_successfully:  boolean
  error_code:            string | null
  error_message:         string | null
  applied_at:            string
  ml_response_status:    number | null
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

function brl(v: number | undefined | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AuditPage() {
  const { selected: selectedSellerId } = useMlAccount()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all' | 'success' | 'failed'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const url = sid != null
        ? `${BACKEND}/ml-campaigns/audit?seller_id=${sid}&limit=200`
        : `${BACKEND}/ml-campaigns/audit?limit=200`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      if (r.ok) setEntries(await r.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load, selectedSellerId])

  const filtered = entries.filter(e => {
    if (filter === 'success') return e.applied_successfully
    if (filter === 'failed')  return !e.applied_successfully
    return true
  })

  const successCount = entries.filter(e => e.applied_successfully).length
  const failedCount  = entries.filter(e => !e.applied_successfully).length

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
            <span>/</span>
            <span className="text-zinc-300">Auditoria</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <History size={22} className="text-cyan-400" />
            Auditoria de Aplicações
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Histórico completo das operações no ML</p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {/* Filters */}
      <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        {[
          { v: 'all',     label: `Todos (${entries.length})`,  color: '#fafafa' },
          { v: 'success', label: `Sucesso (${successCount})`,   color: '#22c55e' },
          { v: 'failed',  label: `Falhas (${failedCount})`,     color: '#ef4444' },
        ].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v as any)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
            style={{
              background: filter === f.v ? `${f.color}15` : '#09090b',
              border: `1px solid ${filter === f.v ? `${f.color}40` : '#1a1a1f'}`,
              color: filter === f.v ? f.color : '#a1a1aa',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-zinc-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <History size={48} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-300 font-medium">Nenhuma operação registrada</p>
          <p className="text-xs text-zinc-500 mt-2">Aplique recomendações pra começar a popular o histórico.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(e => <AuditRow key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const after = entry.values_after as { price?: number; quantity?: number }
  const before = entry.values_before as { price?: number } | null
  const success = entry.applied_successfully
  const color = success ? '#22c55e' : '#ef4444'
  const Icon = success ? Check : X

  const actionLabel: Record<string, string> = {
    join_campaign:   'Aderiu à campanha',
    leave_campaign:  'Saiu da campanha',
    edit_offer:      'Editou oferta',
    price_change:    'Mudou preço',
    quantity_change: 'Mudou qty',
    validate_only:   'Validou (dry-run)',
  }

  return (
    <div className="rounded-lg p-3"
      style={{ background: '#0c0c10', border: `1px solid ${color}25` }}>
      <div className="flex items-start gap-3">
        <Icon size={16} style={{ color }} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-zinc-200">{actionLabel[entry.action] ?? entry.action}</span>
            <span className="font-mono text-xs text-zinc-300">{entry.ml_item_id}</span>
            <a href={`https://www.mercadolivre.com.br/${entry.ml_item_id}`} target="_blank" rel="noreferrer"
              className="text-cyan-400 text-[10px] hover:underline">
              <ExternalLink size={10} />
            </a>
            <span className="text-[10px] text-zinc-500">{entry.ml_promotion_type}</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1 flex-wrap">
            {after.price && <span>Preço: <strong className="text-zinc-300">{brl(after.price)}</strong></span>}
            {before?.price && <span className="text-zinc-600">(antes: {brl(before.price)})</span>}
            {after.quantity && <span>· Qty: <strong className="text-zinc-300">{after.quantity}</strong></span>}
            {entry.ml_offer_id_after && <span>· offer: <span className="font-mono">{entry.ml_offer_id_after.slice(0, 12)}…</span></span>}
          </div>

          {entry.error_message && (
            <p className="text-[11px] text-red-300 mt-1.5">⚠ {entry.error_message}</p>
          )}

          <p className="text-[10px] text-zinc-600 mt-1.5">
            {new Date(entry.applied_at).toLocaleString('pt-BR')} ·
            {' '}HTTP {entry.ml_response_status ?? '—'} · {entry.operation}
          </p>
        </div>
      </div>
    </div>
  )
}
