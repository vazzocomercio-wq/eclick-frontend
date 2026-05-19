'use client'

/**
 * Botao "Adicionar ao carrinho" — usado na pagina de produto quando
 * design.product.ctaMode === 'cart'. Mantem qty local + feedback visual
 * apos adicionar (volta ao estado padrao em 1.6s).
 */

import { useState } from 'react'
import { Plus, Minus, Check, ShoppingBag } from 'lucide-react'
import { useCart, type CartItem } from '@/lib/storefront/cart'
import type { RenderCtx } from '../renderCtx'
import { onAccentColor } from '@/lib/storefront/theme'

export function AddToCartButton({ slug, ctx, product, disabled }: {
  slug:     string
  ctx:      RenderCtx
  product:  Omit<CartItem, 'qty'>
  disabled?: boolean
}) {
  const cart = useCart(slug)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const { colors } = ctx.theme

  function onAdd() {
    if (disabled) return
    cart.add(product, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      <div className="flex items-center self-start"
        style={{ border: `1px solid ${colors.border}`, borderRadius: ctx.radius }}>
        <button type="button" aria-label="Diminuir"
          onClick={() => setQty(q => Math.max(1, q - 1))}
          disabled={disabled}
          className="px-3 py-3 hover:opacity-70 disabled:opacity-30"
          style={{ color: colors.text }}>
          <Minus size={14} />
        </button>
        <span className="px-3 min-w-[40px] text-center text-sm font-medium"
          style={{ color: colors.text }}>
          {qty}
        </span>
        <button type="button" aria-label="Aumentar"
          onClick={() => setQty(q => q + 1)}
          disabled={disabled}
          className="px-3 py-3 hover:opacity-70 disabled:opacity-30"
          style={{ color: colors.text }}>
          <Plus size={14} />
        </button>
      </div>

      <button type="button" onClick={onAdd} disabled={disabled}
        className="flex-1 inline-flex items-center justify-center gap-2 px-8 py-3.5 font-semibold text-sm transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
        style={{
          background:   added ? '#22c55e' : colors.primary,
          color:        added ? '#ffffff' : onAccentColor(ctx.theme),
          borderRadius: ctx.radius,
        }}>
        {added ? <Check size={16} /> : <ShoppingBag size={16} />}
        {added ? 'Adicionado!' : 'Adicionar ao carrinho'}
      </button>
    </div>
  )
}
