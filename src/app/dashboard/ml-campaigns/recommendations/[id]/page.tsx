'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, ExternalLink, Sparkles, Check, X, Edit3,
  AlertOctagon, ShieldCheck, TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { CopyButton } from '@/components/ui/copy-button'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Recommendation {
  id:                     string
  organization_id:        string
  seller_id:              number
  campaign_item_id:       string
  product_id:             string | null
  cost_breakdown:         Record<string, number>
  scenarios:              {
    conservative?: PriceScenario
    competitive?:  PriceScenario
    aggressive?:   PriceScenario
    break_even?:   { price: number; rationale: string }
  }
  quantity_recommendation: {
    current_stock?:           number
    avg_daily_sales?:         number
    campaign_duration_days?:  number
    expected_demand_during?:  number
    safety_stock?:            number
    recommended_max_qty?:     number
    stock_after_campaign?:    number
    rupture_risk?:            string
    rationale?:               string
  }
  opportunity_score:      number | null
  score_breakdown:        Record<string, number>
  recommendation:         string
  recommendation_reason:  string
  recommended_strategy:   string | null
  recommended_price:      number | null
  recommended_quantity:   number | null
  warnings:               Array<{ code: string; severity: string; message: string }>
  status:                 string
  expires_at:             string | null
  ml_campaign_items?: {
    ml_item_id:       string
    ml_campaign_id:   string
    ml_promotion_type: string
    original_price:   number | null
    current_price:    number | null
    min_discounted_price: number | null
    max_discounted_price: number | null
    status:           string
    has_meli_subsidy: boolean
    meli_percentage:  number | null
    meli_subsidy_amount: number | null
    ml_campaigns?: { name: string | null; ml_promotion_type: string; deadline_date: string | null }
  }
}

