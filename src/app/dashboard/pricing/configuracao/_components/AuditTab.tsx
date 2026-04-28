'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from './api'

interface AuditEntry {
  id:              string
  organization_id: string
  config_id:       string | null
  field_path:      string
  old_value:       unknown
  new_value:       unknown
  changed_by:      string | null
  change_reason:   string | null
  created_at:      string
}

/** Aba 8 — Auditoria. Tabela das últimas 50 mudanças com tradução
 * de field_path técnico → label PT-BR humanizada. */
export function AuditTab({ onToast }: { onToast: (m: string, type?: 'success' | 'error') => void }) {
  const [list, setList]       = useState<AuditEntry[]>([])
  const [filter, setFilter]   = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setList(await api<AuditEntry[]>('/pricing/config/audit?limit=50')) }
    catch (e) { onToast((e as Error).message, 'error') }
    setLoading(false)
  }, [onToast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!filter.trim()) return list
    const q = filter.toLowerCase()
    return list.filter(e => humanizePath(e.field_path).toLowerCase().includes(q) || e.field_path.toLowerCase().includes(q))
  }, [list, filter])

  return (
    <>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <p className="text-zinc-400 text-sm">Últimas 50 mudanças. Cada PATCH/preset/reset registra entries por field_path.</p>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrar por campo..."
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa', outline: 'none', minWidth: 240 }}
        />
      </div>

      {loading
        ? <div className="h-32 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        : filtered.length === 0
          ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px dashed #27272a' }}>
              {list.length === 0 ? 'Nenhuma mudança registrada ainda.' : 'Nenhuma mudança bate com o filtro.'}
            </div>
          : <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <table className="w-full text-sm">
                <thead style={{ background: '#0a0a0e' }}>
                  <tr className="text-zinc-500 text-[11px] uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5">Data</th>
                    <th className="text-left px-4 py-2.5">Campo alterado</th>
                    <th className="text-left px-4 py-2.5">Antes</th>
                    <th className="text-left px-4 py-2.5">Depois</th>
                    <th className="text-left px-4 py-2.5">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-t" style={{ borderColor: '#1e1e24' }}>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(e.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-white">{humanizePath(e.field_path)}</p>
                        <p className="text-zinc-600 text-[10px] font-mono mt-0.5">{e.field_path}</p>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{fmtValue(e.old_value)}</td>
                      <td className="px-4 py-2.5 text-cyan-400 font-mono text-xs">{fmtValue(e.new_value)}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs italic">{e.change_reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
    </>
  )
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  if (typeof v === 'object') {
    const json = JSON.stringify(v)
    return json.length > 80 ? json.slice(0, 77) + '…' : json
  }
  return String(v)
}

// ── Path → label humanização ────────────────────────────────────────────────

const TOP_LABELS: Record<string, string> = {
  global_params:    'Globais',
  abc_strategies:   'Curva ABC',
  triggers:         'Gatilhos',
  confidence_rules: 'Confiança',
  custom_rules:     'Personalizações',
  mode:             'Modo de operação',
  preset_name:      'Preset',
  chat_enabled:     'Chat IA',
  chat_model:       'Modelo Chat IA',
}

const FIELD_LABELS: Record<string, string> = {
  // global_params
  min_margin_absolute_pct:  'Margem mínima absoluta',
  target_margin_pct:        'Margem alvo',
  priority_channel:         'Canal prioritário',
  desired_position:         'Posição desejada',
  avg_replenishment_days:   'Prazo médio de reposição',
  min_stock_coverage_days:  'Cobertura mínima de estoque',
  critical_stock_days:      'Estoque crítico',
  // abc_strategies.X.*
  min_margin_pct:           'Margem mínima',
  max_discount_pct:         'Máximo de desconto',
  approval_threshold_pct:   'Aprovação acima de',
  require_approval:         'Requer aprovação',
  priority:                 'Prioridade',
  // triggers
  active:                   'Ativo',
  drop_pct:                 'Queda (%)',
  days:                     'Dias',
  days_no_sale:             'Dias sem venda',
  coverage_days:            'Cobertura (dias)',
  position:                 'Posição',
  growth_pct:               'Crescimento (%)',
  roas:                     'ROAS',
  min_roas:                 'ROAS mínimo',
  units:                    'Unidades',
  // confidence
  min_for_auto_action:      'Mínimo para automático',
  min_for_suggestion:       'Mínimo para sugestão',
  no_cost_data:             'Penalidade — custo não cadastrado',
  no_sales_history:         'Penalidade — sem histórico',
  no_competitor_data:       'Penalidade — sem concorrente',
  new_product_under_30d:    'Penalidade — produto novo',
  stale_data_over_48h:      'Penalidade — dados desatualizados',
}

const TRIGGER_GROUP_LABELS: Record<string, string> = {
  decrease_price: 'Baixar preço',
  increase_price: 'Subir preço',
  do_not_touch:   'Não mexer',
}

function humanizePath(path: string): string {
  // Top-level scalar: mode | preset_name | chat_enabled | chat_model
  const segments = path.split('.')
  const top = segments[0].split('[')[0]
  const topLabel = TOP_LABELS[top] ?? top

  // Top-level only (mode, preset_name, etc)
  if (segments.length === 1 && !segments[0].includes('[')) {
    return topLabel
  }

  // abc_strategies.A.field_x
  if (top === 'abc_strategies' && segments.length >= 2) {
    const curve = segments[1]
    const field = segments[2]
    return `Curva ${curve} — ${FIELD_LABELS[field] ?? field}`
  }

  // triggers.<group>[N].active OR triggers.<group>[N].params.X
  if (top === 'triggers') {
    const groupMatch = path.match(/^triggers\.(\w+)(?:\[(\d+)\])?(?:\.(.+))?$/)
    if (groupMatch) {
      const group = groupMatch[1]
      const idx   = groupMatch[2]
      const rest  = groupMatch[3] // 'active' | 'params.drop_pct' | 'params'
      const groupL = TRIGGER_GROUP_LABELS[group] ?? group
      if (!rest) return `Gatilhos — ${groupL}${idx ? ` #${Number(idx) + 1}` : ''}`
      if (rest === 'active') return `Gatilho ${groupL} #${Number(idx) + 1} — Ativo`
      const paramKey = rest.startsWith('params.') ? rest.slice(7) : rest
      return `Gatilho ${groupL} #${Number(idx) + 1} — ${FIELD_LABELS[paramKey] ?? paramKey}`
    }
  }

  // confidence_rules.penalties.X
  if (top === 'confidence_rules' && segments[1] === 'penalties') {
    return FIELD_LABELS[segments[2]] ?? `Confiança — ${segments[2]}`
  }

  // confidence_rules.threshold
  if (top === 'confidence_rules' && segments.length === 2) {
    return `Confiança — ${FIELD_LABELS[segments[1]] ?? segments[1]}`
  }

  // global_params.X
  if (top === 'global_params' && segments.length >= 2) {
    return `Globais — ${FIELD_LABELS[segments[1]] ?? segments[1]}`
  }

  return `${topLabel} — ${segments.slice(1).join('.')}`
}
