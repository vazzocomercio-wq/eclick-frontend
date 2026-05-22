/**
 * Implementacao dos 15 blocks v3 — basica e funcional.
 *
 * Server Components. Renderem markup minimal acessivel (touch >=44px,
 * fontes via CSS vars do tema). Sem dependencia de bibliotecas externas.
 */

import type { RenderCtx } from '../RenderCtx'
import { PriceDisplay } from '../PriceDisplay'
import { clampRem, ctaButtonStyle, fieldFontFamily } from '../helpers'
import type {
  HeadingBlock, SubheadingBlock, ParagraphBlock,
  ImageBlock, VideoBlock as VideoBlk,
  ButtonBlock, BadgeBlock, CountdownBlock,
  DividerBlock, SpacerBlock, IconBlock,
  ProductCardMiniBlock, CollectionLinkBlock, SocialIconBlock, SlideBlock,
} from '@/lib/storefront/v3/types'

type Align = 'left' | 'center' | 'right'

export function Heading({ block }: { ctx: RenderCtx; block: HeadingBlock }) {
  const { text, level, align, color, sizeRem, fontPair } = block.settings
  const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3' | 'h4'
  const sizes: Record<number, number> = { 1: 2.25, 2: 1.875, 3: 1.5, 4: 1.25 }
  return <Tag style={{ textAlign: align, fontFamily: fieldFontFamily(fontPair, 'heading'), color: color || 'var(--c-text)', fontSize: `${clampRem(sizeRem, sizes[level])}rem` }}>{text}</Tag>
}

export function Subheading({ block }: { ctx: RenderCtx; block: SubheadingBlock }) {
  const { text, align, color, sizeRem, fontPair } = block.settings
  return <p style={{ textAlign: align as Align, fontFamily: fieldFontFamily(fontPair, 'heading'), color: color || 'var(--c-text-muted)', fontSize: `${clampRem(sizeRem, 1.125)}rem` }}>{text}</p>
}

export function Paragraph({ block }: { ctx: RenderCtx; block: ParagraphBlock }) {
  const { text, align, color, sizeRem, fontPair } = block.settings
  return <p style={{ textAlign: align as Align, fontFamily: fieldFontFamily(fontPair, 'body'), color: color || 'var(--c-text)', fontSize: `${clampRem(sizeRem, 1)}rem` }}>{text}</p>
}

export function Image({ block }: { ctx: RenderCtx; block: ImageBlock }) {
  const { url, alt, link, aspectRatio, objectFit } = block.settings
  const aspect: Record<string, string> = { '1:1': '1 / 1', '4:5': '4 / 5', '16:9': '16 / 9', '3:2': '3 / 2', 'free': 'auto' }
  const img = url
    ? <img src={url} alt={alt} loading="lazy" style={{ width: '100%', aspectRatio: aspect[aspectRatio], objectFit, display: 'block' }} />
    : <div style={{ width: '100%', aspectRatio: aspect[aspectRatio] || '16/9', background: 'var(--c-surface)' }} aria-label={alt} />
  return link ? <a href={link}>{img}</a> : img
}

export function Video({ block }: { ctx: RenderCtx; block: VideoBlk }) {
  const { url, autoplay, loop, muted, controls, poster } = block.settings
  if (!url) return null
  return (
    <video
      src={url} poster={poster}
      autoPlay={autoplay} loop={loop} muted={muted} controls={controls}
      playsInline preload="metadata"
      style={{ width: '100%', display: 'block' }}
    />
  )
}

export function Button({ block }: { ctx: RenderCtx; block: ButtonBlock }) {
  const { label, href, style, size, newTab, color, textColor, fontPair } = block.settings
  const padH: Record<string, string> = { sm: '12px', md: '20px', lg: '28px' }
  const padV: Record<string, string> = { sm: '8px',  md: '12px', lg: '16px' }
  // cor base: override do lojista, senão a cor primária do tema.
  const c = color || 'var(--c-primary)'
  const sty = style === 'primary'
    ? { background: c, color: textColor || 'var(--c-on-accent)', border: 'none' }
    : style === 'secondary'
      ? { background: 'transparent', color: color || 'var(--c-primary)', border: `1px solid ${c}` }
      : { background: 'transparent', color: color || 'var(--c-text)', border: 'none' }
  return (
    <a
      href={href}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      style={{
        ...sty,
        padding:      `${padV[size]} ${padH[size]}`,
        borderRadius: 'var(--r)',
        display:      'inline-block',
        fontWeight:   500,
        fontFamily:   fontPair ? fieldFontFamily(fontPair, 'heading') : 'var(--f-body)',
        textDecoration: 'none',
        minHeight:    44,
        minWidth:     44,
      }}
    >
      {label}
    </a>
  )
}

export function Badge({ block }: { ctx: RenderCtx; block: BadgeBlock }) {
  const colorMap: Record<string, string> = {
    primary: 'var(--c-primary)',
    success: 'var(--c-success)',
    error:   'var(--c-error)',
    warning: 'var(--c-warning)',
  }
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px',
      background: colorMap[block.settings.color] ?? 'var(--c-primary)',
      color: 'var(--c-on-accent)',
      fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
      textTransform: 'uppercase',
      borderRadius: 'var(--r)',
      fontFamily: 'var(--f-body)',
    }}>{block.settings.text}</span>
  )
}

/**
 * Countdown — server-side renderiza o target. Atualizacao em tempo real
 * fica pra cliente (B.3b vai virar Client Component).
 */
