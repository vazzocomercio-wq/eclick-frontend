'use client'

/**
 * Card de 1 position (item da PositionList).
 *
 * Features:
 *   - Drag handle (lucide GripVertical) — listener vem do useSortable do parent
 *   - Header colapsível: "Posição N — Nome" + warning badge se prompt vazio
 *   - Expand mostra: nome, aspect_ratio, ambient_hint, textarea prompt + chips,
 *     negative_prompt, toggles use_product/use_logo, ReferenceSelector,
 *     ReferenceMatchConfig accordion, delete button
 */

import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Trash2, AlertTriangle } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TemplatePosition, AspectRatio } from '@/components/creative/types'
import { useConfirm } from '@/components/ui/dialog-provider'
import VariablesChips from './VariablesChips'
import ReferenceSelector from './ReferenceSelector'
import ReferenceMatchConfig from './ReferenceMatchConfig'
import { ASPECT_RATIO_OPTIONS } from './constants'

export default function PositionCard({
  position,
  onChange,
  onDelete,
  defaultExpanded = false,
  disabled,
}: {
  position:          TemplatePosition
  onChange:          (next: TemplatePosition) => void
  onDelete:          () => void
  defaultExpanded?:  boolean
  disabled?:         boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const promptRef   = useRef<HTMLTextAreaElement | null>(null)
  const negativeRef = useRef<HTMLTextAreaElement | null>(null)
  const confirmDialog = useConfirm()

  const sortable = useSortable({ id: position.position })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity:    sortable.isDragging ? 0.5 : 1,
  }

  const set = (patch: Partial<TemplatePosition>) => onChange({ ...position, ...patch })

  const hasPrompt = position.prompt_template.trim().length > 0

  const insertAtCursor = (targetRef: React.RefObject<HTMLTextAreaElement | null>, field: 'prompt_template' | 'negative_prompt') => (token: string) => {
    const ta = targetRef.current
    if (!ta) return
    const start = ta.selectionStart ?? ta.value.length
    const end   = ta.selectionEnd   ?? ta.value.length
    const before = ta.value.slice(0, start)
    const after  = ta.value.slice(end)
    const next   = before + token + after
    set({ [field]: next } as Partial<TemplatePosition>)
    // Reposiciona cursor após o token inserido (próximo tick pra DOM atualizar)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + token.length
      ta.setSelectionRange(pos, pos)
    })
  }

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          disabled={disabled}
          className="text-zinc-500 hover:text-zinc-300 cursor-grab active:cursor-grabbing"
          title="Arraste pra reordenar"
        >
          <GripVertical size={14} />
        </button>

        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            #{position.position}
          </span>
          <span className="text-sm font-medium text-zinc-100 truncate">
            {position.name || '(sem nome)'}
          </span>
          {!hasPrompt && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
              <AlertTriangle size={9} /> sem prompt
            </span>
          )}
          <span className="ml-auto text-zinc-500">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        <button
          type="button"
          onClick={async () => {
            if (hasPrompt) {
              const ok = await confirmDialog({
                title:        'Apagar posição',
                message:      `Apagar posição "${position.name}"?`,
                confirmLabel: 'Apagar',
                variant:      'danger',
              })
              if (!ok) return
            }
            onDelete()
          }}
          disabled={disabled}
          className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40"
          title="Apagar posição"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-3 space-y-3">
          {/* Nome + Aspect + Ambient */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Nome" value={position.name} onChange={v => set({ name: v })} disabled={disabled} />
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Aspect ratio</label>
              <select
                value={position.aspect_ratio ?? '1:1'}
                onChange={e => set({ aspect_ratio: e.target.value as AspectRatio })}
                disabled={disabled}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400"
              >
                {ASPECT_RATIO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <Field label="Ambient hint" value={position.ambient_hint ?? ''} onChange={v => set({ ambient_hint: v || undefined })} placeholder="sala, quarto, cozinha…" disabled={disabled} />
          </div>

          {/* Prompt template */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Prompt template *</label>
            <textarea
              ref={promptRef}
              value={position.prompt_template}
              onChange={e => set({ prompt_template: e.target.value })}
              disabled={disabled}
              rows={4}
              placeholder="Fotografia profissional de {product_name}..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-cyan-400 placeholder:text-zinc-600 resize-y font-mono"
            />
            <div className="mt-1.5">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Vars (click insere no cursor):</p>
              <VariablesChips onInsert={insertAtCursor(promptRef, 'prompt_template')} disabled={disabled} />
            </div>
          </div>

          {/* Negative prompt */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Negative prompt</label>
            <textarea
              ref={negativeRef}
              value={position.negative_prompt ?? ''}
              onChange={e => set({ negative_prompt: e.target.value || undefined })}
              disabled={disabled}
              rows={2}
              placeholder="people, hands, text, watermark..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-cyan-400 placeholder:text-zinc-600 resize-y font-mono"
            />
          </div>

          {/* Source toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Toggle
              label="Usar foto-fonte do produto"
              hint="anexa main_image_url do produto como ref"
              checked={position.use_product_reference}
              onChange={v => set({ use_product_reference: v })}
              disabled={disabled}
            />
            <Toggle
              label="Usar logo da marca"
              hint="usa briefing.logo_url se use_logo=true"
              checked={position.use_brand_logo}
              onChange={v => set({ use_brand_logo: v })}
              disabled={disabled}
            />
          </div>

          {/* Refs fixas */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">References fixas</label>
            <ReferenceSelector
              value={position.use_reference_ids}
              onChange={v => set({ use_reference_ids: v })}
              disabled={disabled}
            />
          </div>

          {/* Match dinâmico */}
          <ReferenceMatchConfig
            value={position.reference_match}
            onChange={v => set({ reference_match: v })}
            hasFixedRefs={position.use_reference_ids.length > 0}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, disabled,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
  disabled?:    boolean
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
      />
    </div>
  )
}

function Toggle({
  label, hint, checked, onChange, disabled,
}: {
  label:    string
  hint:     string
  checked:  boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-start gap-2 p-2 rounded-md bg-zinc-950 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        className="accent-cyan-400 mt-0.5"
      />
      <span className="flex-1">
        <span className="block text-xs text-zinc-200">{label}</span>
        <span className="block text-[9px] text-zinc-500">{hint}</span>
      </span>
    </label>
  )
}
