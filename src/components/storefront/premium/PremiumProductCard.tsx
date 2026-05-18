/**
 * Card de produto do tema premium — retrato editorial.
 * Serve tanto a grade quanto o carrossel (prop `carousel`).
 */

import Link from 'next/link'
import { formatBRL } from '@/lib/storefront/data'
import type { StorefrontProduct } from '@/lib/storefront/data'
import { effects } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'

export function PremiumProductCard({ product, slug, ctx, carousel = false }: {
  product: StorefrontProduct
  slug: string
  ctx: RenderCtx
  carousel?: boolean
}) {
  const { colors } = ctx.theme
  const rollover = effects(ctx.theme).hoverRollover && (product.photo_urls?.length ?? 0) > 1

  return (
    <Link
      href={`/loja/${slug}/produto/${product.id}`}
      className={`group block ${carousel ? 'w-[210px] sm:w-[250px] shrink-0 snap-start' : ''}`}
    >
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: '3 / 4',
          background: '#fff',
          borderRadius: ctx.radius,
          border: `1px solid ${colors.border}`,
        }}
      >
        {product.photo_urls?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.photo_urls[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
            sem foto
          </div>
        )}
        {rollover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.photo_urls![1]}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}
      </div>
      <div className="pt-3">
        <p className="text-xs sm:text-sm leading-snug line-clamp-2" style={{ color: colors.text }}>
          {product.name}
        </p>
        <p
          className="mt-1.5 font-bold text-sm sm:text-base"
          style={{ color: colors.primary, fontFamily: ctx.fontH }}
        >
          {formatBRL(product.price)}
        </p>
      </div>
    </Link>
  )
}
