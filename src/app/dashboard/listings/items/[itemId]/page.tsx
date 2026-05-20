'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { use } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  ChevronLeft, AlertCircle, AlertTriangle, ExternalLink, Clock, X, Check,
  Package, Pause, TrendingUp, Tag, FileText, Truck, ShoppingCart,
} from 'lucide-react'
import { useToast, ToastViewport } from '@/hooks/useToast'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

interface Task {
  id: string
  ml_item_id: string
  product_id: string | null
  task_type: string
  task_title: string
  task_description: string | null
  source: string
  severity: Severity
  priority_score: number | null
  estimated_impact_brl: number | null
  current_value: Record<string, unknown>
  suggested_value: Record<string, unknown>
  suggested_action: string | null
  deeplink_url: string | null
  status: string
  detection_count: number
  first_detected_at: string
  last_seen_at: string
  resolved_at: string | null
  resolution_notes: string | null
  resolved_by: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

const SEV_COLORS: Record<Severity, { bg: string; border: string; text: string }> = {
  critical: { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: '#ef4444' },
  high:     { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
  medium:   { bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.25)', text: '#00E5FF' },
  low:      { bg: 'rgba(113,113,122,0.1)', border: 'rgba(113,113,122,0.25)', text: '#a1a1aa' },
  info:     { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  text: '#3b82f6' },
}

const TYPE_ICONS: Record<string, typeof Package> = {
  OUT_OF_STOCK: Package,
  INACTIVE_PAUSED: Pause,
  QUALITY_LOW: AlertCircle,
  QUALITY_INCOMPLETE: AlertCircle,
  PRICE_HIGH: TrendingUp,
  PRICE_AUTOMATION_AVAILABLE: Tag,
  FISCAL_DATA_MISSING: FileText,
  PROMOTION_AVAILABLE: Tag,
  PROMOTION_HIGH_OPPORTUNITY: Tag,
  DROPSHIP_PARTNER_OUT_OF_STOCK: Truck,
  CATALOG_ELIGIBLE: ShoppingCart,
  LOSING_BUY_BOX: AlertTriangle,
}

export default function ItemDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = use(params)
  const t = useTranslations('listings.itemDetail')
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const [tasks, setTasks]     = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase, t])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/items/${itemId}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.loadFailed'), tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [getHeaders, itemId, toast, t])

  useEffect(() => { load() }, [load])

  const taskAction = async (id: string, action: 'snooze' | 'dismiss' | 'resolve', extra?: Record<string, unknown>) => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/tasks/${id}`, {
        method: 'PATCH', headers, body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast({ message: t(`taskActionDone.${action}`), tone: 'success' })
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.generic'), tone: 'error' })
    }
  }

  const open = tasks.filter(t => ['open', 'snoozed', 'in_progress'].includes(t.status))
  const closed = tasks.filter(t => !['open', 'snoozed', 'in_progress'].includes(t.status))

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }} className="p-6 max-w-[1200px] space-y-5">
      <ToastViewport />

      {/* Header */}
      <div>
        <Link href="/dashboard/listings"
          className="text-zinc-500 hover:text-cyan-400 text-xs flex items-center gap-1 mb-2 transition-colors">
          <ChevronLeft size={12} /> {t('backToCenter')}
        </Link>
        <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">{t('eyebrow')}</p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-white text-2xl font-semibold font-mono">{itemId}</h1>
          <a href={`https://www.mercadolivre.com.br/${itemId}`} target="_blank" rel="noopener noreferrer"
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
            {t('viewOnMl')} <ExternalLink size={11} />
          </a>
        </div>
        <p className="text-xs text-zinc-600 mt-1">
          {t('openTasks', { count: open.length })}
          {closed.length > 0 && ` · ${t('resolvedTasks', { count: closed.length })}`}
        </p>
      </div>

      {/* Tarefas abertas */}
      <section>
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">{t('pendingTasks')}</p>
        {loading ? (
          <div className="rounded-xl p-8 text-center text-zinc-500 text-xs"
            style={{ background: '#111114', border: '1px solid #1a1a1f' }}>{t('loading')}</div>
        ) : open.length === 0 ? (
          <div className="rounded-xl p-8 text-center"
            style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <Check size={28} className="text-emerald-500/60 mx-auto mb-2" />
            <p className="text-zinc-400 text-sm">{t('empty.title')}</p>
            <p className="text-zinc-600 text-xs mt-1">{t('empty.desc')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {open.map(task => <FullTaskCard key={task.id} task={task} onAction={taskAction} />)}
          </div>
        )}
      </section>

      {/* Tarefas resolvidas (histórico) */}
      {closed.length > 0 && (
        <section>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">{t('history')}</p>
          <div className="space-y-1.5">
            {closed.slice(0, 10).map(task => (
              <div key={task.id} className="rounded-lg px-3 py-2 flex items-center justify-between text-xs opacity-60"
                style={{ background: '#0d0d10', border: '1px solid #1a1a1f' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    task.status === 'resolved_auto' ? 'bg-emerald-500/60' :
                    task.status === 'resolved_manual' ? 'bg-emerald-500' :
                    task.status === 'dismissed' ? 'bg-zinc-600' : 'bg-zinc-500'}`} />
                  <p className="text-zinc-400 truncate">{task.task_title}</p>
                </div>
                <span className="text-zinc-600 text-[10px] shrink-0 ml-2">
                  {task.resolved_at ? new Date(task.resolved_at).toLocaleDateString('pt-BR') : '—'}
                  {' · '}
                  {task.status === 'resolved_auto' ? t('resolvedAuto') : task.status === 'resolved_manual' ? t('resolvedManual') : t('dismissed')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function FullTaskCard({ task, onAction }: { task: Task; onAction: (id: string, action: 'snooze' | 'dismiss' | 'resolve', extra?: Record<string, unknown>) => void }) {
  const t = useTranslations('listings.itemDetail')
  const sev = SEV_COLORS[task.severity]
  const Icon = TYPE_ICONS[task.task_type] ?? AlertCircle

  return (
    <div className="rounded-xl p-4"
      style={{ background: '#111114', border: '1px solid #1a1a1f', borderLeft: `3px solid ${sev.text}` }}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 p-1.5 rounded-lg" style={{ background: sev.bg, border: `1px solid ${sev.border}` }}>
          <Icon size={16} style={{ color: sev.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-zinc-100 font-semibold text-sm">{task.task_title}</p>
            <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
              style={{ background: sev.bg, color: sev.text, border: `1px solid ${sev.border}` }}>
              {t(`severity.${task.severity}`)}
            </span>
            <span className="text-[9px] text-zinc-600 uppercase tracking-widest">
              {t('source', { source: task.source })}
            </span>
          </div>
          {task.task_description && (
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{task.task_description}</p>
          )}
          {task.suggested_action && (
            <div className="mt-2.5 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
              <p className="text-[10px] uppercase tracking-widest text-cyan-400/80 font-bold mb-0.5">{t('suggestedAction')}</p>
              <p className="text-xs text-cyan-200">{task.suggested_action}</p>
            </div>
          )}
          <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-600 flex-wrap">
            {task.estimated_impact_brl ? (
              <span className="text-emerald-500 font-medium">{t('estimatedImpact', { value: Math.round(task.estimated_impact_brl).toLocaleString('pt-BR') })}</span>
            ) : null}
            {task.priority_score != null && <span>{t('priority', { score: task.priority_score })}</span>}
            <span>{t('detectionInfo', { count: task.detection_count, date: new Date(task.first_detected_at).toLocaleDateString('pt-BR') })}</span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col gap-1">
          {task.deeplink_url && (
            <a href={task.deeplink_url}
              className="text-[10px] px-2 py-1 rounded text-cyan-400 hover:text-cyan-300 hover:bg-zinc-800 transition-colors flex items-center gap-1">
              {t('resolve')} <ExternalLink size={10} />
            </a>
          )}
          <button onClick={() => onAction(task.id, 'snooze', { days: 7 })}
            className="text-[10px] px-2 py-1 rounded text-amber-400 hover:bg-zinc-800 transition-colors flex items-center gap-1">
            <Clock size={10} /> {t('snooze7')}
          </button>
          <button onClick={() => onAction(task.id, 'resolve')}
            className="text-[10px] px-2 py-1 rounded text-emerald-400 hover:bg-zinc-800 transition-colors flex items-center gap-1">
            <Check size={10} /> {t('resolved')}
          </button>
          <button onClick={() => onAction(task.id, 'dismiss', { reason: t('dismissReason') })}
            className="text-[10px] px-2 py-1 rounded text-rose-400 hover:bg-zinc-800 transition-colors flex items-center gap-1">
            <X size={10} /> {t('dismiss')}
          </button>
        </div>
      </div>
    </div>
  )
}
