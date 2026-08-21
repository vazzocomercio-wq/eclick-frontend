// Espelho dos tipos do backend (src/modules/ml-reputation/ml-reputation.types.ts).
// Percentuais em PONTOS PERCENTUAIS (2.5 = 2,5%). Nada aqui é calculado no
// frontend — a tela só apresenta o que o motor devolveu.

export type MetricKey = 'cancellations' | 'incorrectShipments' | 'claims'
export const METRIC_KEYS: readonly MetricKey[] = ['cancellations', 'incorrectShipments', 'claims'] as const

export type ReputationLevel = 'green' | 'yellow' | 'orange' | 'red'
export type LevelOrUnknown  = ReputationLevel | 'unknown'
export type RiskLevel       = 'safe' | 'attention' | 'high' | 'critical'
export type RiskOrUnknown   = RiskLevel | 'unknown'

export interface MetricThresholds { green: number; yellow: number; orange: number }

export interface RuleSetConfig {
  measurement: { shortPeriodDays: number; longPeriodDays: number; minimumSalesForShortPeriod: number }
  metrics: Record<MetricKey, Record<string, MetricThresholds>>
  risk: { attentionAt: number; highAt: number; criticalAt: number }
}

export interface RuleSetSummary {
  name:           string
  effectiveFrom:  string | null
  effectiveUntil: string | null
  config:         RuleSetConfig
  notes:          string | null
}

export interface OfficialMetric { percentage: number | null; count: number | null; period: string | null }

export interface OfficialReputation {
  levelId:               string | null
  powerSellerStatus:     string | null
  cancellations:         OfficialMetric
  claims:                OfficialMetric
  delayedHandling:       OfficialMetric
  completedTransactions: number | null
  totalTransactions:     number | null
  syncedAt:              string | null
}

export interface DataCoverage {
  oldestSaleAt:        string | null
  claimsSince:         string | null
  delaysSince:         string | null
  cancelledTotal:      number
  cancelledWithDetail: number
}

export interface MetricResult {
  key:                         MetricKey
  affectedSales:               number
  totalSales:                  number
  percentage:                  number | null
  level:                       LevelOrUnknown
  greenLimit:                  number
  yellowLimit:                 number
  orangeLimit:                 number
  currentLimit:                number | null
  nextLevel:                   ReputationLevel | null
  nextLevelAt:                 number | null
  distancePercentagePoints:    number | null
  remainingOccurrencesStatic:  number | null
  remainingOccurrencesDynamic: number | null
  salesToRecoverGreen:         number | null
  marginUsedRatio:             number | null
  riskLevel:                   RiskOrUnknown
  official:                    OfficialMetric | null
  divergence:                  { deltaPercentagePoints: number; significant: boolean } | null
}

export interface PeriodForecast {
  kind:           'may_drop_to_long' | 'stable'
  horizonDays:    number
  exitsInHorizon: number
  dropAt?:        string
  dropInDays?:    number
}

export interface ReputationResult {
  accountId:                number
  orgId:                    string
  calculatedAt:             string
  dataAsOf:                 string
  ruleSet:                  { name: string; effectiveFrom: string | null; effectiveUntil: string | null }
  measurementPeriod:        number
  shortPeriodDays:          number
  longPeriodDays:           number
  salesLast60Days:          number
  salesLast365Days:         number
  salesConsidered:          number
  nextMeasurementThreshold: number
  salesUntilShortPeriod:    number
  periodForecast:           PeriodForecast | null
  metrics:                  Record<MetricKey, MetricResult>
  overallLevel:             LevelOrUnknown
  riskLevel:                RiskOrUnknown
  official:                 OfficialReputation | null
  coverage:                 DataCoverage | null
  warnings:                 string[]
}

export interface AccountView {
  seller_id:            number
  nickname:             string | null
  status:               'ready' | 'pending' | 'error'
  calculated_at:        string | null
  cancel_backfilled_at: string | null
  last_error:           string | null
  active:               ReputationResult | null
  upcoming:             ReputationResult | null
}

export interface DashboardView {
  generated_at: string
  rules: { active: RuleSetSummary; upcoming: RuleSetSummary | null }
  summary: {
    total:              number
    healthy:            number
    attention:          number
    critical:           number
    near_period_switch: number
    worsened_recently:  number
    pending:            number
  }
  accounts: AccountView[]
}

export interface HistoryPoint {
  snapshot_date:             string
  rule_set_name:             string | null
  measurement_period:        number | null
  sales_60d:                 number | null
  sales_365d:                number | null
  sales_considered:          number | null
  cancellation_count:        number | null
  cancellation_pct:          number | string | null
  cancellation_level:        string | null
  shipping_issue_count:      number | null
  shipping_issue_pct:        number | string | null
  shipping_issue_level:      string | null
  claim_count:               number | null
  claim_pct:                 number | string | null
  claim_level:               string | null
  official_level_id:         string | null
  official_cancellation_pct: number | string | null
  official_claims_pct:       number | string | null
  official_delayed_pct:      number | string | null
  overall_level:             string | null
  risk_level:                string | null
  calculated_at:             string
}

export interface ReputationEvent {
  id:         string
  seller_id:  number
  event_type: 'level_changed' | 'period_changed' | 'near_limit' | 'back_to_safe'
  metric:     MetricKey | null
  from_value: string | null
  to_value:   string | null
  severity:   'info' | 'warning' | 'critical'
  payload:    Record<string, unknown> | null
  created_at: string
}

export interface SimulationInput {
  extraOccurrences?:    Partial<Record<MetricKey, number>>
  extraSales?:          number
  occurrencesAddSales?: boolean
  rule_set?:            string
}
