'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { RefreshCw, Plus, Trash2, TrendingUp, TrendingDown, Target, Edit2, Check, X } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

async function getOrgId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()
  return data?.organization_id ?? null
}

// ── types ─────────────────────────────────────────────────────────────────────

type GoalType = 'revenue' | 'orders' | 'margin' | 'custom'
type GoalPeriod = 'monthly' | 'quarterly' | 'yearly'

type Goal = {
  id: string
  organization_id: string
  name: string
  type: GoalType
  period: GoalPeriod
  target_value: number
  current_value: number
  year: number
  month: number | null
  quarter: number | null
  notes: string | null
  created_at: string
}

type KpisMonthData = { count: number; revenue: number }
type KpisResponse  = { current_month: KpisMonthData; last_month: KpisMonthData }

// ── helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<GoalType, string>   = { revenue: 'Receita', orders: 'Pedidos', margin: 'Margem %', custom: 'Personalizado' }
const PERIOD_LABELS: Record<GoalPeriod, string> = { monthly: 'Mensal', quarterly: 'Trimestral', yearly: 'Anual' }
const TYPE_UNIT: Record<GoalType, 'brl' | 'num' | 'pct'> = { revenue: 'brl', orders: 'num', margin: 'pct', custom: 'num' }

function formatVal(v: number, type: GoalType) {
  const unit = TYPE_UNIT[type]
  if (unit === 'brl') return brl(v)
  if (unit === 'pct') return `${v.toFixed(1)}%`
  return String(Math.round(v))
}

function progressColor(pct: number): string {
  if (pct >= 100) return '#34d399'
  if (pct >= 75)  return '#22d3ee'
  if (pct >= 50)  return '#f59e0b'
  return '#f43f5e'
}

const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function periodLabel(g: Goal): string {
  if (g.period === 'monthly' && g.month != null)
    return `${PT_MONTHS[g.month - 1]}/${String(g.year).slice(2)}`
  if (g.period === 'quarterly' && g.quarter != null)
    return `Q${g.quarter}/${String(g.year).slice(2)}`
  return String(g.year)
}

// ── GoalForm ──────────────────────────────────────────────────────────────────

const now = new Date()

