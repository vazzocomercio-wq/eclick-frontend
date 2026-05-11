'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, Truck, AlertTriangle, Package, Zap, Clock,
  Activity, ArrowUpRight, AlertCircle, CheckCircle2,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface LogisticsSummary {
  seller_id:                          number
  nickname:                           string | null
  shipments_to_dispatch_today:        number
  shipments_dispatched_today:         number
  open_delays_count:                  number
  open_delays_handling:               number
  open_delays_sla:                    number
  open_delays_transit:                number
  flex_eligible_count:                number
  flex_scan_coverage_pct:             number | null
  last_synced_at:                     string
}

interface OpenDelay {
  id:               string
  seller_id:        number
  ml_shipment_id:   string
  ml_order_id:      string | null
  delay_type:       'handling_delayed' | 'sla_delayed' | 'transit_delayed'
  delay_days:       number | null
  expected_date:    string | null
  detected_at:      string
}

const DELAY_LABELS: Record<string, { label: string; color: string; bg: string; border: string; description: string }> = {
  handling_delayed: {
    label: 'Atraso na separação',
    description: 'Você atrasou pra postar (afeta delayed_handling_time)',
    color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.30)',
  },
  sla_delayed: {
    label: 'Atraso no SLA total',
    description: 'Prazo prometido ao comprador estourou',
    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)',
  },
  transit_delayed: {
    label: 'Atraso em trânsito',
    description: 'Transportadora segurou — depende da Mercado Envios',
    color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.30)',
  },
}

