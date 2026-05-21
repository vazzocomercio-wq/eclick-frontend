'use client'

/**
 * Modo Avançado — Designer v3 (C.4).
 *
 * Lista vertical das sections da home com:
 *  - Drag handle (reorder via @dnd-kit/sortable)
 *  - Icone do type + label traduzido
 *  - Acoes: duplicar, remover, ocultar mobile/desktop
 *  - Click no item abre sub-editor (TODO: C.5 — por enquanto so destaca)
 *
 * Adicionar nova section via botao "+ Adicionar" — modal com galeria
 * dos 25 types disponiveis.
 *
 * Auto-save com debounce 1.5s (mesmo padrao do ModoFacil).
 *
 * Globais (header/footer) NAO entram nesta lista — sao geridos no
 * ModoFacil ou em sub-editor dedicado.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Copy, Trash2, EyeOff, Eye, Smartphone, Monitor, Plus, X,
  Loader2, Check,
} from 'lucide-react'
import type { StorefrontDesignV3, Section, SectionType } from '@/lib/storefront/v3/types'
import { SECTION_TYPES_V3 } from '@/lib/storefront/v3/types'

const SECTION_LABELS: Partial<Record<SectionType, string>> = {
  siteHeader:          'Cabeçalho',
  siteFooter:          'Rodapé',
  announcementBar:     'Faixa de anúncio',
  breadcrumb:          'Trilha de navegação',
  hero:                'Banner Hero',
  slider:              'Carrossel de slides',
  imageBanner:         'Banner com imagem',
  imageHotspot:        'Imagem com hotspots',
  imageWithText:       'Imagem + texto',
  marquee:             'Texto rolante',
  productGrid:         'Vitrine de produtos (grade)',
  productCarousel:     'Vitrine de produtos (carrossel)',
  featuredProduct:     'Produto em destaque',
  collectionGrid:      'Grade de coleções',
  productDetailLayout: 'Layout da página de produto',
  richText:            'Texto rico',
  testimonials:        'Depoimentos',
  logoList:            'Lista de logos',
  faq:                 'FAQ',
  newsletter:          'Newsletter',
  videoBlock:          'Vídeo',
  customHtml:          'HTML custom (premium)',
  cartLayout:          'Layout do carrinho',
  checkoutLayout:      'Layout do checkout',
  whatsappCatalog:     'Catálogo WhatsApp',
}

// Types que so fazem sentido em paginas especificas — escondidos do add manual na home.
const HOME_FORBIDDEN: SectionType[] = ['siteHeader', 'siteFooter', 'productDetailLayout', 'cartLayout', 'checkoutLayout', 'breadcrumb']

interface Props {
  design:         StorefrontDesignV3
  onSave:         (next: StorefrontDesignV3) => Promise<void>
  /** Chamado IMEDIATO a cada mudanca (sem debounce) — usado pra postMessage
   *  no iframe do preview. Sem efeito se omitido. */
  onLiveChange?:  (next: StorefrontDesignV3) => void
}

