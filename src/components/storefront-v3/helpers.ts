/**
 * Helpers do renderizador v3 — funcoes puras, sem React.
 *
 * Centralizam a logica de:
 *  - aplicar mobileOverrides (mescla deep com defaults)
 *  - computar style CSS de uma section (spacing + background)
 *  - resolver cores/fontes/raios do tema
 *
 * O renderizador faz UMA arvore (server-side) — variacoes mobile entram
 * via Tailwind `md:`/`lg:` ou via `@container`. Mobile-first: base = mobile.
 */

import type {
  Section, Block, ThemeV3, BackgroundStyle, Spacing,
} from '@/lib/storefront/v3/types'

// ─────────────────────────────────────────────────────────────────────────
// Merge profundo para mobileOverrides
// ─────────────────────────────────────────────────────────────────────────

/** Merge raso suficiente pros nossos shapes (settings sao 1 nivel). */
function mergeShallow<T>(base: T, ov?: Partial<T>): T {
  if (!ov) return base
  return { ...base, ...ov }
}

// ─────────────────────────────────────────────────────────────────────────
// Apply overrides de mobile (consumer escolhe se chama)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Retorna a section com settings/spacing/background merged caso o consumer
 * queira a versao "mobile" — usado tipicamente em preview do editor pra
 * variante mobile. No renderizador SSR principal, NAO chamamos isso porque
 * Tailwind/CSS resolve responsivo nativamente.
 */
export function withMobile<S extends Section>(s: S): S {
  const ov = s.mobileOverrides
  if (!ov) return s
  return {
    ...s,
    settings:   mergeShallow(s.settings as Record<string, unknown>, ov.settings as Record<string, unknown> | undefined) as S['settings'],
    spacing:    mergeShallow(s.spacing,    ov.spacing),
    background: mergeShallow(s.background, ov.background),
  }
}

