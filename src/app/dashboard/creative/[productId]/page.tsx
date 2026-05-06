'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Plus, Loader2, Image as ImageIcon, Check, RefreshCw, FileText, X, Wand2, AlertCircle } from 'lucide-react'
import ProductAnalysisCard from '@/components/creative/ProductAnalysisCard'
import CanvaButton from '@/components/creative/CanvaButton'
import { CreativeApi } from '@/components/creative/api'
import type {
  CreativeProduct, CreativeBriefing, CreativeListing,
  CreativeImageJob, JobStatus,
} from '@/components/creative/types'
import { MARKETPLACE_OPTIONS, JOB_STATUS_LABELS, isJobActive } from '@/components/creative/types'

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>()
  const productId = params.productId

  const [product, setProduct]       = useState<CreativeProduct | null>(null)
  const [briefings, setBriefings]   = useState<CreativeBriefing[]>([])
  const [listings, setListings]     = useState<CreativeListing[]>([])
  const [imageJobs, setImageJobs]   = useState<CreativeImageJob[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [regenAnalyzing, setRegenAnalyzing] = useState(false)
  const [imageModalOpen, setImageModalOpen] = useState(false)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  async function load() {
    setError(null)
    setLoading(true)
    try {
      const [p, br, ls, jobs] = await Promise.all([
        CreativeApi.getProduct(productId),
        CreativeApi.listBriefings(productId),
        CreativeApi.listProductListings(productId),
        CreativeApi.listProductImageJobs(productId),
      ])
      setProduct(p)
      setBriefings(br)
      setListings(ls)
      setImageJobs(jobs)
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

            <div className="mt-3">
              <CanvaButton
                imageUrl={product.signed_image_url}
                title={product.name}
                variant="full"
              />
            </div>
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

            {/* Image jobs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <ImageIcon size={14} /> Imagens geradas
                  <span className="text-[10px] text-zinc-500">({imageJobs.length})</span>
                </h2>
                {briefings.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setImageModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-[11px] font-semibold transition-all shadow-[0_0_8px_rgba(0,229,255,0.25)]"
                  >
                    <Wand2 size={11} /> Gerar imagens
                  </button>
                )}
              </div>
              {imageJobs.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  {briefings.length === 0
                    ? 'Crie um briefing primeiro pra gerar imagens.'
                    : 'Nenhum job rodado ainda. Clique em "Gerar imagens" pra começar.'}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {imageJobs.map(j => (
                    <Link
                      key={j.id}
                      href={`/dashboard/creative/${productId}/images/${j.id}`}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 hover:border-cyan-400/40 bg-zinc-900/30 hover:bg-zinc-900 px-3 py-2 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <JobStatusDot status={j.status} />
                        <p className="text-xs text-zinc-200 truncate">
                          {j.requested_count} imagens · {JOB_STATUS_LABELS[j.status]}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {j.approved_count > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                            <Check size={10} /> {j.approved_count} aprovadas
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-500">
                          ${Number(j.total_cost_usd).toFixed(3)}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(j.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
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

      {imageModalOpen && product && (
        <CreateImageJobModal
          product={product}
          briefings={briefings}
          onClose={() => setImageModalOpen(false)}
          onCreated={(jobId) => {
            setImageModalOpen(false)
            window.location.href = `/dashboard/creative/${product.id}/images/${jobId}`
          }}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function JobStatusDot({ status }: { status: JobStatus }) {
  const cfg: Record<JobStatus, string> = {
    queued:             'bg-zinc-500',
    generating_prompts: 'bg-cyan-400 animate-pulse',
    generating_images:  'bg-cyan-400 animate-pulse',
    completed:          'bg-emerald-400',
    failed:             'bg-red-500',
    cancelled:          'bg-zinc-600',
  }
  return <span className={`h-2 w-2 rounded-full shrink-0 ${cfg[status]}`} />
}

function CreateImageJobModal({
  product, briefings, onClose, onCreated,
}: {
  product:    CreativeProduct
  briefings:  CreativeBriefing[]
  onClose:    () => void
  onCreated:  (jobId: string) => void
}) {
  const activeBriefings = briefings.filter(b => b.is_active).length > 0
    ? briefings.filter(b => b.is_active)
    : briefings

  const [briefingId, setBriefingId] = useState(activeBriefings[0]?.id ?? '')
  const [count, setCount]           = useState(activeBriefings[0]?.image_count ?? 10)
  const [maxCost, setMaxCost]       = useState(1.0)
  const [creating, setCreating]     = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Atualiza count quando user muda briefing (default = image_count do briefing)
  useEffect(() => {
    const b = briefings.find(x => x.id === briefingId)
    if (b) setCount(b.image_count)
  }, [briefingId, briefings])

  async function submit() {
    if (!briefingId) { setError('Selecione um briefing.'); return }
    setError(null)
    setCreating(true)
    try {
      const job = await CreativeApi.createImageJob({
        product_id:   product.id,
        briefing_id:  briefingId,
        count,
        max_cost_usd: maxCost,
      })
      onCreated(job.id)
    } catch (e: unknown) {
      setError((e as Error).message)
      setCreating(false)
    }
  }

  const estimatedCost = (count * 0.04)
  const willBlock     = estimatedCost > maxCost

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Wand2 size={14} className="text-cyan-400" />
            <h3 className="text-sm font-semibold">Gerar imagens</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-zinc-400">
            A IA gera {count} prompts coerentes (hero, lifestyle, close-up, etc.) e
            usa a imagem do produto como referência pra gerar cada uma.
          </p>

          {/* Briefing selector */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">Briefing</label>
            <select
              value={briefingId}
              onChange={e => setBriefingId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400"
            >
              {briefings.map(b => {
                const opt = MARKETPLACE_OPTIONS.find(m => m.value === b.target_marketplace)
                return (
                  <option key={b.id} value={b.id}>
                    {opt?.emoji} {opt?.label} · {b.visual_style} · {b.image_count} img
                  </option>
                )
              })}
            </select>
          </div>

          {/* Count slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Quantidade</label>
              <span className="text-xs font-mono text-zinc-200">{count}</span>
            </div>
            <input
              type="range" min={1} max={20} step={1}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          {/* Max cost */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-wider text-zinc-500">Limite de custo</label>
              <span className="text-xs font-mono text-zinc-200">${maxCost.toFixed(2)}</span>
            </div>
            <input
              type="range" min={0.1} max={5} step={0.1}
              value={maxCost}
              onChange={e => setMaxCost(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* Cost estimate */}
          <div className={[
            'rounded-lg border p-3 text-xs',
            willBlock
              ? 'border-red-500/30 bg-red-500/5 text-red-200'
              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400',
          ].join(' ')}>
            <div className="flex items-center justify-between">
              <span>Custo estimado:</span>
              <span className="font-mono">~${estimatedCost.toFixed(2)}</span>
            </div>
            {willBlock && (
              <p className="mt-1 text-[10px]">
                <AlertCircle size={10} className="inline mr-1" />
                Estimativa excede o limite — worker vai parar antes de completar.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-200">
              <AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={creating || !briefingId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            Iniciar geração
          </button>
        </div>
      </div>
    </div>
  )
}
