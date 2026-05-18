/**
 * Texto-marca gigante ao fundo de uma secao premium.
 *
 * Renderiza dentro de um container `relative overflow-hidden`; o conteudo
 * da secao fica acima com `z-index` maior.
 */

export function Watermark({ text, color }: { text: string; color: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none select-none absolute left-1/2 top-1/2 font-bold uppercase whitespace-nowrap"
      style={{
        color,
        transform: 'translate(-50%, -50%)',
        fontSize: 'clamp(5rem, 22vw, 17rem)',
        lineHeight: 1,
        letterSpacing: '-0.05em',
        zIndex: 0,
      }}
    >
      {text}
    </span>
  )
}
