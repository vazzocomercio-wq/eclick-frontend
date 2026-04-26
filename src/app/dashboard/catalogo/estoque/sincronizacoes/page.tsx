'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type SyncLog = {
  id: string
  product_id: string
  channel: string
  account_id: string | null
  quantity_sent: number
  status: 'success' | 'error' | 'skipped'
  error_message: string | null
  triggered_by: string | null
  duration_ms: number | null
  created_at: string
}

type Summary = {
  total: number
  success: number
  error: number
  skipped: number
  last_sync: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-zinc-600 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  success: { label: 'Sucesso',  color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
  error:   { label: 'Erro',     color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  skipped: { label: 'Ignorado', color: '#a1a1aa', bg: 'rgba(161,161,170,0.1)' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SincronizacoesPage() {
  const supabase = useMemo(() => createClient(), [])

  const [logs,      setLogs]      = useState<SyncLog[]>([])
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [status,    setStatus]    = useState('')
  const [channel,   setChannel]   = useState('')
  const [since,     setSince]     = useState('')
  const [syncing,   setSyncing]   = useState(false)
  const [syncMsg,   setSyncMsg]   = useState('')

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}` }
  }, [supabase])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (status)  params.set('status',  status)
      if (channel) params.set('channel', channel)
      if (since)   params.set('since',   since)
      params.set('limit', '100')

      const [logsRes, sumRes] = await Promise.all([
        fetch(`${BACKEND}/stock/sync-logs?${params}`, { headers }),
        fetch(`${BACKEND}/stock/sync-logs?limit=1000`, { headers }),
      ])

      if (logsRes.ok) setLogs(await logsRes.json())

      if (sumRes.ok) {
        const all: SyncLog[] = await sumRes.json()
        const s: Summary = {
          total:    all.length,
          success:  all.filter(l => l.status === 'success').length,
          error:    all.filter(l => l.status === 'error').length,
          skipped:  all.filter(l => l.status === 'skipped').length,
          last_sync: all[0]?.created_at ?? null,
        }
        setSummary(s)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [getHeaders, status, channel, since])

  useEffect(() => { loadData() }, [loadData])

  async function handleSyncAll() {
    setSyncing(true); setSyncMsg('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/stock/sync-all`, { method: 'POST', headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
      setSyncMsg(data.message ?? `${data.success ?? 0} produto(s) sincronizados`)
      await loadData()
    } catch (e: unknown) {
      setSyncMsg(e instanceof Error ? e.message : 'Erro ao sincronizar')
    } finally { setSyncing(false) }
  }

  const successRate = summary && summary.total > 0
    ? Math.round(summary.success / (summary.total - summary.skipped) * 100)
    : 0

  const filterBtn = (active: boolean) => ({
    className: 'px-3 py-1 rounded-lg text-[11px] font-medium transition-all',
    style: active ? { background: '#00E5FF', color: '#000' } : { color: '#71717a' },
  })

  return (
    <div style={{ background: '#09090b', minHeight: '100vh' }} className="p-6 max-w-[1200px] space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Estoque</p>
          <h1 className="text-white text-2xl font-semibold">Sincronizações</h1>
          <p className="text-zinc-500 text-sm mt-1">Histórico de sincronizações de estoque com plataformas</p>
        </div>
        <button onClick={handleSyncAll} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shrink-0"
          style={{ background: '#00E5FF', color: '#000' }}>
          {syncing ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Sincronizando…
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sincronizar Tudo
            </>
          )}
        </button>
      </div>

      {syncMsg && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: '#111114', border: '1px solid rgba(0,229,255,0.2)', color: '#00E5FF' }}>
          {syncMsg}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Total"    value={summary?.total ?? 0}    color="#e4e4e7" />
        <KpiCard label="Sucesso"  value={summary?.success ?? 0}  color="#4ade80" />
        <KpiCard label="Erros"    value={summary?.error ?? 0}    color={summary?.error ? '#f87171' : '#71717a'} />
        <KpiCard label="Ignorados" value={summary?.skipped ?? 0} color="#a1a1aa" />
        <KpiCard label="Taxa de sucesso" value={`${successRate}%`} color={successRate >= 90 ? '#4ade80' : successRate >= 70 ? '#fbbf24' : '#f87171'}
          sub={summary?.last_sync ? `Última: ${relTime(summary.last_sync)}` : 'Sem dados'} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          {['', 'success', 'error', 'skipped'].map(s => (
            <button key={s} onClick={() => setStatus(s)} {...filterBtn(status === s)}>
              {s === '' ? 'Todos' : STATUS_STYLE[s]?.label ?? s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          {['', 'mercadolivre', 'shopee'].map(c => (
            <button key={c} onClick={() => setChannel(c)} {...filterBtn(channel === c)}>
              {c === '' ? 'Canal' : c === 'mercadolivre' ? 'ML' : c}
            </button>
          ))}
        </div>

        <select value={since} onChange={e => setSince(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl outline-none"
          style={{ background: '#111114', border: '1px solid #1a1a1f', color: '#a1a1aa' }}>
          <option value="">Todo o período</option>
          <option value={new Date(Date.now() - 3600000).toISOString()}>Última hora</option>
          <option value={new Date(Date.now() - 86400000).toISOString()}>Últimas 24h</option>
          <option value={new Date(Date.now() - 604800000).toISOString()}>Última semana</option>
        </select>

        <button onClick={loadData}
          className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl transition-colors"
          style={{ color: '#a1a1aa', background: '#111114', border: '1px solid #1a1a1f' }}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>

        <span className="text-[11px] text-zinc-600 ml-auto">{logs.length} registros</span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: '1px solid #1a1a1f', background: '#0c0c10' }}>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Canal</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Produto</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Qtd enviada</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Duração</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Motivo/Erro</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #0f0f12' }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse" style={{ background: '#1a1a1f', width: j === 5 ? '80%' : '60%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-zinc-600">
                    Nenhuma sincronização encontrada
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const ss = STATUS_STYLE[log.status] ?? { label: log.status, color: '#71717a', bg: 'rgba(113,113,122,0.1)' }
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #0f0f12' }}
                      className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold"
                          style={{ color: ss.color, background: ss.bg }}>
                          {ss.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300 font-mono">
                        {log.channel === 'mercadolivre' ? 'ML' : log.channel}
                        {log.account_id && <span className="text-zinc-600 ml-1">· {log.account_id}</span>}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 font-mono text-[11px] max-w-[140px] truncate">
                        {log.product_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300 tabular-nums font-semibold">
                        {log.quantity_sent ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 tabular-nums">
                        {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {log.error_message ? (
                          <span className="text-red-400 text-[11px] truncate block">{log.error_message}</span>
                        ) : log.triggered_by ? (
                          <span className="text-zinc-600 text-[11px]">{log.triggered_by}</span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 whitespace-nowrap">
                        <span title={fmtDate(log.created_at)}>{relTime(log.created_at)}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
