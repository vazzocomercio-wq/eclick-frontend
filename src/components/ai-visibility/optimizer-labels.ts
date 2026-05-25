// Tipos + labels PT-BR do GEO Optimizer (rascunho, apply, impacto do piloto).
// Espelha os tipos do backend (ai-visibility/shared/types.ts).

export interface TitleVariation {
  variant:            'A' | 'B' | 'C'
  type:               string   // transacional | comparativa | informacional
  title:              string
  reasoning:          string
  target_query:       string
  estimated_geo_lift: number
}

export interface OptimizerDraft {
  optimizerId:      string
  status:           string
  title_variations: TitleVariation[]
  description_old:  string | null
  description_new:  string | null
  cost_usd:         number
}

export interface ApplyResult {
  ok:           boolean
  versionId:    string
  listingId:    string
  titleApplied: boolean
  titleLocked:  boolean
}

// ── ImpactTracker (Dia 14) ────────────────────────────────────────────────

export interface ImpactMetricDelta {
  metric:    'visits' | 'units' | 'revenue'
  before:    number
  after:     number | null
  delta_pct: number | null
  improved:  boolean
}

export interface ListingImpact {
  listing_id:       string
  optimizer_id:     string | null
  sku:              string | null
  apply_date:       string
  window_from:      string
  window_to:        string
  window_elapsed:   boolean
  days_remaining:   number
  geo_score_before: number | null
  metrics:          ImpactMetricDelta[]
  is_win:           boolean
  note:             string | null
}

export interface ImpactReport {
  generated_at: string
  total:        number
  measured:     number
  pending:      number
  win_count:    number
  threshold:    number
  delta_pct:    number
  verdict:      'GO' | 'NO_GO' | 'pending'
  listings:     ListingImpact[]
}

export function variantTypeLabel(type: string): string {
  const map: Record<string, string> = {
    transacional:  'Transacional',
    comparativa:   'Comparativa',
    informacional: 'Informacional',
  }
  return map[type] ?? type
}

export function metricLabel(metric: string): string {
  const map: Record<string, string> = { visits: 'Visitas', units: 'Unidades', revenue: 'Receita' }
  return map[metric] ?? metric
}

/** Cor + rótulo do veredito do piloto. */
export function verdictStyle(verdict: string): { color: string; label: string; bg: string } {
  if (verdict === 'GO')    return { color: '#4ADE80', label: 'GO — GEO Score impacta venda', bg: 'rgba(74,222,128,0.10)' }
  if (verdict === 'NO_GO') return { color: '#EF4444', label: 'NO-GO — sem ganho relevante', bg: 'rgba(239,68,68,0.10)' }
  return { color: '#F59E0B', label: 'Em medição', bg: 'rgba(245,158,11,0.10)' }
}

export function impactNoteLabel(note: string | null): string {
  const map: Record<string, string> = {
    window_open:  'Janela de medição em aberto',
    rolled_back:  'Otimização revertida',
    no_product:   'Sem vínculo de produto (venda não medível)',
  }
  return note ? (map[note] ?? note) : ''
}

export function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
