import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTagBySlug, getPostsByTag, getAllTagSlugs } from '../../lib/queries'
import { PostCard } from '../../_components/PostCard'
import { C, SITE_URL } from '../../_components/tokens'

export const revalidate = 3600
export const dynamicParams = true
export const dynamic = 'force-static' // estático no CDN (ver app/blog/page.tsx)

export async function generateStaticParams() {
  try {
    return (await getAllTagSlugs()).map((t) => ({ slug: t.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  let title = `#${slug}`
  try {
    const tag = await getTagBySlug(slug)
    if (tag) title = tag.title
  } catch {
    /* fallback */
  }
  return {
    title: `${title} — Tag`,
    description: `Posts marcados com ${title} no blog da e-Click.`,
    alternates: { canonical: `${SITE_URL}/blog/tag/${slug}` },
  }
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [tag, posts] = await Promise.all([
    getTagBySlug(slug).catch(() => null),
    getPostsByTag(slug).catch(() => []),
  ])
  if (!tag) notFound()

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 20px 40px' }}>
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.DIM }}>Tag</span>
      <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 500, letterSpacing: '-0.02em', margin: '8px 0 24px' }}>
        #{tag.title}
      </h1>
      {posts.length === 0 ? (
        <p style={{ color: C.MUT }}>Nenhum post com essa tag ainda.</p>
      ) : (
        <div className="bl-grid-3">
          {posts.map((p) => <PostCard key={p._id} post={p} />)}
        </div>
      )}
    </main>
  )
}
