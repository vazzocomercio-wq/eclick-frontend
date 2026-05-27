import Link from 'next/link'
import Image from 'next/image'
import { Clock } from 'lucide-react'
import type { PostCardData } from '../lib/types'
import { C, fmtDate, pillarColor } from './tokens'

/** Card de post pra grids (home, categoria, autor, tag, relacionados). */
export function PostCard({ post, featured = false }: { post: PostCardData; featured?: boolean }) {
  const catColor = pillarColor(post.category?.color)
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="bl-card"
      style={{
        display: 'flex',
        flexDirection: featured ? 'column' : 'column',
        background: C.CARD,
        border: `1px solid ${C.BORDER}`,
        borderRadius: 16,
        overflow: 'hidden',
        textDecoration: 'none',
        color: C.TXT,
        height: '100%',
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: featured ? '21 / 9' : '16 / 9', background: '#0a0a0e' }}>
        {post.coverImage?.url && (
          <Image
            src={post.coverImage.url}
            alt={post.coverImage.alt || post.title}
            fill
            sizes={featured ? '(max-width: 1040px) 100vw, 1100px' : '(max-width: 720px) 100vw, (max-width: 1040px) 50vw, 360px'}
            style={{ objectFit: 'cover' }}
            placeholder={post.coverImage.lqip ? 'blur' : 'empty'}
            blurDataURL={post.coverImage.lqip}
            priority={featured}
          />
        )}
      </div>
      <div style={{ padding: featured ? '24px 24px 26px' : '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {post.category && (
          <span style={{
            alignSelf: 'flex-start', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: catColor,
            background: `${catColor}14`, border: `1px solid ${catColor}44`,
            borderRadius: 999, padding: '4px 10px',
          }}>
            {post.category.icon ? `${post.category.icon} ` : ''}{post.category.title}
          </span>
        )}
        <h3 style={{
          fontSize: featured ? 'clamp(1.4rem, 2.6vw, 2rem)' : 18,
          fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0,
        }}>
          {post.title}
        </h3>
        <p style={{ fontSize: featured ? 16 : 14, color: C.MUT, lineHeight: 1.6, margin: 0 }}>
          {post.excerpt}
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 8,
          fontSize: 12.5, color: C.DIM,
        }}>
          {post.author?.name && <span>{post.author.name}</span>}
          {post.author?.name && <span>·</span>}
          <span>{fmtDate(post.publishedAt)}</span>
          {post.readingTimeMinutes ? (
            <>
              <span>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {post.readingTimeMinutes} min
              </span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
