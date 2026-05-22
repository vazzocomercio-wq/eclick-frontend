/**
 * Esquema v3 — receita de design da Loja Própria (Store Builder).
 *
 * Diferenças vs v2:
 *  - Section é container com `blocks` internos (estilo Shopify OS 2.0)
 *  - 5 páginas editáveis: home, product, collection, cart, checkout
 *  - Header/Footer são "globals" compartilhados entre páginas
 *  - mobileOverrides por seção e por bloco
 *  - Spacing/Background por seção
 *  - IDs uuid em seções e blocos (permite N do mesmo type)
 *
 * v2 (storefront/types.ts) continua vivo enquanto existirem lojas legado.
 */

// ─────────────────────────────────────────────────────────────────────────
// Tema
// ─────────────────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light'
// FontPair vem do dicionario central pra escalar sem alterar union manual.
export type { FontPair } from './font-pairs'
import type { FontPair as _FP } from './font-pairs'
type FontPair = _FP
export type Radius    = 'none' | 'sm' | 'md' | 'lg' | 'full'
export type Density   = 'compact' | 'cozy' | 'spacious'
export type ButtonStyleKind = 'solid' | 'outline' | 'pill' | 'sharp'
export type ButtonWeight    = 'normal' | 'bold'

export interface DesignColorsV3 {
  background: string
  surface:    string
  primary:    string
  text:       string
  textMuted:  string
  border:     string
  /** Fundo escuro de banners (announcement, marquee). */
  dark?:      string
  /** Cor do texto-watermark gigante ao fundo das seções. */
  watermark?: string
  /** Cor do texto sobre `primary` (ex.: dentro de botões). */
  onAccent?:  string
  /** Semânticos — feedback de UI. */
  success?:   string
  error?:     string
  warning?:   string
}

export interface DesignEffects {
  scrollReveal:  boolean
  watermarks:    boolean
  parallaxTilt:  boolean
  hoverRollover: boolean
}

export interface ThemeButtons {
  style:  ButtonStyleKind
  weight: ButtonWeight
}

export interface ThemeV3 {
  mode:     ThemeMode
  colors:   DesignColorsV3
  fontPair: FontPair
  /** Override premium — quando preenchido, sobrescreve as fontes do `fontPair`. */
  customFonts?: {
    heading?:         string  // CSS font-family
    body?:            string  // CSS font-family
    googleFamilies?:  string[]  // ex.: ['Inter:wght@400;700']
  }
  radius:   Radius
  density:  Density
  effects:  DesignEffects
  buttons:  ThemeButtons
}

// ─────────────────────────────────────────────────────────────────────────
// Background / Spacing / Visibility (compartilhados entre seções)
// ─────────────────────────────────────────────────────────────────────────

export type BackgroundKind = 'none' | 'color' | 'image' | 'video' | 'gradient'

export interface BackgroundStyle {
  kind:        BackgroundKind
  color?:      string                // kind = 'color'
  imageUrl?:   string                // kind = 'image'
  imageFocus?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  videoUrl?:   string                // kind = 'video' (mp4 ou youtube)
  gradient?:   { from: string; to: string; angle?: number }  // kind = 'gradient'
  overlayColor?: string              // overlay sobre image/video
  overlayOpacity?: number            // 0..1
}

export interface Spacing {
  paddingTop:    number  // px
  paddingBottom: number
  marginTop:     number
  marginBottom:  number
}

export interface Visibility {
  desktop: boolean
  mobile:  boolean
}

/** Override de tipografia POR SEÇÃO (opcional). Quando setado, sobrescreve
 *  as CSS vars do tema só dentro daquela seção:
 *   - textColor   → --c-text       (cor de títulos + texto)
 *   - mutedColor  → --c-text-muted (textos secundários / subtítulos)
 *   - fontPair    → --f-heading + --f-body (modelo da fonte)
 *  Campos vazios herdam o tema global. */
export interface SectionTypography {
  textColor?:  string
  mutedColor?: string
  fontPair?:   FontPair
}

// ─────────────────────────────────────────────────────────────────────────
// Blocks (átomos dentro das seções)
// ─────────────────────────────────────────────────────────────────────────

