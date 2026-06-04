'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'
import type { MlRequiredAttribute } from './types'

interface AttributeValue {
  id:          string
  value_name?: string
  value_id?:   string
}

interface Props {
  attributes: MlRequiredAttribute[]
  values:     AttributeValue[]
  onChange:   (next: AttributeValue[]) => void
  /** Mostra o toggle "Não se aplica" — só para atributos recomendados. */
  allowNotApplicable?: boolean
}

/** value_id "-1" = "Não se aplica" (convenção do Mercado Livre). */
const NOT_APPLICABLE = '-1'

/**
 * Form dinâmico de atributos da categoria do ML.
 * Renderiza por value_type (list/boolean/number/texto). Com
 * `allowNotApplicable`, cada atributo ganha o toggle "Não se aplica".
 */
export default function MLAttributesForm({ attributes, values, onChange, allowNotApplicable }: Props) {
  const map = new Map(values.map(v => [v.id, v]))

  function setValue(attrId: string, patch: Partial<AttributeValue>) {
    const existing = map.get(attrId)
    const next = existing ? { ...existing, ...patch } : { id: attrId, ...patch }
    onChange([...values.filter(v => v.id !== attrId), next])
  }

  function clearValue(attrId: string) {
    onChange(values.filter(v => v.id !== attrId))
  }

  if (attributes.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        {allowNotApplicable ? 'Sem atributos recomendados pra esta categoria.' : 'Sem atributos obrigatórios pra esta categoria. ✓'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {attributes.map(attr => {
        const v      = map.get(attr.id)
        // "não se aplica" só vale nos recomendados — num obrigatório com flag
        // herdado (stale), renderiza o input normal pro usuário corrigir.
        const isNA   = !!allowNotApplicable && v?.value_id === NOT_APPLICABLE
        const filled = !!(v?.value_id || v?.value_name) && !isNA
        return (
          <div key={attr.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-medium text-zinc-300 min-w-0 truncate">
                {attr.name}
                {attr.required && <span className="text-red-400 ml-1">*</span>}
                <span className="ml-1.5 font-mono text-[9px] text-zinc-600">{attr.id}</span>
              </label>
              <div className="flex items-center gap-2 shrink-0">
                {filled && !allowNotApplicable && (
                  <button
                    type="button"
                    onClick={() => clearValue(attr.id)}
                    className="text-[10px] text-zinc-500 hover:text-red-400"
                  >
                    limpar
                  </button>
                )}
                {allowNotApplicable && (
                  <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isNA}
                      onChange={e => e.target.checked
                        ? setValue(attr.id, { value_id: NOT_APPLICABLE, value_name: undefined })
                        : clearValue(attr.id)}
                      className="accent-cyan-400"
                    />
                    Não se aplica
                  </label>
                )}
              </div>
            </div>

            {isNA ? (
              <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-600 italic">
                Não se aplica
              </div>
            ) : (
              renderInput(attr, v, setValue)
            )}

            {attr.hint && !isNA && (
              <p className="text-[10px] text-zinc-500">{attr.hint}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function renderInput(
  attr:     MlRequiredAttribute,
  current:  AttributeValue | undefined,
  setValue: (id: string, patch: Partial<AttributeValue>) => void,
): React.ReactNode {
  // String COM sugestões → COMBOBOX: escolhe uma opção OU digita o seu valor.
  // O ML aceita valor livre quando value_type='string' (ex.: "Material da
  // estrutura" = Madeira, que não está na lista de sugestões). datalist nativo.
  if (attr.values && attr.values.length > 0 && attr.value_type === 'string') {
    const listId = `dl-${attr.id}`
    return (
      <>
        <input
          type="text"
          list={listId}
          value={current?.value_name ?? ''}
          onChange={e => {
            const v = e.target.value
            const opt = attr.values!.find(o => o.name.trim().toLowerCase() === v.trim().toLowerCase())
            setValue(attr.id, { value_name: v, value_id: opt?.id })
          }}
          maxLength={attr.value_max_length}
          placeholder="Escolha uma opção ou digite o seu valor"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400"
        />
        <datalist id={listId}>
          {attr.values.map(o => <option key={o.id} value={o.name} />)}
        </datalist>
      </>
    )
  }

  // List fechada (value_type='list') ou boolean com opções → dropdown nosso,
  // estilizado + PESQUISÁVEL (substitui o <select> nativo, cuja barra de
  // rolagem o navegador não deixa estilizar; e digitar filtra entre as cores).
  if (attr.values && attr.values.length > 0) {
    return (
      <SearchableSelect
        options={attr.values}
        value={current?.value_id}
        onSelect={opt => opt
          ? setValue(attr.id, { value_id: opt.id, value_name: opt.name })
          : setValue(attr.id, { value_id: undefined, value_name: undefined })}
      />
    )
  }

  // Boolean → toggle simples
  if (attr.value_type === 'boolean') {
    const isYes = current?.value_name === 'Sim' || current?.value_id === '242085'
    return (
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setValue(attr.id, { value_name: 'Sim' })}
          className={[
            'flex-1 px-3 py-1.5 rounded-lg text-xs transition-all',
            isYes ? 'bg-cyan-400 text-black font-semibold' : 'bg-zinc-950 text-zinc-400 border border-zinc-800',
          ].join(' ')}
        >Sim</button>
        <button
          type="button"
          onClick={() => setValue(attr.id, { value_name: 'Não' })}
          className={[
            'flex-1 px-3 py-1.5 rounded-lg text-xs transition-all',
            !isYes && current ? 'bg-cyan-400 text-black font-semibold' : 'bg-zinc-950 text-zinc-400 border border-zinc-800',
          ].join(' ')}
        >Não</button>
      </div>
    )
  }

  // Number / number_unit → input
  if (attr.value_type === 'number' || attr.value_type === 'number_unit') {
    return (
      <input
        type="text"
        value={current?.value_name ?? ''}
        onChange={e => setValue(attr.id, { value_name: e.target.value })}
        placeholder={attr.value_type === 'number_unit' ? 'Ex: 500 g, 30 cm' : 'número'}
        maxLength={attr.value_max_length}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400"
      />
    )
  }

  // Default: text
  return (
    <input
      type="text"
      value={current?.value_name ?? ''}
      onChange={e => setValue(attr.id, { value_name: e.target.value })}
      maxLength={attr.value_max_length}
      placeholder={attr.value_max_length ? `máx ${attr.value_max_length} caracteres` : 'preencha aqui'}
      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400"
    />
  )
}

/** Dropdown estilizado + pesquisável (substitui o <select> nativo). A lista é
 *  um elemento nosso → herda a barra de rolagem do tema (globals.css). Digitar
 *  filtra as opções — ótimo pra atributos com muitas opções (cor, voltagem…). */
type SelectOption = { id: string; name: string }
function SearchableSelect({
  options, value, onSelect, placeholder = '— selecione —',
}: {
  options:     SelectOption[]
  value:       string | undefined
  onSelect:    (opt: SelectOption | null) => void
  placeholder?: string
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const rootRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.id === value) ?? null
  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter(o => o.name.toLowerCase().includes(q)) : options

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Ao abrir: limpa a busca e foca o campo.
  useEffect(() => {
    if (open) { setQuery(''); const id = setTimeout(() => inputRef.current?.focus(), 0); return () => clearTimeout(id) }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-cyan-400 hover:border-zinc-700"
      >
        <span className={selected ? 'text-zinc-200 truncate' : 'text-zinc-500 truncate'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={13} className={`shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/50 overflow-hidden">
          <div className="p-1.5 border-b border-zinc-800">
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-md px-2 focus-within:border-cyan-400">
              <Search size={12} className="shrink-0 text-zinc-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar…"
                className="w-full bg-transparent py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onSelect(null); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800/70"
            >
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-zinc-600">Nenhuma opção encontrada</p>
            ) : (
              filtered.map(o => {
                const active = o.id === value
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { onSelect(o); setOpen(false) }}
                    className={[
                      'w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 hover:bg-zinc-800/70',
                      active ? 'text-cyan-300' : 'text-zinc-200',
                    ].join(' ')}
                  >
                    <span className="truncate">{o.name}</span>
                    {active && <Check size={12} className="shrink-0 text-cyan-300" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
