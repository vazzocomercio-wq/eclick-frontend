/**
 * CartLayout v3 — envelope/placeholder do carrinho.
 *
 * Server Component esqueleto. O carrinho real (cart.ts hook + render dos
 * itens) e Client Component — a rota `/loja/[slug]/carrinho` em B.5 vai
 * montar um <CartClient /> dentro deste envelope.
 *
 * Aqui aplicamos as decisoes da settings (showCoupon, showShipping,
 * showNotes, trustBadges) via props pro client.
 */

import type { CartLayoutSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'

export function CartLayoutSectionView({ ctx: _ctx, section }: { ctx: RenderCtx; section: CartLayoutSection }) {
  void _ctx
  const { showCoupon, showShipping, showNotes, trustBadges } = section.settings
  // Marcadores como data-attrs pra o Client Component da rota ler.
  return (
    <div
      className="container mx-auto px-4"
      data-cart-show-coupon={showCoupon}
      data-cart-show-shipping={showShipping}
      data-cart-show-notes={showNotes}
    >
      <h1 className="mb-6" style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.75rem' }}>
        Seu carrinho
      </h1>
      {/* Placeholder — Client da rota substitui */}
      <div id="cart-mount" style={{
        padding: 40, textAlign: 'center',
        background: 'var(--c-surface)', borderRadius: 'var(--r)',
        color: 'var(--c-text-muted)',
      }}>
        Carregando seu carrinho...
      </div>
      {trustBadges.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {trustBadges.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" loading="lazy" style={{ height: 32 }} />
          ))}
        </div>
      )}
    </div>
  )
}
