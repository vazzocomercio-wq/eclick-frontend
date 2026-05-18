import type { DesignTheme, FontPair, Radius, Density } from './types'

/**
 * Pares de fonte curados — Google Fonts reais carregados sob demanda.
 * Cada par tem heading + body (CSS font-family), as familias Google pra
 * montar o <link> e um rotulo pro editor.
 */
export interface FontPairDef {
  label:   string
  heading: string
  body:    string
  /** Familias no formato do parametro `family` do Google Fonts css2. */
  google:  string[]
}

export const FONT_PAIRS: Record<FontPair, FontPairDef> = {
  elegant: {
    label:   'Elegante',
    heading: "'Playfair Display', Georgia, serif",
    body:    "'Lora', Georgia, serif",
    google:  ['Playfair+Display:wght@600;700', 'Lora:wght@400;500'],
  },
  modern: {
    label:   'Moderna',
    heading: "'Space Grotesk', system-ui, sans-serif",
    body:    "'Inter', system-ui, sans-serif",
    google:  ['Space+Grotesk:wght@500;700', 'Inter:wght@400;500'],
  },
  bold: {
    label:   'Marcante',
    heading: "'Archivo Black', 'Arial Black', sans-serif",
    body:    "'Inter', system-ui, sans-serif",
    google:  ['Archivo+Black', 'Inter:wght@400;600'],
  },
  classic: {
    label:   'Clássica',
    heading: "'Libre Baskerville', Georgia, serif",
    body:    "'Inter', system-ui, sans-serif",
    google:  ['Libre+Baskerville:wght@700', 'Inter:wght@400;500'],
  },
  editorial: {
    label:   'Editorial',
    heading: "'DM Serif Display', Georgia, serif",
    body:    "'Inter', system-ui, sans-serif",
    google:  ['DM+Serif+Display', 'Inter:wght@400;500'],
  },
  playful: {
    label:   'Descontraída',
    heading: "'Poppins', system-ui, sans-serif",
    body:    "'Nunito Sans', system-ui, sans-serif",
    google:  ['Poppins:wght@600;700', 'Nunito+Sans:wght@400;600'],
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
  const def = FONT_PAIRS[theme.fontPair] ?? FONT_PAIRS.modern
  return { heading: def.heading, body: def.body }
}

/** URL do Google Fonts css2 pras familias do par de fonte do tema. */
export function googleFontsHref(theme: DesignTheme): string {
  const def = FONT_PAIRS[theme.fontPair] ?? FONT_PAIRS.modern
  const families = def.google.map(f => `family=${f}`).join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

/** Mistura um hex com transparencia: '#00E5FF' + 0.1 -> '#00E5FF1a'. */
export function alpha(hex: string, a: number): string {
  const clamped = Math.max(0, Math.min(1, a))
  const hh = Math.round(clamped * 255).toString(16).padStart(2, '0')
  return `${hex}${hh}`
}
