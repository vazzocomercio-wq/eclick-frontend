/**
 * Imagem de ambiente com pontos clicaveis (hotspots). Cada ponto abre o
 * produto vinculado; o rotulo aparece num tooltip ao passar o mouse.
 */

import type { Section } from '@/lib/storefront/types'
import type { RenderCtx } from '../renderCtx'
import { StoreImage } from './StoreImage'

type Hotspot = Extract<Section, { type: 'imageHotspot' }>['hotspots'][number]

function Dot({ hotspot, slug, ctx }: { hotspot: Hotspot; slug: string; ctx: RenderCtx }) {
  const { colors } = ctx.theme

  const marker = (
    <span className="group absolute -translate-x-1/2 -translate-y-1/2 block"
      style={{ left: `${hotspot.xPct}%`, top: `${hotspot.yPct}%` }}>
      <span className="relative flex h-5 w-5">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
          style={{ background: colors.primary }}
        />
        <span
          className="relative inline-flex h-5 w-5 rounded-full border-2"
          style={{ background: '#fff', borderColor: colors.primary }}
        />
      </span>
      {hotspot.label && (
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-7 whitespace-nowrap px-2.5 py-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            background: colors.surface,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: ctx.radius,
          }}
        >
          {hotspot.label}
        </span>
      )}
    </span>
  )

  return hotspot.productId
    ? <a href={`/loja/${slug}/produto/${hotspot.productId}`} aria-label={hotspot.label ?? 'Ver produto'}>{marker}</a>
    : marker
}

export function ImageHotspot({ section, slug, ctx }: {
  section: Extract<Section, { type: 'imageHotspot' }>
  slug: string
  ctx: RenderCtx
}) {
  const { colors } = ctx.theme

  return (
    <section className="px-4 sm:px-8" style={{ paddingTop: ctx.padY, paddingBottom: ctx.padY }}>
      <div className="max-w-6xl mx-auto">
        {section.title && (
          <h2
            className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8"
            style={{ color: colors.text, fontFamily: ctx.fontH }}
          >
            {section.title}
          </h2>
        )}
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: '16 / 9', borderRadius: ctx.radius, border: `1px solid ${colors.border}` }}
        >
          <StoreImage src={section.imageUrl} alt={section.title ?? ''} ctx={ctx} />
          {section.hotspots.map((h, i) => (
            <Dot key={i} hotspot={h} slug={slug} ctx={ctx} />
          ))}
        </div>
      </div>
    </section>
  )
}
