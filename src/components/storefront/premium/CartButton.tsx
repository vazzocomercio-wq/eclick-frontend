'use client'

/**
 * Botao de carrinho com badge + drawer lateral.
 *
 * Visivel no SiteHeader quando `section.showCart=true`. Usa o hook
 * useCart (localStorage por slug) e gera o link de finalizacao via
 * wa.me preenchido com o resumo do pedido.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { X, ShoppingBag, Plus, Minus, Trash2, CreditCard } from 'lucide-react'
import { useCart, cartLineKey } from '@/lib/storefront/cart'
import { formatBRL } from '@/lib/storefront/data'
import type { StorefrontStore } from '@/lib/storefront/data'
import type { RenderCtx } from '../renderCtx'
import { onAccentColor, alpha } from '@/lib/storefront/theme'

export function CartButton({ store, slug, ctx }: {
  store: StorefrontStore
  slug:  string
  ctx:   RenderCtx
}) {
  const cart = useCart(slug)
  const [open, setOpen] = useState(false)
  const { colors } = ctx.theme
  const t = useTranslations('storefront')

  const link = cart.checkoutLink(store.store_name, store.whatsapp_number)

  // Polimento: ESC fecha o drawer + trava scroll do body quando aberto
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        aria-label={t('cart.open')}
        className="relative p-1.5 transition-opacity hover:opacity-70">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colors.text}
          strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 2 3 6v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        {cart.count > 0 && (
          <span aria-hidden
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: colors.primary, color: onAccentColor(ctx.theme) }}>
            {cart.count > 99 ? '99+' : cart.count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <button type="button" aria-label={t('cart.closeGeneric')}
            onClick={() => setOpen(false)}
            className="flex-1 bg-black/55 transition-opacity" />

          {/* Drawer */}
          <aside className="w-full max-w-md flex flex-col shadow-2xl"
            style={{ background: colors.surface, color: colors.text }}>
            <header className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: colors.border }}>
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: ctx.fontH }}>
                <ShoppingBag size={18} style={{ color: colors.primary }} />
                {t('cart.title')}
                {cart.count > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: alpha(colors.primary, 0.15), color: colors.primary }}>
                    {t('cart.count', { n: cart.count })}
                  </span>
                )}
              </h2>
              <button type="button" aria-label={t('cart.close')}
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:opacity-70" style={{ color: colors.textMuted }}>
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {cart.items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-12">
                  <ShoppingBag size={36} style={{ color: colors.textMuted, opacity: 0.5 }} />
                  <p className="text-sm" style={{ color: colors.textMuted }}>
                    {t('cart.empty')}
                  </p>
                  <button type="button" onClick={() => setOpen(false)}
                    className="text-xs px-4 py-2 rounded transition-opacity hover:opacity-80"
                    style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius }}>
                    {t('nav.keepShopping')}
                  </button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cart.items.map(item => (
                    <li key={cartLineKey(item)}
                      className="flex gap-3 p-3 rounded"
                      style={{ border: `1px solid ${colors.border}`, borderRadius: ctx.radius }}>
                      <div className="w-16 h-16 rounded overflow-hidden shrink-0"
                        style={{ background: colors.background }}>
                        {item.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full" style={{ background: alpha(colors.primary, 0.08) }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2" style={{ color: colors.text }}>
                          {item.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                          {t('cart.perUnit', { price: formatBRL(item.price) })}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center"
                            style={{ border: `1px solid ${colors.border}`, borderRadius: ctx.radius }}>
                            <button type="button" aria-label={t('product.decrease')}
                              onClick={() => cart.setQty(cartLineKey(item), item.qty - 1)}
                              className="px-2 py-1 hover:opacity-70" style={{ color: colors.text }}>
                              <Minus size={12} />
                            </button>
                            <span className="px-2 text-xs font-medium min-w-[24px] text-center">{item.qty}</span>
                            <button type="button" aria-label={t('product.increase')}
                              onClick={() => cart.setQty(cartLineKey(item), item.qty + 1)}
                              className="px-2 py-1 hover:opacity-70" style={{ color: colors.text }}>
                              <Plus size={12} />
                            </button>
                          </div>
                          <p className="text-sm font-semibold" style={{ color: colors.text, fontFamily: ctx.fontH }}>
                            {formatBRL(item.qty * item.price)}
                          </p>
                        </div>
                      </div>
                      <button type="button" aria-label={t('cart.remove')}
                        onClick={() => cart.remove(cartLineKey(item))}
                        className="self-start p-1 hover:opacity-70" style={{ color: colors.textMuted }}>
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {cart.items.length > 0 && (
              <footer className="px-5 py-4 border-t space-y-3"
                style={{ borderColor: colors.border, background: colors.background }}>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: colors.textMuted }}>{t('cart.subtotal')}</span>
                  <span className="text-xl font-bold" style={{ color: colors.text, fontFamily: ctx.fontH }}>
                    {formatBRL(cart.subtotal)}
                  </span>
                </div>

                {store.payments_enabled ? (
                  <>
                    <Link href={`/loja/${slug}/checkout`}
                      onClick={() => setOpen(false)}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold text-sm transition-transform hover:scale-[1.02]"
                      style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius }}>
                      <CreditCard size={16} /> {t('cart.checkout')}
                    </Link>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm transition-opacity hover:opacity-80"
                        style={{ border: `1px solid ${colors.border}`, color: colors.text, borderRadius: ctx.radius }}>
                        {t('cart.combineWhatsapp')}
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[11px]" style={{ color: colors.textMuted }}>
                      {t('cart.paymentNote')}
                    </p>
                    {link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold text-sm transition-transform hover:scale-[1.02]"
                        style={{ background: '#25D366', color: '#fff', borderRadius: ctx.radius }}>
                        {t('cart.finishWhatsapp')}
                      </a>
                    ) : (
                      <p className="text-xs text-center" style={{ color: colors.textMuted }}>
                        {t('cart.setupWhatsapp')}
                      </p>
                    )}
                  </>
                )}

                <button type="button" onClick={() => cart.clear()}
                  className="w-full text-xs py-2 transition-opacity hover:opacity-70"
                  style={{ color: colors.textMuted }}>
                  {t('cart.clear')}
                </button>
              </footer>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
