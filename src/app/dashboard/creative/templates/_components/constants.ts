/**
 * F6 Sprint 2.4 — Frontend Templates Editor
 *
 * Constantes compartilhadas: 11 posições canônicas + exemplos de variáveis.
 *
 * Decisão: skeleton de 11 posições é constante FRONTEND, não endpoint backend.
 * Razão: dados estáticos sem fluxo de aprovação; mais rápido sem round-trip.
 * Se um dia virar fluxo configurável (org customiza skeleton padrão), promove
 * pra endpoint backend.
 */

import type { TemplatePosition } from '@/components/creative/types'

/** 11 posições canônicas — esqueleto inicial pra qualquer template. */
export const CANONICAL_POSITIONS: TemplatePosition[] = [
  {
    position: 1,
    name: 'Capa pura',
    prompt_template: 'Fotografia profissional de catálogo de {product_name}. Material: {material}. Cor: {primary_color}. Fundo branco puro #FFFFFF, iluminação difusa de estúdio. Estética minimalista premium. SEM logo, SEM texto, SEM pessoas.',
    negative_prompt: 'people, hands, text, logos, watermark, split frame, collage, multiple products',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    aspect_ratio: '1:1',
  },
  {
    position: 2,
    name: 'Detalhe macro',
    prompt_template: 'Close-up macro do {product_name} mostrando textura e acabamento {material}. Foco nítido nos detalhes. Fundo neutro suave.',
    negative_prompt: 'people, text, logos, blur, low resolution',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    aspect_ratio: '1:1',
  },
  {
    position: 3,
    name: 'Ambiente principal',
    prompt_template: 'Mesmo {product_name} em {ambient_label} moderna brasileira. Estilo editorial premium. Luz natural diurna. Móveis contemporâneos minimalistas em tons neutros.',
    negative_prompt: 'people, hands, text, watermark, cluttered, dated furniture',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    ambient_hint: 'sala',
    aspect_ratio: '1:1',
  },
  {
    position: 4,
    name: 'Ambiente secundário',
    prompt_template: '{product_name} em {ambient_label} aconchegante. Decoração calorosa, tons quentes. Atmosfera convidativa.',
    negative_prompt: 'people, text, logos, cluttered',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    ambient_hint: 'quarto',
    aspect_ratio: '1:1',
  },
  {
    position: 5,
    name: 'Lifestyle',
    prompt_template: 'Cena lifestyle com {product_name} integrado naturalmente. Composição editorial, profundidade de campo, contexto de uso real ({usage_contexts}).',
    negative_prompt: 'people, text, watermark, fake-looking',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    aspect_ratio: '1:1',
  },
  {
    position: 6,
    name: 'Quarto / Privativo',
    prompt_template: '{product_name} em quarto de casal moderno. Cabeceira estofada, roupa de cama branca, atmosfera relaxante.',
    negative_prompt: 'people, text, logos, cluttered',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    ambient_hint: 'quarto',
    aspect_ratio: '1:1',
  },
  {
    position: 7,
    name: 'Cozinha / Jantar',
    prompt_template: '{product_name} em sala de jantar ou cozinha gourmet brasileira. Mesa de madeira, louças finas. Composição editorial gastronômica.',
    negative_prompt: 'people, text, logos, food clutter',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    ambient_hint: 'cozinha',
    aspect_ratio: '1:1',
  },
  {
    position: 8,
    name: 'Técnica frontal',
    prompt_template: 'Vista frontal técnica do {product_name}. Fundo branco. Iluminação plana. Estilo ficha técnica de catálogo profissional.',
    negative_prompt: 'shadows, gradient, decorative elements',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    aspect_ratio: '1:1',
  },
  {
    position: 9,
    name: 'Medidas técnicas',
    prompt_template: 'Diagrama técnico do {product_name} com {dimensions}. Estilo blueprint minimalista, linhas de cota em cinza escuro, fundo branco.',
    negative_prompt: 'photographic, lifestyle, colorful',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    aspect_ratio: '1:1',
  },
  {
    position: 10,
    name: 'Características',
    prompt_template: '{product_name} com destaques visuais nos {detected_parts}. Composição limpa. Fundo neutro claro.',
    negative_prompt: 'people, text overlay, watermark',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    aspect_ratio: '1:1',
  },
  {
    position: 11,
    name: 'Embalagem',
    prompt_template: '{product_name} ao lado da embalagem original sobre fundo branco. Composição limpa, foco no produto e na embalagem como kit.',
    negative_prompt: 'people, text, logos, cluttered',
    use_product_reference: true,
    use_brand_logo: false,
    use_reference_ids: [],
    aspect_ratio: '1:1',
  },
]

/** Exemplos pra tooltips das variáveis. */
export const VARIABLE_EXAMPLES: Record<string, string> = {
  product_name:              'Pendente dourado',
  material:                  'Metal escovado dourado, vidro opalino',
  primary_color:             'dourado',
  secondary_color:           'branco leitoso',
  dimensions:                'altura: 40cm, largura: 35cm',
  category_label:            'Luminária de teto',
  brand_name:                'Vazzo',
  detected_parts:            'Canopla, cabos, moldura, globo',
  usage_contexts:            'Sala de jantar, hall de entrada',
  target_audience:           'Casais 30-50 com casa própria',
  commercial_differentials:  'Acabamento premium, design exclusivo',
  ambient_label:             'sala',
}

export const MAX_POSITIONS = 11

export const ASPECT_RATIO_OPTIONS: Array<{ value: NonNullable<TemplatePosition['aspect_ratio']>; label: string }> = [
  { value: '1:1',  label: '1:1 (quadrado)' },
  { value: '4:5',  label: '4:5 (vertical próximo)' },
  { value: '9:16', label: '9:16 (story)' },
  { value: '16:9', label: '16:9 (landscape)' },
]