export type BlockType =
  | 'heading'
  | 'subheading'
  | 'paragraph'
  | 'image'
  | 'video'
  | 'button'
  | 'badge'
  | 'countdown'
  | 'divider'
  | 'spacer'
  | 'icon'
  | 'productCardMini'
  | 'collectionLink'
  | 'socialIcon'
  | 'slide'

export interface BlockBase<T extends BlockType, S> {
  id:        string  // uuid
  type:      T
  settings:  S
  mobileOverrides?: Partial<S>
}

export type HeadingBlock = BlockBase<'heading', {
  text:  string
  level: 1 | 2 | 3 | 4
  align: 'left' | 'center' | 'right'
}>

export type SubheadingBlock = BlockBase<'subheading', {
  text:  string
  align: 'left' | 'center' | 'right'
}>

export type ParagraphBlock = BlockBase<'paragraph', {
  text:  string  // markdown leve aceito
  align: 'left' | 'center' | 'right'
}>

export type ImageBlock = BlockBase<'image', {
  url:          string
  alt:          string
  link?:        string
  aspectRatio:  '1:1' | '4:5' | '16:9' | '3:2' | 'free'
  objectFit:    'cover' | 'contain'
}>

export type VideoBlock = BlockBase<'video', {
  url:        string          // mp4 ou youtube/vimeo
  autoplay:   boolean
  loop:       boolean
  muted:      boolean
  controls:   boolean
  poster?:    string
}>

export type ButtonBlock = BlockBase<'button', {
  label:  string
  href:   string
  style:  'primary' | 'secondary' | 'ghost'
  size:   'sm' | 'md' | 'lg'
  icon?:  string                          // nome lucide
  newTab: boolean
}>

export type BadgeBlock = BlockBase<'badge', {
  text:  string
  color: 'primary' | 'success' | 'error' | 'warning'
}>

export type CountdownBlock = BlockBase<'countdown', {
  endsAt: string                          // ISO date
  label?: string
}>

export type DividerBlock = BlockBase<'divider', {
  style:  'solid' | 'dashed' | 'dotted'
  color?: string
}>

export type SpacerBlock = BlockBase<'spacer', {
  height: number  // px
}>

export type IconBlock = BlockBase<'icon', {
  name:  string                            // nome lucide
  size:  number
  color?: string
}>

export type ProductCardMiniBlock = BlockBase<'productCardMini', {
  productId:    string
  showPrice:    boolean
  showCta:      boolean
}>

export type CollectionLinkBlock = BlockBase<'collectionLink', {
  collectionId: string
  label:        string
  imageUrl?:    string
}>

export type SocialIconBlock = BlockBase<'socialIcon', {
  network: 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'twitter' | 'whatsapp' | 'pinterest'
  href:    string
}>

export type SlideBlock = BlockBase<'slide', {
  imageUrl:     string
  headline?:    string
  subheadline?: string
  ctaLabel?:    string
  ctaHref?:     string
  textColor?:   string
  textAlign?:   'left' | 'center' | 'right'
  /** Overlay/transparência sobre a imagem do slide (legibilidade do texto). */
  overlayColor?:   string
  overlayOpacity?: number   // 0..1
}>

export type Block =
  | HeadingBlock | SubheadingBlock | ParagraphBlock
  | ImageBlock | VideoBlock
  | ButtonBlock | BadgeBlock | CountdownBlock
  | DividerBlock | SpacerBlock | IconBlock
  | ProductCardMiniBlock | CollectionLinkBlock | SocialIconBlock
  | SlideBlock

// ─────────────────────────────────────────────────────────────────────────
// Sections (containers — 20 tipos)
// ─────────────────────────────────────────────────────────────────────────

export type SectionType =
  // Layout/Navegação
  | 'siteHeader' | 'siteFooter' | 'announcementBar' | 'breadcrumb'
  // Hero/Banners
  | 'hero' | 'slider' | 'imageBanner' | 'imageHotspot' | 'imageWithText' | 'marquee'
  // Produto/Coleção
  | 'productGrid' | 'productCarousel' | 'featuredProduct' | 'collectionGrid' | 'productDetailLayout'
  // Conteúdo
  | 'richText' | 'testimonials' | 'logoList' | 'faq' | 'newsletter' | 'videoBlock' | 'customHtml'
  // Comércio
  | 'cartLayout' | 'checkoutLayout' | 'whatsappCatalog'
  // Captação
  | 'leadForm'
  // Experiência
  | 'roomVisualizer'

