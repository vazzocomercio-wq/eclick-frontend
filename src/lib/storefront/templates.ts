import type { StorefrontDesign } from './types'

/**
 * Modelos de inspiracao da Loja Propria.
 *
 * Cada modelo e uma receita de design completa. Na Fase 1 sao aplicados
 * via SQL pra teste; na Fase 3 viram a galeria de inspiracao da UI; na
 * Fase 2 servem de ponto de partida pra geracao por IA.
 */

export interface StorefrontTemplate {
  id:          string
  label:       string
  description: string
  design:      StorefrontDesign
}

const boutiqueElegante: StorefrontDesign = {
  version: 1,
  theme: {
    mode: 'dark',
    colors: {
      background: '#0e0c0a',
      surface:    '#17130f',
      primary:    '#c9a24b',
      text:       '#f5efe6',
      textMuted:  '#9c9081',
      border:     '#2a2218',
    },
    fontPair: 'elegant',
    radius:   'sm',
    density:  'spacious',
  },
  sections: [
    { type: 'header', variant: 'centered' },
    {
      type: 'hero', variant: 'gradient',
      headline:    'Peças que contam histórias',
      subheadline: 'Curadoria exclusiva, feita pra durar.',
      ctaLabel:    'Ver coleção',
    },
    {
      type: 'productGrid', variant: 'elevated',
      title: 'Destaques', columns: { mobile: 2, tablet: 2, desktop: 3 },
    },
    {
      type: 'about', variant: 'simple',
      title: 'Sobre a casa',
      body:  'Cada peça é escolhida a dedo, pensando em quem valoriza qualidade e atemporalidade.',
    },
    { type: 'footer', variant: 'full' },
  ],
  product: { gallery: 'side', showAttributes: true, ctaMode: 'whatsapp' },
}

const vibrante: StorefrontDesign = {
  version: 1,
  theme: {
    mode: 'light',
    colors: {
      background: '#ffffff',
      surface:    '#f6f6f8',
      primary:    '#ff3d71',
      text:       '#16131a',
      textMuted:  '#6b6675',
      border:     '#e6e4ea',
    },
    fontPair: 'bold',
    radius:   'lg',
    density:  'cozy',
  },
  sections: [
    { type: 'header', variant: 'minimal' },
    {
      type: 'hero', variant: 'split',
      headline:    'Novidades toda semana',
      subheadline: 'Estilo que acompanha o seu ritmo.',
      ctaLabel:    'Comprar agora',
    },
    {
      type: 'productGrid', variant: 'compact',
      title: 'Mais vendidos', columns: { mobile: 2, tablet: 3, desktop: 4 },
    },
    { type: 'footer', variant: 'minimal' },
  ],
  product: { gallery: 'top', showAttributes: false, ctaMode: 'whatsapp' },
}

const techMinimalista: StorefrontDesign = {
  version: 1,
  theme: {
    mode: 'dark',
    colors: {
      background: '#09090b',
      surface:    '#111114',
      primary:    '#00E5FF',
      text:       '#fafafa',
      textMuted:  '#a1a1aa',
      border:     '#26262c',
    },
    fontPair: 'modern',
    radius:   'md',
    density:  'cozy',
  },
  sections: [
    { type: 'header', variant: 'minimal' },
    {
      type: 'hero', variant: 'gradient',
      headline:    'Tecnologia que resolve',
      subheadline: 'Os produtos certos, sem enrolação.',
      ctaLabel:    'Explorar catálogo',
    },
    {
      type: 'productGrid', variant: 'editorial',
      title: 'Catálogo', columns: { mobile: 1, tablet: 2, desktop: 3 },
    },
    {
      type: 'about', variant: 'banner',
      title: 'Por que comprar aqui',
      body:  'Entrega rápida, garantia real e suporte de verdade em cada compra.',
    },
    { type: 'footer', variant: 'full' },
  ],
  product: { gallery: 'side', showAttributes: true, ctaMode: 'whatsapp' },
}

const cleanClaro: StorefrontDesign = {
  version: 1,
  theme: {
    mode: 'light',
    colors: {
      background: '#fbfbfa',
      surface:    '#ffffff',
      primary:    '#1f6feb',
      text:       '#1a1a1a',
      textMuted:  '#75757d',
      border:     '#e8e8e6',
    },
    fontPair: 'modern',
    radius:   'md',
    density:  'spacious',
  },
  sections: [
    { type: 'header', variant: 'minimal' },
    {
      type: 'hero', variant: 'gradient',
      headline:    'Tudo o que você precisa',
      subheadline: 'Simples, claro e direto ao ponto.',
      ctaLabel:    'Ver produtos',
    },
    {
      type: 'productGrid', variant: 'elevated',
      title: 'Produtos', columns: { mobile: 2, tablet: 3, desktop: 4 },
    },
    { type: 'footer', variant: 'minimal' },
  ],
  product: { gallery: 'top', showAttributes: true, ctaMode: 'whatsapp' },
}

// ─────────────────────────────────────────────────────────────────────
// Tema Premium (v2) — home editorial rica, estilo Renovate.
// ─────────────────────────────────────────────────────────────────────

