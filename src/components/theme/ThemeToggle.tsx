'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from './ThemeProvider'

/**
 * Botão de troca de tema (claro/escuro). Mostra Sun no dark (clicar →
 * vai pra light) e Moon no light (clicar → vai pra dark) — ícone indica
 * o destino, não o estado atual. Padrão consagrado em VS Code/GitHub.
 *
 * Visual segue o estilo dos outros botões do Header (h-7, hover sutil).
 */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className="flex items-center justify-center w-7 h-7 rounded-md text-zinc-500 transition-colors hover:text-zinc-300 hover:bg-white/5 dark:hover:bg-white/5"
    >
      {isDark
        ? <Sun  size={14} />
        : <Moon size={14} />}
    </button>
  )
}
