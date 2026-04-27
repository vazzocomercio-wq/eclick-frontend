'use client'

import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, XCircle, Info, Construction } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'info' | 'warn' | 'todo'

export type ToastInput = {
  message:  string
  tone?:    ToastTone
  duration?: number
}

type ToastItem = {
  id:       number
  message:  string
  tone:     ToastTone
  duration: number
}

let _id = 0
const subs = new Set<(items: ToastItem[]) => void>()
let queue: ToastItem[] = []

function emit() { for (const s of subs) s(queue) }

export function pushToast(input: ToastInput | string) {
  const t: ToastItem = typeof input === 'string'
    ? { id: ++_id, message: input, tone: 'info', duration: 4000 }
    : { id: ++_id, message: input.message, tone: input.tone ?? 'info', duration: input.duration ?? 4000 }
  queue = [...queue, t]
  emit()
  setTimeout(() => {
    queue = queue.filter(x => x.id !== t.id)
    emit()
  }, t.duration)
}

/** Convenience for stubbed buttons — shows the same "Em desenvolvimento" message
 * everywhere so the UX is predictable while features land sprint-by-sprint. */
export function todoToast(label: string) {
  pushToast({ tone: 'todo', message: `${label} — em desenvolvimento, agendado para próxima sprint`, duration: 5000 })
}

const TONE_STYLE: Record<ToastTone, { bg: string; border: string; color: string; Icon: React.ComponentType<{ size?: number }> }> = {
  success: { bg: '#0a1f10', border: '#16a34a40', color: '#4ade80', Icon: CheckCircle2 },
  error:   { bg: '#1f0a0a', border: '#dc262640', color: '#f87171', Icon: XCircle },
  info:    { bg: '#0a141f', border: '#3b82f640', color: '#60a5fa', Icon: Info },
  warn:    { bg: '#1f1a0a', border: '#facc1540', color: '#facc15', Icon: AlertTriangle },
  todo:    { bg: '#0a1a1f', border: '#00E5FF40', color: '#00E5FF', Icon: Construction },
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const fn = (q: ToastItem[]) => setItems([...q])
    subs.add(fn)
    fn(queue)
    return () => { subs.delete(fn) }
  }, [])
  if (!mounted || typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed z-[60] right-4 bottom-4 flex flex-col gap-2 max-w-sm w-[360px] pointer-events-none">
      {items.map(t => {
        const s = TONE_STYLE[t.tone]
        const Icon = s.Icon
        return (
          <div key={t.id}
            className="rounded-xl px-3 py-2.5 text-[12px] flex items-start gap-2 pointer-events-auto shadow-lg"
            style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
            <Icon size={14} />
            <span className="leading-snug whitespace-pre-line">{t.message}</span>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

export function useToast() {
  return useCallback((input: ToastInput | string) => pushToast(input), [])
}
