'use client'

/**
 * Sub-sprint B — Ficha técnica dinâmica ML-aware
 *
 * Quando o listing tem `category_ml_id`, carrega os atributos REAIS dessa
 * categoria do ML e renderiza ficha técnica com:
 *   - Campos OBRIGATÓRIOS em destaque (badge vermelho + label uppercase)
 *   - Campos opcionais embaixo
 *   - Tipos respeitados:
 *     - list (values[]) → <select>
 *     - number, number_unit → <input type="number">
 *     - string com value_max_length → <input> + contador
 *   - Hints do ML como tooltip
 *   - Seção "Extras" pros campos custom que NÃO estão em attributes ML
 *
 * Persistência: continua usando `technical_sheet` jsonb (key/value),
 * usando o `name` do atributo ML como key. Quando publish for chamado,
 * o backend mapeia name → id ML.
 *
 * Quando NÃO há `category_ml_id`, fallback pro KeyValueEditor genérico.
 */

import { useEffect, useMemo, useState } from 'react'
import { Plus, X, Loader2, AlertCircle, AlertTriangle, Info, RefreshCw, CheckCircle2 } from 'lucide-react'
import { CreativeApi } from './api'

export interface MlAttribute {
  id:                string
  name:              string
  value_type:        string
  required:          boolean
  value_max_length?: number
  values?:           Array<{ id: string; name: string }>
  hint?:             string
}

type Row = { key: string; value: string }

