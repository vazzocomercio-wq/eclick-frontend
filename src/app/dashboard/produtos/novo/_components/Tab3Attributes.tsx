'use client'

import { useTranslations } from 'next-intl'
import type { TabProps } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const sel = `${inp} cursor-pointer`
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

const VOLTAGES = ['110V', '220V', 'Bivolt', '12V', '24V', 'Não se aplica']
const WARRANTY_TYPE_KEYS = ['seller', 'factory', 'none'] as const
const ORIGINS = [
  '0 - Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8',
  '1 - Estrangeira, importação direta',
  '2 - Estrangeira, adquirida no mercado interno',
  '3 - Nacional com mais de 40% de conteúdo estrangeiro',
  '4 - Nacional produzida com processos produtivos básicos',
  '5 - Nacional com menos de 40% de conteúdo estrangeiro',
  '6 - Estrangeira com similar nacional (sem conteúdo estrangeiro)',
  '7 - Estrangeira sem similar nacional',
  '8 - Nacional, mercadoria ou bem com conteúdo de importação superior a 70%',
]

export default function Tab3Attributes({ data, set }: TabProps) {
  const t = useTranslations('produtos')
  return (
    <div className="space-y-8">

      {/* Main attributes */}
      <section>
        <p className={sec}>{t('tab3.mainSection')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>{t('tab3.color')}</label>
            <input type="text" className={inp} placeholder={t('tab3.colorPlaceholder')}
              value={data.color} onChange={e => set('color', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t('tab3.lightColor')}</label>
            <input type="text" className={inp} placeholder={t('tab3.lightColorPlaceholder')}
              value={data.lightColor} onChange={e => set('lightColor', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t('tab3.voltage')}</label>
            <select className={sel} value={data.voltage} onChange={e => set('voltage', e.target.value)}
              style={{ background: '#1c1c1f' }}>
              <option value="">{t('tab3.select')}</option>
              {VOLTAGES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>{t('tab3.material')}</label>
            <input type="text" className={inp} placeholder={t('tab3.materialPlaceholder')}
              value={data.material} onChange={e => set('material', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t('tab3.power')}</label>
            <div className="flex gap-2">
              <input type="number" className={inp} placeholder="0"
                value={data.power} onChange={e => set('power', e.target.value)} style={{ flex: 1 }} />
              <select className={sel} value={data.powerUnit} onChange={e => set('powerUnit', e.target.value)}
                style={{ background: '#1c1c1f', width: '80px', flex: 'none' }}>
                {['W', 'kW', 'HP', 'BTU', 'VA'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>{t('tab3.originCountry')}</label>
            <input type="text" className={inp} placeholder={t('tab3.originCountryPlaceholder')}
              value={data.originCountry} onChange={e => set('originCountry', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Secondary attributes */}
      <section>
        <p className={sec}>{t('tab3.secondarySection')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>{t('tab3.lightingType')}</label>
            <input type="text" className={inp} placeholder={t('tab3.lightingTypePlaceholder')}
              value={data.lightingType} onChange={e => set('lightingType', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t('tab3.lampType')}</label>
            <input type="text" className={inp} placeholder={t('tab3.lampTypePlaceholder')}
              value={data.lampType} onChange={e => set('lampType', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t('tab3.connectionType')}</label>
            <input type="text" className={inp} placeholder={t('tab3.connectionTypePlaceholder')}
              value={data.connectionType} onChange={e => set('connectionType', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t('tab3.installLocation')}</label>
            <input type="text" className={inp} placeholder={t('tab3.installLocationPlaceholder')}
              value={data.installLocation} onChange={e => set('installLocation', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Warranty */}
      <section>
        <p className={sec}>{t('tab3.warrantySection')}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>{t('tab3.warrantyType')}</label>
            <select className={sel} value={data.warrantyType}
              onChange={e => set('warrantyType', e.target.value as typeof data.warrantyType)}
              style={{ background: '#1c1c1f' }}>
              {WARRANTY_TYPE_KEYS.map(w => <option key={w} value={w}>{t(`tab3.warranty.${w}`)}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>{t('tab3.warrantyDays')}</label>
            <input type="number" className={inp} placeholder="90" min={0}
              value={data.warrantyDays} onChange={e => set('warrantyDays', e.target.value)}
              disabled={data.warrantyType === 'none'} />
          </div>
        </div>
      </section>
    </div>
  )
}
