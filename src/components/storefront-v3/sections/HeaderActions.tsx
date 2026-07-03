'use client'

/**
 * HeaderActions — parte interativa do cabeçalho da vitrine (Client Component).
 *
 *  - Desktop: caixa de busca inline (à direita do nav) + conta + carrinho.
 *  - Mobile: carrinho + botão hambúrguer que abre um drawer com busca +
 *    links de navegação + conta.
 *
 * Honra as settings da section siteHeader (showSearch/showCart/showAccount —
 * defaults retrocompatíveis resolvidos no SiteHeader server component).
 *
 * A busca navega pra /loja/[slug]/produtos?q=TERMO (a página lê o ?q= e o
 * backend filtra por nome/SKU). Cores via CSS vars do tema.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Menu, X, User } from 'lucide-react'
import { CartButtonV3 } from '../CartClient'

interface NavItem { label: string; href: string }

export function HeaderActions({ nav, slug, showSearch, showCart, showAccount, storeName, whatsappNumber, paymentsEnabled }: {
  nav:  NavItem[]
  slug: string
  showSearch:      boolean
  showCart:        boolean
  showAccount:     boolean
  storeName:       string
  whatsappNumber:  string | null
  paymentsEnabled: boolean
}) {
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
  const iconLinkStyle: React.CSSProperties = {
    color: 'var(--c-text)', minHeight: 44, minWidth: 44,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none',
  }

  return (
    <div className="flex items-center gap-1 md:gap-2">
      {/* Busca desktop (inline) — maior em telas grandes */}
      {showSearch && (
        <form onSubmit={goSearch} className="hidden md:flex md:w-64 lg:w-80" style={{ ...boxStyle, padding: '9px 14px' }}>
          <Search size={18} style={{ color: 'var(--c-text-muted)', flexShrink: 0 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar produtos…"
            aria-label="Buscar produtos" style={{ ...fieldStyle, fontSize: 15 }} />
        </form>
      )}

      {/* Conta (desktop) */}
      {showAccount && (
        <a href={`/loja/${slug}/conta`} aria-label="Minha conta"
          className="hidden md:inline-flex" style={iconLinkStyle}>
          <User size={21} />
        </a>
      )}

      {/* Carrinho (mobile + desktop) */}
      {showCart && (
        <CartButtonV3 store={{ slug, storeName, paymentsEnabled, whatsappNumber }} />
      )}

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
            {showSearch && (
              <form onSubmit={goSearch} style={boxStyle}>
                <Search size={16} style={{ color: 'var(--c-text-muted)', flexShrink: 0 }} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar produtos…"
                  aria-label="Buscar produtos" style={fieldStyle} autoFocus />
              </form>
            )}

            {/* Links de navegação */}
            <nav className="flex flex-col" style={{ gap: 2 }}>
              {nav.map((n, i) => (
                <a key={i} href={n.href} onClick={() => setOpen(false)}
                  style={{ color: 'var(--c-text)', textDecoration: 'none', padding: '12px 4px', fontSize: 16, borderBottom: '1px solid var(--c-border)' }}>
                  {n.label}
                </a>
              ))}
              {showAccount && (
                <a href={`/loja/${slug}/conta`} onClick={() => setOpen(false)}
                  style={{ color: 'var(--c-text)', textDecoration: 'none', padding: '12px 4px', fontSize: 16, borderBottom: '1px solid var(--c-border)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <User size={18} /> Minha conta
                </a>
              )}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
