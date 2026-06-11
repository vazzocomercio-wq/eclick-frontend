/**
 * resolveSectionProducts — resolve os produtos de uma seção (ProductGrid /
 * ProductCarousel) pela ORIGEM escolhida. SÍNCRONO de propósito (as seções
 * são renderizadas também no preview client-side do designer, onde async não
 * roda).
 *
 * Origens dinâmicas (Novidades / Em promoção / Mais vendidos):
 *  - SSR: a ROTA pré-busca do catálogo VINCULADO inteiro (storefront_visible +
 *    estoque) por origem e entrega em `ctx.productsBySource`. Usamos isso.
 *  - Preview do designer (sem productsBySource): diferenciamos client-side
 *    sobre o pré-carregado (`ctx.products`).
 */

import type { StorefrontProduct } from '@/lib/storefront/v3/data'
import type { RenderCtx } from './RenderCtx'

type SectionSource = { kind: string; productIds?: string[] }

export const DYNAMIC_SOURCE_KINDS = ['newest', 'promo', 'bestsellers'] as const

function clientSideDiff(all: StorefrontProduct[], kind: string): StorefrontProduct[] {
  if (kind === 'promo')  return all.filter(p => p.on_sale)
  if (kind === 'newest') return [...all].sort((a, b) =>
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
  if (kind === 'bestsellers') return [...all].sort((a, b) =>
    (Number(b.review_count ?? 0) - Number(a.review_count ?? 0)) ||
    (Number(b.ai_score ?? 0) - Number(a.ai_score ?? 0)))
  return all
}

export function resolveSectionProducts(ctx: RenderCtx, source: SectionSource, limit: number): StorefrontProduct[] {
  const all = ctx.products ?? []
  if (source.kind === 'newest' || source.kind === 'promo' || source.kind === 'bestsellers') {
    const pre = ctx.productsBySource?.[source.kind]
    if (pre) return pre.slice(0, limit)
    return clientSideDiff(all, source.kind).slice(0, limit)
  }
  if (source.kind === 'manual') {
    const ids = new Set(source.productIds ?? [])
    return all.filter(p => ids.has(p.id)).slice(0, limit)
  }
  return all.slice(0, limit)
}
