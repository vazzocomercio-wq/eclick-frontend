'use client'

/**
 * Formulario de checkout da Loja Propria.
 *
 * Le o carrinho do localStorage (useCart), coleta dados do cliente +
 * escolha de gateway, chama POST /storefront/checkout no backend e
 * redireciona pra URL do gateway (init_point do MP ou checkout.url do
 * Stripe). Apos a resposta, o carrinho fica vazio (clear).
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2, CreditCard, AlertCircle, ShoppingBag, ArrowLeft, Wallet, Tag } from 'lucide-react'
import { useCart } from '@/lib/storefront/cart'
import { useCartTracker } from '@/lib/storefront/cart-tracker'
import { formatBRL } from '@/lib/storefront/data'
import { getRefCode } from '@/lib/storefront/affiliate-auth'
import type { StorefrontStore } from '@/lib/storefront/data'
import type { StorefrontDesign } from '@/lib/storefront/types'
import { buildCtx } from '../renderCtx'
import { googleFontsHref, onAccentColor, alpha } from '@/lib/storefront/theme'
import { AnnouncementBar } from './AnnouncementBar'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

const BACKEND =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

type Gateway = 'mercadopago' | 'stripe'

export function CheckoutForm({ store, design, slug }: {
  store:  StorefrontStore
  design: StorefrontDesign
  slug:   string
}) {
  const cart = useCart(slug)
  const ctx = buildCtx(design.theme)
  const { colors } = ctx.theme
  const t = useTranslations('storefront')

  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [doc, setDoc]         = useState('')
  const [notes, setNotes]     = useState('')
  const [gateway, setGateway] = useState<Gateway>('mercadopago')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // AB1 — tracking de abandono. Pinga backend debounced quando o cliente
  // preenche phone/email no checkout. Se ele sair antes de pagar e o
  // lojista habilitou recovery, vai receber WhatsApp depois de N min.
  useCartTracker({
    slug,
    items:    cart.items,
    subtotal: cart.subtotal,
    phone,
    email,
    name,
  })

  // Cashback: saldo do cliente + opt-in pra usar
  const [cashbackBalanceCents, setCashbackBalanceCents] = useState<number | null>(null)
  const [cashbackMaxRedeemable, setCashbackMaxRedeemable] = useState<number>(0)
  const [cashbackEarnPct, setCashbackEarnPct] = useState<number>(0)
  const [useCashback, setUseCashback] = useState<boolean>(false)
  const [cashbackToUseCents, setCashbackToUseCents] = useState<number>(0)

  // Cupom — valida server-side via /coupons/apply (não incrementa uso aqui;
  // o pagamento aprovado é que contabiliza). Só preview de desconto.
  type AppliedCoupon = {
    code: string; type: string; discount_cents: number; free_shipping: boolean; message: string
  }
  const [couponInput, setCouponInput]       = useState('')
  const [couponApplying, setCouponApplying] = useState(false)
  const [couponError, setCouponError]       = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon]   = useState<AppliedCoupon | null>(null)

  async function applyCoupon() {
    const code = couponInput.trim()
    if (!code || couponApplying) return
    setCouponApplying(true)
    setCouponError(null)
    try {
      const subtotalCents = Math.round(cart.subtotal * 100)
      const res = await fetch(
        `${BACKEND}/coupons/apply?slug=${encodeURIComponent(slug)}&code=${encodeURIComponent(code)}&subtotal_cents=${subtotalCents}`,
      )
      const data = await res.json().catch(() => ({})) as Partial<AppliedCoupon> & { message?: string }
      if (!res.ok) throw new Error(data?.message ?? 'Cupom inválido.')
      setAppliedCoupon(data as AppliedCoupon)
    } catch (e) {
      setAppliedCoupon(null)
      setCouponError((e as Error).message)
    } finally {
      setCouponApplying(false)
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError(null)
  }

  // Lookup do saldo quando email é preenchido (debounced 500ms)
  useEffect(() => {
    if (!email.trim() || !email.includes('@')) {
      setCashbackBalanceCents(null)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${BACKEND}/public/cashback/by-slug/${encodeURIComponent(slug)}/balance?email=${encodeURIComponent(email.trim())}`,
        )
        if (!res.ok) return
        const data = await res.json() as {
          enabled: boolean; balance: number;
          settings?: { minBalanceToUseCents: number; maxRedemptionPctPerOrder: number; earnPct: number }
        }
        if (!data.enabled) {
          setCashbackBalanceCents(null)
          return
        }
        setCashbackBalanceCents(data.balance ?? 0)
        setCashbackEarnPct(data.settings?.earnPct ?? 0)
      } catch { /* silent — cashback é opt-in */ }
    }, 500)
    return () => clearTimeout(t)
  }, [email, slug])

  // Preview redemption quando o cliente opta em usar (recalcula maxRedeemable)
  useEffect(() => {
    if (!useCashback || !email.trim() || !cashbackBalanceCents || cart.subtotal <= 0) {
      setCashbackMaxRedeemable(0)
      setCashbackToUseCents(0)
      return
    }
    const orderTotalCents = Math.round(cart.subtotal * 100)
    void (async () => {
      try {
        const res = await fetch(
          `${BACKEND}/public/cashback/by-slug/${encodeURIComponent(slug)}/preview-redemption`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email: email.trim(), orderTotalCents }),
          },
        )
        if (!res.ok) return
        const data = await res.json() as { maxRedeemableCents: number; enabled: boolean }
        if (!data.enabled) {
          setCashbackMaxRedeemable(0)
          setCashbackToUseCents(0)
          return
        }
        setCashbackMaxRedeemable(data.maxRedeemableCents ?? 0)
        // Por padrão, usa o máximo permitido
        setCashbackToUseCents(prev => prev > 0 && prev <= (data.maxRedeemableCents ?? 0) ? prev : (data.maxRedeemableCents ?? 0))
      } catch { /* silent */ }
    })()
  }, [useCashback, email, slug, cart.subtotal, cashbackBalanceCents])

  const cashbackToUseReais = cashbackToUseCents / 100
  const couponDiscountReais = appliedCoupon ? appliedCoupon.discount_cents / 100 : 0
  const effectiveTotal = Math.max(0, cart.subtotal - couponDiscountReais - (useCashback ? cashbackToUseReais : 0))
  const cashbackToEarn  = effectiveTotal * (cashbackEarnPct / 100)

  const announce = design.sections.find(s => s.type === 'announcementBar')
  const header   = design.sections.find(s => s.type === 'siteHeader')
  const footer   = design.sections.find(s => s.type === 'siteFooter')

  const empty = cart.items.length === 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (empty || submitting) return
    setError(null)
    if (!name.trim() || !email.trim()) {
      setError(t('checkout.validation.missingFields'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/storefront/checkout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          gateway,
          items: cart.items,
          customer: {
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            doc:   doc.trim() || undefined,
            notes: notes.trim() || undefined,
          },
          cashbackToUse: useCashback && cashbackToUseCents > 0 ? cashbackToUseCents : undefined,
          affiliateCode: getRefCode(slug) ?? undefined,
          couponCode: appliedCoupon?.code,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? t('checkout.validation.genericError', { status: res.status }))
      }
      const data = await res.json() as { orderId: string; initPoint: string }
      // Limpa o carrinho ANTES do redirect (se o usuario voltar, comeca limpo)
      cart.clear()
      window.location.href = data.initPoint
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: colors.background, color: colors.text, fontFamily: ctx.fontB, minHeight: '100vh' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(design.theme)} />
      {announce && <AnnouncementBar section={announce} ctx={ctx} />}
      {header && header.type === 'siteHeader' && (
        <SiteHeader store={store} section={header} ctx={ctx} slug={slug} />
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <Link href={`/loja/${slug}`} className="text-xs sm:text-sm hover:underline inline-flex items-center gap-1"
          style={{ color: colors.textMuted }}>
          <ArrowLeft size={12} /> {t('nav.keepShopping')}
        </Link>

        <h1 className="mt-4 text-2xl sm:text-4xl font-bold" style={{ color: colors.text, fontFamily: ctx.fontH }}>
          {t('checkout.title')}
        </h1>

        {empty ? (
          <div className="mt-10 p-10 text-center rounded"
            style={{ border: `1px dashed ${colors.border}`, borderRadius: ctx.radius }}>
            <ShoppingBag size={36} className="mx-auto mb-3" style={{ color: colors.textMuted, opacity: 0.5 }} />
            <p className="text-sm" style={{ color: colors.textMuted }}>
              {t('checkout.empty')}
            </p>
            <Link href={`/loja/${slug}`}
              className="inline-block mt-4 px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius }}>
              {t('nav.seeStore')}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid lg:grid-cols-[1fr_360px] gap-8">
            {/* Cliente */}
            <div className="space-y-5">
              <Card title={t('checkout.customer.title')} ctx={ctx}>
                <Field label={t('checkout.customer.name')}>
                  <Input value={name} onChange={setName} ctx={ctx} required />
                </Field>
                <Field label={t('checkout.customer.email')}>
                  <Input value={email} onChange={setEmail} ctx={ctx} type="email" required />
                </Field>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label={t('checkout.customer.phone')}>
                    <Input value={phone} onChange={setPhone} ctx={ctx} placeholder={t('checkout.customer.phonePlaceholder')} />
                  </Field>
                  <Field label={t('checkout.customer.doc')}>
                    <Input value={doc} onChange={setDoc} ctx={ctx} placeholder={t('checkout.customer.docPlaceholder')} />
                  </Field>
                </div>
                <Field label={t('checkout.customer.notes')}>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    placeholder={t('checkout.customer.notesPlaceholder')}
                    className="w-full px-3 py-2 text-sm outline-none resize-none"
                    style={{
                      background: colors.surface, color: colors.text,
                      border: `1px solid ${colors.border}`, borderRadius: ctx.radius,
                    }} />
                </Field>
              </Card>

              {/* Cashback (aparece só quando cliente tem saldo) */}
              {cashbackBalanceCents != null && cashbackBalanceCents > 0 && (
                <Card title={
                  <span className="inline-flex items-center gap-2">
                    <Wallet size={14} /> Cashback disponível
                  </span>
                } ctx={ctx}>
                  <div className="p-3 rounded" style={{
                    background: alpha('#22c55e', 0.08),
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: ctx.radius,
                  }}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs" style={{ color: colors.textMuted }}>Seu saldo</p>
                        <p className="text-xl font-bold" style={{ color: '#22c55e' }}>
                          {formatBRL(cashbackBalanceCents / 100)}
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 cursor-pointer" style={{ minHeight: 44 }}>
                        <span className="text-sm" style={{ color: colors.text }}>
                          Usar agora
                        </span>
                        <input
                          type="checkbox"
                          checked={useCashback}
                          onChange={e => setUseCashback(e.target.checked)}
                          className="w-5 h-5 cursor-pointer"
                          style={{ accentColor: '#22c55e' }}
                        />
                      </label>
                    </div>
                    {useCashback && cashbackMaxRedeemable > 0 && (
                      <>
                        <div className="mt-3 mb-1 flex items-center justify-between">
                          <span className="text-xs" style={{ color: colors.textMuted }}>Quanto usar</span>
                          <span className="text-sm font-bold" style={{ color: '#22c55e' }}>
                            {formatBRL(cashbackToUseCents / 100)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={cashbackMaxRedeemable}
                          step={100}
                          value={cashbackToUseCents}
                          onChange={e => setCashbackToUseCents(Number(e.target.value))}
                          className="w-full"
                          style={{ accentColor: '#22c55e' }}
                        />
                        <p className="text-[10px] mt-1" style={{ color: colors.textMuted }}>
                          Máximo permitido nesse pedido: {formatBRL(cashbackMaxRedeemable / 100)}
                        </p>
                      </>
                    )}
                    {useCashback && cashbackMaxRedeemable === 0 && cashbackBalanceCents > 0 && (
                      <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                        Saldo abaixo do mínimo permitido nesse pedido.
                      </p>
                    )}
                  </div>
                </Card>
              )}

              {/* Cupom de desconto */}
              <Card title={
                <span className="inline-flex items-center gap-2">
                  <Tag size={14} /> Cupom de desconto
                </span>
              } ctx={ctx}>
                {appliedCoupon ? (
                  <div className="p-3 rounded flex items-center justify-between gap-3" style={{
                    background: alpha('#22c55e', 0.08),
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: ctx.radius,
                  }}>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: '#22c55e' }}>{appliedCoupon.code}</p>
                      <p className="text-[11px]" style={{ color: colors.textMuted }}>{appliedCoupon.message}</p>
                    </div>
                    <button type="button" onClick={removeCoupon}
                      className="text-xs underline shrink-0" style={{ color: colors.textMuted, minHeight: 44 }}>
                      Remover
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        value={couponInput}
                        onChange={e => setCouponInput(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void applyCoupon() } }}
                        placeholder="DIGITE O CÓDIGO"
                        className="flex-1 px-3 py-2 text-sm outline-none uppercase"
                        style={{
                          background: colors.surface, color: colors.text,
                          border: `1px solid ${colors.border}`, borderRadius: ctx.radius,
                        }}
                      />
                      <button type="button" onClick={() => void applyCoupon()} disabled={couponApplying || !couponInput.trim()}
                        className="px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 shrink-0 inline-flex items-center justify-center"
                        style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius, minHeight: 44 }}>
                        {couponApplying ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar'}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: '#ef4444' }}>
                        <AlertCircle size={12} /> {couponError}
                      </p>
                    )}
                  </>
                )}
              </Card>

              <Card title={t('checkout.payment.title')} ctx={ctx}>
                <GatewayPick value={gateway} onChange={setGateway} ctx={ctx} />
                <p className="text-[11px] mt-2" style={{ color: colors.textMuted }}>
                  {gateway === 'mercadopago' ? t('checkout.payment.redirectNoteMp') : t('checkout.payment.redirectNoteStripe')}
                </p>
                {useCashback && cashbackToUseCents > 0 && gateway === 'stripe' && (
                  <p className="text-[11px] mt-2" style={{ color: '#f59e0b' }}>
                    ⚠ Resgate de cashback ainda não disponível com Stripe. Use Mercado Pago.
                  </p>
                )}
              </Card>

              {error && (
                <div className="flex items-center gap-2 rounded p-3 text-sm"
                  style={{
                    background: alpha('#ef4444', 0.08),
                    color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: ctx.radius,
                  }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button type="submit" disabled={submitting || empty}
                className="hidden lg:inline-flex w-full items-center justify-center gap-2 px-6 py-3.5 font-semibold text-sm transition-transform hover:scale-[1.01] disabled:opacity-50"
                style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius }}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {submitting ? t('checkout.submit.redirecting') : t('checkout.submit.pay', { price: formatBRL(effectiveTotal) })}
              </button>
            </div>

            {/* Resumo */}
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <Card title={t('checkout.summary.title', { n: cart.count })} ctx={ctx}>
                <ul className="space-y-3">
                  {cart.items.map(it => (
                    <li key={it.productId} className="flex gap-2 text-xs">
                      <span className="flex-1 truncate" style={{ color: colors.text }}>
                        {it.name} <span style={{ color: colors.textMuted }}>{t('checkout.summary.qty', { qty: it.qty })}</span>
                      </span>
                      <span className="shrink-0 font-medium" style={{ color: colors.text }}>
                        {formatBRL(it.price * it.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
                {/* Subtotal */}
                <div className="mt-4 pt-3 border-t flex justify-between items-baseline text-sm"
                  style={{ borderColor: colors.border }}>
                  <span style={{ color: colors.textMuted }}>Subtotal</span>
                  <span style={{ color: colors.text }}>{formatBRL(cart.subtotal)}</span>
                </div>
                {/* Cupom aplicado */}
                {appliedCoupon && appliedCoupon.discount_cents > 0 && (
                  <div className="flex justify-between items-baseline text-sm">
                    <span style={{ color: '#22c55e' }}>🏷 Cupom {appliedCoupon.code}</span>
                    <span style={{ color: '#22c55e' }}>− {formatBRL(appliedCoupon.discount_cents / 100)}</span>
                  </div>
                )}
                {appliedCoupon && appliedCoupon.free_shipping && (
                  <div className="flex justify-between items-baseline text-sm">
                    <span style={{ color: '#22c55e' }}>🏷 Cupom {appliedCoupon.code}</span>
                    <span style={{ color: '#22c55e' }}>Frete grátis</span>
                  </div>
                )}
                {/* Cashback aplicado */}
                {useCashback && cashbackToUseCents > 0 && (
                  <div className="flex justify-between items-baseline text-sm">
                    <span style={{ color: '#22c55e' }}>💰 Cashback aplicado</span>
                    <span style={{ color: '#22c55e' }}>− {formatBRL(cashbackToUseCents / 100)}</span>
                  </div>
                )}
                {/* Total */}
                <div className="pt-3 border-t flex justify-between items-baseline"
                  style={{ borderColor: colors.border }}>
                  <span className="text-sm" style={{ color: colors.textMuted }}>{t('checkout.summary.total')}</span>
                  <span className="text-2xl font-bold" style={{ color: colors.primary, fontFamily: ctx.fontH }}>
                    {formatBRL(effectiveTotal)}
                  </span>
                </div>
                {/* Cashback a ganhar */}
                {cashbackEarnPct > 0 && effectiveTotal > 0 && (
                  <div className="mt-1 text-[11px] text-right" style={{ color: '#22c55e' }}>
                    Você vai ganhar {formatBRL(cashbackToEarn)} em cashback
                  </div>
                )}
              </Card>

              <button type="submit" disabled={submitting || empty}
                className="lg:hidden w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 font-semibold text-sm transition-transform hover:scale-[1.01] disabled:opacity-50"
                style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius }}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {submitting ? t('checkout.submit.redirecting') : t('checkout.submit.pay', { price: formatBRL(effectiveTotal) })}
              </button>
            </aside>
          </form>
        )}
      </main>

      {footer && footer.type === 'siteFooter' && <SiteFooter store={store} section={footer} ctx={ctx} />}
    </div>
  )
}