function GoalForm({ orgId, onSaved, onClose }: { orgId: string; onSaved: () => void; onClose: () => void }) {
  const [name,    setName]    = useState('')
  const [type,    setType]    = useState<GoalType>('revenue')
  const [period,  setPeriod]  = useState<GoalPeriod>('monthly')
  const [target,  setTarget]  = useState('')
  const [year,    setYear]    = useState(now.getFullYear())
  const [month,   setMonth]   = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3))
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const inp = 'w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-600 transition-colors'
  const sel = `${inp} cursor-pointer`
  const lbl = 'block text-xs font-medium text-zinc-400 mb-1'

  async function save() {
    if (!name.trim() || !target) return
    const num = parseFloat(target.replace(',', '.'))
    if (isNaN(num) || num <= 0) { setError('Valor inválido'); return }
    setSaving(true)
    const supabase = createClient()
    const { error: e } = await supabase.from('goals').insert({
      organization_id: orgId,
      name:            name.trim(),
      type,
      period,
      target_value:    num,
      current_value:   0,
      year,
      month:           period === 'monthly'   ? month   : null,
      quarter:         period === 'quarterly' ? quarter : null,
      notes:           notes.trim() || null,
    })
    if (e) { setError(e.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <p className="text-white font-semibold text-sm">Nova Meta</p>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className={lbl}>Nome da meta</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Faturamento mensal"
              className={inp} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo</label>
              <select value={type} onChange={e => setType(e.target.value as GoalType)} className={sel}>
                {(Object.keys(TYPE_LABELS) as GoalType[]).map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Período</label>
              <select value={period} onChange={e => setPeriod(e.target.value as GoalPeriod)} className={sel}>
                {(Object.keys(PERIOD_LABELS) as GoalPeriod[]).map(p => (
                  <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Ano</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className={sel}>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {period === 'monthly' && (
              <div>
                <label className={lbl}>Mês</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className={sel}>
                  {PT_MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
            )}
            {period === 'quarterly' && (
              <div>
                <label className={lbl}>Trimestre</label>
                <select value={quarter} onChange={e => setQuarter(Number(e.target.value))} className={sel}>
                  {[1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className={lbl}>
              Valor alvo {type === 'revenue' ? '(R$)' : type === 'margin' ? '(%)' : ''}
            </label>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="0"
              className={inp} inputMode="decimal" />
          </div>
          <div>
            <label className={lbl}>Observações (opcional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Estratégia, contexto…"
              className={inp} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || !name || !target}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.25)', opacity: (!name || !target) ? 0.4 : 1 }}>
            {saving ? 'Salvando…' : 'Salvar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── GoalCard ──────────────────────────────────────────────────────────────────

function GoalCard({ goal, onDelete, onUpdateProgress }: {
  goal: Goal
  onDelete: (id: string) => void
  onUpdateProgress: (id: string, v: number) => void
}) {
  const [editingProgress, setEditingProgress] = useState(false)
  const [progressVal, setProgressVal] = useState(String(goal.current_value))
  const [deleting, setDeleting] = useState(false)

  const pct = goal.target_value > 0
    ? Math.min(150, (goal.current_value / goal.target_value) * 100)
    : 0
  const clampedPct = Math.min(100, pct)
  const color = progressColor(pct)
  const done  = pct >= 100

  async function saveProgress() {
    const num = parseFloat(progressVal.replace(',', '.'))
    if (!isNaN(num) && num >= 0) onUpdateProgress(goal.id, num)
    setEditingProgress(false)
  }

  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: `1px solid ${done ? '#34d39930' : '#1e1e24'}` }}>
      {/* title row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{goal.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#a1a1aa' }}>
              {TYPE_LABELS[goal.type]}
            </span>
            <span className="text-[10px] text-zinc-600">{PERIOD_LABELS[goal.period]} · {periodLabel(goal)}</span>
          </div>
        </div>
        <button
          onClick={async () => { setDeleting(true); onDelete(goal.id) }}
          disabled={deleting}
          className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 mt-0.5">
          <Trash2 size={13} />
        </button>
      </div>

      {/* progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-zinc-500">Progresso</span>
          <span className="text-[11px] font-bold tabular-nums" style={{ color }}>{pct.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${clampedPct}%`, background: color }}
          />
        </div>
      </div>

      {/* current vs target */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-zinc-600 mb-0.5">Realizado</p>
          {editingProgress ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={progressVal}
                onChange={e => setProgressVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveProgress(); if (e.key === 'Escape') setEditingProgress(false) }}
                className="w-24 bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-600"
              />
              <button onClick={saveProgress} className="text-emerald-400"><Check size={11} /></button>
              <button onClick={() => setEditingProgress(false)} className="text-zinc-500"><X size={11} /></button>
            </div>
          ) : (
            <button onClick={() => { setProgressVal(String(goal.current_value)); setEditingProgress(true) }}
              className="flex items-center gap-1 group">
              <span className="text-sm font-bold text-white">{formatVal(goal.current_value, goal.type)}</span>
              <Edit2 size={10} className="opacity-0 group-hover:opacity-50 text-zinc-400 transition-opacity" />
            </button>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600 mb-0.5">Meta</p>
          <p className="text-sm font-bold" style={{ color: '#a1a1aa' }}>{formatVal(goal.target_value, goal.type)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600 mb-0.5">Faltam</p>
          <p className="text-sm font-bold" style={{ color: done ? '#34d399' : '#f43f5e' }}>
            {done ? '✓ Meta!' : formatVal(Math.max(0, goal.target_value - goal.current_value), goal.type)}
          </p>
        </div>
      </div>

      {goal.notes && (
        <p className="text-[11px] text-zinc-600 mt-2 border-t border-zinc-800 pt-2">{goal.notes}</p>
      )}
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function MetasPage() {
  const [goals,      setGoals]      = useState<Goal[]>([])
  const [orgId,      setOrgId]      = useState<string | null>(null)
  const [kpis,       setKpis]       = useState<KpisResponse | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [noTable,    setNoTable]    = useState(false)

  const loadGoals = useCallback(async (oid: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('organization_id', oid)
      .order('created_at', { ascending: false })

    if (error?.message?.includes('does not exist') || error?.code === '42P01') {
      setNoTable(true)
      return
    }
    setGoals(data ?? [])
  }, [])

  const loadKpis = useCallback(async () => {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch(`${BACKEND}/ml/orders/kpis`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setKpis(await res.json())
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const oid = await getOrgId()
      setOrgId(oid)
      if (oid) await Promise.all([loadGoals(oid), loadKpis()])
      setLoading(false)
    }
    init()
  }, [loadGoals, loadKpis])

  async function deleteGoal(id: string) {
    const supabase = createClient()
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  async function updateProgress(id: string, value: number) {
    const supabase = createClient()
    await supabase.from('goals').update({ current_value: value }).eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, current_value: value } : g))
  }

  // Auto-suggest current month values from ML kpis
  const curMonth = new Date()
  const revenueGoals = goals.filter(g =>
    g.type === 'revenue' && g.period === 'monthly' &&
    g.year === curMonth.getFullYear() && g.month === curMonth.getMonth() + 1
  )
  const ordersGoals = goals.filter(g =>
    g.type === 'orders' && g.period === 'monthly' &&
    g.year === curMonth.getFullYear() && g.month === curMonth.getMonth() + 1
  )

  // KPI summary
  const totalGoals    = goals.length
  const onTrack       = goals.filter(g => g.target_value > 0 && (g.current_value / g.target_value) >= 0.75).length
  const completed     = goals.filter(g => g.target_value > 0 && g.current_value >= g.target_value).length
  const behindCount   = totalGoals - onTrack

  if (noTable) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <Target size={32} className="text-zinc-600" />
        <p className="text-white font-semibold">Tabela de metas não encontrada</p>
        <p className="text-sm text-zinc-500 max-w-sm">
          Execute o SQL abaixo no Supabase para criar a tabela de metas:
        </p>
        <pre className="text-xs text-left text-zinc-400 bg-zinc-900 rounded-xl p-4 max-w-lg w-full overflow-auto"
          style={{ border: '1px solid #27272a' }}>
{`CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'revenue',
  period TEXT NOT NULL DEFAULT 'monthly',
  target_value NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  month INTEGER,
  quarter INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_goals" ON goals FOR ALL TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));`}
        </pre>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-auto px-6 py-6" style={{ color: '#e4e4e7' }}>
      {showForm && orgId && (
        <GoalForm
          orgId={orgId}
          onSaved={async () => { setShowForm(false); if (orgId) await loadGoals(orgId) }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Metas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Acompanhe seus objetivos de receita, pedidos e margem</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF' }}>
          <Plus size={14} /> Nova meta
        </button>
      </div>

      {/* summary KPIs */}
      {!loading && goals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total de metas',      value: String(totalGoals),  icon: <Target size={16} />,       color: '#a1a1aa' },
            { label: 'Concluídas',          value: String(completed),   icon: <Check size={16} />,        color: '#34d399' },
            { label: 'No caminho (≥75%)',   value: String(onTrack),     icon: <TrendingUp size={16} />,   color: '#22d3ee' },
            { label: 'Atrás',              value: String(behindCount),  icon: <TrendingDown size={16} />, color: behindCount > 0 ? '#f43f5e' : '#71717a' },
          ].map(k => (
            <div key={k.label} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <span style={{ color: k.color }}>{k.icon}</span>
              <div>
                <p className="text-[10px] text-zinc-500">{k.label}</p>
                <p className="text-lg font-bold" style={{ color: k.color }}>{k.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ML sync suggestion for current month */}
      {kpis && (revenueGoals.length > 0 || ordersGoals.length > 0) && (
        <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)' }}>
          <RefreshCw size={14} style={{ color: '#00E5FF' }} />
          <div className="flex-1 text-sm text-zinc-400">
            Dados do mês atual: <span className="text-white font-semibold">{brl(kpis.current_month.revenue)}</span>
            {' '}em receita e <span className="text-white font-semibold">{kpis.current_month.count} pedidos</span>.
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-zinc-600 text-sm gap-2">
          <RefreshCw size={14} className="animate-spin" /> Carregando…
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 gap-4 text-center">
          <Target size={36} className="text-zinc-700" />
          <div>
            <p className="text-white font-semibold">Nenhuma meta cadastrada</p>
            <p className="text-sm text-zinc-500 mt-1">Crie sua primeira meta para acompanhar o progresso.</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF' }}>
            <Plus size={14} /> Criar meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(g => (
            <GoalCard
              key={g.id}
              goal={g}
              onDelete={deleteGoal}
              onUpdateProgress={updateProgress}
            />
          ))}
        </div>
      )}
    </div>
  )
}