export function withMobileBlock<B extends Block>(b: B): B {
  const ov = b.mobileOverrides
  if (!ov) return b
  return {
    ...b,
    settings: mergeShallow(b.settings as Record<string, unknown>, ov as Record<string, unknown>) as B['settings'],
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Estilo da section (spacing + background)
// ─────────────────────────────────────────────────────────────────────────

function bgStyle(bg: BackgroundStyle): React.CSSProperties {
  const s: React.CSSProperties = {}
  if (bg.kind === 'color' && bg.color) s.background = bg.color
  if (bg.kind === 'gradient' && bg.gradient) {
    const { from, to, angle = 180 } = bg.gradient
    s.background = `linear-gradient(${angle}deg, ${from}, ${to})`
  }
  if (bg.kind === 'image' && bg.imageUrl) {
    s.backgroundImage    = `url(${JSON.stringify(bg.imageUrl)})`
    s.backgroundSize     = 'cover'
    s.backgroundPosition = bg.imageFocus ?? 'center'
    s.backgroundRepeat   = 'no-repeat'
  }
  if (bg.kind === 'video' && bg.videoUrl) {
    // tratado pelo componente que sabe renderizar <video />; aqui so reserva area
  }
  return s
}

function spacingStyle(sp: Spacing): React.CSSProperties {
  return {
    paddingTop:    `${sp.paddingTop}px`,
    paddingBottom: `${sp.paddingBottom}px`,
    marginTop:     sp.marginTop ? `${sp.marginTop}px` : undefined,
    marginBottom:  sp.marginBottom ? `${sp.marginBottom}px` : undefined,
  }
}

export function sectionContainerStyle(s: Section): React.CSSProperties {
  return {
    ...bgStyle(s.background),
    ...spacingStyle(s.spacing),
    position: 'relative',
  }
}

/**
 * Gera CSS `<style>` content com @media (max-width: 767px) pra aplicar
 * mobileOverrides da section. Retorna null se nao ha override.
 *
 * Usa selector `[data-section-id="X"]` (que o SectionRenderer ja injeta
 * no markup). Aplica !important pra vencer o style inline do desktop.
 */
export function mobileOverrideCss(s: Section): string | null {
  const ov = s.mobileOverrides
  if (!ov) return null
  const rules: string[] = []

  if (ov.spacing) {
    if (typeof ov.spacing.paddingTop    === 'number') rules.push(`padding-top:    ${ov.spacing.paddingTop}px    !important;`)
    if (typeof ov.spacing.paddingBottom === 'number') rules.push(`padding-bottom: ${ov.spacing.paddingBottom}px !important;`)
    if (typeof ov.spacing.marginTop     === 'number') rules.push(`margin-top:     ${ov.spacing.marginTop}px     !important;`)
    if (typeof ov.spacing.marginBottom  === 'number') rules.push(`margin-bottom:  ${ov.spacing.marginBottom}px  !important;`)
  }
  if (ov.background) {
    if (ov.background.kind === 'color' && ov.background.color)   rules.push(`background: ${ov.background.color} !important;`)
    if (ov.background.kind === 'image' && ov.background.imageUrl) {
      rules.push(`background-image: url(${JSON.stringify(ov.background.imageUrl)}) !important;`)
      rules.push(`background-size: cover !important;`)
      rules.push(`background-position: ${ov.background.imageFocus ?? 'center'} !important;`)
      rules.push(`background-repeat: no-repeat !important;`)
    }
    if (ov.background.kind === 'gradient' && ov.background.gradient) {
      const { from, to, angle = 180 } = ov.background.gradient
      rules.push(`background: linear-gradient(${angle}deg, ${from}, ${to}) !important;`)
    }
  }
  if (rules.length === 0) return null
  return `@media (max-width: 767px) { [data-section-id="${s.id}"] { ${rules.join(' ')} } }`
}

/** Overlay (image/video) — retorna { color, opacity } prontos. */
export function backgroundOverlay(bg: BackgroundStyle): { color: string; opacity: number } | null {
  if ((bg.kind === 'image' || bg.kind === 'video') && bg.overlayColor && (bg.overlayOpacity ?? 0) > 0) {
    return { color: bg.overlayColor, opacity: Math.min(1, Math.max(0, bg.overlayOpacity ?? 0)) }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────
// Tema — helpers de cor/fonte/raio
// ─────────────────────────────────────────────────────────────────────────

const RADIUS_PX: Record<ThemeV3['radius'], string> = {
  none: '0',
  sm:   '6px',
  md:   '12px',
  lg:   '20px',
  full: '9999px',
}

const DENSITY: Record<ThemeV3['density'], { gap: string; sectionY: string }> = {
  compact:  { gap: '10px', sectionY: '40px' },
  cozy:     { gap: '16px', sectionY: '60px' },
  spacious: { gap: '24px', sectionY: '88px' },
}

export function radius(theme: ThemeV3): string { return RADIUS_PX[theme.radius] ?? RADIUS_PX.md }
export function density(theme: ThemeV3): { gap: string; sectionY: string } { return DENSITY[theme.density] ?? DENSITY.cozy }

/** Cor sobre fundo primary (com fallback de contraste). */
export function onAccent(theme: ThemeV3): string {
  if (theme.colors.onAccent) return theme.colors.onAccent
  return bestContrast(theme.colors.primary)
}

export function bestContrast(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#111111' : '#ffffff'
}

// ─────────────────────────────────────────────────────────────────────────
// Google Fonts URL — usa dicionario central de font-pairs.ts (30 pares).
// ─────────────────────────────────────────────────────────────────────────

import { getFontPairDef } from '@/lib/storefront/v3/font-pairs'

export function fonts(theme: ThemeV3): { heading: string; body: string } {
  const def = getFontPairDef(theme.fontPair)
  if (theme.customFonts?.heading || theme.customFonts?.body) {
    return {
      heading: theme.customFonts.heading || def.heading,
      body:    theme.customFonts.body    || def.body,
    }
  }
  return { heading: def.heading, body: def.body }
}

export function googleFontsHref(theme: ThemeV3): string {
  const families = (theme.customFonts?.googleFamilies && theme.customFonts.googleFamilies.length > 0)
    ? theme.customFonts.googleFamilies
    : getFontPairDef(theme.fontPair).google
  return `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`
}

/** Variaveis CSS pra usar em escopo do tema. */
export function themeCssVars(theme: ThemeV3): React.CSSProperties {
  const f = fonts(theme)
  return {
    ['--c-bg' as string]:         theme.colors.background,
    ['--c-surface' as string]:    theme.colors.surface,
    ['--c-primary' as string]:    theme.colors.primary,
    ['--c-text' as string]:       theme.colors.text,
    ['--c-text-muted' as string]: theme.colors.textMuted,
    ['--c-border' as string]:     theme.colors.border,
    ['--c-dark' as string]:       theme.colors.dark ?? '#111111',
    ['--c-on-accent' as string]:  onAccent(theme),
    ['--c-success' as string]:    theme.colors.success ?? '#22c55e',
    ['--c-error' as string]:      theme.colors.error   ?? '#ef4444',
    ['--c-warning' as string]:    theme.colors.warning ?? '#eab308',
    ['--r' as string]:            radius(theme),
    ['--f-heading' as string]:    f.heading,
    ['--f-body' as string]:       f.body,
  }
}
