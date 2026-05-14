'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AccountSelector, { getStoredSellerId } from '@/components/ml/AccountSelector'
import {
  AlertTriangle, AlertCircle, Info, ChevronRight, RefreshCw, Filter,
  Package, Pause, TrendingUp, Tag, FileText, Truck, ShoppingCart,
  ExternalLink, Clock, X, Check, Sparkles, Eye,
} from 'lucide-react'
import { useToast, ToastViewport } from '@/hooks/useToast'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type TaskType =
  | 'OUT_OF_STOCK' | 'INACTIVE_PAUSED'
  | 'QUALITY_LOW' | 'QUALITY_INCOMPLETE'
  | 'PRICE_HIGH' | 'PRICE_AUTOMATION_AVAILABLE'
  | 'FISCAL_DATA_MISSING'
  | 'PROMOTION_AVAILABLE' | 'PROMOTION_HIGH_OPPORTUNITY'
  | 'DROPSHIP_PARTNER_OUT_OF_STOCK'
  | 'CATALOG_ELIGIBLE' | 'LOSING_BUY_BOX'
  | 'SEO_LOW' | 'SEO_HIGH_VISITS_LOW_SCORE'
  | string

interface Summary {
  total_open_tasks: number
  total_critical: number
  total_high: number
  total_medium: number
  total_low: number
  tasks_by_type: Record<string, number>
  total_estimated_impact_brl: number
  high_impact_tasks_count: number
  last_full_scan_at: string | null
}

interface SeoOpportunity {
  ml_item_id:       string
  title:            string | null
  structural_score: number
  title_score:      number
  attributes_score: number
  pictures_score:   number
  visits_30d:       number | null
  sold_quantity:    number | null
  price:            number | null
}

