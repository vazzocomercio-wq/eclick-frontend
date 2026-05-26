import { ArrowRight } from 'lucide-react'
import { getRecentPostCards, getAllCategories } from './lib/queries'
import type { PostCardData, Category } from './lib/types'
import { PostCard } from './_components/PostCard'
import { CategoryNav } from './_components/CategoryNav'
import { NewsletterSignup } from './_components/NewsletterSignup'
import { C } from './_components/tokens'

export const revalidate = 3600

/** Busca tolerante a falha (Sanity ainda não provisionado / sem posts) → build verde. */
async function loadHome(): Promise<{ posts: PostCardData[]; categories: Category[] }> {
  try {
    const [posts, categories] = await Promise.all([getRecentPostCards(0, 13), getAllCategories()])
    return { posts: posts ?? [], categories: categories ?? [] }
  } catch {
    return { posts: [], categories: [] }
  }
}

export default async function BlogHome() {
  const { posts, categories } = await loadHome()
  const featured = posts[0]
  const rest = posts.slice(1)

  return (
    <main>
      {/* Hero */}
      <section style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px 40px' }}>
        <span style={{
          display: 'inline-block', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em',
          color: C.CYAN, background: 'rgba(0,229,255,0.08)', border: `1px solid ${C.CYAN}44`,
          borderRadius: 999, padding: '6px 14px', marginBottom: 22,
        }}>
          BLOG · INTELIGÊNCIA COMERCIAL EM IA
        </span>
        <h1 style={{ fontSize: 'clamp(2.2rem, 5.5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0, maxWidth: 900 }}>
          Como vender quando a <span style={{ color: C.CYAN }}>IA</span> virou a vitrine
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 1.6vw, 1.18rem)', color: C.MUT, lineHeight: 1.6, margin: '20px 0 0', maxWidth: 620 }}>
          Análises, frameworks e experimentos sobre GEO (Otimização para Mecanismos Generativos).
          Baseados em pesquisa acadêmica e em dados reais de operação.
        </p>
        <a href="#newsletter" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 24,
          background: C.CYAN, color: '#04141a', fontWeight: 800, fontSize: 15,
          padding: '12px 20px', borderRadius: 11, textDecoration: 'none',
        }}>
          Inscrever-se na newsletter <ArrowRight size={17} />
        </a>
      </section>

      {/* Navegação por pilar */}
      {categories.length > 0 && (
        <section style={{ maxWidth: 1180, margin: '0 auto', padding: '8px 20px 40px' }}>
          <CategoryNav categories={categories} />
        </section>
      )}

      {/* Conteúdo */}
      {posts.length === 0 ? (
        <section style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 20px 56px' }}>
          <div style={{
            padding: '48px 24px', textAlign: 'center', borderRadius: 16,
            background: C.CARD, border: `1px dashed ${C.BORDER_STRONG}`, color: C.MUT,
          }}>
            Os primeiros posts estão a caminho. Inscreva-se na newsletter abaixo pra ser avisado.
          </div>
        </section>
      ) : (
        <>
          {featured && (
            <section style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px 32px' }}>
              <PostCard post={featured} featured />
            </section>
          )}
          {rest.length > 0 && (
            <section style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px 48px' }}>
              <div className="bl-grid-3">
                {rest.map((p) => <PostCard key={p._id} post={p} />)}
              </div>
            </section>
          )}
        </>
      )}

      {/* Newsletter */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '8px 20px 56px' }}>
        <NewsletterSignup variant="footer" position="bottom" />
      </section>
    </main>
  )
}
