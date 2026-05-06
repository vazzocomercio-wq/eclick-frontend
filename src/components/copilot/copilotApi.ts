import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = (body as { message?: string; error?: string }).message ?? (body as { error?: string }).error ?? 'erro'
    throw new Error(`[${res.status}] ${msg}`)
  }
  return (await res.json()) as T
}

export interface KbEntryLight {
  title:    string
  category?: string
  routes:   string[]
  tags?:    string[]
}

export interface RouteContext {
  entries:        KbEntryLight[]
  total_kb_size:  number
}

export interface CopilotMessage {
  role:    'user' | 'assistant'
  content: string
}

export const CopilotApi = {
  /** Tópicos relacionados à tela atual (pra mostrar antes do user perguntar). */
  getRouteContext: (pathname: string) =>
    api<RouteContext>(`/copilot/route-context?pathname=${encodeURIComponent(pathname)}`),

  /** Pergunta principal — Haiku responde com KB excerpt + question. */
  ask: (body: { pathname: string; question: string; history?: CopilotMessage[] }) =>
    api<{ answer: string; matched_kb: number; cost_usd: number }>(
      '/copilot/help',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  /** Feedback thumbs up/down + comentário opcional. */
  feedback: (body: {
    pathname: string
    question: string
    answer:   string
    rating:   'up' | 'down'
    comment?: string
  }) =>
    api<{ ok: true }>(
      '/copilot/feedback',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  /** Lista KB completa por categoria. */
  listKb: () =>
    api<Record<string, Array<{ title: string; tags: string[]; routes: string[] }>>>(
      '/copilot/kb',
    ),
}
