'use client'

/**
 * Error boundary da vitrine pública (/loja/[slug]/*).
 *
 * Chega aqui quando o fetch de dados falha por rede/5xx (data.ts agora
 * lança em vez de virar notFound). Página white-label NEUTRA — sem cores
 * nem marca do e-Click: quem visita é cliente do lojista.
 */

import { useEffect } from 'react'

export default function StorefrontError({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log só no console (diagnóstico) — nada de UI técnica pro visitante
    console.error('[loja] erro ao carregar a vitrine:', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: '#fafafa', color: '#18181b',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div aria-hidden style={{ fontSize: 40, marginBottom: 16 }}>🛍️</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Loja temporariamente indisponível
        </h1>
        <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.6, color: '#52525b' }}>
          Não conseguimos carregar a loja agora. Pode ser uma instabilidade
          passageira — tente novamente em alguns instantes.
        </p>
        <button type="button" onClick={reset}
          style={{
            marginTop: 24, padding: '14px 28px', minHeight: 48,
            background: '#18181b', color: '#ffffff',
            border: 'none', borderRadius: 8,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
          Tentar de novo
        </button>
      </div>
    </div>
  )
}
