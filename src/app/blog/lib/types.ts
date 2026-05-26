/**
 * Tipos das projeções GROQ do blog. NÃO são o schema cru do Sanity — são o
 * shape que as queries em queries.ts retornam (já resolvido/projetado).
 */
import type { PortableTextBlock } from '@portabletext/types'

export interface SanityImage {
  url: string
  alt?: string
  caption?: string
  lqip?: string // base64 blur placeholder
  width?: number
  height?: number
}

export interface Author {
  _id: string
  name: string
  slug: string
  role?: string
  bio?: string
  avatar?: SanityImage
  credentials?: string[]
  expertise?: string[]
  socialLinks?: {
    linkedin?: string
    twitter?: string
    website?: string
  }
}

export interface Category {
  _id: string
  title: string
  slug: string
  description?: string
  pillarNumber?: number
  icon?: string
  color?: string
}

export interface Tag {
  _id: string
  title: string
  slug: string
  description?: string
}

export interface Series {
  _id: string
  title: string
  slug: string
  description?: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface CitationSource {
  title: string
  url?: string
  authorOrOrg?: string
  year?: number
}

/** Card resumido (listagens: home, categoria, autor, tag, relacionados). */
export interface PostCardData {
  _id: string
  title: string
  slug: string
  excerpt: string
  coverImage?: SanityImage
  category?: Pick<Category, 'title' | 'slug' | 'color' | 'icon'>
  author?: Pick<Author, 'name' | 'slug' | 'avatar'>
  publishedAt: string
  readingTimeMinutes?: number
}

/** Post completo (página individual). */
export interface Post extends PostCardData {
  tldr: string[]
  body: PortableTextBlock[]
  faq?: FaqItem[]
  seoTitle?: string
  metaDescription?: string
  focusKeyword?: string
  aiPrompts?: string[]
  citationSources?: CitationSource[]
  tags?: Tag[]
  category?: Category
  author?: Author
  updatedAt?: string
  series?: Series
  relatedPosts?: PostCardData[]
}
