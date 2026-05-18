/**
 * Storefront publico — renderizado quando:
 *  - User acessa app.eclick.app.br/loja/<slug> diretamente
 *  - Host customizado (loja.cliente.com.br) e resolvido pelo middleware
 *  - storefront.eclick.app.br/<slug> reescrito pra esta rota
 *
 *  Renderiza a partir da receita de design (store.design); se a loja
 *  ainda nao tem design, usa o modelo padrao.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore, getProducts } from '@/lib/storefront/data'
import { StorefrontHome } from '@/components/storefront/StorefrontHome'
import { DEFAULT_DESIGN } from '@/lib/storefront/templates'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store) return { title: 'Loja não encontrada' }
  return {
    title: store.seo_title ?? store.store_name,
    description: store.seo_description ?? store.store_description ?? undefined,
  }
}

export default async function StorefrontPage({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()

  const products = await getProducts(slug, 24)
  const design = store.design ?? DEFAULT_DESIGN

  return <StorefrontHome design={design} store={store} products={products} slug={slug} />
}
