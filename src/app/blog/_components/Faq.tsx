import type { FaqItem } from '../lib/types'
import { C } from './tokens'

/** Acordeon de FAQ. O JSON-LD FAQPage é emitido pela página (schema-org). */
export function Faq({ items }: { items?: FaqItem[] }) {
  if (!items?.length) return null
  return (
    <section style={{ margin: '48px 0' }} aria-label="Perguntas frequentes">
      <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 20px', color: C.TXT }}>
        Perguntas frequentes
      </h2>
      {items.map((f, i) => (
        <details key={i} className="bl-faq bl-card" style={{
          marginBottom: 12, background: C.CARD, border: `1px solid ${C.BORDER}`, borderRadius: 12,
        }}>
          <summary style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '16px 18px', fontSize: 15.5, fontWeight: 600, color: C.TXT,
          }}>
            {f.question}
            <span className="bl-faq-plus" style={{ color: C.CYAN, fontSize: 20, fontWeight: 400 }}>+</span>
          </summary>
          <p style={{ padding: '0 18px 18px', margin: 0, fontSize: 14.5, color: C.MUT, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {f.answer}
          </p>
        </details>
      ))}
    </section>
  )
}
