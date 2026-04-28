'use client'

import { useState } from 'react'
import { TriggerGroup, TriggerItem, TRIGGER_PARAMS } from './types'

type GroupKey = 'decrease_price' | 'increase_price' | 'do_not_touch'

const GROUP_META: Record<GroupKey, { label: string; emoji: string; color: string }> = {
  decrease_price: { label: 'BAIXAR PREÇO',  emoji: '🔻', color: '#34d399' },
  increase_price: { label: 'SUBIR PREÇO',   emoji: '🔺', color: '#f59e0b' },
  do_not_touch:   { label: 'NÃO MEXER',     emoji: '⏸',  color: '#a1a1aa' },
}

/** Aba 3 — Gatilhos da IA. 3 seções colapsáveis, cada uma com cards
 * por gatilho. Toggle ativa/desativa, params editáveis inline. */
export function TriggersTab({
  triggers, isDirty, setField,
}: {
  triggers: TriggerGroup
  isDirty:  (path: string) => boolean
  setField: (path: string, value: unknown) => void
}) {
  const [open, setOpen] = useState<Record<GroupKey, boolean>>({
    decrease_price: true,
    increase_price: true,
    do_not_touch:   true,
  })

  return (
    <div className="space-y-3">
      {(['decrease_price', 'increase_price', 'do_not_touch'] as GroupKey[]).map(group => {
        const items = triggers[group] ?? []
        const activeCount = items.filter(t => t.active).length
        const meta = GROUP_META[group]
        return (
          <div key={group} className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <button
              onClick={() => setOpen(o => ({ ...o, [group]: !o[group] }))}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-900 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{meta.emoji}</span>
                <p className="text-white font-semibold tracking-wide" style={{ color: meta.color }}>{meta.label}</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${meta.color}1a`, color: meta.color }}>
                  {activeCount} ativo{activeCount === 1 ? '' : 's'} de {items.length}
                </span>
              </div>
              <span className="text-zinc-400 text-sm">{open[group] ? '▾' : '▸'}</span>
            </button>

            {open[group] && (
              <div className="px-5 pb-5 space-y-2" style={{ borderTop: '1px solid #1e1e24', paddingTop: '1rem' }}>
                {items.map((trig, idx) => (
                  <TriggerCard
                    key={trig.id}
                    trigger={trig}
                    color={meta.color}
                    basePath={`triggers.${group}[${idx}]`}
                    isDirty={isDirty}
                    setField={setField}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function TriggerCard({
  trigger, color, basePath, isDirty, setField,
}: {
  trigger:  TriggerItem
  color:    string
  basePath: string
  isDirty:  (path: string) => boolean
  setField: (path: string, value: unknown) => void
}) {
  const specs = TRIGGER_PARAMS[trigger.id] ?? []
  const activePath = `${basePath}.active`
  const dirtyAny = isDirty(activePath) || specs.some(s => isDirty(`${basePath}.params.${s.key}`))

  return (
    <div className="rounded-xl p-4" style={{
      background: trigger.active ? '#0a0a0e' : '#0a0a0e',
      border: `1px solid ${dirtyAny ? color : trigger.active ? `${color}30` : '#27272a'}`,
      opacity: trigger.active ? 1 : 0.7,
    }}>
      <div className="flex items-start gap-3">
        <label className="flex items-center cursor-pointer pt-0.5">
          <input
            type="checkbox"
            checked={trigger.active}
            onChange={(e) => setField(activePath, e.target.checked)}
            className="w-4 h-4"
            style={{ accentColor: color }}
          />
        </label>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">{trigger.label}</p>

          {specs.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {specs.map(spec => {
                const path = `${basePath}.params.${spec.key}`
                const val = trigger.params?.[spec.key]
                const dirty = isDirty(path)
                return (
                  <div key={spec.key} className="flex items-center gap-1.5">
                    <span className="text-zinc-500 text-xs">{spec.label}</span>
                    <input
                      type="number"
                      value={typeof val === 'number' ? val : Number(val ?? 0)}
                      onChange={(e) => setField(path, Number(e.target.value))}
                      min={spec.min} max={spec.max} step={spec.step ?? 1}
                      disabled={!trigger.active}
                      className="w-16 px-2 py-1 text-xs font-mono rounded text-right"
                      style={{
                        background: '#18181b',
                        border: `1px solid ${dirty ? color : '#27272a'}`,
                        color: '#fafafa',
                      }}
                    />
                    {spec.unit && <span className="text-zinc-500 text-xs">{spec.unit}</span>}
                  </div>
                )
              })}
            </div>
          )}

          {specs.length === 0 && (
            <p className="text-zinc-600 text-xs mt-2 italic">Sem parâmetros — apenas ativa/desativa.</p>
          )}
        </div>

        {dirtyAny && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full self-start" style={{ background: `${color}1a`, color }}>
            ● Editado
          </span>
        )}
      </div>
    </div>
  )
}
