'use client'

/**
 * F6 Sprint 2 — Fase 2.5
 * Galeria de referências em /dashboard/creative/references.
 *
 * Fluxo de upload (signed URL):
 *   1. POST /creative/references/upload-url → { upload_url, storage_path }
 *   2. PUT upload_url (com File) → Storage
 *   3. POST /creative/references { storage_path, name, ... } → cria row
 *   4. Drawer abre na 1ª ref criada pra enriquecer metadata
 *
 * Frontend NUNCA passa o arquivo binário pelo backend NestJS — o PUT vai
 * direto pro Supabase Storage usando a signed URL.
 *
 * State: refs[], selected Set<id>, busy Set<id>, uploadQueue[], editingRef,
 * filters. Refetch a cada mudança de filtros.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ImageIcon, Upload, AlertTriangle, Loader2 } from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { CreativeReference } from '@/components/creative/types'
import { useConfirm } from '@/components/ui/dialog-provider'
import EmptyReferencesState from './_components/EmptyReferencesState'
import UploadDropZone from './_components/UploadDropZone'
import UploadProgressList, { type UploadItem } from './_components/UploadProgressList'
import ReferenceFilters, { EMPTY_FILTERS, type FilterState } from './_components/ReferenceFilters'
import ReferencesGrid from './_components/ReferencesGrid'
import BulkActionsBar from './_components/BulkActionsBar'
import ReferenceEditorDrawer from './_components/ReferenceEditorDrawer'

export default function ReferencesPage() {
  const t = useTranslations('creative.references')
  const [refs, setRefs]                   = useState<CreativeReference[]>([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState<string | null>(null)
  const [filters, setFilters]             = useState<FilterState>(EMPTY_FILTERS)
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  const [busy, setBusy]                   = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy]           = useState(false)
  const [uploads, setUploads]             = useState<UploadItem[]>([])
  const [editingRef, setEditingRef]       = useState<CreativeReference | null>(null)
  const [drawerBusy, setDrawerBusy]       = useState(false)
  const [showDropZone, setShowDropZone]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const confirmDialog = useConfirm()

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await CreativeApi.listReferences({
        search:           filters.search || undefined,
        tags:             filters.tag ? [filters.tag] : undefined,
        category_ml_id:   filters.category_ml_id || undefined,
        product_type:     filters.product_type || undefined,
        ambient:          filters.ambient || undefined,
        include_curated:  !filters.only_curated, // default: ambos. Se only_curated, listamos via endpoint dedicado abaixo
        include_inactive: filters.include_inactive,
        limit:            200,
      })

      if (filters.only_curated) {
        // Override: usa endpoint /curated quando user pediu só curadas
        const curated = await CreativeApi.listCuratedReferences(200)
        setRefs(curated.filter(r =>
          (!filters.include_inactive ? r.is_active : true)
          && (!filters.search || matchSearch(r, filters.search))
          && (!filters.tag || r.tags.includes(filters.tag))
          && (!filters.category_ml_id || r.category_ml_ids.includes(filters.category_ml_id))
          && (!filters.product_type || r.product_type === filters.product_type)
          && (!filters.ambient || r.ambient === filters.ambient),
        ))
      } else {
        setRefs(list)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { void load() }, [load])

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  // Curated nunca selecionável (cards bloqueiam), mas dupla checagem aqui
  const selectedRefs = useMemo(
    () => refs.filter(r => selected.has(r.id) && !r.is_curated),
    [refs, selected],
  )
  const curatedInSelection = useMemo(
    () => refs.filter(r => selected.has(r.id) && r.is_curated).length,
    [refs, selected],
  )

  // ── Counters (pra ReferenceFilters) ───────────────────────────────────────

  const totalCount    = refs.length
  const activeCount   = refs.filter(r => r.is_active).length
  const inactiveCount = refs.filter(r => !r.is_active).length

  // ── Upload flow ───────────────────────────────────────────────────────────

  const handleFilesAccepted = async (files: File[]) => {
    // 1. Cria UploadItem por arquivo
    const queue: UploadItem[] = files.map(f => ({
      id:        crypto.randomUUID(),
      file_name: f.name,
      status:    'pending',
      progress:  0,
    }))
    setUploads(prev => [...prev, ...queue])

    // 2. Processa um por vez (linear) pra não estourar quota
    const created: CreativeReference[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const item = queue[i]
      try {
        // 2a. Pede signed URL
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'uploading', progress: 5 } : u))
        const upload = await CreativeApi.issueReferenceUploadUrl({
          filename:   file.name,
          mime_type:  file.type as 'image/jpeg' | 'image/png' | 'image/webp',
          size_bytes: file.size,
        })

        // 2b. PUT direto pro Storage. Usa XHR pra ter onUploadProgress real.
        await putWithProgress(upload.upload_url, file, pct => {
          setUploads(prev => prev.map(u =>
            u.id === item.id ? { ...u, progress: Math.max(5, pct) } : u,
          ))
        })

        // 2c. Grava metadata
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'creating', progress: 95 } : u))
        const ref = await CreativeApi.createReference({
          storage_path: upload.storage_path,
          name:         file.name.replace(/\.[^.]+$/, ''),
          tags:         [],
          category_ml_ids:       [],
          default_for_positions: [],
          size_bytes: file.size,
          mime_type:  file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        })
        created.push(ref)

        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'done', progress: 100 } : u))
        // Some após 2s
        setTimeout(() => setUploads(prev => prev.filter(u => u.id !== item.id)), 2000)
      } catch (e) {
        const msg = (e as Error).message
        setUploads(prev => prev.map(u =>
          u.id === item.id ? { ...u, status: 'error', error: msg } : u,
        ))
      }
    }

    // 3. Refetch + abre drawer no primeiro criado
    await load()
    if (created.length > 0) {
      setEditingRef(created[0])
    }
    setShowDropZone(false)
  }

  // ── Single actions (singular) ────────────────────────────────────────────

  const markBusy = (id: string, on: boolean) => {
    setBusy(prev => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })
  }

  const handleToggleActive = async (ref: CreativeReference) => {
    if (ref.is_curated) return
    markBusy(ref.id, true)
    try {
      await CreativeApi.toggleReferenceActive(ref.id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      markBusy(ref.id, false)
    }
  }

  const handleDelete = async (ref: CreativeReference) => {
    if (ref.is_curated) return
    const ok = await confirmDialog({
      title:        t('deleteRefTitle'),
      message:      t('deleteRefMessage', { name: ref.name }),
      confirmLabel: t('delete'),
      variant:      'danger',
    })
    if (!ok) return
    markBusy(ref.id, true)
    try {
      await CreativeApi.deleteReference(ref.id)
      setSelected(prev => { const n = new Set(prev); n.delete(ref.id); return n })
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      markBusy(ref.id, false)
    }
  }

  // ── Drawer save/delete ────────────────────────────────────────────────────

  const handleDrawerSave = async (
    id: string,
    patch: Parameters<typeof CreativeApi.updateReference>[1],
  ) => {
    setDrawerBusy(true)
    try {
      await CreativeApi.updateReference(id, patch)
      await load()
      setEditingRef(null)
    } finally {
      setDrawerBusy(false)
    }
  }

  const handleDrawerDelete = async (id: string) => {
    setDrawerBusy(true)
    try {
      await CreativeApi.deleteReference(id)
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
      await load()
      setEditingRef(null)
    } finally {
      setDrawerBusy(false)
    }
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  const handleBulkActivate = async () => {
    if (selectedRefs.length === 0) return
    setBulkBusy(true)
    try {
      await CreativeApi.bulkToggleReferenceActive(selectedRefs.map(r => r.id), true)
      await load()
      clearSelection()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkDeactivate = async () => {
    if (selectedRefs.length === 0) return
    setBulkBusy(true)
    try {
      await CreativeApi.bulkToggleReferenceActive(selectedRefs.map(r => r.id), false)
      await load()
      clearSelection()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedRefs.length === 0) return
    const ok = await confirmDialog({
      title:   t('bulkDeleteTitle', { count: selectedRefs.length }),
      message: (
        <div>
          <p className="mb-2">{t('bulkDeleteMessage')}</p>
          <ul className="text-xs text-zinc-400 space-y-0.5 max-h-40 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/50 p-2">
            {selectedRefs.map(r => (
              <li key={r.id} className="truncate" title={r.name}>· {r.name}</li>
            ))}
          </ul>
        </div>
      ),
      confirmLabel: t('bulkDeleteConfirm', { count: selectedRefs.length }),
      variant:      'danger',
    })
    if (!ok) return
    setBulkBusy(true)
    try {
      await CreativeApi.bulkDeleteReferences(selectedRefs.map(r => r.id))
      await load()
      clearSelection()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBulkBusy(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const showEmpty = !loading && refs.length === 0 && !hasAnyFilter(filters) && uploads.length === 0

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-cyan-400" />
            <div>
              <h1 className="text-lg font-semibold">{t('title')}</h1>
              <p className="text-[11px] text-zinc-500">
                {t('subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowDropZone(true)
              // Pequeno delay pro DOM montar o input antes do click
              setTimeout(() => fileInputRef.current?.click(), 50)
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold transition-colors"
          >
            <Upload size={14} /> {t('uploadImages')}
          </button>
        </div>

        {/* Drop zone (sempre quando ativada OU quando empty) */}
        {(showDropZone || showEmpty) && (
          <div className="mb-4">
            <UploadDropZone onFilesAccepted={handleFilesAccepted} inputRef={fileInputRef} />
          </div>
        )}

        {/* Upload progress */}
        {uploads.length > 0 && (
          <div className="mb-4">
            <UploadProgressList items={uploads} />
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100">
              ✕
            </button>
          </div>
        )}

        {/* Empty global (sem refs E sem filtros) */}
        {showEmpty ? (
          <EmptyReferencesState
            onUploadClick={() => {
              setShowDropZone(true)
              setTimeout(() => fileInputRef.current?.click(), 50)
            }}
            onShowCurated={() => {
              setFilters({ ...EMPTY_FILTERS, only_curated: true })
              setShowDropZone(false)
            }}
          />
        ) : (
          <div className="space-y-4">
            {/* Filtros */}
            <ReferenceFilters
              value={filters}
              onChange={setFilters}
              totalCount={totalCount}
              activeCount={activeCount}
              inactiveCount={inactiveCount}
            />

            {/* Grid */}
            <ReferencesGrid
              loading={loading}
              references={refs}
              selectedIds={selected}
              busyIds={busy}
              onToggleSelect={toggleSelect}
              onEdit={ref => setEditingRef(ref)}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          </div>
        )}

        {/* Loading global (overlay leve quando refs já carregadas + recarrega) */}
        {loading && refs.length > 0 && (
          <div className="fixed top-3 right-3 z-30 flex items-center gap-1.5 text-xs text-cyan-300 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 shadow-lg">
            <Loader2 size={12} className="animate-spin" /> {t('updating')}
          </div>
        )}
      </div>

      {/* Bulk floating bar */}
      <BulkActionsBar
        count={selected.size}
        curatedInSelection={curatedInSelection}
        busy={bulkBusy}
        onActivate={handleBulkActivate}
        onDeactivate={handleBulkDeactivate}
        onDelete={handleBulkDelete}
        onClear={clearSelection}
      />

      {/* Drawer */}
      <ReferenceEditorDrawer
        open={editingRef !== null}
        reference={editingRef}
        onClose={() => setEditingRef(null)}
        onSave={handleDrawerSave}
        onDelete={handleDrawerDelete}
        busy={drawerBusy}
      />
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function hasAnyFilter(f: FilterState): boolean {
  return !!f.search || !!f.tag || !!f.category_ml_id || !!f.product_type
    || !!f.ambient || f.only_curated || f.include_inactive
}

function matchSearch(r: CreativeReference, q: string): boolean {
  const s = q.toLowerCase()
  return r.name.toLowerCase().includes(s)
    || (r.description?.toLowerCase().includes(s) ?? false)
}

/**
 * PUT com onProgress via XMLHttpRequest. fetch() não expõe upload progress,
 * então é XHR mesmo. signed URL do Supabase aceita PUT sem auth header.
 */
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`upload PUT ${xhr.status}: ${xhr.responseText?.slice(0, 200) ?? ''}`))
    })
    xhr.addEventListener('error', () => reject(new Error('upload PUT: network error')))
    xhr.addEventListener('abort', () => reject(new Error('upload PUT: cancelado')))
    xhr.send(file)
  })
}
