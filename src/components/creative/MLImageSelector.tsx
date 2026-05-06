'use client'

import { useState } from 'react'
import { GripVertical, Check, AlertCircle } from 'lucide-react'
import type { MlPublishContext } from './types'

interface Props {
  /** Imagens disponíveis (approved, vindas do contexto). */
  available: MlPublishContext['approved_images']
  /** Lista ordenada de IDs selecionadas (capa = índice 0). */
  selected:  string[]
  onChange:  (next: string[]) => void
}

const ML_MAX_IMAGES = 10

/**
 * Selector de imagens com drag-and-drop pra ordenar.
 * - Click no card alterna selected/unselected
 * - Drag handle (☰) reordena
 * - Ordem importa: índice 0 vira capa do anúncio ML
 */
export default function MLImageSelector({ available, selected, onChange }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id))
    } else {
      if (selected.length >= ML_MAX_IMAGES) return
      onChange([...selected, id])
    }
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (dragId && dragId !== id) setOverId(id)
  }
  function handleDrop(e: React.DragEvent, dropId: string) {
    e.preventDefault()
    if (!dragId || dragId === dropId) { setDragId(null); setOverId(null); return }
    const newOrder = [...selected]
    const fromIdx  = newOrder.indexOf(dragId)
    const toIdx    = newOrder.indexOf(dropId)
    if (fromIdx < 0 || toIdx < 0) return
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, dragId)
    onChange(newOrder)
    setDragId(null); setOverId(null)
  }
  function handleDragEnd() { setDragId(null); setOverId(null) }

  if (available.length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200 flex items-start gap-2">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span>Nenhuma imagem aprovada. Aprove imagens em <strong>"Imagens geradas"</strong> antes de publicar no ML.</span>
      </div>
    )
  }

  // Ordem: selecionadas primeiro (na ordem de selected[]), depois disponíveis
  const selectedItems = selected
    .map(id => available.find(i => i.id === id))
    .filter((i): i is typeof available[number] => !!i)
  const unselectedItems = available.filter(i => !selected.includes(i.id))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>{selected.length}/{ML_MAX_IMAGES} selecionadas · arraste pra reordenar</span>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-zinc-500 hover:text-red-400">
            Limpar seleção
          </button>
        )}
      </div>

      {selectedItems.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-cyan-400 mb-1.5">Selecionadas (1ª = capa)</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {selectedItems.map((img, idx) => {
              const isDragOver = overId === img.id
              return (
                <div
                  key={img.id}
                  draggable
                  onDragStart={e => handleDragStart(e, img.id)}
                  onDragOver={e => handleDragOver(e, img.id)}
                  onDrop={e => handleDrop(e, img.id)}
                  onDragEnd={handleDragEnd}
                  className={[
                    'relative rounded-lg overflow-hidden border-2 transition-all cursor-move',
                    'border-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.25)]',
                    isDragOver ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-zinc-950' : '',
                    dragId === img.id ? 'opacity-50' : '',
                  ].join(' ')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.signed_image_url} alt={`Imagem ${img.position}`}
                       className="w-full aspect-square object-contain bg-zinc-900" />
                  <span className="absolute top-1 left-1 inline-flex items-center justify-center h-5 w-5 rounded bg-cyan-400 text-black text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-cyan-400 text-black text-[9px] font-bold">CAPA</span>
                  )}
                  <div className="absolute top-1 right-1 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => toggle(img.id)}
                      className="h-5 w-5 rounded bg-black/70 text-white hover:bg-red-500 flex items-center justify-center"
                      title="Remover"
                    >
                      ×
                    </button>
                    <span className="h-5 w-5 rounded bg-black/70 text-cyan-300 flex items-center justify-center" title="Arraste pra reordenar">
                      <GripVertical size={10} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {unselectedItems.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Disponíveis</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {unselectedItems.map(img => (
              <button
                key={img.id}
                type="button"
                onClick={() => toggle(img.id)}
                disabled={selected.length >= ML_MAX_IMAGES}
                className="group relative rounded-lg overflow-hidden border border-zinc-800 hover:border-cyan-400/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.signed_image_url} alt={`Imagem ${img.position}`}
                     className="w-full aspect-square object-contain bg-zinc-900" />
                <span className="absolute top-1 left-1 inline-flex items-center justify-center h-5 w-5 rounded bg-black/70 text-zinc-300 text-[10px] border border-zinc-700">
                  {img.position}
                </span>
                <div className="absolute inset-0 bg-cyan-400/0 group-hover:bg-cyan-400/10 transition-colors flex items-center justify-center">
                  <Check size={20} className="text-cyan-400 opacity-0 group-hover:opacity-100" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
