'use client'

/**
 * Camada de parallax — desloca o conteudo verticalmente conforme o
 * scroll, criando profundidade. Usada nos banners do tema premium.
 * O conteudo e renderizado num container maior que a moldura pra o
 * deslocamento nao revelar as bordas. Respeita prefers-reduced-motion.
 */

import { useEffect, useRef, type ReactNode } from 'react'

export function ParallaxLayer({ children, strength = 36 }: {
  children: ReactNode
  strength?: number
}) {
  const frame = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const f = frame.current
    const box = inner.current
    if (!f || !box) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const update = () => {
      raf = 0
      const r = f.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const progress = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2)
      const clamped = Math.max(-1, Math.min(1, progress))
      box.style.transform = `translate3d(0, ${(-clamped * strength).toFixed(1)}px, 0)`
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [strength])

  return (
    <div ref={frame} className="absolute inset-0 overflow-hidden">
      <div
        ref={inner}
        className="absolute left-0 right-0"
        style={{ top: '-16%', bottom: '-16%', willChange: 'transform' }}
      >
        {children}
      </div>
    </div>
  )
}
