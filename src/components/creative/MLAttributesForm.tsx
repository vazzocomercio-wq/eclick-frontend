'use client'

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
        const isNA   = v?.value_id === NOT_APPLICABLE
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
  // List / string com opções → select
  if (attr.values && attr.values.length > 0) {
    return (
      <select
        value={current?.value_id ?? ''}
        onChange={e => {
          const opt = attr.values!.find(o => o.id === e.target.value)
          if (opt) setValue(attr.id, { value_id: opt.id, value_name: opt.name })
          else setValue(attr.id, { value_id: undefined, value_name: undefined })
        }}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400"
      >
        <option value="">— selecione —</option>
        {attr.values.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
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
