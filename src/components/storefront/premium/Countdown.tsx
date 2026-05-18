'use client'

/**
 * Contador regressive da faixa de anuncio (announcementBar.countdownTo).
 *
 * Renderiza nada no servidor — so depois de montar no cliente — pra nao
 * gerar mismatch de hidratacao com o relogio.
 */

import { useEffect, useState } from 'react'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function Countdown({ to, color }: { to: string; color: string }) {
  const target = new Date(to).getTime()
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (now === null || !Number.isFinite(target)) return null

  const left = Math.max(0, target - now)
  const s = Math.floor(left / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60

  return (
    <span className="font-semibold" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
      {d > 0 ? `${d}d ` : ''}{pad(h)}:{pad(m)}:{pad(sec)}
    </span>
  )
}
