/**
 * Helpers da pagina de produto da Loja Propria — compartilhados entre o
 * renderizador v1 (ProductDetail) e o premium (PremiumProductDetail).
 */

import type { StorefrontProductDetail } from './data'

export const CONDITION_LABELS: Record<string, string> = {
  new:         'Novo',
  used:        'Usado',
  refurbished: 'Recondicionado',
}

/** Normaliza os atributos do produto numa lista label/valor renderavel. */
export function attributeRows(attributes: unknown): Array<{ label: string; value: string }> {
  if (Array.isArray(attributes)) {
    return attributes
      .map(a => {
        if (a && typeof a === 'object') {
          const o = a as Record<string, unknown>
          const label = String(o.name ?? o.id ?? '').trim()
          const value = String(o.value_name ?? o.value ?? '').trim()
          if (label && value) return { label, value }
        }
        return null
      })
      .filter((x): x is { label: string; value: string } => x !== null)
  }
  if (attributes && typeof attributes === 'object') {
    return Object.entries(attributes as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => ({ label: k, value: String(v) }))
  }
  return []
}

/** Melhor descricao disponivel — IA longa > manual > IA curta. */
export function resolveDescription(product: StorefrontProductDetail): string {
  return (
    product.ai_long_description?.trim() ||
    product.description?.trim() ||
    product.ai_short_description?.trim() ||
    ''
  )
}

/** Bullets validos do produto. */
export function productBullets(product: StorefrontProductDetail): string[] {
  return (product.bullets ?? []).filter(
    (b): b is string => typeof b === 'string' && b.trim().length > 0,
  )
}

export function conditionLabel(condition: string | null): string | null {
  if (!condition) return null
  return CONDITION_LABELS[condition] ?? condition
}
