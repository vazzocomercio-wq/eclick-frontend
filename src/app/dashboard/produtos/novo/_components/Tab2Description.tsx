'use client'

import { useTranslations } from 'next-intl'
import type { TabProps } from '../types'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

/** Corta o título para no máx. 60 caracteres sem quebrar palavra ao meio. */
function trimTo60(t: string): string {
  if (t.length <= 60) return t
  let cut = t.slice(0, 60)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > 40) cut = cut.slice(0, lastSpace)
  return cut.trimEnd()
}

export default function Tab2Description({ data, set }: TabProps) {
  const t = useTranslations('produtos')
  const mlLen = data.mlTitle.length
  const mlOver = mlLen > 60

  return (
    <div className="space-y-8">

      {/* ML Title */}
      <section>
        <p className={sec}>{t('tab2.titleSection')}</p>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={lbl} style={{ marginBottom: 0 }}>
              {t('tab2.mlTitleLabel')} <span className="text-red-400">*</span>
            </label>
            <span className={`text-[11px] font-semibold ${mlOver ? 'text-red-400' : 'text-zinc-500'}`}>
              {mlLen}/60
            </span>
          </div>
          <input
            type="text"
            className={inp}
            maxLength={80}
            placeholder={t('tab2.mlTitlePlaceholder')}
            value={data.mlTitle}
            onChange={e => set('mlTitle', e.target.value)}
            style={mlOver ? { borderColor: '#f87171' } : {}}
          />
          {mlOver && (
            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-[11px] text-red-400 flex-1">
                {t('tab2.titleTooLong', { over: mlLen - 60 })}
              </p>
              <button
                type="button"
                onClick={() => set('mlTitle', trimTo60(data.mlTitle))}
                className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-all active:scale-[0.97]"
                style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', borderColor: 'rgba(0,229,255,0.3)' }}
              >
                {t('tab2.shortenTo60')}
              </button>
            </div>
          )}
          <p className="text-[11px] text-zinc-600 mt-1">
            {t('tab2.titleHint')}
          </p>
        </div>
      </section>

      {/* Description */}
      <section>
        <p className={sec}>{t('tab2.descriptionSection')}</p>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={lbl} style={{ marginBottom: 0 }}>
              {t('tab2.descriptionLabel')}
            </label>
            <span className="text-[11px] text-zinc-600">
              {data.description.length.toLocaleString('pt-BR')}/50.000
            </span>
          </div>
          <textarea
            className={inp}
            rows={12}
            maxLength={50000}
            placeholder={t('tab2.descriptionPlaceholder')}
            value={data.description}
            onChange={e => set('description', e.target.value)}
            style={{ resize: 'vertical', minHeight: '240px' }}
          />
          <p className="text-[11px] text-zinc-600 mt-1">
            {t('tab2.descriptionHint')}
          </p>
        </div>
      </section>
    </div>
  )
}
