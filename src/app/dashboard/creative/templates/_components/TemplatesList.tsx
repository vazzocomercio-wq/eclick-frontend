'use client'

/**
 * Lista de templates da org. Cards com nome/descrição/n_positions/badge default
 * + actions menu (Editar/Clonar/Set default/Deletar).
 * Filtros: search + is_default + category_ml_id.
 */

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search, MoreVertical, Edit3, Copy, Star, Trash2, AlertTriangle, Loader2,
} from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { CreativePromptTemplate } from '@/components/creative/types'
import { useConfirm, useAlert } from '@/components/ui/dialog-provider'
import EmptyTemplatesState from './EmptyTemplatesState'
import { CANONICAL_POSITIONS } from './constants'

export default function TemplatesList() {
  const t = useTranslations('creative.templates')
  const router = useRouter()
  const [templates, setTemplates] = useState<CreativePromptTemplate[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [onlyDefault, setOnlyDefault] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [actionId, setActionId]   = useState<string | null>(null)
  const [busyId, setBusyId]       = useState<string | null>(null)
  const confirmDialog = useConfirm()
  const alertDialog   = useAlert()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await CreativeApi.listPromptTemplates({
        search:         search || undefined,
        category_ml_id: categoryFilter || undefined,
      })
      setTemplates(onlyDefault ? list.filter(t => t.is_default) : list)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, onlyDefault, categoryFilter])

  const handleSetDefault = async (id: string) => {
    setBusyId(id)
    try {
      await CreativeApi.setPromptTemplateDefault(id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
      setActionId(null)
    }
  }

  const handleClone = async (id: string) => {
    setBusyId(id)
    try {
      const cloned = await CreativeApi.clonePromptTemplate(id)
      router.push(`/dashboard/creative/templates/${cloned.id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string, name: string, isDefault: boolean) => {
    if (isDefault) {
      await alertDialog({
        title:   t('cannotDeleteTitle'),
        message: t('cannotDeleteMessage'),
        variant: 'warning',
      })
      return
    }
    const ok = await confirmDialog({
      title:        t('deleteTitle'),
      message:      t('deleteMessage', { name }),
      confirmLabel: t('deleteConfirm'),
      variant:      'danger',
    })
    if (!ok) return
    setBusyId(id)
    try {
      await CreativeApi.deletePromptTemplate(id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
      setActionId(null)
    }
  }

  // Empty state: aplica canonical e cria via POST direto na navegação
  const handleApplyCanonical = async () => {
    const created = await CreativeApi.createPromptTemplate({
      name:        t('canonicalName', { date: new Date().toLocaleDateString('pt-BR') }),
      description: t('canonicalDescription'),
      is_default:  false,
      positions:   CANONICAL_POSITIONS.map(p => ({
        ...p,
        use_reference_ids: [...p.use_reference_ids],
        reference_match:   p.reference_match ? { ...p.reference_match } : undefined,
      })),
    }).catch(e => { setError((e as Error).message); return null })
    if (created) router.push(`/dashboard/creative/templates/${created.id}`)
  }

  if (loading && templates.length === 0) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-20 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (templates.length === 0 && !search && !onlyDefault && !categoryFilter) {
    return <EmptyTemplatesState onApplySkeleton={handleApplyCanonical} />
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
          />
        </div>
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={onlyDefault}
            onChange={e => setOnlyDefault(e.target.checked)}
            className="accent-cyan-400"
          />
          {t('onlyDefaults')}
        </label>
        <input
          type="text"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          placeholder={t('categoryFilterPlaceholder')}
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600 w-44"
        />
      </div>

      {/* List */}
      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
          <p className="text-sm text-zinc-400">{t('noTemplatesFiltered')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700 transition-all"
            >
              <div className="flex items-center gap-3 p-3">
                <Link href={`/dashboard/creative/templates/${tpl.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{tpl.name}</h3>
                    {tpl.is_default && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-400 text-black">
                        {t('defaultBadge')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mb-1 line-clamp-1">
                    {tpl.description ?? t('noDescription')}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                    <span>{t('positionsCount', { count: tpl.positions.length })}</span>
                    {tpl.category_ml_ids.length > 0 && (
                      <span className="font-mono text-cyan-400/70">
                        {tpl.category_ml_ids.slice(0, 2).join(', ')}{tpl.category_ml_ids.length > 2 ? '…' : ''}
                      </span>
                    )}
                    {tpl.brand_voice && (
                      <span className="italic truncate max-w-[180px]">"{tpl.brand_voice}"</span>
                    )}
                    <span className="ml-auto">
                      {t('updatedAt', { date: new Date(tpl.updated_at).toLocaleDateString('pt-BR') })}
                    </span>
                  </div>
                </Link>

                {/* Actions menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActionId(actionId === tpl.id ? null : tpl.id)}
                    disabled={busyId === tpl.id}
                    className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-40"
                  >
                    {busyId === tpl.id ? <Loader2 size={14} className="animate-spin" /> : <MoreVertical size={14} />}
                  </button>
                  {actionId === tpl.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setActionId(null)} />
                      <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl z-20 overflow-hidden">
                        <ActionItem icon={<Edit3 size={11} />} label={t('actionEdit')} onClick={() => router.push(`/dashboard/creative/templates/${tpl.id}`)} />
                        <ActionItem icon={<Copy size={11} />}  label={t('actionClone')}  onClick={() => handleClone(tpl.id)} />
                        {!tpl.is_default && (
                          <ActionItem icon={<Star size={11} />} label={t('actionSetDefault')} onClick={() => handleSetDefault(tpl.id)} />
                        )}
                        <ActionItem
                          icon={<Trash2 size={11} />}
                          label={t('actionDelete')}
                          danger
                          disabled={tpl.is_default}
                          onClick={() => handleDelete(tpl.id, tpl.name, tpl.is_default)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionItem({
  icon, label, onClick, danger, disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
        danger ? 'text-red-300 hover:bg-red-500/10' : 'text-zinc-300 hover:bg-zinc-900',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  )
}
