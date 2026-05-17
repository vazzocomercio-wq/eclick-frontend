'use client'

/**
 * Painel de atributos ML — fonte ÚNICA de edição dos atributos do anúncio.
 * Usado no editor de anúncio E na tela de publicação, sempre ligado ao
 * campo `creative_listings.ml_attributes`.
 *
 * Renderiza:
 *   - Atributos OBRIGATÓRIOS da categoria (precisam de valor real).
 *   - Atributos RECOMENDADOS, cada um com o toggle "Não se aplica".
 *   - Botão "Preencher com IA" — preenche pelos dados do produto; o que a IA
 *     não souber fica como "Não se aplica".
 */

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import MLAttributesForm from './MLAttributesForm'
import { CreativeApi } from './api'
import type { MlRequiredAttribute } from './types'

interface AttributeValue { id: string; value_name?: string; value_id?: string }

interface Props {
  listingId:  string
  categoryId: string | null
  value:      AttributeValue[]
  onChange:   (next: AttributeValue[]) => void
  /** Roda o preenchimento por IA automaticamente na 1ª carga, se ainda vazio. */
  autoFill?:  boolean
}

export default function MlAttributesPanel({ listingId, categoryId, value, onChange, autoFill }: Props) {
  const [required, setRequired]       = useState<MlRequiredAttribute[]>([])
  const [recommended, setRecommended] = useState<MlRequiredAttribute[]>([])
  const [loading, setLoading]         = useState(false)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [aiFilling, setAiFilling]     = useState(false)
  const [aiError, setAiError]         = useState<string | null>(null)
  const aiFilledRef                   = useRef(false)

  useEffect(() => {
    if (!categoryId) { setRequired([]); setRecommended([]); return }
    let cancelled = false
    setLoading(true); setLoadError(null)
    CreativeApi.getMlCategoryAttributesSplit(categoryId)
      .then(r => { if (!cancelled) { setRequired(r.required); setRecommended(r.recommended) } })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [categoryId])

  async function fillWithAI() {
    setAiError(null); setAiFilling(true)
    try {
      const suggestions = await CreativeApi.suggestMlAttributes(listingId, categoryId ?? undefined)
      const m = new Map(value.map(v => [v.id, v]))
      for (const s of suggestions) {
        m.set(s.id, { id: s.id, value_id: s.value_id, value_name: s.value_name })
      }
      onChange([...m.values()])
    } catch (e: unknown) {
      setAiError((e as Error).message)
    } finally {
      setAiFilling(false)
    }
  }

  // Preenchimento automático — uma vez, quando os atributos carregam e ainda
  // não há valores salvos no anúncio.
  useEffect(() => {
    if (!autoFill || aiFilledRef.current) return
    if (loading || (required.length === 0 && recommended.length === 0)) return
    aiFilledRef.current = true
    if (value.length === 0) void fillWithAI()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, required, recommended, autoFill])

  if (!categoryId) {
    return <p className="text-xs text-zinc-500">Categoria ML não definida — atributos indisponíveis.</p>
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
        <Loader2 size={12} className="animate-spin" /> Carregando atributos da categoria…
      </div>
    )
  }
  if (loadError) {
    return <div className="text-xs text-red-300">Falha ao carregar atributos: {loadError}</div>
  }

  return (
    <div className="space-y-4">
      {/* Preenchimento por IA */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-zinc-500 flex-1">
          A IA preenche pelos dados do produto; o que ela não conseguir determinar fica
          como <span className="text-zinc-400">&quot;Não se aplica&quot;</span>.
        </p>
        <button
          type="button"
          onClick={fillWithAI}
          disabled={aiFilling}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-60"
        >
          {aiFilling
            ? <><Loader2 size={11} className="animate-spin" /> Preenchendo…</>
            : <><Sparkles size={11} /> Preencher com IA</>}
        </button>
      </div>
      {aiError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-200 flex items-start gap-1.5">
          <AlertCircle size={11} className="shrink-0 mt-0.5" />{aiError}
        </div>
      )}

      {required.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-300 mb-1.5">
            Obrigatórios ({required.length})
          </p>
          <MLAttributesForm attributes={required} values={value} onChange={onChange} />
        </div>
      )}

      {recommended.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
            Recomendados ({recommended.length}) — preencha ou marque &quot;Não se aplica&quot;
          </p>
          <MLAttributesForm attributes={recommended} values={value} onChange={onChange} allowNotApplicable />
        </div>
      )}

      {required.length === 0 && recommended.length === 0 && (
        <p className="text-xs text-zinc-500">Sem atributos pra esta categoria.</p>
      )}
    </div>
  )
}
