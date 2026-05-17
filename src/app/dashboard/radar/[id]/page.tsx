'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ArrowLeft, Truck, Activity } from 'lucide-react'
import { api } from '../_components/api'
import {
  brl, pct, severityOf, eventLabel, relativeTime, reputationColor,
  logisticLabel, listingTypeLabel,
} from '../_components/shared'

interface Seller {
  nickname: string | null
  reputation_level: string | null
  power_seller_status: string | null
  is_official_store: boolean | null
}
interface Offer {
  id: string
  item_id: string
  price: number | null
  free_shipping: boolean | null
  logistic_type: string | null
  listing_type: string | null
  condition: string | null
  is_own: boolean
  is_lowest_price: boolean
  permalink: string | null
  seller: Seller | null
  visits_30d: number
  est_units_30d: number | null
  est_revenue_30d: number | null
}
interface Internal {
  id: string
  name: string | null
  cost_price: number | null
  my_price: number | null
}
interface Calibration {
  rate: number | null
  basis: 'categoria' | 'organização' | 'indisponível'
  confidence: 'ok' | 'low'
  own_visits: number
  own_units: number
  calc_date: string | null
}
interface ProductResp {
  product: { id: string; catalog_product_id: string; title: string | null; category_id: string | null; status: string }
  offers: Offer[]
  internal: Internal | null
  calibration: Calibration
}
interface SeriesResp {
  series: Array<{ item_id: string; is_own: boolean }>
  price_history: Array<Record<string, number | string>>
  visits: Array<{ date: string; visits: number }>
}
interface RadarEvent {
  id: string
  event_type: string
  severity: string
  detected_at: string
  previous_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
}

const CARD = { background: '#111114', border: '1px solid #1a1a1f' }
const COMP_COLORS = ['#f59e0b', '#22c55e', '#a78bfa', '#f87171']

