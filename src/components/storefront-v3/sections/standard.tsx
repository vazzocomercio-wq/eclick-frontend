/**
 * Standard sections v3 — 10 sections simples/conteudo em um arquivo unico
 * (cada uma 30-60 linhas, nao justifica arquivo dedicado por enquanto).
 *
 * Server Components. Mobile-first.
 */

import type {
  ImageBannerSection, ImageWithTextSection, MarqueeSection,
  RichTextSection, TestimonialsSection, LogoListSection,
  FaqSection, NewsletterSection, VideoBlockSection, FeaturedProductSection,
} from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'
import { PriceDisplay } from '../PriceDisplay'
import { getFontPairDef } from '@/lib/storefront/v3/font-pairs'

const HEIGHT_BANNER_PRESET: Record<Exclude<ImageBannerSection['settings']['height'], 'custom'>, string> = {
  sm:         '280px',
  md:         '400px',
  lg:         '560px',
  fullscreen: '100svh',
}

function clampRem(v: number | undefined, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return fallback
  return Math.max(0.6, Math.min(8, v))
}

/** Converte #rrggbb → rgba(...,a). Fallback se não for hex 6 dígitos. */
function hexToRgba(hex: string | undefined, a: number, fallback: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? '').trim())
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Estilo do botão do banner por variante/cor/tamanho. */
function bannerButtonStyle(
  variant: ImageBannerSection['settings']['buttonVariant'],
  color?: string,
  textColor?: string,
  size?: ImageBannerSection['settings']['buttonSize'],
): React.CSSProperties {
  const pad = size === 'sm' ? '8px 16px' : size === 'lg' ? '16px 34px' : '12px 26px'
  const fs  = size === 'sm' ? 14 : size === 'lg' ? 18 : 16
  const base: React.CSSProperties = {
    padding: pad, fontSize: fs, fontWeight: 600, minHeight: 44,
    borderRadius: 'var(--r)', cursor: 'pointer', whiteSpace: 'nowrap',
  }
  const c = color || 'var(--c-primary)'
  if (variant === 'outline') {
    return { ...base, background: 'transparent', color: color || '#fff', border: `2px solid ${color || '#fff'}` }
  }
  if (variant === 'soft') {
    return { ...base, background: hexToRgba(color, 0.18, 'rgba(255,255,255,0.18)'), color: color || '#fff', border: 'none', backdropFilter: 'blur(2px)' }
  }
  // solid (default)
  return { ...base, background: c, color: textColor || 'var(--c-on-accent)', border: 'none' }
}

