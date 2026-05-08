'use client'

/**
 * Mini-botão de copiar pra valores curtos (MLB, SKU, título).
 * Mostra check verde por 1.2s após copiar. Falha silenciosa se
 * clipboard indisponível.
 *
 * Uso:
 *   <CopyButton value={mlb.item_id} />              // ícone-só
 *   <CopyButton value={sku} label="SKU copiado" />  // sobrescreve toast
 *   <CopyButton value={text} size={12} />           // tamanho custom
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  value:    string | null | undefined
  size?:    number
  label?:   string
  /** Quando true, NÃO renderiza nada se value vazio (evita "phantom" buttons). */
  hideIfEmpty?: boolean
}

export function CopyButton({ value, size = 11, label, hideIfEmpty = true }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  if (hideIfEmpty && !value) return null

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Browser sem clipboard API ou bloqueado — falha silenciosa
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center transition-all hover:scale-110 flex-shrink-0"
      style={{
        width:  size + 6,
        height: size + 6,
        padding: 3,
        color: copied ? '#22c55e' : '#71717a',
      }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.color = '#a1a1aa' }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.color = '#71717a' }}
      title={copied ? (label ? `${label}!` : 'Copiado!') : `Copiar ${value}`}
      aria-label={copied ? 'Copiado' : 'Copiar'}>
      {copied ? <Check size={size} strokeWidth={2.5} /> : <Copy size={size} />}
    </button>
  )
}
