import type { DesignTheme, FontPair, Radius, Density } from './types'

/**
 * Pares de fonte curados. Fase 1 usa stacks web-safe (zero risco de
 * carregamento); fontes premium via next/font ficam pra uma proxima passada.
 */
export const FONT_PAIRS: Record<FontPair, { heading: string; body: string }> = {
  elegant: {
    heading: "'Georgia', 'Times New Roman', serif",
    body:    "'Georgia', 'Times New Roman', serif",
  },
  modern: {
    heading: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    body:    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  bold: {
    heading: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
    body:    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  classic: {
    heading: "'Times New Roman', Georgia, serif",
    body:    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
}

const RADIUS_PX: Record<Radius, number> = { none: 0, sm: 6, md: 12, lg: 20 }

/** Escala de espacamento (px) por densidade. */
const DENSITY: Record<Density, { gap: number; sectionY: number }> = {
  compact:  { gap: 10, sectionY: 40 },
  cozy:     { gap: 16, sectionY: 60 },
  spacious: { gap: 24, sectionY: 88 },
}

export function radiusPx(theme: DesignTheme): number {
  return RADIUS_PX[theme.radius] ?? RADIUS_PX.md
}

export function density(theme: DesignTheme): { gap: number; sectionY: number } {
  return DENSITY[theme.density] ?? DENSITY.cozy
}

export function fonts(theme: DesignTheme): { heading: string; body: string } {
  return FONT_PAIRS[theme.fontPair] ?? FONT_PAIRS.modern
}

/** Mistura um hex com transparencia: '#00E5FF' + 0.1 -> '#00E5FF1a'. */
export function alpha(hex: string, a: number): string {
  const clamped = Math.max(0, Math.min(1, a))
  const hh = Math.round(clamped * 255).toString(16).padStart(2, '0')
  return `${hex}${hh}`
}
