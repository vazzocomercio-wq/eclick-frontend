'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getSocket } from '@/lib/socket'
import OnboardingBanner from '@/components/inteligencia/OnboardingBanner'
import {
  RefreshCw, Bell, Filter, AlertCircle, ShieldCheck, AlertTriangle, Activity,
  Clock, MessageSquare, CheckCircle2, XCircle, ExternalLink, Sparkles, Link2,
  X, Code, User as UserIcon, Send,
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
  related_signals: string[] | null
  cross_insight:   string | null
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
  { value: 'all',         label: 'Todos' },
  { value: 'cross_intel', label: 'Cross-Intel' },
  { value: 'estoque',     label: 'Estoque' },
  { value: 'compras',     label: 'Compras' },
  { value: 'preco',       label: 'Preço' },
  { value: 'margem',      label: 'Margem' },
  { value: 'ads',         label: 'Ads' },
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

function SignalCard({ signal, deliveries, relatedSignals, onClick }: {
  signal: AlertSignal
  deliveries: AlertDelivery[]
  relatedSignals: AlertSignal[]
  onClick: () => void
}) {
  const meta = SEVERITY_META[signal.severity]
  const isCross = signal.analyzer === 'cross_intel'
  const responded = deliveries.filter(d => d.response_at).length
  const sent = deliveries.filter(d => ['sent', 'delivered', 'read'].includes(d.status)).length
  const failed = deliveries.filter(d => d.status === 'failed').length

  // Cross-intel cards têm visual destaque: gradient sutil + border roxa
  const crossColor = '#a78bfa'
  const cardStyle = isCross
    ? {
        background: `linear-gradient(135deg, ${crossColor}0c 0%, #111114 60%)`,
        border:     `1px solid ${crossColor}55`,
        boxShadow:  `inset 0 1px 0 ${crossColor}22`,
      }
    : {
        background: '#111114',
        border:     `1px solid ${signal.severity === 'critical' ? meta.color + '55' : '#1e1e24'}`,
      }

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-transform hover:-translate-y-0.5"
      style={cardStyle}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}>

      {isCross && (
        <div className="-mb-1 flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full inline-flex items-center gap-1"
            style={{ background: `${crossColor}1a`, color: crossColor, border: `1px solid ${crossColor}55` }}>
            <Sparkles size={10} /> Cross-Insight
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
          style={{
            background: isCross ? `${crossColor}1a` : `${meta.color}1a`,
            border:     `1px solid ${(isCross ? crossColor : meta.color) + '33'}`,
          }}>
          {isCross ? <Sparkles size={15} style={{ color: crossColor }} /> : <meta.icon size={15} style={{ color: meta.color }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: isCross ? crossColor : meta.color }}>
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
          style={{
            background: isCross ? `${crossColor}0d` : 'rgba(0,229,255,0.05)',
            border:     `1px solid ${isCross ? crossColor + '33' : 'rgba(0,229,255,0.15)'}`,
          }}>
          <ShieldCheck size={11} style={{ color: isCross ? crossColor : '#00E5FF', marginTop: 2, flexShrink: 0 }} />
          <p className="text-[11px] text-zinc-300 leading-relaxed">{signal.suggestion_pt}</p>
        </div>
      )}

      {/* Related signals (cross-intel only) */}
      {isCross && relatedSignals.length > 0 && (
        <div className="px-3 py-2 rounded-lg space-y-1.5"
          style={{ background: '#18181b', border: '1px solid #27272a' }}>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 inline-flex items-center gap-1">
            <Link2 size={10} /> Sinais relacionados ({relatedSignals.length})
          </p>
          {relatedSignals.map(r => (
            <div key={r.id} className="flex items-start gap-2 text-[10px] text-zinc-400 leading-relaxed">
              <span className="text-zinc-600">·</span>
              <span className="flex-1">
                <span className="font-semibold text-zinc-300 capitalize">{r.analyzer}</span>
                {' / '}
                <span style={{ color: SEVERITY_META[r.severity].color }}>
                  {humanizeCategory(r.category)}
                </span>
                {' — '}
                {r.summary_pt.slice(0, 80)}{r.summary_pt.length > 80 ? '…' : ''}
              </span>
            </div>
          ))}
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
  const [selectedSignal, setSelectedSignal] = useState<AlertSignal | null>(null)
  const [managers, setManagers] = useState<Array<{ id: string; name: string; department: string }>>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, d, m] = await Promise.all([
        api<AlertSignal[]>('/alert-signals?limit=100'),
        api<AlertDelivery[]>('/alert-deliveries?limit=200'),
        api<Array<{ id: string; name: string; department: string }>>('/alert-managers').catch(() => []),
      ])
      setSignals(s)
      setDeliveries(d)
      setManagers(m)
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

  // Lookup signals by id (pra resolver related_signals)
  const signalById = useMemo(() => {
    const m = new Map<string, AlertSignal>()
    for (const s of signals) m.set(s.id, s)
    return m
  }, [signals])

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

      <OnboardingBanner />

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
          {filtered.map(s => {
            const related = (s.related_signals ?? [])
              .map(id => signalById.get(id))
              .filter((x): x is AlertSignal => !!x)
            return (
              <SignalCard
                key={s.id}
                signal={s}
                deliveries={deliveriesBySignal.get(s.id) ?? []}
                relatedSignals={related}
                onClick={() => setSelectedSignal(s)}
              />
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-zinc-700 leading-relaxed pt-2">
        Os analyzers rodam a cada 15 minutos. Críticos vão direto pelo WhatsApp;
        atenções e informações são compiladas em digests de manhã/tarde/noite.
        Quando o gestor responde &quot;1&quot;, &quot;2&quot; ou &quot;3&quot; pelo WhatsApp, a ação é
        registrada aqui em tempo real.
      </p>

      {selectedSignal && (
        <SignalDetailDrawer
          signal={selectedSignal}
          deliveries={deliveriesBySignal.get(selectedSignal.id) ?? []}
          relatedSignals={(selectedSignal.related_signals ?? [])
            .map(id => signalById.get(id))
            .filter((x): x is AlertSignal => !!x)}
          managers={managers}
          onClose={() => setSelectedSignal(null)}
          onJumpToSignal={(s) => setSelectedSignal(s)}
        />
      )}
    </div>
  )
}

// ── SignalDetailDrawer ────────────────────────────────────────────────────────

const RESPONSE_LABELS: Record<ResponseType, { label: string; color: string }> = {
  approve:  { label: 'Aprovou',   color: '#4ade80' },
  details:  { label: 'Detalhes',  color: '#60a5fa' },
  ignore:   { label: 'Ignorou',   color: '#71717a' },
  delegate: { label: 'Delegou',   color: '#a78bfa' },
  custom:   { label: 'Resposta livre', color: '#a78bfa' },
}

function SignalDetailDrawer({
  signal, deliveries, relatedSignals, managers, onClose, onJumpToSignal,
}: {
  signal: AlertSignal
  deliveries: AlertDelivery[]
  relatedSignals: AlertSignal[]
  managers: Array<{ id: string; name: string; department: string }>
  onClose: () => void
  onJumpToSignal: (s: AlertSignal) => void
}) {
  const meta = SEVERITY_META[signal.severity]
  const isCross = signal.analyzer === 'cross_intel'
  const crossColor = '#a78bfa'
  const accent = isCross ? crossColor : meta.color
  const Icon = isCross ? Sparkles : meta.icon

  // ESC fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const managerById = useMemo(() => {
    const m = new Map<string, { name: string; department: string }>()
    for (const x of managers) m.set(x.id, x)
    return m
  }, [managers])

  const dataEntries = Object.entries(signal.data ?? {}).filter(([, v]) => v !== null && v !== undefined)

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />

      {/* Drawer */}
      <div className="absolute top-0 right-0 h-full w-full sm:w-[480px] overflow-y-auto"
        style={{ background: '#0c0c0e', borderLeft: '1px solid #27272a' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true">

        {/* Header — sticky */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-start gap-3"
          style={{ background: '#0c0c0e', borderBottom: '1px solid #1e1e24' }}>
          <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
            style={{ background: `${accent}1a`, border: `1px solid ${accent}33` }}>
            <Icon size={16} style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            {isCross && (
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] inline-flex items-center gap-1"
                style={{ color: crossColor }}>
                <Sparkles size={9} /> Cross-Insight
              </span>
            )}
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: accent }}>
              {humanizeCategory(signal.category)}
            </p>
            {signal.entity_name && (
              <h2 className="text-white font-semibold text-base mt-0.5 truncate">{signal.entity_name}</h2>
            )}
            <p className="text-[10px] text-zinc-500 mt-1">
              {timeAgo(signal.created_at)} · {signal.analyzer} · score {signal.score}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg transition-colors shrink-0"
            style={{ color: '#71717a' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
            aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityPill severity={signal.severity} />
            <StatusBadge status={signal.status} />
          </div>

          {/* Summary */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">Resumo</p>
            <p className="text-sm text-zinc-200 leading-relaxed">{signal.summary_pt}</p>
          </div>

          {/* Suggestion */}
          {signal.suggestion_pt && (
            <div className="px-3 py-2.5 rounded-lg flex items-start gap-2"
              style={{
                background: `${accent}0d`,
                border:     `1px solid ${accent}33`,
              }}>
              <ShieldCheck size={12} style={{ color: accent, marginTop: 2, flexShrink: 0 }} />
              <p className="text-xs text-zinc-200 leading-relaxed">{signal.suggestion_pt}</p>
            </div>
          )}

          {/* Data jsonb formatado */}
          {dataEntries.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5 inline-flex items-center gap-1">
                <Code size={10} /> Dados do sinal
              </p>
              <div className="rounded-lg overflow-hidden" style={{ background: '#18181b', border: '1px solid #27272a' }}>
                {dataEntries.map(([k, v], i) => (
                  <div key={k} className="px-3 py-2 flex items-start gap-3 text-[11px]"
                    style={{ borderTop: i > 0 ? '1px solid #1e1e24' : 'none' }}>
                    <span className="text-zinc-500 font-mono shrink-0">{k}</span>
                    <span className="flex-1 min-w-0 text-zinc-200 font-mono break-all text-right">
                      {formatValue(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related signals (cross-intel) */}
          {relatedSignals.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5 inline-flex items-center gap-1">
                <Link2 size={10} /> Sinais relacionados ({relatedSignals.length})
              </p>
              <div className="space-y-1.5">
                {relatedSignals.map(r => {
                  const rmeta = SEVERITY_META[r.severity]
                  return (
                    <button key={r.id} onClick={() => onJumpToSignal(r)}
                      className="w-full text-left px-3 py-2 rounded-lg transition-colors"
                      style={{ background: '#18181b', border: '1px solid #27272a' }}>
                      <div className="flex items-center gap-2">
                        <rmeta.icon size={11} style={{ color: rmeta.color }} />
                        <span className="text-[10px] uppercase tracking-wider font-semibold capitalize" style={{ color: rmeta.color }}>
                          {r.analyzer}
                        </span>
                        <span className="text-[10px] text-zinc-600">·</span>
                        <span className="text-[10px] text-zinc-400">{humanizeCategory(r.category)}</span>
                        <span className="ml-auto text-[10px] font-mono text-zinc-600">→</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 mt-1 line-clamp-2">{r.summary_pt}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Deliveries */}
          {deliveries.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5 inline-flex items-center gap-1">
                <Send size={10} /> Entregas ({deliveries.length})
              </p>
              <div className="space-y-1.5">
                {deliveries.map(d => {
                  const mgr = managerById.get(d.manager_id)
                  const resp = d.response_type ? RESPONSE_LABELS[d.response_type] : null
                  return (
                    <div key={d.id} className="px-3 py-2 rounded-lg space-y-1.5"
                      style={{ background: '#18181b', border: '1px solid #27272a' }}>
                      <div className="flex items-center gap-2">
                        <UserIcon size={11} style={{ color: '#a1a1aa' }} />
                        <span className="text-xs text-zinc-200 font-medium">{mgr?.name ?? d.manager_id.slice(0, 8)}</span>
                        {mgr && (
                          <span className="text-[9px] text-zinc-600 capitalize">· {mgr.department}</span>
                        )}
                        <span className="ml-auto"><DeliveryStatusIcon status={d.status} /></span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span>{d.delivery_type === 'immediate' ? 'imediato' : d.delivery_type.replace('digest_', 'digest ')}</span>
                        {d.sent_at && <span>· enviado {timeAgo(d.sent_at)}</span>}
                        {d.status === 'failed' && d.error_message && (
                          <span className="text-rose-400">· {d.error_message.slice(0, 40)}</span>
                        )}
                      </div>
                      {resp && (
                        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: resp.color }}>
                          <CheckCircle2 size={11} />
                          <span className="font-semibold">{resp.label}</span>
                          {d.response_text && d.response_type === 'custom' && (
                            <span className="text-zinc-400 italic">&quot;{d.response_text.slice(0, 60)}&quot;</span>
                          )}
                          {d.response_at && <span className="text-zinc-600 ml-auto">{timeAgo(d.response_at)}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  return JSON.stringify(v)
}
