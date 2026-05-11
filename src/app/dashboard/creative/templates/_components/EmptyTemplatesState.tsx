'use client'

import Link from 'next/link'
import { Wand2, Sparkles } from 'lucide-react'

export default function EmptyTemplatesState({
  onApplySkeleton,
}: {
  onApplySkeleton: () => void
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center max-w-2xl mx-auto">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center mb-4">
        <Wand2 size={28} className="text-cyan-400" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-100 mb-2">
        Nenhum template ainda
      </h2>
      <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
        Templates determinam como cada uma das N imagens do anúncio é gerada.
        Configure uma vez e o sistema usa em todos os produtos da categoria —
        ambiente certo, marca consistente, sem prompt-gen LLM (mais barato).
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/dashboard/creative/templates/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold transition-colors"
        >
          <Wand2 size={14} /> Novo template
        </Link>
        <button
          type="button"
          onClick={onApplySkeleton}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400/10 border border-cyan-400/30 hover:bg-cyan-400/20 text-cyan-300 text-sm transition-colors"
        >
          <Sparkles size={14} /> Aplicar esqueleto canônico (11 posições)
        </button>
      </div>
    </div>
  )
}
