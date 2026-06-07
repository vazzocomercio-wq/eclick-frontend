'use client'

/**
 * ProductCard v3 — card de produto reutilizável (grid estático + filtro de
 * categorias). Extraído do ProductGrid pra ser usável também no
 * CatalogFilterGrid (Client Component). Puramente apresentacional.
 */

import type { StorefrontProduct } from '@/lib/storefront/v3/data'
import type { RenderCtx } from '../RenderCtx'
import { PriceDisplay, SaleBadge } from '../PriceDisplay'
import { findBonusBadge, BonusBadge } from '../bonusBadge'
import { WishlistButton } from '../WishlistButton'
import { ReviewStars } from '@/components/storefront/ReviewStars'

export function ProductCard({ ctx, product, variant }: {
  ctx: RenderCtx
  product: StorefrontProduct
  variant: 'compact' | 'detailed' | 'minimal'
}) {
  const img = product.photo_urls?.[0]
  // Categoria só quando é nome legível — esconde código cru do ML (MLB1586 etc).
  const humanCategory = product.category && !/^MLB\d+$/i.test(product.category) ? product.category : null
  const showCategory = variant !== 'minimal' && !!humanCategory
  const showBrand    = variant === 'detailed' && product.brand
  const showShort    = variant === 'detailed' && product.ai_short_description
  const isLowStock   = typeof product.stock === 'number' && product.stock > 0 && product.stock <= 3
  const isNew = (() => {
    if (!product.created_at) return false
    const days = (Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24)
    return days <= 30
  })()
  const bonusBadge = findBonusBadge(product.id, ctx.bonusRules)

  return (
    <a
      href={`/loja/${ctx.slug}/produto/${product.id}`}
      style={{ display: 'block', textDecoration: 'none', color: 'var(--c-text)' }}
    >
      <div style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 'var(--r)', background: 'transparent' }}>
        {img
          ? /* eslint-disable-next-line @next/next/no-img-element */
            <img src={img} alt={product.name} loading="lazy"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 4, boxSizing: 'border-box', display: 'block' }} />
          : null}
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
          <WishlistButton slug={ctx.slug} productId={product.id} size="sm" />
        </div>
        {(isNew || isLowStock || product.on_sale || bonusBadge) && (
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {product.on_sale && <SaleBadge product={product} />}
            {bonusBadge && <BonusBadge badge={bonusBadge} />}
            {isNew && !product.on_sale && (
              <span style={{
                padding: '3px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                background: 'var(--c-primary)', color: 'var(--c-on-accent)',
                borderRadius: 'var(--r)', textTransform: 'uppercase',
              }}>Novo</span>
            )}
            {isLowStock && (
              <span style={{
                padding: '3px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                background: 'var(--c-warning, #eab308)', color: '#0a0a0e',
                borderRadius: 'var(--r)', textTransform: 'uppercase',
              }}>Últimas {product.stock}</span>
            )}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 4px 0' }}>
        {(showCategory || showBrand) && (
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-muted)', marginBottom: 4 }}>
            {showBrand && product.brand}
            {showBrand && showCategory && ' · '}
            {showCategory && humanCategory}
          </div>
        )}
        <h3 style={{ fontFamily: 'var(--f-body)', fontSize: 14, fontWeight: 500, lineHeight: 1.3, margin: 0 }}>
          {product.name}
        </h3>
        {typeof product.review_count === 'number' && product.review_count > 0 && (
          <div style={{ marginTop: 6 }}>
            <ReviewStars value={product.review_avg ?? 0} count={product.review_count} size={13} idSeed={product.id} />
          </div>
        )}
        {showShort && (
          <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {product.ai_short_description}
          </p>
        )}
        <div style={{ marginTop: 8 }}>
          <PriceDisplay product={product} settings={ctx.paymentDisplay} cashback={ctx.cashback} variant="card" />
        </div>
      </div>
    </a>
  )
}
