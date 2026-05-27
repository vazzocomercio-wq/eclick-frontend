import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getStore } from '@/lib/storefront/v3/data'
import { getStoreBlogPosts } from '@/lib/storefront/blog'
import { resolveBlogTheme } from './_components/theme'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store) return { title: 'Blog' }
  return {
    title: `Blog · ${store.store_name}`,
    description: `Guias, dicas e novidades de ${store.store_name}.`,
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default async function StoreBlogIndex({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()

  const [posts, theme] = [await getStoreBlogPosts(slug), resolveBlogTheme(store)]
  const { colors, background, headingFamily, bodyFamily, fontHref } = theme

  const containerStyle: CSSProperties = {
    background,
    color: colors.text,
    minHeight: '100vh',
    fontFamily: bodyFamily,
    ['--bl-heading' as string]: headingFamily,
    ['--bl-body' as string]: bodyFamily,
  }

  return (
    <main style={containerStyle}>
      {fontHref && <link rel="stylesheet" href={fontHref} />}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 64px' }}>
        <nav style={{ fontSize: 13, color: colors.textMuted, marginBottom: 18 }}>
          <Link href={`/loja/${slug}`} style={{ color: colors.textMuted, textDecoration: 'none' }}>{store.store_name}</Link>
          {' › '}<span>Blog</span>
        </nav>
        <h1 style={{ fontFamily: 'var(--bl-heading)', fontWeight: 700, fontSize: 'clamp(2rem,5vw,3rem)', letterSpacing: '-0.02em', margin: '0 0 28px' }}>
          Blog da {store.store_name}
        </h1>

        {posts.length === 0 ? (
          <p style={{ color: colors.textMuted }}>Em breve, conteúdo novo por aqui.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 22 }}>
            {posts.map((p) => (
              <Link key={p.id} href={`/loja/${slug}/blog/${p.slug}`}
                style={{ textDecoration: 'none', color: 'inherit', border: `1px solid ${colors.border}`, borderRadius: 14, overflow: 'hidden', background: colors.surface, display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', aspectRatio: '16/9', background: colors.surface }}>
                  {p.cover_image_url ? <Image src={p.cover_image_url} alt="" fill sizes="(max-width:700px) 100vw, 360px" style={{ objectFit: 'cover' }} unoptimized /> : null}
                </div>
                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h2 style={{ fontFamily: 'var(--bl-heading)', fontWeight: 600, fontSize: 18, lineHeight: 1.3, margin: 0 }}>{p.title}</h2>
                  {p.excerpt ? <p style={{ fontSize: 14, color: colors.textMuted, lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.excerpt}</p> : null}
                  <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    {fmtDate(p.published_at)}{p.reading_time_minutes ? ` · ${p.reading_time_minutes} min` : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
