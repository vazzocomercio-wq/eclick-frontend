import Image from 'next/image'
import Link from 'next/link'
import { Globe } from 'lucide-react'
import type { Author } from '../lib/types'
import { C } from './tokens'

/** Caixa de bio do autor — sinal forte de E-E-A-T (autoridade/confiança). */
export function AuthorBioBox({ author }: { author?: Author }) {
  if (!author) return null
  return (
    <section style={{
      margin: '40px 0', padding: '24px', borderRadius: 16,
      background: C.CARD, border: `1px solid ${C.BORDER}`,
      display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start',
    }}>
      {author.avatar?.url && (
        <Image
          src={author.avatar.url}
          alt={author.name}
          width={72}
          height={72}
          style={{ borderRadius: 999, objectFit: 'cover', flexShrink: 0 }}
        />
      )}
      <div style={{ flex: 1, minWidth: 240 }}>
        <Link href={`/blog/autor/${author.slug}`} style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: C.TXT, letterSpacing: '-0.01em' }}>{author.name}</span>
        </Link>
        {author.role && <div style={{ fontSize: 13.5, color: C.CYAN, marginTop: 2 }}>{author.role}</div>}
        {author.bio && <p style={{ fontSize: 14.5, color: C.MUT, lineHeight: 1.6, margin: '10px 0 0' }}>{author.bio}</p>}
        {author.credentials?.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {author.credentials.map((c, i) => (
              <span key={i} style={{
                fontSize: 12, color: '#d4d4d8', background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${C.BORDER}`, borderRadius: 999, padding: '4px 10px',
              }}>
                {c}
              </span>
            ))}
          </div>
        ) : null}
        {author.socialLinks && (
          <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
            {author.socialLinks.linkedin && (
              <a href={author.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="bl-link" aria-label="LinkedIn" style={{ fontWeight: 800, fontSize: 15 }}>in</a>
            )}
            {author.socialLinks.twitter && (
              <a href={author.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="bl-link" aria-label="Twitter/X" style={{ fontWeight: 800, fontSize: 16, lineHeight: 1 }}>𝕏</a>
            )}
            {author.socialLinks.website && (
              <a href={author.socialLinks.website} target="_blank" rel="noopener noreferrer" className="bl-link" aria-label="Website"><Globe size={18} /></a>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
