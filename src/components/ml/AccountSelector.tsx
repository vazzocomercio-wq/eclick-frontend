'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, Store, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

export interface MlConnection {
  seller_id:        number
  nickname:         string | null
  expires_at:       string | null
  created_at?:      string
  updated_at?:      string
  organization_id?: string
}

const LS_KEY = 'eclick.ml.selected_seller_id'

/** Le seller_id selecionado do localStorage. null = "todas as contas". */
export function getStoredSellerId(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw || raw === 'all') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch { return null }
}

function setStoredSellerId(sellerId: number | null) {
  try {
    window.localStorage.setItem(LS_KEY, sellerId === null ? 'all' : String(sellerId))
  } catch { /* noop */ }
}

/** Hook canonico pra contas ML. Carrega lista, gerencia selecao com
 *  persistencia localStorage. selected=null significa "todas as contas". */
export function useMlAccount() {
  const [connections, setConnections] = useState<MlConnection[]>([])
  const [selected, setSelectedRaw]    = useState<number | null>(getStoredSellerId())
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const setSelected = useCallback((id: number | null) => {
    setSelectedRaw(id)
    setStoredSellerId(id)
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/ml/connections`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const conns = await res.json() as MlConnection[]
      setConnections(conns)
      // Se a conta selecionada nao existe mais (foi desconectada), reseta
      if (selected != null && !conns.some(c => c.seller_id === selected)) {
        setSelected(null)
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void load() }, [load])

  return {
    connections,
    selected,
    setSelected,
    loading,
    error,
    refresh: load,
    /** seller_id efetivo pra mandar pra backend. Quando selected=null e
     *  ha exatamente 1 conta, retorna ela; senao undefined (= todas). */
    activeSellerId: selected ?? (connections.length === 1 ? connections[0].seller_id : null),
  }
}

interface Props {
  /** Quando true, mostra "Todas as contas" como primeira opcao. Default true. */
  allowAll?: boolean
  /** Label custom acima do select. */
  label?:    string
  /** Tamanho compacto vs default. */
  compact?:  boolean
  /** Nao renderiza nada quando ha 0 contas (deixa pro chamador). Default false. */
  hideWhenEmpty?: boolean
  className?: string
}

/** Dropdown de contas ML conectadas. Plug-and-play em paginas que filtram
 *  dados por conta. Quando ha 0 contas, mostra link pra conectar. Quando
 *  ha 1, mostra como info read-only (nao mostra dropdown). */
export default function AccountSelector({ allowAll = true, label, compact = false, hideWhenEmpty = false, className = '' }: Props) {
  const { connections, selected, setSelected, loading, error } = useMlAccount()

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-zinc-500 ${className}`}>
        <Loader2 size={11} className="animate-spin" />
        Carregando contas ML…
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-xs text-red-400 ${className}`}>
        <AlertCircle size={11} />
        Erro ao carregar contas: {error}
      </div>
    )
  }

  if (connections.length === 0) {
    if (hideWhenEmpty) return null
    return (
      <div className={`flex items-center gap-2 text-xs text-amber-300 ${className}`}>
        <Store size={11} />
        Nenhuma conta ML conectada.{' '}
        <a href="/dashboard/configuracoes/integracoes" className="underline hover:text-amber-200">
          Conectar
        </a>
      </div>
    )
  }

  if (connections.length === 1) {
    const c = connections[0]
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-[11px]' : 'text-xs'} text-zinc-400 ${className}`}>
        <Store size={11} className="text-cyan-400" />
        {label && <span className="text-zinc-500">{label}:</span>}
        <span className="text-zinc-200">{c.nickname ?? `Seller ${c.seller_id}`}</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span className={`shrink-0 ${compact ? 'text-[11px]' : 'text-xs'} text-zinc-500`}>{label}:</span>
      )}
      <div className="relative">
        <select
          value={selected ?? ''}
          onChange={e => setSelected(e.target.value === '' ? null : Number(e.target.value))}
          className={[
            'appearance-none bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-7 py-1.5 text-zinc-200 outline-none focus:border-cyan-400 cursor-pointer',
            compact ? 'text-[11px]' : 'text-xs',
          ].join(' ')}
        >
          {allowAll && <option value="">Todas as contas</option>}
          {connections.map(c => (
            <option key={c.seller_id} value={c.seller_id}>
              {c.nickname ?? `Seller ${c.seller_id}`}
            </option>
          ))}
        </select>
        <Store size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
      </div>
    </div>
  )
}
