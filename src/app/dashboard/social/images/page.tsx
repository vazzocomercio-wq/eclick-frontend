'use client'

/**
 * e-Click Social AI — Geração visual de imagens de post (SV1).
 *
 * Pega um produto do catálogo, escolhe formato (feed 1:1 / story-reels 9:16 /
 * wide 16:9) + estilo, e a IA gera N imagens usando a foto do produto como
 * referência (cena social estilizada, produto preservado). Galeria com
 * download/excluir.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Sparkles, Loader2, Search, AlertCircle, Download, Trash2,
  ImageIcon, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import {
  SocialContentApi,
  type SocialPostImage,
  type SocialImageFormat,
} from '@/components/social/socialContentApi'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ProductLite {
  id: string; name: string; brand?: string | null; category?: string | null
  price?: number | null; photo_urls?: string[] | null
}

const FORMATS: Array<{ key: SocialImageFormat; label: string; ratio: string }> = [
  { key: 'feed',  label: 'Feed',         ratio: '1:1' },
  { key: 'story', label: 'Story / Reels', ratio: '9:16' },
  { key: 'wide',  label: 'Horizontal',   ratio: '16:9' },
]

const STYLES: Array<{ key: string; label: string }> = [
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'studio',    label: 'Estúdio' },
  { key: 'promo',     label: 'Promocional' },
  { key: 'seasonal',  label: 'Sazonal' },
  { key: 'minimal',   label: 'Minimalista' },
  { key: 'vibrant',   label: 'Vibrante' },
]

export default function SocialImagesPage() {
  const [products, setProducts] = useState<ProductLite[] | null>(null)
  const [search, setSearch]     = useState('')
  const [picked, setPicked]     = useState<ProductLite | null>(null)
  const [format, setFormat]     = useState<SocialImageFormat>('feed')
  const [style, setStyle]       = useState('lifestyle')
  const [n, setN]               = useState(2)
  const [extra, setExtra]       = useState('')

  const [generating, setGenerating] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [gallery, setGallery]       = useState<SocialPostImage[]>([])
  const [loadingGallery, setLoadingGallery] = useState(true)
  const [lightbox, setLightbox]     = useState<string | null>(null)

  // Carrega produtos + galeria
  useEffect(() => {
    void (async () => {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session?.access_token) { setError('Sessão expirada — faça login novamente'); return }
      try {
        const res = await fetch(`${BACKEND}/products`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await res.json()
        setProducts(Array.isArray(data) ? data : [])
      } catch (e) { setError((e as Error).message) }
    })()
  }, [])

  useEffect(() => {
    void (async () => {
      setLoadingGallery(true)
      try { setGallery(await SocialContentApi.listPostImages()) }
      catch { /* silent */ } finally { setLoadingGallery(false) }
    })()
  }, [])

  const filtered = useMemo(() => {
    if (!products) return []
    const q = search.trim().toLowerCase()
    const base = q ? products.filter(p => p.name.toLowerCase().includes(q)) : products
    return base.slice(0, 60)
  }, [products, search])

  async function generate() {
    if (!picked) return
    setGenerating(true); setError(null)
    try {
      const r = await SocialContentApi.generatePostImage(picked.id, { format, style, n, extra_prompt: extra.trim() || undefined })
      setGallery(prev => [...r.images, ...prev])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function remove(id: string) {
    setGallery(prev => prev.filter(g => g.id !== id))
    try { await SocialContentApi.deletePostImage(id) } catch { /* silent */ }
  }

  async function download(url: string, id: string) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `social-${id.slice(0, 8)}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { window.open(url, '_blank') }
  }

  const aspectClass: Record<SocialImageFormat, string> = {
    feed: 'aspect-square', story: 'aspect-[9/16]', wide: 'aspect-video',
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Sparkles size={20} className="text-fuchsia-400" />
          Gerador de Imagens — Social AI
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          A IA transforma a foto do seu produto numa imagem pronta pra postar — escolha o produto, formato e estilo.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span className="break-words">{error}</span>
        </div>
      )}

      {/* Painel de geração */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Esquerda: produto */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-zinc-400">1. Produto</p>
          {picked ? (
            <div className="flex items-center gap-3 rounded-lg border border-fuchsia-400/40 bg-fuchsia-400/5 p-2">
              {picked.photo_urls?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picked.photo_urls[0]} alt="" className="w-12 h-12 rounded object-cover" />
              )}
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-zinc-200 truncate">{picked.name}</span>
                {picked.brand && <span className="block text-[11px] text-zinc-500">{picked.brand}</span>}
              </span>
              <button onClick={() => setPicked(null)} className="p-1 text-zinc-500 hover:text-zinc-300"><X size={15} /></button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:border-fuchsia-400/50 focus:outline-none" />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1 no-scrollbar">
                {products === null && <p className="text-[11px] text-zinc-600 px-1">Carregando…</p>}
                {filtered.map(p => (
                  <button key={p.id} onClick={() => setPicked(p)}
                    className="w-full flex items-center gap-2 rounded-lg border border-zinc-800 hover:border-zinc-700 p-2 text-left">
                    {p.photo_urls?.[0]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.photo_urls[0]} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      : <span className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center shrink-0"><ImageIcon size={13} className="text-zinc-600" /></span>}
                    <span className="flex-1 min-w-0 text-[11px] text-zinc-200 truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Direita: opções */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">2. Formato</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map(f => (
                <button key={f.key} onClick={() => setFormat(f.key)}
                  className={`px-3 py-1.5 rounded-lg border text-xs ${format === f.key ? 'border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-200' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
                  {f.label} <span className="opacity-60">{f.ratio}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">3. Estilo</p>
            <div className="flex flex-wrap gap-2">
              {STYLES.map(s => (
                <button key={s.key} onClick={() => setStyle(s.key)}
                  className={`px-3 py-1.5 rounded-lg border text-xs ${style === s.key ? 'border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-200' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Variações</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(num => (
                  <button key={num} onClick={() => setN(num)}
                    className={`w-8 h-8 rounded-lg border text-xs ${n === num ? 'border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-200' : 'border-zinc-800 text-zinc-400'}`}>
                    {num}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Instrução extra (opcional)</p>
              <input value={extra} onChange={e => setExtra(e.target.value)} placeholder="ex: fundo de natal, cores quentes…"
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:border-fuchsia-400/50 focus:outline-none" />
            </div>
          </div>
          <button onClick={generate} disabled={!picked || generating}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 text-white text-sm font-semibold">
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {generating ? 'Gerando…' : `Gerar ${n} ${n === 1 ? 'imagem' : 'imagens'}`}
          </button>
        </div>
      </div>

      {/* Galeria */}
      <div>
        <p className="text-sm font-semibold text-zinc-200 mb-3">
          Imagens geradas {loadingGallery && <Loader2 size={12} className="inline animate-spin ml-1" />}
        </p>
        {gallery.length === 0 && !loadingGallery && (
          <p className="text-xs text-zinc-600">Nenhuma imagem ainda. Escolha um produto e clique em Gerar.</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {gallery.map(img => (
            <div key={img.id} className="group relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
              <button onClick={() => setLightbox(img.image_url)} className={`block w-full ${aspectClass[img.format] ?? 'aspect-square'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
              </button>
              <div className="absolute top-1.5 left-1.5 bg-black/60 rounded px-1.5 py-0.5 text-[9px] text-white uppercase">{img.format}{img.style ? ` · ${img.style}` : ''}</div>
              <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/70 to-transparent">
                <button onClick={() => download(img.image_url, img.id)} title="Baixar"
                  className="flex-1 inline-flex items-center justify-center gap-1 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px]">
                  <Download size={11} /> Baixar
                </button>
                <button onClick={() => remove(img.id)} title="Excluir"
                  className="px-2 py-1 rounded bg-white/10 hover:bg-red-500/40 text-white">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
          <button className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"><X size={22} /></button>
        </div>
      )}
    </div>
  )
}
