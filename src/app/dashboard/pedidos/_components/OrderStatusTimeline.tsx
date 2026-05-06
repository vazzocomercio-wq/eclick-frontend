'use client'

/**
 * Timeline horizontal de status do pedido — visual moderno/futurista.
 *
 * Combina ML order.status (pago/pendente/cancelado) + shipping.status
 * (handling/shipped/in_transit/delivered) em 5 etapas lineares:
 *   Pago → Em preparação → Despachado → Em trânsito → Entregue
 *
 * Branches alternativos (cancelado, mediação) renderizam estado
 * "interrompido" — linha vermelha cortando a partir do step atual.
 */

import { useMemo } from 'react'
import { CreditCard, Package, Truck, MapPin, CheckCircle2, XCircle, AlertOctagon } from 'lucide-react'

interface Props {
  paymentStatus:  string | null
  shippingStatus: string | null
  hasMediation?:  boolean
  /** Data do pedido (sold_at). Mostrada no step "Pago". */
  soldAt?:        string | null
  /** Compacto vs default (default = vertical bigger feel). */
  compact?:       boolean
}

type StepKey = 'paid' | 'handling' | 'shipped' | 'in_transit' | 'delivered'
type StepState = 'done' | 'current' | 'pending' | 'failed'

const STEPS: Array<{ key: StepKey; label: string; icon: typeof Package }> = [
  { key: 'paid',        label: 'Pago',          icon: CreditCard },
  { key: 'handling',    label: 'Em preparação', icon: Package },
  { key: 'shipped',     label: 'Despachado',    icon: Truck },
  { key: 'in_transit',  label: 'Em trânsito',   icon: MapPin },
  { key: 'delivered',   label: 'Entregue',      icon: CheckCircle2 },
]

/** Mapeia (payment, shipping) → indice da etapa atual.
 *  Retorna -1 se nem foi pago ainda (e.g. payment_required). */
function resolveCurrentIndex(payment: string | null, shipping: string | null): number {
  if (shipping === 'delivered')                                    return 4
  if (shipping === 'shipped' || shipping === 'in_transit')         return 3
  if (shipping === 'ready_to_ship')                                return 2
  if (shipping === 'handling' || shipping === 'pending')           return 1
  if (payment === 'approved' || payment === 'paid' || payment === 'partially_paid') return 0
  return -1
}

