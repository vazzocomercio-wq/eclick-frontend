'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Sparkles, Check, Loader2, RefreshCw, X, AlertCircle, Eye, Edit3,
} from 'lucide-react'
import ListingEditor from '@/components/creative/ListingEditor'
import ListingPreview from '@/components/creative/ListingPreview'
import MarketplaceVariantTabs from '@/components/creative/MarketplaceVariantTabs'
import VersionHistory from '@/components/creative/VersionHistory'
import { CreativeApi } from '@/components/creative/api'
import type { CreativeListing, CreativeProduct, Marketplace } from '@/components/creative/types'

export default function ListingDetailPage() {
  const params = useParams<{ productId: string; listingId: string }>()
  const router = useRouter()
  const productId = params.productId
  const listingId = params.listingId

  const [product, setProduct]         = useState<CreativeProduct | null>(null)
  const [listing, setListing]         = useState<CreativeListing | null>(null)
  const [allListings, setAllListings] = useState<CreativeListing[]>([])
  const [activeVariant, setActiveVariant] = useState<Marketplace | null>(null)
  const [view, setView]               = useState<'edit' | 'preview'>('edit')

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Modal de regenerate
  const [regenOpen, setRegenOpen]         = useState(false)
  const [regenInstruction, setRegenInstruction] = useState('')
  const [regenerating, setRegenerating]   = useState(false)

  const [approving, setApproving] = useState(false)

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, listingId])

  async function loadAll() {
    setError(null)
    setLoading(true)
    try {
      const [p, l, list] = await Promise.all([
        CreativeApi.getProduct(productId),
        CreativeApi.getListing(listingId),
        CreativeApi.listProductListings(productId),
      ])
      setProduct(p)
      setListing(l)
      setAllListings(list)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function approve() {
    if (!listing) return
    setApproving(true)
    try {
      const next = await CreativeApi.approveListing(listing.id)
      setListing(next)
      setAllListings(prev => prev.map(x => (x.id === next.id ? next : x)))
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setApproving(false)
    }
  }

  async function regenerate() {
    if (!listing) return
    setRegenerating(true)
    try {
      const next = await CreativeApi.regenerateListing(listing.id, regenInstruction.trim() || undefined)
      setRegenOpen(false)
      setRegenInstruction('')
      router.push(`/dashboard/creative/${productId}/listing/${next.id}`)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" />
      </div>
    )
  }
  if (error || !product || !listing) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6">
        <Link href="/dashboard/creative" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 max-w-2xl">
          {error ?? 'Anúncio não encontrado'}
        </div>
      </div>
    )
  }

  const approved   = listing.status === 'approved'
  const cost       = (listing.generation_metadata?.cost_usd as number | undefined)
  const totalCost  = allListings.reduce((acc, l) => acc + ((l.generation_metadata?.cost_usd as number | undefined) ?? 0), 0)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/dashboard/creative/${productId}`}
              className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-cyan-400" />
                <h1 className="text-base font-semibold truncate" title={product.name}>{product.name}</h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                  v{listing.version}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 truncate">
                {product.category}{product.brand ? ` · ${product.brand}` : ''} · {listing.status}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setRegenOpen(true)}
              disabled={regenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-cyan-400/40 text-zinc-200 text-xs transition-all"
            >
              <RefreshCw size={12} /> Regenerar
            </button>
            {!approved && (
              <button
                type="button"
                onClick={approve}
                disabled={approving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-semibold transition-all"
              >
                {approving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Aprovar
              </button>
            )}
            {approved && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-xs">
                <Check size={12} /> aprovado
              </span>
            )}
          </div>
        </header>

        {/* View toggle (mobile) */}
        <div className="lg:hidden flex gap-2 mb-4">
          <ViewButton active={view === 'edit'}    onClick={() => setView('edit')}>    <Edit3 size={12} /> Editor    </ViewButton>
          <ViewButton active={view === 'preview'} onClick={() => setView('preview')}> <Eye size={12} /> Preview   </ViewButton>
        </div>

        {/* Main grid: editor + preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <div className={view === 'preview' ? 'hidden lg:block' : ''}>
            <ListingEditor
              listing={listing}
              onSaved={next => {
                setListing(next)
                setAllListings(prev => prev.map(x => x.id === next.id ? next : x))
              }}
              disabled={approved}
            />
          </div>

          {/* Preview + variants */}
          <div className={view === 'edit' ? 'hidden lg:block' : ''}>
            <div className="space-y-3 sticky top-4">
              <MarketplaceVariantTabs
                listing={listing}
                active={activeVariant}
                onSelect={setActiveVariant}
                onChange={next => {
                  setListing(next)
                  setAllListings(prev => prev.map(x => x.id === next.id ? next : x))
                }}
              />
              <ListingPreview
                listing={listing}
                variant={activeVariant ?? undefined}
                productImage={product.signed_image_url}
              />
              <UsageCard
                currentCost={cost}
                totalCost={totalCost}
                versionCount={allListings.length}
              />
            </div>
          </div>
        </div>

        {/* Version history */}
        <div className="mt-6">
          <VersionHistory
            listings={allListings}
            productId={productId}
            currentListingId={listing.id}
          />
        </div>
      </div>

      {/* Regenerate modal */}
      {regenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className="text-cyan-400" />
                <h3 className="text-sm font-semibold">Regenerar anúncio</h3>
              </div>
              <button onClick={() => setRegenOpen(false)} className="text-zinc-500 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-400">
                Cria uma <strong className="text-zinc-200">nova versão (v{listing.version + 1})</strong>.
                A atual fica preservada no histórico.
              </p>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                  Instrução (opcional)
                </label>
                <textarea
                  value={regenInstruction}
                  onChange={e => setRegenInstruction(e.target.value)}
                  placeholder="Ex: deixa o título mais curto, usa tom mais técnico, foca no benefício de durabilidade…"
                  rows={4}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600 resize-y"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
              <button
                onClick={() => setRegenOpen(false)}
                className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={regenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-semibold"
              >
                {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Regenerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ViewButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center justify-center gap-1.5 flex-1 px-3 py-1.5 rounded-lg text-xs transition-all',
        active
          ? 'bg-cyan-400 text-black font-semibold'
          : 'bg-zinc-900 text-zinc-400 border border-zinc-800',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function UsageCard({
  currentCost, totalCost, versionCount,
}: {
  currentCost?:  number
  totalCost:     number
  versionCount:  number
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
      <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Custo da geração</h4>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-zinc-500 text-[10px]">Esta versão</p>
          <p className="text-zinc-100 font-mono">${(currentCost ?? 0).toFixed(4)}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-[10px]">Total no produto</p>
          <p className="text-zinc-100 font-mono">${totalCost.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-[10px]">Versões</p>
          <p className="text-zinc-100 font-mono">{versionCount}</p>
        </div>
      </div>
    </div>
  )
}
