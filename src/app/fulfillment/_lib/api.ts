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

export interface FulfillmentSettings {
  organization_id?: string
  ai_damage_triage_enabled: boolean
  ai_pack_verification_enabled: boolean
  ai_smart_queue_enabled: boolean
  photo_required_always: boolean
  photo_required_above_cents: number
  photo_required_vip_channels: string[]
  auto_ingest_enabled: boolean
  auto_ingest_sources: string[]
  default_warehouse_id: string | null
  enforce_roles: boolean
  default_sla_hours: number
}

export type OperatorRole = 'picker' | 'packer' | 'supervisor' | 'admin'
export interface OrgMember { user_id: string; org_role: string; email: string | null; name: string | null }
export interface Operator { id: string; warehouse_id: string; user_id: string; role: OperatorRole; is_active: boolean; email: string | null; name: string | null }
export interface ProductivityRow { userId: string; name: string | null; email: string | null; items: number; packs: number; mismatches: number; itemsPerHour: number | null }
export interface Productivity { days: number; operators: ProductivityRow[] }

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
  lateCount: number
  dueSoonCount: number
  recentActions: Array<{ id: string; action_type: string; created_at: string; fulfillment_order_id: string | null; payload?: Record<string, unknown> }>
}

export type ReturnCondition = 'pending' | 'restock' | 'damaged' | 'discard'
export interface ReturnItem { sku: string; product_id: string | null; qty: number; condition: ReturnCondition; restocked: boolean; title?: string | null }
export interface FulfillmentReturn {
  id: string
  reference: string | null
  reason: string | null
  customer: { name?: string }
  items: ReturnItem[]
  status: 'registered' | 'inspecting' | 'resolved' | 'cancelled'
  created_at: string
}

// ── Painel tempo real (Onda B — KDS "McDonald's") ──────────────────────────
export type BoardUrgency = 'ok' | 'soon' | 'late' | 'none'
export interface BoardCard {
  id: string
  reference: string
  channel: string | null
  platform: string | null
  accountLabel: string | null
  companyName: string | null
  itemsCount: number
  deadline: string | null
  urgency: BoardUrgency
  logisticType: string | null
  customerName: string | null
  status: string
}
export interface BoardData {
  lanes: { received: BoardCard[]; picking: BoardCard[]; packing: BoardCard[]; awaiting_pickup: BoardCard[] }
  blocked: BoardCard[]
  counts: { received: number; picking: number; packing: number; awaiting_pickup: number; blocked: number; late: number; dueSoon: number }
  generatedAt: string
}

// ── Embalagens (Onda E) ─────────────────────────────────────────────────────
export type PackagingKind = 'caixa' | 'envelope' | 'sacola' | 'outro'
export interface PackagingType {
  id: string; name: string; kind: PackagingKind
  width_cm: number | null; height_cm: number | null; depth_cm: number | null
  weight_g: number | null; cost_cents: number | null; stock: number | null; is_active: boolean
}
export interface PackagingKitItem { packaging_type_id: string; qty: number }
export interface PackagingKit { id: string; name: string; items: PackagingKitItem[]; is_active: boolean }

// ── NF-e (Onda D — preparação + validação fiscal) ───────────────────────────
export type InvoiceKind = 'venda' | 'transferencia' | 'devolucao' | 'outra'
export type InvoiceStatus = 'draft' | 'issued' | 'cancelled'
export type InvoiceValidation = 'not_checked' | 'match' | 'mismatch'
export interface InvoiceItem { sku: string; description?: string | null; qty: number; unit_value?: number | null }
export interface InvoiceValidationDiffRow { sku: string; invoiceQty: number; pickedQty: number; ok: boolean }
export interface FulfillmentInvoice {
  id: string
  fulfillment_order_id: string
  company_id: string | null
  kind: InvoiceKind
  status: InvoiceStatus
  number: string | null
  series: string | null
  access_key: string | null
  danfe_url: string | null
  provider: string | null
  items: InvoiceItem[]
  validation_status: InvoiceValidation
  validation_diff: InvoiceValidationDiffRow[] | null
  validated_at: string | null
}

// ── Aguardando coleta (Onda C — staging por empresa → conta) ────────────────
export interface CollectionOrder {
  id: string
  reference: string
  status: string
  channel: string | null
  platform: string | null
  logisticType: string | null
  tracking: string | null
  shipmentId: string | null
  scheduledFrom: string | null
  scheduledTo: string | null
  deadline: string | null
  itemsCount: number
  customerName: string | null
}
export interface CollectionAccount { accountId: string | null; label: string; platform: string; orders: CollectionOrder[]; count: number }
export interface CollectionGroup { companyId: string | null; companyName: string; accounts: CollectionAccount[]; count: number }
export interface CollectionData { groups: CollectionGroup[]; total: number; generatedAt: string }

