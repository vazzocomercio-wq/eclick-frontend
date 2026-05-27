import { resolveDesign, type StorefrontStore } from '@/lib/storefront/v3/data'
import { getFontPairDef } from '@/lib/storefront/v3/font-pairs'
import { googleFontsHref } from '@/lib/storefront/blog'
import type { BlogColors } from './StoreBlogBody'

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

/** Deriva o tema do blog (cores + fontes) do design da loja. Fallback limpo. */
export function resolveBlogTheme(store: StorefrontStore | null): BlogTheme {
  const resolved = resolveDesign(store)
  if (resolved.version === 3) {
    const t = resolved.design.theme
    const c = t.colors
    const pair = getFontPairDef(t.fontPair)
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
  // v2 / sem design → paleta + fonte padrão limpa
  const pair = getFontPairDef('modern')
  return {
    colors: DEFAULT_COLORS,
    background: '#ffffff',
    headingFamily: pair.heading,
    bodyFamily: pair.body,
    fontHref: googleFontsHref(pair.google),
  }
}