export function ModoAvancado({ design, onSave, onLiveChange }: Props) {
  const [local, setLocal]   = useState<StorefrontDesignV3>(design)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [adding, setAdding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setLocal(design) }, [design])

  const update = useCallback((mut: (d: StorefrontDesignV3) => StorefrontDesignV3) => {
    setLocal(prev => {
      const next = mut(prev)
      onLiveChange?.(next)
      if (timer.current) clearTimeout(timer.current)
      setStatus('saving')
      timer.current = setTimeout(async () => {
        await onSave(next)
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 1500)
      }, 1500)
      return next
    })
  }, [onSave, onLiveChange])

  const sections = local.pages.home.sections

  const setSections = (next: Section[]) =>
    update(d => ({ ...d, pages: { ...d.pages, home: { ...d.pages.home, sections: next } } }))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = sections.findIndex(s => s.id === active.id)
    const newIdx = sections.findIndex(s => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    setSections(arrayMove(sections, oldIdx, newIdx))
  }

  const duplicate = (id: string) => {
    const idx = sections.findIndex(s => s.id === id)
    if (idx < 0) return
    const src = sections[idx]
    const copy: Section = JSON.parse(JSON.stringify(src))
    copy.id = `${src.id}_copy_${Date.now().toString(36)}`
    copy.blocks = copy.blocks.map(b => ({ ...b, id: `${b.id}_copy_${Date.now().toString(36)}` }))
    const next = [...sections]
    next.splice(idx + 1, 0, copy)
    setSections(next)
  }

  const remove = (id: string) => {
    if (!confirm('Remover esta seção?')) return
    setSections(sections.filter(s => s.id !== id))
  }

  const toggleVisibility = (id: string, key: 'desktop' | 'mobile') => {
    setSections(sections.map(s => s.id === id ? { ...s, visibility: { ...s.visibility, [key]: !s.visibility[key] } } : s))
  }

  const addSection = (type: SectionType) => {
    const newSection = createDefaultSection(type)
    setSections([...sections, newSection])
    setAdding(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3" style={{ minHeight: 20 }}>
        <span className="text-xs" style={{ color: '#a1a1aa' }}>{sections.length} seções</span>
        <span className="text-xs" style={{ color: '#a1a1aa' }}>
          {status === 'saving' && <><Loader2 size={12} className="inline animate-spin mr-1" /> Salvando…</>}
          {status === 'saved'  && <><Check    size={12} className="inline mr-1" style={{ color: '#22c55e' }} /> Salvo</>}
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map(s => (
            <SortableItem key={s.id} section={s}
              onDuplicate={() => duplicate(s.id)}
              onRemove={() => remove(s.id)}
              onToggleDesktop={() => toggleVisibility(s.id, 'desktop')}
              onToggleMobile={() => toggleVisibility(s.id, 'mobile')}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={() => setAdding(true)}
        className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 text-sm rounded-lg"
        style={{
          background: 'transparent', color: '#00E5FF',
          border: '1px dashed #27272a', minHeight: 44, cursor: 'pointer',
        }}>
        <Plus size={14} /> Adicionar seção
      </button>

      {adding && <AddSectionModal onClose={() => setAdding(false)} onAdd={addSection} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Item arrastavel
// ─────────────────────────────────────────────────────────────────────────

function SortableItem({ section, onDuplicate, onRemove, onToggleDesktop, onToggleMobile }: {
  section: Section
  onDuplicate: () => void
  onRemove:    () => void
  onToggleDesktop: () => void
  onToggleMobile:  () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: '#0a0a0e',
    border: '1px solid #27272a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <button {...attributes} {...listeners}
        aria-label="Arrastar"
        style={{ cursor: 'grab', minHeight: 44, minWidth: 32, background: 'transparent', border: 'none', color: '#a1a1aa' }}>
        <GripVertical size={16} />
      </button>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 14, color: '#fafafa', fontWeight: 500 }}>
          {SECTION_LABELS[section.type] ?? section.type}
        </div>
        <div style={{ fontSize: 11, color: '#52525b' }}>{section.type}</div>
      </div>
      <button onClick={onToggleMobile}  aria-label="Mostrar/ocultar no mobile"
        style={iconBtnStyle(section.visibility.mobile)}><Smartphone size={14} /></button>
      <button onClick={onToggleDesktop} aria-label="Mostrar/ocultar no desktop"
        style={iconBtnStyle(section.visibility.desktop)}><Monitor size={14} /></button>
      <button onClick={onDuplicate} aria-label="Duplicar"
        style={iconBtnStyle(true)}><Copy size={14} /></button>
      <button onClick={onRemove} aria-label="Remover"
        style={{ ...iconBtnStyle(true), color: '#f87171' }}><Trash2 size={14} /></button>
    </div>
  )
}

function iconBtnStyle(active: boolean): React.CSSProperties {
  return {
    minHeight: 32, minWidth: 32,
    padding: 6,
    background: 'transparent',
    color: active ? '#a1a1aa' : '#3f3f46',
    border: 'none', borderRadius: 4, cursor: 'pointer',
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Modal de adicionar
// ─────────────────────────────────────────────────────────────────────────

function AddSectionModal({ onClose, onAdd }: { onClose: () => void; onAdd: (t: SectionType) => void }) {
  const allowed = SECTION_TYPES_V3.filter(t => !HOME_FORBIDDEN.includes(t))
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0d0d10', border: '1px solid #27272a', borderRadius: 8,
          width: '100%', maxWidth: 520, maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
        }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#27272a' }}>
          <h2 className="text-sm font-medium" style={{ color: '#fafafa' }}>Adicionar seção</h2>
          <button onClick={onClose} aria-label="Fechar"
            style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', minHeight: 44, minWidth: 44 }}>
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-3 grid gap-2">
          {allowed.map(t => (
            <button key={t} onClick={() => onAdd(t)}
              className="text-left px-3 py-3 rounded hover:opacity-80 transition-opacity"
              style={{
                background: '#0a0a0e', border: '1px solid #27272a',
                color: '#fafafa', minHeight: 44, cursor: 'pointer',
              }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{SECTION_LABELS[t] ?? t}</div>
              <div style={{ fontSize: 11, color: '#52525b' }}>{t}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Factory: cria section default por type
// ─────────────────────────────────────────────────────────────────────────

function newId() { return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }

function createDefaultSection(type: SectionType): Section {
  const id = newId()
  const base = {
    id,
    blocks:     [] as Section['blocks'],
    visibility: { desktop: true, mobile: true },
    spacing:    { paddingTop: 60, paddingBottom: 60, marginTop: 0, marginBottom: 0 },
    background: { kind: 'none' as const },
  }
  switch (type) {
    case 'announcementBar':
      return { ...base, type, settings: { message: 'Sua mensagem aqui', countdownTo: null, dismissible: false } }
    case 'hero':
      return { ...base, type, settings: { layout: 'centered', height: 'md', textAlign: 'center' } }
    case 'slider':
      return { ...base, type, settings: { autoplay: true, interval: 5, showDots: true, showArrows: true, effect: 'fade', height: 'md' } }
    case 'imageBanner':
      return { ...base, type, settings: { imageUrl: '', textPosition: 'center', height: 'md' } }
    case 'imageHotspot':
      return { ...base, type, settings: { imageUrl: '', hotspots: [] } }
    case 'imageWithText':
      return { ...base, type, settings: { imageUrl: '', imageSide: 'left', title: 'Título', body: 'Texto descritivo aqui.' } }
    case 'marquee':
      return { ...base, type, settings: { items: ['Frase 1', 'Frase 2'], speed: 'normal', direction: 'left' } }
    case 'productGrid':
      return { ...base, type, settings: { source: { kind: 'storefront' }, columns: { mobile: 2, tablet: 3, desktop: 4 }, limit: 12, showFilters: false, showSort: false, cardStyle: 'detailed' } }
    case 'productCarousel':
      return { ...base, type, settings: { source: { kind: 'bestsellers' }, limit: 12, autoplay: false, cardStyle: 'detailed' } }
    case 'featuredProduct':
      return { ...base, type, settings: { productId: '', galleryPosition: 'left', showDescription: true, showAttributes: false } }
    case 'collectionGrid':
      return { ...base, type, settings: { columns: { mobile: 2, tablet: 3, desktop: 4 }, collections: [] } }
    case 'richText':
      return { ...base, type, settings: { content: 'Texto aqui.', maxWidth: 'md', align: 'left' } }
    case 'testimonials':
      return { ...base, type, settings: { layout: 'grid', items: [] } }
    case 'logoList':
      return { ...base, type, settings: { logos: [], grayscale: false } }
    case 'faq':
      return { ...base, type, settings: { items: [] } }
    case 'newsletter':
      return { ...base, type, settings: { ctaLabel: 'Inscrever', placeholder: 'seu@email.com', successMessage: 'Obrigado!' } }
    case 'videoBlock':
      return { ...base, type, settings: { url: '', autoplay: false, loop: false, muted: true, aspectRatio: '16:9' } }
    case 'customHtml':
      return { ...base, type, settings: { html: '<p>HTML custom aqui</p>' } }
    case 'whatsappCatalog':
      return { ...base, type, settings: { enabled: true, position: 'floating', label: 'Ver catálogo no WhatsApp' } }
    // Defensive fallback — não deve ser alcançado (HOME_FORBIDDEN filtra esses)
    case 'siteHeader':
    case 'siteFooter':
    case 'productDetailLayout':
    case 'cartLayout':
    case 'checkoutLayout':
    case 'breadcrumb':
    default:
      return { ...base, type: 'richText', settings: { content: 'Bloco não disponível pra adicionar aqui.', maxWidth: 'md', align: 'center' } } as Section
  }
}
