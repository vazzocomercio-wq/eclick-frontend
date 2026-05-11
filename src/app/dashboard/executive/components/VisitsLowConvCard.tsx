'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { TrendingDown, ExternalLink, RefreshCw, CheckCircle2 } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface DailyPoint { date: string; total: number }

interface LowConvItem {
  ml_item_id:              string
  product_id:              string | null
  title:                   string | null
  category_ml_id:          string | null
  permalink:               string | null
  current_price:           number | null
  visits_7d:               number
  orders_7d:               number
  conversion_pct:          number
  benchmark_pct:           number | null
  benchmark_source:        'category' | 'seller' | 'none'
  benchmark_sample_size:   number | null
  gap_pct:                 number | null
  opportunity_score:       number | null
  visits_daily_breakdown:  DailyPoint[]
}

interface VisitsLowConvCardData {
  summary: {
    totalOpportunities:        number
    totalVisitsWasted:         number
    totalGmvUnderperforming:   number
    topGapPct:                 number | null
    benchmarkSourcesMix: { category: number; seller: number }
  }
  items: LowConvItem[]
  lastSyncedAt: string | null
}

const num = (v: number) => v.toLocaleString('pt-BR')
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function timeSince(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60_000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m}m`
  const h = Math.round(m / 60)
  return h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)}d`
}

/** Mini sparkline SVG inline pra evitar dependência de recharts em card pequeno. */
function Sparkline({ points, height = 24, width = 80 }: { points: DailyPoint[]; height?: number; width?: number }) {
  if (points.length < 2) {
    return <div style={{ height, width, fontSize: 10, color: '#52525b', display: 'flex', alignItems: 'center' }}>—</div>
  }
  const max = Math.max(...points.map(p => p.total), 1)
  const min = Math.min(...points.map(p => p.total))
  const range = max - min || 1
  const stepX = width / (points.length - 1)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${(height - ((p.total - min) / range) * height * 0.85 - height * 0.075).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke="#00E5FF" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function VisitsLowConvCard() {
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<VisitsLowConvCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch(`${BACKEND}/executive/cards/visits-low-conv`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setData(await res.json() as VisitsLowConvCardData)
    } catch (err) {
      console.warn('[visits-card] load fail:', (err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const empty = !loading && data && data.summary.totalOpportunities === 0

  return (
    <div style={{
      background:   'rgba(255,255,255,0.02)',
      border:       '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 12,
      gridColumn: 'span 2',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingDown size={14} color="#ef4444" />
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
            Muita visita, pouca venda
          </span>
        </div>
        <button onClick={load} disabled={refreshing} style={{
          background: 'none', border: 'none', cursor: refreshing ? 'wait' : 'pointer',
          color: '#71717a', padding: 4,
        }}>
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      {loading && <div style={{ color: '#52525b', fontSize: 13 }}>Carregando…</div>}

      {!loading && empty && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#22c55e' }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: 13 }}>Todos items com tráfego performam dentro ou acima da média.</span>
        </div>
      )}

      {!loading && data && !empty && (
        <>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#ef4444', lineHeight: 1 }}>
                {num(data.summary.totalOpportunities)}
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
                oportunidade{data.summary.totalOpportunities === 1 ? '' : 's'} detectada{data.summary.totalOpportunities === 1 ? '' : 's'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#e4e4e7', lineHeight: 1 }}>
                {num(data.summary.totalVisitsWasted)}
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
                visitas vazando/7d
              </div>
            </div>
            {data.summary.totalGmvUnderperforming > 0 && (
              <div>
                <div style={{ fontSize: 18, fontWeight: 500, color: '#a1a1aa', lineHeight: 1 }}>
                  {brl(data.summary.totalGmvUnderperforming)}
                </div>
                <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
                  GMV atual destes items
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {data.items.slice(0, 5).map(it => (
              <div key={it.ml_item_id}
                style={{
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8, padding: '10px 12px',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, color: '#e4e4e7',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {it.title ?? it.ml_item_id}
                    </div>
                    <div style={{ fontSize: 10, color: '#71717a', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>{it.ml_item_id}</span>
                      {it.category_ml_id && <span>· {it.category_ml_id}</span>}
                      {it.benchmark_source === 'category' && <span style={{ color: '#84cc16' }}>· benchmark cat</span>}
                      {it.benchmark_source === 'seller' && <span style={{ color: '#f59e0b' }}>· benchmark seller</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{num(it.visits_7d)} visits</span>
                      <span>{num(it.orders_7d)} vendas</span>
                      <span style={{ color: '#ef4444' }}>conv {it.conversion_pct}%</span>
                      {it.benchmark_pct != null && (
                        <span style={{ color: '#71717a' }}>vs {it.benchmark_pct}% médio</span>
                      )}
                      {it.gap_pct != null && (
                        <span style={{ color: '#f59e0b' }}>gap {it.gap_pct.toFixed(2)}pp</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <Sparkline points={it.visits_daily_breakdown} />
                    {it.permalink && (
                      <a href={it.permalink}
                         target="_blank" rel="noopener noreferrer"
                         style={{
                           display: 'inline-flex', alignItems: 'center', gap: 4,
                           color: '#00E5FF', fontSize: 11, textDecoration: 'none',
                         }}>
                        Ver no ML <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 10, color: '#52525b', marginTop: 'auto' }}>
        ↻ atualizado {timeSince(data?.lastSyncedAt ?? null)}
        {data && data.summary.benchmarkSourcesMix && (
          <> · benchmark: {data.summary.benchmarkSourcesMix.category} cat · {data.summary.benchmarkSourcesMix.seller} seller</>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
