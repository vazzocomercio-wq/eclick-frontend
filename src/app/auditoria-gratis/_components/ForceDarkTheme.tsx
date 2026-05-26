'use client'

/**
 * A landing é uma superfície de marketing sempre escura (estética Profound +
 * marca e-Click). Visitante anônimo já cai em dark por padrão, mas um usuário
 * logado que escolheu tema claro veria as cores invertidas pelo override global
 * de light-mode. Este componente força data-theme="dark" enquanto a landing
 * está montada e restaura a preferência do usuário ao sair.
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