// ── Empresas & Contas (Onda A — multi-CNPJ / multiconta) ────────────────────
export type CompanyRole = 'matriz' | 'revendedora' | 'unica'
export interface FulfillmentCompany {
  id: string
  name: string
  cnpj: string | null
  role: CompanyRole
  is_default: boolean
  is_active: boolean
}
export interface FulfillmentAccount {
  id: string
  company_id: string | null
  platform: string
  external_account_id: string
  label: string | null
  is_active: boolean
}

// ── Wave IA (separação em ondas) ───────────────────────────────────────────
export type WaveStatus = 'open' | 'released' | 'collecting' | 'sorting' | 'done' | 'cancelled'
export interface WaveSummary {
  id: string
  name: string | null
  status: WaveStatus
  warehouse_id: string | null
  collected: Record<string, number>
  created_at: string
  released_at: string | null
  closed_at: string | null
  orders_count: number
}
export interface WaveConsolidatedItem {
  sku: string
  title: string | null
  expected_barcode: string | null
  totalQty: number
  collectedQty: number
  perOrder: Array<{ foId: string; ref: string | null; qty: number }>
}
export interface WaveOrderLink { fulfillmentOrderId: string; sorted: boolean; reference: string | null; channel: string | null }
export interface WaveDetail extends WaveSummary {
  orders: WaveOrderLink[]
  consolidated: WaveConsolidatedItem[]
}
export interface WaveSuggestion { foId: string; reference: string | null; channel: string | null; score: number; reason: string }
export interface WaveSuggestResponse {
  majorityChannel: string | null
  suggestions: WaveSuggestion[]
  warnings: Array<{ foId: string; reference: string | null; reason: string }>
  rationale: string | null
}

