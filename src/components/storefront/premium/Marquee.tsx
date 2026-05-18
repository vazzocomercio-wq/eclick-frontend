/**
 * Faixa diagonal com texto rolando em loop (ticker).
 * Animacao 100% CSS — sem JS. Os itens sao duplicados pra o loop ser
 * continuo (a animacao desloca exatamente metade da largura).
 */

import type { Section } from '@/lib/storefront/types'
import { darkColor, bestContrast } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'

export function Marquee({ section, ctx }: {
  section: Extract<Section, { type: 'marquee' }>
  ctx: RenderCtx
}) {
  const bg = darkColor(ctx.theme)
  const fg = bestContrast(bg)
  const accent = ctx.theme.colors.primary
  const loop = [...section.items, ...section.items]

  return (
    <div className="relative overflow-hidden my-10 sm:my-14">
      <style>{'@keyframes sf-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}'}</style>
      <div
        style={{
          background: bg,
          transform: 'rotate(-2.2deg)',
          width: '110%',
          marginLeft: '-5%',
        }}
      >
        <div
          className="flex items-center py-3.5"
          style={{ width: 'max-content', animation: 'sf-marquee 32s linear infinite' }}
        >
          {loop.map((item, i) => (
            <span key={i} className="flex items-center">
              <span
                className="px-7 text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] whitespace-nowrap"
                style={{ color: fg }}
              >
                {item}
              </span>
              <span aria-hidden style={{ color: accent }}>✦</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
