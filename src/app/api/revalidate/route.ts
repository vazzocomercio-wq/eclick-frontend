import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Revalidação on-demand. Chamado pelos backends ao publicar/agendar (server-to-
 * server), pro post aparecer na hora em vez de esperar o ISR. Secret compartilhado.
 *
 * POST /api/revalidate  { secret, slug? }                  → blog da e-Click (Sanity)
 *   - revalida /blog, /sitemap.xml, /rss.xml e (se slug) /blog/<slug>.
 * POST /api/revalidate  { secret, storeSlug, postSlug? }   → blog da LOJA (SaaS)
 *   - revalida tag store-blog:<storeSlug>[:<postSlug>] + /loja/<storeSlug>/blog[/<postSlug>].
 */
export async function POST(req: NextRequest) {
  let body: { secret?: string; slug?: string; storeSlug?: string; postSlug?: string } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    /* body vazio */
  }
  const secret = body.secret || req.nextUrl.searchParams.get('secret') || req.headers.get('x-revalidate-secret')
  const expected = process.env.BLOG_REVALIDATE_SECRET

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const revalidated: string[] = []

  // Blog da LOJA (storefront, SaaS)
  if (body.storeSlug) {
    const s = body.storeSlug
    try { revalidateTag(`store-blog:${s}`); revalidated.push(`tag:store-blog:${s}`) } catch { /* ignore */ }
    try { revalidatePath(`/loja/${s}/blog`); revalidated.push(`/loja/${s}/blog`) } catch { /* ignore */ }
    if (body.postSlug) {
      try { revalidateTag(`store-blog:${s}:${body.postSlug}`); revalidated.push(`tag:store-blog:${s}:${body.postSlug}`) } catch { /* ignore */ }
      try { revalidatePath(`/loja/${s}/blog/${body.postSlug}`); revalidated.push(`/loja/${s}/blog/${body.postSlug}`) } catch { /* ignore */ }
    }
    return NextResponse.json({ ok: true, revalidated })
  }

  // Blog da e-Click (Sanity)
  for (const path of ['/blog', '/sitemap.xml', '/rss.xml']) {
    try { revalidatePath(path); revalidated.push(path) } catch { /* ignore */ }
  }
  if (body.slug) {
    const p = `/blog/${body.slug}`
    try { revalidatePath(p); revalidated.push(p) } catch { /* ignore */ }
  }

  return NextResponse.json({ ok: true, revalidated })
}
