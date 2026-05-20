'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AccountSelector, { getStoredSellerId } from '@/components/ml/AccountSelector'
import {
  ChevronLeft, RefreshCw, ExternalLink, FileText, AlertTriangle, CheckCircle2, X,
} from 'lucide-react'
import { useToast, ToastViewport } from '@/hooks/useToast'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface FiscalSnap {
  id: string
  ml_item_id: string
  product_id: string | null
  has_ncm: boolean;    ncm_value: string | null
  has_gtin: boolean;   gtin_value: string | null
  has_origin: boolean; origin_value: string | null
  has_cest: boolean;   cest_value: string | null
  has_brand: boolean;  brand_value: string | null
  has_model: boolean;  model_value: string | null
  fiscal_completeness_score: number
  blocks_nfe: boolean
  missing_fields: string[]
  fetched_at: string
}

export default function FiscalPage() {
  const t = useTranslations('listings.fiscal')
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()

  const [rows, setRows]     = useState<FiscalSnap[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [blockedOnly, setBlockedOnly] = useState(true)
  const [fixingItemId, setFixingItemId] = useState<string | null>(null)
  const [fixModal, setFixModal] = useState<{ row: FiscalSnap; values: Record<string, string> } | null>(null)

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
      const sellerQs = sellerId != null ? `&seller_id=${sellerId}` : ''
      const blockedQs = blockedOnly ? '&blocked_only=true' : ''
      const res = await fetch(`${BACKEND}/listings/fiscal?limit=300${sellerQs}${blockedQs}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.loadFailed'), tone: 'error' })
    } finally {
      setLoading(false)
    }
  }, [getHeaders, blockedOnly, toast, t])

  useEffect(() => { load() }, [load])

  const runScan = async () => {
    const sellerId = getStoredSellerId()
    if (sellerId == null) {
      toast({ message: t('errors.selectAccount'), tone: 'error' })
      return
    }
    setScanning(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/scan/fiscal`, {
        method: 'POST', headers, body: JSON.stringify({ seller_id: sellerId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = await res.json()
      toast({ message: t('scanDone', { items: r.items_scanned, tasks: r.tasks_created ?? 0 }), tone: 'success' })
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.generic'), tone: 'error' })
    } finally {
      setScanning(false)
    }
  }

  const applyFix = async () => {
    if (!fixModal) return
    const sellerId = getStoredSellerId()
    if (sellerId == null) { toast({ message: t('errors.noAccount'), tone: 'error' }); return }
    const fixes = Object.entries(fixModal.values)
      .filter(([, v]) => v.trim().length > 0)
      .map(([id, value_name]) => ({ id, value_name: value_name.trim() }))
    if (fixes.length === 0) {
      toast({ message: t('errors.fillField'), tone: 'warn' })
      return
    }
    setFixingItemId(fixModal.row.ml_item_id)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/listings/fiscal/${fixModal.row.ml_item_id}/fix`, {
        method: 'POST', headers, body: JSON.stringify({ seller_id: sellerId, fixes }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`)
      toast({ message: t('attributesApplied', { count: fixes.length }), tone: 'success' })
      setFixModal(null)
      await load()
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : t('errors.generic'), tone: 'error' })
    } finally {
      setFixingItemId(null)
    }
  }

  const totalBlocked = rows.filter(r => r.blocks_nfe).length
  const avgScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.fiscal_completeness_score, 0) / rows.length) : 0

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }} className="p-6 max-w-[1400px] space-y-5">
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
              {rows.length > 0
                ? t('summary', { blocked: totalBlocked, score: avgScore })
                : t('summaryEmpty')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AccountSelector compact hideWhenEmpty />
            <button onClick={runScan} disabled={scanning}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#0d0d10' }}>
              <RefreshCw size={11} className={scanning ? 'animate-spin' : ''} /> {t('runScan')}
            </button>
          </div>
        </div>
      </div>

      {/* Filter */}
      <section className="rounded-xl p-3 flex items-center gap-2 flex-wrap"
        style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
        <button onClick={() => setBlockedOnly(true)}
          className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
          style={blockedOnly
            ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }
            : { background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
          {t('filterBlocked')}
        </button>
        <button onClick={() => setBlockedOnly(false)}
          className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
          style={!blockedOnly
            ? { background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.4)', color: '#00E5FF' }
            : { background: '#0d0d10', border: '1px solid #27272a', color: '#a1a1aa' }}>
          {t('filterAll')}
        </button>
      </section>

      {/* Lista */}
      {loading ? (
        <div className="rounded-xl p-12 text-center text-zinc-500 text-xs"
          style={{ background: '#111114', border: '1px solid #1a1a1f' }}>{t('loading')}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          <CheckCircle2 size={32} className="text-emerald-500/60 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">{blockedOnly ? t('empty.blockedTitle') : t('empty.allTitle')}</p>
          <p className="text-zinc-600 text-xs mt-1">{blockedOnly ? t('empty.blockedDesc') : t('empty.allDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <FiscalCard
              key={r.id}
              row={r}
              fixing={fixingItemId === r.ml_item_id}
              onOpenFix={() => {
                const seed: Record<string, string> = {}
                for (const f of r.missing_fields) seed[f] = ''
                setFixModal({ row: r, values: seed })
              }}
            />
          ))}
        </div>
      )}

      {/* Modal fix */}
      {fixModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setFixModal(null)}>
          <div onClick={e => e.stopPropagation()}
            className="rounded-2xl p-6 max-w-md w-full" style={{ background: '#111114', border: '1px solid #27272a' }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white text-lg font-semibold">{t('modal.title')}</h3>
                <p className="text-zinc-500 text-xs font-mono mt-0.5">{fixModal.row.ml_item_id}</p>
              </div>
              <button onClick={() => setFixModal(null)} className="text-zinc-500 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {fixModal.row.missing_fields.map(field => (
                <div key={field}>
                  <label className="text-xs text-zinc-400 block mb-1">
                    {field}
                    {field === 'NCM'    && <span className="text-zinc-600 ml-1">{t('modal.hintNcm')}</span>}
                    {field === 'GTIN'   && <span className="text-zinc-600 ml-1">{t('modal.hintGtin')}</span>}
                    {field === 'ORIGIN' && <span className="text-zinc-600 ml-1">{t('modal.hintOrigin')}</span>}
                  </label>
                  <input type="text" value={fixModal.values[field] ?? ''}
                    onChange={e => setFixModal(m => m ? { ...m, values: { ...m.values, [field]: e.target.value } } : null)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200" />
                </div>
              ))}
            </div>

            <p className="text-[10px] text-zinc-600 mb-3 leading-relaxed">
              {t('modal.note', { itemId: fixModal.row.ml_item_id })}
            </p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setFixModal(null)}
                className="text-xs px-3 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200">
                {t('modal.cancel')}
              </button>
              <button onClick={applyFix} disabled={fixingItemId !== null}
                className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
                style={{ background: '#00E5FF', color: '#0d0d10' }}>
                {fixingItemId ? t('modal.applying') : t('modal.applyFix')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FiscalCard({ row, fixing, onOpenFix }: { row: FiscalSnap; fixing: boolean; onOpenFix: () => void }) {
  const t = useTranslations('listings.fiscal')
  const scoreColor =
    row.fiscal_completeness_score >= 80 ? '#22c55e' :
    row.fiscal_completeness_score >= 50 ? '#f59e0b' :
    '#ef4444'

  return (
    <div className="rounded-xl p-4"
      style={{
        background: '#111114',
        border: '1px solid #1a1a1f',
        borderLeft: row.blocks_nfe ? '3px solid #ef4444' : '3px solid #22c55e',
      }}>
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {row.blocks_nfe ? (
            <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertTriangle size={16} className="text-rose-400" />
            </div>
          ) : (
            <div className="p-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <FileText size={16} className="text-emerald-400" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <Link href={`/dashboard/listings/items/${row.ml_item_id}`}
              className="font-mono text-zinc-200 font-semibold text-sm hover:text-cyan-400">
              {row.ml_item_id}
            </Link>
            <a href={`https://www.mercadolivre.com.br/${row.ml_item_id}`} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-zinc-500 hover:text-cyan-400 flex items-center gap-1">
              ML <ExternalLink size={9} />
            </a>
            <span className="text-[10px] font-bold tabular-nums" style={{ color: scoreColor }}>
              {t('scoreLabel', { score: row.fiscal_completeness_score })}
            </span>
          </div>

          {row.blocks_nfe && (
            <p className="text-xs text-rose-400 mt-1 font-medium">
              {t('blocksNfe', { fields: row.missing_fields.join(', ') })}
            </p>
          )}

          {/* Grid de atributos */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-2">
            <AttrBadge label="NCM"    ok={row.has_ncm}    value={row.ncm_value} required />
            <AttrBadge label="GTIN"   ok={row.has_gtin}   value={row.gtin_value} required />
            <AttrBadge label="ORIGIN" ok={row.has_origin} value={row.origin_value} required />
            <AttrBadge label="CEST"   ok={row.has_cest}   value={row.cest_value} />
            <AttrBadge label="BRAND"  ok={row.has_brand}  value={row.brand_value} />
            <AttrBadge label="MODEL"  ok={row.has_model}  value={row.model_value} />
          </div>
        </div>

        <div className="shrink-0">
          {row.blocks_nfe && (
            <button onClick={onOpenFix} disabled={fixing}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: '#00E5FF', color: '#0d0d10' }}>
              {fixing ? t('modal.applying') : t('fix')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AttrBadge({ label, ok, value, required }: { label: string; ok: boolean; value: string | null; required?: boolean }) {
  const t = useTranslations('listings.fiscal')
  return (
    <div className="rounded px-2 py-1 text-[10px]"
      style={ok
        ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }
        : required
          ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }
          : { background: '#0d0d10', border: '1px solid #27272a' }}>
      <p className="font-bold tracking-widest uppercase" style={{ color: ok ? '#22c55e' : required ? '#ef4444' : '#71717a' }}>{label}</p>
      <p className="text-zinc-500 truncate" title={value ?? t('emptyValue')}>{value ?? '—'}</p>
    </div>
  )
}