interface Task {
  id: string
  ml_item_id: string
  product_id: string | null
  task_type: TaskType
  task_title: string
  task_description: string | null
  source: string
  severity: Severity
  priority_score: number | null
  estimated_impact_brl: number | null
  current_value: Record<string, unknown>
  suggested_action: string | null
  deeplink_url: string | null
  status: string
  detection_count: number
  last_seen_at: string
}

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa', info: 'Info',
}
const SEVERITY_COLORS: Record<Severity, { bg: string; border: string; text: string }> = {
  critical: { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: '#ef4444' },
  high:     { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
  medium:   { bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.25)', text: '#00E5FF' },
  low:      { bg: 'rgba(113,113,122,0.1)', border: 'rgba(113,113,122,0.25)', text: '#a1a1aa' },
  info:     { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  text: '#3b82f6' },
}

const TASK_TYPE_LABELS: Record<string, { label: string; icon: typeof Package }> = {
  OUT_OF_STOCK:                   { label: 'Sem estoque',         icon: Package },
  INACTIVE_PAUSED:                { label: 'Pausado/inativo',     icon: Pause },
  QUALITY_LOW:                    { label: 'Qualidade baixa',     icon: AlertCircle },
  QUALITY_INCOMPLETE:             { label: 'Atributos faltando',  icon: AlertCircle },
  PRICE_HIGH:                     { label: 'Preço alto',          icon: TrendingUp },
  PRICE_AUTOMATION_AVAILABLE:     { label: 'Automação preço',     icon: Tag },
  FISCAL_DATA_MISSING:            { label: 'Dados fiscais',       icon: FileText },
  PROMOTION_AVAILABLE:            { label: 'Campanha disponível', icon: Tag },
  PROMOTION_HIGH_OPPORTUNITY:     { label: 'Campanha alta',       icon: Tag },
  DROPSHIP_PARTNER_OUT_OF_STOCK:  { label: 'Parceiro sem estoque', icon: Truck },
  CATALOG_ELIGIBLE:               { label: 'Catálogo elegível',   icon: ShoppingCart },
  LOSING_BUY_BOX:                 { label: 'Perdendo Buy Box',    icon: AlertTriangle },
  SEO_LOW:                        { label: 'SEO baixo',           icon: Sparkles },
  SEO_HIGH_VISITS_LOW_SCORE:      { label: 'Tráfego × SEO ruim',  icon: Eye },
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ListingsHomePage() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const searchParams = useSearchParams()
  const initialType = (searchParams.get('type') ?? '') as TaskType | ''

  const [summary, setSummary] = useState<Summary | null>(null)
  const [tasks, setTasks]     = useState<Task[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [seoTop, setSeoTop]     = useState<SeoOpportunity[]>([])

  // Filtros — type vem do query string (atalhos do sidebar)
  const [filterType, setFilterType]         = useState<TaskType | ''>(initialType)
  const [filterSeverity, setFilterSeverity] = useState<Severity | ''>('')
  const [filtersOpen, setFiltersOpen]       = useState(false)

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const sellerId = getStoredSellerId()
      const sellerQs = sellerId != null ? `&seller_id=${sellerId}` : ''
      const filterQs = [
        filterType ? `&task_type=${filterType}` : '',
        filterSeverity ? `&severity=${filterSeverity}` : '',
      ].join('')

      const [sumRes, tasksRes, seoRes] = await Promise.all([
        fetch(`${BACKEND}/listings/summary?_=1${sellerQs}`, { headers }),
        fetch(`${BACKEND}/listings/tasks?limit=50${sellerQs}${filterQs}`, { headers }),
        fetch(`${BACKEND}/listings/seo/top-opportunities?limit=5${sellerQs}`, { headers }),
      ])
      if (sumRes.ok)   setSummary(await sumRes.json())
      if (tasksRes.ok) {
        const body = await tasksRes.json()
        setTasks(body.tasks ?? [])
        setTotal(body.total ?? 0)
      }
      if (seoRes.ok)   setSeoTop((await seoRes.json()) as SeoOpportunity[])
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro ao carregar', tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [getHeaders, filterType, filterSeverity, toast])

  useEffect(() => { load() }, [load])

  const runScan = async (kind: 'full' | 'aggregation' | 'stock' | 'status') => {
    const sellerId = getStoredSellerId()
    if (kind !== 'aggregation' && sellerId == null) {
      toast({ message: 'Selecione uma conta ML primeiro', tone: 'error' })
      return
    }
    setScanning(true)
    try {
      const headers = await getHeaders()
      const body: Record<string, number> = {}
      if (sellerId != null) body.seller_id = sellerId
      const res = await fetch(`${BACKEND}/listings/scan/${kind}`, {
        method: 'POST', headers, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      toast({ message: `Scan ${kind} concluído · +${result.tasks_created} criadas, ${result.tasks_updated} atualizadas, ${result.tasks_resolved_auto} resolvidas`, tone: 'success' })
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro ao rodar scan', tone: 'error' })
    } finally {
      setScanning(false)
    }
  }

  const taskAction = async (id: string, action: 'snooze' | 'dismiss' | 'resolve', extra?: { days?: number; reason?: string; notes?: string }) => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/tasks/${id}`, {
        method: 'PATCH', headers, body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast({ message: `Tarefa ${action === 'snooze' ? 'adiada' : action === 'dismiss' ? 'descartada' : 'resolvida'}`, tone: 'success' })
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Erro', tone: 'error' })
    }
  }

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }} className="p-6 max-w-[1400px] space-y-5">
      <ToastViewport />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Listing Center · IA</p>
          <h1 className="text-white text-3xl font-semibold">Anúncios — central de tarefas</h1>
          <p className="text-xs text-zinc-600 mt-1">
            {summary?.last_full_scan_at
              ? `Último scan completo: ${new Date(summary.last_full_scan_at).toLocaleString('pt-BR')}`
              : 'Nenhum scan completo ainda'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AccountSelector compact hideWhenEmpty />
          <button onClick={() => runScan('aggregation')} disabled={scanning}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
            style={{ background: '#18181b', color: 'var(--text)', border: '1px solid #27272a' }}>
            <RefreshCw size={11} className={scanning ? 'animate-spin' : ''} /> Atualizar agregação
          </button>
          <button onClick={() => runScan('full')} disabled={scanning}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#0d0d10' }}>
            <RefreshCw size={11} className={scanning ? 'animate-spin' : ''} /> Scan completo
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Tarefas abertas"   value={summary?.total_open_tasks ?? 0} color="#00E5FF" loading={loading} />
        <KpiCard label="Críticas"           value={summary?.total_critical ?? 0}    color="#ef4444" loading={loading} />
        <KpiCard label="Alto impacto (>R$1k)" value={summary?.high_impact_tasks_count ?? 0} color="#f59e0b" loading={loading} />
        <KpiCard label="Impacto estimado total"
          value={summary ? brl(summary.total_estimated_impact_brl) : '—'} color="#22c55e" loading={loading} isCurrency />
      </div>

      {/* SEO Top ROI — Passo 3 (visitas × score baixo) */}
      {seoTop.length > 0 && (
        <section className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.06), rgba(0,229,255,0.02))', border: '1px solid rgba(0,229,255,0.25)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5" style={{ color: '#00E5FF' }}>
                <Sparkles size={11} /> Top ROI — otimizar agora
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">Anúncios com tráfego alto e score SEO baixo. Otimizar = converter o tráfego existente.</p>
            </div>
            <Link href="/dashboard/listings/seo-optimizer"
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)' }}>
              Abrir Otimizador →
            </Link>
          </div>
          <div className="space-y-1.5">
            {seoTop.map(s => (
              <Link key={s.ml_item_id}
                href={`/dashboard/listings/seo-optimizer?mlbId=${s.ml_item_id}`}
                className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-zinc-900/40 transition-colors group">
                <div className="flex items-center gap-1 shrink-0 w-16">
                  <Eye size={11} className="text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-200">{(s.visits_30d ?? 0).toLocaleString('pt-BR')}</span>
                </div>
                <div className="shrink-0 w-12 text-center">
                  <span className={`text-xs font-bold ${s.structural_score < 40 ? 'text-red-400' : s.structural_score < 60 ? 'text-amber-400' : 'text-zinc-300'}`}>
                    {s.structural_score}
                  </span>
                  <span className="text-[9px] text-zinc-500">/100</span>
                </div>
                <span className="text-[11px] font-mono text-zinc-500 shrink-0 w-28 truncate">{s.ml_item_id}</span>
                <span className="text-xs text-zinc-300 truncate flex-1" title={s.title ?? ''}>
                  {s.title ?? '—'}
                </span>
                <ChevronRight size={14} className="text-zinc-600 group-hover:text-cyan-400 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick filters por tipo */}
      {summary && Object.keys(summary.tasks_by_type).length > 0 && (
        <section className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">Por tipo</p>
          <div className="flex flex-wrap gap-2">
            <TypeChip label="Todos" count={summary.total_open_tasks} active={filterType === ''} onClick={() => setFilterType('')} />
            {Object.entries(summary.tasks_by_type).sort(([,a],[,b]) => b - a).map(([type, count]) => (
              <TypeChip
                key={type}
                label={TASK_TYPE_LABELS[type]?.label ?? type}
                count={count}
                active={filterType === type}
                onClick={() => setFilterType(filterType === type ? '' : (type as TaskType))}
              />
            ))}
          </div>
        </section>
      )}

      {/* Filtro avançado collapsible */}
      <section className="rounded-xl p-3" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <button onClick={() => setFiltersOpen(o => !o)}
          className="w-full flex items-center justify-between text-zinc-400 text-xs">
          <span className="flex items-center gap-2"><Filter size={12} /> Filtros avançados</span>
          <ChevronRight size={12} className={`transition-transform ${filtersOpen ? 'rotate-90' : ''}`} />
        </button>
        {filtersOpen && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-zinc-500 mb-1">Severidade</label>
              <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as Severity | '')}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-zinc-200">
                <option value="">Todas</option>
                {(['critical','high','medium','low','info'] as Severity[]).map(s =>
                  <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>,
                )}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={() => { setFilterType(''); setFilterSeverity('') }}
                className="text-[11px] px-2 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200">
                Limpar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Lista de tarefas */}
      <section className="rounded-xl" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <div className="p-3 flex items-center justify-between border-b border-zinc-800/60">
          <p className="text-zinc-300 text-sm font-semibold">Tarefas {total > 0 && <span className="text-zinc-500 text-xs">({total} no total)</span>}</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-xs">Carregando…</div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center">
            <Check size={32} className="text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-400 text-sm">Sem tarefas abertas</p>
            <p className="text-zinc-600 text-xs mt-1">Rode o scan completo pra detectar problemas nos anúncios</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {tasks.map(t => <TaskRow key={t.id} task={t} onAction={taskAction} />)}
          </div>
        )}
      </section>
    </div>
  )
}

// ──── Subcomponents ────

function KpiCard({ label, value, color, loading, isCurrency }: { label: string; value: number | string; color: string; loading: boolean; isCurrency?: boolean }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold">{label}</p>
      {loading
        ? <div className="h-7 mt-2 w-1/2 bg-zinc-800 rounded animate-pulse" />
        : <p className="text-2xl font-black mt-1" style={{ color }}>{isCurrency ? value : value.toLocaleString('pt-BR')}</p>
      }
    </div>
  )
}

function TypeChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="text-[11px] px-2.5 py-1 rounded-full transition-colors flex items-center gap-1.5"
      style={active
        ? { background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)', color: '#00E5FF' }
        : { background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
      {label}
      <span className="font-bold tabular-nums">{count}</span>
    </button>
  )
}

function TaskRow({ task, onAction }: { task: Task; onAction: (id: string, action: 'snooze' | 'dismiss' | 'resolve', extra?: { days?: number; reason?: string; notes?: string }) => void }) {
  const sev = SEVERITY_COLORS[task.severity]
  const typeMeta = TASK_TYPE_LABELS[task.task_type]
  const Icon = typeMeta?.icon ?? AlertCircle

  return (
    <div className="p-3 hover:bg-zinc-900/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 p-1.5 rounded-lg" style={{ background: sev.bg, border: `1px solid ${sev.border}` }}>
          <Icon size={14} style={{ color: sev.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-zinc-200 text-sm font-medium leading-snug">{task.task_title}</p>
            <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: sev.bg, color: sev.text, border: `1px solid ${sev.border}` }}>
              {SEVERITY_LABELS[task.severity]}
            </span>
            {task.detection_count > 1 && (
              <span className="text-[9px] text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-800">
                detectada {task.detection_count}x
              </span>
            )}
          </div>
          {task.task_description && (
            <p className="text-xs text-zinc-500 mt-0.5 leading-snug line-clamp-2">{task.task_description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
            <Link href={`/dashboard/listings/items/${task.ml_item_id}`} className="font-mono text-zinc-400 hover:text-cyan-400 transition-colors">
              {task.ml_item_id}
            </Link>
            {task.estimated_impact_brl ? (
              <span className="text-emerald-500 font-medium">+R$ {Math.round(task.estimated_impact_brl).toLocaleString('pt-BR')}/mês</span>
            ) : null}
            {task.suggested_action && (
              <span className="text-zinc-500 italic line-clamp-1">→ {task.suggested_action}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          {task.deeplink_url && (
            <a href={task.deeplink_url}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-cyan-400 transition-colors"
              title="Ir pra módulo de origem">
              <ExternalLink size={12} />
            </a>
          )}
          <button onClick={() => onAction(task.id, 'snooze', { days: 7 })}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 transition-colors"
            title="Adiar 7 dias">
            <Clock size={12} />
          </button>
          <button onClick={() => onAction(task.id, 'resolve')}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-emerald-400 transition-colors"
            title="Marcar como resolvida">
            <Check size={12} />
          </button>
          <button onClick={() => onAction(task.id, 'dismiss', { reason: 'Descartada manualmente' })}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors"
            title="Descartar">
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
