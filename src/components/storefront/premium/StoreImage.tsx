/**
 * Imagem da loja com fallback — quando `src` esta vazio (ex.: template
 * recem-aplicado, antes da IA/editor preencher), mostra um placeholder
 * em gradiente com um rotulo opcional. Preenche sempre o container pai.
 */

import { alpha } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'

export function StoreImage({ src, alt, ctx, label, objectClass = 'object-cover' }: {
  src: string
  alt: string
  ctx: RenderCtx
  label?: string
  objectClass?: string
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`w-full h-full ${objectClass}`} />
  }

  const { colors } = ctx.theme
  return (
    <div
      className="w-full h-full flex items-end p-4"
      style={{ background: `linear-gradient(155deg, ${alpha(colors.primary, 0.18)}, ${colors.surface})` }}
    >
      {label && (
        <span className="text-sm font-semibold" style={{ color: colors.text, fontFamily: ctx.fontH }}>
          {label}
        </span>
      )}
    </div>
  )
}
