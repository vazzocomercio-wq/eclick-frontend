'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { computeContributionMargin, round2 } from '@/lib/margin'
import { useConfirm } from '@/components/ui/dialog-provider'
import CopyToChannelsModal, { type CopyItem } from '@/components/catalog/CopyToChannelsModal'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// Comissão TikTok padrão (% sobre o preço) usada no cálculo de margem. O
// TikTok não expõe a comissão real por categoria como o ML, então é um
// controle editável persistido por ORG (org_channel_settings via backend) —
// o mesmo valor aparece em todos os browsers da equipe.
const DEFAULT_COMMISSION = 8
const PAGE_SIZE = 20

// ── Types ────────────────────────────────────────────────────────────────────

type TkListing = {
  tts_product_id: string
  sku_id: string
  seller_sku: string | null
  title: string
  variation_name: string | null
  status: string | null
  sku_status: string | null
  price: number | null
  currency: string | null
  stock: number
  warehouse_id: string | null
  image: string | null
  category: string | null
  sku_count: number
  synced_at: string | null
}

type Tab = 'active' | 'paused' | 'closed' | 'under_review'
type Counts = { active: number; paused: number; closed: number; under_review: number }
type Toast = { id: number; msg: string; type: 'success' | 'error' | 'info' }

type MarginInfo = {
  product_id: string
  cost: number | null
  tax_pct: number | null
  tax_on_freight: boolean
}

type TFn = (key: string, values?: Record<string, string | number | Date>) => string

// ── Helpers ──────────────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number) => v.toLocaleString('pt-BR')

function ago(iso: string | null, t: TFn): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3600000)
  if (h < 1) return t('tk.ago.now')
  if (h < 24) return t('tk.ago.hours', { h })
  const d = Math.floor(h / 24)
  return d === 1 ? t('tk.ago.yesterday') : t('tk.ago.days', { d })
}

const STATUS_TAB: Record<string, Tab> = {
  ACTIVATE: 'active',
  SELLER_DEACTIVATED: 'paused',
  PLATFORM_DEACTIVATED: 'paused',
  FREEZE: 'paused',
  DELETED: 'closed',
  PENDING: 'under_review',
  DRAFT: 'under_review',
  FAILED: 'under_review',
}

