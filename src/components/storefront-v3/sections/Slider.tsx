/**
 * Slider v3 — carrossel de slides com autoplay, dots e setas opcionais.
 *
 * Client Component (precisa de estado pra slide ativo + timer).
 * Mobile-first: setas escondidas em mobile (gesto de swipe via scroll-snap
 * + dots clicaveis). Em desktop aparecem setas se configurado.
 *
 * Effect:
 *  - fade      → cross-fade entre slides (transition opacity)
 *  - slide     → translate horizontal
 *  - coverflow → translate + scale (3D-like)
 */

'use client'

import { useEffect, useState } from 'react'
import type { SliderSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'
import { Slide as SlideBlockView } from '../blocks'

const HEIGHT: Record<SliderSection['settings']['height'], string> = {
  auto:       '360px',
  sm:         '280px',
  md:         '420px',
  lg:         '560px',
  fullscreen: '100svh',
}

export function SliderSectionView({ ctx, section }: { ctx: RenderCtx; section: SliderSection }) {
  const slides = section.blocks.filter(b => b.type === 'slide')
  const { autoplay, interval, showDots, showArrows, effect, height } = section.settings
  const [active, setActive] = useState(0)
  const total = slides.length

  useEffect(() => {
    if (!autoplay || total <= 1) return
    const ms = Math.max(3, interval) * 1000
    const t = setInterval(() => setActive(a => (a + 1) % total), ms)
    return () => clearInterval(t)
  }, [autoplay, interval, total])

  if (total === 0) return null

  return (
    <div className="relative" style={{ minHeight: HEIGHT[height], overflow: 'hidden' }}>
      {/* Slides */}
      {effect === 'fade'
        ? slides.map((s, i) => (
            <div key={s.id}
              style={{
                position: 'absolute', inset: 0,
                opacity: i === active ? 1 : 0,
                transition: 'opacity 600ms ease',
                pointerEvents: i === active ? 'auto' : 'none',
              }}>
              <SlideBlockView ctx={ctx} block={s as Parameters<typeof SlideBlockView>[0]['block']} />
            </div>
          ))
        : (
          <div style={{
            display: 'flex',
            transform: `translateX(-${active * 100}%)`,
            transition: 'transform 500ms ease',
            height: '100%',
          }}>
            {slides.map(s => (
              <div key={s.id} style={{ flex: '0 0 100%' }}>
                <SlideBlockView ctx={ctx} block={s as Parameters<typeof SlideBlockView>[0]['block']} />
              </div>
            ))}
          </div>
        )}

      {/* Arrows — só desktop */}
      {showArrows && total > 1 && (
        <>
          <button
            aria-label="Anterior"
            onClick={() => setActive(a => (a - 1 + total) % total)}
            className="hidden md:flex"
            style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              width: 44, height: 44,
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.85)', color: '#111',
              border: 0, borderRadius: '50%', cursor: 'pointer',
            }}>‹</button>
          <button
            aria-label="Próximo"
            onClick={() => setActive(a => (a + 1) % total)}
            className="hidden md:flex"
            style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              width: 44, height: 44,
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.85)', color: '#111',
              border: 0, borderRadius: '50%', cursor: 'pointer',
            }}>›</button>
        </>
      )}

      {/* Dots */}
      {showDots && total > 1 && (
        <div style={{
          position: 'absolute', bottom: 16, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 8,
        }}>
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setActive(i)}
              style={{
                width: i === active ? 24 : 8, height: 8,
                background: i === active ? '#fff' : 'rgba(255,255,255,0.5)',
                border: 0, borderRadius: 4,
                cursor: 'pointer', transition: 'all 200ms',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
