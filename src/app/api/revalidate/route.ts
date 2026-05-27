import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'

/**
 * Revalidação on-demand do blog. Chamado pelo Active ao publicar/agendar um
 * post (server-to-server), pra o post aparecer na home/sitemap na hora em vez
 * de esperar o ISR (revalidate=3600). Protegido por secret compartilhado.
 *
 * POST /api/revalidate  { secret, slug? }
 *   - revalida /blog, /sitemap.xml, /rss.xml e (se slug) /blog/<slug>.
 */
export async function POST(req: NextRequest) {
  let body: { secret?: string; slug?: string } = {}
  try {
    body = (await req.json()) as { secret?: string; slug?: string }
  } catch {
    /* body vazio */
  }
  const secret = body.secret || req.nextUrl.searchParams.get('secret') || req.headers.get('x-revalidate-secret')
  const expected = process.env.BLOG_REVALIDATE_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const revalidated: string[] = []
  for (const path of ['/blog', '/sitemap.xml', '/rss.xml']) {
    try { revalidatePath(path); revalidated.push(path) } catch { /* ignore */ }
  }
  if (body.slug) {
    const p = `/blog/${body.slug}`
    try { revalidatePath(p); revalidated.push(p) } catch { /* ignore */ }
  }

  return NextResponse.json({ ok: true, revalidated })
}
