'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Search, X, Image as ImageIcon, Edit3, ExternalLink, ChevronDown, Loader2, AlertTriangle, Package, Link as LinkIcon } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ────────────────────────────────────────────────────────────────────

export type ProductSource = 'catalog' | 'ml' | 'shopee' | 'manual'

export interface ProductData {
  source:         ProductSource
  title:          string
  price:          number
  sale_price?:    number
  image_url?:     string
  url?:           string
  catalog_id?:    string
  ml_listing_id?: string
  all_images?:    string[]
}

interface CatalogResult {
  id:        string
  title:     string
  price:     number
  image_url?: string
}

interface ImportResponse {
  title:        string | null
  price:        number | null
  sale_price:   number | null
  image_url:    string | null
  all_images:   string[]
  url:          string | null
  platform:     string
  listing_id:   string | null
}

interface Props {
  value:    ProductData | null
  onChange: (product: ProductData | null) => void
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function token(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token()
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`[${res.status}] ${(body as { message?: string; error?: string })?.message ?? (body as { error?: string })?.error ?? 'erro'}`)
  }
  return (await res.json()) as T
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SmartProductInput({ value, onChange }: Props) {
  const [mode, setMode]             = useState<'catalog' | 'url'>('catalog')
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<CatalogResult[]>([])
  const [isImporting, setImporting] = useState(false)
  const [isSearching, setSearching] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showGallery, setGallery]   = useState(false)
  const [galleryImgs, setGalleryImgs] = useState<string[]>([])
  const [showEdit, setShowEdit]     = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function switchMode(m: 'catalog' | 'url') {
    setMode(m)
    setQuery('')
    setError(null)
    setResults([])
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!query.trim() || value) {
      setResults([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (mode === 'catalog') {
      // Sempre busca catálogo Vazzo, sem detectar URL
      debounceRef.current = setTimeout(() => handleSearch(query.trim()), 300)
    } else {
      // URL só dispara import se for http(s)://
      const isUrl = /^https?:\/\//i.test(query.trim())
      if (isUrl) {
        debounceRef.current = setTimeout(() => handleImportUrl(query.trim()), 800)
      }
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, value, mode])

  // Quando seleciona um produto com listing ML, pré-carrega galeria sob demanda
  useEffect(() => {
    if (showGallery && value?.ml_listing_id && galleryImgs.length === 0) {
      api<{ all_images: string[] }>(`/campaigns/listing-images?listing_id=${encodeURIComponent(value.ml_listing_id)}`)
        .then(r => setGalleryImgs(r.all_images ?? []))
        .catch(e => setError((e as Error).message))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGallery, value?.ml_listing_id])

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSearch(q: string) {
    setSearching(true)
    setError(null)
    try {
      const r = await api<{ results: CatalogResult[] }>(`/campaigns/products/search?q=${encodeURIComponent(q)}&limit=10`)
      setResults(r.results ?? [])
    } catch (e) {
      setError((e as Error).message)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  async function handleImportUrl(url: string) {
    setImporting(true)
    setError(null)
    try {
      const r = await api<ImportResponse>('/campaigns/import-from-url', {
        method: 'POST',
        body:   JSON.stringify({ url }),
      })
      // Validação semântica — backend pode retornar 200 com shape vazia
      // (PolicyAgent ML, anúncio removido). Aceitamos price=null pra
      // suportar catálogo ML (MLBU), que nem sempre tem buy_box price.
      if (!r.title) {
        throw new Error('O anúncio não retornou dados (pode estar privado, removido ou bloqueado pela plataforma).')
      }
      const source: ProductSource = r.platform === 'mercadolivre' ? 'ml'
                                  : r.platform === 'shopee'       ? 'shopee'
                                  : 'manual'
      onChange({
        source,
        title:         r.title,
        price:         r.price ?? 0,
        sale_price:    r.sale_price ?? undefined,
        image_url:     r.image_url ?? undefined,
        url:           r.url ?? url,
        ml_listing_id: source === 'ml' ? (r.listing_id ?? undefined) : undefined,
        all_images:    r.all_images,
      })
      setQuery('')
    } catch (e) {
      setError((e as Error).message || 'Não foi possível importar a URL.')
    } finally {
      setImporting(false)
    }
  }

  function handleStartManual() {
    onChange({
      source: 'manual',
      title:  '',
      price:  0,
      url:    query || undefined,
    })
    setShowEdit(true)
    setQuery('')
    setError(null)
  }

  function handleRetryUrl() {
    setError(null)
    setQuery('')
  }

  function handleSelectCatalog(item: CatalogResult) {
    onChange({
      source:     'catalog',
      title:      item.title,
      price:      item.price,
      image_url:  item.image_url,
      catalog_id: item.id,
    })
    setQuery('')
    setResults([])
  }

  function handleClear() {
    onChange(null)
    setQuery('')
    setResults([])
    setGallery(false)
    setGalleryImgs([])
    setShowEdit(false)
    setError(null)
  }

  function handleEditField<K extends keyof ProductData>(key: K, val: ProductData[K]) {
    if (!value) return
    onChange({ ...value, [key]: val, source: 'manual' })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const promoPct = (value?.sale_price && value?.price && value.price > value.sale_price)
    ? Math.round((1 - value.sale_price / value.price) * 100)
    : null

  const isUrlInput  = mode === 'url' && /^https?:\/\//i.test(query.trim())
  const InputIcon   = mode === 'catalog' ? Search : LinkIcon
  const placeholder = mode === 'catalog' ? 'Buscar produto pelo nome ou SKU' : 'Cole o link do anúncio ou catálogo'

  return (
    <div className="space-y-3">
      {!value && (
        <>
          {/* Tabs Catálogo Vazzo / Importar de URL */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => switchMode('catalog')}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-1.5 ${
                mode === 'catalog'
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/50'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <Package size={14} /> Catálogo Vazzo
            </button>
            <button
              type="button"
              onClick={() => switchMode('url')}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition flex items-center gap-1.5 ${
                mode === 'url'
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/50'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <LinkIcon size={14} /> Importar de URL
            </button>
          </div>

          <div className="relative">
            <div className="relative">
              <InputIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-[#0d0d10] border border-zinc-800 rounded-lg pl-10 pr-10 py-3 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-cyan-500/50"
              />
              {(isSearching || isImporting) && (
                <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400 animate-spin" />
              )}
            </div>

            {isImporting && (
              <div className="mt-2 text-xs text-zinc-400 flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Importando do marketplace…
              </div>
            )}

            {!isImporting && !error && mode === 'catalog' && (
              <p className="mt-2 text-[11px] text-zinc-500">
                💡 Busca produtos da sua base. Para importar de fora, troque a aba acima.
              </p>
            )}

            {!isImporting && !error && mode === 'url' && !isUrlInput && query.trim().length > 0 && (
              <p className="mt-2 text-[11px] text-amber-400">
                Cole uma URL completa (https://…) ou troque pra Catálogo Vazzo.
              </p>
            )}

            {!isImporting && !error && mode === 'url' && (query.trim().length === 0 || isUrlInput) && (
              <p className="mt-2 text-[11px] text-zinc-500">
                💡 Modo auxiliar — funciona melhor com seus próprios anúncios (MLB-N) e catálogos (MLBU-N) do Mercado Livre. Para anúncios de outros vendedores, use Catálogo Vazzo.
              </p>
            )}

            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d0d10] border border-zinc-800 rounded-lg overflow-hidden z-20 max-h-80 overflow-y-auto">
                {results.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectCatalog(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/50 text-left"
                  >
                    {r.image_url
                      ? <img src={r.image_url} alt="" className="w-8 h-8 rounded object-cover bg-zinc-800" />
                      : <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center"><ImageIcon size={14} className="text-zinc-600" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{r.title}</p>
                      <p className="text-xs text-cyan-400">R$ {r.price.toFixed(2)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <div
          className="rounded-lg p-3 text-sm space-y-2"
          style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
          {!value && (
            <div className="flex flex-wrap gap-2 pl-6">
              <button
                type="button"
                onClick={handleRetryUrl}
                className="text-xs px-2.5 py-1 rounded border border-red-400/30 hover:bg-red-400/10 text-red-300"
              >
                Tentar outra URL
              </button>
              <button
                type="button"
                onClick={handleStartManual}
                className="text-xs px-2.5 py-1 rounded bg-red-400/20 hover:bg-red-400/30 text-red-200 font-semibold"
              >
                Preencher manualmente
              </button>
            </div>
          )}
        </div>
      )}

      {value && (
        <div className="bg-[#0d0d10] border border-zinc-800 rounded-lg p-4 relative">
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300"
            aria-label="Remover"
          >
            <X size={16} />
          </button>

          <div className="flex gap-4">
            {value.image_url
              ? <img src={value.image_url} alt={value.title} className="w-[60px] h-[60px] rounded-lg object-cover bg-zinc-800 flex-shrink-0" />
              : <div className="w-[60px] h-[60px] rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0"><ImageIcon size={20} className="text-zinc-600" /></div>}

            <div className="flex-1 min-w-0 pr-6">
              <p className="text-sm font-bold text-zinc-100 truncate">{value.title || '(sem título)'}</p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {value.sale_price ? (
                  <>
                    <span className="text-xs text-zinc-500 line-through">R$ {value.price.toFixed(2)}</span>
                    <span className="text-sm font-bold text-cyan-400">R$ {value.sale_price.toFixed(2)}</span>
                    {promoPct !== null && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">-{promoPct}%</span>
                    )}
                  </>
                ) : (
                  <span className="text-sm font-bold text-cyan-400">R$ {value.price.toFixed(2)}</span>
                )}
              </div>
              {value.url && (
                <a href={value.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-zinc-500 hover:text-zinc-300">
                  Ver anúncio <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {value.ml_listing_id && (
              <button
                type="button"
                onClick={() => setGallery(g => !g)}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-zinc-800 text-zinc-300 hover:border-zinc-700"
              >
                <ImageIcon size={12} /> Imagens do anúncio
                <ChevronDown size={12} className={`transition-transform ${showGallery ? 'rotate-180' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowEdit(s => !s)}
              className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-zinc-800 text-zinc-300 hover:border-zinc-700"
            >
              <Edit3 size={12} /> Editar dados manualmente
              <ChevronDown size={12} className={`transition-transform ${showEdit ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showGallery && value.ml_listing_id && (
            <div className="mt-3 grid grid-cols-6 gap-2">
              {galleryImgs.length === 0 && (
                <div className="col-span-6 text-xs text-zinc-500 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Carregando galeria…
                </div>
              )}
              {galleryImgs.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ ...value, image_url: src })}
                  className={`aspect-square rounded overflow-hidden border-2 ${value.image_url === src ? 'border-cyan-500' : 'border-transparent hover:border-zinc-700'}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover bg-zinc-800" />
                </button>
              ))}
            </div>
          )}

          {showEdit && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="col-span-2 text-xs text-zinc-500">
                Título
                <input
                  type="text"
                  defaultValue={value.title}
                  onBlur={e => handleEditField('title', e.target.value)}
                  className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-500/50"
                />
              </label>
              <label className="text-xs text-zinc-500">
                Preço
                <input
                  type="number"
                  step="0.01"
                  defaultValue={value.price}
                  onBlur={e => handleEditField('price', Number(e.target.value) || 0)}
                  className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-500/50"
                />
              </label>
              <label className="text-xs text-zinc-500">
                Preço promo (opcional)
                <input
                  type="number"
                  step="0.01"
                  defaultValue={value.sale_price ?? ''}
                  onBlur={e => handleEditField('sale_price', e.target.value === '' ? undefined : Number(e.target.value))}
                  className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-500/50"
                />
              </label>
              <label className="col-span-2 text-xs text-zinc-500">
                URL da imagem
                <input
                  type="text"
                  defaultValue={value.image_url ?? ''}
                  onBlur={e => handleEditField('image_url', e.target.value || undefined)}
                  className="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-500/50"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
