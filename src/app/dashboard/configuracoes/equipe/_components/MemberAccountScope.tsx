'use client'

/**
 * F17-C · Escopo por conta na tela Equipe.
 *
 * Chip por membro mostrando a responsabilidade de contas:
 *   - "Todas as contas" (sem restrição — default)
 *   - "N conta(s)" (whitelist) com tooltip dos nomes
 *
 * Owner clica e abre modal com as contas conectadas da org (ML, Shopee,
 * TikTok, Loja Própria) pra montar a whitelist. Lista vazia = acesso total.
 * Enforcement REAL é no backend (orders/dashboards filtram pelo escopo);
 * aqui é gestão + UX.
 */

import { useCallback, useEffect, useState } from 'react'
import { Store, Loader2, X, Check, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface ScopeRow {
  platform:      string
  account_key:   string
  account_label: string | null
}

const PLATFORM_LABEL: Record<string, { label: string; color: string }> = {
  mercadolivre: { label: 'ML',     color: '#ffe600' },
  shopee:       { label: 'Shopee', color: '#EE4D2D' },
  tiktok_shop:  { label: 'TikTok', color: '#ff3b5c' },
  storefront:   { label: 'Loja',   color: '#00E5FF' },
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await createClient().auth.getSession()
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${session?.access_token}`,
  }
}

export default function MemberAccountScope({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const [scopes, setScopes]   = useState<ScopeRow[] | null>(null) // null = carregando
  const [open, setOpen]       = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/access/account-scopes/users/${userId}`, {
        headers: await authHeaders(),
      })
      if (!res.ok) { setScopes([]); return }
      const json = await res.json() as { scopes?: ScopeRow[] }
      setScopes(json.scopes ?? [])
    } catch { setScopes([]) }
  }, [userId])

  useEffect(() => { void load() }, [load])

  if (scopes === null) {
    return <Loader2 size={11} className="animate-spin text-zinc-700 shrink-0" />
  }

  const restricted = scopes.length > 0
  const title = restricted
    ? scopes.map(s => s.account_label ?? `${s.platform}/${s.account_key}`).join(' · ')
    : 'Acesso a todas as contas da organização'

  return (
    <>
      <button
        onClick={() => canEdit && setOpen(true)}
        disabled={!canEdit}
        title={canEdit ? `${title} — clique pra editar` : title}
        className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 transition-all disabled:cursor-default"
        style={restricted
          ? { background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)' }
          : { background: 'rgba(161,161,170,0.10)', color: '#71717a', border: '1px solid transparent' }}
      >
        <Store size={10} />
        {restricted ? `${scopes.length} conta${scopes.length > 1 ? 's' : ''}` : 'Todas as contas'}
      </button>

      {open && (
        <ScopeModal
          userId={userId}
          initial={scopes}
          onClose={() => setOpen(false)}
          onSaved={(next) => { setScopes(next); setOpen(false) }}
        />
      )}
    </>
  )
}

function ScopeModal({
  userId, initial, onClose, onSaved,
}: {
  userId:  string
  initial: ScopeRow[]
  onClose: () => void
  onSaved: (next: ScopeRow[]) => void
}) {
  const [options, setOptions]   = useState<ScopeRow[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial.map(s => `${s.platform}::${s.account_key}`)),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${BACKEND}/access/account-scopes/options`, {
          headers: await authHeaders(),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as { accounts?: ScopeRow[] }
        setOptions(json.accounts ?? [])
      } catch (e) {
        setError(`Erro ao carregar contas: ${(e as Error).message}`)
        setOptions([])
      }
    })()
  }, [])

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      const rows = (options ?? []).filter(o => selected.has(`${o.platform}::${o.account_key}`))
      const res = await fetch(`${BACKEND}/access/account-scopes/users/${userId}`, {
        method:  'PUT',
        headers: await authHeaders(),
        body:    JSON.stringify({ scopes: rows }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string }
        throw new Error(err.message ?? `HTTP ${res.status}`)
      }
      onSaved(rows)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const allAccess = selected.size === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-4"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Contas sob responsabilidade</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-zinc-500 hover:bg-zinc-700/40"><X size={14} /></button>
        </div>

        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Sem nenhuma conta marcada, o membro tem <strong className="text-zinc-400">acesso total</strong>.
          Marcando contas, ele passa a enxergar pedidos, métricas e seletores
          <strong className="text-zinc-400"> apenas das contas marcadas</strong>.
        </p>

        {options === null ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500 py-4">
            <Loader2 size={12} className="animate-spin" /> Carregando contas da organização…
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {options.map(o => {
              const key = `${o.platform}::${o.account_key}`
              const on  = selected.has(key)
              const meta = PLATFORM_LABEL[o.platform] ?? { label: o.platform, color: '#a1a1aa' }
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
                  style={{
                    background: on ? 'rgba(0,229,255,0.07)' : '#0a0a0e',
                    border:     `1px solid ${on ? 'rgba(0,229,255,0.35)' : '#27272a'}`,
                  }}
                >
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                    style={{ background: on ? '#00E5FF' : 'transparent', border: on ? 'none' : '1px solid #3f3f46' }}
                  >
                    {on && <Check size={11} className="text-black" />}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0"
                    style={{ background: `${meta.color}1a`, color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-zinc-200 truncate">{o.account_label ?? o.account_key}</span>
                </button>
              )
            })}
          </div>
        )}

        {error && (
          <div className="rounded-lg p-3 text-sm" style={{
            background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
          }}>{error}</div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[10px]" style={{ color: allAccess ? '#71717a' : '#00E5FF' }}>
            {allAccess ? 'Acesso total (nenhuma restrição)' : `${selected.size} conta(s) selecionada(s)`}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving || options === null}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#000' }}>
              {saving && <Loader2 size={11} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
