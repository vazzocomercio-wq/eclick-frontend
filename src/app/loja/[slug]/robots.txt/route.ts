/**
 * robots.txt dinamico por loja — /loja/[slug]/robots.txt
 * Permite tudo + aponta o sitemap.
 */

import { NextResponse } from 'next/server'
import { getStore } from '@/lib/storefront/data'

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 3600

export async function GET(_req: Request, { params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store) return new NextResponse('Not found', { status: 404 })

  const baseUrl = store.custom_domain
    ? `https://${store.custom_domain}`
    : `https://eclick.app.br/loja/${slug}`

  const txt = [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n')

  return new NextResponse(txt, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
