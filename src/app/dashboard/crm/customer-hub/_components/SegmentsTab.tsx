'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { api } from './api'
import {
  CustomerSegment, SegmentRule, SegmentField, SegmentOperator,
  SEGMENT_FIELD_LABELS, OPERATOR_LABELS, SEGMENT_AUTO_LABELS,
  fmtNumber,
} from './types'
import { useConfirm } from '@/components/ui/dialog-provider'

const ICON_PRESETS = ['👥', '👑', '⭐', '🎯', '💎', '🚀', '⚠️', '🔥', '📈', '💰', '❤️', '🛡️']

const FIELDS: SegmentField[] = [
  'abc_curve', 'churn_risk', 'segment',
  'total_purchases', 'purchase_count', 'rfm_score', 'avg_ticket',
  'last_purchase_days', 'has_cpf', 'is_vip',
]
const OPERATORS_BY_FIELD: Record<SegmentField, SegmentOperator[]> = {
  abc_curve:          ['eq', 'in', 'not_in'],
  churn_risk:         ['eq', 'in', 'not_in'],
  segment:            ['eq', 'in', 'not_in'],
  total_purchases:    ['gt', 'lt', 'gte', 'lte', 'eq'],
  purchase_count:     ['gt', 'lt', 'gte', 'lte', 'eq'],
  rfm_score:          ['gt', 'lt', 'gte', 'lte', 'eq'],
  avg_ticket:         ['gt', 'lt', 'gte', 'lte', 'eq'],
  last_purchase_days: ['lt', 'gt', 'lte', 'gte', 'eq'],
  has_cpf:            ['eq'],
  is_vip:             ['eq'],
}