function Card({ title, children, ctx }: { title: React.ReactNode; children: React.ReactNode; ctx: ReturnType<typeof buildCtx> }) {
  return (
    <section className="p-5 space-y-3"
      style={{ background: ctx.theme.colors.surface, border: `1px solid ${ctx.theme.colors.border}`, borderRadius: ctx.radius }}>
      <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: ctx.theme.colors.text }}>{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider opacity-70">{label}</span>
      {children}
    </label>
  )
}

function Input({ value, onChange, ctx, ...rest }: {
  value: string; onChange: (v: string) => void; ctx: ReturnType<typeof buildCtx>
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const { colors } = ctx.theme
  return (
    <input value={value} onChange={e => onChange(e.target.value)} {...rest}
      className="w-full px-3 py-2 text-sm outline-none"
      style={{
        background: colors.surface, color: colors.text,
        border: `1px solid ${colors.border}`, borderRadius: ctx.radius,
      }} />
  )
}

function GatewayPick({ value, onChange, ctx }: {
  value: Gateway
  onChange: (v: Gateway) => void
  ctx: ReturnType<typeof buildCtx>
}) {
  const { colors } = ctx.theme
  const t = useTranslations('storefront')
  const Opt = ({ id, title, desc }: { id: Gateway; title: string; desc: string }) => {
    const active = value === id
    return (
      <button type="button" onClick={() => onChange(id)}
        className="text-left p-3 transition-colors"
        style={{
          background: active ? alpha(colors.primary, 0.08) : colors.surface,
          border: `1px solid ${active ? colors.primary : colors.border}`,
          borderRadius: ctx.radius,
        }}>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: active ? colors.primary : colors.border }}>
            {active && <span className="w-2 h-2 rounded-full" style={{ background: colors.primary }} />}
          </span>
          <span className="font-semibold text-sm" style={{ color: colors.text }}>{title}</span>
        </div>
        <p className="text-[11px] mt-1 ml-6" style={{ color: colors.textMuted }}>{desc}</p>
      </button>
    )
  }
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <Opt id="mercadopago" title={t('checkout.payment.mp')}     desc={t('checkout.payment.mpDesc')} />
      <Opt id="stripe"      title={t('checkout.payment.stripe')} desc={t('checkout.payment.stripeDesc')} />
    </div>
  )
}