const editorialPremium: StorefrontDesign = {
  version: 2,
  theme: {
    mode: 'light',
    colors: {
      background: '#f4f1ec',
      surface:    '#ffffff',
      primary:    '#1c1b19',
      text:       '#1c1b19',
      textMuted:  '#7a756c',
      border:     '#e3ddd2',
      dark:       '#1c1b19',
      watermark:  '#ece7dd',
      onAccent:   '#f4f1ec',
    },
    fontPair: 'editorial',
    radius:   'sm',
    density:  'spacious',
    effects: {
      scrollReveal:  true,
      watermarks:    true,
      parallaxTilt:  true,
      hoverRollover: true,
    },
  },
  sections: [
    {
      type: 'announcementBar',
      message:     'Frete grátis acima de R$ 199 — entregamos para todo o Brasil',
      countdownTo: null,
    },
    {
      type: 'siteHeader', variant: 'split',
      sticky: true, showSearch: true, showCart: true,
      nav: [
        { label: 'Início',    href: '/' },
        { label: 'Novidades', href: '#novidades' },
        { label: 'Coleções',  href: '#colecoes' },
        { label: 'Sobre',     href: '#sobre' },
      ],
    },
    {
      type: 'heroPortrait',
      watermark:   'LOJA',
      headline:    'Curadoria que transforma o seu dia a dia',
      subheadline: 'Peças escolhidas uma a uma — design, qualidade e história em cada detalhe.',
      ctaLabel:    'Explorar a coleção',
      slides: [
        { imageUrl: '', label: 'Lançamentos' },
        { imageUrl: '', label: 'Mais desejados' },
        { imageUrl: '', label: 'Edição limitada' },
      ],
    },
    {
      type: 'marquee',
      items: [
        'Novidades toda semana',
        'Curadoria exclusiva',
        'Entrega para todo o Brasil',
        'Atendimento de verdade',
      ],
    },
    {
      type: 'productShowcase', layout: 'carousel',
      title: 'Em alta', watermark: 'EM ALTA',
      source: 'storefront', collectionId: null,
    },
    {
      type: 'categoryGrid',
      title: 'Navegue por categoria', watermark: 'CATEGORIAS',
      categories: [
        { label: 'Destaques',     imageUrl: '' },
        { label: 'Novidades',     imageUrl: '' },
        { label: 'Mais vendidos', imageUrl: '' },
        { label: 'Ofertas',       imageUrl: '' },
      ],
    },
    {
      type: 'editorialSplit',
      title:     'Feito para durar',
      body:      'Cada produto da nossa loja passa por uma curadoria cuidadosa. Acreditamos em qualidade que se vê e se sente — e em um atendimento que acompanha você do clique à entrega.',
      imageUrl:  '',
      imageSide: 'right',
      ctaLabel:  'Conheça a loja',
      ctaHref:   '#sobre',
    },
    {
      type: 'productShowcase', layout: 'grid',
      title: 'Catálogo completo',
      source: 'storefront', collectionId: null,
      columns: { mobile: 2, tablet: 3, desktop: 4 },
    },
    {
      type: 'siteFooter', variant: 'columns',
      newsletter: true,
      columns: [
        {
          title: 'Loja',
          links: [
            { label: 'Novidades',     href: '#novidades' },
            { label: 'Mais vendidos', href: '#' },
            { label: 'Ofertas',       href: '#' },
          ],
        },
        {
          title: 'Ajuda',
          links: [
            { label: 'Trocas e devoluções', href: '#' },
            { label: 'Entrega',             href: '#' },
            { label: 'Fale conosco',        href: '#' },
          ],
        },
      ],
    },
  ],
  product: { gallery: 'side', showAttributes: true, ctaMode: 'whatsapp' },
}

export const STOREFRONT_TEMPLATES: StorefrontTemplate[] = [
  {
    id: 'editorial_premium',
    label: 'Editorial Premium',
    description: 'Tema premium completo — home editorial com hero em carrossel, watermarks, vitrines, marquee e rodapé rico. Estilo revista. Bom para qualquer catálogo que queira se destacar.',
    design: editorialPremium,
  },
  {
    id: 'tech_minimalista',
    label: 'Tech Minimalista',
    description: 'Escuro, ciano e-Click, limpo. Grade editorial. Bom pra eletrônicos e gadgets.',
    design: techMinimalista,
  },
  {
    id: 'boutique_elegante',
    label: 'Boutique Elegante',
    description: 'Escuro, dourado, fontes serifadas, espaçoso. Bom pra joias, moda premium, decoração.',
    design: boutiqueElegante,
  },
  {
    id: 'vibrante',
    label: 'Vibrante',
    description: 'Claro, cor forte, fontes marcantes, compacto. Bom pra moda e produtos de giro rápido.',
    design: vibrante,
  },
  {
    id: 'clean_claro',
    label: 'Clean Claro',
    description: 'Claro, neutro, muito respiro. Versátil pra qualquer catálogo.',
    design: cleanClaro,
  },
]

export const STOREFRONT_TEMPLATE_MAP: Record<string, StorefrontTemplate> =
  Object.fromEntries(STOREFRONT_TEMPLATES.map(t => [t.id, t]))

/** Receita usada quando a loja ainda nao tem design definido. */
export const DEFAULT_DESIGN: StorefrontDesign = techMinimalista
