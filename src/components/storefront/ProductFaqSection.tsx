/**
 * Seção de Perguntas Frequentes na página de produto (Loja Própria).
 *
 * Conteúdo REAL vindo de products.faq (Q&A curados/gerados). É renderizado
 * VISÍVEL (server component, sem JS) usando <details> nativo — acessível,
 * crawlável e casando com o FAQPage JSON-LD (ver structured-data.ts).
 *
 * Cores vêm do tema da loja (CSS vars `--text`, `--text-muted`, `--surface`,
 * `--border`, `--primary`) expostas pelo StoreShell.
 */

interface Props {
  faq?: Array<{ q: string; a: string }> | null
}

export function ProductFaqSection({ faq }: Props) {
  const items = (faq ?? []).filter(f => f?.q?.trim() && f?.a?.trim())
  if (items.length === 0) return null

  return (
    <section aria-label="Perguntas frequentes" style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text, #18181b)', marginBottom: 16 }}>
        Perguntas frequentes
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((f, i) => (
          <details
            key={i}
            open={i === 0}
            style={{
              background: 'var(--surface, #fff)',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                listStyle: 'none',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text, #18181b)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span>{f.q.trim()}</span>
              <span aria-hidden style={{ color: 'var(--primary, #00E5FF)', fontSize: 20, lineHeight: 1, flexShrink: 0 }}>+</span>
            </summary>
            <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.65, color: 'var(--text-muted, #52525b)' }}>
              {f.a.trim()}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
