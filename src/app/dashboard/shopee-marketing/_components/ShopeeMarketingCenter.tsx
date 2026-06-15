'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle, RefreshCw, Sparkles, Boxes, Eye, TrendingUp, Radar,
  Tag, Zap, Ticket, Check, X, Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { computeContributionMargin, round2 } from '@/lib/margin'

/** F18 Marketing inteligente — Central de Marketing Shopee.
 *  Consome GET /shopee/marketing/recommendations (motor margem-safe) e deixa
 *  aplicar a promoção (POST /apply, vehicle=discount) com desconto ajustável e
 *  margem ao vivo — sempre respeitando o piso. O "aplicar" cria o Desconto REAL
 *  na Shopee (escopo confirmado). */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN = '#00E5FF'
const SHOPEE = '#EE4D2D'

type ObjKey = 'overstock' | 'visibility' | 'profit' | 'opportunity'
const OBJECTIVES: { key: ObjKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overstock',   label: 'Girar estoque',  icon: <Boxes size={13} /> },
  { key: 'visibility',  label: 'Visibilidade',   icon: <Eye size={13} /> },
  { key: 'profit',      label: 'Lucro',          icon: <TrendingUp size={13} /> },
  { key: 'opportunity', label: 'Oportunidade',   icon: <Radar size={13} /> },
]

interface Rec {
  item_id: number
  title: string | null
  thumbnail: string | null
  product_id: string
  sku: string | null
  price: number
  cost: number
  algo_score: number | null
  stock: number
  sales_60d: number
  months_of_stock: number
  max_safe_discount_pct: number
  recommended: { vehicle: 'flash_sale' | 'voucher' | 'discount'; discount_pct: number; effective_price: number; projected_margin_pct: number; passes_floor: boolean }
  objective_scores: { overstock: number; visibility: number; profit: number; opportunity: number }
  priority: number
  rationale: string
}
interface RecResponse {
  floor_pct: number
  commission_pct: number
  objectives: string[]
  total_candidates: number
  already_promoted?: number
  recommendations: Rec[]
  warnings: string[]
}

