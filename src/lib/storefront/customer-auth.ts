'use client'

/**
 * Auth client-side da Loja Própria.
 *
 * Token JWT do customer é salvo em localStorage com chave por slug
 * (pra suportar várias contas em lojas diferentes no mesmo navegador).
 */

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

export interface CustomerAddress {
  id:           string
  label:        string
  zip:          string
  street:       string
  number:       string
  complement?:  string
  neighborhood: string
  city:         string
  state:        string
  is_default:   boolean
}

export interface Customer {
  id:                 string
  organization_id:    string
  email:              string
  name:               string
  phone:              string | null
  doc:                string | null
  addresses:          CustomerAddress[]
  accepts_marketing:  boolean
  last_login_at:      string | null
  created_at:         string
}

const tokenKey  = (slug: string) => `storefront_token_${slug}`

export function getCustomerToken(slug: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(tokenKey(slug))
}

export function setCustomerToken(slug: string, token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(tokenKey(slug), token)
}

export function clearCustomerToken(slug: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(tokenKey(slug))
}

export async function fetchCurrentCustomer(slug: string): Promise<Customer | null> {
  const token = getCustomerToken(slug)
  if (!token) return null
  try {
    const res = await fetch(`${BACKEND}/public/store/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      if (res.status === 401) clearCustomerToken(slug)
      return null
    }
    return await res.json() as Customer
  } catch {
    return null
  }
}

export async function signup(slug: string, body: {
  email: string; password: string; name: string; phone?: string; doc?: string;
}): Promise<{ customer: Customer; token: string }> {
  const res = await fetch(`${BACKEND}/public/store/auth/by-slug/${encodeURIComponent(slug)}/signup`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `Erro HTTP ${res.status}`)
  }
  const data = await res.json() as { customer: Customer; token: string }
  setCustomerToken(slug, data.token)
  return data
}

export async function login(slug: string, body: { email: string; password: string }): Promise<{
  customer: Customer; token: string
}> {
  const res = await fetch(`${BACKEND}/public/store/auth/by-slug/${encodeURIComponent(slug)}/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Email ou senha inválidos')
  }
  const data = await res.json() as { customer: Customer; token: string }
  setCustomerToken(slug, data.token)
  return data
}

export interface CustomerOrder {
  id:               string
  total:            number
  status:           string
  shipping_status:  string | null
  tracking_code:    string | null
  created_at:       string
  items_count:      number
}

export async function fetchMyOrders(slug: string): Promise<CustomerOrder[]> {
  const token = getCustomerToken(slug)
  if (!token) return []
  const res = await fetch(`${BACKEND}/public/store/auth/me/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  return await res.json() as CustomerOrder[]
}

// ── Wishlist ────────────────────────────────────────────────────────

export async function fetchMyWishlist(slug: string): Promise<Array<{
  id: string; name: string; price: number; sale_price: number | null;
  sale_start_at: string | null; sale_end_at: string | null;
  sale_badge_text: string | null; photo_urls: string[] | null;
  category: string | null; brand: string | null;
  stock: number | null; ai_short_description: string | null;
  created_at: string | null;
}>> {
  const token = getCustomerToken(slug)
  if (!token) return []
  const res = await fetch(`${BACKEND}/public/store/auth/me/wishlist`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  return await res.json()
}

export async function addToWishlist(slug: string, productId: string): Promise<boolean> {
  const token = getCustomerToken(slug)
  if (!token) return false
  try {
    const res = await fetch(`${BACKEND}/public/store/auth/me/wishlist/${encodeURIComponent(productId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch { return false }
}

export async function removeFromWishlist(slug: string, productId: string): Promise<boolean> {
  const token = getCustomerToken(slug)
  if (!token) return false
  try {
    const res = await fetch(`${BACKEND}/public/store/auth/me/wishlist/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch { return false }
}

export async function checkWishlist(slug: string, productIds: string[]): Promise<Set<string>> {
  const token = getCustomerToken(slug)
  if (!token || productIds.length === 0) return new Set()
  try {
    const res = await fetch(
      `${BACKEND}/public/store/auth/me/wishlist/check?ids=${encodeURIComponent(productIds.join(','))}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) return new Set()
    const data = await res.json() as { favorited: string[] }
    return new Set(data.favorited ?? [])
  } catch { return new Set() }
}

export async function updateMe(slug: string, patch: Partial<Customer>): Promise<Customer | null> {
  const token = getCustomerToken(slug)
  if (!token) return null
  const res = await fetch(`${BACKEND}/public/store/auth/me`, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? 'Erro ao atualizar')
  }
  return await res.json() as Customer
}
