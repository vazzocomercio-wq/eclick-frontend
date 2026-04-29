'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Loader2, RefreshCw } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── types ─────────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'em_andamento' | 'bloqueados' | 'concluidos' | 'falhas'

interface Funnel {
  journeys_created:            number
  customers_enriched:          number
  journeys_active:             number
  journeys_blocked_consent:    number
  journeys_blocked_no_contact: number
  messages_sent:               number
  messages_failed:             number
}

interface TimelineDay {
  date:             string
  messages_sent:    number
  messages_failed:  number
  journeys_created: number
}

interface Journey {
  ocj_id:                string
  state:                 string
  customer_name:         string | null
  product_title:         string | null
  current_step:          number | null
  total_steps:           number | null
  last_message_sent_at:  string | null
  created_at:            string
  // Campos extra (vão pro detalhe expandido) — endpoint atual não traz mas
  // type permite extensão futura sem quebrar.
  journey_name?:         string | null
  stopped_reason?:       string | null
  last_error?:           string | null
}

const STATE_META: Record<string, { color: string; label: string }> = {
  pending:            { color: '#fbbf24', label: 'Pendente' },
  active:             { color: '#22c55e', label: 'Em andamento' },
  blocked_consent:    { color: '#f97316', label: 'Sem consent.' },
  blocked_no_contact: { color: '#ef4444', label: 'Sem contato' },
  completed:          { color: '#00E5FF', label: 'Concluído' },
  failed:             { color: '#dc2626', label: 'Falha' },
  cancelled:          { color: '#6b7280', label: 'Cancelado' },
  paused:             { color: '#a1a1aa', label: 'Pausado' },
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',          label: 'Todos' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'bloqueados',   label: 'Bloqueados' },
  { key: 'concluidos',   label: 'Concluídos' },
  { key: 'falhas',       label: 'Falhas' },
]

interface Props {
  onToast?: (msg: string, type?: 'success' | 'error') => void
}

// ── helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000)        return 'agora'
  if (d < 3_600_000)     return `há ${Math.floor(d / 60_000)}min`
  if (d < 86_400_000)    return `há ${Math.floor(d / 3_600_000)}h`
  if (d < 86_400_000 * 7) return `há ${Math.floor(d / 86_400_000)}d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return '—'
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

// ── component ─────────────────────────────────────────────────────────────────

export default function PedidosEmCursoTab({ onToast }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [funnel,    setFunnel]    = useState<Funnel | null>(null)
  const [timeline,  setTimeline]  = useState<TimelineDay[]>([])
  const [journeys,  setJourneys]  = useState<Journey[]>([])
  const [filter,    setFilter]    = useState<FilterKey>('all')
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const filterRef = useRef<FilterKey>('all')
  filterRef.current = filter

  const headers = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      Authorization:  `Bearer ${session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [supabase])

  // Constrói URL pra journeys conforme o filtro ativo. Bloqueados não
  // tem endpoint próprio — chamamos 2 vezes (consent + no_contact) e
  // mergimos. Demais filtros mapeiam direto pro state da OCJ.
  const fetchJourneys = useCallback(async (f: FilterKey, h: HeadersInit): Promise<Journey[]> => {
    const base = `${BACKEND}/communication/journeys`
    if (f === 'bloqueados') {
      const [a, b] = await Promise.all([
        fetch(`${base}?state=blocked_consent&limit=50`,    { headers: h }),
        fetch(`${base}?state=blocked_no_contact&limit=50`, { headers: h }),
      ])
      const aj = a.ok ? (await a.json() as Journey[]) : []
      const bj = b.ok ? (await b.json() as Journey[]) : []
      return [...aj, ...bj].sort((x, y) => y.created_at.localeCompare(x.created_at))
    }
    const stateMap: Partial<Record<FilterKey, string>> = {
      em_andamento: 'active',
      concluidos:   'completed',
      falhas:       'failed',
    }
    const state = stateMap[f]
    const url   = state ? `${base}?state=${state}&limit=50` : `${base}?limit=50`
    const res   = await fetch(url, { headers: h })
    if (!res.ok) return []
    return await res.json() as Journey[]
  }, [])

  const loadAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true)
    try {
      const h = await headers()
      const [funnelRes, timelineRes, journeysRes] = await Promise.all([
        fetch(`${BACKEND}/communication/dashboard/funnel`,             { headers: h }),
        fetch(`${BACKEND}/communication/dashboard/timeline?days=30`,   { headers: h }),
        fetchJourneys(filterRef.current, h),
      ])
      if (funnelRes.ok)   setFunnel(await funnelRes.json() as Funnel)
      if (timelineRes.ok) setTimeline(await timelineRes.json() as TimelineDay[])
      setJourneys(journeysRes)
    } catch {
      if (!silent) onToast?.('Erro ao carregar dashboard', 'error')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [headers, fetchJourneys, onToast])

  // onMount + filter change
  useEffect(() => { void loadAll() }, [loadAll, filter])

  // Auto-refresh @30s pausa quando aba escondida
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) void loadAll(true)
    }, 30_000)
    return () => clearInterval(id)
  }, [loadAll])

  // ── timeline geometry ───────────────────────────────────────────────────────
  const timelineGeo = useMemo(() => {
    const W = 300, H = 120, padTop = 8
    const days = timeline.length || 30
    const barW = Math.max((W / days) - 1, 1)
    const maxV = Math.max(1, ...timeline.map(d => d.messages_sent + d.messages_failed))
    const scale = (H - padTop) / maxV
    const bars = timeline.map((d, i) => {
      const x      = (i / days) * W
      const sentH  = d.messages_sent   * scale
      const failH  = d.messages_failed * scale
      return {
        x, w: barW,
        sentY: H - sentH, sentH,
        failY: H - sentH - failH, failH,
        date: d.date,
        sent: d.messages_sent, fail: d.messages_failed,
      }
    })
    return { W, H, bars, maxV, hasData: maxV > 1 || timeline.some(d => d.messages_sent + d.messages_failed > 0) }
  }, [timeline])

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* SEÇÃO 1: Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil */}
        <div className="rounded-xl p-4"
          style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <h3 className="text-zinc-200 text-sm font-semibold mb-3">Funil últimos 30 dias</h3>
          {!funnel ? (
            <p className="text-zinc-600 text-[12px]"><Loader2 size={11} className="inline animate-spin mr-1.5" />Carregando…</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Kpi label="Jornadas criadas"       value={funnel.journeys_created}            color="#60a5fa" />
              <Kpi label="Clientes enriquecidos"  value={funnel.customers_enriched}          color="#60a5fa" />
              <Kpi label="Em andamento"           value={funnel.journeys_active}             color="#22c55e" />
              <Kpi label="Bloqueados (consent)"   value={funnel.journeys_blocked_consent}    color="#f97316" />
              <Kpi label="Sem contato"            value={funnel.journeys_blocked_no_contact} color="#ef4444" />
              <Kpi label="Mensagens enviadas"     value={funnel.messages_sent}               color="#00E5FF" />
              <div className="col-span-2">
                <Kpi label="Falhas" value={funnel.messages_failed} color="#dc2626" />
              </div>
            </div>
          )}
        </div>

        {/* Gráfico timeline */}
        <div className="rounded-xl p-4"
          style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <h3 className="text-zinc-200 text-sm font-semibold mb-3">Mensagens últimos 30 dias</h3>
          {!timelineGeo.hasData ? (
            <p className="text-zinc-600 text-[12px] text-center py-12">Nenhuma atividade nos últimos 30 dias</p>
          ) : (
            <>
              <svg viewBox={`0 0 ${timelineGeo.W} ${timelineGeo.H}`} preserveAspectRatio="none"
                className="w-full" style={{ height: 160 }}>
                {timelineGeo.bars.map((b, i) => (
                  <g key={i}>
                    {b.sentH > 0 && (
                      <rect x={b.x} y={b.sentY} width={b.w} height={b.sentH} fill="#22c55e">
                        <title>{`${b.date}\n✓ Enviadas: ${b.sent}\n✗ Falhas: ${b.fail}`}</title>
                      </rect>
                    )}
                    {b.failH > 0 && (
                      <rect x={b.x} y={b.failY} width={b.w} height={b.failH} fill="#dc2626">
                        <title>{`${b.date}\n✓ Enviadas: ${b.sent}\n✗ Falhas: ${b.fail}`}</title>
                      </rect>
                    )}
                  </g>
                ))}
              </svg>
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1 px-0.5">
                <span>dia 1</span>
                <span>10</span>
                <span>20</span>
                <span>30</span>
              </div>
              <div className="flex items-center justify-end gap-3 text-[10px] text-zinc-500 mt-2">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 inline-block rounded-sm" style={{ background: '#22c55e' }} /> enviadas
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 inline-block rounded-sm" style={{ background: '#dc2626' }} /> falhas
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SEÇÃO 2: Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <button key={f.key} onClick={() => { setFilter(f.key); setExpanded(null) }}
              className="px-3 py-1.5 text-[12px] font-medium rounded-full transition-colors"
              style={{
                background: active ? 'rgba(0,229,255,0.08)' : '#0c0c10',
                color:      active ? '#00E5FF' : '#a1a1aa',
                border:     `1px solid ${active ? 'rgba(0,229,255,0.40)' : '#1a1a1f'}`,
              }}>
              {f.label}
            </button>
          )
        })}
        {refreshing && (
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-zinc-500">
            <RefreshCw size={10} className="animate-spin" /> atualizando…
          </span>
        )}
      </div>

      {/* SEÇÃO 3: Tabela */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-600"
                style={{ borderBottom: '1px solid #1a1a1f' }}>
                <th className="px-3 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">Produto</th>
                <th className="px-3 py-2 font-semibold w-28">Estado</th>
                <th className="px-3 py-2 font-semibold w-28">Progresso</th>
                <th className="px-3 py-2 font-semibold w-20">Última msg</th>
                <th className="px-3 py-2 font-semibold w-20">Criado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-zinc-600">
                    <Loader2 size={14} className="inline animate-spin mr-1.5" />Carregando pedidos…
                  </td>
                </tr>
              ) : journeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-zinc-600">
                    Nenhum pedido encontrado{filter !== 'all' ? ' nesse filtro' : ''}.
                  </td>
                </tr>
              ) : journeys.map(j => {
                const meta = STATE_META[j.state] ?? { color: '#a1a1aa', label: j.state }
                const isOpen = expanded === j.ocj_id
                const total  = j.total_steps ?? 0
                const cur    = j.current_step ?? 0
                const pct    = total > 0 ? Math.min(100, (cur / total) * 100) : 0
                return (
                  <Fragment key={j.ocj_id}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : j.ocj_id)}
                      className="cursor-pointer transition-colors hover:bg-[#161618]"
                      style={isOpen ? { borderLeft: '2px solid #00E5FF', background: 'rgba(0,229,255,0.04)' } : { borderLeft: '2px solid transparent' }}>
                      <td className="px-3 py-2.5 text-[12px] text-zinc-200 font-medium">
                        {j.customer_name ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-zinc-300" title={j.product_title ?? ''}>
                        {truncate(j.product_title, 40)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-semibold inline-flex items-center px-2 py-0.5 rounded"
                          style={{ color: meta.color, background: `${meta.color}1a`, border: `1px solid ${meta.color}40` }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {total > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-400 tabular-nums w-8">{cur}/{total}</span>
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#1f1f24' }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                            </div>
                          </div>
                        ) : <span className="text-[10px] text-zinc-700">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-zinc-500 tabular-nums">
                        {relTime(j.last_message_sent_at)}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-zinc-500 tabular-nums">
                        {relTime(j.created_at)}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ background: '#070709' }}>
                        <td colSpan={6} className="px-4 py-3" style={{ borderLeft: '2px solid #00E5FF' }}>
                          <div className="space-y-1.5 text-[11px]">
                            {j.journey_name && (
                              <p className="text-zinc-400">
                                <span className="text-zinc-600 mr-1">Jornada:</span>
                                <span className="text-zinc-200">{j.journey_name}</span>
                              </p>
                            )}
                            {j.stopped_reason && (
                              <p style={{ color: '#f97316' }}>
                                <span className="text-zinc-600 mr-1">Parada:</span>
                                {j.stopped_reason}
                              </p>
                            )}
                            {j.last_error && (
                              <p style={{ color: '#dc2626' }}>
                                <span className="text-zinc-600 mr-1">Erro:</span>
                                {j.last_error}
                              </p>
                            )}
                            <p className="text-zinc-600 italic pt-1.5"
                              style={{ borderTop: '1px solid #1a1a1f' }}>
                              Detalhes de mensagens em breve.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── KPI ───────────────────────────────────────────────────────────────────────

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg p-2.5 flex flex-col gap-0.5"
      style={{ background: '#070709', border: '1px solid #1a1a1f' }}>
      <span className="text-base font-bold tabular-nums" style={{ color }}>
        {value.toLocaleString('pt-BR')}
      </span>
      <span className="text-[9px] uppercase tracking-widest text-zinc-600 leading-tight">
        {label}
      </span>
    </div>
  )
}
