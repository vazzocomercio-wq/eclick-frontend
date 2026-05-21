/**
 * ProductDetailLayout v3 — esqueleto da pagina de produto.
 *
 * Esta section so e usada na page `product`. O renderer assume que a rota
 * (`/loja/[slug]/produto/[id]`) pre-carregou o produto e o passou via
 * ctx.products[0] (single product context).
 *
 * Sticky add-to-cart (mobile-first) e tratado por um Client Component
 * separado (AddToCartSticky) que B.5 da rota vai montar — aqui o esqueleto
 * deixa um marcador.
 *
 * Galleria: por simplicidade, B.3b renderiza a primeira foto + miniaturas.
 * Galeria interativa com troca client-side fica pra refinement.
 */

import type { ProductDetailLayoutSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'
import { formatBRL } from '@/lib/storefront/v3/data'

export function ProductDetailLayoutSectionView({ ctx, section }: { ctx: RenderCtx; section: ProductDetailLayoutSection }) {
  const { galleryPosition, stickyAddToCart, showShareButtons } = section.settings
  const product = (ctx.products ?? [])[0]
  if (!product) {
    return (
      <div className="container mx-auto px-4 text-center" style={{ color: 'var(--c-text-muted)' }}>
        Produto não encontrado.
      </div>
    )
  }
  void stickyAddToCart // marcador — vira AddToCartSticky em B.5

  const photos = product.photo_urls ?? []
  const main   = photos[0]
  const thumbs = photos.slice(1, 5)

  const reverseClass =
    galleryPosition === 'right' ? 'md:flex-row-reverse'
    : galleryPosition === 'top'   ? 'flex-col'
    : 'md:flex-row'

  return (
    <div className="container mx-auto px-4">
      <div className={`flex flex-col gap-6 md:gap-12 ${reverseClass}`}>
        {/* Galeria */}
        <div className="md:flex-1">
          <div style={{ aspectRatio: '1 / 1', background: 'var(--c-surface)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            {main && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={main} alt={product.name} loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
          </div>
          {thumbs.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              {thumbs.map((u, i) => (
                <div key={i} style={{ aspectRatio: '1/1', borderRadius: 'var(--r)', overflow: 'hidden', background: 'var(--c-surface)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detalhes */}
        <div className="md:flex-1">
          {product.category && (
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-muted)' }}>
              {product.category}
            </div>
          )}
          <h1 style={{ marginTop: 8, fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '2rem', lineHeight: 1.2 }}>
            {product.name}
          </h1>
          <div style={{ marginTop: 16, fontSize: '1.75rem', fontWeight: 700, color: 'var(--c-primary)' }}>
            {formatBRL(product.price)}
          </div>
          {product.ai_short_description && (
            <p style={{ marginTop: 16, color: 'var(--c-text-muted)', lineHeight: 1.6 }}>
              {product.ai_short_description}
            </p>
          )}

          {/* CTA — sera substituida por AddToCartSticky client na B.5 */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              style={{
                flex: 1, padding: '14px 24px', minHeight: 48,
                background: 'var(--c-primary)', color: 'var(--c-on-accent)',
                border: 0, borderRadius: 'var(--r)', cursor: 'pointer',
                fontWeight: 600, fontSize: 16,
              }}>
              Adicionar ao carrinho
            </button>
            {ctx.store.whatsapp_number && (
              <a href={`https://wa.me/${ctx.store.whatsapp_number.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  padding: '14px 24px', minHeight: 48,
                  background: 'var(--c-surface)', color: 'var(--c-text)',
                  border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
                  textDecoration: 'none', fontWeight: 500, textAlign: 'center',
                }}>
                Pedir pelo WhatsApp
              </a>
            )}
          </div>

          {showShareButtons && (
            <div className="mt-6 text-sm" style={{ color: 'var(--c-text-muted)' }}>
              Compartilhar:{' '}
              <a href="#" style={{ color: 'var(--c-primary)', textDecoration: 'underline', marginRight: 12 }}>WhatsApp</a>
              <a href="#" style={{ color: 'var(--c-primary)', textDecoration: 'underline' }}>Copiar link</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
