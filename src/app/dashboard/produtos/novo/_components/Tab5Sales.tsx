'use client'

import { useId } from 'react'
import type { TabProps, WholesaleLevel } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const sel = `${inp} cursor-pointer`
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border transition-all"
      style={{ background: '#1c1c1f', borderColor: checked ? 'rgba(0,229,255,0.3)' : '#3f3f46' }}>
      <div>
        <p className="text-white text-sm font-medium">{label}</p>
        {sub && <p className="text-zinc-500 text-[12px] mt-0.5">{sub}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-all shrink-0"
        style={{ background: checked ? '#00E5FF' : '#3f3f46' }}>
        <span className="absolute top-0.5 transition-all w-5 h-5 rounded-full"
          style={{ background: '#fff', left: checked ? '22px' : '2px' }} />
      </button>
    </div>
  )
}

const SALE_FORMATS = [
  { v: 'unit', l: 'Unidade' },
  { v: 'kit2', l: 'Kit c/2' },
  { v: 'kit3', l: 'Kit c/3' },
  { v: 'box', l: 'Caixa' },
  { v: 'pair', l: 'Par' },
]

export default function Tab5Sales({ data, set }: TabProps) {
  const uid = useId()

  function addWholesaleLevel() {
    const level: WholesaleLevel = { id: `${uid}-${Date.now()}`, minQty: '', price: '' }
    set('wholesaleLevels', [...data.wholesaleLevels, level])
  }

  function updateLevel(id: string, field: keyof WholesaleLevel, value: string) {
    set('wholesaleLevels', data.wholesaleLevels.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  function removeLevel(id: string) {
    set('wholesaleLevels', data.wholesaleLevels.filter(l => l.id !== id))
  }

  return (
    <div className="space-y-8">

      {/* Price & Stock */}
      <section>
        <p className={sec}>Preço e estoque</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Preço de venda <span className="text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">R$</span>
              <input type="text" className={inp} placeholder="0,00"
                value={data.price} onChange={e => set('price', e.target.value)}
                style={{ paddingLeft: '36px' }} />
            </div>
          </div>
          <div>
            <label className={lbl}>Estoque total <span className="text-red-400">*</span></label>
            <input type="number" className={inp} placeholder="0" min={0}
              value={data.stock} onChange={e => set('stock', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Formato de venda</label>
            <div className="flex gap-2 flex-wrap">
              {SALE_FORMATS.map(f => {
                const active = data.saleFormat === f.v
                return (
                  <button key={f.v} type="button" onClick={() => set('saleFormat', f.v)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
                    style={{
                      background: active ? 'rgba(0,229,255,0.08)' : '#1c1c1f',
                      borderColor: active ? '#00E5FF' : '#3f3f46',
                      color: active ? '#00E5FF' : '#71717a',
                    }}>
                    {f.l}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Wholesale */}
      <section>
        <p className={sec}>Atacado</p>
        <Toggle checked={data.wholesaleEnabled} onChange={v => set('wholesaleEnabled', v)}
          label="Habilitar preço de atacado"
          sub="Defina preços especiais para compras em quantidade" />

        {data.wholesaleEnabled && (
          <div className="mt-4 space-y-3">
            {data.wholesaleLevels.length === 0 && (
              <p className="text-zinc-500 text-[12px] text-center py-4">
                Nenhum nível de atacado adicionado.
              </p>
            )}
            {data.wholesaleLevels.map((level, i) => (
              <div key={level.id} className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ background: '#1c1c1f', borderColor: '#3f3f46' }}>
                <span className="text-zinc-500 text-[11px] font-semibold w-16 shrink-0">Nível {i + 1}</span>
                <div className="flex-1">
                  <label className="block text-[11px] text-zinc-500 mb-1">Qtd. mínima</label>
                  <input type="number" className={inp} placeholder="10" min={1}
                    value={level.minQty} onChange={e => updateLevel(level.id, 'minQty', e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] text-zinc-500 mb-1">Preço (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">R$</span>
                    <input type="text" className={inp} placeholder="0,00"
                      value={level.price} onChange={e => updateLevel(level.id, 'price', e.target.value)}
                      style={{ paddingLeft: '32px' }} />
                  </div>
                </div>
                <button type="button" onClick={() => removeLevel(level.id)}
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-4"
                  style={{ color: '#71717a' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button type="button" onClick={addWholesaleLevel}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
              style={{ borderColor: '#00E5FF', color: '#00E5FF', background: 'rgba(0,229,255,0.05)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Adicionar nível
            </button>
          </div>
        )}
      </section>

      {/* Cost & Margin */}
      <section>
        <p className={sec}>Custo &amp; Impostos</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Custo do produto (CMV)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">R$</span>
              <input type="text" className={inp} placeholder="0,00"
                value={data.costPrice} onChange={e => set('costPrice', e.target.value)}
                style={{ paddingLeft: '36px' }} />
            </div>
          </div>
          <div>
            <label className={lbl}>Imposto (%)</label>
            <div className="relative">
              <input type="text" className={inp} placeholder="0,00"
                value={data.taxPercentage} onChange={e => set('taxPercentage', e.target.value)}
                style={{ paddingRight: '32px' }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
            </div>
          </div>
          <div className="col-span-2">
            <Toggle checked={data.taxOnFreight} onChange={v => set('taxOnFreight', v)}
              label="Imposto incide sobre frete?"
              sub="Quando ativo, o imposto é calculado sobre (venda + frete)" />
          </div>
        </div>

        {/* Live margin preview */}
        {(() => {
          const salePrice  = parseFloat(String(data.price).replace(',', '.'))  || 0
          const cost       = parseFloat(String(data.costPrice).replace(',', '.')) || 0
          const taxPct     = parseFloat(String(data.taxPercentage).replace(',', '.')) || 0
          const feeRate    = data.mlListingType === 'premium' ? 0.16 : 0.115
          const tarifa     = Math.round(salePrice * feeRate * 100) / 100
          const taxBase    = data.taxOnFreight ? salePrice : salePrice
          const taxAmount  = Math.round(taxBase * (taxPct / 100) * 100) / 100
          const margin     = Math.round((salePrice - cost - tarifa - taxAmount) * 100) / 100
          const marginPct  = salePrice > 0 ? Math.round((margin / salePrice) * 10000) / 100 : 0
          const hasData    = salePrice > 0 || cost > 0
          if (!hasData) return null
          const green = '#4ade80', red = '#f87171', dim = '#52525b'
          const row = (icon: string, label: string, val: number, color: string) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: dim }}>{icon} {label}</span>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
                {val < 0 ? '-' : ''}{Math.abs(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          )
          return (
            <div className="mt-4 p-4 rounded-xl border space-y-1.5" style={{ background: '#0f0f12', borderColor: '#1e1e24' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Preview de margem</p>
              {row('💰', 'Venda', salePrice, '#e4e4e7')}
              {cost > 0 && row('📦', 'Custo (CMV)', -cost, red)}
              {tarifa > 0 && row('🏪', `Tarifa ML (${Math.round(feeRate * 100)}%)`, -tarifa, red)}
              {taxAmount > 0 && row('⚖️', `Imposto (${taxPct}%)`, -taxAmount, red)}
              <div className="border-t pt-1.5" style={{ borderColor: '#1e1e24' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold" style={{ color: '#e4e4e7' }}>🟢 Margem contrib.</span>
                  <span className="text-[13px] font-bold tabular-nums" style={{ color: margin >= 0 ? green : red }}>
                    {margin.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    <span className="ml-1.5 text-[11px] font-semibold opacity-70">({marginPct}%)</span>
                  </span>
                </div>
              </div>
            </div>
          )
        })()}
      </section>

      {/* ML listing type */}
      <section>
        <p className={sec}>Tipo de anúncio — Mercado Livre</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            {
              v: 'classic', title: 'Clássico',
              fee: '11%', perks: ['Duração ilimitada', 'Sem custo fixo', 'Sem destaque na busca'],
            },
            {
              v: 'premium', title: 'Premium',
              fee: '16%', perks: ['Destaque na busca', 'Mais visibilidade', 'Frete grátis obrigatório'],
            },
          ] as const).map(opt => {
            const active = data.mlListingType === opt.v
            return (
              <button key={opt.v} type="button" onClick={() => set('mlListingType', opt.v)}
                className="p-4 rounded-xl border text-left transition-all"
                style={{
                  background: active ? 'rgba(0,229,255,0.05)' : '#1c1c1f',
                  borderColor: active ? '#00E5FF' : '#3f3f46',
                }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold text-sm">{opt.title}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: active ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.05)', color: active ? '#00E5FF' : '#71717a' }}>
                    {opt.fee} / venda
                  </span>
                </div>
                <ul className="space-y-1">
                  {opt.perks.map(p => (
                    <li key={p} className="text-[12px] text-zinc-500 flex items-center gap-1.5">
                      <span style={{ color: active ? '#00E5FF' : '#52525b' }}>·</span> {p}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
