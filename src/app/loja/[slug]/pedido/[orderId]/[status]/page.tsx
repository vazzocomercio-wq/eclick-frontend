/**
 * Pagina de retorno do gateway de pagamento — Loja Propria Frente C.
 *
 * URL: /loja/[slug]/pedido/[orderId]/[status]
 * status = 'sucesso' | 'falha' | 'pendente'
 *
 * Mostra resumo do pedido + status visual + CTA (voltar pra loja, ou
 * tentar de novo, dependendo do status). O componente lê o pedido via
 * /storefront/order/:id (cache de 60s).
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getStore } from '@/lib/storefront/data'
import { DEFAULT_DESIGN } from '@/lib/storefront/templates'
import { OrderResult } from '@/components/storefront/premium/OrderResult'

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Props {
  params: Promise<{ slug: string; orderId: string; status: string }>
}

interface PublicOrder {
  id:        string
  status:    string
  total:     number
  items:     Array<{ productId: string; name: string; price: number; qty: number; imageUrl?: string }>
  customer:  { name: string; email: string }
  gateway:   string | null
  initPoint: string | null
}

const ALLOWED_STATUS = new Set(['sucesso', 'falha', 'pendente'])

export const metadata = { title: 'Pedido' }

async function fetchOrder(orderId: string): Promise<PublicOrder | null> {
  try {
    const res = await fetch(`${BACKEND}/storefront/order/${encodeURIComponent(orderId)}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    return await res.json() as PublicOrder
  } catch {
    return null
  }
}

export default async function OrderResultPage({ params }: Props) {
  const { slug, orderId, status } = await params
  if (!ALLOWED_STATUS.has(status)) notFound()

  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()

  const order = await fetchOrder(orderId)
  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <p className="text-zinc-500 text-sm">Pedido não encontrado.</p>
        <Link href={`/loja/${slug}`} className="mt-4 text-cyan-400 hover:underline text-sm">
          Voltar para a loja
        </Link>
      </div>
    )
  }

  const design = store.design ?? DEFAULT_DESIGN
  return <OrderResult store={store} design={design} slug={slug}
    order={order} returnStatus={status as 'sucesso' | 'falha' | 'pendente'} />
}
