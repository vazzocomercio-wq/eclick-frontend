/**
 * Helper pra detectar regras de bônus aplicáveis a um produto e
 * renderizar badge na vitrine. Server Component compatível.
 */

import type { RenderCtx } from './RenderCtx'

interface BonusBadge {
  label: string
  color: string
}

export function findBonusBadge(
  productId: string,
  rules?: RenderCtx['bonusRules'],
): BonusBadge | null {
  if (!rules || rules.length === 0) return null

  // BOGO no próprio produto
  const bogo = rules.find(r => r.type === 'bogo' && r.trigger_product_id === productId)
  if (bogo) {
    return {
      label: `🎁 LEVE ${bogo.trigger_qty + bogo.gift_qty} PAGUE ${bogo.trigger_qty}`,
      color: '#a78bfa',
    }
  }

  // gift_with_product onde o produto é o trigger
  const gift = rules.find(r => r.type === 'gift_with_product' && r.trigger_product_id === productId)
  if (gift) {
    return {
      label: `🎁 GANHA BRINDE`,
      color: '#fb923c',
    }
  }

  // produto é gift de uma regra free_above_value (não badge — só info no carrinho)
  return null
}

export function BonusBadge({ badge }: { badge: BonusBadge }) {
  return (
    <span style={{
      padding: '4px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
      background: badge.color, color: '#fff',
      borderRadius: 'var(--r)', textTransform: 'uppercase', lineHeight: 1,
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    }}>
      {badge.label}
    </span>
  )
}
