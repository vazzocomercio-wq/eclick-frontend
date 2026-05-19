'use client'

/**
 * Resultado do checkout — pagina renderizada apos o redirect do gateway.
 *
 * Recebe orderId + status ('sucesso' | 'falha' | 'pendente'). Mostra um
 * card central com cone + headline + descricao + CTA. Reusa o chrome
 * (announcement, header, footer) do design da loja.
 */

import Link from 'next/link'
import { Check, X, Clock, ArrowLeft, RefreshCcw } from 'lucide-react'
import { formatBRL } from '@/lib/storefront/data'
import type { StorefrontStore } from '@/lib/storefront/data'
import type { StorefrontDesign } from '@/lib/storefront/types'
import { buildCtx } from '../renderCtx'
import { googleFontsHref, onAccentColor, alpha } from '@/lib/storefront/theme'
import { AnnouncementBar } from './AnnouncementBar'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

interface OrderProp {
  id:        string
  status:    string
  total:     number
  items:     Array<{ productId: string; name: string; price: number; qty: number; imageUrl?: string }>
  customer:  { name: string; email: string }
  gateway:   string | null
  initPoint: string | null
}

export function OrderResult({ store, design, slug, order, returnStatus }: {
  store:        StorefrontStore
  design:       StorefrontDesign
  slug:         string
  order:        OrderProp
  returnStatus: 'sucesso' | 'falha' | 'pendente'
}) {
  const ctx = buildCtx(design.theme)
  const { colors } = ctx.theme

  const announce = design.sections.find(s => s.type === 'announcementBar')
  const header   = design.sections.find(s => s.type === 'siteHeader')
  const footer   = design.sections.find(s => s.type === 'siteFooter')

  // O 'returnStatus' vem da URL (gateway). O order.status real vem do DB
  // (atualizado pelo webhook). Usamos o REAL quando disponivel, caindo no
  // returnStatus apenas pra escolher o visual default.
  const real = order.status
  const isPaid     = real === 'paid'
  const isFailed   = real === 'failed' || real === 'cancelled' || returnStatus === 'falha'
  const isPending  = real === 'pending' || real === 'awaiting_payment' || returnStatus === 'pendente'

  const variant = isPaid ? 'success' : isFailed ? 'failed' : 'pending'

  const ui = {
    success: {
      icon:  <Check size={28} />,
      bg:    '#22c55e',
      title: 'Pagamento confirmado!',
      sub:   `Obrigado pela compra, ${order.customer.name.split(' ')[0] || ''}. O lojista entrará em contato pelos próximos passos.`,
    },
    failed: {
      icon:  <X size={28} />,
      bg:    '#ef4444',
      title: 'Pagamento não concluído',
      sub:   'Não recebemos confirmação do pagamento. Você pode tentar de novo ou falar com o lojista.',
    },
    pending: {
      icon:  <Clock size={28} />,
      bg:    '#f59e0b',
      title: 'Aguardando confirmação',
      sub:   'O pagamento ainda está em análise pelo gateway. Avisaremos por e-mail quando confirmar.',
    },
  }[variant]

  return (
    <div style={{ background: colors.background, color: colors.text, fontFamily: ctx.fontB, minHeight: '100vh' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(design.theme)} />
      {announce && <AnnouncementBar section={announce} ctx={ctx} />}
      {header && header.type === 'siteHeader' && (
        <SiteHeader store={store} section={header} ctx={ctx} slug={slug} />
      )}

      <main className="max-w-2xl mx-auto px-4 sm:px-8 py-12 sm:py-16">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full text-white"
            style={{ background: ui.bg, borderRadius: 999 }}>
            {ui.icon}
          </div>
          <h1 className="mt-5 text-3xl sm:text-4xl font-bold" style={{ color: colors.text, fontFamily: ctx.fontH }}>
            {ui.title}
          </h1>
          <p className="mt-3 text-sm sm:text-base max-w-md mx-auto" style={{ color: colors.textMuted }}>
            {ui.sub}
          </p>
        </div>

        <section className="mt-8 p-5"
          style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: ctx.radius }}>
          <div className="flex items-center justify-between text-xs mb-3" style={{ color: colors.textMuted }}>
            <span>Pedido</span>
            <span className="font-mono">{order.id.slice(0, 8)}</span>
          </div>
          <ul className="space-y-2.5">
            {order.items.map(it => (
              <li key={it.productId} className="flex gap-3 text-sm">
                <span className="flex-1 truncate" style={{ color: colors.text }}>
                  {it.name} <span style={{ color: colors.textMuted }}>× {it.qty}</span>
                </span>
                <span className="shrink-0 font-medium" style={{ color: colors.text }}>
                  {formatBRL(it.price * it.qty)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-3 border-t flex items-baseline justify-between"
            style={{ borderColor: colors.border }}>
            <span className="text-sm" style={{ color: colors.textMuted }}>Total</span>
            <span className="text-2xl font-bold" style={{ color: colors.primary, fontFamily: ctx.fontH }}>
              {formatBRL(order.total)}
            </span>
          </div>
        </section>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={`/loja/${slug}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: colors.primary, color: onAccentColor(ctx.theme), borderRadius: ctx.radius }}>
            <ArrowLeft size={14} /> Voltar para a loja
          </Link>
          {isFailed && order.initPoint && (
            <a href={order.initPoint}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: alpha(colors.primary, 0.1), color: colors.primary,
                       border: `1px solid ${colors.primary}`, borderRadius: ctx.radius }}>
              <RefreshCcw size={14} /> Tentar pagar de novo
            </a>
          )}
          {isPending && (
            <button type="button" onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: alpha(colors.primary, 0.1), color: colors.primary,
                       border: `1px solid ${colors.primary}`, borderRadius: ctx.radius }}>
              <RefreshCcw size={14} /> Atualizar status
            </button>
          )}
        </div>

        {isPaid && store.whatsapp_number && (
          <p className="mt-6 text-center text-[11px]" style={{ color: colors.textMuted }}>
            Dúvidas? Chame a loja no WhatsApp: <span className="font-mono">{store.whatsapp_number}</span>
          </p>
        )}
      </main>

      {footer && footer.type === 'siteFooter' && <SiteFooter store={store} section={footer} ctx={ctx} />}
    </div>
  )
}
