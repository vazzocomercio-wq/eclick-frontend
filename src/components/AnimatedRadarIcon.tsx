interface AnimatedRadarIconProps {
  /** Lado do ícone em px (quadrado). Default 22. */
  size?: number
  /** Cor do radar. Default cyan da marca. */
  color?: string
  /** Segundos por volta da varredura. Default 2.6. */
  speed?: number
  className?: string
}

/**
 * Ícone de radar com varredura animada — o feixe circula continuamente
 * "buscando", com cunha de afterglow e um blip que pisca quando o feixe
 * passa por cima.
 *
 * SVG puro com <animateTransform>/<animate> (SMIL): a animação não depende
 * de CSS nem de JS, roda sozinha no markup.
 */
export function AnimatedRadarIcon({
  size = 22,
  color = '#00E5FF',
  speed = 2.6,
  className,
}: AnimatedRadarIconProps) {
  const dur = `${speed}s`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      role="img"
      aria-label="Radar em varredura"
    >
      <defs>
        {/* Afterglow do feixe: brilhante na borda de ataque, some na cauda. */}
        <linearGradient
          id="eclkRadarSweep"
          gradientUnits="userSpaceOnUse"
          x1="12" y1="2" x2="2.34" y2="9.41"
        >
          <stop offset="0%"   stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Anéis concêntricos + eixos — estáticos. */}
      <g stroke={color} fill="none">
        <circle cx="12" cy="12" r="10"  strokeOpacity="0.35" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="6.3" strokeOpacity="0.20" strokeWidth="1.25" />
        <line x1="12" y1="2"  x2="12" y2="22" strokeOpacity="0.12" strokeWidth="1" />
        <line x1="2"  y1="12" x2="22" y2="12" strokeOpacity="0.12" strokeWidth="1" />
      </g>

      {/* Blip — alvo detectado: acende quando o feixe cruza sua posição. */}
      <circle cx="16" cy="8" r="1.6" fill={color}>
        <animate
          attributeName="opacity"
          values="0;0;1;0.18;0"
          keyTimes="0;0.1;0.16;0.42;1"
          dur={dur}
          repeatCount="indefinite"
        />
      </circle>

      {/* Varredura: cunha de afterglow + feixe, girando juntos. */}
      <g>
        <path d="M12 12 L12 2 A10 10 0 0 0 2.34 9.41 Z" fill="url(#eclkRadarSweep)" />
        <line
          x1="12" y1="12" x2="12" y2="2"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur={dur}
          repeatCount="indefinite"
        />
      </g>

      {/* Núcleo. */}
      <circle cx="12" cy="12" r="1.7" fill={color} />
    </svg>
  )
}
