'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, Loader2, AlertCircle, CheckCircle2, RefreshCw,
  Image as ImageIcon, Film, Tag, DollarSign, Package, Eye, Layers, ExternalLink, Send, Lock, X, Calculator,
  Check, Store,
} from 'lucide-react'
import MLImageSelector from '@/components/creative/MLImageSelector'
import MLAttributesForm from '@/components/creative/MLAttributesForm'
import ListingSeoPanel, { scrollToSeoField } from '@/components/creative/ListingSeoPanel'
import MarkupPanel from '@/components/creative/MarkupPanel'
import { CreativeApi } from '@/components/creative/api'
import { fallbackFeeRate } from '@/lib/margin'
import {
  ML_LISTING_TYPE_OPTIONS, ML_CONDITION_OPTIONS,
  type MlPublishContext, type MlPreviewResponse,
  type MlListingType, type MlCondition,
  type CreativePublication, type MlAccount,
} from '@/components/creative/types'
import { useAlert } from '@/components/ui/dialog-provider'

interface AttributeValue { id: string; value_name?: string; value_id?: string }

export default function MLPublishPage() {
  const t = useTranslations('creative.publish')
  const params = useParams<{ productId: string; listingId: string }>()
  const productId = params.productId
  const listingId = params.listingId

  const [ctx, setCtx]             = useState<MlPublishContext | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Listing types vêm da API ML (cacheados 1h no backend)
  const [listingTypesFromApi, setListingTypesFromApi] = useState<Array<{ id: string; name: string }> | null>(null)

  // Form state
  const [imageIds, setImageIds]   = useState<string[]>([])
  const [videoId, setVideoId]     = useState<string | null>(null)
  const [price, setPrice]         = useState<string>('')
  const [stock, setStock]         = useState<string>('')
  const [listingType, setListingType] = useState<MlListingType>('gold_special')
  const [condition, setCondition] = useState<MlCondition>('new')
  const [attributes, setAttributes] = useState<AttributeValue[]>([])
  const [title, setTitle]         = useState<string>('')

  // Carrega listing types da API ML no mount
  useEffect(() => {
    CreativeApi.listMlListingTypes()
      .then(setListingTypesFromApi)
      .catch(() => setListingTypesFromApi([]))  // fallback pro ML_LISTING_TYPE_OPTIONS hardcoded
  }, [])

  // Preview
  const [preview, setPreview]     = useState<MlPreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Publications
  const [publications, setPublications] = useState<CreativePublication[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [storefrontAlready, setStorefrontAlready] = useState(false)
  const [alsoStorefront, setAlsoStorefront]       = useState(true)
  const [publishing, setPublishing]   = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  // Preço de atacado calculado no painel de markup — enviado ao ML pós-publicação.
  const [wholesale, setWholesale] = useState<{ price: number; minQty: number } | null>(null)

  // Atributos recomendados — preenchimento por IA
  const [aiFilling, setAiFilling] = useState(false)
  const [aiError, setAiError]     = useState<string | null>(null)
  const aiFilledRef               = useRef(false)

  // Contas ML — escolha de onde publicar (single ou todas)
  const [accounts, setAccounts]               = useState<MlAccount[]>([])
  const [selectedSellerIds, setSelectedSellerIds] = useState<number[]>([])
  const accountName = (sellerId: number | null) =>
    accounts.find(a => a.seller_id === sellerId)?.nickname ?? (sellerId != null ? String(sellerId) : null)

  useEffect(() => { void load() }, [listingId])

  async function refreshPublications() {
    try {
      const list = await CreativeApi.listListingPublications(listingId)
      setPublications(list)
    } catch { /* silencioso */ }
  }

  async function load() {
    setError(null); setLoading(true)
    try {
      const [c, pubs, accs, sf] = await Promise.all([
        CreativeApi.getMlContext(listingId),
        CreativeApi.listListingPublications(listingId).catch(() => []),
        CreativeApi.listMlAccounts().catch(() => [] as MlAccount[]),
        CreativeApi.getProductStorefront(productId).catch(() => false),
      ])
      setCtx(c)
      setTitle(c.listing.title ?? '')
      setPublications(pubs)
      setStorefrontAlready(sf)
      setAlsoStorefront(!sf)
      // Atributos vêm do anúncio (fonte única ml_attributes) — editor e
      // publicação compartilham o mesmo campo.
      setAttributes((c.listing.ml_attributes ?? []) as AttributeValue[])
      // Conta mais antiga = principal — pré-selecionada por padrão.
      const sortedAccs = [...accs].sort((a, b) => a.created_at.localeCompare(b.created_at))
      setAccounts(sortedAccs)
      if (sortedAccs.length > 0) setSelectedSellerIds([sortedAccs[0].seller_id])
      // Defaults
      setImageIds(c.approved_images.map(i => i.id).slice(0, 10))
      setVideoId(c.approved_videos[0]?.id ?? null)
      if (c.sku_suggestion) {
        if (c.sku_suggestion.price != null) setPrice(String(c.sku_suggestion.price))
        if (c.sku_suggestion.stock != null) setStock(String(c.sku_suggestion.stock))
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function publish() {
    if (!preview?.ready || !preview.publish_enabled) return
    if (selectedSellerIds.length === 0) {
      setPublishError(t('selectAccountError'))
      return
    }
    setPublishError(null); setPublishing(true)
    // Garante que os atributos ficam salvos no anúncio antes de publicar.
    await CreativeApi.updateListing(listingId, { ml_attributes: attributes }).catch(() => {})
    const newKey = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Publica em cada conta selecionada — uma publicação por conta.
    const done: CreativePublication[] = []
    const errs: string[] = []
    for (const sellerId of selectedSellerIds) {
      try {
        const pub = await CreativeApi.publishMl(listingId, {
          idempotency_key:   newKey(),
          seller_id:         sellerId,
          image_ids:         imageIds,
          video_id:          videoId,
          price:             Number(price) || 0,
          stock:             Number(stock) || 0,
          listing_type:      listingType,
          condition,
          attributes:        attributes.filter(a => a.value_id || a.value_name),
          wholesale_price:   wholesale?.price,
          wholesale_min_qty: wholesale?.minQty,
        })
        done.push(pub)
      } catch (e: unknown) {
        errs.push(`${accountName(sellerId)}: ${(e as Error).message}`)
      }
    }
    if (done.length > 0) {
      setPublications(prev => [...done, ...prev.filter(p => !done.some(d => d.id === p.id))])
      // Loja Propria — se marcado e ainda nao estiver na loja, envia tambem.
      if (alsoStorefront && !storefrontAlready) {
        await CreativeApi.setProductStorefront(productId, true).catch(() => {})
        setStorefrontAlready(true)
      }
    }
    if (errs.length > 0) setPublishError(errs.join('\n'))
    else setConfirmOpen(false)
    setPublishing(false)
  }

  /** Preenche os atributos da categoria via IA a partir do produto. */
  async function fillWithAI() {
    setAiError(null); setAiFilling(true)
    try {
      const catId = preview?.predicted_category.category_id ?? undefined
      const suggestions = await CreativeApi.suggestMlAttributes(listingId, catId)
      setAttributes(prev => {
        const m = new Map(prev.map(v => [v.id, v]))
        for (const s of suggestions) {
          m.set(s.id, { id: s.id, value_id: s.value_id, value_name: s.value_name })
        }
        return [...m.values()]
      })
    } catch (e: unknown) {
      setAiError((e as Error).message)
    } finally {
      setAiFilling(false)
    }
  }

  // Preenchimento automático por IA — uma vez, só se o anúncio ainda não
  // tem atributos salvos (senão usa o que veio do editor).
  useEffect(() => {
    if (aiFilledRef.current) return
    if (!preview || preview.recommended_attributes.length === 0) return
    aiFilledRef.current = true
    if (attributes.length === 0) void fillWithAI()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview])

  // Auto-save dos atributos no anúncio (fonte única). Pula a carga inicial.
  const attrSaveRef = useRef(false)
  useEffect(() => {
    if (!ctx) return
    if (!attrSaveRef.current) { attrSaveRef.current = true; return }
    const t = setTimeout(() => {
      void CreativeApi.updateListing(listingId, { ml_attributes: attributes }).catch(() => {})
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributes, ctx])

  // Auto-save do título no anúncio + re-preview (recalcula a pendência de
  // tamanho). Pula a carga inicial.
  const titleSaveRef = useRef(false)
  useEffect(() => {
    if (!ctx) return
    if (!titleSaveRef.current) { titleSaveRef.current = true; return }
    const t = setTimeout(async () => {
      await CreativeApi.updateListing(listingId, { title }).catch(() => {})
      void buildPreview()
    }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, ctx])

  async function buildPreview() {
    if (!ctx) return
    setPreviewError(null); setPreviewing(true)
    try {
      const res = await CreativeApi.buildMlPreview(listingId, {
        image_ids:    imageIds,
        video_id:     videoId,
        price:        Number(price) || 0,
        stock:        Number(stock) || 0,
        listing_type: listingType,
        condition,
        attributes:   attributes.filter(a => a.value_id || a.value_name),
      })
      setPreview(res)
    } catch (e: unknown) {
      setPreviewError((e as Error).message)
    } finally {
      setPreviewing(false)
    }
  }

  // Auto-preview na mudança de campos críticos (debounce 600ms)
  useEffect(() => {
    if (!ctx) return
    const t = setTimeout(() => { void buildPreview() }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageIds, videoId, price, stock, listingType, condition, attributes, ctx])

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400" /></div>
  }
  if (error || !ctx) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
        <Link href={`/dashboard/creative/${productId}/listing/${listingId}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4">
          <ArrowLeft size={14} /> {t('back')}
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error ?? t('listingNotFound')}</div>
      </div>
    )
  }

  const { listing, product, approved_images, approved_videos, sku_suggestion } = ctx

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/dashboard/creative/${productId}/listing/${listingId}`} className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400">
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">🟡</span>
                <h1 className="text-base font-semibold truncate" title={listing.title}>{t('headerTitle')}</h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  {t('preview')}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 truncate">{t('headerSubtitle', { name: product.name, version: listing.version })}</p>
            </div>
          </div>
        </header>

        {/* Banner: estado da publicação */}
        {preview && !preview.publish_enabled && (
          <div className="mb-5 rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-xs text-zinc-300 flex items-start gap-2">
            <Lock size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>{t('publishDisabledBannerBold')}</strong>{t('publishDisabledBannerText')}
            </span>
          </div>
        )}
        {preview?.publish_enabled && (
          <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200 flex items-start gap-2">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>{t('publishEnabledBannerBold')}</strong>{t('publishEnabledBannerText')}
            </span>
          </div>
        )}

        {/* e-Otimizer SEO — checkpoint antes de publicar. */}
        <div className="mb-5">
          <ListingSeoPanel
            listingId={listingId}
            variant="compact"
            picturesCount={imageIds.length}
            listingVersion={ctx.listing.version}
            onJumpToField={scrollToSeoField}
          />
        </div>

        {/* Histórico de publicações */}
        {publications.length > 0 && (
          <div className="mb-5">
            <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('publicationsHistory')}</h3>
            <div className="space-y-1.5">
              {publications.slice(0, 5).map(p => (
                <PublicationRow key={p.id} pub={p} accountName={accountName(p.seller_id)} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Form */}
          <div className="space-y-6">
            {/* Conta(s) ML — onde o anúncio será publicado */}
            <Section icon={<Store size={14} />} title={t('accountsSection')}>
              {accounts.length === 0 ? (
                <p className="text-xs text-zinc-500">{t('noAccounts')}</p>
              ) : (
                <div className="space-y-1.5">
                  {accounts.map(a => {
                    const on = selectedSellerIds.includes(a.seller_id)
                    return (
                      <button
                        key={a.seller_id}
                        type="button"
                        onClick={() => setSelectedSellerIds(prev =>
                          on ? prev.filter(s => s !== a.seller_id) : [...prev, a.seller_id])}
                        className={[
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all',
                          on ? 'border-cyan-400/40 bg-cyan-400/5' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700',
                        ].join(' ')}
                      >
                        <span className={[
                          'flex items-center justify-center w-4 h-4 rounded border shrink-0 transition-colors',
                          on ? 'bg-cyan-400 border-cyan-400' : 'border-zinc-600',
                        ].join(' ')}>
                          {on && <Check size={11} className="text-black" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs text-zinc-200 font-medium truncate">
                            {a.nickname ?? t('accountFallback', { sellerId: a.seller_id })}
                          </span>
                          <span className="block text-[10px] text-zinc-500 font-mono">{a.seller_id}</span>
                        </span>
                      </button>
                    )
                  })}
                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSellerIds(
                        selectedSellerIds.length === accounts.length ? [] : accounts.map(a => a.seller_id))}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      {selectedSellerIds.length === accounts.length ? t('clearSelection') : t('selectAllAccounts')}
                    </button>
                  )}
                  <p className="text-[10px] text-zinc-600">
                    {t('accountsHint')}
                  </p>
                </div>
              )}
            </Section>

            {/* Title — editável */}
            <Section icon={<Tag size={14} />} title={t('titleSection')}>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                className="w-full text-xs text-zinc-100 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 outline-none focus:border-cyan-500/60"
              />
              <p className={`text-[10px] mt-1 ${title.length > 60 ? 'text-amber-400' : 'text-zinc-500'}`}>
                {title.length > 60
                  ? t('titleTooLong', { count: title.length })
                  : t('titleCount', { count: title.length })}
              </p>
            </Section>

            {/* Images */}
            <div data-seo-field="pictures">
              <Section icon={<ImageIcon size={14} />} title={t('imagesSection')}>
                <MLImageSelector
                  available={approved_images}
                  selected={imageIds}
                  onChange={setImageIds}
                />
              </Section>
            </div>

            {/* Video */}
            <Section icon={<Film size={14} />} title={t('videoSection')}>
              {approved_videos.length === 0 ? (
                <p className="text-xs text-zinc-500">{t('noApprovedVideos')}</p>
              ) : (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setVideoId(null)}
                    className={[
                      'w-full text-left px-3 py-2 rounded-lg text-xs transition-all border',
                      videoId === null
                        ? 'border-cyan-400/40 bg-cyan-400/5 text-cyan-100'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700',
                    ].join(' ')}
                  >
                    {t('noVideo')}
                  </button>
                  {approved_videos.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVideoId(v.id)}
                      className={[
                        'w-full text-left px-3 py-2 rounded-lg text-xs transition-all border flex items-center gap-2',
                        videoId === v.id
                          ? 'border-cyan-400/40 bg-cyan-400/5 text-cyan-100'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700',
                      ].join(' ')}
                    >
                      <span className="font-mono text-[10px] text-zinc-500">#{v.position}</span>
                      <span className="flex-1">{t('videoOption', { duration: v.duration_seconds })}</span>
                      {videoId === v.id && <CheckCircle2 size={12} className="text-cyan-400" />}
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {/* Category + Attributes */}
            <div data-seo-field="attributes">
            <Section icon={<Layers size={14} />} title={t('categorySection')}>
              {!preview ? (
                <p className="text-xs text-zinc-500">{t('waitingPreview')}</p>
              ) : !preview.predicted_category.category_id ? (
                <div className="flex items-start gap-2 text-xs text-amber-300">
                  <AlertCircle size={12} className="mt-0.5" />
                  <span>{t('categoryPredictFail')}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">{t('predictedCategory')}</span>
                      <span className="font-mono text-cyan-300 text-[10px]">{preview.predicted_category.category_id}</span>
                    </div>
                    <p className="text-zinc-200 mt-1">{preview.predicted_category.category_name}</p>
                    {preview.predicted_category.domain_name && (
                      <p className="text-[10px] text-zinc-500 mt-0.5">{t('domain', { name: preview.predicted_category.domain_name })}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                      {t('requiredAttributes', { count: preview.required_attributes.length })}
                    </p>
                    <MLAttributesForm
                      attributes={preview.required_attributes}
                      values={attributes}
                      onChange={setAttributes}
                    />
                  </div>
                </div>
              )}
            </Section>
            </div>

            {/* Atributos recomendados — preenchidos por IA, com "Não se aplica" */}
            {preview && preview.recommended_attributes.length > 0 && (
              <Section
                icon={<Sparkles size={14} />}
                title={t('recommendedAttributes')}
                actionLabel={aiFilling ? t('fillingAi') : t('fillWithAi')}
                onAction={aiFilling ? undefined : fillWithAI}
                actionLoading={aiFilling}
              >
                <p className="text-[11px] text-zinc-500 mb-2.5">
                  {t('recommendedAttributesIntro')}<span className="text-zinc-400">{t('notApplicable')}</span>{t('recommendedAttributesIntroSuffix')}
                </p>
                {aiError && (
                  <div className="mb-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-200 flex items-start gap-1.5">
                    <AlertCircle size={11} className="shrink-0 mt-0.5" />{aiError}
                  </div>
                )}
                <MLAttributesForm
                  attributes={preview.recommended_attributes}
                  values={attributes}
                  onChange={setAttributes}
                  allowNotApplicable
                />
              </Section>
            )}

            {/* Markup / precificação — calcula o preço de venda pela margem alvo */}
            <Section icon={<Calculator size={14} />} title={t('markupSection')}>
              <MarkupPanel
                defaultFeePercent={fallbackFeeRate(listingType)}
                currentPrice={price}
                onApplyPrice={p => setPrice(String(p))}
                listingId={listingId}
                listingType={listingType}
                initialDimensions={product.dimensions}
                onWholesaleChange={setWholesale}
              />
            </Section>

            {/* Pricing */}
            <Section icon={<DollarSign size={14} />} title={t('pricingSection')}>
              {sku_suggestion && (
                <div className="rounded-lg bg-cyan-400/5 border border-cyan-400/30 p-2 text-[11px] text-cyan-200 mb-3 flex items-start gap-2">
                  <Package size={11} className="mt-0.5 shrink-0" />
                  <span>
                    {t.rich('skuMatch', { sku: sku_suggestion.sku, b: (chunks) => <strong>{chunks}</strong> })}
                    {sku_suggestion.price != null && t('skuMatchPrice', { price: sku_suggestion.price.toFixed(2) })}
                    {sku_suggestion.stock != null && t('skuMatchStock', { stock: sku_suggestion.stock })}
                    {t('skuMatchHint')}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <NumberField label={t('fieldPrice')} value={price} onChange={setPrice} placeholder="99.90" step="0.01" />
                <NumberField label={t('fieldStock')} value={stock} onChange={setStock} placeholder="10" step="1" />
              </div>
            </Section>

            {/* Listing type + condition */}
            <Section icon={<Sparkles size={14} />} title={t('listingTypeSection')}>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t('modality')}</p>
                    {listingTypesFromApi !== null && (
                      <span className="text-[9px] text-cyan-300/70" title={t('mlApiTooltip')}>
                        {t('mlApiBadge')}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {/* Lista da API ML quando disponível, com descrição do hardcoded como fallback;
                        se a API falhar (array vazio), cai no hardcoded ML_LISTING_TYPE_OPTIONS pra UX */}
                    {(() => {
                      const apiList = listingTypesFromApi ?? []
                      // Mescla: prioriza API mas pega description do hardcoded se houver matching value
                      const merged: Array<{ value: MlListingType; label: string; description: string }> =
                        apiList.length > 0
                          ? apiList.map(t => {
                              const hc = ML_LISTING_TYPE_OPTIONS.find(o => o.value === t.id)
                              return {
                                value:       t.id as MlListingType,
                                label:       t.name,
                                description: hc?.description ?? '',
                              }
                            })
                          : ML_LISTING_TYPE_OPTIONS
                      return merged.map(o => (
                        <button
                          key={o.value} type="button" onClick={() => setListingType(o.value)}
                          className={[
                            'w-full text-left px-3 py-1.5 rounded-lg text-[11px] transition-all border',
                            listingType === o.value
                              ? 'border-cyan-400/40 bg-cyan-400/5 text-cyan-100'
                              : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{o.label}</span>
                            {listingType === o.value && <CheckCircle2 size={11} />}
                          </div>
                          {o.description && <p className="text-[10px] text-zinc-500 mt-0.5">{o.description}</p>}
                        </button>
                      ))
                    })()}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('condition')}</p>
                  <div className="flex gap-1.5">
                    {ML_CONDITION_OPTIONS.map(o => (
                      <button
                        key={o.value} type="button" onClick={() => setCondition(o.value)}
                        className={[
                          'flex-1 px-2.5 py-1.5 rounded-lg text-[11px] transition-all',
                          condition === o.value
                            ? 'bg-cyan-400 text-black font-semibold'
                            : 'bg-zinc-950 text-zinc-400 border border-zinc-800',
                        ].join(' ')}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* RIGHT: Preview */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Section icon={<Eye size={14} />} title={t('previewSection')}
              actionLabel={previewing ? t('updating') : t('update')}
              onAction={previewing ? undefined : buildPreview}
              actionLoading={previewing}
            >
              {previewError && (
                <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-200 flex items-start gap-1.5">
                  <AlertCircle size={11} className="mt-0.5 shrink-0" />{previewError}
                </div>
              )}

              {!preview && !previewError && (
                <div className="text-xs text-zinc-500 px-3 py-6 text-center">{t('waitingPreviewShort')}</div>
              )}

              {preview && (
                <div className="space-y-3">
                  {/* Status pill */}
                  <div className={[
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                    preview.ready
                      ? 'bg-emerald-400/10 text-emerald-200 border border-emerald-400/30'
                      : 'bg-amber-400/10 text-amber-200 border border-amber-400/30',
                  ].join(' ')}>
                    {preview.ready ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                    {preview.ready ? t('readyToPublish') : t('pendingCount', { count: preview.warnings.length })}
                  </div>

                  {/* Warnings */}
                  {preview.warnings.length > 0 && (
                    <ul className="space-y-1">
                      {preview.warnings.map((w, i) => (
                        <li key={i} className="text-[11px] text-amber-300 flex items-start gap-1.5">
                          <span className="text-amber-400 shrink-0">•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* JSON preview */}
                  <details className="rounded-lg border border-zinc-800 bg-zinc-950" open={false}>
                    <summary className="cursor-pointer px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900">
                      {t('payloadJson')}
                    </summary>
                    <pre className="px-3 py-2 text-[10px] text-zinc-300 max-h-96 overflow-auto leading-relaxed">
{JSON.stringify(preview.ml_payload, null, 2)}
                    </pre>
                    <div className="px-3 py-2 border-t border-zinc-800 flex justify-end">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(preview.ml_payload, null, 2))}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300"
                      >
                        {t('copyJson')}
                      </button>
                    </div>
                  </details>

                  {/* Publish button — estado depende de ready + publish_enabled */}
                  {!preview.publish_enabled ? (
                    <button
                      type="button"
                      disabled
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-semibold cursor-not-allowed"
                      title={t('publishDisabledBtnTooltip')}
                    >
                      <Lock size={12} /> {t('publishDisabledBtn')}
                    </button>
                  ) : !preview.ready ? (
                    <button
                      type="button"
                      disabled
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-semibold cursor-not-allowed"
                    >
                      <AlertCircle size={12} /> {t('resolvePending')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setPublishError(null); setConfirmOpen(true) }}
                      style={{ ['--glow-color' as string]: '#34d399' }}
                      className="submit-glow w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold"
                    >
                      <Send size={12} /> {t('publishNow')}
                    </button>
                  )}
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>

      {/* Confirm publish dialog */}
      {confirmOpen && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-zinc-950 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Send size={14} className="text-emerald-400" />
                <h3 className="text-sm font-semibold">{t('confirmTitle')}</h3>
              </div>
              <button onClick={() => setConfirmOpen(false)} disabled={publishing} className="text-zinc-500 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/30 p-3 text-xs text-amber-200 flex items-start gap-2">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>
                  {t.rich('pausedWarning', { b: (chunks) => <strong>{chunks}</strong> })}
                </span>
              </div>

              <ul className="text-xs text-zinc-300 space-y-1">
                <li>
                  <span className="text-zinc-500">{t('confirmAccounts')}</span>{' '}
                  <strong className="text-emerald-300">
                    {selectedSellerIds.length === 0
                      ? t('noneSelected')
                      : selectedSellerIds.map(s => accountName(s)).join(', ')}
                  </strong>
                </li>
                <li><span className="text-zinc-500">{t('confirmTitleLabel')}</span> {title.slice(0, 60)}</li>
                <li><span className="text-zinc-500">{t('confirmCategory')}</span> {preview.predicted_category.category_id ?? '—'}</li>
                <li><span className="text-zinc-500">{t('confirmImages')}</span> {imageIds.length}</li>
                <li><span className="text-zinc-500">{t('confirmPrice')}</span> R$ {(Number(price) || 0).toFixed(2)}</li>
                <li><span className="text-zinc-500">{t('confirmStock')}</span> {t('confirmStockUnit', { count: Number(stock) || 0 })}</li>
                <li><span className="text-zinc-500">{t('confirmModality')}</span> {listingType}</li>
              </ul>

              {storefrontAlready ? (
                <p className="rounded-lg bg-cyan-500/5 border border-cyan-500/25 p-3 text-xs text-cyan-200">
                  {t('storefrontAlready')}
                </p>
              ) : (
                <label className="flex items-start gap-2 rounded-lg bg-cyan-500/5 border border-cyan-500/25 p-3 text-xs cursor-pointer">
                  <input type="checkbox" checked={alsoStorefront}
                    onChange={e => setAlsoStorefront(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 shrink-0 mt-0.5" />
                  <span className="text-zinc-300">
                    {t.rich('alsoStorefront', { b: (chunks) => <strong className="text-cyan-300">{chunks}</strong> })}
                  </span>
                </label>
              )}

              {videoId && (
                <p className="text-[11px] text-amber-300">
                  {t('videoUploadNote')}
                </p>
              )}

              {publishError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200 flex items-start gap-1.5">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>{publishError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
              <button onClick={() => setConfirmOpen(false)} disabled={publishing}
                className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs">
                {t('cancel')}
              </button>
              <button onClick={publish} disabled={publishing || selectedSellerIds.length === 0}
                style={{ ['--glow-color' as string]: '#34d399' }}
                className="submit-glow flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-semibold">
                {publishing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {selectedSellerIds.length > 1
                  ? t('publishInAccounts', { count: selectedSellerIds.length })
                  : t('confirmPublish')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function PublicationRow({ pub: initial, accountName }: { pub: CreativePublication; accountName: string | null }) {
  const t = useTranslations('creative.publish')
  const [pub, setPub] = useState(initial)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [acking, setAcking]     = useState(false)
  const alertDialog = useAlert()

  // Re-sync com prop quando muda externamente
  useEffect(() => { setPub(initial) }, [initial])

  const isDegraded = !!pub.degraded_at && !pub.degradation_acknowledged_at

  async function ack() {
    setAcking(true)
    try {
      const updated = await CreativeApi.acknowledgeDegradation(pub.id)
      setPub(updated)
    } catch (e: unknown) {
      await alertDialog({ title: t('errorTitle'), message: (e as Error).message, variant: 'danger' })
    } finally {
      setAcking(false)
    }
  }

  const cfg: Record<CreativePublication['status'], { label: string; className: string }> = {
    pending:    { label: t('pubStatusPending'),    className: 'bg-zinc-900 text-zinc-400 border-zinc-700' },
    publishing: { label: t('pubStatusPublishing'), className: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' },
    published:  { label: t('pubStatusPublished'),  className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' },
    failed:     { label: t('pubStatusFailed'),     className: 'bg-red-500/10 text-red-300 border-red-500/30' },
  }
  const c = cfg[pub.status]

  async function sync() {
    if (syncing) return
    setSyncError(null); setSyncing(true)
    try {
      const updated = await CreativeApi.syncPublication(pub.id)
      setPub(updated)
    } catch (e: unknown) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className={[
      'rounded-lg border px-3 py-2',
      isDegraded ? 'border-amber-500/40 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/30',
    ].join(' ')}>
      {isDegraded && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-amber-200">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle size={12} className="shrink-0" />
            <span className="truncate">
              {t.rich('degradedText', {
                from: pub.degraded_from_status ?? '',
                to:   pub.degraded_to_status ?? '',
                date: new Date(pub.degraded_at!).toLocaleString('pt-BR'),
                b:    (chunks) => <strong>{chunks}</strong>,
                code: (chunks) => <code className="font-mono">{chunks}</code>,
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={ack}
            disabled={acking}
            className="shrink-0 text-[10px] text-amber-300 hover:text-amber-100 disabled:opacity-50"
          >
            {acking ? '…' : t('dismissAlert')}
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-[10px] border ${c.className}`}>{c.label}</span>
          {accountName && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border border-zinc-700 bg-zinc-900 text-zinc-300">
              <Store size={9} /> {accountName}
            </span>
          )}
          {pub.external_id && (
            <span className="font-mono text-cyan-300 text-[10px]">{pub.external_id}</span>
          )}
          {pub.last_synced_status && pub.status === 'published' && (
            <MlStatusBadge status={pub.last_synced_status} syncedAt={pub.last_synced_at} />
          )}
          <span className="text-zinc-500 text-[10px]">
            {new Date(pub.created_at).toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pub.status === 'published' && (
            <button
              type="button"
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-cyan-300 disabled:opacity-50"
              title={t('syncTooltip')}
            >
              {syncing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              {t('sync')}
            </button>
          )}
          {pub.external_url && (
            <a
              href={pub.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200"
            >
              <ExternalLink size={10} /> {t('viewOnMl')}
            </a>
          )}
        </div>
      </div>
      {pub.error_message && pub.status === 'failed' && (
        <p className="mt-1 text-[10px] text-red-300 truncate" title={pub.error_message}>
          ⚠ {pub.error_message}
        </p>
      )}
      {syncError && (
        <p className="mt-1 text-[10px] text-red-300">{t('syncError', { error: syncError })}</p>
      )}
    </div>
  )
}

function MlStatusBadge({ status, syncedAt }: { status: string; syncedAt: string | null }) {
  const t = useTranslations('creative.publish')
  const cfg: Record<string, { label: string; className: string }> = {
    active:           { label: t('mlStatusActive'),          className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' },
    paused:           { label: t('mlStatusPaused'),          className: 'bg-amber-400/10 text-amber-300 border-amber-400/30' },
    closed:           { label: t('mlStatusClosed'),          className: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
    under_review:     { label: t('mlStatusUnderReview'),     className: 'bg-blue-400/10 text-blue-300 border-blue-400/30' },
    inactive:         { label: t('mlStatusInactive'),        className: 'bg-red-500/10 text-red-300 border-red-500/30' },
    payment_required: { label: t('mlStatusPaymentRequired'), className: 'bg-red-500/10 text-red-300 border-red-500/30' },
  }
  const c = cfg[status] ?? { label: status, className: 'bg-zinc-900 text-zinc-300 border-zinc-700' }
  const hint = syncedAt ? t('mlSyncedAt', { date: new Date(syncedAt).toLocaleString('pt-BR') }) : t('mlNotSynced')
  return (
    <span title={hint} className={`px-2 py-0.5 rounded-full text-[10px] border ${c.className}`}>
      {t('mlStatusBadge', { status: c.label })}
    </span>
  )
}

function Section({
  icon, title, actionLabel, onAction, actionLoading, children,
}: {
  icon:           React.ReactNode
  title:          string
  actionLabel?:   string
  onAction?:      () => void
  actionLoading?: boolean
  children:       React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="text-cyan-400">{icon}</span>
          <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
        </div>
        {actionLabel && (
          <button
            type="button" onClick={onAction} disabled={!onAction || actionLoading}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-zinc-400 hover:text-cyan-300 hover:bg-zinc-900 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            {actionLabel}
          </button>
        )}
      </header>
      {children}
    </section>
  )
}

function NumberField({
  label, value, onChange, placeholder, step,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; step?: string }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
      />
    </div>
  )
}