export default function MlAttributesEditor({
  categoryMlId,
  items,
  onChange,
  disabled,
}: {
  categoryMlId: string | null
  items:        Row[]
  onChange:     (next: Row[]) => void
  disabled?:    boolean
}) {
  const [attrs, setAttrs]     = useState<MlAttribute[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const load = async () => {
    if (!categoryMlId) {
      setAttrs(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await CreativeApi.getMlCategoryAttributesDetail(categoryMlId)
      setAttrs(list)
    } catch (e) {
      setError((e as Error).message)
      setAttrs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryMlId])

  // Map por name pra lookup rápido (matching com technical_sheet existente)
  const attrByName = useMemo(() => {
    const m = new Map<string, MlAttribute>()
    for (const a of attrs ?? []) m.set(a.name.toLowerCase(), a)
    return m
  }, [attrs])

  // Helper pra setar 1 campo no items[] (substitui se existir pelo nome, senão adiciona)
  const setField = (name: string, value: string) => {
    const lower = name.toLowerCase()
    const idx = items.findIndex(r => r.key.toLowerCase() === lower)
    const next = [...items]
    if (idx >= 0) {
      if (value === '') next.splice(idx, 1)
      else              next[idx] = { key: name, value }
    } else if (value !== '') {
      next.push({ key: name, value })
    }
    onChange(next)
  }

  const getValue = (name: string): string => {
    const lower = name.toLowerCase()
    return items.find(r => r.key.toLowerCase() === lower)?.value ?? ''
  }

  // Separa items em: ML-mapped + Extras
  const extras = useMemo(() => {
    if (!attrs) return items
    return items.filter(r => !attrByName.has(r.key.toLowerCase()))
  }, [items, attrs, attrByName])

  // Fallback: sem categoria ML — usa KeyValueEditor inline
  if (!categoryMlId) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Ficha técnica</span>
          <span className="text-[10px] text-amber-300 inline-flex items-center gap-1">
            <AlertTriangle size={10} /> Sem categoria ML detectada — campos livres
          </span>
        </div>
        <FreeKvEditor items={items} onChange={onChange} disabled={disabled} />
      </div>
    )
  }

  if (loading && !attrs) {
    return (
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Ficha técnica</span>
        <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
          <Loader2 size={12} className="animate-spin" /> Carregando atributos da categoria ML…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Ficha técnica</span>
        <div className="flex items-center gap-2 text-xs text-red-300 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertCircle size={12} className="shrink-0" />
          <span className="flex-1">Falha ao carregar atributos ML: {error}</span>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-red-200 hover:bg-red-500/20"
          >
            <RefreshCw size={10} /> tentar de novo
          </button>
        </div>
        {/* Fallback livre */}
        <FreeKvEditor items={items} onChange={onChange} disabled={disabled} />
      </div>
    )
  }

  const required = (attrs ?? []).filter(a => a.required)
  const optional = (attrs ?? []).filter(a => !a.required)
  const filledRequired  = required.filter(a => getValue(a.name).trim()).length
  const totalRequired   = required.length
  const allRequiredOk   = filledRequired === totalRequired
  const filledOptional  = optional.filter(a => getValue(a.name).trim()).length
  const totalOptional   = optional.length

  return (
    <div className="space-y-3">
      {/* Header com status */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          Ficha técnica <span className="text-[9px] text-zinc-600 normal-case font-medium">(ML-aware)</span>
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={allRequiredOk ? 'text-emerald-400' : 'text-amber-300'}>
            {allRequiredOk ? <CheckCircle2 size={10} className="inline" /> : <AlertTriangle size={10} className="inline" />}
            {' '}{filledRequired}/{totalRequired} obrigatórios
          </span>
          {totalOptional > 0 && (
            <span className="text-zinc-500">{filledOptional}/{totalOptional} opcionais</span>
          )}
        </div>
      </div>

      {/* OBRIGATÓRIOS */}
      {required.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-300">
            Obrigatórios pela categoria
          </p>
          <div className="space-y-1.5">
            {required.map(attr => (
              <AttrInput
                key={attr.id}
                attr={attr}
                value={getValue(attr.name)}
                onChange={v => setField(attr.name, v)}
                disabled={disabled}
                highlight
              />
            ))}
          </div>
        </div>
      )}

      {/* OPCIONAIS */}
      {optional.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Opcionais (melhoram qualidade do anúncio)
          </p>
          <div className="space-y-1.5">
            {optional.map(attr => (
              <AttrInput
                key={attr.id}
                attr={attr}
                value={getValue(attr.name)}
                onChange={v => setField(attr.name, v)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* EXTRAS — campos custom que não estão em attributes ML */}
      {extras.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Extras <span className="font-medium normal-case text-zinc-600">(não enviados pro ML — informativo)</span>
          </p>
          <FreeKvEditor items={extras} onChange={next => {
            // Atualiza só os extras dentro do items[] global
            const mlItems = items.filter(r => attrByName.has(r.key.toLowerCase()))
            onChange([...mlItems, ...next])
          }} disabled={disabled} />
        </div>
      )}

      {/* Botão pra adicionar extra mesmo quando vazio */}
      {extras.length === 0 && !disabled && (
        <button
          type="button"
          onClick={() => onChange([...items, { key: '', value: '' }])}
          className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-dashed border-zinc-800 hover:border-cyan-400/40 hover:text-cyan-400 text-zinc-500 text-xs flex items-center justify-center gap-1"
        >
          <Plus size={12} /> Adicionar campo extra (não enviado pro ML)
        </button>
      )}
    </div>
  )
}

// ── Sub: input genérico que escolhe o tipo certo baseado no attr ─────────

function AttrInput({
  attr, value, onChange, disabled, highlight,
}: {
  attr:       MlAttribute
  value:      string
  onChange:   (v: string) => void
  disabled?:  boolean
  highlight?: boolean
}) {
  const hasValues = Array.isArray(attr.values) && attr.values.length > 0
  const isNumber  = attr.value_type === 'number' || attr.value_type === 'number_unit'

  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <label className="col-span-5 text-xs text-zinc-300 pt-1.5 flex items-center gap-1 truncate" title={attr.name}>
        {attr.required && <span className="text-red-400" aria-label="obrigatório">*</span>}
        <span className="truncate">{attr.name}</span>
        {attr.hint && (
          <span title={attr.hint} className="text-zinc-600 hover:text-zinc-400">
            <Info size={10} />
          </span>
        )}
      </label>

      <div className="col-span-7">
        {hasValues ? (
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className={[
              'w-full bg-zinc-950 border rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400',
              highlight && !value ? 'border-red-500/40' : 'border-zinc-800',
            ].join(' ')}
          >
            <option value="">— selecionar —</option>
            {attr.values!.map(v => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
        ) : (
          <input
            type={isNumber ? 'number' : 'text'}
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            placeholder={attr.hint?.slice(0, 60) ?? ''}
            maxLength={attr.value_max_length}
            className={[
              'w-full bg-zinc-950 border rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600',
              highlight && !value.trim() ? 'border-red-500/40' : 'border-zinc-800',
            ].join(' ')}
          />
        )}
        {attr.value_max_length && !hasValues && (
          <p className="text-[9px] text-zinc-600 mt-0.5">
            {value.length}/{attr.value_max_length}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Sub: editor livre (fallback + extras) ────────────────────────────────

function FreeKvEditor({
  items, onChange, disabled,
}: {
  items:    Row[]
  onChange: (next: Row[]) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      {items.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-2">
          <input
            type="text"
            value={row.key}
            onChange={e => {
              const next = [...items]
              next[i] = { ...row, key: e.target.value }
              onChange(next)
            }}
            disabled={disabled}
            placeholder="Campo"
            className="col-span-5 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
          />
          <input
            type="text"
            value={row.value}
            onChange={e => {
              const next = [...items]
              next[i] = { ...row, value: e.target.value }
              onChange(next)
            }}
            disabled={disabled}
            placeholder="Valor"
            className="col-span-6 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="col-span-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-400/40 hover:text-red-400 text-zinc-500"
            >
              <X size={12} className="mx-auto" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...items, { key: '', value: '' }])}
          className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-dashed border-zinc-800 hover:border-cyan-400/40 hover:text-cyan-400 text-zinc-500 text-xs flex items-center justify-center gap-1"
        >
          <Plus size={12} /> Adicionar campo
        </button>
      )}
    </div>
  )
}
