'use client'

import { useEffect, useRef } from 'react'
import { ScanLine } from 'lucide-react'

/**
 * Campo de bipagem. O leitor Bluetooth se comporta como teclado: digita o
 * código e manda Enter. Mantemos o input SEMPRE em foco (autoFocus + refocus
 * no blur + refocus periódico) pra nunca perder uma leitura.
 *
 * Aceita SKU, EAN ou QR code — o backend é quem casa o código.
 */
export function Scanner({
  onScan,
  placeholder = 'Bipe SKU, EAN ou QR…',
  disabled = false,
  hint,
}: {
  onScan: (code: string) => void
  placeholder?: string
  disabled?: boolean
  hint?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (disabled) return
    ref.current?.focus()
    const id = setInterval(() => {
      if (!disabled && document.activeElement !== ref.current) ref.current?.focus()
    }, 700)
    return () => clearInterval(id)
  }, [disabled])

  function submit() {
    const v = ref.current?.value?.trim()
    if (!v) return
    if (ref.current) ref.current.value = ''
    onScan(v)
  }

  return (
    <div className="w-full">
      <div
        className="flex items-center gap-3 rounded-2xl border-2 px-4 py-4 transition-colors"
        style={{
          background: '#0c0c10',
          borderColor: disabled ? 'rgba(255,255,255,0.08)' : '#00E5FF',
          boxShadow: disabled ? 'none' : '0 0 0 4px rgba(0,229,255,0.10)',
        }}
      >
        <ScanLine size={26} color={disabled ? '#52525b' : '#00E5FF'} />
        <input
          ref={ref}
          autoFocus
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit() }
          }}
          onBlur={() => {
            if (!disabled) setTimeout(() => ref.current?.focus(), 60)
          }}
          className="flex-1 bg-transparent text-xl font-semibold tracking-wide outline-none"
          style={{ color: '#fafafa' }}
        />
      </div>
      {hint && <p className="mt-2 text-center text-sm" style={{ color: '#71717a' }}>{hint}</p>}
    </div>
  )
}
