/**
 * Bloco editorial — texto de um lado, imagem do outro.
 * No mobile empilha (imagem em cima). `imageSide` controla o desktop.
 */

import type { Section } from '@/lib/storefront/types'
import { onAccentColor } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'
import { StoreImage } from './StoreImage'

export function EditorialSplit({ section, ctx }: {
  section: Extract<Section, { type: 'editorialSplit' }>
  ctx: RenderCtx
}) {
  const { colors } = ctx.theme
  const imageLeft = section.imageSide === 'left'

  return (
    <section className="px-4 sm:px-8" style={{ paddingTop: ctx.padY, paddingBottom: ctx.padY }}>
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
        <div
          className={imageLeft ? 'lg:order-1' : 'lg:order-2'}
          style={{ aspectRatio: '4 / 3', borderRadius: ctx.radius, overflow: 'hidden', border: `1px solid ${colors.border}` }}
        >
          <StoreImage src={section.imageUrl} alt={section.title} ctx={ctx} />
        </div>
        <div className={imageLeft ? 'lg:order-2' : 'lg:order-1'}>
          <h2
            className="text-2xl sm:text-4xl font-bold leading-tight"
            style={{ color: colors.text, fontFamily: ctx.fontH }}
          >
            {section.title}
          </h2>
          <p className="mt-4 text-sm sm:text-base leading-relaxed" style={{ color: colors.textMuted }}>
            {section.body}
          </p>
          {section.ctaLabel && (
            <a
              href={section.ctaHref || '#'}
              className="inline-block mt-6 px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.03]"
              style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius }}
            >
              {section.ctaLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
