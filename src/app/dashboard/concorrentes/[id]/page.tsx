'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { Competitor, PriceHistory, PM, priceDiff, brl, relativeTime } from '../types'

const SCRAPER = process.env.NEXT_PUBLIC_SCRAPER_URL ?? 'https://price-scraper-production-2e7c.up.railway.app'

// ── custom tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2.5 text-sm shadow-2xl"
      style={{ background: '#18181b', border: '1px solid #2e2e33' }}>
      <p className="text-zinc-400 text-[11px] mb-1">{label}</p>
      <p className="text-white font-bold">{brl(payload[0].value)}</p>
    </div>
  )
}

export default function CompetitorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [competitor, setCompetitor] = useState<Competitor | null>(null)
  const [history, setHistory] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [{ data: comp }, { data: hist }] = await Promise.all([
      supabase
        .from('competitors')
        .select('*, products(name)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('price_history')
        .select('*')
        .eq('competitor_id', id)
        .order('checked_at', { ascending: true })
        .limit(90),
    ])

    if (comp) {
      setCompetitor({
        ...comp,
        product_name: comp.products?.name ?? '—',
      })
    }
    setHistory(hist ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function verifyNow() {
    if (!competitor) return
    setVerifying(true)
    try {
      const res = await fetch(`${SCRAPER}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: competitor.url }),
      })
      if (!res.ok) throw new Error()
      const { price, title, seller } = await res.json()
      if (!price) throw new Error('Preço não encontrado.')

      const now = new Date().toISOString()
      const supabase = createClient()
      await Promise.all([
        supabase.from('competitors').update({
          current_price: price,
          title: title ?? competitor.title,
          seller: seller ?? competitor.seller,
          last_checked: now,
        }).eq('id', id),
        supabase.from('price_history').insert({ competitor_id: id, price }),
      ])

      setCompetitor(prev => prev ? { ...prev, current_price: price, last_checked: now } : prev)
      setHistory(prev => [...prev, { id: crypto.randomUUID(), competitor_id: id, price, checked_at: now }])
      showToast(`Preço atualizado: ${brl(price)}`)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Falha ao verificar preço.', 'error')
    } finally {
      setVerifying(false)
    }
  }

  // ── chart data ─────────────────────────────────────────────────────────────

  const chartData = history.map(h => ({
    date: new Date(h.checked_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    price: Number(h.price),
  }))

  // Collapse same-day entries to last value
  const dedupedChart = chartData.reduce<typeof chartData>((acc, curr) => {
    const last = acc[acc.length - 1]
    if (last?.date === curr.date) { acc[acc.length - 1] = curr; return acc }
    acc.push(curr)
    return acc
  }, [])

  const minPrice = history.length ? Math.min(...history.map(h => Number(h.price))) : 0
  const maxPrice = history.length ? Math.max(...history.map(h => Number(h.price))) : 0
  const diff = priceDiff(competitor?.current_price ?? null, competitor?.my_price ?? null)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#09090b' }}>
        <svg className="w-7 h-7 animate-spin" style={{ color: '#00E5FF' }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!competitor) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ background: '#09090b' }}>
        <p className="text-zinc-400">Concorrente não encontrado.</p>
        <button onClick={() => router.push('/dashboard/concorrentes')}
          className="text-sm font-medium" style={{ color: '#00E5FF' }}>
          Voltar para Monitor de Preços
        </button>
      </div>
    )
  }

  const pm = PM[competitor.platform]

  return (
    <>
      <div className="flex flex-col h-full" style={{ background: '#09090b' }}>

        {/* Top bar */}
        <div className="shrink-0 px-6 pt-5 pb-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/dashboard/concorrentes')}
                className="text-zinc-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  {pm && (
                    <span className="text-[9px] font-black w-5 h-5 rounded flex items-center justify-center"
                      style={{ background: pm.bg, color: pm.fg }}>
                      {competitor.platform.toUpperCase().slice(0, 2)}
                    </span>
                  )}
                  <h2 className="text-white text-base font-semibold leading-tight truncate max-w-[400px]">
                    {competitor.title ?? competitor.url}
                  </h2>
                </div>
                <p className="text-zinc-500 text-[12px] mt-0.5">
                  Produto: {competitor.product_name} · Última verificação: {relativeTime(competitor.last_checked)}
                </p>
              </div>
            </div>

            <button
              onClick={verifyNow}
              disabled={verifying}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: '#00E5FF', color: '#000' }}>
              {verifying
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Verificando…</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Verificar agora</>
              }
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

            {/* Info cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Preço atual',   value: brl(competitor.current_price),  accent: '#fff' },
                { label: 'Nosso preço',   value: brl(competitor.my_price),        accent: '#a1a1aa' },
                { label: 'Diferença',
                  value: diff != null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '—',
                  accent: diff == null ? '#71717a' : diff < 0 ? '#f87171' : '#34d399',
                },
                { label: 'Vendedor',      value: competitor.seller ?? '—',       accent: '#a1a1aa' },
              ].map(({ label, value, accent }) => (
                <div key={label} className="rounded-2xl px-5 py-4"
                  style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                  <p className="text-zinc-500 text-xs mb-1">{label}</p>
                  <p className="font-bold text-sm leading-snug" style={{ color: accent }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="rounded-2xl px-6 py-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex items-center justify-between mb-5">
                <p className="text-white text-sm font-semibold">Histórico de preços</p>
                <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                  <span>Mín: <span className="text-white font-medium">{brl(minPrice)}</span></span>
                  <span>Máx: <span className="text-white font-medium">{brl(maxPrice)}</span></span>
                  <span>{history.length} registro{history.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {dedupedChart.length < 2 ? (
                <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
                  Dados insuficientes para exibir o gráfico. Verifique o preço algumas vezes para acumular histórico.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dedupedChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#52525b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={v => `R$${(v as number).toFixed(0)}`}
                      tick={{ fontSize: 11, fill: '#52525b' }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {competitor.my_price != null && (
                      <ReferenceLine
                        y={competitor.my_price}
                        stroke="#00E5FF"
                        strokeDasharray="4 4"
                        strokeOpacity={0.6}
                        label={{ value: 'Meu preço', fill: '#00E5FF', fontSize: 10, position: 'insideTopRight' }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#f59e0b' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* Legend */}
              <div className="flex items-center gap-5 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-0.5 rounded-full" style={{ background: '#f59e0b' }} />
                  <span className="text-[11px] text-zinc-500">Preço do concorrente</span>
                </div>
                {competitor.my_price != null && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 border-t border-dashed" style={{ borderColor: '#00E5FF', opacity: 0.6 }} />
                    <span className="text-[11px] text-zinc-500">Meu preço</span>
                  </div>
                )}
              </div>
            </div>

            {/* History table */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1e1e24' }}>
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid #1e1e24', background: '#0c0c0f' }}>
                <p className="text-white text-sm font-semibold">Histórico completo</p>
                <p className="text-zinc-500 text-xs">{history.length} registros</p>
              </div>
              {history.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-zinc-600 text-sm">
                  Nenhum histórico registrado ainda.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: '#0c0c0f', borderBottom: '1px solid #1e1e24' }}>
                      {['DATA / HORA', 'PREÇO', 'VARIAÇÃO'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                          style={{ color: '#52525b' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((h, idx, arr) => {
                      const prev = arr[idx + 1]
                      const change = prev ? ((Number(h.price) - Number(prev.price)) / Number(prev.price)) * 100 : null
                      return (
                        <tr key={h.id} style={{ borderBottom: '1px solid #1e1e24' }}>
                          <td className="px-5 py-3 text-zinc-400 text-[13px]">
                            {new Date(h.checked_at).toLocaleString('pt-BR', {
                              dateStyle: 'short', timeStyle: 'short'
                            })}
                          </td>
                          <td className="px-5 py-3 text-white font-bold">{brl(Number(h.price))}</td>
                          <td className="px-5 py-3">
                            {change == null
                              ? <span className="text-zinc-600 text-xs">—</span>
                              : <span className="text-xs font-semibold" style={{
                                  color: change < 0 ? '#34d399' : change > 0 ? '#f87171' : '#71717a'
                                }}>
                                  {change > 0 ? '+' : ''}{change.toFixed(2)}%
                                </span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* URL link */}
            <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
              style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">URL monitorada</p>
                <p className="text-zinc-300 text-sm truncate max-w-[500px]">{competitor.url}</p>
              </div>
              <a href={competitor.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all shrink-0"
                style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#52525b' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#3f3f46' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Abrir link
              </a>
            </div>

          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl"
          style={{
            background: toast.type === 'success' ? '#111114' : '#1a0a0a',
            border: `1px solid ${toast.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: toast.type === 'success' ? '#34d399' : '#f87171',
          }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
