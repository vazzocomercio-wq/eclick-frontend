'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Database, RefreshCw, AlertCircle, CheckCircle2, XCircle,
  Clock, Play, ChevronRight, X,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface AggregatorRun {
  id: string
  run_type: 'backfill' | 'daily' | 'manual'
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  start_date: string
  end_date: string
  total_dates: number
  processed_dates: number
  current_date_processing: string | null
  orders_fetched: number
  orders_inserted: number
  snapshots_inserted: number
  api_calls_made: number
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  error_message: string | null
  error_details: Record<string, unknown>[] | null
}

interface StatusResponse {
  activeRun: AggregatorRun | null
  recentRuns: AggregatorRun[]
}

function useAuthHeaders() {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session) setHeaders({ Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' })
    })
  }, [])
  return headers
}

function fmtDuration(secs: number | null): string {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function StatusBadge({ status }: { status: AggregatorRun['status'] }) {
  const cfg = {
    running:   { bg: 'rgba(0,229,255,0.12)', color: '#00E5FF', label: 'Em andamento', pulse: true },
    completed: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Concluído',    pulse: false },
    failed:    { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Falhou',       pulse: false },
    cancelled: { bg: 'rgba(113,113,122,0.12)', color: '#71717a', label: 'Cancelado',  pulse: false },
  }[status]
  return (
    <span
      className={cfg.pulse ? 'animate-pulse' : ''}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 600, padding: '3px 9px',
        borderRadius: 99, background: cfg.bg, color: cfg.color,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  )
}

function TypeBadge({ type }: { type: AggregatorRun['run_type'] }) {
  const labels = { backfill: 'Backfill', daily: 'Diário', manual: 'Manual' }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: '#71717a', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6 }}>
      {labels[type]}
    </span>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#111114', border: '1px solid #1a1a1f', borderRadius: 12, padding: 20, ...style }}>
      {children}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color: color ?? '#fff' }}>{value}</p>
    </div>
  )
}

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const base = Date.now() - new Date(startedAt).getTime()
    setElapsed(Math.floor(base / 1000))
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return <span>{fmtDuration(elapsed)}</span>
}

