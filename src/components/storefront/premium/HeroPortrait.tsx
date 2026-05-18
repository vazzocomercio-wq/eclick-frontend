'use client'

/**
 * Hero premium — carrossel coverflow de cards em retrato + watermark.
 * Card central grande, vizinhos reduzidos/esmaecidos. Autoplay, setas,
 * dots e swipe. Respeita prefers-reduced-motion (sem autoplay).
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Section } from '@/lib/storefront/types'
import { effects, watermarkColor, onAccentColor, alpha } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'
import { Watermark } from './Watermark'

type HeroSec = Extract<Section, { type: 'heroPortrait' }>

const AUTOPLAY_MS = 5000

function slideStyle(offset: number, radius: number): CSSProperties {
  const abs = Math.abs(offset)
  const sign = offset < 0 ? -1 : 1
  const tx = sign * Math.min(abs, 2) * 62
  const scale = abs === 0 ? 1 : abs === 1 ? 0.82 : 0.66
  const opacity = abs === 0 ? 1 : abs === 1 ? 0.5 : 0
  return {
    transform: `translateX(calc(-50% + ${tx}%)) scale(${scale})`,
    opacity,
    zIndex: 20 - abs,
    borderRadius: radius,
    pointerEvents: abs > 1 ? 'none' : 'auto',
    transition: 'transform .55s cubic-bezier(.4,0,.2,1), opacity .55s ease',
  }
}

export function HeroPortrait({ section, ctx }: { section: HeroSec; ctx: RenderCtx }) {
  const { colors } = ctx.theme
  const slides = section.slides
  const n = slides.length
  const [active, setActive] = useState(0)
  const touchX = useRef<number | null>(null)

  const go = (i: number) => { if (n) setActive(((i % n) + n) % n) }

  useEffect(() => {
    if (n <= 1) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setActive(a => (a + 1) % n), AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [n, active])

  const showWm = effects(ctx.theme).watermarks && !!section.watermark

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: colors.background, paddingTop: ctx.padY, paddingBottom: ctx.padY }}
    >
      {showWm && <Watermark text={section.watermark!} color={watermarkColor(ctx.theme)} />}

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-8 text-center">
        <h1
          className="text-3xl sm:text-5xl lg:text-6xl font-bold leading-[1.06]"
          style={{ color: colors.text, fontFamily: ctx.fontH }}
        >
          {section.headline}
        </h1>
        {section.subheadline && (
          <p className="mt-4 text-base sm:text-lg max-w-xl mx-auto" style={{ color: colors.textMuted }}>
            {section.subheadline}
          </p>
        )}
        {section.ctaLabel && (
          <a
            href="#produtos"
            className="inline-block mt-6 px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.03]"
            style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius }}
          >
            {section.ctaLabel}
          </a>
        )}
      </div>

      {n > 0 && (
        <div className="relative z-10 mt-9 sm:mt-14">
          <div
            className="relative mx-auto h-[300px] sm:h-[420px]"
            style={{ maxWidth: 920 }}
            onTouchStart={e => { touchX.current = e.touches[0].clientX }}
            onTouchEnd={e => {
              if (touchX.current == null) return
              const dx = e.changedTouches[0].clientX - touchX.current
              if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1))
              touchX.current = null
            }}
          >
            {slides.map((s, i) => {
              const offset = i - active
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-0 w-[200px] sm:w-[270px] h-full cursor-pointer"
                  style={slideStyle(offset, ctx.radius)}
                  onClick={() => {
                    if (offset !== 0) go(i)
                    else if (s.href) window.location.href = s.href
                  }}
                >
                  <div
                    className="w-full h-full overflow-hidden"
                    style={{
                      borderRadius: ctx.radius,
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      boxShadow: '0 24px 50px -22px rgba(0,0,0,0.55)',
                    }}
                  >
                    {s.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.imageUrl} alt={s.label ?? ''} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-end p-4"
                        style={{ background: `linear-gradient(155deg, ${alpha(colors.primary, 0.2)}, ${colors.surface})` }}
                      >
                        <span
                          className="text-sm font-semibold"
                          style={{ color: colors.text, fontFamily: ctx.fontH }}
                        >
                          {s.label ?? 'Coleção'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {n > 1 && (
            <>
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  type="button" aria-label="Anterior" onClick={() => go(active - 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-full transition-transform hover:scale-105"
                  style={{ background: colors.surface, border: `1px solid ${colors.border}`, color: colors.text }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  {slides.map((_, i) => (
                    <button
                      key={i} type="button" aria-label={`Slide ${i + 1}`} onClick={() => go(i)}
                      className="rounded-full transition-all"
                      style={{
                        width: i === active ? 22 : 7,
                        height: 7,
                        background: i === active ? colors.primary : colors.border,
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button" aria-label="Próximo" onClick={() => go(active + 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-full transition-transform hover:scale-105"
                  style={{ background: colors.surface, border: `1px solid ${colors.border}`, color: colors.text }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
