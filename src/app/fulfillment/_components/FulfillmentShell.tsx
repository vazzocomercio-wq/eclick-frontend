'use client'

import { useEffect, useState } from 'react'
import { WifiOff, CloudUpload } from 'lucide-react'
import { flushOutbox, outboxCount } from '../_lib/offline'

/**
 * Casca full-screen do app do operador (mobile-first). Registra o service
 * worker (offline-first), mostra indicador quando cai a conexão e sincroniza
 * a fila offline (outbox) ao reconectar.
 */
export function FulfillmentShell({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true)
  const [queued, setQueued] = useState(0)

  useEffect(() => {
    setOnline(navigator.onLine)
    setQueued(outboxCount())
    const on = () => {
      setOnline(true)
      flushOutbox().then(() => setQueued(outboxCount())).catch(() => {})
    }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/fulfillment-sw.js', { scope: '/fulfillment' }).catch(() => {})
    }
    // sincroniza qualquer pendência ao abrir
    if (navigator.onLine) flushOutbox().then(() => setQueued(outboxCount())).catch(() => {})

    const poll = setInterval(() => setQueued(outboxCount()), 4000)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      clearInterval(poll)
    }
  }, [])

  return (
    <div className="min-h-[100dvh]" style={{ background: '#09090b', color: '#fafafa' }}>
      {!online && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 py-2 text-sm font-semibold" style={{ background: '#F59E0B', color: '#1a1205' }}>
          <WifiOff size={16} /> Sem conexão — as ações ficam na fila e sincronizam ao voltar
        </div>
      )}
      {online && queued > 0 && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 py-2 text-sm font-semibold" style={{ background: '#00E5FF', color: '#04222a' }}>
          <CloudUpload size={16} /> Sincronizando {queued} {queued === 1 ? 'ação' : 'ações'} da fila…
        </div>
      )}
      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4">{children}</div>
    </div>
  )
}
