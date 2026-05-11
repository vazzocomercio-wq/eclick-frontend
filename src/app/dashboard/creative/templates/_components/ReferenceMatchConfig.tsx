'use client'

/**
 * Accordion do match dinâmico de references.
 *
 * Toggles:
 *   - by_category: usa categoria do produto p/ filtrar refs
 *   - by_position_default: filtra refs cujo default_for_positions inclui essa position
 *   - by_tags: input multi-chip de tags
 * + limit: número 1..6 (default 3)
 *
 * Quando há refs fixas também configuradas, mostra hint: "Refs fixas têm
 * prioridade. Match dinâmico preenche slots restantes até `limit`."
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import type { ReferenceMatchConfig as Config } from '@/components/creative/types'

export default function ReferenceMatchConfig({
  value,
  onChange,
  hasFixedRefs,
  disabled,
}: {
  value:         Config | undefined
  onChange:      (next: Config | undefined) => void
  hasFixedRefs:  boolean
  disabled?:     boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [tagInput, setTagInput] = useState('')

  const cur: Config = value ?? {}

  const set = (patch: Partial<Config>) => {
    const next: Config = { ...cur, ...patch }
    // Limpa entradas inúteis pra manter row do DB enxuta
    if (!next.by_category && !next.by_position_default && (!next.by_tags || next.by_tags.length === 0)) {
      onChange(undefined)
      return
    }
    onChange(next)
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    const tags = Array.from(new Set([...(cur.by_tags ?? []), t]))
    set({ by_tags: tags })
    setTagInput('')
  }

  const removeTag = (t: string) => {
    set({ by_tags: (cur.by_tags ?? []).filter(x => x !== t) })
  }

  const enabledCount = [
    cur.by_category,
    cur.by_position_default,
    (cur.by_tags && cur.by_tags.length > 0),
  ].filter(Boolean).length

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900/60 hover:bg-zinc-900 transition-colors"
      >
        <span className="text-xs font-medium text-zinc-300">
          Match dinâmico de refs
          {enabledCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
              {enabledCount} regra{enabledCount !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
      </button>

      {expanded && (
        <div className="px-3 py-3 space-y-3 bg-zinc-950/40">
          {hasFixedRefs && (
            <p className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
              Refs fixas têm prioridade. Match dinâmico preenche slots restantes até <code className="font-mono">limit</code>.
            </p>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!cur.by_category}
              onChange={e => set({ by_category: e.target.checked || undefined })}
              disabled={disabled}
              className="accent-cyan-400"
            />
            <span className="text-xs text-zinc-300">
              Por categoria do produto
              <span className="block text-[10px] text-zinc-500">filtra refs cujo <code className="font-mono">category_ml_ids</code> cobre a categoria do produto vinculado</span>
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!cur.by_position_default}
              onChange={e => set({ by_position_default: e.target.checked || undefined })}
              disabled={disabled}
              className="accent-cyan-400"
            />
            <span className="text-xs text-zinc-300">
              Por position default
              <span className="block text-[10px] text-zinc-500">refs marcadas como default desta position no cadastro</span>
            </span>
          </label>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Por tags</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {(cur.by_tags ?? []).map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-cyan-400/10 text-cyan-200 border border-cyan-400/30">
                  {t}
                  <button type="button" onClick={() => removeTag(t)} disabled={disabled} className="hover:text-cyan-100">
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                disabled={disabled}
                placeholder="ex: minimalista, premium..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
              />
              <button
                type="button"
                onClick={addTag}
                disabled={disabled}
                className="px-2 rounded-md bg-zinc-900 border border-zinc-800 hover:border-cyan-400 text-cyan-400 transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Limit (1-6, default 3)</label>
            <input
              type="number"
              min={1}
              max={6}
              value={cur.limit ?? 3}
              onChange={e => set({ limit: Math.max(1, Math.min(6, Number(e.target.value) || 3)) })}
              disabled={disabled}
              className="w-20 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-200 outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      )}
    </div>
  )
}
