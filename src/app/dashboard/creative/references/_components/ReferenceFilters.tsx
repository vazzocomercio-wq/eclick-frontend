'use client'

/**
 * Topbar de filtros (combináveis com AND). Search com debounce 300ms.
 * Reactive: cada mudança chama onChange — page.tsx faz refetch.
 *
 * Filtros disponíveis (espelham backend):
 *   - search (text, debounced)
 *   - tag (string única ou csv; backend faz overlaps)
 *   - category_ml_id
 *   - product_type
 *   - ambient
 *   - only_curated (mostra só curated)
 *   - include_inactive (mostra também desativadas)
 */

import { useEffect, useState, useRef } from 'react'
import { Search, X } from 'lucide-react'

export type FilterState = {
  search:           string
  tag:              string
  category_ml_id:   string
  product_type:     string
  ambient:          string
  only_curated:     boolean
  include_inactive: boolean
}

export const EMPTY_FILTERS: FilterState = {
  search:           '',
  tag:              '',
  category_ml_id:   '',
  product_type:     '',
  ambient:          '',
  only_curated:     false,
  include_inactive: false,
}

const PRODUCT_TYPES = ['lustre', 'pendente', 'abajur', 'plafon', 'spot', 'arandela', 'outro']
const AMBIENTS: Array<{ value: string; label: string }> = [
  { value: 'sala',        label: 'Sala' },
  { value: 'sala_estar',  label: 'Sala de estar' },
  { value: 'sala_jantar', label: 'Sala de jantar' },
  { value: 'quarto',      label: 'Quarto' },
  { value: 'cozinha',     label: 'Cozinha' },
  { value: 'banheiro',    label: 'Banheiro' },
  { value: 'gourmet',     label: 'Gourmet' },
  { value: 'varanda',     label: 'Varanda' },
  { value: 'escritorio',  label: 'Escritório' },
  { value: 'externa',     label: 'Externa' },
  { value: 'estudio',     label: 'Estúdio' },
  { value: 'neutro',      label: 'Neutro' },
  { value: 'capa',                   label: 'Capa' },
  { value: 'embalagem',              label: 'Embalagem' },
  { value: 'caracteristicas_medidas', label: 'Características / medidas' },
  { value: 'detalhes',               label: 'Detalhes' },
]

export default function ReferenceFilters({
  value, onChange, totalCount, activeCount, inactiveCount,
}: {
  value: FilterState
  onChange: (next: FilterState) => void
  totalCount: number
  activeCount: number
  inactiveCount: number
}) {
  // Debounce do search local pra não martelar API
  const [searchLocal, setSearchLocal] = useState(value.search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setSearchLocal(value.search) }, [value.search])

  const handleSearchChange = (v: string) => {
    setSearchLocal(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange({ ...value, search: v }), 300)
  }

  const hasAny =
    !!value.search || !!value.tag || !!value.category_ml_id ||
    !!value.product_type || !!value.ambient ||
    value.only_curated || value.include_inactive

  const reset = () => {
    setSearchLocal('')
    onChange(EMPTY_FILTERS)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchLocal}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar nome ou descrição..."
            className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
          />
        </div>

        <input
          type="text"
          value={value.tag}
          onChange={e => onChange({ ...value, tag: e.target.value })}
          placeholder="Tag (ex: premium)"
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600 w-36"
        />

        <input
          type="text"
          value={value.category_ml_id}
          onChange={e => onChange({ ...value, category_ml_id: e.target.value })}
          placeholder="Categoria (MLB…)"
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600 w-40"
        />

        <select
          value={value.product_type}
          onChange={e => onChange({ ...value, product_type: e.target.value })}
          className="px-2 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-cyan-400"
        >
          <option value="">Tipo: todos</option>
          {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={value.ambient}
          onChange={e => onChange({ ...value, ambient: e.target.value })}
          className="px-2 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-cyan-400"
        >
          <option value="">Ambiente: todos</option>
          {AMBIENTS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>

        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={value.only_curated}
            onChange={e => onChange({ ...value, only_curated: e.target.checked })}
            className="accent-cyan-400"
          />
          Só curadas
        </label>

        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={value.include_inactive}
            onChange={e => onChange({ ...value, include_inactive: e.target.checked })}
            className="accent-cyan-400"
          />
          Incluir desativadas
        </label>

        {hasAny && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      <div className="text-[11px] text-zinc-500">
        {totalCount} referência{totalCount === 1 ? '' : 's'}
        {' '}({activeCount} ativa{activeCount === 1 ? '' : 's'}, {inactiveCount} inativa{inactiveCount === 1 ? '' : 's'})
      </div>
    </div>
  )
}
