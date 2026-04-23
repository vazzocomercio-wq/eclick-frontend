'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { TabProps } from '../types'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const inp = 'w-full bg-[#1c1c1f] border border-[#3f3f46] text-white text-sm rounded-lg px-3 py-2.5 outline-none transition-all placeholder-zinc-600 focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF20]'
const lbl = 'block text-[13px] font-medium text-zinc-300 mb-1.5'
const sec = 'text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-4 pb-2 border-b border-[#1e1e24]'

const CATEGORIES = [
  'Eletrônicos', 'Celulares e Smartphones', 'Informática', 'Televisores',
  'Áudio', 'Câmeras e Fotografia', 'Games', 'Eletrodomésticos',
  'Casa e Jardim', 'Ferramentas', 'Esporte e Lazer', 'Moda',
  'Beleza e Saúde', 'Bebês', 'Brinquedos', 'Alimentos',
  'Automotivo', 'Indústria e Comércio', 'Outros',
]

type Props = TabProps & { orgId: string | null }

// ── SortablePhotoItem ─────────────────────────────────────────────────────────

function SortablePhotoItem({
  url,
  index,
  onRemove,
}: {
  url: string
  index: number
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
      }}
      className="relative group shrink-0"
    >
      <img
        src={url}
        alt=""
        {...attributes}
        {...listeners}
        draggable={false}
        className="w-20 h-20 rounded-xl object-cover border-2 select-none"
        style={{
          borderColor: index === 0 ? '#00E5FF' : '#3f3f46',
          opacity: isDragging ? 0.35 : 1,
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: 'border-color 0.2s, opacity 0.15s',
        }}
      />
      {index === 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10 pointer-events-none"
          style={{ background: '#00E5FF', color: '#000' }}
        >
          CAPA
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
        style={{ background: 'rgba(0,0,0,0.75)' }}
      >
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── DragOverlayPhoto ──────────────────────────────────────────────────────────

function DragOverlayPhoto({ url }: { url: string }) {
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className="w-20 h-20 rounded-xl object-cover border-2 select-none"
      style={{
        borderColor: '#00E5FF',
        cursor: 'grabbing',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 2px rgba(0,229,255,0.3)',
        transform: 'scale(1.08) rotate(1.5deg)',
        opacity: 0.95,
      }}
    />
  )
}

// ── Tab1Basic ─────────────────────────────────────────────────────────────────

export default function Tab1Basic({ data, set, orgId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string)
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIdx = data.photoUrls.indexOf(active.id as string)
    const newIdx = data.photoUrls.indexOf(over.id as string)
    if (oldIdx !== -1 && newIdx !== -1) {
      set('photoUrls', arrayMove(data.photoUrls, oldIdx, newIdx))
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const total = data.photoUrls.length + uploadingCount
    const arr = Array.from(files).slice(0, 10 - total)
    if (arr.length === 0) return

    setUploadError(null)
    setUploadingCount(c => c + arr.length)

    const supabase = createClient()
    const folder = orgId ?? 'public'
    const uploaded: string[] = []
    const failed: string[] = []

    await Promise.all(
      arr.map(async (file) => {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

        const { error } = await supabase.storage
          .from('produtos')
          .upload(path, file, { cacheControl: '3600', upsert: false })

        if (error) { failed.push(file.name); return }

        const { data: pub } = supabase.storage.from('produtos').getPublicUrl(path)
        uploaded.push(pub.publicUrl)
      })
    )

    setUploadingCount(c => c - arr.length)

    if (uploaded.length > 0) set('photoUrls', [...data.photoUrls, ...uploaded])
    if (failed.length > 0) {
      setUploadError(`Erro ao enviar: ${failed.join(', ')}. Verifique se o bucket "produtos" existe no Supabase Storage.`)
    }

    if (fileRef.current) fileRef.current.value = ''
  }

  function removePhoto(i: number) {
    set('photoUrls', data.photoUrls.filter((_, idx) => idx !== i))
  }

  const totalSlots = data.photoUrls.length + uploadingCount
  const canAddMore = totalSlots < 10
  const activeUrl = activeId ? data.photoUrls.find(u => u === activeId) ?? null : null

  return (
    <div className="space-y-8">

      {/* Photos */}
      <section>
        <p className={sec}>Fotos do produto</p>

        {uploadError && (
          <div className="mb-3 px-3 py-2.5 rounded-lg border text-[12px]"
            style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.2)', color: '#f87171' }}>
            {uploadError}
          </div>
        )}

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={data.photoUrls} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-3">
              {data.photoUrls.map((url, i) => (
                <SortablePhotoItem
                  key={url}
                  url={url}
                  index={i}
                  onRemove={() => removePhoto(i)}
                />
              ))}

              {/* Upload loading placeholders */}
              {[...Array(uploadingCount)].map((_, i) => (
                <div key={`loading-${i}`}
                  className="w-20 h-20 rounded-xl shrink-0 flex items-center justify-center border-2 border-dashed"
                  style={{ background: 'rgba(0,229,255,0.04)', borderColor: 'rgba(0,229,255,0.3)' }}>
                  <svg className="w-5 h-5 animate-spin" style={{ color: '#00E5FF' }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ))}

              {/* Add button */}
              {canAddMore && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors shrink-0"
                  style={{ borderColor: '#3f3f46' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#00E5FF')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#3f3f46')}
                >
                  <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[10px] text-zinc-600">Adicionar</span>
                </button>
              )}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
            {activeUrl ? <DragOverlayPhoto url={activeUrl} /> : null}
          </DragOverlay>
        </DndContext>

        <p className="text-[11px] text-zinc-600 mt-2">
          {totalSlots}/10 fotos · Arraste para reordenar · A primeira imagem será a capa
        </p>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />
      </section>

      {/* Identity */}
      <section>
        <p className={sec}>Identificação</p>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={lbl}>Nome do produto <span className="text-red-400">*</span></label>
            <input type="text" className={inp} maxLength={120} placeholder="Ex: Ventilador de Mesa Mondial 40cm 6 Pás"
              value={data.name} onChange={e => set('name', e.target.value)} />
            <p className="text-[11px] text-zinc-600 mt-1 text-right">{data.name.length}/120</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>SKU interno</label>
              <input type="text" className={inp} placeholder="Ex: VENT-40CM-001"
                value={data.sku} onChange={e => set('sku', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>GTIN / EAN</label>
              <input type="text" className={inp} placeholder="Ex: 7891234567890" maxLength={14}
                value={data.gtin} onChange={e => set('gtin', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Marca <span className="text-red-400">*</span></label>
              <input type="text" className={inp} placeholder="Ex: Mondial"
                value={data.brand} onChange={e => set('brand', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Modelo</label>
              <input type="text" className={inp} placeholder="Ex: NV-18-6P"
                value={data.model} onChange={e => set('model', e.target.value)} />
            </div>
          </div>
        </div>
      </section>

      {/* Condition */}
      <section>
        <p className={sec}>Condição</p>
        <div className="flex gap-3">
          {(['new', 'used', 'refurbished'] as const).map(c => {
            const labels = { new: 'Novo', used: 'Usado', refurbished: 'Recondicionado' }
            const active = data.condition === c
            return (
              <button key={c} type="button" onClick={() => set('condition', c)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all"
                style={{
                  background: active ? 'rgba(0,229,255,0.08)' : '#1c1c1f',
                  borderColor: active ? '#00E5FF' : '#3f3f46',
                  color: active ? '#00E5FF' : '#71717a',
                }}>
                {labels[c]}
              </button>
            )
          })}
        </div>
      </section>

      {/* Category */}
      <section>
        <p className={sec}>Categoria</p>
        <div>
          <label className={lbl}>Categoria principal</label>
          <select className={inp} value={data.category} onChange={e => set('category', e.target.value)}
            style={{ background: '#1c1c1f' }}>
            <option value="">Selecione uma categoria</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </section>
    </div>
  )
}