export function SegmentsTab({ onToast }: { onToast: (m: string, type?: 'success' | 'error') => void }) {
  const router = useRouter()
  const [list, setList]     = useState<CustomerSegment[]>([])
  const [loading, setLoad]  = useState(true)
  const [editing, setEdit]  = useState<CustomerSegment | 'new' | null>(null)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoad(true)
    try { setList(await api<CustomerSegment[]>('/customer-hub/segments')) }
    catch (e) { onToast((e as Error).message, 'error') }
    setLoad(false)
  }, [onToast])

  useEffect(() => { load() }, [load])

  async function compute(s: CustomerSegment) {
    try {
      const r = await api<{ count: number }>(`/customer-hub/segments/${s.id}/compute`, { method: 'POST' })
      onToast(`${s.name}: ${r.count} clientes`, 'success')
      await load()
    } catch (e) { onToast((e as Error).message, 'error') }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title:        'Excluir segmento',
      message:      'Excluir segmento? Membros serão removidos (clientes preservados).',
      confirmLabel: 'Excluir',
      variant:      'danger',
    })
    if (!ok) return
    try {
      await api(`/customer-hub/segments/${id}`, { method: 'DELETE' })
      setList(prev => prev.filter(s => s.id !== id))
      onToast('Segmento excluído', 'success')
    } catch (e) { onToast((e as Error).message, 'error') }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-zinc-400 text-sm">Segmentos com regras dinâmicas. Cron diário recalcula auto_refresh=true.</p>
        <button
          onClick={() => setEdit('new')}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: '#00E5FF', color: '#08323b' }}
        >+ Novo segmento</button>
      </div>

      {loading
        ? <div className="h-32 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        : list.length === 0
          ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500" style={{ background: '#111114', border: '1px dashed #27272a' }}>
              Nenhum segmento ainda. Crie um pra usar em campanhas Messaging.
            </div>
          : <div className="grid gap-3">
              {list.map(s => (
                <div key={s.id} className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${s.color}1a`, border: `1px solid ${s.color}40` }}>
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold truncate">{s.name}</p>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${s.color}1a`, color: s.color }}>
                        {fmtNumber(s.customer_count)} clientes
                      </span>
                      {s.auto_refresh && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                          Auto
                        </span>
                      )}
                    </div>
                    {s.description && <p className="text-zinc-500 text-xs mt-0.5">{s.description}</p>}
                    <p className="text-zinc-600 text-[11px] mt-1">
                      {s.rules.length} regra{s.rules.length === 1 ? '' : 's'}
                      {s.last_computed_at && ` · Última atualização: ${new Date(s.last_computed_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => setEdit(s)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>Editar</button>
                    <button onClick={() => compute(s)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#00E5FF', color: '#00E5FF' }}>Recalcular</button>
                    <button onClick={() => router.push(`/dashboard/messaging?segment_id=${s.id}`)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>Campanha</button>
                    <button onClick={() => remove(s.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#f87171' }}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>}

      {editing && (
        <SegmentEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEdit(null)}
          onSaved={(s) => {
            setEdit(null)
            setList(prev => {
              const idx = prev.findIndex(x => x.id === s.id)
              return idx >= 0 ? prev.map(x => x.id === s.id ? s : x) : [s, ...prev]
            })
            onToast('Segmento salvo', 'success')
          }}
          onError={(m) => onToast(m, 'error')}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SegmentEditor({
  initial, onClose, onSaved, onError,
}: {
  initial: CustomerSegment | null
  onClose: () => void
  onSaved: (s: CustomerSegment) => void
  onError: (m: string) => void
}) {
  const [name, setName]               = useState(initial?.name ?? '')
  const [description, setDesc]        = useState(initial?.description ?? '')
  const [color, setColor]             = useState(initial?.color ?? '#00E5FF')
  const [icon, setIcon]               = useState(initial?.icon ?? '👥')
  const [autoRefresh, setAutoRefresh] = useState(initial?.auto_refresh ?? true)
  const [rules, setRules]             = useState<SegmentRule[]>(initial?.rules ?? [])
  const [previewCount, setPreview]    = useState<number | null>(null)
  const [previewing, setPreviewing]   = useState(false)
  const [saving, setSaving]           = useState(false)

  // Preview ao vivo (debounced)
  useEffect(() => {
    if (rules.length === 0) { setPreview(null); return }
    const t = setTimeout(async () => {
      setPreviewing(true)
      try {
        const r = await api<{ count: number }>('/customer-hub/segments/preview', {
          method: 'POST',
          body: JSON.stringify({ rules }),
        })
        setPreview(r.count)
      } catch { setPreview(null) }
      setPreviewing(false)
    }, 500)
    return () => clearTimeout(t)
  }, [rules])

  function addRule() {
    setRules(prev => [...prev, { field: 'abc_curve', operator: 'eq', value: 'A' }])
  }
  function updateRule(i: number, patch: Partial<SegmentRule>) {
    setRules(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const next = { ...r, ...patch }
      // Se mudou field, reseta operator e value pra defaults
      if (patch.field && patch.field !== r.field) {
        next.operator = OPERATORS_BY_FIELD[patch.field][0]
        next.value = defaultValueFor(patch.field)
      }
      return next
    }))
  }
  function removeRule(i: number) {
    setRules(prev => prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (!name.trim()) return onError('Nome obrigatório')
    setSaving(true)
    try {
      const payload = { name: name.trim(), description: description.trim() || null, color, icon, rules, auto_refresh: autoRefresh }
      const s = initial
        ? await api<CustomerSegment>(`/customer-hub/segments/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api<CustomerSegment>('/customer-hub/segments', { method: 'POST', body: JSON.stringify(payload) })
      // Já dispara compute pra popular members
      try { await api(`/customer-hub/segments/${s.id}/compute`, { method: 'POST' }) } catch { /* nbd */ }
      onSaved(s)
    } catch (e) {
      onError((e as Error).message)
      setSaving(false)
    }
  }

  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl my-auto" style={{ background: '#111114', border: '1px solid #1e1e24' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-white font-semibold">{initial ? 'Editar segmento' : 'Novo segmento'}</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-zinc-400 text-xs mb-1">Nome</p>
              <input className="seg-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: VIPs ativos" />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300 mt-5">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Atualização automática (cron diário)
            </label>
          </div>

          <div>
            <p className="text-zinc-400 text-xs mb-1">Descrição (opcional)</p>
            <textarea className="seg-input" rows={2} value={description ?? ''} onChange={e => setDesc(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-zinc-400 text-xs mb-1">Cor</p>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer" style={{ background: 'transparent', border: '1px solid #27272a' }} />
                <input type="text" value={color} onChange={e => setColor(e.target.value)} className="seg-input flex-1 font-mono text-xs" />
              </div>
            </div>
            <div>
              <p className="text-zinc-400 text-xs mb-1">Ícone</p>
              <div className="flex flex-wrap gap-1">
                {ICON_PRESETS.map(em => (
                  <button key={em} type="button" onClick={() => setIcon(em)}
                    className="w-9 h-9 rounded-lg text-lg flex items-center justify-center"
                    style={{
                      background: icon === em ? `${color}1a` : '#0a0a0e',
                      border: `1px solid ${icon === em ? color : '#27272a'}`,
                    }}
                  >{em}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Rules builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-zinc-300 text-sm font-semibold">Regras (todas precisam ser verdadeiras)</p>
              <p className="text-zinc-500 text-xs">
                {previewing ? 'Calculando…' : previewCount !== null ? `${fmtNumber(previewCount)} clientes correspondem` : 'Adicione regras'}
              </p>
            </div>
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <RuleRow key={i} rule={rule} onChange={(p) => updateRule(i, p)} onRemove={() => removeRule(i)} />
              ))}
            </div>
            <button onClick={addRule} className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>+ Adicionar regra</button>
          </div>

          {/* Preview */}
          <div className="rounded-lg p-3" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
            <p className="text-zinc-400 text-xs">Preview ao vivo</p>
            <p className="text-2xl font-bold mt-1" style={{ color }}>
              {previewing ? '…' : previewCount !== null ? fmtNumber(previewCount) : '0'}
              <span className="text-sm text-zinc-500 ml-2 font-normal">cliente{previewCount === 1 ? '' : 's'} correspondem</span>
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: '#00E5FF', color: '#08323b' }}>
            {saving ? 'Salvando…' : 'Salvar e calcular'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .seg-input {
          width: 100%; padding: 0.5rem 0.75rem; background: #0a0a0e;
          border: 1px solid #27272a; border-radius: 0.5rem; color: #fafafa;
          font-size: 0.875rem; outline: none;
        }
        .seg-input:focus { border-color: #00E5FF; }
      `}</style>
    </div>,
    document.body,
  )
}

function defaultValueFor(field: SegmentField): unknown {
  if (field === 'abc_curve')  return 'A'
  if (field === 'churn_risk') return 'low'
  if (field === 'segment')    return 'campeoes'
  if (field === 'has_cpf')    return true
  if (field === 'is_vip')     return true
  return 0
}

function RuleRow({
  rule, onChange, onRemove,
}: {
  rule:     SegmentRule
  onChange: (p: Partial<SegmentRule>) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg p-3 grid grid-cols-12 gap-2" style={{ background: '#0a0a0e', border: '1px solid #27272a' }}>
      <select className="rule-input col-span-4" value={rule.field} onChange={e => onChange({ field: e.target.value as SegmentField })}>
        {FIELDS.map(f => <option key={f} value={f}>{SEGMENT_FIELD_LABELS[f]}</option>)}
      </select>
      <select className="rule-input col-span-3" value={rule.operator} onChange={e => onChange({ operator: e.target.value as SegmentOperator })}>
        {OPERATORS_BY_FIELD[rule.field].map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
      </select>
      <ValueInput rule={rule} onChange={onChange} />
      <button onClick={onRemove} className="col-span-1 text-red-400 hover:text-red-300 text-sm">✕</button>
      <style jsx>{`
        .rule-input {
          padding: 0.4rem 0.6rem; background: #18181b; border: 1px solid #27272a;
          border-radius: 0.375rem; color: #fafafa; font-size: 0.8125rem; outline: none; width: 100%;
        }
        .rule-input:focus { border-color: #00E5FF; }
      `}</style>
    </div>
  )
}

function ValueInput({ rule, onChange }: { rule: SegmentRule; onChange: (p: Partial<SegmentRule>) => void }) {
  const cls = "rule-input col-span-4"
  // Multi-value pra in/not_in
  if (rule.operator === 'in' || rule.operator === 'not_in') {
    const csv = Array.isArray(rule.value) ? rule.value.join(',') : String(rule.value ?? '')
    return (
      <input className={cls} value={csv}
        onChange={e => onChange({ value: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        placeholder="A,B (vírgula)" />
    )
  }
  if (rule.field === 'abc_curve') {
    return (
      <select className={cls} value={String(rule.value ?? 'A')} onChange={e => onChange({ value: e.target.value })}>
        <option value="A">A</option><option value="B">B</option><option value="C">C</option>
      </select>
    )
  }
  if (rule.field === 'churn_risk') {
    return (
      <select className={cls} value={String(rule.value ?? 'low')} onChange={e => onChange({ value: e.target.value })}>
        <option value="low">Baixo</option><option value="medium">Médio</option>
        <option value="high">Alto</option><option value="critical">Crítico</option>
      </select>
    )
  }
  if (rule.field === 'segment') {
    return (
      <select className={cls} value={String(rule.value ?? 'campeoes')} onChange={e => onChange({ value: e.target.value })}>
        {Object.keys(SEGMENT_AUTO_LABELS).map(s => <option key={s} value={s}>{SEGMENT_AUTO_LABELS[s]}</option>)}
      </select>
    )
  }
  if (rule.field === 'has_cpf' || rule.field === 'is_vip') {
    return (
      <select className={cls} value={String(rule.value ?? 'true')} onChange={e => onChange({ value: e.target.value === 'true' })}>
        <option value="true">Sim</option><option value="false">Não</option>
      </select>
    )
  }
  // Numéricos
  return (
    <input type="number" className={cls} value={String(rule.value ?? 0)}
      onChange={e => onChange({ value: Number(e.target.value) || 0 })} />
  )
}
