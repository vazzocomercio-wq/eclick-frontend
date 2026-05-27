/**
 * Catálogo de fontes de display do blog.
 *
 * A fonte aplicada nos títulos é controlada pela var CSS `--font-display`
 * (ver BLOG_CSS em tokens.ts). O layout define a var com a fonte PADRÃO do
 * blog (siteSettings.blogDisplayFont, escolhida no Estúdio do Active); cada
 * post pode sobrescrever via post.displayFont.
 *
 * Todas as Google Fonts entram com `preload: false` — só a família realmente
 * aplicada baixa o woff2; as outras ficam declaradas mas inertes. Assim dá pra
 * oferecer um catálogo grande sem pesar o carregamento.
 */
import localFont from 'next/font/local'
import {
  Space_Grotesk,
  Sora,
  Outfit,
  Manrope,
  Inter_Tight,
  Chivo,
  Archivo,
  Syne,
  Exo_2,
  Unbounded,
  Lexend,
} from 'next/font/google'

// Clash Display — local (análogo livre da Agrandir). Default histórico do blog.
// next/font exige args como OBJETO LITERAL (sem spread) — o transform do SWC
// precisa analisar estaticamente; por isso cada fonte repete subsets/display.
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

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-space-grotesk' })
const sora = Sora({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-sora' })
const outfit = Outfit({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-outfit' })
const manrope = Manrope({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-manrope' })
const interTight = Inter_Tight({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-inter-tight' })
const chivo = Chivo({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-chivo' })
const archivo = Archivo({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-archivo' })
const syne = Syne({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-syne' })
const exo2 = Exo_2({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-exo2' })
const unbounded = Unbounded({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-unbounded' })
const lexend = Lexend({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-lexend' })

export interface BlogFont {
  slug: string
  label: string
  /** valor pra `--font-display` (ex: 'var(--font-sora)'). */
  cssVar: string
  /** className do next/font (injeta o @font-face + define a var). */
  className: string
}

/** Catálogo (a 1ª é o default/fallback). Slugs batem com o Active. */
export const BLOG_FONTS: BlogFont[] = [
  { slug: 'clash', label: 'Clash Display', cssVar: 'var(--font-clash)', className: clash.variable },
  { slug: 'space-grotesk', label: 'Space Grotesk', cssVar: 'var(--font-space-grotesk)', className: spaceGrotesk.variable },
  { slug: 'sora', label: 'Sora', cssVar: 'var(--font-sora)', className: sora.variable },
  { slug: 'outfit', label: 'Outfit', cssVar: 'var(--font-outfit)', className: outfit.variable },
  { slug: 'manrope', label: 'Manrope', cssVar: 'var(--font-manrope)', className: manrope.variable },
  { slug: 'inter-tight', label: 'Inter Tight', cssVar: 'var(--font-inter-tight)', className: interTight.variable },
  { slug: 'chivo', label: 'Chivo', cssVar: 'var(--font-chivo)', className: chivo.variable },
  { slug: 'archivo', label: 'Archivo', cssVar: 'var(--font-archivo)', className: archivo.variable },
  { slug: 'syne', label: 'Syne', cssVar: 'var(--font-syne)', className: syne.variable },
  { slug: 'exo2', label: 'Exo 2', cssVar: 'var(--font-exo2)', className: exo2.variable },
  { slug: 'unbounded', label: 'Unbounded', cssVar: 'var(--font-unbounded)', className: unbounded.variable },
  { slug: 'lexend', label: 'Lexend', cssVar: 'var(--font-lexend)', className: lexend.variable },
]

/** Todas as classNames juntas (aplicar no container pra declarar as vars). */
export const BLOG_FONT_CLASSNAMES = BLOG_FONTS.map((f) => f.className).join(' ')

/** Resolve o valor de `--font-display` a partir do slug (fallback no 1º). */
export function fontCssVar(slug?: string | null): string {
  const found = slug ? BLOG_FONTS.find((f) => f.slug === slug) : undefined
  return (found ?? BLOG_FONTS[0]).cssVar
}