export function ImageBanner({ section }: { ctx: RenderCtx; section: ImageBannerSection }) {
  const {
    imageUrl, headline, subheadline, ctaLabel, ctaHref, textPosition, height, customHeight, overlayColor, overlayOpacity,
    titleColor, titleSizeRem, titleFontPair, subtitleColor, subtitleSizeRem, subtitleFontPair,
    buttonVariant, buttonColor, buttonTextColor, buttonSize, buttonAlign, buttonFontPair,
  } = section.settings
  const minH = height === 'custom'
    ? `${Math.max(80, Math.min(1200, customHeight ?? 400))}px`
    : HEIGHT_BANNER_PRESET[height]
  const pos = textPosition.split('-') as [string, string]
  const align = pos[0]
  const just  = pos[1]
  // Cor do texto: override de tipografia da seção, com branco como padrão
  // (banners costumam ter texto claro sobre a imagem).
  const textColor = section.typography?.textColor ?? '#fff'
  const ov = (overlayColor && (overlayOpacity ?? 0) > 0)
    ? { color: overlayColor, opacity: Math.min(1, Math.max(0, overlayOpacity ?? 0)) }
    : null
  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: minH }}>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={headline ?? ''} loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {ov && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: ov.color, opacity: ov.opacity, pointerEvents: 'none' }} />
      )}
      <div
        className="container mx-auto px-4 relative h-full flex flex-col"
        style={{
          minHeight: minH,
          justifyContent: align === 'top' ? 'flex-start' : align === 'bottom' ? 'flex-end' : 'center',
          alignItems:     just  === 'left' ? 'flex-start' : just  === 'right'  ? 'flex-end' : 'center',
          textAlign:      just === 'center' ? 'center' : just === 'right' ? 'right' : 'left',
          color: textColor,
          padding: '40px 16px',
        }}
      >
        {headline && (
          <h2 style={{
            fontFamily: titleFontPair ? getFontPairDef(titleFontPair).heading : 'var(--f-heading)',
            fontSize:   `${clampRem(titleSizeRem, 2.25)}rem`,
            color:      titleColor || textColor,
            lineHeight: 1.15, margin: 0,
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}>{headline}</h2>
        )}
        {subheadline && (
          <p style={{
            fontFamily: subtitleFontPair ? getFontPairDef(subtitleFontPair).body : 'var(--f-body)',
            fontSize:   `${clampRem(subtitleSizeRem, 1.1)}rem`,
            color:      subtitleColor || textColor,
            marginTop: 12, maxWidth: 560, textShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}>{subheadline}</p>
        )}
        {ctaLabel && (
          <a href={ctaHref || '#'}
            style={{
              ...bannerButtonStyle(buttonVariant, buttonColor, buttonTextColor, buttonSize),
              marginTop: 20, textDecoration: 'none', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              fontFamily: buttonFontPair ? getFontPairDef(buttonFontPair).heading : 'inherit',
              alignSelf: buttonAlign === 'center' ? 'center' : buttonAlign === 'right' ? 'flex-end' : buttonAlign === 'left' ? 'flex-start' : undefined,
            }}>
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  )
}

export function ImageWithText({ section }: { ctx: RenderCtx; section: ImageWithTextSection }) {
  const { imageUrl, imageSide, title, body, ctaLabel, ctaHref } = section.settings
  // Mobile: SEMPRE empilhado (imagem em cima, texto embaixo). Desktop: lado a lado.
  const reverseClass = imageSide === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'
  return (
    <div className="container mx-auto px-4">
      <div className={`flex flex-col gap-8 md:gap-12 ${reverseClass}`}>
        <div className="md:flex-1">
          {imageUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={imageUrl} alt={title} loading="lazy" style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: 'var(--r)' }} />
            : <div style={{ width: '100%', aspectRatio: '4/5', background: 'var(--c-surface)', borderRadius: 'var(--r)' }} />}
        </div>
        <div className="md:flex-1 flex flex-col justify-center">
          <h2 style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '2rem' }}>{title}</h2>
          <p style={{ marginTop: 16, color: 'var(--c-text-muted)', lineHeight: 1.6 }}>{body}</p>
          {ctaLabel && ctaHref && (
            <a href={ctaHref}
              style={{ marginTop: 24, padding: '12px 24px', background: 'var(--c-primary)', color: 'var(--c-on-accent)', borderRadius: 'var(--r)', textDecoration: 'none', alignSelf: 'flex-start', minHeight: 44, display: 'inline-block', fontWeight: 500 }}>
              {ctaLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export function Marquee({ section }: { ctx: RenderCtx; section: MarqueeSection }) {
  const { items, speed, direction } = section.settings
  if (items.length === 0) return null
  const duration = speed === 'slow' ? '40s' : speed === 'fast' ? '15s' : '25s'
  // CSS animation puro — sem JS. Mobile-friendly.
  const animName = direction === 'right' ? 'mq-right' : 'mq-left'
  const rendered = [...items, ...items] // duplica pra loop infinito visual
  return (
    <div style={{ overflow: 'hidden', color: 'var(--c-on-accent)' }}>
      <style>{`
        @keyframes mq-left  { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes mq-right { from { transform: translateX(-50%) } to { transform: translateX(0) } }
      `}</style>
      <div style={{
        display: 'inline-flex', gap: 48,
        animation: `${animName} ${duration} linear infinite`,
        whiteSpace: 'nowrap',
        paddingLeft: 24,
      }}>
        {rendered.map((it, i) => (
          <span key={i} style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}

const MAXW: Record<RichTextSection['settings']['maxWidth'], string> = {
  sm:   '560px',
  md:   '720px',
  lg:   '960px',
  full: '100%',
}

export function RichText({ section }: { ctx: RenderCtx; section: RichTextSection }) {
  const { content, maxWidth, align } = section.settings
  // Markdown leve: quebras de linha viram <p>. Sem HTML embed.
  const paragraphs = content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  return (
    <div className="container mx-auto px-4">
      <div style={{ maxWidth: MAXW[maxWidth], margin: '0 auto', textAlign: align, color: 'var(--c-text)', lineHeight: 1.7 }}>
        {paragraphs.map((p, i) => <p key={i} style={{ marginBottom: 16 }}>{p}</p>)}
      </div>
    </div>
  )
}

export function Testimonials({ section }: { ctx: RenderCtx; section: TestimonialsSection }) {
  const { title, layout, items } = section.settings
  if (items.length === 0) return null

  return (
    <div className="container mx-auto px-4">
      {title && <h2 className="mb-8 text-center" style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '2rem' }}>{title}</h2>}
      {layout === 'carousel' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x" style={{ scrollbarWidth: 'thin' }}>
          {items.map(t => <TestimonialCard key={t.id} t={t} compact />)}
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {items.map(t => <TestimonialCard key={t.id} t={t} />)}
        </div>
      )}
    </div>
  )
}

function TestimonialCard({ t, compact }: { t: TestimonialsSection['settings']['items'][number]; compact?: boolean }) {
  return (
    <div className={compact ? 'snap-start shrink-0' : ''} style={{
      flex: compact ? '0 0 80vw' : undefined,
      maxWidth: compact ? 320 : undefined,
      padding: 24, background: 'var(--c-surface)',
      border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
    }}>
      {t.rating && (
        <div style={{ color: 'var(--c-primary)', marginBottom: 8 }}>
          {'★'.repeat(t.rating)}<span style={{ opacity: 0.3 }}>{'★'.repeat(5 - t.rating)}</span>
        </div>
      )}
      <p style={{ fontStyle: 'italic', lineHeight: 1.6, color: 'var(--c-text)' }}>"{t.text}"</p>
      <div style={{ marginTop: 16, fontWeight: 600, color: 'var(--c-text)' }}>— {t.name}</div>
    </div>
  )
}

export function LogoList({ section }: { ctx: RenderCtx; section: LogoListSection }) {
  const { title, logos, grayscale } = section.settings
  if (logos.length === 0) return null
  return (
    <div className="container mx-auto px-4">
      {title && <h2 className="mb-6 text-center" style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text-muted)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</h2>}
      <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
        {logos.map(l => {
          // eslint-disable-next-line @next/next/no-img-element
          const img = <img src={l.imageUrl} alt={l.alt} loading="lazy" style={{ maxHeight: 40, maxWidth: 120, filter: grayscale ? 'grayscale(1)' : undefined, opacity: grayscale ? 0.6 : 1 }} />
          return l.href ? <a key={l.id} href={l.href}>{img}</a> : <span key={l.id}>{img}</span>
        })}
      </div>
    </div>
  )
}

export function Faq({ section }: { ctx: RenderCtx; section: FaqSection }) {
  const { title, items } = section.settings
  if (items.length === 0) return null
  return (
    <div className="container mx-auto px-4">
      {title && <h2 className="mb-8 text-center" style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '2rem' }}>{title}</h2>}
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {items.map(it => (
          <details key={it.id} style={{ borderBottom: '1px solid var(--c-border)', padding: '16px 0' }}>
            <summary style={{ fontFamily: 'var(--f-body)', fontWeight: 600, color: 'var(--c-text)', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
              {it.question}
            </summary>
            <p style={{ marginTop: 12, color: 'var(--c-text-muted)', lineHeight: 1.6 }}>{it.answer}</p>
          </details>
        ))}
      </div>
    </div>
  )
}

export function Newsletter({ section }: { ctx: RenderCtx; section: NewsletterSection }) {
  const { title, description, ctaLabel, placeholder } = section.settings
  return (
    <div className="container mx-auto px-4 text-center" style={{ maxWidth: 560 }}>
      {title && <h2 style={{ fontFamily: 'var(--f-heading)', fontSize: '1.75rem', color: 'var(--c-text)' }}>{title}</h2>}
      {description && <p style={{ marginTop: 8, color: 'var(--c-text-muted)' }}>{description}</p>}
      {/* TODO B.4+: submeter pra endpoint /storefront/newsletter via Client component */}
      <form className="mt-6 flex flex-col sm:flex-row gap-3" action="#" method="post">
        <input
          type="email" required placeholder={placeholder} aria-label="Email"
          inputMode="email"
          style={{
            flex: 1, padding: '12px 16px', minHeight: 44,
            border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
            background: 'var(--c-surface)', color: 'var(--c-text)',
          }}
        />
        <button type="submit"
          style={{
            padding: '12px 24px', minHeight: 44,
            background: 'var(--c-primary)', color: 'var(--c-on-accent)',
            borderRadius: 'var(--r)', border: 'none', fontWeight: 500, cursor: 'pointer',
          }}>
          {ctaLabel}
        </button>
      </form>
    </div>
  )
}

const VIDEO_ASPECT: Record<VideoBlockSection['settings']['aspectRatio'], string> = {
  '16:9': '16 / 9', '4:3': '4 / 3', '1:1': '1 / 1', '9:16': '9 / 16',
}

export function VideoBlock({ section }: { ctx: RenderCtx; section: VideoBlockSection }) {
  const { url, autoplay, loop, muted, poster, aspectRatio } = section.settings
  if (!url) return null
  const isYouTube = /youtu\.?be/.test(url)
  return (
    <div className="container mx-auto px-4">
      <div style={{ aspectRatio: VIDEO_ASPECT[aspectRatio], maxWidth: 960, margin: '0 auto', borderRadius: 'var(--r)', overflow: 'hidden', background: 'var(--c-surface)' }}>
        {isYouTube
          ? <iframe src={url} title="Video" loading="lazy" allowFullScreen style={{ width: '100%', height: '100%', border: 0 }} />
          : <video src={url} poster={poster} autoPlay={autoplay} loop={loop} muted={muted} playsInline controls={!autoplay} preload="metadata" style={{ width: '100%', height: '100%', display: 'block' }} />}
      </div>
    </div>
  )
}

export function FeaturedProduct({ ctx, section }: { ctx: RenderCtx; section: FeaturedProductSection }) {
  const { productId, galleryPosition, showDescription, showAttributes, ctaLabel } = section.settings
  void showAttributes // mostrar/esconder atributos vira no ProductDetailLayout, aqui simples
  const product = (ctx.products ?? []).find(p => p.id === productId)
  if (!product) {
    return (
      <div className="container mx-auto px-4 text-center" style={{ color: 'var(--c-text-muted)' }}>
        Produto em destaque indisponível.
      </div>
    )
  }
  const img = product.photo_urls?.[0]
  const reverseClass = galleryPosition === 'right' ? 'md:flex-row-reverse' : galleryPosition === 'top' ? 'flex-col' : 'md:flex-row'
  return (
    <div className="container mx-auto px-4">
      <div className={`flex flex-col gap-8 ${reverseClass}`}>
        <div className="md:flex-1">
          {img
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={img} alt={product.name} loading="lazy" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 'var(--r)' }} />
            : <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--c-surface)', borderRadius: 'var(--r)' }} />}
        </div>
        <div className="md:flex-1 flex flex-col justify-center">
          <h2 style={{ fontFamily: 'var(--f-heading)', color: 'var(--c-text)', fontSize: '2.25rem' }}>{product.name}</h2>
          {showDescription && product.ai_short_description && (
            <p style={{ marginTop: 12, color: 'var(--c-text-muted)', lineHeight: 1.6 }}>{product.ai_short_description}</p>
          )}
          <div style={{ marginTop: 20 }}>
            <PriceDisplay product={product} settings={ctx.paymentDisplay} cashback={ctx.cashback} variant="detail" inlineBadge />
          </div>
          <a href={`/loja/${ctx.slug}/produto/${product.id}`}
            style={{ marginTop: 24, padding: '14px 28px', background: 'var(--c-primary)', color: 'var(--c-on-accent)', borderRadius: 'var(--r)', textDecoration: 'none', alignSelf: 'flex-start', minHeight: 44, display: 'inline-block', fontWeight: 500 }}>
            {ctaLabel ?? 'Ver produto'}
          </a>
        </div>
      </div>
    </div>
  )
}
