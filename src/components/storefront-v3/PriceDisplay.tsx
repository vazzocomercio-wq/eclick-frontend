/**
 * PriceDisplay — exibe preço de produto na vitrine respeitando:
 *   - Promoção (sale_price + janela → preço efetivo + badge OFERTA + riscado)
 *   - Settings de exibição (parcelas, Pix, formato)
 *
 * Server Component (sem useState). Recebe `product` + `settings` e renderiza
 * o bloco completo: preço principal, secundário, label de parcelas e badge
 * de desconto Pix.
 *
 * 3 formatos de display (`settings.display.format`):
 *  - 'installment_first': "12x de R$ 83,33"   (destaque) + "R$ 1.000 à vista"  (secundário)
 *  - 'total_first':       "R$ 1.000"          (destaque) + "12x de R$ 83,33"  (secundário)
 *  - 'pix_first':         "R$ 950 no Pix"     (destaque) + "12x de R$ 83,33"  (secundário)
 *
 * Quando o produto está em promoção (on_sale=true):
 *  - Preço efetivo já é o sale_price (vem do backend)
 *  - Preço original aparece RISCADO logo acima do destaque
 *  - Badge "OFERTA -X%" aparece no canto superior (caller decide onde renderizar — exposed via prop badge)
 *
 * Tamanho: variant 'card' (compacto pro grid) ou 'detail' (grande pra detalhe).
 */

import type { StorefrontProduct, PaymentDisplaySettings } from '@/lib/storefront/data'
import { DEFAULT_PAYMENT_DISPLAY } from '@/lib/storefront/data'

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  product:  StorefrontProduct
  settings?: PaymentDisplaySettings | null
  variant?: 'card' | 'detail'
  /** Se true, mostra também a "etiqueta" de desconto sobre o preço (badge inline). */
  inlineBadge?: boolean
}

