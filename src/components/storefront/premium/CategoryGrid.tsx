/**
 * Grade de categorias/colecoes — cards com thumbnail, rotulo e contagem.
 */

import type { Section } from '@/lib/storefront/types'
import { effects, watermarkColor } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'
import { Watermark } from './Watermark'
import { StoreImage } from './StoreImage'

type Category = Extract<Section, { type: 'categoryGrid' }>['categories'][number]

function Card({ category, ctx }: { category: Category; ctx: RenderCtx }) {
  const { colors } = ctx.theme
  const inner = (
    <div
      className="group relative overflow-hidden"
      style={{ aspectRatio: '4 / 5', borderRadius: ctx.radius, border: `1px solid ${colors.border}` }}
    >
      <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
        <StoreImage src={category.imageUrl} alt={category.label} ctx={ctx} />
      </div>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 55%)' }}
      />
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
        <p className="text-sm sm:text-base font-bold text-white" style={{ fontFamily: ctx.fontH }}>
          {category.label}
        </p>
        {typeof category.count === 'number' && (
          <p className="text-[11px] text-white/75">{category.count} produtos</p>
        )}
      </div>
    </div>
  )

  return category.href
    ? <a href={category.href} className="block">{inner}</a>
    : inner
}

export function CategoryGrid({ section, ctx }: {
  section: Extract<Section, { type: 'categoryGrid' }>
  ctx: RenderCtx
}) {
  const { colors } = ctx.theme
  const showWm = effects(ctx.theme).watermarks && !!section.watermark

  return (
    <section className="relative overflow-hidden" style={{ paddingTop: ctx.padY, paddingBottom: ctx.padY }}>
      {showWm && <Watermark text={section.watermark!} color={watermarkColor(ctx.theme)} />}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8">
        <h2
          className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8"
          style={{ color: colors.text, fontFamily: ctx.fontH }}
        >
          {section.title}
        </h2>
        {section.categories.length === 0 ? (
          <div
            className="py-14 text-center text-sm"
            style={{ color: colors.textMuted, border: `1px dashed ${colors.border}`, borderRadius: ctx.radius }}
          >
            Nenhuma categoria cadastrada.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" style={{ gap: ctx.gap }}>
            {section.categories.map((c, i) => (
              <Card key={i} category={c} ctx={ctx} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
