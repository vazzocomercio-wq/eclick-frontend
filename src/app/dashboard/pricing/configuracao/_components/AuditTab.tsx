'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('pricing')
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
    return list.filter(e => humanizePath(e.field_path, t).toLowerCase().includes(q) || e.field_path.toLowerCase().includes(q))
  }, [list, filter, t])

  return (
    <>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <p className="text-zinc-400 text-sm">{t('auditIntro')}</p>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder={t('auditFilterPlaceholder')}
          className="px-3 py-1.5 rounded-lg text-xs"
          style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa', outline: 'none', minWidth: 240 }}
        />
      </div>

      {loading
        ? <div className="h-32 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        : filtered.length === 0
          ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px dashed #27272a' }}>
              {list.length === 0 ? t('noChangesRecorded') : t('noChangesMatchFilter')}
            </div>
          : <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <table className="w-full text-sm">
                <thead style={{ background: '#0a0a0e' }}>
                  <tr className="text-zinc-500 text-[11px] uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5">{t('auditColDate')}</th>
                    <th className="text-left px-4 py-2.5">{t('auditColField')}</th>
                    <th className="text-left px-4 py-2.5">{t('auditColBefore')}</th>
                    <th className="text-left px-4 py-2.5">{t('auditColAfter')}</th>
                    <th className="text-left px-4 py-2.5">{t('auditColReason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-t" style={{ borderColor: '#1e1e24' }}>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs whitespace-nowrap">{fmtDate(e.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-white">{humanizePath(e.field_path, t)}</p>
                        <p className="text-zinc-600 text-[10px] font-mono mt-0.5">{e.field_path}</p>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{fmtValue(e.old_value, t)}</td>
                      <td className="px-4 py-2.5 text-cyan-400 font-mono text-xs">{fmtValue(e.new_value, t)}</td>
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

function fmtValue(v: unknown, t: ReturnType<typeof useTranslations>): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? t('valueYes') : t('valueNo')
  if (typeof v === 'object') {
    const json = JSON.stringify(v)
    return json.length > 80 ? json.slice(0, 77) + '…' : json
  }
  return String(v)
}

// ── Path → label humanização ────────────────────────────────────────────────

const TOP_KEYS = new Set([
  'global_params', 'abc_strategies', 'triggers', 'confidence_rules',
  'custom_rules', 'mode', 'preset_name', 'chat_enabled', 'chat_model',
])

const FIELD_KEYS = new Set([
  'min_margin_absolute_pct', 'target_margin_pct', 'priority_channel', 'desired_position',
  'avg_replenishment_days', 'min_stock_coverage_days', 'critical_stock_days',
  'min_margin_pct', 'max_discount_pct', 'approval_threshold_pct', 'require_approval', 'priority',
  'active', 'drop_pct', 'days', 'days_no_sale', 'coverage_days', 'position',
  'growth_pct', 'roas', 'min_roas', 'units',
  'min_for_auto_action', 'min_for_suggestion', 'no_cost_data', 'no_sales_history',
  'no_competitor_data', 'new_product_under_30d', 'stale_data_over_48h',
])

const TRIGGER_GROUP_KEYS = new Set(['decrease_price', 'increase_price', 'do_not_touch'])

type Translator = ReturnType<typeof useTranslations>

function topLabelOf(key: string, t: Translator): string {
  return TOP_KEYS.has(key) ? t(`auditTop_${key}`) : key
}
function fieldLabelOf(key: string, t: Translator): string {
  return FIELD_KEYS.has(key) ? t(`auditField_${key}`) : key
}
function triggerGroupLabelOf(key: string, t: Translator): string {
  return TRIGGER_GROUP_KEYS.has(key) ? t(`auditTriggerGroup_${key}`) : key
}

function humanizePath(path: string, t: Translator): string {
  // Top-level scalar: mode | preset_name | chat_enabled | chat_model
  const segments = path.split('.')
  const top = segments[0].split('[')[0]
  const topLabel = topLabelOf(top, t)

  // Top-level only (mode, preset_name, etc)
  if (segments.length === 1 && !segments[0].includes('[')) {
    return topLabel
  }

  // abc_strategies.A.field_x
  if (top === 'abc_strategies' && segments.length >= 2) {
    const curve = segments[1]
    const field = segments[2]
    return t('auditCurveField', { curve, field: fieldLabelOf(field, t) })
  }

  // triggers.<group>[N].active OR triggers.<group>[N].params.X
  if (top === 'triggers') {
    const groupMatch = path.match(/^triggers\.(\w+)(?:\[(\d+)\])?(?:\.(.+))?$/)
    if (groupMatch) {
      const group = groupMatch[1]
      const idx   = groupMatch[2]
      const rest  = groupMatch[3] // 'active' | 'params.drop_pct' | 'params'
      const groupL = triggerGroupLabelOf(group, t)
      if (!rest) return idx
        ? t('auditTriggerGroupIdx', { group: groupL, idx: Number(idx) + 1 })
        : t('auditTriggerGroupNoIdx', { group: groupL })
      const paramKey = rest === 'active' ? 'active' : (rest.startsWith('params.') ? rest.slice(7) : rest)
      return t('auditTriggerField', { group: groupL, idx: Number(idx) + 1, field: fieldLabelOf(paramKey, t) })
    }
  }

  // confidence_rules.penalties.X
  if (top === 'confidence_rules' && segments[1] === 'penalties') {
    return FIELD_KEYS.has(segments[2])
      ? fieldLabelOf(segments[2], t)
      : t('auditConfidenceField', { field: segments[2] })
  }

  // confidence_rules.threshold
  if (top === 'confidence_rules' && segments.length === 2) {
    return t('auditConfidenceField', { field: fieldLabelOf(segments[1], t) })
  }

  // global_params.X
  if (top === 'global_params' && segments.length >= 2) {
    return t('auditGlobalsField', { field: fieldLabelOf(segments[1], t) })
  }

  return `${topLabel} — ${segments.slice(1).join('.')}`
}
