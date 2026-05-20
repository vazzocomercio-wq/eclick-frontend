'use client'

/**
 * Wrapper DnD da lista de positions.
 *
 * - SortableContext do @dnd-kit/sortable
 * - onDragEnd: reordena array + recalcula `position` field 1..N (sem gaps)
 * - Botão "+ Adicionar posição" (disabled se length >= MAX_POSITIONS)
 * - Botão "Aplicar 11 canônicas" (via ApplyCanonicalSkeleton)
 */

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { useTranslations } from 'next-intl'
import { Plus, FileStack } from 'lucide-react'
import type { TemplatePosition } from '@/components/creative/types'
import PositionCard from './PositionCard'
import ApplyCanonicalSkeleton from './ApplyCanonicalSkeleton'
import { MAX_POSITIONS } from './constants'

export default function PositionList({
  positions,
  onChange,
  disabled,
  templateId,
  templateName,
}: {
  positions: TemplatePosition[]
  onChange:  (next: TemplatePosition[]) => void
  disabled?: boolean
  /** Quando passado, PositionCard mostra botão "Testar slot". */
  templateId?:   string
  templateName?: string
}) {
  const t = useTranslations('creative.templates')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = positions.findIndex(p => p.position === active.id)
    const newIdx = positions.findIndex(p => p.position === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(positions, oldIdx, newIdx)
    // Renumera 1..N pra preservar ordem visual
    const renumbered = reordered.map((p, i) => ({ ...p, position: i + 1 }))
    onChange(renumbered)
  }

  const addEmpty = () => {
    if (positions.length >= MAX_POSITIONS) return
    const next: TemplatePosition = {
      position:              positions.length + 1,
      name:                  t('defaultPositionName', { n: positions.length + 1 }),
      prompt_template:       '',
      use_product_reference: true,
      use_brand_logo:        false,
      use_reference_ids:     [],
      aspect_ratio:          '1:1',
    }
    onChange([...positions, next])
  }

  const updateOne = (idx: number, updated: TemplatePosition) => {
    const next = [...positions]
    next[idx] = updated
    onChange(next)
  }

  const removeOne = (idx: number) => {
    const reordered = positions.filter((_, i) => i !== idx)
    const renumbered = reordered.map((p, i) => ({ ...p, position: i + 1 }))
    onChange(renumbered)
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-200">
            {t('positions')} <span className="text-zinc-500 font-normal">{t('positionsCounter', { current: positions.length, max: MAX_POSITIONS })}</span>
          </h3>
          {positions.length === 0 && (
            <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
              {t('emptyBadge')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ApplyCanonicalSkeleton
            existingCount={positions.length}
            onApply={next => onChange(next)}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={addEmpty}
            disabled={disabled || positions.length >= MAX_POSITIONS}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-cyan-400/40 text-cyan-400 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={positions.length >= MAX_POSITIONS ? t('maxPositionsTooltip', { max: MAX_POSITIONS }) : t('addEmptyPositionTooltip')}
          >
            <Plus size={12} /> {t('addPosition')}
          </button>
        </div>
      </div>

      {/* Empty state — toca skeleton */}
      {positions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <FileStack size={32} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-400 mb-2">{t('noPositionsTitle')}</p>
          <p className="text-[11px] text-zinc-600 mb-4">
            {t('noPositionsText')}
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={positions.map(p => p.position)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {positions.map((p, i) => (
                <PositionCard
                  key={p.position}
                  position={p}
                  onChange={updated => updateOne(i, updated)}
                  onDelete={() => removeOne(i)}
                  defaultExpanded={positions.length <= 3}
                  disabled={disabled}
                  templateId={templateId}
                  templateName={templateName}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
