'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AccountSelector, { getStoredSellerId } from '@/components/ml/AccountSelector'
import {
  ChevronLeft, RefreshCw, Activity, CheckCircle2, AlertTriangle, X, Clock,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { useToast, ToastViewport } from '@/hooks/useToast'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

type Status = 'pending' | 'validating' | 'executing' | 'completed' | 'partial' | 'failed' | 'cancelled'
type ActionType =
  | 'apply_price_suggestions' | 'activate_automation' | 'pause_automation'
  | 'fix_fiscal_data' | 'reactivate_paused' | 'pause_listings'
  | 'snooze_tasks' | 'dismiss_tasks' | 'resolve_tasks_manual'

interface BulkAction {
  id: string
  action_type: ActionType
  apply_mode: 'safe' | 'best_effort' | 'dry_run'
  status: Status
  total_count: number
  applied_count: number
  failed_count: number
  skipped_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  user_id: string | null
}

interface BulkActionDetail extends BulkAction {
  task_ids: string[]
  item_ids: string[]
  results: Array<{ item_id_or_task_id: string; status: 'applied' | 'failed' | 'skipped'; message?: string; new_price?: number }>
}

const STATUS_META: Record<Status, { color: string; bg: string; icon: typeof Activity }> = {
  pending:     { color: '#a1a1aa', bg: 'rgba(113,113,122,0.08)', icon: Clock },
  validating:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  icon: Activity },
  executing:   { color: '#00E5FF', bg: 'rgba(0,229,255,0.08)',   icon: Activity },
  completed:   { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: CheckCircle2 },
  partial:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: AlertTriangle },
  failed:      { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: AlertTriangle },
  cancelled:   { color: '#71717a', bg: 'rgba(113,113,122,0.08)', icon: X },
}

export default function BulkActionsPage() {
  const t = useTranslations('listings.bulk')
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const [actions, setActions] = useState<BulkAction[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<BulkActionDetail | null>(null)

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase, t])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const sellerId = getStoredSellerId()
      const sellerQs = sellerId != null ? `?seller_id=${sellerId}` : ''
      const res = await fetch(`${BACKEND}/listings/bulk/actions${sellerQs}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setActions(await res.json())
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.generic'), tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [getHeaders, toast, t])

  useEffect(() => { load() }, [load])

  // Polling — se tem alguma action ativa, recarrega a cada 3s
  useEffect(() => {
    const hasActive = actions.some(a => ['pending', 'validating', 'executing'].includes(a.status))
    if (!hasActive) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [actions, load])

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    setDetail(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/bulk/actions/${id}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDetail(await res.json())
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.generic'), tone: 'error' })
    }
  }

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }} className="p-6 max-w-[1200px] space-y-5">
      <ToastViewport />

      <div>
        <Link href="/dashboard/listings"
          className="text-zinc-500 hover:text-cyan-400 text-xs flex items-center gap-1 mb-2 transition-colors">
          <ChevronLeft size={12} /> {t('backToCenter')}
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">{t('eyebrow')}</p>
            <h1 className="text-white text-3xl font-semibold">{t('title')}</h1>
            <p className="text-xs text-zinc-600 mt-1">
              {actions.length > 0 ? t('executionsCount', { count: actions.length }) : t('summaryEmpty')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AccountSelector compact hideWhenEmpty />
            <button onClick={load} disabled={loading}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              style={{ background: '#18181b', color: 'var(--text)', border: '1px solid #27272a' }}>
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> {t('reload')}
            </button>
          </div>
        </div>
      </div>

      {loading && actions.length === 0 ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-xs"
          style={{ background: '#111114', border: '1px solid #1a1a1f' }}>{t('loading')}</div>
      ) : actions.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <p className="text-zinc-400 text-sm">{t('empty.title')}</p>
          <p className="text-zinc-600 text-xs mt-1">
            {t('empty.descPrefix')}{' '}
            <Link href="/dashboard/listings/pricing" className="text-cyan-400 hover:text-cyan-300">{t('empty.descLink')}</Link>
            {' '}{t('empty.descSuffix')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map(a => {
            const meta = STATUS_META[a.status]
            const Icon = meta.icon
            const isOpen = expandedId === a.id
            const progress = a.total_count > 0
              ? Math.round(((a.applied_count + a.failed_count + a.skipped_count) / a.total_count) * 100)
              : 0
            return (
              <div key={a.id} className="rounded-xl overflow-hidden"
                style={{ background: '#111114', border: '1px solid #1a1a1f', borderLeft: `3px solid ${meta.color}` }}>
                <button onClick={() => toggleExpand(a.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-zinc-900/40 transition-colors">
                  <div className="shrink-0 p-2 rounded-lg" style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}>
                    <Icon size={16} style={{ color: meta.color }} className={['executing', 'validating'].includes(a.status) ? 'animate-pulse' : ''} />
                  </div>

                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-zinc-100 font-semibold text-sm">{t(`actionType.${a.action_type}`)}</p>
                      <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
                        style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}>
                        {t(`status.${a.status}`)}
                      </span>
                      <span className="text-[10px] text-zinc-500">{t('mode', { mode: a.apply_mode })}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-500">
                      <span>{t('totalCount', { count: a.total_count })}</span>
                      {a.applied_count > 0 && <span className="text-emerald-400">{t('appliedCount', { count: a.applied_count })}</span>}
                      {a.skipped_count > 0 && <span className="text-amber-400">{t('skippedCount', { count: a.skipped_count })}</span>}
                      {a.failed_count > 0 && <span className="text-rose-400">{t('failedCount', { count: a.failed_count })}</span>}
                      <span className="text-zinc-600">·</span>
                      <span>{new Date(a.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    {/* Progress bar */}
                    {['executing', 'validating', 'partial', 'completed'].includes(a.status) && (
                      <div className="h-1 mt-2 rounded-full overflow-hidden bg-zinc-800/60">
                        <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: meta.color }} />
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-zinc-500">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-zinc-800/60 p-4">
                    {!detail ? (
                      <p className="text-xs text-zinc-500 text-center">{t('loadingDetails')}</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">{t('results')}</p>
                        <div className="max-h-80 overflow-y-auto space-y-1">
                          {detail.results.length === 0 ? (
                            <p className="text-xs text-zinc-500">{t('noResults')}</p>
                          ) : (
                            detail.results.map((r, idx) => {
                              const color = r.status === 'applied' ? '#22c55e' : r.status === 'skipped' ? '#f59e0b' : '#ef4444'
                              return (
                                <div key={idx} className="flex items-center gap-2 text-[11px] py-1 px-2 rounded"
                                  style={{ background: '#0d0d10', border: '1px solid #1a1a1f' }}>
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                                  <span className="font-mono text-zinc-300">{r.item_id_or_task_id}</span>
                                  <span className="text-zinc-600">·</span>
                                  <span style={{ color }}>{t(`resultStatus.${r.status}`)}</span>
                                  {r.new_price != null && (
                                    <span className="text-emerald-400">{r.new_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                  )}
                                  {r.message && <span className="text-zinc-500 italic truncate">{r.message}</span>}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
