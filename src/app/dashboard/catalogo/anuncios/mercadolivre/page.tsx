'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const ML_FEE_DEFAULT = 0.115

// ── Types ──────────────────────────────────────────────────────────────────

type MListing = {
  id: string
  title: string
  price: number
  original_price: number | null
  available_quantity: number
  sold_quantity: number
  thumbnail: string
  permalink: string
  status: string
  listing_type_id: string
  catalog_product_id: string | null
  catalog_listing: boolean
  catalog_listing_type_id: string | null
  free_shipping: boolean
  logistic_type: string | null
  sku: string | null
  has_variations: boolean
  pictures_count: number
  tags: string[]
  deal_ids: string[]
  promotions: unknown[]
  health_score: number | null
  health_status: string | null
  health_reasons: string[]
  last_updated: string
  date_created: string
  account_nickname: string | null
  account_seller_id: number | null
}

type CreateResult = {
  listing_id: string
  status: 'created' | 'skipped' | 'error'
  product_id?: string
  reason?: string
}

type Counts = Record<string, number>
type Toast  = { id: number; msg: string; type: 'success' | 'error' | 'info' }
type Tab    = 'active' | 'paused' | 'closed' | 'under_review'

// ── Helpers ────────────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number) => v.toLocaleString('pt-BR')

function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const h  = Math.floor(ms / 3600000)
  if (h < 1)  return 'agora'
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `${d}d atrás`
}

function discountPct(original: number | null, current: number): number | null {
  if (!original || original <= current) return null
  return Math.round(((original - current) / original) * 100)
}

function feeRate(type: string) {
  return type === 'gold_pro' || type === 'gold_premium' ? 0.16 : ML_FEE_DEFAULT
}

function typeBadge(listing_type_id: string, logistic_type: string | null, catalog_listing: boolean) {
  const badges: { label: string; bg: string; color: string; border: string }[] = []

  if (logistic_type === 'fulfillment')
    badges.push({ label: 'FULL', bg: '#0a1f2e', color: '#00E5FF', border: '#00E5FF2a' })
  else if (catalog_listing)
    badges.push({ label: 'Catálogo', bg: '#1a0e33', color: '#a78bfa', border: '#7c3aed2a' })

  if (listing_type_id === 'gold_pro' || listing_type_id === 'gold_premium')
    badges.push({ label: 'Premium', bg: '#0e2a33', color: '#00E5FF', border: '#00E5FF22' })
  else if (listing_type_id === 'gold_special')
    badges.push({ label: 'Ouro', bg: '#2a1e00', color: '#fbbf24', border: '#f59e0b22' })
  else
    badges.push({ label: 'Clássico', bg: '#1a1a1f', color: '#71717a', border: '#27272a' })

  return badges
}

// ── Account badge color ────────────────────────────────────────────────────

const ACCOUNT_COLORS = [
  { color: '#00E5FF', bg: '#0a1f2e', border: '#00E5FF2a' },
  { color: '#a78bfa', bg: '#1a0e33', border: '#7c3aed2a' },
  { color: '#fb923c', bg: '#2a1500', border: '#f973162a' },
  { color: '#34d399', bg: '#0d1f17', border: '#22c55e2a' },
  { color: '#f472b6', bg: '#2a0d1f', border: '#ec48992a' },
]

function accountPalette(sellerId: number | null) {
  if (sellerId == null) return ACCOUNT_COLORS[0]
  return ACCOUNT_COLORS[sellerId % ACCOUNT_COLORS.length]
}

// ── Semi-circular gauge ────────────────────────────────────────────────────

