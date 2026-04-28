'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { formatPii, type PiiType } from '@/lib/format'
import { usePreferences } from '@/hooks/usePreferences'

const REVEAL_MS = 30_000

/** Renders PII (CPF / phone / email) according to the user's mask preference.
 * Click the eye icon to reveal for 30s. The full value is always available
 * internally — masking is purely display. */
export function MaskedField({ type, value, className, hideToggle }: {
  type: PiiType
  value: string | null | undefined
  className?: string
  /** When true, suppresses the eye toggle (read-only display). */
  hideToggle?: boolean
}) {
  const { maskCpf, maskPhone, maskEmail } = usePreferences()
  const [revealed, setRevealed] = useState(false)
  const masked =
    type === 'cpf'   ? maskCpf :
    type === 'phone' ? maskPhone :
    type === 'email' ? maskEmail : true

  useEffect(() => {
    if (!revealed) return
    const t = setTimeout(() => setRevealed(false), REVEAL_MS)
    return () => clearTimeout(t)
  }, [revealed])

  const showMasked = masked && !revealed
  const text = formatPii(type, value, showMasked)

  if (!value) return <span className={className} style={{ color: '#52525b' }}>—</span>

  return (
    <span className={['inline-flex items-center gap-1', className ?? ''].join(' ')}>
      <span className="font-mono">{text}</span>
      {!hideToggle && masked && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setRevealed(r => !r) }}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          title={revealed ? 'Ocultar' : `Revelar por ${REVEAL_MS / 1000}s`}>
          {revealed ? <EyeOff size={10} /> : <Eye size={10} />}
        </button>
      )}
    </span>
  )
}
