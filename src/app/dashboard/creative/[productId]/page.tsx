'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Plus, Loader2, Image as ImageIcon, Check, RefreshCw, FileText } from 'lucide-react'
import ProductAnalysisCard from '@/components/creative/ProductAnalysisCard'
import { CreativeApi } from '@/components/creative/api'
import type { CreativeProduct, CreativeBriefing, CreativeListing } from '@/components/creative/types'
import { MARKETPLACE_OPTIONS } from '@/components/creative/types'

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>()
  const productId = params.productId

  const [product, setProduct]       = useState<CreativeProduct | null>(null)
  const [briefings, setBriefings]   = useState<CreativeBriefing[]>([])
  const [listings, setListings]     = useState<CreativeListing[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [regenAnalyzing, setRegenAnalyzing] = useState(false)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const [p, br, ls] = await Promise.all([
        CreativeApi.getProduct(productId),
        CreativeApi.listBriefings(productId),
        CreativeApi.listProductListings(productId),
      ])
      setProduct(p)
      setBriefings(br)
      setListings(ls)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function reanalyze() {
    if (!product) return
    setRegenAnalyzing(true)
    try {
      const updated = await CreativeApi.analyzeProduct(product.id)
      setProduct(updated)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setRegenAnalyzing(false)
    }
  }

  async function generateNew(briefingId: string) {
    if (!product) return
    try {
      const newListing = await CreativeApi.generateListing(product.id, briefingId)
      window.location.href = `/dashboard/creative/${product.id}/listing/${newListing.id}`
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" />
      </div>
    )
  }
  if (error || !product) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
        <Link href="/dashboard/creative" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 max-w-2xl">
          {error ?? 'Produto não encontrado'}
        </div>
      </div>
    )
  }

  const activeBriefing = briefings.find(b => b.is_active) ?? briefings[0]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-3 mb-5">
          <Link href="/dashboard/creative" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={16} className="text-cyan-400" />
            <h1 className="text-base font-semibold truncate" title={product.name}>{product.name}</h1>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Image */}
          <div className="md:col-span-1">
            <div className="aspect-square rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              {product.signed_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.signed_image_url}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-700">
                  <ImageIcon size={36} />
                </div>
              )}
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-zinc-400">
              {product.brand    && <p><span className="text-zinc-600">Marca:</span> {product.brand}</p>}
              {product.color    && <p><span className="text-zinc-600">Cor:</span> {product.color}</p>}
              {product.material && <p><span className="text-zinc-600">Material:</span> {product.material}</p>}
              {product.sku      && <p><span className="text-zinc-600">SKU:</span> {product.sku}</p>}
              {product.target_audience && (
                <p><span className="text-zinc-600">Público:</span> {product.target_audience}</p>
              )}
            </div>

            {!!product.differentials?.length && (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Diferenciais</p>
                <div className="flex flex-wrap gap-1">
                  {product.differentials.map((d, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-200 border border-cyan-400/30">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Analysis + actions */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">Análise IA</h2>
              <button
                type="button"
                onClick={reanalyze}
                disabled={regenAnalyzing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-cyan-400/40 text-zinc-300 text-[11px]"
              >
                <RefreshCw size={10} className={regenAnalyzing ? 'animate-spin' : ''} />
                Re-analisar
              </button>
            </div>
            <ProductAnalysisCard
              analysis={product.ai_analysis}
              loading={regenAnalyzing}
            />

            {/* Briefings + generate */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-200 mb-2">Briefings</h2>
              {briefings.length === 0 ? (
                <p className="text-xs text-zinc-500">Nenhum briefing ainda.</p>
              ) : (
                <div className="space-y-2">
                  {briefings.map(b => {
                    const opt = MARKETPLACE_OPTIONS.find(m => m.value === b.target_marketplace)
                    return (
                      <div key={b.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2">
                        <div className="flex items-center gap-2 text-xs min-w-0">
                          <span>{opt?.emoji}</span>
                          <span className="text-zinc-200 truncate">{opt?.label ?? b.target_marketplace}</span>
                          <span className="text-[10px] text-zinc-500">· {b.visual_style}</span>
                          <span className="text-[10px] text-zinc-500">· {b.communication_tone}</span>
                          {b.is_active && (
                            <span className="text-[10px] text-emerald-400">✓ ativo</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => generateNew(b.id)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-cyan-400 text-black font-semibold hover:bg-cyan-300 shrink-0"
                        >
                          <Plus size={10} /> Novo anúncio
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              {activeBriefing && (
                <Link
                  href={`/dashboard/creative/new?productId=${product.id}`}
                  className="text-[11px] text-zinc-500 hover:text-cyan-400 mt-2 inline-block"
                >
                  + Adicionar briefing pra outro marketplace
                </Link>
              )}
            </div>

            {/* Listings */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
                <FileText size={14} /> Anúncios gerados
                <span className="text-[10px] text-zinc-500">({listings.length})</span>
              </h2>
              {listings.length === 0 ? (
                <p className="text-xs text-zinc-500">Nenhum anúncio gerado ainda. Use um briefing pra começar.</p>
              ) : (
                <div className="space-y-1.5">
                  {listings.map(l => (
                    <Link
                      key={l.id}
                      href={`/dashboard/creative/${product.id}/listing/${l.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 hover:border-cyan-400/40 bg-zinc-900/30 hover:bg-zinc-900 px-3 py-2 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex items-center justify-center h-6 w-6 rounded-md text-[10px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-800">
                          v{l.version}
                        </span>
                        <p className="text-xs text-zinc-200 truncate" title={l.title}>{l.title}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {l.status === 'approved' && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                            <Check size={10} /> aprovado
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500">
                          {new Date(l.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
