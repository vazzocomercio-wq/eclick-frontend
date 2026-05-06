'use client'

import { Plus, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { MARKETPLACE_OPTIONS, type Marketplace, type CreativeListing } from './types'
import { CreativeApi } from './api'

interface Props {
  listing:  CreativeListing
  active:   Marketplace | null      // null = base
  onSelect: (next: Marketplace | null) => void
  onChange: (updated: CreativeListing) => void
}

export default function MarketplaceVariantTabs({ listing, active, onSelect, onChange }: Props) {
  const [generating, setGenerating] = useState<Marketplace | null>(null)
  const [error, setError]           = useState<string | null>(null)

  const existing = Object.keys(listing.marketplace_variants ?? {}) as Marketplace[]
  const missing  = MARKETPLACE_OPTIONS
    .map(o => o.value)
    .filter(v => !existing.includes(v) && v !== 'multi') // multi não faz sentido como variante isolada

  async function generateVariant(target: Marketplace) {
    setError(null)
    setGenerating(target)
    try {
      const updated = await CreativeApi.createVariant(listing.id, target)
      onChange(updated)
      onSelect(target)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        <Tab active={active === null} onClick={() => onSelect(null)}>
          Base
        </Tab>
        {existing.map(m => {
          const opt = MARKETPLACE_OPTIONS.find(o => o.value === m)
          return (
            <Tab key={m} active={active === m} onClick={() => onSelect(m)}>
              <span>{opt?.emoji}</span>
              <span>{opt?.label ?? m}</span>
            </Tab>
          )
        })}

        {missing.length > 0 && (
          <details className="relative">
            <summary className="list-none cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-zinc-950 text-zinc-400 border border-dashed border-zinc-800 hover:border-cyan-400/40 hover:text-cyan-300">
              <Plus size={10} /> Variante
            </summary>
            <div className="absolute z-10 mt-1 right-0 min-w-[180px] rounded-lg border border-zinc-800 bg-zinc-950 shadow-lg p-1">
              {missing.map(target => {
                const opt = MARKETPLACE_OPTIONS.find(o => o.value === target)
                const busy = generating === target
                return (
                  <button
                    key={target}
                    type="button"
                    onClick={() => generateVariant(target)}
                    disabled={!!generating}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={10} className="animate-spin" /> : <span>{opt?.emoji}</span>}
                    <span>{opt?.label ?? target}</span>
                    {busy && <span className="text-[10px] text-cyan-400 ml-auto">gerando…</span>}
                  </button>
                )
              })}
            </div>
          </details>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-red-400">{error}</p>
      )}
    </div>
  )
}

function Tab({
  active, onClick, children,
}: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-all',
        active
          ? 'bg-cyan-400 text-black font-semibold'
          : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-cyan-400/40 hover:text-zinc-200',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
