/**
 * Sitemap dinamico por loja — /loja/[slug]/sitemap.xml
 *
 * Inclui:
 *  - Home da loja
 *  - Catalogo (produtos)
 *  - Cada produto individual
 *  - Paginas customizadas (store.pages)
 *
 * Cache 1h (revalidate). Robots do Google e Bing usam isso pra indexar.
 */

import { NextResponse } from 'next/server'
import { getStore, getProducts } from '@/lib/storefront/data'

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 3600

export async function GET(_req: Request, { params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store || store.status !== 'active') {
    return new NextResponse('Not found', { status: 404 })
  }

  const baseUrl = store.custom_domain
    ? `https://${store.custom_domain}`
    : `https://eclick.app.br/loja/${slug}`

  const products = await getProducts(slug, 200)
  const pages = store.pages ? Object.keys(store.pages) : []

  const now = new Date().toISOString()
  const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = []

  // Home
  urls.push({ loc: baseUrl, lastmod: now, changefreq: 'daily', priority: '1.0' })
  // Catalogo
  urls.push({ loc: `${baseUrl}/produtos`, lastmod: now, changefreq: 'daily', priority: '0.9' })
  // Produtos
  for (const p of products) {
    urls.push({ loc: `${baseUrl}/produto/${p.id}`, lastmod: now, changefreq: 'weekly', priority: '0.7' })
  }
  // Paginas customizadas
  for (const slugPage of pages) {
    urls.push({ loc: `${baseUrl}/p/${slugPage}`, lastmod: now, changefreq: 'monthly', priority: '0.5' })
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(u => [
      '  <url>',
      `    <loc>${escapeXml(u.loc)}</loc>`,
      `    <lastmod>${u.lastmod}</lastmod>`,
      `    <changefreq>${u.changefreq}</changefreq>`,
      `    <priority>${u.priority}</priority>`,
      '  </url>',
    ].join('\n')),
    '</urlset>',
  ].join('\n')

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, c =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;')
}
