'use client'

import { useEffect, type ReactNode, type CSSProperties, type ButtonHTMLAttributes } from 'react'

const KEYFRAMES = `
@keyframes eclick-pulse-glow {
  0%, 100% {
    opacity: 1;
    filter: brightness(1.2);
    text-shadow: 0 0 8px currentColor;
  }
  50% {
    opacity: 0.45;
    filter: brightness(0.7);
    text-shadow: none;
  }
}
@keyframes eclick-pulse-border {
  0%, 100% { border-color: currentColor; }
  50%      { border-color: transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .eclick-pulse-glow {
    animation: eclick-pulse-fade 1.4s ease-in-out infinite !important;
    filter: none !important;
    text-shadow: none !important;
  }
  @keyframes eclick-pulse-fade {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.55; }
  }
}
`

let injected = false
/** Idempotent — injects the @keyframes into <head> once per page load. */
export function ensurePulseStyles() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const s = document.createElement('style')
  s.setAttribute('data-eclick-pulse', '')
  s.textContent = KEYFRAMES
  document.head.appendChild(s)
}

export const PULSE_VARIANTS = {
  cyan:    { color: '#00E5FF', bg: 'rgba(0,229,255,0.10)',  border: 'rgba(0,229,255,0.30)' },
  amber:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)' },
  emerald: { color: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.30)' },
  rose:    { color: '#F43F5E', bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.30)' },
} as const

export type PulseVariant = keyof typeof PULSE_VARIANTS

export function pulseClass(loading: boolean): string {
  return loading ? 'eclick-pulse-glow' : ''
}

export function pulseVariantStyle(variant: PulseVariant): CSSProperties {
  const v = PULSE_VARIANTS[variant]
  return {
    color:      v.color,
    background: v.bg,
    border:     `1px solid ${v.border}`,
  }
}

interface PulsingButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick:  () => void | Promise<void>
  loading?: boolean
  icon?:    ReactNode
  label:    string
  badge?:   string | number
  variant?: PulseVariant
  disabled?: boolean
}

/** Drop-in async-action button. While `loading=true` the icon + label
 * pulse (opacity + glow) instead of being replaced by a spinner. The
 * label stays legible (min opacity 0.45). Auto-disables during load. */
export function PulsingButton({
  onClick, loading = false, icon, label, badge,
  variant = 'cyan', disabled = false, className = '', ...rest
}: PulsingButtonProps) {
  useEffect(ensurePulseStyles, [])
  return (
    <button
      type="button"
      {...rest}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold',
        'transition-opacity disabled:cursor-not-allowed',
        loading ? 'eclick-pulse-glow' : 'disabled:opacity-40',
        className,
      ].join(' ')}
      style={pulseVariantStyle(variant)}>
      {icon}
      <span>{label}</span>
      {badge != null && (
        <span className="ml-0.5 text-[10px] tabular-nums px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(0,0,0,0.30)' }}>
          {typeof badge === 'number' ? badge.toLocaleString('pt-BR') : badge}
        </span>
      )}
    </button>
  )
}
