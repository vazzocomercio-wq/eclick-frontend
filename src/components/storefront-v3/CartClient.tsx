'use client'

/**
 * CartClient v3 — componentes client do carrinho da vitrine v3.
 *
 *  - <CartButtonV3 />        botão com badge + drawer (bottom sheet no mobile,
 *                            drawer lateral no desktop) — usado no SiteHeader.
 *  - <CartPageClient />      carrinho de página inteira — usado pela section
 *                            cartLayout (mesmo miolo do drawer).
 *  - <CheckoutSummaryClient /> resumo do carrinho + CTA pro checkout real —
 *                            usado pela section checkoutLayout.
 *
 * Todos usam o hook useCart (localStorage por slug, sincroniza entre abas)
 * e as CSS vars do tema v3 (--c-*, --r, --f-*) — NADA de cor hardcoded da
 * marca: a loja é white-label do lojista. Único hex fixo é o verde oficial
 * do WhatsApp (#25D366), identidade do canal e não da marca.
 *
 * Mobile-first: touch targets >=44px, drawer vira bottom sheet no celular.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, ShoppingBag, Plus, Minus, Trash2, CreditCard } from 'lucide-react'
import { useCart, cartLineKey, type UseCartApi } from '@/lib/storefront/cart'
import { formatBRL } from '@/lib/storefront/data'
import { WhatsAppIcon } from '@/components/storefront/WhatsAppIcon'

/** Dados da loja que o carrinho precisa (subset do StorefrontStore). */
export interface CartStoreInfo {
  slug:            string
  storeName:       string
  paymentsEnabled: boolean
  whatsappNumber:  string | null
}

/** Dispara begin_checkout no tracker da vitrine (helper global exposto
 *  pelo StorefrontTracker). Fire-and-forget. */
function trackBeginCheckout(subtotal: number) {
  try {
    const w = window as unknown as { eclickTrack?: (type: string, productId?: string, value?: number) => void }
    w.eclickTrack?.('begin_checkout', undefined, subtotal)
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────
// Miolo compartilhado: lista de itens + CTAs (drawer E página usam)
// ─────────────────────────────────────────────────────────────────────────

/** Lista de linhas do carrinho com stepper de quantidade + remover. */
function CartLines({ cart }: { cart: UseCartApi }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cart.items.map(item => {
        const key = cartLineKey(item)
        return (
          <li key={key} style={{
            display: 'flex', gap: 12, padding: 12,
            border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
            background: 'var(--c-surface)',
          }}>
            <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 'var(--r)', overflow: 'hidden', background: 'var(--c-bg)' }}>
              {item.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-muted)' }}>
                  <ShoppingBag size={20} />
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="line-clamp-2" style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--c-text)' }}>{item.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--c-text-muted)' }}>{formatBRL(item.price)} cada</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--c-border)', borderRadius: 'var(--r)' }}>
                  <button type="button" aria-label="Diminuir quantidade"
                    onClick={() => cart.setQty(key, item.qty - 1)}
                    style={qtyBtnStyle()}>
                    <Minus size={14} />
                  </button>
                  <span style={{ minWidth: 28, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{item.qty}</span>
                  <button type="button" aria-label="Aumentar quantidade"
                    onClick={() => cart.setQty(key, item.qty + 1)}
                    style={qtyBtnStyle()}>
                    <Plus size={14} />
                  </button>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)', fontFamily: 'var(--f-heading)' }}>
                  {formatBRL(item.qty * item.price)}
                </span>
              </div>
            </div>
            <button type="button" aria-label="Remover item"
              onClick={() => cart.remove(key)}
              style={{
                alignSelf: 'flex-start', minHeight: 44, minWidth: 44,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)',
              }}>
              <Trash2 size={16} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function qtyBtnStyle(): React.CSSProperties {
  return {
    minHeight: 44, minWidth: 44,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text)',
  }
}

/** Subtotal + os DOIS CTAs (checkout real quando payments_enabled; WhatsApp
 *  sempre que houver whatsapp_number). `onNavigate` fecha o drawer. */
