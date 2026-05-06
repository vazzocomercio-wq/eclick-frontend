// Tipos espelhando o backend (apps/api creative.service.ts).
// Não importa diretamente do backend — duplicado conscientemente pra
// manter front desacoplado.

export type Marketplace =
  | 'mercado_livre'
  | 'shopee'
  | 'amazon'
  | 'magalu'
  | 'loja_propria'
  | 'multi'

export type ProductStatus = 'draft' | 'analyzing' | 'ready' | 'archived'

export interface CreativeProduct {
  id:                       string
  organization_id:          string
  user_id:                  string | null
  name:                     string
  category:                 string
  brand:                    string | null
  main_image_url:           string
  main_image_storage_path:  string
  dimensions:               Record<string, unknown>
  color:                    string | null
  material:                 string | null
  differentials:            string[]
  target_audience:          string | null
  sku:                      string | null
  ean:                      string | null
  ai_analysis:              ProductAiAnalysis
  reference_images:         string[]
  competitor_links:         string[]
  reference_video_url:      string | null
  brand_identity_url:       string | null
  status:                   ProductStatus
  created_at:               string
  updated_at:               string
  /** Quando vem de GET /creative/products[/:id], backend embute signed URL */
  signed_image_url?:        string | null
}

export interface ProductAiAnalysis {
  product_type?:     string
  detected_color?:   string
  detected_material?: string
  detected_format?:  string
  key_parts?:        string[]
  possible_uses?:    string[]
  visual_risks?:     string[]
  suggested_angles?: string[]
  confidence_score?: number
}

export interface CreativeBriefing {
  id:                  string
  product_id:          string
  organization_id:     string
  target_marketplace:  Marketplace
  visual_style:        string
  environment:         string | null
  custom_environment:  string | null
  background_color:    string
  use_logo:            boolean
  logo_url:            string | null
  logo_storage_path:   string | null
  communication_tone:  string
  image_count:         number
  image_format:        string
  marketplace_rules:   Record<string, unknown>
  is_active:           boolean
  created_at:          string
  updated_at:          string
}

export interface CreativeListing {
  id:                       string
  product_id:               string
  briefing_id:              string
  organization_id:          string
  title:                    string
  subtitle:                 string | null
  description:              string
  bullets:                  string[]
  technical_sheet:          Record<string, string>
  keywords:                 string[]
  search_tags:              string[]
  suggested_category:       string | null
  faq:                      Array<{ q: string; a: string }>
  commercial_differentials: string[]
  marketplace_variants:     Record<string, { title: string; description: string; bullets: string[] }>
  version:                  number
  parent_listing_id:        string | null
  generation_metadata:      Record<string, unknown>
  status:                   'draft' | 'generating' | 'review' | 'approved' | 'published' | 'archived'
  approved_at:              string | null
  approved_by:              string | null
  created_at:               string
  updated_at:               string
}

// ── Constantes UI ──────────────────────────────────────────────────────────

export const MARKETPLACE_OPTIONS: Array<{ value: Marketplace; label: string; emoji: string }> = [
  { value: 'mercado_livre', label: 'Mercado Livre', emoji: '🟡' },
  { value: 'shopee',        label: 'Shopee',        emoji: '🟠' },
  { value: 'amazon',        label: 'Amazon',        emoji: '🟧' },
  { value: 'magalu',        label: 'Magalu',        emoji: '🔵' },
  { value: 'loja_propria',  label: 'Loja própria',  emoji: '🏪' },
  { value: 'multi',         label: 'Multi-canal',   emoji: '🌐' },
]

export const VISUAL_STYLES: Array<{ value: string; label: string; description: string }> = [
  { value: 'clean',           label: 'Clean',           description: 'Fundo neutro, foco no produto' },
  { value: 'premium',         label: 'Premium',         description: 'Tons sofisticados, acabamento elegante' },
  { value: 'tecnico',         label: 'Técnico',         description: 'Especificações em destaque' },
  { value: 'promocional',     label: 'Promocional',     description: 'Cores fortes, urgência' },
  { value: 'lifestyle',       label: 'Lifestyle',       description: 'Produto em uso real' },
  { value: 'luxo_acessivel',  label: 'Luxo acessível',  description: 'Premium sem ser inacessível' },
]

export const ENVIRONMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'cozinha',       label: 'Cozinha' },
  { value: 'sala',          label: 'Sala' },
  { value: 'quarto',        label: 'Quarto' },
  { value: 'banheiro',      label: 'Banheiro' },
  { value: 'area_gourmet',  label: 'Área gourmet' },
  { value: 'escritorio',    label: 'Escritório' },
  { value: 'area_externa',  label: 'Área externa' },
  { value: 'garagem',       label: 'Garagem' },
  { value: 'lavanderia',    label: 'Lavanderia' },
  { value: 'estudio',       label: 'Estúdio' },
  { value: 'loja',          label: 'Loja' },
  { value: 'neutro',        label: 'Neutro' },
  { value: 'custom',        label: 'Personalizado' },
]

export const TONE_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: 'tecnico',       label: 'Técnico',       description: 'Foco em especificações' },
  { value: 'vendedor',      label: 'Vendedor',      description: 'Persuasivo e direto' },
  { value: 'sofisticado',   label: 'Sofisticado',   description: 'Elegante, premium' },
  { value: 'direto',        label: 'Direto',        description: 'Objetivo, sem floreios' },
  { value: 'emocional',     label: 'Emocional',     description: 'Conta uma história' },
  { value: 'educativo',     label: 'Educativo',     description: 'Informa enquanto vende' },
]

export const IMAGE_COUNT_OPTIONS = [5, 7, 10, 11] as const
export const IMAGE_FORMAT_OPTIONS = ['1200x1200', '1200x1500', '1000x1000', '800x800'] as const
