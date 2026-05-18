/**
 * Banner de imagem cheia com watermark. O efeito de inclinacao/parallax
 * no scroll entra na camada de efeitos (E4) — aqui renderiza estatico.
 */

import type { Section } from '@/lib/storefront/types'
import { effects, watermarkColor } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'
import { Watermark } from './Watermark'
import { StoreImage } from './StoreImage'
import { ParallaxLayer } from './ParallaxLayer'

export function TiltBanner({ section, ctx }: {
  section: Extract<Section, { type: 'tiltBanner' }>
  ctx: RenderCtx
}) {
  const fx = effects(ctx.theme)
  const showWm = fx.watermarks && !!section.watermark
  const img = <StoreImage src={section.imageUrl} alt={section.headline ?? ''} ctx={ctx} />

  return (
    <section className="relative overflow-hidden my-8 sm:my-12">
      <div className="relative h-[260px] sm:h-[420px]">
        {fx.parallaxTilt ? <ParallaxLayer>{img}</ParallaxLayer> : img}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.1))' }}
        />
        {showWm && <Watermark text={section.watermark!} color={watermarkColor(ctx.theme)} />}
        {section.headline && (
          <div className="absolute bottom-0 left-0 right-0 z-10 p-5 sm:p-10">
            <h2
              className="text-2xl sm:text-4xl font-bold text-white max-w-2xl"
              style={{ fontFamily: ctx.fontH }}
            >
              {section.headline}
            </h2>
          </div>
        )}
      </div>
    </section>
  )
}
