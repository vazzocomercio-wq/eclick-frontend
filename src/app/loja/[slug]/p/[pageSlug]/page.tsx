/**
 * Pagina customizada da Loja Propria.
 *
 * Le `store.pages[pageSlug]` (Record<string, {title, content}>) — quando
 * a chave nao existe, devolve 404. Sem markdown nesta fase: renderiza
 * `content` como texto preformatado (whitespace-pre-line + max-width).
 *
 * Link tipico: lojista cria `pages.sobre = {title:'Sobre nós', content:'...'}`
 * via Config > Páginas extras → acessivel em /loja/[slug]/p/sobre.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore } from '@/lib/storefront/data'
import { DEFAULT_DESIGN } from '@/lib/storefront/templates'
import { CustomPage } from '@/components/storefront/premium/CustomPage'

interface Props {
  params: Promise<{ slug: string; pageSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, pageSlug } = await params
  const store = await getStore(slug)
  const page  = store?.pages?.[pageSlug]
  if (!page) return { title: 'Página não encontrada' }
  return {
    title:       `${page.title} — ${store?.store_name ?? slug}`,
    description: page.content?.slice(0, 160),
  }
}

export default async function CustomPageRoute({ params }: Props) {
  const { slug, pageSlug } = await params
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()
  const page = store.pages?.[pageSlug]
  if (!page) notFound()

  const design = store.design ?? DEFAULT_DESIGN
  return <CustomPage store={store} design={design} slug={slug} page={page} />
}
