/**
 * CheckoutLayout v3 — ponte pro checkout real.
 *
 * O formulário de pagamento de verdade vive na rota dedicada
 * `/loja/[slug]/checkout`. Esta section mostra um card com o resumo do
 * carrinho (Client) + botão "Ir para o checkout" apontando pra rota real.
 *
 * Settings de steps/requireAccount/askForCpf/askForCnpj continuam expostos
 * como data-attrs pra fase em que o form for embutido aqui.
 */

import type { CheckoutLayoutSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'
import { CheckoutSummaryClient } from '../CartClient'

export function CheckoutLayoutSectionView({ ctx, section }: { ctx: RenderCtx; section: CheckoutLayoutSection }) {
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
      <CheckoutSummaryClient slug={ctx.slug} />
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
