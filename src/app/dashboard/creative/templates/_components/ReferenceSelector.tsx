'use client'

/**
 * Multiselect de references fixas (use_reference_ids[]).
 *
 * Comportamento:
 *   - Mostra inline lista compacta dos IDs selecionados (com nome + thumb se carregamos)
 *   - Botão "Adicionar" abre modal com lista de refs ativas (próprias + curated)
 *   - Modal tem search + filtros + multiselect
 *
 * Quando org tem 0 references cadastradas, mostra hint "Cadastre em /references"
 * (Fase 2.5 vai criar a galeria; backend de upload já existe).
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, Search, Library } from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { CreativeReference } from '@/components/creative/types'

export default function ReferenceSelector({
  value,
  onChange,
  disabled,
}: {
  value:    string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const t = useTranslations('creative.templates')
  const [open, setOpen] = useState(false)
  const [refs, setRefs] = useState<CreativeReference[]>([])
  const [selectedDetails, setSelectedDetails] = useState<CreativeReference[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')
  const [error, setError]     = useState<string | null>(null)

  // Carrega detalhes dos IDs já selecionados (pra mostrar nome + thumb fora do modal)
  useEffect(() => {
    if (value.length === 0) { setSelectedDetails([]); return }
    let cancelled = false
    void CreativeApi.listReferences({ include_curated: true })
      .then(all => {
        if (cancelled) return
        const sel = all.filter(r => value.includes(r.id))
        setSelectedDetails(sel)
      })
      .catch(() => {/* silent */})
    return () => { cancelled = true }
  }, [value])

  // Quando abre modal, carrega lista filtrada
  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    void CreativeApi.listReferences({ search, include_curated: true })
      .then(list => setRefs(list))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [open, search])

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  }

  const remove = (id: string) => {
    onChange(value.filter(x => x !== id))
  }

  return (
    <div className="space-y-2">
      {/* Lista compacta dos selecionados */}
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map(id => {
            const ref = selectedDetails.find(r => r.id === id)
            return (
              <div key={id} className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-md bg-zinc-900 border border-zinc-800">
                {ref?.signed_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={ref.signed_url} alt={ref.name} className="w-6 h-6 rounded object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-600">
                    <Library size={10} />
                  </div>
                )}
                <span className="text-[10px] text-zinc-300 max-w-[120px] truncate">
                  {ref?.name ?? id.slice(0, 8)}
                </span>
                <button type="button" onClick={() => remove(id)} disabled={disabled} className="text-zinc-500 hover:text-zinc-200">
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-[10px] text-zinc-500 italic">{t('selectorNoneSelected')}</p>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 hover:border-cyan-400/40 text-cyan-400 text-[11px] transition-colors disabled:opacity-40"
      >
        <Plus size={11} /> {t('addFixedRefs')}
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-3xl max-h-[80vh] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Library size={14} className="text-cyan-400" />
                <h3 className="text-sm font-semibold">{t('galleryTitle')}</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-zinc-800">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('searchByNameTag')}
                  className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading && <p className="text-xs text-zinc-500">{t('loading')}</p>}
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>
              )}
              {!loading && !error && refs.length === 0 && (
                <div className="text-center py-12">
                  <Library size={32} className="mx-auto text-zinc-700 mb-3" />
                  <p className="text-sm text-zinc-400 mb-1">{t('noRefsRegistered')}</p>
                  <p className="text-[11px] text-zinc-600">
                    {t('registerInRefs')}
                  </p>
                </div>
              )}
              {!loading && refs.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {refs.map(r => {
                    const selected = value.includes(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggle(r.id)}
                        className={[
                          'group relative rounded-lg overflow-hidden border-2 transition-all',
                          selected ? 'border-cyan-400 ring-2 ring-cyan-400/30' : 'border-zinc-800 hover:border-zinc-700',
                        ].join(' ')}
                      >
                        <div className="aspect-square bg-zinc-900">
                          {r.signed_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={r.signed_url} alt={r.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700">
                              <Library size={20} />
                            </div>
                          )}
                        </div>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-1.5">
                          <p className="text-[10px] text-zinc-100 truncate">{r.name}</p>
                          {r.is_curated && (
                            <span className="text-[9px] text-cyan-300 uppercase tracking-wider">curated</span>
                          )}
                        </div>
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-cyan-400 text-black text-[10px] font-bold flex items-center justify-center">
                            ✓
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">
                {t('selectedCountSel', { count: value.length })}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-md bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-semibold"
              >
                {t('done')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
