'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { Bot, RefreshCw, AlertCircle, Radio, CheckCircle2, Clock } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type VinculoRow = {
  id: string
  listing_id: string
  platform: string
  account_id: string | null
  quantity_per_unit: number
  variation_id: string | null
  listing_title: string | null
  listing_price: number | null
  listing_thumbnail: string | null
  is_active: boolean
}

type StockRow = {
  id: string
  quantity: number
  platform: string | null
  account_id: string | null
  virtual_quantity: number
  min_stock_to_pause: number
  auto_pause_enabled: boolean
}

type ProductRow = {
  id: string
  name: string
  sku: string | null
  cost_price: number | null
  photo_urls: string[] | null
  product_listings: VinculoRow[]
  product_stock: StockRow[]
}

type Movement = {
  id: string
  type: string
  quantity: number
  reason: string | null
  created_at: string
}

type Reservation = {
  id: string
  quantity: number
  reference_type: string
  reference_id: string
  channel: string
  expires_at: string | null
  created_at: string
}

type Distribution = {
  id: string
  channel: string
  account_id: string | null
  distribution_mode: string
  percentage: number | null
  fixed_quantity: number | null
  min_quantity: number
  max_quantity: number | null
  priority: number
  is_active: boolean
}

type ChannelOption = {
  id: string
  name: string
  api_status: 'available' | 'coming_soon' | 'deprecated'
  is_integrated: boolean
  integration_status: 'connected' | 'expired' | 'error' | 'never_connected' | null
}

type FullStockData = {
  physical: number; virtual: number; reserved: number
  safety: number; available: number; total_platform: number
  stock_id: string | null
  safety_mode: string; safety_percentage: number; safety_quantity: number
  reservations: Reservation[]
  distributions: Distribution[]
}

type Toast  = { id: number; msg: string; type: 'success' | 'error' | 'info' }
type Filter = 'all' | 'vinculado' | 'sem_vinculo' | 'kit' | 'variacao'
type PlatformFilter = 'all' | 'mercadolivre' | 'shopee' | 'amazon' | 'magalu'

type PreviewData = {
  id: string; title: string; price: number
  available_quantity: number; thumbnail: string | null; permalink: string; status: string
}

// ── Config ────────────────────────────────────────────────────────────────────

