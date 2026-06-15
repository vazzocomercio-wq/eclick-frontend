'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
 *  Open Platform Console + re-OAuth; até lá o backend devolve um 403 acionável.
 *
 *  Multi-loja: o usuário pode marcar VÁRIAS lojas e publicar nas duas de uma vez
 *  (uma chamada por loja). Cada loja tem status próprio — uma pode publicar e a
 *  outra falhar (ex.: categoria que exige atributo que só sai numa das contas). */

// estado da publicação POR loja (multi-conta)
type ShopPub = {
  status: 'publishing' | 'done' | 'blocked' | 'error'
  item_id?: number
  images?: number
  virtual_stock?: number | null
  stock_paused?: boolean
  attributes_count?: number
  blockers?: string[]
  error?: string
}

export default function ShopeePublishPage() {
  const params = useParams<{ productId: string; listingId: string }>()
  const { productId, listingId } = params

  const [ctx, setCtx] = useState<MlPublishContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [publishing, setPublishing] = useState(false)
  // multi-loja: lojas Shopee conectadas + seleção (marca TODAS por padrão, pra
  // publicar nas duas de uma vez) + resultado por loja.
  const [shops, setShops] = useState<Array<{ shop_id: number; nickname: string | null }>>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pub, setPub] = useState<Record<number, ShopPub>>({})
  // nº de registro p/ campos numéricos obrigatórios da categoria (ex.: Inmetro)
  const [regNumber, setRegNumber] = useState('')
  // "não se aplica / não tenho" (espelho do "não se aplica" do ML)
  const [regNotApplicable, setRegNotApplicable] = useState(false)

  useEffect(() => {
    CreativeApi.getMlContext(listingId)
      .then(setCtx)
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar o anúncio'))
      .finally(() => setLoading(false))
  }, [listingId])

  useEffect(() => {
    CreativeApi.shopeeShops()
      .then((list) => {
        setShops(list)
        // por padrão marca TODAS as lojas conectadas (intenção = publicar em todas)
        setSelected(new Set(list.map((s) => s.shop_id)))
      })
      .catch(() => setShops([]))
  }, [])

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
      // descrição LIMPA — o backend junta destaques (bullets) + FAQ na descrição
      // na hora de publicar (Shopee não tem campo separado pra isso).
      description: ctx.listing.description ?? '',
      bullets: ctx.listing.bullets ?? null,
      faq: ctx.listing.faq ?? null,
      images,
      price: ctx.sku_suggestion?.price ?? null,
      brand,
      // atributos do IA Criativo (formato ML) — backend faz o de-para pros
      // campos da categoria Shopee (tensão, potência, cor, material, marca…).
      ml_attributes: ctx.listing.ml_attributes ?? null,
      // produto de catálogo (vínculo direto ou match de SKU) — backend usa pra
      // aplicar o estoque virtual (físico+virtual) e respeitar a pausa no mínimo.
      catalog_product_id: ctx.product?.product_id ?? ctx.sku_suggestion?.product_id ?? null,
      // creative_products.id — pra registrar a publicação em creative_publications.
      creative_product_id: ctx.listing.product_id ?? null,
    }
  }, [ctx])

  const toggleShop = (id: number) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // lojas marcadas que ainda NÃO foram publicadas com sucesso (pra não duplicar
  // anúncio se o usuário clicar de novo após um erro parcial).
  const pendingTargets = useMemo(
    () => shops.filter((s) => selected.has(s.shop_id) && pub[s.shop_id]?.status !== 'done'),
    [shops, selected, pub],
  )

  const publishingRef = useRef(false)
  const publish = async () => {
    if (!data || data.price == null || pendingTargets.length === 0) return
    // Trava SÍNCRONA contra duplo-clique: o `disabled` do botão só vale após o
    // re-render, deixando uma fresta onde 2 cliques rápidos disparavam 2
    // publicações (= 2 anúncios reais na Shopee). A ref bloqueia na hora.
    if (publishingRef.current) return
    publishingRef.current = true
    setPublishing(true)
    // publica em CADA loja marcada (sequencial pra feedback claro por loja).
    // pula as que já publicaram (status 'done') — evita anúncio duplicado.
    const targets = shops.filter((s) => selected.has(s.shop_id) && pub[s.shop_id]?.status !== 'done')
    for (const s of targets) {
      setPub((p) => ({ ...p, [s.shop_id]: { status: 'publishing' } }))
      try {
        const r = await CreativeApi.shopeePublish({
          shop_id: s.shop_id,
          title: data.title,
          description: data.description,
          price: data.price,
          image_urls: data.images,
          image_count: data.images.length,
          brand: data.brand ?? undefined,
          ml_attributes: data.ml_attributes ?? undefined,
          bullets: data.bullets ?? undefined,
          faq: data.faq ?? undefined,
          registration_number: regNotApplicable ? undefined : (regNumber.trim() || undefined),
          registration_not_applicable: regNotApplicable || undefined,
          catalog_product_id: data.catalog_product_id ?? undefined,
          listing_id: listingId,
          creative_product_id: data.creative_product_id ?? undefined,
        })
        if (!r.ok) {
          setPub((p) => ({ ...p, [s.shop_id]: { status: 'blocked', blockers: r.blockers ?? ['Anúncio não passou no gate de relevância.'] } }))
        } else {
          setPub((p) => ({ ...p, [s.shop_id]: { status: 'done', item_id: r.item_id, images: r.images, virtual_stock: r.virtual_stock, stock_paused: r.stock_paused, attributes_count: r.attributes_count } }))
        }
      } catch (e) {
        setPub((p) => ({ ...p, [s.shop_id]: { status: 'error', error: e instanceof Error ? e.message : 'Falha ao publicar' } }))
      }
    }
    setPublishing(false)
    publishingRef.current = false
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

  const canPublish = data.images.length > 0 && data.price != null && pendingTargets.length > 0 && !publishing
  const doneCount = shops.filter((s) => pub[s.shop_id]?.status === 'done').length
  const allSelectedDone = selected.size > 0 && [...selected].every((id) => pub[id]?.status === 'done')

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

      {/* Lojas de destino — MULTI-SELEÇÃO: marque uma ou as duas pra publicar de
          uma vez. Cada loja mostra o próprio status (publicando / publicado / erro). */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Lojas Shopee de destino</p>
          {shops.length > 1 && (
            <div className="flex items-center gap-2 text-[11px]">
              <button type="button" onClick={() => setSelected(new Set(shops.map((s) => s.shop_id)))}
                disabled={publishing} className="text-muted-foreground hover:text-[#ee4d2d] disabled:opacity-50">
                Marcar todas
              </button>
              <span className="text-border">·</span>
              <button type="button" onClick={() => setSelected(new Set())}
                disabled={publishing} className="text-muted-foreground hover:text-[#ee4d2d] disabled:opacity-50">
                Limpar
              </button>
            </div>
          )}
        </div>

        {shops.length === 0 ? (
          <p className="mt-1 text-xs text-amber-600">Nenhuma loja Shopee conectada — conecte em Configurações › Integrações.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {shops.map((s) => {
              const st = pub[s.shop_id]
              const checked = selected.has(s.shop_id)
              return (
                <label key={s.shop_id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-[#ee4d2d]/60"
                  style={checked ? { borderColor: '#ee4d2d', background: 'rgba(238,77,45,0.06)' } : undefined}>
                  <input
                    type="checkbox"
                    checked={checked}
                    // não deixa desmarcar/mudar durante a publicação, nem a loja já publicada
                    disabled={publishing || st?.status === 'done'}
                    onChange={() => toggleShop(s.shop_id)}
                    className="accent-[#ee4d2d]"
                  />
                  <span>{s.nickname ?? `Shopee #${s.shop_id}`}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">#{s.shop_id}</span>
                  {/* status por loja */}
                  {st?.status === 'publishing' && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ee4d2d]" />}
                  {st?.status === 'done' && <span className="flex items-center gap-1 text-[11px] font-medium text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> #{st.item_id}</span>}
                  {st?.status === 'blocked' && <span className="text-[11px] font-medium text-amber-600">ajustar ↓</span>}
                  {st?.status === 'error' && <span className="text-[11px] font-medium text-red-600">erro ↓</span>}
                </label>
              )
            })}
            {selected.size === 0 && !allSelectedDone && (
              <p className="text-xs text-amber-600">Marque pelo menos uma loja.</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-medium">Como funciona</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A Shopee recomenda a categoria pelo título e o IA Criativo preenche o máximo de atributos
          (obrigatórios + opcionais: tensão, cor, material, tipo de lâmpada…) fazendo o de-para com os
          campos da categoria. As fotos vão pro media space. Se o produto estiver vinculado ao catálogo,
          o anúncio já nasce com o <strong>estoque virtual (físico + virtual)</strong> e respeita a pausa
          no mínimo — senão entra com estoque 0 (ajuste na Central de Anúncios Shopee). Marcando as duas
          lojas, o anúncio é criado <strong>em cada uma</strong> (uma publicação por loja).
        </p>
      </div>

      {/* Número de registro — campos numéricos obrigatórios (ex.: Inmetro) */}
      <div className="rounded-lg border border-border bg-card p-4">
        <label htmlFor="shopee-regnum" className="text-sm font-medium">
          Número de registro <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="shopee-regnum"
          type="text"
          inputMode="numeric"
          value={regNumber}
          onChange={(e) => setRegNumber(e.target.value)}
          disabled={regNotApplicable}
          placeholder="Ex.: nº Inmetro (só números)"
          className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#ee4d2d] disabled:opacity-50"
        />
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={regNotApplicable}
            onChange={(e) => setRegNotApplicable(e.target.checked)}
            className="mt-0.5 accent-[#ee4d2d]"
          />
          <span>
            <strong className="text-foreground">Não se aplica / não tenho esse registro.</strong>{' '}
            Marca o produto como isento (igual ao &quot;não se aplica&quot; do Mercado Livre): nos campos de
            certificação a Shopee recebe a opção de não-aplicável. A Shopee tem a palavra final — se a
            categoria exigir mesmo assim, o aviso dirá qual campo falta.
          </span>
        </label>
      </div>

      {/* Resultado POR loja — sucesso, bloqueios do gate, ou erro (inclui o 403
          acionável de escopo da Shopee). Só mostra as lojas que já tentaram. */}
      {shops.filter((s) => pub[s.shop_id] && pub[s.shop_id].status !== 'publishing').map((s) => {
        const st = pub[s.shop_id]!
        const name = s.nickname ?? `Shopee #${s.shop_id}`
        if (st.status === 'done') {
          return (
            <div key={s.shop_id} className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
              <p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" /> {name}: publicado!</p>
              <p className="mt-1 text-xs">
                item_id: {st.item_id} · {st.images ?? 0} fotos
                {st.attributes_count != null && ` · ${st.attributes_count} atributos preenchidos`}.
                {st.virtual_stock != null
                  ? (st.stock_paused
                      ? ` Estoque virtual ${st.virtual_stock} ≤ mínimo → anúncio nasce pausado (esgotado).`
                      : ` Estoque virtual aplicado: ${st.virtual_stock} un. (físico+virtual).`)
                  : ' Estoque entra como 0 (produto sem vínculo de catálogo) — ajuste na Central de Anúncios Shopee.'}
                {' '}Veja em Seller Center → Produtos (pode entrar em análise).
              </p>
            </div>
          )
        }
        if (st.status === 'blocked') {
          return (
            <div key={s.shop_id} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" /> {name}: ajuste antes de publicar</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {(st.blockers ?? []).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          )
        }
        return (
          <div key={s.shop_id} className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span><strong>{name}:</strong> {st.error}</span>
          </div>
        )
      })}

      {/* Ação */}
      <button
        type="button"
        onClick={publish}
        disabled={!canPublish}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#ee4d2d] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {allSelectedDone
          ? `Publicado em ${doneCount} loja${doneCount > 1 ? 's' : ''}`
          : pendingTargets.length > 1
            ? `Publicar na Shopee (${pendingTargets.length} lojas)`
            : 'Publicar na Shopee'}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        Sobe as fotos pra Shopee, recomenda a categoria e cria o anúncio com os atributos do IA Criativo.
        Ação irreversível (cria um anúncio público em cada loja marcada).
      </p>
    </div>
  )
}
