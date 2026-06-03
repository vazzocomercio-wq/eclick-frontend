import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAuthorBySlug, getPostsByAuthor, getAllAuthorSlugs } from '../../lib/queries'
import { PostCard } from '../../_components/PostCard'
import { AuthorBioBox } from '../../_components/AuthorBioBox'
import { C, SITE_URL } from '../../_components/tokens'

export const revalidate = 3600
export const dynamicParams = true
export const dynamic = 'force-static' // estático no CDN (ver app/blog/page.tsx)

export async function generateStaticParams() {
  try {
    return (await getAllAuthorSlugs()).map((a) => ({ slug: a.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  let title = 'Autor'
  let description = 'Posts do autor no blog da e-Click.'
  try {
    const author = await getAuthorBySlug(slug)
    if (author) {
      title = author.name
      description = author.bio || `Posts de ${author.name} sobre GEO e inteligência comercial.`
    }
  } catch {
    /* fallback */
  }
  return { title, description, alternates: { canonical: `${SITE_URL}/blog/autor/${slug}` } }
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [author, posts] = await Promise.all([
    getAuthorBySlug(slug).catch(() => null),
    getPostsByAuthor(slug).catch(() => []),
  ])
  if (!author) notFound()

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 20px 40px' }}>
      <AuthorBioBox author={author} />
      <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 600, letterSpacing: '-0.02em', margin: '8px 0 20px' }}>
        Posts de {author.name}
      </h2>
      {posts.length === 0 ? (
        <p style={{ color: C.MUT }}>Nenhum post publicado ainda.</p>
      ) : (
        <div className="bl-grid-3">
          {posts.map((p) => <PostCard key={p._id} post={p} />)}
        </div>
      )}
    </main>
  )
}
