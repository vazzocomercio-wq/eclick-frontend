'use client'

import { useTranslations } from 'next-intl'
import { AbsoluteBlocks } from './types'

const BLOCK_KEYS: Array<{ key: keyof AbsoluteBlocks; icon: string }> = [
  { key: 'never_below_cost',                icon: '🔒' },
  { key: 'max_change_per_run_pct',          icon: '🔒' },
  { key: 'require_cost_data',               icon: '🔒' },
  { key: 'max_changes_per_day_per_product', icon: '🔒' },
]

/** Aba 4 — Bloqueios Absolutos. Read-only por design (proteção do
 * negócio). Display informativo apenas. */
export function BlocksTab({ blocks }: { blocks: AbsoluteBlocks }) {
  const t = useTranslations('pricing')
  return (
    <>
      <div className="rounded-2xl px-5 py-4 mb-5" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.3)' }}>
        <p className="text-amber-400 text-sm font-semibold mb-1">⚠ {t('permanentBlocks')}</p>
        <p className="text-zinc-400 text-xs">{t('permanentBlocksDesc')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BLOCK_KEYS.map(b => {
          const v = blocks[b.key]
          const display = typeof v === 'boolean' ? (v ? t('blockActive') : t('blockInactive')) : `${v}${b.key === 'max_change_per_run_pct' ? '%' : ''}`
          return (
            <div key={b.key} className="rounded-2xl p-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{b.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <p className="text-white text-sm font-semibold">{t(`block_${b.key}_label`)}</p>
                    <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                      {display}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs leading-relaxed">{t(`block_${b.key}_desc`)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
