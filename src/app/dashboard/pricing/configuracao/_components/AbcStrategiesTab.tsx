'use client'

import {
  AbcStrategy, Curve, AbcPriority,
  CURVE_COLORS, CURVE_LABELS, PRIORITY_OPTIONS,
} from './types'

/** Aba 2 — Estratégia por Curva ABC. 3 cards lado a lado com slider+input
 * pra cada limite (min_margin/max_discount/approval_threshold), toggle
 * pra require_approval e select de priority. */
export function AbcStrategiesTab({
  strategies, isDirty, setField,
}: {
  strategies: Record<Curve, AbcStrategy>
  isDirty:    (path: string) => boolean
  setField:   (path: string, value: unknown) => void
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {(['A','B','C'] as Curve[]).map(c => (
        <CurveCard
          key={c}
          curve={c}
          strategy={strategies[c]}
          isDirty={isDirty}
          setField={setField}
        />
      ))}
    </div>
  )
}

function CurveCard({
  curve, strategy, isDirty, setField,
}: {
  curve:    Curve
  strategy: AbcStrategy
  isDirty:  (path: string) => boolean
  setField: (path: string, value: unknown) => void
}) {
  const color = CURVE_COLORS[curve]
  const base = `abc_strategies.${curve}`

  return (
    <div className="rounded-2xl p-5" style={{ background: '#111114', border: `1px solid ${color}40` }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl font-bold"
          style={{ background: `${color}1a`, color }}>
          {curve}
        </div>
        <div>
          <p className="text-white font-semibold">Curva {curve}</p>
          <p className="text-zinc-500 text-xs">{CURVE_LABELS[curve].split('—')[1]?.trim()}</p>
        </div>
      </div>

      <SliderField
        label="Margem mínima"
        value={Number(strategy.min_margin_pct)}
        unit="%"
        min={0} max={50}
        color={color}
        dirty={isDirty(`${base}.min_margin_pct`)}
        onChange={(v) => setField(`${base}.min_margin_pct`, v)}
      />
      <SliderField
        label="Máximo de desconto"
        value={Number(strategy.max_discount_pct)}
        unit="%"
        min={0} max={30}
        color={color}
        dirty={isDirty(`${base}.max_discount_pct`)}
        onChange={(v) => setField(`${base}.max_discount_pct`, v)}
      />
      <SliderField
        label="Aprovação acima de"
        value={Number(strategy.approval_threshold_pct)}
        unit="%"
        min={0} max={15}
        color={color}
        dirty={isDirty(`${base}.approval_threshold_pct`)}
        onChange={(v) => setField(`${base}.approval_threshold_pct`, v)}
      />

      <label className="flex items-center gap-2 mt-4 cursor-pointer">
        <input
          type="checkbox"
          checked={!!strategy.require_approval}
          onChange={(e) => setField(`${base}.require_approval`, e.target.checked)}
          className="w-4 h-4"
          style={{ accentColor: color }}
        />
        <span className="text-sm text-zinc-300">Requer aprovação humana sempre</span>
        {isDirty(`${base}.require_approval`) && <span className="text-[10px] uppercase" style={{ color }}>● editado</span>}
      </label>

      <div className="mt-4">
        <p className="text-zinc-500 text-xs mb-1">Prioridade</p>
        <select
          value={strategy.priority}
          onChange={(e) => setField(`${base}.priority`, e.target.value as AbcPriority)}
          className="abc-select"
          style={{
            border: `1px solid ${isDirty(`${base}.priority`) ? color : '#27272a'}`,
          }}
        >
          {PRIORITY_OPTIONS[curve].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <style jsx>{`
        .abc-select {
          width: 100%; padding: 0.5rem 0.75rem; background: #0a0a0e;
          border-radius: 0.5rem; color: #fafafa; font-size: 0.875rem; outline: none;
        }
        .abc-select:focus { border-color: ${color}; }
      `}</style>
    </div>
  )
}

function SliderField({
  label, value, unit, min, max, color, dirty, onChange,
}: {
  label:    string
  value:    number
  unit:     string
  min:      number
  max:      number
  color:    string
  dirty:    boolean
  onChange: (v: number) => void
}) {
  const safeValue = Number.isFinite(value) ? value : 0
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-zinc-400 text-xs">{label}</p>
        <div className="flex items-center gap-1">
          {dirty && <span className="text-[10px]" style={{ color }}>●</span>}
          <input
            type="number"
            value={safeValue}
            onChange={(e) => onChange(Number(e.target.value))}
            min={min} max={max}
            className="w-14 px-1.5 py-0.5 text-xs text-right font-mono rounded"
            style={{
              background: '#0a0a0e',
              border: `1px solid ${dirty ? color : '#27272a'}`,
              color: '#fafafa',
            }}
          />
          <span className="text-zinc-500 text-xs">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} step="1"
        value={safeValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer appearance-none rounded"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((safeValue - min) / (max - min)) * 100}%, #27272a ${((safeValue - min) / (max - min)) * 100}%, #27272a 100%)`,
          accentColor: color,
        }}
      />
    </div>
  )
}
