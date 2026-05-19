'use client'

/**
 * Painel de gestão de clientes — lista as organizações e libera/bloqueia
 * os módulos de cada uma. Visão Geral e Configurações são núcleo (sempre
 * liberados) e não aparecem aqui.
 */

import { useEffect, useState } from 'react'
import { Loader2, Check, AlertCircle, Building2 } from 'lucide-react'
import { GATEABLE_MODULES } from '@/lib/modules'

interface Org {
  id:               string
  name:             string
  slug:             string | null
  enabled_modules:  string[] | null
}

const ALL_KEYS = GATEABLE_MODULES.map(m => m.key)

export function AdminClientsPanel() {
  const [orgs, setOrgs]       = useState<Org[]>([])
  const [draft, setDraft]     = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId]   = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/orgs')
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`)
        const list: Org[] = body.orgs ?? []
        setOrgs(list)
        const d: Record<string, Set<string>> = {}
        for (const o of list) {
          // enabled_modules NULL = todos os módulos liberados.
          d[o.id] = new Set(o.enabled_modules ?? ALL_KEYS)
        }
        setDraft(d)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function toggle(orgId: string, key: string) {
    setSavedId(null)
    setDraft(prev => {
      const set = new Set(prev[orgId] ?? [])
      if (set.has(key)) set.delete(key)
      else set.add(key)
      return { ...prev, [orgId]: set }
    })
  }

  async function save(orgId: string) {
    setSavingId(orgId); setError(null); setSavedId(null)
    try {
      const enabledModules = ALL_KEYS.filter(k => draft[orgId]?.has(k))
      const res = await fetch('/api/admin/orgs', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orgId, enabledModules }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`)
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, enabled_modules: enabledModules } : o))
      setSavedId(orgId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Building2 size={20} className="text-cyan-400" /> Gestão de clientes
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Libere ou bloqueie os módulos de cada cliente. Visão Geral e Configurações
          são sempre liberados.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> carregando…
        </div>
      ) : orgs.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma organização encontrada.</p>
      ) : (
        <div className="space-y-4">
          {orgs.map(org => {
            const set = draft[org.id] ?? new Set<string>()
            return (
              <div key={org.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{org.name}</p>
                    {org.slug && <p className="text-[11px] text-zinc-500">/{org.slug}</p>}
                  </div>
                  <button
                    onClick={() => save(org.id)}
                    disabled={savingId === org.id}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                    style={{ background: '#00E5FF', color: '#000' }}
                  >
                    {savingId === org.id
                      ? <><Loader2 size={13} className="animate-spin" /> Salvando…</>
                      : savedId === org.id
                        ? <><Check size={13} /> Salvo</>
                        : 'Salvar'}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {GATEABLE_MODULES.map(m => {
                    const on = set.has(m.key)
                    return (
                      <label
                        key={m.key}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                        style={{
                          background: on ? 'rgba(0,229,255,0.07)' : 'transparent',
                          border: `1px solid ${on ? 'rgba(0,229,255,0.3)' : '#27272a'}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(org.id, m.key)}
                          className="w-4 h-4 accent-[#00E5FF]"
                        />
                        <span className="text-[13px]" style={{ color: on ? '#e4e4e7' : '#a1a1aa' }}>
                          {m.label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
