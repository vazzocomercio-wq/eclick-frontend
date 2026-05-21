'use client'

/**
 * Auth client-side do AFILIADO da Loja Própria.
 *
 * Mesma infra do customer-auth (PBKDF2 + JWT HS256 com role='affiliate'),
 * mas token é salvo separado pra não conflitar com sessão de cliente.
 *
 * Também cuida do COOKIE de tracking ?ref=<code>: quando visitante chega
 * com ?ref=joao_x9, persistimos em localStorage com TTL configurado pela
 * loja (default 30 dias). Checkout pega esse code e envia no POST.
 */

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

export interface Affiliate {
  id:                     string
  organization_id:        string
  code:                   string
  name:                   string
  email:                  string
  phone:                  string | null
  doc:                    string | null
  custom_commission_pct:  number | null
  status:                 'pending' | 'approved' | 'rejected' | 'suspended'
  total_clicks:           number
  total_orders:           number
  total_earned_cents:     number
  total_paid_cents:       number
  payout_method:          string | null
  payout_details:         Record<string, unknown> | null
}

export interface AffiliateStats {
  clicks_today:    number
  clicks_7d:       number
  clicks_30d:      number
  orders_total:    number
  pending_cents:   number
  approved_cents:  number
  paid_cents:      number
}

export interface AffiliateCommission {
  id:                string
  order_id:          string
  order_total_cents: number
  commission_pct:    number
  amount_cents:      number
  status:            string
  approved_at:       string | null
  paid_at:           string | null
  created_at:        string
}

const tokenKey = (slug: string) => `affiliate_token_${slug}`

export function getAffiliateToken(slug: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(tokenKey(slug))
}

export function setAffiliateToken(slug: string, token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(tokenKey(slug), token)
}

export function clearAffiliateToken(slug: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(tokenKey(slug))
}

export async function fetchCurrentAffiliate(slug: string): Promise<Affiliate | null> {
  const token = getAffiliateToken(slug)
  if (!token) return null
  try {
    const res = await fetch(`${BACKEND}/public/affiliate/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      if (res.status === 401) clearAffiliateToken(slug)
      return null
    }
    return await res.json() as Affiliate
  } catch { return null }
}

export async function affiliateSignup(slug: string, body: {
  name: string; email: string; password: string; phone?: string; doc?: string; code?: string
}): Promise<{ affiliate: Affiliate; token: string }> {
  const res = await fetch(`${BACKEND}/public/affiliate/by-slug/${encodeURIComponent(slug)}/signup`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `Erro HTTP ${res.status}`)
  }
  const data = await res.json() as { affiliate: Affiliate; token: string }
  setAffiliateToken(slug, data.token)
  return data
}

export async function affiliateLogin(slug: string, body: { email: string; password: string }): Promise<{
  affiliate: Affiliate; token: string
}> {
  const res = await fetch(`${BACKEND}/public/affiliate/by-slug/${encodeURIComponent(slug)}/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Email ou senha inválidos')
  }
  const data = await res.json() as { affiliate: Affiliate; token: string }
  setAffiliateToken(slug, data.token)
  return data
}

export async function fetchMyStats(slug: string): Promise<AffiliateStats | null> {
  const token = getAffiliateToken(slug)
  if (!token) return null
  const res = await fetch(`${BACKEND}/public/affiliate/me/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return await res.json() as AffiliateStats
}

export async function fetchMyCommissions(slug: string): Promise<AffiliateCommission[]> {
  const token = getAffiliateToken(slug)
  if (!token) return []
  const res = await fetch(`${BACKEND}/public/affiliate/me/commissions`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  return await res.json() as AffiliateCommission[]
}

// ── Cookie de tracking ?ref= ────────────────────────────────────────

const REF_KEY = (slug: string) => `affiliate_ref_${slug}`
const REF_TTL_MS = 30 * 86400_000  // 30 dias default

interface RefCookie {
  code:      string
  expiresAt: number
}

export function getRefCode(slug: string): string | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(REF_KEY(slug))
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as RefCookie
    if (data.expiresAt < Date.now()) {
      localStorage.removeItem(REF_KEY(slug))
      return null
    }
    return data.code
  } catch { return null }
}

export function setRefCode(slug: string, code: string, ttlMs = REF_TTL_MS): void {
  if (typeof window === 'undefined') return
  const data: RefCookie = { code, expiresAt: Date.now() + ttlMs }
  localStorage.setItem(REF_KEY(slug), JSON.stringify(data))
}

export function clearRefCode(slug: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(REF_KEY(slug))
}

/** Chamado quando a página detecta ?ref=X na URL: salva o cookie +
 *  dispara o track-click pro backend (que faz dedup de 24h por IP). */
export async function trackAffiliateRef(slug: string, code: string, opts?: {
  referrerUrl?: string; landingUrl?: string; customerEmail?: string
}): Promise<void> {
  setRefCode(slug, code)
  try {
    await fetch(`${BACKEND}/public/affiliate/by-slug/${encodeURIComponent(slug)}/track`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        referrerUrl:   opts?.referrerUrl   ?? (typeof document !== 'undefined' ? document.referrer : undefined),
        landingUrl:    opts?.landingUrl    ?? (typeof window   !== 'undefined' ? window.location.href : undefined),
        customerEmail: opts?.customerEmail,
      }),
    })
  } catch { /* silent — tracking é best-effort */ }
}
