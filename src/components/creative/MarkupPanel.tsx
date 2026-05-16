'use client'

/**
 * Painel de markup do anúncio — calcula o PREÇO DE VENDA a partir de:
 *   • margem de contribuição alvo (%)
 *   • custo do produto / CMV (R$)
 *   • custo de venda do marketplace / tarifa (%)
 *   • imposto (%)
 *   • reserva para campanhas de promoção (%)
 *
 * O preço cheio é dimensionado para que, MESMO durante uma promoção do
 * tamanho da reserva, a margem de contribuição alvo se mantenha.
 *
 * Matemática (rates em decimal):
 *   precoPromo = CMV ÷ (1 − tarifa − imposto − margemAlvo)
 *   precoVenda = precoPromo ÷ (1 − reservaPromo)
 *
 * O resultado é reverificado pelo motor canônico `computeContributionMargin`
 * (@/lib/margin) — a margem exibida é sempre a do motor, não a de entrada.
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, AlertCircle, Check } from 'lucide-react'
import { computeContributionMargin, estimateSaleFee, round2 } from '@/lib/margin'

interface MarkupPanelProps {
  /** Tarifa % default do tipo de anúncio selecionado (escala 0–100). */
  defaultFeePercent: number
  /** Preço atual no formulário do anúncio. */
  currentPrice?: string
  /** Aplica o preço calculado no campo de preço do anúncio. */
  onApplyPrice: (price: number) => void
}

const num = (s: string): number => {
  const n = Number(String(s).replace(',', '.').trim())
  return Number.isFinite(n) && n >= 0 ? n : 0
}
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function MarkupPanel({ defaultFeePercent, currentPrice, onApplyPrice }: MarkupPanelProps) {
  const [targetMargin, setTargetMargin] = useState('')
  const [cost, setCost]                 = useState('')
  const [feePct, setFeePct]             = useState(String(defaultFeePercent))
  const [feeTouched, setFeeTouched]     = useState(false)
  const [taxPct, setTaxPct]             = useState('')
  const [promoPct, setPromoPct]         = useState('')

  // Resync da tarifa quando o tipo de anúncio muda — só se o usuário não editou.
  useEffect(() => {
    if (!feeTouched) setFeePct(String(defaultFeePercent))
  }, [defaultFeePercent, feeTouched])

  const calc = useMemo(() => {
    const m     = num(targetMargin)
    const cmv   = num(cost)
    const f     = num(feePct)
    const t     = num(taxPct)
    const promo = num(promoPct)

    if (m <= 0 || cmv <= 0) return { state: 'incomplete' as const }
    if (promo >= 100)       return { state: 'error' as const, msg: 'A reserva para promoção precisa ser menor que 100%.' }

    const denom = 1 - f / 100 - t / 100 - m / 100
    if (denom <= 0) {
      return {
        state: 'error' as const,
        msg: `Margem alvo + tarifa + imposto somam ${round2(m + f + t)}% do preço. O total precisa ser menor que 100% para existir um preço possível.`,
      }
    }

    const pricePromo = round2(cmv / denom)
    const priceFull  = round2(pricePromo / (1 - promo / 100))

    const verify = (price: number) => computeContributionMargin({
      price,
      saleFee:       estimateSaleFee(price, f, 0),
      shipping:      0,
      cost:          cmv,
      taxPercentage: t,
      taxOnFreight:  false,
    })

    return {
      state: 'ok' as const,
      cmv, promo,
      pricePromo, priceFull,
      feePromo: estimateSaleFee(pricePromo, f, 0),
      atPromo:  verify(pricePromo),
      atFull:   verify(priceFull),
      markup:   round2(priceFull / cmv),
    }
  }, [targetMargin, cost, feePct, taxPct, promoPct])

  const applied = calc.state === 'ok' && num(currentPrice ?? '') === calc.priceFull

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
