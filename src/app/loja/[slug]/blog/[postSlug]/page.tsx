import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStore } from '@/lib/storefront/v3/data'
import { getStoreBlogPost } from '@/lib/storefront/blog'
import { resolveBlogTheme } from '../_components/theme'
import { StoreBlogBody } from '../_components/StoreBlogBody'

interface Props {
  params: Promise<{ slug: string; postSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, postSlug } = await params
  const data = await getStoreBlogPost(slug, postSlug)
  if (!data) return { title: 'Post' }
  const { post } = data
  return {
    title: post.seo_title ?? post.title,
    description: post.meta_description ?? post.excerpt ?? undefined,
    openGraph: post.cover_image_url ? { images: [{ url: post.cover_image_url }] } : undefined,
  }
}

function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}

export default async function StoreBlogPost({ params }: Props) {
  const { slug, postSlug } = await params
  const [store, data] = [await getStore(slug), await getStoreBlogPost(slug, postSlug)]
  if (!store || store.status !== 'active' || !data) notFound()

  const { post, products } = data
  const theme = resolveBlogTheme(store)
  const { colors, background, headingFamily, bodyFamily, fontHref } = theme

  const containerStyle: CSSProperties = {
    background,
    color: colors.text,
    minHeight: '100vh',
    fontFamily: bodyFamily,
    ['--bl-heading' as string]: headingFamily,
    ['--bl-body' as string]: bodyFamily,
  }

  // JSON-LD (GEO/SEO): BlogPosting + FAQPage
  const blogPosting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.meta_description ?? post.excerpt ?? undefined,
    image: post.cover_image_url ?? undefined,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at ?? post.published_at ?? undefined,
    author: { '@type': 'Organization', name: store.store_name },
    publisher: { '@type': 'Organization', name: store.store_name },
  }
  const faqPage =
    post.faq?.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null

  return (
    <main style={containerStyle}>
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(blogPosting) }} />
      {faqPage && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqPage) }} />}

      <article style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 64px' }}>
        <nav style={{ fontSize: 13, color: colors.textMuted, marginBottom: 18 }}>
          <Link href={`/loja/${slug}`} style={{ color: colors.textMuted, textDecoration: 'none' }}>{store.store_name}</Link>
          {' › '}<Link href={`/loja/${slug}/blog`} style={{ color: colors.textMuted, textDecoration: 'none' }}>Blog</Link>
        </nav>

        <h1 style={{ fontFamily: 'var(--bl-heading)', fontWeight: 700, fontSize: 'clamp(2rem,5vw,3rem)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 14px' }}>
          {post.title}
        </h1>
        {post.reading_time_minutes ? <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>{post.reading_time_minutes} min de leitura</div> : null}

        {post.cover_image_url ? (
          <Image src={post.cover_image_url} alt={post.title} width={1200} height={675} sizes="(max-width:860px) 100vw, 820px" priority style={{ width: '100%', height: 'auto', borderRadius: 14, marginBottom: 28 }} unoptimized />
        ) : null}

        {post.tldr?.length ? (
          <div style={{ margin: '0 0 28px', padding: '16px 18px', borderRadius: 12, background: colors.surface, border: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.primary, marginBottom: 8 }}>Resumo</div>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {post.tldr.map((t, i) => <li key={i} style={{ lineHeight: 1.5 }}>{t}</li>)}
            </ul>
          </div>
        ) : null}

        <StoreBlogBody body={post.body} products={products} slug={slug} colors={colors} />

        {post.faq?.length ? (
          <section style={{ margin: '40px 0 0' }}>
            <h2 style={{ fontFamily: 'var(--bl-heading)', fontWeight: 700, fontSize: 'clamp(1.4rem,3vw,1.9rem)', margin: '0 0 18px' }}>Perguntas frequentes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {post.faq.map((f, i) => (
                <details key={i} style={{ borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface, padding: '14px 16px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{f.question}</summary>
                  <div style={{ marginTop: 8, color: colors.textMuted, lineHeight: 1.6 }}>{f.answer}</div>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <div style={{ marginTop: 40 }}>
          <Link href={`/loja/${slug}/produtos`} style={{ display: 'inline-block', background: colors.primary, color: colors.onAccent, fontWeight: 700, padding: '12px 20px', borderRadius: 10, textDecoration: 'none' }}>
            Ver todos os produtos →
          </Link>
        </div>
      </article>
    </main>
  )
}
