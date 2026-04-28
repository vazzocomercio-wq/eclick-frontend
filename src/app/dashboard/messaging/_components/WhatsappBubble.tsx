'use client'

import { useMemo } from 'react'

const VAR_RE = /(\{\{\s*\w+\s*\}\})/g

/** Bubble estilo WhatsApp (verde escuro, pseudo-status). Renderiza
 * {{vars}} em cyan se highlightVars=true (modo edição); senão substitui
 * por context[var]. Múltiplas linhas preservam quebras. */
export function WhatsappBubble({
  message, context, highlightVars = false,
}: {
  message:        string
  context?:       Record<string, string>
  highlightVars?: boolean
}) {
  const parts = useMemo(() => {
    if (highlightVars) return message.split(VAR_RE)
    const rendered = message.replace(VAR_RE, (m) => {
      const key = m.replace(/[{}\s]/g, '')
      const v = context?.[key]
      return v === undefined ? m : v
    })
    return [rendered]
  }, [message, context, highlightVars])

  const time = useMemo(() => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }, [])

  return (
    <div className="rounded-xl px-4 py-3" style={{ background: '#0a3a35', border: '1px solid #134e48' }}>
      <div className="text-[12px] text-emerald-300/70 mb-1">{time}</div>
      <div className="text-white text-sm whitespace-pre-wrap leading-relaxed">
        {parts.map((p, i) => {
          if (highlightVars && VAR_RE.test(p)) {
            VAR_RE.lastIndex = 0 // reset stateful regex
            return <span key={i} className="font-mono text-cyan-400">{p}</span>
          }
          VAR_RE.lastIndex = 0
          return <span key={i}>{p}</span>
        })}
      </div>
      <div className="text-[10px] text-emerald-300/60 text-right mt-1">✓✓ {time}</div>
    </div>
  )
}