export default function ShopeeMarketingCenter() {
  const [data, setData]     = useState<RecResponse | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [objs, setObjs]     = useState<Set<ObjKey>>(new Set(OBJECTIVES.map(o => o.key)))
  const [tab, setTab]       = useState<'recs' | 'outcomes'>('recs')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const headers = await authHeaders()
      const q = [...objs].join(',')
      const res = await fetch(`${BACKEND}/shopee/marketing/recommendations?objectives=${q}&limit=80`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json() as RecResponse)
    } catch (e) {
      setError((e as Error).message); setData(null)
    } finally { setLoading(false) }
  }, [objs])

  useEffect(() => { void load() }, [load])

  const toggleObj = (k: ObjKey) => setObjs(prev => {
    const n = new Set(prev)
    if (n.has(k)) { if (n.size > 1) n.delete(k) } else n.add(k)
    return n
  })

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(238,77,45,0.15)', color: SHOPEE }}><Sparkles size={18} /></div>
        <div>
          <h1 className="text-white text-lg font-semibold">Marketing Shopee inteligente</h1>
          <p className="text-zinc-500 text-xs">
            Recomendações margem-safe de Oferta Relâmpago / Cupom / Desconto
            {data && <span className="text-zinc-600"> · {data.total_candidates} produtos analisados · piso {data.floor_pct}% · take estimado {data.commission_pct.toFixed(1)}%{data.already_promoted ? ` · ${data.already_promoted} já em campanha (ver Resultados)` : ''}</span>}
          </p>
        </div>
        <button onClick={load} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
          style={{ borderColor: '#2e2e33', color: '#a1a1aa', background: '#111114' }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: '#1e1e24' }}>
        {([['recs', 'Recomendações'], ['outcomes', 'Resultados']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className="px-3 py-2 text-xs font-semibold transition-colors -mb-px border-b-2"
            style={tab === k ? { color: CYAN, borderColor: CYAN } : { color: '#71717a', borderColor: 'transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'outcomes' ? <OutcomesPanel /> : (
      <>
      {/* Objetivos */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-zinc-500">Priorizar:</span>
        {OBJECTIVES.map(o => {
          const on = objs.has(o.key)
          return (
            <button key={o.key} onClick={() => toggleObj(o.key)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
              style={on
                ? { background: 'rgba(0,229,255,0.1)', color: CYAN, border: '1px solid rgba(0,229,255,0.35)' }
                : { background: '#111114', color: '#71717a', border: '1px solid #27272a' }}>
              {o.icon} {o.label}
            </button>
          )
        })}
      </div>

      {data?.warnings?.map((w, i) => (
        <div key={i} className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300/90 flex-1">{w}</p>
        </div>
      ))}

      {error && (
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <AlertCircle size={14} className="text-red-400" />
          <p className="text-xs text-red-300 flex-1">{error}</p>
          <button onClick={load} className="text-xs text-red-300 underline">tentar de novo</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-12 justify-center"><Loader2 size={16} className="animate-spin" /> Analisando catálogo…</div>
      ) : !data || data.recommendations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 rounded-2xl" style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
          <Sparkles size={20} className="text-zinc-600" />
          <p className="text-sm text-zinc-300">Nenhuma recomendação no momento.</p>
          <p className="text-xs text-zinc-500 text-center max-w-md">Vincule anúncios a produtos com custo cadastrado para o motor calcular descontos margem-safe.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.recommendations.map(r => (
            <RecCard key={r.item_id} rec={r} commissionPct={data.commission_pct} floorPct={data.floor_pct} onApplied={load} />
          ))}
        </div>
      )}
      </>
      )}
    </div>
  )
}

// ── Aba Resultados (loop de outcome) ────────────────────────────────────────
interface Outcome {
  id: string; item_id: number; vehicle: string; discount_pct: number; status: string
  window_start: string | null; window_end: string | null
  baseline_units: number; promo_units: number; lift_units: number; lift_pct: number
  margin_cost: number; verdict: 'pending' | 'positive' | 'neutral' | 'negative'
}
function OutcomesPanel() {
  const [rows, setRows]   = useState<Outcome[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders()
        const res = await fetch(`${BACKEND}/shopee/marketing/outcomes`, { headers })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const j = await res.json() as { outcomes: Outcome[] }
        setRows(j.outcomes ?? [])
      } catch (e) { setError((e as Error).message); setRows([]) }
    })()
  }, [])

  if (error) return <div className="rounded-xl p-3 text-xs text-red-300" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>{error}</div>
  if (rows === null) return <div className="flex items-center gap-2 text-zinc-500 text-sm py-12 justify-center"><Loader2 size={16} className="animate-spin" /> Medindo resultados…</div>
  if (rows.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-12 rounded-2xl" style={{ background: '#111114', border: '1px dashed #2e2e33' }}>
      <TrendingUp size={20} className="text-zinc-600" />
      <p className="text-sm text-zinc-300">Nenhuma promoção aplicada ainda.</p>
      <p className="text-xs text-zinc-500 text-center max-w-md">Aplique um desconto na aba Recomendações — depois o resultado (venda × custo de margem) aparece aqui.</p>
    </div>
  )
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-zinc-500" style={{ borderBottom: '1px solid #1e1e24' }}>
            <th className="text-left font-medium px-3 py-2">Anúncio</th>
            <th className="text-center font-medium px-3 py-2">Desconto</th>
            <th className="text-center font-medium px-3 py-2">Status</th>
            <th className="text-center font-medium px-3 py-2">Baseline</th>
            <th className="text-center font-medium px-3 py-2">Na promo</th>
            <th className="text-center font-medium px-3 py-2">Lift</th>
            <th className="text-right font-medium px-3 py-2">Custo margem</th>
            <th className="text-center font-medium px-3 py-2">Veredito</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const v = verdictInfo(r.verdict)
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid #15151a' }}>
                <td className="px-3 py-2 font-mono text-zinc-400">#{r.item_id}</td>
                <td className="px-3 py-2 text-center text-zinc-300">{r.discount_pct}%</td>
                <td className="px-3 py-2 text-center text-zinc-500">{r.status}</td>
                <td className="px-3 py-2 text-center text-zinc-400 tabular-nums">{r.baseline_units}</td>
                <td className="px-3 py-2 text-center text-zinc-200 tabular-nums">{r.promo_units}</td>
                <td className="px-3 py-2 text-center tabular-nums" style={{ color: r.lift_units > 0 ? '#4ade80' : r.lift_units < 0 ? '#f87171' : '#71717a' }}>
                  {r.lift_units > 0 ? '+' : ''}{r.lift_units} ({r.lift_pct.toFixed(0)}%)
                </td>
                <td className="px-3 py-2 text-right text-amber-400/80 tabular-nums">{brl(r.margin_cost)}</td>
                <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${v.color}1a`, color: v.color }}>{v.label}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
function verdictInfo(v: Outcome['verdict']) {
  if (v === 'positive') return { label: 'positivo', color: '#4ade80' }
  if (v === 'negative') return { label: 'negativo', color: '#f87171' }
  if (v === 'neutral')  return { label: 'neutro', color: '#a1a1aa' }
  return { label: 'aguardando', color: '#fbbf24' }
}

function RecCard({ rec, commissionPct, floorPct, onApplied }: { rec: Rec; commissionPct: number; floorPct: number; onApplied: () => void }) {
  const [disc, setDisc] = useState(rec.recommended.discount_pct)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState<{ discount_id?: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // margem ao vivo (aprox: imposto via re-cálculo; servidor re-guarda no apply)
  const effPrice = round2(rec.price * (1 - disc / 100))
  const mm = computeContributionMargin({ price: effPrice, saleFee: round2(effPrice * commissionPct / 100), shipping: 0, cost: rec.cost, taxPercentage: 0, taxOnFreight: false })
  const marginPct = mm.contributionMarginPct
  const marginColor = marginPct < floorPct ? '#f87171' : marginPct < floorPct + 7 ? '#fbbf24' : '#4ade80'
  const overFloor = marginPct >= floorPct

  const vh = vehicleInfo(rec.recommended.vehicle)

  async function apply() {
    setBusy(true); setErr(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/marketing/apply`, {
        method: 'POST', headers,
        body: JSON.stringify({ item_id: rec.item_id, discount_pct: disc, vehicle: 'discount' }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`)
      setApplied({ discount_id: j.discount_id })
      setConfirm(false)
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  async function cancel() {
    if (!applied?.discount_id) return
    setBusy(true); setErr(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BACKEND}/shopee/marketing/cancel-discount`, {
        method: 'POST', headers, body: JSON.stringify({ discount_id: applied.discount_id }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message ?? `HTTP ${res.status}`) }
      setApplied(null)
      onApplied()
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="flex gap-3 p-4 rounded-xl" style={{ background: '#0f0f12', border: '1px solid #1a1a1f' }}>
      {/* thumb */}
      <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800">
        {rec.thumbnail
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={rec.thumbnail} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">SH</div>}
      </div>

      {/* info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: `${vh.color}1a`, color: vh.color, border: `1px solid ${vh.color}33` }}>{vh.icon} {vh.label}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#1a1a1f', color: '#a1a1aa', border: '1px solid #27272a' }}>Prioridade {rec.priority}</span>
          {rec.algo_score != null && <span className="text-[10px] text-zinc-500">Score {rec.algo_score}</span>}
          <span className="text-[10px] text-zinc-500">Estoque {rec.stock}</span>
          <span className="text-[10px] text-zinc-500">{rec.sales_60d} vendas/60d</span>
        </div>
        <p className="text-sm font-medium text-zinc-100 line-clamp-1">{rec.title ?? `Item ${rec.item_id}`}</p>
        <p className="text-[11px] text-zinc-500 mb-1.5">#{rec.item_id}{rec.sku ? ` · SKU ${rec.sku}` : ''}</p>
        <p className="text-[11px] text-zinc-400 leading-snug">{rec.rationale}</p>
      </div>

      {/* ação */}
      <div className="shrink-0 w-64 flex flex-col gap-1.5">
        {applied ? (
          <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)' }}>
            <Check size={16} className="mx-auto text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-300 mt-1">Promoção criada na Shopee</p>
            <p className="text-[10px] text-emerald-500/80">{disc}% OFF · agendada (+1h, 7 dias)</p>
            <button onClick={cancel} disabled={busy} className="mt-2 text-[11px] text-zinc-400 hover:text-red-400 underline disabled:opacity-50">
              {busy ? 'cancelando…' : 'cancelar promoção'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-zinc-500">Desconto</span>
              <span className="text-lg font-bold tabular-nums" style={{ color: CYAN }}>{disc}%</span>
            </div>
            <input type="range" min={1} max={Math.max(rec.max_safe_discount_pct, 1)} value={disc}
              onChange={e => setDisc(Number(e.target.value))}
              className="w-full accent-cyan-400" />
            <div className="flex justify-between text-[10px] text-zinc-600">
              <span>preço {brl(effPrice)}</span>
              <span>teto seguro {rec.max_safe_discount_pct}%</span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1" style={{ borderTop: '1px solid #1e1e24' }}>
              <span className="text-zinc-500">Margem projetada</span>
              <span className="font-bold" style={{ color: marginColor }}>{marginPct.toFixed(1)}% {overFloor ? '' : `(< piso ${floorPct}%)`}</span>
            </div>
            {confirm ? (
              <div className="flex gap-1.5">
                <button onClick={() => setConfirm(false)} className="flex-1 rounded-lg py-1.5 text-[11px] font-medium" style={{ border: '1px solid #27272a', color: '#a1a1aa' }}>Cancelar</button>
                <button onClick={apply} disabled={busy || !overFloor} className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-opacity disabled:opacity-50" style={{ background: SHOPEE, color: '#fff' }}>
                  {busy ? 'Criando…' : 'Confirmar'}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirm(true)} disabled={!overFloor}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-opacity disabled:opacity-40"
                style={{ background: overFloor ? CYAN : '#27272a', color: overFloor ? '#06181c' : '#71717a' }}>
                <Tag size={12} /> Aplicar desconto na Shopee
              </button>
            )}
          </>
        )}
        {err && <p className="text-[11px] text-red-400 flex items-start gap-1"><X size={12} className="mt-0.5 shrink-0" />{err}</p>}
      </div>
    </div>
  )
}

function vehicleInfo(v: Rec['recommended']['vehicle']) {
  if (v === 'flash_sale') return { label: 'Oferta Relâmpago', color: SHOPEE, icon: <Zap size={11} /> }
  if (v === 'voucher')    return { label: 'Cupom', color: '#a78bfa', icon: <Ticket size={11} /> }
  return { label: 'Desconto', color: CYAN, icon: <Tag size={11} /> }
}

async function authHeaders(): Promise<Record<string, string>> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }
}

const brl = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
