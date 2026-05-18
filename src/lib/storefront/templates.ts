import type { StorefrontDesign } from './types'

/**
 * Modelo de inspiração da Loja Própria.
 *
 * "Editorial Premium" é a receita de design completa do tema — serve de
 * ponto de partida pra galeria do Designer e pra geração por IA.
 */

export interface StorefrontTemplate {
  id:          string
  label:       string
  description: string
  design:      StorefrontDesign
}

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
]

export const STOREFRONT_TEMPLATE_MAP: Record<string, StorefrontTemplate> =
  Object.fromEntries(STOREFRONT_TEMPLATES.map(t => [t.id, t]))

/** Receita usada quando a loja ainda não tem design definido. */
export const DEFAULT_DESIGN: StorefrontDesign = editorialPremium
