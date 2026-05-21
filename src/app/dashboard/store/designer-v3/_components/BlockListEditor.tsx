'use client'

/**
 * BlockListEditor — gerencia a lista de blocks de uma section.
 *
 * - Lista compacta de blocks com type label
 - Click no bloco abre BlockEditor inline expandido
 * - "+ Adicionar bloco" → modal com types permitidos pra section
 * - Remove + reorder (up/down) sem drag-drop (mais simples que @dnd-kit
 *   aninhado, e blocks tipicamente sao poucos)
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react'
import type { Block, BlockType, SectionType } from '@/lib/storefront/v3/types'
import { BlockEditor } from './BlockEditor'

const BLOCK_LABELS: Record<BlockType, string> = {
  heading:         'Título',
  subheading:      'Subtítulo',
  paragraph:       'Parágrafo',
  image:           'Imagem',
  video:           'Vídeo',
  button:          'Botão',
  badge:           'Selo',
  countdown:       'Contagem regressiva',
  divider:         'Divisor',
  spacer:          'Espaço',
  icon:            'Ícone',
  productCardMini: 'Card de produto',
  collectionLink:  'Link de coleção',
  socialIcon:      'Ícone social',
  slide:           'Slide',
}

// Whitelist de blocks por section type (decisões de produto: o que faz
// sentido em cada container). Default = todos exceto slide.
const ALLOWED_BLOCKS_PER_SECTION: Partial<Record<SectionType, BlockType[]>> = {
  hero:           ['heading', 'subheading', 'paragraph', 'button', 'badge', 'image', 'spacer'],
  slider:         ['slide'],
  imageBanner:    ['heading', 'subheading', 'paragraph', 'button'],
  imageWithText:  ['paragraph', 'button'],
  announcementBar: ['button'],
  siteHeader:     ['button'],
  siteFooter:     ['socialIcon', 'paragraph', 'divider'],
  newsletter:     ['heading', 'paragraph'],
}

const ALL_BLOCKS: BlockType[] = [
  'heading','subheading','paragraph','image','video','button','badge',
  'countdown','divider','spacer','icon','productCardMini','collectionLink','socialIcon',
]

function newId(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function defaultBlock(type: BlockType): Block {
  const id = newId()
  switch (type) {
    case 'heading':         return { id, type, settings: { text: 'Título', level: 2, align: 'left' } }
    case 'subheading':      return { id, type, settings: { text: 'Subtítulo', align: 'left' } }
    case 'paragraph':       return { id, type, settings: { text: 'Texto aqui.', align: 'left' } }
    case 'image':           return { id, type, settings: { url: '', alt: '', aspectRatio: '16:9', objectFit: 'cover' } }
    case 'video':           return { id, type, settings: { url: '', autoplay: false, loop: false, muted: true, controls: true } }
    case 'button':          return { id, type, settings: { label: 'Clique aqui', href: '#', style: 'primary', size: 'md', newTab: false } }
    case 'badge':           return { id, type, settings: { text: 'NOVO', color: 'primary' } }
    case 'countdown':       return { id, type, settings: { endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() } }
    case 'divider':         return { id, type, settings: { style: 'solid' } }
    case 'spacer':          return { id, type, settings: { height: 40 } }
    case 'icon':            return { id, type, settings: { name: 'Star', size: 24 } }
    case 'productCardMini': return { id, type, settings: { productId: '', showPrice: true, showCta: true } }
    case 'collectionLink':  return { id, type, settings: { collectionId: '', label: 'Coleção' } }
    case 'socialIcon':      return { id, type, settings: { network: 'instagram', href: 'https://instagram.com/' } }
    case 'slide':           return { id, type, settings: { imageUrl: '', textAlign: 'left' } }
  }
}

interface Props {
  blocks:      Block[]
  sectionType: SectionType
  onChange:    (next: Block[]) => void
}

export function BlockListEditor({ blocks, sectionType, onChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding,   setAdding]   = useState(false)

  const allowed = ALLOWED_BLOCKS_PER_SECTION[sectionType] ?? ALL_BLOCKS

  const update = (id: string, next: Block) => onChange(blocks.map(b => b.id === id ? next : b))
  const remove = (id: string) => onChange(blocks.filter(b => b.id !== id))
  const move   = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= blocks.length) return
    const next = [...blocks]
    const [item] = next.splice(idx, 1)
    next.splice(newIdx, 0, item)
    onChange(next)
  }
  const add = (type: BlockType) => {
    onChange([...blocks, defaultBlock(type)])
    setAdding(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium uppercase tracking-wide" style={{ color: '#a1a1aa' }}>
          Blocos ({blocks.length})
        </h4>
      </div>

      <div className="space-y-1">
        {blocks.map((b, i) => {
          const open = expanded === b.id
          return (
            <div key={b.id} style={{ border: '1px solid #27272a', borderRadius: 6, background: '#0a0a0e' }}>
              <div className="flex items-center gap-1 p-2">
                <button onClick={() => setExpanded(open ? null : b.id)}
                  className="flex-1 flex items-center gap-2 text-left text-sm"
                  style={{ color: '#fafafa', background: 'transparent', border: 'none', cursor: 'pointer', minHeight: 36 }}>
                  {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {BLOCK_LABELS[b.type]}
                  <span style={{ fontSize: 11, color: '#52525b' }}>{b.type}</span>
                </button>
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover pra cima"
                  style={btnStyle(i === 0)}><ArrowUp size={12} /></button>
                <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="Mover pra baixo"
                  style={btnStyle(i === blocks.length - 1)}><ArrowDown size={12} /></button>
                <button onClick={() => remove(b.id)} aria-label="Remover"
                  style={{ ...btnStyle(false), color: '#f87171' }}><Trash2 size={12} /></button>
              </div>
              {open && (
                <div className="p-3 space-y-3" style={{ borderTop: '1px solid #27272a' }}>
                  <BlockEditor block={b} onChange={n => update(b.id, n)} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button onClick={() => setAdding(true)}
        className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded"
        style={{
          background: 'transparent', color: '#00E5FF',
          border: '1px dashed #27272a', minHeight: 40, cursor: 'pointer',
        }}>
        <Plus size={12} /> Adicionar bloco
      </button>

      {adding && (
        <div onClick={() => setAdding(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: '#0d0d10', border: '1px solid #27272a', borderRadius: 8,
              width: '100%', maxWidth: 420, maxHeight: '80vh',
              display: 'flex', flexDirection: 'column',
            }}>
            <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: '#27272a' }}>
              <h2 className="text-sm font-medium" style={{ color: '#fafafa' }}>Adicionar bloco</h2>
              <button onClick={() => setAdding(false)} aria-label="Fechar"
                style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', minHeight: 44, minWidth: 44 }}>
                <X size={14} />
              </button>
            </div>
            <div className="overflow-y-auto p-2 grid gap-1">
              {allowed.map(t => (
                <button key={t} onClick={() => add(t)}
                  className="text-left px-3 py-2 rounded hover:opacity-80"
                  style={{
                    background: '#0a0a0e', border: '1px solid #27272a',
                    color: '#fafafa', minHeight: 40, cursor: 'pointer', fontSize: 13,
                  }}>
                  {BLOCK_LABELS[t]}
                  <span style={{ fontSize: 11, color: '#52525b', marginLeft: 8 }}>{t}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 28, minWidth: 28,
    padding: 4,
    background: 'transparent',
    color: disabled ? '#3f3f46' : '#a1a1aa',
    border: 'none', borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
