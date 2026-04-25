'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import {
  ImageIcon, Upload, Search, Copy, Trash2, ExternalLink,
  RefreshCw, Grid3x3, List, CheckSquare, Square, X,
} from 'lucide-react'

const BUCKET = 'produtos'

// ── Types ─────────────────────────────────────────────────────────────────────

type MediaItem = {
  url: string
  path: string
  name: string
  productId: string | null
  productName: string | null
  productHref: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STORAGE_MARKER = `/storage/v1/object/public/${BUCKET}/`

function urlToPath(url: string): string | null {
  const idx = url.indexOf(STORAGE_MARKER)
  return idx === -1 ? null : url.slice(idx + STORAGE_MARKER.length)
}

function basename(path: string) {
  return path.split('/').pop() ?? path
}

function isImage(url: string) {
  return /\.(jpe?g|png|webp|gif|svg|avif)(\?|$)/i.test(url)
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadZone({ onUploaded }: { onUploaded: (urls: string[]) => void }) {
  const [dragging,  setDragging]  = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err,       setErr]       = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(files: File[]) {
    if (files.length === 0) return
    setUploading(true)
    setErr('')
    const sb = createClient()
    const uploaded: string[] = []
    const failed: string[] = []

    await Promise.all(files.map(async file => {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `biblioteca/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
      if (error) { failed.push(file.name); return }
      const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)
      uploaded.push(pub.publicUrl)
    }))

    setUploading(false)
    if (failed.length > 0) setErr(`Falha ao enviar: ${failed.join(', ')}`)
    if (uploaded.length > 0) onUploaded(uploaded)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); upload(Array.from(e.dataTransfer.files)) }}
      onClick={() => inputRef.current?.click()}
      className="relative flex flex-col items-center justify-center gap-2 rounded-2xl py-8 cursor-pointer transition-all"
      style={{
        border: `2px dashed ${dragging ? '#00E5FF' : '#2e2e33'}`,
        background: dragging ? 'rgba(0,229,255,0.04)' : '#111114',
      }}>
      <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden"
        onChange={e => upload(Array.from(e.target.files ?? []))} />
      {uploading
        ? <RefreshCw size={20} className="text-zinc-500 animate-spin" />
        : <Upload size={20} style={{ color: dragging ? '#00E5FF' : '#52525b' }} />
      }
      <p className="text-xs font-medium" style={{ color: dragging ? '#00E5FF' : '#71717a' }}>
        {uploading ? 'Enviando…' : 'Arraste arquivos ou clique para selecionar'}
      </p>
      <p className="text-[10px] text-zinc-600">JPG, PNG, WEBP, GIF, MP4</p>
      {err && <p className="text-[10px] text-red-400 mt-1">{err}</p>}
    </div>
  )
}

// ── Media card ────────────────────────────────────────────────────────────────

function MediaCard({
  item, selected, onSelect, onCopy, onDelete,
}: {
  item: MediaItem
  selected: boolean
  onSelect: () => void
  onCopy: () => void
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(item.url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    onCopy()
  }

  return (
    <div className="group relative rounded-2xl overflow-hidden transition-all"
      style={{ background: '#111114', border: `1px solid ${selected ? '#00E5FF' : '#1e1e24'}` }}>

      {/* Selection toggle */}
      <button onClick={onSelect}
        className="absolute top-2 left-2 z-10 transition-opacity"
        style={{ opacity: selected ? 1 : 0 }}
        onMouseEnter={e => { (e.currentTarget.parentElement as HTMLElement).querySelector<HTMLElement>('.sel-btn')!.style.opacity = '1' }}>
        <span className="sel-btn" style={{ opacity: selected ? 1 : 0 }}>
          {selected
            ? <CheckSquare size={15} style={{ color: '#00E5FF' }} />
            : <Square size={15} style={{ color: '#71717a' }} />
          }
        </span>
      </button>

      {/* Thumbnail */}
      <div className="relative aspect-square bg-zinc-900 overflow-hidden cursor-pointer" onClick={onSelect}>
        {isImage(item.url)
          ? <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={28} className="text-zinc-600" /></div>
        }
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button onClick={e => { e.stopPropagation(); handleCopy() }}
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: copied ? 'rgba(0,229,255,0.2)' : 'rgba(0,0,0,0.6)' }}
            title="Copiar URL">
            <Copy size={12} style={{ color: copied ? '#00E5FF' : '#e4e4e7' }} />
          </button>
          <a href={item.url} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-1.5 rounded-lg transition-colors" style={{ background: 'rgba(0,0,0,0.6)' }}
            title="Abrir em nova aba">
            <ExternalLink size={12} className="text-zinc-200" />
          </a>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg transition-colors" style={{ background: 'rgba(0,0,0,0.6)' }}
            title="Excluir">
            <Trash2 size={12} className="text-red-400" />
          </button>
        </div>
        {/* Selection overlay */}
        <button className="absolute top-2 left-2 transition-opacity group-hover:opacity-100"
          style={{ opacity: selected ? 1 : 0 }}
          onClick={e => { e.stopPropagation(); onSelect() }}>
          {selected
            ? <CheckSquare size={15} style={{ color: '#00E5FF' }} />
            : <Square size={15} style={{ color: '#fff' }} />
          }
        </button>
      </div>

      {/* Info */}
      <div className="px-2.5 py-2">
        <p className="text-[10px] font-medium text-zinc-300 truncate" title={item.name}>{item.name}</p>
        {item.productName && (
          <a href={item.productHref ?? '#'} className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors truncate block mt-0.5">
            {item.productName}
          </a>
        )}
        {!item.productName && (
          <p className="text-[9px] text-zinc-600 mt-0.5">Biblioteca</p>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BibliotecaPage() {
  const [items,    setItems]    = useState<MediaItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [query,    setQuery]    = useState('')
  const [view,     setView]     = useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()

    // Fetch all products with their photo_urls
    const { data: prods } = await sb
      .from('products')
      .select('id, ml_title, photo_urls')
      .not('photo_urls', 'is', null)
      .order('created_at', { ascending: false })

    const seen = new Set<string>()
    const result: MediaItem[] = []

    for (const prod of (prods ?? [])) {
      const urls: string[] = Array.isArray(prod.photo_urls) ? prod.photo_urls : []
      for (const url of urls) {
        if (!url || seen.has(url)) continue
        seen.add(url)
        const path = urlToPath(url) ?? url
        result.push({
          url,
          path,
          name:        basename(path),
          productId:   prod.id,
          productName: prod.ml_title ?? null,
          productHref: `/dashboard/produtos/${prod.id}/editar`,
        })
      }
    }

    // Also list biblioteca/ folder for standalone uploads
    try {
      const { data: storageFiles } = await sb.storage.from(BUCKET).list('biblioteca', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
      for (const f of (storageFiles ?? [])) {
        if (f.name === '.emptyFolderPlaceholder') continue
        const path = `biblioteca/${f.name}`
        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)
        const url = pub.publicUrl
        if (!url || seen.has(url)) continue
        seen.add(url)
        result.push({ url, path, name: f.name, productId: null, productName: null, productHref: null })
      }
    } catch { /* storage folder may not exist yet */ }

    setItems(result)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function deleteSelected() {
    if (!confirm(`Excluir ${selected.size} arquivo(s)? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    const sb = createClient()
    const toDelete = items.filter(i => selected.has(i.url))
    const paths = toDelete.map(i => i.path).filter(Boolean)

    if (paths.length > 0) {
      await sb.storage.from(BUCKET).remove(paths)
    }

    setItems(prev => prev.filter(i => !selected.has(i.url)))
    setSelected(new Set())
    setDeleting(false)
  }

  function handleUploaded(urls: string[]) {
    const newItems: MediaItem[] = urls.map(url => ({
      url,
      path:        urlToPath(url) ?? url,
      name:        basename(urlToPath(url) ?? url),
      productId:   null,
      productName: null,
      productHref: null,
    }))
    setItems(prev => [...newItems, ...prev])
  }

  function toggleSelect(url: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map(i => i.url)))
  }
  function clearSelection() { setSelected(new Set()) }

  const filtered = items.filter(i =>
    !query.trim() ||
    i.name.toLowerCase().includes(query.toLowerCase()) ||
    (i.productName ?? '').toLowerCase().includes(query.toLowerCase())
  )

  const imgCount = filtered.filter(i => isImage(i.url)).length

  return (
    <div className="p-6 space-y-5 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Produção</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Biblioteca de Mídias</h2>
          <p className="text-zinc-500 text-xs mt-1">
            {loading ? 'Carregando…' : `${items.length} arquivo${items.length !== 1 ? 's' : ''} · ${imgCount} imagem${imgCount !== 1 ? 'ns' : ''}`}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Upload zone */}
      <UploadZone onUploaded={handleUploaded} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-48 px-3 py-2 rounded-xl"
          style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <Search size={13} className="text-zinc-600 shrink-0" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome ou produto…"
            className="bg-transparent text-xs text-zinc-300 outline-none flex-1 placeholder-zinc-600"
          />
          {query && <button onClick={() => setQuery('')}><X size={12} className="text-zinc-600 hover:text-zinc-300" /></button>}
        </div>

        {/* View toggle */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #1e1e24' }}>
          {(['grid', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-3 py-2 transition-colors"
              style={{ background: view === v ? 'rgba(0,229,255,0.1)' : '#111114', color: view === v ? '#00E5FF' : '#52525b' }}>
              {v === 'grid' ? <Grid3x3 size={13} /> : <List size={13} />}
            </button>
          ))}
        </div>

        {/* Selection actions */}
        {selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">{selected.size} selecionado{selected.size !== 1 ? 's' : ''}</span>
            <button onClick={clearSelection} className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg transition-colors"
              style={{ border: '1px solid #2e2e33' }}>
              Limpar
            </button>
            <button onClick={deleteSelected} disabled={deleting}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
              <Trash2 size={11} />
              {deleting ? 'Excluindo…' : 'Excluir'}
            </button>
          </div>
        ) : (
          filtered.length > 0 && (
            <button onClick={selectAll}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg transition-colors"
              style={{ border: '1px solid #2e2e33' }}>
              <CheckSquare size={11} />
              Selecionar tudo
            </button>
          )
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600 text-xs">Carregando biblioteca…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ImageIcon size={32} className="text-zinc-700" />
          <p className="text-sm text-zinc-500">{query ? 'Nenhum arquivo encontrado' : 'Biblioteca vazia'}</p>
          <p className="text-xs text-zinc-600">
            {query ? 'Tente outro termo de busca.' : 'Faça upload de arquivos ou adicione fotos a produtos.'}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {filtered.map(item => (
            <MediaCard
              key={item.url}
              item={item}
              selected={selected.has(item.url)}
              onSelect={() => toggleSelect(item.url)}
              onCopy={() => {}}
              onDelete={() => {
                if (!confirm('Excluir este arquivo?')) return
                const sb = createClient()
                sb.storage.from(BUCKET).remove([item.path]).catch(() => {})
                setItems(prev => prev.filter(i => i.url !== item.url))
                setSelected(prev => { const n = new Set(prev); n.delete(item.url); return n })
              }}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          {filtered.map((item, idx) => (
            <div key={item.url}
              className="flex items-center gap-3 px-4 py-3 transition-colors"
              style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #1e1e24' : undefined, background: selected.has(item.url) ? 'rgba(0,229,255,0.04)' : 'transparent' }}>
              <button onClick={() => toggleSelect(item.url)}>
                {selected.has(item.url)
                  ? <CheckSquare size={14} style={{ color: '#00E5FF' }} />
                  : <Square size={14} className="text-zinc-600" />
                }
              </button>
              {isImage(item.url)
                ? <img src={item.url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" loading="lazy" />
                : <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#1e1e24' }}><ImageIcon size={13} className="text-zinc-500" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-200 truncate">{item.name}</p>
                {item.productName && <p className="text-[10px] text-zinc-500 truncate">{item.productName}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => { navigator.clipboard.writeText(item.url).catch(() => {}) }}
                  className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Copiar URL">
                  <Copy size={12} className="text-zinc-500" />
                </button>
                {item.productHref && (
                  <a href={item.productHref} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Ver produto">
                    <ExternalLink size={12} className="text-zinc-500" />
                  </a>
                )}
                <button
                  onClick={() => {
                    if (!confirm('Excluir este arquivo?')) return
                    const sb = createClient()
                    sb.storage.from(BUCKET).remove([item.path]).catch(() => {})
                    setItems(prev => prev.filter(i => i.url !== item.url))
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Excluir">
                  <Trash2 size={12} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