export default function RadarDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ProductResp | null>(null)
  const [series, setSeries] = useState<SeriesResp | null>(null)
  const [events, setEvents] = useState<RadarEvent[]>([])

  useEffect(() => {
    if (!id) return
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [p, s, e] = await Promise.all([
          api<ProductResp>(`/radar/products/${id}`),
          api<SeriesResp>(`/radar/products/${id}/series`),
          api<RadarEvent[]>(`/radar/products/${id}/events`),
        ])
        if (!alive) return
        setData(p)
        setSeries(s)
        setEvents(e)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Falha ao carregar o produto')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id])

  const lineConfig = useMemo(() => {
    if (!series) return []
    let comp = 0
    return series.series.map(s => {
      const own = s.is_own
      const cfg = {
        key: s.item_id,
        label: own ? 'Vazzo' : `Conc. ${comp + 1}`,
        color: own ? '#00E5FF' : COMP_COLORS[comp % COMP_COLORS.length],
      }
      if (!own) comp++
      return cfg
    })
  }, [series])

  const offers = data?.offers ?? []
  const marketMin = offers.length ? offers[0].price : null
  const vazzoOffer = offers.find(o => o.is_own) ?? null

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      <Link href="/dashboard/radar"
        className="inline-flex items-center gap-1.5 text-xs mb-4 hover:text-zinc-300 transition-colors"
        style={{ color: '#71717a' }}>
        <ArrowLeft size={13} /> Voltar ao Radar
      </Link>

      {error && (
        <div className="rounded-lg p-3 text-sm mb-5" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>{error}</div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="h-9 w-2/3 rounded bg-zinc-800/50 animate-pulse" />
          <div className="h-64 rounded-xl bg-zinc-800/30 animate-pulse" />
        </div>
      )}

      {!loading && data && (
        <>
          <h1 className="text-xl font-bold mb-1" style={{ color: '#fafafa' }}>
            {data.product.title ?? data.product.catalog_product_id}
          </h1>
          <p className="text-xs mb-5" style={{ color: '#52525b' }}>
            {data.product.catalog_product_id}
            {data.product.category_id ? ` · ${data.product.category_id}` : ''}
          </p>

          {/* Margem */}
          {data.internal && data.internal.cost_price != null && (
            <div className="rounded-xl p-4 mb-5" style={CARD}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: '#fafafa' }}>
                Cruzamento de margem
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="Custo interno" value={brl(data.internal.cost_price)} />
                <Metric label="Menor preço do mercado" value={brl(marketMin)} />
                <Metric label="Margem no menor preço"
                  value={marginPct(marketMin, data.internal.cost_price)}
                  color={marginColor(marketMin, data.internal.cost_price)} />
                <Metric label="Margem no seu preço"
                  value={marginPct(vazzoOffer?.price ?? null, data.internal.cost_price)}
                  color={marginColor(vazzoOffer?.price ?? null, data.internal.cost_price)} />
              </div>
              <p className="text-[10px] mt-3" style={{ color: '#52525b' }}>
                Margem bruta estimada — (preço − custo) ÷ preço. Não inclui tarifa ML, frete nem imposto.
              </p>
            </div>
          )}

          {/* Ranking competitivo */}
          <section className="rounded-xl overflow-hidden mb-5" style={CARD}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #1a1a1f' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#fafafa' }}>
                Ranking competitivo <span style={{ color: '#52525b' }}>· {offers.length} ofertas</span>
              </h2>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 text-[10px] uppercase tracking-wide"
              style={{ borderBottom: '1px solid #1a1a1f', color: '#52525b' }}>
              <span className="flex-1">Vendedor</span>
              <span className="w-24 text-right">Preço</span>
              <span className="w-28 text-right">Demanda 30d</span>
              <span className="w-20 text-center">Frete</span>
              <span className="w-28 text-center">Logística</span>
              <span className="w-24 text-center">Tipo</span>
            </div>
            {offers.length === 0 && (
              <div className="p-8 text-center text-sm" style={{ color: '#a1a1aa' }}>
                Sem ofertas ativas neste produto de catálogo.
              </div>
            )}
            {offers.map(o => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-2.5"
                style={{
                  borderBottom: '1px solid #18181b',
                  background: o.is_own ? 'rgba(0,229,255,0.05)' : undefined,
                }}>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: reputationColor(o.seller?.reputation_level) }} />
                  <span className="text-xs font-medium truncate" style={{ color: '#fafafa' }}>
                    {o.is_own ? 'Vazzo (você)' : o.seller?.nickname ?? 'Concorrente'}
                  </span>
                  {o.seller?.is_official_store && (
                    <span className="text-[9px] rounded px-1 py-0.5 shrink-0"
                      style={{ background: 'rgba(0,229,255,0.12)', color: '#67e8f9' }}>oficial</span>
                  )}
                </div>
                <span className="w-24 text-right text-xs tabular-nums font-semibold"
                  style={{ color: o.is_lowest_price ? '#4ade80' : '#fafafa' }}>
                  {brl(o.price)}{o.is_lowest_price && ' ▾'}
                </span>
                <span className="w-28 text-right">
                  {o.est_units_30d == null ? (
                    <span className="text-[10px]" style={{ color: '#52525b' }}>—</span>
                  ) : (
                    <>
                      <span className="text-xs tabular-nums" style={{ color: '#a1a1aa' }}>
                        ~{o.est_units_30d.toLocaleString('pt-BR')} un
                      </span>
                      <span className="block text-[9px] tabular-nums" style={{ color: '#52525b' }}>
                        {o.visits_30d.toLocaleString('pt-BR')} visitas
                      </span>
                    </>
                  )}
                </span>
                <span className="w-20 flex justify-center">
                  {o.free_shipping
                    ? <Truck size={13} style={{ color: '#4ade80' }} />
                    : <span className="text-[10px]" style={{ color: '#52525b' }}>—</span>}
                </span>
                <span className="w-28 text-center text-[10px]" style={{ color: '#a1a1aa' }}>
                  {logisticLabel(o.logistic_type)}
                </span>
                <span className="w-24 text-center text-[10px]" style={{ color: '#71717a' }}>
                  {listingTypeLabel(o.listing_type)}
                </span>
              </div>
            ))}
          </section>

          {/* Transparência da conversão */}
          <div className="rounded-xl p-4 mb-5" style={CARD}>
            <h2 className="text-sm font-semibold mb-2" style={{ color: '#fafafa' }}>
              Como a demanda é estimada
            </h2>
            {data.calibration.rate == null ? (
              <p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
                Ainda não há conversão calibrada para a sua operação. A demanda estimada
                aparece assim que o Radar acumular vendas e visitas próprias suficientes
                (a coleta diária calibra isso automaticamente).
              </p>
            ) : (
              <>
                <p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
                  Demanda estimada = <span style={{ color: '#fafafa' }}>visitas coletadas do anúncio</span> ×{' '}
                  <span style={{ color: '#fafafa' }}>conversão de {pct(data.calibration.rate)}</span>.
                  A conversão vem das suas próprias vendas (unidades vendidas ÷ visitas, janela de 30 dias),
                  calibrada por {data.calibration.basis}.
                </p>
                <div className="flex flex-wrap gap-x-8 gap-y-3 mt-3">
                  <Metric label="Conversão usada" value={pct(data.calibration.rate)} />
                  <Metric label="Base de cálculo"
                    value={`${data.calibration.own_units.toLocaleString('pt-BR')} un · ${data.calibration.own_visits.toLocaleString('pt-BR')} visitas`} />
                  <Metric label="Confiança"
                    value={data.calibration.confidence === 'ok' ? 'Boa' : 'Baixa'}
                    color={data.calibration.confidence === 'ok' ? '#4ade80' : '#fbbf24'} />
                </div>
                {data.calibration.confidence === 'low' && (
                  <p className="text-[10px] mt-3" style={{ color: '#fbbf24' }}>
                    Confiança baixa — ainda há poucos dados próprios. Trate a demanda como ordem de grandeza, não número exato.
                  </p>
                )}
                <p className="text-[10px] mt-2" style={{ color: '#52525b' }}>
                  Estimativa — não é a venda real do concorrente, dado que o Mercado Livre não expõe.
                  {data.calibration.calc_date ? ` Conversão calibrada em ${data.calibration.calc_date}.` : ''}
                </p>
              </>
            )}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <ChartCard title="Histórico de preço">
              {series && series.price_history.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={series.price_history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={55}
                      tickFormatter={(v: number) => `R$${v}`} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: '#a1a1aa' }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} iconSize={9} />
                    {lineConfig.map(c => (
                      <Line key={c.key} type="monotone" dataKey={c.key} name={c.label}
                        stroke={c.color} strokeWidth={1.5} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : <ChartEmpty msg="Sem histórico de preço ainda" />}
            </ChartCard>

            <ChartCard title="Visitas">
              {series && series.visits.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={series.visits}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: '#a1a1aa' }} />
                    <Line type="monotone" dataKey="visits" name="Visitas"
                      stroke="#00E5FF" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <ChartEmpty msg="Sem dados de visita ainda" />}
            </ChartCard>
          </div>

          {/* Feed de eventos */}
          <section className="rounded-xl overflow-hidden" style={CARD}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #1a1a1f' }}>
              <Activity size={15} style={{ color: '#00E5FF' }} />
              <h2 className="text-sm font-semibold" style={{ color: '#fafafa' }}>Eventos deste produto</h2>
            </div>
            {events.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-sm" style={{ color: '#a1a1aa' }}>Nenhum evento registrado</p>
                <p className="text-xs mt-1" style={{ color: '#52525b' }}>
                  Eventos surgem quando a coleta diária detecta mudanças.
                </p>
              </div>
            )}
            {events.map(ev => {
              const sev = severityOf(ev.severity)
              return (
                <div key={ev.id} className="flex items-start gap-3 px-4 py-2.5"
                  style={{ borderBottom: '1px solid #18181b', borderLeft: `2px solid ${sev.rule}` }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: '#fafafa' }}>
                        {eventLabel(ev.event_type)}
                      </span>
                      <span className="text-[9px] rounded px-1.5 py-0.5"
                        style={{ background: sev.bg, color: sev.text }}>{sev.label}</span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: '#71717a' }}>
                      {describeEvent(ev)}
                    </p>
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: '#52525b' }}>
                    {relativeTime(ev.detected_at)}
                  </span>
                </div>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}

