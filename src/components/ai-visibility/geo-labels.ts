// Labels PT-BR + faixas de cor do GEO Score (AI Visibility). Compartilhado
// entre a tela do auditor e o histórico.

export interface GeoDimension {
  name:      string
  score:     number   // 0-10
  weight:    number
  reasoning: string
  evidence:  string
}

export interface GeoRecommendation {
  dimension:        string
  severity:         'high' | 'medium' | 'low'
  title:            string
  description:      string
  example_before:   string
  example_after:    string
  estimated_impact: string
}

export interface GeoScoreData {
  jobId:           string
  url:             string
  platform:        string
  status:          string
  score:           number | null
  breakdown:       GeoDimension[] | null
  recommendations: GeoRecommendation[] | null
  skip_reason?:    string | null
  cost_usd?:       number | null
  error?:          string | null
  created_at?:     string
  completed_at?:   string | null
}

/** Motivo pelo qual a auditoria foi pulada (anúncio indisponível). */
export function skipReasonLabel(reason: string | null | undefined): string {
  const map: Record<string, string> = {
    blocked_by_marketplace: 'Bloqueado pelo marketplace',
    product_not_found:      'Anúncio não encontrado',
    product_unavailable:    'Esgotado / pausado / finalizado',
  }
  return reason ? (map[reason] ?? reason) : ''
}

/** Label PT-BR de cada dimensão do GEO Score. */
export const DIMENSION_LABELS: Record<string, string> = {
  title_geo:           'Título otimizado para IA',
  description_depth:   'Profundidade da descrição',
  entity_coverage:     'Cobertura de entidades',
  semantic_density:    'Densidade semântica',
  structured_data:     'Dados estruturados',
  review_architecture: 'Arquitetura de avaliações',
  faq_presence:        'Presença de FAQ',
  crawler_access:      'Acesso de bots de IA',
}

export function dimensionLabel(name: string): string {
  return DIMENSION_LABELS[name] ?? name
}

/** Faixa do score total 0-100 → cor + rótulo. */
export function scoreBand(score: number): { color: string; label: string } {
  if (score <= 30) return { color: '#EF4444', label: 'Crítico' }
  if (score <= 60) return { color: '#F97316', label: 'Precisa atenção' }
  if (score <= 80) return { color: '#EAB308', label: 'Bom, dá pra melhorar' }
  return { color: '#4ADE80', label: 'Excelente' }
}

/** Cor de uma dimensão 0-10. */
export function dimensionColor(score: number): string {
  if (score <= 3) return '#EF4444'
  if (score <= 6) return '#F97316'
  if (score <= 8) return '#EAB308'
  return '#4ADE80'
}

/** Cor do badge de severidade da recomendação. */
export function severityColor(severity: string): string {
  if (severity === 'high')   return '#EF4444'
  if (severity === 'medium') return '#F97316'
  return '#EAB308'
}

export function severityLabel(severity: string): string {
  if (severity === 'high')   return 'Alta'
  if (severity === 'medium') return 'Média'
  return 'Baixa'
}

/** Rótulo legível a partir da URL (o histórico não guarda título). */
export function labelFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const seg = u.pathname.split('/').filter(Boolean).pop() ?? u.hostname
    const cleaned = seg
      .replace(/^MLB-?\d+-?/i, '')
      .replace(/-_JM$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim()
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : u.hostname
  } catch {
    return url
  }
}

export function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    mercadolivre: 'Mercado Livre',
    shopee:       'Shopee',
    amazon:       'Amazon',
    generic:      'Site',
  }
  return map[platform] ?? platform
}
