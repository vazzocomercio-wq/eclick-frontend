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
  /** Onda 1 M1 — vínculo opcional com catálogo mestre `products` */
  product_id:               string | null
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
  /** @deprecated use environments[] */
  environment:         string | null
  environments:        string[]
  custom_environment:  string | null
  custom_prompt:       string | null
  background_color:    string
  use_logo:            boolean
  logo_url:            string | null
  logo_storage_path:   string | null
  communication_tone:  string
  image_count:         number
  image_format:        string
  image_prompts:       string[] | null
  video_prompts:       string[] | null
  marketplace_rules:   Record<string, unknown>
  is_active:           boolean
  /** F6: tipo de produto (template de imagens) escolhido. NULL = auto-match. */
  template_id:         string | null
  /** F6: slots do template selecionados (1 imagem por slot). Vazio = N primeiras. */
  selected_positions:  number[]
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
  /** Sub-sprint A: categoria ML real (MLB...) sugerida pelo predict_category. */
  category_ml_id:           string | null
  /** Sub-sprint A: attributes sugeridos pelo predict_category. Base pra ficha técnica ML. */
  attributes_ml_suggested:  Array<{ id: string; name: string; value_id?: string; value_name?: string }>
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

/**
 * @deprecated Use `CreativeApi.listTaxonomy('ambient')` em vez disso.
 *
 * Lista hardcoded antiga — substituída pela tabela `creative_taxonomy_options`
 * (defaults globais + customs por org). Mantido só pra compat se algum lugar
 * ainda referenciar. Não usar em código novo.
 *
 * Bug que motivou: values aqui (`area_gourmet`, `area_externa`) não batiam
 * com values nas refs (`gourmet`, `externa`), causando match falho silencioso
 * no template.
 */
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

export type KlingModel =
  | 'kling-v2-1'
  | 'kling-v2-1-master'
  | 'kling-v2-5'
  | 'kling-v2-6'
  | 'kling-v1-6'
  // legados (pra retrocompat com vídeos antigos no DB)
  | 'kling-v1-6-std'
  | 'kling-v1-6-pro'
  | 'kling-v2-master'
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
  // F6: chain fields (vídeos longos 15s+ encadeados)
  target_duration_seconds?: number | null
  source_provider?:    'kling' | 'flow' | 'sora' | null
  camera_motion?:      string | null
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
  // F6: chain fields (vídeos longos 15s+)
  parent_video_id?:     string | null
  chain_position?:      number | null
  chain_total?:         number | null
  is_chain_master?:     boolean
  chain_master_id?:     string | null
  provider?:            'kling' | 'flow'
  source_frame_path?:   string | null
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

// Pricing API real (USD) — confirmado em console.kling.com em 2026-05-13.
// IMPORTANTE: o pricing do site/subscription é DIFERENTE — esses valores
// são pra carteira da API (chamadas via KLING_ACCESS_KEY/SECRET_KEY).
export const KLING_PRICING: Record<KlingModel, Record<5 | 10, number>> = {
  'kling-v2-1':        { 5: 0.49, 10: 0.98 },
  'kling-v2-1-master': { 5: 1.40, 10: 2.80 },
  'kling-v2-5':        { 5: 0.35, 10: 0.70 },
  'kling-v2-6':        { 5: 0.70, 10: 1.40 },
  'kling-v1-6':        { 5: 0.49, 10: 0.98 },
  // legados (DB pode ter rows antigas — mesmos valores do equivalente atual)
  'kling-v1-6-std':    { 5: 0.49, 10: 0.98 },
  'kling-v1-6-pro':    { 5: 0.49, 10: 0.98 },
  'kling-v2-master':   { 5: 1.40, 10: 2.80 },
}

