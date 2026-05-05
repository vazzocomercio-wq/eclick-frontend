'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { AlertCircle, AlertTriangle, Activity, MessageSquare, ArrowRight, Bell } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface OrgStats {
  signals_total:     number
  by_severity:       { critical: number; warning: number; info: number }
  by_status:         Record<string, number>
  top_categories:    Array<{ category: string; count: number }>
  deliveries_total:  number
  deliveries_sent:   number
  responded_total:   number
  action_rate:       number
}

interface HubConfig { enabled: boolean }

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string): Promise<T | null> {
  const token = await getToken()
  if (!token) return null
  const res = await fetch(`${BACKEND}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  return res.json()
}

function humanizeCategory(c: string) { return c.replace(/_/g, ' ') }

/**
 * Card resumo do Intelligence Hub pra exibir na tela inicial /dashboard.
 *
 * Mostra estatísticas das últimas 24h:
 *   - Critical / warning / info abertos
 *   - Action rate
 *   - Top 3 categorias
 *
 * Some quando o hub não está enabled (evita poluir dashboard de quem ainda
 * não configurou). OnboardingBanner cobre esse caso nas páginas do hub.
 */
export default function HubSummaryCard() {
  const [stats, setStats]     = useState<OrgStats | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loaded, setLoaded]   = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [cfg, s] = await Promise.all([
        api<HubConfig>('/alert-hub/config'),
        api<OrgStats>('/alert-hub/stats?days=1'),
      ])
      if (cancelled) return
      setEnabled(cfg?.enabled ?? false)
      setStats(s)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [])

  // Não mostra se hub desligado ou ainda carregando
  if (!loaded || !enabled || !stats) return null

  // Não mostra se não há atividade nas últimas 24h (UI limpa)
  if (stats.signals_total === 0 && stats.deliveries_total === 0) return null

  const critical = stats.by_severity.critical
  const pendingResponse = stats.deliveries_sent - stats.responded_total

  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{
        background: 'linear-gradient(135deg, rgba(0,229,255,0.04) 0%, rgba(167,139,250,0.04) 100%)',
        border: '1px solid rgba(0,229,255,0.2)',
      }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
          style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)' }}>
          <Bell size={14} style={{ color: '#00E5FF' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm">Intelligence Hub · últimas 24h</h3>
          <p className="text-[11px] text-zinc-500">
            {stats.signals_total} alerta{stats.signals_total !== 1 ? 's' : ''} · {stats.deliveries_sent} mensage{stats.deliveries_sent === 1 ? 'm' : 'ns'} enviada{stats.deliveries_sent !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/dashboard/inteligencia/alertas"
          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
          style={{ color: '#00E5FF' }}>
          Ver todos <ArrowRight size={11} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Críticos"  value={critical}             color="#f87171" icon={AlertCircle} />
        <Stat label="Atenções"  value={stats.by_severity.warning} color="#f59e0b" icon={AlertTriangle} />
        <Stat label="Info"      value={stats.by_severity.info}    color="#60a5fa" icon={Activity} />
        <Stat label="Aguardando resposta"  value={Math.max(0, pendingResponse)} color="#a78bfa" icon={MessageSquare} />
      </div>

      {stats.top_categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">
            Top categorias:
          </span>
          {stats.top_categories.slice(0, 3).map(c => (
            <span key={c.category} className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}>
              {humanizeCategory(c.category)} <strong className="text-white">· {c.count}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color, icon: Icon }: {
  label: string
  value: number
  color: string
  icon: typeof AlertCircle
}) {
  return (
    <div className="rounded-xl p-3 flex items-center gap-2"
      style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}1a`, border: `1px solid ${color}33` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-zinc-500 leading-none">{label}</p>
        <p className="text-lg font-bold leading-tight mt-0.5" style={{ color: value > 0 ? color : '#52525b' }}>
          {value}
        </p>
      </div>
    </div>
  )
}
