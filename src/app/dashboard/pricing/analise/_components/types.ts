// Pricing Signals — espelha shapes do backend (P2)

export type SignalType   = 'decrease_price' | 'increase_price' | 'do_not_touch' | 'review_needed' | 'low_confidence'
export type SignalStatus = 'active' | 'actioned' | 'expired' | 'auto_applied'
export type Severity     = 'low' | 'medium' | 'high' | 'critical'

export interface PricingSignal {
  id:                   string
  organization_id:      string
  product_id:           string | null
  listing_id:           string | null
  channel:              string
  signal_type:          SignalType
  trigger_id:           string
  severity:             Severity
  title:                string
  description:          string | null
  current_price:        number | null
  suggested_price:      number | null
  current_margin_pct:   number | null
  min_safe_price:       number | null
  signal_data:          Record<string, unknown>
  confidence_score:     number
  confidence_breakdown: Record<string, number>
  status:               SignalStatus
  notification_status:  'pending' | 'sent' | 'failed' | 'skipped' | 'disabled'
  notified_at:          string | null
  expires_at:           string
  created_at:           string
  updated_at:           string
}

export interface SignalsSummary {
  total:       number
  by_severity: Record<Severity, number>
  by_type:     Record<SignalType, number>
}

// ── Labels e cores ──────────────────────────────────────────────────────────

export const SEVERITY_META: Record<Severity, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Crítico', emoji: '🔴', color: '#f87171', bg: 'rgba(248,113,113,0.05)',  border: '#ef4444' },
  high:     { label: 'Alto',    emoji: '🟠', color: '#fb923c', bg: 'rgba(251,146,60,0.05)',   border: '#f97316' },
  medium:   { label: 'Médio',   emoji: '🟡', color: '#fbbf24', bg: 'rgba(251,191,36,0.05)',   border: '#eab308' },
  low:      { label: 'Baixo',   emoji: '🟢', color: '#34d399', bg: 'rgba(52,211,153,0.05)',   border: '#22c55e' },
}

export const SIGNAL_TYPE_META: Record<SignalType, { label: string; icon: string; color: string }> = {
  decrease_price: { label: 'Baixar preço',     icon: '↓', color: '#00E5FF' },
  increase_price: { label: 'Subir preço',      icon: '↑', color: '#34d399' },
  do_not_touch:   { label: 'Não mexer',        icon: '⏸', color: '#a1a1aa' },
  review_needed:  { label: 'Revisar manual',   icon: '🔍', color: '#fbbf24' },
  low_confidence: { label: 'Confiança baixa',  icon: '❓', color: '#a1a1aa' },
}

export const TRIGGER_LABELS: Record<string, string> = {
  ctr_drop:           'CTR caiu mais que X% em Y dias E concorrente mais barato',
  stale_stock:        'Estoque parado por X dias sem venda',
  curve_c_overstock:  'Curva C com cobertura > X dias',
  low_position:       'Posição no canal > X por Y dias',
  low_coverage:       'Cobertura < X dias sem compra em andamento',
  competitor_oos:     'Concorrente principal esgotado',
  growing_demand:     'Demanda crescendo > X% semana a semana',
  high_roas:          'ROAS > X por Y dias consecutivos',
  incoming_purchase:  'Compra chegando em < X dias',
  recent_change:      'Mudança nos últimos X dias',
  active_ads:         'Em campanha Ads com ROAS > X',
  low_stock_safe:     'Estoque < X unidades (modo conservador)',
}

export const PENALTY_LABELS: Record<string, string> = {
  no_cost_data:           'Custo não cadastrado',
  no_sales_history:       'Sem histórico de vendas',
  no_competitor_data:     'Sem dados de concorrente',
  new_product_under_30d:  'Produto novo (< 30 dias)',
  stale_data_over_48h:    'Dados desatualizados (> 48h)',
}

export function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}
export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null) return '—'
  return `${Number(v).toFixed(digits)}%`
}
export function fmtRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1)    return 'agora'
  if (m < 60)   return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24)   return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}
export function confidenceColor(score: number): string {
  if (score >= 75) return '#34d399'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}
