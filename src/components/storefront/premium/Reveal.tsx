'use client'

/**
 * Envolve uma secao e a revela (fade + slide-up) quando entra na
 * viewport. Respeita prefers-reduced-motion (mostra direto).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(26px)',
        transition: 'opacity .6s ease, transform .7s cubic-bezier(.16,.84,.44,1)',
      }}
    >
      {children}
    </div>
  )
}