export interface SectionBase<T extends SectionType, S> {
  id:           string  // uuid
  type:         T
  settings:     S
  blocks:       Block[]
  visibility:   Visibility
  spacing:      Spacing
  background:   BackgroundStyle
  /** Override de cor/fonte só desta seção (opcional). */
  typography?:  SectionTypography
  mobileOverrides?: {
    settings?:   Partial<S>
    spacing?:    Partial<Spacing>
    background?: Partial<BackgroundStyle>
  }
}

// — Layout —

export type SiteHeaderSection = SectionBase<'siteHeader', {
  variant:    'centered' | 'split' | 'minimal'
  sticky:     boolean
  showSearch: boolean
  showCart:   boolean
  showAccount: boolean
  logoUrl?:   string
  logoText?:  string                       // fallback texto se sem logo
  /** Altura maxima da imagem do logo em px (default 40, range 24-120). */
  logoMaxHeight?: number
  nav:        Array<{ label: string; href: string; submenu?: Array<{ label: string; href: string }> }>
}>

export type SiteFooterSection = SectionBase<'siteFooter', {
  variant:           'minimal' | 'columns'
  columns?:          Array<{ title: string; links: Array<{ label: string; href: string }> }>
  showNewsletter:    boolean
  showSocialIcons:   boolean
  showPaymentMethods: boolean
  copyright?:        string
}>

export type AnnouncementBarSection = SectionBase<'announcementBar', {
  message:       string
  ctaLabel?:     string
  ctaHref?:      string
  /** ISO date — quando preenchido, renderiza countdown até a data. */
  countdownTo?:  string | null
  dismissible:   boolean
}>

export type BreadcrumbSection = SectionBase<'breadcrumb', {
  showHome: boolean
  separator: '/' | '>' | '·'
}>

// — Hero/Banners —

export type HeroSection = SectionBase<'hero', {
  layout:       'split' | 'centered' | 'overlay'
  height:       'auto' | 'sm' | 'md' | 'lg' | 'fullscreen' | 'custom'
  /** Altura em px quando `height='custom'`. Range 100-1200. */
  customHeight?: number
  textAlign:    'left' | 'center' | 'right'
}>

export type SliderSection = SectionBase<'slider', {
  autoplay:     boolean
  interval:     number   // segundos
  showDots:     boolean
  showArrows:   boolean
  effect:       'fade' | 'slide' | 'coverflow'
  height:       'auto' | 'sm' | 'md' | 'lg' | 'fullscreen' | 'custom'
  customHeight?: number
}>

export type ImageBannerSection = SectionBase<'imageBanner', {
  imageUrl:     string
  headline?:    string
  subheadline?: string
  ctaLabel?:    string
  ctaHref?:     string
  textPosition: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  height:       'sm' | 'md' | 'lg' | 'fullscreen' | 'custom'
  customHeight?: number
  /** Overlay/transparência sobre a imagem (legibilidade do texto). */
  overlayColor?:   string
  overlayOpacity?: number   // 0..1
  // Tipografia por campo (override do tema; cada campo independente)
  titleColor?:       string
  titleSizeRem?:     number      // tamanho do título em rem
  titleFontPair?:    FontPair
  subtitleColor?:    string
  subtitleSizeRem?:  number      // tamanho do subtítulo em rem
  subtitleFontPair?: FontPair
  // Botão (CTA)
  buttonVariant?:   'solid' | 'outline' | 'soft'
  buttonColor?:     string       // cor base do botão
  buttonTextColor?: string       // cor do texto (variante solid)
  buttonSize?:      'sm' | 'md' | 'lg'
  buttonAlign?:     'left' | 'center' | 'right'
  buttonFontPair?:  FontPair
}>

export type ImageHotspotSection = SectionBase<'imageHotspot', {
  title?:   string
  imageUrl: string
  hotspots: Array<{ id: string; xPct: number; yPct: number; productId?: string; label?: string }>
}>

export type ImageWithTextSection = SectionBase<'imageWithText', {
  imageUrl:  string
  imageSide: 'left' | 'right'
  title:     string
  body:      string
  ctaLabel?: string
  ctaHref?:  string
}>

