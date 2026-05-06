'use client'

import { useState } from 'react'
import { Link2, Link2Off, Loader2, Check, AlertCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { CreativeApi } from './api'
import type { CreativeProduct } from './types'

interface Props {
  creative:   CreativeProduct
  onChange:   (next: CreativeProduct) => void
}

/**
 * Banner mostrado no detalhe do creative_product.
 * - Se vinculado: mostra link pro produto no catálogo + botão desvincular
 * - Se não vinculado: oferece "Salvar no catálogo" (cria products row + vincula)
 *
 * Onda 1 M1.
 */
export default function CatalogLinkBanner({ creative, onChange }: Props) {
  const [busy, setBusy]     = useState<null | 'save' | 'unlink'>(null)
  const [error, setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const linked = !!creative.product_id

  async function saveToCatalog() {
    if (!confirm('Criar este produto no catálogo mestre? Vai aparecer em /dashboard/produtos com os dados que a IA já levantou.')) return
    setError(null); setSuccess(null); setBusy('save')
    try {
      const res = await CreativeApi.creativeToCatalog(creative.id)
      onChange(res.creative)
      setSuccess(`Produto criado no catálogo. ID ${res.catalog_product_id.slice(0, 8)}…`)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function unlink() {
    if (!confirm('Desvincular este criativo do catálogo? O produto continua existindo no catálogo, só perde o link com este criativo.')) return
    setError(null); setSuccess(null); setBusy('unlink')
    try {
      const next = await CreativeApi.updateProduct(creative.id, { product_id: null })
      onChange(next)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (linked) {
    return (
      <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 size={14} className="text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-emerald-200 font-medium">Vinculado ao catálogo</p>
            <p className="text-[10px] text-zinc-500 truncate">
              ID <code className="font-mono">{creative.product_id?.slice(0, 8)}…</code> · alterações no catálogo refletem aqui
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/dashboard/produtos/${creative.product_id}`}
            className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-100"
          >
            <ExternalLink size={11} /> ver no catálogo
          </Link>
          <button
            type="button"
            onClick={unlink}
            disabled={!!busy}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-400 disabled:opacity-50"
            title="Desvincular do catálogo (não apaga o produto)"
          >
            {busy === 'unlink' ? <Loader2 size={10} className="animate-spin" /> : <Link2Off size={10} />}
            desvincular
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Link2Off size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-amber-200 font-medium">Não vinculado ao catálogo mestre</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Este criativo existe só no módulo IA Criativo. Pra ele aparecer em <code className="font-mono">/produtos</code>,
            controle de estoque e sincronizar com marketplaces, salve no catálogo.
          </p>
        </div>
      </div>
      {error && (
        <div className="flex items-start gap-1 text-[11px] text-red-400">
          <AlertCircle size={11} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-1 text-[11px] text-emerald-300">
          <Check size={11} className="mt-0.5 shrink-0" /><span>{success}</span>
        </div>
      )}
      <button
        type="button"
        onClick={saveToCatalog}
        disabled={!!busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black text-xs font-semibold"
      >
        {busy === 'save' ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
        Salvar no catálogo
      </button>
    </div>
  )
}
