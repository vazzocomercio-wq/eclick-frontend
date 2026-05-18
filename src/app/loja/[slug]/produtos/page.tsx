/**
 * Pagina de colecao / catalogo da Loja Propria (publica, sem auth).
 *
 * Lista os produtos publicos da loja; aceita ?categoria= pra pre-filtrar.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore, getProducts } from '@/lib/storefront/data'
import { CollectionPage } from '@/components/storefront/CollectionPage'
import { DEFAULT_DESIGN } from '@/lib/storefront/templates'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ categoria?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store) return { title: 'Loja não encontrada' }
  return {
    title: `Produtos — ${store.store_name}`,
    description: store.seo_description ?? store.store_description ?? undefined,
  }
}

export default async function CollectionRoute({ params, searchParams }: Props) {
  const { slug } = await params
  const { categoria } = await searchParams
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()

  const products = await getProducts(slug, 60)
  const design = store.design ?? DEFAULT_DESIGN

  return (
    <CollectionPage
      design={design}
      store={store}
      products={products}
      slug={slug}
      initialCategory={categoria}
    />
  )
}
