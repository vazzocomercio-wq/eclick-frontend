/**
 * Preview da loja v3 — rota dedicada pro Designer (iframe + postMessage).
 *
 * Server Component que faz o fetch inicial (store + products) e delega o
 * render pra ClientPreview, que escuta postMessage do parent (Designer
 * v3) e atualiza o design em tempo real sem refresh.
 *
 * NAO usar essa rota pra trafego publico — e otimizada pra preview no
 * editor. Robots ja sao bloqueados via meta noindex abaixo.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore, getProducts, resolveDesign } from '@/lib/storefront/v3/data'
import { DEFAULT_DESIGN_V3 } from '@/lib/storefront/v3/templates'
import { ClientPreview } from './ClientPreview'

export const metadata: Metadata = {
  title:  'Preview',
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PreviewPage({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store) notFound()

  const products = await getProducts(slug, 24)
  const resolved = resolveDesign(store)
  // Preview sempre roda em modo v3 — design inicial e v3 (do banco) ou
  // DEFAULT_DESIGN_V3 se a loja so tem v2 ainda.
  const initialDesign = resolved.version === 3 ? resolved.design : DEFAULT_DESIGN_V3

  return (
    <ClientPreview store={store} products={products} initialDesign={initialDesign} slug={slug} />
  )
}
