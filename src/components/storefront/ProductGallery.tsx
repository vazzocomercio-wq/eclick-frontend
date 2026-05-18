'use client'

/**
 * Galeria de fotos do produto. Imagem principal + miniaturas clicaveis.
 * Unico ponto interativo da Loja Propria — por isso e client component.
 */

import { useState } from 'react'

export function ProductGallery({ images, name, radius, border }: {
  images: string[]
  name: string
  radius: number
  border: string
}) {
  const [active, setActive] = useState(0)
  const safe = images.filter(Boolean)
  const current = safe[active] ?? safe[0]

  return (
    <div className="w-full">
      <div
        className="aspect-square w-full overflow-hidden"
        style={{ background: '#fff', borderRadius: radius, border: `1px solid ${border}` }}
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

      {safe.length > 1 && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {safe.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Foto ${i + 1}`}
              className="h-14 w-14 sm:h-16 sm:w-16 overflow-hidden shrink-0 transition-opacity"
              style={{
                background: '#fff',
                borderRadius: Math.max(radius - 4, 0),
                border: `2px solid ${i === active ? border : 'transparent'}`,
                outline: i === active ? `1px solid ${border}` : 'none',
                opacity: i === active ? 1 : 0.6,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