export function Countdown({ block }: { ctx: RenderCtx; block: CountdownBlock }) {
  const end = new Date(block.settings.endsAt)
  if (Number.isNaN(end.getTime())) return null
  const fmt = end.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ fontFamily: 'var(--f-body)', color: 'var(--c-text)' }}>
      {block.settings.label && <span style={{ color: 'var(--c-text-muted)' }}>{block.settings.label} </span>}
      <strong>{fmt}</strong>
    </div>
  )
}

export function Divider({ block }: { ctx: RenderCtx; block: DividerBlock }) {
  return <hr style={{ border: 0, borderTop: `1px ${block.settings.style} ${block.settings.color ?? 'var(--c-border)'}`, margin: '24px 0' }} />
}

export function Spacer({ block }: { ctx: RenderCtx; block: SpacerBlock }) {
  return <div style={{ height: block.settings.height }} />
}

export function Icon({ block }: { ctx: RenderCtx; block: IconBlock }) {
  // Stub: cria placeholder com nome do icone. B.3b vai integrar lucide-react.
  return <span style={{ fontSize: block.settings.size, color: block.settings.color ?? 'var(--c-text)' }}>◆</span>
}

export function ProductCardMini({ ctx, block }: { ctx: RenderCtx; block: ProductCardMiniBlock }) {
  const product = (ctx.products ?? []).find(p => p.id === block.settings.productId)
  if (!product) return null
  const img = product.photo_urls?.[0]
  return (
    <a href={`/loja/${ctx.slug}/produto/${product.id}`} style={{ display: 'block', textDecoration: 'none', color: 'var(--c-text)' }}>
      {img ? <img src={img} alt={product.name} loading="lazy" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }} /> : null}
      <div style={{ padding: '8px 0' }}>
        <div style={{ fontFamily: 'var(--f-body)', fontSize: 14 }}>{product.name}</div>
        {block.settings.showPrice && (
          <div style={{ marginTop: 4 }}>
            <PriceDisplay product={product} settings={ctx.paymentDisplay} cashback={ctx.cashback} variant="card" />
          </div>
        )}
      </div>
    </a>
  )
}

export function CollectionLink({ ctx, block }: { ctx: RenderCtx; block: CollectionLinkBlock }) {
  return (
    <a href={`/loja/${ctx.slug}/produtos?col=${block.settings.collectionId}`}
       style={{ display: 'block', textDecoration: 'none', color: 'var(--c-text)' }}>
      {block.settings.imageUrl && (
        <img src={block.settings.imageUrl} alt={block.settings.label} loading="lazy"
          style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover' }} />
      )}
      <div style={{ marginTop: 8, fontFamily: 'var(--f-body)', fontSize: 14 }}>{block.settings.label}</div>
    </a>
  )
}

export function SocialIcon({ block }: { ctx: RenderCtx; block: SocialIconBlock }) {
  const labels: Record<string, string> = {
    instagram: 'IG', facebook: 'FB', tiktok: 'TT', youtube: 'YT',
    twitter: 'X', whatsapp: 'WA', pinterest: 'PT',
  }
  return (
    <a href={block.settings.href} target="_blank" rel="noopener noreferrer"
       aria-label={block.settings.network}
       style={{
         display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
         width: 44, height: 44,
         borderRadius: 'var(--r)',
         background: 'var(--c-surface)', color: 'var(--c-text)',
         border: '1px solid var(--c-border)',
         fontSize: 12, fontWeight: 700, textDecoration: 'none',
       }}>
      {labels[block.settings.network] ?? '·'}
    </a>
  )
}

/** Slide — usado pelo Slider client component. Aqui so renderiza preview SSR. */
export function Slide({ block }: { ctx: RenderCtx; block: SlideBlock }) {
  const {
    imageUrl, headline, subheadline, ctaLabel, ctaHref, textColor, textAlign, overlayColor, overlayOpacity,
    titleColor, titleSizeRem, titleFontPair, subtitleColor, subtitleSizeRem, subtitleFontPair,
    buttonVariant, buttonColor, buttonTextColor, buttonSize, buttonFontPair,
  } = block.settings
  const baseColor = textColor ?? '#fff'
  const ov = (overlayColor && (overlayOpacity ?? 0) > 0)
    ? { color: overlayColor, opacity: Math.min(1, Math.max(0, overlayOpacity ?? 0)) }
    : null
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: 'var(--c-surface)' }}>
      {imageUrl && <img src={imageUrl} alt={headline ?? ''} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      {ov && <div aria-hidden style={{ position: 'absolute', inset: 0, background: ov.color, opacity: ov.opacity, pointerEvents: 'none' }} />}
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, color: baseColor, textAlign: textAlign ?? 'left' }}>
        {headline && (
          <h2 style={{ fontFamily: fieldFontFamily(titleFontPair, 'heading'), fontSize: `${clampRem(titleSizeRem, 2)}rem`, color: titleColor || baseColor, margin: 0 }}>{headline}</h2>
        )}
        {subheadline && (
          <p style={{ fontFamily: fieldFontFamily(subtitleFontPair, 'body'), fontSize: `${clampRem(subtitleSizeRem, 1)}rem`, color: subtitleColor || baseColor, marginTop: 8 }}>{subheadline}</p>
        )}
        {ctaLabel && (
          <a href={ctaHref || '#'}
            style={{
              ...ctaButtonStyle(buttonVariant, buttonColor, buttonTextColor, buttonSize),
              marginTop: 16,
              alignSelf: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start',
              fontFamily: buttonFontPair ? fieldFontFamily(buttonFontPair, 'heading') : 'inherit',
            }}>
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  )
}
