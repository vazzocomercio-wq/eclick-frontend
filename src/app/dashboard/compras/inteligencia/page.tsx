'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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

function StockBar({ days, lead }: { days: number; lead: number }) {
  if (days === 0) return (
    <div>
      <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>SEM ESTOQUE</span>
      <p style={{ fontSize: 10, color: '#52525b', marginTop: 1 }}>Lead: {lead}d</p>
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
      <p style={{ fontSize: 10, color: '#52525b' }}>Lead: {lead}d · sem giro</p>
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
        Lead: {lead}d{freedays > 0 ? ` · ${freedays}d livre` : ' · ⚠ urgente'}
      </p>
    </div>
  )
}

// ── Stock Projection Chart (SVG) ──────────────────────────────────────────────

function StockChart({ p }: { p: Product }) {
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
          <text x={xLead + 3} y={mT + 9} fontSize={8} fill="#f97316" opacity={0.9}>Pedir hoje</text>
        </>
      )}

      {/* Stockout vertical */}
      {xStockout !== null && (
        <>
          <line x1={xStockout} y1={mT} x2={xStockout} y2={yBottom}
            stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          <text x={xStockout + 3} y={mT + 9 + labelOffset} fontSize={8} fill="#ef4444" opacity={0.9}>
            Ruptura {stockoutDate}
          </text>
        </>
      )}

      {/* Current stock dot + label */}
      <circle cx={toX(0)} cy={toY(p.current_stock)} r={3} fill="#00E5FF" />
      <text x={toX(0) + 5} y={toY(p.current_stock) - 3} fontSize={8} fill="#00E5FF">
        {fmtN(p.current_stock)} un
      </text>

      {/* X axis ticks */}
      {[0, 30, 60, 90].map(d => (
        <g key={d}>
          <line x1={toX(d)} y1={yBottom} x2={toX(d)} y2={yBottom + 3} stroke="#3f3f46" strokeWidth={1} />
          <text x={toX(d)} y={H - 4} fontSize={8} fill="#52525b" textAnchor="middle">
            {d === 0 ? 'Hoje' : `+${d}d`}
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
  if (!abc) return <span style={{ color: '#52525b', fontSize: 12 }}>–</span>
  return (
    <span className="inline-flex items-center justify-center rounded text-[11px] font-bold"
      style={{ background: abcColor(abc) + '22', color: abcColor(abc), width: 20, height: 20 }}>
      {abc}
    </span>
  )
}

// ── Product Drawer (Level 2) ──────────────────────────────────────────────────

function ProductDrawer({ product: p, onClose }: { product: Product; onClose: () => void }) {
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
              <p style={{ color: '#52525b', fontSize: 11, marginBottom: 6 }}>{p.sku || '–'}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <ABCBadge abc={p.abc_class} />
                <span style={{ fontSize: 11, color: '#71717a' }}>
                  {p.supply_type === 'importado' ? '🌍 Importado' : '🇧🇷 Nacional'}
                </span>
                <span style={{ fontSize: 11, color: scoreColor(p.score), background: scoreColor(p.score) + '18', padding: '1px 7px', borderRadius: 20 }}>
                  {p.acao}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center shrink-0">
              <ScoreBadge score={p.score} />
              <span style={{ fontSize: 9, color: '#52525b', marginTop: 3 }}>score</span>
            </div>
          </div>

          {/* ── Section B: Stock Projection Chart ── */}
          <div style={{ background: '#0e0e11', borderRadius: 10, padding: '12px 10px 6px', marginBottom: 16, border: '1px solid #1a1a1f' }}>
            <p style={{ color: '#71717a', fontSize: 11, fontWeight: 600, marginBottom: 6, paddingLeft: 4 }}>
              Projeção de estoque — 90 dias
            </p>
            <StockChart p={p} />
            <div className="flex items-center gap-4 mt-2 px-1">
              {[
                { color: '#00E5FF', label: 'Estoque projetado' },
                { color: '#f97316', label: `Lead: ${p.lead_time_days}d` },
                { color: '#f59e0b', label: 'Estoque mínimo' },
                { color: '#ef4444', label: 'Ruptura' },
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
              { label: 'Estoque atual',  value: `${fmtN(p.current_stock)} un`, color: '#e4e4e7' },
              { label: 'Em trânsito',    value: '0 un',                          color: '#71717a' },
              { label: 'Vendas 30d',     value: `${fmtN(p.sales_30d)} un`,      color: '#e4e4e7' },
              { label: 'Giro/dia',       value: `${fmtN(p.avg_daily_sales_30d, 2)} un`, color: '#e4e4e7' },
              { label: 'Dias restantes', value: p.days_of_stock === 999 ? '∞' : `${fmtN(p.days_of_stock)} dias`,
                color: daysColor(p.days_of_stock, p.lead_time_days) },
              { label: 'Lead time',      value: `${p.lead_time_days} dias`,      color: '#e4e4e7' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#0e0e11', borderRadius: 8, padding: '10px 12px', border: '1px solid #1a1a1f' }}>
                <p style={{ color: '#52525b', fontSize: 10, marginBottom: 3 }}>{label}</p>
                <p style={{ color, fontSize: 13, fontWeight: 600 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Sugestão de compra */}
          {p.sugestao_compra > 0 && (
            <div style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.14)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <p style={{ color: '#00E5FF', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                Sugestão: {fmtN(p.sugestao_compra)} unidades
              </p>
              <p style={{ color: '#71717a', fontSize: 12 }}>
                Capital necessário: {fmtBRL(p.sugestao_compra * p.cost_price)}
              </p>
              {p.days_of_stock < p.lead_time_days && (
                <p style={{ color: '#f97316', fontSize: 11, marginTop: 6 }}>
                  ⚠ Pedir até {orderDate} para evitar ruptura
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
                Ver fornecedor: {p.supplier_name}
              </button>
            )}
            <button style={{
              width: '100%', padding: '9px 0', borderRadius: 8, cursor: 'not-allowed',
              background: '#18181b', border: '1px solid #27272a',
              color: '#52525b', fontSize: 12,
            }}>
              Criar ordem de compra (em breve)
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
        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#52525b' }}>{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color: '#e4e4e7' }}>{value}</p>
      {sub && <p className="text-[11px]" style={{ color: '#52525b' }}>{sub}</p>}
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
  const [allItems, setAllItems]         = useState<Product[]>([])
  const [summary, setSummary]           = useState<Summary | null>(null)
  const [loading, setLoading]           = useState(true)
  const [period, setPeriod]             = useState(30)
  const [typeF, setTypeF]               = useState('')
  const [abcF, setAbcF]                 = useState('')
  const [scoreF, setScoreF]             = useState(0)
  const [q, setQ]                       = useState('')
  const [page, setPage]                 = useState(0)
  const [selectedProduct, setSelected]  = useState<Product | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true); setPage(0)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      const headers = { Authorization: `Bearer ${session.access_token}` }
      const [sumRes, listRes] = await Promise.all([
        fetch(`${BACKEND}/compras/inteligencia/summary`, { headers }),
        fetch(`${BACKEND}/compras/inteligencia?periodo=${period}`, { headers }),
      ])
      if (sumRes.ok)  setSummary(await sumRes.json())
      if (listRes.ok) setAllItems(await listRes.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = useMemo(() => allItems
    .filter(p => !typeF  || p.supply_type === typeF)
    .filter(p => !abcF   || p.abc_class   === abcF)
    .filter(p => !scoreF || p.score       >= scoreF)
    .filter(p => !q      || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())),
    [allItems, typeF, abcF, scoreF, q],
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
    <div style={{ background: '#09090b', minHeight: '100vh', padding: 24 }}>

      {/* Drawer */}
      {selectedProduct && (
        <ProductDrawer product={selectedProduct} onClose={() => setSelected(null)} />
      )}

      {/* ── Section 1: Header + Filters ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Brain size={20} color="#00E5FF" />
          <h1 className="text-lg font-bold" style={{ color: '#e4e4e7' }}>Inteligência de Compras</h1>
        </div>
        <p className="text-xs mb-4" style={{ color: '#52525b' }}>
          Score preditivo por produto · {allItems.length} produtos analisados · clique em uma linha para detalhes
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #27272a' }}>
            {[7, 30, 90, 180].map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ background: period === d ? 'rgba(0,229,255,0.12)' : '#18181b', color: period === d ? '#00E5FF' : '#71717a' }}>
                {d}d
              </button>
            ))}
          </div>
          <select value={typeF} onChange={e => setTypeF(e.target.value)} style={selStyle}>
            <option value="">Todos os tipos</option>
            <option value="nacional">🇧🇷 Nacional</option>
            <option value="importado">🌍 Importado</option>
          </select>
          <select value={abcF} onChange={e => setAbcF(e.target.value)} style={selStyle}>
            <option value="">Curva ABC</option>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option>
          </select>
          <select value={scoreF} onChange={e => setScoreF(Number(e.target.value))} style={selStyle}>
            <option value={0}>Score mínimo</option>
            <option value={50}>≥ 50 (Monitorar+)</option>
            <option value={70}>≥ 70 (Comprar+)</option>
            <option value={85}>≥ 85 (Crítico)</option>
          </select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar produto / SKU…"
            style={{ ...selStyle, width: 200 }} />
          {loading && <span className="text-xs animate-pulse" style={{ color: '#52525b' }}>Carregando…</span>}
        </div>
      </div>

      {/* ── Section 2: KPI Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <KpiCard icon={<ShoppingCart size={16} />} label="Capital sugerido" value={fmtBRL(summary.capital_sugerido)} sub="score ≥ 50" color="#00E5FF" />
          <KpiCard icon={<AlertTriangle size={16} />} label="Críticos" value={String(summary.produtos_criticos)} sub="score ≥ 85" color="#ef4444" />
          <KpiCard icon={<Ship size={16} />} label="Importar agora" value={String(summary.importacoes_urgentes)} sub="importados score ≥ 70" color="#f97316" />
          <KpiCard icon={<Package size={16} />} label="Parados" value={String(summary.produtos_parados)} sub="> 180 dias sem venda" color="#6b7280" />
          <KpiCard icon={<Rocket size={16} />} label="Oportunidades" value={String(summary.produtos_oportunidade)} sub="tendência positiva" color="#22c55e" />
          <KpiCard icon={<BarChart3 size={16} />} label="Cobertura média" value={`${fmtN(summary.cobertura_media)} dias`} sub="produtos ativos" color="#f59e0b" />
        </div>
      )}

      {/* ── Section 3: Table ── */}
      <div className="rounded-xl mb-5 overflow-hidden" style={{ border: '1px solid #1a1a1f' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1a1a1f' }}>
          <p className="text-sm font-semibold" style={{ color: '#e4e4e7' }}>
            {filtered.length} produtos · ordenados por score
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#71717a' }}>
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
                {['Produto', 'ABC', 'Tipo', 'Vendas 30d', 'Tendência', 'Giro/dia', 'Estoque', 'Dias est.', 'Lead', 'Score', 'Ação'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: '#52525b', background: '#0e0e11' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && !loading && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-sm" style={{ color: '#52525b' }}>
                  Nenhum produto encontrado
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
                        <p className="text-[10px]" style={{ color: '#52525b' }}>{p.sku || '–'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><ABCBadge abc={p.abc_class} /></td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#a1a1aa' }}>
                    {p.supply_type === 'importado' ? '🌍 Import.' : '🇧🇷 Nac.'}
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
                        {p.tendencia === 'POSITIVA' ? 'Subindo' : p.tendencia === 'NEGATIVA' ? 'Caindo' : 'Estável'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#a1a1aa' }}>{fmtN(p.avg_daily_sales_30d, 2)} un</td>
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#e4e4e7' }}>{fmtN(p.current_stock)}</td>
                  {/* Dias est. — visual bar */}
                  <td className="px-3 py-2.5">
                    <StockBar days={p.days_of_stock} lead={p.lead_time_days} />
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#71717a' }}>{p.lead_time_days}d</td>
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
        <Block title="Comprar Agora" icon={<ShoppingCart size={15} />} count={criticals.length} color="#ef4444">
          {criticals.length === 0
            ? <p className="text-xs py-2" style={{ color: '#52525b' }}>Nenhum produto crítico</p>
            : criticals.slice(0, 6).map(p => (
              <BlockRow key={p.id}
                left={<><p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{p.name}</p><p className="text-[10px]" style={{ color: '#71717a' }}>{p.days_of_stock === 999 ? 'Sem giro' : `${p.days_of_stock}d restantes`} · Lead {p.lead_time_days}d</p></>}
                right={<><p className="text-xs font-bold" style={{ color: '#00E5FF' }}>{fmtN(p.sugestao_compra)} un</p><p className="text-[10px]" style={{ color: '#52525b' }}>{fmtBRL(p.sugestao_compra * p.cost_price)}</p></>}
              />
            ))
          }
        </Block>

        <Block title="Planejamento de Importação" icon={<Ship size={15} />} count={imports.length} color="#f97316">
          {imports.length === 0
            ? <p className="text-xs py-2" style={{ color: '#52525b' }}>Nenhuma importação urgente</p>
            : imports.slice(0, 6).map(p => {
              const dto = Math.max(0, p.days_of_stock === 999 ? 90 : p.days_of_stock - p.lead_time_days)
              return (
                <BlockRow key={p.id}
                  left={<><p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{p.name}</p><p className="text-[10px]" style={{ color: '#71717a' }}>Pedir até {new Date(Date.now() + dto * 86400000).toLocaleDateString('pt-BR')} · Chega {new Date(Date.now() + (dto + p.lead_time_days) * 86400000).toLocaleDateString('pt-BR')}</p></>}
                  right={<><p className="text-xs font-bold" style={{ color: '#f97316' }}>{fmtN(p.sugestao_compra)} un</p><p className="text-[10px]" style={{ color: '#52525b' }}>{fmtBRL(p.sugestao_compra * p.cost_price)}</p></>}
                />
              )
            })
          }
        </Block>

        <Block title="Estoque Parado" icon={<Package size={15} />} count={stopped.length} color="#6b7280">
          {stopped.length === 0
            ? <p className="text-xs py-2" style={{ color: '#52525b' }}>Nenhum produto parado</p>
            : stopped.slice(0, 6).map(p => (
              <BlockRow key={p.id}
                left={<><p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{p.name}</p><p className="text-[10px]" style={{ color: '#71717a' }}>{fmtN(p.current_stock)} un · Considere promoção</p></>}
                right={<><p className="text-xs font-bold" style={{ color: '#ef4444' }}>{fmtBRL(p.current_stock * p.cost_price)}</p><p className="text-[10px]" style={{ color: '#52525b' }}>capital imobilizado</p></>}
              />
            ))
          }
        </Block>

        <Block title="Oportunidades" icon={<Rocket size={15} />} count={opps.length} color="#22c55e">
          {opps.length === 0
            ? <p className="text-xs py-2" style={{ color: '#52525b' }}>Nenhuma oportunidade</p>
            : opps.slice(0, 6).map(p => {
              const growth = p.avg_daily_sales_30d > 0 ? ((p.sales_7d / 7 / p.avg_daily_sales_30d) - 1) * 100 : 0
              return (
                <BlockRow key={p.id}
                  left={<><p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{p.name}</p><p className="text-[10px]" style={{ color: '#71717a' }}>Estoque: {fmtN(p.current_stock)} un · Em ascensão</p></>}
                  right={<><p className="text-xs font-bold" style={{ color: '#22c55e' }}>+{fmtN(growth, 0)}%</p><p className="text-[10px]" style={{ color: '#52525b' }}>vs 30d</p></>}
                />
              )
            })
          }
        </Block>

        <div className="md:col-span-2">
          <Block title="Risco de Ruptura" icon={<AlertTriangle size={15} />} count={rupture.length} color="#f59e0b">
            {rupture.length === 0
              ? <p className="text-xs py-2" style={{ color: '#52525b' }}>Nenhum produto em risco de ruptura</p>
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  {rupture.slice(0, 8).map(p => {
                    const deficit = Math.max(0, p.lead_time_days * p.avg_daily_sales_30d - p.current_stock)
                    return (
                      <BlockRow key={p.id}
                        left={<><p className="text-xs font-medium truncate" style={{ color: '#e4e4e7' }}>{p.name}</p><p className="text-[10px]" style={{ color: '#71717a' }}>{p.days_of_stock}d restantes · Lead {p.lead_time_days}d · Déficit: {fmtN(deficit)} un</p></>}
                        right={<span className="text-xs font-bold" style={{ color: daysColor(p.days_of_stock, p.lead_time_days) }}>{p.days_of_stock < 1 ? 'ZEROU' : `${p.days_of_stock}d`}</span>}
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