const num = (v: number) => v.toLocaleString('pt-BR')

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60_000)
  if (m < 1)  return 'agora'
  if (m < 60) return `há ${m}m`
  const h = Math.round(m / 60)
  return h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)}d`
}

function dateBr(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function LogisticsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [summaries, setSummaries] = useState<LogisticsSummary[]>([])
  const [delays,    setDelays]    = useState<OpenDelay[]>([])
  const [selected,  setSelected]  = useState<number | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [scanning,  setScanning]  = useState(false)

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const [sumRes, delRes] = await Promise.all([
        fetch(`${BACKEND}/executive/logistics`, { headers }),
        fetch(`${BACKEND}/executive/logistics/delays?limit=50`, { headers }),
      ])
      if (sumRes.ok) {
        const body = await sumRes.json() as { summaries: LogisticsSummary[] }
        setSummaries(body.summaries ?? [])
        if (!selected && body.summaries.length > 0) setSelected(body.summaries[0].seller_id)
      }
      if (delRes.ok) {
        const body = await delRes.json() as { delays: OpenDelay[] }
        setDelays(body.delays ?? [])
      }
    } catch (err) {
      console.warn('[logistics] load fail:', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [getHeaders, selected])

  const triggerScan = useCallback(async () => {
    if (!selected) return
    setScanning(true)
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/executive/logistics/scan?seller_id=${selected}`, {
        method: 'POST', headers,
      })
      await load()
    } catch (err) {
      console.warn('[logistics] scan fail:', (err as Error).message)
    } finally {
      setScanning(false)
    }
  }, [getHeaders, load, selected])

  useEffect(() => { void load() }, [load])

  const current = useMemo(
    () => summaries.find(s => s.seller_id === selected) ?? null,
    [summaries, selected],
  )

  const delaysOfCurrent = useMemo(
    () => selected ? delays.filter(d => d.seller_id === selected) : delays,
    [delays, selected],
  )

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, color: '#fafafa' }}>
            Logística
          </h1>
          <div style={{ fontSize: 13, color: '#71717a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={12} />
            {current
              ? <>Atualizado {timeSince(current.last_synced_at)} · scan diário 03:30 BRT</>
              : <>Carregando…</>}
          </div>
        </div>
        <button
          onClick={triggerScan}
          disabled={scanning || !selected}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,229,255,0.10)',
            border: '1px solid rgba(0,229,255,0.30)',
            color: '#00E5FF', padding: '8px 14px', borderRadius: 8,
            fontSize: 13, cursor: scanning ? 'wait' : 'pointer',
            opacity: scanning || !selected ? 0.6 : 1, fontWeight: 500,
          }}
        >
          <RefreshCw size={14} style={{ animation: scanning ? 'spin 1s linear infinite' : undefined }} />
          {scanning ? 'Escaneando…' : 'Escanear agora'}
        </button>
      </div>

      {summaries.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {summaries.map(s => (
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
              {s.open_delays_count > 0 && <AlertTriangle size={11} style={{ marginLeft: 6, color: '#f59e0b' }} />}
            </button>
          ))}
        </div>
      )}

      {loading && !current && (
        <div style={{ textAlign: 'center', padding: 40, color: '#71717a' }}>Carregando…</div>
      )}

      {current && (
        <>
          {/* Linha 1: Operação do dia */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            Operação de hoje
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <div style={{
              background: current.shipments_to_dispatch_today > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)',
              border:     current.shipments_to_dispatch_today > 0 ? '1px solid rgba(245,158,11,0.30)' : '1px solid rgba(34,197,94,0.30)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Package size={14} color={current.shipments_to_dispatch_today > 0 ? '#f59e0b' : '#22c55e'} />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
                  Pra despachar agora
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: current.shipments_to_dispatch_today > 0 ? '#f59e0b' : '#22c55e' }}>
                {num(current.shipments_to_dispatch_today)}
              </div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                envios prontos para envio
              </div>
            </div>

            <div style={{
              background: 'rgba(0,229,255,0.04)',
              border: '1px solid rgba(0,229,255,0.20)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ArrowUpRight size={14} color="#00E5FF" />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
                  Despachados hoje
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: '#00E5FF' }}>
                {num(current.shipments_dispatched_today)}
              </div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                desde 00:00
              </div>
            </div>

            <div style={{
              background: current.open_delays_count > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
              border:     current.open_delays_count > 0 ? '1px solid rgba(239,68,68,0.30)' : '1px solid rgba(34,197,94,0.30)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Clock size={14} color={current.open_delays_count > 0 ? '#ef4444' : '#22c55e'} />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
                  Atrasos abertos
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: current.open_delays_count > 0 ? '#ef4444' : '#22c55e' }}>
                {num(current.open_delays_count)}
              </div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                {current.open_delays_handling}h · {current.open_delays_sla}s · {current.open_delays_transit}t
              </div>
            </div>

            <div style={{
              background: current.flex_eligible_count > 0 ? 'rgba(132,204,22,0.06)' : 'rgba(255,255,255,0.02)',
              border:     current.flex_eligible_count > 0 ? '1px solid rgba(132,204,22,0.30)' : '1px solid rgba(255,255,255,0.10)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Zap size={14} color={current.flex_eligible_count > 0 ? '#84cc16' : '#71717a'} />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
                  Flex elegível
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: current.flex_eligible_count > 0 ? '#84cc16' : '#71717a' }}>
                {num(current.flex_eligible_count)}
              </div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                cobertura {current.flex_scan_coverage_pct ?? 0}% dos itens
              </div>
            </div>
          </div>

          {/* Breakdown de atrasos por tipo */}
          {current.open_delays_count > 0 && (
            <>
              <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
                Atrasos por categoria
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 12, marginBottom: 28,
              }}>
                {(['handling_delayed', 'sla_delayed', 'transit_delayed'] as const).map(t => {
                  const meta = DELAY_LABELS[t]
                  const count = t === 'handling_delayed' ? current.open_delays_handling
                              : t === 'sla_delayed'      ? current.open_delays_sla
                              : current.open_delays_transit
                  return (
                    <div key={t} style={{
                      background: count > 0 ? meta.bg : 'rgba(255,255,255,0.015)',
                      border:     count > 0 ? `1px solid ${meta.border}` : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12, padding: '16px 18px',
                    }}>
                      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa', marginBottom: 8 }}>
                        {meta.label}
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 600, color: count > 0 ? meta.color : '#71717a' }}>
                        {num(count)}
                      </div>
                      <div style={{ fontSize: 12, color: '#71717a', marginTop: 6, lineHeight: 1.4 }}>
                        {meta.description}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Lista de atrasos abertos */}
          {delaysOfCurrent.length > 0 ? (
            <>
              <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
                Últimos atrasos detectados ({delaysOfCurrent.length})
              </h2>
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, overflow: 'hidden', marginBottom: 28,
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ textAlign: 'left',  padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>SHIPMENT</th>
                      <th style={{ textAlign: 'left',  padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>PEDIDO</th>
                      <th style={{ textAlign: 'left',  padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>TIPO</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>DIAS</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>PREVISTO</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#71717a', fontWeight: 500, fontSize: 11 }}>DETECTADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delaysOfCurrent.map(d => {
                      const meta = DELAY_LABELS[d.delay_type]
                      return (
                        <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px 16px', color: '#e4e4e7', fontFamily: 'monospace', fontSize: 12 }}>
                            {d.ml_shipment_id}
                          </td>
                          <td style={{ padding: '10px 16px', color: '#a1a1aa', fontFamily: 'monospace', fontSize: 12 }}>
                            {d.ml_order_id ?? '—'}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 99,
                              background: meta?.bg ?? 'rgba(255,255,255,0.05)',
                              border:     `1px solid ${meta?.border ?? 'rgba(255,255,255,0.10)'}`,
                              color:      meta?.color ?? '#a1a1aa',
                            }}>
                              {meta?.label ?? d.delay_type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#e4e4e7' }}>
                            {d.delay_days ?? '—'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#a1a1aa' }}>
                            {dateBr(d.expected_date)}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#71717a', fontSize: 11 }}>
                            {timeSince(d.detected_at)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : current.open_delays_count === 0 && (
            <div style={{
              background: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.30)',
              borderRadius: 12, padding: '14px 18px', marginBottom: 28,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <CheckCircle2 size={20} color="#22c55e" />
              <div style={{ color: '#22c55e', fontSize: 14 }}>
                Sem atrasos abertos pra essa conta. Bom trabalho.
              </div>
            </div>
          )}

          {/* Nota sobre Flex */}
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#a1a1aa', marginBottom: 12 }}>
            Mercado Envios Flex
          </h2>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 28,
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20,
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Items elegíveis</div>
              <div style={{ fontSize: 24, fontWeight: 500, color: '#84cc16' }}>
                {num(current.flex_eligible_count)}
                <span style={{ fontSize: 13, color: '#71717a', fontWeight: 400, marginLeft: 8 }}>
                  de {current.flex_scan_coverage_pct ?? 0}% verificado
                </span>
              </div>
            </div>
            <div style={{ flex: 2, minWidth: 280, fontSize: 12, color: '#a1a1aa', lineHeight: 1.5 }}>
              <AlertCircle size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              <strong style={{ color: '#e4e4e7' }}>Limitação atual:</strong> a API ML retorna apenas
              <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3, margin: '0 4px' }}>
                {`{has_flex}`}
              </code>
              — não distingue &ldquo;elegível mas inativo&rdquo; vs &ldquo;ativo entregando agora&rdquo;.
              Pra ativação real, use o painel ML.
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
