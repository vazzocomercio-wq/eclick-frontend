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

// ── E2: Image Pipeline ─────────────────────────────────────────────────────

export type JobStatus =
  | 'queued'
  | 'generating_prompts'
  | 'generating_images'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ImageStatus =
  | 'pending'
  | 'generating'
  | 'ready'
  | 'approved'
  | 'rejected'
  | 'failed'

export interface CreativeImageJob {
  id:                  string
  organization_id:     string
  product_id:          string
  briefing_id:         string
  listing_id:          string | null
  user_id:             string | null
  status:              JobStatus
  requested_count:     number
  completed_count:     number
  failed_count:        number
  approved_count:      number
  rejected_count:      number
  max_cost_usd:        number
  total_cost_usd:      number
  prompts_generated:   string[]
  prompts_metadata:    Record<string, unknown>
  error_message:       string | null
  started_at:          string | null
  completed_at:        string | null
  created_at:          string
  updated_at:          string
}

export interface CreativeImage {
  id:                   string
  job_id:               string
  product_id:           string
  organization_id:      string
  position:             number
  prompt_text:          string
  status:               ImageStatus
  storage_path:         string | null
  generation_metadata:  Record<string, unknown>
  regenerated_from_id:  string | null
  approved_at:          string | null
  approved_by:          string | null
  rejected_at:          string | null
  rejected_by:          string | null
  error_message:        string | null
  created_at:           string
  updated_at:           string
  signed_image_url?:    string | null
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued:             'Na fila',
  generating_prompts: 'Gerando prompts',
  generating_images:  'Gerando imagens',
  completed:          'Concluído',
  failed:             'Falhou',
  cancelled:          'Cancelado',
}

export const IMAGE_STATUS_LABELS: Record<ImageStatus, string> = {
  pending:    'Aguardando',
  generating: 'Gerando',
  ready:      'Pronta',
  approved:   'Aprovada',
  rejected:   'Rejeitada',
  failed:     'Falhou',
}

export function isJobActive(status: JobStatus): boolean {
  return status === 'queued' || status === 'generating_prompts' || status === 'generating_images'
}

// ── E3a: Video Pipeline ────────────────────────────────────────────────────

export type VideoJobStatus =
  | 'queued'
  | 'generating_prompts'
  | 'generating_videos'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type VideoStatus =
  | 'pending'
  | 'generating'
  | 'ready'
  | 'approved'
  | 'rejected'
  | 'failed'

export type KlingModel = 'kling-v1-6-std' | 'kling-v1-6-pro' | 'kling-v2-master'
export type VideoDuration = 5 | 10
export type VideoAspectRatio = '1:1' | '16:9' | '9:16'

export interface CreativeVideoJob {
  id:                  string
  organization_id:     string
  product_id:          string
  briefing_id:         string
  listing_id:          string | null
  source_image_id:     string | null
  user_id:             string | null
  status:              VideoJobStatus
  requested_count:     number
  duration_seconds:    number
  aspect_ratio:        VideoAspectRatio
  model_name:          KlingModel
  completed_count:     number
  failed_count:        number
  approved_count:      number
  rejected_count:      number
  max_cost_usd:        number
  total_cost_usd:      number
  prompts_generated:   string[]
  prompts_metadata:    Record<string, unknown>
  error_message:       string | null
  started_at:          string | null
  completed_at:        string | null
  created_at:          string
  updated_at:          string
}

export interface CreativeVideo {
  id:                   string
  job_id:               string
  product_id:           string
  organization_id:      string
  position:             number
  prompt_text:          string
  status:               VideoStatus
  duration_seconds:     number
  aspect_ratio:         VideoAspectRatio
  model_name:           KlingModel
  external_task_id:     string | null
  source_image_id:      string | null
  storage_path:         string | null
  thumbnail_path:       string | null
  generation_metadata:  Record<string, unknown>
  regenerated_from_id:  string | null
  approved_at:          string | null
  approved_by:          string | null
  rejected_at:          string | null
  rejected_by:          string | null
  error_message:        string | null
  created_at:           string
  updated_at:           string
  signed_video_url?:    string | null
}

export const VIDEO_JOB_STATUS_LABELS: Record<VideoJobStatus, string> = {
  queued:             'Na fila',
  generating_prompts: 'Gerando prompts',
  generating_videos:  'Gerando vídeos',
  completed:          'Concluído',
  failed:             'Falhou',
  cancelled:          'Cancelado',
}

