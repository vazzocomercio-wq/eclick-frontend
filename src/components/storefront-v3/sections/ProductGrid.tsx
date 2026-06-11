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
 *
 * Na página de coleção (/produtos) o grid ganha a barra de categorias
 * (Cat-2b) via CatalogFilterGrid. O card foi extraído pra ProductCard.tsx.
 */

import type { ProductGridSection } from '@/lib/storefront/v3/types'
import type { StorefrontProduct } from '@/lib/storefront/v3/data'
import type { RenderCtx } from '../RenderCtx'
import { ProductCard } from './ProductCard'
import { CatalogFilterGrid } from './CatalogFilterGrid'
import { resolveSectionProducts } from '../resolveSectionProducts'

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
  const products = resolveSectionProducts(ctx, source, limit)

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

  // Na página de coleção (/produtos) com a fonte do catálogo, mostra a barra
  // de categorias (Cat-2b) + grid filtrável. Nos demais (home/destaques),
  // mantém o grid estático de sempre.
  const showCategoryFilter = ctx.page === 'collection' && (source.kind === 'storefront' || source.kind === 'collection')

  return (
    <div className="container mx-auto px-4">
      {title && (
        <h2 className="mb-6"
          style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.875rem' }}>
          {title}
        </h2>
      )}
      {showCategoryFilter ? (
        <CatalogFilterGrid ctx={ctx} products={products} columns={columns} cardStyle={cardStyle} />
      ) : (
        <div className={gridCls}>
          {products.map(p => <ProductCard key={p.id} ctx={ctx} product={p} variant={cardStyle} />)}
        </div>
      )}
    </div>
  )
}