export function PriceDisplay({ product, settings, variant = 'card', inlineBadge = false }: Props) {
  const s = settings ?? DEFAULT_PAYMENT_DISPLAY
  // Preço efetivo: server já calculou (effective_price); fallback pro price.
  const original  = Number(product.price ?? 0)
  const effective = Number(product.effective_price ?? product.price ?? 0)
  const onSale    = Boolean(product.on_sale) || (effective > 0 && effective < original)
  const discount  = Number(product.discount_pct ?? (onSale && original > 0 ? Math.round(((original - effective) / original) * 100) : 0))

  // Parcelas
  const showInstallment = s.installments.enabled && effective > 0
  const maxInst         = Math.max(1, Math.min(12, s.installments.max ?? 12))
  const interestFree    = Math.max(1, Math.min(maxInst, s.installments.interestFreeUpTo ?? maxInst))
  // Pra MVP, parcela = effective / maxInst (sem cálculo de juros).
  const installmentVal  = maxInst > 0 ? effective / maxInst : effective
  const interestFreeNote = interestFree >= maxInst ? 'sem juros' : ''

  // Pix
  const showPix     = s.pix.enabled && (s.pix.discountPct ?? 0) > 0
  const pixDiscount = Math.max(0, Math.min(50, s.pix.discountPct ?? 0))
  const pixPrice    = showPix ? effective * (1 - pixDiscount / 100) : effective

  const format = s.display.format ?? 'installment_first'

  // Tamanhos por variant
  const fontSize = {
    primary:   variant === 'detail' ? '1.875rem' : '1.125rem',
    secondary: variant === 'detail' ? '0.95rem'  : '0.8rem',
    strike:    variant === 'detail' ? '0.95rem'  : '0.78rem',
    badge:     variant === 'detail' ? '0.75rem'  : '0.65rem',
  }

  // ── Renderização dos 3 blocos (primary/secondary/pix) ──
  // Cada formato escolhe o que vai em cada slot.
  type PriceSlot = { value: string; note?: string; muted?: boolean; strike?: boolean }

  const slots: { primary: PriceSlot; secondary?: PriceSlot; tertiary?: PriceSlot } = (() => {
    const totalSlot:   PriceSlot = { value: brl(effective) }
    const instSlot:    PriceSlot | null = showInstallment
      ? { value: `${maxInst}x de ${brl(installmentVal)}`, note: interestFreeNote || undefined }
      : null
    const pixSlot:     PriceSlot | null = showPix
      ? { value: `${brl(pixPrice)} no Pix`, note: `${pixDiscount}% off` }
      : null

    switch (format) {
      case 'installment_first':
        return instSlot
          ? { primary: instSlot, secondary: totalSlot, tertiary: pixSlot ?? undefined }
          : { primary: totalSlot, secondary: pixSlot ?? undefined }
      case 'pix_first':
        return pixSlot
          ? { primary: pixSlot, secondary: totalSlot, tertiary: instSlot ?? undefined }
          : { primary: totalSlot, secondary: instSlot ?? undefined }
      case 'total_first':
      default:
        return {
          primary:   totalSlot,
          secondary: instSlot ?? pixSlot ?? undefined,
          tertiary:  instSlot && pixSlot ? pixSlot : undefined,
        }
    }
  })()

  // Mostra a label de parcelas separada quando o formato não a tem
  // como primary/secondary (raro — quase sempre cai num slot).
  const showStandaloneInstallmentLabel =
    s.display.showInstallmentLabel &&
    showInstallment &&
    slots.primary.value.indexOf('x de') === -1 &&
    (slots.secondary?.value ?? '').indexOf('x de') === -1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: variant === 'detail' ? 6 : 2 }}>
      {/* Preço riscado quando em promoção e o destaque NÃO é o total */}
      {onSale && (
        <div style={{
          fontSize: fontSize.strike, color: 'var(--c-text-muted)',
          textDecoration: 'line-through', lineHeight: 1,
        }}>
          de {brl(original)}
        </div>
      )}

      {/* Primary (destaque) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: fontSize.primary,
          fontWeight: 700,
          color: 'var(--c-primary)',
          lineHeight: 1.1,
        }}>
          {slots.primary.value}
        </span>
        {slots.primary.note && (
          <span style={{ fontSize: fontSize.secondary, color: 'var(--c-text-muted)' }}>
            {slots.primary.note}
          </span>
        )}
        {/* Badge inline OFERTA */}
        {onSale && inlineBadge && discount > 0 && (
          <span style={{
            fontSize: fontSize.badge, fontWeight: 700, letterSpacing: '0.05em',
            padding: '2px 6px', borderRadius: 'var(--r)',
            background: 'var(--c-warning, #ef4444)', color: '#fff',
            textTransform: 'uppercase', lineHeight: 1,
          }}>
            -{discount}%
          </span>
        )}
      </div>

      {/* Secondary */}
      {slots.secondary && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: fontSize.secondary,
            color: 'var(--c-text-muted)',
            lineHeight: 1.2,
          }}>
            {slots.secondary.value}
          </span>
          {slots.secondary.note && (
            <span style={{ fontSize: fontSize.badge, color: 'var(--c-text-muted)' }}>
              {slots.secondary.note}
            </span>
          )}
        </div>
      )}

      {/* Tertiary (variant detail prefere mostrar todas as 3 linhas) */}
      {variant === 'detail' && slots.tertiary && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: fontSize.secondary,
            color: 'var(--c-text-muted)',
            lineHeight: 1.2,
          }}>
            {slots.tertiary.value}
          </span>
          {slots.tertiary.note && (
            <span style={{ fontSize: fontSize.badge, color: 'var(--c-text-muted)' }}>
              {slots.tertiary.note}
            </span>
          )}
        </div>
      )}

      {/* Standalone parcela label (caso raro) */}
      {showStandaloneInstallmentLabel && (
        <div style={{ fontSize: fontSize.secondary, color: 'var(--c-text-muted)' }}>
          {maxInst}x de {brl(installmentVal)} {interestFreeNote}
        </div>
      )}
    </div>
  )
}

/** Badge "OFERTA -X%" pra usar sobre a imagem do produto. Pega
 *  discount_pct/effective do produto (calculado server-side). */
export function SaleBadge({ product, customText }: { product: StorefrontProduct; customText?: string | null }) {
  if (!product.on_sale) return null
  const discount = Number(product.discount_pct ?? 0)
  const label = customText ?? product.sale_badge_text ?? (discount > 0 ? `OFERTA -${discount}%` : 'OFERTA')
  return (
    <span style={{
      padding: '4px 10px', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
      background: 'var(--c-warning, #ef4444)', color: '#fff',
      borderRadius: 'var(--r)', textTransform: 'uppercase', lineHeight: 1,
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    }}>
      {label}
    </span>
  )
}
