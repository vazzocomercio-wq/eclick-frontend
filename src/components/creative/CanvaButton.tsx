'use client'

import { useEffect, useRef, useState } from 'react'
import { Wand2, ChevronDown, Loader2, AlertCircle, ExternalLink, Plug } from 'lucide-react'
import {
  CanvaApi,
  CANVA_DIM_OPTIONS,
  CANVA_DIM_GROUPS,
  type CanvaDimOption,
  type CanvaMarketplaceKey,
} from './canvaApi'

interface Props {
  /** URL da imagem (signed) que vai ser enviada pro Canva. */
  imageUrl?:    string | null
  /** Título base do design — Canva concatena com a dimensão. */
  title?:       string
  /** Visual: 'full' (botão claro com texto) ou 'compact' (icon-only menor, pra cards). */
  variant?:     'full' | 'compact'
  /** Estado disabled externo (ex: imagem ainda não pronta). */
  disabled?:    boolean
  /** Onde redirecionar após OAuth de volta. Default: rota atual. */
  redirectTo?:  string
}

/**
 * Botão "Editar no Canva" com dropdown de marketplace/dimensão.
 *
 * Fluxo:
 *   1. User clica → checa status OAuth (lazy, primeira vez)
 *   2. Se desconectado: oferece "Conectar Canva" → window.location.href = authorize_url
 *   3. Se conectado: dropdown lista 11 dimensões agrupadas
 *   4. Click numa dim → POST /canva/upload-and-open → window.open(edit_url)
 */
export default function CanvaButton({
  imageUrl, title, variant = 'full', disabled, redirectTo,
}: Props) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown')
  const [busy, setBusy] = useState<null | CanvaMarketplaceKey | 'connect'>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastEdit, setLastEdit] = useState<{ url: string; key: CanvaMarketplaceKey } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Click outside fecha o dropdown
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function handleOpen() {
    if (disabled || !imageUrl) return
    setError(null)
    if (status === 'unknown') {
      try {
        const s = await CanvaApi.getStatus()
        setStatus(s.connected ? 'connected' : 'disconnected')
      } catch (e: unknown) {
        setStatus('disconnected')
        setError((e as Error).message)
      }
    }
    setOpen(true)
  }

  async function connect() {
    setBusy('connect')
    setError(null)
    try {
      const target = redirectTo ?? (typeof window !== 'undefined' ? window.location.pathname : '/dashboard/creative')
      const { authorize_url } = await CanvaApi.getAuthorizeUrl(target)
      window.location.href = authorize_url
    } catch (e: unknown) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  async function pick(opt: CanvaDimOption) {
    if (!imageUrl) { setError('Imagem indisponível.'); return }
    setError(null)
    setBusy(opt.key)
    try {
      const res = await CanvaApi.uploadAndOpen({
        image_url:   imageUrl,
        marketplace: opt.key,
        title,
      })
      setLastEdit({ url: res.edit_url, key: opt.key })
      window.open(res.edit_url, '_blank', 'noopener,noreferrer')
      setOpen(false)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // ── Render ──

  const triggerDisabled = disabled || !imageUrl

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={handleOpen}
        disabled={triggerDisabled}
        title={triggerDisabled ? 'Imagem ainda não disponível' : 'Editar no Canva'}
        className={[
          'inline-flex items-center gap-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed',
          variant === 'full'
            ? 'px-3 py-1.5 text-xs font-semibold bg-[#7D2AE7] hover:bg-[#6c20cf] text-white shadow-[0_0_10px_rgba(125,42,231,0.25)]'
            : 'px-2 py-1 text-[10px] font-semibold bg-[#7D2AE7]/15 hover:bg-[#7D2AE7]/30 text-[#c8a8ff] border border-[#7D2AE7]/40',
        ].join(' ')}
      >
        <Wand2 size={variant === 'full' ? 12 : 10} />
        <span>{variant === 'full' ? 'Editar no Canva' : 'Canva'}</span>
        <ChevronDown size={variant === 'full' ? 12 : 10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={[
          'absolute z-30 mt-1 right-0 min-w-[260px] max-w-[300px] rounded-xl border bg-zinc-950 shadow-xl',
          'border-[#7D2AE7]/40',
        ].join(' ')}>
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
            <span className="h-5 w-5 rounded flex items-center justify-center bg-[#7D2AE7] text-white text-[10px] font-bold">C</span>
            <span className="text-xs font-semibold text-zinc-200">Canva</span>
            <span className="ml-auto text-[10px] text-zinc-500">
              {status === 'connected'    && '● conectado'}
              {status === 'disconnected' && '○ desconectado'}
              {status === 'unknown'      && <Loader2 size={10} className="animate-spin" />}
            </span>
          </div>

          {/* Body */}
          {status === 'disconnected' ? (
            <div className="p-3 space-y-2">
              <p className="text-xs text-zinc-400">
                Conecte sua conta Canva pra abrir designs direto daqui.
              </p>
              <button
                type="button"
                onClick={connect}
                disabled={busy === 'connect'}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7D2AE7] hover:bg-[#6c20cf] text-white text-xs font-semibold disabled:opacity-50"
              >
                {busy === 'connect' ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                Conectar Canva
              </button>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {(['marketplace', 'social', 'web'] as const).map(group => {
                const items = CANVA_DIM_OPTIONS.filter(o => o.group === group)
                if (items.length === 0) return null
                return (
                  <div key={group} className="py-1">
                    <p className="px-3 py-1 text-[9px] uppercase tracking-wider text-zinc-500">
                      {CANVA_DIM_GROUPS[group]}
                    </p>
                    {items.map(opt => {
                      const isBusy = busy === opt.key
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => pick(opt)}
                          disabled={!!busy || status !== 'connected'}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                        >
                          <span>{opt.emoji}</span>
                          <span className="flex-1 text-left truncate">{opt.label}</span>
                          <span className="text-[9px] text-zinc-600 font-mono shrink-0">
                            {opt.dims.w}×{opt.dims.h}
                          </span>
                          {isBusy && <Loader2 size={10} className="animate-spin text-[#c8a8ff]" />}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer: erro + último design aberto */}
          {(error || lastEdit) && (
            <div className="border-t border-zinc-800 px-3 py-2 space-y-1">
              {error && (
                <div className="flex items-start gap-1 text-[10px] text-red-400">
                  <AlertCircle size={10} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {lastEdit && (
                <a
                  href={lastEdit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-[#c8a8ff] hover:text-white"
                >
                  <ExternalLink size={10} /> reabrir último design
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
