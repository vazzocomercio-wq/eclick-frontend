'use client'

/**
 * F4 (sessão 2026-05-14) — Operação de Cadastro.
 *
 * Tela do GESTOR pra:
 *   1. Ver produtos pendentes (com tag cadastro_pendente) + campos faltando
 *   2. Selecionar N em massa
 *   3. Despachar pro operador (config Active: pipeline + stage + due_date)
 *   4. Acompanhar assignments OPEN/IN_PROGRESS
 *
 * Backend: GET /products/completeness-summary + POST /products/dispatch-to-operator
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getAuthToken(): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

type IncompleteProduct = {
  id:      string
  sku:     string | null
  name:    string
  missing: string[]
}

type CompletenessSummary = {
  total:             number
  incomplete_count:  number
  by_missing:        Record<string, number>
  sample_incomplete: IncompleteProduct[]
}

type Assignment = {
  id:                       string
  product_id:               string
  operator_user_id:         string
  active_deal_id:           string | null
  active_task_id:           string | null
  due_date:                 string | null
  status:                   'open' | 'in_progress' | 'completed' | 'cancelled' | 'failed'
  missing_fields_snapshot:  Array<{ label: string; type: string }>
  created_at:               string
  completed_at:             string | null
  products?: {
    id:         string
    name:       string
    sku:        string | null
    photo_urls: string[] | null
  } | null
}

type DispatchConfig = {
  operator_user_id: string
  pipeline_id:      string
  stage_id:         string
  due_date:         string
  priority:         'low' | 'normal' | 'high' | 'urgent'
  notes:            string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function plusDays(days: number): string {
  const d = new Date(Date.now() + days * 24 * 3600_000)
  return d.toISOString().slice(0, 10)
}

const STATUS_PILL: Record<Assignment['status'], { label: string; bg: string; color: string }> = {
  open:        { label: 'Aberto',      bg: 'rgba(0,229,255,0.12)',   color: '#67e8f9' },
  in_progress: { label: 'Em andamento', bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  completed:   { label: 'Concluído',    bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
  cancelled:   { label: 'Cancelado',    bg: 'rgba(113,113,122,0.15)', color: '#71717a' },
  failed:      { label: 'Falhou',       bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
}

// ── main page ───────────────────────────────────────────────────────────────

export default function OperacaoCadastroPage() {
  const [summary, setSummary] = useState<CompletenessSummary | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [tab, setTab] = useState<'pending' | 'assignments'>('pending')
  const [dispatching, setDispatching] = useState(false)
  const [dispatchResult, setDispatchResult] = useState<{ dispatched: number; skipped_existing: number; errors: Array<{ product_id: string; message: string }> } | null>(null)

  // ── load data ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Sessão expirou')

      const [sumRes, assignRes] = await Promise.all([
        fetch(`${BACKEND}/products/completeness-summary?limit=500`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${BACKEND}/products/operator-assignments?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const sumBody = await sumRes.json().catch(() => null)
      const assignBody = await assignRes.json().catch(() => [])

      if (sumRes.ok && sumBody) setSummary(sumBody as CompletenessSummary)
      if (assignRes.ok && Array.isArray(assignBody)) setAssignments(assignBody as Assignment[])

      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── selection ────────────────────────────────────────────────────────────

  const toggleAll = useCallback(() => {
    if (!summary) return
    if (selected.size === summary.sample_incomplete.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(summary.sample_incomplete.map(p => p.id)))
    }
  }, [summary, selected.size])

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  // ── dispatch ─────────────────────────────────────────────────────────────

  const handleDispatch = useCallback(async (config: DispatchConfig) => {
    if (selected.size === 0) return
    setDispatching(true)
    setDispatchResult(null)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Sessão expirou')

      const res = await fetch(`${BACKEND}/products/dispatch-to-operator`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          product_ids:      [...selected],
          operator_user_id: config.operator_user_id,
          pipeline_id:      config.pipeline_id,
          stage_id:         config.stage_id,
          due_date:         config.due_date ? new Date(config.due_date + 'T18:00:00').toISOString() : undefined,
          task_priority:    config.priority,
          notes:            config.notes || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`)

      setDispatchResult({
        dispatched:       body.dispatched ?? 0,
        skipped_existing: body.skipped_existing ?? 0,
        errors:           body.errors ?? [],
      })
      setSelected(new Set())
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDispatching(false)
    }
  }, [selected, load])

  // ── KPIs ────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const open = assignments.filter(a => a.status === 'open').length
    const inProgress = assignments.filter(a => a.status === 'in_progress').length
    const completed7d = assignments.filter(a => a.status === 'completed' &&
      a.completed_at &&
      new Date(a.completed_at).getTime() > Date.now() - 7 * 24 * 3600_000).length
    return {
      pendentes:    summary?.incomplete_count ?? 0,
      em_andamento: inProgress,
      em_fila:      open,
      concluidos_7d: completed7d,
    }
  }, [summary, assignments])

  // ── UI ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-white" style={{ background: '#0a0a0c' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
              <Link href="/dashboard/produtos" className="hover:text-zinc-300">Produtos</Link>
              <span>›</span>
              <span>Operação de cadastro</span>
            </div>
            <h1 className="text-2xl font-bold">Operação de Cadastro</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Selecione produtos pendentes e despache pro operador como cards no Active CRM.
              O operador recebe tarefas no kanban com prazo e campos a preencher.
            </p>
          </div>
          <Link href="/dashboard/produtos/importar"
            className="px-3 py-2 rounded-lg text-[13px] font-medium border transition-all hover:border-cyan-500/40 hover:text-cyan-400"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            + Importar planilha
          </Link>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm border"
            style={{ background: '#1a0a0a', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="Cadastros pendentes" value={kpis.pendentes} color="amber" />
          <Kpi label="Em andamento" value={kpis.em_andamento} color="cyan" />
          <Kpi label="Em fila" value={kpis.em_fila} />
          <Kpi label="Concluídos (7 dias)" value={kpis.concluidos_7d} color="emerald" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: '#27272a' }}>
          <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')}
            label="Pendentes" count={summary?.incomplete_count ?? 0} />
          <TabBtn active={tab === 'assignments'} onClick={() => setTab('assignments')}
            label="Despachados" count={assignments.filter(a => a.status !== 'completed').length} />
        </div>

        {/* PENDING tab */}
        {tab === 'pending' && (
          loading ? (
            <div className="text-center py-12 text-zinc-500">Carregando…</div>
          ) : !summary || summary.incomplete_count === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <div className="text-5xl mb-3">🎉</div>
              <div className="text-lg font-semibold">Nenhum produto pendente!</div>
              <div className="text-sm text-zinc-400 mt-1">Todos os cadastros estão completos.</div>
            </div>
          ) : (
            <>
              {/* Top missing fields breakdown */}
              <div className="mb-4 p-4 rounded-xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
                <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">Principais campos faltando</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.by_missing)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 12)
                    .map(([field, count]) => (
                      <span key={field}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border"
                        style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' }}>
                        <span className="text-zinc-300">{field}</span>
                        <span className="text-amber-400 font-bold">{count}</span>
                      </span>
                    ))}
                </div>
              </div>

              {/* Bulk action bar */}
              {selected.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-3 text-sm"
                  style={{ background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.2)' }}>
                  <span className="font-semibold text-cyan-400">{selected.size} selecionado{selected.size === 1 ? '' : 's'}</span>
                  <button onClick={() => setShowDispatchModal(true)}
                    className="ml-auto px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                    style={{ background: '#00E5FF', color: '#000' }}>
                    Despachar pra operador
                  </button>
                  <button onClick={() => setSelected(new Set())}
                    className="text-zinc-500 hover:text-zinc-300 text-xs">
                    Limpar
                  </button>
                </div>
              )}

              {/* Pending list */}
              <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #27272a' }}>
                <table className="w-full text-sm">
                  <thead style={{ background: '#0d0d10' }}>
                    <tr className="text-[11px] text-zinc-500 uppercase tracking-wider">
                      <th className="px-3 py-3 text-left w-10">
                        <input type="checkbox"
                          checked={summary.sample_incomplete.length > 0 && selected.size === summary.sample_incomplete.length}
                          onChange={toggleAll}
                          className="w-4 h-4 cursor-pointer accent-cyan-400" />
                      </th>
                      <th className="px-3 py-3 text-left">SKU</th>
                      <th className="px-3 py-3 text-left">Nome</th>
                      <th className="px-3 py-3 text-left">Campos faltando</th>
                      <th className="px-3 py-3 text-right w-32">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sample_incomplete.map(p => (
                      <tr key={p.id} className="border-t hover:bg-white/[0.02] transition-colors"
                        style={{ borderColor: '#27272a' }}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleOne(p.id)}
                            className="w-4 h-4 cursor-pointer accent-cyan-400" />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-zinc-300">{p.sku || '—'}</td>
                        <td className="px-3 py-2.5 max-w-xs truncate">{p.name}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {p.missing.slice(0, 4).map(m => (
                              <span key={m} className="px-1.5 py-0.5 rounded text-[10px]"
                                style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{m}</span>
                            ))}
                            {p.missing.length > 4 && (
                              <span className="text-[10px] text-zinc-500">+{p.missing.length - 4}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Link href={`/dashboard/produtos/${p.id}/editar`}
                            className="text-[11px] text-cyan-400 hover:text-cyan-300">
                            Editar →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {summary.incomplete_count > summary.sample_incomplete.length && (
                  <div className="px-4 py-3 text-center text-xs text-zinc-500"
                    style={{ borderTop: '1px solid #27272a' }}>
                    Mostrando {summary.sample_incomplete.length} de {summary.incomplete_count} pendentes
                  </div>
                )}
              </div>
            </>
          )
        )}

        {/* ASSIGNMENTS tab */}
        {tab === 'assignments' && (
          assignments.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <div className="text-4xl mb-2">📋</div>
              <div className="text-base font-semibold">Nenhum despacho ainda</div>
              <div className="text-sm text-zinc-500 mt-1">Despache produtos pendentes pro operador na aba "Pendentes".</div>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #27272a' }}>
              <table className="w-full text-sm">
                <thead style={{ background: '#0d0d10' }}>
                  <tr className="text-[11px] text-zinc-500 uppercase tracking-wider">
                    <th className="px-3 py-3 text-left">Produto</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-left">Faltando</th>
                    <th className="px-3 py-3 text-left">Prazo</th>
                    <th className="px-3 py-3 text-left">Despachado em</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id} className="border-t" style={{ borderColor: '#27272a' }}>
                      <td className="px-3 py-2.5">
                        <div className="text-sm font-medium">{a.products?.name ?? '—'}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">{a.products?.sku ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: STATUS_PILL[a.status].bg, color: STATUS_PILL[a.status].color }}>
                          {STATUS_PILL[a.status].label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-[11px] text-zinc-400">
                          {a.missing_fields_snapshot.slice(0, 3).map(m => m.label).join(' • ')}
                          {a.missing_fields_snapshot.length > 3 && ` +${a.missing_fields_snapshot.length - 3}`}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-zinc-400">{fmtDate(a.due_date)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-zinc-400">{fmtDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Dispatch result */}
        {dispatchResult && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-xl shadow-2xl"
            style={{ background: '#111114', border: '1px solid rgba(52,211,153,0.3)' }}>
            <div className="flex items-start gap-3">
              <div className="text-2xl">✅</div>
              <div className="flex-1">
                <div className="font-semibold text-emerald-400">
                  {dispatchResult.dispatched} card{dispatchResult.dispatched === 1 ? '' : 's'} criado{dispatchResult.dispatched === 1 ? '' : 's'} no Active
                </div>
                {dispatchResult.skipped_existing > 0 && (
                  <div className="text-xs text-zinc-400 mt-0.5">
                    {dispatchResult.skipped_existing} já tinha{dispatchResult.skipped_existing === 1 ? '' : 'm'} card aberto
                  </div>
                )}
                {dispatchResult.errors.length > 0 && (
                  <div className="text-xs text-red-400 mt-1">
                    {dispatchResult.errors.length} erro{dispatchResult.errors.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>
              <button onClick={() => setDispatchResult(null)} className="text-zinc-500 hover:text-zinc-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Dispatch modal */}
        {showDispatchModal && (
          <DispatchModal
            count={selected.size}
            onClose={() => setShowDispatchModal(false)}
            onConfirm={async (config) => {
              setShowDispatchModal(false)
              await handleDispatch(config)
            }}
            loading={dispatching}
          />
        )}
      </div>
    </div>
  )
}

// ── components ──────────────────────────────────────────────────────────────

function Kpi({ label, value, color }: { label: string; value: number; color?: 'amber' | 'cyan' | 'emerald' }) {
  const C = {
    amber:   { bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.2)',  text: '#f59e0b' },
    cyan:    { bg: 'rgba(0,229,255,0.06)',    border: 'rgba(0,229,255,0.2)',    text: '#67e8f9' },
    emerald: { bg: 'rgba(52,211,153,0.06)',   border: 'rgba(52,211,153,0.2)',   text: '#34d399' },
  } as const
  const c = color ? C[color] : { bg: '#111114', border: '#27272a', text: '#e4e4e7' }
  return (
    <div className="p-4 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: c.text }}>{value}</div>
    </div>
  )
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-all ${active ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
      {label}
      {count > 0 && (
        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]"
          style={{ background: active ? 'rgba(0,229,255,0.15)' : '#27272a' }}>
          {count}
        </span>
      )}
    </button>
  )
}

function DispatchModal({ count, onClose, onConfirm, loading }: {
  count:     number
  onClose:   () => void
  onConfirm: (config: DispatchConfig) => Promise<void> | void
  loading:   boolean
}) {
  const [operator, setOperator] = useState('')
  const [pipeline, setPipeline] = useState('')
  const [stage, setStage] = useState('')
  const [dueDate, setDueDate] = useState(plusDays(3))
  const [priority, setPriority] = useState<DispatchConfig['priority']>('normal')
  const [notes, setNotes] = useState('')

  const canSubmit = operator.trim() && pipeline.trim() && stage.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: '#0d0d10', border: '1px solid #27272a' }}
        onClick={e => e.stopPropagation()}>
        <div className="mb-4">
          <h2 className="text-lg font-bold">Despachar {count} produto{count === 1 ? '' : 's'} pro operador</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Cria 1 card no kanban do Active por produto, com task atribuída ao operador e prazo.
          </p>
        </div>

        <div className="space-y-3">
          <Field label="UUID do operador (user Active)" hint="Cole o uuid do operador no Active CRM">
            <input value={operator} onChange={e => setOperator(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono border outline-none"
              style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }} />
          </Field>

          <Field label="Pipeline ID" hint="UUID do funil 'Operação de Cadastro' no Active">
            <input value={pipeline} onChange={e => setPipeline(e.target.value)}
              placeholder="UUID do pipeline"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono border outline-none"
              style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }} />
          </Field>

          <Field label="Stage ID inicial" hint="UUID do estágio 'A Fazer'">
            <input value={stage} onChange={e => setStage(e.target.value)}
              placeholder="UUID do estágio"
              className="w-full px-3 py-2 rounded-lg text-sm font-mono border outline-none"
              style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prazo">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }} />
            </Field>

            <Field label="Prioridade">
              <select value={priority} onChange={e => setPriority(e.target.value as DispatchConfig['priority'])}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }}>
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </Field>
          </div>

          <Field label="Observações (opcional)">
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Instruções extras pro operador"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
              style={{ background: '#0a0a0c', borderColor: '#27272a', color: '#e4e4e7' }} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Cancelar
          </button>
          <button onClick={() => void onConfirm({
            operator_user_id: operator.trim(),
            pipeline_id:      pipeline.trim(),
            stage_id:         stage.trim(),
            due_date:         dueDate,
            priority,
            notes,
          })}
            disabled={!canSubmit || loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #00E5FF 0%, #0091EA 100%)', color: '#000' }}>
            {loading ? 'Despachando…' : `Despachar ${count}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-zinc-600 mt-1">{hint}</div>}
    </div>
  )
}
