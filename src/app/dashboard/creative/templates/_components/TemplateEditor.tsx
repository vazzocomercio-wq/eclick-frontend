'use client'

/**
 * Form principal do editor de template.
 *
 * Modos:
 *   - 'create': sem id, POST ao salvar
 *   - 'edit':   com id, PATCH ao salvar
 *
 * Carrega dados via getPromptTemplate(id) quando edição.
 * Validação local sem submit:
 *   - name vazio → erro inline
 *   - positions vazio → erro inline
 *   - position com prompt_template vazio → badge amber (não bloqueia save)
 *
 * Salvar: POST ou PATCH. Feedback via banner + estado de phase.
 * Sticky footer com Salvar / Preview / Clonar / Deletar.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Eye, Copy, Trash2, Loader2, AlertTriangle, CheckCircle2, Plus, X,
} from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { CreativePromptTemplate, TemplatePosition } from '@/components/creative/types'
import { useConfirm, useAlert } from '@/components/ui/dialog-provider'
import PositionList from './PositionList'
import TemplatePreviewDrawer from './TemplatePreviewDrawer'

type Mode = 'create' | 'edit'

export default function TemplateEditor({ mode, templateId }: { mode: Mode; templateId?: string }) {
  const t = useTranslations('creative.templates')
  const router = useRouter()
  const [loading, setLoading]   = useState(mode === 'edit')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [savedAt, setSavedAt]   = useState<Date | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Form state
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [brandVoice, setBrandVoice]   = useState('')
  const [isDefault, setIsDefault]     = useState(false)
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [catInput, setCatInput]       = useState('')
  const [positions, setPositions]     = useState<TemplatePosition[]>([])
  const [original, setOriginal]       = useState<CreativePromptTemplate | null>(null)
  const lastSavedHash = useRef('')
  const confirmDialog = useConfirm()
  const alertDialog   = useAlert()

  // Load existing
  useEffect(() => {
    if (mode !== 'edit' || !templateId) return
    setLoading(true)
    void CreativeApi.getPromptTemplate(templateId)
      .then(t => {
        setOriginal(t)
        setName(t.name)
        setDescription(t.description ?? '')
        setBrandVoice(t.brand_voice ?? '')
        setIsDefault(t.is_default)
        setCategoryIds(t.category_ml_ids ?? [])
        setPositions(t.positions ?? [])
        lastSavedHash.current = JSON.stringify(t.positions)
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [mode, templateId])

  // Validation
  const errors: string[] = []
  if (!name.trim()) errors.push(t('nameRequiredError'))
  if (positions.length === 0) errors.push(t('positionsRequiredError'))
  const positionsWithoutPrompt = positions.filter(p => !p.prompt_template.trim()).length

  const isDirty = original
    ? (
        name !== original.name ||
        (description || '') !== (original.description ?? '') ||
        (brandVoice || '') !== (original.brand_voice ?? '') ||
        isDefault !== original.is_default ||
        JSON.stringify(categoryIds) !== JSON.stringify(original.category_ml_ids ?? []) ||
        JSON.stringify(positions) !== JSON.stringify(original.positions ?? [])
      )
    : true

  // Save
  const save = async (alsoSetDefault?: boolean) => {
    if (errors.length > 0) {
      setError(errors[0])
      return
    }
    setError(null)
    setSaving(true)
    try {
      const body = {
        name:            name.trim(),
        description:     description.trim() || undefined,
        is_default:      alsoSetDefault ?? isDefault,
        category_ml_ids: categoryIds,
        brand_voice:     brandVoice.trim() || undefined,
        positions,
      }
      if (mode === 'create') {
        const created = await CreativeApi.createPromptTemplate(body)
        router.push(`/dashboard/creative/templates/${created.id}`)
        return
      }
      if (!templateId) throw new Error(t('templateIdMissing'))
      const updated = await CreativeApi.updatePromptTemplate(templateId, body)
      setOriginal(updated)
      lastSavedHash.current = JSON.stringify(updated.positions)
      setSavedAt(new Date())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleClone = async () => {
    if (!templateId) return
    setSaving(true)
    try {
      const cloned = await CreativeApi.clonePromptTemplate(templateId)
      router.push(`/dashboard/creative/templates/${cloned.id}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!templateId || !original) return
    if (original.is_default) {
      await alertDialog({
        title:   t('cannotDeleteTitle'),
        message: t('cannotDeleteAlert'),
        variant: 'warning',
      })
      return
    }
    const ok = await confirmDialog({
      title:        t('deleteTitle'),
      message:      t('deleteTemplateMessage', { name }),
      confirmLabel: t('deleteConfirm'),
      variant:      'danger',
    })
    if (!ok) return
    setSaving(true)
    try {
      await CreativeApi.deletePromptTemplate(templateId)
      router.push('/dashboard/creative/templates')
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const addCategory = () => {
    const v = catInput.trim()
    if (!v) return
    if (!categoryIds.includes(v)) setCategoryIds([...categoryIds, v])
    setCatInput('')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 rounded-lg bg-zinc-900/40 animate-pulse" />
        <div className="h-32 rounded-lg bg-zinc-900/40 animate-pulse" />
        <div className="h-24 rounded-lg bg-zinc-900/40 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/creative/templates" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">
            {mode === 'create' ? t('newTemplateTitle') : (original?.name ?? t('editTitle'))}
          </h1>
          {mode === 'edit' && original && (
            <p className="text-[11px] text-zinc-500">
              {t('createdUpdated', {
                created: new Date(original.created_at).toLocaleDateString('pt-BR'),
                updated: new Date(original.updated_at).toLocaleDateString('pt-BR'),
              })}
            </p>
          )}
        </div>
      </div>

      {/* Error / Saved banners */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {savedAt && !error && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          <span>{t('savedAt', { time: savedAt.toLocaleTimeString('pt-BR') })}</span>
        </div>
      )}

      {/* Meta fields */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
        <Field label={t('fieldName')} value={name} onChange={setName} placeholder={t('fieldNamePlaceholder')} />
        <Field label={t('fieldDescription')} value={description} onChange={setDescription} placeholder={t('fieldDescriptionPlaceholder')} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{t('categoriesMl')}</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {categoryIds.map(c => (
                <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-400/10 text-cyan-200 border border-cyan-400/30">
                  {c}
                  <button type="button" onClick={() => setCategoryIds(categoryIds.filter(x => x !== c))} className="hover:text-cyan-100">
                    <X size={9} />
                  </button>
                </span>
              ))}
              {categoryIds.length === 0 && (
                <span className="text-[10px] text-zinc-600 italic">{t('categoriesEmpty')}</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={catInput}
                onChange={e => setCatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }}
                placeholder={t('categoryPlaceholder')}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
              />
              <button type="button" onClick={addCategory} className="px-2 rounded-md bg-zinc-900 border border-zinc-800 hover:border-cyan-400 text-cyan-400 transition-colors">
                <Plus size={11} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{t('brandVoice')}</label>
            <textarea
              value={brandVoice}
              onChange={e => setBrandVoice(e.target.value)}
              rows={2}
              placeholder={t('brandVoicePlaceholder')}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600 resize-y"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={e => setIsDefault(e.target.checked)}
            className="accent-cyan-400"
          />
          {t('setAsDefault')}
          <span className="text-[10px] text-zinc-500">{t('setAsDefaultHint')}</span>
        </label>
      </div>

      {/* Positions */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <PositionList
          positions={positions}
          onChange={setPositions}
          disabled={saving}
          templateId={mode === 'edit' ? templateId : undefined}
          templateName={name}
        />
        {positionsWithoutPrompt > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>{t('positionsWithoutPrompt', { count: positionsWithoutPrompt })}</span>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 sm:left-[224px] z-30 bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => save()}
            disabled={saving || errors.length > 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {t('save')}
          </button>

          {mode === 'edit' && !isDefault && (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving || errors.length > 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400/10 border border-cyan-400/30 hover:bg-cyan-400/20 text-cyan-300 text-xs disabled:opacity-40"
            >
              {t('saveSetDefault')}
            </button>
          )}

          {mode === 'edit' && (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={saving || isDirty}
              title={isDirty ? t('previewSaveFirst') : t('previewTooltip')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs disabled:opacity-40"
            >
              <Eye size={12} /> {t('previewWithProduct')}
            </button>
          )}

          {mode === 'edit' && (
            <button
              type="button"
              onClick={handleClone}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs disabled:opacity-40 ml-auto"
            >
              <Copy size={12} /> {t('clone')}
            </button>
          )}

          {mode === 'edit' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || original?.is_default}
              title={original?.is_default ? t('deleteDefaultTooltip') : t('deleteTooltip')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/40 hover:text-red-300 text-zinc-400 text-xs disabled:opacity-40"
            >
              <Trash2 size={12} /> {t('delete')}
            </button>
          )}

          {errors.length > 0 && (
            <span className="text-[11px] text-red-300 ml-2">
              {t('pendingCount', { count: errors.length })}
            </span>
          )}
        </div>
      </div>

      {/* Preview drawer */}
      {mode === 'edit' && templateId && (
        <TemplatePreviewDrawer
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          templateId={templateId}
        />
      )}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
      />
    </div>
  )
}