export type MarqueeSection = SectionBase<'marquee', {
  items:    string[]
  speed:    'slow' | 'normal' | 'fast'
  direction: 'left' | 'right'
}>

// — Produto/Coleção —

export type ProductSource =
  | { kind: 'storefront' }
  | { kind: 'collection'; collectionId: string }
  | { kind: 'manual'; productIds: string[] }
  | { kind: 'bestsellers' }
  | { kind: 'newest' }
  | { kind: 'promo' }

export type ProductGridSection = SectionBase<'productGrid', {
  title?:    string
  source:    ProductSource
  columns:   { mobile: 1 | 2; tablet: 2 | 3 | 4; desktop: 2 | 3 | 4 | 5 | 6 }
  limit:     number
  showFilters: boolean
  showSort:    boolean
  cardStyle: 'compact' | 'detailed' | 'minimal'
}>

export type ProductCarouselSection = SectionBase<'productCarousel', {
  title?:    string
  source:    ProductSource
  limit:     number
  autoplay:  boolean
  cardStyle: 'compact' | 'detailed' | 'minimal'
}>

export type FeaturedProductSection = SectionBase<'featuredProduct', {
  productId:        string
  galleryPosition:  'left' | 'right' | 'top'
  showDescription:  boolean
  showAttributes:   boolean
  ctaLabel?:        string
}>

export type CollectionGridSection = SectionBase<'collectionGrid', {
  title?:     string
  columns:    { mobile: 1 | 2; tablet: 2 | 3 | 4; desktop: 2 | 3 | 4 | 5 | 6 }
  collections: Array<{ collectionId: string; label?: string; imageUrl?: string }>
}>

/** Só na página `product` — layout do detalhe. */
export type ProductDetailLayoutSection = SectionBase<'productDetailLayout', {
  galleryPosition:     'left' | 'right' | 'top'
  galleryStyle:        'carousel' | 'stack' | 'grid'
  stickyAddToCart:     boolean
  showShareButtons:    boolean
  showRelatedProducts: boolean
  relatedProductsCount: number
  showReviews:         boolean
}>

// — Conteúdo —

export type RichTextSection = SectionBase<'richText', {
  content: string                          // markdown
  maxWidth: 'sm' | 'md' | 'lg' | 'full'
  align:    'left' | 'center' | 'right'
}>

export type TestimonialsSection = SectionBase<'testimonials', {
  title?: string
  layout: 'carousel' | 'grid'
  items:  Array<{
    id:      string
    name:    string
    avatar?: string
    text:    string
    rating?: 1 | 2 | 3 | 4 | 5
  }>
}>

export type LogoListSection = SectionBase<'logoList', {
  title?: string
  logos:  Array<{ id: string; imageUrl: string; alt: string; href?: string }>
  grayscale: boolean
}>

export type FaqSection = SectionBase<'faq', {
  title?: string
  items:  Array<{ id: string; question: string; answer: string }>
}>

export type NewsletterSection = SectionBase<'newsletter', {
  title?:       string
  description?: string
  ctaLabel:     string
  placeholder:  string
  successMessage: string
}>

export type VideoBlockSection = SectionBase<'videoBlock', {
  url:        string
  autoplay:   boolean
  loop:       boolean
  muted:      boolean
  poster?:    string
  aspectRatio: '16:9' | '4:3' | '1:1' | '9:16'
}>

/** Premium — HTML/CSS custom. Sanitizado via DOMPurify no render. */
export type CustomHtmlSection = SectionBase<'customHtml', {
  html: string
  css?: string  // escopo da seção
}>

// — Comércio —

export type CartLayoutSection = SectionBase<'cartLayout', {
  showCoupon:     boolean
  showShipping:   boolean
  showNotes:      boolean
  trustBadges:    string[]                 // imagens
  upsellSource?:  ProductSource
}>

export type CheckoutLayoutSection = SectionBase<'checkoutLayout', {
  steps:           'multi' | 'single'
  requireAccount:  boolean
  askForCpf:       boolean
  askForCnpj:      boolean
  trustBadges:     string[]
}>

export type WhatsappCatalogSection = SectionBase<'whatsappCatalog', {
  enabled:  boolean
  position: 'header' | 'footer' | 'floating'
  label:    string
}>

