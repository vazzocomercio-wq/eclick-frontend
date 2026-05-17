// e-Click Radar IA — helpers compartilhados das telas R4.

export function brl(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Variação percentual já em fração (0.12 → "+12,0%"). */
export function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  const s = (v * 100).toFixed(1).replace('.', ',')
  return `${v > 0 ? '+' : ''}${s}%`
}

export interface SeverityStyle {
  rule: string
  bg: string
  text: string
  label: string
}

export const SEVERITY: Record<string, SeverityStyle> = {
  critico: { rule: '#ef4444', bg: 'rgba(239,68,68,0.10)', text: '#f87171', label: 'Crítico' },
  atencao: { rule: '#f59e0b', bg: 'rgba(245,158,11,0.10)', text: '#fbbf24', label: 'Atenção' },
  info: { rule: '#00E5FF', bg: 'rgba(0,229,255,0.10)', text: '#67e8f9', label: 'Info' },
}

export function severityOf(s: string | null | undefined): SeverityStyle {
  return SEVERITY[s ?? 'info'] ?? SEVERITY.info
}

export const EVENT_LABELS: Record<string, string> = {
  queda_preco: 'Queda de preço',
  alta_preco: 'Alta de preço',
  mudanca_menor_preco: 'Mudança na ponta de preço',
  novo_concorrente: 'Novo concorrente',
  saiu_concorrente: 'Concorrente saiu',
  mudanca_frete: 'Mudança de frete',
}

export function eventLabel(t: string | null | undefined): string {
  return EVENT_LABELS[t ?? ''] ?? (t ?? 'Evento')
}

/** Reputação ML "5_green" → cor do termômetro. */
export function reputationColor(level: string | null | undefined): string {
  if (!level) return '#52525b'
  if (level.includes('green')) return '#22c55e'
  if (level.includes('yellow')) return '#f59e0b'
  if (level.includes('orange')) return '#f97316'
  if (level.includes('red')) return '#ef4444'
  return '#71717a'
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}
