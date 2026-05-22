'use client'

/**
 * Dashboard — Instagram Shopping: tag de produtos em posts/reels.
 *
 * Lista a mídia do @conta (posts/reels), e num modal o lojista busca
 * produtos do catálogo Meta e os "tagueia" na imagem (sacolinha clicável
 * no Instagram). Posição (x,y) clicando na imagem — só pra IMAGE; VIDEO/
 * CAROUSEL a Meta ignora a posição.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Loader2, AlertCircle, ShoppingBag, Tag, X, Search, Check,
  Image as ImageIcon, Film, Images, ChevronRight, ExternalLink, Lock,
} from 'lucide-react'
import {
  SocialCommerceApi,
  type IgAccount,
  type IgMedia,
  type TaggableProduct,
  type MediaProductTag,
} from '@/components/social-commerce/socialCommerceApi'

type PendingTag = {
  product_id: string
  name: string
  image?: string
  price?: string
  x: number
  y: number
  isNew: boolean
}

const MEDIA_ICON: Record<string, React.ReactNode> = {
  IMAGE:          <ImageIcon size={12} />,
  VIDEO:          <Film size={12} />,
  CAROUSEL_ALBUM: <Images size={12} />,
}

export default function InstagramPostsPage() {
  const [account, setAccount] = useState<IgAccount | null>(null)
  const [media, setMedia]     = useState<IgMedia[]>([])
  const [after, setAfter]     = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [openMedia, setOpenMedia] = useState<IgMedia | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Resolve a conta IG (persiste o id) e lista a mídia em paralelo
      const [acc, m] = await Promise.all([
        SocialCommerceApi.getIgAccount(),
        SocialCommerceApi.listIgMedia(),
      ])
      setAccount(acc)
      setMedia(m.data)
      setAfter(m.after)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function loadMore() {
    if (!after) return
    setLoadingMore(true)
    try {
      const m = await SocialCommerceApi.listIgMedia(after)
      setMedia(prev => [...prev, ...m.data])
      setAfter(m.after)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingMore(false)
    }
  }

  function onModalClose(taggedCount?: number) {
    if (openMedia && taggedCount != null) {
      setMedia(prev => prev.map(m => m.id === openMedia.id ? { ...m, tagged_count: taggedCount } : m))
    }
    setOpenMedia(null)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-zinc-500 text-sm">
        <Loader2 size={14} className="animate-spin" /> Carregando posts do Instagram…
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <ShoppingBag size={20} className="text-fuchsia-400" />
            Tag de produtos no Instagram
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Marque produtos do catálogo nos seus posts e reels — vira sacolinha clicável no feed.
          </p>
        </div>
        {account && (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5">
            {account.profile_picture_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.profile_picture_url} alt="" className="w-7 h-7 rounded-full object-cover" />
            )}
            <span className="text-xs text-zinc-300 font-medium">@{account.username ?? account.name}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
            <Link href="/dashboard/social-commerce/instagram" className="underline text-red-200 mt-1 inline-block">
              Verificar conexão Meta
            </Link>
          </div>
        </div>
      )}

      {!error && media.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
          Nenhum post encontrado na conta @{account?.username}. Publique algo no Instagram e volte aqui.
        </div>
      )}

      {/* Grade de posts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {media.map(m => {
          const thumb = m.media_type === 'VIDEO' ? m.thumbnail_url : (m.media_url ?? m.thumbnail_url)
          return (
            <button
              key={m.id}
              onClick={() => setOpenMedia(m)}
              className="group relative aspect-square rounded-lg overflow-hidden border border-zinc-800 hover:border-fuchsia-400/50 transition-colors bg-zinc-900"
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt={m.caption ?? ''} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                  {MEDIA_ICON[m.media_type] ?? <ImageIcon size={24} />}
                </div>
              )}
              {/* media type chip */}
              <span className="absolute top-1.5 left-1.5 bg-black/60 rounded px-1.5 py-0.5 text-[10px] text-white flex items-center gap-1">
                {MEDIA_ICON[m.media_type]}
              </span>
              {/* tagged badge */}
              {m.tagged_count > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-emerald-500/90 rounded-full px-1.5 py-0.5 text-[10px] text-white font-semibold flex items-center gap-0.5">
                  <Tag size={9} /> {m.tagged_count}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-white line-clamp-2 text-left block">{m.caption}</span>
              </span>
            </button>
          )
        })}
      </div>

      {after && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs disabled:opacity-50"
          >
            {loadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
            Carregar mais
          </button>
        </div>
      )}

      {openMedia && (
        <TagModal media={openMedia} onClose={onModalClose} />
      )}
    </div>
  )
}

// ── Modal de tagueamento ───────────────────────────────────────────────

