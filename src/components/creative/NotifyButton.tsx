'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'

type Permission = 'default' | 'granted' | 'denied' | 'unsupported'

/**
 * Hook + botão pra notificações nativas do browser.
 *
 * Estado:
 *   - 'unsupported' → browser não tem Notification API (navegador antigo)
 *   - 'default'     → user nunca decidiu, botão pede permissão
 *   - 'granted'     → notificações ativas
 *   - 'denied'      → user negou (não dá pra reverter sem ele entrar nas configs)
 */
export function useNotifyOnComplete() {
  const [permission, setPermission] = useState<Permission>('default')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as Permission)
  }, [])

  async function requestPermission() {
    if (permission === 'unsupported') return
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result as Permission)
  }

  function fire(title: string, body: string, opts: { tag?: string; onClick?: () => void } = {}) {
    if (permission !== 'granted') return
    if (typeof Notification === 'undefined') return
    try {
      const notif = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag:   opts.tag,
        // renotify: true,  // comportamento padrão do tag já agrupa
      })
      notif.onclick = () => {
        if (typeof window !== 'undefined') window.focus()
        notif.close()
        opts.onClick?.()
      }
    } catch {
      // Algumas browsers (Safari iOS) jogam exception mesmo em 'granted'
      // Falha silenciosa — UI da página já mostra status terminal de qualquer jeito
    }
  }

  return { permission, requestPermission, fire }
}

interface ButtonProps {
  permission:    Permission
  onRequest:     () => void
  /** Texto auxiliar quando granted, ex: "te aviso quando ficar pronto" */
  hintGranted?:  string
}

export default function NotifyButton({ permission, onRequest, hintGranted }: ButtonProps) {
  if (permission === 'unsupported') return null

  if (permission === 'granted') {
    return (
      <span
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-emerald-400/10 text-emerald-300 border border-emerald-400/30"
        title={hintGranted ?? 'Notificações ativadas'}
      >
        <BellRing size={11} /> avisar
      </span>
    )
  }

  if (permission === 'denied') {
    return (
      <span
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-zinc-900 text-zinc-500 border border-zinc-800"
        title="Você negou notificações. Pra reativar entre nas configurações do site no browser."
      >
        <BellOff size={11} /> bloqueado
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onRequest}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 border border-zinc-800 hover:border-cyan-400/40 transition-all"
      title="Receba notificação no browser quando o job terminar"
    >
      <Bell size={11} /> avisar quando pronto
    </button>
  )
}
