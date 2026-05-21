/**
 * ProductGrid v3 — grid responsivo de produtos.
 *
 * Mobile-first: mobile cai pra `columns.mobile` (2 default), tablet/desktop
 * aumentam via Tailwind `sm:` `md:` `lg:`.
 *
 * Source: filtra/seleciona produtos do ctx.products conforme `source.kind`.
 * Sources 'storefront' e 'manual' resolvem 100% client-side com o que ja
 * veio pre-fetched. 'collection', 'bestsellers', 'newest', 'promo' ainda
 * dependem de fetch adicional — por ora caem em 'storefront' como fallback
 * (a rota da pagina deve eventualmente pre-fetch por source).
 */

import type { ProductGridSection } from '@/lib/storefront/v3/types'
import type { StorefrontProduct } from '@/lib/storefront/v3/data'
import type { RenderCtx } from '../RenderCtx'
import { formatBRL } from '@/lib/storefront/v3/data'

function pickProducts(all: StorefrontProduct[], src: ProductGridSection['settings']['source']): StorefrontProduct[] {
  switch (src.kind) {
    case 'manual': {
      const ids = new Set(src.productIds)
      return all.filter(p => ids.has(p.id))
    }
    case 'storefront':
    case 'collection':   // TODO pre-fetch por coleção na rota
    case 'bestsellers':  // TODO pre-fetch ranking
    case 'newest':       // TODO order by created_at
    case 'promo':        // TODO filter discount > 0
    default:
      return all
  }
}

function colClass(n: number, breakpoint: '' | 'sm' | 'md' | 'lg'): string {
  // Tailwind precisa de classes literais — mapeamos manualmente os valores
  // possiveis (1..6) por breakpoint pra que o purge nao remova.
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

export function ProductGridSectionView({ ctx, section }: { ctx: RenderCtx; section: ProductGridSection }) {
  const { title, source, columns, limit, cardStyle } = section.settings
  const all = ctx.products ?? []
  const products = pickProducts(all, source).slice(0, limit)

  if (products.length === 0) {
    return (
      <div className="container mx-auto px-4 text-center py-10" style={{ color: 'var(--c-text-muted)' }}>
        {title && <h2 className="mb-3" style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.5rem' }}>{title}</h2>}
        <p>Nenhum produto disponível no momento.</p>
      </div>
    )
  }

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
        {products.map(p => <ProductCard key={p.id} ctx={ctx} product={p} variant={cardStyle} />)}
      </div>
    </div>
  )
}

function ProductCard({ ctx, product, variant }: {
  ctx: RenderCtx
  product: StorefrontProduct
  variant: 'compact' | 'detailed' | 'minimal'
}) {
  const img = product.photo_urls?.[0]
  const showCategory = variant !== 'minimal' && product.category
  const showShort    = variant === 'detailed' && product.ai_short_description

  return (
    <a
      href={`/loja/${ctx.slug}/produto/${product.id}`}
      style={{ display: 'block', textDecoration: 'none', color: 'var(--c-text)' }}
    >
      <div style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 'var(--r)', background: 'var(--c-surface)' }}>
        {img
          ? <img src={img} alt={product.name} loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : null}
      </div>
      <div style={{ padding: '12px 4px 0' }}>
        {showCategory && (
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-muted)', marginBottom: 4 }}>
            {product.category}
          </div>
        )}
        <h3 style={{ fontFamily: 'var(--f-body)', fontSize: 14, fontWeight: 500, lineHeight: 1.3, margin: 0 }}>
          {product.name}
        </h3>
        {showShort && (
          <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            {product.ai_short_description}
          </p>
        )}
        <div style={{ marginTop: 8, fontWeight: 600, color: 'var(--c-primary)', fontSize: 16 }}>
          {formatBRL(product.price)}
        </div>
      </div>
    </a>
  )
}