function CartCtas({ cart, store, onNavigate }: {
  cart:       UseCartApi
  store:      CartStoreInfo
  onNavigate?: () => void
}) {
  const waLink = cart.checkoutLink(store.storeName, store.whatsappNumber)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, color: 'var(--c-text-muted)' }}>Subtotal</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text)', fontFamily: 'var(--f-heading)' }}>
          {formatBRL(cart.subtotal)}
        </span>
      </div>

      {store.paymentsEnabled && (
        <Link href={`/loja/${store.slug}/checkout`}
          onClick={() => { trackBeginCheckout(cart.subtotal); onNavigate?.() }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', minHeight: 48,
            background: 'var(--c-primary)', color: 'var(--c-on-accent)',
            borderRadius: 'var(--r)', textDecoration: 'none', fontWeight: 600, fontSize: 15,
          }}>
          <CreditCard size={16} /> Finalizar compra
        </Link>
      )}

      {waLink && (
        <a href={waLink} target="_blank" rel="noopener noreferrer"
          onClick={() => { trackBeginCheckout(cart.subtotal); onNavigate?.() }}
          style={store.paymentsEnabled
            ? { // secundário quando existe checkout online
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 20px', minHeight: 48,
                background: 'transparent', color: 'var(--c-text)',
                border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
                textDecoration: 'none', fontWeight: 500, fontSize: 14,
              }
            : { // primário quando o WhatsApp é o único canal de fechamento
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 20px', minHeight: 48,
                background: '#25D366', color: '#ffffff',
                border: 'none', borderRadius: 'var(--r)',
                textDecoration: 'none', fontWeight: 600, fontSize: 15,
              }}>
          <WhatsAppIcon size={17} color={store.paymentsEnabled ? undefined : '#ffffff'} />
          Finalizar pelo WhatsApp
        </a>
      )}

      {!store.paymentsEnabled && !waLink && (
        <p style={{ margin: 0, fontSize: 12, textAlign: 'center', color: 'var(--c-text-muted)' }}>
          Esta loja ainda não configurou uma forma de finalizar a compra.
        </p>
      )}

      <button type="button" onClick={() => cart.clear()}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '10px 0', minHeight: 44, fontSize: 12, color: 'var(--c-text-muted)',
        }}>
        Esvaziar carrinho
      </button>
    </div>
  )
}

/** Estado vazio compartilhado. */
function CartEmpty({ slug, onNavigate }: { slug: string; onNavigate?: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 16px', textAlign: 'center' }}>
      <ShoppingBag size={36} style={{ color: 'var(--c-text-muted)', opacity: 0.5 }} />
      <p style={{ margin: 0, fontSize: 14, color: 'var(--c-text-muted)' }}>Seu carrinho está vazio.</p>
      <Link href={`/loja/${slug}/produtos`} onClick={onNavigate}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '12px 20px', minHeight: 44,
          background: 'var(--c-primary)', color: 'var(--c-on-accent)',
          borderRadius: 'var(--r)', textDecoration: 'none', fontWeight: 600, fontSize: 14,
        }}>
        Continuar comprando
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// CartButtonV3 — badge + drawer (header)
// ─────────────────────────────────────────────────────────────────────────