export function isVideoJobActive(status: VideoJobStatus): boolean {
  return status === 'queued' || status === 'generating_prompts' || status === 'generating_videos'
}

// Pricing por modelo (USD) — espelha backend kling.client.ts
export const KLING_PRICING: Record<KlingModel, Record<5 | 10, number>> = {
  'kling-v1-6-std':  { 5: 0.21, 10: 0.42 },
  'kling-v1-6-pro':  { 5: 0.49, 10: 0.98 },
  'kling-v2-master': { 5: 0.42, 10: 0.84 },
}

export const KLING_MODEL_OPTIONS: Array<{ value: KlingModel; label: string; description: string }> = [
  { value: 'kling-v1-6-std',  label: 'v1.6 Standard', description: 'Mais rápido, mais barato ($0.21/5s)' },
  { value: 'kling-v1-6-pro',  label: 'v1.6 Pro',      description: 'Qualidade alta ($0.49/5s)' },
  { value: 'kling-v2-master', label: 'v2 Master',     description: 'Premium, motion suave ($0.42/5s)' },
]

export const VIDEO_DURATION_OPTIONS: VideoDuration[] = [5, 10]

export const VIDEO_ASPECT_OPTIONS: Array<{ value: VideoAspectRatio; label: string; emoji: string }> = [
  { value: '1:1',  label: '1:1 (quadrado)',     emoji: '◻️' },
  { value: '16:9', label: '16:9 (landscape)',   emoji: '🖥️' },
  { value: '9:16', label: '9:16 (vertical)',    emoji: '📱' },
]

// ── E3c: ML Publisher ─────────────────────────────────────────────────────

export type MlListingType = 'free' | 'gold_special' | 'gold_pro'
export type MlCondition   = 'new' | 'used' | 'not_specified'

export interface MlPublishContext {
  listing: CreativeListing
  product: CreativeProduct
  briefing_id: string
  approved_images: Array<{
    id:               string
    position:         number
    storage_path:     string
    signed_image_url: string
  }>
  approved_videos: Array<{
    id:               string
    position:         number
    storage_path:     string
    signed_video_url: string
    duration_seconds: number
  }>
  sku_suggestion: { product_id: string; sku: string; price: number | null; stock: number | null } | null
}

export interface MlPredictedCategory {
  category_id:   string | null
  category_name: string | null
  domain_id:     string | null
  domain_name:   string | null
  suggested_attributes: Array<{ id: string; name: string; value_id?: string; value_name?: string }>
}

export interface MlRequiredAttribute {
  id:               string
  name:             string
  value_type:       string  // string | number | boolean | list | number_unit
  required:         boolean
  value_max_length?: number
  values?:          Array<{ id: string; name: string }>
  hint?:            string
}

export interface MlPreviewResponse {
  ready:    boolean
  warnings: string[]
  publish_enabled: boolean
  predicted_category:  MlPredictedCategory
  required_attributes: MlRequiredAttribute[]
  ml_payload:          Record<string, unknown>
}

export interface CreativePublication {
  id:                     string
  organization_id:        string
  listing_id:             string
  product_id:             string
  user_id:                string | null
  marketplace:            'mercado_livre' | 'shopee' | 'amazon' | 'magalu'
  status:                 'pending' | 'publishing' | 'published' | 'failed'
  idempotency_key:        string
  image_ids:              string[]
  video_id:               string | null
  category_id:            string | null
  listing_type:           string | null
  condition:              string | null
  price:                  number | null
  stock:                  number | null
  attributes:             unknown[]
  payload_sent:           Record<string, unknown> | null
  external_id:            string | null
  external_url:           string | null
  external_picture_ids:   string[]
  external_video_id:      string | null
  ml_response:            Record<string, unknown> | null
  last_synced_status:     string | null
  last_synced_at:         string | null
  error_message:          string | null
  published_at:           string | null
  created_at:             string
  updated_at:             string
}

export const ML_LISTING_TYPE_OPTIONS: Array<{ value: MlListingType; label: string; description: string }> = [
  { value: 'free',         label: 'Free',         description: 'Sem custo de listagem, sem destaques' },
  { value: 'gold_special', label: 'Gold Especial', description: 'Pago, com destaques e mais visibilidade' },
  { value: 'gold_pro',     label: 'Gold Pro',     description: 'Pago premium, máxima exposição' },
]

export const ML_CONDITION_OPTIONS: Array<{ value: MlCondition; label: string }> = [
  { value: 'new',           label: 'Novo' },
  { value: 'used',          label: 'Usado' },
  { value: 'not_specified', label: 'Não especificado' },
]