function statusBadge(status: string | null): { key: string; bg: string; color: string; border: string } {
  const tab = STATUS_TAB[(status ?? '').toUpperCase()] ?? 'under_review'
  switch (tab) {
    case 'active':
      return { key: 'active', bg: '#0d1f17', color: '#4ade80', border: '#22c55e2a' }
    case 'paused':
      return { key: 'paused', bg: '#1a1a1f', color: '#a1a1aa', border: '#27272a' }
    case 'closed':
      return { key: 'closed', bg: '#1f0d0d', color: '#f87171', border: '#ef44442a' }
    default:
      return { key: 'under_review', bg: '#2a1500', color: '#fb923c', border: '#f973162a' }
  }
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toasts({ list }: { list: Toast[] }) {
  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {list.map((t) => (
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

function SkeletonRow() {
  return (
    <div className="flex gap-4 p-4 rounded-xl animate-pulse" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      <div className="w-16 h-16 rounded-lg bg-zinc-800 shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="flex gap-2"><div className="h-5 w-16 rounded bg-zinc-800" /><div className="h-5 w-12 rounded bg-zinc-800" /></div>
        <div className="h-4 w-3/4 rounded bg-zinc-800" />
        <div className="h-3 w-1/2 rounded bg-zinc-800" />
      </div>
      <div className="w-44 shrink-0 space-y-2 py-1">
        <div className="h-8 w-32 rounded bg-zinc-800 ml-auto" />
        <div className="h-3 w-24 rounded bg-zinc-800 ml-auto" />
      </div>
    </div>
  )
}

// ── Margin panel ─────────────────────────────────────────────────────────────
// Custo + imposto editáveis (gravados no produto). Comissão vem do controle de
// página. Aparece só em SKU com produto vinculado.

function MarginPanel({ price, commissionPct, info, orgTaxPct, onSave }: {
  price: number
  commissionPct: number
  info: MarginInfo
  orgTaxPct: number | null
  onSave: (productId: string, patch: { cost: number | null; taxPct: number | null }) => Promise<boolean>
}) {
  const t = useTranslations('catalogo')
  const taxInitial = info.tax_pct ?? orgTaxPct
  const costInitial = info.cost != null ? String(info.cost) : ''
  const taxBaseline = taxInitial != null ? String(taxInitial) : ''

  const [costDraft, setCostDraft] = useState(costInitial)
  const [taxDraft, setTaxDraft] = useState(taxBaseline)
  const [saving, setSaving] = useState(false)

  const cost = parseFloat(costDraft.replace(',', '.')) || 0
  const taxPct = parseFloat(taxDraft.replace(',', '.')) || 0
  const saleFee = round2(price * (commissionPct / 100))

  const m = computeContributionMargin({
    price, saleFee, shipping: 0, cost,
    taxPercentage: taxPct, taxOnFreight: info.tax_on_freight,
  })
  const grossProfit = round2(price - saleFee)
  const grossProfitPct = price > 0 ? round2((grossProfit / price) * 100) : 0
  const marginOverCost = cost > 0 ? round2((m.contributionMargin / cost) * 100) : null

  const dirty = costDraft !== costInitial || taxDraft !== taxBaseline
  const taxInherited = info.tax_pct == null && orgTaxPct != null
  const noCost = costDraft.trim() === ''

  async function save() {
    setSaving(true)
    await onSave(info.product_id, {
      cost: costDraft.trim() === '' ? null : cost,
      taxPct: taxDraft.trim() === '' ? null : taxPct,
    })
    setSaving(false)
  }

  const marginColor = noCost ? '#71717a'
    : m.contributionMarginPct >= 15 ? '#4ade80'
    : m.contributionMarginPct >= 5 ? '#fbbf24'
    : '#f87171'
  const fieldStyle = { background: '#0d0d10', border: '1px solid #27272a' }

  return (
    <div className="w-full text-[11px] pt-2 mt-1 space-y-1.5" style={{ borderTop: '1px solid #1e1e24' }}>
      <div className="flex justify-between text-zinc-500">
        <span>{t('tk.margin.commission')} ({commissionPct}%)</span>
        <span className="text-zinc-400 tabular-nums">−{brl(saleFee)}</span>
      </div>
      <div className="flex justify-between text-zinc-500">
        <span>{t('tk.margin.grossProfit')}</span>
        <span className="text-emerald-400/90">{brl(grossProfit)} · {grossProfitPct.toFixed(1)}%</span>
      </div>
      <div className="flex items-center justify-between gap-1 pt-1" style={{ borderTop: '1px dashed #1e1e24' }}>
        <span className="text-zinc-500">{t('tk.margin.cost')}</span>
        <div className="flex items-center gap-0.5">
          <span className="text-zinc-600">R$</span>
          <input value={costDraft} onChange={(e) => setCostDraft(e.target.value)}
            placeholder="0,00" inputMode="decimal"
            className="w-16 text-right text-zinc-200 tabular-nums px-1.5 py-0.5 rounded outline-none focus:border-cyan-400"
            style={fieldStyle} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-zinc-500">
          {t('tk.margin.tax')}{taxInherited && <span className="text-zinc-600" title={t('tk.margin.taxInheritedTooltip')}> {t('tk.margin.taxDefaultSuffix')}</span>}
        </span>
        <div className="flex items-center gap-0.5">
          <input value={taxDraft} onChange={(e) => setTaxDraft(e.target.value)}
            placeholder="0" inputMode="decimal"
            className="w-12 text-right text-zinc-200 tabular-nums px-1.5 py-0.5 rounded outline-none focus:border-cyan-400"
            style={fieldStyle} />
          <span className="text-zinc-600">%</span>
        </div>
      </div>
      <div className="flex justify-between items-start pt-1" style={{ borderTop: '1px dashed #1e1e24' }}>
        <span className="text-zinc-400 font-medium">{t('tk.margin.contributionMargin')}</span>
        <div className="text-right">
          <div className="font-bold" style={{ color: marginColor }}>
            {noCost ? t('tk.margin.noCost') : `${brl(m.contributionMargin)} · ${m.contributionMarginPct.toFixed(1)}%`}
          </div>
          {!noCost && marginOverCost != null && (
            <div className="text-[10px] text-zinc-600">{t('tk.margin.percentOfCost', { pct: marginOverCost.toFixed(1) })}</div>
          )}
        </div>
      </div>
      {dirty && (
        <button onClick={save} disabled={saving}
          className="w-full text-[10px] py-1 rounded-md font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: '#00E5FF', color: '#000' }}>
          {saving ? t('tk.margin.saving') : t('tk.margin.saveCostTax')}
        </button>
      )}
    </div>
  )
}

// ── Listing card ───────────────────────────────────────────────────────────

function ListingCard({ item, linked, linkedStock, marginInfo, orgTaxPct, commissionPct, matchedProduct, selected, onSelect, onLink, onLinkKnown, onUnlink, onSaveMargin, onUpdatePrice, onSetActive }: {
  item: TkListing
  linked: boolean
  linkedStock: number | null
  marginInfo: MarginInfo | null
  orgTaxPct: number | null
  commissionPct: number
  matchedProduct: { id: string; name: string } | null
  selected: boolean
  onSelect: (skuId: string) => void
  onLink: (item: TkListing) => void
  onLinkKnown: (item: TkListing, product: { id: string; name: string }) => void
  onUnlink: (item: TkListing) => void
  onSaveMargin: (productId: string, patch: { cost: number | null; taxPct: number | null }) => Promise<boolean>
  onUpdatePrice: (item: TkListing, price: number) => Promise<void>
  onSetActive: (item: TkListing, active: boolean) => Promise<void>
}) {
  const t = useTranslations('catalogo')
  const badge = statusBadge(item.status)
  const stock = linked && linkedStock != null ? linkedStock : item.stock
  const tab = STATUS_TAB[(item.status ?? '').toUpperCase()] ?? 'under_review'

  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirmPrice() {
    const v = parseFloat(priceDraft.replace(',', '.'))
    if (!(v > 0)) { setEditingPrice(false); return }
    setBusy(true)
    await onUpdatePrice(item, v)
    setBusy(false)
    setEditingPrice(false)
  }
  async function toggleActive(active: boolean) {
    setBusy(true)
    await onSetActive(item, active)
    setBusy(false)
  }

  return (
    <div className="flex gap-4 p-4 rounded-xl" style={{ background: selected ? 'rgba(0,229,255,0.05)' : '#0f0f12', border: selected ? '1px solid rgba(0,229,255,0.35)' : '1px solid #1a1a1f' }}>
      {/* Checkbox de seleção (cópia em lote) */}
      <input type="checkbox" checked={selected} onChange={() => onSelect(item.sku_id)}
        className="w-4 h-4 mt-1 rounded accent-cyan-400 cursor-pointer shrink-0" />
      {/* Thumb */}
      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0" style={{ background: '#1c1c1f' }}>
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>

      {/* Middle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
            style={{ background: badge.bg, color: badge.color, borderColor: badge.border }}>
            {t(`tk.status.${badge.key}`)}
          </span>
          {item.sku_count > 1 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
              style={{ background: '#1a0e33', color: '#a78bfa', borderColor: '#7c3aed2a' }}>
              {t('tk.variations', { count: item.sku_count })}
            </span>
          )}
          {linked && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
              style={{ background: '#0a1f2e', color: '#00E5FF', borderColor: '#00E5FF2a' }}>
              {t('tk.linkedBadge')}
            </span>
          )}
        </div>

        <p className="text-zinc-100 text-sm font-medium mt-1.5 line-clamp-2">{item.title}</p>
        {item.variation_name && (
          <p className="text-[11px] text-zinc-500 mt-0.5">{item.variation_name}</p>
        )}

        <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 flex-wrap">
          <span>SKU: <span className={item.seller_sku ? 'text-zinc-300' : 'text-amber-400'}>{item.seller_sku ?? t('tk.noSku')}</span></span>
          {item.category && <span>{t('tk.category')}: <span className="text-zinc-400">{item.category}</span></span>}
          <span>{t('tk.stock')}: <span className="text-zinc-300 tabular-nums">{num(stock)}</span></span>
          <span>{t('tk.updated')} {ago(item.synced_at, t)}</span>
        </div>
      </div>

      {/* Right: price + actions + margin */}
      <div className="w-52 shrink-0 flex flex-col items-end">
        {/* Preço — clicável pra editar no TikTok (escrita real) */}
        {editingPrice ? (
          <div className="flex items-center gap-1 w-full justify-end">
            <span className="text-zinc-600 text-sm">R$</span>
            <input autoFocus value={priceDraft} inputMode="decimal" disabled={busy}
              onChange={(e) => setPriceDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void confirmPrice(); if (e.key === 'Escape') setEditingPrice(false) }}
              className="w-20 text-right text-white tabular-nums px-1.5 py-1 rounded outline-none focus:border-cyan-400"
              style={{ background: '#0d0d10', border: '1px solid #27272a' }} />
            <button onClick={() => void confirmPrice()} disabled={busy} title="Aplicar"
              className="text-emerald-400 hover:text-emerald-300 disabled:opacity-40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </button>
            <button onClick={() => setEditingPrice(false)} disabled={busy} title="Cancelar"
              className="text-zinc-500 hover:text-zinc-300 disabled:opacity-40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setPriceDraft(item.price != null ? String(item.price) : ''); setEditingPrice(true) }}
            className="group text-right flex items-center gap-1.5 hover:opacity-90" title={t('tk.editPrice')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth={2} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-white text-lg font-bold tabular-nums">{item.price != null ? brl(item.price) : '—'}</span>
          </button>
        )}

        <div className="mt-2 w-full flex flex-col gap-1.5">
          {linked ? (
            <button onClick={() => onUnlink(item)}
              className="w-full text-xs font-semibold py-1.5 rounded-lg border transition-colors"
              style={{ background: '#2a1500', color: '#fbbf24', borderColor: '#f59e0b3a' }}>
              {t('tk.unlinkProduct')}
            </button>
          ) : matchedProduct ? (
            <button onClick={() => onLinkKnown(item, matchedProduct)}
              className="w-full text-xs font-semibold py-1.5 rounded-lg border transition-colors truncate px-2"
              style={{ background: '#0d1f17', color: '#4ade80', borderColor: '#22c55e3a' }}
              title={matchedProduct.name}>
              {t('tk.linkToProduct', { name: matchedProduct.name })}
            </button>
          ) : (
            <button onClick={() => onLink(item)}
              className="w-full text-xs font-semibold py-1.5 rounded-lg border transition-colors"
              style={{ background: '#0d1f17', color: '#4ade80', borderColor: '#22c55e3a' }}>
              {t('tk.linkProduct')}
            </button>
          )}

          {/* Ativar / Pausar no TikTok (escrita real) — só onde faz sentido */}
          {tab === 'active' && (
            <button onClick={() => void toggleActive(false)} disabled={busy}
              className="w-full text-xs font-medium py-1.5 rounded-lg border transition-colors disabled:opacity-50"
              style={{ background: '#1a1a1f', color: '#a1a1aa', borderColor: '#27272a' }}>
              {t('tk.pauseListing')}
            </button>
          )}
          {tab === 'paused' && (
            <button onClick={() => void toggleActive(true)} disabled={busy}
              className="w-full text-xs font-medium py-1.5 rounded-lg border transition-colors disabled:opacity-50"
              style={{ background: '#0d1f17', color: '#4ade80', borderColor: '#22c55e3a' }}>
              {t('tk.activateListing')}
            </button>
          )}
        </div>

        {linked && marginInfo && item.price != null && (
          <MarginPanel
            price={item.price}
            commissionPct={commissionPct}
            info={marginInfo}
            orgTaxPct={orgTaxPct}
            onSave={onSaveMargin}
          />
        )}
      </div>
    </div>
  )
}

// ── Link-to-product modal ──────────────────────────────────────────────────

type ProductOption = { id: string; name: string; sku: string | null; cost_price: number | null; photo_urls: string[] | null }

function LinkToProductModal({ target, linking, onConfirm, onClose }: {
  target: TkListing
  linking: boolean
  onConfirm: (productId: string, productLabel: string, qtyPerUnit: number) => void
  onClose: () => void
}) {
  const t = useTranslations('catalogo')
  const supabase = useMemo(() => createClient(), [])
  const [search, setSearch] = useState(target.seller_sku ?? '')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<ProductOption | null>(null)
  const [qtyPerUnit, setQtyPerUnit] = useState('1')

  useEffect(() => {
    const term = search.trim()
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from('products')
        .select('id, name, sku, cost_price, photo_urls')
        .order('updated_at', { ascending: false })
        .limit(30)
      if (term) query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
      const { data } = await query
      if (cancelled) return
      setProducts((data ?? []) as ProductOption[])
      setSearching(false)
    }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [search, supabase])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl rounded-2xl flex flex-col overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24', maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <div>
            <p className="text-white text-sm font-semibold">{t('tk.linkModal.title')}</p>
            <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-md">{target.title}{target.variation_name ? ` · ${target.variation_name}` : ''}</p>
          </div>
          <button onClick={onClose} disabled={linking} className="text-zinc-500 hover:text-white transition-colors disabled:opacity-40">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <input type="text" autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('tk.linkModal.searchPlaceholder')}
            className="w-full px-4 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#09090b', border: '1px solid #27272a', color: '#fafafa' }} disabled={linking} />
        </div>

        <div className="flex-1 overflow-y-auto" style={{ minHeight: 120 }}>
          {searching && products.length === 0 ? (
            <p className="text-zinc-500 text-sm px-5 py-6">{t('tk.linkModal.searching')}</p>
          ) : products.length === 0 ? (
            <p className="text-zinc-500 text-sm px-5 py-6">{t('tk.linkModal.noProducts')}</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#1e1e24' }}>
              {products.map((p) => {
                const isPicked = picked?.id === p.id
                const thumb = p.photo_urls?.[0] ?? null
                return (
                  <button key={p.id} onClick={() => setPicked(p)} disabled={linking}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                    style={{ background: isPicked ? 'rgba(0,229,255,0.08)' : 'transparent' }}
                    onMouseEnter={(e) => { if (!isPicked) e.currentTarget.style.background = '#15151a' }}
                    onMouseLeave={(e) => { if (!isPicked) e.currentTarget.style.background = 'transparent' }}>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" style={{ background: '#1c1c1f' }} />
                    ) : (
                      <div className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center text-zinc-700" style={{ background: '#1c1c1f' }}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-100 text-xs font-medium truncate">{p.name}</p>
                      <p className="text-zinc-500 text-[10px] mt-0.5">
                        {p.sku ? `SKU: ${p.sku}` : t('tk.linkModal.noSku')}
                        {p.cost_price != null && ` · ${t('tk.linkModal.costLabel', { value: brl(Number(p.cost_price)) })}`}
                      </p>
                    </div>
                    {isPicked && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
                        style={{ background: 'rgba(0,229,255,0.15)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.4)' }}>
                        {t('tk.linkModal.selected')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {picked && (
          <div className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid #1e1e24', background: '#0c0c0f' }}>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-zinc-500">{t('tk.linkModal.qtyPerUnit')}</label>
              <input type="number" min={1} value={qtyPerUnit} onChange={(e) => setQtyPerUnit(e.target.value)} disabled={linking}
                className="w-16 px-2 py-1 rounded text-xs text-center outline-none" style={{ background: '#09090b', border: '1px solid #27272a', color: '#fafafa' }} />
              <span className="text-[10px] text-zinc-600">{t('tk.linkModal.qtyHint')}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 px-5 py-4 shrink-0" style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} disabled={linking} className="px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            {t('tk.linkModal.cancel')}
          </button>
          <button onClick={() => picked && onConfirm(picked.id, picked.name, Number(qtyPerUnit) || 1)} disabled={linking || !picked}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50" style={{ background: '#00E5FF', color: '#000' }}>
            {linking && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            )}
            {linking ? t('tk.linkModal.linking') : `${t('tk.linkModal.linkBtn')} →`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────

function Pagination({ page, total, size, onChange }: { page: number; total: number; size: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / size)
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button onClick={() => onChange(Math.max(0, page - 1))} disabled={page === 0}
        className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40" style={{ borderColor: '#27272a', color: '#a1a1aa' }}>←</button>
      <span className="text-sm text-zinc-500 tabular-nums">{page + 1} / {pages}</span>
      <button onClick={() => onChange(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1}
        className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40" style={{ borderColor: '#27272a', color: '#a1a1aa' }}>→</button>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TikTokListingsPage() {
  const t = useTranslations('catalogo')
  const supabase = useMemo(() => createClient(), [])
  const confirm = useConfirm()

  const [items, setItems] = useState<TkListing[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Counts>({ active: 0, paused: 0, closed: 0, under_review: 0 })
  const [tab, setTab] = useState<Tab>('active')
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const [connected, setConnected] = useState<boolean | null>(null)
  const [sellerName, setSellerName] = useState<string | null>(null)

  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [linkMap, setLinkMap] = useState<Map<string, { vinculoId: string; productId: string; productName: string }>>(new Map())
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map())
  const [marginMap, setMarginMap] = useState<Record<string, MarginInfo>>({})
  const [productBySku, setProductBySku] = useState<Record<string, { id: string; name: string }>>({})
  const [orgTax, setOrgTax] = useState<{ pct: number | null; onFreight: boolean }>({ pct: null, onFreight: false })

  const [commissionPct, setCommissionPct] = useState(DEFAULT_COMMISSION)

  const [toasts, setToasts] = useState<Toast[]>([])
  const [linkTarget, setLinkTarget] = useState<TkListing | null>(null)
  const [linking, setLinking] = useState(false)
  // Cópia em lote pra outras contas/plataformas
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [copyOpen, setCopyOpen] = useState(false)
  const toggleSelect = useCallback((skuId: string) => setSelected((prev) => {
    const n = new Set(prev); n.has(skuId) ? n.delete(skuId) : n.add(skuId); return n
  }), [])

  const toast = useCallback((msg: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((l) => [...l, { id, msg, type }])
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 4000)
  }, [])

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` } as Record<string, string>
  }, [supabase])

  // Comissão lida da org (backend). Edição debounced salva no banco — o valor
  // passa a ser compartilhado entre todos os usuários da org.
  useEffect(() => {
    void (async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(`${BACKEND}/channel-settings/tiktok_shop`, { headers })
        if (res.ok) {
          const d = (await res.json()) as { estimated_take_rate_pct?: number; commission_pct?: number } | null
          const pct = Number(d?.estimated_take_rate_pct ?? d?.commission_pct)
          if (Number.isFinite(pct)) setCommissionPct(pct)
        }
      } catch { /* silencioso — usa o default */ }
    })()
  }, [getHeaders])

  const commissionSaveTimer = useMemo(() => ({ id: 0 as number | ReturnType<typeof setTimeout> }), [])
  const updateCommission = (v: number) => {
    setCommissionPct(v)
    // Debounce 600ms — evita PATCH a cada keystroke
    if (commissionSaveTimer.id) clearTimeout(commissionSaveTimer.id as ReturnType<typeof setTimeout>)
    commissionSaveTimer.id = setTimeout(async () => {
      try {
        const headers = await getHeaders()
        await fetch(`${BACKEND}/channel-settings/tiktok_shop`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ estimated_take_rate_pct: v }),
        })
      } catch { /* silencioso */ }
    }, 600) as unknown as number
  }

  const loadItems = useCallback(async (currentTab: Tab, currentPage: number, query: string) => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const params = new URLSearchParams({ status: currentTab, offset: String(currentPage * PAGE_SIZE), limit: String(PAGE_SIZE) })
      if (query.trim()) params.set('q', query.trim())
      const res = await fetch(`${BACKEND}/tiktok-shop/listings?${params.toString()}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { items: TkListing[]; total: number }
      setItems(body.items ?? [])
      setTotal(body.total ?? 0)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t('tk.loadError'), 'error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [getHeaders, toast, t])

  const loadCounts = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/tiktok-shop/listings/counts`, { headers })
      if (res.ok) setCounts((await res.json()) as Counts)
    } catch { /* silencioso */ }
  }, [getHeaders])

  const loadStatus = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/tiktok-shop/status`, { headers })
      if (res.ok) {
        const d = (await res.json()) as { connected: boolean; seller_name: string | null }
        setConnected(d.connected)
        setSellerName(d.seller_name)
      }
    } catch { setConnected(false) }
  }, [getHeaders])

  // Vínculos ativos (badge "Produto vinculado") + estoque mestre por SKU.
  const loadLinkMap = useCallback(async () => {
    type Row = {
      id: string
      listing_id: string
      product_id: string
      products: { name: string | null; product_stock: Array<{ id: string; quantity: number; platform: string | null }> | null } | null
    }
    const { data, error } = await supabase
      .from('product_listings')
      .select('id, listing_id, product_id, products(name, product_stock(id, quantity, platform))')
      .eq('platform', 'tiktok_shop')
      .eq('is_active', true)
    if (error || !data) return
    const ids = new Set<string>()
    const links = new Map<string, { vinculoId: string; productId: string; productName: string }>()
    const stocks = new Map<string, number>()
    for (const r of data as unknown as Row[]) {
      if (!r.listing_id) continue
      ids.add(r.listing_id)
      links.set(r.listing_id, { vinculoId: r.id, productId: r.product_id, productName: r.products?.name ?? '' })
      const shared = r.products?.product_stock?.find((s) => s.platform === null)
      if (shared) stocks.set(r.listing_id, Number(shared.quantity ?? 0))
    }
    setLinkedIds(ids)
    setLinkMap(links)
    setStockMap(stocks)
  }, [supabase])

  // Imposto padrão da org (fallback do painel de margem)
  useEffect(() => {
    void (async () => {
      try {
        const headers = await getHeaders()
        const res = await fetch(`${BACKEND}/products/tax-config`, { headers })
        if (res.ok) {
          const d = (await res.json()) as { default_tax_percentage: number | null; default_tax_on_freight: boolean }
          setOrgTax({ pct: d.default_tax_percentage, onFreight: Boolean(d.default_tax_on_freight) })
        }
      } catch { /* silencioso */ }
    })()
  }, [getHeaders])

  // Custo/imposto do produto vinculado + detecção de produto-pai por SKU.
  useEffect(() => {
    if (items.length === 0) { setMarginMap({}); setProductBySku({}); return }
    const skuIds = items.map((i) => i.sku_id)
    const sellerSkus = [...new Set(items.map((i) => i.seller_sku).filter((s): s is string => !!s))]
    void (async () => {
      const [linkRes, prodRes] = await Promise.all([
        supabase
          .from('product_listings')
          .select('listing_id, product_id, product:products(cost_price, tax_percentage, tax_on_freight)')
          .in('listing_id', skuIds)
          .eq('platform', 'tiktok_shop'),
        sellerSkus.length > 0
          ? supabase.from('products').select('id, name, sku').in('sku', sellerSkus)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string; sku: string }> }),
      ])
      type ProdRow = { cost_price: number | null; tax_percentage: number | null; tax_on_freight: boolean | null }
      type LinkRow = { listing_id: string; product_id: string; product: ProdRow | ProdRow[] | null }
      const mm: Record<string, MarginInfo> = {}
      for (const r of (linkRes.data ?? []) as LinkRow[]) {
        const prod = Array.isArray(r.product) ? r.product[0] : r.product
        mm[r.listing_id] = {
          product_id: r.product_id,
          cost: prod?.cost_price ?? null,
          tax_pct: prod?.tax_percentage ?? null,
          tax_on_freight: Boolean(prod?.tax_on_freight),
        }
      }
      const pbs: Record<string, { id: string; name: string }> = {}
      for (const p of (prodRes.data ?? []) as Array<{ id: string; name: string; sku: string }>) {
        if (p.sku && !pbs[p.sku]) pbs[p.sku] = { id: p.id, name: p.name }
      }
      setMarginMap(mm)
      setProductBySku(pbs)
    })()
  }, [items, supabase])

  useEffect(() => { void loadStatus() }, [loadStatus])
  useEffect(() => { void loadCounts() }, [loadCounts])
  useEffect(() => { void loadLinkMap() }, [loadLinkMap])
  useEffect(() => { void loadItems(tab, page, q) }, [tab, page, q, loadItems])

  async function saveMargin(productId: string, patch: { cost: number | null; taxPct: number | null }) {
    const { error } = await supabase.from('products').update({ cost_price: patch.cost, tax_percentage: patch.taxPct }).eq('id', productId)
    if (error) { toast(t('tk.toast.saveCostTaxFailed'), 'error'); return false }
    setMarginMap((m) => {
      const next = { ...m }
      for (const [sku, info] of Object.entries(next)) {
        if (info.product_id === productId) next[sku] = { ...info, cost: patch.cost, tax_pct: patch.taxPct }
      }
      return next
    })
    toast(t('tk.toast.costTaxUpdated'), 'success')
    return true
  }

  async function linkTo(productId: string, productLabel: string, qtyPerUnit: number, targets: TkListing[]) {
    setLinking(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/products/vinculos/bulk`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          platform: 'tiktok_shop',
          items: targets.map((it) => ({
            listing_id: it.sku_id,
            quantity_per_unit: qtyPerUnit,
            account_id: null,
            listing_title: it.title,
            listing_price: it.price,
            listing_thumbnail: it.image,
            listing_permalink: null,
          })),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }
      toast(t('tk.toast.linked', { name: productLabel }), 'success')
      setLinkTarget(null)
      await loadLinkMap()
      // TT-4: ao vincular, o TikTok assume o estoque do catálogo. No-op
      // enquanto o servidor estiver com o sync de estoque desligado (gate).
      try {
        const r = await fetch(`${BACKEND}/tiktok-shop/listings/sync-stock`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: productId }),
        })
        if (r.ok) {
          const b = (await r.json().catch(() => ({}))) as { pushed?: number }
          if ((b.pushed ?? 0) > 0) {
            toast(t('tk.toast.stockAssumed', { count: b.pushed ?? 0 }), 'success')
            await loadItems(tab, page, q)
          }
        }
      } catch { /* não-fatal: vínculo já foi feito */ }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t('tk.toast.linkError'), 'error')
    } finally {
      setLinking(false)
    }
  }

  async function unlink(item: TkListing) {
    const info = linkMap.get(item.sku_id)
    if (!info) return
    const ok = await confirm({
      message: t('tk.unlinkConfirm', { name: info.productName || t('tk.unlinkConfirmFallback') }),
      confirmLabel: 'Desvincular',
      variant: 'warning',
    })
    if (!ok) return
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/products/vinculos/${info.vinculoId}`, { method: 'DELETE', headers })
      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }
      toast(t('tk.toast.unlinked'), 'success')
      await loadLinkMap()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t('tk.toast.unlinkError'), 'error')
    }
  }

  /** Edita o preço do SKU no TikTok (escrita ao vivo) — confirma antes. */
  async function updatePrice(item: TkListing, price: number) {
    const ok = await confirm({
      message: t('tk.confirmPrice', { from: brl(item.price ?? 0), to: brl(price) }),
      confirmLabel: t('tk.applyPrice'),
      variant: 'warning',
    })
    if (!ok) return
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/tiktok-shop/listings/${item.tts_product_id}/price`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku_id: item.sku_id, price, currency: item.currency ?? 'BRL' }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }
      toast(t('tk.toast.priceUpdated'), 'success')
      await loadItems(tab, page, q)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t('tk.toast.priceFailed'), 'error')
    }
  }

  /** Ativa/pausa o produto no TikTok (escrita ao vivo) — confirma antes. */
  async function setActive(item: TkListing, active: boolean) {
    const ok = await confirm({
      message: active ? t('tk.confirmActivate') : t('tk.confirmPause'),
      confirmLabel: active ? t('tk.activateListing') : t('tk.pauseListing'),
      variant: 'warning',
    })
    if (!ok) return
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/tiktok-shop/listings/${item.tts_product_id}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? `HTTP ${res.status}`)
      }
      toast(t('tk.toast.statusUpdated'), 'success')
      await Promise.all([loadItems(tab, page, q), loadCounts()])
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t('tk.toast.statusFailed'), 'error')
    }
  }

  async function syncFromTikTok() {
    setSyncing(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/tiktok-shop/products/import`, { method: 'POST', headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { imported?: number }
      toast(t('tk.toast.synced', { count: body.imported ?? 0 }), 'success')
      await Promise.all([loadItems(tab, page, q), loadCounts()])
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t('tk.toast.syncFailed'), 'error')
    } finally {
      setSyncing(false)
    }
  }

  function changeTab(next: Tab) { setTab(next); setPage(0) }
  function submitSearch() { setQ(qInput); setPage(0) }

  const TABS: { key: Tab; count: number }[] = [
    { key: 'active', count: counts.active },
    { key: 'paused', count: counts.paused },
    { key: 'closed', count: counts.closed },
    { key: 'under_review', count: counts.under_review },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold tracking-widest text-zinc-500">{t('tk.eyebrow')}</p>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {t('tk.live')}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-white mt-0.5">{t('tk.title')}</h1>
          <p className="text-sm text-zinc-500 mt-1">{t('tk.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {connected === false ? (
            <span className="text-xs text-amber-300">
              {t('tk.notConnected')}{' '}
              <a href="/dashboard/integracoes/tiktok-shop" className="underline hover:text-amber-200">{t('tk.connect')}</a>
            </span>
          ) : connected && sellerName ? (
            <span className="text-xs text-zinc-400">{t('tk.shop')}: <span className="text-zinc-200">{sellerName}</span></span>
          ) : null}
          {/* Comissão TikTok (afeta a margem) */}
          <div className="flex items-center gap-1.5" title={t('tk.commissionHint')}>
            <span className="text-[11px] text-zinc-500">{t('tk.commissionLabel')}</span>
            <input type="number" min={0} step={0.5} value={commissionPct}
              onChange={(e) => updateCommission(Number(e.target.value) || 0)}
              className="w-14 px-2 py-1 rounded-lg text-xs text-right tabular-nums outline-none focus:border-cyan-400"
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#e4e4e7' }} />
            <span className="text-[11px] text-zinc-500">%</span>
          </div>
          <button onClick={syncFromTikTok} disabled={syncing || connected === false}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#000' }}>
            {syncing ? t('tk.syncing') : t('tk.sync')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mt-6 border-b" style={{ borderColor: '#1a1a1f' }}>
        {TABS.map(({ key, count }) => (
          <button key={key} onClick={() => changeTab(key)}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative"
            style={{ color: tab === key ? '#00E5FF' : '#71717a' }}>
            {t(`tk.tab.${key === 'under_review' ? 'underReview' : key}`)}
            <span className="ml-1.5 text-[11px] tabular-nums" style={{ color: tab === key ? '#67e8f9' : '#52525b' }}>{count}</span>
            {tab === key && <span className="absolute bottom-[-1px] left-0 right-0 h-0.5" style={{ background: '#00E5FF' }} />}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mt-4 flex items-center gap-2">
        <input value={qInput} onChange={(e) => setQInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
          placeholder={t('tk.searchPlaceholder')}
          className="flex-1 px-4 py-2 rounded-lg text-sm outline-none focus:border-cyan-400"
          style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
        {(q || qInput) && (
          <button onClick={() => { setQInput(''); setQ(''); setPage(0) }} className="text-xs text-zinc-500 hover:text-zinc-300 px-2">✕</button>
        )}
      </div>

      {/* Count line */}
      <p className="text-[11px] text-zinc-600 mt-3">{t('tk.onThisPage', { count: items.length })}</p>

      {/* List */}
      <div className="mt-2 space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-zinc-600 text-sm">—</div>
        ) : (
          items.map((item) => (
            <ListingCard
              key={item.sku_id}
              item={item}
              linked={linkedIds.has(item.sku_id)}
              linkedStock={stockMap.get(item.sku_id) ?? null}
              marginInfo={marginMap[item.sku_id] ?? null}
              orgTaxPct={orgTax.pct}
              commissionPct={commissionPct}
              matchedProduct={item.seller_sku ? (productBySku[item.seller_sku] ?? null) : null}
              selected={selected.has(item.sku_id)}
              onSelect={toggleSelect}
              onLink={(it) => setLinkTarget(it)}
              onLinkKnown={(it, product) => linkTo(product.id, product.name, 1, [it])}
              onUnlink={unlink}
              onSaveMargin={saveMargin}
              onUpdatePrice={updatePrice}
              onSetActive={setActive}
            />
          ))
        )}
      </div>

      <Pagination page={page} total={total} size={PAGE_SIZE} onChange={setPage} />

      {linkTarget && (
        <LinkToProductModal
          target={linkTarget}
          linking={linking}
          onConfirm={(productId, label, qty) => linkTo(productId, label, qty, [linkTarget])}
          onClose={() => setLinkTarget(null)}
        />
      )}

      {/* Bulk bar — copiar selecionados pra outras contas/plataformas */}
      {selected.size > 0 && (() => {
        const copyItems: CopyItem[] = [...selected]
          .map((sku) => {
            const link = linkMap.get(sku)
            return link ? { product_id: link.productId, listing_id: sku, platform: 'tiktok_shop' } : null
          })
          .filter((x): x is CopyItem => x !== null)
        return (
          <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
            style={{ background: '#111114', borderTop: '1px solid #00E5FF33', boxShadow: '0 -4px 24px rgba(0,229,255,0.08)' }}>
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ background: '#00E5FF', color: '#000' }}>{selected.size}</span>
              {selected.size === 1 ? 'anúncio selecionado' : 'anúncios selecionados'}
            </span>
            <div className="flex items-center gap-3">
              <button onClick={() => setCopyOpen(true)} disabled={copyItems.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}
                title={copyItems.length === 0 ? 'Vincule os anúncios a um produto pra poder copiar' : `Copiar ${copyItems.length} anúncio(s) pra outras contas/plataformas`}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                Copiar p/ contas{copyItems.length > 0 && copyItems.length !== selected.size && <span className="text-[11px] opacity-80">({copyItems.length})</span>}
              </button>
              <button onClick={() => setSelected(new Set())} className="px-4 py-2.5 rounded-xl text-sm font-medium border transition-all" style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>Cancelar</button>
            </div>
          </div>
        )
      })()}

      {copyOpen && (
        <CopyToChannelsModal
          items={[...selected].map((sku) => {
            const link = linkMap.get(sku)
            return link ? { product_id: link.productId, listing_id: sku, platform: 'tiktok_shop' } : null
          }).filter((x): x is CopyItem => x !== null)}
          unlinkedCount={[...selected].filter((sku) => !linkMap.has(sku)).length}
          onClose={() => setCopyOpen(false)}
          onDone={(msg) => { setCopyOpen(false); setSelected(new Set()); toast(msg, 'success') }}
        />
      )}

      <Toasts list={toasts} />
    </div>
  )
}
