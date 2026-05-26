'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'
import { C, SITE_URL } from './tokens'

/** Botões de compartilhamento do post. */
export function ShareButtons({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${SITE_URL}/blog/${slug}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* ignore */
    }
  }

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 9, background: C.CARD,
    border: `1px solid ${C.BORDER}`, color: C.MUT, cursor: 'pointer', textDecoration: 'none',
  }

  return (
    <div style={{ display: 'inline-flex', gap: 8 }}>
      <button type="button" onClick={copy} style={btn} aria-label="Copiar link" title="Copiar link">
        {copied ? <Check size={16} color={C.GREEN} /> : <Link2 size={16} />}
      </button>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank" rel="noopener noreferrer" style={btn} aria-label="Compartilhar no LinkedIn"
      >
        <span style={{ fontWeight: 800, fontSize: 13 }}>in</span>
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
        target="_blank" rel="noopener noreferrer" style={btn} aria-label="Compartilhar no X"
      >
        <span style={{ fontWeight: 800, fontSize: 14, lineHeight: 1 }}>𝕏</span>
      </a>
    </div>
  )
}
