'use client'

/**
 * Drawer 600px (right side) pra editar metadata da referência.
 * Curated: form todo disabled + banner amber explicando.
 * Tags e category_ml_ids: chips com input livre (Enter cria, X remove).
 * Positions: checkbox grid 1..11.
 *
 * Fecha por ESC, ✕, ou click no overlay.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Save, Trash2, AlertTriangle, Loader2, Plus, ImageOff } from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { CreativeReference, TaxonomyOption } from '@/components/creative/types'
import { useConfirm } from '@/components/ui/dialog-provider'
import TaxonomySelect from './TaxonomySelect'

const POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

export default function ReferenceEditorDrawer({
  open, reference, onClose, onSave, onDelete, busy,
}: {
  open:       boolean
  reference:  CreativeReference | null
  onClose:    () => void
  onSave:     (id: string, patch: {
    name?:                  string
    description?:           string | null
    tags?:                  string[]
    category_ml_ids?:       string[]
    default_for_positions?: number[]
    product_type?:          string | null
    ambient?:               string | null
    is_active?:             boolean
  }) => Promise<void>
  onDelete:   (id: string) => Promise<void>
  busy:       boolean
}) {
  const t = useTranslations('creative.references')
  const [name, setName]                 = useState('')
  const [description, setDescription]   = useState('')
  const [tags, setTags]                 = useState<string[]>([])
  const [categoryIds, setCategoryIds]   = useState<string[]>([])
  const [positions, setPositions]       = useState<Set<number>>(new Set())
  const [productType, setProductType]   = useState('')
  const [ambient, setAmbient]           = useState('')
  const [isActive, setIsActive]         = useState(true)
  const [tagInput, setTagInput]         = useState('')
  const [categoryInput, setCategoryInput] = useState('')
  const [error, setError]               = useState<string | null>(null)
  const [imgError, setImgError]         = useState(false)
  const [ambientOptions, setAmbientOptions] = useState<TaxonomyOption[]>([])
  const confirmDialog = useConfirm()

  // Carrega ambientes pra mapear position → label dos botões 1..11
  const reloadAmbientOptions = useCallback(() => {
    void CreativeApi.listTaxonomy('ambient')
      .then(setAmbientOptions)
      .catch(() => setAmbientOptions([]))
  }, [])

  useEffect(() => {
    if (!open) return
    reloadAmbientOptions()
  }, [open, reloadAmbientOptions])

  // Map de position → label do ambient linkado
  const positionLabel = new Map<number, string>()
  for (const opt of ambientOptions) {
    if (opt.linked_position != null) {
      positionLabel.set(opt.linked_position, opt.label)
    }
  }

  // Reset form quando reference muda
  useEffect(() => {
    if (!reference) return
    setName(reference.name)
    setDescription(reference.description ?? '')
    setTags([...reference.tags])
    setCategoryIds([...reference.category_ml_ids])
    setPositions(new Set(reference.default_for_positions))
    setProductType(reference.product_type ?? '')
    setAmbient(reference.ambient ?? '')
    setIsActive(reference.is_active)
    setTagInput('')
    setCategoryInput('')
    setError(null)
    setImgError(false)
  }, [reference?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ESC fecha
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !reference) return null

  const curated = reference.is_curated

  const togglePosition = (p: number) => {
    const next = new Set(positions)
    if (next.has(p)) next.delete(p); else next.add(p)
    setPositions(next)
  }

  const addTag = () => {
    const v = tagInput.trim()
    if (!v) return
    if (!tags.includes(v)) setTags([...tags, v])
    setTagInput('')
  }
  const removeTag = (t: string) => setTags(tags.filter(x => x !== t))

  const addCategory = () => {
    const v = categoryInput.trim()
    if (!v) return
    if (!categoryIds.includes(v)) setCategoryIds([...categoryIds, v])
    setCategoryInput('')
  }
  const removeCategory = (c: string) => setCategoryIds(categoryIds.filter(x => x !== c))

  const save = async () => {
    if (!name.trim()) { setError(t('nameRequired')); return }
    setError(null)
    try {
      await onSave(reference.id, {
        name:                  name.trim(),
        description:           description.trim() || null,
        tags,
        category_ml_ids:       categoryIds,
        default_for_positions: Array.from(positions).sort((a, b) => a - b),
        product_type:          productType || null,
        ambient:               ambient || null,
        is_active:             isActive,
      })
      // Drawer fechado pelo parent após sucesso
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const remove = async () => {
    const ok = await confirmDialog({
      title:        t('deleteRefTitle'),
      message:      t('deleteWithStorage', { name: reference.name }),
      confirmLabel: t('delete'),
      variant:      'danger',
    })
    if (!ok) return
    setError(null)
    try {
      await onDelete(reference.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[600px] max-w-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">{t('editorTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            title={t('close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body (scroll) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Preview */}
          <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 aspect-square">
            {!imgError && reference.signed_url ? (
              <img
                src={reference.signed_url}
                alt={reference.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <ImageOff size={36} />
              </div>
            )}
          </div>

          {/* Banner curated */}
          {curated && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{t('curatedBanner')}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome */}
          <Field label={t('fieldName')}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={curated}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600 disabled:opacity-50"
              placeholder={t('fieldNamePlaceholder')}
            />
          </Field>

          {/* Descrição */}
          <Field label={t('fieldDescription')}>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={curated}
              rows={2}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600 resize-y disabled:opacity-50"
              placeholder={t('fieldDescriptionPlaceholder')}
            />
          </Field>

          {/* Tags */}
          <Field label={t('fieldTags')}>
            <ChipsInput
              chips={tags}
              input={tagInput}
              onInput={setTagInput}
              onAdd={addTag}
              onRemove={removeTag}
              disabled={curated}
              placeholder={t('tagPlaceholder')}
            />
          </Field>

          {/* Categorias ML */}
          <Field label={t('fieldCategories')}>
            <ChipsInput
              chips={categoryIds}
              input={categoryInput}
              onInput={setCategoryInput}
              onAdd={addCategory}
              onRemove={removeCategory}
              disabled={curated}
              placeholder={t('categoryPlaceholder')}
              monoFont
            />
          </Field>

          {/* Posições — botões mostram label do ambient linkado ou número */}
          <Field label={t('fieldPositions')}>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
              {POSITIONS.map(p => {
                const checked = positions.has(p)
                const label   = positionLabel.get(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePosition(p)}
                    disabled={curated}
                    title={label ? t('positionTooltipLinked', { p, label }) : t('positionTooltipUnlinked', { p })}
                    className={[
                      'h-12 px-1.5 rounded-md flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-50',
                      checked
                        ? 'bg-cyan-400 text-black'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-cyan-500/40 hover:text-zinc-200',
                    ].join(' ')}
                  >
                    <span className={[
                      'text-[9px] font-mono leading-none',
                      checked ? 'text-black/60' : 'text-zinc-500',
                    ].join(' ')}>
                      {p}
                    </span>
                    <span className={[
                      'text-[11px] font-semibold leading-tight truncate w-full text-center',
                      label ? '' : 'opacity-50 italic',
                    ].join(' ')}>
                      {label ?? t('noLink')}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              {t.rich('positionsHint', { b: (chunks) => <strong>{chunks}</strong> })}
            </p>
          </Field>

          {/* Tipo + ambiente lado a lado */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('fieldProductType')}>
              <TaxonomySelect
                kind="product_type"
                value={productType}
                onChange={setProductType}
                placeholder={t('noTypePlaceholder')}
                disabled={curated}
              />
            </Field>
            <Field label={t('fieldAmbient')}>
              <TaxonomySelect
                kind="ambient"
                value={ambient}
                onChange={setAmbient}
                placeholder={t('noAmbientPlaceholder')}
                disabled={curated}
                onOptionsChanged={reloadAmbientOptions}
              />
            </Field>
          </div>

          {/* Ativa toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              disabled={curated}
              className="accent-cyan-400"
            />
            <span className="text-sm text-zinc-200">{t('activeToggle')}</span>
          </label>

          {/* Metadata */}
          <div className="border-t border-zinc-800 pt-3 mt-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{t('metadata')}</p>
            <dl className="text-[11px] text-zinc-400 space-y-0.5 font-mono">
              <MetaRow label={t('metaId')}     value={reference.id} />
              <MetaRow label={t('metaPath')}   value={reference.storage_path} />
              <MetaRow label={t('metaSource')} value={curated ? t('metaSourceCurated') : t('metaSourceOrg', { id: reference.organization_id?.slice(0, 8) ?? '?' })} />
            </dl>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-zinc-800 shrink-0 bg-zinc-950">
          <button
            type="button"
            onClick={remove}
            disabled={curated || busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {t('delete')}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={curated || busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-semibold transition-colors disabled:opacity-40 disabled:hover:bg-cyan-400"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {t('save')}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

// ── Sub components ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</label>
      {children}
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-zinc-600 shrink-0">{label}</span>
      <span className="text-zinc-400 truncate" title={value}>{value}</span>
    </div>
  )
}

function ChipsInput({
  chips, input, onInput, onAdd, onRemove, disabled, placeholder, monoFont,
}: {
  chips:       string[]
  input:       string
  onInput:     (v: string) => void
  onAdd:       () => void
  onRemove:    (chip: string) => void
  disabled?:   boolean
  placeholder: string
  monoFont?:   boolean
}) {
  const t = useTranslations('creative.references')
  return (
    <div className={[
      'flex flex-wrap items-center gap-1.5 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg min-h-[40px]',
      disabled ? 'opacity-50' : 'focus-within:border-cyan-400',
    ].join(' ')}>
      {chips.map(c => (
        <span
          key={c}
          className={[
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-zinc-800 text-zinc-200 border border-zinc-700',
            monoFont ? 'font-mono' : '',
          ].join(' ')}
        >
          {c}
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(c)}
              className="hover:text-red-300"
              aria-label={t('removeChip', { chip: c })}
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => onInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onAdd() }
          if (e.key === ',')     { e.preventDefault(); onAdd() }
        }}
        disabled={disabled}
        placeholder={chips.length === 0 ? placeholder : ''}
        className={[
          'flex-1 min-w-[120px] bg-transparent outline-none text-xs text-zinc-200 placeholder:text-zinc-600',
          monoFont ? 'font-mono' : '',
        ].join(' ')}
      />
      {!disabled && input.trim() && (
        <button
          type="button"
          onClick={onAdd}
          className="text-cyan-300 hover:text-cyan-200 px-1"
          aria-label={t('addChip')}
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  )
}
