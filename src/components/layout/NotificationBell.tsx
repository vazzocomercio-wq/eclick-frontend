'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getSocket } from '@/lib/socket'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface SignalRow {
  severity: string
  status:   string
}

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

/**
 * Bell de notificações no Header. Mostra contagem de alertas críticos
 * pendentes de ação (status dispatched/delivered, severity=critical).
 *
 * Carga inicial: GET /alert-signals (filter client-side).
 * Realtime: incrementa em alert:dispatched (severity=critical),
 *           decrementa em alert:responded.
 *
 * Click → navega pra /alertas e zera contador local (next refresh trará
 * a contagem real do backend).
 */
export default function NotificationBell() {
  const router = useRouter()
  const [count, setCount] = useState(0)
  const [loaded, setLoaded] = useState(false)

  // Carga inicial
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const token = await getToken()
        if (!token) return
        const res = await fetch(`${BACKEND}/alert-signals?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const signals = (await res.json()) as SignalRow[]
        if (cancelled) return
        const pending = signals.filter(s =>
          s.severity === 'critical' && (s.status === 'dispatched' || s.status === 'delivered'),
        ).length
        setCount(pending)
      } catch {
        // silenciosamente ignora; bell some pra UX clean
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Socket realtime
  useEffect(() => {
    let cancelled = false
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null

    void (async () => {
      try {
        socket = await getSocket()
        if (cancelled || !socket) return

        const onDispatched = (payload: { severity?: string }) => {
          if (payload.severity === 'critical') setCount(c => c + 1)
        }
        const onResponded = () => {
          // Pode ser que o respondido seja crítico; melhor decrementar otimistamente,
          // o próximo refetch ou navegação pra /alertas reconcilia.
          setCount(c => Math.max(0, c - 1))
        }

        socket.on('alert:dispatched', onDispatched)
        socket.on('alert:responded',  onResponded)
      } catch {
        /* sem socket, sem realtime — UI fica com count inicial */
      }
    })()

    return () => {
      cancelled = true
      if (socket) {
        socket.off('alert:dispatched')
        socket.off('alert:responded')
      }
    }
  }, [])

  function handleClick() {
    router.push('/dashboard/inteligencia/alertas')
    setCount(0)
  }

  const showBadge = loaded && count > 0
  const badgeColor = count > 0 ? '#f87171' : '#00E5FF'

  return (
    <button onClick={handleClick}
      className="relative flex items-center justify-center w-7 h-7 rounded-md text-zinc-500 transition-colors hover:text-zinc-300 hover:bg-white/5"
      title={count > 0 ? `${count} alerta${count !== 1 ? 's' : ''} crítico${count !== 1 ? 's' : ''}` : 'Notificações'}
      aria-label="Notificações">
      <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {showBadge && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
          style={{ background: badgeColor, color: count > 0 ? '#fff' : '#000' }}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
