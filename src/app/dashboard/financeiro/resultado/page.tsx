'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  ArrowLeft, RefreshCw, Plus, Trash2, TrendingDown, TrendingUp, Target,
  Wallet, Megaphone, Building2, Coins, AlertTriangle, Truck,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

const CATEGORIES = [
  'aluguel', 'folha', 'pro_labore', 'energia', 'agua', 'internet_telefone',
  'software', 'contabilidade', 'impostos_fixos', 'manutencao', 'marketing_fixo', 'outros',
] as const

interface Consolidated {
  month: string; revenue: number; variable_cost: number; contribution_margin: number
  contribution_margin_pct: number | null; ad_spend: number; tacos_pct: number | null
  fixed_cost: number; net_profit: number; net_margin_pct: number | null
  target_net_margin_pct: number; gap_pct: number | null
  ad_budget_envelope: number; ad_envelope_remaining: number; units: number; orders: number
  // Fase 2.4 — custo real do ledger (platform_charges)
  cmv?: number; cmv_imputed?: number; cmv_coverage_pct?: number | null; platform_fees?: number
  cost_by_category?: Record<string, number>
}

// rótulos amigáveis das categorias de taxa (platform_charges)
const CAT_LABELS: Record<string, string> = {
  comissao: 'Comissão', frete: 'Frete / Envios', servico: 'Taxa de serviço (Shopee)',
  parcelamento: 'Parcelamento', cobranca: 'Cobrança / recebimento', ads: 'Publicidade (ADS)',
  imposto: 'Impostos (DIFAL)', outros: 'Outros',
}
interface ProductRow {
  product_id: string; name: string; sku: string | null; units: number; revenue: number
  contribution_margin: number; contribution_margin_pct: number | null; ad_spend: number
  acos_pct: number | null; fixed_cost_allocated: number; net_profit: number; net_margin_pct: number | null
}
interface OperatingCost {
  id: string; label: string; category: string; amount: number; recurrence: string
  allocation_driver: string; valid_from: string; valid_to: string | null; active: boolean
}
interface ShippingRate {
  id: string; platform: string; logistic_type: string; amount: number
  valid_from: string; valid_to: string | null; active: boolean; notes: string | null
}

const LOGISTIC_TYPES: Record<string, string> = {
  self_service: 'Flex',
  cross_docking: 'Coleta/Agência',
  drop_off: 'Pontos',
  custom: 'Outro',
}

const brl = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (n: number | null | undefined) => (n == null ? '—' : `${n.toFixed(1)}%`)

function thisMonth() { return new Date().toISOString().slice(0, 7) }

