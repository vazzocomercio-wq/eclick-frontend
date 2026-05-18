'use client'

/**
 * Galeria de produto do tema premium. Imagem principal + miniaturas.
 * `layout='side'` poe as miniaturas na vertical (desktop); `top` deixa
 * tudo empilhado. Unico ponto interativo da pagina de produto.
 */

import { useState } from 'react'
import type { RenderCtx } from './renderCtx'

export function PremiumGallery({ images, name, ctx, layout }: {
  images: string[]
  name: string
  ctx: RenderCtx
  layout: 'side' | 'top'
}) {
  const [active, setActive] = useState(0)
  const { colors } = ctx.theme
  const safe = images.filter(Boolean)
  const current = safe[active] ?? safe[0]
  const side = layout === 'side'

  const thumbStrip = safe.length > 1 && (
    <div
      className={
        side
          ? 'flex md:flex-col gap-2 md:w-[68px] shrink-0 overflow-x-auto md:overflow-visible'
          : 'flex gap-2 overflow-x-auto'
      }
    >
      {safe.map((url, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setActive(i)}
          aria-label={`Foto ${i + 1}`}
          className="h-16 w-16 shrink-0 overflow-hidden transition-opacity"
          style={{
            background: '#fff',
            borderRadius: Math.max(ctx.radius - 4, 0),
            border: `2px solid ${i === active ? colors.primary : colors.border}`,
            opacity: i === active ? 1 : 0.6,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  )

  return (
    <div className={side ? 'flex flex-col-reverse md:flex-row gap-3' : 'flex flex-col gap-3'}>
      {thumbStrip}
      <div
        className="flex-1 aspect-square overflow-hidden"
        style={{ background: '#fff', borderRadius: ctx.radius, border: `1px solid ${colors.border}` }}
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt={name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-zinc-400">
            sem foto
          </div>
        )}
      </div>
    </div>
  )
}
