'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Plus, X, AlertTriangle, Calendar, User, Tag, GripVertical,
  CheckSquare, Circle, Clock, CheckCircle2, Pencil, Trash2,
} from 'lucide-react'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDroppable, useDraggable, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

// ── Types ─────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high' | 'urgent'
type TaskType = 'task' | 'content' | 'photo' | 'listing' | 'bug'
type Status   = 'todo' | 'in_progress' | 'review' | 'done'

interface Task {
  id: string
  organization_id: string
  title: string
  description: string | null
  status: Status
  priority: Priority
  type: TaskType
  assignee_name: string | null
  due_date: string | null
  created_at: string
}

// ── Config ────────────────────────────────────────────────────────────────────

const COLUMNS: { id: Status; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'todo',        label: 'A Fazer',       color: '#71717a', icon: <Circle size={13} /> },
  { id: 'in_progress', label: 'Em Andamento',  color: '#3b82f6', icon: <Clock size={13} /> },
  { id: 'review',      label: 'Em Revisão',    color: '#f59e0b', icon: <AlertTriangle size={13} /> },
  { id: 'done',        label: 'Concluído',     color: '#22c55e', icon: <CheckCircle2 size={13} /> },
]

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string }> = {
  low:    { label: 'Baixa',  color: '#71717a', bg: 'rgba(113,113,122,0.15)' },
  medium: { label: 'Média',  color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  high:   { label: 'Alta',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  urgent: { label: 'Urgente', color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
}

const TYPE_CFG: Record<TaskType, { label: string; color: string }> = {
  task:    { label: 'Tarefa',   color: '#a1a1aa' },
  content: { label: 'Conteúdo', color: '#a78bfa' },
  photo:   { label: 'Foto',     color: '#fb923c' },
  listing: { label: 'Anúncio',  color: '#00E5FF' },
  bug:     { label: 'Bug',      color: '#f87171' },
}

const CREATE_SQL = `-- Execute no Supabase SQL Editor
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  type TEXT DEFAULT 'task',
  assignee_name TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_tasks" ON tasks FOR ALL TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));`

// ── Auth/org helpers ──────────────────────────────────────────────────────────

async function getOrgId(): Promise<string | null> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle()
  return data?.organization_id ?? null
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task, onEdit, onDelete, overlay = false,
}: {
  task: Task; onEdit: (t: Task) => void; onDelete: (id: string) => void; overlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }
  const p   = PRIORITY_CFG[task.priority]
  const tp  = TYPE_CFG[task.type]

  const isOverdue = task.due_date && task.status !== 'done' &&
    new Date(task.due_date + 'T23:59:59') < new Date()

  return (
    <div
      ref={setNodeRef}
      style={overlay ? {} : style}
      className="group rounded-xl p-3 space-y-2.5 cursor-default select-none"
      {...(overlay ? {} : { style: { ...style, background: '#18181b', border: '1px solid #27272a' } })}
      {...(!overlay ? {} : { style: { background: '#18181b', border: '1px solid #3f3f46', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' } })}
    >
      {/* Drag handle + title row */}
      <div className="flex items-start gap-2">
        <button {...listeners} {...attributes}
          className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 transition-colors">
          <GripVertical size={13} />
        </button>
        <p className="text-xs font-medium text-zinc-200 flex-1 leading-snug">{task.title}</p>
        {!overlay && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => onEdit(task)} className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors">
              <Pencil size={11} />
            </button>
            <button onClick={() => onDelete(task.id)} className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors">
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 ml-5">
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: p.bg, color: p.color }}>{p.label}</span>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.05)', color: tp.color }}>{tp.label}</span>
      </div>

      {/* Footer */}
      {(task.due_date || task.assignee_name) && (
        <div className="flex items-center gap-2 ml-5">
          {task.due_date && (
            <span className="flex items-center gap-1 text-[10px]"
              style={{ color: isOverdue ? '#f87171' : '#71717a' }}>
              <Calendar size={10} />
              {new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              {isOverdue && ' ⚠'}
            </span>
          )}
          {task.assignee_name && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-600">
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{ background: '#2e2e33', color: '#a1a1aa' }}>
                {task.assignee_name.charAt(0).toUpperCase()}
              </div>
              <span className="truncate max-w-[60px]">{task.assignee_name}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

function KanbanColumn({
  col, tasks, onAdd, onEdit, onDelete,
}: {
  col: typeof COLUMNS[0]; tasks: Task[]
  onAdd: (status: Status) => void; onEdit: (t: Task) => void; onDelete: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <div className="flex flex-col min-w-[260px] max-w-[300px] flex-1" style={{ minHeight: 500 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span style={{ color: col.color }}>{col.icon}</span>
          <span className="text-xs font-semibold text-zinc-300">{col.label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a' }}>
            {tasks.length}
          </span>
        </div>
        <button onClick={() => onAdd(col.id)}
          className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all">
          <Plus size={13} />
        </button>
      </div>

      {/* Cards drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 rounded-2xl p-2 space-y-2 transition-colors"
        style={{
          background: isOver ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${isOver ? col.color + '40' : '#1e1e24'}`,
          minHeight: 120,
        }}>
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} />
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <p className="text-[11px] text-zinc-700">Sem tarefas</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Task Modal ────────────────────────────────────────────────────────────────

type TaskForm = { title: string; description: string; status: Status; priority: Priority; type: TaskType; assignee_name: string; due_date: string }

function TaskModal({
  initial, defaultStatus, onSave, onClose,
}: {
  initial?: Task; defaultStatus: Status; onSave: (f: TaskForm) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState<TaskForm>({
    title:         initial?.title         ?? '',
    description:   initial?.description   ?? '',
    status:        initial?.status        ?? defaultStatus,
    priority:      initial?.priority      ?? 'medium',
    type:          initial?.type          ?? 'task',
    assignee_name: initial?.assignee_name ?? '',
    due_date:      initial?.due_date      ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  function set<K extends keyof TaskForm>(k: K, v: TaskForm[K]) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    if (!form.title.trim()) { setErr('Título é obrigatório'); return }
    setSaving(true); setErr(null)
    try { await onSave(form) }
    catch (e: any) { setErr(e.message); setSaving(false) }
  }

  const inp = 'w-full rounded-lg px-3 py-2 text-xs text-white outline-none transition-all'
  const is  = { background: '#1c1c1f', border: '1px solid #3f3f46' }
  const lbl = 'block text-[10px] font-medium text-zinc-500 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: '#111114', border: '1px solid #2e2e33' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">{initial ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div>
          <label className={lbl}>Título *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            className={inp} style={is} placeholder="O que precisa ser feito?"
            onFocus={e => (e.target.style.borderColor = '#00E5FF')}
            onBlur={e => (e.target.style.borderColor  = '#3f3f46')} />
        </div>

        <div>
          <label className={lbl}>Descrição</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            className={inp} style={{ ...is, resize: 'none' }} rows={2} placeholder="Detalhes opcionais…"
            onFocus={e => (e.target.style.borderColor = '#00E5FF')}
            onBlur={e => (e.target.style.borderColor  = '#3f3f46')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value as Status)}
              className={inp + ' cursor-pointer'} style={is}>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Prioridade</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value as Priority)}
              className={inp + ' cursor-pointer'} style={is}>
              {(Object.entries(PRIORITY_CFG) as [Priority, typeof PRIORITY_CFG[Priority]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Tipo</label>
            <select value={form.type} onChange={e => set('type', e.target.value as TaskType)}
              className={inp + ' cursor-pointer'} style={is}>
              {(Object.entries(TYPE_CFG) as [TaskType, typeof TYPE_CFG[TaskType]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Prazo</label>
            <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
              className={inp} style={is}
              onFocus={e => (e.target.style.borderColor = '#00E5FF')}
              onBlur={e => (e.target.style.borderColor  = '#3f3f46')} />
          </div>
        </div>

        <div>
          <label className={lbl}>Responsável</label>
          <input value={form.assignee_name} onChange={e => set('assignee_name', e.target.value)}
            className={inp} style={is} placeholder="Nome do responsável…"
            onFocus={e => (e.target.style.borderColor = '#00E5FF')}
            onBlur={e => (e.target.style.borderColor  = '#3f3f46')} />
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-semibold text-zinc-400 border border-zinc-800 transition-colors">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving ? 'Salvando…' : (initial ? 'Salvar' : 'Criar tarefa')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TarefasPage() {
  const [tasks, setTasks]         = useState<Task[]>([])
  const [loading, setLoading]     = useState(true)
  const [noTable, setNoTable]     = useState(false)
  const [orgId, setOrgId]         = useState<string | null>(null)
  const [modal, setModal]         = useState<{ open: boolean; task?: Task; defaultStatus: Status }>({ open: false, defaultStatus: 'todo' })
  const [dragging, setDragging]   = useState<Task | null>(null)
  const [copied, setCopied]       = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(async () => {
    setLoading(true)
    const sb  = createClient()
    const oid = await getOrgId()
    setOrgId(oid)
    if (!oid) { setLoading(false); return }

    try {
      const { data, error } = await sb
        .from('tasks')
        .select('*')
        .eq('organization_id', oid)
        .order('created_at', { ascending: false })

      if (error) {
        // 42P01 = relation does not exist (table not yet created)
        // PGRST205 = schema cache miss (also "table not found" from PostgREST)
        if (error.code === '42P01' || error.code === 'PGRST205' || /not.*exist|find the table/i.test(error.message ?? '')) {
          setNoTable(true)
        } else {
          console.warn('[tasks]', error.message)
          setNoTable(true) // fail closed — show "feature not available" instead of white screen
        }
        setLoading(false)
        return
      }
      setTasks(Array.isArray(data) ? data as Task[] : [])
    } catch (e) {
      console.warn('[tasks] load failed:', (e as Error).message)
      setNoTable(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Columns ──────────────────────────────────────────────────────────────────

  const byStatus = useMemo(() => {
    const map: Record<Status, Task[]> = { todo: [], in_progress: [], review: [], done: [] }
    for (const t of tasks) map[t.status]?.push(t)
    return map
  }, [tasks])

  // ── DnD ──────────────────────────────────────────────────────────────────────

  function onDragStart(e: DragStartEvent) {
    setDragging(tasks.find(t => t.id === e.active.id) ?? null)
  }

  async function onDragEnd(e: DragEndEvent) {
    setDragging(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const task    = tasks.find(t => t.id === active.id)
    const newStat = over.id as Status
    if (!task || task.status === newStat) return

    // Optimistic
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: newStat } : t))

    const sb = createClient()
    await sb.from('tasks').update({ status: newStat, updated_at: new Date().toISOString() }).eq('id', task.id)
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async function saveTask(form: TaskForm) {
    const sb = createClient()
    if (modal.task) {
      const { error } = await sb.from('tasks').update({
        ...form,
        description:   form.description   || null,
        assignee_name: form.assignee_name || null,
        due_date:      form.due_date      || null,
        updated_at:    new Date().toISOString(),
      }).eq('id', modal.task.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await sb.from('tasks').insert({
        ...form,
        organization_id: orgId,
        description:   form.description   || null,
        assignee_name: form.assignee_name || null,
        due_date:      form.due_date      || null,
      })
      if (error) throw new Error(error.message)
    }
    setModal({ open: false, defaultStatus: 'todo' })
    load()
  }

  async function deleteTask(id: string) {
    if (!confirm('Excluir esta tarefa?')) return
    const sb = createClient()
    await sb.from('tasks').delete().eq('id', id)
    setTasks(ts => ts.filter(t => t.id !== id))
  }

  function copySql() {
    navigator.clipboard.writeText(CREATE_SQL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  // ── Table-not-found screen ───────────────────────────────────────────────────

  if (noTable) return (
    <div className="p-6 space-y-4 min-h-full" style={{ background: '#09090b' }}>
      <div>
        <p className="text-zinc-500 text-xs">Produção</p>
        <h2 className="text-white text-lg font-semibold mt-0.5">Tarefas</h2>
      </div>
      <div className="rounded-2xl p-5 space-y-4 max-w-2xl" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle size={16} />
          <p className="text-sm font-semibold">Tabela <code className="font-mono">tasks</code> não encontrada</p>
        </div>
        <p className="text-xs text-zinc-400">Execute o SQL abaixo no Supabase SQL Editor para criar a tabela:</p>
        <pre className="text-[10px] font-mono p-4 rounded-xl overflow-x-auto leading-relaxed"
          style={{ background: '#0a0a0d', border: '1px solid #1e1e24', color: '#a1a1aa' }}>
          {CREATE_SQL}
        </pre>
        <div className="flex gap-2">
          <button onClick={copySql}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(0,229,255,0.1)', color: copied ? '#22c55e' : '#00E5FF', border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(0,229,255,0.2)'}` }}>
            {copied ? 'Copiado!' : 'Copiar SQL'}
          </button>
          <button onClick={load}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-zinc-800 text-zinc-400 transition-colors">
            Verificar novamente
          </button>
        </div>
      </div>
    </div>
  )

  // ── KPIs ─────────────────────────────────────────────────────────────────────

  const total    = tasks.length
  const done     = tasks.filter(t => t.status === 'done').length
  const overdue  = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date + 'T23:59:59') < new Date()).length
  const urgent   = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Produção</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Tarefas</h2>
        </div>
        <button
          onClick={() => setModal({ open: true, defaultStatus: 'todo' })}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: '#00E5FF', color: '#000' }}>
          <Plus size={14} /> Nova Tarefa
        </button>
      </div>

      {/* KPI strip */}
      {!loading && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Total',    value: total,  color: '#a1a1aa' },
            { label: 'Concluídas', value: done,  color: '#22c55e' },
            { label: 'Atrasadas', value: overdue, color: '#f87171' },
            { label: 'Urgentes',  value: urgent,  color: '#ef4444' },
          ].map(k => (
            <div key={k.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <span className="text-lg font-black" style={{ color: k.color }}>{k.value}</span>
              <span className="text-[11px] text-zinc-500">{k.label}</span>
            </div>
          ))}
          {total > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex h-2 w-24 rounded-full overflow-hidden gap-0.5">
                {COLUMNS.map(c => byStatus[c.id].length > 0 && (
                  <div key={c.id} className="rounded-sm" style={{ background: c.color, flex: byStatus[c.id].length }} />
                ))}
              </div>
              <span className="text-[11px] text-zinc-500">{total > 0 ? Math.round((done / total) * 100) : 0}% completo</span>
            </div>
          )}
        </div>
      )}

      {/* Board */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(c => (
            <div key={c.id} className="min-w-[260px] space-y-3">
              <div className="h-6 w-32 rounded animate-pulse" style={{ background: '#1e1e24' }} />
              {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: '#111114' }} />)}
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-6">
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.id}
                col={col}
                tasks={byStatus[col.id]}
                onAdd={status => setModal({ open: true, defaultStatus: status })}
                onEdit={task => setModal({ open: true, task, defaultStatus: task.status })}
                onDelete={deleteTask}
              />
            ))}
          </div>
          <DragOverlay>
            {dragging && (
              <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 240 }}>
                <p className="text-xs font-medium text-zinc-200">{dragging.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal */}
      {modal.open && (
        <TaskModal
          initial={modal.task}
          defaultStatus={modal.defaultStatus}
          onSave={saveTask}
          onClose={() => setModal({ open: false, defaultStatus: 'todo' })}
        />
      )}
    </div>
  )
}
