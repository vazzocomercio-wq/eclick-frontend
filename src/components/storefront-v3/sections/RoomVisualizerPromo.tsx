/**
 * Seção promocional do Ambientador IA ("Veja no seu ambiente").
 *
 * Em página de produto (ctx.products[0]) abre o ambientador pro produto
 * atual; em outras páginas leva o cliente a escolher um produto na vitrine.
 *
 * O botão real (RoomVisualizerLauncher) é Client e se auto-oculta se a loja
 * não ativou o recurso — então a seção só mostra o CTA quando faz sentido.
 */

import type { RoomVisualizerSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'
import { RoomVisualizerLauncher } from '../RoomVisualizerLauncher'

export function RoomVisualizerPromo({ ctx, section }: { ctx: RenderCtx; section: RoomVisualizerSection }) {
  const product = (ctx.products ?? [])[0]
  const title = section.settings.title?.trim() || 'Veja no seu ambiente'
  const description = section.settings.description?.trim()
    || 'Tire uma foto do seu espaço e veja, com IA, como os nossos produtos ficam aí — fiel ao seu ambiente.'

  return (
    <div className="container mx-auto px-4" style={{ textAlign: 'center' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.875rem', lineHeight: 1.2 }}>
          {title}
        </h2>
        <p style={{ color: 'var(--c-text-muted)', marginTop: 10, lineHeight: 1.6 }}>{description}</p>
        {product ? (
          <div style={{ maxWidth: 360, margin: '18px auto 0' }}>
            <RoomVisualizerLauncher slug={ctx.slug} productId={product.id} productName={product.name} />
          </div>
        ) : (
          <a href={`/loja/${ctx.slug}`}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 18, padding: '14px 28px', minHeight: 48,
              background: 'var(--c-primary)', color: 'var(--c-on-accent)',
              borderRadius: 'var(--r)', textDecoration: 'none', fontWeight: 600,
            }}>
            Escolher um produto
          </a>
        )}
      </div>
    </div>
  )
}
