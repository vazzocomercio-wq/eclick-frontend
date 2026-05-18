/**
 * Receita de design da Loja Própria.
 *
 * Documento estruturado que descreve o visual e o layout da vitrine.
 * v1 = esquema simples (Fases 1-9). v2 = Tema Premium (estilo editorial/
 * Renovate) — seções ricas com efeitos. O renderizador trata os dois.
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

/** Premium — efeitos globais ligáveis. v1 ignora (campo opcional). */
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
  /** Premium — efeitos globais (opcional; v1 não preenche). */
  effects?: DesignEffects
}

// ─────────────────────────────────────────────────────────────────────
// v1 — seções simples (Fases 1-9). Mantidas por compatibilidade.
// ─────────────────────────────────────────────────────────────────────

export interface HeaderSection {
  type:    'header'
  variant: 'minimal' | 'centered' | 'overlay'
}

export interface HeroSection {
  type:        'hero'
  variant:     'gradient' | 'image' | 'split'
  headline:    string
  subheadline: string
  ctaLabel:    string
  imageUrl?:   string | null
}

export interface CollectionsSection {
  type:    'collections'
  variant: 'strip' | 'grid'
  title:   string
}

export interface ProductGridSection {
  type:    'productGrid'
  variant: 'compact' | 'elevated' | 'editorial'
  title:   string
  columns: { mobile: number; tablet: number; desktop: number }
}

export interface AboutSection {
  type:    'about'
  variant: 'simple' | 'banner'
  title:   string
  body:    string
}

export interface FooterSection {
  type:    'footer'
  variant: 'minimal' | 'full'
}

// ─────────────────────────────────────────────────────────────────────
// v2 — Tema Premium (estilo editorial/Renovate). Seções ricas.
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
  // v1
  | HeaderSection
  | HeroSection
  | CollectionsSection
  | ProductGridSection
  | AboutSection
  | FooterSection
  // v2 premium
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
  /** 1 = esquema simples; 2 = Tema Premium. */
  version:  1 | 2
  theme:    DesignTheme
  sections: Section[]
  product:  ProductPageDesign
}
