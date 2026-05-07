'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { TrendingUp, Loader2, ChevronRight, ShieldCheck, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface QualityItem {
  id:                         string
  ml_item_id:                 string
  ml_domain_id:               string | null
  ml_score:                   number | null
  ml_level:                   string | null
  pi_missing_attributes:      string[]
  ft_missing_attributes:      string[]
  has_exposure_penalty:       boolean
  pending_count:              number
  internal_priority_score:    number | null
  estimated_score_after_fix:  number | null
  fix_complexity:             'easy' | 'medium' | 'hard' | 'blocked' | null
  seller_id:                  number
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export default function QuickWinsPage() {
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
        ? `${BACKEND}/ml-quality/quick-wins?seller_id=${sid}&limit=100`
        : `${BACKEND}/ml-quality/quick-wins?limit=100`
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

  const totalGain = items.reduce((s, it) => {
    const gain = (it.estimated_score_after_fix ?? 100) - (it.ml_score ?? 0)
    return s + Math.max(0, gain)
  }, 0)

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
            <span className="text-zinc-300">Quick wins</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <TrendingUp size={22} className="text-cyan-400" />
            Quick wins (90–99)
          </h1>
          <p className="text-xs text-zinc-500 mt-1 max-w-xl">
            Anúncios a poucos pontos do nível Profissional. Pequenos ajustes
            (preenchimento de 1–3 atributos) costumam levar pra 100%.
          </p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {/* KPI strip */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiBox label="Anúncios próximos do topo" value={items.length.toString()} icon={<TrendingUp size={14} />} color="#00E5FF" />
          <KpiBox
            label="Ganho potencial"
            value={totalGain > 0 ? `+${totalGain} pts` : '—'}
            icon={<Sparkles size={14} />}
            color="#22c55e"
          />
          <KpiBox
            label="Fáceis de corrigir"
            value={items.filter(i => i.fix_complexity === 'easy').length.toString()}
            icon={<ShieldCheck size={14} />}
            color="#84cc16"
          />
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
          <p className="text-zinc-300 font-medium">Nenhum quick win encontrado</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
            Ou os anúncios já estão completos, ou ainda não rodaram sync. Você pode ver
            todos os anúncios em <Link href="/dashboard/ml-quality/items" className="text-cyan-400 hover:underline">Anúncios</Link>.
          </p>
        </div>
      )}

      {/* Lista */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => <QuickWinRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}

function QuickWinRow({ item }: { item: QualityItem }) {
  const score = item.ml_score ?? 0
  const gain  = (item.estimated_score_after_fix ?? 100) - score
  const missingAttrs = [...(item.pi_missing_attributes ?? []), ...(item.ft_missing_attributes ?? [])]

  return (
    <Link
      href={`/dashboard/ml-quality/items/${item.ml_item_id}`}
      className="block rounded-lg p-3 transition-all hover:border-cyan-400/30"
      style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}
    >
      <div className="flex items-center gap-3">
        {/* Score with gain */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <div
            className="rounded-lg w-12 h-12 flex flex-col items-center justify-center font-bold"
            style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}
          >
            <span className="text-base leading-none">{item.ml_score}</span>
            <span className="text-[8px] mt-0.5 opacity-70">/100</span>
          </div>
          {gain > 0 && (
            <div className="text-cyan-400 text-xs font-bold flex items-center">
              <span className="opacity-50 mr-0.5">→</span>+{gain}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-zinc-200">{item.ml_item_id}</span>
            {item.fix_complexity && (
              <ComplexityBadge c={item.fix_complexity} />
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1 flex-wrap">
            {item.ml_domain_id && <span>{cleanDomainName(item.ml_domain_id)}</span>}
            {missingAttrs.length > 0 && (
              <span>
                Falta: <strong className="text-zinc-300">{missingAttrs.slice(0, 3).join(', ')}</strong>
                {missingAttrs.length > 3 && <span className="text-zinc-500"> +{missingAttrs.length - 3}</span>}
              </span>
            )}
            <span>seller {item.seller_id}</span>
          </div>
        </div>

        <ChevronRight size={14} className="text-zinc-600 flex-shrink-0" />
      </div>
    </Link>
  )
}

function ComplexityBadge({ c }: { c: 'easy' | 'medium' | 'hard' | 'blocked' }) {
  const map = {
    easy:    { label: 'Fácil',    color: '#22c55e' },
    medium:  { label: 'Médio',    color: '#fbbf24' },
    hard:    { label: 'Difícil',  color: '#f97316' },
    blocked: { label: 'Bloqueado',color: '#ef4444' },
  } as const
  const m = map[c]
  return (
    <span
      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}
    >
      {m.label}
    </span>
  )
}

function KpiBox({ label, value, icon, color }: {
  label: string; value: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        <div style={{ color }}>{icon}</div>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function cleanDomainName(d: string): string {
  return d.replace(/^MLB-/, '').replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}
