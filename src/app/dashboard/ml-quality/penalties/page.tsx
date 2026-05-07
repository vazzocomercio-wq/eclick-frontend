'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { AlertOctagon, Loader2, ChevronRight, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface QualityItem {
  id:                    string
  ml_item_id:            string
  ml_domain_id:          string | null
  ml_score:              number | null
  ml_level:              string | null
  has_exposure_penalty:  boolean
  penalty_reasons:       string[]
  pi_missing_attributes: string[]
  ft_missing_attributes: string[]
  pending_count:         number
  fix_complexity:        'easy' | 'medium' | 'hard' | 'blocked' | null
  seller_id:             number
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export default function PenaltiesPage() {
  const { selected: selectedSellerId } = useMlAccount()
  const [items, setItems]     = useState<QualityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t   = await getToken()
      const sid = getStoredSellerId()
      const url = sid != null
        ? `${BACKEND}/ml-quality/penalties?seller_id=${sid}&limit=200`
        : `${BACKEND}/ml-quality/penalties?limit=200`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setItems(await r.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load, selectedSellerId])

  // Agrupa por motivo
  const byReason = new Map<string, number>()
  for (const item of items) {
    for (const r of item.penalty_reasons ?? []) {
      byReason.set(r, (byReason.get(r) ?? 0) + 1)
    }
  }
  const topReasons = Array.from(byReason.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto" style={{ background: '#09090b', minHeight: '100vh', color: '#fafafa' }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-quality" className="hover:text-cyan-400 transition-colors">
              Quality Center
            </Link>
            <span>/</span>
            <span className="text-zinc-300">Penalizados</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <AlertOctagon size={22} className="text-red-400" />
            Anúncios penalizados
          </h1>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl">
            Anúncios com perda de exposição no ML. Resolver os motivos abaixo
            geralmente devolve o ranking imediatamente.
          </p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {/* KPI strip */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiBox label="Total penalizados" value={items.length.toString()} color="#ef4444" />
          <KpiBox
            label="Score médio"
            value={Math.round(items.reduce((s, i) => s + (i.ml_score ?? 0), 0) / items.length).toString()}
            color="#fbbf24"
          />
          <KpiBox
            label="Fáceis de resolver"
            value={items.filter(i => i.fix_complexity === 'easy').length.toString()}
            color="#22c55e"
          />
          <KpiBox
            label="Bloqueados"
            value={items.filter(i => i.fix_complexity === 'blocked').length.toString()}
            color="#52525b"
          />
        </div>
      )}

      {/* Top reasons */}
      {topReasons.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            Principais motivos de penalização
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {topReasons.map(([reason, count]) => (
              <div
                key={reason}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <span className="text-red-200 font-mono text-[11px] truncate mr-2">{reason}</span>
                <span className="text-red-400 font-semibold flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-zinc-900/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Vazio */}
      {!loading && items.length === 0 && !error && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <ShieldCheck size={48} className="mx-auto text-emerald-700 mb-3" />
          <p className="text-zinc-300 font-medium">Nenhum anúncio penalizado!</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
            Sua conta está limpa. Continue monitorando — qualquer perda de exposição vai aparecer aqui.
          </p>
        </div>
      )}

      {/* Lista */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => <PenaltyRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}

function PenaltyRow({ item }: { item: QualityItem }) {
  const score = item.ml_score ?? 0
  const color = score >= 60 ? '#fbbf24' : '#ef4444'

  return (
    <Link
      href={`/dashboard/ml-quality/items/${item.ml_item_id}`}
      className="block rounded-lg p-3 transition-all hover:border-red-400/30"
      style={{ background: '#0c0c10', border: '1px solid rgba(239,68,68,0.15)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 rounded-lg w-12 h-12 flex flex-col items-center justify-center font-bold"
          style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}
        >
          <span className="text-base leading-none">{item.ml_score ?? '—'}</span>
          <span className="text-[8px] mt-0.5 opacity-70">/100</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-zinc-200">{item.ml_item_id}</span>
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold"
              style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <AlertOctagon size={9} /> Penalizado
            </span>
          </div>

          {item.penalty_reasons && item.penalty_reasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.penalty_reasons.slice(0, 4).map(r => (
                <span
                  key={r}
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  {r}
                </span>
              ))}
              {item.penalty_reasons.length > 4 && (
                <span className="text-[10px] text-zinc-500">+{item.penalty_reasons.length - 4}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1 flex-wrap">
            {item.ml_domain_id && <span>{cleanDomainName(item.ml_domain_id)}</span>}
            <span>seller {item.seller_id}</span>
          </div>
        </div>

        <ChevronRight size={14} className="text-zinc-600 flex-shrink-0 mt-1" />
      </div>
    </Link>
  )
}

function KpiBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function cleanDomainName(d: string): string {
  return d.replace(/^MLB-/, '').replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}
