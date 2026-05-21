/**
 * Dashboard do cliente da Loja Própria.
 *
 * Mostra: dados pessoais, endereços, histórico de pedidos, saldo de
 * cashback, tier de fidelidade. Logout no topo.
 *
 * Layout: usa tema da loja via CSS vars. Hydration client-side pra
 * checar token + buscar dados.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore, resolveDesign } from '@/lib/storefront/v3/data'
import { themeCssVars, googleFontsHref } from '@/components/storefront-v3/helpers'
import { ContaPageClient } from './ContaPageClient'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  return { title: store ? `Minha conta — ${store.store_name}` : 'Minha conta' }
}

export default async function ContaPage({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()

  const resolved = resolveDesign(store)
  const theme = resolved.version === 3 ? resolved.design.theme : null

  return (
    <div style={{
      ...(theme ? themeCssVars(theme) : {}),
      background: 'var(--c-bg, #0a0a0e)',
      color:      'var(--c-text, #fafafa)',
      fontFamily: 'var(--f-body, system-ui)',
      minHeight:  '100vh',
    }}>
      {theme && <link rel="stylesheet" href={googleFontsHref(theme)} />}
      <ContaPageClient slug={slug} storeName={store.store_name} />
    </div>
  )
}
