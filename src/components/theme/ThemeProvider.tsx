'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Theme provider — gerencia tema claro/escuro do app.
 *
 * Estratégia:
 *  - Estado vive em React Context + persistência em localStorage (chave
 *    'eclick-theme'). Sem dependência externa (next-themes etc).
 *  - Aplica `data-theme="light"` ou `data-theme="dark"` no <html> root.
 *  - CSS variables em globals.css reagem ao atributo.
 *  - SSR-safe: mounted gate evita hydration mismatch.
 *  - Em light mode, runtime mutator (lightModeMutator()) varre o DOM e
 *    limpa inline styles com cores escuras hardcoded, deixando as CSS
 *    rules do tema (.bg-zinc-900 -> var(--surface), etc) ganharem.
 *    Isso resolve o caso onde o browser converte hex pra rgb(...) na
 *    serializacao do atributo style, quebrando [style*="#XXX"] selectors.
 */

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme:    Theme
  setTheme: (t: Theme) => void
  toggle:   () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'eclick-theme'

// ────────────────────────────────────────────────────────────────────────
// lightModeMutator — varre o DOM e neutraliza inline styles com cores
// escuras hardcoded em light mode. Resolve o caso onde React/browser
// serializa hex como rgb(...), quebrando selectors [style*="#XXX"].
//
// Estrategia: parseia element.style.backgroundColor e borderColor; se
// for uma das cores escuras conhecidas, REMOVE a propriedade do inline
// style. Como CSS classes no globals.css ja tem regras de fallback
// (.bg-zinc-900 -> var(--surface) etc), o tema light se aplica corretamente.
//
// Para elementos que SO tem cor inline (sem class), seta var(--surface)
// como fallback explicito.
// ────────────────────────────────────────────────────────────────────────

const DARK_BG_RGB = new Set([
  'rgb(7, 7, 9)',     'rgb(9, 9, 11)',    'rgb(10, 10, 12)',  'rgb(10, 10, 13)',
  'rgb(10, 10, 14)',  'rgb(12, 12, 14)',  'rgb(12, 12, 15)',  'rgb(12, 12, 16)',
  'rgb(13, 13, 16)',  'rgb(14, 14, 17)',  'rgb(14, 14, 18)',  'rgb(15, 15, 18)',
  'rgb(17, 17, 20)',  'rgb(22, 22, 24)',  'rgb(24, 24, 27)',  'rgb(26, 26, 31)',
  'rgb(28, 28, 31)',  'rgb(30, 30, 36)',  'rgb(6, 13, 20)',   'rgb(10, 21, 32)',
  'rgb(10, 26, 26)',  'rgb(10, 58, 53)',  'rgb(13, 26, 13)',  'rgb(13, 26, 26)',
  'rgb(13, 31, 23)',  'rgb(9, 20, 9)',    'rgb(9, 20, 20)',   'rgb(26, 10, 10)',
  'rgb(0, 0, 0)',     'rgb(39, 39, 42)',  // black + zinc-800 as bg
])

const DARK_BORDER_RGB = new Set([
  'rgb(19, 78, 72)',  'rgb(26, 26, 31)',  'rgb(30, 30, 36)',  'rgb(39, 39, 42)',
  'rgb(42, 42, 48)',  'rgb(42, 42, 63)',  'rgb(46, 46, 51)',  'rgb(63, 63, 70)',
])

const DARK_TEXT_RGB = new Set([
  'rgb(255, 255, 255)', 'rgb(250, 250, 250)', 'rgb(244, 244, 245)',
  'rgb(228, 228, 231)',
])

// Substrings de cores escuras que aparecem em gradients (linear-gradient,
// radial-gradient). Quando style.background = 'linear-gradient(...)' tem
// alguma dessas, toda a stack de gradient eh substituida por var(--surface).
const DARK_GRADIENT_PATTERNS = [
  'rgb(7, 7, 9)',     'rgb(9, 9, 11)',    'rgb(10, 10, 12)',  'rgb(10, 10, 13)',
  'rgb(10, 10, 14)',  'rgb(12, 12, 14)',  'rgb(12, 12, 15)',  'rgb(12, 12, 16)',
  'rgb(13, 13, 16)',  'rgb(13, 17, 23)',  'rgb(14, 14, 17)',  'rgb(14, 14, 18)',
  'rgb(15, 15, 18)',  'rgb(17, 17, 20)',  'rgb(22, 22, 24)',  'rgb(24, 24, 27)',
  'rgb(26, 26, 31)',  'rgb(28, 28, 31)',  'rgb(30, 30, 36)',  'rgb(0, 0, 0)',
]

