'use client'

/**
 * Panel inline de references por slot — substitui o modal-only do ReferenceSelector.
 *
 * Render:
 *   - Grid 4 col (responsivo) com thumbnails das refs já vinculadas (use_reference_ids)
 *   - Drop-zone retangular no fim do grid pra arrastar arquivos OU clicar e selecionar
 *   - Botão "Buscar da galeria" abre modal multiselect (reusa estética do ReferenceSelector)
 *   - Botão X no hover de cada thumb pra desvincular
 *
 * Upload flow (igual /references/page.tsx):
 *   1. issueReferenceUploadUrl
 *   2. PUT direto pro Storage (XHR com progress)
 *   3. createReference com tag automática `slot:N` + nome do arquivo
 *   4. Append ref.id em use_reference_ids
 *
 * Limit visual recomendado: 10 refs por slot (não bloqueamos, só warning).
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, Library, X, Loader2, AlertTriangle, Plus } from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { CreativeReference } from '@/components/creative/types'

const SOFT_LIMIT = 10

export default function SlotReferencesPanel({
  positionNumber,
  positionName,
  value,
  onChange,
  disabled,
}: {
  positionNumber: number
  positionName:   string
  value:          string[]            // use_reference_ids
  onChange:       (next: string[]) => void
  disabled?:      boolean
}) {
  const t = useTranslations('creative.templates')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [thumbs, setThumbs] = useState<CreativeReference[]>([])
  const [uploads, setUploads] = useState<Array<{ id: string; name: string; progress: number; error?: string }>>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [thumbsLoading, setThumbsLoading] = useState(false)

  // Carrega thumbnails das refs vinculadas
  useEffect(() => {
    if (value.length === 0) { setThumbs([]); return }
    let cancelled = false
    setThumbsLoading(true)
    void CreativeApi.listReferences({ include_curated: true, limit: 200 })
      .then(all => {
        if (cancelled) return
        const ordered = value
          .map(id => all.find(r => r.id === id))
          .filter((r): r is CreativeReference => Boolean(r))
        setThumbs(ordered)
      })
      .catch(() => { /* silent */ })
      .finally(() => { if (!cancelled) setThumbsLoading(false) })
    return () => { cancelled = true }
  }, [value])

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return
    const cleaned = files.filter(f =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
    )
    if (cleaned.length === 0) return

    const queue = cleaned.map(f => ({
      id:       `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 6)}`,
      name:     f.name,
      progress: 0,
    }))
    setUploads(prev => [...prev, ...queue])

    const createdIds: string[] = []
    for (let i = 0; i < cleaned.length; i++) {
      const file = cleaned[i]
      const item = queue[i]
      try {
        const upload = await CreativeApi.issueReferenceUploadUrl({
          filename:   file.name,
          mime_type:  file.type as 'image/jpeg' | 'image/png' | 'image/webp',
          size_bytes: file.size,
        })
        await putWithProgress(upload.upload_url, file, pct => {
          setUploads(prev => prev.map(u => u.id === item.id ? { ...u, progress: Math.max(5, pct) } : u))
        })
        const created = await CreativeApi.createReference({
          storage_path:          upload.storage_path,
          name:                  file.name.replace(/\.[^.]+$/, ''),
          tags:                  [`slot:${positionNumber}`, normalizeSlotTag(positionName)],
          category_ml_ids:       [],
          default_for_positions: [positionNumber],
          size_bytes:            file.size,
          mime_type:             file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        })
        createdIds.push(created.id)
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, progress: 100 } : u))
        setTimeout(() => setUploads(prev => prev.filter(u => u.id !== item.id)), 1500)
      } catch (e) {
        setUploads(prev => prev.map(u => u.id === item.id
          ? { ...u, error: (e as Error).message } : u))
      }
    }

    if (createdIds.length > 0) {
      const next = [...value, ...createdIds.filter(id => !value.includes(id))]
      onChange(next)
    }
  }

  const remove = (id: string) => {
    onChange(value.filter(x => x !== id))
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDropActive(true)
  }
  const onDragLeave = () => setDropActive(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDropActive(false)
    void handleFiles(Array.from(e.dataTransfer.files))
  }

  const overSoftLimit = value.length > SOFT_LIMIT

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="block text-[10px] uppercase tracking-wider text-zinc-500">
          {t('visualRefs', { count: value.length, max: SOFT_LIMIT })}
        </label>
        {overSoftLimit && (
          <span className="inline-flex items-center gap-1 text-[9px] text-amber-300">
            <AlertTriangle size={9} /> {t('tooManyRefs', { max: SOFT_LIMIT })}
          </span>
        )}
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          'rounded-lg border-2 border-dashed transition-colors p-2',
          dropActive ? 'border-cyan-400 bg-cyan-400/5' : 'border-zinc-800 bg-zinc-950',
        ].join(' ')}
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {/* Thumbnails das refs vinculadas */}
          {thumbs.map(r => (
            <div key={r.id} className="group relative aspect-square rounded-md overflow-hidden bg-zinc-900 border border-zinc-800">
              {r.signed_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.signed_url} alt={r.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                  <Library size={20} />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1 py-0.5">
                <p className="text-[9px] text-zinc-100 truncate">{r.name}</p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title={t('desvincular')}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}

          {/* Skeleton enquanto carrega thumbs */}
          {thumbsLoading && value.length > 0 && thumbs.length === 0 && (
            Array.from({ length: Math.min(value.length, 5) }).map((_, i) => (
              <div key={`sk-${i}`} className="aspect-square rounded-md bg-zinc-900 animate-pulse" />
            ))
          )}

          {/* Uploads em progresso */}
          {uploads.map(u => (
            <div key={u.id} className="aspect-square rounded-md bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center gap-1 px-1">
              {u.error ? (
                <>
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-[8px] text-red-300 text-center line-clamp-2 leading-tight">{u.error.slice(0, 40)}</span>
                </>
              ) : (
                <>
                  <Loader2 size={16} className="text-cyan-400 animate-spin" />
                  <span className="text-[9px] text-zinc-400">{u.progress}%</span>
                  <span className="text-[8px] text-zinc-600 truncate w-full text-center">{u.name.slice(0, 14)}</span>
                </>
              )}
            </div>
          ))}

          {/* Drop zone trigger */}
          {!disabled && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-md border border-dashed border-zinc-700 hover:border-cyan-400/60 hover:bg-cyan-400/5 transition-colors flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-cyan-300"
              title={t('uploadImagesTooltip')}
            >
              <Upload size={16} />
              <span className="text-[9px]">{t('uploadShort')}</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={e => {
            if (!e.target.files) return
            void handleFiles(Array.from(e.target.files))
            e.target.value = ''
          }}
        />

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] text-zinc-500">
            {t('dropHint')}<span className="text-zinc-400">{t('uploadWord')}</span>{t('dropHintSuffix')}
          </p>
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 hover:border-cyan-400/40 text-cyan-400 text-[10px] transition-colors disabled:opacity-40"
          >
            <Plus size={10} /> {t('fromGallery')}
          </button>
        </div>
      </div>

      {galleryOpen && (
        <GalleryPickerModal
          selectedIds={value}
          onClose={() => setGalleryOpen(false)}
          onApply={ids => {
            onChange(ids)
            setGalleryOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ── Gallery picker modal ────────────────────────────────────────────────────

function GalleryPickerModal({
  selectedIds,
  onClose,
  onApply,
}: {
  selectedIds: string[]
  onClose:     () => void
  onApply:     (next: string[]) => void
}) {
  const t = useTranslations('creative.templates')
  const [refs, setRefs] = useState<CreativeReference[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [local, setLocal] = useState<string[]>(selectedIds)

  useEffect(() => {
    setLoading(true)
    setError(null)
    void CreativeApi.listReferences({ search, include_curated: true, limit: 200 })
      .then(list => setRefs(list))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [search])

  const toggle = (id: string) => {
    setLocal(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Library size={14} className="text-cyan-400" />
            <h3 className="text-sm font-semibold">{t('galleryRefsTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-zinc-800">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchByNameTagEllipsis')}
            className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && <p className="text-xs text-zinc-500">{t('loading')}</p>}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>
          )}
          {!loading && !error && refs.length === 0 && (
            <p className="text-center text-xs text-zinc-500 py-8">{t('noRefsFound')}</p>
          )}
          {!loading && refs.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {refs.map(r => {
                const selected = local.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(r.id)}
                    className={[
                      'group relative rounded-md overflow-hidden border-2 transition-all aspect-square',
                      selected ? 'border-cyan-400 ring-2 ring-cyan-400/30' : 'border-zinc-800 hover:border-zinc-700',
                    ].join(' ')}
                  >
                    {r.signed_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={r.signed_url} alt={r.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-900">
                        <Library size={20} />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1">
                      <p className="text-[9px] text-zinc-100 truncate">{r.name}</p>
                    </div>
                    {selected && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-cyan-400 text-black text-[10px] font-bold flex items-center justify-center">
                        ✓
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">{t('selectedCountFem', { count: local.length })}</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => onApply(local)}
              className="px-3 py-1.5 rounded-md bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-semibold"
            >
              {t('apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeSlotTag(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')   // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'slot'
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`upload PUT ${xhr.status}`))
    })
    xhr.addEventListener('error', () => reject(new Error('upload PUT: network error')))
    xhr.addEventListener('abort', () => reject(new Error('upload PUT: cancelado')))
    xhr.send(file)
  })
}
