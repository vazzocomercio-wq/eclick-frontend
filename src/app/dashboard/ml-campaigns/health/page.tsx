'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ShieldAlert, Loader2, ExternalLink, AlertOctagon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface MissingItem {
  id:                  string
  ml_item_id:          string
  product_id:          string | null
  health_status:       string | null
  health_warnings:     Array<{ code: string; message: string }>
  ml_campaign_id:      string
  status:              string
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export default function CampaignsHealthPage() {
  const { selected: selectedSellerId } = useMlAccount()
  const [items, setItems]     = useState<MissingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const url = sid != null
        ? `${BACKEND}/ml-campaigns/health?seller_id=${sid}&limit=200`
        : `${BACKEND}/ml-campaigns/health?limit=200`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      setItems(await r.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load, selectedSellerId])

  // Agrega por anuncio (1 anuncio aparece N vezes se está em N campanhas)
  const byItem = new Map<string, MissingItem>()
  for (const it of items) {
    if (!byItem.has(it.ml_item_id)) byItem.set(it.ml_item_id, it)
  }
  const uniqueItems = [...byItem.values()]

  const missingCost = uniqueItems.filter(i => i.health_warnings?.some(w => w.code === 'missing_cost')).length
  const missingTax  = uniqueItems.filter(i => i.health_warnings?.some(w => w.code === 'missing_tax')).length
  const missingDim  = uniqueItems.filter(i => i.health_warnings?.some(w => w.code === 'missing_dimensions')).length
  const noProduct   = uniqueItems.filter(i => i.health_warnings?.some(w => w.code === 'no_internal_product')).length

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400 transition-colors">
              Campaign Center
            </Link>
            <span>/</span>
            <span className="text-zinc-300">Health Check</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <ShieldAlert size={22} className="text-amber-400" />
            Health Check do Catálogo
          </h1>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl">
            Anúncios elegíveis pra campanha que ainda não têm dados completos
            pra calcular margem (custo, imposto, dimensões).
          </p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {/* KPIs */}
      {!loading && uniqueItems.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiBox label="Sem custo"       value={missingCost} color="#ef4444" />
          <KpiBox label="Sem imposto"     value={missingTax}  color="#fbbf24" />
          <KpiBox label="Sem dimensões"   value={missingDim}  color="#fb923c" />
          <KpiBox label="Sem produto interno" value={noProduct} color="#71717a" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-zinc-900/50 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && uniqueItems.length === 0 && !error && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <ShieldAlert size={48} className="mx-auto text-emerald-700 mb-3" />
          <p className="text-zinc-300 font-medium">Catálogo saudável!</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
            Todos os anúncios em campanhas têm custo, imposto e dimensões cadastrados.
            Margem é calculável.
          </p>
        </div>
      )}

      {uniqueItems.length > 0 && (
        <div className="space-y-2">
          {uniqueItems.map(item => <HealthRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}

function HealthRow({ item }: { item: MissingItem }) {
  const warningColors: Record<string, string> = {
    missing_cost:        '#ef4444',
    missing_tax:         '#fbbf24',
    missing_dimensions:  '#fb923c',
    no_internal_product: '#71717a',
  }

  return (
    <div className="rounded-lg p-3" style={{ background: '#0c0c10', border: '1px solid rgba(251,191,36,0.15)' }}>
      <div className="flex items-start gap-3">
        <AlertOctagon size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-zinc-200">{item.ml_item_id}</span>
            <a
              href={`https://www.mercadolivre.com.br/${item.ml_item_id}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-cyan-400 text-[11px] hover:underline">
              <ExternalLink size={10} /> ML
            </a>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.health_warnings?.map((w, i) => (
              <span key={i}
                className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold"
                style={{
                  background: `${warningColors[w.code] ?? '#71717a'}15`,
                  color:      warningColors[w.code] ?? '#71717a',
                  border:     `1px solid ${warningColors[w.code] ?? '#71717a'}40`,
                }}>
                {w.message}
              </span>
            ))}
          </div>
        </div>
        {item.product_id && (
          <Link href={`/dashboard/produtos/${item.product_id}`}
            className="text-[11px] text-cyan-400 hover:underline flex-shrink-0">
            Editar produto →
          </Link>
        )}
      </div>
    </div>
  )
}

function KpiBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}
