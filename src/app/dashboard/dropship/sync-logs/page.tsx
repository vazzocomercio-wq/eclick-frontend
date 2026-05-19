'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, AlertCircle, CheckCircle2, XCircle, Clock, ListFilter } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface SyncLog {
  id: string
  sync_type: string
  source: string | null
  source_file_name: string | null
  products_processed: number
  products_created: number
  products_updated: number
  products_failed: number
  cost_changes_count: number
  stock_changes_count: number
  out_of_stock_skus: string[]
  status: 'running' | 'completed' | 'failed' | 'partial'
  error_message: string | null
  duration_seconds: number | null
  started_at: string
  completed_at: string | null
  suppliers: { id: string; name: string } | null
}

export default function SyncLogsPage() {
  const t = useTranslations('dropship.syncLogs')
  const searchParams = useSearchParams()
  const initialSupplierId = searchParams.get('supplier_id') ?? ''
  const supabase = useMemo(() => createClient(), [])

  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | SyncLog['status']>('all')
  const [supplierFilter] = useState(initialSupplierId)

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}` }
  }, [supabase, t])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (supplierFilter) params.set('supplier_id', supplierFilter)
      const res = await fetch(`${BACKEND}/dropship/sync-logs?${params}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setLogs(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.loadFailed'))
      setLogs([])
    } finally { setLoading(false) }
  }, [getHeaders, filterStatus, supplierFilter, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/dropship" className="text-zinc-500 hover:text-white">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {t('subtitle')}
            {supplierFilter && ` · ${t('filteredByPartner')}`}
          </p>
        </div>
      </div>

      {err && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {err}
        </div>
      )}

      {/* filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
          {(['all', 'running', 'completed', 'partial', 'failed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterStatus === s ? '#00E5FF' : 'transparent',
                color: filterStatus === s ? '#09090b' : '#a1a1aa',
              }}
            >
              {s === 'all' ? t('filter.all') : statusLabel(s, t)}
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1f' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111114', borderBottom: '1px solid #1a1a1f' }}>
              {[t('table.when'), t('table.partner'), t('table.type'), t('table.source'), t('table.processed'), t('table.createdUpdated'), t('table.failures'), t('table.status'), t('table.duration')].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-zinc-500 text-sm">{t('loading')}</td></tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  <ListFilter size={28} className="mx-auto mb-2 text-zinc-700" />
                  {t('empty')}
                  <p className="text-xs mt-1">{t('emptyHint')}</p>
                </td>
              </tr>
            ) : logs.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #1a1a1f' }}>
                <td className="px-4 py-3 text-zinc-300 text-xs">{fmtDateTime(l.started_at)}</td>
                <td className="px-4 py-3 text-white">{l.suppliers?.name ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{syncTypeLabel(l.sync_type, t)}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">
                  {l.source_file_name ?? l.source ?? '—'}
                </td>
                <td className="px-4 py-3 text-zinc-300 text-xs">{l.products_processed}</td>
                <td className="px-4 py-3 text-zinc-300 text-xs">
                  <span style={{ color: '#22c55e' }}>+{l.products_created}</span>
                  {' / '}
                  <span style={{ color: '#fcd34d' }}>~{l.products_updated}</span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: l.products_failed > 0 ? '#f87171' : '#71717a' }}>
                  {l.products_failed}
                </td>
                <td className="px-4 py-3"><StatusPill status={l.status} t={t} /></td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{fmtDuration(l.duration_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────────

function StatusPill({ status, t }: { status: SyncLog['status']; t: ReturnType<typeof useTranslations> }) {
  const c: Record<string, { bg: string; fg: string; key: string; icon: React.ReactNode }> = {
    running:   { bg: 'rgba(0,229,255,0.10)',   fg: '#00E5FF', key: 'statusPill.running',   icon: <Clock size={11} /> },
    completed: { bg: 'rgba(34,197,94,0.10)',   fg: '#22c55e', key: 'statusPill.ok',        icon: <CheckCircle2 size={11} /> },
    partial:   { bg: 'rgba(252,211,77,0.10)',  fg: '#fcd34d', key: 'statusPill.partial',   icon: <AlertCircle size={11} /> },
    failed:    { bg: 'rgba(248,113,113,0.10)', fg: '#f87171', key: 'statusPill.failed',    icon: <XCircle size={11} /> },
  }
  const x = c[status]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: x.bg, color: x.fg, border: `1px solid ${x.fg}33` }}>
      {x.icon}
      {t(x.key)}
    </span>
  )
}

function statusLabel(s: string, t: ReturnType<typeof useTranslations>): string {
  return s === 'running' ? t('statusPill.running')
    : s === 'completed' ? t('statusPill.ok')
    : s === 'partial' ? t('statusPill.partial')
    : s === 'failed' ? t('statusPill.failed')
    : s
}

function syncTypeLabel(type: string, t: ReturnType<typeof useTranslations>): string {
  const keys: Record<string, string> = {
    catalog_full: 'syncType.catalogFull',
    catalog_incremental: 'syncType.catalogIncremental',
    stock: 'syncType.stock',
    cost: 'syncType.cost',
    spreadsheet_import: 'syncType.spreadsheet',
    api_pull: 'syncType.apiPull',
    manual: 'syncType.manual',
  }
  return keys[type] ? t(keys[type]) : type
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDuration(secs: number | null) {
  if (secs == null) return '—'
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}m${s.toString().padStart(2, '0')}s`
}
