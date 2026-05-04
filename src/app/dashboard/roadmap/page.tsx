'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Map as MapIcon, ChevronDown, ChevronRight, Plus, Pencil, Loader2,
  CheckCircle2, Circle, Star, Clock, X, Save, Trash2,
} from 'lucide-react'
import { useConfirm } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type RoadmapStatus = 'done' | 'wip' | 'next' | 'new' | 'planned'

interface RoadmapItem {
  id:        string
  phase_id:  string
  label:     string
  status:    RoadmapStatus
  priority:  number
  notes:     string | null
  created_at: string
  updated_at: string
}

interface RoadmapPhase {
  id:         string
  num:        string
  label:      string
  sub:        string | null
  status:     RoadmapStatus
  pct:        number
  sort_order: number
  items:      RoadmapItem[]
}

type FilterKey = 'all' | 'done' | 'wip' | 'new' | 'planned'

// ── Status palette ────────────────────────────────────────────────────────────

const STATUS: Record<RoadmapStatus, { label: string; color: string; bg: string; border: string }> = {
  done:    { label: 'Concluído',    color: '#22d3a0', bg: 'rgba(34,211,160,0.10)', border: 'rgba(34,211,160,0.30)' },
  wip:     { label: 'Em andamento', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)' },
  next:    { label: 'Próximo',      color: '#378ADD', bg: 'rgba(55,138,221,0.10)', border: 'rgba(55,138,221,0.30)' },
  new:     { label: 'Novo módulo',  color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.30)' },
  planned: { label: 'Planejado',    color: '#6b6b80', bg: 'rgba(107,107,128,0.10)', border: 'rgba(107,107,128,0.30)' },
}

const PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
  0: { label: '',        color: '' },
  1: { label: 'ALTA',    color: '#f59e0b' },
  2: { label: 'URGENTE', color: '#ef4444' },
}

function StatusIcon({ status, size = 14 }: { status: RoadmapStatus; size?: number }) {
  const c = STATUS[status].color
  switch (status) {
    case 'done':    return <CheckCircle2 size={size} style={{ color: c }} />
    case 'wip':     return <Loader2      size={size} style={{ color: c }} className="animate-spin" />
    case 'next':    return <Circle       size={size} style={{ color: c }} />
    case 'new':     return <Star         size={size} style={{ color: c }} />
    default:        return <Clock        size={size} style={{ color: c }} />
  }
}

