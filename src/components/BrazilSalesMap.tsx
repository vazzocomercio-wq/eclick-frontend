'use client'

import { useState, useRef, useMemo } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const brazilGeo = require('@/data/brazil-states.json')

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

function spread(id: string, range = 0.5): [number, number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) | 0
  const u = ((h >>> 0) % 10000) / 10000
  const v = (((h >>> 14) >>> 0) % 10000) / 10000
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
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setTip({ x, y, dot })
  }

  return (
    <div ref={containerRef} className="relative w-full select-none" style={{ height }}>
      <style>{`
        @keyframes bsm-pulse {
          0%   { r: 0;  opacity: 0.9; }
          60%  { opacity: 0.4; }
          100% { r: 16; opacity: 0; }
        }
        .bsm-pulse { animation: bsm-pulse 1.4s ease-out forwards; }
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

      {/* Counter top-right */}
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
        <Geographies geography={brazilGeo}>
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
                r={0}
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

      {/* Legend bottom-right */}
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
          className="absolute z-20 pointer-events-none rounded-lg px-3 py-2"
          style={{
            left: Math.min(tip.x + 14, (containerRef.current?.offsetWidth ?? 9999) - 165),
            top: Math.max(tip.y - 72, 4),
            background: '#18181b',
            border: '1px solid #2e2e36',
            minWidth: 155,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <p className="text-white text-[11px] font-semibold mb-0.5">{tip.dot.city} · {tip.dot.state}</p>
          <p className="text-zinc-400 text-[10px] mb-0.5 leading-tight">
            {tip.dot.label}{tip.dot.label.length === 30 ? '…' : ''}
          </p>
          <p className="text-[11px] font-bold" style={{ color: dotColor(tip.dot.value) }}>
            {brl(tip.dot.value)}
          </p>
          <p className="text-zinc-600 text-[10px] mt-0.5">{tip.dot.time}</p>
        </div>
      )}

      {/* Empty state */}
      {dots.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
          <svg className="w-8 h-8 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
          <p className="text-zinc-600 text-sm">Nenhuma venda com endereço disponível</p>
          <p className="text-zinc-700 text-[10px]">Os endereços são carregados via API de envios</p>
        </div>
      )}
    </div>
  )
}
