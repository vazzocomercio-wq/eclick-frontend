/**
 * Catálogo de fontes de título do blog (estilo Store Builder: Google Fonts via
 * <link>, agrupadas por estilo). A fonte aplicada nos títulos é controlada pela
 * var CSS `--font-display` (ver BLOG_CSS em tokens.ts).
 *
 * - O blog-wide default vem de siteSettings.blogDisplayFont (escolhido no Estúdio).
 * - Cada post pode sobrescrever via post.displayFont.
 * - Carregamento: o layout/post renderizam só o <link> da fonte aplicada
 *   (visitante baixa 1 família, não o catálogo todo). Clash Display é local.
 *
 * ⚠️ Os slugs DEVEM bater com o backend (eclick-active .../blog-fonts.ts).
 */
import localFont from 'next/font/local'

// Clash Display — local (análogo livre da Agrandir). Default histórico.
const clash = localFont({
  src: [
    { path: './clash-display-400.woff2', weight: '400', style: 'normal' },
    { path: './clash-display-500.woff2', weight: '500', style: 'normal' },
    { path: './clash-display-600.woff2', weight: '600', style: 'normal' },
    { path: './clash-display-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-clash',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'sans-serif'],
})

/** className do Clash pra declarar a var --font-clash (aplicar no container). */
export const CLASH_CLASSNAME = clash.variable

export interface BlogFont {
  slug: string
  label: string
  /** valor pra `--font-display` (CSS font-family). Clash usa a var local. */
  family: string
  /** parâmetro `family` do Google Fonts CSS2 (null = local, sem fetch). */
  google: string | null
  group: string
}

/** Catálogo (1ª = default/fallback = Clash). Slugs batem com o Active. */
export const BLOG_FONTS: BlogFont[] = [
  // ── Moderno (sans geométricas/tech) ───────────────────────────────
  { slug: 'clash',         label: 'Clash Display', family: 'var(--font-clash)',                 google: null,                                  group: 'Moderno' },
  { slug: 'space-grotesk', label: 'Space Grotesk', family: "'Space Grotesk', sans-serif",       google: 'Space+Grotesk:wght@400;500;600;700',  group: 'Moderno' },
  { slug: 'sora',          label: 'Sora',          family: "'Sora', sans-serif",                google: 'Sora:wght@400;500;600;700',           group: 'Moderno' },
  { slug: 'manrope',       label: 'Manrope',       family: "'Manrope', sans-serif",             google: 'Manrope:wght@400;500;600;700',        group: 'Moderno' },
  { slug: 'outfit',        label: 'Outfit',        family: "'Outfit', sans-serif",              google: 'Outfit:wght@400;500;600;700',         group: 'Moderno' },
  { slug: 'dm-sans',       label: 'DM Sans',       family: "'DM Sans', sans-serif",             google: 'DM+Sans:wght@400;500;700',            group: 'Moderno' },
  { slug: 'inter-tight',   label: 'Inter Tight',   family: "'Inter Tight', sans-serif",         google: 'Inter+Tight:wght@400;500;600;700',    group: 'Moderno' },
  { slug: 'work-sans',     label: 'Work Sans',     family: "'Work Sans', sans-serif",           google: 'Work+Sans:wght@400;500;600;700',      group: 'Moderno' },
  { slug: 'lexend',        label: 'Lexend',        family: "'Lexend', sans-serif",              google: 'Lexend:wght@400;500;600;700',         group: 'Moderno' },
  { slug: 'chivo',         label: 'Chivo',         family: "'Chivo', sans-serif",               google: 'Chivo:wght@400;500;600;700',          group: 'Moderno' },
  { slug: 'archivo',       label: 'Archivo',       family: "'Archivo', sans-serif",             google: 'Archivo:wght@400;500;600;700',        group: 'Moderno' },
  { slug: 'mulish',        label: 'Mulish',        family: "'Mulish', sans-serif",              google: 'Mulish:wght@400;500;700',             group: 'Moderno' },
  { slug: 'public-sans',   label: 'Public Sans',   family: "'Public Sans', sans-serif",         google: 'Public+Sans:wght@400;500;700',        group: 'Moderno' },

  // ── Serifa (elegantes/editoriais) ─────────────────────────────────
  { slug: 'playfair',          label: 'Playfair Display',   family: "'Playfair Display', Georgia, serif",    google: 'Playfair+Display:wght@400;500;600;700', group: 'Serifa' },
  { slug: 'cormorant',         label: 'Cormorant Garamond', family: "'Cormorant Garamond', Georgia, serif",  google: 'Cormorant+Garamond:wght@400;500;600;700', group: 'Serifa' },
  { slug: 'cinzel',            label: 'Cinzel',             family: "'Cinzel', Georgia, serif",              google: 'Cinzel:wght@400;500;600;700',           group: 'Serifa' },
  { slug: 'bodoni',            label: 'Bodoni Moda',        family: "'Bodoni Moda', Georgia, serif",         google: 'Bodoni+Moda:wght@400;500;600;700',      group: 'Serifa' },
  { slug: 'dm-serif',          label: 'DM Serif Display',   family: "'DM Serif Display', Georgia, serif",    google: 'DM+Serif+Display',                      group: 'Serifa' },
  { slug: 'fraunces',          label: 'Fraunces',           family: "'Fraunces', Georgia, serif",            google: 'Fraunces:wght@400;500;600;700',         group: 'Serifa' },
  { slug: 'libre-baskerville', label: 'Libre Baskerville',  family: "'Libre Baskerville', Georgia, serif",   google: 'Libre+Baskerville:wght@400;700',        group: 'Serifa' },
  { slug: 'spectral',          label: 'Spectral',           family: "'Spectral', Georgia, serif",            google: 'Spectral:wght@400;500;600;700',         group: 'Serifa' },
  { slug: 'lora',              label: 'Lora',               family: "'Lora', Georgia, serif",                google: 'Lora:wght@400;500;600;700',             group: 'Serifa' },
  { slug: 'abril-fatface',     label: 'Abril Fatface',      family: "'Abril Fatface', Georgia, serif",       google: 'Abril+Fatface',                         group: 'Serifa' },
  { slug: 'italiana',          label: 'Italiana',           family: "'Italiana', Georgia, serif",            google: 'Italiana',                              group: 'Serifa' },

  // ── Marcante (display forte) ──────────────────────────────────────
  { slug: 'anton',         label: 'Anton',         family: "'Anton', sans-serif",               google: 'Anton',                               group: 'Marcante' },
  { slug: 'bebas',         label: 'Bebas Neue',    family: "'Bebas Neue', sans-serif",          google: 'Bebas+Neue',                          group: 'Marcante' },
  { slug: 'oswald',        label: 'Oswald',        family: "'Oswald', sans-serif",              google: 'Oswald:wght@400;500;600;700',         group: 'Marcante' },
  { slug: 'archivo-black', label: 'Archivo Black', family: "'Archivo Black', sans-serif",       google: 'Archivo+Black',                       group: 'Marcante' },
  { slug: 'unbounded',     label: 'Unbounded',     family: "'Unbounded', sans-serif",           google: 'Unbounded:wght@400;500;600;700',      group: 'Marcante' },
  { slug: 'syne',          label: 'Syne',          family: "'Syne', sans-serif",                google: 'Syne:wght@400;500;600;700',           group: 'Marcante' },
  { slug: 'righteous',     label: 'Righteous',     family: "'Righteous', sans-serif",           google: 'Righteous',                           group: 'Marcante' },
  { slug: 'exo2',          label: 'Exo 2',         family: "'Exo 2', sans-serif",               google: 'Exo+2:wght@400;500;600;700',          group: 'Marcante' },

  // ── Casual (arredondadas/amigáveis) ───────────────────────────────
  { slug: 'poppins',       label: 'Poppins',       family: "'Poppins', sans-serif",             google: 'Poppins:wght@400;500;600;700',        group: 'Casual' },
  { slug: 'quicksand',     label: 'Quicksand',     family: "'Quicksand', sans-serif",           google: 'Quicksand:wght@400;500;600;700',      group: 'Casual' },
  { slug: 'comfortaa',     label: 'Comfortaa',     family: "'Comfortaa', sans-serif",           google: 'Comfortaa:wght@400;500;700',          group: 'Casual' },
  { slug: 'nunito',        label: 'Nunito',        family: "'Nunito', sans-serif",              google: 'Nunito:wght@400;600;800',             group: 'Casual' },

  // ── Mais opções ───────────────────────────────────────────────────
  { slug: 'plus-jakarta', label: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif", google: 'Plus+Jakarta+Sans:wght@400;500;600;700', group: 'Moderno' },
  { slug: 'urbanist',     label: 'Urbanist',      family: "'Urbanist', sans-serif",            google: 'Urbanist:wght@400;500;600;700',       group: 'Moderno' },
  { slug: 'red-hat',      label: 'Red Hat Display', family: "'Red Hat Display', sans-serif",   google: 'Red+Hat+Display:wght@400;500;600;700', group: 'Moderno' },
  { slug: 'eb-garamond',  label: 'EB Garamond',   family: "'EB Garamond', Georgia, serif",     google: 'EB+Garamond:wght@400;500;600;700',    group: 'Serifa' },
  { slug: 'marcellus',    label: 'Marcellus',     family: "'Marcellus', Georgia, serif",       google: 'Marcellus',                           group: 'Serifa' },
  { slug: 'bitter',       label: 'Bitter',        family: "'Bitter', Georgia, serif",          google: 'Bitter:wght@400;500;600;700',         group: 'Serifa' },
  { slug: 'zilla-slab',   label: 'Zilla Slab',    family: "'Zilla Slab', Georgia, serif",      google: 'Zilla+Slab:wght@400;500;600;700',     group: 'Serifa' },
  { slug: 'teko',         label: 'Teko',          family: "'Teko', sans-serif",                google: 'Teko:wght@400;500;600;700',           group: 'Marcante' },
  { slug: 'fjalla',       label: 'Fjalla One',    family: "'Fjalla One', sans-serif",          google: 'Fjalla+One',                          group: 'Marcante' },
  { slug: 'staatliches',  label: 'Staatliches',   family: "'Staatliches', sans-serif",         google: 'Staatliches',                         group: 'Marcante' },
  { slug: 'alfa-slab',    label: 'Alfa Slab One', family: "'Alfa Slab One', Georgia, serif",   google: 'Alfa+Slab+One',                       group: 'Marcante' },
  { slug: 'fredoka',      label: 'Fredoka',       family: "'Fredoka', sans-serif",             google: 'Fredoka:wght@400;500;600;700',        group: 'Casual' },
  { slug: 'baloo',        label: 'Baloo 2',       family: "'Baloo 2', sans-serif",             google: 'Baloo+2:wght@400;500;600;700',        group: 'Casual' },
  { slug: 'varela-round', label: 'Varela Round',  family: "'Varela Round', sans-serif",        google: 'Varela+Round',                        group: 'Casual' },
]

/** Resolve uma entrada por slug (fallback no 1º = Clash). */
export function getBlogFont(slug?: string | null): BlogFont {
  const found = slug ? BLOG_FONTS.find((f) => f.slug === slug) : undefined
  return found ?? BLOG_FONTS[0]
}

/** Monta o href do Google Fonts CSS2 pra 1+ famílias (ignora null/local). */
export function googleFontsHref(googleParams: Array<string | null | undefined>): string | null {
  const params = googleParams.filter((p): p is string => !!p)
  if (!params.length) return null
  return `https://fonts.googleapis.com/css2?${params.map((p) => `family=${p}`).join('&')}&display=swap`
}
