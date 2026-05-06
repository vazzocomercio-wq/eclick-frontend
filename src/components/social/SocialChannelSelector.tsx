'use client'

import { Check } from 'lucide-react'
import type { SocialChannel } from './types'
import { CHANNEL_GROUPS, CHANNEL_META } from './channels'

interface Props {
  value:      SocialChannel[]
  onChange:   (next: SocialChannel[]) => void
  disabled?:  boolean
}

/** Onda 3 / S1 — Seletor visual de canais sociais agrupados por categoria.
 *  Cada chip = 1 canal com ícone + cor da marca + label curto. Toggle com
 *  click; multi-select. */
export default function SocialChannelSelector({ value, onChange, disabled }: Props) {
  const toggle = (ch: SocialChannel) => {
    if (disabled) return
    if (value.includes(ch)) onChange(value.filter(c => c !== ch))
    else onChange([...value, ch])
  }

  return (
    <div className="space-y-4">
      {CHANNEL_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">{group.label}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.channels.map(ch => {
              const meta = CHANNEL_META[ch]
              const Icon = meta.icon
              const selected = value.includes(ch)
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggle(ch)}
                  disabled={disabled}
                  className={[
                    'group relative flex items-center gap-2 px-3 py-2 rounded-lg',
                    'border bg-zinc-900/40 backdrop-blur-sm transition-all text-left',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    selected
                      ? 'border-cyan-400/60 shadow-[0_0_0_1px_rgba(0,229,255,0.2)]'
                      : 'border-zinc-800 hover:border-zinc-700',
                  ].join(' ')}
                  style={selected ? { background: `${meta.color}10` } : undefined}
                >
                  <Icon size={16} style={{ color: meta.color }} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-200 truncate">{meta.shortLabel}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{meta.description.slice(0, 38)}…</p>
                  </div>
                  {selected && (
                    <Check size={12} className="shrink-0 text-cyan-400" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {value.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <p className="text-[11px] text-zinc-500">
            {value.length} canal{value.length > 1 ? 'is' : ''} selecionado{value.length > 1 ? 's' : ''}
          </p>
          <button
            onClick={() => onChange([])}
            disabled={disabled}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            limpar
          </button>
        </div>
      )}
    </div>
  )
}
