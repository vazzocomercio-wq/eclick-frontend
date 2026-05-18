/**
 * Contexto de renderizacao da Loja Propria.
 *
 * Deriva do tema os tokens prontos pra uso (fontes resolvidas, raio em
 * px, espacamentos). Compartilhado entre o renderizador v1 e as secoes
 * premium v2.
 */

import type { DesignTheme } from '@/lib/storefront/types'
import { fonts, radiusPx, density } from '@/lib/storefront/theme'

export interface RenderCtx {
  theme:    DesignTheme
  fontH:    string
  fontB:    string
  radius:   number
  gap:      number
  padY:     number
  /** Preview no dashboard — desliga sticky/altura de viewport. */
  embedded: boolean
}

export function buildCtx(theme: DesignTheme, embedded = false): RenderCtx {
  const f = fonts(theme)
  const d = density(theme)
  return {
    theme,
    fontH:  f.heading,
    fontB:  f.body,
    radius: radiusPx(theme),
    gap:    d.gap,
    padY:   d.sectionY,
    embedded,
  }
}
