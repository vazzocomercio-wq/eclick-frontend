import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore, resolveDesign } from '@/lib/storefront/v3/data'
import { themeCssVars, googleFontsHref } from '@/components/storefront-v3/helpers'
import { AuthForm } from '../AuthForm'

interface Props { params: Promise<{ slug: string }> }

export const metadata: Metadata = { title: 'Cadastro' }

export default async function CadastroPage({ params }: Props) {
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
      <AuthForm slug={slug} storeName={store.store_name} mode="signup" />
    </div>
  )
}
