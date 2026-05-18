/**
 * Receita de design da Loja Própria — Tema Premium.
 *
 * Documento estruturado que descreve o visual e o layout da vitrine:
 * tema, efeitos globais e a lista ordenada de seções ricas.
 */

export type ThemeMode = 'dark' | 'light'
export type FontPair  = 'elegant' | 'modern' | 'bold' | 'classic' | 'editorial' | 'playful'
export type Radius    = 'none' | 'sm' | 'md' | 'lg'
export type Density   = 'compact' | 'cozy' | 'spacious'

export interface DesignColors {
  background: string  // fundo da pagina
  surface:    string  // fundo de cards / blocos
  primary:    string  // cor de destaque (botoes, preco, links)
  text:       string  // texto forte
  textMuted:  string  // texto secundario
  border:     string  // bordas e divisorias
  /** Premium: fundo escuro de banners (announcement, marquee). */
  dark?:      string
  /** Premium: cor do texto-watermark gigante ao fundo das seções. */
  watermark?: string
  /** Premium: cor do texto sobre a cor primária (ex.: dentro de botões). */
  onAccent?:  string
}

/** Efeitos globais ligáveis da vitrine. */
export interface DesignEffects {
  scrollReveal:  boolean  // fade + slide-up das seções ao entrar na viewport
  watermarks:    boolean  // texto gigante de marca ao fundo das seções
  parallaxTilt:  boolean  // banners com inclinação/parallax no scroll
  hoverRollover: boolean  // troca de imagem do produto no hover
}

export interface DesignTheme {
  mode:     ThemeMode
  colors:   DesignColors
  fontPair: FontPair
  radius:   Radius
  density:  Density
  /** Efeitos globais (opcional — cai no padrão quando ausente). */
  effects?: DesignEffects
}

// ─────────────────────────────────────────────────────────────────────
// Seções do Tema Premium (estilo editorial/Renovate).
// ─────────────────────────────────────────────────────────────────────

/** Faixa superior com mensagem + countdown opcional. */
export interface AnnouncementBarSection {
  type:         'announcementBar'
  message:      string
  ctaLabel?:    string
  ctaHref?:     string
  /** ISO date — quando preenchido, renderiza um countdown até essa data. */
  countdownTo?: string | null
}

/** Cabeçalho rico — sticky, logo, navegação, ícones de busca/carrinho. */
export interface SiteHeaderSection {
  type:       'siteHeader'
  variant:    'centered' | 'split'   // logo central vs logo à esquerda
  sticky:     boolean
  showSearch: boolean
  showCart:   boolean
  nav:        Array<{ label: string; href: string }>
}

/** Hero com carrossel de cards verticais (coverflow) + watermark gigante. */
export interface HeroPortraitSection {
  type:         'heroPortrait'
  watermark?:   string
  headline:     string
  subheadline?: string
  ctaLabel?:    string
  slides:       Array<{ imageUrl: string; label?: string; href?: string }>
}

/** Vitrine de produtos — carrossel ou grade. Cobre "shop by room" e "trending". */
export interface ProductShowcaseSection {
  type:          'productShowcase'
  layout:        'carousel' | 'grid'
  title:         string
  watermark?:    string
  /** Origem dos produtos. */
  source:        'storefront' | 'collection' | 'manual'
  collectionId?: string | null
  productIds?:   string[]
  columns?:      { mobile: number; tablet: number; desktop: number }
}

/** Imagem de ambiente com pontos clicáveis (hotspots) que abrem produtos. */
export interface ImageHotspotSection {
  type:     'imageHotspot'
  title?:   string
  imageUrl: string
  hotspots: Array<{ xPct: number; yPct: number; productId?: string; label?: string }>
}

/** Grade de categorias/coleções com thumbnail e contagem. */
export interface CategoryGridSection {
  type:       'categoryGrid'
  title:      string
  watermark?: string
  categories: Array<{ label: string; imageUrl: string; href?: string; count?: number }>
}

/** Banner de imagem cheia com efeito de inclinação/parallax no scroll. */
export interface TiltBannerSection {
  type:       'tiltBanner'
  imageUrl:   string
  watermark?: string
  headline?:  string
}

/** Banner panorâmico com título centralizado e CTA pill. */
export interface FullBannerSection {
  type:         'fullBanner'
  imageUrl:     string
  headline:     string
  subheadline?: string
  ctaLabel?:    string
  ctaHref?:     string
}

/** Faixa diagonal com texto rolando em loop (ticker). */
export interface MarqueeSection {
  type:  'marquee'
  items: string[]
}

/** Bloco editorial — texto de um lado, imagem do outro. */
export interface EditorialSplitSection {
  type:       'editorialSplit'
  title:      string
  body:       string
  imageUrl:   string
  imageSide:  'left' | 'right'
  ctaLabel?:  string
  ctaHref?:   string
}

/** Rodapé rico — colunas de links, newsletter, redes sociais. */
export interface SiteFooterSection {
  type:        'siteFooter'
  variant:     'minimal' | 'columns'
  columns?:    Array<{ title: string; links: Array<{ label: string; href: string }> }>
  newsletter?: boolean
}

export type Section =
  | AnnouncementBarSection
  | SiteHeaderSection
  | HeroPortraitSection
  | ProductShowcaseSection
  | ImageHotspotSection
  | CategoryGridSection
  | TiltBannerSection
  | FullBannerSection
  | MarqueeSection
  | EditorialSplitSection
  | SiteFooterSection

export type SectionType = Section['type']

export interface ProductPageDesign {
  gallery:        'side' | 'top'      // galeria ao lado (desktop) ou no topo
  showAttributes: boolean
  ctaMode:        'whatsapp' | 'cart' // 'cart' fica pra fase transacional
}

export interface StorefrontDesign {
  /** Sempre 2 — versão do esquema da receita de design. */
  version:  2
  theme:    DesignTheme
  sections: Section[]
  product:  ProductPageDesign
}
