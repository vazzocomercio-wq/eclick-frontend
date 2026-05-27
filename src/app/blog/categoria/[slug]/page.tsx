import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCategoryBySlug, getPostsByCategory, getAllCategories, getAllCategorySlugs } from '../../lib/queries'
import { PostCard } from '../../_components/PostCard'
import { CategoryNav } from '../../_components/CategoryNav'
import { C, pillarColor, SITE_URL } from '../../_components/tokens'

export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  try {
    return (await getAllCategorySlugs()).map((c) => ({ slug: c.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  let title = 'Categoria'
  let description = 'Posts da categoria no blog da e-Click.'
  try {
    const cat = await getCategoryBySlug(slug)
    if (cat) {
      title = cat.title
      description = cat.description || `Posts sobre ${cat.title} — GEO e inteligência comercial em IA.`
    }
  } catch {
    /* fallback */
  }
  return { title, description, alternates: { canonical: `${SITE_URL}/blog/categoria/${slug}` } }
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [cat, posts, categories] = await Promise.all([
    getCategoryBySlug(slug).catch(() => null),
    getPostsByCategory(slug).catch(() => []),
    getAllCategories().catch(() => []),
  ])
  if (!cat) notFound()
  const color = pillarColor(cat.color)

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 20px 40px' }}>
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color }}>
        {cat.icon ? `${cat.icon} ` : ''}Pilar editorial
      </span>
      <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.02em', margin: '10px 0 0' }}>
        {cat.title}
      </h1>
      {cat.description && <p style={{ fontSize: 16, color: C.MUT, lineHeight: 1.6, margin: '14px 0 0', maxWidth: 620 }}>{cat.description}</p>}

      <div style={{ margin: '28px 0 32px' }}>
        <CategoryNav categories={categories} activeSlug={slug} />
      </div>

      {posts.length === 0 ? (
        <p style={{ color: C.MUT }}>Ainda não há posts publicados nessa categoria.</p>
      ) : (
        <div className="bl-grid-3">
          {posts.map((p) => <PostCard key={p._id} post={p} />)}
        </div>
      )}
    </main>
  )
}
