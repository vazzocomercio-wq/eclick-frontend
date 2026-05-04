'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api'
import { useConfirm } from '@/components/ui/dialog-provider'

interface SeasonalPeriod {
  id:                     string
  organization_id:        string
  name:                   string
  category:               string | null
  start_date:             string
  end_date:               string
  pricing_adjustment_pct: number | null
  margin_override_pct:    number | null
  notes:                  string | null
  is_active:              boolean
  recurring_yearly:       boolean
  created_at:             string
}

export function SeasonalTab({ onToast }: { onToast: (m: string, type?: 'success' | 'error') => void }) {
  const [list, setList]       = useState<SeasonalPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SeasonalPeriod | 'new' | null>(null)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setList(await api<SeasonalPeriod[]>('/pricing/seasonal')) }
    catch (e) { onToast((e as Error).message, 'error') }
    setLoading(false)
  }, [onToast])

  useEffect(() => { load() }, [load])

  async function toggleActive(p: SeasonalPeriod) {
    try {
      const updated = await api<SeasonalPeriod>(`/pricing/seasonal/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !p.is_active }),
      })
      setList(prev => prev.map(x => x.id === p.id ? updated : x))
    } catch (e) { onToast((e as Error).message, 'error') }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title:        'Excluir período sazonal',
      message:      'Excluir período sazonal?',
      confirmLabel: 'Excluir',
      variant:      'danger',
    })
    if (!ok) return
    try {
      await api(`/pricing/seasonal/${id}`, { method: 'DELETE' })
      setList(prev => prev.filter(x => x.id !== id))
      onToast('Período excluído', 'success')
    } catch (e) { onToast((e as Error).message, 'error') }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-zinc-400 text-sm">Períodos com regras de preço/margem temporárias. Ativos durante o intervalo configurado.</p>
        <button
          onClick={() => setEditing('new')}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: '#00E5FF', color: '#08323b' }}
        >+ Novo período</button>
      </div>

      {loading
        ? <div className="h-32 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
        : list.length === 0
          ? <div className="rounded-2xl px-6 py-10 text-center text-zinc-500" style={{ background: '#111114', border: '1px dashed #27272a' }}>
              Nenhum período cadastrado. Black Friday seedada vem com a migration.
            </div>
          : <div className="grid gap-3">
              {list.map(p => <PeriodCard key={p.id} p={p} onEdit={() => setEditing(p)} onToggle={() => toggleActive(p)} onDelete={() => remove(p.id)} />)}
            </div>}

      {editing && (
        <PeriodEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setEditing(null)
            setList(prev => {
              const idx = prev.findIndex(x => x.id === p.id)
              return idx >= 0 ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev]
            })
            onToast('Período salvo', 'success')
          }}
          onError={(m) => onToast(m, 'error')}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function PeriodCard({
  p, onEdit, onToggle, onDelete,
}: {
  p: SeasonalPeriod
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const adj = p.pricing_adjustment_pct
  const adjColor = adj == null ? '#a1a1aa' : adj < 0 ? '#34d399' : '#fbbf24'
  return (
    <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: '#111114', border: `1px solid ${p.is_active ? '#1e1e24' : '#1e1e24'}`, opacity: p.is_active ? 1 : 0.5 }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white font-semibold">{p.name}</p>
          {p.category && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>{p.category}</span>}
          {p.recurring_yearly && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>Anual</span>}
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={p.is_active ? { background: 'rgba(52,211,153,0.1)', color: '#34d399' } : { background: 'rgba(161,161,170,0.1)', color: '#a1a1aa' }}>
            {p.is_active ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        <p className="text-zinc-500 text-xs mt-1">{fmt(p.start_date)} → {fmt(p.end_date)}</p>
        <div className="flex items-center gap-4 mt-1.5 text-xs">
          {adj != null && <span style={{ color: adjColor }}>{adj > 0 ? '+' : ''}{adj}% no preço</span>}
          {p.margin_override_pct != null && <span className="text-zinc-400">margem temporária {p.margin_override_pct}%</span>}
        </div>
        {p.notes && <p className="text-zinc-600 text-xs mt-1">{p.notes}</p>}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button onClick={onEdit}   className="px-3 py-1 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>Editar</button>
        <button onClick={onToggle} className="px-3 py-1 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#e4e4e7' }}>{p.is_active ? 'Desativar' : 'Ativar'}</button>
        <button onClick={onDelete} className="px-3 py-1 rounded-lg text-xs font-medium border" style={{ borderColor: '#3f3f46', color: '#f87171' }}>Excluir</button>
      </div>
    </div>
  )
}

function fmt(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

// ─────────────────────────────────────────────────────────────────────────────

function PeriodEditor({
  initial, onClose, onSaved, onError,
}: {
  initial: SeasonalPeriod | null
  onClose: () => void
  onSaved: (p: SeasonalPeriod) => void
  onError: (m: string) => void
}) {
  const [name, setName]               = useState(initial?.name ?? '')
  const [category, setCategory]       = useState(initial?.category ?? '')
  const [startDate, setStart]         = useState(initial?.start_date ?? '')
  const [endDate, setEnd]             = useState(initial?.end_date ?? '')
  const [adj, setAdj]                 = useState<number>(initial?.pricing_adjustment_pct ?? 0)
  const [marginOv, setMargin]         = useState<number | ''>(initial?.margin_override_pct ?? '')
  const [recurring, setRecurring]     = useState(initial?.recurring_yearly ?? false)
  const [active, setActive]           = useState(initial?.is_active ?? true)
  const [notes, setNotes]             = useState(initial?.notes ?? '')
  const [saving, setSaving]           = useState(false)

  async function save() {
    if (!name.trim())  return onError('Nome obrigatório')
    if (!startDate)    return onError('Data início obrigatória')
    if (!endDate)      return onError('Data fim obrigatória')
    if (endDate < startDate) return onError('Data fim deve ser depois do início')
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || null,
        start_date: startDate,
        end_date: endDate,
        pricing_adjustment_pct: adj,
        margin_override_pct: marginOv === '' ? null : Number(marginOv),
        notes: notes.trim() || null,
        is_active: active,
        recurring_yearly: recurring,
      }
      const p = initial
        ? await api<SeasonalPeriod>(`/pricing/seasonal/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api<SeasonalPeriod>('/pricing/seasonal', { method: 'POST', body: JSON.stringify(payload) })
      onSaved(p)
    } catch (e) { onError((e as Error).message); setSaving(false) }
  }

  if (typeof window === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl my-auto" style={{ background: '#111114', border: '1px solid #1e1e24' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-white font-semibold">{initial ? 'Editar período' : 'Novo período'}</p>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <Field label="Nome">
            <input className="se-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Black Friday" />
          </Field>
          <Field label="Categoria (opcional — vazio = aplica geral)">
            <input className="se-input" value={category ?? ''} onChange={e => setCategory(e.target.value)} placeholder="Ex: Eletrônicos" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data início">
              <input type="date" className="se-input" value={startDate} onChange={e => setStart(e.target.value)} />
            </Field>
            <Field label="Data fim">
              <input type="date" className="se-input" value={endDate} onChange={e => setEnd(e.target.value)} />
            </Field>
          </div>

          <Field label={`Ajuste de preço: ${adj > 0 ? '+' : ''}${adj}%`}>
            <input type="range" min="-30" max="30" step="1" value={adj}
              onChange={e => setAdj(Number(e.target.value))}
              className="w-full h-1.5 cursor-pointer"
              style={{ accentColor: adj < 0 ? '#34d399' : '#fbbf24' }} />
            <p className="text-zinc-500 text-[11px] mt-1">Negativo = desconto, positivo = premium.</p>
          </Field>

          <Field label="Margem temporária (opcional)">
            <div className="flex items-center gap-2">
              <input type="number" className="se-input flex-1" value={marginOv} onChange={e => setMargin(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Deixe em branco pra usar a configuração padrão" />
              <span className="text-zinc-500 text-xs">%</span>
            </div>
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="w-4 h-4" style={{ accentColor: '#a855f7' }} />
            <span className="text-sm text-zinc-300">Recorrente anualmente (renova mesmo período no próximo ano)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4" style={{ accentColor: '#34d399' }} />
            <span className="text-sm text-zinc-300">Período ativo</span>
          </label>

          <Field label="Notas">
            <textarea className="se-input" rows={2} value={notes ?? ''} onChange={e => setNotes(e.target.value)} placeholder="Observações sobre este período..." />
          </Field>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>Cancelar</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: '#00E5FF', color: '#08323b' }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .se-input {
          width: 100%; padding: 0.5rem 0.75rem; background: #0a0a0e;
          border: 1px solid #27272a; border-radius: 0.5rem; color: #fafafa;
          font-size: 0.875rem; outline: none;
        }
        .se-input:focus { border-color: #00E5FF; }
      `}</style>
    </div>,
    document.body,
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-zinc-400 text-xs mb-1">{label}</p>{children}</div>
}
