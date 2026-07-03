/**
 * CartLayout v3 — carrinho de página inteira.
 *
 * Server Component envelope; o carrinho real (cart.ts hook + render dos
 * itens) é o Client Component <CartPageClient /> — mesmo miolo (linhas,
 * stepper, CTAs) do drawer do header (CartClient.tsx).
 */

import type { CartLayoutSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'
import { CartPageClient } from '../CartClient'

export function CartLayoutSectionView({ ctx, section }: { ctx: RenderCtx; section: CartLayoutSection }) {
  const { showCoupon, showShipping, showNotes, trustBadges } = section.settings
  // Marcadores como data-attrs (cupom/frete/observações ficam pra fase de
  // pagamento integrado — o client ainda não usa).
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
      <CartPageClient store={{
        slug:            ctx.slug,
        storeName:       ctx.store.store_name,
        paymentsEnabled: !!ctx.store.payments_enabled,
        whatsappNumber:  ctx.store.whatsapp_number,
      }} />
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
