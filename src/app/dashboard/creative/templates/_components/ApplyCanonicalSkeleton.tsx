'use client'

/**
 * Botão "Aplicar 11 canônicas" — substitui positions atuais pelo CANONICAL_POSITIONS.
 * Pede confirm se já tem positions.
 */

import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { CANONICAL_POSITIONS } from './constants'
import type { TemplatePosition } from '@/components/creative/types'
import { useConfirm } from '@/components/ui/dialog-provider'

export default function ApplyCanonicalSkeleton({
  existingCount,
  onApply,
  disabled,
}: {
  existingCount: number
  onApply:       (positions: TemplatePosition[]) => void
  disabled?:     boolean
}) {
  const t = useTranslations('creative.templates')
  const confirmDialog = useConfirm()

  const handle = async () => {
    if (existingCount > 0) {
      const ok = await confirmDialog({
        title:   t('replacePositionsTitle'),
        message: t('replacePositionsMessage', { count: existingCount }),
        confirmLabel: t('replaceConfirm'),
        variant:      'warning',
      })
      if (!ok) return
    }
    // Clone deep pra evitar mutação acidental do constant
    onApply(CANONICAL_POSITIONS.map(p => ({
      ...p,
      use_reference_ids: [...p.use_reference_ids],
      reference_match:   p.reference_match ? { ...p.reference_match } : undefined,
    })))
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-cyan-400/10 border border-cyan-400/30 hover:bg-cyan-400/20 text-cyan-300 text-xs transition-colors disabled:opacity-40"
      title={t('applyCanonicalTooltip')}
    >
      <Sparkles size={12} /> {t('applyCanonical')}
    </button>
  )
}
