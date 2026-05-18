'use client'

/**
 * Carrossel horizontal de produtos com scroll-snap e setas de navegacao.
 * As setas aparecem no desktop; no mobile vale o swipe nativo.
 */

import { useRef } from 'react'
import { PremiumProductCard } from './PremiumProductCard'
import type { StorefrontProduct } from '@/lib/storefront/data'
import type { RenderCtx } from '../renderCtx'

function Arrow({ dir, color, surface, border, onClick }: {
  dir: 'left' | 'right'
  color: string
  surface: string
  border: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'left' ? 'Anterior' : 'Próximo'}
      className={`hidden sm:flex absolute top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 ${
        dir === 'left' ? '-left-3' : '-right-3'
      }`}
      style={{ background: surface, border: `1px solid ${border}`, color }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  )
}

export function ShowcaseCarousel({ products, slug, ctx }: {
  products: StorefrontProduct[]
  slug: string
  ctx: RenderCtx
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { colors } = ctx.theme

  const nudge = (dir: number) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <style>{'.sf-noscroll::-webkit-scrollbar{display:none}'}</style>
      <div
        ref={ref}
        className="sf-noscroll flex overflow-x-auto pb-1 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', gap: ctx.gap }}
      >
        {products.map(p => (
          <PremiumProductCard key={p.id} product={p} slug={slug} ctx={ctx} carousel />
        ))}
      </div>
      <Arrow dir="left" color={colors.text} surface={colors.surface} border={colors.border}
        onClick={() => nudge(-1)} />
      <Arrow dir="right" color={colors.text} surface={colors.surface} border={colors.border}
        onClick={() => nudge(1)} />
    </div>
  )
}
