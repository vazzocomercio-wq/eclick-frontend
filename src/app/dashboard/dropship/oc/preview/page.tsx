'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, AlertCircle, Eye, RefreshCw, Clock, FileText,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface PreviewGroup {
  supplier_id: string
  supplier_name: string
  marketplace: string
  items_count: number
  units_count: number
  gross_total: number
}

interface PreviewResponse {
  groups: PreviewGroup[]
  total_idents: number
}

export default function OCPreviewPage() {
  const t = useTranslations('dropship.ocPreview')
  const supabase = useMemo(() => createClient(), [])

  const [data, setData] = useState<PreviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error(t('errors.notAuthenticated'))
      const res = await fetch(`${BACKEND}/dropship/oc/preview`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.loadFailed'))
    } finally { setLoading(false); setRefreshing(false) }
  }, [supabase, t])

  useEffect(() => { load() }, [load])

  // Auto-refresh a cada 60s
  useEffect(() => {
    const t = setInterval(() => load(true), 60_000)
    return () => clearInterval(t)
  }, [load])

  const groups = data?.groups ?? []
  const totalGross = groups.reduce((s, g) => s + g.gross_total, 0)
  const totalItems = groups.reduce((s, g) => s + g.items_count, 0)
  const totalUnits = groups.reduce((s, g) => s + g.units_count, 0)

  // Tempo restante até próximo cron 22h
  const now = new Date()
  const nextRun = new Date(now)
  nextRun.setHours(22, 0, 0, 0)
  if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1)
  const msUntil = nextRun.getTime() - now.getTime()
  const hoursUntil = Math.floor(msUntil / 3600000)
  const minsUntil = Math.floor((msUntil % 3600000) / 60000)

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--background)', color: '#fff' }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/dropship/oc" className="text-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Eye size={20} style={{ color: '#00E5FF' }} />
              {t('title')}
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg"
          style={{ border: '1px solid #27272a', color: '#a1a1aa' }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {t('refresh')}
        </button>
      </div>

      {err && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          <AlertCircle size={14} className="inline mr-2" />
          {err}
        </div>
      )}

      {/* countdown 22h */}
      <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{
        background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)',
      }}>
        <Clock size={20} style={{ color: '#00E5FF' }} />
        <div className="flex-1">
          <p className="text-sm text-white font-medium">
            {t.rich('countdown', {
              time: `${hoursUntil}h${String(minsUntil).padStart(2, '0')}min`,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t('countdownHint')}
          </p>
        </div>
      </div>

      {/* totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label={t('kpi.expectedOcs')} value={loading ? '…' : groups.length} />
        <Kpi label={t('kpi.orders')} value={loading ? '…' : totalItems} />
        <Kpi label={t('kpi.units')} value={loading ? '…' : totalUnits} />
        <Kpi
          label={t('kpi.estimatedValue')}
          value={loading ? '…' : fmtBrl(totalGross)}
          accent="#00E5FF"
        />
      </div>

      {/* grupos */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        {t('groups')} {groups.length > 0 && `(${groups.length})`}
      </h2>
      {loading ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          {t('loading')}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-sm" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <FileText size={28} className="mx-auto mb-2 text-zinc-700" />
          {t('empty')}
          <p className="text-xs mt-1">
            {t.rich('emptyHint', { code: (chunks) => <code>{chunks}</code> })}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map((g, idx) => (
            <div key={idx} className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">{g.supplier_name}</p>
                  <p className="text-xs text-zinc-500 capitalize">{g.marketplace.replace('_', ' ')}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(0,229,255,0.10)',
                    color: '#00E5FF',
                    border: '1px solid rgba(0,229,255,0.3)',
                  }}>
                  {t('ordersCount', { count: g.items_count })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-500">{t('kpi.units')}</p>
                  <p className="text-sm font-semibold text-white">{g.units_count}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">{t('kpi.estimatedValue')}</p>
                  <p className="text-sm font-semibold text-white">{fmtBrl(g.gross_total)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold" style={{ color: accent ?? '#fff' }}>{value}</p>
    </div>
  )
}

function fmtBrl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
