/**
 * CheckoutLayout v3 — envelope/placeholder do checkout.
 *
 * Server Component esqueleto. Form e gateway sao Client Component que a
 * rota `/loja/[slug]/checkout` em B.5 monta dentro deste envelope.
 *
 * Settings importantes:
 *  - steps: 'multi' | 'single' (mobile-first default = single via overrides)
 *  - requireAccount, askForCpf, askForCnpj
 */

import type { CheckoutLayoutSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'

export function CheckoutLayoutSectionView({ ctx: _ctx, section }: { ctx: RenderCtx; section: CheckoutLayoutSection }) {
  void _ctx
  const { steps, requireAccount, askForCpf, askForCnpj, trustBadges } = section.settings
  return (
    <div
      className="container mx-auto px-4"
      style={{ maxWidth: 720 }}
      data-checkout-steps={steps}
      data-checkout-require-account={requireAccount}
      data-checkout-ask-cpf={askForCpf}
      data-checkout-ask-cnpj={askForCnpj}
    >
      <h1 className="mb-6" style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '1.75rem' }}>
        Finalizar compra
      </h1>
      <div id="checkout-mount" style={{
        padding: 40, textAlign: 'center',
        background: 'var(--c-surface)', borderRadius: 'var(--r)',
        color: 'var(--c-text-muted)',
      }}>
        Carregando formulário de pagamento...
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