export function CartButtonV3({ store }: { store: CartStoreInfo }) {
  const cart = useCart(store.slug)
  const [open, setOpen] = useState(false)

  // ESC fecha + trava o scroll do body enquanto aberto
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
      <button type="button" onClick={() => setOpen(true)} aria-label="Abrir carrinho"
        style={{
          position: 'relative', minHeight: 44, minWidth: 44,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text)',
        }}>
        <ShoppingBag size={21} />
        {cart.count > 0 && (
          <span aria-hidden style={{
            position: 'absolute', top: 3, right: 3,
            minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999,
            background: 'var(--c-primary)', color: 'var(--c-on-accent)',
            fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {cart.count > 99 ? '99+' : cart.count}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Carrinho"
          style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          {/* Overlay */}
          <div onClick={() => setOpen(false)} aria-hidden
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />

          {/* Painel: bottom sheet no mobile, drawer lateral no desktop */}
          <div
            className="max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-h-[85svh] max-md:w-full max-md:rounded-t-2xl md:top-0 md:bottom-0 md:right-0 md:w-[min(92vw,420px)]"
            style={{
              position: 'absolute',
              background: 'var(--c-bg)', color: 'var(--c-text)',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column',
              fontFamily: 'var(--f-body)',
              overflow: 'hidden',
            }}>
            <header style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: '1px solid var(--c-border)', flexShrink: 0,
            }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, fontFamily: 'var(--f-heading)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingBag size={18} style={{ color: 'var(--c-primary)' }} />
                Carrinho
                {cart.count > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-muted)' }}>
                    ({cart.count} {cart.count === 1 ? 'item' : 'itens'})
                  </span>
                )}
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar carrinho"
                style={{
                  minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)',
                }}>
                <X size={20} />
              </button>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, minHeight: 120 }}>
              {cart.items.length === 0
                ? <CartEmpty slug={store.slug} onNavigate={() => setOpen(false)} />
                : <CartLines cart={cart} />}
            </div>

            {cart.items.length > 0 && (
              <footer style={{
                padding: '14px 20px', borderTop: '1px solid var(--c-border)',
                background: 'var(--c-surface)', flexShrink: 0,
                paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
              }}>
                <CartCtas cart={cart} store={store} onNavigate={() => setOpen(false)} />
              </footer>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// CartPageClient — carrinho de página inteira (section cartLayout)
// ─────────────────────────────────────────────────────────────────────────

export function CartPageClient({ store }: { store: CartStoreInfo }) {
  const cart = useCart(store.slug)

  if (cart.items.length === 0) {
    return (
      <div style={{ background: 'var(--c-surface)', borderRadius: 'var(--r)', border: '1px solid var(--c-border)' }}>
        <CartEmpty slug={store.slug} />
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 md:items-start">
      <div className="md:flex-[3] min-w-0">
        <CartLines cart={cart} />
      </div>
      <div className="md:flex-[2]"
        style={{
          padding: 20, background: 'var(--c-surface)',
          border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
        }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, fontFamily: 'var(--f-heading)', color: 'var(--c-text)' }}>
          Resumo do pedido
        </h2>
        <CartCtas cart={cart} store={store} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// CheckoutSummaryClient — resumo + link pro checkout real (section checkoutLayout)
// ─────────────────────────────────────────────────────────────────────────

export function CheckoutSummaryClient({ slug }: { slug: string }) {
  const cart = useCart(slug)

  if (cart.items.length === 0) {
    return (
      <div style={{ background: 'var(--c-surface)', borderRadius: 'var(--r)', border: '1px solid var(--c-border)' }}>
        <CartEmpty slug={slug} />
      </div>
    )
  }

  return (
    <div style={{
      padding: 20, background: 'var(--c-surface)',
      border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: 'var(--f-heading)', color: 'var(--c-text)' }}>
        Resumo do pedido
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cart.items.map(item => (
          <li key={cartLineKey(item)}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: 'var(--c-text)' }}>
            <span className="line-clamp-1" style={{ minWidth: 0 }}>{item.qty}× {item.name}</span>
            <span style={{ flexShrink: 0, fontWeight: 600 }}>{formatBRL(item.qty * item.price)}</span>
          </li>
        ))}
      </ul>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 10, borderTop: '1px solid var(--c-border)',
      }}>
        <span style={{ fontSize: 14, color: 'var(--c-text-muted)' }}>Subtotal</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)', fontFamily: 'var(--f-heading)' }}>
          {formatBRL(cart.subtotal)}
        </span>
      </div>
      <Link href={`/loja/${slug}/checkout`}
        onClick={() => trackBeginCheckout(cart.subtotal)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px 20px', minHeight: 48,
          background: 'var(--c-primary)', color: 'var(--c-on-accent)',
          borderRadius: 'var(--r)', textDecoration: 'none', fontWeight: 600, fontSize: 15,
        }}>
        <CreditCard size={16} /> Ir para o checkout
      </Link>
    </div>
  )
}
