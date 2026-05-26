import Image from 'next/image'
import Link from 'next/link'
import {
  PortableText,
  type PortableTextComponents,
  type PortableTextBlock,
} from '@portabletext/react'
import { urlFor } from '../lib/sanity'
import { C } from './tokens'
import { blockText, headingId } from './headings'

const CALLOUT_STYLE: Record<string, { color: string; icon: string }> = {
  info: { color: '#38bdf8', icon: 'ℹ️' },
  warning: { color: '#fbbf24', icon: '⚠️' },
  tip: { color: C.GREEN, icon: '💡' },
  science: { color: '#a855f7', icon: '🔬' },
  case: { color: '#fb923c', icon: '📊' },
}

const CTA_DEFAULTS: Record<string, { href: string; label: string }> = {
  audit: { href: '/auditoria-gratis', label: 'Auditar meu anúncio (grátis)' },
  demo: { href: '/register', label: 'Conhecer a plataforma' },
  newsletter: { href: '#newsletter', label: 'Inscrever na newsletter' },
  custom: { href: '/', label: 'Saber mais' },
}

const components: PortableTextComponents = {
  types: {
    image: ({ value }) => {
      const url = value?.url || (value?.asset ? urlFor(value).width(1400).url() : null)
      if (!url) return null
      return (
        <figure style={{ margin: '28px 0' }}>
          <Image
            src={url}
            alt={value.alt || ''}
            width={value.width || 1400}
            height={value.height || 800}
            sizes="(max-width: 1040px) 100vw, 760px"
            style={{ width: '100%', height: 'auto', borderRadius: 12 }}
          />
          {value.caption && (
            <figcaption style={{ fontSize: 13, color: C.DIM, marginTop: 8, textAlign: 'center' }}>
              {value.caption}
            </figcaption>
          )}
        </figure>
      )
    },
    callout: ({ value }) => {
      const v = CALLOUT_STYLE[value?.variant as string] || CALLOUT_STYLE.info
      return (
        <div style={{
          margin: '24px 0', padding: '18px 20px', borderRadius: 12,
          background: `${v.color}10`, border: `1px solid ${v.color}44`,
          borderLeft: `4px solid ${v.color}`,
        }}>
          {value.title && (
            <div style={{ fontWeight: 800, color: v.color, fontSize: 15, marginBottom: 6 }}>
              {v.icon} {value.title}
            </div>
          )}
          <div style={{ color: '#d4d4d8', fontSize: 15.5, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {value.body}
          </div>
        </div>
      )
    },
    paperQuote: ({ value }) => (
      <figure style={{
        margin: '28px 0', padding: '22px 24px', borderRadius: 14,
        background: 'linear-gradient(160deg, rgba(168,85,247,0.08), rgba(18,18,20,0.5))',
        border: `1px solid rgba(168,85,247,0.3)`,
      }}>
        <blockquote style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: '#f4f4f5', fontStyle: 'italic' }}>
          “{value.quote}”
        </blockquote>
        <figcaption style={{ marginTop: 14, fontSize: 13, color: C.MUT }}>
          {value.paperTitle && <strong style={{ color: '#e4e4e7' }}>{value.paperTitle}</strong>}
          {value.authors ? ` · ${value.authors}` : ''}
          {value.venue ? ` · ${value.venue}` : ''}
          {value.url && (
            <>
              {' · '}
              <a href={value.url} target="_blank" rel="noopener noreferrer" style={{ color: C.CYAN }}>
                ver paper
              </a>
            </>
          )}
        </figcaption>
      </figure>
    ),
    stat: ({ value }) => (
      <div style={{
        margin: '24px 0', padding: '24px', borderRadius: 14, textAlign: 'center',
        background: C.CARD, border: `1px solid ${C.BORDER}`,
      }}>
        <div style={{ fontSize: 'clamp(2.4rem, 6vw, 3.6rem)', fontWeight: 900, color: C.CYAN, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value.value}
        </div>
        <div style={{ fontSize: 15.5, color: '#d4d4d8', marginTop: 10, lineHeight: 1.5 }}>{value.label}</div>
        {value.source && <div style={{ fontSize: 12.5, color: C.DIM, marginTop: 8 }}>Fonte: {value.source}</div>}
      </div>
    ),
    comparison: ({ value }) => (
      <div style={{ margin: '28px 0', overflowX: 'auto' }}>
        {value.title && <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12, color: C.TXT }}>{value.title}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5, minWidth: 480 }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={{ ...thStyle, color: C.MUT }}>{value.leftLabel}</th>
              <th style={{ ...thStyle, color: C.CYAN }}>{value.rightLabel}</th>
            </tr>
          </thead>
          <tbody>
            {(value.rows || []).map((row: { aspect?: string; left?: string; right?: string }, i: number) => (
              <tr key={i}>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#e4e4e7' }}>{row.aspect}</td>
                <td style={{ ...tdStyle, color: C.MUT }}>{row.left}</td>
                <td style={{ ...tdStyle, color: '#d4d4d8' }}>{row.right}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    ctaInline: ({ value }) => {
      const d = CTA_DEFAULTS[value?.variant as string] || CTA_DEFAULTS.audit
      const href = value.href || d.href
      const label = value.buttonLabel || d.label
      return (
        <div style={{
          margin: '28px 0', padding: '24px', borderRadius: 16,
          background: 'linear-gradient(160deg, rgba(0,229,255,0.08), rgba(18,18,20,0.5))',
          border: `1px solid ${C.CYAN}44`,
        }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.TXT, letterSpacing: '-0.01em' }}>{value.title}</div>
          {value.body && <p style={{ color: C.MUT, fontSize: 14.5, lineHeight: 1.6, margin: '8px 0 16px' }}>{value.body}</p>}
          <Link href={href} data-cta={value.variant || 'audit'} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: C.CYAN, color: '#04141a', fontWeight: 800, fontSize: 14.5,
            padding: '11px 18px', borderRadius: 10, textDecoration: 'none',
          }}>
            {label} →
          </Link>
        </div>
      )
    },
    code: ({ value }) => (
      <pre style={{
        margin: '24px 0', padding: '18px 20px', borderRadius: 12, overflowX: 'auto',
        background: '#0a0a0e', border: `1px solid ${C.BORDER}`, fontSize: 13.5,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: '#e4e4e7', lineHeight: 1.6,
      }}>
        {value.filename && <div style={{ color: C.DIM, fontSize: 12, marginBottom: 8 }}>{value.filename}</div>}
        <code>{value.code}</code>
      </pre>
    ),
  },
  block: {
    h2: ({ children, value }) => {
      const id = headingId(blockText(value as PortableTextBlock))
      return <h2 id={id}>{children}</h2>
    },
    h3: ({ children, value }) => {
      const id = headingId(blockText(value as PortableTextBlock))
      return <h3 id={id}>{children}</h3>
    },
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
  },
  marks: {
    link: ({ children, value }) => {
      const href = value?.href || '#'
      const external = /^https?:\/\//i.test(href) && !href.includes('eclick.app.br')
      return external ? (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
      ) : (
        <Link href={href}>{children}</Link>
      )
    },
  },
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${C.BORDER_STRONG}`,
  fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
}
const tdStyle: React.CSSProperties = {
  padding: '12px', borderBottom: `1px solid ${C.BORDER}`, verticalAlign: 'top', lineHeight: 1.55,
}

/** Renderiza o corpo do post (Portable Text) com todos os blocks customizados. */
export function PostBody({ body }: { body: PortableTextBlock[] }) {
  return (
    <div className="bl-prose">
      <PortableText value={body} components={components} />
    </div>
  )
}
