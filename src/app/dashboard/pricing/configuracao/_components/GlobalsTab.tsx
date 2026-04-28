'use client'

import { GlobalParams, CHANNEL_OPTIONS } from './types'

/** Aba 1 — Parâmetros Globais. Cards 2-col com inputs + helpers. Cada
 * mudança chama setField(path, value) — page.tsx tracka dirty paths. */
export function GlobalsTab({
  params, isDirty, setField,
}: {
  params:   GlobalParams
  isDirty:  (path: string) => boolean
  setField: (path: string, value: unknown) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumberCard
        path="global_params.min_margin_absolute_pct"
        label="Margem mínima absoluta"
        value={params.min_margin_absolute_pct}
        unit="%"
        helper="Nunca vende abaixo disso — limite de segurança."
        dirty={isDirty('global_params.min_margin_absolute_pct')}
        onChange={(v) => setField('global_params.min_margin_absolute_pct', v)}
        min={0} max={100}
      />
      <NumberCard
        path="global_params.target_margin_pct"
        label="Margem alvo"
        value={params.target_margin_pct}
        unit="%"
        helper="Onde quer estar na maioria dos produtos."
        dirty={isDirty('global_params.target_margin_pct')}
        onChange={(v) => setField('global_params.target_margin_pct', v)}
        min={0} max={100}
      />
      <SelectCard
        path="global_params.priority_channel"
        label="Canal prioritário"
        value={params.priority_channel}
        options={CHANNEL_OPTIONS}
        helper="Canal mais relevante pra estratégia de preço."
        dirty={isDirty('global_params.priority_channel')}
        onChange={(v) => setField('global_params.priority_channel', v)}
      />
      <SelectCard
        path="global_params.desired_position"
        label="Posição desejada no canal"
        value={String(params.desired_position)}
        options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}º` }))}
        helper="Top 3 = foco em destaque. Posições mais altas demandam preços competitivos."
        dirty={isDirty('global_params.desired_position')}
        onChange={(v) => setField('global_params.desired_position', Number(v))}
      />
      <NumberCard
        path="global_params.avg_replenishment_days"
        label="Prazo médio de reposição"
        value={params.avg_replenishment_days}
        unit="dias"
        helper="Da ordem de compra até chegar no estoque."
        dirty={isDirty('global_params.avg_replenishment_days')}
        onChange={(v) => setField('global_params.avg_replenishment_days', v)}
        min={1} max={365}
      />
      <NumberCard
        path="global_params.min_stock_coverage_days"
        label="Cobertura mínima de estoque"
        value={params.min_stock_coverage_days}
        unit="dias"
        helper="Mínimo de dias antes de alertar reposição."
        dirty={isDirty('global_params.min_stock_coverage_days')}
        onChange={(v) => setField('global_params.min_stock_coverage_days', v)}
        min={1} max={180}
      />
      <NumberCard
        path="global_params.critical_stock_days"
        label="Estoque crítico"
        value={params.critical_stock_days}
        unit="dias"
        helper="Abaixo disso: modo conservador de preços."
        dirty={isDirty('global_params.critical_stock_days')}
        onChange={(v) => setField('global_params.critical_stock_days', v)}
        min={1} max={60}
        critical
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function NumberCard({
  label, value, unit, helper, dirty, onChange, min, max, critical,
}: {
  label:    string
  value:    number
  unit:     string
  helper:   string
  dirty:    boolean
  onChange: (v: number) => void
  min?:     number
  max?:     number
  critical?: boolean
  path?:    string
}) {
  const accent = critical ? '#f87171' : '#00E5FF'
  return (
    <div className="rounded-2xl p-4" style={{
      background: '#111114',
      border: `1px solid ${dirty ? accent : '#1e1e24'}`,
    }}>
      <p className="text-zinc-300 text-sm font-semibold">{label}</p>
      <div className="flex items-center gap-2 mt-3">
        <input
          type="number"
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min} max={max}
          className="cfg-input flex-1 text-lg font-semibold"
          style={{ color: critical ? '#f87171' : '#fafafa' }}
        />
        <span className="text-zinc-500 text-sm">{unit}</span>
      </div>
      <p className="text-zinc-500 text-xs mt-2">{helper}</p>
      <style jsx>{`
        .cfg-input {
          padding: 0.5rem 0.75rem; background: #0a0a0e;
          border: 1px solid #27272a; border-radius: 0.5rem;
          outline: none;
        }
        .cfg-input:focus { border-color: ${accent}; }
      `}</style>
    </div>
  )
}

function SelectCard({
  label, value, options, helper, dirty, onChange,
}: {
  label:    string
  value:    string
  options:  Array<{ value: string; label: string }>
  helper:   string
  dirty:    boolean
  onChange: (v: string) => void
  path?:    string
}) {
  return (
    <div className="rounded-2xl p-4" style={{
      background: '#111114',
      border: `1px solid ${dirty ? '#00E5FF' : '#1e1e24'}`,
    }}>
      <p className="text-zinc-300 text-sm font-semibold">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cfg-input mt-3 w-full text-sm font-medium"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <p className="text-zinc-500 text-xs mt-2">{helper}</p>
      <style jsx>{`
        .cfg-input {
          padding: 0.5rem 0.75rem; background: #0a0a0e;
          border: 1px solid #27272a; border-radius: 0.5rem;
          color: #fafafa; outline: none;
        }
        .cfg-input:focus { border-color: #00E5FF; }
      `}</style>
    </div>
  )
}
