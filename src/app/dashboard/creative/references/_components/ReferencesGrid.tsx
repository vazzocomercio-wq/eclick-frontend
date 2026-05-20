'use client'

/**
 * Grid responsivo de cards. Cols 2/3/4/5 conforme breakpoint.
 * Estados: loading (12 skeletons), filtered-empty (texto inline), normal.
 *
 * Empty global (sem refs E sem filtro) é tratado no page.tsx — esse componente
 * só lida com lista filtrada vazia.
 */

import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import type { CreativeReference } from '@/components/creative/types'
import ReferenceCard from './ReferenceCard'

export default function ReferencesGrid({
  loading, references, selectedIds, busyIds,
  onToggleSelect, onEdit, onToggleActive, onDelete,
}: {
  loading:        boolean
  references:     CreativeReference[]
  selectedIds:    Set<string>
  busyIds:        Set<string>
  onToggleSelect: (id: string) => void
  onEdit:         (ref: CreativeReference) => void
  onToggleActive: (ref: CreativeReference) => void
  onDelete:       (ref: CreativeReference) => void
}) {
  const t = useTranslations('creative.references')
  if (loading && references.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (references.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
        <p className="text-sm text-zinc-400">{t('gridLoadingEmpty')}</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1 text-[10px] text-cyan-300 px-2 py-1 rounded bg-zinc-900/80 backdrop-blur-sm">
          <Loader2 size={10} className="animate-spin" /> {t('updating')}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {references.map(r => (
          <ReferenceCard
            key={r.id}
            ref={r}
            selected={selectedIds.has(r.id)}
            busy={busyIds.has(r.id)}
            onToggleSelect={() => onToggleSelect(r.id)}
            onEdit={() => onEdit(r)}
            onToggleActive={() => onToggleActive(r)}
            onDelete={() => onDelete(r)}
          />
        ))}
      </div>
    </div>
  )
}
