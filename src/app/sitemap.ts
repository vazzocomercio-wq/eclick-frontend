import type { MetadataRoute } from 'next'
import { getAllPublishedSlugs, getAllCategorySlugs, getAllAuthorSlugs } from './blog/lib/queries'
import { SITE_URL } from './blog/_components/tokens'

export const revalidate = 3600

/** Sitemap do site, incluindo posts/categorias/autores do blog. Tolerante a falha. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: SITE_URL, priority: 1.0, changeFrequency: 'weekly' },
    { url: `${SITE_URL}/auditoria-gratis`, priority: 0.9, changeFrequency: 'monthly' },
    { url: `${SITE_URL}/blog`, priority: 0.9, changeFrequency: 'daily' },
  ]

  try {
    const [posts, categories, authors] = await Promise.all([
      getAllPublishedSlugs(),
      getAllCategorySlugs(),
      getAllAuthorSlugs(),
    ])
    for (const p of posts ?? []) {
      base.push({
        url: `${SITE_URL}/blog/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
        priority: 0.7,
        changeFrequency: 'weekly',
      })
    }
    for (const c of categories ?? []) {
      base.push({ url: `${SITE_URL}/blog/categoria/${c.slug}`, priority: 0.6, changeFrequency: 'weekly' })
    }
    for (const a of authors ?? []) {
      base.push({ url: `${SITE_URL}/blog/autor/${a.slug}`, priority: 0.5, changeFrequency: 'monthly' })
    }
  } catch {
    /* sem Sanity ainda → só as rotas estáticas */
  }

  return base
}