// ── Chamadas ─────────────────────────────────────────────────────────────
export const fulfillmentApi = {
  warehouses: () => api<Warehouse[]>('/fulfillment/warehouses'),
  dashboard: (wid?: string) => api<DashboardData>(`/fulfillment/dashboard${wid ? `?warehouse_id=${wid}` : ''}`),
  board: (wid?: string) => api<BoardData>(`/fulfillment/board${wid ? `?warehouse_id=${wid}` : ''}`),
  collection: (wid?: string) => api<CollectionData>(`/fulfillment/collection${wid ? `?warehouse_id=${wid}` : ''}`),

  // Onda D — NF-e
  invoices: (foId: string) => api<FulfillmentInvoice[]>(`/fulfillment/orders/${foId}/invoices`),
  upsertInvoice: (foId: string, body: { id?: string; companyId?: string | null; kind?: InvoiceKind; status?: InvoiceStatus; number?: string | null; series?: string | null; accessKey?: string | null; danfeUrl?: string | null; provider?: string | null; items?: InvoiceItem[] }) =>
    api<{ ok: boolean; id: string }>(`/fulfillment/orders/${foId}/invoices`, { method: 'PUT', body: JSON.stringify(body) }),
  validateInvoice: (id: string) =>
    api<{ status: 'match' | 'mismatch'; diff: InvoiceValidationDiffRow[] }>(`/fulfillment/invoices/${id}/validate`, { method: 'POST' }),
  removeInvoice: (id: string) => api<{ ok: boolean }>(`/fulfillment/invoices/${id}`, { method: 'DELETE' }),

  // Onda E — embalagens
  packagingTypes: () => api<PackagingType[]>('/fulfillment/packaging/types'),
  createPackagingType: (body: { name: string; kind?: PackagingKind; width_cm?: number | null; height_cm?: number | null; depth_cm?: number | null; weight_g?: number | null; cost_cents?: number | null; stock?: number | null }) =>
    api<{ ok: boolean; id: string }>('/fulfillment/packaging/types', { method: 'POST', body: JSON.stringify(body) }),
  updatePackagingType: (id: string, patch: Record<string, unknown>) =>
    api<{ ok: boolean }>(`/fulfillment/packaging/types/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removePackagingType: (id: string) => api<{ ok: boolean }>(`/fulfillment/packaging/types/${id}`, { method: 'DELETE' }),
  packagingKits: () => api<PackagingKit[]>('/fulfillment/packaging/kits'),
  createPackagingKit: (body: { name: string; items?: PackagingKitItem[] }) =>
    api<{ ok: boolean; id: string }>('/fulfillment/packaging/kits', { method: 'POST', body: JSON.stringify(body) }),
  updatePackagingKit: (id: string, patch: { name?: string; items?: PackagingKitItem[]; is_active?: boolean }) =>
    api<{ ok: boolean }>(`/fulfillment/packaging/kits/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removePackagingKit: (id: string) => api<{ ok: boolean }>(`/fulfillment/packaging/kits/${id}`, { method: 'DELETE' }),

  getSettings: () => api<FulfillmentSettings>('/fulfillment/settings'),
  updateSettings: (patch: Partial<FulfillmentSettings>) =>
    api<FulfillmentSettings>('/fulfillment/settings', { method: 'PUT', body: JSON.stringify(patch) }),

  orgMembers: () => api<OrgMember[]>('/fulfillment/org-members'),
  operators: (wid?: string) => api<Operator[]>(`/fulfillment/operators${wid ? `?warehouse_id=${wid}` : ''}`),
  addOperator: (body: { warehouseId: string; userId: string; role: OperatorRole }) =>
    api<{ ok: boolean; id?: string }>('/fulfillment/operators', { method: 'POST', body: JSON.stringify(body) }),
  updateOperator: (id: string, patch: { role?: OperatorRole; is_active?: boolean }) =>
    api<{ ok: boolean }>(`/fulfillment/operators/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeOperator: (id: string) => api<{ ok: boolean }>(`/fulfillment/operators/${id}`, { method: 'DELETE' }),
  productivity: (days?: number, wid?: string) =>
    api<Productivity>(`/fulfillment/productivity?days=${days ?? 7}${wid ? `&warehouse_id=${wid}` : ''}`),
  reconcile: () => api<{ storefront: number; marketplace: number; skipped?: boolean }>('/fulfillment/reconcile', { method: 'POST' }),

  // Onda A — empresas & contas
  companies: () => api<FulfillmentCompany[]>('/fulfillment/companies'),
  createCompany: (body: { name: string; cnpj?: string | null; role?: CompanyRole }) =>
    api<{ ok: boolean; id: string }>('/fulfillment/companies', { method: 'POST', body: JSON.stringify(body) }),
  updateCompany: (id: string, patch: { name?: string; cnpj?: string | null; role?: CompanyRole; is_active?: boolean }) =>
    api<{ ok: boolean }>(`/fulfillment/companies/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  accounts: () => api<FulfillmentAccount[]>('/fulfillment/accounts'),
  updateAccount: (id: string, patch: { company_id?: string | null; label?: string; is_active?: boolean }) =>
    api<{ ok: boolean }>(`/fulfillment/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  returns: (wid?: string) => api<FulfillmentReturn[]>(`/fulfillment/returns${wid ? `?warehouse_id=${wid}` : ''}`),
  registerReturn: (body: { warehouseId?: string; fulfillmentOrderId?: string; reference?: string; customer?: Record<string, unknown>; reason?: string; items?: Array<{ sku: string; productId?: string; qty: number; title?: string }> }) =>
    api<{ ok: boolean; id: string }>('/fulfillment/returns', { method: 'POST', body: JSON.stringify(body) }),
  resolveReturn: (id: string, resolutions: Array<{ sku: string; condition: ReturnCondition }>) =>
    api<{ ok: boolean; restocked: number }>(`/fulfillment/returns/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolutions }) }),

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

  // Wave IA
  waves: (wid?: string) => api<WaveSummary[]>(`/fulfillment/waves${wid ? `?warehouse_id=${wid}` : ''}`),
  wave: (id: string) => api<WaveDetail>(`/fulfillment/waves/${id}`),
  createWave: (body: { warehouseId?: string; name?: string; fulfillmentOrderIds: string[] }) =>
    api<{ ok: boolean; id: string; orders: number }>('/fulfillment/waves', { method: 'POST', body: JSON.stringify(body) }),
  suggestWave: (body: { warehouseId?: string; selectedIds: string[] }) =>
    api<WaveSuggestResponse>('/fulfillment/waves/suggest', { method: 'POST', body: JSON.stringify(body) }),
  releaseWave: (id: string) => api<WaveDetail>(`/fulfillment/waves/${id}/release`, { method: 'POST' }),
  scanWaveItem: (id: string, code: string) =>
    api<{ ok: boolean; sku: string; collected: number; total: number; allCollected: boolean }>(
      `/fulfillment/waves/${id}/scan-item`, { method: 'POST', body: JSON.stringify({ code }) }),
  completeWaveOrder: (id: string, foId: string) =>
    api<{ ok: boolean; allSorted?: boolean; alreadySorted?: boolean }>(`/fulfillment/waves/${id}/orders/${foId}/complete`, { method: 'POST' }),
  cancelWave: (id: string) => api<{ ok: boolean }>(`/fulfillment/waves/${id}/cancel`, { method: 'POST' }),
}
