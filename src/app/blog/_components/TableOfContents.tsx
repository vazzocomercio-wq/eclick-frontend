import type { Heading } from './headings'
import { C } from './tokens'

/** Índice (TOC) gerado dos H2/H3 do corpo. Âncoras puras (funciona sem JS). */
export function TableOfContents({ headings }: { headings: Heading[] }) {
  if (headings.length < 2) return null
  return (
    <nav className="bl-sticky" aria-label="Índice" style={{ fontSize: 13.5 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.DIM, marginBottom: 12 }}>
        Neste post
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8, borderLeft: `1px solid ${C.BORDER}` }}>
        {headings.map((h) => (
          <li key={h.id} style={{ paddingLeft: h.level === 3 ? 24 : 12 }}>
            <a href={`#${h.id}`} className="bl-link" style={{ fontSize: h.level === 3 ? 12.5 : 13.5 }}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
      <a href="#top" className="bl-link" style={{ display: 'inline-block', marginTop: 16, fontSize: 12.5, color: C.DIM }}>
        ↑ Voltar ao topo
      </a>
    </nav>
  )
}