function ConfirmModal({
  title, description, onConfirm, onClose,
}: { title: string; description: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#111114', border: '1px solid #1a1a1f', borderRadius: 14, padding: 28, width: 380 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{title}</h3>
          <button onClick={onClose} style={{ color: '#a1a1aa' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 24 }}>{description}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            style={{ padding: '8px 18px', borderRadius: 8, background: '#00E5FF', color: '#000', fontWeight: 700, fontSize: 13 }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

function RunDetailModal({ run, onClose }: { run: AggregatorRun; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#111114', border: '1px solid #1a1a1f', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TypeBadge type={run.run_type} />
            <StatusBadge status={run.status} />
          </div>
          <button onClick={onClose} style={{ color: '#a1a1aa' }}><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Stat label="Início" value={fmtDate(run.started_at)} />
          <Stat label="Duração" value={fmtDuration(run.duration_seconds)} />
          <Stat label="Período" value={`${run.start_date} → ${run.end_date}`} />
          <Stat label="Dias processados" value={`${run.processed_dates}/${run.total_dates}`} />
          <Stat label="Pedidos encontrados" value={run.orders_fetched} color="#00E5FF" />
          <Stat label="Pedidos inseridos" value={run.orders_inserted} color="#00E5FF" />
          <Stat label="Snapshots gerados" value={run.snapshots_inserted} color="#22c55e" />
          <Stat label="Chamadas API" value={run.api_calls_made} />
        </div>
        {run.error_message && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>Erro</p>
            <p style={{ fontSize: 12, color: '#fca5a5' }}>{run.error_message}</p>
          </div>
        )}
        {run.error_details && (
          <div>
            <p style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 6 }}>Detalhes dos erros</p>
            <pre style={{ fontSize: 11, color: '#a1a1aa', background: '#0c0c0f', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 200 }}>
              {JSON.stringify(run.error_details, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AggregatorPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [backfillDays, setBackfillDays] = useState(180)
  const [customDays, setCustomDays] = useState(7)
  const [confirm, setConfirm] = useState<{ title: string; desc: string; action: () => void } | null>(null)
  const [detailRun, setDetailRun] = useState<AggregatorRun | null>(null)
  const headers = useAuthHeaders()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchStatus = useCallback(async () => {
    if (!headers) return
    try {
      const res = await fetch(`${BACKEND}/sales-aggregator/status`, { headers })
      if (res.ok) setStatus(await res.json())
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    if (!headers) return
    fetchStatus()
    const scheduleNext = () => {
      const delay = status?.activeRun ? 5000 : 30000
      intervalRef.current = setTimeout(() => { fetchStatus().then(scheduleNext) }, delay)
    }
    scheduleNext()
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers])

  // Faster polling while run is active
  useEffect(() => {
    if (!headers) return
    if (intervalRef.current) clearTimeout(intervalRef.current)
    const delay = status?.activeRun ? 5000 : 30000
    intervalRef.current = setTimeout(() => fetchStatus(), delay)
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current) }
  }, [status?.activeRun, headers, fetchStatus])

  const post = async (path: string, body: Record<string, unknown> = {}) => {
    if (!headers) return
    setActionLoading(true)
    try {
      const res = await fetch(`${BACKEND}/sales-aggregator/${path}`, {
        method: 'POST', headers, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`)
      await fetchStatus()
      return data
    } finally {
      setActionLoading(false)
    }
  }

  const handleBackfill = async () => {
    try {
      await post('backfill', { days: backfillDays })
      showToast(`Backfill de ${backfillDays} dias iniciado`)
    } catch (e: unknown) {
      showToast((e as Error).message, false)
    }
  }

  const handleRunNow = async (days: number) => {
    try {
      await post('run-now', { days })
      showToast(`Sincronização de ${days} dias iniciada`)
    } catch (e: unknown) {
      showToast((e as Error).message, false)
    }
  }

  const handleCancel = async (runId: string) => {
    try {
      await post(`cancel/${runId}`)
      showToast('Execução marcada como cancelada')
    } catch (e: unknown) {
      showToast((e as Error).message, false)
    }
  }

  const active = status?.activeRun
  const pct = active ? Math.round((active.processed_dates / Math.max(active.total_dates, 1)) * 100) : 0

  return (
    <div className="p-6" style={{ background: '#09090b', minHeight: '100%' }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
          style={{ background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: toast.ok ? '#22c55e' : '#ef4444' }}
        >
          {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {confirm && (
        <ConfirmModal title={confirm.title} description={confirm.desc} onConfirm={confirm.action} onClose={() => setConfirm(null)} />
      )}
      {detailRun && <RunDetailModal run={detailRun} onClose={() => setDetailRun(null)} />}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Database size={20} style={{ color: '#00E5FF' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Agregador de Vendas</h1>
        </div>
        <p style={{ fontSize: 13, color: '#71717a' }}>
          Sincroniza pedidos da API do Mercado Livre e agrega métricas por produto/dia.
        </p>
      </div>

      {/* Status Card */}
      <Card style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa' }}>Status Atual</span>
          <button
            onClick={fetchStatus}
            style={{ color: '#a1a1aa', padding: 4, borderRadius: 6 }}
            title="Atualizar"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: '#71717a' }}>Carregando...</p>
        ) : active ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <StatusBadge status="running" />
              <TypeBadge type={active.run_type} />
              <span style={{ fontSize: 12, color: '#71717a' }}>
                <ElapsedTimer startedAt={active.started_at} /> decorridos
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 8 }}>
              {active.current_date_processing
                ? `Processando ${active.current_date_processing}... (${active.processed_dates}/${active.total_dates} dias)`
                : `Aguardando... (${active.processed_dates}/${active.total_dates} dias)`
              }
            </p>
            <div style={{ background: '#1a1a1f', borderRadius: 99, height: 8, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#00E5FF', borderRadius: 99, width: `${pct}%`, transition: 'width 0.5s ease' }} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <Stat label="Pedidos lidos" value={active.orders_fetched} color="#00E5FF" />
              <Stat label="Pedidos gravados" value={active.orders_inserted} color="#00E5FF" />
              <Stat label="Snapshots" value={active.snapshots_inserted} color="#22c55e" />
              <Stat label="Chamadas API" value={active.api_calls_made} />
            </div>
            <button
              onClick={() => setConfirm({
                title: 'Cancelar execução',
                desc: 'Isso marcará a execução como cancelada. O processamento em andamento continuará até completar o dia atual.',
                action: () => handleCancel(active.id),
              })}
              style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '5px 12px' }}
            >
              Cancelar execução
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                Ocioso
              </span>
            </div>
            {status?.recentRuns?.[0] && (
              <p style={{ fontSize: 12, color: '#71717a' }}>
                Última execução: <span style={{ color: '#a1a1aa' }}>{fmtDate(status.recentRuns[0].started_at)}</span>
                &nbsp;—&nbsp;<StatusBadge status={status.recentRuns[0].status} />
              </p>
            )}
            {status?.recentRuns?.[0]?.error_message && (
              <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12 }}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle size={13} style={{ color: '#ef4444' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>Último erro</span>
                </div>
                <p style={{ fontSize: 12, color: '#fca5a5' }}>{status.recentRuns[0].error_message}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Action Cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>

        {/* Daily sync */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} style={{ color: '#00E5FF' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Sincronização Diária</span>
          </div>
          <p style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 4 }}>Re-processa os últimos 3 dias.</p>
          <p style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 14 }}>Cron: 02:00 BRT todos os dias</p>
          <button
            onClick={() => handleRunNow(3)}
            disabled={!!active || actionLoading}
            className="w-full flex items-center justify-center gap-2"
            style={{
              padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: active || actionLoading ? 'rgba(255,255,255,0.04)' : 'rgba(0,229,255,0.12)',
              color: active || actionLoading ? '#52525b' : '#00E5FF',
              border: '1px solid',
              borderColor: active || actionLoading ? 'transparent' : 'rgba(0,229,255,0.2)',
              cursor: active || actionLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <Play size={13} />
            Forçar agora
          </button>
        </Card>

        {/* Backfill */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Database size={16} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Backfill Inicial</span>
          </div>
          <p style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 4 }}>Importa histórico completo.</p>
          <p style={{ fontSize: 11, color: '#f59e0b', marginBottom: 10 }}>⚠ Pode levar 30–60 minutos</p>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>Dias:</span>
            <input
              type="number"
              value={backfillDays}
              onChange={e => setBackfillDays(Math.min(365, Math.max(1, Number(e.target.value))))}
              min={1} max={365}
              style={{ width: 70, padding: '4px 8px', borderRadius: 6, background: '#1a1a1f', border: '1px solid #2a2a30', color: '#fff', fontSize: 13 }}
            />
          </div>
          <button
            onClick={() => setConfirm({
              title: 'Iniciar Backfill',
              desc: `Isso vai importar pedidos dos últimos ${backfillDays} dias. A operação pode levar mais de 30 minutos. Continuar?`,
              action: handleBackfill,
            })}
            disabled={!!active || actionLoading}
            className="w-full flex items-center justify-center gap-2"
            style={{
              padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: active || actionLoading ? 'rgba(255,255,255,0.04)' : 'rgba(245,158,11,0.12)',
              color: active || actionLoading ? '#52525b' : '#f59e0b',
              border: '1px solid',
              borderColor: active || actionLoading ? 'transparent' : 'rgba(245,158,11,0.2)',
              cursor: active || actionLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <Play size={13} />
            Iniciar Backfill
          </button>
        </Card>

        {/* Custom sync */}
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={16} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Sincronização Custom</span>
          </div>
          <p style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 4 }}>Sincroniza um período personalizado.</p>
          <p style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 10 }}>Máximo 30 dias</p>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>Dias:</span>
            <input
              type="number"
              value={customDays}
              onChange={e => setCustomDays(Math.min(30, Math.max(1, Number(e.target.value))))}
              min={1} max={30}
              style={{ width: 70, padding: '4px 8px', borderRadius: 6, background: '#1a1a1f', border: '1px solid #2a2a30', color: '#fff', fontSize: 13 }}
            />
          </div>
          <button
            onClick={() => handleRunNow(customDays)}
            disabled={!!active || actionLoading}
            className="w-full flex items-center justify-center gap-2"
            style={{
              padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: active || actionLoading ? 'rgba(255,255,255,0.04)' : 'rgba(167,139,250,0.12)',
              color: active || actionLoading ? '#52525b' : '#a78bfa',
              border: '1px solid',
              borderColor: active || actionLoading ? 'transparent' : 'rgba(167,139,250,0.2)',
              cursor: active || actionLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <Play size={13} />
            Sincronizar
          </button>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Histórico de Execuções</h2>
        {!status?.recentRuns?.length ? (
          <p style={{ fontSize: 13, color: '#a1a1aa', textAlign: 'center', padding: '24px 0' }}>Nenhuma execução registrada.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1f' }}>
                  {['Tipo', 'Início', 'Duração', 'Status', 'Dias', 'Pedidos', 'Snapshots', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#a1a1aa', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {status.recentRuns.map(run => (
                  <tr
                    key={run.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => setDetailRun(run)}
                  >
                    <td style={{ padding: '10px 12px' }}><TypeBadge type={run.run_type} /></td>
                    <td style={{ padding: '10px 12px', color: '#a1a1aa', whiteSpace: 'nowrap' }}>{fmtDate(run.started_at)}</td>
                    <td style={{ padding: '10px 12px', color: '#a1a1aa' }}>{fmtDuration(run.duration_seconds)}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={run.status} /></td>
                    <td style={{ padding: '10px 12px', color: '#a1a1aa' }}>{run.processed_dates}/{run.total_dates}</td>
                    <td style={{ padding: '10px 12px', color: '#00E5FF', fontWeight: 600 }}>{run.orders_inserted}</td>
                    <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 600 }}>{run.snapshots_inserted}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <ChevronRight size={14} style={{ color: '#a1a1aa' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
