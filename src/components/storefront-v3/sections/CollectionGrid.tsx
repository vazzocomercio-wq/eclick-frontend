/**
 * CollectionGrid v3 — grade de coleções (ambientes, categorias, looks).
 *
 * Mobile-first: cai pra columns.mobile, expande nos breakpoints.
 * Cada item e um link clickavel grande (touch target inteiro).
 */

import type { CollectionGridSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'

function colClass(n: number, breakpoint: '' | 'sm' | 'md' | 'lg'): string {
  const prefix = breakpoint ? `${breakpoint}:` : ''
  const safe: Record<number, string> = {
    1: `${prefix}grid-cols-1`,
    2: `${prefix}grid-cols-2`,
    3: `${prefix}grid-cols-3`,
    4: `${prefix}grid-cols-4`,
    5: `${prefix}grid-cols-5`,
    6: `${prefix}grid-cols-6`,
  }
  return safe[n] ?? `${prefix}grid-cols-2`
}

export function CollectionGridSectionView({ ctx, section }: { ctx: RenderCtx; section: CollectionGridSection }) {
  const { title, columns, collections } = section.settings
  if (collections.length === 0) return null

  const gridCls = [
    'grid gap-4',
    colClass(columns.mobile, ''),
    colClass(columns.tablet, 'sm'),
    colClass(columns.desktop, 'md'),
  ].join(' ')

  return (
    <div className="container mx-auto px-4">
      {title && (
        <h2 className="mb-6"
          style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.875rem' }}>
          {title}
        </h2>
      )}
      <div className={gridCls}>
        {collections.map((c, i) => (
          <a
            key={i}
            href={`/loja/${ctx.slug}/produtos?col=${encodeURIComponent(c.collectionId)}`}
            style={{
              display:       'block',
              textDecoration:'none',
              color:         'var(--c-text)',
              borderRadius:  'var(--r)',
              overflow:      'hidden',
              minHeight:     44,
              position:      'relative',
            }}
          >
            <div style={{ aspectRatio: '4 / 5', background: 'var(--c-surface)', position: 'relative' }}>
              {c.imageUrl && (
                <img
                  src={c.imageUrl} alt={c.label ?? ''} loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
              {/* Overlay gradient pra texto ficar legivel */}
              <div
                aria-hidden
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent 60%)',
                }}
              />
              {c.label && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 12,
                  padding: '0 16px',
                  fontFamily: 'var(--f-heading)', color: '#fff', fontSize: '1.125rem', fontWeight: 600,
                  textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }}>
                  {c.label}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
