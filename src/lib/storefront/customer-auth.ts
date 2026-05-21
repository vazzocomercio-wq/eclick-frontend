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
