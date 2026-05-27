/**
 * Dados públicos do Blog da Loja (vitrine /loja/[slug]/blog).
 * Lê do eclick-backend (módulo store-blog, endpoints @Public).
 */
const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

export interface StoreBlogCard {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  reading_time_minutes: number | null
  tags: string[]
  published_at: string | null
}

export interface StoreBlogBodyNode {
  _type: string
  _key: string
  [k: string]: unknown
}

export interface StoreBlogProduct {
  id: string
  name: string
  category: string | null
  brand: string | null
  price: number
  photo_url: string | null
  short_description: string | null
}

export interface StoreBlogPostFull extends StoreBlogCard {
  tldr: string[]
  body: StoreBlogBodyNode[]
  faq: Array<{ question: string; answer: string }>
  ai_prompts: string[]
  citation_sources: Array<{ title: string; url?: string; authorOrOrg?: string; year?: number }>
  seo_title: string | null
  meta_description: string | null
  focus_keyword: string | null
  featured_product_ids: string[]
  updated_at: string
}

export async function getStoreBlogPosts(slug: string): Promise<StoreBlogCard[]> {
  try {
    const res = await fetch(`${BACKEND}/public/store-blog/${encodeURIComponent(slug)}/posts`, {
      next: { revalidate: 60, tags: [`store-blog:${slug}`] },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { posts?: StoreBlogCard[] }
    return data.posts ?? []
  } catch {
    return []
  }
}

export async function getStoreBlogPost(
  slug: string,
  postSlug: string,
): Promise<{ post: StoreBlogPostFull; products: StoreBlogProduct[] } | null> {
  try {
    const res = await fetch(
      `${BACKEND}/public/store-blog/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postSlug)}`,
      { next: { revalidate: 60, tags: [`store-blog:${slug}:${postSlug}`] } },
    )
    if (!res.ok) return null
    return (await res.json()) as { post: StoreBlogPostFull; products: StoreBlogProduct[] }
  } catch {
    return null
  }
}

/** Monta o href do Google Fonts CSS2 a partir dos params do fontPair. */
export function googleFontsHref(googleParams: string[]): string | null {
  if (!googleParams?.length) return null
  return `https://fonts.googleapis.com/css2?${googleParams.map((p) => `family=${p}`).join('&')}&display=swap`
}
