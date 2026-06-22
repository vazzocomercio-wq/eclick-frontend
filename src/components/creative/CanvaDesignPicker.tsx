'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plug, Search, RefreshCw, Check, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { CanvaApi, type CanvaDesignSummary, type CanvaExportAsset } from './canvaApi'

interface Props {
  /** IDs de design já escolhidos (pra marcar o check). */
  pickedDesignIds: Set<string>
  /** Chamado quando um design é exportado com sucesso (vira imagem do anúncio). */
  onPicked:   (asset: CanvaExportAsset) => void
  /** Chamado quando um design é desmarcado. */
  onUnpicked: (designId: string) => void
  /** Pra onde voltar após OAuth do Canva. */
  redirectTo?: string
}

/**
 * Grade dos designs do Canva do usuário. Ao clicar num design, exporta pra
 * PNG (espelhado no Storage) e devolve o asset pro pai usar como imagem do
 * anúncio. Reusa os endpoints que já existem (/canva/designs + /canva/export).
 */
export default function CanvaDesignPicker({ pickedDesignIds, onPicked, onUnpicked, redirectTo }: Props) {
  const [status, setStatus]   = useState<'unknown' | 'connected' | 'disconnected'>('unknown')
  const [designs, setDesigns] = useState<CanvaDesignSummary[]>([])
  const [continuation, setContinuation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')
  const [exporting, setExporting] = useState<Set<string>>(new Set())
  const [connecting, setConnecting] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const loadDesigns = useCallback(async (opts: { query?: string; continuation?: string } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const res = await CanvaApi.listDesigns(opts)
      setDesigns(prev => opts.continuation ? [...prev, ...res.items] : res.items)
      setContinuation(res.continuation)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Checa conexão + carrega designs na montagem
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await CanvaApi.getStatus()
        if (cancelled) return
        if (s.connected) {
          setStatus('connected')
          void loadDesigns()
        } else {
          setStatus('disconnected')
        }
      } catch {
        if (!cancelled) setStatus('disconnected')
      }
    })()
    return () => { cancelled = true }
  }, [loadDesigns])

  async function connect() {
    setConnecting(true)
    setError(null)
    try {
      const target = redirectTo ?? (typeof window !== 'undefined' ? window.location.pathname : '/dashboard/creative')
      const { authorize_url } = await CanvaApi.getAuthorizeUrl(target)
      window.location.href = authorize_url
    } catch (e: unknown) {
      setError((e as Error).message)
      setConnecting(false)
    }
  }

  async function toggle(d: CanvaDesignSummary) {
    if (pickedDesignIds.has(d.id)) {
      onUnpicked(d.id)
      return
    }
    if (exporting.has(d.id)) return
    setExporting(prev => new Set(prev).add(d.id))
    setError(null)
    try {
      const asset = await CanvaApi.exportDesign({ designId: d.id, format: 'png', name: d.title })
      if (!asset.storage_url) throw new Error('export sem URL utilizável')
      onPicked(asset)
    } catch (e: unknown) {
      setError(`Falha ao exportar "${d.title}": ${(e as Error).message}`)
    } finally {
      setExporting(prev => { const n = new Set(prev); n.delete(d.id); return n })
    }
  }

  // ── Render ──

  if (status === 'unknown') {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500 py-8 justify-center">
        <Loader2 size={14} className="animate-spin" /> Verificando conexão com o Canva…
      </div>
    )
  }

  if (status === 'disconnected') {
    return (
      <div className="rounded-xl border border-dashed border-[#7D2AE7]/40 bg-[#7D2AE7]/5 p-6 text-center">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#7D2AE7] text-white text-sm font-bold mb-3">C</div>
        <p className="text-sm text-zinc-300 mb-3">Conecte sua conta Canva para escolher seus designs.</p>
        <button
          type="button"
          onClick={connect}
          disabled={connecting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#7D2AE7] hover:bg-[#6c20cf] text-white text-sm font-semibold disabled:opacity-50"
        >
          {connecting ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
          Conectar Canva
        </button>
        {error && <p className="mt-3 text-[11px] text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      {/* Busca */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void loadDesigns({ query: search.trim() || undefined }) }}
            placeholder="Buscar design no Canva…"
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 outline-none focus:border-[#7D2AE7] placeholder:text-zinc-600"
          />
        </div>
        <button
          type="button"
          onClick={() => void loadDesigns({ query: search.trim() || undefined })}
          disabled={loading}
          className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 disabled:opacity-50"
          title="Atualizar"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-200">
          <AlertCircle size={12} className="shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {loading && designs.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8 justify-center">
          <Loader2 size={14} className="animate-spin" /> Carregando designs…
        </div>
      ) : designs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          Nenhum design encontrado no seu Canva.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {designs.map(d => {
              const picked = pickedDesignIds.has(d.id)
              const isExporting = exporting.has(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => void toggle(d)}
                  disabled={isExporting}
                  className={[
                    'group relative aspect-square rounded-lg overflow-hidden border-2 bg-zinc-950 transition-all text-left',
                    picked ? 'border-cyan-400 ring-2 ring-cyan-400/20' : 'border-zinc-800 hover:border-[#7D2AE7]/60',
                  ].join(' ')}
                  title={d.title}
                >
                  {d.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.thumbnail_url} alt={d.title} className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-700"><ImageIcon size={24} /></div>
                  )}

                  {/* Overlay de estado */}
                  {isExporting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <Loader2 size={20} className="animate-spin text-[#c8a8ff]" />
                    </div>
                  )}
                  {picked && !isExporting && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-cyan-400 flex items-center justify-center">
                      <Check size={13} className="text-black" strokeWidth={3} />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[9px] text-zinc-200 truncate">{d.title}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {continuation && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => void loadDesigns({ query: search.trim() || undefined, continuation })}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-700 disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="inline animate-spin" /> : 'Carregar mais'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
