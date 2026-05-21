/**
 * Hero v3 — container responsivo com blocks internos (heading, subheading,
 * button, badge, image, slide). Server Component.
 *
 * Layouts:
 *  - `split`     → conteudo a esquerda, espaco a direita (em desktop). Em
 *                   mobile vira coluna unica.
 *  - `centered`  → conteudo centralizado.
 *  - `overlay`   → conteudo sobre o background da section (com gradient
 *                   automatico no bottom pra legibilidade).
 *
 * Heights mobile-first:
 *  - auto, sm (240px), md (380px), lg (520px), fullscreen (100svh)
 */

import type { HeroSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'
import { BlockRenderer } from '../BlockRenderer'

const HEIGHT: Record<HeroSection['settings']['height'], string> = {
  auto:       'auto',
  sm:         '240px',
  md:         '380px',
  lg:         '520px',
  fullscreen: '100svh',
}

export function HeroSectionView({ ctx, section }: { ctx: RenderCtx; section: HeroSection }) {
  const { layout, height, textAlign } = section.settings
  const minH = HEIGHT[height]

  const alignClass =
    textAlign === 'center' ? 'items-center text-center'
    : textAlign === 'right' ? 'items-end text-right'
    : 'items-start text-left'

  const layoutClass =
    layout === 'centered' ? 'justify-center'
    : layout === 'overlay' ? 'justify-end pb-8'
    : 'justify-start'

  return (
    <div
      className={`container mx-auto px-4 flex flex-col gap-4 ${alignClass} ${layoutClass}`}
      style={{ minHeight: minH, maxWidth: layout === 'split' ? 720 : undefined }}
    >
      {section.blocks.map(b => (
        <BlockRenderer key={b.id} ctx={ctx} block={b} />
      ))}
    </div>
  )
}
