/**
 * Receita de design da Loja Própria.
 *
 * Documento estruturado que descreve o visual e o layout da vitrine.
 * A Fase 1 entrega os tipos + modelos estaticos; na Fase 2 a IA passa
 * a preencher este objeto a partir de um prompt + modelo de inspiracao.
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
}

export interface DesignTheme {
  mode:     ThemeMode
  colors:   DesignColors
  fontPair: FontPair
  radius:   Radius
  density:  Density
}

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

export type Section =
  | HeaderSection
  | HeroSection
  | CollectionsSection
  | ProductGridSection
  | AboutSection
  | FooterSection

export interface ProductPageDesign {
  gallery:        'side' | 'top'      // galeria ao lado (desktop) ou no topo
  showAttributes: boolean
  ctaMode:        'whatsapp' | 'cart' // 'cart' fica pra fase transacional
}

export interface StorefrontDesign {
  version:  1
  theme:    DesignTheme
  sections: Section[]
  product:  ProductPageDesign
}