function fmtShort(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function OrderStatusTimeline({
  paymentStatus,
  shippingStatus,
  hasMediation = false,
  soldAt,
  compact = false,
}: Props) {
  const currentIdx = useMemo(
    () => resolveCurrentIndex(paymentStatus, shippingStatus),
    [paymentStatus, shippingStatus],
  )

  const isCancelled = paymentStatus === 'cancelled' || shippingStatus === 'cancelled' || shippingStatus === 'not_delivered'
  const isMediation = hasMediation && !isCancelled

  // Quando cancelado/mediação a partir do step atual: tinge interrupção
  const interruptedAt = isCancelled || isMediation ? Math.max(0, currentIdx) : -1

  const stateOf = (idx: number): StepState => {
    if (interruptedAt >= 0 && idx > interruptedAt)   return 'pending'
    if (interruptedAt >= 0 && idx === interruptedAt) return 'failed'
    if (currentIdx === -1)                            return 'pending'
    if (idx < currentIdx)                             return 'done'
    if (idx === currentIdx)                           return 'current'
    return 'pending'
  }

  const dotSize = compact ? 28 : 36

  return (
    <div className="relative w-full" style={{ paddingTop: compact ? 6 : 10, paddingBottom: compact ? 22 : 28 }}>
      {/* Linha de fundo (rail completo) */}
      <div
        className="absolute"
        style={{
          left:  `${dotSize / 2}px`,
          right: `${dotSize / 2}px`,
          top:   `${(compact ? 6 : 10) + dotSize / 2 - 1}px`,
          height: 2,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
          borderRadius: 1,
        }}
      />

      {/* Linha de progresso (gradiente glow até o step atual) */}
      {currentIdx >= 0 && (
        <div
          className="absolute"
          style={{
            left: `${dotSize / 2}px`,
            top:  `${(compact ? 6 : 10) + dotSize / 2 - 1}px`,
            height: 2,
            width: `calc(${(currentIdx / (STEPS.length - 1)) * 100}% - ${currentIdx === 0 ? 0 : 0}px)`,
            background: isCancelled
              ? 'linear-gradient(90deg, #00E5FF, #ef4444)'
              : isMediation
                ? 'linear-gradient(90deg, #00E5FF, #fb923c)'
                : 'linear-gradient(90deg, #00E5FF, #00E5FF, rgba(0,229,255,0.4))',
            boxShadow: '0 0 8px rgba(0,229,255,0.55)',
            transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: 1,
          }}
        />
      )}

      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}>
        {STEPS.map((s, idx) => {
          const st = stateOf(idx)
          const Icon = s.icon

          // Cores por estado
          let borderColor = 'rgba(255,255,255,0.12)'
          let bgColor     = '#0a0a0c'
          let iconColor   = '#52525b'
          let glow        = 'none'
          let pulseRing   = false
          let labelColor  = '#71717a'

          if (st === 'done') {
            borderColor = 'rgba(0,229,255,0.5)'
            bgColor     = 'rgba(0,229,255,0.08)'
            iconColor   = '#00E5FF'
            glow        = '0 0 10px rgba(0,229,255,0.35)'
            labelColor  = '#a1a1aa'
          } else if (st === 'current') {
            borderColor = '#00E5FF'
            bgColor     = 'rgba(0,229,255,0.14)'
            iconColor   = '#00E5FF'
            glow        = '0 0 16px rgba(0,229,255,0.65), 0 0 32px rgba(0,229,255,0.35)'
            pulseRing   = true
            labelColor  = '#fafafa'
          } else if (st === 'failed') {
            borderColor = '#ef4444'
            bgColor     = 'rgba(239,68,68,0.16)'
            iconColor   = '#fca5a5'
            glow        = '0 0 12px rgba(239,68,68,0.55)'
            labelColor  = '#fca5a5'
          }

          const dateStr = idx === 0 && st !== 'pending' ? fmtShort(soldAt) : null

          return (
            <div key={s.key} className="flex flex-col items-center" style={{ minWidth: 0 }}>
              <div className="relative" style={{ width: dotSize, height: dotSize }}>
                {/* Pulse ring quando current */}
                {pulseRing && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: '1px solid #00E5FF',
                      animation: 'eclick-pulse-ring 1.6s cubic-bezier(0.4,0,0.6,1) infinite',
                    }}
                  />
                )}
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{
                    width: '100%',
                    height: '100%',
                    background: bgColor,
                    border: `1.5px solid ${borderColor}`,
                    boxShadow: glow,
                    transition: 'all 300ms ease-out',
                  }}
                >
                  {st === 'failed'
                    ? (isCancelled
                        ? <XCircle      size={compact ? 13 : 16} style={{ color: iconColor }} />
                        : <AlertOctagon size={compact ? 13 : 16} style={{ color: iconColor }} />)
                    : <Icon size={compact ? 13 : 16} style={{ color: iconColor }} />}
                </div>
              </div>

              <div className="mt-1.5 text-center" style={{ minWidth: 0, maxWidth: '100%' }}>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider truncate"
                  style={{ color: labelColor, transition: 'color 300ms ease-out' }}
                  title={s.label}
                >
                  {st === 'failed' && isCancelled ? 'Cancelado' : st === 'failed' && isMediation ? 'Reclamação' : s.label}
                </p>
                {dateStr && (
                  <p className="text-[9px] font-mono mt-0.5" style={{ color: '#52525b' }}>{dateStr}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Animação keyframe inline (escopada com nome unico) */}
      <style jsx>{`
        @keyframes eclick-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.65; }
          80%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
