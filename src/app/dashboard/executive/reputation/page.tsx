'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, ShieldCheck, AlertTriangle, AlertCircle, TrendingDown, TrendingUp,
  Minus, Award, Activity,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type Trend = 'improving' | 'stable' | 'degrading' | 'unknown'

interface ReputationCurrent {
  organization_id:         string
  seller_id:               number
  nickname:                string | null
  level_id:                string | null
  level_color:             string | null
  power_seller_status:     string | null
  claims_rate:             number | null
  cancellations_rate:      number | null
  delayed_handling_rate:   number | null
  claims_count:            number | null
  cancellations_count:     number | null
  delayed_handling_count:  number | null
  total_transactions:      number | null
  completed_transactions:  number | null
  cancelled_transactions:  number | null
  positive_ratings:        number | null
  neutral_ratings:         number | null
  negative_ratings:        number | null
  is_mercado_lider:        boolean
  is_at_risk:              boolean
  risk_reasons:            string[]
  trend:                   Trend
  last_synced_at:          string
}

interface HistoryPoint {
  snapshot_date:          string
  level_id:               string | null
  claims_rate:            number | null
  cancellations_rate:     number | null
  delayed_handling_rate:  number | null
  is_at_risk:             boolean
  risk_reasons:           string[]
}

// Limites Mercado Líder MLB
const LIMIT  = { claims: 0.01, cancellations: 0.005, late: 0.06 }
// Thresholds amber (alerta — perto do limite)
const AMBER  = { claims: 0.008, cancellations: 0.004, late: 0.05 }

const LEVEL_DETAILS: Record<string, { label: string; sub: string; bg: string; text: string; border: string }> = {
  '5_green':       { label: 'Mercado Líder Platinum', sub: 'O mais alto nível',     bg: 'rgba(34,197,94,0.12)',  text: '#22c55e', border: 'rgba(34,197,94,0.40)' },
  '4_light_green': { label: 'Mercado Líder Gold',     sub: 'Nível premium',         bg: 'rgba(132,204,22,0.12)', text: '#84cc16', border: 'rgba(132,204,22,0.40)' },
  '3_yellow':      { label: 'Mercado Líder',          sub: 'Reconhecido',           bg: 'rgba(234,179,8,0.12)',  text: '#eab308', border: 'rgba(234,179,8,0.40)' },
  '2_orange':      { label: 'Sem nível',              sub: 'Não é Mercado Líder',   bg: 'rgba(249,115,22,0.12)', text: '#f97316', border: 'rgba(249,115,22,0.40)' },
  '1_red':         { label: 'Reputação vermelha',     sub: 'Risco de bloqueio',     bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', border: 'rgba(239,68,68,0.40)' },
  '0_red':         { label: 'Sem reputação',          sub: 'Vendas insuficientes',  bg: 'rgba(113,113,122,0.12)', text: '#a1a1aa', border: 'rgba(113,113,122,0.30)' },
}

const RISK_LABEL: Record<string, string> = {
  claims_above_0_8:        'Reclamações acima de 0,8%',
  cancellations_above_0_4: 'Cancelamentos acima de 0,4%',
  late_handling_above_5:   'Atrasos de envio acima de 5%',
}

const pct  = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(2)}%`
const num  = (v: number | null | undefined) => v == null ? '—' : v.toLocaleString('pt-BR')
const dateBr = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60_000)
  if (m < 1)  return 'agora'
  if (m < 60) return `há ${m}m`
  const h = Math.round(m / 60)
  return h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)}d`
}

function metricStatus(value: number | null, amber: number, limit: number): 'good' | 'warning' | 'critical' | 'unknown' {
  if (value == null) return 'unknown'
  if (value >= limit) return 'critical'
  if (value >= amber) return 'warning'
  return 'good'
}

const STATUS_COLOR = {
  good:     { text: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.30)'  },
  warning:  { text: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)' },
  critical: { text: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.30)'  },
  unknown:  { text: '#71717a', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.10)' },
}

function TrendIndicator({ trend }: { trend: Trend }) {
  if (trend === 'improving')
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#22c55e' }}><TrendingUp size={12} /> melhorando</span>
  if (trend === 'degrading')
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#ef4444' }}><TrendingDown size={12} /> piorando</span>
  if (trend === 'stable')
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#a1a1aa' }}><Minus size={12} /> estável</span>
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#71717a' }}><Minus size={12} /> sem histórico</span>
}

