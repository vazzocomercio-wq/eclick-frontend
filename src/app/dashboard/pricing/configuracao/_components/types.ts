// Pricing Intelligence — espelha src/modules/pricing-intelligence/

export type PricingMode = 'disabled' | 'suggestion_only' | 'auto_with_limits' | 'full_auto'
export type PresetName  = 'conservador' | 'equilibrado' | 'agressivo' | 'custom'
export type Curve       = 'A' | 'B' | 'C'

export type AbcPriority =
  | 'maintain_position' | 'maximize_margin'
  | 'balanced'          | 'volume_growth'
  | 'aggressive_turnover' | 'liquidate'

export interface AbcStrategy {
  min_margin_pct:         number
  max_discount_pct:       number
  approval_threshold_pct: number
  require_approval:       boolean
  priority:               AbcPriority
}

export interface GlobalParams {
  min_margin_absolute_pct:  number
  target_margin_pct:        number
  priority_channel:         string
  desired_position:         number
  avg_replenishment_days:   number
  min_stock_coverage_days:  number
  critical_stock_days:      number
}

export interface TriggerItem {
  id:     string
  active: boolean
  params: Record<string, number | string | boolean>
  label:  string
}

export interface TriggerGroup {
  decrease_price: TriggerItem[]
  increase_price: TriggerItem[]
  do_not_touch:   TriggerItem[]
}

export interface AbsoluteBlocks {
  never_below_cost:                 boolean
  max_change_per_run_pct:           number
  require_cost_data:                boolean
  max_changes_per_day_per_product:  number
}

export interface ConfidenceRules {
  min_for_auto_action: number
  min_for_suggestion:  number
  penalties: {
    no_cost_data:           number
    no_sales_history:       number
    no_competitor_data:     number
    new_product_under_30d:  number
    stale_data_over_48h:    number
  }
}

export interface PricingConfig {
  id:               string
  organization_id:  string
  global_params:    GlobalParams
  abc_strategies:   Record<Curve, AbcStrategy>
  triggers:         TriggerGroup
  absolute_blocks:  AbsoluteBlocks
  confidence_rules: ConfidenceRules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  custom_rules:     any
  mode:             PricingMode
  preset_name:      PresetName | null
  chat_enabled:     boolean
  chat_model:       string
  created_at:       string
  updated_at:       string
}

// ── Labels e cores ──────────────────────────────────────────────────────────

export const MODE_META: Record<PricingMode, { label: string; color: string; emoji: string; bg: string }> = {
  disabled:         { label: 'Desabilitado',         color: '#f87171', emoji: '🔴', bg: 'rgba(248,113,113,0.1)' },
  suggestion_only:  { label: 'Apenas sugestões',     color: '#fbbf24', emoji: '🟡', bg: 'rgba(251,191,36,0.1)' },
  auto_with_limits: { label: 'Automático com limites', color: '#34d399', emoji: '🟢', bg: 'rgba(52,211,153,0.1)' },
  full_auto:        { label: 'Automático completo',  color: '#a855f7', emoji: '🚀', bg: 'rgba(168,85,247,0.1)' },
}

export const PRESET_LABELS: Record<PresetName, string> = {
  conservador:  'Conservador',
  equilibrado:  'Equilibrado',
  agressivo:    'Agressivo',
  custom:       'Personalizado',
}

export const CURVE_COLORS: Record<Curve, string> = {
  A: '#00E5FF',
  B: '#3B82F6',
  C: '#6B7280',
}
export const CURVE_LABELS: Record<Curve, string> = {
  A: 'Curva A — Top performers',
  B: 'Curva B — Intermediários',
  C: 'Curva C — Cauda longa',
}

export const PRIORITY_OPTIONS: Record<Curve, Array<{ value: AbcPriority; label: string }>> = {
  A: [
    { value: 'maintain_position', label: 'Manter posição' },
    { value: 'maximize_margin',   label: 'Maximizar margem' },
  ],
  B: [
    { value: 'balanced',       label: 'Equilibrado' },
    { value: 'volume_growth',  label: 'Crescimento volume' },
  ],
  C: [
    { value: 'aggressive_turnover', label: 'Girar agressivamente' },
    { value: 'liquidate',           label: 'Liquidar' },
  ],
}

export const CHANNEL_OPTIONS = [
  { value: 'mercadolivre', label: 'Mercado Livre' },
  { value: 'shopee',       label: 'Shopee' },
  { value: 'amazon',       label: 'Amazon' },
  { value: 'magalu',       label: 'Magalu' },
]

// ── Param schemas dos triggers (drives os inputs editáveis) ─────────────────

export interface TriggerParamSpec {
  key:    string
  label:  string
  unit:   '%' | 'dias' | 'unidades' | 'posição' | ''
  type:   'number'
  min?:   number
  max?:   number
  step?:  number
}

export const TRIGGER_PARAMS: Record<string, TriggerParamSpec[]> = {
  ctr_drop: [
    { key: 'drop_pct', label: 'Queda',     unit: '%',    type: 'number', min: 1, max: 100 },
    { key: 'days',     label: 'Janela',    unit: 'dias', type: 'number', min: 1, max: 90 },
  ],
  stale_stock: [
    { key: 'days_no_sale', label: 'Sem venda há', unit: 'dias', type: 'number', min: 1, max: 365 },
  ],
  curve_c_overstock: [
    { key: 'coverage_days', label: 'Cobertura', unit: 'dias', type: 'number', min: 30, max: 365 },
  ],
  low_position: [
    { key: 'position', label: 'Posição',  unit: 'posição', type: 'number', min: 1, max: 50 },
    { key: 'days',     label: 'Por',      unit: 'dias',    type: 'number', min: 1, max: 30 },
  ],
  low_coverage: [
    { key: 'days', label: 'Cobertura <', unit: 'dias', type: 'number', min: 1, max: 60 },
  ],
  competitor_oos: [],
  growing_demand: [
    { key: 'growth_pct', label: 'Crescimento >', unit: '%', type: 'number', min: 1, max: 200 },
  ],
  high_roas: [
    { key: 'roas', label: 'ROAS >',  unit: '',     type: 'number', min: 1, max: 50, step: 0.5 },
    { key: 'days', label: 'Por',     unit: 'dias', type: 'number', min: 1, max: 30 },
  ],
  incoming_purchase: [
    { key: 'days', label: 'Chegando em <', unit: 'dias', type: 'number', min: 1, max: 90 },
  ],
  recent_change: [
    { key: 'days', label: 'Últimos', unit: 'dias', type: 'number', min: 1, max: 30 },
  ],
  active_ads: [
    { key: 'min_roas', label: 'ROAS mínimo', unit: '', type: 'number', min: 1, max: 20, step: 0.5 },
  ],
  low_stock_safe: [
    { key: 'units', label: 'Estoque <', unit: 'unidades', type: 'number', min: 1, max: 100 },
  ],
}
