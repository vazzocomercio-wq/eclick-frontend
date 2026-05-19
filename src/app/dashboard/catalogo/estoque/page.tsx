'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { AlertTriangle, Package, TrendingDown, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Types ─────────────────────────────────────────────────────────────────────

type Product = {
  id: string
  name: string
  sku: string | null
  price: number | null
  stock: number | null
  status: 'draft' | 'active' | 'paused'
  platforms: string[]
  photo_urls: string[] | null
}

type StockRecord = {
  id: string
  product_id: string
  quantity: number
  virtual_quantity: number
  min_stock_to_pause: number | null
  auto_pause_enabled: boolean | null
  updated_at: string
}

type StockRow = {
  product: Product
  stockRecord: StockRecord | null
  qty: number
  virtualQty: number
  platformQty: number
  minStock: number
  autoPause: boolean
  alert: 'zero' | 'critical' | 'low' | 'ok'
}

type MovementType = 'in' | 'out' | 'adjustment'

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

// ── Alert helper ──────────────────────────────────────────────────────────────

function calcAlert(qty: number, min: number): StockRow['alert'] {
  if (qty === 0) return 'zero'
  if (min > 0 && qty <= min) return 'critical'
  if (min > 0 && qty <= min * 1.5) return 'low'
  return 'ok'
}

// ── Alert badge ───────────────────────────────────────────────────────────────

