'use client'

import { createClient } from '@/lib/supabase'

export const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

export async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Fetch autenticado contra o backend. Lança ApiError com a mensagem amigável do backend. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let msg = `Erro ${res.status}`
    try {
      const body = await res.json()
      msg = body?.message ?? body?.error ?? msg
      if (Array.isArray(msg)) msg = msg.join(', ')
    } catch { /* corpo não-JSON */ }
    throw new ApiError(String(msg), res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Tipos ────────────────────────────────────────────────────────────────
export interface Warehouse { id: string; name: string; code: string; is_active: boolean }

export interface PickTask {
  id: string
  fulfillment_order_id: string
  sku: string
  title: string | null
  expected_qty: number
  picked_qty: number
  expected_barcode: string | null
  status: string
  priority: number
  sla_deadline: string | null
  order?: { reference?: string | null; channel?: string | null; customer?: { name?: string } } | null
}

export interface PackTask {
  id: string
  fulfillment_order_id: string
  status: string
  requires_photo: boolean
  photo_url: string | null
  scanned_order_at: string | null
  order?: { reference?: string | null; channel?: string | null; customer?: { name?: string }; items_count?: number } | null
  items?: Array<{ sku: string; title: string | null; qty: number }>
}

export interface DashboardData {
  pickQueue: number
  packQueue: number
  damagesToday: number
  mismatch24h: number
  recentActions: Array<{ id: string; action_type: string; created_at: string; fulfillment_order_id: string | null; payload?: Record<string, unknown> }>
}

// ── Chamadas ─────────────────────────────────────────────────────────────
export const fulfillmentApi = {
  warehouses: () => api<Warehouse[]>('/fulfillment/warehouses'),
  dashboard: (wid?: string) => api<DashboardData>(`/fulfillment/dashboard${wid ? `?warehouse_id=${wid}` : ''}`),

  pickQueue: (wid?: string) => api<PickTask[]>(`/fulfillment/pick-tasks/queue${wid ? `?warehouse_id=${wid}` : ''}`),
  scanItem: (id: string, code: string) =>
    api<{ ok: boolean; matched: boolean; picked_qty: number; expected_qty: number; status: string }>(
      `/fulfillment/pick-tasks/${id}/scan-item`, { method: 'POST', body: JSON.stringify({ code }) }),
  pickComplete: (id: string) => api<{ ok: boolean }>(`/fulfillment/pick-tasks/${id}/complete`, { method: 'POST' }),
  pickBlock: (id: string, reason: string) =>
    api<{ ok: boolean }>(`/fulfillment/pick-tasks/${id}/block`, { method: 'POST', body: JSON.stringify({ reason }) }),

  packQueue: (wid?: string) => api<PackTask[]>(`/fulfillment/pack-tasks/queue${wid ? `?warehouse_id=${wid}` : ''}`),
  packScanOrder: (id: string, code: string) =>
    api<{ ok: boolean }>(`/fulfillment/pack-tasks/${id}/scan-order`, { method: 'POST', body: JSON.stringify({ code }) }),
  packPhoto: (id: string, imageBase64: string, mimeType?: string) =>
    api<{ ok: boolean; photoUrl: string | null; aiVerification: boolean | null }>(
      `/fulfillment/pack-tasks/${id}/photo`, { method: 'POST', body: JSON.stringify({ imageBase64, mimeType }) }),
  packComplete: (id: string) => api<{ ok: boolean }>(`/fulfillment/pack-tasks/${id}/complete`, { method: 'POST' }),

  printLabel: (fulfillmentOrderId: string) =>
    api<{ ok: boolean; format: string; trackingCode: string | null; labelUrl: string | null }>(
      '/fulfillment/shipment-labels/print', { method: 'POST', body: JSON.stringify({ fulfillmentOrderId }) }),

  reportDamage: (body: { warehouseId?: string; pickTaskId?: string; fulfillmentOrderId?: string; sku: string; severity: string; description?: string; photosBase64?: string[] }) =>
    api<{ ok: boolean; id?: string; aiSuggested?: unknown }>('/fulfillment/damage-reports', { method: 'POST', body: JSON.stringify(body) }),
}
