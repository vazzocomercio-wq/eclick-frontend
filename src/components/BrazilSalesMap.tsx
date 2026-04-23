'use client'

import { useState } from 'react'
import { BRAZIL_VIEW_BOX, STATE_POSITIONS, STATE_PATHS } from '@/data/brazil-svg-paths'

// Handles both "BR-SP" and "SP" formats
function extractUF(state: string | null | undefined): string | null {
  if (!state) return null
  const uf = state.includes('-') ? state.split('-').pop()! : state
  return uf.toUpperCase()
}

export interface MapOrder {
  id?: string
  shipping_state?: string | null
  shipping_city?: string | null
  total_amount?: number
  date_created?: string
  items?: Array<{ title?: string }>
}

interface BrazilSalesMapProps {
  orders?: MapOrder[]
  title?: string
  height?: number
  realtime?: boolean
  newOrderIds?: Set<string> | string[]
}

interface Point {
  x: number
  y: number
  uf: string
  color: string
  size: number
  city: string
  state: string
  title: string
  value: number
  time: string
  orderId: string
}

interface Tooltip {
  x: number
  y: number
  city: string
  state: string
  title: string
  value: number
  time: string
}

function dotColor(v: number): string {
  if (v > 500) return '#f59e0b'
  if (v > 300) return '#22c55e'
  if (v > 100) return '#00E5FF'
  return '#3b82f6'
}

function dotSize(v: number): number {
  if (v > 500) return 7
  if (v > 300) return 6
  if (v > 100) return 5
  return 4
}

function hasNewId(newOrderIds: Set<string> | string[] | undefined, id: string): boolean {
  if (!newOrderIds) return false
  if (newOrderIds instanceof Set) return newOrderIds.has(id)
  return newOrderIds.includes(id)
}

// Parse viewBox to get dimensions
const [vbX, vbY, vbW, vbH] = BRAZIL_VIEW_BOX.split(' ').map(Number)

export default function BrazilSalesMap({
  orders = [],
  title = 'Mapa de Vendas',
  height = 400,
  realtime = false,
  newOrderIds,
}: BrazilSalesMapProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const points: Point[] = orders
    .map((order, idx) => {
      const uf = extractUF(order.shipping_state)
      if (!uf || !STATE_POSITIONS[uf]) return null
      const pos = STATE_POSITIONS[uf]
      const spread = 14
      const angle = (idx * 137.5) % 360
      const dist = (idx % 4) * (spread / 4)
      const x = pos.x + Math.cos((angle * Math.PI) / 180) * dist
      const y = pos.y + Math.sin((angle * Math.PI) / 180) * dist
      const value = order.total_amount ?? 0
      return {
        x,
        y,
        uf,
        color: dotColor(value),
        size: dotSize(value),
        city: order.shipping_city ?? uf,
        state: uf,
        title: (order.items?.[0]?.title ?? '').substring(0, 30),
        value,
        time: order.date_created
          ? new Date(order.date_created).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '',
        orderId: order.id ?? String(idx),
      }
    })
    .filter((p): p is Point => p !== null)

  const stateCount = new Set(points.map(p => p.state)).size

  // Active state UFs (have sales)
  const activeUFs = new Set(points.map(p => p.state))

  return (
    <div className="bg-[#111114] rounded-xl border border-[#1a1a1f] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold text-sm">{title}</h3>
          {realtime && (
            <span className="flex items-center gap-1 text-xs text-[#00E5FF]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
              Ao vivo
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {points.length} venda{points.length !== 1 ? 's' : ''} · {stateCount} estado{stateCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Map area */}
      <div className="relative" style={{ height }}>
        <svg
          viewBox={BRAZIL_VIEW_BOX}
          className="w-full h-full"
          style={{ filter: 'drop-shadow(0 0 20px rgba(0,229,255,0.04))' }}
        >
          {/* Real Brazil state paths */}
          {Object.entries(STATE_PATHS).map(([uf, d]) => (
            <path
              key={uf}
              d={d}
              fill={activeUFs.has(uf) ? '#1e2a3a' : '#141418'}
              stroke="#2a2a3f"
              strokeWidth="0.5"
              strokeLinejoin="round"
            />
          ))}

          {/* State labels */}
          {Object.entries(STATE_POSITIONS).map(([uf, pos]) => (
            <text
              key={uf}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              fill={activeUFs.has(uf) ? '#ffffff30' : '#ffffff0d'}
              fontSize="7"
              fontFamily="monospace"
              fontWeight={activeUFs.has(uf) ? '700' : '400'}
            >
              {uf}
            </text>
          ))}

          {/* Sale dots */}
          {points.map((point, idx) => {
            const isNew = hasNewId(newOrderIds, point.orderId)
            return (
              <g key={idx}>
                {isNew && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={point.size + 4}
                    fill="none"
                    stroke="#00E5FF"
                    strokeWidth="1.5"
                    opacity="0.6"
                  >
                    <animate attributeName="r" from={point.size} to={point.size + 12} dur="1s" begin="0s" fill="freeze" />
                    <animate attributeName="opacity" from="0.8" to="0" dur="1s" begin="0s" fill="freeze" />
                  </circle>
                )}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={point.size}
                  fill={point.color}
                  opacity={0.9}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => {
                    const svg = e.currentTarget.closest('svg')!
                    const rect = svg.getBoundingClientRect()
                    const scaleX = rect.width / vbW
                    const scaleY = rect.height / vbH
                    setTooltip({
                      x: (point.x - vbX) * scaleX,
                      y: (point.y - vbY) * scaleY,
                      city: point.city,
                      state: point.state,
                      title: point.title,
                      value: point.value,
                      time: point.time,
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              </g>
            )
          })}
        </svg>

        {/* Empty state overlay */}
        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-600 text-xs">Sem vendas com endereço no período</p>
          </div>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 rounded-lg p-2 text-xs pointer-events-none shadow-xl"
            style={{
              left: Math.min(tooltip.x + 10, 540),
              top: Math.max(tooltip.y - 60, 4),
              background: '#1a1a2e',
              border: '1px solid rgba(0,229,255,0.2)',
            }}
          >
            <p className="text-[#00E5FF] font-medium">{tooltip.city} · {tooltip.state}</p>
            {tooltip.title && (
              <p className="text-gray-300 mt-0.5">
                {tooltip.title}{tooltip.title.length === 30 ? '…' : ''}
              </p>
            )}
            <p className="text-white font-semibold">
              {tooltip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            {tooltip.time && <p className="text-gray-500 mt-0.5">{tooltip.time}</p>}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 justify-end">
        {[
          { color: '#3b82f6', label: '< R$100' },
          { color: '#00E5FF', label: 'R$100–300' },
          { color: '#22c55e', label: 'R$300–500' },
          { color: '#f59e0b', label: '> R$500' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
