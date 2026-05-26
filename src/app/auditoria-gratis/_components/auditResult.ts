/**
 * Tipos do resultado da Auditoria GEO pública (espelho do backend
 * PublicAuditResult em public-audit-processor.service.ts).
 */

export type Band = 'red' | 'yellow' | 'green'

export interface PublicAuditResult {
  platform: string
  score: number
  band: Band
  headline: string
  dimensions: Array<{ key: string; label: string; score: number; weight: number; status: Band }>
  topProblems: Array<{ rank: number; key: string; title: string; why: string; gain: string }>
  rankSimulation: { query: string; candidate_count: number; your_rank: number | null } | null
  science: { kdd: string; ego: string }
  skipped: { reason: string } | null
}

export interface PublicAuditStatus {
  id: string
  status: 'running' | 'done' | 'failed'
  geo_score: number | null
  platform: string | null
  result: PublicAuditResult | null
  created_at: string
}

export const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  'https://eclick-backend-production-2a87.up.railway.app'

export const BAND_COLOR: Record<Band, string> = {
  red: '#EF4444',
  yellow: '#F59E0B',
  green: '#4ADE80',
}

export function bandLabel(band: Band): string {
  if (band === 'red') return 'INVISÍVEL PRA IA'
  if (band === 'yellow') return 'PARCIALMENTE VISÍVEL'
  return 'BEM POSICIONADA'
}
