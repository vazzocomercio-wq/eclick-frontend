'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AlertTriangle, AlertCircle, Info, Flame, Check, X, Eye } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Insight = {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  campaign_id: string | null
  campaign_name: string | null
  title: string
  description: string
  recommendation: string
  estimated_impact: string | null
  status: string
}

const SEV: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  critical: { color: '#f87171', bg: 'rgba(248,113,113,0.10)', icon: <Flame size={14} />,         label: 'Crítico' },
  high:     { color: '#facc15', bg: 'rgba(250,204,21,0.10)', icon: <AlertTriangle size={14} />, label: 'Alto'    },
  medium:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', icon: <AlertCircle size={14} />,    label: 'Médio'   },
  low:      { color: '#a1a1aa', bg: 'rgba(161,161,170,0.10)', icon: <Info size={14} />,           label: 'Info'    },
}

export function InsightsBanner() {
  const supabase = useMemo(() => createClient(), [])
  const [list, setList] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ads-ai/insights?status=open`, { headers })
      if (res.ok) {
        const v = await res.json()
        const arr: Insight[] = Array.isArray(v) ? v : []
        // Show top 3 by severity rank
        const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const
        arr.sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0))
        setList(arr)
      }
    } finally { setLoading(false) }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  async function dismiss(id: string) {
    const headers = await getHeaders()
    await fetch(`${BACKEND}/ads-ai/insights/${id}/dismiss`, { method: 'PATCH', headers })
    setList(prev => prev.filter(i => i.id !== id))
  }
  async function resolve(id: string) {
    const headers = await getHeaders()
    await fetch(`${BACKEND}/ads-ai/insights/${id}/resolve`, { method: 'PATCH', headers })
    setList(prev => prev.filter(i => i.id !== id))
  }

  if (loading || list.length === 0) return null

  const top = list.slice(0, 3)
  const remaining = list.length - top.length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Insights da IA</span>
        {remaining > 0 && (
          <Link href="/dashboard/ads/inteligencia"
            className="text-[10px] text-zinc-500 hover:text-cyan-400 flex items-center gap-1">
            <Eye size={10} /> Ver todos os {list.length} insights
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {top.map(ins => {
          const meta = SEV[ins.severity] ?? SEV.low
          return (
            <div key={ins.id} className="rounded-xl p-3 space-y-2"
              style={{ background: meta.bg, border: `1px solid ${meta.color}30` }}>
              <div className="flex items-center gap-1.5">
                <span style={{ color: meta.color }}>{meta.icon}</span>
                <span className="text-[10px] font-bold uppercase" style={{ color: meta.color }}>{meta.label}</span>
              </div>
              <div>
                <p className="text-zinc-100 text-xs font-semibold">{ins.title}</p>
                <p className="text-zinc-400 text-[11px] mt-0.5 line-clamp-2">{ins.description}</p>
              </div>
              <p className="text-zinc-500 text-[11px] line-clamp-2">💡 {ins.recommendation}</p>
              <div className="flex items-center gap-1 pt-1">
                <Link href={`/dashboard/ads/inteligencia#i-${ins.id}`}
                  className="flex-1 text-center text-[10px] font-medium py-1 rounded transition-colors"
                  style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
                  Detalhes
                </Link>
                <button onClick={() => dismiss(ins.id)} title="Dispensar"
                  className="p-1 rounded hover:bg-[#27272a] text-zinc-500 transition-colors"><X size={11} /></button>
                <button onClick={() => resolve(ins.id)} title="Marcar como resolvido"
                  className="p-1 rounded hover:bg-[#27272a] text-emerald-400 transition-colors"><Check size={11} /></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
