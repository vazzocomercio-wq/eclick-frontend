'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ArrowLeft, Plus, Sparkles, Pencil, Trash2, Pause, Play, X } from 'lucide-react'
import { api } from '../../_components/api'
import { brl, severityOf } from '../../_components/shared'

interface SeriesPoint { date: string; price: number | null; visits: number }
interface Movement { kind: string; severity: string; label: string }
interface Competitor {
  link_id: string
  item_id: string
  label: string | null
  title: string | null
  url: string | null
  thumbnail: string | null
  status: string
  current_price: number | null
  price_source: string | null
  price_updated_at: string | null
  visits_30d: number
  est_units_30d: number | null
  est_revenue_30d: number | null
  price_vs_us_pct: number | null
  series: SeriesPoint[]
  movements: Movement[]
}
interface Comparison {
  product: { id: string; name: string | null; sku: string | null; category_id: string | null; cost_price: number | null; my_price: number | null }
  conversion: { rate: number | null; basis: string; confidence: string; calc_date: string | null }
  our_side: { item_ids: string[]; min_price: number | null; visits_30d: number; real_units_30d: number; series: SeriesPoint[] }
  competitors: Competitor[]
}

const CARD = { background: '#111114', border: '1px solid #1a1a1f' }
const COMP_COLORS = ['#f59e0b', '#22c55e', '#a78bfa', '#f87171', '#fb923c', '#34d399']

