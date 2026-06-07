'use client'

/**
 * HeaderActions — parte interativa do cabeçalho da vitrine (Client Component).
 *
 *  - Desktop: caixa de busca inline (à direita do nav).
 *  - Mobile: botão hambúrguer que abre um drawer com busca + links de navegação.
 *
 * A busca navega pra /loja/[slug]/produtos?q=TERMO (a página lê o ?q= e o
 * backend filtra por nome/SKU). Cores via CSS vars do tema.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Menu, X } from 'lucide-react'

interface NavItem { label: string; href: string }

export function HeaderActions({ nav, slug }: { nav: NavItem[]; slug: string }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const router = useRouter()

  const goSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    router.push(`/loja/${slug}/produtos${term ? `?q=${encodeURIComponent(term)}` : ''}`)
    setOpen(false)
  }

  const fieldStyle: React.CSSProperties = {
    flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none',
    color: 'var(--c-text)', fontFamily: 'var(--f-body)', fontSize: 14,
  }
  const boxStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
    padding: '6px 10px', background: 'var(--c-surface)',
  }

  return (
    <div className="flex items-center gap-2">
      {/* Busca desktop (inline) — maior em telas grandes */}
      <form onSubmit={goSearch} className="hidden md:flex md:w-64 lg:w-80" style={{ ...boxStyle, padding: '9px 14px' }}>
        <Search size={18} style={{ color: 'var(--c-text-muted)', flexShrink: 0 }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar produtos…"
          aria-label="Buscar produtos" style={{ ...fieldStyle, fontSize: 15 }} />
      </form>

      {/* Hambúrguer (mobile) */}
      <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"
        style={{ color: 'var(--c-text)', minHeight: 44, minWidth: 44, background: 'transparent', border: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Menu size={22} />
      </button>

      {/* Drawer mobile */}
      {open && (
        <div role="dialog" aria-modal="true"
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          {/* Overlay */}
          <div onClick={() => setOpen(false)} aria-hidden
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          {/* Painel */}
          <div style={{
            position: 'relative', width: 'min(82vw, 360px)', height: '100%',
            background: 'var(--c-bg)', color: 'var(--c-text)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
            padding: 20, gap: 16, fontFamily: 'var(--f-body)',
          }}>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: 'var(--f-heading)', fontWeight: 600 }}>Menu</span>
              <button onClick={() => setOpen(false)} aria-label="Fechar menu"
                style={{ color: 'var(--c-text)', minHeight: 44, minWidth: 44, background: 'transparent', border: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>

            {/* Busca no drawer */}
            <form onSubmit={goSearch} style={boxStyle}>
              <Search size={16} style={{ color: 'var(--c-text-muted)', flexShrink: 0 }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar produtos…"
                aria-label="Buscar produtos" style={fieldStyle} autoFocus />
            </form>

            {/* Links de navegação */}
            <nav className="flex flex-col" style={{ gap: 2 }}>
              {nav.map((n, i) => (
                <a key={i} href={n.href} onClick={() => setOpen(false)}
                  style={{ color: 'var(--c-text)', textDecoration: 'none', padding: '12px 4px', fontSize: 16, borderBottom: '1px solid var(--c-border)' }}>
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