export default function CentralResultadoPage() {
  const supabase = useMemo(() => createClient(), [])
  const [month, setMonth] = useState(thisMonth())
  const [con, setCon] = useState<Consolidated | null>(null)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [costs, setCosts] = useState<OperatingCost[]>([])
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [target, setTarget] = useState<number>(15)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // form de custo fixo
  const [nf, setNf] = useState({ label: '', category: 'aluguel', amount: '', recurrence: 'monthly' })
  // form de tarifa de frete (Flex)
  const [sr, setSr] = useState({ logistic_type: 'self_service', amount: '', valid_from: thisMonth() + '-01' })

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Sessão expirada — faça login de novo.')
    return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const h = await getHeaders()
      const [c, p, oc, cfg, srates] = await Promise.all([
        fetch(`${BACKEND}/financeiro/result/consolidated?month=${month}`, { headers: h }).then((r) => r.json()),
        fetch(`${BACKEND}/financeiro/result/by-product?month=${month}&limit=50`, { headers: h }).then((r) => r.json()),
        fetch(`${BACKEND}/financeiro/operating-costs?active=true`, { headers: h }).then((r) => r.json()),
        fetch(`${BACKEND}/financeiro/result-config`, { headers: h }).then((r) => r.json()),
        fetch(`${BACKEND}/financeiro/shipping-rates`, { headers: h }).then((r) => r.json()),
      ])
      setCon(c); setProducts(p?.products ?? []); setCosts(Array.isArray(oc) ? oc : [])
      setTarget(Number(cfg?.target_net_margin_pct ?? 15))
      setRates(Array.isArray(srates) ? srates : [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao carregar.')
    } finally { setLoading(false) }
  }, [getHeaders, month])

  useEffect(() => { void load() }, [load])

  const addCost = async () => {
    if (!nf.label.trim() || !nf.amount) return
    setBusy(true)
    try {
      const h = await getHeaders()
      await fetch(`${BACKEND}/financeiro/operating-costs`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ label: nf.label.trim(), category: nf.category, amount: Number(nf.amount), recurrence: nf.recurrence }),
      })
      setNf({ label: '', category: 'aluguel', amount: '', recurrence: 'monthly' })
      await load()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao adicionar.') } finally { setBusy(false) }
  }
  const delCost = async (id: string) => {
    setBusy(true)
    try { const h = await getHeaders(); await fetch(`${BACKEND}/financeiro/operating-costs/${id}`, { method: 'DELETE', headers: h }); await load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao remover.') } finally { setBusy(false) }
  }
  const saveTarget = async (v: number) => {
    setBusy(true)
    try { const h = await getHeaders(); await fetch(`${BACKEND}/financeiro/result-config`, { method: 'PATCH', headers: h, body: JSON.stringify({ target_net_margin_pct: v }) }); setTarget(v); await load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao salvar meta.') } finally { setBusy(false) }
  }
  const addRate = async () => {
    if (!sr.amount) return
    setBusy(true)
    try {
      const h = await getHeaders()
      await fetch(`${BACKEND}/financeiro/shipping-rates`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ platform: 'mercadolivre', logistic_type: sr.logistic_type, amount: Number(sr.amount), valid_from: sr.valid_from }),
      })
      setSr({ logistic_type: 'self_service', amount: '', valid_from: thisMonth() + '-01' })
      await load()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao cadastrar tarifa.') } finally { setBusy(false) }
  }
  const delRate = async (id: string) => {
    setBusy(true)
    try { const h = await getHeaders(); await fetch(`${BACKEND}/financeiro/shipping-rates/${id}`, { method: 'DELETE', headers: h }); await load() }
    catch (e) { setErr(e instanceof Error ? e.message : 'Falha ao remover tarifa.') } finally { setBusy(false) }
  }

  const netOk = con?.net_margin_pct != null && con.net_margin_pct >= (con?.target_net_margin_pct ?? 15)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/financeiro" className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:text-zinc-100">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Central de Resultado</h1>
              <p className="text-xs text-zinc-500">DRE viva · lucro real depois de custo, anúncio e despesa fixa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 [color-scheme:dark]" />
            <button onClick={() => void load()} disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
          </div>
        </div>

        {err && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
          </div>
        )}

        {loading && !con ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => (<div key={i} className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900" />))}</div>
        ) : con ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Kpi icon={Wallet} label="Receita" value={brl(con.revenue)} sub={`${con.orders} pedidos`} />
              <Kpi icon={Coins} label="Margem contrib." value={pct(con.contribution_margin_pct)} sub={brl(con.contribution_margin)} tone="cyan" />
              <Kpi icon={Megaphone} label="TACOS (peso do ADS)" value={pct(con.tacos_pct)} sub={brl(con.ad_spend)} />
              <Kpi icon={Building2} label="Custo fixo" value={brl(con.fixed_cost)} sub={con.fixed_cost === 0 ? 'cadastre abaixo' : undefined} />
              <Kpi icon={netOk ? TrendingUp : TrendingDown} label="Lucro líquido" value={pct(con.net_margin_pct)} sub={brl(con.net_profit)} tone={netOk ? 'emerald' : 'red'} highlight />
              <Kpi icon={Target} label={`Meta ${con.target_net_margin_pct}%`} value={con.gap_pct != null ? `${con.gap_pct > 0 ? '+' : ''}${con.gap_pct.toFixed(1)} p.p.` : '—'} sub={netOk ? 'meta batida' : 'abaixo da meta'} tone={netOk ? 'emerald' : 'amber'} />
            </div>

            {/* DRE cascata + custos lado a lado */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Cascata */}
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <h2 className="mb-3 text-sm font-semibold text-zinc-200">DRE do mês</h2>
                <Cascade con={con} />
                <p className="mt-3 rounded-lg bg-zinc-800/40 p-2 text-[11px] text-zinc-400">
                  Envelope de ADS p/ bater {con.target_net_margin_pct}%: <span className="tabular-nums text-zinc-200">{brl(con.ad_budget_envelope)}</span>
                  {' · '}{con.ad_envelope_remaining >= 0
                    ? <span className="text-emerald-400">ainda cabe {brl(con.ad_envelope_remaining)}</span>
                    : <span className="text-red-400">estourou em {brl(-con.ad_envelope_remaining)}</span>}
                </p>
              </section>

              {/* Custos fixos */}
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-200">Custos fixos / operacionais</h2>
                  <label className="flex items-center gap-1 text-[11px] text-zinc-400">
                    Meta líquido
                    <input type="number" defaultValue={target} min={0} max={95} step={0.5}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== target) void saveTarget(v) }}
                      className="w-14 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-right tabular-nums text-zinc-200" />%
                  </label>
                </div>
                {/* add form */}
                <div className="mb-3 grid grid-cols-12 gap-1.5">
                  <input placeholder="Aluguel CD, Folha…" value={nf.label} onChange={(e) => setNf({ ...nf, label: e.target.value })}
                    className="col-span-5 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200" />
                  <select value={nf.category} onChange={(e) => setNf({ ...nf, category: e.target.value })}
                    className="col-span-3 rounded border border-zinc-800 bg-zinc-900 px-1 py-1 text-xs text-zinc-300 [color-scheme:dark]">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="number" placeholder="R$" value={nf.amount} onChange={(e) => setNf({ ...nf, amount: e.target.value })}
                    className="col-span-2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-right text-xs tabular-nums text-zinc-200" />
                  <button onClick={() => void addCost()} disabled={busy || !nf.label || !nf.amount}
                    className="col-span-2 inline-flex items-center justify-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 px-1 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40">
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                {costs.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
                    Nenhum custo fixo cadastrado — o lucro líquido acima ainda não desconta aluguel/folha/etc.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {costs.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-2.5 py-1.5 text-xs">
                        <span className="truncate"><span className="text-zinc-200">{c.label}</span> <span className="text-zinc-500">· {c.category} · {c.recurrence === 'monthly' ? 'mensal' : c.recurrence === 'annual' ? 'anual' : 'única'}</span></span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums text-zinc-200">{brl(c.amount)}</span>
                          <button onClick={() => void delCost(c.id)} disabled={busy} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Quebra real das taxas (platform_charges: fatura ML + escrow Shopee) */}
            {con.cost_by_category && Object.keys(con.cost_by_category).length > 0 && (
              <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-200">
                    Para onde vai o dinheiro <span className="text-zinc-500">(taxas reais da fatura/escrow)</span>
                  </h2>
                  {con.cmv_coverage_pct != null && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{
                        background: con.cmv_coverage_pct >= 90 ? 'rgba(74,222,128,0.12)' : 'rgba(252,211,77,0.12)',
                        color: con.cmv_coverage_pct >= 90 ? '#4ade80' : '#fcd34d',
                      }}
                      title="% da receita com custo cadastrado. O restante tem custo ESTIMADO pela média — cadastre mais custos pra precisão total."
                    >
                      custo cadastrado: {pct(con.cmv_coverage_pct)} {con.cmv_coverage_pct < 90 && '· resto estimado'}
                    </span>
                  )}
                </div>
                {(() => {
                  const cats = Object.entries(con.cost_by_category!).filter(([, v]) => Math.abs(v) > 0.005)
                  const max = Math.max(...cats.map(([, v]) => Math.abs(v)), 1)
                  cats.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                  return (
                    <div className="flex flex-col gap-1.5">
                      {cats.map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="w-44 shrink-0 truncate text-xs text-zinc-400">
                            {CAT_LABELS[k] ?? k}
                            {k === 'ads' && <span className="ml-1 text-[10px] text-amber-400/70">marketing</span>}
                          </span>
                          <div className="h-4 flex-1 overflow-hidden rounded bg-zinc-800/40">
                            <div className={`h-full ${k === 'ads' ? 'bg-amber-500/60' : 'bg-cyan-500/50'}`}
                              style={{ width: `${Math.min(100, (Math.abs(v) / max) * 100)}%` }} />
                          </div>
                          <span className="w-24 shrink-0 text-right text-xs tabular-nums text-zinc-200">{brl(v)}</span>
                          <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">
                            {con.revenue > 0 ? `${(v / con.revenue * 100).toFixed(1)}%` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <p className="mt-3 rounded-lg bg-zinc-800/40 p-2 text-[11px] text-zinc-400">
                  Custo do produto (CMV): <span className="tabular-nums text-zinc-200">{brl(con.cmv)}</span>
                  {con.cmv_imputed != null && con.cmv_imputed > 0 && (
                    <> · <span className="text-zinc-500">sendo {brl(con.cmv_imputed)} estimado (pedidos sem custo cadastrado)</span></>
                  )}
                  {' · '}Taxas de plataforma: <span className="tabular-nums text-zinc-200">{brl(con.platform_fees)}</span>
                </p>
              </section>
            )}

            {/* Frete pago por fora (Flex) */}
            <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Truck className="h-4 w-4 text-cyan-300" />
                <h2 className="text-sm font-semibold text-zinc-200">Frete pago por fora (Flex)</h2>
              </div>
              <p className="mb-3 text-[11px] text-zinc-500">
                Custo fixo por venda que você paga à transportadora/motoboy e que <span className="text-zinc-400">não aparece em nenhuma API do ML/MP</span>.
                Quando houver reajuste de tabela, cadastre o novo valor com a data — os pedidos antigos continuam usando a tarifa vigente na época.
              </p>
              {/* add / reajuste form */}
              <div className="mb-3 grid grid-cols-12 gap-1.5">
                <select value={sr.logistic_type} onChange={(e) => setSr({ ...sr, logistic_type: e.target.value })}
                  className="col-span-3 rounded border border-zinc-800 bg-zinc-900 px-1 py-1 text-xs text-zinc-300 [color-scheme:dark]">
                  {Object.entries(LOGISTIC_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input type="number" placeholder="R$ por venda" value={sr.amount} onChange={(e) => setSr({ ...sr, amount: e.target.value })}
                  className="col-span-3 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-right text-xs tabular-nums text-zinc-200" />
                <input type="date" value={sr.valid_from} onChange={(e) => setSr({ ...sr, valid_from: e.target.value })}
                  className="col-span-4 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 [color-scheme:dark]" />
                <button onClick={() => void addRate()} disabled={busy || !sr.amount}
                  className="col-span-2 inline-flex items-center justify-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 px-1 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40">
                  <Plus className="h-3 w-3" /> Salvar
                </button>
              </div>
              {rates.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
                  Nenhuma tarifa de frete cadastrada — cadastre o valor que você paga por venda Flex.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {rates.map((r) => {
                    const vigente = r.active && !r.valid_to
                    return (
                      <div key={r.id} className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-2.5 py-1.5 text-xs">
                        <span className="flex items-center gap-2 truncate">
                          <span className="text-zinc-200">{LOGISTIC_TYPES[r.logistic_type] ?? r.logistic_type}</span>
                          {vigente
                            ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">vigente</span>
                            : <span className="rounded bg-zinc-700/40 px-1.5 py-0.5 text-[10px] text-zinc-500">encerrada</span>}
                          <span className="text-zinc-500">desde {r.valid_from}{r.valid_to ? ` até ${r.valid_to}` : ''}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums text-zinc-200">{brl(r.amount)}</span>
                          <button onClick={() => void delRate(r.id)} disabled={busy} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Lucro por SKU */}
            <section className="mt-6">
              <h2 className="mb-3 text-sm font-semibold text-zinc-200">Lucro líquido por anúncio <span className="text-zinc-500">(pior primeiro — onde está sangrando)</span></h2>
              {products.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">Sem vendas no período.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-xs">
                    <thead className="border-b border-zinc-800 bg-zinc-900 text-[11px] uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Anúncio</th>
                        <th className="px-3 py-2 text-right font-medium">Receita</th>
                        <th className="px-3 py-2 text-right font-medium">MC</th>
                        <th className="px-3 py-2 text-right font-medium">ADS</th>
                        <th className="px-3 py-2 text-right font-medium">ACOS</th>
                        <th className="px-3 py-2 text-right font-medium">Fixo rat.</th>
                        <th className="px-3 py-2 text-right font-medium">Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.product_id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/50">
                          <td className="max-w-[260px] truncate px-3 py-2"><span className="text-zinc-200">{p.name}</span>{p.sku && <span className="text-zinc-600"> · {p.sku}</span>}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{brl(p.revenue)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{pct(p.contribution_margin_pct)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{brl(p.ad_spend)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{pct(p.acos_pct)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{brl(p.fixed_cost_allocated)}</td>
                          <td className={`px-3 py-2 text-right font-medium tabular-nums ${p.net_profit < 0 ? 'text-red-400' : p.net_margin_pct != null && p.net_margin_pct >= con.target_net_margin_pct ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {brl(p.net_profit)} <span className="text-[10px] text-zinc-600">{pct(p.net_margin_pct)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub, tone = 'zinc', highlight }: {
  icon: typeof Wallet; label: string; value: string; sub?: string; tone?: 'zinc' | 'cyan' | 'emerald' | 'red' | 'amber'; highlight?: boolean
}) {
  const tcolor = { zinc: 'text-zinc-100', cyan: 'text-cyan-300', emerald: 'text-emerald-400', red: 'text-red-400', amber: 'text-amber-400' }[tone]
  return (
    <div className={`rounded-xl border bg-zinc-900/50 p-3 ${highlight && tone === 'emerald' ? 'border-emerald-500/30' : highlight && tone === 'red' ? 'border-red-500/30' : 'border-zinc-800'}`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`text-xl font-semibold leading-none tabular-nums ${tcolor}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] tabular-nums text-zinc-500">{sub}</div>}
    </div>
  )
}

function Cascade({ con }: { con: Consolidated }) {
  const max = Math.max(con.revenue, 1)
  const row = (label: string, value: number, color: string, sign?: string) => (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-xs text-zinc-400">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-zinc-800/40">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.abs(value) / max * 100)}%` }} />
      </div>
      <span className="w-28 shrink-0 text-right text-xs tabular-nums text-zinc-200">{sign}{brl(Math.abs(value))}</span>
    </div>
  )
  return (
    <div className="flex flex-col gap-1.5">
      {row('Receita', con.revenue, 'bg-zinc-500')}
      {row('− Custo variável', con.variable_cost, 'bg-zinc-700', '−')}
      {row('= Margem contrib.', con.contribution_margin, 'bg-cyan-500/70')}
      {row('− ADS', con.ad_spend, 'bg-amber-500/60', '−')}
      {row('− Custo fixo', con.fixed_cost, 'bg-orange-700/60', '−')}
      {row('= Líquido', con.net_profit, con.net_profit >= 0 ? 'bg-emerald-500/70' : 'bg-red-500/70')}
    </div>
  )
}
