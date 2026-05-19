'use client'

import { useTranslations } from 'next-intl'
import type { TabProps } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const sel = `${inp} cursor-pointer`
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

const ORIGIN_CODES = ['0', '1', '2', '3', '4', '5', '6', '7', '8']
const CSOSN_CODES = ['102', '400', '500', '900']
const PIS_COFINS_CODES = ['01', '02', '07', '08', '49', '70', '99']

export default function Tab7Fiscal({ data, set }: TabProps) {
  const t = useTranslations('produtos')
  return (
    <div className="space-y-8">

      <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-[12px]"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#d4a017' }}>
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {t('tab7.optionalNotice')}
      </div>

      {/* Classification */}
      <section>
        <p className={sec}>{t('tab7.classificationSection')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>NCM</label>
            <input type="text" className={inp} placeholder="0000.00.00" maxLength={10}
              value={data.ncm} onChange={e => set('ncm', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>CEST</label>
            <input type="text" className={inp} placeholder="00.000.00" maxLength={9}
              value={data.cest} onChange={e => set('cest', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>{t('tab7.origin')}</label>
            <select className={sel} value={data.origin} onChange={e => set('origin', e.target.value)}
              style={{ background: '#1c1c1f' }}>
              {ORIGIN_CODES.map(o => <option key={o} value={o}>{t(`tab7.originOption.${o}`)}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* CFOP */}
      <section>
        <p className={sec}>CFOP</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>{t('tab7.cfopSameState')}</label>
            <input type="text" className={inp} placeholder="5102" maxLength={4}
              value={data.cfopSameState} onChange={e => set('cfopSameState', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t('tab7.cfopOtherState')}</label>
            <input type="text" className={inp} placeholder="6102" maxLength={4}
              value={data.cfopOtherState} onChange={e => set('cfopOtherState', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Taxes */}
      <section>
        <p className={sec}>{t('tab7.taxesSection')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={lbl}>CSOSN</label>
            <select className={sel} value={data.csosn} onChange={e => set('csosn', e.target.value)}
              style={{ background: '#1c1c1f' }}>
              <option value="">{t('tab7.select')}</option>
              {CSOSN_CODES.map(o => <option key={o} value={o}>{t(`tab7.csosnOption.${o}`)}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>PIS/COFINS CST</label>
            <select className={sel} value={data.pisCofins} onChange={e => set('pisCofins', e.target.value)}
              style={{ background: '#1c1c1f' }}>
              <option value="">{t('tab7.select')}</option>
              {PIS_COFINS_CODES.map(o => <option key={o} value={o}>{t(`tab7.pisCofinsOption.${o}`)}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>{t('tab7.totalTributes')}</label>
            <div className="relative">
              <input type="number" className={inp} placeholder="0.00" step="0.01" min={0} max={100}
                value={data.tributesPercent} onChange={e => set('tributesPercent', e.target.value)}
                style={{ paddingRight: '30px' }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">%</span>
            </div>
          </div>
          <div>
            <label className={lbl}>EX TIPI</label>
            <input type="text" className={inp} placeholder="Ex: 01"
              value={data.exTipi} onChange={e => set('exTipi', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Other fiscal */}
      <section>
        <p className={sec}>{t('tab7.otherSection')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>{t('tab7.recopi')}</label>
            <input type="text" className={inp} placeholder={t('tab7.recopiPlaceholder')}
              value={data.recopi} onChange={e => set('recopi', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t('tab7.fci')}</label>
            <input type="text" className={inp} placeholder="UUID"
              value={data.fci} onChange={e => set('fci', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>{t('tab7.additionalInfo')}</label>
            <textarea className={inp} rows={3} placeholder={t('tab7.additionalInfoPlaceholder')}
              value={data.additionalInfo} onChange={e => set('additionalInfo', e.target.value)}
              style={{ resize: 'vertical' }} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>{t('tab7.groupable')}</label>
            <div className="flex gap-3">
              {([true, false] as const).map(optVal => {
                const active = optVal === data.groupable
                return (
                  <button key={String(optVal)} type="button" onClick={() => set('groupable', optVal)}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium border transition-all"
                    style={{
                      background: active ? 'rgba(0,229,255,0.08)' : '#1c1c1f',
                      borderColor: active ? '#00E5FF' : '#3f3f46',
                      color: active ? '#00E5FF' : '#71717a',
                    }}>
                    {optVal ? t('tab7.yes') : t('tab7.no')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
