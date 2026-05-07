'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Theme provider — gerencia tema claro/escuro do app.
 *
 * Estratégia:
 *  - Estado vive em React Context + persistência em localStorage (chave
 *    'eclick-theme'). Sem dependência externa (next-themes etc).
 *  - Aplica `data-theme="light"` ou `data-theme="dark"` no <html> root.
 *  - CSS variables em globals.css reagem ao atributo (var(--background)
 *    troca por tema).
 *  - SSR-safe: mounted gate evita hydration mismatch (server renderiza
 *    sem saber a preferência do user; primeira pintura usa `dark` default,
 *    depois useEffect re-aplica).
 *
 * IMPORTANTE — cobertura parcial: a maioria dos componentes do app
 * ainda tem cores HARDCODED (#0d0d10, zinc-900, #1a1a1f). O toggle só
 * troca o chrome (Header/Sidebar/body bg) + componentes que migrarem
 * pra usar var(--*). Migração é incremental por página.
 */

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme:    Theme
  setTheme: (t: Theme) => void
  toggle:   () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'eclick-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark') // SSR default
  const [mounted, setMounted]  = useState(false)

  // Hidrata do localStorage no mount — antes disso, mantém 'dark' pra
  // não quebrar SSR.
  useEffect(() => {
    const saved = (typeof window !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEY) as Theme | null)
      : null) ?? 'dark'
    setThemeState(saved)
    setMounted(true)
  }, [])

  // Aplica no <html> e persiste sempre que muda
  useEffect(() => {
    if (!mounted) return
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme, mounted])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggle   = () => setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
  return ctx
}
