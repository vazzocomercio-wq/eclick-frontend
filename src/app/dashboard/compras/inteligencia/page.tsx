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
  d < lead ? '#ef4444' : d < lead * 2 ? '#f59e0b' : '#22c55e'

const abcColor = (a: string | null) =>
  a === 'A' ? '#22c55e' : a === 'B' ? '#f59e0b' : '#6b7280'

const fmtN = (n: number, d = 0) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

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
  if (!abc) return <span className="text-zinc-600 text-xs">–</span>
  return (
    <span className="inline-flex items-center justify-center rounded w-5 h-5 text-[11px] font-bold"
      style={{ background: abcColor(abc) + '22', color: abcColor(abc) }}>
      {abc}
    </span>
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
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3">
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
      <div>{left}</div>
      <div className="text-right">{right}</div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InteligenciaPage() {
  const [allItems, setAllItems]   = useState<Product[]>([])
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [loading, setLoading]     = useState(true)
  const [period, setPeriod]       = useState(30)
  const [typeF, setTypeF]         = useState('')
  const [abcF, setAbcF]           = useState('')
  const [scoreF, setScoreF]       = useState(0)
  const [q, setQ]                 = useState('')
  const [page, setPage]           = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setPage(0)
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

  // Block data (from unfiltered set)
  const criticals  = allItems.filter(p => p.score >= 85).sort((a, b) => b.score - a.score)
  const imports    = allItems.filter(p => p.supply_type === 'importado' && p.score >= 70).sort((a, b) => b.score - a.score)
  const stopped    = allItems.filter(p => p.days_of_stock > 180 && p.avg_daily_sales_30d < 0.1).sort((a, b) => b.current_stock * b.cost_price - a.current_stock * a.cost_price)
  const opps       = allItems.filter(p => p.tendencia === 'POSITIVA' && p.score >= 50).sort((a, b) => b.score - a.score)
  const rupture    = allItems.filter(p => p.days_of_stock < p.lead_time_days).sort((a, b) => a.days_of_stock - b.days_of_stock)

  const selStyle: React.CSSProperties = {
    background: '#18181b', border: '1px solid #27272a', borderRadius: 8,
    color: '#a1a1aa', fontSize: 12, padding: '6px 10px', outline: 'none',
  }

  return (
    <div style={{ background: '#09090b', minHeight: '100vh', padding: 24 }}>

      {/* ── Section 1: Header + Filters ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <Brain size={20} color="#00E5FF" />
          <h1 className="text-lg font-bold" style={{ color: '#e4e4e7' }}>Inteligência de Compras</h1>
        </div>
        <p className="text-xs mb-4" style={{ color: '#52525b' }}>
          Score preditivo por produto · {allItems.length} produtos analisados
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period */}
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
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
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
          <KpiCard icon={<ShoppingCart size={16} />} label="Capital sugerido"
            value={fmtBRL(summary.capital_sugerido)} sub="score ≥ 50" color="#00E5FF" />
          <KpiCard icon={<AlertTriangle size={16} />} label="Críticos"
            value={String(summary.produtos_criticos)} sub="score ≥ 85" color="#ef4444" />
          <KpiCard icon={<Ship size={16} />} label="Importar agora"
            value={String(summary.importacoes_urgentes)} sub="importados score ≥ 70" color="#f97316" />
          <KpiCard icon={<Package size={16} />} label="Parados"
            value={String(summary.produtos_parados)} sub="> 180 dias sem venda" color="#6b7280" />
          <KpiCard icon={<Rocket size={16} />} label="Oportunidades"
            value={String(summary.produtos_oportunidade)} sub="tendência positiva" color="#22c55e" />
          <KpiCard icon={<BarChart3 size={16} />} label="Cobertura média"
            value={`${fmtN(summary.cobertura_media)} dias`} sub="produtos ativos" color="#f59e0b" />
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
                className="px-2 py-1 rounded" style={{ background: '#18181b', opacity: page === 0 ? 0.4 : 1 }}>
                ←
              </button>
              <span>{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="px-2 py-1 rounded" style={{ background: '#18181b', opacity: page === totalPages - 1 ? 0.4 : 1 }}>
                →
              </button>
            </div>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ minWidth: 960 }}>
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
                <tr key={p.id} style={{ borderBottom: '1px solid #1a1a1f' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#111114')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {/* Produto */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {p.photo_url
                        ? <img src={p.photo_url} className="w-8 h-8 rounded object-cover shrink-0" />
                        : <div className="w-8 h-8 rounded shrink-0" style={{ background: '#1e1e24' }} />}
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#e4e4e7', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                        <p className="text-[10px]" style={{ color: '#52525b' }}>{p.sku || '–'}</p>
                      </div>
                    </div>
                  </td>
                  {/* ABC */}
                  <td className="px-3 py-2.5"><ABCBadge abc={p.abc_class} /></td>
                  {/* Tipo */}
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
                  {/* Giro/dia */}
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#a1a1aa' }}>
                    {fmtN(p.avg_daily_sales_30d, 2)} un
                  </td>
                  {/* Estoque */}
                  <td className="px-3 py-2.5 text-xs font-medium" style={{ color: '#e4e4e7' }}>
                    {fmtN(p.current_stock)}
                  </td>
                  {/* Dias est. */}
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-semibold" style={{ color: daysColor(p.days_of_stock, p.lead_time_days) }}>
                      {p.days_of_stock === 999 ? '∞' : `${fmtN(p.days_of_stock)}d`}
                    </span>
                  </td>
                  {/* Lead */}
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#71717a' }}>
                    {p.lead_time_days}d
                  </td>
                  {/* Score */}
                  <td className="px-3 py-2.5"><ScoreBadge score={p.score} /></td>
                  {/* Ação */}
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

      {/* ── Section 4: 5 Blocks ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Block 1: Comprar Agora */}
        <Block title="Comprar Agora" icon={<ShoppingCart size={15} />} count={criticals.length} color="#ef4444">
          {criticals.length === 0
            ? <p className="text-xs py-2" style={{ color: '#52525b' }}>Nenhum produto crítico</p>
            : criticals.slice(0, 6).map(p => (
              <BlockRow key={p.id}
                left={<>
                  <p className="text-xs font-medium" style={{ color: '#e4e4e7' }}>{p.name}</p>
                  <p className="text-[10px]" style={{ color: '#71717a' }}>
                    {p.days_of_stock === 999 ? 'Sem giro' : `${p.days_of_stock}d restantes`} · Lead {p.lead_time_days}d
                  </p>
                </>}
                right={<>
                  <p className="text-xs font-bold" style={{ color: '#00E5FF' }}>{fmtN(p.sugestao_compra)} un</p>
                  <p className="text-[10px]" style={{ color: '#52525b' }}>{fmtBRL(p.sugestao_compra * p.cost_price)}</p>
                </>}
              />
            ))
          }
        </Block>

        {/* Block 2: Planejamento de Importação */}
        <Block title="Planejamento de Importação" icon={<Ship size={15} />} count={imports.length} color="#f97316">
          {imports.length === 0
            ? <p className="text-xs py-2" style={{ color: '#52525b' }}>Nenhuma importação urgente</p>
            : imports.slice(0, 6).map(p => {
              const daysToOrder = Math.max(0, p.days_of_stock === 999 ? 0 : p.days_of_stock - p.lead_time_days)
              const orderDate   = new Date(Date.now() + daysToOrder * 86400000)
              const arrivalDate = new Date(Date.now() + (daysToOrder + p.lead_time_days) * 86400000)
              return (
                <BlockRow key={p.id}
                  left={<>
                    <p className="text-xs font-medium" style={{ color: '#e4e4e7' }}>{p.name}</p>
                    <p className="text-[10px]" style={{ color: '#71717a' }}>
                      Pedir até {orderDate.toLocaleDateString('pt-BR')} · Chega {arrivalDate.toLocaleDateString('pt-BR')}
                    </p>
                  </>}
                  right={<>
                    <p className="text-xs font-bold" style={{ color: '#f97316' }}>{fmtN(p.sugestao_compra)} un</p>
                    <p className="text-[10px]" style={{ color: '#52525b' }}>{fmtBRL(p.sugestao_compra * p.cost_price)}</p>
                  </>}
                />
              )
            })
          }
        </Block>

        {/* Block 3: Estoque Parado */}
        <Block title="Estoque Parado" icon={<Package size={15} />} count={stopped.length} color="#6b7280">
          {stopped.length === 0
            ? <p className="text-xs py-2" style={{ color: '#52525b' }}>Nenhum produto parado</p>
            : stopped.slice(0, 6).map(p => (
              <BlockRow key={p.id}
                left={<>
                  <p className="text-xs font-medium" style={{ color: '#e4e4e7' }}>{p.name}</p>
                  <p className="text-[10px]" style={{ color: '#71717a' }}>{fmtN(p.current_stock)} un · Considere promoção</p>
                </>}
                right={<>
                  <p className="text-xs font-bold" style={{ color: '#ef4444' }}>{fmtBRL(p.current_stock * p.cost_price)}</p>
                  <p className="text-[10px]" style={{ color: '#52525b' }}>capital imobilizado</p>
                </>}
              />
            ))
          }
        </Block>

        {/* Block 4: Oportunidades */}
        <Block title="Oportunidades" icon={<Rocket size={15} />} count={opps.length} color="#22c55e">
          {opps.length === 0
            ? <p className="text-xs py-2" style={{ color: '#52525b' }}>Nenhuma oportunidade</p>
            : opps.slice(0, 6).map(p => {
              const growth = p.avg_daily_sales_30d > 0
                ? ((p.sales_7d / 7 / p.avg_daily_sales_30d) - 1) * 100 : 0
              return (
                <BlockRow key={p.id}
                  left={<>
                    <p className="text-xs font-medium" style={{ color: '#e4e4e7' }}>{p.name}</p>
                    <p className="text-[10px]" style={{ color: '#71717a' }}>
                      Estoque: {fmtN(p.current_stock)} un · Produto em ascensão
                    </p>
                  </>}
                  right={<>
                    <p className="text-xs font-bold" style={{ color: '#22c55e' }}>+{fmtN(growth, 0)}%</p>
                    <p className="text-[10px]" style={{ color: '#52525b' }}>vs média 30d</p>
                  </>}
                />
              )
            })
          }
        </Block>

        {/* Block 5: Risco de Ruptura (full width) */}
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
                        left={<>
                          <p className="text-xs font-medium" style={{ color: '#e4e4e7' }}>{p.name}</p>
                          <p className="text-[10px]" style={{ color: '#71717a' }}>
                            {p.days_of_stock}d restantes · Lead {p.lead_time_days}d · Déficit: {fmtN(deficit)} un
                          </p>
                        </>}
                        right={
                          <span className="text-xs font-bold" style={{ color: daysColor(p.days_of_stock, p.lead_time_days) }}>
                            {p.days_of_stock < 1 ? 'ZEROU' : `${p.days_of_stock}d`}
                          </span>
                        }
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
