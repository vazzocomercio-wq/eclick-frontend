'use client'

/**
 * AnnouncementBarClient — parte interativa da faixa de anúncio v3.
 *
 *  - dismissible: X que fecha e persiste em localStorage POR loja+texto
 *    (mudou a mensagem → a faixa volta). Quando dispensada, esconde a
 *    <section> pai inteira via [data-section-id] (remove padding/fundo).
 *  - countdownTo: contagem regressiva dd:hh:mm:ss client-side; quando
 *    expira, o countdown some (a mensagem continua).
 *
 * Render inicial (SSR) = mensagem sem countdown/sem dismiss aplicado, pra
 * evitar mismatch de hidratação; ajusta após o mount.
 */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/** Hash simples (djb2) — chave estável por texto da mensagem. */
function textHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

const dismissKey = (slug: string, message: string) => `eclick-annc:${slug}:${textHash(message)}`

function pad(n: number): string { return String(n).padStart(2, '0') }

/** Diferença até `end` formatada dd:hh:mm:ss — null quando expirado. */
function remaining(end: Date): string | null {
  const ms = end.getTime() - Date.now()
  if (ms <= 0) return null
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return `${pad(d)}:${pad(h)}:${pad(m)}:${pad(r)}`
}

export function AnnouncementBarClient({ sectionId, slug, message, ctaLabel, ctaHref, countdownTo, dismissible }: {
  sectionId:   string
  slug:        string
  message:     string
  ctaLabel?:   string
  ctaHref?:    string
  countdownTo?: string | null
  dismissible: boolean
}) {
  const [dismissed, setDismissed] = useState(false)
  const [countdown, setCountdown] = useState<string | null>(null)

  // Estado de "dispensada" persistido (só depois do mount — SSR neutro)
  useEffect(() => {
    if (!dismissible) return
    try {
      if (window.localStorage.getItem(dismissKey(slug, message)) === '1') setDismissed(true)
    } catch { /* ignore */ }
  }, [dismissible, slug, message])

  // Countdown 1s — para sozinho quando expira
  useEffect(() => {
    if (!countdownTo) return
    const end = new Date(countdownTo)
    if (Number.isNaN(end.getTime())) return
    const tick = () => {
      const r = remaining(end)
      setCountdown(r)
      return r
    }
    if (tick() === null) return  // já expirado — não agenda
    const id = setInterval(() => { if (tick() === null) clearInterval(id) }, 1000)
    return () => clearInterval(id)
  }, [countdownTo])

  const dismiss = () => {
    setDismissed(true)
    try { window.localStorage.setItem(dismissKey(slug, message), '1') } catch { /* quota */ }
  }

  if (dismissed) {
    // Esconde a <section> pai inteira (padding/fundo inclusos)
    return <style dangerouslySetInnerHTML={{ __html: `[data-section-id="${sectionId}"]{display:none}` }} />
  }

  return (
    <div className="container mx-auto px-4 text-center text-sm"
      style={{ color: 'var(--c-on-accent)', position: 'relative', paddingRight: dismissible ? 44 : undefined }}>
      {message}
      {countdown && (
        <span style={{
          marginLeft: 10, fontVariantNumeric: 'tabular-nums', fontWeight: 700,
          letterSpacing: '0.04em',
        }} aria-label="Tempo restante">
          {countdown}
        </span>
      )}
      {ctaLabel && ctaHref && <a href={ctaHref} className="ml-3 underline" style={{ color: 'inherit' }}>{ctaLabel}</a>}
      {dismissible && (
        <button type="button" onClick={dismiss} aria-label="Fechar aviso"
          style={{
            position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
            minHeight: 44, minWidth: 44,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit',
          }}>
          <X size={16} />
        </button>
      )}
    </div>
  )
}
