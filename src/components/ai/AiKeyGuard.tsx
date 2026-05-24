'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, X, ArrowRight, Sparkles } from 'lucide-react'

/**
 * AiKeyGuard — interceptor global de `window.fetch`.
 *
 * O backend, quando a org está em modo BYOK ('own') e NÃO tem chave própria de
 * IA cadastrada, responde HTTP 402 com body:
 *   { statusCode: 402, error: 'ai_key_required', provider, message }
 *
 * Em vez de migrar centenas de call-sites pra tratar esse caso, montamos UM
 * interceptor no layout do dashboard que escuta qualquer resposta 402 com
 * `ai_key_required` e abre um modal "Conectar chave de IA" → leva pra
 * /dashboard/configuracoes/ia (aba Chaves).
 *
 * Importante:
 * - Usa `response.clone()` pra ler o body sem consumir o do caller original.
 * - Restaura o `window.fetch` original no unmount (evita stacking de patches).
 * - Idempotente: se já houver um patch nosso ativo, não re-aplica.
 */

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Anthropic (Claude)',
  openai:    'OpenAI',
  google:    'Google (Gemini)',
}

// Flag no fetch pra evitar patch duplo (StrictMode monta 2x em dev).
const PATCH_FLAG = '__eclickAiKeyGuard__'

interface AiKeyInfo {
  provider: string
  message:  string
}

export default function AiKeyGuard() {
  const [info, setInfo] = useState<AiKeyInfo | null>(null)
  const router = useRouter()
  const infoRef = useRef<AiKeyInfo | null>(null)
  infoRef.current = info

  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as Record<string, unknown>
    // Já patcheado por outra instância? não empilha.
    if (w[PATCH_FLAG]) return

    const orig = window.fetch
    w[PATCH_FLAG] = orig

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await orig(...args)
      if (res.status === 402) {
        try {
          const data = await res.clone().json()
          if (data?.error === 'ai_key_required') {
            // Só mostra um modal por vez (não empilha se já tiver um aberto).
            if (!infoRef.current) {
              setInfo({
                provider: String(data.provider ?? 'IA'),
                message:  String(data.message ?? 'Conecte sua chave de IA pra usar este recurso.'),
              })
            }
          }
        } catch {
          // body não-JSON ou já consumido — ignora silencioso.
        }
      }
      return res
    }

    return () => {
      // Restaura só se o patch ativo ainda for o nosso.
      if (window.fetch !== orig && w[PATCH_FLAG] === orig) {
        window.fetch = orig
      }
      delete w[PATCH_FLAG]
    }
  }, [])

  const close = useCallback(() => setInfo(null), [])

  const goConnect = useCallback(() => {
    setInfo(null)
    router.push('/dashboard/configuracoes/ia')
  }, [router])

  if (!info) return null

  const providerName = PROVIDER_LABEL[info.provider] ?? info.provider

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(4px)' }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden"
        style={{
          background:   'linear-gradient(180deg, #141418 0%, #0d0d10 100%)',
          border:       '1px solid rgba(0,229,255,0.22)',
          borderRadius: 16,
          boxShadow:    '0 20px 60px -12px rgba(0,229,255,0.18), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        {/* Glow no topo */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-48 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(0,229,255,0.16) 0%, transparent 70%)',
          }}
        />

        <button
          onClick={close}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>

        <div className="relative px-6 pt-6 pb-5">
          {/* Ícone */}
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{
              background: 'rgba(0,229,255,0.10)',
              border:     '1px solid rgba(0,229,255,0.28)',
            }}
          >
            <KeyRound size={22} style={{ color: '#00E5FF' }} />
          </div>

          <h2 className="text-lg font-semibold mb-1.5" style={{ color: '#fafafa' }}>
            Conecte sua chave de IA
          </h2>

          <p className="text-sm leading-relaxed mb-1" style={{ color: '#a1a1aa' }}>
            {info.message}
          </p>

          <div
            className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs"
            style={{
              background: 'rgba(0,229,255,0.06)',
              border:     '1px solid rgba(0,229,255,0.16)',
              color:      '#a5f3fc',
            }}
          >
            <Sparkles size={13} className="flex-shrink-0" />
            <span>
              Provedor necessário: <strong style={{ color: '#5dd5e8' }}>{providerName}</strong>.
              Use sua própria chave pra consumir seus créditos.
            </span>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={goConnect}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                background: '#00E5FF',
                color:      '#06181b',
              }}
            >
              Conectar chave <ArrowRight size={15} />
            </button>
            <button
              onClick={close}
              className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border:     '1px solid rgba(255,255,255,0.10)',
                color:      '#a1a1aa',
              }}
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
