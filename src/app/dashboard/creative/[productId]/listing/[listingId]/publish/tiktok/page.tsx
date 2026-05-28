'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, Search, Send, Package, Tag, X,
} from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { MlPublishContext } from '@/components/creative/types'

type TkCategory = { id: string; name: string; is_leaf: boolean; parent_id: string }
type TkPreview = {
  category_id: string | null
  recommended: boolean
  attributes: Array<{ id: string; name: string; required: boolean }>
  missing_required: Array<{ id: string; name: string }>
}

/** Publicar no TikTok Shop — espelho do publish ML, reusa o contexto do IA Criativo
 *  (título, descrição, imagens, preço, SKU e ml_attributes). Mapeia atributos+marca
 *  no backend. NÃO publica sozinho — só na confirmação do usuário. */
export default function TikTokPublishPage() {
  const params = useParams<{ productId: string; listingId: string }>()
  const { productId, listingId } = params

  const [ctx, setCtx] = useState<MlPublishContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // categoria
  const [catQuery, setCatQuery] = useState('')
  const [cats, setCats] = useState<TkCategory[]>([])
  const [catLoading, setCatLoading] = useState(false)
  const [category, setCategory] = useState<TkCategory | null>(null)

  // preview + publish
  const [preview, setPreview] = useState<TkPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<{ product_id: string | null; mapped_attributes?: number; brand_id?: string | null } | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  useEffect(() => {
    CreativeApi.getMlContext(listingId)
      .then(setCtx)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar o anúncio'))
      .finally(() => setLoading(false))
  }, [listingId])

  // dados derivados do contexto (mesma fonte do ML)
  const data = useMemo(() => {
    if (!ctx) return null
    const images = ctx.approved_images
      .sort((a, b) => a.position - b.position)
      .map((i) => i.signed_image_url)
      .filter(Boolean)
    const brand = ctx.listing.ml_attributes?.find((a) => a.id === 'BRAND')?.value_name ?? null
    return {
      title: ctx.listing.title,
      description: ctx.listing.description,
      bullets: ctx.listing.bullets ?? [],
      images,
      price: ctx.sku_suggestion?.price ?? null,
      stock: ctx.sku_suggestion?.stock ?? null,
      sku: ctx.sku_suggestion?.sku ?? null,
      ml_attributes: ctx.listing.ml_attributes ?? [],
      brand,
    }
  }, [ctx])

  // busca de categoria (debounce)
  useEffect(() => {
    const q = catQuery.trim()
    if (q.length < 2) { setCats([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setCatLoading(true)
      CreativeApi.tiktokCategories(q)
        .then((r) => setCats(r))
        .catch(() => setCats([]))
        .finally(() => setCatLoading(false))
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [catQuery])

  const pickCategory = async (c: TkCategory) => {
    setCategory(c); setCats([]); setCatQuery(''); setPreview(null); setResult(null); setPublishError(null)
    if (!data) return
    setPreviewing(true)
    try {
      const p = await CreativeApi.tiktokPublishPreview({
        product_name: data.title,
        description: data.description,
        images: data.images,
        price: data.price ?? undefined,
        sku: data.sku ?? undefined,
        stock: data.stock ?? undefined,
        category_id: c.id,
      })
      setPreview(p)
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Falha no preview')
    } finally {
      setPreviewing(false)
    }
  }

  const publish = async () => {
    if (!data || !category || data.price == null) return
    setPublishing(true); setPublishError(null)
    try {
      const r = await CreativeApi.tiktokPublish({
        title: data.title,
        description: [data.description, ...(data.bullets || [])].filter(Boolean).join('\n'),
        category_id: category.id,
        image_urls: data.images,
        price: data.price,
        stock: data.stock ?? undefined,
        sku: data.sku ?? undefined,
        ml_attributes: data.ml_attributes,
        brand_name: data.brand ?? undefined,
      })
      setResult(r)
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Falha ao publicar')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error ?? 'Anúncio não encontrado'}
        </div>
      </div>
    )
  }

  const canPublish = !!category && data.images.length > 0 && data.price != null && !publishing && !result

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <Link
        href={`/dashboard/creative/${productId}/listing/${listingId}/publish/ml`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar pro publish do Mercado Livre
      </Link>

      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">TT</span>
        <h1 className="text-lg font-semibold">Publicar no TikTok Shop</h1>
      </div>

      {/* Resumo do produto (reusa o IA Criativo) */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex gap-3">
          {data.images[0] && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={data.images[0]} alt="" className="h-16 w-16 rounded object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{data.title}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span><Tag className="mr-1 inline h-3 w-3" />{data.price != null ? `R$ ${Number(data.price).toFixed(2)}` : 'sem preço'}</span>
              <span><Package className="mr-1 inline h-3 w-3" />estoque {data.stock ?? '—'}</span>
              <span>{data.images.length} fotos</span>
              <span>marca: {data.brand ?? 'Sem marca'}</span>
            </p>
          </div>
        </div>
        {data.price == null && (
          <p className="mt-2 text-xs text-amber-600">⚠️ Defina o preço no publish do Mercado Livre antes de publicar no TikTok.</p>
        )}
      </div>

      {/* Categoria */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Categoria do TikTok Shop</label>
        {category ? (
          <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 p-2 text-sm">
            <span>{category.name} <span className="text-xs text-muted-foreground">({category.id})</span></span>
            <button type="button" onClick={() => { setCategory(null); setPreview(null) }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-background">
            <div className="relative border-b border-border">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={catQuery}
                onChange={(e) => setCatQuery(e.target.value)}
                placeholder="Buscar categoria (ex.: iluminação, ventilador)…"
                className="w-full bg-transparent py-2 pl-7 pr-2 text-sm outline-none"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {catLoading ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /></p>
              ) : cats.length === 0 ? (
                <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">{catQuery.trim().length < 2 ? 'Digite ao menos 2 letras…' : 'Nada encontrado.'}</p>
              ) : (
                cats.map((c) => (
                  <button key={c.id} type="button" onClick={() => pickCategory(c)} className="block w-full px-2 py-1.5 text-left text-xs hover:bg-muted">
                    {c.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      {previewing && <p className="text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /> Conferindo categoria…</p>}
      {preview && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium">Pré-visualização</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {preview.attributes.length} atributos na categoria · {preview.missing_required.length} obrigatórios faltando.
            {' '}Os atributos do IA Criativo (marca, tensão, potência, cor, material) são preenchidos automaticamente.
          </p>
          {preview.missing_required.length > 0 && (
            <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-700">
              Obrigatórios sem valor: {preview.missing_required.map((m) => m.name).join(', ')}. O TikTok pode pedir esses no anúncio.
            </p>
          )}
        </div>
      )}

      {/* Resultado / erro */}
      {publishError && (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {publishError}
        </div>
      )}
      {result && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Publicado no TikTok Shop!</p>
          <p className="mt-1 text-xs">
            product_id: {result.product_id} · {result.mapped_attributes ?? 0} atributos mapeados · marca: {result.brand_id ? 'vinculada' : 'Sem marca'}.
            {' '}Veja em Seller Center → Gerenciar produtos (pode entrar em análise).
          </p>
        </div>
      )}

      {/* Ação */}
      <button
        type="button"
        onClick={publish}
        disabled={!canPublish}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {result ? 'Publicado' : 'Publicar no TikTok Shop'}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        Sobe as fotos pro TikTok, cria o anúncio com a categoria escolhida e mapeia marca/atributos do IA Criativo. Ação irreversível (cria anúncio público).
      </p>
    </div>
  )
}
