'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calculator, CheckCircle2, X, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase'

/** F18 F3.1 — Calculadora de margem de campanha. Inputs ao vivo →
 *  POST /shopee/campaigns/evaluate-margin → margem líquida + gate. */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'https://eclick-backend-production-2a87.up.railway.app'

const CYAN = '#00E5FF'

interface MarginResult {
  effective_price: number
  breakdown: {
    gross_price:          number
    discount_amount:      number
    shopee_commission:    number
    affiliate_commission: number
    product_cost:         number
    tax_amount:           number
    shipping:             number
  }
  net_margin:      number
  net_margin_pct:  number
  min_margin_pct:  number
  passes_gate:     boolean
  verdict:         string
  message:         string
}

interface Form {
  price:                    number
  discount_pct:             number  // 0-100 na UI
  estimated_take_rate_pct:  number  // 0-100 — take rate Shopee (comissão+serviço+transação+programas)
  affiliate_commission_pct: number  // 0-100
  cost:                     number
}

// take rate inicial = placeholder; sobrescrito on-mount pelo valor REAL
// configurado da org (org_channel_settings), evitando subestimar o custo Shopee.
const DEFAULT: Form = { price: 99.9, discount_pct: 10, estimated_take_rate_pct: 30, affiliate_commission_pct: 0, cost: 45 }

export default function MarginCalculatorModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('shopeeCampaigns.marginCalc')
  const [form, setForm]     = useState<Form>(DEFAULT)
  const [result, setResult] = useState<MarginResult | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const evaluate = useCallback(async (f: Form) => {
    setError(null)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const res = await fetch(`${BACKEND}/shopee/campaigns/evaluate-margin`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          price:                    f.price,
          discount_pct:             f.discount_pct / 100,
          estimated_take_rate_pct:  f.estimated_take_rate_pct / 100,
          affiliate_commission_pct: f.affiliate_commission_pct / 100,
          cost:                     f.cost,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setResult(await res.json())
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => void evaluate(form), 400)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [form, evaluate])

  // Busca o take rate REAL configurado da org (org_channel_settings) e usa como
  // valor inicial — em vez de um default genérico que subestima o custo Shopee.
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const sb = createClient()
        const { data: { session } } = await sb.auth.getSession()
        const res = await fetch(`${BACKEND}/channel-settings/shopee`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        if (!res.ok) return
        const d = (await res.json()) as { estimated_take_rate_pct?: number; commission_pct?: number } | null
        const pct = Number(d?.estimated_take_rate_pct ?? d?.commission_pct)
        if (alive && Number.isFinite(pct) && pct > 0) {
          setForm(f => ({ ...f, estimated_take_rate_pct: Math.round(pct * 10) / 10 }))
        }
      } catch { /* mantém o placeholder */ }
    })()
    return () => { alive = false }
  }, [])

  const set = <K extends keyof Form>(k: K, v: number) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: '#0f0f13', border: '1px solid #1e1e24' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Calculator size={16} style={{ color: CYAN }} />
            <h3 className="text-white font-semibold">{t('title')}</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white" aria-label={t('close')}><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <NumRow label={t('price')}        value={form.price}                    prefix="R$" step={1}  onChange={v => set('price', v)} />
          <SliderRow label={t('discount')}  value={form.discount_pct}             max={80}    onChange={v => set('discount_pct', v)} />
          <SliderRow label={t('shopeeCom')} value={form.estimated_take_rate_pct}  max={45}    onChange={v => set('estimated_take_rate_pct', v)} />
          <SliderRow label={t('affCom')}    value={form.affiliate_commission_pct} max={30}    onChange={v => set('affiliate_commission_pct', v)} />
          <NumRow label={t('cost')}         value={form.cost}                     prefix="R$" step={1}  onChange={v => set('cost', v)} />
        </div>

        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

        {result && (
          <div className="mt-5">
            <div className="rounded-xl p-4" style={{
              background: result.passes_gate ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${result.passes_gate ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
            }}>
              <div className="flex items-center gap-2">
                {result.passes_gate
                  ? <CheckCircle2 size={18} className="text-emerald-400" />
                  : <XCircle size={18} className="text-red-400" />}
                <div className="flex-1">
                  <p className="text-2xl font-black leading-none" style={{ color: result.passes_gate ? '#34d399' : '#f87171' }}>
                    {result.net_margin_pct.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {t('netMargin')} · {t('min')} {result.min_margin_pct.toFixed(0)}%
                  </p>
                </div>
                <p className="text-sm font-semibold" style={{ color: result.passes_gate ? '#34d399' : '#f87171' }}>
                  {formatBRL(result.net_margin)}
                </p>
              </div>
              <p className="text-[11px] mt-2 leading-relaxed" style={{ color: result.passes_gate ? '#86efac' : '#fca5a5' }}>
                {result.message}
              </p>
            </div>

            <div className="mt-3 space-y-1">
              <BreakdownRow label={t('br.gross')}     value={result.breakdown.gross_price} />
              <BreakdownRow label={t('br.discount')}  value={-result.breakdown.discount_amount} />
              <BreakdownRow label={t('br.shopee')}    value={-result.breakdown.shopee_commission} />
              {result.breakdown.affiliate_commission > 0 && (
                <BreakdownRow label={t('br.affiliate')} value={-result.breakdown.affiliate_commission} />
              )}
              <BreakdownRow label={t('br.cost')}      value={-result.breakdown.product_cost} />
              <BreakdownRow label={t('br.tax')}       value={-result.breakdown.tax_amount} />
              <div className="border-t pt-1 mt-1" style={{ borderColor: '#1e1e24' }}>
                <BreakdownRow label={t('br.net')} value={result.net_margin} bold />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NumRow({ label, value, prefix, step, onChange }: { label: string; value: number; prefix?: string; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-zinc-400">{label}</label>
      <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg w-32" style={{ background: '#0a0a0e', border: '1px solid #1e1e24' }}>
        {prefix && <span className="text-xs text-zinc-600">{prefix}</span>}
        <input type="number" value={value} step={step ?? 1} min={0}
          onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full bg-transparent text-sm text-zinc-200 text-right" style={{ outline: 'none' }} />
      </div>
    </div>
  )
}

function SliderRow({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs text-zinc-400">{label}</label>
        <span className="text-xs font-semibold" style={{ color: CYAN }}>{value}%</span>
      </div>
      <input type="range" min={0} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full mt-1 accent-cyan-400" style={{ accentColor: CYAN }} />
    </div>
  )
}

function BreakdownRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  const neg = value < 0
  return (
    <div className="flex items-center justify-between">
      <span className={`text-[11px] ${bold ? 'text-zinc-200 font-semibold' : 'text-zinc-500'}`}>{label}</span>
      <span className={`text-[11px] tabular-nums ${bold ? 'font-bold' : ''}`}
        style={{ color: bold ? (value >= 0 ? '#34d399' : '#f87171') : neg ? '#a1a1aa' : '#d4d4d8' }}>
        {formatBRL(value)}
      </span>
    </div>
  )
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
