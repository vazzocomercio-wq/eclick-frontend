'use client'

/**
 * Formulario de checkout da Loja Propria.
 *
 * Le o carrinho do localStorage (useCart), coleta dados do cliente +
 * escolha de gateway, chama POST /storefront/checkout no backend e
 * redireciona pra URL do gateway (init_point do MP ou checkout.url do
 * Stripe). Apos a resposta, o carrinho fica vazio (clear).
 */

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, CreditCard, AlertCircle, ShoppingBag, ArrowLeft } from 'lucide-react'
import { useCart } from '@/lib/storefront/cart'
import { formatBRL } from '@/lib/storefront/data'
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

  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [doc, setDoc]         = useState('')
  const [notes, setNotes]     = useState('')
  const [gateway, setGateway] = useState<Gateway>('mercadopago')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const announce = design.sections.find(s => s.type === 'announcementBar')
  const header   = design.sections.find(s => s.type === 'siteHeader')
  const footer   = design.sections.find(s => s.type === 'siteFooter')

  const empty = cart.items.length === 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (empty || submitting) return
    setError(null)
    if (!name.trim() || !email.trim()) {
      setError('Preencha nome e e-mail.')
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
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? `Erro ${res.status}`)
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
          <ArrowLeft size={12} /> Continuar comprando
        </Link>

        <h1 className="mt-4 text-2xl sm:text-4xl font-bold" style={{ color: colors.text, fontFamily: ctx.fontH }}>
          Finalizar compra
        </h1>

        {empty ? (
          <div className="mt-10 p-10 text-center rounded"
            style={{ border: `1px dashed ${colors.border}`, borderRadius: ctx.radius }}>
            <ShoppingBag size={36} className="mx-auto mb-3" style={{ color: colors.textMuted, opacity: 0.5 }} />
            <p className="text-sm" style={{ color: colors.textMuted }}>
              Seu carrinho está vazio.
            </p>
            <Link href={`/loja/${slug}`}
              className="inline-block mt-4 px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius }}>
              Ver a loja
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid lg:grid-cols-[1fr_360px] gap-8">
            {/* Cliente */}
            <div className="space-y-5">
              <Card title="Dados do comprador" ctx={ctx}>
                <Field label="Nome completo *">
                  <Input value={name} onChange={setName} ctx={ctx} required />
                </Field>
                <Field label="E-mail *">
                  <Input value={email} onChange={setEmail} ctx={ctx} type="email" required />
                </Field>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Telefone">
                    <Input value={phone} onChange={setPhone} ctx={ctx} placeholder="(11) 9..." />
                  </Field>
                  <Field label="CPF ou CNPJ">
                    <Input value={doc} onChange={setDoc} ctx={ctx} placeholder="Apenas números" />
                  </Field>
                </div>
                <Field label="Observações (opcional)">
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    placeholder="Endereço de entrega, ponto de referência, etc."
                    className="w-full px-3 py-2 text-sm outline-none resize-none"
                    style={{
                      background: colors.surface, color: colors.text,
                      border: `1px solid ${colors.border}`, borderRadius: ctx.radius,
                    }} />
                </Field>
              </Card>

              <Card title="Forma de pagamento" ctx={ctx}>
                <GatewayPick value={gateway} onChange={setGateway} ctx={ctx} />
                <p className="text-[11px] mt-2" style={{ color: colors.textMuted }}>
                  Você será redirecionado para o pagamento seguro do {gateway === 'mercadopago' ? 'Mercado Pago' : 'Stripe'}.
                </p>
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
                {submitting ? 'Redirecionando…' : `Pagar ${formatBRL(cart.subtotal)}`}
              </button>
            </div>

            {/* Resumo */}
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <Card title={`Seu pedido (${cart.count} ${cart.count === 1 ? 'item' : 'itens'})`} ctx={ctx}>
                <ul className="space-y-3">
                  {cart.items.map(it => (
                    <li key={it.productId} className="flex gap-2 text-xs">
                      <span className="flex-1 truncate" style={{ color: colors.text }}>
                        {it.name} <span style={{ color: colors.textMuted }}>× {it.qty}</span>
                      </span>
                      <span className="shrink-0 font-medium" style={{ color: colors.text }}>
                        {formatBRL(it.price * it.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-3 border-t flex justify-between items-baseline"
                  style={{ borderColor: colors.border }}>
                  <span className="text-sm" style={{ color: colors.textMuted }}>Total</span>
                  <span className="text-2xl font-bold" style={{ color: colors.primary, fontFamily: ctx.fontH }}>
                    {formatBRL(cart.subtotal)}
                  </span>
                </div>
              </Card>

              <button type="submit" disabled={submitting || empty}
                className="lg:hidden w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 font-semibold text-sm transition-transform hover:scale-[1.01] disabled:opacity-50"
                style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius }}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {submitting ? 'Redirecionando…' : `Pagar ${formatBRL(cart.subtotal)}`}
              </button>
            </aside>
          </form>
        )}
      </main>

      {footer && footer.type === 'siteFooter' && <SiteFooter store={store} section={footer} ctx={ctx} />}
    </div>
  )
}

function Card({ title, children, ctx }: { title: string; children: React.ReactNode; ctx: ReturnType<typeof buildCtx> }) {
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
  value: Gateway; onChange: (v: Gateway) => void; ctx: ReturnType<typeof buildCtx>
}) {
  const { colors } = ctx.theme
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
      <Opt id="mercadopago" title="Mercado Pago" desc="Pix, cartão e boleto" />
      <Opt id="stripe"      title="Cartão (Stripe)" desc="Cartão de crédito ou débito" />
    </div>
  )
}
