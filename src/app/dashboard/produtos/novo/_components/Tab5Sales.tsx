'use client'

import { useId, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { TabProps, WholesaleLevel } from '../types'
import { computeContributionMargin, estimateSaleFee } from '@/lib/margin'

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

const SALE_FORMAT_KEYS = ['unit', 'kit2', 'kit3', 'box', 'pair']

export default function Tab5Sales({ data, set }: TabProps) {
  const t = useTranslations('produtos')
  const uid = useId()

  // Preview de margem — usa o motor canônico (lib/margin). No cadastro de
  // produto novo não há frete conhecido (shipping = 0): é uma margem
  // OTIMISTA, sem frete. A tarifa é estimada por tipo de anúncio — quando o
  // produto for anunciado, o sistema usa a tarifa real da categoria.
  const previewMargem = useMemo(() => {
    const venda     = parseFloat(String(data.price        || '').replace(',', '.')) || 0
    const custo     = parseFloat(String(data.costPrice    || '').replace(',', '.')) || 0
    const taxPct    = parseFloat(String(data.taxPercentage || '').replace(',', '.')) || 0
    const tarifaPct = data.mlListingType === 'premium' ? 16 : 11.5
    const tarifa    = estimateSaleFee(venda, tarifaPct, 0)
    const r = computeContributionMargin({
      price:         venda,
      saleFee:       tarifa,
      shipping:      0,
      cost:          custo,
      taxPercentage: taxPct,
      taxOnFreight:  false,
    })
    return {
      venda, custo, tarifa, tarifaPct, taxPct,
      imposto:   r.taxAmount,
      margem:    r.contributionMargin,
      margemPct: r.contributionMarginPct,
    }
  }, [data.price, data.costPrice, data.taxPercentage, data.mlListingType])

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
        <p className={sec}>{t('tab5.priceSection')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>{t('tab5.salePrice')} <span className="text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">R$</span>
              <input type="text" className={inp} placeholder="0,00"
                value={data.price} onChange={e => set('price', e.target.value)}
                style={{ paddingLeft: '36px' }} />
            </div>
          </div>
          <div>
            <label className={lbl}>{t('tab5.totalStock')} <span className="text-red-400">*</span></label>
            <input type="number" className={inp} placeholder="0" min={0}
              value={data.stock} onChange={e => set('stock', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>{t('tab5.saleFormat')}</label>
            <div className="flex gap-2 flex-wrap">
              {SALE_FORMAT_KEYS.map(f => {
                const active = data.saleFormat === f
                return (
                  <button key={f} type="button" onClick={() => set('saleFormat', f)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
                    style={{
                      background: active ? 'rgba(0,229,255,0.08)' : '#1c1c1f',
                      borderColor: active ? '#00E5FF' : '#3f3f46',
                      color: active ? '#00E5FF' : '#71717a',
                    }}>
                    {t(`tab5.saleFormatOption.${f}`)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Wholesale */}
      <section>
        <p className={sec}>{t('tab5.wholesaleSection')}</p>
        <Toggle checked={data.wholesaleEnabled} onChange={v => set('wholesaleEnabled', v)}
          label={t('tab5.enableWholesale')}
          sub={t('tab5.enableWholesaleSub')} />

        {data.wholesaleEnabled && (
          <div className="mt-4 space-y-3">
            {data.wholesaleLevels.length === 0 && (
              <p className="text-zinc-500 text-[12px] text-center py-4">
                {t('tab5.noWholesaleLevels')}
              </p>
            )}
            {data.wholesaleLevels.map((level, i) => (
              <div key={level.id} className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ background: '#1c1c1f', borderColor: '#3f3f46' }}>
                <span className="text-zinc-500 text-[11px] font-semibold w-16 shrink-0">{t('tab5.level', { n: i + 1 })}</span>
                <div className="flex-1">
                  <label className="block text-[11px] text-zinc-500 mb-1">{t('tab5.minQty')}</label>
                  <input type="number" className={inp} placeholder="10" min={1}
                    value={level.minQty} onChange={e => updateLevel(level.id, 'minQty', e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] text-zinc-500 mb-1">{t('tab5.priceLabel')}</label>
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
              {t('tab5.addLevel')}
            </button>
          </div>
        )}
      </section>

      {/* Cost & Margin */}
      <section>
        <p className={sec}>{t('tab5.costSection')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>{t('tab5.productCost')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">R$</span>
              <input type="text" className={inp} placeholder="0,00"
                value={data.costPrice} onChange={e => set('costPrice', e.target.value)}
                style={{ paddingLeft: '36px' }} />
            </div>
          </div>
          <div>
            <label className={lbl}>{t('tab5.tax')}</label>
            <div className="relative">
              <input type="text" className={inp} placeholder="0,00"
                value={data.taxPercentage} onChange={e => set('taxPercentage', e.target.value)}
                style={{ paddingRight: '32px' }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">%</span>
            </div>
          </div>
          <div className="col-span-2">
            <Toggle checked={data.taxOnFreight} onChange={v => set('taxOnFreight', v)}
              label={t('tab5.taxOnFreight')}
              sub={t('tab5.taxOnFreightSub')} />
          </div>
        </div>

        {/* Live margin preview */}
        {(previewMargem.venda > 0 || previewMargem.custo > 0) && (
          <div className="mt-4 p-4 rounded-xl border space-y-1.5" style={{ background: '#0f0f12', borderColor: '#1e1e24' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">{t('tab5.marginPreview')}</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">💰 {t('tab5.sale')}</span>
              <span className="text-[11px] font-semibold tabular-nums text-zinc-200">
                {previewMargem.venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            {previewMargem.custo > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">📦 {t('tab5.costCmv')}</span>
                <span className="text-[11px] font-semibold tabular-nums text-red-400">
                  -{previewMargem.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
            {previewMargem.tarifa > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">🏪 {t('tab5.mlFee', { pct: previewMargem.tarifaPct.toFixed(0) })}</span>
                <span className="text-[11px] font-semibold tabular-nums text-red-400">
                  -{previewMargem.tarifa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
            {previewMargem.imposto > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">⚖️ {t('tab5.taxPct', { pct: previewMargem.taxPct.toFixed(0) })}</span>
                <span className="text-[11px] font-semibold tabular-nums text-red-400">
                  -{previewMargem.imposto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
            <div className="border-t pt-1.5" style={{ borderColor: '#1e1e24' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-200">🟢 {t('tab5.contributionMargin')}</span>
                <span className="text-[13px] font-bold tabular-nums"
                  style={{ color: previewMargem.margem >= 0 ? '#4ade80' : '#f87171' }}>
                  {previewMargem.margem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  <span className="ml-1.5 text-[11px] font-semibold opacity-70">
                    ({previewMargem.margemPct.toFixed(2)}%)
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ML listing type */}
      <section>
        <p className={sec}>{t('tab5.listingTypeSection')}</p>
        <div className="grid grid-cols-2 gap-3">
          {([
            {
              v: 'classic', title: t('tab5.classic'),
              fee: '11%', perks: [t('tab5.classicPerk1'), t('tab5.classicPerk2'), t('tab5.classicPerk3')],
            },
            {
              v: 'premium', title: t('tab5.premium'),
              fee: '16%', perks: [t('tab5.premiumPerk1'), t('tab5.premiumPerk2'), t('tab5.premiumPerk3')],
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
                    {t('tab5.feePerSale', { fee: opt.fee })}
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