function marginPct(price: number | null, cost: number | null): string {
  if (price == null || cost == null || price <= 0) return '—'
  return pct((price - cost) / price)
}
function marginColor(price: number | null, cost: number | null): string {
  if (price == null || cost == null || price <= 0) return '#71717a'
  const m = (price - cost) / price
  return m < 0.1 ? '#f87171' : m < 0.25 ? '#fbbf24' : '#4ade80'
}

function describeEvent(ev: RadarEvent): string {
  const nv = ev.new_value ?? {}
  const pv = ev.previous_value ?? {}
  if (ev.event_type === 'queda_preco' || ev.event_type === 'alta_preco') {
    return `${brl(pv.price as number)} → ${brl(nv.price as number)}`
  }
  if (ev.event_type === 'mudanca_menor_preco') {
    return nv.leader === 'vazzo' ? 'Vazzo voltou à ponta de preço' : 'Vazzo perdeu a ponta de preço'
  }
  if (ev.event_type === 'novo_concorrente') return 'Nova oferta no conjunto competitivo'
  if (ev.event_type === 'saiu_concorrente') return 'Oferta saiu do conjunto'
  if (ev.event_type === 'mudanca_frete') return 'Frete ou logística mudou'
  return ''
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] mb-1" style={{ color: '#71717a' }}>{label}</p>
      <p className="text-base font-semibold tabular-nums" style={{ color: color ?? '#fafafa' }}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={CARD}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: '#fafafa' }}>{title}</h2>
      {children}
    </div>
  )
}

function ChartEmpty({ msg }: { msg: string }) {
  return (
    <div className="h-[240px] flex items-center justify-center">
      <p className="text-xs" style={{ color: '#52525b' }}>{msg}</p>
    </div>
  )
}
