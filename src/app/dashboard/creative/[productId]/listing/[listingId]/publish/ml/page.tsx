'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, Loader2, AlertCircle, CheckCircle2, RefreshCw,
  Image as ImageIcon, Film, Tag, DollarSign, Package, Eye, Layers, ExternalLink, Send, Lock, X,
} from 'lucide-react'
import MLImageSelector from '@/components/creative/MLImageSelector'
import MLAttributesForm from '@/components/creative/MLAttributesForm'
import { CreativeApi } from '@/components/creative/api'
import {
  ML_LISTING_TYPE_OPTIONS, ML_CONDITION_OPTIONS,
  type MlPublishContext, type MlPreviewResponse,
  type MlListingType, type MlCondition,
  type CreativePublication,
} from '@/components/creative/types'

interface AttributeValue { id: string; value_name?: string; value_id?: string }

export default function MLPublishPage() {
  const params = useParams<{ productId: string; listingId: string }>()
  const productId = params.productId
  const listingId = params.listingId

  const [ctx, setCtx]             = useState<MlPublishContext | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Form state
  const [imageIds, setImageIds]   = useState<string[]>([])
  const [videoId, setVideoId]     = useState<string | null>(null)
  const [price, setPrice]         = useState<string>('')
  const [stock, setStock]         = useState<string>('')
  const [listingType, setListingType] = useState<MlListingType>('free')
  const [condition, setCondition] = useState<MlCondition>('new')
  const [attributes, setAttributes] = useState<AttributeValue[]>([])

  // Preview
  const [preview, setPreview]     = useState<MlPreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Publications
  const [publications, setPublications] = useState<CreativePublication[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [publishing, setPublishing]   = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

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
      const [c, pubs] = await Promise.all([
        CreativeApi.getMlContext(listingId),
        CreativeApi.listListingPublications(listingId).catch(() => []),
      ])
      setCtx(c)
      setPublications(pubs)
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
    setPublishError(null); setPublishing(true)
    try {
      const idempotency_key = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const pub = await CreativeApi.publishMl(listingId, {
        idempotency_key,
        image_ids:    imageIds,
        video_id:     videoId,
        price:        Number(price) || 0,
        stock:        Number(stock) || 0,
        listing_type: listingType,
        condition,
        attributes:   attributes.filter(a => a.value_id || a.value_name),
      })
      setConfirmOpen(false)
      // Atualiza histórico
      setPublications(prev => [pub, ...prev.filter(p => p.id !== pub.id)])
    } catch (e: unknown) {
      setPublishError((e as Error).message)
    } finally {
      setPublishing(false)
    }
  }

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
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error ?? 'Listing não encontrado'}</div>
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
                <h1 className="text-base font-semibold truncate" title={listing.title}>Publicar no Mercado Livre</h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  PREVIEW
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 truncate">{product.name} · v{listing.version}</p>
            </div>
          </div>
        </header>

        {/* Banner: estado da publicação */}
        {preview && !preview.publish_enabled && (
          <div className="mb-5 rounded-lg border border-zinc-700 bg-zinc-900/50 p-3 text-xs text-zinc-300 flex items-start gap-2">
            <Lock size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>Publicação real desabilitada</strong> — set <code className="font-mono text-cyan-300">CREATIVE_ML_PUBLISH_ENABLED=true</code> no Railway pra ativar. Por enquanto preview-only, JSON copiável.
            </span>
          </div>
        )}
        {preview?.publish_enabled && (
          <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200 flex items-start gap-2">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span>
              <strong>Publicação ATIVA</strong> — anúncios são criados em <code className="font-mono">paused</code> no ML. Você revisa e ativa manualmente lá.
            </span>
          </div>
        )}

        {/* Histórico de publicações */}
        {publications.length > 0 && (
          <div className="mb-5">
            <h3 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Publicações desse anúncio</h3>
            <div className="space-y-1.5">
              {publications.slice(0, 5).map(p => (
                <PublicationRow key={p.id} pub={p} />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Form */}
          <div className="space-y-6">
            {/* Title preview (read-only) */}
            <Section icon={<Tag size={14} />} title="Título do anúncio">
              <p className="text-xs text-zinc-300 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800">
                {listing.title}
              </p>
              {listing.title.length > 60 && (
                <p className="text-[10px] text-amber-400 mt-1">
                  ⚠️ {listing.title.length} chars — ML aceita máx 60. Será truncado.
                </p>
              )}
            </Section>

            {/* Images */}
            <Section icon={<ImageIcon size={14} />} title="Imagens (1-10)">
              <MLImageSelector
                available={approved_images}
                selected={imageIds}
                onChange={setImageIds}
              />
            </Section>

            {/* Video */}
            <Section icon={<Film size={14} />} title="Vídeo (opcional)">
              {approved_videos.length === 0 ? (
                <p className="text-xs text-zinc-500">Nenhum vídeo aprovado disponível.</p>
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
                    Sem vídeo
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
                      <span className="flex-1">Vídeo {v.duration_seconds}s</span>
                      {videoId === v.id && <CheckCircle2 size={12} className="text-cyan-400" />}
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {/* Category + Attributes */}
            <Section icon={<Layers size={14} />} title="Categoria & atributos">
              {!preview ? (
                <p className="text-xs text-zinc-500">Aguardando preview…</p>
              ) : !preview.predicted_category.category_id ? (
                <div className="flex items-start gap-2 text-xs text-amber-300">
                  <AlertCircle size={12} className="mt-0.5" />
                  <span>Não foi possível predizer categoria pelo título. (F3 vai permitir busca manual.)</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Categoria predita:</span>
                      <span className="font-mono text-cyan-300 text-[10px]">{preview.predicted_category.category_id}</span>
                    </div>
                    <p className="text-zinc-200 mt-1">{preview.predicted_category.category_name}</p>
                    {preview.predicted_category.domain_name && (
                      <p className="text-[10px] text-zinc-500 mt-0.5">domínio: {preview.predicted_category.domain_name}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                      Atributos obrigatórios ({preview.required_attributes.length})
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

            {/* Pricing */}
            <Section icon={<DollarSign size={14} />} title="Preço & estoque">
              {sku_suggestion && (
                <div className="rounded-lg bg-cyan-400/5 border border-cyan-400/30 p-2 text-[11px] text-cyan-200 mb-3 flex items-start gap-2">
                  <Package size={11} className="mt-0.5 shrink-0" />
                  <span>
                    Match SKU <strong>{sku_suggestion.sku}</strong>:
                    {sku_suggestion.price != null && ` preço R$ ${sku_suggestion.price.toFixed(2)},`}
                    {sku_suggestion.stock != null && ` estoque ${sku_suggestion.stock}.`}
                    {' '}Pré-preenchido — ajuste se quiser.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Preço (R$) *" value={price} onChange={setPrice} placeholder="99.90" step="0.01" />
                <NumberField label="Estoque *"     value={stock} onChange={setStock} placeholder="10" step="1" />
              </div>
            </Section>

            {/* Listing type + condition */}
            <Section icon={<Sparkles size={14} />} title="Tipo de anúncio & condição">
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Modalidade</p>
                  <div className="space-y-1">
                    {ML_LISTING_TYPE_OPTIONS.map(o => (
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
                        <p className="text-[10px] text-zinc-500 mt-0.5">{o.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Condição</p>
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
            <Section icon={<Eye size={14} />} title="Preview do payload ML"
              actionLabel={previewing ? 'Atualizando…' : 'Atualizar'}
              onAction={previewing ? undefined : buildPreview}
              actionLoading={previewing}
            >
              {previewError && (
                <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-200 flex items-start gap-1.5">
                  <AlertCircle size={11} className="mt-0.5 shrink-0" />{previewError}
                </div>
              )}

              {!preview && !previewError && (
                <div className="text-xs text-zinc-500 px-3 py-6 text-center">Aguardando preview…</div>
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
                    {preview.ready ? 'Pronto pra publicação (F3)' : `${preview.warnings.length} pendência${preview.warnings.length === 1 ? '' : 's'}`}
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
                      Payload JSON (copiável)
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
                        copiar JSON
                      </button>
                    </div>
                  </details>

                  {/* Publish button — estado depende de ready + publish_enabled */}
                  {!preview.publish_enabled ? (
                    <button
                      type="button"
                      disabled
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-semibold cursor-not-allowed"
                      title="Setar CREATIVE_ML_PUBLISH_ENABLED=true no Railway pra ativar"
                    >
                      <Lock size={12} /> Publicação desabilitada
                    </button>
                  ) : !preview.ready ? (
                    <button
                      type="button"
                      disabled
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs font-semibold cursor-not-allowed"
                    >
                      <AlertCircle size={12} /> Resolver pendências antes de publicar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setPublishError(null); setConfirmOpen(true) }}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold shadow-[0_0_12px_rgba(74,222,128,0.25)] transition-all"
                    >
                      <Send size={12} /> Publicar agora no ML (paused)
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
                <h3 className="text-sm font-semibold">Publicar no Mercado Livre</h3>
              </div>
              <button onClick={() => setConfirmOpen(false)} disabled={publishing} className="text-zinc-500 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/30 p-3 text-xs text-amber-200 flex items-start gap-2">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                <span>
                  Anúncio será criado com status <code className="font-mono">paused</code>.
                  Você precisa abrir no ML, revisar e <strong>ativar manualmente</strong> pra ficar visível.
                </span>
              </div>

              <ul className="text-xs text-zinc-300 space-y-1">
                <li><span className="text-zinc-500">Título:</span> {ctx?.listing.title.slice(0, 60)}</li>
                <li><span className="text-zinc-500">Categoria:</span> {preview.predicted_category.category_id ?? '—'}</li>
                <li><span className="text-zinc-500">Imagens:</span> {imageIds.length}</li>
                <li><span className="text-zinc-500">Preço:</span> R$ {(Number(price) || 0).toFixed(2)}</li>
                <li><span className="text-zinc-500">Estoque:</span> {Number(stock) || 0} un</li>
                <li><span className="text-zinc-500">Modalidade:</span> {listingType}</li>
              </ul>

              {videoId && (
                <p className="text-[11px] text-amber-300">
                  ℹ️ Vídeo selecionado mas <strong>não vai pro ML nesta versão</strong> — upload de vídeo será adicionado em F3.1.
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
                Cancelar
              </button>
              <button onClick={publish} disabled={publishing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-semibold">
                {publishing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Confirmar publicação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function PublicationRow({ pub }: { pub: CreativePublication }) {
  const cfg: Record<CreativePublication['status'], { label: string; className: string }> = {
    pending:    { label: 'pendente',    className: 'bg-zinc-900 text-zinc-400 border-zinc-700' },
    publishing: { label: 'publicando',  className: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' },
    published:  { label: '✓ publicado', className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' },
    failed:     { label: '✗ falhou',    className: 'bg-red-500/10 text-red-300 border-red-500/30' },
  }
  const c = cfg[pub.status]
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${c.className}`}>{c.label}</span>
        {pub.external_id && (
          <span className="font-mono text-cyan-300 text-[10px]">{pub.external_id}</span>
        )}
        <span className="text-zinc-500 text-[10px] truncate">
          {new Date(pub.created_at).toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {pub.error_message && pub.status === 'failed' && (
          <span className="text-[10px] text-red-300 truncate max-w-xs" title={pub.error_message}>
            {pub.error_message.slice(0, 60)}
          </span>
        )}
        {pub.external_url && (
          <a
            href={pub.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-amber-300 hover:text-amber-200"
          >
            <ExternalLink size={10} /> ver no ML
          </a>
        )}
      </div>
    </div>
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
