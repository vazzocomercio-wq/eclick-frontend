import { resolveDesign, type StorefrontStore } from '@/lib/storefront/v3/data'
import { getFontPairDef, FONT_PAIRS_V3, type FontPair } from '@/lib/storefront/v3/font-pairs'
import { googleFontsHref } from '@/lib/storefront/blog'
import type { BlogColors } from './StoreBlogBody'

function isFontPair(v: string | null | undefined): v is FontPair {
  return !!v && (FONT_PAIRS_V3 as readonly string[]).includes(v)
}

const DEFAULT_COLORS: BlogColors = {
  text: '#18181b',
  textMuted: '#71717a',
  primary: '#2563eb',
  surface: '#f8f8f9',
  border: 'rgba(0,0,0,0.10)',
  onAccent: '#ffffff',
}

export interface BlogTheme {
  colors: BlogColors
  background: string
  headingFamily: string
  bodyFamily: string
  fontHref: string | null
}

/**
 * Deriva o tema do blog (cores + fontes) do design da loja. `blogFont` (key de
 * fontPair, escolhida no Estúdio) sobrescreve as fontes do tema quando setada.
 */
export function resolveBlogTheme(store: StorefrontStore | null, blogFont?: string | null): BlogTheme {
  const resolved = resolveDesign(store)
  if (resolved.version === 3) {
    const t = resolved.design.theme
    const c = t.colors
    const pair = getFontPairDef(isFontPair(blogFont) ? blogFont : t.fontPair)
    return {
      colors: {
        text: c.text,
        textMuted: c.textMuted,
        primary: c.primary,
        surface: c.surface,
        border: c.border,
        onAccent: c.onAccent ?? '#ffffff',
      },
      background: c.background,
      headingFamily: pair.heading,
      bodyFamily: pair.body,
      fontHref: googleFontsHref(pair.google),
    }
  }
  // v2 / sem design → paleta + fonte padrão limpa (ou a escolhida no Estúdio)
  const pair = getFontPairDef(isFontPair(blogFont) ? blogFont : 'modern')
  return {
    colors: DEFAULT_COLORS,
    background: '#ffffff',
    headingFamily: pair.heading,
    bodyFamily: pair.body,
    fontHref: googleFontsHref(pair.google),
  }
}