function hasDarkGradient(value: string): boolean {
  if (!value) return false
  // gradient lookup via includes (rgb forms)
  for (const p of DARK_GRADIENT_PATTERNS) {
    if (value.includes(p)) return true
  }
  return false
}

// Marca elementos modificados pra que possamos restaurar no toggle dark.
// Guarda o valor original do inline style num data-attr.
const MUTATED_ATTR = 'data-eclick-mutated'

function processElement(el: HTMLElement) {
  let mutated = false

  // 1) background-color liso
  const bg = el.style.backgroundColor
  if (bg && DARK_BG_RGB.has(bg)) {
    // setProperty + 'important' garante que o inline style tem prioridade
    // e CSS vars sao aceitos sem rejeicao do parser (alguns browsers
    // descartam el.style.backgroundColor='var(--surface)' silenciosamente)
    el.style.setProperty('background-color', 'var(--surface)', 'important')
    mutated = true
  }

  // 2) background-image (gradients) — quando style.background = 'linear-gradient(...)'
  //    o gradient vai pro backgroundImage. Se contem cor escura, neutraliza.
  const bgImage = el.style.backgroundImage
  if (bgImage && bgImage !== 'none' && hasDarkGradient(bgImage)) {
    el.style.setProperty('background-image', 'none', 'important')
    el.style.setProperty('background-color', 'var(--surface)', 'important')
    mutated = true
  }

  // 3) borders
  const border = el.style.borderColor
  if (border && DARK_BORDER_RGB.has(border)) {
    el.style.setProperty('border-color', 'var(--border)', 'important')
    mutated = true
  }
  for (const side of ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'] as const) {
    const v = el.style[side]
    if (v && DARK_BORDER_RGB.has(v)) {
      const cssProp = side.replace(/([A-Z])/g, '-$1').toLowerCase()
      el.style.setProperty(cssProp, 'var(--border)', 'important')
      mutated = true
    }
  }

  // 4) text
  const color = el.style.color
  if (color && DARK_TEXT_RGB.has(color)) {
    el.style.setProperty('color', 'var(--text)', 'important')
    mutated = true
  }

  if (mutated) el.setAttribute(MUTATED_ATTR, '1')
}

function walkAll(root: Node) {
  if (!(root instanceof HTMLElement)) return
  processElement(root)
  // querySelectorAll é mais rapido que TreeWalker pra esse caso
  const all = root.querySelectorAll<HTMLElement>('*')
  for (let i = 0; i < all.length; i++) processElement(all[i]!)
}

const lightModeMutator = (() => {
  let observer: MutationObserver | null = null
  return {
    start() {
      if (typeof document === 'undefined') return
      // Roda 1 vez agora
      walkAll(document.body)
      // Observa mudancas pra pegar elementos novos (SPA nav, modals, etc)
      if (observer) return
      observer = new MutationObserver(mutations => {
        for (const m of mutations) {
          if (m.type === 'childList') {
            for (const node of m.addedNodes) walkAll(node)
          } else if (m.type === 'attributes' && m.target instanceof HTMLElement) {
            processElement(m.target)
          }
        }
      })
      observer.observe(document.body, {
        childList:      true,
        subtree:        true,
        attributes:     true,
        attributeFilter: ['style'],
      })
    },
    stop() {
      if (observer) {
        observer.disconnect()
        observer = null
      }
    },
  }
})()

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

    // Em light mode, neutraliza inline styles com cores escuras hardcoded.
    // Funciona como fallback pra paginas que ainda usam style={{ background:
    // '#0c0c10' }} em vez de var(--surface). Roda apos cada render via
    // MutationObserver pra pegar elementos novos (SPA navigation).
    if (theme === 'light') {
      lightModeMutator.start()
    } else {
      lightModeMutator.stop()
    }
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
