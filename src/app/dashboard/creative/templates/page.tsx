import Link from 'next/link'
import { Plus, Wand2 } from 'lucide-react'
import TemplatesList from './_components/TemplatesList'

export default function TemplatesIndexPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 sm:px-8 py-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Wand2 size={18} className="text-cyan-400" />
            <div>
              <h1 className="text-lg font-semibold">Templates de prompt</h1>
              <p className="text-[11px] text-zinc-500">
                Templates determinam como cada uma das N imagens do anúncio é gerada — controle determinístico do ambiente, marca consistente, sem custo de prompt-gen LLM.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/creative/templates/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-semibold transition-colors"
          >
            <Plus size={14} /> Novo template
          </Link>
        </div>

        <TemplatesList />
      </div>
    </div>
  )
}
