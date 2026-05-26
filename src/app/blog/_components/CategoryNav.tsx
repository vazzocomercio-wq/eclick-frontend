import Link from 'next/link'
import type { Category } from '../lib/types'
import { C, pillarColor } from './tokens'

/** Navegação horizontal pelos 7 pilares editoriais. */
export function CategoryNav({ categories, activeSlug }: { categories: Category[]; activeSlug?: string }) {
  if (!categories.length) return null
  return (
    <nav className="bl-pillars" aria-label="Pilares editoriais">
      {categories.map((cat) => {
        const color = pillarColor(cat.color)
        const active = cat.slug === activeSlug
        return (
          <Link
            key={cat._id}
            href={`/blog/categoria/${cat.slug}`}
            className="bl-card"
            style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '14px 14px', borderRadius: 12, textDecoration: 'none',
              background: active ? `${color}14` : C.CARD,
              border: `1px solid ${active ? `${color}66` : C.BORDER}`,
            }}
          >
            <span style={{ fontSize: 18 }}>{cat.icon || '•'}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: active ? color : C.TXT, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {cat.title}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