function StatusBadge({ status }: { status: RoadmapStatus }) {
  const cfg = STATUS[status]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const [phases, setPhases]   = useState<RoadmapPhase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<FilterKey>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [newIdea, setNewIdea] = useState<{ phaseId?: string } | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const confirm = useConfirm()

  const getHeaders = useCallback(async () => {
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/roadmap`, { headers })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error('[roadmap] fetch HTTP', res.status, body)
        setError(`Erro ao carregar roadmap (HTTP ${res.status})`)
        return
      }
      const data = await res.json() as RoadmapPhase[]
      setPhases(data)
      // Expand WIP phase by default; collapse rest pra dar foco visual.
      const exp: Record<string, boolean> = {}
      for (const p of data) exp[p.id] = p.status === 'wip'
      setExpanded(exp)
    } catch (err) {
      console.error('[roadmap] fetch falhou:', err)
      setError('Erro ao carregar roadmap')
    } finally {
      setLoading(false)
    }
  }, [getHeaders])

  useEffect(() => { load() }, [load])

  const filteredPhases = useMemo(() => {
    if (filter === 'all') return phases
    return phases
      .map(p => ({ ...p, items: p.items.filter(i => i.status === filter) }))
      .filter(p => p.status === filter || p.items.length > 0)
  }, [phases, filter])

  // Counts pros tabs
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: 0, done: 0, wip: 0, new: 0, planned: 0 }
    for (const p of phases) {
      c.all += p.items.length
      for (const it of p.items) {
        if (it.status === 'done')    c.done++
        if (it.status === 'wip')     c.wip++
        if (it.status === 'new')     c.new++
        if (it.status === 'planned') c.planned++
      }
    }
    return c
  }, [phases])

  async function patchItem(id: string, body: Partial<Pick<RoadmapItem, 'status' | 'label' | 'priority' | 'notes'>>) {
    const headers = await getHeaders()
    const res = await fetch(`${BACKEND}/roadmap/items/${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
    if (res.ok) await load()
  }

  async function deleteItem(id: string) {
    const ok = await confirm({
      title:        'Remover ideia',
      message:      'Remover essa ideia do roadmap?',
      confirmLabel: 'Remover',
      variant:      'danger',
    })
    if (!ok) return
    const headers = await getHeaders()
    await fetch(`${BACKEND}/roadmap/items/${id}`, { method: 'DELETE', headers })
    await load()
  }

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Dashboard</p>
          <h1 className="text-white text-3xl font-semibold flex items-center gap-2">
            <MapIcon size={22} style={{ color: '#00E5FF' }} /> Roadmap
          </h1>
          <p className="text-zinc-500 text-sm mt-1">8 fases · versão 2.0 · {counts.all} itens</p>
        </div>
        <button onClick={() => setNewIdea({})}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: '#00E5FF', color: '#000' }}>
          <Plus size={13} /> Nova ideia
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg p-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error} · veja DevTools → Console pra detalhes
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-1" style={{ borderBottom: '1px solid #1a1a1f' }}>
        {([
          { k: 'all',     label: 'Todas',        count: counts.all     },
          { k: 'done',    label: 'Concluído',    count: counts.done    },
          { k: 'wip',     label: 'Em andamento', count: counts.wip     },
          { k: 'new',     label: 'Novo',         count: counts.new     },
          { k: 'planned', label: 'Planejado',    count: counts.planned },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={filter === t.k
              ? { color: '#00E5FF', borderBottom: '2px solid #00E5FF', marginBottom: -1 }
              : { color: '#a1a1aa' }}>
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                style={filter === t.k
                  ? { background: '#00E5FF1a', color: '#00E5FF' }
                  : { background: '#1a1a1f', color: '#3f3f46' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Phases */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: '#111114' }} />
          ))}
        </div>
      ) : filteredPhases.length === 0 ? (
        <div className="rounded-xl p-8 text-center"
          style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <p className="text-sm text-zinc-500">Nenhuma fase com itens nesse filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPhases.map(phase => {
            const cfg = STATUS[phase.status]
            const isExp = expanded[phase.id] ?? false
            return (
              <div key={phase.id} className="rounded-xl overflow-hidden"
                style={{ background: '#111114', border: `1px solid ${cfg.border}` }}>
                {/* Phase header */}
                <button onClick={() => setExpanded(e => ({ ...e, [phase.id]: !e[phase.id] }))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
                  {isExp ? <ChevronDown size={16} className="text-zinc-500 shrink-0" /> : <ChevronRight size={16} className="text-zinc-500 shrink-0" />}
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold shrink-0"
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    {phase.num}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate">{phase.label}</p>
                    {phase.sub && <p className="text-[11px] text-zinc-500 truncate">{phase.sub}</p>}
                  </div>
                  <StatusBadge status={phase.status} />
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a1f' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${phase.pct}%`, background: cfg.color }} />
                    </div>
                    <span className="text-[11px] tabular-nums w-9 text-right" style={{ color: cfg.color }}>{phase.pct}%</span>
                  </div>
                  <span onClick={e => { e.stopPropagation(); setNewIdea({ phaseId: phase.id }) }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer hover:bg-white/5"
                    style={{ color: '#a1a1aa', border: '1px solid #1a1a1f' }}
                    title="Adicionar ideia nesta fase">
                    <Plus size={10} /> Ideia
                  </span>
                </button>

                {/* Items grid */}
                {isExp && (
                  <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid #1a1a1f' }}>
                    {phase.items.length === 0 ? (
                      <p className="text-xs text-zinc-600 py-3">Sem itens nessa fase. Adicione uma ideia 👆</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                        {phase.items.map(item => (
                          <ItemCard key={item.id} item={item}
                            isEditing={editingItemId === item.id}
                            onEdit={() => setEditingItemId(item.id)}
                            onCancel={() => setEditingItemId(null)}
                            onSave={async patch => { await patchItem(item.id, patch); setEditingItemId(null) }}
                            onDelete={() => deleteItem(item.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New idea modal */}
      {newIdea && (
        <NewIdeaModal
          phases={phases}
          presetPhaseId={newIdea.phaseId}
          onClose={() => setNewIdea(null)}
          onSaved={async () => { setNewIdea(null); await load() }}
          getHeaders={getHeaders}
        />
      )}
    </div>
  )
}

// ── Item card ────────────────────────────────────────────────────────────────

function ItemCard({ item, isEditing, onEdit, onCancel, onSave, onDelete }: {
  item:      RoadmapItem
  isEditing: boolean
  onEdit:    () => void
  onCancel:  () => void
  onSave:    (patch: Partial<Pick<RoadmapItem, 'status' | 'label' | 'priority' | 'notes'>>) => Promise<void>
  onDelete:  () => void
}) {
  const cfg = STATUS[item.status]
  const [status, setStatus]     = useState<RoadmapStatus>(item.status)
  const [priority, setPriority] = useState<number>(item.priority)
  const [notes, setNotes]       = useState<string>(item.notes ?? '')
  const [saving, setSaving]     = useState(false)

  const prio = PRIORITY_LABEL[item.priority]

  if (isEditing) {
    return (
      <div className="rounded-lg p-3 space-y-2"
        style={{ background: '#0c0c10', border: `1px solid ${cfg.border}` }}>
        <p className="text-xs font-medium text-zinc-200">{item.label}</p>

        <div className="grid grid-cols-2 gap-2">
          <select value={status} onChange={e => setStatus(e.target.value as RoadmapStatus)}
            className="px-2 py-1.5 text-[11px] rounded bg-[#070709] text-zinc-200 outline-none focus:border-[#00E5FF]"
            style={{ border: '1px solid #27272a' }}>
            {(Object.keys(STATUS) as RoadmapStatus[]).map(s => (
              <option key={s} value={s}>{STATUS[s].label}</option>
            ))}
          </select>
          <select value={priority} onChange={e => setPriority(Number(e.target.value))}
            className="px-2 py-1.5 text-[11px] rounded bg-[#070709] text-zinc-200 outline-none"
            style={{ border: '1px solid #27272a' }}>
            <option value={0}>Normal</option>
            <option value={1}>Alta</option>
            <option value={2}>Urgente</option>
          </select>
        </div>

        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Notas (opcional)…" rows={2}
          className="w-full px-2 py-1.5 text-[11px] rounded bg-[#070709] text-zinc-200 outline-none resize-none"
          style={{ border: '1px solid #27272a' }} />

        <div className="flex items-center justify-between gap-2">
          <button onClick={onDelete}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-500 hover:text-red-400 transition-colors">
            <Trash2 size={10} /> Remover
          </button>
          <div className="flex items-center gap-1">
            <button onClick={onCancel}
              className="px-2 py-1 rounded text-[10px] text-zinc-400"
              style={{ background: '#1e1e24' }}>Cancelar</button>
            <button onClick={async () => {
                setSaving(true)
                await onSave({ status, priority, notes: notes.trim() || null })
                setSaving(false)
              }} disabled={saving}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#000' }}>
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.02]"
      style={{ background: '#0c0c10', border: `1px solid #1a1a1f` }}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0"><StatusIcon status={item.status} size={13} /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-zinc-200">{item.label}</p>
            {prio.label && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${prio.color}1a`, color: prio.color, border: `1px solid ${prio.color}55` }}>
                {prio.label}
              </span>
            )}
          </div>
          {item.notes && (
            <p className="text-[10px] text-zinc-500 mt-1 italic line-clamp-2">{item.notes}</p>
          )}
        </div>
        <button onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 shrink-0">
          <Pencil size={11} />
        </button>
      </div>
    </div>
  )
}

// ── New idea modal ───────────────────────────────────────────────────────────

function NewIdeaModal({ phases, presetPhaseId, onClose, onSaved, getHeaders }: {
  phases:        RoadmapPhase[]
  presetPhaseId?: string
  onClose:       () => void
  onSaved:       () => void | Promise<void>
  getHeaders:    () => Promise<Record<string, string>>
}) {
  const [phaseId, setPhaseId]   = useState<string>(presetPhaseId ?? phases[0]?.id ?? '')
  const [label, setLabel]       = useState('')
  const [status, setStatus]     = useState<RoadmapStatus>('new')
  const [priority, setPriority] = useState<number>(0)
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)

  async function save() {
    if (!phaseId || !label.trim()) return
    setSaving(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/roadmap/items`, {
        method: 'POST', headers,
        body: JSON.stringify({
          phase_id: phaseId,
          label:    label.trim(),
          status,
          priority,
          notes:    notes.trim() || null,
        }),
      })
      if (res.ok) await onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <header className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div className="flex items-center gap-2">
            <Plus size={15} style={{ color: '#00E5FF' }} />
            <p className="text-sm font-semibold text-white">Adicionar ideia ao roadmap</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
        </header>

        <div className="px-5 py-5 space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Fase</label>
            <select value={phaseId} onChange={e => setPhaseId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#070709] text-zinc-200 outline-none focus:border-[#00E5FF]"
              style={{ border: '1px solid #27272a' }}>
              {phases.map(p => (
                <option key={p.id} value={p.id}>{p.num} — {p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Descrição da ideia</label>
            <input value={label} onChange={e => setLabel(e.target.value)} autoFocus
              placeholder="ex.: Importação CSV de clientes"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[#070709] text-zinc-200 outline-none focus:border-[#00E5FF]"
              style={{ border: '1px solid #27272a' }} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as RoadmapStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#070709] text-zinc-200 outline-none"
                style={{ border: '1px solid #27272a' }}>
                {(Object.keys(STATUS) as RoadmapStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Prioridade</label>
              <select value={priority} onChange={e => setPriority(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#070709] text-zinc-200 outline-none"
                style={{ border: '1px solid #27272a' }}>
                <option value={0}>Normal</option>
                <option value={1}>Alta</option>
                <option value={2}>Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Notas (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Contexto, links, restrições…"
              className="w-full px-3 py-2 text-xs rounded-lg bg-[#070709] text-zinc-200 outline-none resize-none focus:border-[#00E5FF]"
              style={{ border: '1px solid #27272a' }} />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-zinc-400"
            style={{ background: '#1e1e24' }}>Cancelar</button>
          <button onClick={save} disabled={!phaseId || !label.trim() || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Adicionar ao roadmap
          </button>
        </div>
      </div>
    </div>
  )
}
