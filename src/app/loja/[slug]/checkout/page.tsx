/**
 * Pagina de checkout da Loja Propria — Frente C.
 *
 * Lojas com `payments_enabled=true` enviam o lojista pra ca em vez de
 * abrir o WhatsApp direto. Mostra resumo do carrinho + formulario de
 * cliente + escolha de gateway (MP/Stripe), e ao submeter chama
 * /storefront/checkout no backend.
 */

import { notFound } from 'next/navigation'
import { getStore } from '@/lib/storefront/data'
import { CheckoutForm } from '@/components/storefront/premium/CheckoutForm'
import { DEFAULT_DESIGN } from '@/lib/storefront/templates'

interface Props {
  params: Promise<{ slug: string }>
}

export const metadata = { title: 'Finalizar compra' }

export default async function CheckoutPage({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()
  if (!store.payments_enabled) notFound() // pagamento desabilitado nesta loja

  const design = store.design ?? DEFAULT_DESIGN
  return <CheckoutForm store={store} design={design} slug={slug} />
}
