import { getRecentPostCards } from '../blog/lib/queries'
import { SITE_URL } from '../blog/_components/tokens'

export const revalidate = 3600

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(): Promise<Response> {
  let items = ''
  try {
    const posts = await getRecentPostCards(0, 20)
    items = (posts ?? [])
      .map((p) => {
        const url = `${SITE_URL}/blog/${p.slug}`
        const pub = p.publishedAt ? new Date(p.publishedAt).toUTCString() : ''
        return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      ${pub ? `<pubDate>${pub}</pubDate>` : ''}
      ${p.category ? `<category>${esc(p.category.title)}</category>` : ''}
      <description>${esc(p.excerpt || '')}</description>
    </item>`
      })
      .join('\n')
  } catch {
    items = ''
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>e-Click Blog · GEO e Inteligência Comercial em IA</title>
    <link>${SITE_URL}/blog</link>
    <description>Análises, frameworks e experimentos sobre GEO (Otimização para Mecanismos Generativos).</description>
    <language>pt-BR</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
