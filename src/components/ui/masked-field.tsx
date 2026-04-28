'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { formatPii, type PiiType } from '@/lib/format'
import { usePreferences } from '@/hooks/usePreferences'

const DEFAULT_REVEAL_MS = 30_000
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/** Renders PII (CPF / phone / email) according to user mask preference.
 * Click eye to reveal for `autoMaskAfterMs` (default 30s). On reveal, posts
 * an audit log to /user-preferences/audit-reveal so reveals are traceable.
 *
 * Props:
 *   - alwaysVisible: bypasses mask (used in detail screens like /pedidos/[id])
 *   - copyable: shows a copy-to-clipboard button (default true)
 *   - autoMaskAfterMs: how long the reveal stays open (default 30s)
 *   - customerId: included in the audit row when revealing */
export function MaskedField({
  type, value, customerId,
  alwaysVisible = false,
  copyable = true,
  autoMaskAfterMs = DEFAULT_REVEAL_MS,
  hideToggle = false,
  className,
}: {
  type:             PiiType
  value:            string | null | undefined
  customerId?:      string
  alwaysVisible?:   boolean
  copyable?:        boolean
  autoMaskAfterMs?: number
  hideToggle?:      boolean
  className?:       string
}) {
  const { maskCpf, maskPhone, maskEmail } = usePreferences()
  const [revealed, setRevealed] = useState(false)
  const [copied,   setCopied]   = useState(false)

  const userMasksThis =
    type === 'cpf'   ? maskCpf :
    type === 'phone' ? maskPhone :
    type === 'email' ? maskEmail : true
  const masked = !alwaysVisible && userMasksThis

  useEffect(() => {
    if (!revealed) return
    const t = setTimeout(() => setRevealed(false), autoMaskAfterMs)
    return () => clearTimeout(t)
  }, [revealed, autoMaskAfterMs])

  const showMasked = masked && !revealed
  const text = formatPii(type, value, showMasked)

  const handleReveal = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !revealed
    setRevealed(next)
    if (next && value) {
      // Fire-and-forget audit. Never blocks the UI; quietly ignored if offline.
      fetch(`${BACKEND}/user-preferences/audit-reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: type, customer_id: customerId ?? null }),
        credentials: 'include',
        keepalive: true,
      }).catch(() => undefined)
    }
  }, [revealed, value, type, customerId])

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!value) return
    try {
      await navigator.clipboard.writeText(formatPii(type, value, false))
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* ignore */ }
  }, [value, type])

  if (!value) return <span className={className} style={{ color: '#52525b' }}>—</span>

  return (
    <span className={['inline-flex items-center gap-1', className ?? ''].join(' ')}>
      <span className="font-mono">{text}</span>
      {!hideToggle && masked && (
        <button type="button" onClick={handleReveal}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          title={revealed ? 'Ocultar' : `Revelar por ${Math.round(autoMaskAfterMs / 1000)}s`}>
          {revealed ? <EyeOff size={10} /> : <Eye size={10} />}
        </button>
      )}
      {copyable && (
        <button type="button" onClick={handleCopy}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          title={copied ? 'Copiado' : 'Copiar'}>
          {copied ? <Check size={10} style={{ color: '#4ade80' }} /> : <Copy size={10} />}
        </button>
      )}
    </span>
  )
}
