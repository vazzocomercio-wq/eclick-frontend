'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import {
  Brain, TrendingUp, TrendingDown, Minus, Package,
  ShoppingCart, AlertTriangle, Rocket, Ship, BarChart3,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
const PAGE_SIZE = 50

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id: string; name: string; sku: string; cost_price: number; photo_url: string | null
  supply_type: string; abc_class: string | null
  current_stock: number; sales_7d: number; sales_30d: number; sales_90d: number
  avg_daily_sales_30d: number; days_of_stock: number; lead_time_days: number
  tendencia: 'POSITIVA' | 'ESTAVEL' | 'NEGATIVA'
  sugestao_compra: number; margin_pct: number; score: number
  classificacao: string; acao: string; supplier_name: string | null
}

interface Summary {
  capital_sugerido: number; produtos_criticos: number; produtos_parados: number
  produtos_oportunidade: number; importacoes_urgentes: number; cobertura_media: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const scoreColor = (s: number) =>
  s >= 85 ? '#22c55e' : s >= 70 ? '#f97316' : s >= 50 ? '#f59e0b' : s >= 30 ? '#6b7280' : '#ef4444'

const daysColor = (d: number, lead: number) =>
  d === 0 ? '#ef4444' : d <= lead ? '#f97316' : d <= lead * 2 ? '#f59e0b' : '#22c55e'

const abcColor = (a: string | null) =>
  a === 'A' ? '#22c55e' : a === 'B' ? '#f59e0b' : '#6b7280'

const fmtN = (n: number, d = 0) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// ── Stock Bar (Level 1) ───────────────────────────────────────────────────────

type TFn = ReturnType<typeof useTranslations>

function StockBar({ days, lead, t }: { days: number; lead: number; t: TFn }) {
  if (days === 0) return (
    <div>
      <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>{t('outOfStock')}</span>
      <p style={{ fontSize: 10, color: '#a1a1aa', marginTop: 1 }}>{t('leadLabel', { days: lead })}</p>
    </div>
  )
  if (days === 999) return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#22c55e22' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 3, background: '#22c55e' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', minWidth: 14 }}>∞</span>
      </div>
      <p style={{ fontSize: 10, color: '#52525b' }}>{t('leadNoTurnover', { days: lead })}</p>
    </div>
  )

  const max        = Math.max(days, lead * 2, 1)
  const freedays   = Math.max(0, days - lead)
  const isDanger   = days <= lead
  const barColor   = days === 0 ? '#ef4444' : isDanger ? '#f97316' : days <= lead * 2 ? '#f59e0b' : '#22c55e'

  // Within the filled portion: green (safe) + yellow (alert zone = lead days)
  const totalFillPct = Math.min(100, (days / max) * 100)
  const safePct      = Math.max(0, (freedays / max) * 100)
  const alertPct     = Math.min(100, (lead / max) * 100)

