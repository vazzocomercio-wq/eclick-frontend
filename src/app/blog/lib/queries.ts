/**
 * Queries GROQ + helpers tipados do blog.
 *
 * Regra de visibilidade pública: status == "published" && publishedAt <= now().
 * Rascunhos/revisão/aprovados NÃO aparecem no site.
 */
import { sanityFetch } from './sanity'
import type { Post, PostCardData, Category, Author, Tag } from './types'

// ── Fragmentos reutilizáveis ────────────────────────────────────────────────

const IMG = /* groq */ `{
  "url": asset->url,
  "lqip": asset->metadata.lqip,
  "width": asset->metadata.dimensions.width,
  "height": asset->metadata.dimensions.height,
  alt,
  caption
}`

const CARD = /* groq */ `{
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  readingTimeMinutes,
  "coverImage": coverImage${IMG},
  "category": category->{ title, "slug": slug.current, color, icon },
  "author": author->{ name, "slug": slug.current, "avatar": avatar${IMG} }
}`

const PUBLISHED = `_type == "post" && status == "published" && publishedAt <= now()`

// ── Queries ──────────────────────────────────────────────────────────────────

const allCardsQuery = /* groq */ `*[${PUBLISHED}] | order(publishedAt desc) ${CARD}`

const recentCardsQuery = /* groq */ `*[${PUBLISHED}] | order(publishedAt desc) [$start...$end] ${CARD}`

const postBySlugQuery = /* groq */ `*[${PUBLISHED} && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  excerpt,
  tldr,
  body[]{
    ...,
    _type == "image" => { ..., "url": asset->url, "lqip": asset->metadata.lqip, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height }
  },
  faq,
  seoTitle,
  metaDescription,
  focusKeyword,
  aiPrompts,
  citationSources,
  publishedAt,
  updatedAt,
  readingTimeMinutes,
  "coverImage": coverImage${IMG},
  "category": category->{ _id, title, "slug": slug.current, description, color, icon, pillarNumber },
  "author": author->{ _id, name, "slug": slug.current, role, bio, "avatar": avatar${IMG}, credentials, expertise, socialLinks },
  "tags": tags[]->{ _id, title, "slug": slug.current },
  "series": series->{ _id, title, "slug": slug.current },
  "relatedPosts": relatedPosts[]->${CARD}
}`

const postsByCategoryQuery = /* groq */ `*[${PUBLISHED} && category->slug.current == $slug] | order(publishedAt desc) ${CARD}`
const postsByAuthorQuery = /* groq */ `*[${PUBLISHED} && author->slug.current == $slug] | order(publishedAt desc) ${CARD}`
const postsByTagQuery = /* groq */ `*[${PUBLISHED} && $slug in tags[]->slug.current] | order(publishedAt desc) ${CARD}`

const relatedByCategoryQuery = /* groq */ `*[${PUBLISHED} && category->slug.current == $slug && slug.current != $exclude] | order(publishedAt desc) [0...3] ${CARD}`

const allCategoriesQuery = /* groq */ `*[_type == "category"] | order(pillarNumber asc){ _id, title, "slug": slug.current, description, pillarNumber, icon, color }`
const categoryBySlugQuery = /* groq */ `*[_type == "category" && slug.current == $slug][0]{ _id, title, "slug": slug.current, description, pillarNumber, icon, color }`
const authorBySlugQuery = /* groq */ `*[_type == "author" && slug.current == $slug][0]{ _id, name, "slug": slug.current, role, bio, "avatar": avatar${IMG}, credentials, expertise, socialLinks }`
const tagBySlugQuery = /* groq */ `*[_type == "tag" && slug.current == $slug][0]{ _id, title, "slug": slug.current, description }`

const siteSettingsQuery = /* groq */ `*[_type == "siteSettings"][0]{ blogDisplayFont }`

const allPublishedSlugsQuery = /* groq */ `*[${PUBLISHED}]{ "slug": slug.current, "updatedAt": coalesce(updatedAt, publishedAt) }`
const allCategorySlugsQuery = /* groq */ `*[_type == "category"]{ "slug": slug.current }`
const allAuthorSlugsQuery = /* groq */ `*[_type == "author"]{ "slug": slug.current }`
const allTagSlugsQuery = /* groq */ `*[_type == "tag" && count(*[${PUBLISHED} && ^._id in tags[]._ref]) > 0]{ "slug": slug.current }`

// ── Helpers tipados ────────────────────────────────────────────────────────

export const getAllPostCards = () => sanityFetch<PostCardData[]>(allCardsQuery)
export const getRecentPostCards = (start = 0, end = 12) =>
  sanityFetch<PostCardData[]>(recentCardsQuery, { start, end })
export const getPostBySlug = (slug: string) =>
  sanityFetch<Post | null>(postBySlugQuery, { slug }, { tags: [`post:${slug}`] })
export const getPostsByCategory = (slug: string) =>
  sanityFetch<PostCardData[]>(postsByCategoryQuery, { slug })
export const getPostsByAuthor = (slug: string) =>
  sanityFetch<PostCardData[]>(postsByAuthorQuery, { slug })
export const getPostsByTag = (slug: string) =>
  sanityFetch<PostCardData[]>(postsByTagQuery, { slug })
export const getRelatedByCategory = (slug: string, exclude: string) =>
  sanityFetch<PostCardData[]>(relatedByCategoryQuery, { slug, exclude })

export const getAllCategories = () => sanityFetch<Category[]>(allCategoriesQuery)
export const getCategoryBySlug = (slug: string) =>
  sanityFetch<Category | null>(categoryBySlugQuery, { slug })
export const getAuthorBySlug = (slug: string) =>
  sanityFetch<Author | null>(authorBySlugQuery, { slug })
export const getTagBySlug = (slug: string) =>
  sanityFetch<Tag | null>(tagBySlugQuery, { slug })

/** Config global do blog (fonte de display padrão etc). Revalida rápido + tag. */
export const getSiteSettings = () =>
  sanityFetch<{ blogDisplayFont?: string } | null>(siteSettingsQuery, {}, { revalidate: 60, tags: ['siteSettings'] })

export const getAllPublishedSlugs = () =>
  sanityFetch<Array<{ slug: string; updatedAt: string }>>(allPublishedSlugsQuery)
export const getAllCategorySlugs = () =>
  sanityFetch<Array<{ slug: string }>>(allCategorySlugsQuery)
export const getAllAuthorSlugs = () =>
  sanityFetch<Array<{ slug: string }>>(allAuthorSlugsQuery)
export const getAllTagSlugs = () =>
  sanityFetch<Array<{ slug: string }>>(allTagSlugsQuery)
