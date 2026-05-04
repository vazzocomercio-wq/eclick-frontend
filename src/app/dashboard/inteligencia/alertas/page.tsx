'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getSocket } from '@/lib/socket'
import {
  RefreshCw, Bell, Filter, AlertCircle, ShieldCheck, AlertTriangle, Activity,
  Clock, MessageSquare, CheckCircle2, XCircle, ExternalLink,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type AnalyzerName = 'compras' | 'preco' | 'estoque' | 'margem' | 'ads' | 'cross_intel'
type Severity = 'critical' | 'warning' | 'info'
type SignalStatus = 'new' | 'dispatched' | 'delivered' | 'acted' | 'ignored' | 'expired'
type DeliveryStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
type ResponseType = 'approve' | 'details' | 'ignore' | 'delegate' | 'custom'

interface AlertSignal {
  id:              string
  organization_id: string
  analyzer:        AnalyzerName
  category:        string
  severity:        Severity
  score:           number
  entity_type:     string | null
  entity_id:       string | null
  entity_name:     string | null
  data:            Record<string, unknown>
  summary_pt:      string
  suggestion_pt:   string | null
  status:          SignalStatus
  created_at:      string
}

interface AlertDelivery {
  id:             string
  signal_id:      string
  manager_id:     string
  status:         DeliveryStatus
  delivery_type:  string
  sent_at:        string | null
  response_type:  ResponseType | null
  response_text:  string | null
  response_at:    string | null
  error_message:  string | null
  created_at:     string
}

const ANALYZERS: { value: AnalyzerName | 'all'; label: string }[] = [
  { value: 'all',     label: 'Todos' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'compras', label: 'Compras' },
  { value: 'preco',   label: 'Preço' },
  { value: 'margem',  label: 'Margem' },
]

const SEVERITY_META: Record<Severity, { color: string; icon: typeof AlertCircle; label: string }> = {
  critical: { color: '#f87171', icon: AlertCircle,   label: 'Crítico' },
  warning:  { color: '#f59e0b', icon: AlertTriangle, label: 'Atenção' },
  info:     { color: '#60a5fa', icon: Activity,     label: 'Info' },
}

// ── API ───────────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string): Promise<T> {
  const token = await getToken()
  if (!token) throw new Error('Sessão expirada')
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

function humanizeCategory(cat: string): string {
  return cat.replace(/_/g, ' ')
}

// ── Components ────────────────────────────────────────────────────────────────

function SeverityPill({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity]
  const Icon = meta.icon
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: `${meta.color}1a`, color: meta.color, border: `1px solid ${meta.color}33` }}>
      <Icon size={10} />
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: SignalStatus }) {
  const map: Record<SignalStatus, { label: string; color: string }> = {
    new:        { label: 'Novo',       color: '#60a5fa' },
    dispatched: { label: 'Enviado',    color: '#FFE600' },
    delivered:  { label: 'Entregue',   color: '#a78bfa' },
    acted:      { label: 'Aprovado',   color: '#4ade80' },
    ignored:    { label: 'Ignorado',   color: '#71717a' },
    expired:    { label: 'Expirado',   color: '#52525b' },
  }
  const s = map[status]
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${s.color}1a`, color: s.color, border: `1px solid ${s.color}33` }}>
      {s.label}
    </span>
  )
}

function DeliveryStatusIcon({ status }: { status: DeliveryStatus }) {
  if (status === 'sent' || status === 'delivered' || status === 'read') {
    return <CheckCircle2 size={11} style={{ color: '#4ade80' }} />
  }
  if (status === 'failed') return <XCircle size={11} style={{ color: '#f87171' }} />
  return <Clock size={11} style={{ color: '#71717a' }} />
}

// ── Card ──────────────────────────────────────────────────────────────────────

function SignalCard({ signal, deliveries }: { signal: AlertSignal; deliveries: AlertDelivery[] }) {
  const meta = SEVERITY_META[signal.severity]
  const responded = deliveries.filter(d => d.response_at).length
  const sent = deliveries.filter(d => ['sent', 'delivered', 'read'].includes(d.status)).length
  const failed = deliveries.filter(d => d.status === 'failed').length

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: '#111114',
        border: `1px solid ${signal.severity === 'critical' ? meta.color + '55' : '#1e1e24'}`,
      }}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
          style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}33` }}>
          <meta.icon size={15} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: meta.color }}>
              {humanizeCategory(signal.category)}
            </span>
            <span className="text-[10px] text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-500 font-mono">score {signal.score}</span>
          </div>
          {signal.entity_name && (
            <h3 className="text-white font-semibold text-sm mt-0.5 truncate">{signal.entity_name}</h3>
          )}
        </div>
        <span className="text-[10px] text-zinc-600 font-mono whitespace-nowrap">
          {timeAgo(signal.created_at)}
        </span>
      </div>

      {/* Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <SeverityPill severity={signal.severity} />
        <StatusBadge status={signal.status} />
        <span className="text-[10px] text-zinc-600 ml-auto">
          {signal.analyzer}
        </span>
      </div>

      {/* Summary */}
      <p className="text-xs text-zinc-300 leading-relaxed">{signal.summary_pt}</p>

      {/* Suggestion */}
      {signal.suggestion_pt && (
        <div className="px-3 py-2 rounded-lg flex items-start gap-2"
          style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.15)' }}>
          <ShieldCheck size={11} style={{ color: '#00E5FF', marginTop: 2, flexShrink: 0 }} />
          <p className="text-[11px] text-zinc-300 leading-relaxed">{signal.suggestion_pt}</p>
        </div>
      )}

      {/* Deliveries summary */}
      {deliveries.length > 0 && (
        <div className="flex items-center gap-3 pt-1 text-[10px] text-zinc-500 border-t" style={{ borderColor: '#1e1e24' }}>
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={11} />
            {deliveries.length} gestor{deliveries.length !== 1 ? 'es' : ''}
          </span>
          {sent > 0 && (
            <span className="inline-flex items-center gap-1" style={{ color: '#4ade80' }}>
              <CheckCircle2 size={11} /> {sent} enviado{sent !== 1 ? 's' : ''}
            </span>
          )}
          {failed > 0 && (
            <span className="inline-flex items-center gap-1" style={{ color: '#f87171' }}>
              <XCircle size={11} /> {failed} falhou
            </span>
          )}
          {responded > 0 && (
            <span className="inline-flex items-center gap-1" style={{ color: '#a78bfa' }}>
              <CheckCircle2 size={11} /> {responded} respondeu
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AlertasPage() {
  const [signals, setSignals]       = useState<AlertSignal[]>([])
  const [deliveries, setDeliveries] = useState<AlertDelivery[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [filter, setFilter]         = useState<AnalyzerName | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'disconnected'>('connecting')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, d] = await Promise.all([
        api<AlertSignal[]>('/alert-signals?limit=100'),
        api<AlertDelivery[]>('/alert-deliveries?limit=200'),
      ])
      setSignals(s)
      setDeliveries(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar alertas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Socket.IO listeners
  useEffect(() => {
    let cancelled = false
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null

    void (async () => {
      try {
        socket = await getSocket()
        if (cancelled || !socket) return

        const onConnect    = () => setLiveStatus('live')
        const onDisconnect = () => setLiveStatus('disconnected')
        const onDispatched = () => { void load() }   // simples: recarrega pra pegar novo signal+deliveries
        const onSent       = (payload: { delivery_id: string }) => {
          setDeliveries(prev => prev.map(d => d.id === payload.delivery_id
            ? { ...d, status: 'sent', sent_at: new Date().toISOString() }
            : d
          ))
        }
        const onResponded  = (payload: { delivery_id: string; response_type: ResponseType }) => {
          setDeliveries(prev => prev.map(d => d.id === payload.delivery_id
            ? { ...d, response_type: payload.response_type, response_at: new Date().toISOString() }
            : d
          ))
        }

        socket.on('connect', onConnect)
        socket.on('disconnect', onDisconnect)
        socket.on('alert:dispatched', onDispatched)
        socket.on('alert:sent',       onSent)
        socket.on('alert:responded',  onResponded)
        if (socket.connected) onConnect()
      } catch {
        if (!cancelled) setLiveStatus('disconnected')
      }
    })()

    return () => {
      cancelled = true
      if (socket) {
        socket.off('alert:dispatched')
        socket.off('alert:sent')
        socket.off('alert:responded')
      }
    }
  }, [load])

  // Group deliveries by signal_id
  const deliveriesBySignal = useMemo(() => {
    const m = new Map<string, AlertDelivery[]>()
    for (const d of deliveries) {
      const arr = m.get(d.signal_id) ?? []
      arr.push(d)
      m.set(d.signal_id, arr)
    }
    return m
  }, [deliveries])

  const filtered = useMemo(() => {
    return signals.filter(s => {
      if (filter !== 'all' && s.analyzer !== filter) return false
      if (severityFilter !== 'all' && s.severity !== severityFilter) return false
      return true
    })
  }, [signals, filter, severityFilter])

  const counts = useMemo(() => ({
    critical: signals.filter(s => s.severity === 'critical').length,
    warning:  signals.filter(s => s.severity === 'warning').length,
    info:     signals.filter(s => s.severity === 'info').length,
  }), [signals])

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-zinc-500 text-xs">Inteligência</p>
          <div className="flex items-center gap-2 mt-0.5">
            <h2 className="text-white text-lg font-semibold">Alertas</h2>
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: liveStatus === 'live' ? 'rgba(74,222,128,0.1)' : 'rgba(161,161,170,0.1)',
                color:      liveStatus === 'live' ? '#4ade80' : '#a1a1aa',
                border:     `1px solid ${liveStatus === 'live' ? 'rgba(74,222,128,0.25)' : 'rgba(161,161,170,0.2)'}`,
              }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: liveStatus === 'live' ? '#4ade80' : '#a1a1aa' }} />
              {liveStatus === 'live' ? 'AO VIVO' : liveStatus === 'connecting' ? 'CONECTANDO' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-600 mt-1">
            {counts.critical > 0 && <span style={{ color: '#f87171' }}>{counts.critical} crítico{counts.critical !== 1 ? 's' : ''}</span>}
            {counts.critical > 0 && counts.warning > 0 && ' · '}
            {counts.warning > 0 && <span style={{ color: '#f59e0b' }}>{counts.warning} atenção</span>}
            {(counts.critical > 0 || counts.warning > 0) && counts.info > 0 && ' · '}
            {counts.info > 0 && <span style={{ color: '#60a5fa' }}>{counts.info} info</span>}
            {signals.length === 0 && 'Sem alertas'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/dashboard/inteligencia/gestores"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Gestores
            <ExternalLink size={11} />
          </a>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 shrink-0 mr-1 inline-flex items-center gap-1">
            <Filter size={10} /> Analyzer
          </span>
          {ANALYZERS.map(a => {
            const active = filter === a.value
            return (
              <button key={a.value} onClick={() => setFilter(a.value)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                style={{
                  background: active ? 'rgba(0,229,255,0.1)' : '#111114',
                  color:      active ? '#00E5FF' : '#a1a1aa',
                  border:     `1px solid ${active ? 'rgba(0,229,255,0.3)' : '#27272a'}`,
                }}>
                {a.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {(['all', 'critical', 'warning', 'info'] as const).map(v => {
            const active = severityFilter === v
            const meta = v === 'all' ? null : SEVERITY_META[v]
            const color = meta?.color ?? '#a1a1aa'
            return (
              <button key={v} onClick={() => setSeverityFilter(v)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                style={{
                  background: active ? `${color}1a` : '#111114',
                  color:      active ? color : '#a1a1aa',
                  border:     `1px solid ${active ? color + '55' : '#27272a'}`,
                }}>
                {v === 'all' ? 'Todas severities' : meta?.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center gap-3"
          style={{ background: '#111114', border: '1px dashed #27272a' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <Bell size={22} style={{ color: '#00E5FF' }} />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Nenhum alerta gerado ainda</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Os analyzers rodam a cada 15 minutos. Cadastre gestores e ative o hub
              em configurações pra começar a receber alertas inteligentes via WhatsApp.
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl px-4 py-8 text-center text-xs text-zinc-500"
          style={{ background: '#111114', border: '1px solid #27272a' }}>
          Nenhum alerta com esses filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(s => (
            <SignalCard
              key={s.id}
              signal={s}
              deliveries={deliveriesBySignal.get(s.id) ?? []}
            />
          ))}
        </div>
      )}

      <p className="text-[10px] text-zinc-700 leading-relaxed pt-2">
        Os analyzers rodam a cada 15 minutos. Críticos vão direto pelo WhatsApp;
        atenções e informações são compiladas em digests de manhã/tarde/noite.
        Quando o gestor responde &quot;1&quot;, &quot;2&quot; ou &quot;3&quot; pelo WhatsApp, a ação é
        registrada aqui em tempo real.
      </p>
    </div>
  )
}
