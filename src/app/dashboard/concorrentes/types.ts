export type Platform = 'ml' | 'shopee' | 'amazon' | 'magalu' | string

export type Competitor = {
  id: string
  product_id: string
  organization_id: string
  platform: Platform
  url: string
  title: string | null
  seller: string | null
  current_price: number | null
  my_price: number | null
  status: 'active' | 'paused'
  last_checked: string | null
  created_at: string
  // joined
  product_name?: string
}

export type PriceHistory = {
  id: string
  competitor_id: string
  price: number
  checked_at: string
}

export type ScraperResult = {
  title: string
  price: number
  seller: string
  platform: string
}

export const PM: Record<string, { label: string; bg: string; fg: string }> = {
  ml:       { label: 'Mercado Livre', bg: '#FFE600', fg: '#111' },
  shopee:   { label: 'Shopee',        bg: '#EE4D2D', fg: '#fff' },
  amazon:   { label: 'Amazon',        bg: '#FF9900', fg: '#111' },
  magalu:   { label: 'Magalu',        bg: '#0086FF', fg: '#fff' },
}

export function priceDiff(theirs: number | null, mine: number | null): number | null {
  if (theirs == null || mine == null || mine === 0) return null
  return ((theirs - mine) / mine) * 100
}

export function brl(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'Nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Agora'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}