const PLATFORM_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  mercadolivre: { label: 'ML',     color: '#00E5FF', bg: 'rgba(0,229,255,0.1)'  },
  shopee:       { label: 'Shopee', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  amazon:       { label: 'Amazon', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  magalu:       { label: 'Magalu', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
}

const MOV_TYPE_COLOR: Record<string, string> = {
  in:         '#4ade80',
  out:        '#f87171',
  adjustment: '#fbbf24',
  sale:       '#f87171',
  return:     '#4ade80',
  transfer:   '#a78bfa',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number) => v.toLocaleString('pt-BR')

function parseMlbId(input: string): string | null {
  const m = input.match(/MLB-?(\d{6,})/i)
  return m ? `MLB${m[1]}` : null
}

function vinculoBadge(v: VinculoRow) {
  if (v.variation_id)          return { kind: 'variation' as const, qty: 0,                     color: '#00E5FF', bg: 'rgba(0,229,255,0.1)'    }
  if (v.quantity_per_unit > 1) return { kind: 'kit' as const,       qty: v.quantity_per_unit,    color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' }
  return                              { kind: 'simple' as const,    qty: 0,                     color: '#52525b', bg: 'rgba(82,82,91,0.12)'   }
}

function fmtMovDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toasts({ list }: { list: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {list.map(t => (
        <div key={t.id} className="px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
          style={{
            background: t.type === 'error' ? '#1f0d0d' : '#111114',
            border: `1px solid ${t.type === 'error' ? 'rgba(248,113,113,.3)' : t.type === 'success' ? 'rgba(34,197,94,.3)' : 'rgba(0,229,255,.2)'}`,
            color: t.type === 'error' ? '#f87171' : t.type === 'success' ? '#4ade80' : '#00E5FF',
          }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, subColor }: { label: string; value: string; sub?: string; color: string; subColor?: string }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col justify-between min-h-[120px]"
      style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <p className="text-zinc-500 text-xs uppercase tracking-wide">{label}</p>
      <div>
        <p className="text-3xl font-bold leading-none tabular-nums" style={{ color }}>{value}</p>
        {sub && <p className="text-xs mt-2" style={{ color: subColor ?? '#52525b' }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function TooltipInfo({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0"
        style={{ background: '#27272a', color: '#71717a' }}>?</button>
      {show && (
        <div className="absolute left-5 bottom-0 z-50 w-64 p-3 rounded-xl text-[11px] leading-relaxed shadow-2xl"
          style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa' }}>
          {text}
        </div>
      )}
    </span>
  )
}

// ── Add Vínculo Modal ─────────────────────────────────────────────────────────

function AddVinculoModal({
  productId, productName, defaultQty,
  onClose, onSaved, getHeaders,
}: {
  productId: string; productName: string; defaultQty?: number
  onClose: () => void; onSaved: (v: VinculoRow) => void
  getHeaders: () => Promise<Record<string, string>>
}) {
  const t = useTranslations('catalogo')
  const [input,       setInput]       = useState('')
  const [previewing,  setPreviewing]  = useState(false)
  const [preview,     setPreview]     = useState<PreviewData | null>(null)
  const [previewErr,  setPreviewErr]  = useState<string | null>(null)
  const [qty,         setQty]         = useState(String(defaultQty ?? 1))
  const [variationId, setVariationId] = useState('')
  const [accountId,   setAccountId]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function buscar() {
    const mlbId = parseMlbId(input)
    if (!mlbId) { setPreviewErr(t('links.modal.invalidId')); return }
    setPreviewing(true); setPreviewErr(null); setPreview(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/vinculos/preview?listing_id=${mlbId}`, { headers })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? `HTTP ${res.status}`) }
      setPreview(await res.json())
    } catch (e: unknown) {
      setPreviewErr(e instanceof Error ? e.message : t('links.modal.fetchError'))
    } finally { setPreviewing(false) }
  }

  async function handleSave() {
    if (!preview) return
    setSaving(true); setError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/products/vinculos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id:        productId,
          platform:          'mercadolivre',
          listing_id:        preview.id,
          quantity_per_unit: Number(qty) || 1,
          variation_id:      variationId.trim() || null,
          account_id:        accountId.trim()   || null,
          listing_title:     preview.title,
          listing_price:     preview.price,
          listing_thumbnail: preview.thumbnail,
          listing_permalink: preview.permalink,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
      onSaved(data as VinculoRow)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('links.modal.linkError'))
    } finally { setSaving(false) }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none transition-colors focus:border-[#00E5FF] placeholder-zinc-600'
  const lbl = 'block text-xs text-zinc-400 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.75)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: '#111114', border: '1px solid #27272a' }}>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div>
            <h2 className="text-white text-sm font-semibold">{t('links.modal.title')}</h2>
            <p className="text-zinc-500 text-[11px] mt-0.5 truncate max-w-[300px]">{productName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* MLB input */}
          <div>
            <label className={lbl}>{t('links.modal.idOrUrlLabel')}</label>
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscar()}
                placeholder={t('links.modal.idOrUrlPlaceholder')}
                className={inp + ' flex-1'} />
              <button onClick={buscar} disabled={!input.trim() || previewing}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50 shrink-0"
                style={{ background: '#00E5FF', color: '#000' }}>
                {previewing ? '…' : t('links.modal.search')}
              </button>
            </div>
            {previewErr && <p className="text-[11px] text-red-400 mt-1">{previewErr}</p>}
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-xl p-3 flex gap-3" style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>
              {preview.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.thumbnail} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" style={{ border: '1px solid #27272a' }} />
              )}
              <div className="min-w-0">
                <p className="text-zinc-100 text-xs font-medium line-clamp-2 leading-snug">{preview.title}</p>
                <p className="text-[#00E5FF] font-semibold text-sm mt-1">{brl(preview.price)}</p>
                <p className="text-zinc-500 text-[10px] mt-0.5">
                  {t('links.modal.stockLabel')} {preview.available_quantity} · {preview.id}
                  {preview.status !== 'active' && (
                    <span className="ml-1 text-yellow-400">({preview.status})</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{t('links.modal.qtyPerListing')}</label>
              <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} className={inp} />
              <p className="text-[10px] text-zinc-600 mt-1">
                {Number(qty) > 1 ? t('links.modal.kitHint', { qty }) : t('links.modal.individualSale')}
              </p>
            </div>
            <div>
              <label className={lbl}>{t('links.modal.variationLabel')}</label>
              <input value={variationId} onChange={e => setVariationId(e.target.value)}
                placeholder={t('links.modal.variationPlaceholder')} className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>{t('links.modal.accountLabel')}</label>
              <input value={accountId} onChange={e => setAccountId(e.target.value)}
                placeholder={t('links.modal.accountPlaceholder')} className={inp} />
            </div>
          </div>

          {error && <p className="text-[11px] text-red-400 bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
            style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
            {t('links.modal.cancel')}
          </button>
          <button onClick={handleSave} disabled={!preview || saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving ? t('links.modal.linking') : t('links.modal.link')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stock Panel ───────────────────────────────────────────────────────────────

function StockPanel({
  product, onClose, getHeaders, onUpdated, onSettingsSaved,
}: {
  product: ProductRow; onClose: () => void
  getHeaders: () => Promise<Record<string, string>>
  onUpdated: (productId: string, newQty: number) => void
  onSettingsSaved: (productId: string, updates: Partial<StockRow>) => void
}) {
  const t = useTranslations('catalogo')
  const TOOLTIP_VIRTUAL = t('links.stock.tooltipVirtual')
  const TOOLTIP_MINPAUSE = t('links.stock.tooltipMinPause')
  const supabase = useMemo(() => createClient(), [])
  const [movements,      setMovements]      = useState<Movement[]>([])
  const [movLoading,     setMovLoading]     = useState(true)

  // Movement modal
  const [movModalOpen,   setMovModalOpen]   = useState(false)
  const [adjType,        setAdjType]        = useState<'in' | 'out' | 'adjustment'>('adjustment')
  const [adjQty,         setAdjQty]         = useState('')
  const [adjReason,      setAdjReason]      = useState('')
  const [adjSaving,      setAdjSaving]      = useState(false)
  const [adjError,       setAdjError]       = useState<string | null>(null)

  // Editable fields (saved together via "Salvar tudo")
  const [virtualQty,     setVirtualQty]     = useState('0')
  const [minPause,       setMinPause]       = useState('0')
  const [autoPause,      setAutoPause]      = useState(false)
  const [safetyMode,     setSafetyMode]     = useState<'percentage' | 'fixed'>('percentage')
  const [safetyPct,      setSafetyPct]      = useState('10')
  const [safetyQty,      setSafetyQty]      = useState('0')

  // Unified save state
  const [savingAll,      setSavingAll]      = useState(false)
  const [savedAll,       setSavedAll]       = useState(false)
  const [saveErr,        setSaveErr]        = useState<string | null>(null)

  // Full stock data
  const [fullStock,      setFullStock]      = useState<FullStockData | null>(null)
  const [fullLoading,    setFullLoading]    = useState(false)

  // Channel distribution
  const [distributions,  setDistributions]  = useState<Distribution[]>([])
  const [distOpen,       setDistOpen]       = useState(true)
  const [newDistForm,    setNewDistForm]    = useState(false)
  const [channelOpts,    setChannelOpts]    = useState<ChannelOption[]>([])
  const [distChannel,    setDistChannel]    = useState('')
  const [distType,       setDistType]       = useState<'percentage' | 'fixed'>('percentage')
  const [distValue,      setDistValue]      = useState('')
  const [distMin,        setDistMin]        = useState('0')
  const [distMax,        setDistMax]        = useState('')
  const [savingDist,     setSavingDist]     = useState(false)
  const [distErr,        setDistErr]        = useState<string | null>(null)
  const [forceSyncing,   setForceSyncing]   = useState(false)
  const [forceSyncMsg,   setForceSyncMsg]   = useState<string | null>(null)

  // Auto distribution mode
  type AutoCheck = {
    can_use: boolean; reason?: string
    ready_channels: string[]; missing_integration: string[]; missing_sales_data: string[]
  }
  type AutoPreview = { ok: boolean; message?: string; distribution?: { channel: string; percentage: number }[] }
  type RecalcLog = {
    id: string; triggered_by: string; applied: boolean; created_at: string
    channels_considered: { channel: string; percentage: number }[] | null
    channels_skipped:    { channel?: string; reason?: string }[] | null
    result: { channel: string; old_pct: number; new_pct: number }[] | null
  }
  const [autoModalOpen,  setAutoModalOpen]  = useState(false)
  const [autoCheck,      setAutoCheck]      = useState<AutoCheck | null>(null)
  const [autoPreview,    setAutoPreview]    = useState<AutoPreview | null>(null)
  const [autoLoading,    setAutoLoading]    = useState(false)
  const [autoApplying,   setAutoApplying]   = useState(false)
  const [autoMsg,        setAutoMsg]        = useState<string | null>(null)
  const [historyOpen,    setHistoryOpen]    = useState(false)
  const [historyLogs,    setHistoryLogs]    = useState<RecalcLog[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const sharedStock = product.product_stock.find(s => s.platform === null) ?? null
  const physicalQty = sharedStock?.quantity ?? 0

  useEffect(() => {
    if (!sharedStock) return
    setVirtualQty(String(sharedStock.virtual_quantity ?? 0))
    setMinPause(String(sharedStock.min_stock_to_pause ?? 0))
    setAutoPause(sharedStock.auto_pause_enabled ?? false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedStock?.id])

  useEffect(() => {
    setFullLoading(true)
    getHeaders()
      .then(h => fetch(`${BACKEND}/stock/${product.id}/full`, { headers: h }))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        // Normalize array fields up front so downstream .filter/.map can't crash
        // when the backend returns null for these collections.
        const safe: FullStockData = {
          ...d,
          reservations:  Array.isArray(d.reservations)  ? d.reservations  : [],
          distributions: Array.isArray(d.distributions) ? d.distributions : [],
        }
        setFullStock(safe)
        setSafetyMode(d.safety_mode ?? 'percentage')
        setSafetyPct(String(d.safety_percentage ?? 10))
        setSafetyQty(String(d.safety_quantity ?? 0))
        setDistributions(safe.distributions)
        // distOpen stays at its initial value (true) so the section is always
        // expanded when the panel mounts; user can still collapse via chevron.
      })
      .catch(() => {})
      .finally(() => setFullLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  // Channel slugs/labels for the "Adicionar canal" dropdown.
  // Loaded once per panel open, ignored failure (form falls back to empty list
  // and shows "nenhum canal disponível").
  useEffect(() => {
    getHeaders()
      .then(h => fetch(`${BACKEND}/marketplace-channels`, { headers: h }))
      .then(r => r.ok ? r.json() : [])
      .then((rows: ChannelOption[]) => setChannelOpts(rows ?? []))
      .catch(() => setChannelOpts([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setMovLoading(true)
    supabase
      .from('stock_movements')
      .select('id, type, quantity, reason, created_at')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { setMovements((data ?? []) as Movement[]); setMovLoading(false) })
  }, [product.id, supabase])

  const vQty   = Number(virtualQty) || 0
  const mPause = Number(minPause) || 0

  // Saves virtual_quantity + min_stock_to_pause + auto_pause_enabled + safety_*
  // in parallel, then refreshes full stock (which triggers ML sync via backend).
  async function handleSaveAll() {
    if (!sharedStock) return
    setSavingAll(true); setSaveErr(null); setSavedAll(false)
    try {
      const headers = await getHeaders()
      const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

      const stockBody = {
        virtual_quantity:    vQty,
        min_stock_to_pause:  mPause,
        auto_pause_enabled:  autoPause,
      }
      const safetyBody = {
        safety_mode:        safetyMode,
        safety_percentage:  Number(safetyPct) || 10,
        safety_quantity:    Number(safetyQty) || 0,
      }

      const stockReq = fetch(`${BACKEND}/products/stock/${sharedStock.id}`, {
        method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(stockBody),
      })
      const safetyReq = fullStock?.stock_id
        ? fetch(`${BACKEND}/stock/${fullStock.stock_id}/safety`, {
            method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(safetyBody),
          })
        : Promise.resolve(null)

      const [stockRes, safetyRes] = await Promise.all([stockReq, safetyReq])

      if (!stockRes.ok) {
        const d = await stockRes.json().catch(() => ({}))
        throw new Error(d.message ?? t('links.stock.stockHttpError', { status: stockRes.status }))
      }
      if (safetyRes && !safetyRes.ok) {
        const d = await safetyRes.json().catch(() => ({}))
        throw new Error(d.message ?? t('links.stock.bufferHttpError', { status: safetyRes.status }))
      }

      onSettingsSaved(product.id, stockBody)

      // Refresh full stock to get updated calculations
      const updated = await fetch(`${BACKEND}/stock/${product.id}/full`, { headers }).then(r => r.json())
      const safeUpdated: FullStockData = {
        ...updated,
        reservations:  Array.isArray(updated.reservations)  ? updated.reservations  : [],
        distributions: Array.isArray(updated.distributions) ? updated.distributions : [],
      }
      setFullStock(safeUpdated)
      setDistributions(safeUpdated.distributions)

      setSavedAll(true)
      setTimeout(() => setSavedAll(false), 2500)
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : t('links.stock.saveError'))
    } finally { setSavingAll(false) }
  }

  async function handleAdjust() {
    const qty = parseInt(adjQty, 10)
    if (isNaN(qty) || qty <= 0) { setAdjError(t('links.stock.invalidQty')); return }
    setAdjSaving(true); setAdjError(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/products/stock/movement`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, type: adjType, quantity: qty, reason: adjReason || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
      const newQty = adjType === 'adjustment' ? qty : adjType === 'in' ? physicalQty + qty : Math.max(0, physicalQty - qty)
      onUpdated(product.id, newQty)
      const { data: mvs } = await supabase.from('stock_movements').select('id, type, quantity, reason, created_at')
        .eq('product_id', product.id).order('created_at', { ascending: false }).limit(10)
      setMovements((mvs ?? []) as Movement[])
      setMovModalOpen(false); setAdjQty(''); setAdjReason('')
    } catch (e: unknown) {
      setAdjError(e instanceof Error ? e.message : t('links.stock.adjustError'))
    } finally { setAdjSaving(false) }
  }

  async function handleForceSync() {
    setForceSyncing(true); setForceSyncMsg(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/stock/sync/${product.id}`, { method: 'POST', headers })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message ?? `HTTP ${res.status}`)
      }
      setForceSyncMsg('✓ ' + t('links.stock.syncTriggered'))
      setTimeout(() => setForceSyncMsg(null), 2500)
    } catch (e: unknown) {
      setForceSyncMsg(e instanceof Error ? e.message : t('links.stock.syncError'))
    } finally { setForceSyncing(false) }
  }

  async function handleOpenAuto() {
    setAutoModalOpen(true)
    setAutoMsg(null)
    setAutoCheck(null)
    setAutoPreview(null)
    setAutoLoading(true)
    try {
      const headers = await getHeaders()
      const checkRes = await fetch(`${BACKEND}/stock/${product.id}/auto-check`, { headers })
      const check = await checkRes.json() as AutoCheck
      setAutoCheck(check)
      if (check.can_use) {
        const previewRes = await fetch(`${BACKEND}/stock/${product.id}/auto-preview`, { headers })
        const preview = await previewRes.json() as AutoPreview
        setAutoPreview(preview)
      }
    } catch (e: unknown) {
      setAutoMsg(e instanceof Error ? e.message : t('links.stock.autoCheckError'))
    } finally { setAutoLoading(false) }
  }

  async function handleApplyAuto() {
    setAutoApplying(true); setAutoMsg(null)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/stock/${product.id}/recalc-auto`, { method: 'POST', headers })
      const data = await res.json() as AutoPreview
      if (!res.ok || !data.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
      setAutoMsg('✓ ' + t('links.stock.distributionApplied'))
      // Refresh distributions in the panel
      const fresh = await fetch(`${BACKEND}/stock/${product.id}/full`, { headers }).then(r => r.json())
      setDistributions(Array.isArray(fresh?.distributions) ? fresh.distributions : [])
      setTimeout(() => { setAutoModalOpen(false); setAutoMsg(null) }, 1500)
    } catch (e: unknown) {
      setAutoMsg(e instanceof Error ? e.message : t('links.stock.applyError'))
    } finally { setAutoApplying(false) }
  }

  async function handleToggleHistory() {
    if (historyOpen) { setHistoryOpen(false); return }
    setHistoryOpen(true)
    if (historyLogs) return
    setHistoryLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/stock/${product.id}/recalc-history`, { headers })
      setHistoryLogs(res.ok ? await res.json() as RecalcLog[] : [])
    } catch { setHistoryLogs([]) } finally { setHistoryLoading(false) }
  }

  async function handleSaveDist() {
    const channelSlug = distChannel.trim().toLowerCase()
    // Validate before POST so we don't trip the channel CHECK constraint on the DB.
    // Channel must be a slug from marketplace_channels (lowercase, no spaces).
    if (!channelSlug)            { setDistErr(t('links.stock.selectChannel')); return }
    if (!/^[a-z0-9_]+$/.test(channelSlug)) { setDistErr(t('links.stock.invalidChannel', { channel: channelSlug })); return }
    if (!['percentage', 'fixed', 'auto'].includes(distType)) { setDistErr(t('links.stock.invalidMode')); return }
    if (!distValue.trim())       { setDistErr(t('links.stock.fillValue')); return }

    setSavingDist(true); setDistErr(null)
    try {
      const headers = await getHeaders()
      const body = {
        product_id:        product.id,
        channel:           channelSlug,            // slug, not label
        distribution_mode: distType,                // matches DB column name
        percentage:        distType === 'percentage' ? Number(distValue) : null,
        fixed_quantity:    distType === 'fixed' ? Number(distValue) : null,
        min_quantity:      Number(distMin) || 0,
        max_quantity:      distMax.trim() ? Number(distMax) : null,
        is_active:         true,
      }
      const res = await fetch(`${BACKEND}/stock/distribution`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message ?? `HTTP ${res.status}`)
      setDistributions(prev => [...prev, d as Distribution])
      setNewDistForm(false); setDistChannel(''); setDistValue(''); setDistMin('0'); setDistMax('')
    } catch (e: unknown) {
      setDistErr(e instanceof Error ? e.message : t('links.stock.distSaveError'))
    } finally { setSavingDist(false) }
  }

  async function handleDeleteDist(id: string) {
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/stock/distribution/${id}`, { method: 'DELETE', headers })
      setDistributions(prev => prev.filter(d => d.id !== id))
    } catch { /* ignore */ }
  }

  async function handleReleaseReservation(id: string) {
    try {
      const headers = await getHeaders()
      await fetch(`${BACKEND}/stock/reservations/${id}/release`, { method: 'POST', headers })
      setFullStock(prev => prev ? { ...prev, reservations: prev.reservations.filter(r => r.id !== id) } : prev)
    } catch { /* ignore */ }
  }

  const inp = 'w-full bg-[#0f0f12] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF] tabular-nums'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-50 flex flex-col w-full max-w-sm overflow-hidden"
        style={{ background: '#111114', borderLeft: '1px solid #1e1e24' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div>
            <h2 className="text-white text-sm font-semibold">{t('links.stock.title')}</h2>
            <p className="text-zinc-500 text-[11px] truncate max-w-[220px]">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* 1. ESTOQUE FÍSICO */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">{t('links.stock.s1Title')}</p>
            {product.product_stock.length === 0 ? (
              <p className="text-zinc-600 text-xs">{t('links.stock.noStockRecord')}</p>
            ) : (
              <div className="space-y-1.5">
                {product.product_stock.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>
                    <span className="text-xs text-zinc-400">
                      {s.platform ? `${s.platform}${s.account_id ? ` · ${s.account_id}` : ''}` : t('links.stock.shared')}
                    </span>
                    <span className="text-sm font-bold text-white tabular-nums">{t('links.stock.units', { qty: num(s.quantity) })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. ESTOQUE VIRTUAL */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{t('links.stock.s2Title')}</p>
              <TooltipInfo text={TOOLTIP_VIRTUAL} />
            </div>
            <div className="relative">
              <input type="number" min={0} value={virtualQty} onChange={e => setVirtualQty(e.target.value)} className={inp} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">{t('links.stock.unitSuffix')}</span>
            </div>
          </div>

          {/* 3. BUFFER DE SEGURANÇA */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">{t('links.stock.s3Title')}</p>
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {(['percentage', 'fixed'] as const).map(m => (
                <button key={m} onClick={() => setSafetyMode(m)}
                  className="py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: safetyMode === m ? 'rgba(0,229,255,0.1)' : '#111114',
                    color: safetyMode === m ? '#00E5FF' : '#71717a',
                    border: `1px solid ${safetyMode === m ? 'rgba(0,229,255,0.3)' : '#27272a'}`,
                  }}>
                  {m === 'percentage' ? t('links.stock.modePercentage') : t('links.stock.modeFixed')}
                </button>
              ))}
            </div>
            {safetyMode === 'percentage' ? (
              <div className="relative">
                <input type="number" min={0} max={100} value={safetyPct}
                  onChange={e => setSafetyPct(e.target.value)} className={inp} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">%</span>
              </div>
            ) : (
              <div className="relative">
                <input type="number" min={0} value={safetyQty}
                  onChange={e => setSafetyQty(e.target.value)} className={inp} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">{t('links.stock.unitSuffix')}</span>
              </div>
            )}
            {fullStock && (
              <p className="text-[11px] text-zinc-600 mt-1.5">
                {t('links.stock.currentBuffer')} <span className="text-yellow-400 font-semibold">{t('links.stock.units', { qty: num(fullStock.safety) })}</span>
                {safetyMode === 'percentage'
                  ? ` ${t('links.stock.bufferPctHint', { pct: safetyPct, physical: num(fullStock.physical) })}`
                  : ` ${t('links.stock.bufferFixedHint')}`}
              </p>
            )}
          </div>

          {/* 4. ESTOQUE RESERVADO */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">{t('links.stock.s4Title')}</p>
            {fullLoading ? (
              <div className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1a1f' }} />
            ) : !fullStock?.reservations?.length ? (
              <p className="text-zinc-600 text-xs py-1">{t('links.stock.noReservations')}</p>
            ) : (
              <div className="space-y-1.5">
                {fullStock.reservations.map(r => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)' }}>
                      {r.reference_type}
                    </span>
                    <span className="flex-1 text-[11px] text-zinc-500 truncate">{r.reference_id}</span>
                    <span className="text-[11px] font-bold tabular-nums text-yellow-400 shrink-0">{t('links.stock.units', { qty: num(r.quantity) })}</span>
                    <button onClick={() => handleReleaseReservation(r.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. ESTOQUE DISPONÍVEL PARA VENDA */}
          {fullStock && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.2)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#00E5FF' }}>
                {t('links.stock.s5Title')}
              </p>
              <div className="space-y-1 text-[12px]">
                <div className="flex justify-between text-zinc-400">
                  <span>{t('links.stock.physical')}</span>
                  <span className="tabular-nums">{num(fullStock.physical)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>{t('links.stock.plusVirtual')}</span>
                  <span className="tabular-nums">{num(fullStock.virtual)}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>{t('links.stock.minusReserved')}</span>
                  <span className="tabular-nums text-yellow-400">−{num(fullStock.reserved)}</span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>{t('links.stock.minusBuffer')}</span>
                  <span className="tabular-nums text-orange-400">−{num(fullStock.safety)}</span>
                </div>
                <div className="border-t pt-1.5 flex justify-between font-bold" style={{ borderColor: 'rgba(0,229,255,0.2)' }}>
                  <span style={{ color: '#00E5FF' }}>{t('links.stock.equalsAvailable')}</span>
                  <span className="tabular-nums text-xl" style={{ color: '#00E5FF' }}>{num(fullStock.available)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 6. CONFIGURAÇÕES DE PAUSA */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">{t('links.stock.s6Title')}</p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <p className="text-[11px] text-zinc-400">{t('links.stock.minToPause')}</p>
                  <TooltipInfo text={TOOLTIP_MINPAUSE} />
                </div>
                <div className="relative">
                  <input type="number" min={0} value={minPause} onChange={e => setMinPause(e.target.value)} className={inp} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-500">{t('links.stock.unitSuffix')}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <p className="text-sm text-zinc-300">{t('links.stock.pauseAuto')}</p>
                <button onClick={() => setAutoPause(p => !p)}
                  className="relative w-10 h-5 rounded-full transition-colors shrink-0"
                  style={{ background: autoPause ? '#00E5FF' : '#27272a' }}>
                  <span className="absolute top-0.5 transition-all w-4 h-4 rounded-full shadow"
                    style={{ left: autoPause ? '1.25rem' : '0.125rem', background: autoPause ? '#000' : '#71717a' }} />
                </button>
              </div>
            </div>
          </div>

          {/* 7. DISTRIBUIÇÃO POR CANAL (colapsável) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setDistOpen(o => !o)}
                className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors">
                <span>{distOpen ? '▾' : '▸'}</span>
                <span>{t('links.stock.s7Title')}</span>
                {distributions.length === 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold animate-pulse normal-case tracking-normal"
                    style={{ background: 'rgba(251,146,60,0.15)', color: '#fdba74', border: '1px solid rgba(251,146,60,0.3)' }}>
                    <AlertCircle size={10} /> {t('links.stock.configure')}
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-600 normal-case tracking-normal">
                    · {t('links.stock.channelCount', { count: distributions.length })}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-1.5">
                <button onClick={handleOpenAuto}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-semibold transition-all"
                  style={{ background: 'rgba(0,229,255,0.06)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                  <Bot size={11} /> {t('links.stock.auto')}
                </button>
                <button onClick={handleForceSync} disabled={forceSyncing}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-semibold transition-all disabled:opacity-50"
                  style={{ background: '#1a1a1f', color: '#a1a1aa', border: '1px solid #27272a' }}>
                  <RefreshCw size={10} className={forceSyncing ? 'animate-spin' : ''} />
                  {forceSyncing ? t('links.stock.syncing') : t('links.stock.forceSync')}
                </button>
              </div>
            </div>
            {forceSyncMsg && (
              <p className={`text-[11px] mb-2 ${forceSyncMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{forceSyncMsg}</p>
            )}
            {distOpen && (
              <div className="space-y-1.5">
                {distributions.length === 0 && !newDistForm && (
                  <div className="rounded-xl p-6 text-center"
                    style={{ background: '#0d0d10', border: '1px dashed #2a2a3f' }}>
                    <div className="flex justify-center mb-2"><Radio size={32} style={{ color: '#3f3f46' }} /></div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      {t('links.stock.emptyDistTitle')}
                    </h4>
                    <p className="text-[11px] text-zinc-500 mb-4 max-w-sm mx-auto leading-relaxed">
                      {t('links.stock.emptyDistText')}
                    </p>
                    <button onClick={() => setNewDistForm(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: '#00E5FF', color: '#000' }}>
                      <span className="text-base leading-none">+</span>
                      {t('links.stock.addFirstChannel')}
                    </button>
                  </div>
                )}
                {distributions.map(d => (
                  <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: '#00E5FF', background: 'rgba(0,229,255,0.1)' }}>
                      {d.channel}{d.account_id ? ` · ${d.account_id}` : ''}
                    </span>
                    <span className="flex-1 text-[11px] text-zinc-400 tabular-nums">
                      {d.distribution_mode === 'percentage'
                        ? `${d.percentage}%`
                        : d.distribution_mode === 'auto'
                          ? <span className="inline-flex items-center gap-1">{d.percentage}% <Bot size={10} style={{ color: '#00E5FF' }} /></span>
                          : t('links.stock.units', { qty: num(d.fixed_quantity ?? 0) })}
                      {d.min_quantity > 0 && <span className="text-zinc-600"> {t('links.stock.minShort', { qty: d.min_quantity })}</span>}
                      {d.max_quantity != null && <span className="text-zinc-600"> {t('links.stock.maxShort', { qty: d.max_quantity })}</span>}
                    </span>
                    <span className="shrink-0 text-[10px]" style={{ color: d.is_active ? '#4ade80' : '#71717a' }}>
                      {d.is_active ? '●' : '○'}
                    </span>
                    <button onClick={() => handleDeleteDist(d.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {/* When form is closed AND there are existing channels →
                    small "+ add another" button (empty state above has its
                    own CTA when no channels). When form is open → render it. */}
                {!newDistForm && distributions.length > 0 && (
                  <button onClick={() => setNewDistForm(true)}
                    className="w-full text-[11px] py-2 rounded-lg font-semibold transition-all"
                    style={{ background: 'rgba(0,229,255,0.06)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.15)' }}>
                    + {t('links.stock.addChannel')}
                  </button>
                )}
                {newDistForm && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['percentage', 'fixed'] as const).map(m => (
                        <button key={m} onClick={() => setDistType(m)}
                          className="py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                          style={{
                            background: distType === m ? 'rgba(0,229,255,0.1)' : '#111114',
                            color: distType === m ? '#00E5FF' : '#71717a',
                            border: `1px solid ${distType === m ? 'rgba(0,229,255,0.3)' : '#27272a'}`,
                          }}>
                          {m === 'percentage' ? t('links.stock.modePercentage') : t('links.stock.modeFixed')}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{t('links.stock.channel')}</label>
                      <div className="space-y-1.5">
                        {channelOpts.map(ch => {
                          const isSelected   = distChannel === ch.id
                          const isComingSoon = ch.api_status === 'coming_soon'
                          const isIntegrated = ch.is_integrated && ch.integration_status === 'connected'
                          const subLabel     = isIntegrated ? t('links.stock.integratedReady')
                                              : isComingSoon ? t('links.stock.comingSoon')
                                              : t('links.stock.notIntegrated')
                          return (
                            <button key={ch.id} type="button" disabled={isComingSoon}
                              onClick={() => setDistChannel(ch.id)}
                              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all disabled:cursor-not-allowed"
                              style={{
                                background: isSelected ? 'rgba(0,229,255,0.06)' : '#0d0d10',
                                borderColor: isSelected ? '#00E5FF' : isComingSoon ? '#1a1a1f' : '#1a1a1f',
                                opacity:     isComingSoon ? 0.5 : 1,
                              }}>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all"
                                  style={{
                                    background: isSelected ? '#00E5FF' : '#1a1a1f',
                                    color:      isSelected ? '#000'    : '#a1a1aa',
                                  }}>
                                  {ch.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="text-left">
                                  <p className="text-[13px] font-medium" style={{ color: isSelected ? '#fff' : '#d4d4d8' }}>
                                    {ch.name}
                                  </p>
                                  <p className="text-[10px] text-zinc-500">{subLabel}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isIntegrated && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
                                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#4ade80' }}>
                                      {t('links.stock.connected')}
                                    </span>
                                  </div>
                                )}
                                {!isIntegrated && !isComingSoon && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#fb923c' }} />
                                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#fb923c' }}>
                                      {t('links.stock.disconnected')}
                                    </span>
                                  </div>
                                )}
                                {isComingSoon && (
                                  <div className="flex items-center gap-1.5">
                                    <Clock size={10} style={{ color: '#71717a' }} />
                                    <span className="text-[10px] uppercase tracking-wider font-medium text-zinc-500">
                                      {t('links.stock.comingSoon')}
                                    </span>
                                  </div>
                                )}
                                {isSelected && <CheckCircle2 size={16} style={{ color: '#00E5FF' }} className="ml-1" />}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      {distChannel && (
                        <p className="text-[11px] text-zinc-500">
                          {channelOpts.find(c => c.id === distChannel)?.is_integrated
                            ? t('links.stock.channelIntegratedHint')
                            : t('links.stock.channelNotIntegratedHint')}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="block text-[10px] text-zinc-500 mb-1">
                          {distType === 'percentage' ? '%' : t('links.stock.qtyShort')}
                        </label>
                        <input type="number" min={0} value={distValue} onChange={e => setDistValue(e.target.value)} className={inp} />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">{t('links.stock.minLabel')}</label>
                        <input type="number" min={0} value={distMin} onChange={e => setDistMin(e.target.value)} className={inp} />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-500 mb-1">{t('links.stock.maxLabel')}</label>
                        <input type="number" min={0} value={distMax} onChange={e => setDistMax(e.target.value)}
                          placeholder="∞" className={inp} />
                      </div>
                    </div>
                    {distErr && <p className="text-[11px] text-red-400">{distErr}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => { setNewDistForm(false); setDistErr(null) }}
                        className="flex-1 py-2 rounded-lg text-xs text-zinc-400 transition-colors hover:text-white"
                        style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
                        {t('links.stock.cancel')}
                      </button>
                      <button onClick={handleSaveDist} disabled={savingDist}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                        style={{ background: '#00E5FF', color: '#000' }}>
                        {savingDist ? t('links.stock.saving') : t('links.stock.add')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 8. ÚLTIMAS MOVIMENTAÇÕES */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">{t('links.stock.s8Title')}</p>
            {movLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: '#1a1a1f' }} />)}
              </div>
            ) : movements.length === 0 ? (
              <p className="text-zinc-600 text-xs py-2">{t('links.stock.noMovements')}</p>
            ) : (
              <div className="space-y-1.5">
                {movements.map(mv => {
                  const mvColor = MOV_TYPE_COLOR[mv.type] ?? '#71717a'
                  const mvLabel = MOV_TYPE_COLOR[mv.type] ? t(`links.stock.movType.${mv.type}`) : mv.type
                  const sign = mv.type === 'in' || mv.type === 'return' ? '+' : mv.type === 'adjustment' ? '→' : '-'
                  return (
                    <div key={mv.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: mvColor, background: `${mvColor}15` }}>{mvLabel}</span>
                      <span className="flex-1 text-[11px] text-zinc-500 truncate">{mv.reason ?? '—'}</span>
                      <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color: mvColor }}>
                        {sign}{num(mv.quantity)}
                      </span>
                      <span className="text-[10px] text-zinc-600 shrink-0">{fmtMovDate(mv.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-5 py-3 space-y-2" style={{ borderTop: '1px solid #1e1e24', background: '#0f0f12' }}>
          {saveErr && <p className="text-[11px] text-red-400">{saveErr}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setMovModalOpen(true); setAdjError(null) }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: '#1a1a1f', color: '#a1a1aa', border: '1px solid #27272a' }}>
              {t('links.stock.move')}
            </button>
            <button onClick={handleSaveAll} disabled={savingAll || !sharedStock}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: savedAll ? 'rgba(74,222,128,0.1)' : '#00E5FF',
                color: savedAll ? '#4ade80' : '#000',
                border: `1px solid ${savedAll ? 'rgba(74,222,128,0.2)' : '#00E5FF'}`,
              }}>
              {savingAll ? t('links.stock.saving') : savedAll ? '✓ ' + t('links.stock.saved') : t('links.stock.saveAll')}
            </button>
          </div>
        </div>
      </div>

      {/* Auto distribution modal */}
      {autoModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => !autoApplying && setAutoModalOpen(false)}>
          <div className="rounded-xl p-5 w-full max-w-md space-y-4"
            style={{ background: '#111114', border: '1px solid #27272a' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500"><Bot size={12} /> {t('links.stock.autoModalTitle')}</p>
              <button onClick={() => setAutoModalOpen(false)} className="text-zinc-600 hover:text-white">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {autoLoading && <p className="text-zinc-500 text-xs">{t('links.stock.checking')}</p>}

            {!autoLoading && autoCheck && !autoCheck.can_use && (
              <div className="space-y-2">
                <div className="rounded-lg p-3" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <p className="text-red-400 text-xs font-semibold">{t('links.stock.autoUnavailable')}</p>
                  <p className="text-zinc-400 text-[11px] mt-1">{autoCheck.reason}</p>
                </div>
                {autoCheck.missing_integration.length > 0 && (
                  <div className="text-[11px]">
                    <p className="text-zinc-500">{t('links.stock.missingIntegration')}</p>
                    <ul className="text-yellow-400 mt-1 space-y-0.5">
                      {autoCheck.missing_integration.map(c => <li key={c}>• {c}</li>)}
                    </ul>
                  </div>
                )}
                {autoCheck.missing_sales_data.length > 0 && (
                  <div className="text-[11px]">
                    <p className="text-zinc-500">{t('links.stock.missingSalesData')}</p>
                    <ul className="text-zinc-400 mt-1 space-y-0.5">
                      {autoCheck.missing_sales_data.map(c => <li key={c}>• {c}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-zinc-500 text-[11px] pt-2">
                  {t.rich('links.stock.useModeMeanwhile', {
                    pct: (chunks) => <span className="text-zinc-300 font-semibold">{chunks}</span>,
                    fix: (chunks) => <span className="text-zinc-300 font-semibold">{chunks}</span>,
                  })}
                </p>
              </div>
            )}

            {!autoLoading && autoCheck?.can_use && autoPreview?.distribution && (
              <div className="space-y-3">
                <p className="text-zinc-400 text-xs">
                  {t.rich('links.stock.basedOnSales', {
                    b: (chunks) => <span className="text-zinc-200 font-semibold">{chunks}</span>,
                  })}
                </p>
                <div className="space-y-1.5">
                  {autoPreview.distribution.map(d => (
                    <div key={d.channel} className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                        style={{ color: '#00E5FF', background: 'rgba(0,229,255,0.1)' }}>{d.channel}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: '#00E5FF' }}>{d.percentage}%</span>
                    </div>
                  ))}
                </div>
                {autoMsg && (
                  <p className={`text-[11px] ${autoMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{autoMsg}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setAutoModalOpen(false)} disabled={autoApplying}
                    className="flex-1 py-2 rounded-lg text-xs text-zinc-400 transition-colors hover:text-white disabled:opacity-50"
                    style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
                    {t('links.stock.cancel')}
                  </button>
                  <button onClick={handleApplyAuto} disabled={autoApplying}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                    style={{ background: '#00E5FF', color: '#000' }}>
                    <RefreshCw size={12} className={autoApplying ? 'animate-spin' : ''} />
                    {autoApplying ? t('links.stock.applying') : t('links.stock.recalcNow')}
                  </button>
                </div>
              </div>
            )}

            {!autoLoading && autoMsg && !autoCheck && (
              <p className="text-red-400 text-[11px]">{autoMsg}</p>
            )}

            <div className="pt-3" style={{ borderTop: '1px solid #1e1e24' }}>
              <button onClick={handleToggleHistory}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5">
                <span>{historyOpen ? '▾' : '▸'}</span>
                <span>📜 {t('links.stock.viewRecalcs')}</span>
              </button>
              {historyOpen && (
                <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto">
                  {historyLoading && <p className="text-zinc-600 text-[11px]">{t('links.stock.loading')}</p>}
                  {!historyLoading && (!historyLogs || historyLogs.length === 0) && (
                    <p className="text-zinc-600 text-[11px]">{t('links.stock.noRecalcs')}</p>
                  )}
                  {historyLogs?.map(log => (
                    <div key={log.id} className="px-3 py-2 rounded-lg text-[11px]"
                      style={{ background: '#0c0c10', border: '1px solid #1e1e24' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                        <span className="text-[10px]" style={{ color: log.applied ? '#4ade80' : '#f87171' }}>
                          {log.applied ? '✓ ' + t('links.stock.applied') : '✗ ' + t('links.stock.skip')} · {log.triggered_by}
                        </span>
                      </div>
                      {log.applied && log.result?.length ? (
                        <div className="text-zinc-400 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                          {log.result.map(r => (
                            <span key={r.channel} className="tabular-nums">
                              <span className="text-zinc-500">{r.channel}:</span> {r.old_pct}% → {r.new_pct}%
                            </span>
                          ))}
                        </div>
                      ) : log.channels_skipped?.[0]?.reason ? (
                        <p className="text-yellow-400 mt-0.5">{log.channels_skipped[0].reason}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Movement modal */}
      {movModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => !adjSaving && setMovModalOpen(false)}>
          <div className="rounded-xl p-5 w-full max-w-sm space-y-3"
            style={{ background: '#111114', border: '1px solid #27272a' }}
            onClick={e => e.stopPropagation()}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{t('links.movModal.title')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['adjustment', 'in', 'out'] as const).map(mt => (
                <button key={mt} onClick={() => setAdjType(mt)}
                  className="py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={{
                    background: adjType === mt ? (mt === 'in' ? 'rgba(74,222,128,0.1)' : mt === 'out' ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)') : '#0c0c10',
                    color:      adjType === mt ? (mt === 'in' ? '#4ade80'              : mt === 'out' ? '#f87171'             : '#fbbf24')             : '#71717a',
                    border:     `1px solid ${adjType === mt ? (mt === 'in' ? 'rgba(74,222,128,0.3)' : mt === 'out' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)') : '#27272a'}`,
                  }}>
                  {mt === 'adjustment' ? '= ' + t('links.movModal.adjustment') : mt === 'in' ? '+ ' + t('links.movModal.in') : '- ' + t('links.movModal.out')}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">
                {adjType === 'adjustment' ? t('links.movModal.newTotalQty') : t('links.movModal.quantity')}
              </label>
              <input type="number" min={1} value={adjQty} onChange={e => setAdjQty(e.target.value)}
                placeholder="0" className={inp} autoFocus />
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">{t('links.movModal.reasonLabel')}</label>
              <input value={adjReason} onChange={e => setAdjReason(e.target.value)}
                placeholder={t('links.movModal.reasonPlaceholder')}
                className="w-full bg-[#0c0c10] border border-[#27272a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#00E5FF]" />
            </div>
            {adjError && <p className="text-[11px] text-red-400">{adjError}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setMovModalOpen(false); setAdjError(null) }}
                disabled={adjSaving}
                className="flex-1 py-2 rounded-lg text-xs text-zinc-400 transition-colors hover:text-white disabled:opacity-50"
                style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
                {t('links.movModal.cancel')}
              </button>
              <button onClick={handleAdjust} disabled={adjSaving || !adjQty}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                style={{ background: '#00E5FF', color: '#000' }}>
                {adjSaving ? t('links.movModal.saving') : t('links.movModal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({
  product, onAddVinculo, onAddKit, onStockPanel, onRemoveVinculo,
}: {
  product: ProductRow
  onAddVinculo: (p: ProductRow) => void
  onAddKit:     (p: ProductRow) => void
  onStockPanel: (p: ProductRow) => void
  onRemoveVinculo: (vinculoId: string, listingId: string, productId: string) => void
}) {
  const t = useTranslations('catalogo')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const thumb = product.photo_urls?.[0] ?? null
  const stock = product.product_stock.find(s => s.platform === null)?.quantity ?? 0

  return (
    <div className="rounded-xl" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      <div className="p-5 flex gap-4">

        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-xl shrink-0 overflow-hidden flex items-center justify-center"
          style={{ background: '#1a1a1f', border: '1px solid #27272a' }}>
          {thumb
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={thumb} alt="" className="w-full h-full object-cover" />
            : <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#3f3f46" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
              </svg>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-zinc-100 text-base font-medium leading-snug truncate">{product.name}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] text-zinc-500">
            {product.sku && (
              <>
                <span>SKU: <span className="text-zinc-400 font-mono">{product.sku}</span></span>
                <span className="text-zinc-700">·</span>
              </>
            )}
            <span>{t('links.card.stock')} <span className="text-zinc-300 font-semibold">{num(stock)}</span></span>
            {product.cost_price != null && product.cost_price > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: '#1a1a1f', border: '1px solid #27272a', color: '#a1a1aa' }}>
                {t('links.card.cost')} {brl(product.cost_price)}
              </span>
            )}
          </div>

          {/* Vinculos list */}
          <div className="mt-3 space-y-1.5">
            {product.product_listings.length === 0 ? (
              <p className="text-[11px] text-zinc-700 italic">{t('links.card.noLinkedListing')}</p>
            ) : (
              product.product_listings.map(v => {
                const pb  = PLATFORM_BADGE[v.platform] ?? { label: v.platform, color: '#71717a', bg: 'rgba(113,113,122,0.1)' }
                const vb  = vinculoBadge(v)
                const vbLabel = vb.kind === 'kit' ? t('links.card.kitBadge', { qty: vb.qty }) : t(`links.card.badge.${vb.kind}`)
                const isConfirm = confirmId === v.id
                const mlUrl = v.platform === 'mercadolivre' && typeof v.listing_id === 'string' && v.listing_id
                  ? `https://produto.mercadolivre.com.br/${v.listing_id.replace(/^MLB/, 'MLB-')}`
                  : null
                return (
                  <div key={v.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                    style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                    {/* Platform logo / badge */}
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: pb.color, background: pb.bg }}>{pb.label}</span>

                    {/* Listing thumbnail */}
                    {v.listing_thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.listing_thumbnail} alt="" className="w-4 h-4 rounded object-cover shrink-0" />
                    )}

                    {/* Listing id (clickable) + price + type badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {mlUrl ? (
                        <a href={mlUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] font-mono text-zinc-300 hover:text-[#00E5FF] transition-colors">
                          {v.listing_id}
                        </a>
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-400">{v.listing_id}</span>
                      )}
                      {v.listing_price != null && (
                        <span className="text-[11px] text-white font-semibold">{brl(v.listing_price)}</span>
                      )}
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: vb.color, background: vb.bg }}>{vbLabel}</span>
                    </div>

                    {/* Title (grayed, truncated, takes remaining space) */}
                    {v.listing_title && (
                      <p className="text-[11px] text-zinc-600 truncate flex-1 min-w-0">{v.listing_title}</p>
                    )}
                    {!v.listing_title && <div className="flex-1" />}

                    {/* Remove / confirm — always at right edge */}
                    {!isConfirm ? (
                      <button onClick={() => setConfirmId(v.id)}
                        title={t('links.card.removeLink')}
                        className="shrink-0 ml-auto text-zinc-600 hover:text-red-400 transition-colors p-1">
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0 ml-auto">
                        <button onClick={() => setConfirmId(null)}
                          className="text-[10px] px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors">
                          {t('links.card.no')}
                        </button>
                        <button
                          onClick={() => { setConfirmId(null); onRemoveVinculo(v.id, v.listing_id, product.id) }}
                          className="text-[10px] px-2 py-0.5 rounded font-semibold transition-colors"
                          style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                          {t('links.card.remove')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-3 flex flex-wrap items-center gap-2"
        style={{ borderTop: '1px solid #1a1a1f', background: '#0c0c0f' }}>
        <button onClick={() => onAddVinculo(product)}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all hover:brightness-125"
          style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t('links.card.addLink')}
        </button>
        <button onClick={() => onAddKit(product)}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all hover:brightness-125"
          style={{ background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t('links.card.kit')}
        </button>
        <button onClick={() => onStockPanel(product)}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all hover:brightness-125 ml-auto"
          style={{ background: '#1a1a1f', color: '#a1a1aa', border: '1px solid #27272a' }}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t('links.card.stockBtn')}
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VinculosPage() {
  const t = useTranslations('catalogo')
  const supabase = useMemo(() => createClient(), [])

  const [products,     setProducts]     = useState<ProductRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filter,       setFilter]       = useState<Filter>('all')
  const [platFilter,   setPlatFilter]   = useState<PlatformFilter>('all')
  const [toasts,       setToasts]       = useState<Toast[]>([])
  const [modalProduct, setModalProduct] = useState<ProductRow | null>(null)
  const [modalKitQty,  setModalKitQty]  = useState(1)
  const [stockProduct, setStockProduct] = useState<ProductRow | null>(null)
  const tid = { current: 0 }

  function toast(msg: string, type: Toast['type'] = 'info') {
    const id = ++tid.current
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error(t('links.notAuthenticated'))
    return { Authorization: `Bearer ${session.access_token}` }
  }, [supabase, t])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, sku, cost_price, photo_urls,
        product_listings(id, listing_id, platform, account_id, quantity_per_unit,
          variation_id, listing_title, listing_price, listing_thumbnail, is_active),
        product_stock(id, quantity, platform, account_id, virtual_quantity, min_stock_to_pause, auto_pause_enabled)
      `)
      .order('name')
      .limit(200)
    if (error) { toast(t('links.loadError', { msg: error.message }), 'error'); setLoading(false); return }
    // Supabase nested selects return null (not []) when no related rows exist —
    // normalize so downstream .filter/.map/.length never explode.
    const rows = Array.isArray(data) ? data : []
    const safe = rows.map((r: Record<string, unknown>) => ({
      ...r,
      product_listings: Array.isArray(r.product_listings) ? r.product_listings : [],
      product_stock:    Array.isArray(r.product_stock)    ? r.product_stock    : [],
    })) as unknown as ProductRow[]
    setProducts(safe)
    setLoading(false)
  }, [supabase, t])

  useEffect(() => { loadProducts() }, [loadProducts])

  // KPIs
  const kpis = useMemo(() => {
    const total       = products.length
    const vinculados  = products.filter(p => p.product_listings.length > 0).length
    const listingIds  = new Set(products.flatMap(p => p.product_listings.map(v => v.listing_id)))
    const semVinculo  = total - vinculados
    return { total, vinculados, anuncios: listingIds.size, semVinculo }
  }, [products])

  // Filtered list
  const filtered = useMemo(() => {
    let list = products
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q))
    }
    if (filter === 'vinculado')   list = list.filter(p => p.product_listings.length > 0)
    if (filter === 'sem_vinculo') list = list.filter(p => p.product_listings.length === 0)
    if (filter === 'kit')         list = list.filter(p => p.product_listings.some(v => v.quantity_per_unit > 1))
    if (filter === 'variacao')    list = list.filter(p => p.product_listings.some(v => v.variation_id != null))
    if (platFilter !== 'all')     list = list.filter(p => p.product_listings.some(v => v.platform === platFilter))
    return list
  }, [products, search, filter, platFilter])

  function handleVinculoSaved(productId: string, newVinculo: VinculoRow) {
    setProducts(prev => prev.map(p =>
      p.id === productId
        ? { ...p, product_listings: [...p.product_listings, newVinculo] }
        : p
    ))
    setModalProduct(null)
    toast(t('links.linkedSuccess'), 'success')
  }

  async function handleRemoveVinculo(vinculoId: string, listingId: string, productId: string) {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/products/vinculos/${vinculoId}`, { method: 'DELETE', headers })
      if (!res.ok && res.status !== 204) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { message?: string }).message ?? `HTTP ${res.status}`)
      }
      setProducts(prev => prev.map(p =>
        p.id === productId
          ? { ...p, product_listings: p.product_listings.filter(v => v.id !== vinculoId) }
          : p
      ))
      toast(t('links.linkRemoved', { id: listingId }), 'success')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t('links.removeError'), 'error')
    }
  }

  function handleStockUpdated(productId: string, newQty: number) {
    const updater = (p: ProductRow) => p.id !== productId ? p : {
      ...p,
      product_stock: p.product_stock.map(s => s.platform === null ? { ...s, quantity: newQty } : s),
    }
    setProducts(prev => prev.map(updater))
    setStockProduct(prev => prev ? updater(prev) : prev)
    toast(t('links.stockUpdated'), 'success')
  }

  function handleStockSettingsSaved(productId: string, updates: Partial<StockRow>) {
    const updater = (p: ProductRow) => p.id !== productId ? p : {
      ...p,
      product_stock: p.product_stock.map(s => s.platform === null ? { ...s, ...updates } : s),
    }
    setProducts(prev => prev.map(updater))
    setStockProduct(prev => prev ? updater(prev) : prev)
    toast(t('links.stockSettingsSaved'), 'success')
  }

  const FILTER_BTNS: { key: Filter; label: string }[] = [
    { key: 'all',        label: t('links.filter.all')        },
    { key: 'vinculado',  label: t('links.filter.linked')     },
    { key: 'sem_vinculo',label: t('links.filter.unlinked')   },
    { key: 'kit',        label: t('links.filter.kit')        },
    { key: 'variacao',   label: t('links.filter.variation')  },
  ]

  // Platform filter — "Todas" reset + 4 marketplace shortcuts.
  // Removed the generic "Plataforma" label per UX feedback (icons already self-explanatory).
  const PLAT_BTNS: { key: PlatformFilter; label: string }[] = [
    { key: 'all',          label: t('links.filter.allPlatforms') },
    { key: 'mercadolivre', label: 'ML'     },
    { key: 'shopee',       label: 'Shopee' },
    { key: 'amazon',       label: 'Amazon' },
    { key: 'magalu',       label: 'Magalu' },
  ]

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }} className="p-6 space-y-6">
      <Toasts list={toasts} />

      {/* Header */}
      <div>
        <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">{t('links.eyebrow')}</p>
        <h1 className="text-white text-2xl font-semibold">{t('links.title')}</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {t('links.subtitle')}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label={t('links.kpi.totalProducts')}   value={num(kpis.total)}      color="#e4e4e7" />
        <KpiCard label={t('links.kpi.linkedProducts')}  value={num(kpis.vinculados)} color="#4ade80"
          sub={kpis.total > 0 ? t('links.kpi.percentOfCatalog', { pct: Math.round(kpis.vinculados / kpis.total * 100) }) : undefined} />
        <KpiCard label={t('links.kpi.linkedListings')}  value={num(kpis.anuncios)}   color="#00E5FF" />
        <KpiCard label={t('links.kpi.unlinked')}        value={num(kpis.semVinculo)} color={kpis.semVinculo > 0 ? '#f59e0b' : '#22c55e'}
          sub={kpis.semVinculo > 0 ? t('links.kpi.needLink') : t('links.kpi.allLinked')}
          subColor={kpis.semVinculo > 0 ? '#52525b' : '#4ade80'} />
      </div>

      {/* Search + filter groups + reload */}
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('links.searchPlaceholder')}
          className="text-sm px-4 py-2 rounded-xl text-zinc-200 placeholder-zinc-600 outline-none w-64"
          style={{ background: '#111114', border: '1px solid #27272a' }} />

        {/* Group 1: type filters */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          {FILTER_BTNS.map(b => (
            <button key={b.key} onClick={() => setFilter(b.key)}
              className="px-3 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={filter === b.key
                ? { background: '#00E5FF', color: '#000' }
                : { color: '#71717a' }}>
              {b.label}
            </button>
          ))}
        </div>

        {/* Visual separator */}
        <div className="h-6 w-px" style={{ background: '#1e1e24' }} />

        {/* Group 2: platform filters */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
          {PLAT_BTNS.map(b => (
            <button key={b.key} onClick={() => setPlatFilter(b.key)}
              className="px-3 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={platFilter === b.key
                ? { background: '#00E5FF', color: '#000' }
                : { color: '#71717a' }}>
              {b.label}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-zinc-600">
          {t('links.productCount', { count: filtered.length })}
        </span>

        {/* Atualizar — moved to far right, separated from filters */}
        <button onClick={loadProducts}
          className="ml-auto flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl transition-colors hover:text-zinc-300"
          style={{ color: '#a1a1aa', background: '#111114', border: '1px solid #1a1a1f' }}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('links.refresh')}
        </button>
      </div>

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8} className="mb-4 opacity-25">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-sm font-medium text-zinc-500">{t('links.emptyTitle')}</p>
          <p className="text-xs text-zinc-600 mt-1">{t('links.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onAddVinculo={prod => { setModalKitQty(1); setModalProduct(prod) }}
              onAddKit={prod    => { setModalKitQty(2); setModalProduct(prod) }}
              onStockPanel={prod => setStockProduct(prod)}
              onRemoveVinculo={handleRemoveVinculo}
            />
          ))}
        </div>
      )}

      {/* Add vínculo modal */}
      {modalProduct && (
        <AddVinculoModal
          productId={modalProduct.id}
          productName={modalProduct.name}
          defaultQty={modalKitQty}
          onClose={() => setModalProduct(null)}
          onSaved={v => handleVinculoSaved(modalProduct.id, v)}
          getHeaders={getHeaders}
        />
      )}

      {/* Stock panel */}
      {stockProduct && (
        <StockPanel
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          getHeaders={getHeaders}
          onUpdated={(pid, qty) => { handleStockUpdated(pid, qty); setStockProduct(null) }}
          onSettingsSaved={handleStockSettingsSaved}
        />
      )}
    </div>
  )
}
