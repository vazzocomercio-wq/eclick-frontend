'use client'

/**
 * Painel de markup do anúncio — calcula o PREÇO DE VENDA a partir de:
 *   • margem de contribuição alvo (%)
 *   • custo do produto / CMV (R$)
 *   • custo de venda do marketplace / tarifa (%)
 *   • imposto (%)
 *   • reserva para campanhas de promoção (%)
 *   • custo do frete grátis pago pelo vendedor (R$, opcional)
 *
 * O preço cheio é dimensionado para que, MESMO durante uma promoção do
 * tamanho da reserva, a margem de contribuição alvo se mantenha.
 *
 * Matemática (rates em decimal):
 *   precoPromo = (CMV + frete) ÷ (1 − tarifa − imposto − margemAlvo)
 *   precoVenda = precoPromo ÷ (1 − reservaPromo)
 *
 * O frete é o custo real que o ML cobra do vendedor pelo frete grátis —
 * buscado via API por dimensões + peso + preço (o ML aplica internamente as
 * regras de faixa de preço, incluindo o salto no valor mínimo de frete
 * grátis). Como o frete depende do preço e o preço depende do frete, a busca
 * itera até convergir.
 *
 * O resultado é reverificado pelo motor canônico `computeContributionMargin`
 * (@/lib/margin) — a margem exibida é sempre a do motor, não a de entrada.
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, AlertCircle, Check, Truck, Loader2 } from 'lucide-react'
import { computeContributionMargin, estimateSaleFee, round2 } from '@/lib/margin'
import { CreativeApi } from './api'
import type { MlShippingCost } from './types'

interface MarkupPanelProps {
  /** Tarifa % default do tipo de anúncio selecionado (escala 0–100). */
  defaultFeePercent: number
  /** Preço atual no formulário do anúncio. */
  currentPrice?: string
  /** Aplica o preço calculado no campo de preço do anúncio. */
  onApplyPrice: (price: number) => void
  /** Anúncio — usado para buscar o custo de frete no ML. */
  listingId: string
  /** Tipo de anúncio (free / gold_special / gold_pro) — o ML usa para aplicar o desconto de frete. */
  listingType: string
  /** Dimensões da embalagem do produto, para pré-preencher os campos de frete. */
  initialDimensions?: Record<string, unknown>
}

const num = (s: string): number => {
  const n = Number(String(s).replace(',', '.').trim())
  return Number.isFinite(n) && n >= 0 ? n : 0
}
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dimStr = (d: Record<string, unknown> | undefined, key: string): string => {
  const v = d?.[key]
  return v == null || v === '' ? '' : String(v)
}

