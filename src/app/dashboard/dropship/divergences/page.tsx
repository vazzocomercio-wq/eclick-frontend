'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { usePrompt } from '@/components/ui/dialog-provider'
import {
  ArrowLeft, AlertCircle, Search, RefreshCw, AlertTriangle, CheckCircle2,
  EyeOff, X, Lightbulb,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type DivergenceType =
  | 'cost_change_uninformed' | 'cost_at_oc_different' | 'stock_inconsistency'
  | 'shipment_delay' | 'no_shipment_confirmation' | 'return_amount_mismatch'
  | 'duplicate_oc_item' | 'missing_partner_product' | 'price_below_cost'

type Severity = 'critical' | 'high' | 'medium' | 'low'

interface Divergence {
  id: string
  divergence_type: DivergenceType
  severity: Severity
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'ignored'
  expected_value: number | null
  actual_value: number | null
  difference_amount: number | null
  difference_pct: number | null
  description: string
  recommended_action: string | null
  identification_id: string | null
  supplier_product_id: string | null
  oc_id: string | null
  acknowledged_at: string | null
  resolved_at: string | null
  resolution_notes: string | null
  detected_at: string
  suppliers: { id: string; name: string } | null
}

export default function DivergencesPage() {
  const supabase = useMemo(() => createClient(), [])

  const [divergences, setDivergences] = useState<Divergence[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [err, setErr] = useState('')
  const [filterStatus, setFilterStatus] = useState<'open_all' | Divergence['status'] | 'all'>('open_all')
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all')
  const prompt = usePrompt()

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (filterStatus === 'open_all') params.set('status', 'open,acknowledged,investigating')
      else if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterSeverity !== 'all') params.set('severity', filterSeverity)
      const res = await fetch(`${BACKEND}/dropship/divergences?${params}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDivergences(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }, [getHeaders, filterStatus, filterSeverity])

  useEffect(() => { load() }, [load])

  async function runScan() {
    setScanning(true); setErr('')
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/divergences/scan`, { method: 'POST', headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = await res.json()
      if (r.detected === 0) setErr('Nenhuma divergência nova detectada')
      else await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao escanear')
    } finally { setScanning(false) }
  }

  async function action(id: string, mode: 'acknowledge' | 'resolve' | 'ignore') {
    let body: Record<string, string> = {}
    if (mode === 'resolve') {
      const notes = await prompt({
        title: 'Resolver divergência',
        message: 'Descreva como foi resolvida (vai pro registro de auditoria).',
        placeholder: 'Ex: Parceiro confirmou envio às 16h após contato',
        multiline: true,
        confirmLabel: 'Resolver',
      })
      if (!notes?.trim()) return
      body = { notes }
    } else if (mode === 'ignore') {
      const reason = await prompt({
        title: 'Ignorar divergência',
        message: 'Por que esta divergência pode ser ignorada?',
        placeholder: 'Ex: Falso positivo — pedido cancelado pelo comprador',
        multiline: true,
        confirmLabel: 'Ignorar',
        variant: 'warning',
      })
      if (!reason?.trim()) return
      body = { reason }
    }
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/dropship/divergences/${id}/${mode}`, {
        method: 'POST', headers,
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro')
    }
  }

  // KPIs
  const total = divergences.length
  const open = divergences.filter(d => d.status === 'open').length
  const critical = divergences.filter(d => d.severity === 'critical' && ['open', 'acknowledged', 'investigating'].includes(d.status)).length

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/dropship" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">Divergências</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Detecção automática @02h diário · 3 regras v1 (atraso envio, mapeamento, preço &lt; custo)
            </p>
          </div>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg"
          style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
        >
          <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'Escaneando...' : 'Escanear agora'}
        </button>
      </div>

      {err && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(252,211,77,0.10)', color: '#fcd34d', border: '1px solid rgba(252,211,77,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {err}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Kpi label="Total" value={total} />
        <Kpi label="Em aberto" value={open} accent={open > 0 ? '#fcd34d' : undefined} />
        <Kpi label="Críticas" value={critical} accent={critical > 0 ? '#f87171' : '#22c55e'} />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden flex-wrap" style={{ border: '1px solid #27272a' }}>
          {(['open_all', 'open', 'acknowledged', 'resolved', 'ignored', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterStatus === s ? '#00E5FF' : 'transparent',
                color: filterStatus === s ? '#09090b' : '#a1a1aa',
              }}
            >
              {filterLabel(s)}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterSeverity(s)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterSeverity === s ? '#00E5FF' : 'transparent',
                color: filterSeverity === s ? '#09090b' : '#a1a1aa',
              }}
            >
              {s === 'all' ? 'Todas' : severityLabel(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="rounded-xl p-12 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            Carregando...
          </div>
        ) : divergences.length === 0 ? (
          <div className="rounded-xl p-12 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <CheckCircle2 size={28} className="mx-auto mb-2" style={{ color: '#22c55e' }} />
            <p>Sem divergências nesse filtro</p>
            <p className="text-xs mt-1">Tudo certo. Ou talvez não rodou scan ainda — clique em &quot;Escanear agora&quot;.</p>
          </div>
        ) : divergences.map(d => (
          <DivergenceCard key={d.id} divergence={d} onAction={action} />
        ))}
      </div>
    </div>
  )
}

function DivergenceCard({
  divergence: d, onAction,
}: {
  divergence: Divergence
  onAction: (id: string, mode: 'acknowledge' | 'resolve' | 'ignore') => void
}) {
  const c = severityColor(d.severity)
  const isOpen = ['open', 'acknowledged', 'investigating'].includes(d.status)

  return (
    <div className="rounded-xl p-4" style={{
      background: '#111114',
      borderLeft: `3px solid ${c}`,
      border: `1px solid ${c}33`,
    }}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} style={{ color: c }} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${c}1A`, color: c, border: `1px solid ${c}33` }}>
              {severityLabel(d.severity)}
            </span>
            <DivergenceTypePill type={d.divergence_type} />
            <DivergenceStatusPill status={d.status} />
            <span className="text-xs text-zinc-500">{d.suppliers?.name ?? '—'}</span>
          </div>
          <p className="text-sm text-white mb-1">{d.description}</p>
          {d.recommended_action && (
            <p className="text-xs flex items-start gap-1.5 mt-2" style={{ color: '#a5f3fc' }}>
              <Lightbulb size={11} className="mt-0.5 shrink-0" />
              {d.recommended_action}
            </p>
          )}
          {d.expected_value != null && d.actual_value != null && (
            <p className="text-xs text-zinc-500 mt-1">
              Esperado: <span className="text-zinc-300">{d.expected_value}</span>
              {' · '}
              Real: <span style={{ color: c }}>{d.actual_value}</span>
              {d.difference_pct != null && <span> ({d.difference_pct > 0 ? '+' : ''}{d.difference_pct}%)</span>}
            </p>
          )}
          {d.resolution_notes && (
            <p className="text-xs text-zinc-500 mt-2 italic">
              {d.status === 'resolved' ? '✓' : '✕'} {d.resolution_notes}
            </p>
          )}
          <p className="text-xs text-zinc-600 mt-2">{fmtDateTime(d.detected_at)}</p>
        </div>
        {isOpen && (
          <div className="flex items-center gap-1 shrink-0">
            {d.status === 'open' && (
              <button
                onClick={() => onAction(d.id, 'acknowledge')}
                className="text-zinc-500 hover:text-cyan-400 p-1"
                title="Reconhecer"
              >
                <CheckCircle2 size={14} />
              </button>
            )}
            <button
              onClick={() => onAction(d.id, 'resolve')}
              className="text-zinc-500 hover:text-green-400 p-1"
              title="Resolver"
            >
              <CheckCircle2 size={14} />
            </button>
            <button
              onClick={() => onAction(d.id, 'ignore')}
              className="text-zinc-500 hover:text-yellow-400 p-1"
              title="Ignorar"
            >
              <EyeOff size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function DivergenceTypePill({ type }: { type: DivergenceType }) {
  const m: Record<DivergenceType, string> = {
    cost_change_uninformed: 'Custo s/aviso',
    cost_at_oc_different: 'Custo na OC',
    stock_inconsistency: 'Estoque',
    shipment_delay: 'Atraso envio',
    no_shipment_confirmation: 'Sem confirm.',
    return_amount_mismatch: 'Devolução',
    duplicate_oc_item: 'Item duplicado',
    missing_partner_product: 'Sem mapeam.',
    price_below_cost: 'Preço<custo',
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(113,113,122,0.10)', color: '#a1a1aa', border: '1px solid #27272a' }}>
      {m[type]}
    </span>
  )
}

function DivergenceStatusPill({ status }: { status: Divergence['status'] }) {
  const c: Record<Divergence['status'], { bg: string; fg: string; label: string }> = {
    open:          { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', label: 'Aberta' },
    acknowledged:  { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', label: 'Reconhec.' },
    investigating: { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', label: 'Investig.' },
    resolved:      { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', label: 'Resolvida' },
    ignored:       { bg: 'rgba(113,113,122,0.10)', fg: '#71717a', label: 'Ignorada' },
  }
  const x = c[status]
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.label}
    </span>
  )
}

function severityColor(s: Severity): string {
  return s === 'critical' ? '#f87171' : s === 'high' ? '#fb923c' : s === 'medium' ? '#fcd34d' : '#a1a1aa'
}

function severityLabel(s: Severity): string {
  return s === 'critical' ? 'Crítica' : s === 'high' ? 'Alta' : s === 'medium' ? 'Média' : 'Baixa'
}

function filterLabel(s: string): string {
  return s === 'open_all' ? 'Em aberto'
    : s === 'open' ? 'Abertas'
    : s === 'acknowledged' ? 'Reconhecidas'
    : s === 'resolved' ? 'Resolvidas'
    : s === 'ignored' ? 'Ignoradas'
    : 'Todas'
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}
