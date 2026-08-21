import { createClient } from '@/lib/supabase'
import type {
  AccountView, DashboardView, HistoryPoint, ReputationEvent, ReputationResult, RuleSetSummary, SimulationInput,
} from './types'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const doFetch = () => fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  let res: Response
  try {
    res = await doFetch()
  } catch {
    // GET é idempotente: tenta 1× de novo. Mutações NÃO são reenviadas.
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'GET') {
      await new Promise(r => setTimeout(r, 800))
      try { res = await doFetch() } catch {
        throw new Error('Sem resposta do servidor — verifique sua internet e tente de novo.')
      }
    } else {
      throw new Error('Sem resposta do servidor — verifique sua internet. Confira se a ação foi concluída antes de repetir.')
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = (body as { message?: string | string[]; error?: string }).message ?? (body as { error?: string }).error ?? 'erro'
    throw new Error(`[${res.status}] ${Array.isArray(msg) ? msg.join(', ') : msg}`)
  }
  return (await res.json()) as T
}

export const fetchDashboard = () => api<DashboardView>('/ml-reputation/dashboard')
export const fetchAccount   = (sellerId: number) => api<AccountView>(`/ml-reputation/accounts/${sellerId}`)
export const fetchHistory   = (sellerId: number, days: number) =>
  api<{ history: HistoryPoint[] }>(`/ml-reputation/accounts/${sellerId}/history?days=${days}`)
export const fetchEvents    = (sellerId: number | null, limit = 30) =>
  api<{ events: ReputationEvent[] }>(`/ml-reputation/events?limit=${limit}${sellerId != null ? `&seller_id=${sellerId}` : ''}`)
export const fetchRules     = () => api<{ rules: RuleSetSummary[] }>('/ml-reputation/rules')
export const recalcAccount  = (sellerId: number, body: { sync_official?: boolean; backfill?: boolean } = {}) =>
  api<AccountView>(`/ml-reputation/accounts/${sellerId}/recalculate`, { method: 'POST', body: JSON.stringify(body) })
export const recalcAll      = () =>
  api<{ accounts: AccountView[] }>('/ml-reputation/recalculate', { method: 'POST', body: JSON.stringify({}) })
export const simulateAccount = (sellerId: number, body: SimulationInput) =>
  api<{ base: ReputationResult; simulated: ReputationResult }>(`/ml-reputation/accounts/${sellerId}/simulate`, { method: 'POST', body: JSON.stringify(body) })
