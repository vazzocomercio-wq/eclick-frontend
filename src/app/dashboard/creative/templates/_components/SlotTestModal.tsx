'use client'

/**
 * Modal "Testar slot" — chama POST /creative/prompt-templates/:id/positions/:position/test
 * com um produto escolhido pelo user e mostra o resultado (imagem + prompt + refs + custo).
 *
 * Fluxo:
 *   1. Abre lista de produtos recentes (já carregados ao montar)
 *   2. User clica em um → fica em "gerando" enquanto fetch acontece
 *   3. Resposta: mostra imagem grande, prompt resolvido (collapsible), refs usadas
 *   4. Botão "Testar com outro produto" volta pra lista; X fecha
 */

import { useEffect, useState } from 'react'
import { X, Loader2, Image as ImageIcon, FileText, Layers, DollarSign, Clock, AlertTriangle } from 'lucide-react'
import { CreativeApi } from '@/components/creative/api'
import type { CreativeProduct } from '@/components/creative/types'

type TestResult = Awaited<ReturnType<typeof CreativeApi.testPromptTemplatePosition>>

export default function SlotTestModal({
  templateId,
  templateName,
  positionNumber,
  positionName,
  onClose,
}: {
  templateId:     string
  templateName:   string
  positionNumber: number
  positionName:   string
  onClose:        () => void
}) {
  const [products, setProducts] = useState<CreativeProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    setLoadingProducts(true)
    void CreativeApi.listProducts({ sort: 'recent' })
      .then(list => setProducts(list))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoadingProducts(false))
  }, [])

  const runTest = async (productId: string) => {
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const r = await CreativeApi.testPromptTemplatePosition(templateId, positionNumber, { product_id: productId })
      setResult(r)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const reset = () => {
    setResult(null)
    setError(null)
    setShowPrompt(false)
  }

  const filtered = search
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon size={14} className="text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">Testar slot · {positionName}</h3>
              <p className="text-[10px] text-zinc-500 truncate">{templateName} · posição #{positionNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Estado 1: gerando */}
          {generating && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={32} className="text-cyan-400 animate-spin" />
              <p className="text-sm text-zinc-300">Gerando imagem de teste…</p>
              <p className="text-[11px] text-zinc-500">Pode levar 15-40s (Gemini NB / OpenAI)</p>
            </div>
          )}

          {/* Estado 2: erro */}
          {!generating && error && (
            <div className="p-4">
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-300 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-red-200">Falha ao gerar</p>
                    <p className="text-xs text-red-300/80 mt-1 break-words">{error}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={reset}
                className="mt-3 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs"
              >
                Tentar com outro produto
              </button>
            </div>
          )}

          {/* Estado 3: resultado */}
          {!generating && !error && result && (
            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 p-4">
              <div>
                <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.test_image_url} alt="resultado" className="w-full h-full object-cover" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <DollarSign size={9} /> ${result.cost_usd.toFixed(4)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={9} /> {result.latency_ms}ms
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {result.provider}/{result.model}
                    </span>
                  </span>
                  {result.fallback_used && (
                    <span className="text-amber-300">fallback</span>
                  )}
                </div>
              </div>

              <div className="space-y-3 min-w-0">
                {/* Refs usadas */}
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1">
                    <Layers size={10} /> References usadas ({result.references_used.length})
                  </h4>
                  {result.references_used.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 italic">Nenhuma — só foto do produto.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {result.references_used.map((r, i) => (
                        <div key={i} className="aspect-square rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.signed_url} alt={r.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-0.5">
                            <p className="text-[8px] text-zinc-100 truncate">{r.name}</p>
                          </div>
                          <span className="absolute top-0.5 right-0.5 text-[7px] uppercase tracking-wider bg-black/70 text-zinc-300 px-1 rounded">
                            {r.source.split('_')[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prompt collapsible */}
                <div>
                  <button
                    onClick={() => setShowPrompt(s => !s)}
                    className="w-full text-left text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-between hover:text-zinc-300"
                  >
                    <span className="flex items-center gap-1">
                      <FileText size={10} /> Prompt resolvido ({result.prompt_text.length} chars)
                    </span>
                    <span className="text-cyan-400">{showPrompt ? 'Esconder' : 'Ver'}</span>
                  </button>
                  {showPrompt && (
                    <pre className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-md p-2 max-h-60 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                      {result.prompt_text}
                    </pre>
                  )}
                </div>

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-amber-300 mb-1">Warnings</p>
                    <ul className="space-y-0.5">
                      {result.warnings.map((w, i) => (
                        <li key={i} className="text-[10px] text-amber-200/80">• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={reset}
                  className="w-full px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-cyan-400/40 text-zinc-300 hover:text-cyan-300 text-xs transition-colors"
                >
                  Testar com outro produto
                </button>
              </div>
            </div>
          )}

          {/* Estado 0: escolha de produto */}
          {!generating && !result && !error && (
            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-400">
                Escolha um produto pra gerar 1 imagem de teste apenas deste slot. Não cria job, não consome créditos do produto — só uma chamada direta ao modelo.
              </p>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrar produtos…"
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md text-xs text-zinc-200 outline-none focus:border-cyan-400 placeholder:text-zinc-600"
              />
              {loadingProducts ? (
                <p className="text-[11px] text-zinc-500">Carregando produtos…</p>
              ) : filtered.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic">Nenhum produto encontrado.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                  {filtered.slice(0, 60).map(p => (
                    <button
                      key={p.id}
                      onClick={() => runTest(p.id)}
                      className="group text-left rounded-lg overflow-hidden border border-zinc-800 hover:border-cyan-400/60 bg-zinc-900 transition-colors"
                    >
                      <div className="aspect-square bg-zinc-950">
                        {p.main_image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={p.main_image_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700">
                            <ImageIcon size={20} />
                          </div>
                        )}
                      </div>
                      <div className="p-1.5">
                        <p className="text-[10px] text-zinc-200 line-clamp-2 leading-tight">{p.name}</p>
                        <p className="text-[9px] text-zinc-500 mt-0.5 truncate">{p.category || '—'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
