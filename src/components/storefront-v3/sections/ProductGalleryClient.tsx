'use client'

/**
 * Galeria interativa do produto v3.
 *
 * Recebe todas as photos do produto, mostra a ativa grande + grid de
 * thumbs (todas, sem cortar em 4). Click numa thumb troca a principal.
 * Setas pra navegar com teclado. Mobile-first: thumbs scroll horizontal,
 * imagem principal full-width.
 */

import { useState, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  photos: string[]
  alt:    string
}

export function ProductGalleryClient({ photos, alt }: Props) {
  const [active, setActive] = useState(0)
  const total = photos.length

  const next = useCallback(() => setActive(a => (a + 1) % total), [total])
  const prev = useCallback(() => setActive(a => (a - 1 + total) % total), [total])

  // Setas teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])

  if (total === 0) {
    return <div style={{ aspectRatio: '1 / 1', background: 'var(--c-surface)', borderRadius: 'var(--r)' }} />
  }

  const mainImage = photos[active]

  return (
    <div>
      {/* Imagem principal */}
      <div style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        background: 'var(--c-surface)',
        borderRadius: 'var(--r)',
        overflow: 'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mainImage} alt={alt} loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 16, boxSizing: 'border-box', display: 'block' }} />

        {/* Setas (só quando tem mais que 1) */}
        {total > 1 && (
          <>
            <button onClick={prev} aria-label="Imagem anterior"
              style={{
                position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.9)', color: '#111',
                border: 0, borderRadius: '50%', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}>
              <ChevronLeft size={20} />
            </button>
            <button onClick={next} aria-label="Próxima imagem"
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.9)', color: '#111',
                border: 0, borderRadius: '50%', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}>
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Contador */}
        {total > 1 && (
          <div style={{
            position: 'absolute', bottom: 12, right: 12,
            padding: '4px 10px',
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            borderRadius: 12, fontSize: 11, fontWeight: 600,
          }}>
            {active + 1} / {total}
          </div>
        )}
      </div>

      {/* Thumbs — scroll horizontal mobile, grid desktop */}
      {total > 1 && (
        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'thin' }}>
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Imagem ${i + 1}`}
              style={{
                flex: '0 0 70px',
                width: 70, height: 70,
                padding: 0,
                background: 'var(--c-surface)',
                border: `2px solid ${i === active ? 'var(--c-primary)' : 'transparent'}`,
                borderRadius: 'var(--r)',
                overflow: 'hidden', cursor: 'pointer',
                opacity: i === active ? 1 : 0.7,
                transition: 'opacity 150ms, border-color 150ms',
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${alt} ${i + 1}`} loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
