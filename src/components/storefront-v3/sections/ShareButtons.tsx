'use client'

/**
 * ShareButtons — compartilhamento real da página de produto v3
 * (substitui os links href="#" do esqueleto).
 *
 *  - WhatsApp: abre wa.me com "<nome do produto> — <url atual>"
 *  - Copiar link: navigator.clipboard + feedback "Copiado!" por 2s
 *
 * URLs lidas em runtime (window.location.href) — funciona em domínio
 * customizado e em /loja/[slug] sem hardcode.
 */

import { useRef, useState } from 'react'

export function ShareButtons({ productName }: { productName: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const shareWhatsApp = () => {
    const text = `${productName} — ${window.location.href}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard indisponível (http/permissão) — silencia */ }
  }

  const linkStyle: React.CSSProperties = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--c-primary)', textDecoration: 'underline',
    fontSize: 'inherit', fontFamily: 'inherit',
    padding: '12px 4px', minHeight: 44, // touch target
  }

  return (
    <span>
      Compartilhar:{' '}
      <button type="button" onClick={shareWhatsApp} style={{ ...linkStyle, marginRight: 8 }}>
        WhatsApp
      </button>
      <button type="button" onClick={copyLink} style={linkStyle}>
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
    </span>
  )
}
