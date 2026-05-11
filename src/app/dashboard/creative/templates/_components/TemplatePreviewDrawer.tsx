'use client'

/**
 * Drawer lateral 600px com preview do template renderizado pra um produto.
 *
 * Fluxo:
 *   - Open: carrega produtos da org (CreativeApi.listProducts) pra dropdown
 *   - User seleciona produto → POST /:id/preview → renderiza cards por position
 *   - Cards mostram: rendered_prompt, refs com thumb, resolution_log, warnings
 *
 * Não persiste nada.
 */

import { useEffect, useState } from 'react'
import { X, Loader2, AlertTriangle, ChevronDown, ChevronUp, ImageIcon, Wand2 } from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type {
  CreativeProduct, TemplatePreviewResponse, ResolvedPositionPreview,
} from '@/components/creative/types'

export default function TemplatePreviewDrawer({
  open,
  onClose,
  templateId,
  initialProductId,
}: {
  open:              boolean
  onClose:           () => void
  templateId:        string | null
  initialProductId?: string
}) {
  const [products, setProducts]   = useState<CreativeProduct[]>([])
  const [productId, setProductId] = useState<string>(initialProductId ?? '')
  const [preview, setPreview]     = useState<TemplatePreviewResponse | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Carrega produtos ao abrir
  useEffect(() => {
    if (!open) return
    void CreativeApi.listProducts({ sort: 'recent' })
      .then(list => setProducts(list))
      .catch(e => setError((e as Error).message))
  }, [open])

  // Auto-preview quando productId definido (initial ou seleção)
  useEffect(() => {
    if (!open || !templateId || !productId) { setPreview(null); return }
    setLoading(true)
    setError(null)
    void CreativeApi.previewPromptTemplate(templateId, { product_id: productId })
      .then(p => setPreview(p))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [open, templateId, productId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <aside
        className="relative w-full sm:w-[600px] max-w-full h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Wand2 size={14} className="text-cyan-400" />
            <h2 className="text-sm font-semibold truncate">Preview do template</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        {/* Product selector */}
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/40">
          <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Produto pra renderizar</label>
          <select
            value={productId}
            onChange={e => setProductId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-cyan-400"
          >
            <option value="">— selecione —</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
            ))}
          </select>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!productId && !loading && (
            <div className="text-center py-12">
              <ImageIcon size={28} className="mx-auto text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-400">Selecione um produto pra ver o preview</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Loader2 size={12} className="animate-spin text-cyan-400" />
              Resolvendo prompts + refs…
            </div>
          )}

          {!loading && preview && preview.positions.map(pos => (
            <PreviewPositionCard key={pos.position} position={pos} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/40">
          <p className="text-[10px] text-zinc-500">
            {preview ? `${preview.positions.length} posições renderizadas` : 'aguardando produto…'}
            {preview?.briefing_id && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px]">
                briefing ativo
              </span>
            )}
          </p>
        </div>
      </aside>
    </div>
  )
}

function PreviewPositionCard({ position }: { position: ResolvedPositionPreview }) {
  const [expanded, setExpanded] = useState(true)

  const sourceColors: Record<string, string> = {
    fixed_id:         'bg-cyan-400/15 text-cyan-300 border-cyan-400/30',
    tag_match:        'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
    category_match:   'bg-blue-400/15 text-blue-300 border-blue-400/30',
    position_default: 'bg-violet-400/15 text-violet-300 border-violet-400/30',
    product_main:     'bg-amber-400/15 text-amber-300 border-amber-400/30',
    brand_logo:       'bg-pink-400/15 text-pink-300 border-pink-400/30',
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-900/80 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            #{position.position}
          </span>
          <span className="text-xs font-medium text-zinc-100 truncate">{position.name}</span>
          <span className="text-[9px] font-mono text-zinc-500">{position.aspect_ratio}</span>
        </span>
        {expanded ? <ChevronUp size={13} className="text-zinc-500" /> : <ChevronDown size={13} className="text-zinc-500" />}
      </button>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* Rendered prompt */}
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Prompt resolvido</p>
            <div className="rounded-md bg-zinc-950 border border-zinc-800 p-2 max-h-32 overflow-y-auto">
              <p className="text-[11px] font-mono text-zinc-200 whitespace-pre-wrap">{position.prompt_resolved}</p>
            </div>
            {position.negative_prompt && (
              <div className="mt-1.5 rounded-md bg-zinc-950 border border-red-500/20 p-2">
                <p className="text-[9px] uppercase tracking-wider text-red-300/60 mb-0.5">avoid</p>
                <p className="text-[10px] font-mono text-zinc-400">{position.negative_prompt}</p>
              </div>
            )}
          </div>

          {/* References */}
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5">
              References ({position.references.length})
            </p>
            {position.references.length === 0 ? (
              <p className="text-[10px] text-zinc-600 italic">nenhuma ref resolvida</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {position.references.map((r, i) => (
                  <a
                    key={i}
                    href={r.signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-md overflow-hidden border border-zinc-800 hover:border-cyan-400/40 transition-all"
                  >
                    <div className="aspect-square bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.signed_url} alt={r.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="px-1.5 py-1">
                      <span className={['inline-block text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border', sourceColors[r.source] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'].join(' ')}>
                        {r.source.replace('_', ' ')}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Warnings */}
          {position.warnings.length > 0 && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-2">
              <p className="text-[9px] uppercase tracking-wider text-amber-300/80 mb-1">
                Warnings ({position.warnings.length})
              </p>
              <ul className="space-y-0.5">
                {position.warnings.map((w, i) => (
                  <li key={i} className="text-[10px] text-amber-200">• {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
