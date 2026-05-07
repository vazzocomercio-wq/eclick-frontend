'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Activity, AlertOctagon, TrendingUp, RefreshCw, Loader2, ChevronRight,
  ShieldCheck, ShieldAlert, ShieldQuestion,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'
import { useMlLabels } from '@/hooks/useMlLabels'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Dashboard {
  total_items:                number
  items_basic:                number
  items_satisfactory:         number
  items_professional:         number
  items_complete:             number
  items_incomplete:           number
  items_with_penalty:         number
  avg_score:                  number | null
  median_score:               number | null
  total_pending_actions:      number
  top_critical_domains:       Array<{ domain_id: string; items_incomplete: number; avg_score: number }>
  top_missing_attributes:     Array<{ attribute: string; missing_in_items: number }>
  quick_wins_count:           number
  quick_wins_estimated_gain:  number
  last_sync_at:               string | null
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

function ago(iso: string | null): string {
  if (!iso) return 'nunca'
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export default function MlQualityDashboardPage() {
  const { selected: selectedSellerId } = useMlAccount()
  const { domainName, attributeName, refresh: refreshLabels } = useMlLabels()
  const [data, setData]       = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const url = sid != null
        ? `${BACKEND}/ml-quality/dashboard?seller_id=${sid}`
        : `${BACKEND}/ml-quality/dashboard`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) {
        const body = await r.text().catch(() => '')
        throw new Error(`HTTP ${r.status}: ${body || r.statusText}`)
      }
      setData(await r.json())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(); void refreshLabels() }, [load, selectedSellerId, refreshLabels])

  async function syncNow() {
    setSyncing(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const url = sid != null
        ? `${BACKEND}/ml-quality/sync?seller_id=${sid}`
        : `${BACKEND}/ml-quality/sync`
      const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto" style={{ background: '#09090b', minHeight: '100vh', color: '#fafafa' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-widest">Mercado Livre · Quality Center IA</p>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <ShieldCheck size={22} className="text-cyan-400" />
            Diagnóstico de Anúncios
          </h1>
          {data?.last_sync_at && (
            <p className="text-[11px] text-zinc-500 mt-1">Última sync: {ago(data.last_sync_at)}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AccountSelector compact hideWhenEmpty />
          <button onClick={syncNow} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold">
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-zinc-900/50 animate-pulse" />
          ))}
        </div>
      )}

      {data && data.total_items === 0 && !loading && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <ShieldQuestion size={48} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-300 font-medium">Nenhum anúncio sincronizado ainda</p>
          <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
            Clica em <strong className="text-cyan-400">Sincronizar agora</strong> pra puxar diagnóstico de qualidade
            de todos os anúncios da{selectedSellerId ? ' conta selecionada' : 's contas conectadas'}.
          </p>
        </div>
      )}

      {data && data.total_items > 0 && (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Score médio"
              value={data.avg_score != null ? `${Math.round(data.avg_score)}` : '—'}
              suffix="/100"
              color={scoreColor(data.avg_score ?? 0)}
              icon={<Activity size={14} />}
            />
            <KpiCard
              label="Anúncios completos"
              value={`${data.items_complete}`}
              suffix={` / ${data.total_items}`}
              color="#22c55e"
              icon={<ShieldCheck size={14} />}
            />
            <KpiCard
              label="Quick wins (90-99)"
              value={`${data.quick_wins_count}`}
              suffix={data.quick_wins_estimated_gain > 0 ? ` · +${data.quick_wins_estimated_gain}pts` : ''}
              color="#00E5FF"
              icon={<TrendingUp size={14} />}
            />
            <KpiCard
              label="Com penalização"
              value={`${data.items_with_penalty}`}
              suffix=""
              color={data.items_with_penalty > 0 ? '#ef4444' : '#52525b'}
              icon={<AlertOctagon size={14} />}
              href={data.items_with_penalty > 0 ? '/dashboard/ml-quality/penalties' : undefined}
            />
          </div>

          {/* Distribuição por nível */}
          <div className="rounded-xl p-5 space-y-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Distribuição por nível
            </h2>
            <LevelBar
              total={data.total_items}
              basic={data.items_basic}
              satisfactory={data.items_satisfactory}
              professional={data.items_professional}
            />
          </div>

          {/* Domínios críticos + Atributos faltantes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl p-5" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Categorias mais críticas
              </h2>
              {data.top_critical_domains.length === 0 ? (
                <p className="text-xs text-zinc-500">Nada crítico — todas categorias bem.</p>
              ) : (
                <div className="space-y-2">
                  {data.top_critical_domains.slice(0, 8).map(d => (
                    <Link
                      key={d.domain_id}
                      href={`/dashboard/ml-quality/items?domain_id=${encodeURIComponent(d.domain_id)}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-zinc-900 transition-colors"
                      style={{ border: '1px solid #1a1a1f' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-zinc-200 truncate">{domainName(d.domain_id)}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {d.items_incomplete} anúncios · score médio {d.avg_score}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-zinc-600 ml-2" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl p-5" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Atributos mais ausentes
              </h2>
              {data.top_missing_attributes.length === 0 ? (
                <p className="text-xs text-zinc-500">Nenhum atributo faltando.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.top_missing_attributes.slice(0, 10).map(a => (
                    <div key={a.attribute} className="flex items-center justify-between text-xs px-2 py-1.5 rounded"
                      style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)' }}>
                      <span className="text-zinc-200 text-[12px]">{attributeName(a.attribute)}</span>
                      <span className="text-cyan-400 font-semibold">{a.missing_in_items}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Atalhos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Link href="/dashboard/ml-quality/items"
              className="rounded-lg px-3 py-2.5 text-xs font-medium hover:border-cyan-400/40 transition-colors"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#a1a1aa' }}>
              Todos os anúncios →
            </Link>
            <Link href="/dashboard/ml-quality/quick-wins"
              className="rounded-lg px-3 py-2.5 text-xs font-medium hover:border-cyan-400/40 transition-colors"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#a1a1aa' }}>
              Quick wins →
            </Link>
            <Link href="/dashboard/ml-quality/penalties"
              className="rounded-lg px-3 py-2.5 text-xs font-medium hover:border-cyan-400/40 transition-colors"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#a1a1aa' }}>
              Penalizados →
            </Link>
            <Link href="/dashboard/ml-quality/items?level=basic"
              className="rounded-lg px-3 py-2.5 text-xs font-medium hover:border-cyan-400/40 transition-colors"
              style={{ background: '#0c0c10', border: '1px solid #1a1a1f', color: '#a1a1aa' }}>
              Nível básico →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, suffix, color, icon, href }: {
  label: string; value: string; suffix?: string; color: string;
  icon?: React.ReactNode; href?: string;
}) {
  const inner = (
    <div className="rounded-xl p-4 transition-all hover:scale-[1.01]"
      style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        <div style={{ color }}>{icon}</div>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}{suffix && <span className="text-sm text-zinc-500 font-normal">{suffix}</span>}
      </p>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function LevelBar({ total, basic, satisfactory, professional }: {
  total: number; basic: number; satisfactory: number; professional: number;
}) {
  const pct = (n: number) => total > 0 ? (n / total) * 100 : 0
  return (
    <>
      <div className="flex h-3 rounded-full overflow-hidden" style={{ background: '#1a1a1f' }}>
        {basic > 0        && <div style={{ width: `${pct(basic)}%`,        background: '#ef4444' }} title={`Básico: ${basic}`} />}
        {satisfactory > 0 && <div style={{ width: `${pct(satisfactory)}%`, background: '#fbbf24' }} title={`Satisfatório: ${satisfactory}`} />}
        {professional > 0 && <div style={{ width: `${pct(professional)}%`, background: '#22c55e' }} title={`Profissional: ${professional}`} />}
      </div>
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <Legend color="#ef4444" label={`Básico (${basic})`}        />
        <Legend color="#fbbf24" label={`Satisfatório (${satisfactory})`} />
        <Legend color="#22c55e" label={`Profissional (${professional})`} />
      </div>
    </>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-zinc-400">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function scoreColor(s: number): string {
  if (s >= 85) return '#22c55e'
  if (s >= 60) return '#fbbf24'
  if (s > 0)   return '#ef4444'
  return '#52525b'
}

