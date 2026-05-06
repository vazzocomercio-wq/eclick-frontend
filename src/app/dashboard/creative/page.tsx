'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Sparkles, Loader2, Image as ImageIcon, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import CreativeUsageCard from '@/components/creative/CreativeUsageCard'
import type { CreativeProduct } from '@/components/creative/types'

export default function CreativeListPage() {
  const [products, setProducts] = useState<CreativeProduct[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setError(null)
    try {
      const list = await CreativeApi.listProducts()
      setProducts(list)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-cyan-400" />
            <h1 className="text-lg font-semibold">IA Criativo</h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
              BETA
            </span>
          </div>
          <Link
            href="/dashboard/creative/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold transition-all shadow-[0_0_12px_rgba(0,229,255,0.25)]"
          >
            <Plus size={14} /> Novo produto
          </Link>
        </header>

        <p className="text-sm text-zinc-400 mb-6 max-w-2xl">
          Esteira completa de criação de anúncios. Suba uma imagem do produto e a IA
          gera título, descrição, bullets, ficha técnica e palavras-chave otimizados
          pro marketplace que você escolher.
        </p>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <CreativeUsageCard />

        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 size={14} className="animate-spin" /> Carregando produtos…
          </div>
        ) : products.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
      <div className="inline-flex p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4">
        <Sparkles size={28} className="text-cyan-400" />
      </div>
      <h2 className="text-base font-semibold text-zinc-200">Nenhum produto criativo ainda</h2>
      <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
        Comece subindo a foto do seu primeiro produto. A IA cuida do resto.
      </p>
      <Link
        href="/dashboard/creative/new"
        className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold transition-all"
      >
        <Plus size={14} /> Criar primeiro produto
      </Link>
    </div>
  )
}

function ProductCard({ product }: { product: CreativeProduct }) {
  const status = product.status
  return (
    <Link
      href={`/dashboard/creative/${product.id}`}
      className="group block rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50 hover:border-cyan-400/40 hover:bg-zinc-900 transition-all"
    >
      <div className="aspect-square bg-zinc-950 relative overflow-hidden">
        {product.signed_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.signed_image_url}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-700">
            <ImageIcon size={32} />
          </div>
        )}
        <StatusBadge status={status} />
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-zinc-100 truncate" title={product.name}>
          {product.name}
        </h3>
        <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
          {product.category}{product.brand ? ` · ${product.brand}` : ''}
        </p>
      </div>
    </Link>
  )
}

function StatusBadge({ status }: { status: CreativeProduct['status'] }) {
  const config: Record<CreativeProduct['status'], { icon: React.ReactNode; label: string; className: string }> = {
    draft:     { icon: <Clock size={10} />,        label: 'Rascunho',  className: 'bg-zinc-900 text-zinc-300 border-zinc-700' },
    analyzing: { icon: <Loader2 size={10} className="animate-spin" />, label: 'Analisando', className: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' },
    ready:     { icon: <CheckCircle2 size={10} />, label: 'Pronto',    className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' },
    archived:  { icon: <Clock size={10} />,        label: 'Arquivado', className: 'bg-zinc-900 text-zinc-500 border-zinc-700' },
  }
  const c = config[status]
  return (
    <span className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${c.className}`}>
      {c.icon} {c.label}
    </span>
  )
}
