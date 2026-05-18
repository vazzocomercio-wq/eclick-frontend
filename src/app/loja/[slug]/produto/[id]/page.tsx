/**
 * Pagina de produto da Loja Propria (publica, sem auth).
 *
 * Rota linkada pelos cards da vitrine. Renderiza a partir da receita
 * de design da loja; usa o modelo padrao se nao houver design definido.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getProduct, getProducts } from '@/lib/storefront/data'
import { ProductDetail } from '@/components/storefront/ProductDetail'
import { DEFAULT_DESIGN } from '@/lib/storefront/templates'

interface Props {
  params: Promise<{ slug: string; id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params
  const data = await getProduct(slug, id)
  if (!data) return { title: 'Produto não encontrado' }
  return {
    title: `${data.product.name} — ${data.store.store_name}`,
    description: data.product.ai_short_description ?? data.store.store_description ?? undefined,
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug, id } = await params
  const [data, related] = await Promise.all([
    getProduct(slug, id),
    getProducts(slug, 12),
  ])
  if (!data || data.store.status !== 'active') notFound()

  const design = data.store.design ?? DEFAULT_DESIGN

  return (
    <ProductDetail
      design={design}
      store={data.store}
      product={data.product}
      slug={slug}
      related={related}
    />
  )
}
