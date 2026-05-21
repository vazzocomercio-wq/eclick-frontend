/**
 * Página pública de Fidelidade — vitrine da loja.
 *
 * Mostra explicação do programa + cards de cada tier + form pra
 * consultar saldo. Usa as cores/fontes do tema da loja.
 *
 * Server Component (header/footer SSR); o form de consulta é Client.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getStore, resolveDesign } from '@/lib/storefront/v3/data'
import { LoyaltyPageClient } from './LoyaltyPageClient'
import { themeCssVars, googleFontsHref } from '@/components/storefront-v3/helpers'

interface Props {
  params: Promise<{ slug: string }>
}

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface LoyaltyTierPublic {
  id:              string
  name:            string
  description:     string | null
  color:           string
  icon_emoji:      string | null
  min_spent_cents: number
  benefits:        Array<{ label: string; icon?: string }>
}

interface LoyaltySettingsPublic {
  enabled:       boolean
  currencyLabel: string
  pointsPerReal: number
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const store = await getStore(slug)
  return { title: store ? `Fidelidade — ${store.store_name}` : 'Programa de fidelidade' }
}

export default async function FidelidadePage({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()

  // Fetch tiers via endpoint público (Server Component sem auth)
  let tiers: LoyaltyTierPublic[] = []
  let enabled = false
  let settings: LoyaltySettingsPublic | null = null
  try {
    const res = await fetch(`${BACKEND}/public/loyalty/by-slug/${encodeURIComponent(slug)}/tiers`, {
      next: { revalidate: 300 },  // 5 min cache
    })
    if (res.ok) {
      const data = await res.json() as { enabled: boolean; tiers?: LoyaltyTierPublic[]; settings?: LoyaltySettingsPublic }
      enabled = data.enabled
      tiers   = data.tiers ?? []
      settings = data.settings ?? null
    }
  } catch { /* silent */ }

  if (!enabled) notFound()

  const resolved = resolveDesign(store)
  const theme = resolved.version === 3 ? resolved.design.theme : null

  // Tiers ordenados por min_spent (menor → maior)
  const sortedTiers = [...tiers].sort((a, b) => a.min_spent_cents - b.min_spent_cents)

  return (
    <div style={{
      ...(theme ? themeCssVars(theme) : {}),
      background: 'var(--c-bg, #0a0a0e)',
      color:      'var(--c-text, #fafafa)',
      fontFamily: 'var(--f-body, system-ui)',
      minHeight:  '100vh',
    }}>
      {theme && <link rel="stylesheet" href={googleFontsHref(theme)} />}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link href={`/loja/${slug}`} className="text-xs hover:underline" style={{ color: 'var(--c-text-muted)' }}>
          ← Voltar pra loja
        </Link>

        <div className="text-center mt-6 mb-10">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)' }}>
            Programa de Fidelidade
          </h1>
          <p className="text-sm sm:text-base max-w-2xl mx-auto" style={{ color: 'var(--c-text-muted)' }}>
            Compre mais, ganhe mais. Cada pedido te aproxima do próximo nível
            e desbloqueia novos benefícios.
          </p>
        </div>

        {/* Cards de tier — ordem crescente */}
        {sortedTiers.length > 0 && (
          <div className="space-y-3 mb-12">
            {sortedTiers.map((tier, i) => (
              <div key={tier.id}
                className="rounded-xl p-5 sm:p-6"
                style={{
                  background: 'var(--c-surface)',
                  border: `1px solid ${tier.color}40`,
                  boxShadow: i === sortedTiers.length - 1 ? `0 0 32px ${tier.color}20` : 'none',
                }}>
                <div className="flex items-start gap-4 mb-3">
                  <div style={{ fontSize: 42, flexShrink: 0 }}>{tier.icon_emoji ?? '⭐'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-bold" style={{ color: tier.color }}>
                        {tier.name}
                      </h2>
                      <span className="text-xs sm:text-sm" style={{ color: 'var(--c-text-muted)' }}>
                        {tier.min_spent_cents === 0
                          ? 'Nível inicial'
                          : `A partir de ${brl(tier.min_spent_cents)} em compras`}
                      </span>
                    </div>
                    {tier.description && (
                      <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--c-text-muted)' }}>
                        {tier.description}
                      </p>
                    )}
                  </div>
                </div>

                {tier.benefits.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2 pl-1">
                    {tier.benefits.map((b, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm" style={{ color: 'var(--c-text)' }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{b.icon ?? '✓'}</span>
                        <span>{b.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Form de consulta de saldo */}
        <LoyaltyPageClient slug={slug} tiers={sortedTiers} />

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t" style={{ borderColor: 'var(--c-border)' }}>
          <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
            {settings?.currencyLabel && `Acumule ${settings.currencyLabel} a cada compra · `}
            Suba de nível automaticamente conforme você compra
          </p>
          <Link href={`/loja/${slug}`}
            className="inline-block mt-4 px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{
              background: 'var(--c-primary)', color: 'var(--c-on-accent, #000)',
              borderRadius: 'var(--r)', minHeight: 44,
            }}>
            Ver produtos da loja →
          </Link>
        </div>
      </main>
    </div>
  )
}
