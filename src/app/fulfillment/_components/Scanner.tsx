'use client'

import { useEffect, useRef, useState } from 'react'
import { ScanLine, Camera } from 'lucide-react'
import { CameraScanner } from './CameraScanner'

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
  const [cam, setCam] = useState(false)

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

      <button
        type="button"
        onClick={() => setCam(true)}
        disabled={disabled}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
        style={{ background: '#18181b', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }}
      >
        <Camera size={16} /> Ler com a câmera
      </button>

      {hint && <p className="mt-2 text-center text-sm" style={{ color: '#71717a' }}>{hint}</p>}

      {cam && (
        <CameraScanner
          onDetect={(code) => { setCam(false); onScan(code) }}
          onClose={() => setCam(false)}
        />
      )}
    </div>
  )
}