export default function ComparacaoPage() {
  const params = useParams<{ productId: string }>()
  const productId = params?.productId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Comparison | null>(null)
  const [insight, setInsight] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    setError(null)
    try {
      setData(await api<Comparison>(`/radar/competitors/products/${productId}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!productId || !data || data.competitors.length === 0) return
    let alive = true
    ;(async () => {
      try {
        const r = await api<{ insight: string }>(`/radar/competitors/products/${productId}/insight`)
        if (alive) setInsight(r.insight)
      } catch { /* insight é best-effort */ }
    })()
    return () => { alive = false }
  }, [productId, data])

  const labelOf = useCallback((c: Competitor, i: number) =>
    c.label || c.title || `Concorrente ${i + 1}`, [])

  const priceChart = useMemo(() => data ? mergeSeries(data, 'price', labelOf) : [], [data, labelOf])
  const visitsChart = useMemo(() => data ? mergeSeries(data, 'visits', labelOf) : [], [data, labelOf])

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      <Link href="/dashboard/radar/concorrentes"
        className="inline-flex items-center gap-1.5 text-xs mb-4 hover:text-zinc-300 transition-colors"
        style={{ color: '#71717a' }}>
        <ArrowLeft size={13} /> Concorrentes Vinculados
      </Link>

      {error && (
        <div className="rounded-lg p-3 text-sm mb-5" style={{
          background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
        }}>{error}</div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="h-9 w-2/3 rounded bg-zinc-800/50 animate-pulse" />
          <div className="h-24 rounded-xl bg-zinc-800/30 animate-pulse" />
          <div className="h-64 rounded-xl bg-zinc-800/30 animate-pulse" />
        </div>
      )}

      {!loading && data && (
        <>
          <div className="flex items-start justify-between gap-4 mb-1">
            <h1 className="text-xl font-bold" style={{ color: '#fafafa' }}>
              {data.product.name ?? data.product.id}
            </h1>
            <button onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shrink-0"
              style={{ background: '#00E5FF', color: '#09090b' }}>
              <Plus size={14} /> Vincular concorrente
            </button>
          </div>
          <p className="text-xs mb-5" style={{ color: '#52525b' }}>
            {data.product.sku ? `SKU ${data.product.sku}` : '—'} · seu anúncio vs concorrentes vinculados
          </p>

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Kpi label="Seu preço" value={brl(data.our_side.min_price)} />
            <Kpi label="Suas visitas (30d)" value={data.our_side.visits_30d.toLocaleString('pt-BR')} />
            <Kpi label="Suas vendas reais (30d)" value={`${data.our_side.real_units_30d.toLocaleString('pt-BR')} un`} accent />
            <Kpi label="Concorrentes" value={String(data.competitors.length)} />
          </div>

          {/* Insight IA */}
          {data.competitors.length > 0 && (
            <div className="rounded-xl p-4 mb-5" style={{
              background: '#111114', border: '1px solid rgba(0,229,255,0.25)',
            }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={14} style={{ color: '#00E5FF' }} />
                <h2 className="text-sm font-semibold" style={{ color: '#fafafa' }}>Leitura do Radar</h2>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: insight ? '#d4d4d8' : '#52525b' }}>
                {insight ?? 'Analisando os movimentos dos concorrentes…'}
              </p>
            </div>
          )}

          {data.competitors.length === 0 && (
            <div className="rounded-xl p-10 text-center" style={CARD}>
              <p className="text-sm font-medium" style={{ color: '#fafafa' }}>Nenhum concorrente vinculado a este produto</p>
              <p className="text-xs mt-1 mb-4" style={{ color: '#71717a' }}>
                Vincule anúncios de concorrente para comparar preço, visitas e venda estimada.
              </p>
              <button onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
                style={{ background: '#00E5FF', color: '#09090b' }}>
                <Plus size={14} /> Vincular concorrente
              </button>
            </div>
          )}

          {data.competitors.length > 0 && (
            <>
              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                <ChartCard title="Preço ao longo do tempo">
                  <CompareChart data={priceChart} comps={data.competitors} labelOf={labelOf}
                    fmt={(v: number) => `R$${v}`} />
                </ChartCard>
                <ChartCard title="Visitas ao longo do tempo">
                  <CompareChart data={visitsChart} comps={data.competitors} labelOf={labelOf} />
                </ChartCard>
              </div>

              {/* Conversão usada */}
              <p className="text-[10px] mb-4" style={{ color: '#52525b' }}>
                Venda estimada do concorrente = visitas × {data.conversion.rate != null
                  ? `conversão de ${(data.conversion.rate * 100).toFixed(1).replace('.', ',')}% (calibrada por ${data.conversion.basis}${data.conversion.confidence === 'low' ? ', confiança baixa' : ''})`
                  : 'conversão ainda não calibrada'}. É estimativa — não a venda real do concorrente.
              </p>

              {/* Cards de concorrente */}
              <div className="space-y-3">
                {data.competitors.map((c, i) => (
                  <CompetitorCard key={c.link_id} comp={c} color={COMP_COLORS[i % COMP_COLORS.length]}
                    name={labelOf(c, i)} onChanged={load} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {addOpen && productId && (
        <AddCompetitorModal productId={productId}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); void load() }} />
      )}
    </div>
  )
}

// ── Card de concorrente ───────────────────────────────────────────────────────

function CompetitorCard({ comp, color, name, onChanged }: {
  comp: Competitor; color: string; name: string; onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [priceInput, setPriceInput] = useState(comp.current_price != null ? String(comp.current_price) : '')
  const [busy, setBusy] = useState(false)

  const savePrice = async () => {
    setBusy(true)
    try {
      await api(`/radar/competitors/links/${comp.link_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_price: Number(priceInput.replace(',', '.')) }),
      })
      setEditing(false)
      onChanged()
    } catch { setBusy(false) }
  }
  const toggleStatus = async () => {
    setBusy(true)
    try {
      await api(`/radar/competitors/links/${comp.link_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: comp.status === 'ativo' ? 'pausado' : 'ativo' }),
      })
      onChanged()
    } catch { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(`Remover o vínculo com "${name}"?`)) return
    setBusy(true)
    try {
      await api(`/radar/competitors/links/${comp.link_id}`, { method: 'DELETE' })
      onChanged()
    } catch { setBusy(false) }
  }

  const vs = comp.price_vs_us_pct
  return (
    <div className="rounded-xl p-4" style={{
      ...CARD, opacity: comp.status === 'pausado' ? 0.55 : 1,
    }}>
      <div className="flex items-start gap-3">
        <span className="h-2.5 w-2.5 rounded-full mt-1 shrink-0" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate" style={{ color: '#fafafa' }}>{name}</span>
            {comp.status === 'pausado' && (
              <span className="text-[9px] rounded px-1.5 py-0.5" style={{ background: '#27272a', color: '#a1a1aa' }}>pausado</span>
            )}
          </div>
          {comp.url && (
            <a href={comp.url} target="_blank" rel="noopener noreferrer"
              className="text-[10px] hover:underline" style={{ color: '#52525b' }}>
              {comp.item_id} ↗
            </a>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={toggleStatus} disabled={busy} title={comp.status === 'ativo' ? 'Pausar' : 'Retomar'}
            className="p-1.5 rounded hover:bg-white/[0.05]">
            {comp.status === 'ativo'
              ? <Pause size={13} style={{ color: '#71717a' }} />
              : <Play size={13} style={{ color: '#71717a' }} />}
          </button>
          <button onClick={remove} disabled={busy} title="Remover"
            className="p-1.5 rounded hover:bg-white/[0.05]">
            <Trash2 size={13} style={{ color: '#71717a' }} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
        <div>
          <p className="text-[10px] mb-1" style={{ color: '#71717a' }}>Preço dele</p>
          {editing ? (
            <div className="flex items-center gap-1">
              <input value={priceInput} onChange={e => setPriceInput(e.target.value)} inputMode="decimal" autoFocus
                className="w-20 rounded px-1.5 py-1 text-sm tabular-nums outline-none"
                style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
              <button onClick={savePrice} disabled={busy} className="text-[10px]" style={{ color: '#4ade80' }}>ok</button>
              <button onClick={() => { setEditing(false); setPriceInput(comp.current_price != null ? String(comp.current_price) : '') }}
                className="text-[10px]" style={{ color: '#71717a' }}>x</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 group">
              <span className="text-base font-semibold tabular-nums" style={{ color: '#fafafa' }}>
                {brl(comp.current_price)}
              </span>
              <Pencil size={11} style={{ color: '#52525b' }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
        <div>
          <p className="text-[10px] mb-1" style={{ color: '#71717a' }}>Preço vs você</p>
          <p className="text-base font-semibold tabular-nums"
            style={{ color: vs == null ? '#71717a' : vs < 0 ? '#f87171' : vs > 0 ? '#4ade80' : '#fafafa' }}>
            {vs == null ? '—' : `${vs > 0 ? '+' : ''}${vs.toString().replace('.', ',')}%`}
          </p>
        </div>
        <div>
          <p className="text-[10px] mb-1" style={{ color: '#71717a' }}>Visitas (30d)</p>
          <p className="text-base font-semibold tabular-nums" style={{ color: '#fafafa' }}>
            {comp.visits_30d.toLocaleString('pt-BR')}
          </p>
        </div>
        <div>
          <p className="text-[10px] mb-1" style={{ color: '#71717a' }}>Venda estimada (30d)</p>
          <p className="text-base font-semibold tabular-nums" style={{ color: '#a1a1aa' }}>
            {comp.est_units_30d == null ? '—' : `~${comp.est_units_30d.toLocaleString('pt-BR')} un`}
          </p>
        </div>
      </div>

      {comp.movements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {comp.movements.map((m, j) => {
            const sev = severityOf(m.severity)
            return (
              <span key={j} className="text-[10px] rounded px-2 py-1"
                style={{ background: sev.bg, color: sev.text, border: `1px solid ${sev.rule}33` }}>
                {m.label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Modal de vínculo (produto fixo) ───────────────────────────────────────────

function AddCompetitorModal({ productId, onClose, onSaved }: {
  productId: string; onClose: () => void; onSaved: () => void
}) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setErr(null)
    if (!url.trim()) { setErr('Cole o link do anúncio concorrente.'); return }
    setSaving(true)
    try {
      await api('/radar/competitors/links', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productId,
          url: url.trim(),
          label: label.trim() || undefined,
          current_price: price ? Number(price.replace(',', '.')) : undefined,
        }),
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-5" style={CARD} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: '#fafafa' }}>Vincular concorrente</h2>
          <button onClick={onClose}><X size={16} style={{ color: '#71717a' }} /></button>
        </div>

        <label className="text-[11px] block mb-1" style={{ color: '#a1a1aa' }}>Link do anúncio concorrente</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://produto.mercadolivre.com.br/MLB-…"
          className="w-full rounded-lg px-3 py-2 text-xs outline-none mb-3"
          style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] block mb-1" style={{ color: '#a1a1aa' }}>Apelido (opcional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Loja barata"
              className="w-full rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
          </div>
          <div>
            <label className="text-[11px] block mb-1" style={{ color: '#a1a1aa' }}>Preço dele (R$)</label>
            <input value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" inputMode="decimal"
              className="w-full rounded-lg px-3 py-2 text-xs outline-none tabular-nums"
              style={{ background: '#0a0a0e', border: '1px solid #27272a', color: '#fafafa' }} />
          </div>
        </div>
        <p className="text-[10px] mb-3" style={{ color: '#52525b' }}>
          O Mercado Livre não libera o preço de concorrente — por isso você informa. As visitas são coletadas sozinhas.
        </p>

        {err && (
          <div className="rounded-lg p-2.5 text-xs mb-3" style={{
            background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
          }}>{err}</div>
        )}

        <button onClick={submit} disabled={saving}
          className="w-full rounded-lg py-2.5 text-xs font-medium transition-opacity disabled:opacity-50"
          style={{ background: '#00E5FF', color: '#09090b' }}>
          {saving ? 'Salvando…' : 'Vincular'}
        </button>
      </div>
    </div>
  )
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-3.5" style={CARD}>
      <p className="text-[10px] mb-1" style={{ color: '#71717a' }}>{label}</p>
      <p className="text-lg font-bold tabular-nums" style={{ color: accent ? '#4ade80' : '#fafafa' }}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={CARD}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: '#fafafa' }}>{title}</h2>
      {children}
    </div>
  )
}

function CompareChart({ data, comps, labelOf, fmt }: {
  data: Array<Record<string, number | string>>
  comps: Competitor[]
  labelOf: (c: Competitor, i: number) => string
  fmt?: (v: number) => string
}) {
  if (data.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center">
        <p className="text-xs" style={{ color: '#52525b' }}>Sem dados ainda — a coleta diária preenche isto.</p>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e24" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} width={50}
          tickFormatter={fmt} />
        <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#a1a1aa' }} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} iconSize={9} />
        <Line type="monotone" dataKey="Você" stroke="#00E5FF" strokeWidth={1.8} dot={false} connectNulls />
        {comps.map((c, i) => (
          <Line key={c.link_id} type="monotone" dataKey={labelOf(c, i)}
            stroke={COMP_COLORS[i % COMP_COLORS.length]} strokeWidth={1.5} dot={false} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Funde as séries (nossa + concorrentes) num dataset único por data pro recharts. */
function mergeSeries(
  data: Comparison,
  field: 'price' | 'visits',
  labelOf: (c: Competitor, i: number) => string,
): Array<Record<string, number | string>> {
  const byDate = new Map<string, Record<string, number | string>>()
  const ensure = (d: string): Record<string, number | string> => {
    let row = byDate.get(d)
    if (!row) { row = { date: d.slice(5) }; byDate.set(d, row) }
    return row
  }
  for (const p of data.our_side.series) {
    const v = p[field]
    if (v != null) ensure(p.date)['Você'] = v
  }
  data.competitors.forEach((c, i) => {
    const name = labelOf(c, i)
    for (const p of c.series) {
      const v = p[field]
      if (v != null) ensure(p.date)[name] = v
    }
  })
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, row]) => row)
}
