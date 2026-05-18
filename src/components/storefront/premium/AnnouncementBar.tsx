/**
 * Faixa de anuncio premium — mensagem fina no topo, fundo escuro.
 * Suporta CTA opcional e countdown ate uma data.
 */

import type { Section } from '@/lib/storefront/types'
import { darkColor, bestContrast } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'
import { Countdown } from './Countdown'

export function AnnouncementBar({ section, ctx }: {
  section: Extract<Section, { type: 'announcementBar' }>
  ctx: RenderCtx
}) {
  const bg = darkColor(ctx.theme)
  const fg = bestContrast(bg)

  return (
    <div className="w-full" style={{ background: bg, color: fg }}>
      <div className="max-w-6xl mx-auto px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <p className="text-[11px] sm:text-xs tracking-wide uppercase">
          {section.message}
          {section.countdownTo && (
            <>
              {' · '}
              <Countdown to={section.countdownTo} color={fg} />
            </>
          )}
        </p>
        {section.ctaLabel && (
          <a
            href={section.ctaHref || '#'}
            className="text-[11px] sm:text-xs font-semibold underline underline-offset-2 shrink-0"
            style={{ color: fg }}
          >
            {section.ctaLabel}
          </a>
        )}
      </div>
    </div>
  )
}