const ALERT_CFG = {
  zero:     { color: '#f87171', bg: 'rgba(248,113,113,0.1)', icon: <XCircle size={11} /> },
  critical: { color: '#fb923c', bg: 'rgba(251,146,60,0.1)', icon: <AlertTriangle size={11} /> },
  low:      { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', icon: <TrendingDown size={11} /> },
  ok:       { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', icon: <CheckCircle2 size={11} /> },
}

function AlertBadge({ alert }: { alert: StockRow['alert'] }) {
  const t = useTranslations('catalogo')
  const c = ALERT_CFG[alert]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30` }}>
      {c.icon} {t(`stock.alert.${alert}`)}
    </span>
  )
}

// ── Stock Adjustment Modal ────────────────────────────────────────────────────

function AdjustModal({ row, onClose, onDone }: {
  row: StockRow
  onClose: () => void
  onDone: () => void
}) {
  const t = useTranslations('catalogo')
  const [type, setType]     = useState<MovementType>('in')
  const [qty, setQty]       = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const previewQty = useMemo(() => {
    const n = parseInt(qty) || 0
    if (type === 'adjustment') return n
    if (type === 'in') return row.qty + n
    return Math.max(0, row.qty - n)
  }, [type, qty, row.qty])

  async function handleSubmit() {
    const n = parseInt(qty)
    if (!n || n <= 0) { setError(t('stock.modal.invalidQty')); return }

    setSaving(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch(`${BACKEND}/products/stock/movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          product_id: row.product.id,
          product_stock_id: row.stockRecord?.id ?? undefined,
          type,
          quantity: n,
          reason: reason.trim() || null,
        }),
      })
      if (!res.ok) { const errText = await res.text(); throw new Error(errText) }
      onDone()
    } catch (e: any) {
      setError(e.message ?? t('stock.modal.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const TYPE_OPTS: { value: MovementType; label: string; color: string }[] = [
    { value: 'in',         label: t('stock.movType.in'),         color: '#4ade80' },
    { value: 'out',        label: t('stock.movType.out'),        color: '#f87171' },
    { value: 'adjustment', label: t('stock.movType.adjustment'), color: '#00E5FF' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: '#111114', border: '1px solid #2e2e33' }}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">{t('stock.modal.title')}</h3>
            <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{row.product.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Type selector */}
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTS.map(opt => (
            <button key={opt.value} onClick={() => setType(opt.value)}
              className="py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: type === opt.value ? `${opt.color}18` : 'rgba(255,255,255,0.04)',
                color: type === opt.value ? opt.color : '#71717a',
                border: `1px solid ${type === opt.value ? opt.color + '40' : '#2e2e33'}`,
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">
            {type === 'adjustment' ? t('stock.modal.newPhysical') : t('stock.modal.quantity')}
          </label>
          <input
            type="number"
            min={0}
            value={qty}
            onChange={e => setQty(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none transition-all"
            style={{ background: '#1c1c1f', border: '1px solid #3f3f46' }}
            onFocus={e => (e.target.style.borderColor = '#00E5FF')}
            onBlur={e => (e.target.style.borderColor = '#3f3f46')}
          />
        </div>

        {/* Preview */}
        {qty && parseInt(qty) > 0 && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)' }}>
            <span className="text-zinc-400">{t('stock.modal.current')} <strong className="text-white">{row.qty}</strong></span>
            <span className="text-zinc-600">→</span>
            <span className="text-zinc-400">{t('stock.modal.new')} <strong style={{ color: '#00E5FF' }}>{previewQty}</strong></span>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1">{t('stock.modal.reasonLabel')}</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={t('stock.modal.reasonPlaceholder')}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none transition-all"
            style={{ background: '#1c1c1f', border: '1px solid #3f3f46' }}
            onFocus={e => (e.target.style.borderColor = '#00E5FF')}
            onBlur={e => (e.target.style.borderColor = '#3f3f46')}
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-semibold text-zinc-400 transition-colors"
            style={{ border: '1px solid #3f3f46' }}>
            {t('stock.modal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-60"
            style={{ background: '#00E5FF', color: '#000' }}>
            {saving ? t('stock.modal.saving') : t('stock.modal.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Min stock inline editor ───────────────────────────────────────────────────

function MinStockCell({ row, onSaved }: { row: StockRow; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(String(row.minStock))
  const [saving, setSaving]   = useState(false)

  async function save() {
    const n = parseInt(val)
    if (isNaN(n) || n < 0) { setEditing(false); return }
    if (n === row.minStock) { setEditing(false); return }
    if (!row.stockRecord) { setEditing(false); return }

    setSaving(true)
    try {
      const token = await getToken()
      await fetch(`${BACKEND}/products/stock/${row.stockRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ min_stock_to_pause: n }),
      })
      onSaved()
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (!row.stockRecord) {
    return <span className="text-zinc-700 text-[11px]">—</span>
  }

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="w-16 rounded px-1.5 py-0.5 text-xs text-white outline-none"
        style={{ background: '#1c1c1f', border: '1px solid #00E5FF' }}
        autoFocus
        disabled={saving}
      />
    )
  }

  return (
    <button onClick={() => { setVal(String(row.minStock)); setEditing(true) }}
      className="text-[11px] text-zinc-400 hover:text-white transition-colors tabular-nums underline decoration-dotted underline-offset-2">
      {row.minStock > 0 ? row.minStock : <span className="text-zinc-700">—</span>}
    </button>
  )
}

// ── Auto-pause toggle ─────────────────────────────────────────────────────────

function AutoPauseToggle({ row, onSaved }: { row: StockRow; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (!row.stockRecord) return
    setBusy(true)
    try {
      const token = await getToken()
      await fetch(`${BACKEND}/products/stock/${row.stockRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ auto_pause_enabled: !row.autoPause }),
      })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  if (!row.stockRecord) return <span className="text-zinc-700 text-[11px]">—</span>

  return (
    <button onClick={toggle} disabled={busy}
      className="relative w-8 h-4 rounded-full transition-all disabled:opacity-50 shrink-0"
      style={{ background: row.autoPause ? '#00E5FF' : '#3f3f46' }}>
      <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
        style={{ left: row.autoPause ? '18px' : '2px' }} />
    </button>
  )
}

// ── Stock detail drawer ───────────────────────────────────────────────────────

type FullStock = {
  physical: number; virtual: number; reserved: number
  safety: number; available: number; total_platform: number
  no_stock_record?: boolean
  distributions: Array<{
    id: string; channel: string; distribution_mode: string | null
    percentage: number | null; fixed_quantity: number | null
    virtual_markup: number | null; min_quantity: number | null
    is_active: boolean; last_published_qty: number | null; last_synced_at: string | null
  }>
}

type Movement = {
  id: string; movement_type: string; quantity: number; balance_after: number
  reference_type: string | null; reference_id: string | null
  notes: string | null; created_at: string
}

const MOV_CFG: Record<string, { color: string; sign: '+' | '-' | '' }> = {
  sale:          { color: '#f87171', sign: '-' },
  sale_reversal: { color: '#4ade80', sign: '+' },
  in:            { color: '#4ade80', sign: '+' },
  out:           { color: '#f87171', sign: '-' },
  adjustment:    { color: '#00E5FF', sign: ''  },
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function ChainLine({ label, value, sign = '', muted = false }: {
  label: string; value: number; sign?: '+' | '-' | ''; muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: muted ? '#71717a' : '#d4d4d8' }}>{label}</span>
      <span className="text-sm tabular-nums" style={{ color: muted ? '#71717a' : '#e4e4e7' }}>{sign}{value}</span>
    </div>
  )
}

function StockDetailDrawer({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const t = useTranslations('catalogo')
  const [full, setFull]       = useState<FullStock | null>(null)
  const [moves, setMoves]     = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const token = await getToken()
        const h = { Authorization: `Bearer ${token}` }
        const [f, m] = await Promise.all([
          fetch(`${BACKEND}/stock/${row.product.id}/full`, { headers: h }),
          fetch(`${BACKEND}/stock/${row.product.id}/movements`, { headers: h }),
        ])
        if (!alive) return
        if (f.ok) setFull(await f.json())
        if (m.ok) setMoves(await m.json())
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [row.product.id])

  const channelLabel = (c: string) =>
    c === 'mercadolivre' ? 'Mercado Livre' : c === 'shopee' ? 'Shopee' : c === 'loja' ? t('stock.drawer.ownStore') : c

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-md h-full overflow-y-auto" style={{ background: '#0d0d10', borderLeft: '1px solid #2e2e33' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4"
          style={{ background: '#0d0d10', borderBottom: '1px solid #1e1e24' }}>
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">{row.product.name}</h3>
            {row.product.sku && <p className="text-zinc-600 text-[11px] font-mono mt-0.5">{row.product.sku}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: '#1a1a1f' }} />
            ))}
          </div>
        ) : (
          <div className="p-5 space-y-6">

            {/* Cadeia do estoque */}
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">{t('stock.drawer.chainTitle')}</p>
              <div className="rounded-xl p-4 space-y-2" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                <ChainLine label={t('stock.drawer.physical')}  value={full?.physical ?? 0} />
                <ChainLine label={t('stock.drawer.virtual')}   value={full?.virtual ?? 0}  sign="+" muted />
                <ChainLine label={t('stock.drawer.reserved')}  value={full?.reserved ?? 0} sign="-" muted />
                <ChainLine label={t('stock.drawer.safety')}    value={full?.safety ?? 0}   sign="-" muted />
                <div className="h-px my-1" style={{ background: '#2e2e33' }} />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">{t('stock.drawer.availableForSale')}</span>
                  <span className="text-xl font-black tabular-nums" style={{ color: '#00E5FF' }}>{full?.available ?? 0}</span>
                </div>
              </div>
              {full?.no_stock_record && (
                <p className="text-[10px] text-amber-400 mt-1.5">{t('stock.drawer.noStockRecord')}</p>
              )}
            </section>

            {/* Distribuição por canal */}
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">{t('stock.drawer.distributionTitle')}</p>
              {full && full.distributions.length > 0 ? (
                <div className="space-y-1.5">
                  {full.distributions.map(d => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                      <div>
                        <p className="text-xs text-zinc-200">{channelLabel(d.channel)}</p>
                        <p className="text-[10px] text-zinc-600">
                          {d.distribution_mode === 'fixed' ? t('stock.drawer.modeFixed', { qty: d.fixed_quantity ?? 0 })
                            : d.distribution_mode === 'auto' ? t('stock.drawer.modeAuto', { pct: d.percentage ?? 0 })
                            : `${d.percentage ?? 100}%`}
                          {d.virtual_markup ? t('stock.drawer.virtualSuffix', { qty: d.virtual_markup }) : ''}
                          {!d.is_active ? t('stock.drawer.inactiveSuffix') : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-zinc-200">{d.last_published_qty ?? 0}</p>
                        <p className="text-[9px] text-zinc-600">{d.last_synced_at ? fmtDateTime(d.last_synced_at) : t('stock.drawer.never')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg px-3 py-2.5 text-[11px] text-zinc-500"
                  style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                  {t('stock.drawer.noDistribution')}
                </div>
              )}
            </section>

            {/* Histórico de movimentos */}
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">{t('stock.drawer.historyTitle')}</p>
              {moves.length === 0 ? (
                <div className="rounded-lg px-3 py-2.5 text-[11px] text-zinc-500"
                  style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                  {t('stock.drawer.noMovements')}
                </div>
              ) : (
                <div className="space-y-1">
                  {moves.map(m => {
                    const cfg = MOV_CFG[m.movement_type] ?? { color: '#a1a1aa', sign: '' as const }
                    const cfgLabel = MOV_CFG[m.movement_type] ? t(`stock.movLabel.${m.movement_type}`) : m.movement_type
                    return (
                      <div key={m.id} className="flex items-center gap-3 rounded-lg px-3 py-2"
                        style={{ background: '#111114', border: '1px solid #1e1e24' }}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfgLabel}</p>
                          <p className="text-[10px] text-zinc-600 truncate">{m.notes ?? '—'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold tabular-nums" style={{ color: cfg.color }}>{cfg.sign}{m.quantity}</p>
                          <p className="text-[9px] text-zinc-600">→ {m.balance_after} · {fmtDateTime(m.created_at)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'zero' | 'critical' | 'low' | 'ok'
type SortKey = 'name' | 'qty' | 'platformQty' | 'alert' | 'minStock'

export default function EstoquePage() {
  const t = useTranslations('catalogo')
  const [rows, setRows]         = useState<StockRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [filter, setFilter]     = useState<FilterKey>('all')
  const [search, setSearch]     = useState('')
  const [sortKey, setSortKey]   = useState<SortKey>('name')
  const [sortAsc, setSortAsc]   = useState(true)
  const [adjusting, setAdjusting] = useState<StockRow | null>(null)
  const [detail, setDetail]       = useState<StockRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const sb    = createClient()

      const [prodRes, { data: stocks }] = await Promise.all([
        fetch(`${BACKEND}/products`, { headers: { Authorization: `Bearer ${token}` } }),
        sb.from('product_stock').select('id,product_id,quantity,virtual_quantity,min_stock_to_pause,auto_pause_enabled,updated_at').is('platform', null),
      ])

      if (!prodRes.ok) throw new Error(t('stock.loadProductsError'))
      const products: Product[] = await prodRes.json()

      const stockMap = new Map<string, StockRecord>()
      for (const s of stocks ?? []) stockMap.set(s.product_id, s as StockRecord)

      const built: StockRow[] = products.map(p => {
        const s   = stockMap.get(p.id) ?? null
        const qty        = s?.quantity         ?? (p.stock ?? 0)
        const virtualQty = s?.virtual_quantity ?? 0
        const minStock   = s?.min_stock_to_pause ?? 0
        return {
          product:      p,
          stockRecord:  s,
          qty,
          virtualQty,
          platformQty:  qty + virtualQty,
          minStock,
          autoPause:    s?.auto_pause_enabled ?? false,
          alert:        calcAlert(qty, minStock),
        }
      })

      setRows(built)
    } catch (e: any) {
      setError(e.message ?? t('stock.loadStockError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total    = rows.length
    const zero     = rows.filter(r => r.alert === 'zero').length
    const critical = rows.filter(r => r.alert === 'critical').length
    const low      = rows.filter(r => r.alert === 'low').length
    const ok       = rows.filter(r => r.alert === 'ok').length
    return { total, zero, critical, low, ok }
  }, [rows])

  // ── Filtered + sorted rows ──────────────────────────────────────────────────

  const visible = useMemo(() => {
    const ALERT_ORDER = { zero: 0, critical: 1, low: 2, ok: 3 }
    let r = rows
    if (filter !== 'all') r = r.filter(row => row.alert === filter)
    const q = search.trim().toLowerCase()
    if (q) r = r.filter(row => row.product.name.toLowerCase().includes(q) || (row.product.sku ?? '').toLowerCase().includes(q))
    return [...r].sort((a, b) => {
      let diff = 0
      if (sortKey === 'name')        diff = a.product.name.localeCompare(b.product.name)
      else if (sortKey === 'qty')    diff = a.qty - b.qty
      else if (sortKey === 'platformQty') diff = a.platformQty - b.platformQty
      else if (sortKey === 'alert')  diff = ALERT_ORDER[a.alert] - ALERT_ORDER[b.alert]
      else if (sortKey === 'minStock') diff = a.minStock - b.minStock
      return sortAsc ? diff : -diff
    })
  }, [rows, filter, search, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  function SortTh({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k
    return (
      <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
        style={{ color: active ? '#00E5FF' : '#52525b' }}
        onClick={() => toggleSort(k)}>
        {label}
        {active && <span className="ml-1">{sortAsc ? <ChevronUp size={10} className="inline" /> : <ChevronDown size={10} className="inline" />}</span>}
      </th>
    )
  }

  const FILTER_PILLS: { key: FilterKey; label: string; count: number; color: string }[] = [
    { key: 'all',      label: t('stock.filter.all'),      count: kpis.total,    color: '#a1a1aa' },
    { key: 'zero',     label: t('stock.filter.zero'),     count: kpis.zero,     color: '#f87171' },
    { key: 'critical', label: t('stock.filter.critical'), count: kpis.critical, color: '#fb923c' },
    { key: 'low',      label: t('stock.filter.low'),      count: kpis.low,      color: '#fbbf24' },
    { key: 'ok',       label: t('stock.filter.ok'),       count: kpis.ok,       color: '#4ade80' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: 'var(--background)' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">{t('stock.eyebrow')}</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">{t('stock.title')}</h2>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {t('stock.refresh')}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('stock.kpi.totalProducts'), value: kpis.total,    color: '#a1a1aa' },
          { label: t('stock.kpi.outOfStock'),    value: kpis.zero,     color: '#f87171' },
          { label: t('stock.kpi.critical'),      value: kpis.critical + kpis.low, color: '#fb923c' },
          { label: t('stock.kpi.healthy'),       value: kpis.ok,       color: '#4ade80' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
            <p className="text-zinc-500 text-[11px] font-medium">{k.label}</p>
            {loading
              ? <div className="h-7 w-12 mt-2 rounded-lg animate-pulse" style={{ background: '#1e1e24' }} />
              : <p className="text-2xl font-black mt-1" style={{ color: k.color }}>{k.value}</p>
            }
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_PILLS.map(pill => (
          <button key={pill.key} onClick={() => setFilter(pill.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: filter === pill.key ? `${pill.color}18` : 'rgba(255,255,255,0.04)',
              color: filter === pill.key ? pill.color : '#71717a',
              border: `1px solid ${filter === pill.key ? pill.color + '40' : '#2e2e33'}`,
            }}>
            {pill.label}
            <span className="px-1 py-0.5 rounded text-[9px]" style={{ background: 'rgba(255,255,255,0.08)' }}>{pill.count}</span>
          </button>
        ))}
        <div className="ml-auto">
          <input
            type="text"
            placeholder={t('stock.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-xs text-white outline-none w-52 transition-all"
            style={{ background: '#1c1c1f', border: '1px solid #3f3f46' }}
            onFocus={e => (e.target.style.borderColor = '#00E5FF')}
            onBlur={e => (e.target.style.borderColor = '#3f3f46')}
          />
        </div>
      </div>

      {/* Table */}
      <section className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#0a0a0d', borderBottom: '1px solid #1e1e24' }}>
                <SortTh k="name"        label={t('stock.col.product')} />
                <SortTh k="qty"         label={t('stock.col.physical')} />
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{t('stock.col.virtual')}</th>
                <SortTh k="platformQty" label={t('stock.col.platform')} />
                <SortTh k="minStock"    label={t('stock.col.minStock')} />
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{t('stock.col.autoPause')}</th>
                <SortTh k="alert"       label={t('stock.col.status')} />
                <th className="px-3 py-2.5 text-[10px] text-zinc-600 font-semibold uppercase tracking-wider">{t('stock.col.action')}</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(6)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e1e24' }}>
                      {[...Array(8)].map((__, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-3 rounded animate-pulse" style={{ background: '#1e1e24', width: j === 0 ? '70%' : '40%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : visible.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <Package size={32} className="mx-auto mb-2 text-zinc-700" />
                        <p className="text-zinc-600 text-sm">{t('stock.empty')}</p>
                      </td>
                    </tr>
                  )
                  : visible.map(row => {
                      const thumb = row.product.photo_urls?.[0] ?? null
                      return (
                        <tr key={row.product.id}
                          style={{ borderBottom: '1px solid #1a1a1f' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                          {/* Produto */}
                          <td className="px-3 py-2.5" style={{ maxWidth: 280 }}>
                            <button onClick={() => setDetail(row)}
                              className="flex items-center gap-2.5 text-left w-full group"
                              title={t('stock.viewDetailTooltip')}>
                              <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden flex items-center justify-center"
                                style={{ background: '#1c1c1f', border: '1px solid #2e2e33' }}>
                                {thumb
                                  ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                                  : <Package size={13} className="text-zinc-600" />
                                }
                              </div>
                              <div className="min-w-0">
                                <p className="text-[12px] text-zinc-200 font-medium truncate group-hover:text-cyan-400 transition-colors">{row.product.name}</p>
                                {row.product.sku && <p className="text-[10px] text-zinc-600 font-mono">{row.product.sku}</p>}
                              </div>
                            </button>
                          </td>

                          {/* Físico */}
                          <td className="px-3 py-2.5">
                            <span className="text-sm font-bold tabular-nums" style={{ color: row.qty === 0 ? '#f87171' : '#e4e4e7' }}>
                              {row.qty}
                            </span>
                          </td>

                          {/* Virtual */}
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] text-zinc-500 tabular-nums">+{row.virtualQty}</span>
                          </td>

                          {/* Plataforma */}
                          <td className="px-3 py-2.5">
                            <span className="text-[12px] font-semibold tabular-nums" style={{ color: '#00E5FF' }}>
                              {row.platformQty}
                            </span>
                          </td>

                          {/* Mínimo */}
                          <td className="px-3 py-2.5">
                            <MinStockCell row={row} onSaved={load} />
                          </td>

                          {/* Auto-pausa */}
                          <td className="px-3 py-2.5">
                            <AutoPauseToggle row={row} onSaved={load} />
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2.5">
                            <AlertBadge alert={row.alert} />
                          </td>

                          {/* Ação */}
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => setAdjusting(row)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                              style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.18)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,229,255,0.1)')}>
                              {t('stock.moveAction')}
                            </button>
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>
        </div>

        {!loading && visible.length > 0 && (
          <div className="px-4 py-2 border-t" style={{ borderColor: '#1e1e24' }}>
            <p className="text-[10px] text-zinc-600">{t('stock.shownCount', { count: visible.length })}</p>
          </div>
        )}
      </section>

      {/* Legend */}
      <p className="text-[10px] text-zinc-700">
        {t('stock.legend')}
      </p>

      {/* Adjust modal */}
      {adjusting && (
        <AdjustModal
          row={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => { setAdjusting(null); load() }}
        />
      )}

      {/* Detail drawer */}
      {detail && (
        <StockDetailDrawer row={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
