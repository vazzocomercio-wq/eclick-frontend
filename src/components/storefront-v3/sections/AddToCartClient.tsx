'use client'

/**
 * AddToCartClient — CTA real de "Adicionar ao carrinho" da página de
 * produto v3 (substitui o botão morto do esqueleto B.3b).
 *
 *  - Stepper de quantidade (touch >=44px)
 *  - Botão que chama cart.add() (o hook já dispara add_to_cart no tracker
 *    e o badge do header atualiza via evento eclick-cart-change)
 *  - Feedback visual: botão vira "Adicionado ✓" por 2s
 *  - Barra sticky no rodapé SÓ no mobile quando settings.stickyAddToCart
 *    (preço + botão) — default true.
 *
 * Cores via CSS vars do tema v3 (white-label do lojista).
 */

import { useRef, useState } from 'react'
import { Check, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/storefront/cart'
import { formatBRL } from '@/lib/storefront/data'

export interface AddToCartProduct {
  id:        string
  name:      string
  /** Preço unitário efetivo (promo aplicada quando houver). */
  price:     number
  imageUrl?: string
}

export function AddToCartClient({ slug, product, sticky }: {
  slug:    string
  product: AddToCartProduct
  sticky:  boolean
}) {
  const cart = useCart(slug)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const add = () => {
    cart.add({ productId: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl }, qty)
    setAdded(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 2000)
  }

  const btnStyle: React.CSSProperties = {
    flex: 1, padding: '14px 24px', minHeight: 48,
    background: added ? 'var(--c-success, #22c55e)' : 'var(--c-primary)',
    color: 'var(--c-on-accent)',
    border: 0, borderRadius: 'var(--r)', cursor: 'pointer',
    fontWeight: 600, fontSize: 16,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 0.2s ease',
  }

  return (
    <>
      {/* Stepper + botão (inline, no fluxo da página) */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        <QtyStepper qty={qty} onChange={setQty} />
        <button type="button" onClick={add} style={btnStyle}>
          {added ? <><Check size={18} /> Adicionado ✓</> : <><ShoppingBag size={18} /> Adicionar ao carrinho</>}
        </button>
      </div>

      {/* Barra sticky no rodapé — SÓ mobile. O <style> empurra o floater
          do WhatsApp (fixed bottom-5 right-5) pra cima da barra no celular,
          senão ele cobriria o botão de adicionar. */}
      {sticky && (
        <style dangerouslySetInnerHTML={{ __html:
          '@media (max-width: 767px){ .fixed.bottom-5.right-5{ bottom: 92px !important; } }',
        }} />
      )}
      {sticky && (
        <div className="md:hidden"
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px',
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
            background: 'var(--c-surface)',
            borderTop: '1px solid var(--c-border)',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
          }}>
          <div style={{ minWidth: 0 }}>
            <div className="line-clamp-1" style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{product.name}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)', fontFamily: 'var(--f-heading)' }}>
              {formatBRL(product.price * qty)}
            </div>
          </div>
          <button type="button" onClick={add} style={{ ...btnStyle, fontSize: 14, padding: '12px 16px', minHeight: 48 }}>
            {added ? <><Check size={16} /> Adicionado ✓</> : <><ShoppingBag size={16} /> Adicionar</>}
          </button>
        </div>
      )}
    </>
  )
}

function QtyStepper({ qty, onChange }: { qty: number; onChange: (n: number) => void }) {
  const btn: React.CSSProperties = {
    minHeight: 48, minWidth: 44,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text)',
  }
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', flexShrink: 0,
      border: '1px solid var(--c-border)', borderRadius: 'var(--r)', background: 'var(--c-surface)',
    }}>
      <button type="button" aria-label="Diminuir quantidade"
        onClick={() => onChange(Math.max(1, qty - 1))} style={btn}>
        <Minus size={16} />
      </button>
      <span aria-live="polite" style={{ minWidth: 28, textAlign: 'center', fontSize: 15, fontWeight: 600, color: 'var(--c-text)' }}>
        {qty}
      </span>
      <button type="button" aria-label="Aumentar quantidade"
        onClick={() => onChange(qty + 1)} style={btn}>
        <Plus size={16} />
      </button>
    </div>
  )
}
