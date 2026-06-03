'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, Send, Package, Tag,
} from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { MlPublishContext } from '@/components/creative/types'

/** Publicar na Shopee — reusa o contexto do IA Criativo (título, descrição,
 *  imagens, preço, marca). O backend recomenda categoria + preenche atributos
 *  obrigatórios automaticamente (não precisa escolher categoria aqui). NÃO
 *  publica sozinho — só na confirmação do usuário. ⚠️ A publicação real depende
 *  do escopo de produto da Shopee (get_attributes/add_item) estar liberado no
 *  Open Platform Console + re-OAuth; até lá o backend devolve um 403 acionável. */
export default function ShopeePublishPage() {
  const params = useParams<{ productId: string; listingId: string }>()
  const { productId, listingId } = params

  const [ctx, setCtx] = useState<MlPublishContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<{ item_id?: number; images?: number } | null>(null)
  const [blockers, setBlockers] = useState<string[] | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  useEffect(() => {
    CreativeApi.getMlContext(listingId)
      .then(setCtx)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar o anúncio'))
      .finally(() => setLoading(false))
  }, [listingId])

  // dados derivados do contexto (mesma fonte do ML/TikTok)
  const data = useMemo(() => {
    if (!ctx) return null
    const images = ctx.approved_images
      .sort((a, b) => a.position - b.position)
      .map((i) => i.signed_image_url)
      .filter(Boolean)
    const brand = ctx.listing.ml_attributes?.find((a) => a.id === 'BRAND')?.value_name ?? null
    return {
      title: ctx.listing.title,
      description: [ctx.listing.description, ...(ctx.listing.bullets ?? [])].filter(Boolean).join('\n'),
      images,
      price: ctx.sku_suggestion?.price ?? null,
      brand,
      // atributos do IA Criativo (formato ML) — backend faz o de-para pros
      // campos da categoria Shopee (tensão, potência, cor, material, marca…).
      ml_attributes: ctx.listing.ml_attributes ?? null,
    }
  }, [ctx])

  const publish = async () => {
    if (!data || data.price == null) return
    setPublishing(true); setPublishError(null); setBlockers(null); setResult(null)
    try {
      const r = await CreativeApi.shopeePublish({
        title: data.title,
        description: data.description,
        price: data.price,
        image_urls: data.images,
        image_count: data.images.length,
        brand: data.brand ?? undefined,
        ml_attributes: data.ml_attributes ?? undefined,
      })
      if (!r.ok) setBlockers(r.blockers ?? ['Anúncio não passou no gate de relevância.'])
      else setResult({ item_id: r.item_id, images: r.images })
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

  const canPublish = data.images.length > 0 && data.price != null && !publishing && !result

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <Link
        href={`/dashboard/creative/${productId}/listing/${listingId}/publish/ml`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar pro publish do Mercado Livre
      </Link>

      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ee4d2d] text-xs font-bold text-white">SP</span>
        <h1 className="text-lg font-semibold">Publicar na Shopee</h1>
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
              <span><Package className="mr-1 inline h-3 w-3" />{data.images.length} fotos</span>
              <span>marca: {data.brand ?? 'Sem marca'}</span>
            </p>
          </div>
        </div>
        {data.price == null && (
          <p className="mt-2 text-xs text-amber-600">⚠️ Defina o preço no publish do Mercado Livre antes de publicar na Shopee.</p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-medium">Como funciona</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A Shopee recomenda a categoria pelo título e o IA Criativo preenche os atributos obrigatórios
          (marca, etc.) automaticamente. As fotos são enviadas pro media space, e o anúncio nasce com
          estoque 0 (ajuste o estoque depois na Central de Anúncios Shopee).
        </p>
      </div>

      {/* Bloqueios do gate de relevância */}
      {blockers && blockers.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" /> Ajuste antes de publicar:</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {blockers.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {/* Erro (inclui o 403 acionável de escopo da Shopee) */}
      {publishError && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{publishError}</span>
        </div>
      )}
      {result && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> Publicado na Shopee!</p>
          <p className="mt-1 text-xs">
            item_id: {result.item_id} · {result.images ?? 0} fotos enviadas.
            {' '}Veja em Seller Center → Produtos (pode entrar em análise). Ajuste o estoque na Central de Anúncios Shopee.
          </p>
        </div>
      )}

      {/* Ação */}
      <button
        type="button"
        onClick={publish}
        disabled={!canPublish}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#ee4d2d] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {result ? 'Publicado' : 'Publicar na Shopee'}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        Sobe as fotos pra Shopee, recomenda a categoria e cria o anúncio com os atributos do IA Criativo.
        Ação irreversível (cria anúncio público).
      </p>
    </div>
  )
}
