/**
 * Estrelas de avaliação — 5★ com preenchimento por metade.
 *
 * Reusável tanto em listings (compacto) quanto no header de avaliações
 * (grande). Pode ser server component (puro SVG, sem state).
 *
 * Props:
 *   value: 0..5 (suporta meia estrela, ex.: 4.5)
 *   size:  px da estrela (default 14)
 *   count: opcional — número de avaliações pra exibir ao lado ("(127)")
 */

interface Props {
  value: number | null
  size?: number
  count?: number | null
  color?: string
  emptyColor?: string
  className?: string
  /** Semente única e ESTÁVEL pros IDs de gradiente SVG (ex.: productId ou
   *  reviewId). Evita IDs duplicados na mesma página + hydration mismatch.
   *  Quando omitido, usa a própria value (suficiente quando só há 1 na tela). */
  idSeed?: string
}

export function ReviewStars({ value, size = 14, count, color = '#fbbf24', emptyColor = '#3f3f46', className, idSeed }: Props) {
  const v = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0
  const seed = (idSeed ?? `v${v}`).replace(/[^a-zA-Z0-9]/g, '')
  // Render 5 estrelas, cada uma com preenchimento entre 0-100%
  const stars = Array.from({ length: 5 }, (_, i) => Math.max(0, Math.min(1, v - i)))

  return (
    <span className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, lineHeight: 1 }}>
      <span style={{ display: 'inline-flex', gap: 1 }}>
        {stars.map((fill, i) => (
          <Star key={i} id={`rs-${seed}-${i}`} fill={fill} size={size} color={color} emptyColor={emptyColor} />
        ))}
      </span>
      {typeof count === 'number' && count > 0 && (
        <span style={{ fontSize: Math.max(10, size - 2), color: emptyColor === '#3f3f46' ? '#a1a1aa' : emptyColor }}>
          ({count})
        </span>
      )}
    </span>
  )
}

function Star({ id, fill, size, color, emptyColor }: { id: string; fill: number; size: number; color: string; emptyColor: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`}  stopColor={color} />
          <stop offset={`${fill * 100}%`}  stopColor={emptyColor} />
        </linearGradient>
      </defs>
      <path
        d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1.99 5.85L10 14.95 4.71 17.65l1-5.85L1.5 7.7l5.9-.9z"
        fill={`url(#${id})`}
        stroke={fill > 0 ? color : emptyColor}
        strokeWidth={0.5}
      />
    </svg>
  )
}