function SemiGauge({ score, label, sub }: { score: number | null; label: string; sub?: string }) {
  const W = 72, H = 44, cx = W / 2, cy = H - 4, r = 28
  const color = score == null ? '#3f3f46'
    : score >= 80 ? '#22c55e'
    : score >= 60 ? '#f59e0b'
    : '#ef4444'

  const arcLen  = Math.PI * r
  const filled  = score != null ? (score / 100) * arcLen : 0
  const fullCirc = 2 * Math.PI * r
  const offset   = fullCirc * 0.75

  return (
    <div className="flex flex-col items-center" style={{ width: W }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="visible">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e24" strokeWidth="5"
          strokeDasharray={`${arcLen} ${arcLen}`}
          strokeDashoffset={-offset} strokeLinecap="round" />
        {score != null && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${filled} ${fullCirc - filled}`}
            strokeDashoffset={-offset} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .5s' }} />
        )}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="13" fontWeight="800" fill={score != null ? color : '#52525b'}>
          {score != null ? score : '—'}
        </text>
      </svg>
      <p className="text-[10px] font-semibold mt-0.5" style={{ color: score != null ? color : '#52525b' }}>{label}</p>
      {sub && <p className="text-[9px] text-zinc-600 mt-0.5 text-center leading-tight">{sub}</p>}
    </div>
  )
}

// ── Copy button ────────────────────────────────────────────────────────────

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500) }}
      className="ml-1 opacity-40 hover:opacity-100 transition-opacity" title="Copiar">
      {ok
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
      }
    </button>
  )
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toasts({ list }: { list: Toast[] }) {
  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-2 pointer-events-none">
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

// ── Skeleton row ───────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex gap-4 p-4 rounded-xl animate-pulse" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      <div className="w-4 h-4 rounded bg-zinc-800 shrink-0 mt-1" />
      <div className="w-16 h-16 rounded-lg bg-zinc-800 shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded bg-zinc-800" />
          <div className="h-5 w-12 rounded bg-zinc-800" />
        </div>
        <div className="h-4 w-3/4 rounded bg-zinc-800" />
        <div className="h-3 w-1/2 rounded bg-zinc-800" />
        <div className="flex gap-2 mt-2">
          <div className="h-5 w-16 rounded-full bg-zinc-800" />
          <div className="h-5 w-20 rounded-full bg-zinc-800" />
        </div>
      </div>
      <div className="w-44 shrink-0 space-y-2 py-1">
        <div className="h-8 w-32 rounded bg-zinc-800 ml-auto" />
        <div className="h-3 w-24 rounded bg-zinc-800 ml-auto" />
        <div className="h-3 w-20 rounded bg-zinc-800 ml-auto" />
      </div>
    </div>
  )
}

// ── Item action menu ───────────────────────────────────────────────────────

function ItemMenu({ item, onClose, onFocusStock, hasLinkedStock }: {
  item: MListing
  onClose: () => void
  onFocusStock?: () => void
  hasLinkedStock?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-9 z-50 w-52 rounded-xl overflow-hidden shadow-2xl"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <a href={item.permalink} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        Abrir no ML
      </a>
      {hasLinkedStock && onFocusStock && (
        <button onClick={() => { onFocusStock(); onClose() }}
          className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          Atualizar estoque
        </button>
      )}
      {[
        { label: 'Ver visitas', key: 'visits' },
        { label: item.status === 'active' ? 'Pausar anúncio' : 'Ativar anúncio', key: 'toggle' },
      ].map(a => (
        <button key={a.key} onClick={onClose}
          className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
          {a.label}
        </button>
      ))}
      <button onClick={() => { navigator.clipboard.writeText(item.id); onClose() }}
        className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
        Copiar MLB ID
      </button>
    </div>
  )
}

// ── Listing card ───────────────────────────────────────────────────────────

function ListingCard({ item, selected, linked, stockInfo, onSelect, onCreateProduct, onLinkProduct, onUpdateStock }: {
  item: MListing
  selected: boolean
  linked: boolean
  stockInfo?: { stock_id: string; product_id: string; quantity: number }
  onSelect: (id: string) => void
  onCreateProduct: (id: string) => void
  onLinkProduct: () => void
  onUpdateStock: (listingId: string, stockId: string, newQty: number) => Promise<boolean>
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const stockRef = useRef<HTMLInputElement>(null)
  const [stockDraft,  setStockDraft]  = useState<string>(stockInfo ? String(stockInfo.quantity) : '')
  const [stockState,  setStockState]  = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  // Keep input in sync when the parent's stockInfo changes (after save/refresh)
  useEffect(() => {
    if (stockInfo) setStockDraft(String(stockInfo.quantity))
  }, [stockInfo?.quantity, stockInfo])

  async function commitStock() {
    if (!stockInfo) return
    const next = parseInt(stockDraft, 10)
    if (isNaN(next) || next < 0) {
      setStockDraft(String(stockInfo.quantity))
      return
    }
    if (next === stockInfo.quantity) return
    setStockState('saving')
    const ok = await onUpdateStock(item.id, stockInfo.stock_id, next)
    setStockState(ok ? 'success' : 'error')
    setTimeout(() => setStockState('idle'), 1200)
  }
  const fee      = item.price * feeRate(item.listing_type_id)
  const net      = item.price - fee
  const badges   = typeBadge(item.listing_type_id, item.logistic_type, item.catalog_listing)
  const isActive = item.status === 'active'
  const disc     = discountPct(item.original_price, item.price)
  const hasPromo = (item.deal_ids?.length ?? 0) > 0 || (item.promotions?.length ?? 0) > 0

  const compStatus = (() => {
    const t = item.catalog_listing_type_id?.toLowerCase() ?? ''
    if (t.includes('winning')) return { label: '🏆 Ganhando', bg: '#0d1f17', color: '#4ade80', border: 'rgba(34,197,94,.2)' }
    if (t.includes('losing'))  return { label: '📉 Perdendo', bg: '#1f0d0d', color: '#f87171', border: 'rgba(248,113,113,.2)' }
    return null
  })()

  const shippingLabel = (() => {
    if (item.logistic_type === 'fulfillment') return { text: 'Flex', bg: '#0e2a33', color: '#00E5FF', border: '#00E5FF22' }
    if (item.logistic_type === 'drop_off' || item.logistic_type === 'xd_drop_off') return { text: 'Coleta', bg: '#1a1a1f', color: '#71717a', border: '#27272a' }
    if (item.free_shipping) return null
    return { text: 'Comprador paga frete', bg: '#1a1a1f', color: '#52525b', border: '#1e1e24' }
  })()

  return (
    <div className="flex gap-3 p-4 rounded-xl transition-colors"
      style={{ background: '#0f0f12', border: `1px solid ${selected ? '#00E5FF33' : '#1a1a1f'}` }}>

      {/* Checkbox */}
      <div className="pt-0.5 shrink-0">
        <input type="checkbox" checked={selected} onChange={() => onSelect(item.id)}
          className="w-4 h-4 rounded accent-cyan-400 cursor-pointer" />
      </div>

      {/* Thumbnail */}
      <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 relative">
        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
        {disc && (
          <span className="absolute bottom-0 right-0 text-[9px] font-bold px-1 py-0.5 rounded-tl-md"
            style={{ background: '#22c55e', color: '#000' }}>
            -{disc}%
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {item.account_nickname && (() => {
            const p = accountPalette(item.account_seller_id)
            return (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
                {item.account_nickname}
              </span>
            )
          })()}
          {badges.map(b => (
            <span key={b.label} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
              {b.label}
            </span>
          ))}
          <span className="flex items-center gap-1 text-[10px] font-medium"
            style={{ color: isActive ? '#4ade80' : '#f87171' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? '#22c55e' : '#ef4444' }} />
            {isActive ? 'Ativo' : item.status === 'paused' ? 'Pausado' : item.status === 'closed' ? 'Finalizado' : 'Em revisão'}
          </span>
          {compStatus && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: compStatus.bg, color: compStatus.color, border: `1px solid ${compStatus.border}` }}>
              {compStatus.label}
            </span>
          )}
          {hasPromo && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#2a1500', color: '#fb923c', border: '1px solid rgba(251,146,60,.2)' }}>
              {(item.deal_ids?.length ?? 0) + (item.promotions?.length ?? 0)} Promoção
            </span>
          )}
          {linked && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
              📦 Produto vinculado
            </span>
          )}
        </div>

        <div className="flex items-start gap-1 mb-1.5">
          <a href={item.permalink} target="_blank" rel="noopener noreferrer"
            className="text-zinc-100 text-sm font-medium hover:text-cyan-300 transition-colors line-clamp-2 block flex-1">
            {item.title}
          </a>
          <Copy text={item.title} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mb-2">
          <span className="flex items-center font-mono text-zinc-400">
            {item.id}<Copy text={item.id} />
          </span>
          {item.sku && (
            <span className="flex items-center">
              SKU: <span className="text-zinc-400 ml-1">{item.sku}</span>
              <Copy text={item.sku} />
            </span>
          )}
          {item.catalog_product_id && (
            <span className="flex items-center">
              Cat: <span className="font-mono ml-1 text-zinc-400">{item.catalog_product_id}</span>
              <Copy text={item.catalog_product_id} />
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2">
          <span className="text-zinc-500">Disp: <span className="text-zinc-200 font-semibold">{num(item.available_quantity)}</span></span>
          <span className="text-zinc-500">Vendidos: <span className="text-zinc-200 font-semibold">{num(item.sold_quantity)}</span></span>
          <span className="text-zinc-600">📷 {item.pictures_count}</span>

          {/* Inline editable stock — visible affordance even at rest */}
          <span className="inline-flex items-center gap-1.5 text-zinc-500">
            Estoque:
            <input
              ref={stockRef}
              type="number"
              min={0}
              value={stockInfo ? stockDraft : ''}
              placeholder={stockInfo ? '' : '—'}
              onChange={e => setStockDraft(e.target.value)}
              onBlur={commitStock}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape' && stockInfo) {
                  setStockDraft(String(stockInfo.quantity))
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              disabled={!stockInfo || stockState === 'saving'}
              title={stockInfo ? '' : 'Vincule um produto para editar o estoque'}
              className="w-[70px] text-zinc-200 font-semibold tabular-nums text-xs px-2 py-1 rounded outline-none transition-colors disabled:cursor-not-allowed disabled:text-zinc-700"
              style={{
                background: '#0d0d10',
                border: `1px solid ${
                  stockState === 'success' ? '#22c55e' :
                  stockState === 'error'   ? '#ef4444' :
                  stockState === 'saving'  ? '#3f3f46' :
                  '#27272a'
                }`,
              }}
              onFocus={e => { if (stockState === 'idle') e.currentTarget.style.borderColor = '#00E5FF' }}
              onBlurCapture={e => { if (stockState === 'idle') e.currentTarget.style.borderColor = '#27272a' }}
            />
          </span>

          <span className="text-zinc-600">Atualizado {ago(item.last_updated)}</span>
          {item.has_variations && (
            <span className="text-cyan-500 font-medium cursor-pointer hover:text-cyan-300 text-xs">Ver variações</span>
          )}
        </div>

        {(item.health_score != null || item.health_status != null) && (
          <div className="flex items-start gap-3 mt-2 pt-2" style={{ borderTop: '1px solid #1e1e24' }}>
            <SemiGauge score={item.health_score} label="Qualidade"
              sub={item.health_reasons.length > 0 ? `${item.health_reasons.length} ponto${item.health_reasons.length > 1 ? 's' : ''}` : undefined} />
            <SemiGauge score={null} label="Experiência"
              sub={item.health_status === 'good' ? 'Ótima' : item.health_status === 'with_issues' ? 'Com problemas' : item.health_status === 'bad' ? 'Crítica' : undefined} />
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.free_shipping && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#0d1f17', border: '1px solid rgba(34,197,94,.2)', color: '#4ade80' }}>
              Frete grátis
            </span>
          )}
          {shippingLabel && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: shippingLabel.bg, color: shippingLabel.color, border: `1px solid ${shippingLabel.border}` }}>
              {shippingLabel.text}
            </span>
          )}
          {item.tags.includes('good_seller') && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: '#0e2a33', border: '1px solid #00E5FF1a', color: '#67e8f9' }}>
              Bom vendedor
            </span>
          )}
          {item.tags.includes('dragged_bids_and_visits') && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: '#1f1a00', border: '1px solid #fbbf2422', color: '#fbbf24' }}>
              Destaque
            </span>
          )}
        </div>
      </div>

      {/* Price card */}
      <div className="shrink-0 w-44 flex flex-col items-end gap-1.5">
        <div className="text-right">
          {disc && item.original_price && (
            <div className="flex items-center gap-1.5 justify-end">
              <p className="text-zinc-600 text-[11px] line-through">{brl(item.original_price)}</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#0d1f17', color: '#4ade80' }}>-{disc}%</span>
            </div>
          )}
          <p className="text-white text-xl font-bold leading-tight">{brl(item.price)}</p>
          <p className="text-emerald-400 text-xs font-semibold mt-0.5">Líquido: {brl(net)}</p>
        </div>

        <div className="w-full text-[11px] pt-2 space-y-1" style={{ borderTop: '1px solid #1e1e24' }}>
          <div className="flex justify-between text-zinc-600">
            <span>Tarifa ML ({(feeRate(item.listing_type_id) * 100).toFixed(1)}%)</span>
            <span className="text-red-400/80">-{brl(fee)}</span>
          </div>
          <div className="flex justify-between text-zinc-600">
            <span>Frete vendedor</span>
            <span>{item.free_shipping ? 'Incluso' : 'Comprador'}</span>
          </div>
        </div>

        {/* Ações principais — visíveis no card. Criar/Vincular só quando o
            anúncio ainda não tem produto vinculado. SEO IA sempre. */}
        <div className="w-full flex flex-col gap-1 mt-1">
          {!linked && (
            <>
              <button onClick={() => onCreateProduct(item.id)}
                className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors"
                style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Criar produto
              </button>
              <button onClick={onLinkProduct}
                className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors hover:text-white"
                style={{ background: '#1a1a1f', border: '1px solid #27272a', color: '#a1a1aa' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5m6.656-1.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
                </svg>
                Vincular produto
              </button>
            </>
          )}
          <a href={`/dashboard/listings/seo-optimizer?mlbId=${item.id}`}
            className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors"
            style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF' }}
            title="Analisa o SEO desse anúncio e sugere melhorias respeitando travas do ML">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Otimizar SEO IA
          </a>
        </div>

        <div className="relative mt-1">
          <button onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:text-white"
            style={{ background: '#1a1a1f', border: '1px solid #27272a', color: '#a1a1aa' }}>
            Ações
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {menuOpen && (
            <ItemMenu
              item={item}
              onClose={() => setMenuOpen(false)}
              hasLinkedStock={!!stockInfo}
              onFocusStock={() => { stockRef.current?.focus(); stockRef.current?.select() }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Confirm create modal ───────────────────────────────────────────────────

function ConfirmCreateModal({
  count, items, creating, onConfirm, onClose,
}: {
  count: number
  items: MListing[]
  creating: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden"
        style={{ background: '#111114', border: '1px solid #1e1e24', maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid #1e1e24' }}>
          <div>
            <p className="text-white text-sm font-semibold">Criar Produtos a partir de Anúncios</p>
            <p className="text-zinc-500 text-xs mt-0.5">{count} anúncio{count > 1 ? 's' : ''} selecionado{count > 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: '#1e1e24' }}>
          {items.length > 0 ? items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3">
              {item.thumbnail
                ? <img src={item.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" style={{ background: '#1c1c1f' }} />
                : <div className="w-10 h-10 rounded-lg shrink-0" style={{ background: '#1c1c1f' }} />
              }
              <div className="flex-1 min-w-0">
                <p className="text-zinc-100 text-xs font-medium truncate">{item.title || item.id}</p>
                <p className="text-zinc-500 text-[10px] mt-0.5">
                  {item.id}{item.sku ? ` · SKU: ${item.sku}` : ''}
                </p>
              </div>
              {item.price > 0 && <p className="text-white text-sm font-bold shrink-0">{brl(item.price)}</p>}
            </div>
          )) : (
            <div className="px-5 py-4 text-zinc-500 text-sm">
              {count} anúncio{count > 1 ? 's' : ''} selecionado{count > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Notice */}
        <div className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid #1e1e24', background: 'rgba(0,229,255,0.04)' }}>
          <p className="text-[11px]" style={{ color: '#71717a' }}>
            ℹ️ Os produtos serão criados com os dados disponíveis do Mercado Livre. Você poderá editar custo e imposto depois.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 shrink-0"
          style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} disabled={creating}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={creating}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: '#00E5FF', color: '#000' }}>
            {creating && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {creating ? 'Criando…' : `Confirmar e Criar ${count} Produto${count > 1 ? 's' : ''} →`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Result modal ───────────────────────────────────────────────────────────

function ResultModal({
  results, loading, onClose,
}: {
  results: CreateResult[]
  loading: boolean
  onClose: () => void
}) {
  const router  = useRouter()
  const created = results.filter(r => r.status === 'created').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errors  = results.filter(r => r.status === 'error').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden"
        style={{ background: '#111114', border: '1px solid #1e1e24', maxHeight: '80vh' }}>

        {/* Header */}
        <div className="px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <p className="text-white text-sm font-semibold">Resultado da criação</p>
          {!loading && results.length > 0 && (
            <div className="flex gap-4 mt-2">
              {created > 0 && <span className="text-[11px] font-semibold" style={{ color: '#4ade80' }}>✅ {created} criado{created > 1 ? 's' : ''}</span>}
              {skipped > 0 && <span className="text-[11px] font-semibold" style={{ color: '#f59e0b' }}>⚠️ {skipped} ignorado{skipped > 1 ? 's' : ''}</span>}
              {errors  > 0 && <span className="text-[11px] font-semibold" style={{ color: '#f87171' }}>❌ {errors} erro{errors > 1 ? 's' : ''}</span>}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 80 }}>
          {loading ? (
            <div className="flex items-center gap-3 px-5 py-8 text-zinc-400">
              <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Criando produtos...</span>
            </div>
          ) : results.length === 0 ? (
            <p className="text-zinc-500 text-sm px-5 py-8">Nenhum resultado.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#1e1e24' }}>
              {results.map(r => {
                const icon  = r.status === 'created' ? '✅' : r.status === 'skipped' ? '⚠️' : '❌'
                const color = r.status === 'created' ? '#4ade80' : r.status === 'skipped' ? '#f59e0b' : '#f87171'
                return (
                  <div key={r.listing_id} className="flex items-start gap-3 px-5 py-3">
                    <span className="text-base shrink-0 mt-0.5">{icon}</span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-mono font-semibold" style={{ color }}>{r.listing_id}</p>
                      <p className="text-zinc-500 text-[11px] mt-0.5">
                        {r.status === 'created' ? 'Produto criado com sucesso'
                          : r.status === 'skipped' ? (r.reason ?? 'Ignorado')
                          : (r.reason ?? 'Erro ao criar')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 shrink-0"
          style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-40"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Fechar
          </button>
          {!loading && created > 0 && (
            <button onClick={() => router.push('/dashboard/produtos')}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: '#00E5FF', color: '#000' }}>
              Ver Produtos Criados →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Link-to-product modal ──────────────────────────────────────────────────
// Permite selecionar UM produto do catálogo e vincular vários anúncios
// (multi-conta consciente: cada anúncio carrega seu account_seller_id pra
// gravar `account_id` em product_listings).

type ProductOption = {
  id:          string
  name:        string
  sku:         string | null
  cost_price:  number | null
  photo_urls:  string[] | null
}

type BulkLinkResult = {
  created: number
  skipped: number
  errors:  number
  results: Array<{ listing_id: string; status: 'created' | 'skipped' | 'error'; message?: string }>
}

function LinkToProductModal({
  selectedItems, linking, onConfirm, onClose,
}: {
  selectedItems: MListing[]
  linking: boolean
  onConfirm: (productId: string, productLabel: string, qtyPerUnit: number) => void
  onClose: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<ProductOption | null>(null)
  const [qtyPerUnit, setQtyPerUnit] = useState('1')

  // Busca produtos com debounce — Supabase direto (usa RLS por org)
  useEffect(() => {
    const term = search.trim()
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
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
    return () => { cancelled = true; clearTimeout(t) }
  }, [search, supabase])

  // Agrupa selecionados por conta pra exibir breakdown multi-conta
  const byAccount = useMemo(() => {
    const m = new Map<string, { nickname: string; sellerId: number | null; items: MListing[] }>()
    for (const it of selectedItems) {
      const key = it.account_nickname ?? `seller-${it.account_seller_id ?? 'unknown'}`
      if (!m.has(key)) m.set(key, { nickname: it.account_nickname ?? 'Conta sem nickname', sellerId: it.account_seller_id, items: [] })
      m.get(key)!.items.push(it)
    }
    return [...m.values()]
  }, [selectedItems])

  const count = selectedItems.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl rounded-2xl flex flex-col overflow-hidden"
        style={{ background: '#111114', border: '1px solid #1e1e24', maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid #1e1e24' }}>
          <div>
            <p className="text-white text-sm font-semibold">Vincular Anúncios a um Produto</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              {count} anúncio{count > 1 ? 's' : ''} selecionado{count > 1 ? 's' : ''}
              {byAccount.length > 1 && ` · ${byAccount.length} contas`}
            </p>
          </div>
          <button onClick={onClose} disabled={linking}
            className="text-zinc-500 hover:text-white transition-colors disabled:opacity-40">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Multi-account breakdown */}
        {byAccount.length > 1 && (
          <div className="px-5 py-2 shrink-0" style={{ background: 'rgba(0,229,255,0.04)', borderBottom: '1px solid #1e1e24' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Multi-conta:</span>
              {byAccount.map((g, idx) => {
                const palette = accountPalette(g.sellerId)
                return (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                    style={{ background: palette.bg, borderColor: palette.border, color: palette.color }}>
                    {g.nickname}
                    <span className="text-zinc-500">({g.items.length})</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #1e1e24' }}>
          <input
            type="text"
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produto por nome ou SKU…"
            className="w-full px-4 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#09090b', border: '1px solid #27272a', color: '#fafafa' }}
            disabled={linking}
          />
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 120 }}>
          {searching && products.length === 0 ? (
            <p className="text-zinc-500 text-sm px-5 py-6">Buscando produtos…</p>
          ) : products.length === 0 ? (
            <p className="text-zinc-500 text-sm px-5 py-6">Nenhum produto encontrado.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#1e1e24' }}>
              {products.map(p => {
                const isPicked = picked?.id === p.id
                const thumb = p.photo_urls?.[0] ?? null
                return (
                  <button
                    key={p.id}
                    onClick={() => setPicked(p)}
                    disabled={linking}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                    style={{ background: isPicked ? 'rgba(0,229,255,0.08)' : 'transparent' }}
                    onMouseEnter={e => { if (!isPicked) e.currentTarget.style.background = '#15151a' }}
                    onMouseLeave={e => { if (!isPicked) e.currentTarget.style.background = 'transparent' }}>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" style={{ background: '#1c1c1f' }} />
                    ) : (
                      <div className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center text-zinc-700"
                        style={{ background: '#1c1c1f' }}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-100 text-xs font-medium truncate">{p.name}</p>
                      <p className="text-zinc-500 text-[10px] mt-0.5">
                        {p.sku ? `SKU: ${p.sku}` : 'sem SKU'}
                        {p.cost_price != null && ` · custo ${brl(Number(p.cost_price))}`}
                      </p>
                    </div>
                    {isPicked && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
                        style={{ background: 'rgba(0,229,255,0.15)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.4)' }}>
                        Selecionado
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Picked summary + qty input */}
        {picked && (
          <div className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid #1e1e24', background: '#0c0c0f' }}>
            <p className="text-zinc-300 text-xs">
              <span className="text-zinc-500">Vincular </span>
              <span className="text-cyan-300 font-semibold">{count} anúncio{count > 1 ? 's' : ''}</span>
              <span className="text-zinc-500"> ao produto </span>
              <span className="text-white font-semibold">{picked.name}</span>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <label className="text-[11px] text-zinc-500">Qtd por unidade:</label>
              <input
                type="number"
                min={1}
                value={qtyPerUnit}
                onChange={e => setQtyPerUnit(e.target.value)}
                disabled={linking}
                className="w-16 px-2 py-1 rounded text-xs text-center outline-none"
                style={{ background: '#09090b', border: '1px solid #27272a', color: '#fafafa' }}
              />
              <span className="text-[10px] text-zinc-600">
                (kits: quantos do produto = 1 unidade do anúncio)
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 shrink-0"
          style={{ borderTop: '1px solid #1e1e24' }}>
          <button onClick={onClose} disabled={linking}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50"
            style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
            Cancelar
          </button>
          <button
            onClick={() => picked && onConfirm(picked.id, picked.name, Number(qtyPerUnit) || 1)}
            disabled={linking || !picked}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: '#00E5FF', color: '#000' }}>
            {linking && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {linking ? 'Vinculando…' : `Vincular ${count} →`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────

function Pagination({ page, total, size, onChange }: {
  page: number; total: number; size: number; onChange: (p: number) => void
}) {
  const last = Math.max(0, Math.ceil(total / size) - 1)
  if (last === 0) return null

  const pages: (number | '…')[] = []
  if (last < 7) for (let i = 0; i <= last; i++) pages.push(i)
  else {
    pages.push(0)
    if (page > 2) pages.push('…')
    for (let i = Math.max(1, page - 1); i <= Math.min(last - 1, page + 1); i++) pages.push(i)
    if (page < last - 2) pages.push('…')
    pages.push(last)
  }

  const btn = (label: string, p: number, disabled: boolean) => (
    <button onClick={() => onChange(p)} disabled={disabled}
      className="px-2 py-1.5 rounded-lg text-xs text-zinc-400 disabled:opacity-25 hover:text-white hover:bg-zinc-800 transition-colors">
      {label}
    </button>
  )

  return (
    <div className="flex items-center justify-between pt-5">
      <p className="text-zinc-600 text-xs">{num(total)} anúncio{total !== 1 ? 's' : ''}</p>
      <div className="flex items-center gap-1">
        {btn('«', 0, page === 0)}
        {btn('‹', page - 1, page === 0)}
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="text-zinc-700 text-xs px-1">…</span>
            : <button key={p} onClick={() => onChange(p as number)}
                className="w-7 h-7 rounded-lg text-xs font-medium transition-colors"
                style={p === page ? { background: '#00E5FF', color: '#000' } : { color: '#71717a' }}>
                {(p as number) + 1}
              </button>
        )}
        {btn('›', page + 1, page === last)}
        {btn('»', last, page === last)}
      </div>
    </div>
  )
}

// ── Active filter chip (filtros avançados ML) ────────────────────────────────

function ChipML({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
      style={{ background: 'rgba(0,229,255,0.06)', borderColor: 'rgba(0,229,255,0.25)', color: '#67e8f9' }}>
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors -mr-0.5"
        aria-label={`Remover filtro ${label}`}>
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function MLAnunciosPage() {
  const supabase = useMemo(() => createClient(), [])

  const [tab, setTab]     = useState<Tab>('active')
  const [page, setPage]   = useState(0)
  const [q, setQ]         = useState('')
  const [items, setItems] = useState<MListing[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Counts>({})
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toasts, setToasts]     = useState<Toast[]>([])

  // Create-from-listing state
  const [pendingIds, setPendingIds]         = useState<string[]>([])
  const [confirmOpen, setConfirmOpen]       = useState(false)
  const [creating, setCreating]             = useState(false)
  const [results, setResults]               = useState<CreateResult[] | null>(null)
  const [loadingCriacao, setLoadingCriacao] = useState(false)
  const [linkedIds, setLinkedIds]           = useState<Set<string>>(new Set())
  // Link-to-product state — modal abre com os anúncios-alvo (linkTargets) e
  // exige escolha de UM produto + qty_per_unit. linkTargets é setado pelo
  // bulk (selecionados não-vinculados) OU pelo botão de vínculo de 1 card.
  const [linkOpen, setLinkOpen]             = useState(false)
  const [linking, setLinking]               = useState(false)
  const [linkTargets, setLinkTargets]       = useState<MListing[]>([])
  // Map listing_id -> stock info (filled from Supabase). Used to render the
  // inline stock input on each card and to compute the page-total KPI.
  const [stockMap, setStockMap]             = useState<Map<string, { stock_id: string; product_id: string; quantity: number }>>(new Map())

  // Filtros avançados
  const [advOpen, setAdvOpen]                 = useState(false)
  const [filterListingType, setFilterListingType] = useState<'all' | 'premium' | 'gold' | 'classic'>('all')
  const [filterLogistic, setFilterLogistic]   = useState<'all' | 'fulfillment' | 'cross_docking' | 'self_service' | 'drop_off'>('all')
  const [filterFlags, setFilterFlags]         = useState({
    promo:           false,
    noLink:          false,
    noCost:          false,
    noPhoto:         false,
    zeroStockActive: false,
    noCampaign:      false,
    badHealth:       false,  // health_status diferente de 'active' / null (warning/risk/critical)
  })
  // Map listing_id → cost_price (vinculado e com cost cadastrado)
  const [costMap, setCostMap] = useState<Record<string, number | null>>({})
  const [adItems, setAdItems] = useState<Set<string>>(new Set())

  const tid = useRef(0)
  const PAGE = 20

  function toast(msg: string, type: Toast['type'] = 'info') {
    const id = ++tid.current
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }

  // ── Auth ───────────────────────────────────────────────────────────────

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Não autenticado')
    return { Authorization: `Bearer ${session.access_token}` }
  }, [supabase])

  // Conta ML selecionada (multi-conta). `selected=null` = todas as contas.
  // O hook tem custom event que dispara re-render quando o dropdown muda,
  // então o useEffect que depende de `selectedSellerId` refaz fetch.
  const { selected: selectedSellerId } = useMlAccount()

  // ── Load counts ────────────────────────────────────────────────────────

  const loadCounts = useCallback(async () => {
    try {
      const headers = await getHeaders()
      const qs = selectedSellerId != null ? `?seller_id=${selectedSellerId}` : ''
      const res = await fetch(`${BACKEND}/ml/listings/counts${qs}`, { headers })
      if (res.ok) setCounts(await res.json())
    } catch { /* silent */ }
  }, [getHeaders, selectedSellerId])

  // ── Load items ─────────────────────────────────────────────────────────

  const loadItems = useCallback(async (currentTab: Tab, currentPage: number, query: string) => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const params  = new URLSearchParams({
        status: currentTab,
        offset: String(currentPage * PAGE),
        limit: String(PAGE),
      })
      // Busca unificada — o backend resolve título / SKU / código MLB.
      if (query.trim()) params.set('q', query.trim())
      if (selectedSellerId != null) params.set('seller_id', String(selectedSellerId))
      const res  = await fetch(`${BACKEND}/ml/listings?${params}`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      const list: MListing[] = body.items ?? []

      setItems(list)
      setTotal(body.total ?? 0)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao carregar anúncios', 'error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [getHeaders, selectedSellerId])

  // ── Initial + reactive loads ───────────────────────────────────────────

  useEffect(() => { loadCounts() }, [loadCounts])
  useEffect(() => { loadItems(tab, page, q) }, [tab, page, loadItems])
  // Quando troca de conta, volta pra página 0 e limpa seleção pra evitar
  // operar em IDs que sumiram do filtro atual.
  useEffect(() => { setPage(0); setSelected(new Set()) }, [selectedSellerId])

  // Load linked listing IDs (used by the "Produto vinculado" badge) AND
  // the per-listing stock map (used by the inline stock input on each card).
  // Done in a single Supabase round-trip to avoid duplicate network cost.
  const loadStockMap = useCallback(async () => {
    type Row = {
      listing_id: string
      product_id: string
      products: {
        product_stock: Array<{ id: string; quantity: number; platform: string | null }> | null
      } | null
    }
    const { data, error } = await supabase
      .from('product_listings')
      .select('listing_id, product_id, products(product_stock(id, quantity, platform))')
      .eq('platform', 'mercadolivre')
      .eq('is_active', true)

    if (error || !data) return

    const ids = new Set<string>()
    const map = new Map<string, { stock_id: string; product_id: string; quantity: number }>()
    for (const r of data as unknown as Row[]) {
      if (!r.listing_id) continue
      ids.add(r.listing_id)
      // Use the "shared" stock row (platform IS NULL) — what the rest of the
      // app treats as the canonical product_stock for an SKU.
      const shared = r.products?.product_stock?.find(s => s.platform === null)
      if (shared) {
        map.set(r.listing_id, {
          stock_id:   shared.id,
          product_id: r.product_id,
          quantity:   Number(shared.quantity ?? 0),
        })
      }
    }
    setLinkedIds(ids)
    setStockMap(map)
  }, [supabase])

  useEffect(() => { loadStockMap() }, [loadStockMap])

  // Fetch cost_price por listing + campanhas ML Ads ativas (pra "sem custo" / "sem campanha")
  useEffect(() => {
    if (items.length === 0) return
    const ids = items.map(i => i.id)
    ;(async () => {
      const [linkRes, campsRes] = await Promise.all([
        supabase
          .from('product_listings')
          .select('listing_id, product:products(cost_price)')
          .in('listing_id', ids)
          .eq('platform', 'mercadolivre'),
        supabase
          .from('ml_ads_campaigns')
          .select('items')
          .eq('status', 'active'),
      ])
      type LinkRow = { listing_id: string; product: { cost_price: number | null } | { cost_price: number | null }[] | null }
      const cm: Record<string, number | null> = {}
      for (const r of (linkRes.data ?? []) as LinkRow[]) {
        const prod = Array.isArray(r.product) ? r.product[0] : r.product
        cm[r.listing_id] = prod?.cost_price ?? null
      }
      const inCamps = new Set<string>()
      for (const c of (campsRes.data ?? []) as Array<{ items: string[] | null }>) {
        for (const it of c.items ?? []) inCamps.add(it)
      }
      setCostMap(cm)
      setAdItems(inCamps)
    })()
  }, [items, supabase])

  // Aplica filtros avançados sobre items (server já filtra por status/q via API)
  const displayedItems = useMemo(() => {
    let list = items

    if (filterListingType !== 'all') {
      list = list.filter(l => {
        if (filterListingType === 'premium') return l.listing_type_id === 'gold_pro' || l.listing_type_id === 'gold_premium'
        if (filterListingType === 'gold')    return l.listing_type_id === 'gold_special'
        if (filterListingType === 'classic') return !l.listing_type_id?.startsWith('gold')
        return true
      })
    }
    if (filterLogistic !== 'all')        list = list.filter(l => l.logistic_type === filterLogistic)
    if (filterFlags.promo)               list = list.filter(l => l.original_price != null && l.original_price > l.price)
    if (filterFlags.noLink)              list = list.filter(l => !linkedIds.has(l.id))
    if (filterFlags.noCost)              list = list.filter(l => linkedIds.has(l.id) && !((costMap[l.id] ?? 0) > 0))
    if (filterFlags.noPhoto)             list = list.filter(l => l.pictures_count === 0)
    if (filterFlags.zeroStockActive)     list = list.filter(l => l.available_quantity === 0 && l.status === 'active')
    if (filterFlags.noCampaign)          list = list.filter(l => !adItems.has(l.id))
    if (filterFlags.badHealth)           list = list.filter(l => l.health_status != null && l.health_status !== 'active' && l.health_status !== 'good')

    return list
  }, [items, filterListingType, filterLogistic, filterFlags, linkedIds, costMap, adItems])

  const flagCounts = useMemo(() => ({
    promo:           items.filter(l => l.original_price != null && l.original_price > l.price).length,
    noLink:          items.filter(l => !linkedIds.has(l.id)).length,
    noCost:          items.filter(l => linkedIds.has(l.id) && !((costMap[l.id] ?? 0) > 0)).length,
    noPhoto:         items.filter(l => l.pictures_count === 0).length,
    zeroStockActive: items.filter(l => l.available_quantity === 0 && l.status === 'active').length,
    noCampaign:      items.filter(l => !adItems.has(l.id)).length,
    badHealth:       items.filter(l => l.health_status != null && l.health_status !== 'active' && l.health_status !== 'good').length,
  }), [items, linkedIds, costMap, adItems])

  const advCount =
    (filterListingType !== 'all' ? 1 : 0) +
    (filterLogistic !== 'all' ? 1 : 0) +
    Object.values(filterFlags).filter(Boolean).length

  function clearAdv() {
    setFilterListingType('all'); setFilterLogistic('all')
    setFilterFlags({ promo: false, noLink: false, noCost: false, noPhoto: false, zeroStockActive: false, noCampaign: false, badHealth: false })
  }

  // Optimistic update + PATCH the new stock value. Returns true on success.
  // Called by ListingCard's inline stock input on blur/Enter.
  const updateLinkedStock = useCallback(async (listingId: string, stockId: string, newQty: number): Promise<boolean> => {
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/products/stock/${stockId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQty }),
      })
      if (!res.ok) return false
      setStockMap(prev => {
        const next = new Map(prev)
        const cur = next.get(listingId)
        if (cur) next.set(listingId, { ...cur, quantity: newQty })
        return next
      })
      return true
    } catch {
      return false
    }
  }, [getHeaders])

  function handleTabChange(t: Tab) { setTab(t); setPage(0); setSelected(new Set()) }
  function handleSearch() { setPage(0); loadItems(tab, 0, q) }

  // ── Sync ───────────────────────────────────────────────────────────────

  async function handleSync() {
    setSyncing(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/my-items`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      toast(`${body.items?.length ?? 0} anúncios encontrados no ML`, 'success')
      loadItems(tab, page, q)
      loadCounts()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao sincronizar', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // ── Select helpers ─────────────────────────────────────────────────────
  // Usa displayedItems pra select-all respeitar filtros avançados.

  const allSelected = displayedItems.length > 0 && displayedItems.every(i => selected.has(i.id))

  function toggleAll() {
    if (allSelected) setSelected(s => { const n = new Set(s); displayedItems.forEach(i => n.delete(i.id)); return n })
    else             setSelected(s => { const n = new Set(s); displayedItems.forEach(i => n.add(i.id));    return n })
  }

  // ── Create from listing ────────────────────────────────────────────────

  function openCreateConfirm(ids: string[]) {
    if (ids.length === 0) return
    console.log('[criar-produto] openCreateConfirm ids:', ids)
    setPendingIds(ids)
    setConfirmOpen(true)
  }

  async function handleCreateConfirm() {
    if (pendingIds.length === 0) return
    // Close confirm, open result modal immediately with loading state
    setConfirmOpen(false)
    setCreating(true)
    setResults([])
    setLoadingCriacao(true)

    console.log('[criar-produto] selecionados:', pendingIds)

    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/ml/products/from-listing`, {
        method:  'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ listing_ids: pendingIds }),
      })
      const data = await res.json()
      console.log('[criar-produto] resposta status:', res.status, '| body:', data)

      const r: CreateResult[] = data.results || []
      if (!res.ok && r.length === 0) {
        // Backend returned an error without results array
        setResults([{ listing_id: pendingIds[0] ?? '?', status: 'error', reason: data.message ?? `HTTP ${res.status}` }])
      } else {
        setResults(r)
      }

      setSelected(new Set())
      const created = r.filter(x => x.status === 'created').length
      if (created > 0) {
        toast(`${created} produto${created > 1 ? 's' : ''} criado${created > 1 ? 's' : ''}!`, 'success')
        // Refresh linked IDs + stock map so the badge AND the inline stock
        // input appear immediately on freshly-created products
        loadStockMap()
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao criar produtos'
      setResults([{ listing_id: pendingIds[0] ?? '?', status: 'error', reason: msg }])
      toast(msg, 'error')
    } finally {
      setCreating(false)
      setLoadingCriacao(false)
    }
  }

  // ── Bulk-link to product ──────────────────────────────────────────────
  // Coleta selecionados, filtra os que já estão vinculados (so para os não-
  // vinculados é que faz sentido vincular) e abre o picker de produto.
  // Filtragem é client-side via linkedIds que já vem carregado.

  const unlinkedSelected = useMemo(
    () => items.filter(i => selected.has(i.id) && !linkedIds.has(i.id)),
    [items, selected, linkedIds],
  )

  function openLinkModal() {
    if (unlinkedSelected.length === 0) {
      toast('Todos os selecionados já estão vinculados a algum produto.', 'info')
      return
    }
    setLinkTargets(unlinkedSelected)
    setLinkOpen(true)
  }

  /** Abre o modal de vínculo pra UM anúncio (botão do card). */
  function openSingleLink(item: MListing) {
    setLinkTargets([item])
    setLinkOpen(true)
  }

  async function handleBulkLink(productId: string, productLabel: string, qtyPerUnit: number) {
    if (linkTargets.length === 0) return
    setLinking(true)
    try {
      const headers = await getHeaders()
      const payload = {
        product_id: productId,
        platform:   'mercadolivre',
        items: linkTargets.map(it => ({
          listing_id:        it.id,
          quantity_per_unit: qtyPerUnit,
          // account_id armazena seller_id como text (multi-conta). Cada
          // anúncio carrega sua própria conta — o batch pode misturar.
          account_id:        it.account_seller_id != null ? String(it.account_seller_id) : null,
          listing_title:     it.title ?? null,
          listing_price:     it.price ?? null,
          listing_thumbnail: it.thumbnail ?? null,
          listing_permalink: it.permalink ?? null,
        })),
      }
      const res = await fetch(`${BACKEND}/products/vinculos/bulk`, {
        method:  'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const body = (await res.json().catch(() => ({}))) as Partial<BulkLinkResult> & { message?: string }
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`)

      const created = body.created ?? 0
      const skipped = body.skipped ?? 0
      const errors  = body.errors  ?? 0
      const partsTxt: string[] = []
      if (created > 0) partsTxt.push(`${created} vinculado${created > 1 ? 's' : ''}`)
      if (skipped > 0) partsTxt.push(`${skipped} já existia${skipped > 1 ? 'm' : ''}`)
      if (errors  > 0) partsTxt.push(`${errors} erro${errors > 1 ? 's' : ''}`)
      const msg = `${partsTxt.join(' · ')} → ${productLabel}`
      toast(msg, errors > 0 ? 'error' : 'success')

      setLinkOpen(false)
      setSelected(new Set())
      // Refresh linked IDs + stock map pra badges atualizarem imediatamente
      loadStockMap()
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao vincular', 'error')
    } finally {
      setLinking(false)
    }
  }

  // ── KPIs derived ──────────────────────────────────────────────────────

  // Page-total stock: prefer the linked product's quantity (more accurate
  // than ML's available_quantity which can be stale), fallback to ML value
  // for unlinked items.
  const stockTotal = items.reduce((a, i) => {
    const linked = stockMap.get(i.id)
    return a + (linked ? linked.quantity : i.available_quantity)
  }, 0)

  // ── Tabs config ───────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string }[] = [
    { key: 'active',       label: 'Ativos' },
    { key: 'paused',       label: 'Pausados' },
    { key: 'closed',       label: 'Finalizados' },
    { key: 'under_review', label: 'Em revisão' },
  ]

  // Pending items objects for confirm modal
  const pendingItems = items.filter(i => pendingIds.includes(i.id))

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh' }}
      className={`p-6 space-y-5 ${selected.size > 0 ? 'pb-24' : ''}`}>
      <Toasts list={toasts} />

      {/* ── Header ──────────────────────────────────────────────────
          Toolbar compacto: título à esquerda, seletor de conta ML +
          botão sync à direita. Sync menor (px-3 py-1.5) pra equiparar
          com o select e não roubar atenção visual. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Catálogo · Anúncios</p>
          <h1 className="text-white text-2xl font-semibold">Mercado Livre</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Multi-conta: filtra anúncios pela conta selecionada (default
              = todas). Quando há 1 só conta, vira read-only. localStorage
              persiste seleção entre páginas. */}
          <AccountSelector compact label="Conta" hideWhenEmpty />
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: syncing ? '#0e2a33' : '#00E5FF', color: syncing ? '#00E5FF' : '#000',
              border: syncing ? '1px solid #00E5FF33' : 'none', opacity: syncing ? 0.8 : 1 }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              style={{ animation: syncing ? 'spin 1s linear infinite' : undefined }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Sincronizando…' : 'Sincronizar ML'}
          </button>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Anúncios ativos',   value: num(counts.active  ?? 0), sub: 'publicados',       color: '#22c55e' },
          { label: 'Anúncios pausados', value: num(counts.paused  ?? 0), sub: 'fora do ar',       color: '#f87171' },
          { label: 'Em revisão',        value: num(counts.under_review ?? 0), sub: 'aguardando',  color: '#fbbf24' },
          { label: 'Estoque (pág.)',    value: num(stockTotal),            sub: 'itens disponíveis', color: '#00E5FF' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            <p className="text-zinc-500 text-xs mb-2">{kpi.label}</p>
            <p className="text-2xl font-bold leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-zinc-600 text-xs mt-1.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Search bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Buscar por título, SKU ou código MLB…"
          className="text-sm px-4 py-2 rounded-xl text-zinc-200 placeholder-zinc-600 outline-none w-96 max-w-full"
          style={{ background: '#111114', border: '1px solid #27272a' }}
        />
        <button onClick={handleSearch}
          className="text-sm px-5 py-2 rounded-xl font-semibold transition-opacity hover:opacity-90"
          style={{ background: '#00E5FF', color: '#000' }}>
          Buscar
        </button>
        {q && (
          <button onClick={() => { setQ(''); loadItems(tab, 0, '') }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2">
            Limpar
          </button>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid #1a1a1f' }}>
        {TABS.map(t => {
          const count = counts[t.key] ?? 0
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => handleTabChange(t.key)}
              className="px-4 py-2.5 text-sm font-medium transition-colors relative"
              style={active
                ? { color: '#00E5FF', borderBottom: '2px solid #00E5FF', marginBottom: -1 }
                : { color: '#52525b' }}>
              {t.label}
              {count > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={active
                    ? { background: '#00E5FF1a', color: '#00E5FF' }
                    : { background: '#1a1a1f', color: '#3f3f46' }}>
                  {num(count)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Filtros avançados ──────────────────────────────────────── */}
      <div>
        <button onClick={() => setAdvOpen(v => !v)}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-all mb-3"
          style={{
            background: advCount > 0 ? 'rgba(0,229,255,0.08)' : '#111114',
            border: `1px solid ${advCount > 0 || advOpen ? '#00E5FF' : '#27272a'}`,
            color: advCount > 0 || advOpen ? '#00E5FF' : '#e4e4e7',
          }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filtros avançados
          {advCount > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full" style={{ background: '#00E5FF', color: '#000' }}>{advCount}</span>}
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ transform: advOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s', opacity: 0.7, marginLeft: 2 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {advOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl mb-4"
            style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
            {/* Tipo de listagem */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Tipo de listagem</p>
              <div className="flex flex-wrap gap-1">
                {([
                  { v: 'all',     label: 'Todos' },
                  { v: 'premium', label: 'Premium' },
                  { v: 'gold',    label: 'Ouro' },
                  { v: 'classic', label: 'Clássico' },
                ] as const).map(o => (
                  <button key={o.v} onClick={() => setFilterListingType(o.v)}
                    className="px-2 py-1 rounded-md text-[11px] font-medium border transition-all"
                    style={{
                      background: filterListingType === o.v ? 'rgba(0,229,255,0.08)' : 'transparent',
                      borderColor: filterListingType === o.v ? '#00E5FF' : '#27272a',
                      color: filterListingType === o.v ? '#00E5FF' : '#a1a1aa',
                    }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Logística */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Logística</p>
              <div className="flex flex-wrap gap-1">
                {([
                  { v: 'all',           label: 'Todos' },
                  { v: 'fulfillment',   label: 'Full' },
                  { v: 'cross_docking', label: 'Coleta' },
                  { v: 'self_service',  label: 'Self' },
                  { v: 'drop_off',      label: 'Agência' },
                ] as const).map(o => (
                  <button key={o.v} onClick={() => setFilterLogistic(o.v)}
                    className="px-2 py-1 rounded-md text-[11px] font-medium border transition-all"
                    style={{
                      background: filterLogistic === o.v ? 'rgba(0,229,255,0.08)' : 'transparent',
                      borderColor: filterLogistic === o.v ? '#00E5FF' : '#27272a',
                      color: filterLogistic === o.v ? '#00E5FF' : '#a1a1aa',
                    }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Atributos */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Atributos</p>
              <div className="flex flex-col gap-1">
                {([
                  { k: 'promo',     label: 'Em promoção',       count: flagCounts.promo,     accent: '#22c55e' },
                  { k: 'badHealth', label: 'Saúde com problemas', count: flagCounts.badHealth, accent: '#f87171' },
                ] as const).map(o => {
                  const active = filterFlags[o.k]
                  return (
                    <button key={o.k}
                      onClick={() => setFilterFlags(p => ({ ...p, [o.k]: !p[o.k] }))}
                      className="flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-medium border transition-all"
                      style={{
                        background: active ? `${o.accent}14` : 'transparent',
                        borderColor: active ? o.accent : '#27272a',
                        color: active ? o.accent : '#a1a1aa',
                      }}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded border flex items-center justify-center"
                          style={{ borderColor: active ? o.accent : '#3f3f46', background: active ? o.accent : 'transparent' }}>
                          {active && <svg className="w-2 h-2" fill="none" stroke="#000" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        {o.label}
                      </span>
                      <span className="text-[10px] opacity-70">{o.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Saneamento */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Saneamento</p>
              <div className="flex flex-col gap-1">
                {([
                  { k: 'noLink',          label: 'Sem vínculo',      count: flagCounts.noLink,          accent: '#f59e0b' },
                  { k: 'noCost',          label: 'Sem custo',        count: flagCounts.noCost,          accent: '#f59e0b' },
                  { k: 'noPhoto',         label: 'Sem foto',         count: flagCounts.noPhoto,         accent: '#f59e0b' },
                  { k: 'zeroStockActive', label: 'Estoque 0 + ativo', count: flagCounts.zeroStockActive, accent: '#f87171' },
                  { k: 'noCampaign',      label: 'Sem campanha',     count: flagCounts.noCampaign,      accent: '#f59e0b' },
                ] as const).map(o => {
                  const active = filterFlags[o.k]
                  return (
                    <button key={o.k}
                      onClick={() => setFilterFlags(p => ({ ...p, [o.k]: !p[o.k] }))}
                      className="flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-medium border transition-all"
                      style={{
                        background: active ? `${o.accent}14` : 'transparent',
                        borderColor: active ? o.accent : '#27272a',
                        color: active ? o.accent : '#a1a1aa',
                      }}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded border flex items-center justify-center"
                          style={{ borderColor: active ? o.accent : '#3f3f46', background: active ? o.accent : 'transparent' }}>
                          {active && <svg className="w-2 h-2" fill="none" stroke="#000" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        {o.label}
                      </span>
                      <span className="text-[10px] opacity-70">{o.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {advCount > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-zinc-500 font-medium">Ativos:</span>
            {filterListingType !== 'all' && (
              <ChipML label={`Tipo: ${({ premium: 'Premium', gold: 'Ouro', classic: 'Clássico' } as const)[filterListingType]}`} onRemove={() => setFilterListingType('all')} />
            )}
            {filterLogistic !== 'all' && (
              <ChipML label={`Logística: ${({ fulfillment: 'Full', cross_docking: 'Coleta', self_service: 'Self', drop_off: 'Agência' } as const)[filterLogistic]}`} onRemove={() => setFilterLogistic('all')} />
            )}
            {filterFlags.promo           && <ChipML label="Em promoção"        onRemove={() => setFilterFlags(p => ({ ...p, promo: false }))} />}
            {filterFlags.badHealth       && <ChipML label="Saúde com problemas" onRemove={() => setFilterFlags(p => ({ ...p, badHealth: false }))} />}
            {filterFlags.noLink          && <ChipML label="Sem vínculo"        onRemove={() => setFilterFlags(p => ({ ...p, noLink: false }))} />}
            {filterFlags.noCost          && <ChipML label="Sem custo"          onRemove={() => setFilterFlags(p => ({ ...p, noCost: false }))} />}
            {filterFlags.noPhoto         && <ChipML label="Sem foto"           onRemove={() => setFilterFlags(p => ({ ...p, noPhoto: false }))} />}
            {filterFlags.zeroStockActive && <ChipML label="Estoque 0 + ativo"  onRemove={() => setFilterFlags(p => ({ ...p, zeroStockActive: false }))} />}
            {filterFlags.noCampaign      && <ChipML label="Sem campanha"       onRemove={() => setFilterFlags(p => ({ ...p, noCampaign: false }))} />}
            <button onClick={clearAdv}
              className="ml-1 px-2 py-0.5 text-[10px] font-medium rounded transition-colors"
              style={{ color: '#71717a' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#71717a' }}>
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* ── Select-all row ────────────────────────────────────────── */}
      {!loading && displayedItems.length > 0 && (
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={allSelected} onChange={toggleAll}
            className="w-4 h-4 rounded accent-cyan-400 cursor-pointer" />
          <span className="text-zinc-500 text-xs">
            {selected.size > 0
              ? `${selected.size} selecionado${selected.size > 1 ? 's' : ''}`
              : `${num(displayedItems.length)} anúncio${displayedItems.length !== 1 ? 's' : ''}${advCount > 0 ? ' (filtrados)' : ' nesta página'}`}
          </span>
          {selected.size > 0 && (
            <>
              <button
                onClick={openLinkModal}
                className="ml-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}
                title={unlinkedSelected.length === 0 ? 'Todos os selecionados já estão vinculados' : `Vincular ${unlinkedSelected.length} não-vinculado(s) a um produto`}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Vincular a produto
                {unlinkedSelected.length > 0 && unlinkedSelected.length !== selected.size && (
                  <span className="ml-1 text-[10px] opacity-70">({unlinkedSelected.length})</span>
                )}
              </button>
              <button
                onClick={() => openCreateConfirm([...selected])}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Criar Produtos
              </button>
            </>
          )}
        </div>
      )}

      {/* ── List ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          : displayedItems.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                <svg width="52" height="52" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}
                  className="mb-4 opacity-25">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-sm font-medium text-zinc-500 mb-1">Nenhum anúncio encontrado</p>
                <p className="text-xs mb-5">Sincronize com o Mercado Livre para importar seus anúncios</p>
                <button onClick={handleSync} disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: '#00E5FF', color: '#000' }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sincronizar ML
                </button>
              </div>
            )
            : displayedItems.map(item => (
              <ListingCard key={item.id} item={item}
                selected={selected.has(item.id)}
                linked={linkedIds.has(item.id)}
                stockInfo={stockMap.get(item.id)}
                onSelect={id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })}
                onCreateProduct={id => openCreateConfirm([id])}
                onLinkProduct={() => openSingleLink(item)}
                onUpdateStock={updateLinkedStock}
              />
            ))
        }
      </div>

      {/* ── Pagination ────────────────────────────────────────────── */}
      <Pagination page={page} total={total} size={PAGE}
        onChange={p => { setPage(p); setSelected(new Set()); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
      />

      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Floating action bar ───────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4"
          style={{
            background: '#111114',
            borderTop: '1px solid #00E5FF33',
            boxShadow: '0 -4px 24px rgba(0,229,255,0.08)',
          }}>
          <span className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
              style={{ background: '#00E5FF', color: '#000' }}>
              {selected.size}
            </span>
            anúncio{selected.size > 1 ? 's' : ''} selecionado{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={openLinkModal}
              disabled={unlinkedSelected.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.35)' }}
              title={unlinkedSelected.length === 0 ? 'Todos os selecionados já estão vinculados' : `Vincular ${unlinkedSelected.length} a um produto`}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Vincular a produto
              {unlinkedSelected.length > 0 && unlinkedSelected.length !== selected.size && (
                <span className="text-[11px] opacity-80">({unlinkedSelected.length})</span>
              )}
            </button>
            <button
              onClick={() => {
                const ids = [...selected]
                console.log('IDs selecionados:', ids)
                openCreateConfirm(ids)
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: '#00E5FF', color: '#000' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Criar Produtos
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border transition-all"
              style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm modal ─────────────────────────────────────────── */}
      {confirmOpen && pendingIds.length > 0 && (
        <ConfirmCreateModal
          count={pendingIds.length}
          items={pendingItems}
          creating={creating}
          onConfirm={handleCreateConfirm}
          onClose={() => { if (!creating) setConfirmOpen(false) }}
        />
      )}

      {/* ── Result modal ──────────────────────────────────────────── */}
      {results !== null && (
        <ResultModal
          results={results}
          loading={loadingCriacao}
          onClose={() => { if (!loadingCriacao) setResults(null) }}
        />
      )}

      {/* ── Link-to-product modal ─────────────────────────────────── */}
      {linkOpen && (
        <LinkToProductModal
          selectedItems={linkTargets}
          linking={linking}
          onConfirm={handleBulkLink}
          onClose={() => { if (!linking) setLinkOpen(false) }}
        />
      )}
    </div>
  )
}