  return (
    <div style={{ width: 108 }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <div style={{ flex: 1, height: 5, background: '#1e1e24', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
          {isDanger ? (
            <div style={{ width: `${totalFillPct}%`, height: '100%', background: barColor }} />
          ) : (
            <>
              <div style={{ position: 'absolute', left: 0, width: `${safePct}%`, height: '100%', background: '#22c55e' }} />
              <div style={{ position: 'absolute', left: `${safePct}%`, width: `${alertPct}%`, height: '100%', background: '#f59e0b' }} />
            </>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: barColor, minWidth: 26, textAlign: 'right' }}>{days}d</span>
      </div>
      <p style={{ fontSize: 10, color: '#52525b' }}>
        {t('leadLabel', { days: lead })}{freedays > 0 ? ` · ${t('daysFree', { days: freedays })}` : ` · ${t('urgent')}`}
      </p>
    </div>
  )
}

// ── Stock Projection Chart (SVG) ──────────────────────────────────────────────

function StockChart({ p, t }: { p: Product; t: TFn }) {
  const W = 380, H = 110
  const mL = 38, mR = 10, mT = 14, mB = 22
  const cW = W - mL - mR
  const cH = H - mT - mB
  const DAYS = 90

  const maxY = Math.max(p.current_stock, 1)
  const avg  = p.avg_daily_sales_30d

  const toX = (day: number) => mL + (day / DAYS) * cW
  const toY = (stock: number) => mT + cH - Math.min(1, Math.max(0, stock / maxY)) * cH

  // Projection points
  const pts = Array.from({ length: DAYS + 1 }, (_, i) => Math.max(0, p.current_stock - avg * i))

  // Find where stock first hits 0
  const zeroDay = avg > 0 ? Math.min(Math.ceil(p.current_stock / avg), DAYS) : DAYS

  const linePath = pts.map((s, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(s).toFixed(1)}`).join(' ')
  const areaPath = linePath
    + ` L${toX(Math.min(zeroDay, DAYS)).toFixed(1)},${toY(0).toFixed(1)}`
    + ` L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`

  const yBottom   = toY(0)
  const xLead     = toX(Math.min(p.lead_time_days, DAYS))
  const xStockout = p.days_of_stock < DAYS ? toX(Math.min(p.days_of_stock, DAYS)) : null
  const safetyStk = avg * p.lead_time_days
  const ySafety   = safetyStk > 0 && safetyStk < p.current_stock ? toY(safetyStk) : null

  const stockoutDate = new Date(Date.now() + Math.min(p.days_of_stock, DAYS) * 86400000)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  // Offset stockout label to avoid overlap with lead label
  const labelOffset = xStockout !== null && Math.abs(xStockout - xLead) < 52 ? 10 : 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {/* Background grid line at 0 */}
      <line x1={mL} y1={yBottom} x2={W - mR} y2={yBottom} stroke="#1e1e24" strokeWidth={1} />

      {/* Area fill */}
      <path d={areaPath} fill="#00E5FF" fillOpacity={0.07} />
      {/* Stock line */}
      <path d={linePath} fill="none" stroke="#00E5FF" strokeWidth={1.5} strokeLinejoin="round" />

      {/* Ruptura horizontal dashed */}
      <line x1={mL} y1={yBottom} x2={W - mR} y2={yBottom}
        stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />

      {/* Safety stock horizontal dashed */}
      {ySafety !== null && (
        <line x1={mL} y1={ySafety} x2={W - mR} y2={ySafety}
          stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      )}

      {/* Lead time vertical */}
      {p.lead_time_days <= DAYS && (
        <>
          <line x1={xLead} y1={mT} x2={xLead} y2={yBottom}
            stroke="#f97316" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          <text x={xLead + 3} y={mT + 9} fontSize={8} fill="#f97316" opacity={0.9}>{t('chart.orderToday')}</text>
        </>
      )}

      {/* Stockout vertical */}
      {xStockout !== null && (
        <>
          <line x1={xStockout} y1={mT} x2={xStockout} y2={yBottom}
            stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          <text x={xStockout + 3} y={mT + 9 + labelOffset} fontSize={8} fill="#ef4444" opacity={0.9}>
            {t('chart.stockout', { date: stockoutDate })}
          </text>
        </>
      )}

      {/* Current stock dot + label */}
      <circle cx={toX(0)} cy={toY(p.current_stock)} r={3} fill="#00E5FF" />
      <text x={toX(0) + 5} y={toY(p.current_stock) - 3} fontSize={8} fill="#00E5FF">
        {t('chart.units', { n: fmtN(p.current_stock) })}
      </text>

      {/* X axis ticks */}
      {[0, 30, 60, 90].map(d => (
        <g key={d}>
          <line x1={toX(d)} y1={yBottom} x2={toX(d)} y2={yBottom + 3} stroke="#3f3f46" strokeWidth={1} />
          <text x={toX(d)} y={H - 4} fontSize={8} fill="#52525b" textAnchor="middle">
            {d === 0 ? t('chart.today') : `+${d}d`}
          </text>
        </g>
      ))}

      {/* Y axis labels */}
      <text x={mL - 3} y={mT + 5} fontSize={8} fill="#3f3f46" textAnchor="end">{fmtN(maxY)}</text>
      <text x={mL - 3} y={yBottom + 4} fontSize={8} fill="#3f3f46" textAnchor="end">0</text>
    </svg>
  )
}

// ── Small reused components ───────────────────────────────────────────────────

function TendIcon({ t }: { t: Product['tendencia'] }) {
  if (t === 'POSITIVA') return <TrendingUp size={13} color="#22c55e" />
  if (t === 'NEGATIVA') return <TrendingDown size={13} color="#ef4444" />
  return <Minus size={13} color="#6b7280" />
}

function ScoreBadge({ score }: { score: number }) {
  const c = scoreColor(score)
  return (
    <span className="inline-flex items-center justify-center rounded-full text-[11px] font-bold w-9 h-9"
      style={{ background: c + '22', color: c, border: `1px solid ${c}44` }}>
      {Math.round(score)}
    </span>
  )
}

function ABCBadge({ abc }: { abc: string | null }) {
  if (!abc) return <span style={{ color: '#a1a1aa', fontSize: 12 }}>–</span>
  return (
    <span className="inline-flex items-center justify-center rounded text-[11px] font-bold"
      style={{ background: abcColor(abc) + '22', color: abcColor(abc), width: 20, height: 20 }}>
      {abc}
    </span>
  )
}

// ── Product Drawer (Level 2) ──────────────────────────────────────────────────

function ProductDrawer({ product: p, onClose, t }: { product: Product; onClose: () => void; t: TFn }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const daysToOrder = Math.max(0, p.days_of_stock === 999 ? 90 : p.days_of_stock - p.lead_time_days)
  const orderDate   = new Date(Date.now() + daysToOrder * 86400000).toLocaleDateString('pt-BR')

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40,
        opacity: visible ? 1 : 0, transition: 'opacity 200ms ease',
      }} />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100dvh', width: 420,
        background: '#111114', borderLeft: '1px solid #1a1a1f',
        zIndex: 50, overflowY: 'auto',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease',
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'sticky', top: 0, left: '100%', zIndex: 1,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '16px 16px 0 0', display: 'block', marginLeft: 'auto',
        }}>
          <svg width={18} height={18} fill="none" stroke="#52525b" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div style={{ padding: '4px 20px 28px' }}>

          {/* ── Section A: Header ── */}
          <div className="flex items-start gap-3 mb-5">
            {p.photo_url
              ? <img src={p.photo_url} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid #1e1e24' }} />
              : <div style={{ width: 64, height: 64, borderRadius: 8, background: '#1e1e24', flexShrink: 0 }} />
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#e4e4e7', fontWeight: 600, fontSize: 14, marginBottom: 3, lineHeight: 1.3 }}>{p.name}</p>
              <p style={{ color: '#a1a1aa', fontSize: 11, marginBottom: 6 }}>{p.sku || '–'}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <ABCBadge abc={p.abc_class} />
                <span style={{ fontSize: 11, color: '#71717a' }}>
                  {p.supply_type === 'importado' ? `🌍 ${t('imported')}` : `🇧🇷 ${t('national')}`}
                </span>
                <span style={{ fontSize: 11, color: scoreColor(p.score), background: scoreColor(p.score) + '18', padding: '1px 7px', borderRadius: 20 }}>
                  {p.acao}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <ScoreBadge score={p.score} />
              <span style={{ fontSize: 9, color: '#a1a1aa', marginTop: 3 }}>{t('score')}</span>
            </div>
          </div>

          {/* ── Section B: Stock Projection Chart ── */}
          <div style={{ background: '#0e0e11', borderRadius: 10, padding: '12px 10px 6px', marginBottom: 16, border: '1px solid #1a1a1f' }}>
            <p style={{ color: '#a1a1aa', fontSize: 11, fontWeight: 600, marginBottom: 6, paddingLeft: 4 }}>
              {t('drawer.stockProjection')}
            </p>
            <StockChart p={p} t={t} />
            <div className="flex items-center gap-4 mt-2 px-1">
              {[
                { color: '#00E5FF', label: t('drawer.legendProjected') },
                { color: '#f97316', label: t('leadLabel', { days: p.lead_time_days }) },
                { color: '#f59e0b', label: t('drawer.legendMinStock') },
                { color: '#ef4444', label: t('drawer.legendStockout') },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                  <span style={{ fontSize: 9, color: '#52525b' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section C: Metrics grid ── */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: t('metric.currentStock'),  value: t('chart.units', { n: fmtN(p.current_stock) }), color: '#e4e4e7' },
              { label: t('metric.inTransit'),     value: t('chart.units', { n: 0 }),                     color: '#71717a' },
              { label: t('metric.sales30d'),      value: t('chart.units', { n: fmtN(p.sales_30d) }),     color: '#e4e4e7' },
              { label: t('metric.turnoverPerDay'), value: t('chart.units', { n: fmtN(p.avg_daily_sales_30d, 2) }), color: '#e4e4e7' },
              { label: t('metric.daysRemaining'), value: p.days_of_stock === 999 ? '∞' : t('daysValue', { days: fmtN(p.days_of_stock) }),
                color: daysColor(p.days_of_stock, p.lead_time_days) },
              { label: t('metric.leadTime'),      value: t('daysValue', { days: p.lead_time_days }),     color: '#e4e4e7' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#0e0e11', borderRadius: 8, padding: '10px 12px', border: '1px solid #1a1a1f' }}>
                <p style={{ color: '#a1a1aa', fontSize: 10, marginBottom: 3 }}>{label}</p>
                <p style={{ color, fontSize: 13, fontWeight: 600 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Sugestão de compra */}
          {p.sugestao_compra > 0 && (
            <div style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.14)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <p style={{ color: '#00E5FF', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                {t('drawer.suggestion', { count: fmtN(p.sugestao_compra) })}
              </p>
              <p style={{ color: '#a1a1aa', fontSize: 12 }}>
                {t('drawer.capitalNeeded', { value: fmtBRL(p.sugestao_compra * p.cost_price) })}
              </p>
              {p.days_of_stock < p.lead_time_days && (
                <p style={{ color: '#f97316', fontSize: 11, marginTop: 6 }}>
                  {t('drawer.orderBy', { date: orderDate })}
                </p>
              )}
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-2">
            {p.supplier_name && (
              <button style={{
                width: '100%', padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.18)',
                color: '#00E5FF', fontSize: 12, fontWeight: 600,
              }}>
                {t('drawer.viewSupplier', { name: p.supplier_name })}
              </button>
            )}
            <button style={{
              width: '100%', padding: '9px 0', borderRadius: 8, cursor: 'not-allowed',
              background: '#18181b', border: '1px solid #27272a',
              color: '#a1a1aa', fontSize: 12,
            }}>
              {t('drawer.createPo')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color = '#00E5FF' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#a1a1aa' }}>{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color: '#e4e4e7' }}>{value}</p>
      {sub && <p className="text-[11px]" style={{ color: '#a1a1aa' }}>{sub}</p>}
    </div>
  )
}

// ── Block ─────────────────────────────────────────────────────────────────────

function Block({ title, icon, count, color, children }: {
  title: string; icon: React.ReactNode; count: number; color: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl" style={{ background: '#111114', border: '1px solid #1a1a1f' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-sm font-semibold" style={{ color: '#e4e4e7' }}>{title}</span>
          <span className="text-[11px] rounded-full px-2 py-0.5 font-semibold"
            style={{ background: color + '22', color }}>{count}</span>
        </div>
        <svg className="w-4 h-4" style={{ color: '#52525b', transform: open ? 'rotate(180deg)' : undefined }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

function BlockRow({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid #1e1e24' }}>
      <div className="min-w-0 flex-1 pr-3">{left}</div>
      <div className="text-right shrink-0">{right}</div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InteligenciaPage() {
  const t = useTranslations('compras.inteligencia')
  const [allItems, setAllItems]        = useState<Product[]>([])
  const [summary, setSummary]          = useState<Summary | null>(null)
  const [loading, setLoading]          = useState(true)
  const [filtros, setFiltros]          = useState({ periodo: 30, tipo: '', abc: '', minScore: 0 })
  const [q, setQ]                      = useState('')
  const [page, setPage]                = useState(0)
  const [selectedProduct, setSelected] = useState<Product | null>(null)
  const [customPickerOpen, setCustomPickerOpen] = useState(false)
  const [customFrom, setCustomFrom]    = useState('')
  const [customTo, setCustomTo]        = useState('')
  const [customLabel, setCustomLabel]  = useState('')
  const [isCustom, setIsCustom]        = useState(false)
  const [customError, setCustomError]  = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true); setPage(0)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const params = new URLSearchParams({ periodo: String(filtros.periodo) })
      if (filtros.tipo)     params.set('supply_type', filtros.tipo)
      if (filtros.abc)      params.set('abc_class', filtros.abc)
      if (filtros.minScore) params.set('min_score', String(filtros.minScore))
      const [sumRes, listRes] = await Promise.all([
        fetch(`${BACKEND}/compras/inteligencia/summary`, { headers }),
        fetch(`${BACKEND}/compras/inteligencia?${params}`, { headers }),
      ])
      if (sumRes.ok)  setSummary(await sumRes.json())
      if (listRes.ok) setAllItems(await listRes.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filtros])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() =>
    q ? allItems.filter(p =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.sku.toLowerCase().includes(q.toLowerCase())
    ) : allItems,
    [allItems, q],
  )

  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const maxSales   = Math.max(...allItems.map(p => p.sales_30d), 1)

  const criticals = allItems.filter(p => p.score >= 85).sort((a, b) => b.score - a.score)
  const imports   = allItems.filter(p => p.supply_type === 'importado' && p.score >= 70).sort((a, b) => b.score - a.score)
  const stopped   = allItems.filter(p => p.days_of_stock > 180 && p.avg_daily_sales_30d < 0.1).sort((a, b) => b.current_stock * b.cost_price - a.current_stock * a.cost_price)
  const opps      = allItems.filter(p => p.tendencia === 'POSITIVA' && p.score >= 50).sort((a, b) => b.score - a.score)
  const rupture   = allItems.filter(p => p.days_of_stock < p.lead_time_days).sort((a, b) => a.days_of_stock - b.days_of_stock)

  const selStyle: React.CSSProperties = {
    background: '#18181b', border: '1px solid #27272a', borderRadius: 8,
    color: '#a1a1aa', fontSize: 12, padding: '6px 10px', outline: 'none',
  }

  return (
    <div style={{ background: 'var(--background)', minHeight: '100vh', padding: 24 }}>

      {/* Drawer */}
      {selectedProduct && (
        <ProductDrawer product={selectedProduct} onClose={() => setSelected(null)} t={t} />
      )}

      {/* ── Section 1: Header + Filters ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Brain size={20} color="#00E5FF" />
          <h1 className="text-lg font-bold" style={{ color: '#e4e4e7' }}>{t('title')}</h1>
        </div>
        <p className="text-xs mb-4" style={{ color: '#a1a1aa' }}>
          {t('subtitle', { count: allItems.length })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 relative">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
              {[7, 30, 90, 180].map(d => (
                <button key={d}
                  onClick={() => { setFiltros(f => ({ ...f, periodo: d })); setIsCustom(false); setCustomPickerOpen(false) }}
                  className="px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ background: !isCustom && filtros.periodo === d ? 'rgba(0,229,255,0.12)' : '#18181b', color: !isCustom && filtros.periodo === d ? '#00E5FF' : '#71717a' }}>
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={() => setCustomPickerOpen(o => !o)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{ background: isCustom ? 'rgba(0,229,255,0.12)' : '#18181b', color: isCustom ? '#00E5FF' : '#71717a', border: '1px solid #27272a' }}>
              {isCustom ? customLabel : `📅 ${t('filters.custom')}`}
            </button>
            {customPickerOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 30,
                background: '#18181b', border: '1px solid #27272a', borderRadius: 10,
                padding: '14px 16px', minWidth: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                <div className="flex flex-col gap-3">
                  {([[t('filters.from'), customFrom, setCustomFrom], [t('filters.to'), customTo, setCustomTo]] as const).map(([label, value, set]) => (
                    <div key={label} className="flex flex-col gap-1">
                      <label style={{ fontSize: 11, color: '#71717a' }}>{label}</label>
                      <input type="date" value={value} onChange={e => (set as (v: string) => void)(e.target.value)}
                        style={{ background: '#111114', border: '1px solid #27272a', borderRadius: 7, color: '#e4e4e7', fontSize: 12, padding: '6px 10px', outline: 'none' }} />
                    </div>
                  ))}
                  {customError && <p style={{ color: '#ef4444', fontSize: 11 }}>{customError}</p>}
                  <button
                    onClick={() => {
                      setCustomError('')
                      if (!customFrom || !customTo) { setCustomError(t('filters.errorSelectBoth')); return }
                      const days = Math.round((new Date(customTo).getTime() - new Date(customFrom).getTime()) / 86400000)
                      if (days <= 0) { setCustomError(t('filters.errorEndAfterStart')); return }
                      if (days > 180) { setCustomError(t('filters.errorMax180')); return }
                      const fmt = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                      setCustomLabel(`${fmt(customFrom)} → ${fmt(customTo)}`)
                      setIsCustom(true)
                      setCustomPickerOpen(false)
                      setFiltros(f => ({ ...f, periodo: days }))
                    }}
                    style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: 7, color: '#00E5FF', fontSize: 12, fontWeight: 600, padding: '7px 0', cursor: 'pointer' }}>
                    {t('filters.apply')}
                  </button>
                </div>
              </div>
            )}
          </div>
          <select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))} style={selStyle}>
            <option value="">{t('filters.allTypes')}</option>
            <option value="nacional">🇧🇷 {t('national')}</option>
            <option value="importado">🌍 {t('imported')}</option>
          </select>
          <select value={filtros.abc} onChange={e => setFiltros(f => ({ ...f, abc: e.target.value }))} style={selStyle}>
            <option value="">{t('filters.abcCurve')}</option>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
          </select>
          <select value={filtros.minScore} onChange={e => setFiltros(f => ({ ...f, minScore: Number(e.target.value) }))} style={selStyle}>
            <option value={0}>{t('filters.minScore')}</option>
            <option value={50}>{t('filters.score50')}</option>
            <option value={70}>{t('filters.score70')}</option>
            <option value={85}>{t('filters.score85')}</option>
          </select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('filters.searchPlaceholder')}
            style={{ ...selStyle, width: 200 }} />
          {loading && <span className="text-xs animate-pulse" style={{ color: '#a1a1aa' }}>{t('loading')}</span>}
        </div>
      </div>

      {/* ── Section 2: KPI Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <KpiCard icon={<ShoppingCart size={16} />} label={t('kpi.suggestedCapital')} value={fmtBRL(summary.capital_sugerido)} sub={t('kpi.score50')} color="#00E5FF" />
          <KpiCard icon={<AlertTriangle size={16} />} label={t('kpi.critical')} value={String(summary.produtos_criticos)} sub={t('kpi.score85')} color="#ef4444" />
          <KpiCard icon={<Ship size={16} />} label={t('kpi.importNow')} value={String(summary.importacoes_urgentes)} sub={t('kpi.importedScore70')} color="#f97316" />
          <KpiCard icon={<Package size={16} />} label={t('kpi.stopped')} value={String(summary.produtos_parados)} sub={t('kpi.stoppedSub')} color="#6b7280" />
          <KpiCard icon={<Rocket size={16} />} label={t('kpi.opportunities')} value={String(summary.produtos_oportunidade)} sub={t('kpi.positiveTrend')} color="#22c55e" />
          <KpiCard icon={<BarChart3 size={16} />} label={t('kpi.avgCoverage')} value={t('daysValue', { days: fmtN(summary.cobertura_media) })} sub={t('kpi.activeProducts')} color="#f59e0b" />
        </div>
      )}

      {/* ── Section 3: Table ── */}
      <div className="rounded-xl mb-5 overflow-hidden" style={{ border: '1px solid #1a1a1f' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1a1a1f' }}>
          <p className="text-sm font-semibold" style={{ color: '#e4e4e7' }}>
            {t('table.heading', { count: filtered.length })}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#a1a1aa' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-2 py-1 rounded" style={{ background: '#18181b', opacity: page === 0 ? 0.4 : 1 }}>←</button>
              <span>{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="px-2 py-1 rounded" style={{ background: '#18181b', opacity: page === totalPages - 1 ? 0.4 : 1 }}>→</button>
            </div>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ minWidth: 980 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1a1a1f' }}>
                {[t('col.product'), t('col.abc'), t('col.type'), t('col.sales30d'), t('col.trend'), t('col.turnoverPerDay'), t('col.stock'), t('col.daysStock'), t('col.lead'), t('col.score'), t('col.action')].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: '#52525b', background: '#0e0e11' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && !loading && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-sm" style={{ color: '#a1a1aa' }}>
                  {t('noProductsFound')}
                </td></tr>
              )}
              {paginated.map(p => (
                <tr key={p.id}
                  onClick={() => setSelected(p)}
                  style={{ borderBottom: '1px solid #1a1a1f', cursor: 'pointer', transition: 'background 100ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {/* Produto */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {p.photo_url
                        ? <img src={p.photo_url} className="w-8 h-8 rounded object-cover shrink-0" />
                        : <div className="w-8 h-8 rounded shrink-0" style={{ background: '#1e1e24' }} />}
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#e4e4e7', maxWidth: 155, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                        <p className="text-[10px]" style={{ color: '#a1a1aa' }}>{p.sku || '–'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><ABCBadge abc={p.abc_class} /></td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#a1a1aa' }}>
                    {p.supply_type === 'importado' ? `🌍 ${t('importedShort')}` : `🇧🇷 ${t('nationalShort')}`}
                  </td>
                  {/* Vendas 30d */}
                  <td className="px-3 py-2.5">
                    <p className="text-xs font-medium" style={{ color: '#e4e4e7' }}>{fmtN(p.sales_30d)}</p>
                    <div className="mt-0.5 h-1 rounded-full" style={{ background: '#1e1e24', width: 40 }}>
                      <div className="h-1 rounded-full" style={{ background: '#00E5FF', width: `${Math.min(100, (p.sales_30d / maxSales) * 100)}%` }} />
                    </div>
                  </td>
                  {/* Tendência */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <TendIcon t={p.tendencia} />
                      <span className="text-[11px]" style={{ color: p.tendencia === 'POSITIVA' ? '#22c55e' : p.tendencia === 'NEGATIVA' ? '#ef4444' : '#6b7280' }}>
                        {p.tendencia === 'POSITIVA' ? t('trend.up') : p.tendencia === 'NEGATIVA' ? t('trend.down') : t('trend.stable')}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#a1a1aa' }}>{t('chart.units', { n: fmtN(p.avg_daily_sales_30d, 2) })}</td>
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#e4e4e7' }}>{fmtN(p.current_stock)}</td>
                  {/* Dias est. — visual bar */}
                  <td className="px-3 py-2.5">
                    <StockBar days={p.days_of_stock} lead={p.lead_time_days} t={t} />
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#a1a1aa' }}>{p.lead_time_days}d</td>
                  <td className="px-3 py-2.5"><ScoreBadge score={p.score} /></td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] font-medium px-2 py-1 rounded-md whitespace-nowrap"
                      style={{ background: scoreColor(p.score) + '18', color: scoreColor(p.score) }}>
                      {p.acao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 4: Blocks ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Block title={t('block.buyNow')} icon={<ShoppingCart size={15} />} count={criticals.length} color="#ef4444">
          {criticals.length === 0
            ? <p className="text-xs py-2" style={{ color: '#a1a1aa' }}>{t('block.noCritical')}</p>
            : criticals.slice(0, 6).map(p => (
              <BlockRow key={p.id}
                left={<><p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{p.name}</p><p className="text-[10px]" style={{ color: '#a1a1aa' }}>{p.days_of_stock === 999 ? t('block.noTurnover') : t('daysRemaining', { days: p.days_of_stock })} · {t('leadShort', { days: p.lead_time_days })}</p></>}
                right={<><p className="text-xs font-bold" style={{ color: '#00E5FF' }}>{t('chart.units', { n: fmtN(p.sugestao_compra) })}</p><p className="text-[10px]" style={{ color: '#a1a1aa' }}>{fmtBRL(p.sugestao_compra * p.cost_price)}</p></>}
              />
            ))
          }
        </Block>

        <Block title={t('block.importPlanning')} icon={<Ship size={15} />} count={imports.length} color="#f97316">
          {imports.length === 0
            ? <p className="text-xs py-2" style={{ color: '#a1a1aa' }}>{t('block.noImports')}</p>
            : imports.slice(0, 6).map(p => {
              const dto = Math.max(0, p.days_of_stock === 999 ? 90 : p.days_of_stock - p.lead_time_days)
              return (
                <BlockRow key={p.id}
                  left={<><p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{p.name}</p><p className="text-[10px]" style={{ color: '#a1a1aa' }}>{t('block.orderByArrives', { orderBy: new Date(Date.now() + dto * 86400000).toLocaleDateString('pt-BR'), arrives: new Date(Date.now() + (dto + p.lead_time_days) * 86400000).toLocaleDateString('pt-BR') })}</p></>}
                  right={<><p className="text-xs font-bold" style={{ color: '#f97316' }}>{t('chart.units', { n: fmtN(p.sugestao_compra) })}</p><p className="text-[10px]" style={{ color: '#a1a1aa' }}>{fmtBRL(p.sugestao_compra * p.cost_price)}</p></>}
                />
              )
            })
          }
        </Block>

        <Block title={t('block.stoppedStock')} icon={<Package size={15} />} count={stopped.length} color="#6b7280">
          {stopped.length === 0
            ? <p className="text-xs py-2" style={{ color: '#a1a1aa' }}>{t('block.noStopped')}</p>
            : stopped.slice(0, 6).map(p => (
              <BlockRow key={p.id}
                left={<><p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{p.name}</p><p className="text-[10px]" style={{ color: '#a1a1aa' }}>{t('block.considerPromo', { n: fmtN(p.current_stock) })}</p></>}
                right={<><p className="text-xs font-bold" style={{ color: '#ef4444' }}>{fmtBRL(p.current_stock * p.cost_price)}</p><p className="text-[10px]" style={{ color: '#a1a1aa' }}>{t('block.tiedCapital')}</p></>}
              />
            ))
          }
        </Block>

        <Block title={t('block.opportunities')} icon={<Rocket size={15} />} count={opps.length} color="#22c55e">
          {opps.length === 0
            ? <p className="text-xs py-2" style={{ color: '#a1a1aa' }}>{t('block.noOpportunities')}</p>
            : opps.slice(0, 6).map(p => {
              const growth = p.avg_daily_sales_30d > 0 ? ((p.sales_7d / 7 / p.avg_daily_sales_30d) - 1) * 100 : 0
              return (
                <BlockRow key={p.id}
                  left={<><p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{p.name}</p><p className="text-[10px]" style={{ color: '#a1a1aa' }}>{t('block.stockRising', { n: fmtN(p.current_stock) })}</p></>}
                  right={<><p className="text-xs font-bold" style={{ color: '#22c55e' }}>+{fmtN(growth, 0)}%</p><p className="text-[10px]" style={{ color: '#a1a1aa' }}>{t('block.vs30d')}</p></>}
                />
              )
            })
          }
        </Block>

        <div className="md:col-span-2">
          <Block title={t('block.stockoutRisk')} icon={<AlertTriangle size={15} />} count={rupture.length} color="#f59e0b">
            {rupture.length === 0
              ? <p className="text-xs py-2" style={{ color: '#a1a1aa' }}>{t('block.noStockoutRisk')}</p>
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  {rupture.slice(0, 8).map(p => {
                    const deficit = Math.max(0, p.lead_time_days * p.avg_daily_sales_30d - p.current_stock)
                    return (
                      <BlockRow key={p.id}
                        left={<><p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{p.name}</p><p className="text-[10px]" style={{ color: '#a1a1aa' }}>{t('block.ruptureDetail', { days: p.days_of_stock, lead: p.lead_time_days, deficit: fmtN(deficit) })}</p></>}
                        right={<span className="text-xs font-bold" style={{ color: daysColor(p.days_of_stock, p.lead_time_days) }}>{p.days_of_stock < 1 ? t('block.zeroed') : `${p.days_of_stock}d`}</span>}
                      />
                    )
                  })}
                </div>
              )
            }
          </Block>
        </div>
      </div>
    </div>
  )
}
