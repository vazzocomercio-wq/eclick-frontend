/**
 * Banner panoramico — imagem de fundo escurecida, titulo centralizado
 * e CTA em pill.
 */

import type { Section } from '@/lib/storefront/types'
import { onAccentColor } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'
import { StoreImage } from './StoreImage'

export function FullBanner({ section, ctx }: {
  section: Extract<Section, { type: 'fullBanner' }>
  ctx: RenderCtx
}) {
  const { colors } = ctx.theme

  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[300px] sm:h-[440px]">
        <StoreImage src={section.imageUrl} alt={section.headline} ctx={ctx} />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-5">
          <h2
            className="text-3xl sm:text-5xl font-bold text-white leading-tight max-w-3xl"
            style={{ fontFamily: ctx.fontH }}
          >
            {section.headline}
          </h2>
          {section.subheadline && (
            <p className="mt-3 text-sm sm:text-lg text-white/85 max-w-xl">
              {section.subheadline}
            </p>
          )}
          {section.ctaLabel && (
            <a
              href={section.ctaHref || '#'}
              className="inline-block mt-6 px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.03]"
              style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: 999 }}
            >
              {section.ctaLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