function TagModal({ media, onClose }: { media: IgMedia; onClose: (taggedCount?: number) => void }) {
  const isImage = media.media_type === 'IMAGE'
  const [tags, setTags]       = useState<PendingTag[]>([])
  const [loadingTags, setLoadingTags] = useState(true)
  const [search, setSearch]   = useState('')
  const [results, setResults] = useState<TaggableProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const imgRef = useRef<HTMLDivElement>(null)

  // Carrega tags existentes
  useEffect(() => {
    void (async () => {
      try {
        const existing = await SocialCommerceApi.getMediaTags(media.id)
        setTags(existing.map((t: MediaProductTag) => ({
          product_id: t.product_id,
          name:       t.name ?? t.product_id,
          image:      t.image_url,
          price:      t.price_string,
          x:          t.x ?? 0.5,
          y:          t.y ?? 0.5,
          isNew:      false,
        })))
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoadingTags(false)
      }
    })()
  }, [media.id])

  // Busca de produtos (debounce simples)
  useEffect(() => {
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await SocialCommerceApi.listTaggableProducts(search.trim() || undefined)
        setResults(r.slice(0, 30))
      } catch { /* ignore */ } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  function addProduct(p: TaggableProduct) {
    if (tags.some(t => t.product_id === p.id)) return
    setTags(prev => [...prev, {
      product_id: p.id, name: p.name, image: p.image, price: p.price,
      x: 0.5, y: 0.5, isNew: true,
    }])
    setActiveId(p.id)
  }

  // Só dá pra remover tag NÃO salva (pendente). Tag já publicada não pode
  // ser removida via API (limitação da Meta) — só editando no app do IG.
  function removeTag(productId: string) {
    const tag = tags.find(t => t.product_id === productId)
    if (!tag || !tag.isNew) return
    setTags(prev => prev.filter(t => t.product_id !== productId))
    if (activeId === productId) setActiveId(null)
  }

  function onImageClick(e: React.MouseEvent) {
    if (!isImage || !activeId || !imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    setTags(prev => prev.map(t => t.product_id === activeId ? { ...t, x, y } : t))
  }

  async function save() {
    setSaving(true); setError(null)
    try {
      const adds = tags.filter(t => t.isNew).map(t => ({ product_id: t.product_id, x: t.x, y: t.y }))
      let tagged = tags.length
      if (adds.length) {
        const r = await SocialCommerceApi.tagProducts(media.id, adds)
        tagged = r.tagged
      }
      onClose(tagged)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const thumb = media.media_type === 'VIDEO' ? media.thumbnail_url : (media.media_url ?? media.thumbnail_url)
  const dirty = tags.some(t => t.isNew)

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Tag size={16} className="text-fuchsia-400" /> Taguear produtos
          </h3>
          <div className="flex items-center gap-3">
            {media.permalink && (
              <a href={media.permalink} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
                Ver no Instagram <ExternalLink size={11} />
              </a>
            )}
            <button onClick={() => onClose()} className="p-1 text-zinc-500 hover:text-zinc-300"><X size={18} /></button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 p-4">
          {/* Imagem com tags posicionadas */}
          <div>
            <div
              ref={imgRef}
              onClick={onImageClick}
              className={`relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 ${isImage && activeId ? 'cursor-crosshair' : ''}`}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="w-full object-cover" />
              ) : (
                <div className="aspect-square flex items-center justify-center text-zinc-700">
                  {MEDIA_ICON[media.media_type]}
                </div>
              )}
              {/* dots das tags (só posicionais em IMAGE) */}
              {isImage && tags.map((t, i) => (
                <span
                  key={t.product_id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                    activeId === t.product_id ? 'bg-fuchsia-500 border-white' : 'bg-black/70 border-white/80'
                  } text-white`}
                  style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%` }}
                  title={t.name}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            {isImage ? (
              <p className="text-[11px] text-zinc-500 mt-2">
                {activeId
                  ? '📍 Clique na imagem pra posicionar o produto selecionado.'
                  : 'Adicione produtos ao lado, depois clique num deles pra posicionar na imagem.'}
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500 mt-2">
                {media.media_type === 'VIDEO' ? 'Reels/vídeo: o produto aparece como sacolinha, sem posição na tela.' : 'Carrossel: tags aplicadas no álbum.'}
              </p>
            )}
          </div>

          {/* Painel direito: tags atuais + busca */}
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-400 mb-2">
                Produtos tagueados {loadingTags && <Loader2 size={11} className="inline animate-spin ml-1" />}
              </p>
              {tags.length === 0 && !loadingTags && (
                <p className="text-[11px] text-zinc-600">Nenhum produto ainda. Busque abaixo e adicione.</p>
              )}
              <div className="space-y-1.5">
                {tags.map((t, i) => (
                  <button
                    key={t.product_id}
                    onClick={() => setActiveId(t.product_id)}
                    className={`w-full flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                      activeId === t.product_id ? 'border-fuchsia-400/60 bg-fuchsia-400/5' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    {t.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] text-zinc-200 truncate">{t.name}</span>
                      {t.price && <span className="block text-[10px] text-zinc-500">{t.price}</span>}
                    </span>
                    {t.isNew ? (
                      <span
                        onClick={(e) => { e.stopPropagation(); removeTag(t.product_id) }}
                        className="p-1 text-zinc-600 hover:text-red-400 shrink-0"
                        title="Remover (ainda não salvo)"
                      >
                        <X size={13} />
                      </span>
                    ) : (
                      <span className="p-1 text-zinc-600 shrink-0" title="Já publicado — pra remover, edite a publicação no app do Instagram">
                        <Lock size={12} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar produto do catálogo…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:border-fuchsia-400/50 focus:outline-none"
                />
              </div>
              <div className="mt-2 max-h-52 overflow-y-auto space-y-1 no-scrollbar">
                {searching && <p className="text-[11px] text-zinc-600 px-1">Buscando…</p>}
                {results.map(p => {
                  const added = tags.some(t => t.product_id === p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      disabled={added}
                      className="w-full flex items-center gap-2 rounded-lg border border-zinc-800 hover:border-zinc-700 p-2 text-left disabled:opacity-40"
                    >
                      {p.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[11px] text-zinc-200 truncate">{p.name}</span>
                        {p.price && <span className="block text-[10px] text-zinc-500">{p.price}</span>}
                      </span>
                      {added ? <Check size={13} className="text-emerald-400 shrink-0" /> : <Tag size={13} className="text-zinc-600 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 p-4 border-t border-zinc-800 sticky bottom-0 bg-zinc-950">
          <button onClick={() => onClose()} disabled={saving}
            className="px-3 py-2 rounded text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-50 text-white text-sm font-semibold"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Salvar tags
          </button>
        </div>
      </div>
    </div>
  )
}
