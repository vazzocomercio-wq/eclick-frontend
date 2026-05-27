import Image from 'next/image'
import Link from 'next/link'
import type { StoreBlogBodyNode, StoreBlogProduct } from '@/lib/storefront/blog'

export interface BlogColors {
  text: string
  textMuted: string
  primary: string
  surface: string
  border: string
  onAccent: string
}

function formatBRL(n: number): string {
  try {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  } catch {
    return `R$ ${n.toFixed(2)}`
  }
}

function spanText(node: StoreBlogBodyNode): string {
  const children = (node.children as Array<{ text?: string }> | undefined) ?? []
  return children.map((c) => c.text ?? '').join('')
}

/** Renderiza o corpo (blocks Portable-Text-like) do post da loja com o tema. */
export function StoreBlogBody({
  body,
  products,
  slug,
  colors,
}: {
  body: StoreBlogBodyNode[]
  products: StoreBlogProduct[]
  slug: string
  colors: BlogColors
}) {
  const byId = new Map(products.map((p) => [p.id, p]))

  return (
    <div style={{ color: colors.text, fontSize: 17, lineHeight: 1.75 }}>
      {body.map((node) => {
        const key = node._key
        switch (node._type) {
          case 'block': {
            const style = (node.style as string) || 'normal'
            const text = spanText(node)
            if (!text.trim()) return null
            if (style === 'h2')
              return (
                <h2 key={key} style={{ fontFamily: 'var(--bl-heading)', fontWeight: 700, fontSize: 'clamp(1.5rem,3vw,2rem)', letterSpacing: '-0.02em', margin: '36px 0 14px', color: colors.text }}>
                  {text}
                </h2>
              )
            if (style === 'h3')
              return (
                <h3 key={key} style={{ fontFamily: 'var(--bl-heading)', fontWeight: 600, fontSize: 'clamp(1.2rem,2vw,1.4rem)', margin: '26px 0 10px', color: colors.text }}>
                  {text}
                </h3>
              )
            return <p key={key} style={{ margin: '0 0 18px' }}>{text}</p>
          }
          case 'image': {
            const url = node.url as string | undefined
            if (!url) return null
            return (
              <figure key={key} style={{ margin: '28px 0' }}>
                <Image src={url} alt={(node.alt as string) || ''} width={1200} height={700} sizes="(max-width:820px) 100vw, 760px" style={{ width: '100%', height: 'auto', borderRadius: 12 }} unoptimized />
                {node.caption ? <figcaption style={{ fontSize: 13, color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>{node.caption as string}</figcaption> : null}
              </figure>
            )
          }
          case 'productGrid': {
            const ids = (node.productIds as string[]) || []
            const items = ids.map((id) => byId.get(id)).filter((p): p is StoreBlogProduct => !!p)
            if (!items.length) return null
            return (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, margin: '28px 0' }}>
                {items.map((p) => (
                  <Link key={p.id} href={`/loja/${slug}/produto/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden', background: colors.surface, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', aspectRatio: '1/1', background: colors.surface }}>
                      {p.photo_url ? <Image src={p.photo_url} alt={p.name} fill sizes="200px" style={{ objectFit: 'cover' }} unoptimized /> : null}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                      <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700, color: colors.primary }}>{formatBRL(p.price)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          }
          case 'callout': {
            return (
              <div key={key} style={{ margin: '24px 0', padding: '16px 18px', borderRadius: 12, background: `${colors.primary}10`, borderLeft: `4px solid ${colors.primary}` }}>
                {node.title ? <div style={{ fontWeight: 700, color: colors.primary, marginBottom: 4 }}>{node.title as string}</div> : null}
                <div style={{ whiteSpace: 'pre-wrap' }}>{node.body as string}</div>
              </div>
            )
          }
          case 'stat': {
            return (
              <div key={key} style={{ margin: '24px 0', padding: 24, borderRadius: 14, textAlign: 'center', background: colors.surface, border: `1px solid ${colors.border}` }}>
                <div style={{ fontFamily: 'var(--bl-heading)', fontSize: 'clamp(2.2rem,6vw,3.2rem)', fontWeight: 800, color: colors.primary, lineHeight: 1 }}>{node.value as string}</div>
                <div style={{ marginTop: 8 }}>{node.label as string}</div>
                {node.source ? <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 6 }}>Fonte: {node.source as string}</div> : null}
              </div>
            )
          }
          case 'comparison': {
            const rows = (node.rows as Array<{ aspect?: string; left?: string; right?: string }>) || []
            return (
              <div key={key} style={{ margin: '28px 0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${colors.border}` }} />
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{node.leftLabel as string}</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${colors.border}`, color: colors.primary }}>{node.rightLabel as string}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: 12, borderBottom: `1px solid ${colors.border}`, fontWeight: 600 }}>{r.aspect}</td>
                        <td style={{ padding: 12, borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{r.left}</td>
                        <td style={{ padding: 12, borderBottom: `1px solid ${colors.border}` }}>{r.right}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
          case 'paperQuote': {
            return (
              <figure key={key} style={{ margin: '28px 0', padding: '20px 22px', borderRadius: 14, background: colors.surface, border: `1px solid ${colors.border}` }}>
                <blockquote style={{ margin: 0, fontSize: 17, fontStyle: 'italic' }}>“{node.quote as string}”</blockquote>
                <figcaption style={{ marginTop: 12, fontSize: 13, color: colors.textMuted }}>
                  {node.paperTitle ? <strong>{node.paperTitle as string}</strong> : null}
                  {node.authors ? ` · ${node.authors as string}` : ''}
                  {node.url ? <> · <a href={node.url as string} target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>ver fonte</a></> : null}
                </figcaption>
              </figure>
            )
          }
          default:
            return null
        }
      })}
    </div>
  )
}