interface PriceScenario {
  price:           number
  discount_pct:    number
  margin_brl:      number
  margin_pct:      number
  expected_volume: string
  rationale:       string
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

function brl(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function RecoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [reco, setReco]       = useState<Recommendation | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState<'approve' | 'reject' | 'edit' | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editPrice, setEditPrice] = useState('')
  const [editQty, setEditQty]     = useState('')
  const [strategy, setStrategy]   = useState<'conservative' | 'competitive' | 'aggressive' | null>(null)
  // Threshold do soft gate vindo de ml_campaigns_config (default 10% se não conseguir buscar).
  // Usado pra colorir o feedback de margem em tempo real.
  const [gateThreshold, setGateThreshold] = useState<number>(10)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const r = await fetch(`${BACKEND}/ml-campaigns/recommendations/${id}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const text = await r.text()
      const data = text ? JSON.parse(text) as Recommendation : null
      setReco(data)
      if (data?.recommended_strategy) setStrategy(data.recommended_strategy as any)
      if (data?.recommended_price)    setEditPrice(String(data.recommended_price))
      if (data?.recommended_quantity) setEditQty(String(data.recommended_quantity))

      // Busca threshold do soft gate da config (best-effort, não bloqueia).
      // Aplica override por tipo de campanha se existir.
      if (data?.seller_id) {
        try {
          const cfgRes = await fetch(`${BACKEND}/ml-campaigns/config?seller_id=${data.seller_id}`, { headers: { Authorization: `Bearer ${t}` } })
          if (cfgRes.ok) {
            const cfg = await cfgRes.json() as {
              min_approval_margin_pct?: number;
              per_campaign_type_overrides?: Record<string, number>;
            }
            const type = data.ml_campaign_items?.ml_campaigns?.ml_promotion_type
            const override = (type && cfg.per_campaign_type_overrides) ? cfg.per_campaign_type_overrides[type] : undefined
            setGateThreshold(Number(override ?? cfg.min_approval_margin_pct ?? 10))
          }
        } catch { /* fallback default 10 */ }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function approve(withEdit = false) {
    if (!reco) return
    setBusy('approve')
    try {
      const t = await getToken()
      const body: Record<string, unknown> = {}
      if (withEdit) {
        if (editPrice) body.price    = Number(editPrice)
        if (editQty)   body.quantity = Number(editQty)
      } else if (strategy && reco.scenarios[strategy]) {
        body.price = reco.scenarios[strategy]!.price
      }
      const r = await fetch(`${BACKEND}/ml-campaigns/recommendations/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({} as { message?: string }))
        throw new Error(errBody.message ?? `HTTP ${r.status}`)
      }
      const result = await r.json() as {
        gate_triggered?:        boolean
        attempted_margin_pct?:  number
        threshold_pct?:         number
        recent_attempts_count?: number
        audit_threshold?:       number
      }
      if (result.gate_triggered) {
        // Margem abaixo — foi pra fila do gestor
        const m = result.attempted_margin_pct?.toFixed(1) ?? '?'
        const t = result.threshold_pct?.toFixed(1) ?? '?'
        let extra = ''
        if (result.recent_attempts_count != null && result.audit_threshold != null
            && result.recent_attempts_count > result.audit_threshold) {
          extra = `\n\n⚠ ATENÇÃO: você teve ${result.recent_attempts_count} tentativas abaixo do limite nos últimos 30 dias (limite ${result.audit_threshold}). O gestor foi notificado.`
        }
        alert(`📋 Enviado pra fila do gestor.\n\nMargem ${m}% < ${t}% (limite). O gestor vai revisar e decidir aprovar ou rejeitar.${extra}`)
      }
      router.push('/dashboard/ml-campaigns/recommendations')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function reject() {
    if (!reco || !confirm('Rejeitar essa recomendação?')) return
    setBusy('reject')
    try {
      const t = await getToken()
      const r = await fetch(`${BACKEND}/ml-campaigns/recommendations/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      router.push('/dashboard/ml-campaigns/recommendations')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      </div>
    )
  }

  if (error || !reco) {
    return (
      <div className="p-6 max-w-5xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
        <Link href="/dashboard/ml-campaigns/recommendations" className="inline-flex items-center gap-1 text-cyan-400 text-xs mb-3">
          <ArrowLeft size={12} /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error || 'Recomendação não encontrada.'}
        </div>
      </div>
    )
  }

  const item = reco.ml_campaign_items
  const cb = reco.cost_breakdown
  const score = reco.opportunity_score ?? 0
  const isPending = reco.status === 'pending'

  // Margem em tempo real conforme user digita o preço.
  // Custos % (imposto, comissão ML) são RECALCULADOS no novo preço.
  // Custos fixos (cost_price, taxa fixa, frete grátis, embalagem,
  // operacional, subsídio MELI) ficam como snapshot.
  // Aproximação: operational_cost tratado como fixo (no config pode
  // ser %, mas erro é pequeno e damos feedback rápido).
  const liveMargin = (() => {
    const price = Number(editPrice)
    if (!price || price <= 0 || !cb) return null
    const taxPct       = Number(cb.tax_percentage ?? 0) / 100
    const commissionPct = Number(cb.ml_commission_pct ?? 0) / 100
    const variableCosts = price * taxPct + price * commissionPct
    const fixedCosts =
      Number(cb.cost_price        ?? 0)
    + Number(cb.ml_fixed_fee       ?? 0)
    + Number(cb.free_shipping_cost ?? 0)
    + Number(cb.packaging_cost     ?? 0)
    + Number(cb.operational_cost   ?? 0)
    - Number(cb.meli_subsidy_brl   ?? 0)
    const totalCosts = fixedCosts + variableCosts
    const marginBrl = price - totalCosts
    const marginPct = (marginBrl / price) * 100
    return { price, marginBrl, marginPct, totalCosts, taxAmount: price * taxPct, commission: price * commissionPct }
  })()

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
        <span>/</span>
        <Link href="/dashboard/ml-campaigns/recommendations" className="hover:text-cyan-400">Recomendações</Link>
        <span>/</span>
        <span className="text-zinc-300">{item?.ml_item_id ?? id}</span>
      </div>

      {/* Header com score e classificação */}
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-shrink-0 rounded-xl w-24 h-24 flex flex-col items-center justify-center font-bold"
          style={{ background: `${scoreColor(score)}15`, border: `1px solid ${scoreColor(score)}40`, color: scoreColor(score) }}>
          <span className="text-4xl leading-none">{score}</span>
          <span className="text-[10px] mt-1 opacity-70">/100</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <ClassificationBadge type={reco.recommendation} />
            <StatusBadge status={reco.status} />
            {item?.has_meli_subsidy && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1"
                style={{ background: 'rgba(0,229,255,0.1)', color: '#67e8f9', border: '1px solid rgba(0,229,255,0.3)' }}>
                <Sparkles size={10} />
                ML reduz {item.meli_percentage?.toFixed(1)}%
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="font-mono">{item?.ml_item_id ?? '—'}</span>
            <CopyButton value={item?.ml_item_id} size={13} />
            {item?.ml_item_id && (
              <a href={`https://www.mercadolivre.com.br/${item.ml_item_id}`} target="_blank" rel="noreferrer"
                className="text-cyan-400 text-xs hover:underline inline-flex items-center gap-1">
                <ExternalLink size={11} /> ML
              </a>
            )}
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            {item?.ml_campaigns?.name ?? item?.ml_campaign_id} · {item?.ml_promotion_type}
            {reco.expires_at && ` · expira ${new Date(reco.expires_at).toLocaleDateString('pt-BR')}`}
          </p>
        </div>
      </div>

      {/* Reasoning */}
      <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <p className="text-sm text-zinc-200 leading-relaxed">{reco.recommendation_reason}</p>
      </div>

      {/* Warnings */}
      {reco.warnings && reco.warnings.length > 0 && (
        <div className="space-y-1">
          {reco.warnings.map((w, i) => (
            <div key={i} className="rounded-lg p-3 flex items-start gap-2"
              style={{
                background: w.severity === 'high' ? 'rgba(239,68,68,0.06)' : 'rgba(251,191,36,0.06)',
                border:     `1px solid ${w.severity === 'high' ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.25)'}`,
              }}>
              <AlertOctagon size={14} className="flex-shrink-0 mt-0.5"
                style={{ color: w.severity === 'high' ? '#f87171' : '#fbbf24' }} />
              <p className="text-xs" style={{ color: w.severity === 'high' ? '#fecaca' : '#fde68a' }}>{w.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* 3 cenários */}
      {reco.scenarios?.competitive && (
        <div className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Cenários de preço</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ScenarioCard
              title="Conservador" scenario={reco.scenarios.conservative}
              selected={strategy === 'conservative'}
              onClick={() => isPending && setStrategy('conservative')}
              color="#a78bfa"
              clickable={isPending}
            />
            <ScenarioCard
              title="Competitivo" scenario={reco.scenarios.competitive}
              selected={strategy === 'competitive'}
              onClick={() => isPending && setStrategy('competitive')}
              color="#00E5FF"
              clickable={isPending}
              recommended={reco.recommended_strategy === 'competitive'}
            />
            <ScenarioCard
              title="Agressivo" scenario={reco.scenarios.aggressive}
              selected={strategy === 'aggressive'}
              onClick={() => isPending && setStrategy('aggressive')}
              color="#22c55e"
              clickable={isPending}
            />
          </div>
          {reco.scenarios.break_even && (
            <p className="text-[11px] text-zinc-500 text-center mt-1">
              Break-even: <strong className="text-zinc-300">{brl(reco.scenarios.break_even.price)}</strong> — abaixo disso é prejuízo
            </p>
          )}
        </div>
      )}

      {/* Cost breakdown */}
      {Object.keys(cb).length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-3">
            Detalhamento de custos
          </h2>
          <div className="space-y-1 text-xs">
            <CostRow label="Custo do produto"        value={cb.cost_price} />
            <CostRow label="Imposto"                  value={cb.tax_amount} suffix={`(${cb.tax_percentage}%)`} />
            <CostRow label="Comissão ML"              value={cb.ml_commission} suffix={`(${cb.ml_commission_pct}%)`} />
            {cb.ml_fixed_fee > 0       && <CostRow label="Taxa fixa ML"        value={cb.ml_fixed_fee} />}
            {cb.free_shipping_cost > 0 && <CostRow label="Frete grátis"        value={cb.free_shipping_cost} />}
            {cb.packaging_cost > 0     && <CostRow label="Embalagem"           value={cb.packaging_cost} />}
            {cb.operational_cost > 0   && <CostRow label="Operacional"         value={cb.operational_cost} />}
            {cb.meli_subsidy_brl > 0   && <CostRow label="− Subsídio ML"       value={-cb.meli_subsidy_brl} highlight="cyan" />}
            <div className="border-t border-zinc-800 pt-2 mt-2">
              <CostRow label="Custo total"           value={cb.total_costs}  bold />
              <CostRow label="Receita líquida (M.C.)" value={cb.net_revenue} bold highlight={cb.net_revenue > 0 ? 'green' : 'red'} />
            </div>
          </div>
        </div>
      )}

      {/* Quantity */}
      {reco.quantity_recommendation?.recommended_max_qty != null && (
        <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-3">
            Quantidade recomendada
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Stat label="Estoque atual"      value={reco.quantity_recommendation.current_stock ?? 0} />
            <Stat label="Vendas/dia (avg)"   value={(reco.quantity_recommendation.avg_daily_sales ?? 0).toFixed(2)} />
            <Stat label="Demanda esperada"   value={reco.quantity_recommendation.expected_demand_during ?? 0} />
            <Stat label="Recomendado"        value={reco.quantity_recommendation.recommended_max_qty ?? 0} highlight="cyan" />
          </div>
          <p className="text-[11px] text-zinc-400 mt-2">{reco.quantity_recommendation.rationale}</p>
        </div>
      )}

      {/* Score breakdown */}
      {Object.keys(reco.score_breakdown ?? {}).length > 0 && (
        <details className="rounded-xl p-4" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <summary className="text-xs uppercase tracking-wider text-zinc-400 font-semibold cursor-pointer">
            Detalhamento do score (clique pra expandir)
          </summary>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-xs">
            {Object.entries(reco.score_breakdown).filter(([k]) => k !== 'total').map(([k, v]) => (
              <div key={k} className="flex justify-between rounded p-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-zinc-500 capitalize">{k.replace(/_/g, ' ')}</span>
                <strong className="text-zinc-200">{v as number}</strong>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Actions */}
      {isPending && (
        <div className="rounded-xl p-4 sticky bottom-4 z-10"
          style={{ background: 'rgba(12,12,16,0.95)', border: '1px solid #1a1a1f', backdropFilter: 'blur(8px)' }}>
          {!editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => approve(false)}
                disabled={!strategy || busy !== null}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
                style={{ background: '#22c55e', color: '#000' }}>
                {busy === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Aprovar {strategy && `(${strategy})`}
              </button>
              <button onClick={() => setEditing(true)} disabled={busy !== null}
                className="px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-1.5"
                style={{ background: '#1a1a1f', color: '#a1a1aa' }}>
                <Edit3 size={12} /> Editar
              </button>
              <button onClick={reject} disabled={busy !== null}
                className="ml-auto px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-1.5"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                {busy === 'reject' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Rejeitar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-zinc-400 flex-shrink-0 w-28">Preço (R$)</label>
                <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                  step="0.01"
                  min={item?.min_discounted_price ?? 0}
                  max={item?.max_discounted_price ?? undefined}
                  className="flex-1 rounded px-2 py-1.5 text-sm outline-none"
                  style={{ background: '#09090b', border: '1px solid #27272a', color: '#fafafa' }} />
                <span className="text-[11px] text-zinc-500">
                  min {brl(item?.min_discounted_price)} · max {brl(item?.max_discounted_price)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-zinc-400 flex-shrink-0 w-28">Quantidade</label>
                <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)}
                  min={1}
                  className="flex-1 rounded px-2 py-1.5 text-sm outline-none"
                  style={{ background: '#09090b', border: '1px solid #27272a', color: '#fafafa' }} />
              </div>

              {/* Feedback de margem em tempo real */}
              {liveMargin && (() => {
                const { price, marginBrl, marginPct, totalCosts, taxAmount, commission } = liveMargin
                // Estado visual:
                //   verde:    margem >= threshold do gate     (aprovação direta)
                //   amarelo:  0 < margem < threshold           (vai pra fila do gestor)
                //   vermelho: margem <= 0                      (prejuízo — abaixo do break-even)
                const state =
                  marginBrl <= 0           ? 'loss'    :
                  marginPct < gateThreshold ? 'review' :
                                              'ok'
                const cfg = {
                  ok:     { color: '#22c55e', bg: 'rgba(34,197,94,0.06)',  border: 'rgba(34,197,94,0.4)',  label: 'Aprovação direta',          icon: '✓' },
                  review: { color: '#fbbf24', bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.4)', label: 'Abaixo do limite — vai pra fila do gestor', icon: '⚠' },
                  loss:   { color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.4)',  label: 'Prejuízo — abaixo do break-even',           icon: '✕' },
                }[state]
                return (
                  <div className="rounded-lg p-3 space-y-2"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-lg" style={{ color: cfg.color }}>{cfg.icon}</span>
                        <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                          A esse preço: {cfg.label}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500">limite: {gateThreshold.toFixed(1)}%</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      <div className="rounded p-2" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                        <p className="text-[9px] uppercase tracking-wider text-zinc-500">Margem</p>
                        <p className="font-bold text-base" style={{ color: cfg.color }}>{marginPct.toFixed(1)}%</p>
                      </div>
                      <div className="rounded p-2" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                        <p className="text-[9px] uppercase tracking-wider text-zinc-500">Lucro (M.C.)</p>
                        <p className="font-bold text-base" style={{ color: cfg.color }}>{brl(marginBrl)}</p>
                      </div>
                      <div className="rounded p-2 col-span-2 md:col-span-1" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
                        <p className="text-[9px] uppercase tracking-wider text-zinc-500">Custo total</p>
                        <p className="text-zinc-300 font-medium">{brl(totalCosts)}</p>
                      </div>
                    </div>
                    {/* Quebra dos %s recalculados */}
                    <div className="text-[10px] text-zinc-500 flex items-center gap-3 flex-wrap pt-1 border-t border-zinc-800">
                      <span>Imposto: {brl(taxAmount)}</span>
                      <span>·</span>
                      <span>Comissão ML: {brl(commission)}</span>
                      <span>·</span>
                      <span>Preço: {brl(price)}</span>
                    </div>
                  </div>
                )
              })()}

              <div className="flex items-center gap-2">
                <button onClick={() => approve(true)} disabled={busy !== null}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  style={{ background: '#22c55e', color: '#000' }}>
                  {busy === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Aprovar editado
                </button>
                <button onClick={() => setEditing(false)} disabled={busy !== null}
                  className="px-3 py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#1a1a1f', color: '#a1a1aa' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScenarioCard({ title, scenario, selected, onClick, color, clickable, recommended }: {
  title:    string
  scenario: PriceScenario | undefined
  selected: boolean
  onClick:  () => void
  color:    string
  clickable: boolean
  recommended?: boolean
}) {
  if (!scenario) return null
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`rounded-xl p-4 transition-all ${clickable ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
      style={{
        background: '#0c0c10',
        border: `2px solid ${selected ? color : `${color}30`}`,
        boxShadow: selected ? `0 0 12px ${color}40` : undefined,
      }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color }}>{title}</p>
        {recommended && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
            style={{ background: `${color}20`, color }}>
            Recomendado
          </span>
        )}
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{brl(scenario.price)}</p>
      <p className="text-[11px] text-emerald-400">−{scenario.discount_pct}%</p>
      <div className="mt-3 pt-3 border-t" style={{ borderColor: '#1a1a1f' }}>
        <div className="flex justify-between text-[11px]">
          <span className="text-zinc-500">M.C.</span>
          <strong style={{ color: scenario.margin_pct > 0 ? '#22c55e' : '#ef4444' }}>
            {scenario.margin_pct.toFixed(1)}% ({brl(scenario.margin_brl)})
          </strong>
        </div>
        <div className="flex justify-between text-[11px] mt-1">
          <span className="text-zinc-500">Volume</span>
          <span className="text-zinc-300 capitalize">{scenario.expected_volume}</span>
        </div>
      </div>
      <p className="text-[10px] text-zinc-500 mt-2 line-clamp-2">{scenario.rationale}</p>
    </div>
  )
}

function CostRow({ label, value, suffix, bold, highlight }: {
  label: string; value: number; suffix?: string; bold?: boolean; highlight?: 'cyan' | 'green' | 'red';
}) {
  const color =
    highlight === 'cyan'  ? '#67e8f9'
    : highlight === 'green' ? '#34d399'
    : highlight === 'red'   ? '#f87171'
    : '#fafafa'
  return (
    <div className="flex justify-between">
      <span className={bold ? 'text-zinc-200 font-semibold' : 'text-zinc-400'}>{label}</span>
      <span className={bold ? 'font-bold' : ''} style={{ color }}>
        {brl(value)}{suffix && <span className="text-zinc-500 text-[10px] ml-1">{suffix}</span>}
      </span>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: 'cyan' }) {
  return (
    <div className="rounded p-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-base font-bold mt-0.5" style={{ color: highlight === 'cyan' ? '#67e8f9' : '#fafafa' }}>
        {value}
      </p>
    </div>
  )
}

function ClassificationBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string; icon: string }> = {
    recommended:         { label: 'Recomendado',     color: '#22c55e', icon: '✅' },
    recommended_caution: { label: 'Com cautela',     color: '#fbbf24', icon: '⚠️' },
    clearance_only:      { label: 'Liquidação',      color: '#a78bfa', icon: '♻️' },
    review_costs:        { label: 'Revisar custos',  color: '#f97316', icon: '📋' },
    low_quality_listing: { label: 'Qualidade baixa', color: '#ef4444', icon: '🔧' },
    skip:                { label: 'Não recomendado', color: '#71717a', icon: '❌' },
  }
  const m = map[type] ?? { label: type, color: '#71717a', icon: '·' }
  return (
    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold inline-flex items-center gap-1"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}>
      {m.icon} {m.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending:  { label: 'Pendente',   color: '#fbbf24' },
    approved: { label: 'Aprovada',   color: '#22c55e' },
    edited:   { label: 'Editada',    color: '#22c55e' },
    rejected: { label: 'Rejeitada',  color: '#ef4444' },
    applied:  { label: 'Aplicada',   color: '#a78bfa' },
    expired:  { label: 'Expirada',   color: '#71717a' },
  }
  const m = map[status] ?? { label: status, color: '#71717a' }
  return (
    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}>
      {m.label}
    </span>
  )
}

function scoreColor(s: number): string {
  if (s >= 75) return '#22c55e'
  if (s >= 50) return '#fbbf24'
  if (s > 0)   return '#ef4444'
  return '#52525b'
}
