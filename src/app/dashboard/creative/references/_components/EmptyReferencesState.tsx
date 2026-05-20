'use client'

/**
 * Empty state da galeria: ilustração + texto + 2 CTAs.
 * "Subir imagens" abre o seletor de arquivo via onUpload.
 * "Ver curadas" aplica filtro is_curated=true.
 */

import { useTranslations } from 'next-intl'
import { Package, Upload, Sparkles } from 'lucide-react'

export default function EmptyReferencesState({
  onUploadClick, onShowCurated,
}: {
  onUploadClick: () => void
  onShowCurated: () => void
}) {
  const t = useTranslations('creative.references')
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
      <div className="mx-auto mb-4 flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-400/10 text-cyan-300">
        <Package size={26} />
      </div>
      <h2 className="text-base font-semibold text-zinc-100 mb-2">{t('emptyTitle')}</h2>
      <p className="text-sm text-zinc-400 max-w-md mx-auto mb-1">
        {t('emptyText')}
      </p>
      <p className="text-xs text-zinc-500 max-w-md mx-auto mb-6">
        {t('emptySubtext')}
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <button
          onClick={onUploadClick}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold transition-colors"
        >
          <Upload size={14} /> {t('uploadImages')}
        </button>
        <button
          onClick={onShowCurated}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10 text-sm font-semibold transition-colors"
        >
          <Sparkles size={14} /> {t('viewCurated')}
        </button>
      </div>
    </div>
  )
}
