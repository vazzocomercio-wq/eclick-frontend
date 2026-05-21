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
import { ProductGalleryClient } from './ProductGalleryClient'

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

  // Combina photo_urls (array principal) + images jsonb (legado) — dedup.
  const photoUrls = product.photo_urls ?? []
  const imagesJson = (product as unknown as { images?: unknown }).images
  const extraUrls: string[] = Array.isArray(imagesJson)
    ? (imagesJson as unknown[]).map(x => typeof x === 'string' ? x : (typeof x === 'object' && x && 'url' in x ? (x as { url: string }).url : null)).filter((u): u is string => typeof u === 'string')
    : []
  const photos: string[] = Array.from(new Set([...photoUrls, ...extraUrls].filter(u => u && u.startsWith('http'))))
  // Texto da descrição completa (resolvido fora do JSX pra contornar
  // inferência esquisita do TS quando concatenamos opcionais no JSX).
  const longDescText: string = String(
    (product as unknown as { ai_long_description?: unknown }).ai_long_description ??
    (product as unknown as { description?: unknown }).description ?? ''
  )
  // Entries de atributos pra renderização (max 20)
  const attrs = (product as unknown as { attributes?: unknown }).attributes
  const attrEntries: Array<[string, string]> = (attrs && typeof attrs === 'object' && !Array.isArray(attrs))
    ? Object.entries(attrs as Record<string, unknown>).slice(0, 20).map(([k, v]) => [k, String(v)])
    : []

  const reverseClass =
    galleryPosition === 'right' ? 'md:flex-row-reverse'
    : galleryPosition === 'top'   ? 'flex-col'
    : 'md:flex-row'

  return (
    <div className="container mx-auto px-4">
      <div className={`flex flex-col gap-6 md:gap-12 ${reverseClass}`}>
        {/* Galeria interativa (todas as fotos, thumbs clicaveis) */}
        <div className="md:flex-1">
          <ProductGalleryClient photos={photos} alt={product.name} />
        </div>

        {/* Detalhes */}
        <div className="md:flex-1">
          {(product.brand || product.category) && (
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-muted)' }}>
              {product.brand && <span>{product.brand}</span>}
              {product.brand && product.category && ' · '}
              {product.category && <span>{product.category}</span>}
            </div>
          )}
          <h1 style={{ marginTop: 8, fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '2rem', lineHeight: 1.2 }}>
            {product.name}
          </h1>
          {(product.sku || product.model) && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--c-text-muted)' }}>
              {product.sku && <span>SKU: {product.sku}</span>}
              {product.sku && product.model && ' · '}
              {product.model && <span>Modelo: {product.model}</span>}
            </div>
          )}
          <div style={{ marginTop: 16, fontSize: '1.75rem', fontWeight: 700, color: 'var(--c-primary)' }}>
            {formatBRL(product.my_price ?? product.price)}
          </div>
          {typeof product.stock === 'number' && product.stock > 0 && product.stock <= 5 && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--c-warning, #eab308)', fontWeight: 600 }}>
              ⚡ Apenas {product.stock} em estoque
            </div>
          )}
          {product.ai_short_description && (
            <p style={{ marginTop: 16, color: 'var(--c-text-muted)', lineHeight: 1.6 }}>
              {product.ai_short_description}
            </p>
          )}
          {/* Bullets (lista de destaques) */}
          {Array.isArray(product.bullets) && product.bullets.length > 0 && (
            <ul style={{ marginTop: 16, paddingLeft: 18, color: 'var(--c-text)' }}>
              {(product.bullets as unknown[]).slice(0, 6).map((b, i) => (
                <li key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>{String(b)}</li>
              ))}
            </ul>
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

      {/* Descrição completa + atributos abaixo da galeria */}
      {longDescText.trim() ? (
        <div className="mt-12 max-w-3xl">
          <h2 style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.5rem', marginBottom: 12 }}>
            Sobre este produto
          </h2>
          <div style={{ color: 'var(--c-text)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{longDescText}</div>
        </div>
      ) : null}

      {/* Atributos (especificações técnicas) */}
      <AttributesBlock attrs={attrEntries} />
    </div>
  )
}

function AttributesBlock({ attrs }: { attrs: Array<[string, string]> }) {
  if (attrs.length === 0) return null
  return (
    <div className="mt-10 max-w-3xl">
      <h3 style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.25rem', marginBottom: 12 }}>
        Especificações
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <tbody>
          {attrs.map(([k, v]) => (
            <tr key={k} style={{ borderBottom: '1px solid var(--c-border)' }}>
              <td style={{ padding: '10px 12px 10px 0', color: 'var(--c-text-muted)', textTransform: 'capitalize', width: '40%' }}>{k.replace(/_/g, ' ')}</td>
              <td style={{ padding: '10px 0', color: 'var(--c-text)' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

