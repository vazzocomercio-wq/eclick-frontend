'use client'

import { useState, useRef, useMemo } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

const GEO_URL =
  'https://raw.githubusercontent.com/giuliano-macedo/geodata-br-states/main/geojson/br_states.json'

const STATE_COORDS: Record<string, [number, number]> = {
  AC: [-70.55, -8.77],  AL: [-36.95, -9.71],
  AM: [-60.02, -3.10],  AP: [-51.07,  1.41],
  BA: [-41.72, -12.97], CE: [-38.54, -3.72],
  DF: [-47.93, -15.78], ES: [-40.34, -19.19],
  GO: [-49.31, -16.69], MA: [-44.30, -2.55],
  MG: [-44.04, -18.51], MS: [-54.64, -20.44],
  MT: [-56.10, -15.60], PA: [-48.50, -1.46],
  PB: [-34.86, -7.12],  PE: [-37.86, -8.38],
  PI: [-42.80, -5.09],  PR: [-51.55, -25.43],
  RJ: [-43.18, -22.91], RN: [-36.53, -5.79],
  RO: [-63.90, -10.83], RR: [-61.27,  2.82],
  RS: [-53.08, -30.03], SC: [-50.00, -27.33],
  SE: [-37.45, -10.91], SP: [-48.55, -22.98],
  TO: [-48.32, -10.18],
}

export interface MapOrder {
  id: string
  total_amount: number
  date_created: string
  shipping_state?: string | null
  shipping_city?: string | null
  items: Array<{ title: string }>
}

interface Props {
  orders: MapOrder[]
  title?: string
  height?: number
  realtime?: boolean
  newOrderIds?: Set<string>
}

interface Dot {
  id: string
  lng: number
  lat: number
  value: number
  city: string
  state: string
  label: string
  time: string
  isNew: boolean
}

interface Tip {
  x: number
  y: number
  dot: Dot
}

// Deterministic spread so same-state orders don't pile up on one pixel
function spread(id: string, range = 0.5): [number, number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) | 0
  const u = ((h >>> 0) % 10000) / 10000
  const v = ((h >>> 14) % 10000) / 10000
  return [(u - 0.5) * range * 2, (v - 0.5) * range * 2]
}

function dotColor(v: number): string {
  if (v < 100) return '#3b82f6'
  if (v < 300) return '#00E5FF'
  if (v < 500) return '#22c55e'
  return '#f59e0b'
}

function dotR(v: number): number {
  if (v < 100) return 3.5
  if (v < 300) return 4.5
  if (v < 500) return 5.5
  return 7
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const LEGEND = [
  { color: '#3b82f6', label: '< R$100' },
  { color: '#00E5FF', label: 'R$100–300' },
  { color: '#22c55e', label: 'R$300–500' },
  { color: '#f59e0b', label: '> R$500' },
]

export default function BrazilSalesMap({
  orders,
  title,
  height = 350,
  realtime = false,
  newOrderIds,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<Tip | null>(null)

  const dots = useMemo<Dot[]>(() => {
    return orders
      .filter(o => o.shipping_state && STATE_COORDS[o.shipping_state])
      .map(o => {
        const base = STATE_COORDS[o.shipping_state!]
        const [dx, dy] = spread(o.id)
        const d = new Date(o.date_created)
        return {
          id: o.id,
          lng: base[0] + dx,
          lat: base[1] + dy,
          value: o.total_amount,
          city: o.shipping_city ?? o.shipping_state ?? '',
          state: o.shipping_state!,
          label: (o.items?.[0]?.title ?? '—').slice(0, 30),
          time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          isNew: !!(realtime && newOrderIds?.has(o.id)),
        }
      })
  }, [orders, realtime, newOrderIds])

  const stateCount = useMemo(() => new Set(dots.map(d => d.state)).size, [dots])

  function handleEnter(e: React.MouseEvent, dot: Dot) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, dot })
  }

  return (
    <div ref={containerRef} className="relative w-full select-none" style={{ height }}>
      {/* Pulse keyframe injected once */}
      <style>{`
        @keyframes bsm-pulse {
          0%   { r: 0;  opacity: 0.9; }
          60%  { opacity: 0.5; }
          100% { r: 14; opacity: 0; }
        }
        .bsm-pulse { animation: bsm-pulse 1.2s ease-out forwards; }
      `}</style>

      {/* Title + live badge */}
      {title && (
        <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
          <p className="text-white text-sm font-semibold">{title}</p>
          {realtime && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00E5FF' }} />
              Ao vivo
            </span>
          )}
        </div>
      )}

      {/* Counter */}
      <div className="absolute top-3 right-3 z-10 text-right">
        <p className="text-white text-[11px] font-bold">{dots.length} vendas</p>
        <p className="text-zinc-500 text-[10px]">{stateCount} estado{stateCount !== 1 ? 's' : ''}</p>
      </div>

      {/* Map */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ center: [-55, -15], scale: 830 }}
        width={600}
        height={500}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map(geo => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#18181f"
                stroke="#2e2e3c"
                strokeWidth={0.6}
                style={{ outline: 'none' }}
              />
            ))
          }
        </Geographies>

        {dots.map(dot => (
          <Marker key={dot.id} coordinates={[dot.lng, dot.lat]}>
            {dot.isNew && (
              <circle
                className="bsm-pulse"
                cx={0}
                cy={0}
                fill="none"
                stroke="#00E5FF"
                strokeWidth={1.5}
              />
            )}
            <circle
              cx={0}
              cy={0}
              r={dotR(dot.value)}
              fill={dotColor(dot.value)}
              opacity={0.85}
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => handleEnter(e, dot)}
              onMouseLeave={() => setTip(null)}
            />
          </Marker>
        ))}
      </ComposableMap>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1 p-2 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {LEGEND.map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} />
            <span className="text-zinc-400 text-[9px] font-medium">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tip && (
        <div
          className="absolute z-20 pointer-events-none rounded-lg px-3 py-2 text-[11px]"
          style={{
            left: Math.min(tip.x + 14, (containerRef.current?.offsetWidth ?? 9999) - 160),
            top: tip.y - 60,
            background: '#18181b',
            border: '1px solid #2e2e36',
            minWidth: 150,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <p className="text-white font-semibold mb-0.5">{tip.dot.city} · {tip.dot.state}</p>
          <p className="text-zinc-400 mb-0.5 leading-tight">{tip.dot.label}{tip.dot.label.length === 30 ? '…' : ''}</p>
          <p style={{ color: dotColor(tip.dot.value) }} className="font-bold">{brl(tip.dot.value)}</p>
          <p className="text-zinc-600 text-[10px] mt-0.5">{tip.dot.time}</p>
        </div>
      )}

      {/* Empty state */}
      {dots.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-zinc-700 text-sm">Sem pedidos com endereço disponível</p>
        </div>
      )}
    </div>
  )
}