function MetricCard({
  title, value, limit, amber, count, period, trend,
}: {
  title: string
  value: number | null
  limit: number
  amber: number
  count: number | null
  period: string
  trend: Trend
}) {
  const status = metricStatus(value, amber, limit)
  const palette = STATUS_COLOR[status]
  const limitPct = (limit * 100).toFixed(1) + '%'
  const usagePct = value != null ? Math.min(100, (value / limit) * 100) : 0

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border:     `1px solid ${palette.border}`,
      borderRadius: 12, padding: '18px 20px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 120, height: 120,
        background: `radial-gradient(circle at top right, ${palette.bg}, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 32, fontWeight: 600, color: palette.text, lineHeight: 1 }}>
          {pct(value)}
        </div>
        <div style={{ fontSize: 11, color: '#71717a' }}>
          limite ML {limitPct}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 12 }}>
        {num(count)} ocorrências · {period || 'últimos 60 dias'}
      </div>
      {/* Barra de progresso até o limite ML */}
      <div style={{
        height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2,
        marginBottom: 10, overflow: 'hidden',
      }}>
        <div style={{
          width: `${usagePct}%`, height: '100%',
          background: palette.text, transition: 'width 300ms',
        }} />
      </div>
      <div style={{ fontSize: 11 }}>
        <TrendIndicator trend={trend} />
      </div>
    </div>
  )
}

/** Mini sparkline SVG das últimas N taxas (claims OR cancellations OR late). */
function MiniSparkline({ values, color, height = 40, width = 200 }: {
  values: Array<number | null>
  color:  string
  height?: number
  width?:  number
}) {
  const valid = values.filter((v): v is number => v != null)
  if (valid.length < 2) {
    return <div style={{ height, width, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#52525b' }}>
      Histórico insuficiente
    </div>
  }
  const max = Math.max(...valid)
  const min = Math.min(...valid)
  const range = max - min || 1
  const stepX = width / Math.max(1, values.length - 1)
  const points = values
    .map((v, i) => v == null ? null : `${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height * 0.85 - height * 0.075).toFixed(1)}`)
    .filter((p): p is string => p != null)
    .join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function ReputationPage() {
  const supabase = useMemo(() => createClient(), [])
  const [snapshots, setSnapshots] = useState<ReputationCurrent[]>([])
  const [selected,  setSelected]  = useState<number | null>(null)
  const [history,   setHistory]   = useState<HistoryPoint[]>([])
  const [loading,   setLoading]   = useState(true)
  const [syncing,   setSyncing]   = useState(false)

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const loadCurrent = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/executive/reputation`, { headers })
      if (res.ok) {
        const body = await res.json() as { snapshots: ReputationCurrent[] }
        setSnapshots(body.snapshots ?? [])
        if (!selected && body.snapshots.length > 0) {
          setSelected(body.snapshots[0].seller_id)
        }
      }
    } catch (err) {
      console.warn('[reputation] load fail:', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [getHeaders, selected])

  const loadHistory = useCallback(async (sellerId: number) => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/executive/reputation/history?seller_id=${sellerId}&days=90`, { headers })
      if (res.ok) {
        const body = await res.json() as { history: HistoryPoint[] }
        setHistory(body.history ?? [])
      }
    } catch (err) {
      console.warn('[reputation] history fail:', (err as Error).message)
    }
  }, [getHeaders])

  const triggerSync = useCallback(async () => {
    setSyncing(true)
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/executive/reputation/sync`, { method: 'POST', headers })
      await loadCurrent()
      if (selected) await loadHistory(selected)
    } catch (err) {
      console.warn('[reputation] sync fail:', (err as Error).message)
    } finally {
      setSyncing(false)
    }
  }, [getHeaders, loadCurrent, loadHistory, selected])

  useEffect(() => { void loadCurrent() }, [loadCurrent])
  useEffect(() => {
    if (selected != null) void loadHistory(selected)
  }, [selected, loadHistory])

  const current = useMemo(
    () => snapshots.find(s => s.seller_id === selected) ?? null,
    [snapshots, selected],
  )

  const levelInfo = current?.level_id ? LEVEL_DETAILS[current.level_id] : null

  // Sparkline data (history vem DESC, inverter pra cronológico)
  const sparkHistory = useMemo(() => [...history].reverse(), [history])

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: '#fafafa' }}>
            Reputação Mercado Livre
          </h1>
          <div style={{ fontSize: 13, color: '#71717a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={12} />
            {current
              ? <>Atualizado {timeSince(current.last_synced_at)} · sync 1×/hora</>
              : <>Carregando…</>}
          </div>
        </div>
        <button
          onClick={triggerSync}
          disabled={syncing}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,229,255,0.10)',
            border: '1px solid rgba(0,229,255,0.30)',
            color: '#00E5FF', padding: '8px 14px', borderRadius: 8,
            fontSize: 13, cursor: syncing ? 'wait' : 'pointer',
            opacity: syncing ? 0.6 : 1, fontWeight: 500,
          }}
        >
          <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : undefined }} />
          {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
        </button>
      </div>

      {/* Seletor de conta (se >1) */}
      {snapshots.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {snapshots.map(s => (
            <button
              key={s.seller_id}
              onClick={() => setSelected(s.seller_id)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12,
                background: s.seller_id === selected ? 'rgba(0,229,255,0.10)' : 'rgba(255,255,255,0.02)',
                border:     s.seller_id === selected ? '1px solid rgba(0,229,255,0.30)' : '1px solid rgba(255,255,255,0.10)',
                color:      s.seller_id === selected ? '#00E5FF' : '#a1a1aa',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              {s.nickname ?? `Conta ${s.seller_id}`}
              {s.is_at_risk && <AlertTriangle size={11} style={{ marginLeft: 6, color: '#f59e0b' }} />}
            </button>
          ))}
        </div>
      )}

      {loading && !current && (
        <div style={{ textAlign: 'center', padding: 40, color: '#71717a' }}>Carregando…</div>
      )}

      {current && (
        <>
          {/* Risk alert */}
          {current.is_at_risk && (
            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.30)',
              borderRadius: 12, padding: '14px 18px',
              marginBottom: 20, display: 'flex', gap: 12,
            }}>
              <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b', marginBottom: 4 }}>
                  Atenção: métricas perto do limite Mercado Líder
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#e4e4e7' }}>
                  {current.risk_reasons.map(r => (
                    <li key={r}>{RISK_LABEL[r] ?? r}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Level badge gigante */}
          {levelInfo && (
            <div style={{
              background:   levelInfo.bg,
              border:       `1px solid ${levelInfo.border}`,
              borderRadius: 16, padding: '24px 28px',
              marginBottom: 24, display: 'flex', flexWrap: 'wrap',
              alignItems: 'center', justifyContent: 'space-between', gap: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <Award size={48} color={levelInfo.text} />
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#a1a1aa', marginBottom: 4 }}>
                    Nível atual
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: levelInfo.text, lineHeight: 1.1 }}>
                    {levelInfo.label}
                  </div>
                  <div style={{ fontSize: 13, color: '#a1a1aa', marginTop: 4 }}>
                    {levelInfo.sub}{current.power_seller_status ? ` · ${current.power_seller_status}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#71717a', marginBottom: 4 }}>
                  Transações (histórico)
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: '#e4e4e7' }}>
                  {num(current.completed_transactions)}
                </div>
                <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                  {num(current.total_transactions)} total · {num(current.cancelled_transactions)} canceladas
                </div>
              </div>
            </div>
          )}

          {/* Métricas — 3 cards */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            Métricas (últimos 60 dias)
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <MetricCard
              title="Reclamações (claims)"
              value={current.claims_rate}
              limit={LIMIT.claims}
              amber={AMBER.claims}
              count={current.claims_count}
              period="60 dias"
              trend={current.trend}
            />
            <MetricCard
              title="Cancelamentos"
              value={current.cancellations_rate}
              limit={LIMIT.cancellations}
              amber={AMBER.cancellations}
              count={current.cancellations_count}
              period="60 dias"
              trend={current.trend}
            />
            <MetricCard
              title="Atrasos de envio"
              value={current.delayed_handling_rate}
              limit={LIMIT.late}
              amber={AMBER.late}
              count={current.delayed_handling_count}
              period="60 dias"
              trend={current.trend}
            />
          </div>

          {/* Histórico — sparklines + tabela */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            Evolução ({history.length || 0} snapshots · até 90 dias)
          </h2>
          {history.length === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.015)',
              border: '1px dashed rgba(255,255,255,0.10)',
              borderRadius: 12, padding: 20, color: '#71717a', fontSize: 13,
            }}>
              Sem histórico ainda. A primeira sincronização foi {timeSince(current.last_synced_at)} — o gráfico
              ganha pontos conforme o cron horário rodar.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12, marginBottom: 28,
            }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa', marginBottom: 12 }}>
                  Reclamações
                </div>
                <MiniSparkline values={sparkHistory.map(h => h.claims_rate)} color="#ef4444" />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa', marginBottom: 12 }}>
                  Cancelamentos
                </div>
                <MiniSparkline values={sparkHistory.map(h => h.cancellations_rate)} color="#f59e0b" />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa', marginBottom: 12 }}>
                  Atrasos de envio
                </div>
                <MiniSparkline values={sparkHistory.map(h => h.delayed_handling_rate)} color="#eab308" />
              </div>
            </div>
          )}

          {/* Ratings (informativo) */}
          {(current.positive_ratings != null || current.negative_ratings != null) && (
            <>
              <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
                Avaliações dos compradores
              </h2>
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', gap: 32, flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Positivas</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: '#22c55e' }}>
                    {current.positive_ratings != null ? `${(current.positive_ratings * 100).toFixed(0)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Neutras</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: '#a1a1aa' }}>
                    {current.neutral_ratings != null ? `${(current.neutral_ratings * 100).toFixed(0)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Negativas</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: '#ef4444' }}>
                    {current.negative_ratings != null ? `${(current.negative_ratings * 100).toFixed(0)}%` : '—'}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
