'use client'

/**
 * O blog é superfície de marketing sempre escura (estética Profound + marca
 * e-Click). Força data-theme="dark" enquanto montado e restaura ao sair —
 * mesmo padrão da landing /auditoria-gratis.
 */
import { useEffect } from 'react'

export function ForceDarkTheme() {
  useEffect(() => {
    const root = document.documentElement
    const prev = root.getAttribute('data-theme')
    root.setAttribute('data-theme', 'dark')
    root.style.colorScheme = 'dark'
    return () => {
      if (prev) {
        root.setAttribute('data-theme', prev)
        root.style.colorScheme = prev
      }
    }
  }, [])
  return null
}