export default function MarkupPanel({
  defaultFeePercent, currentPrice, onApplyPrice, listingId, listingType, initialDimensions,
}: MarkupPanelProps) {
  const [targetMargin, setTargetMargin] = useState('')
  const [cost, setCost]                 = useState('')
  const [feePct, setFeePct]             = useState(String(defaultFeePercent))
  const [feeTouched, setFeeTouched]     = useState(false)
  const [taxPct, setTaxPct]             = useState('')
  const [promoPct, setPromoPct]         = useState('')

  // Frete
  const [sellerPaysShipping, setSellerPaysShipping] = useState(true)
  const [largura, setLargura] = useState(() => dimStr(initialDimensions, 'largura'))
  const [altura, setAltura]   = useState(() => dimStr(initialDimensions, 'altura'))
  const [profund, setProfund] = useState(() => dimStr(initialDimensions, 'profundidade'))
  const [peso, setPeso]       = useState(() => dimStr(initialDimensions, 'peso'))
  const [shippingCost, setShippingCost]       = useState(0)
  const [shippingMeta, setShippingMeta]       = useState<MlShippingCost | null>(null)
  const [shippingFetchedFor, setShippingFetchedFor] = useState(0)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingError, setShippingError]     = useState<string | null>(null)

  // Resync da tarifa quando o tipo de anúncio muda — só se o usuário não editou.
  useEffect(() => {
    if (!feeTouched) setFeePct(String(defaultFeePercent))
  }, [defaultFeePercent, feeTouched])

  // O custo de frete depende do tipo de anúncio — limpa ao trocar a modalidade.
  useEffect(() => {
    setShippingCost(0); setShippingMeta(null); setShippingError(null)
  }, [listingType])

  const calc = useMemo(() => {
    const m     = num(targetMargin)
    const cmv   = num(cost)
    const f     = num(feePct)
    const t     = num(taxPct)
    const promo = num(promoPct)
    const ship  = sellerPaysShipping ? round2(shippingCost) : 0

    if (m <= 0 || cmv <= 0) return { state: 'incomplete' as const }
    if (promo >= 100)       return { state: 'error' as const, msg: 'A reserva para promoção precisa ser menor que 100%.' }

    const denom = 1 - f / 100 - t / 100 - m / 100
    if (denom <= 0) {
      return {
        state: 'error' as const,
        msg: `Margem alvo + tarifa + imposto somam ${round2(m + f + t)}% do preço. O total precisa ser menor que 100% para existir um preço possível.`,
      }
    }

    const pricePromo = round2((cmv + ship) / denom)
    const priceFull  = round2(pricePromo / (1 - promo / 100))

    const verify = (price: number) => computeContributionMargin({
      price,
      saleFee:       estimateSaleFee(price, f, 0),
      shipping:      ship,
      cost:          cmv,
      taxPercentage: t,
      taxOnFreight:  false,
    })

    return {
      state: 'ok' as const,
      cmv, promo, shipping: ship,
      pricePromo, priceFull,
      feePromo: estimateSaleFee(pricePromo, f, 0),
      atPromo:  verify(pricePromo),
      atFull:   verify(priceFull),
      markup:   round2(priceFull / cmv),
    }
  }, [targetMargin, cost, feePct, taxPct, promoPct, sellerPaysShipping, shippingCost])

  const applied = calc.state === 'ok' && num(currentPrice ?? '') === calc.priceFull
  const shippingStale =
    calc.state === 'ok' && sellerPaysShipping && shippingMeta != null &&
    Math.abs(calc.pricePromo - shippingFetchedFor) > 0.5

  /**
   * Busca o custo de frete no ML. O custo depende da faixa de preço, então
   * itera: estima o preço → consulta o frete → recalcula o preço → repete.
   */
  async function fetchShipping() {
    const L = num(profund), W = num(largura), H = num(altura), wt = num(peso)
    if (!L || !W || !H || !wt) {
      setShippingError('Preencha largura, altura, profundidade e peso da embalagem.')
      return
    }
    const m = num(targetMargin), cmv = num(cost), f = num(feePct), t = num(taxPct)
    const denom = 1 - f / 100 - t / 100 - m / 100
    if (m <= 0 || cmv <= 0 || denom <= 0) {
      setShippingError('Preencha margem alvo e custo (CMV) antes de buscar o frete.')
      return
    }

    setShippingLoading(true); setShippingError(null)
    try {
      let ship = 0
      let meta: MlShippingCost | null = null
      let pricePromo = 0
      for (let i = 0; i < 6; i++) {
        pricePromo = round2((cmv + ship) / denom)
        const res = await CreativeApi.getListingShippingCost(listingId, {
          length_cm: L, width_cm: W, height_cm: H, weight_grams: wt,
          item_price: pricePromo, listing_type_id: listingType,
        })
        if (!res) {
          setShippingError('O Mercado Livre não retornou o custo de frete. Confira as medidas da embalagem.')
          return
        }
        meta = res
        if (Math.abs(res.sellerCost - ship) < 0.01) { ship = res.sellerCost; break }
        ship = res.sellerCost
      }
      setShippingCost(round2(ship))
      setShippingMeta(meta)
      setShippingFetchedFor(round2((cmv + round2(ship)) / denom))
    } catch (e) {
      setShippingError((e as Error).message)
    } finally {
      setShippingLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Margem de contribuição alvo (%)" value={targetMargin} onChange={setTargetMargin} placeholder="20" />
        <Field label="Custo do produto — CMV (R$)" value={cost} onChange={setCost} placeholder="50,00" />
        <Field
          label="Custo de venda — marketplace (%)"
          value={feePct}
          onChange={v => { setFeeTouched(true); setFeePct(v) }}
          placeholder="16"
        />
        <Field label="Imposto (%)" value={taxPct} onChange={setTaxPct} placeholder="8" />
        <Field label="Reserva para promoção (%)" value={promoPct} onChange={setPromoPct} placeholder="10" wide />
      </div>

      {/* Frete */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 space-y-2.5">
        <button
          type="button"
          onClick={() => setSellerPaysShipping(v => !v)}
          className="flex items-center gap-2 w-full text-left"
        >
          <span className={[
            'flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0',
            sellerPaysShipping ? 'bg-cyan-400 border-cyan-400' : 'border-zinc-600',
          ].join(' ')}>
            {sellerPaysShipping && <Check size={11} className="text-black" />}
          </span>
          <Truck size={13} className="text-cyan-400 shrink-0" />
          <span className="text-[11px] font-medium text-zinc-200">Frete grátis por conta do vendedor</span>
        </button>

        {sellerPaysShipping ? (
          <>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Acima do valor mínimo de frete grátis o custo é seu — ele entra na formação do preço.
              O Mercado Livre calcula pelo tamanho e peso da embalagem.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Largura (cm)"       value={largura} onChange={setLargura} placeholder="40" />
              <Field label="Altura (cm)"        value={altura}  onChange={setAltura}  placeholder="10" />
              <Field label="Profundidade (cm)"  value={profund} onChange={setProfund} placeholder="40" />
              <Field label="Peso (g)"           value={peso}    onChange={setPeso}    placeholder="420" />
            </div>

            <button
              type="button"
              onClick={fetchShipping}
              disabled={shippingLoading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-60"
            >
              {shippingLoading
                ? <><Loader2 size={12} className="animate-spin" /> Consultando o Mercado Livre…</>
                : <><Truck size={12} /> {shippingMeta ? 'Recalcular frete' : 'Buscar custo de frete no ML'}</>}
            </button>

            {shippingError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[10px] text-red-200 flex items-start gap-1.5">
                <AlertCircle size={11} className="shrink-0 mt-0.5" />
                <span>{shippingError}</span>
              </div>
            )}

            {shippingMeta && !shippingError && (
              <div className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">Frete por venda</span>
                  <span className="font-semibold text-zinc-100">{brl(shippingCost)}</span>
                </div>
                <p className="text-[10px] text-zinc-600">
                  Peso considerado {(shippingMeta.billableWeight / 1000).toFixed(2)} kg
                  {shippingMeta.discountRate > 0 && (
                    <> · de {brl(shippingMeta.grossCost)} com {Math.round(shippingMeta.discountRate * 100)}% de desconto Mercado Líder</>
                  )}
                </p>
              </div>
            )}

            {shippingStale && (
              <p className="text-[10px] text-amber-400 flex items-start gap-1">
                <AlertCircle size={11} className="shrink-0 mt-0.5" />
                O preço mudou desde o cálculo — clique em Recalcular frete para confirmar a faixa.
              </p>
            )}
          </>
        ) : (
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            O comprador paga o frete — nenhum custo de frete entra na formação do preço.
          </p>
        )}
      </div>

      {calc.state === 'incomplete' && (
        <p className="text-[11px] text-zinc-500 px-1">
          Informe ao menos a <strong className="text-zinc-400">margem alvo</strong> e o{' '}
          <strong className="text-zinc-400">custo (CMV)</strong> para calcular o preço de venda.
        </p>
      )}

      {calc.state === 'error' && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] text-red-200 flex items-start gap-1.5">
          <AlertCircle size={12} className="shrink-0 mt-0.5" />
          <span>{calc.msg}</span>
        </div>
      )}

      {calc.state === 'ok' && (
        <div className="space-y-2.5">
          {/* Preço de venda — destaque */}
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-wider text-cyan-300/80">Preço de venda</span>
              <span className="text-[10px] text-zinc-500">markup {calc.markup}× sobre o CMV</span>
            </div>
            <p className="text-2xl font-bold text-cyan-300 mt-0.5">{brl(calc.priceFull)}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Sem promoção, a margem de contribuição fica em{' '}
              <strong className="text-emerald-300">{calc.atFull.contributionMarginPct}%</strong>.
            </p>
          </div>

          {/* Linha promoção */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Preço em promoção (−{calc.promo}%)</span>
              <span className="font-semibold text-zinc-200">{brl(calc.pricePromo)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Margem garantida na promoção</span>
              <span className="font-semibold text-emerald-300">
                {brl(calc.atPromo.contributionMargin)} · {calc.atPromo.contributionMarginPct}%
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <details className="rounded-lg border border-zinc-800 bg-zinc-950">
            <summary className="cursor-pointer px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200">
              Como o preço foi calculado
            </summary>
            <div className="px-2.5 pb-2.5 pt-1 text-[11px] space-y-1">
              <Row label="Preço durante a promoção" value={brl(calc.pricePromo)} />
              <Row label="− Custo de venda (marketplace)" value={`− ${brl(calc.feePromo)}`} muted />
              <Row label="− Imposto" value={`− ${brl(calc.atPromo.taxAmount)}`} muted />
              {calc.shipping > 0 && (
                <Row label="− Frete grátis (por conta do vendedor)" value={`− ${brl(calc.shipping)}`} muted />
              )}
              <Row label="− Custo do produto (CMV)" value={`− ${brl(calc.cmv)}`} muted />
              <div className="border-t border-zinc-800 my-1" />
              <Row
                label="= Margem de contribuição"
                value={`${brl(calc.atPromo.contributionMargin)} · ${calc.atPromo.contributionMarginPct}%`}
                strong
              />
              <p className="text-[10px] text-zinc-600 pt-1 leading-relaxed">
                O preço de venda {brl(calc.priceFull)} é o preço de promoção dividido por (100% − reserva),
                garantindo que mesmo na promoção a margem alvo se mantenha.
              </p>
            </div>
          </details>

          {/* Aplicar */}
          <button
            type="button"
            onClick={() => onApplyPrice(calc.priceFull)}
            disabled={applied}
            className={[
              'w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
              applied
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 cursor-default'
                : 'bg-cyan-400 hover:bg-cyan-300 text-black active:scale-[0.98]',
            ].join(' ')}
          >
            {applied
              ? <><Check size={13} /> Preço aplicado no anúncio</>
              : <><ArrowDownToLine size={13} /> Aplicar {brl(calc.priceFull)} como preço</>}
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, wide }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean
}) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1 leading-tight">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
      />
    </div>
  )
}

function Row({ label, value, muted, strong }: {
  label: string; value: string; muted?: boolean; strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-zinc-500' : strong ? 'text-zinc-200 font-semibold' : 'text-zinc-400'}>{label}</span>
      <span className={['font-mono', strong ? 'text-emerald-300 font-semibold' : muted ? 'text-zinc-400' : 'text-zinc-200'].join(' ')}>
        {value}
      </span>
    </div>
  )
}
