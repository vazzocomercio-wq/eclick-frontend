'use client'

import { useState } from 'react'
import { Wand2, Check, Loader2, AlertCircle } from 'lucide-react'
import { CatalogApi, type CatalogProductLight } from './catalogApi'

interface Props {
  product:  CatalogProductLight
  onApplied: () => void
}

/**
 * Onda 1 hybrid C / Delta extra — UI das sugestões aplicáveis.
 * Mostra current vs ai_suggested_* lado a lado + botão de aplicar.
 *
 * Aplicar copia o ai_suggested_* pro campo oficial (name/description/
 * bullets/category). Backend valida tenant + persiste.
 */
export default function ProductAiSuggestions({ product, onApplied }: Props) {
  const [busy, setBusy]   = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Helpers
  const has = {
    title:       !!product.ai_suggested_title && product.ai_suggested_title !== product.name,
    description: !!product.ai_long_description && product.ai_long_description !== product.description,
    bullets:     (product.ai_suggested_bullets?.length ?? 0) > 0,
    category:    !!product.ai_suggested_category && product.ai_suggested_category !== product.category,
  }
  const hasAny = has.title || has.description || has.bullets || has.category

  if (!hasAny) return null

  async function apply(opts: Parameters<typeof CatalogApi.applySuggestions>[1]) {
    setError(null); setSuccess(null)
    const key = Object.keys(opts).filter(k => opts[k as keyof typeof opts] === true).join('+') || 'all'
    setBusy(key)
    try {
      const res = await CatalogApi.applySuggestions(product.id, opts)
      setSuccess(`Aplicado: ${res.applied.join(', ')}`)
      onApplied()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 mb-6">
      <header className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <Wand2 size={14} /> Sugestões da IA pro catálogo
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            A IA sugeriu novos valores pros campos abaixo. Aplicar substitui o conteúdo oficial.
          </p>
        </div>
        <button
          type="button"
          onClick={() => apply({ all: true })}
          disabled={!!busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black text-xs font-semibold"
        >
          {busy === 'all' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Aplicar tudo
        </button>
      </header>

      {error && (
        <div className="mb-2 flex items-start gap-2 text-[11px] text-red-300">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="mb-2 flex items-start gap-2 text-[11px] text-emerald-300">
          <Check size={11} className="mt-0.5 shrink-0" />{success}
        </div>
      )}

      <div className="space-y-2">
        {has.title && (
          <SuggestionRow
            label="Título"
            current={product.name}
            suggested={product.ai_suggested_title!}
            onApply={() => apply({ title: true })}
            busy={busy === 'title'}
          />
        )}
        {has.description && (
          <SuggestionRow
            label="Descrição"
            current={product.description ?? ''}
            suggested={product.ai_long_description!}
            onApply={() => apply({ description: true })}
            busy={busy === 'description'}
            multiline
          />
        )}
        {has.category && (
          <SuggestionRow
            label="Categoria"
            current={product.category ?? '—'}
            suggested={product.ai_suggested_category!}
            onApply={() => apply({ category: true })}
            busy={busy === 'category'}
          />
        )}
        {has.bullets && (
          <BulletsSuggestion
            current={product.bullets ?? []}
            suggested={product.ai_suggested_bullets}
            onApply={() => apply({ bullets: true })}
            busy={busy === 'bullets'}
          />
        )}
      </div>
    </div>
  )
}

function SuggestionRow({
  label, current, suggested, onApply, busy, multiline,
}: {
  label:     string
  current:   string
  suggested: string
  onApply:   () => void
  busy:      boolean
  multiline?: boolean
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</h3>
        <button
          type="button"
          onClick={onApply}
          disabled={busy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-semibold"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
          aplicar
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] text-zinc-600 mb-0.5">Atual</p>
          <p className={`text-zinc-400 ${multiline ? 'whitespace-pre-line' : 'truncate'}`}>{current || <span className="italic text-zinc-700">— vazio —</span>}</p>
        </div>
        <div>
          <p className="text-[10px] text-amber-400 mb-0.5">Sugerido</p>
          <p className={`text-amber-100 ${multiline ? 'whitespace-pre-line' : 'truncate'}`}>{suggested}</p>
        </div>
      </div>
    </div>
  )
}

function BulletsSuggestion({
  current, suggested, onApply, busy,
}: { current: string[]; suggested: string[]; onApply: () => void; busy: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[10px] uppercase tracking-wider text-zinc-500">Bullets ({suggested.length})</h3>
        <button
          type="button"
          onClick={onApply}
          disabled={busy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-semibold"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
          aplicar
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-[10px] text-zinc-600 mb-1">Atual ({current.length})</p>
          <ul className="space-y-0.5">
            {current.length === 0 ? (
              <li className="text-zinc-700 italic">— sem bullets —</li>
            ) : (
              current.map((b, i) => <li key={i} className="text-zinc-400">{b}</li>)
            )}
          </ul>
        </div>
        <div>
          <p className="text-[10px] text-amber-400 mb-1">Sugerido</p>
          <ul className="space-y-0.5">
            {suggested.map((b, i) => <li key={i} className="text-amber-100">{b}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}