/** Campo configurável do formulário de captação de leads. */
export interface LeadFormField {
  key:       'name' | 'email' | 'phone' | 'message' | string  // 'custom_*' pra extras
  label:     string
  type:      'text' | 'email' | 'tel' | 'textarea'
  required:  boolean
  enabled:   boolean
}

/** Formulário editável que cria um lead (contato + card) num funil do Active. */
export type LeadFormSection = SectionBase<'leadForm', {
  title?:        string
  description?:  string
  fields:        LeadFormField[]
  submitLabel:   string
  successMessage: string
  // Destino no Active CRM (escolhido no editor via picker)
  pipelineId?:   string
  stageId?:      string
  assignedTo?:   string          // org_members.id (opcional)
  // Rótulos legíveis pra exibir no editor (cache; não usados no envio)
  pipelineName?: string
  stageName?:    string
}>

/** Bloco promocional do Ambientador IA ("Veja no seu ambiente"). Em página
 *  de produto abre o ambientador pro produto atual; em outras páginas leva
 *  o cliente a escolher um produto na vitrine. */
export type RoomVisualizerSection = SectionBase<'roomVisualizer', {
  title?:       string
  description?: string
}>

export type Section =
  | SiteHeaderSection | SiteFooterSection | AnnouncementBarSection | BreadcrumbSection
  | HeroSection | SliderSection | ImageBannerSection | ImageHotspotSection | ImageWithTextSection | MarqueeSection
  | ProductGridSection | ProductCarouselSection | FeaturedProductSection | CollectionGridSection | ProductDetailLayoutSection
  | RichTextSection | TestimonialsSection | LogoListSection | FaqSection | NewsletterSection | VideoBlockSection | CustomHtmlSection
  | CartLayoutSection | CheckoutLayoutSection | WhatsappCatalogSection | LeadFormSection
  | RoomVisualizerSection

// ─────────────────────────────────────────────────────────────────────────
// Páginas e raiz
// ─────────────────────────────────────────────────────────────────────────

export interface PageSeo {
  title?:       string
  description?: string
  ogImage?:     string
}

export interface PageDesign {
  sections: Section[]
  seo:      PageSeo
  layout?:  'default' | 'sidebar' | 'fullwidth'
}

export interface PageMap {
  home:       PageDesign
  product:    PageDesign
  collection: PageDesign
  cart:       PageDesign
  checkout:   PageDesign
}

export interface DesignGlobals {
  header: SiteHeaderSection
  footer: SiteFooterSection
}

export interface DesignMeta {
  templateKey: string  // ex.: 'lustres-decor'
  updatedAt:   string  // ISO
}

export interface StorefrontDesignV3 {
  version:  3
  theme:    ThemeV3
  globals:  DesignGlobals
  pages:    PageMap
  meta:     DesignMeta
}

// ─────────────────────────────────────────────────────────────────────────
// Arrays runtime (espelho do backend storefront-design-v3.types)
// ─────────────────────────────────────────────────────────────────────────

export const THEME_MODES_V3:        readonly ThemeMode[]   = ['dark', 'light']
export { FONT_PAIRS_V3 } from './font-pairs'
export const RADII_V3:              readonly Radius[]      = ['none', 'sm', 'md', 'lg', 'full']
export const DENSITIES_V3:          readonly Density[]     = ['compact', 'cozy', 'spacious']
export const SECTION_TYPES_V3:      readonly SectionType[] = [
  'siteHeader','siteFooter','announcementBar','breadcrumb',
  'hero','slider','imageBanner','imageHotspot','imageWithText','marquee',
  'leadForm',
  'productGrid','productCarousel','featuredProduct','collectionGrid','productDetailLayout',
  'richText','testimonials','logoList','faq','newsletter','videoBlock','customHtml',
  'cartLayout','checkoutLayout','whatsappCatalog',
  'roomVisualizer',
]
export const BLOCK_TYPES_V3:        readonly BlockType[]   = [
  'heading','subheading','paragraph','image','video','button','badge','countdown',
  'divider','spacer','icon','productCardMini','collectionLink','socialIcon','slide',
]
export const PAGE_KEYS_V3:          readonly (keyof PageMap)[] = ['home','product','collection','cart','checkout']
