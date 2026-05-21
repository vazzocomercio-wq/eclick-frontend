/**
 * Dashboard do AFILIADO logado.
 *
 * Stats: cliques (24h/7d/30d), comissões pending/approved/paid.
 * Link personalizado pra copiar + histórico de comissões.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore, resolveDesign } from '@/lib/storefront/v3/data'
import { themeCssVars, googleFontsHref } from '@/components/storefront-v3/helpers'
import { AfiliadoDashboardClient } from './AfiliadoDashboardClient'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  return { title: store ? `Área do Afiliado — ${store.store_name}` : 'Área do Afiliado' }
}

export default async function AfiliadoPage({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()

  const resolved = resolveDesign(store)
  const theme = resolved.version === 3 ? resolved.design.theme : null

  // Detecta URL base pra montar o link personalizado do afiliado
  const baseUrl = store.custom_domain
    ? `https://${store.custom_domain}`
    : `https://eclick.app.br/loja/${slug}`

  return (
    <div style={{
      ...(theme ? themeCssVars(theme) : {}),
      background: 'var(--c-bg, #0a0a0e)',
      color:      'var(--c-text, #fafafa)',
      fontFamily: 'var(--f-body, system-ui)',
      minHeight:  '100vh',
    }}>
      {theme && <link rel="stylesheet" href={googleFontsHref(theme)} />}
      <AfiliadoDashboardClient slug={slug} storeName={store.store_name} baseUrl={baseUrl} />
    </div>
  )
}