export const KLING_MODEL_OPTIONS: Array<{ value: KlingModel; label: string; description: string }> = [
  { value: 'kling-v2-6',        label: 'v2.6 (áudio)',   description: 'NOVO — áudio nativo ($0.70/5s)' },
  { value: 'kling-v2-5',        label: 'v2.5 Turbo',     description: 'Recomendado — bom equilíbrio ($0.35/5s)' },
  { value: 'kling-v2-1',        label: 'v2.1',           description: 'Padrão Pro ($0.49/5s)' },
  { value: 'kling-v1-6',        label: 'v1.6',           description: 'Com controle de câmera ($0.49/5s)' },
  { value: 'kling-v2-1-master', label: 'v2.1 Master',    description: 'Premium — caro ($1.40/5s)' },
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

export interface MlShippingCost {
  /** Custo do frete grátis pago pelo vendedor (R$), já com subsídio do ML descontado. */
  sellerCost:     number
  /** Custo de tabela bruto, antes do subsídio (R$). */
  listCost:       number
  /** Peso considerado pelo ML (máx. real x volumétrico), em gramas. */
  billableWeight: number
  /** Fração do subsídio de reputação do ML (0–1). */
  discountRate:   number
}

export interface CreativePublication {
  id:                            string
  organization_id:               string
  listing_id:                    string
  product_id:                    string
  user_id:                       string | null
  marketplace:                   'mercado_livre' | 'shopee' | 'amazon' | 'magalu'
  status:                        'pending' | 'publishing' | 'published' | 'failed'
  idempotency_key:               string
  image_ids:                     string[]
  video_id:                      string | null
  category_id:                   string | null
  listing_type:                  string | null
  condition:                     string | null
  price:                         number | null
  stock:                         number | null
  attributes:                    unknown[]
  payload_sent:                  Record<string, unknown> | null
  external_id:                   string | null
  external_url:                  string | null
  external_picture_ids:          string[]
  external_video_id:             string | null
  ml_response:                   Record<string, unknown> | null
  last_synced_status:            string | null
  last_synced_at:                string | null
  degraded_at:                   string | null
  degraded_from_status:          string | null
  degraded_to_status:            string | null
  degradation_acknowledged_at:   string | null
  degradation_acknowledged_by:   string | null
  error_message:                 string | null
  published_at:                  string | null
  created_at:                    string
  updated_at:                    string
}

// Nomes oficiais ML (interno → vitrine):
//   gold_special → "Clássico" (12% taxa, 6x sem juros, sem destaque premium)
//   gold_pro     → "Premium"  (16% taxa, 12x sem juros, máxima exposição)
//   free         → "Grátis"   (sem custo de listagem, sem destaques)
// IDs internos (gold_special/gold_pro) continuam os mesmos na API do ML.
export const ML_LISTING_TYPE_OPTIONS: Array<{ value: MlListingType; label: string; description: string }> = [
  { value: 'free',         label: 'Grátis',   description: 'Sem custo de listagem, exposição reduzida (limite ~10 unidades)' },
  { value: 'gold_special', label: 'Clássico', description: '12% de tarifa · 6x sem juros · boa exposição' },
  { value: 'gold_pro',     label: 'Premium',  description: '16% de tarifa · 12x sem juros · máxima exposição' },
]

export const ML_CONDITION_OPTIONS: Array<{ value: MlCondition; label: string }> = [
  { value: 'new',           label: 'Novo' },
  { value: 'used',          label: 'Usado' },
  { value: 'not_specified', label: 'Não especificado' },
]

// ── F6 Sprint 2: Prompt Templates (image generation) ─────────────────────

export type AspectRatio = '1:1' | '4:5' | '16:9' | '9:16'

export interface ReferenceMatchConfig {
  by_tags?:              string[]
  by_category?:          boolean
  by_position_default?:  boolean
  limit?:                number
}

export interface TemplatePosition {
  position:                number
  name:                    string
  prompt_template:         string
  negative_prompt?:        string
  use_product_reference:   boolean
  use_brand_logo:          boolean
  use_reference_ids:       string[]
  reference_match?:        ReferenceMatchConfig
  ambient_hint?:           string
  aspect_ratio?:           AspectRatio
}

export interface CreativePromptTemplate {
  id:              string
  organization_id: string
  name:            string
  description:     string | null
  is_default:      boolean
  category_ml_ids: string[]
  brand_voice:     string | null
  positions:       TemplatePosition[]
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

export interface MatchedTemplate {
  template:                 CreativePromptTemplate
  match_reason:             'category_exact' | 'org_default' | 'most_recent' | 'none'
  matched_category_ml_id?:  string
}

export interface ResolvedPositionPreview {
  position:           number
  name:               string
  prompt_template:    string
  prompt_resolved:    string
  negative_prompt?:   string
  aspect_ratio:       AspectRatio
  references:         Array<{
    id:           string
    name:         string
    storage_path: string
    signed_url:   string
    source:       'fixed_id' | 'tag_match' | 'category_match' | 'position_default' | 'product_main' | 'brand_logo'
  }>
  variables_resolved: Record<string, string>
  warnings:           string[]
}

export interface TemplatePreviewResponse {
  template_id: string
  product_id:  string
  briefing_id: string | null
  positions:   ResolvedPositionPreview[]
}

// Taxonomy (ambient + product_type customizáveis por org)
export type TaxonomyKind = 'ambient' | 'product_type'

export interface TaxonomyOption {
  id:               string
  organization_id:  string | null   // null = default global
  kind:             TaxonomyKind
  value:            string
  label:            string
  sort_order:       number
  is_default:       boolean
  linked_position:  number | null   // 1..11 (só kind='ambient'); null = sem link
  /** UUID do default global que essa cópia sobrescreve. null = não sobrescreve. */
  overrides_default_id: string | null
  created_at:       string
  updated_at:       string
  /** Marcado true só quando list(include_hidden=true). Indica que a org ocultou. */
  hidden?:          boolean
}

// References (Fase 2.5 vai usar; backend já existe da 2.2)
export interface CreativeReference {
  id:                    string
  organization_id:       string | null
  is_curated:            boolean
  name:                  string
  description:           string | null
  storage_path:          string
  tags:                  string[]
  category_ml_ids:       string[]
  default_for_positions: number[]
  product_type:          string | null
  ambient:               string | null
  is_active:             boolean
  signed_url:            string | null
}

// ── SEO score (pré-publicação) ────────────────────────────────────────────

export type SeoIssueArea     = 'title' | 'attributes' | 'pictures' | 'description' | 'general'
export type SeoIssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface SeoIssue {
  code:        string
  area:        SeoIssueArea
  severity:    SeoIssueSeverity
  message:     string
  fixHint?:    string
  fixesField?: 'title' | 'subtitle' | 'description' | 'bullets' | 'attributes' | 'pictures'
}

export interface CreativeListingSeoResult {
  listing_id: string
  scores: {
    title:      number
    attributes: number
    pictures:   number
    structural: number
  }
  issues:  SeoIssue[]
  summary: {
    score_label:    'excelente' | 'bom' | 'regular' | 'baixo' | 'crítico'
    critical_count: number
    high_count:     number
  }
  context: {
    title_length:         number
    has_brand_in_title:   boolean
    has_keyword_in_title: boolean
    attributes_total:     number
    attributes_filled:    number
    attributes_missing:   string[]
    pictures_count:       number
  }
}

// ── Melhoria #2: Briefing Templates ───────────────────────────────────────

export interface BriefingTemplate {
  id:                  string
  organization_id:     string
  user_id:             string | null
  name:                string
  description:         string | null
  target_marketplace:  Marketplace
  visual_style:        string
  /** @deprecated use environments[] */
  environment:         string | null
  environments:        string[]
  custom_environment:  string | null
  custom_prompt:       string | null
  background_color:    string
  use_logo:            boolean
  logo_url:            string | null
  logo_storage_path:   string | null
  communication_tone:  string
  image_count:         number
  image_format:        string
  is_default:          boolean
  created_at:          string
  updated_at:          string
}
