'use client'

/**
 * F17-B · Context de permissions do user logado.
 *
 * No mount busca `GET /access/me/permissions` (com Bearer do Supabase) e
 * expõe via:
 *   - `useCan('products.publish_ml')` → boolean
 *   - `<Can permission="x">...</Can>` → renderiza children se permitido
 *   - `usePermissionsContext()` → estado completo
 *
 * Política de fallback durante o boot:
 *   - `loaded === false` → libera (retorna true). Evita flash de UI vazia.
 *   - `loaded === true && erro` → também libera (degrada gracioso; enforcement
 *     real continua sendo no backend).
 *
 * Backend é a fonte de verdade — o frontend só esconde botões pra UX. Mesmo
 * se o user contornar a UI, o Guard backend (`@RequirePermission`) recusa.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'http://localhost:3001'

/** F17-C: uma conta de marketplace sob responsabilidade do user. */
export interface AccountScopeEntry {
  platform:      string
  account_key:   string
  account_label: string | null
}

interface PermissionsState {
  loaded:      boolean
  error:       string | null
  permissions: Set<string>
  roles:       string[]
  /** null = irrestrito (vê todas as contas da org). Array = whitelist. */
  accountScope: AccountScopeEntry[] | null
}

interface PermissionsContextValue extends PermissionsState {
  /** Re-busca do backend (use após admin alterar roles do user). */
  refresh: () => Promise<void>
  /** True se user tem essa permission key. Durante boot retorna true (fallback). */
  can: (key: string) => boolean
}

const Ctx = createContext<PermissionsContextValue | null>(null)

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PermissionsState>({
    loaded:      false,
    error:       null,
    permissions: new Set(),
    roles:       [],
    accountScope: null,
  })

  const load = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        // Sem sessão = visitante. Não erra, só não tem perms.
        setState({ loaded: true, error: null, permissions: new Set(), roles: [], accountScope: null })
        return
      }
      const res = await fetch(`${BACKEND}/access/me/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        setState({ loaded: true, error: `HTTP ${res.status}`, permissions: new Set(), roles: [], accountScope: null })
        return
      }
      const body = await res.json() as {
        permissions?: string[]; roles?: string[]
        account_scope?: AccountScopeEntry[] | null
      }
      setState({
        loaded:      true,
        error:       null,
        permissions: new Set(body.permissions ?? []),
        roles:       body.roles ?? [],
        accountScope: body.account_scope ?? null,
      })
    } catch (e) {
      setState({
        loaded: true, error: (e as Error).message,
        permissions: new Set(), roles: [], accountScope: null,
      })
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const value = useMemo<PermissionsContextValue>(() => ({
    ...state,
    refresh: load,
    can: (key: string) => {
      // Fallback durante boot ou em erro: libera. Backend continua enforcing.
      if (!state.loaded || state.error) return true
      return state.permissions.has(key)
    },
  }), [state, load])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePermissionsContext(): PermissionsContextValue {
  const v = useContext(Ctx)
  if (!v) {
    // Não está dentro do Provider: assume liberado pra não quebrar UI legada
    // que não passa pelo dashboard layout. Backend continua sendo a barreira.
    return {
      loaded: true, error: null, permissions: new Set(), roles: [], accountScope: null,
      refresh: async () => {},
      can: () => true,
    }
  }
  return v
}

/** F17-C: escopo por conta do user. null = irrestrito; array = whitelist
 *  de contas (o backend já restringe os dados — isto é só pra UX). */
export function useAccountScope(): AccountScopeEntry[] | null {
  return usePermissionsContext().accountScope
}

/** Hook compacto: `const canPublish = useCan('products.publish_ml')`. */
export function useCan(permission: string): boolean {
  return usePermissionsContext().can(permission)
}

/** Wrapper declarativo: `<Can permission="x">...</Can>`.
 *  Opcionalmente um `fallback` (mostra outra coisa em vez de ocultar). */
export function Can({
  permission, fallback = null, children,
}: {
  permission: string
  fallback?:  ReactNode
  children:   ReactNode
}) {
  const ok = useCan(permission)
  return <>{ok ? children : fallback}</>
}
