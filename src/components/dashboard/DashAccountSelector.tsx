'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, Store, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

// ── Escopo unificado do dashboard ────────────────────────────────────────────
// Diferente do AccountSelector (ML-only, usado nas 30+ telas ML), aqui o filtro
// é MULTI-PLATAFORMA: { plataforma, conta }. Guardado num LS separado pra não
// interferir na seleção de conta ML das outras páginas.
//
//   platform: 'all' | 'mercadolivre' | 'shopee' | 'tiktok_shop' | …
//   seller_id: number | null  (só ML tem múltiplas contas; Shopee/TikTok = null)

export interface DashScope {
  platform: string         // 'all' = todas as plataformas
  seller_id: number | null // null = todas as contas da plataforma
}

export interface DashAccount {
  platform: string
  seller_id: number | null
  nickname: string
  orders: number
}

const LS_KEY = 'eclick.dash.scope'
const SCOPE_CHANGED_EVENT = 'eclick:dash-scope-changed'

const ALL_SCOPE: DashScope = { platform: 'all', seller_id: null }

/** Metadados de exibição por plataforma (label curto + cor da marca). */
export const PLATFORM_META: Record<string, { label: string; color: string }> = {
  mercadolivre: { label: 'ML',     color: '#ffe600' },
  shopee:       { label: 'Shopee', color: '#EE4D2D' },
  tiktok_shop:  { label: 'TikTok', color: '#ff3b5c' },
  amazon:       { label: 'Amazon', color: '#FF9900' },
  magalu:       { label: 'Magalu', color: '#0086FF' },
}

export function getStoredScope(): DashScope {
  if (typeof window === 'undefined') return ALL_SCOPE
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return ALL_SCOPE
    const p = JSON.parse(raw) as Partial<DashScope>
    return {
      platform: typeof p.platform === 'string' ? p.platform : 'all',
      seller_id: typeof p.seller_id === 'number' ? p.seller_id : null,
    }
  } catch { return ALL_SCOPE }
}

export function setStoredScope(scope: DashScope) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(scope))
    window.dispatchEvent(new CustomEvent(SCOPE_CHANGED_EVENT, { detail: scope }))
  } catch { /* noop */ }
}

/** Chave estável pra dependências de efeito (refetch quando muda). */
export function scopeKey(s: DashScope): string {
  return `${s.platform}:${s.seller_id ?? 'all'}`
}

/** Monta o sufixo de query pros endpoints (&seller_id=&platforms=). */
export function buildScopeQuery(s: DashScope): string {
  const parts: string[] = []
  if (s.seller_id != null) parts.push(`seller_id=${s.seller_id}`)
  if (s.platform && s.platform !== 'all') parts.push(`platforms=${encodeURIComponent(s.platform)}`)
  return parts.length ? '&' + parts.join('&') : ''
}

/** Hook canônico do escopo do dashboard: carrega as contas com venda
 *  (/orders/accounts), gerencia a seleção com persistência + sincronia entre
 *  instâncias no mesmo tab (custom event) e entre tabs (storage event). */
export function useDashScope() {
  const [scope, setScopeRaw] = useState<DashScope>(getStoredScope())
  const [accounts, setAccounts] = useState<DashAccount[]>([])
  const [loading, setLoading] = useState(true)

  const setScope = useCallback((next: DashScope) => {
    setScopeRaw(next)
    setStoredScope(next)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`${BACKEND}/orders/accounts`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = await res.json() as DashAccount[]
      // /orders/accounts agora separa LOJAS do canal (account_id Shopee/TikTok)
      // pro filtro da tela de pedidos. O escopo do dashboard é por
      // (platform, seller_id) — agrega de volta pra não duplicar pills.
      const merged = new Map<string, DashAccount>()
      for (const a of raw) {
        const k = `${a.platform}|${a.seller_id ?? ''}`
        const prev = merged.get(k)
        if (prev) {
          prev.orders += a.orders
          // várias lojas agregadas → rótulo genérico da plataforma
          prev.nickname = a.platform === 'shopee' ? 'Shopee'
            : a.platform === 'tiktok_shop' ? 'TikTok Shop' : prev.nickname
        } else merged.set(k, { ...a })
      }
      const list = [...merged.values()].sort((x, y) => y.orders - x.orders)
      setAccounts(list)
      // F17-C: /orders/accounts agora vem filtrado pelo escopo do user no
      // backend. Se o escopo salvo no LS aponta pra conta/plataforma que o
      // user não enxerga (mais), reseta pra "todas" — evita 403 nos KPIs.
      const stored = getStoredScope()
      if (stored.platform !== 'all') {
        const stillValid = list.some(a =>
          a.platform === stored.platform
          && (stored.seller_id == null || a.seller_id === stored.seller_id))
        if (!stillValid) {
          setScopeRaw(ALL_SCOPE)
          setStoredScope(ALL_SCOPE)
        }
      }
    } catch {
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sync = () => setScopeRaw(getStoredScope())
    window.addEventListener('storage', sync)
    window.addEventListener(SCOPE_CHANGED_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(SCOPE_CHANGED_EVENT, sync)
    }
  }, [])

  return { scope, setScope, accounts, loading, refresh: load, scopeKey: scopeKey(scope) }
}

// ── Componente: dropdown unificado de contas ─────────────────────────────────

interface Props {
  scope: DashScope
  setScope: (s: DashScope) => void
  accounts: DashAccount[]
  loading?: boolean
  compact?: boolean
  className?: string
}

/** Valor serializado pra <option> — combina plataforma + conta. */
function optValue(a: DashAccount): string {
  return `${a.platform}|${a.seller_id ?? ''}`
}

export default function DashAccountSelector({ scope, setScope, accounts, loading = false, compact = false, className = '' }: Props) {
  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-zinc-500 ${className}`}>
        <Loader2 size={11} className="animate-spin" />
        Carregando contas…
      </div>
    )
  }

  // Nada com venda ainda — não renderiza filtro (caller decide o vazio).
  if (accounts.length === 0) return null

  const current = scope.platform === 'all'
    ? ''
    : optValue({ platform: scope.platform, seller_id: scope.seller_id } as DashAccount)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <select
          value={current}
          onChange={e => {
            const v = e.target.value
            if (!v) { setScope(ALL_SCOPE); return }
            const [platform, sellerRaw] = v.split('|')
            setScope({ platform, seller_id: sellerRaw ? Number(sellerRaw) : null })
          }}
          className={[
            'appearance-none bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-7 py-1.5 text-zinc-200 outline-none focus:border-cyan-400 cursor-pointer',
            compact ? 'text-[11px]' : 'text-xs',
          ].join(' ')}
        >
          <option value="">Todas as contas</option>
          {accounts.map(a => (
            <option key={optValue(a)} value={optValue(a)}>
              {a.nickname}{accounts.length > 1 ? ` · ${a.orders}` : ''}
            </option>
          ))}
        </select>
        <Store size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
      </div>
    </div>
  )
}
