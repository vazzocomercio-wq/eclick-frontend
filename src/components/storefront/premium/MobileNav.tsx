'use client'

/**
 * Menu de navegacao mobile do cabecalho premium — botao hamburguer que
 * abre um painel suspenso. So aparece abaixo de `md`.
 */

import { useState } from 'react'

export function MobileNav({ nav, color, surface, border }: {
  nav: Array<{ label: string; href: string }>
  color: string
  surface: string
  border: string
}) {
  const [open, setOpen] = useState(false)
  if (nav.length === 0) return null

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={open}
        className="flex items-center justify-center w-9 h-9"
        style={{ color }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={1.8} strokeLinecap="round" aria-hidden>
          {open ? (
            <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>
          ) : (
            <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>
          )}
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-40"
          style={{ background: surface, borderBottom: `1px solid ${border}` }}
        >
          <nav className="flex flex-col px-4 sm:px-8 py-1">
            {nav.map(n => (
              <a
                key={`${n.href}-${n.label}`}
                href={n.href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm border-b last:border-b-0"
                style={{ color, borderColor: border }}
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}
