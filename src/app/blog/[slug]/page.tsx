import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Clock } from 'lucide-react'
import { getPostBySlug, getAllPublishedSlugs, getRelatedByCategory } from '../lib/queries'
import type { Post, PostCardData } from '../lib/types'
import { generatePostSchemas, jsonLd, SITE_URL } from '../lib/schema-org'
import { PostBody } from '../_components/PostBody'
import { Tldr } from '../_components/Tldr'
import { Faq } from '../_components/Faq'
import { TableOfContents } from '../_components/TableOfContents'
import { AuthorBioBox } from '../_components/AuthorBioBox'
import { RelatedPosts } from '../_components/RelatedPosts'
import { ShareButtons } from '../_components/ShareButtons'
import { CtaFinal } from '../_components/CtaFinal'
import { NewsletterSignup } from '../_components/NewsletterSignup'
import { extractHeadings } from '../_components/headings'
import { C, fmtDate, pillarColor } from '../_components/tokens'
import { getBlogFont, googleFontsHref } from '../_fonts/registry'
import type { CSSProperties } from 'react'

export const revalidate = 3600
export const dynamicParams = true
// Estático no CDN (ver app/blog/page.tsx): força render estático + ISR,
// neutralizando o cookies() do i18n no layout raiz. Slugs novos = ISR on-demand.
export const dynamic = 'force-static'

export async function generateStaticParams() {
  try {
    const slugs = await getAllPublishedSlugs()
    return (slugs ?? []).map((s) => ({ slug: s.slug }))
  } catch {
    return []
  }
}

async function load(slug: string): Promise<Post | null> {
  try {
    return await getPostBySlug(slug)
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await load(slug)
  if (!post) return { title: 'Post não encontrado' }
  const url = `${SITE_URL}/blog/${post.slug}`
  return {
    title: post.seoTitle || post.title,
    description: post.metaDescription || post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      type: 'article',
      siteName: 'e-Click',
      locale: 'pt_BR',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      ...(post.coverImage?.url ? { images: [{ url: post.coverImage.url }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      ...(post.coverImage?.url ? { images: [post.coverImage.url] } : {}),
    },
  }
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await load(slug)
  if (!post) notFound()

  const catColor = pillarColor(post.category?.color)
  const headings = extractHeadings(post.body)

  let related: PostCardData[] = post.relatedPosts ?? []
  if (related.length === 0 && post.category) {
    try {
      related = await getRelatedByCategory(post.category.slug, post.slug)
    } catch {
      related = []
    }
  }

  const schemas = generatePostSchemas(post)

  // Override de fonte deste post (se setado no Active) — sobrepõe o padrão do blog.
  const mainStyle: CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '8px 20px 24px' }
  let overrideFontHref: string | null = null
  if (post.displayFont) {
    const f = getBlogFont(post.displayFont)
    ;(mainStyle as Record<string, string | number>)['--font-display'] = f.family
    overrideFontHref = googleFontsHref([f.google])
  }

  return (
    <main style={mainStyle}>
      {overrideFontHref && <link rel="stylesheet" href={overrideFontHref} />}
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(s) }} />
      ))}

      {/* Cabeçalho do post */}
      <header style={{ maxWidth: 820, margin: '0 auto' }}>
        <nav style={{ fontSize: 13, color: C.DIM, marginBottom: 16 }} aria-label="Breadcrumb">
          <Link href="/blog" className="bl-link">Blog</Link>
          {post.category && (
            <>
              {' › '}
              <Link href={`/blog/categoria/${post.category.slug}`} className="bl-link">{post.category.title}</Link>
            </>
          )}
        </nav>

        {post.category && (
          <span style={{
            display: 'inline-block', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: catColor, background: `${catColor}14`,
            border: `1px solid ${catColor}44`, borderRadius: 999, padding: '5px 12px', marginBottom: 16,
          }}>
            {post.category.icon ? `${post.category.icon} ` : ''}{post.category.title}
          </span>
        )}

        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>
          {post.title}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '20px 0 24px', fontSize: 13.5, color: C.MUT }}>
          {post.author?.name && (
            <Link href={`/blog/autor/${post.author.slug}`} className="bl-link" style={{ color: C.TXT, fontWeight: 600 }}>
              {post.author.name}
            </Link>
          )}
          <span>·</span>
          <span>{fmtDate(post.publishedAt)}</span>
          {post.readingTimeMinutes ? (
            <>
              <span>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={13} /> {post.readingTimeMinutes} min de leitura
              </span>
            </>
          ) : null}
          <span style={{ marginLeft: 'auto' }}>
            <ShareButtons slug={post.slug} title={post.title} />
          </span>
        </div>

        {post.coverImage?.url && (
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', maxHeight: 480, borderRadius: 16, overflow: 'hidden', background: C.INPUT }}>
            <Image
              src={post.coverImage.url}
              alt={post.coverImage.alt || post.title}
              fill
              sizes="(max-width: 1040px) 100vw, 820px"
              style={{ objectFit: 'cover' }}
              placeholder={post.coverImage.lqip ? 'blur' : 'empty'}
              blurDataURL={post.coverImage.lqip}
              priority
            />
          </div>
        )}
      </header>

      {/* Corpo em 3 colunas (TOC | conteúdo | sidebar) */}
      <div className="bl-post-layout" style={{ marginTop: 32 }}>
        <aside>
          <TableOfContents headings={headings} />
        </aside>

        <article style={{ maxWidth: 760, minWidth: 0 }}>
          <Tldr items={post.tldr} />
          <PostBody body={post.body} />
          <Faq items={post.faq} />
          <CtaFinal />
          <AuthorBioBox author={post.author} />
        </article>

        <aside>
          <div className="bl-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <NewsletterSignup variant="sidebar" position="top" postSlug={post.slug} />
          </div>
        </aside>
      </div>

      <RelatedPosts posts={related} />

      <section style={{ maxWidth: 760, margin: '0 auto' }}>
        <NewsletterSignup variant="footer" position="bottom" postSlug={post.slug} />
      </section>
    </main>
  )
}
