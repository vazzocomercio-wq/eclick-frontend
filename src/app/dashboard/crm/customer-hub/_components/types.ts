// Shapes do backend customer-hub. Espelha src/modules/customer-hub/.

export type Curve     = 'A' | 'B' | 'C'
export type ChurnRisk = 'low' | 'medium' | 'high' | 'critical'

export interface Overview {
  total_customers:      number
  abc:                  Record<Curve, number>
  churn:                Record<ChurnRisk, number>
  segments:             Record<string, number>
  avg_ltv:              number
  avg_ticket:           number
  active_customers_90d: number
  top_segment:          string | null
}

export interface AbcBucket {
  count:       number
  revenue:     number
  avg_ticket:  number
  pct_revenue: number
}

export interface AbcResult {
  A:             AbcBucket
  B:             AbcBucket
  C:             AbcBucket
  total_revenue: number
}

export interface TopCustomer {
  id:                string
  display_name:      string | null
  phone:             string | null
  cpf:               string | null
  abc_curve:         Curve | null
  ltv_score:         number | null
  rfm_score:         number | null
  rfm_monetary:      number | null
  rfm_frequency:     number | null
  rfm_recency_days:  number | null
  segment:           string | null
  last_purchase_at:  string | null
  avg_ticket:        number | null
}

export interface RfmDistribution {
  histogram: Array<{ bucket: number; label: string; count: number }>
  scatter:   Array<{ id: string; name: string | null; frequency: number; recency: number; monetary: number; score: number }>
}

export interface ChurnRiskCustomer {
  id:                string
  display_name:      string | null
  phone:             string | null
  last_purchase_at:  string | null
  rfm_recency_days:  number | null
  ltv_score:         number | null
  avg_ticket:        number | null
  churn_risk:        ChurnRisk
}

export interface CustomerSegment {
  id:               string
  organization_id:  string
  name:             string
  description:      string | null
  color:            string
  icon:             string
  rules:            SegmentRule[]
  customer_count:   number
  auto_refresh:     boolean
  last_computed_at: string | null
  created_at:       string
  updated_at:       string
}

export type SegmentField =
  | 'abc_curve' | 'churn_risk' | 'segment'
  | 'total_purchases' | 'purchase_count' | 'rfm_score' | 'avg_ticket'
  | 'last_purchase_days' | 'has_cpf' | 'is_vip'

export type SegmentOperator =
  | 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in'

export interface SegmentRule {
  field:    SegmentField
  operator: SegmentOperator
  value:    unknown
}

export const CHURN_LABELS: Record<ChurnRisk, string> = {
  low:      'Baixo (compra < 30d)',
  medium:   'Médio (30-90d)',
  high:     'Alto (90-180d)',
  critical: 'Crítico (> 180d)',
}
export const CHURN_COLORS: Record<ChurnRisk, string> = {
  low:      '#34d399',
  medium:   '#fbbf24',
  high:     '#fb923c',
  critical: '#f87171',
}

export const ABC_COLORS: Record<Curve, string> = {
  A: '#00E5FF',
  B: '#60a5fa',
  C: '#71717a',
}
export const ABC_LABELS: Record<Curve, string> = {
  A: 'Curva A — Top performers',
  B: 'Curva B — Intermediários',
  C: 'Curva C — Cauda longa',
}

export const SEGMENT_AUTO_LABELS: Record<string, string> = {
  campeoes:    'Campeões',
  leais:       'Leais',
  promissores: 'Promissores',
  novos:       'Novos',
  em_risco:    'Em risco',
  perdidos:    'Perdidos',
  ocasionais:  'Ocasionais',
}

export const SEGMENT_FIELD_LABELS: Record<SegmentField, string> = {
  abc_curve:          'Curva ABC',
  churn_risk:         'Risco de churn',
  segment:            'Segmento automático',
  total_purchases:    'Total comprado (R$)',
  purchase_count:     'Nº de compras',
  rfm_score:          'Score RFM',
  avg_ticket:         'Ticket médio',
  last_purchase_days: 'Dias desde última compra',
  has_cpf:            'Tem CPF',
  is_vip:             'É VIP',
}

export const OPERATOR_LABELS: Record<SegmentOperator, string> = {
  eq:     'é igual a',
  gt:     'maior que',
  lt:     'menor que',
  gte:    'maior ou igual',
  lte:    'menor ou igual',
  in:     'está em',
  not_in: 'não está em',
}

export function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
}
export function fmtNumber(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR').format(Number(v))
}
export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null) return '—'
  return `${(Number(v) * 100).toFixed(digits)}%`
}
