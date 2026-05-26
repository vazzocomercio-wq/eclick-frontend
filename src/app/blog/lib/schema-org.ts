/**
 * Geradores de JSON-LD (schema.org) — núcleo da estratégia GEO.
 * Cada post emite: BlogPosting + FAQPage (se houver FAQ) + BreadcrumbList.
 */
import type { Post } from './types'

export const SITE_URL = 'https://eclick.app.br'
const ORG_ID = `${SITE_URL}#org`

/** Organização e-Click — referenciável por @id nos outros schemas. */
export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'e-Click Inteligência Comercial',
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo-eclick.png` },
  }
}

/** WebSite schema (home do blog/site). */
export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}#website`,
    name: 'e-Click',
    url: SITE_URL,
    publisher: { '@id': ORG_ID },
  }
}

/** Schemas de um post individual. Retorna array (pula FAQPage se não houver FAQ). */
export function generatePostSchemas(post: Post): Array<Record<string, unknown>> {
  const postUrl = `${SITE_URL}/blog/${post.slug}`
  const authorUrl = post.author ? `${SITE_URL}/blog/autor/${post.author.slug}` : undefined

  const blogPosting: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${postUrl}#article`,
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    mainEntityOfPage: postUrl,
    url: postUrl,
    publisher: organizationSchema(),
    ...(post.coverImage?.url ? { image: post.coverImage.url } : {}),
    ...(post.category ? { articleSection: post.category.title } : {}),
    ...(post.tags?.length ? { keywords: post.tags.map((t) => t.title).join(', ') } : {}),
    ...(post.author
      ? {
          author: {
            '@type': 'Person',
            '@id': authorUrl,
            name: post.author.name,
            url: authorUrl,
            ...(post.author.role ? { jobTitle: post.author.role } : {}),
            ...(post.author.expertise?.length ? { knowsAbout: post.author.expertise } : {}),
            ...(post.author.socialLinks
              ? {
                  sameAs: [
                    post.author.socialLinks.linkedin,
                    post.author.socialLinks.twitter,
                    post.author.socialLinks.website,
                  ].filter(Boolean),
                }
              : {}),
          },
        }
      : {}),
    ...(post.citationSources?.length
      ? {
          citation: post.citationSources.map((s) => ({
            '@type': 'CreativeWork',
            name: s.title,
            ...(s.url ? { url: s.url } : {}),
            ...(s.authorOrOrg ? { author: s.authorOrOrg } : {}),
            ...(s.year ? { datePublished: String(s.year) } : {}),
          })),
        }
      : {}),
  }

  const schemas: Array<Record<string, unknown>> = [blogPosting]

  if (post.faq?.length) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: post.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    })
  }

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Blog', item: `${SITE_URL}/blog` },
      ...(post.category
        ? [
            {
              '@type': 'ListItem',
              position: 2,
              name: post.category.title,
              item: `${SITE_URL}/blog/categoria/${post.category.slug}`,
            },
          ]
        : []),
      { '@type': 'ListItem', position: post.category ? 3 : 2, name: post.title },
    ],
  })

  return schemas
}

/** Serializa JSON-LD escapando `<` (anti-XSS em dangerouslySetInnerHTML). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
