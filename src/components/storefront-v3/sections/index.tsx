/**
 * Re-exports + implementacoes inline das sections "navegacao basica" (Header,
 * Footer, AnnouncementBar, Breadcrumb, WhatsappCatalog).
 *
 * As demais sections vivem em arquivos dedicados (./Hero, ./ProductGrid, etc.).
 * O switch em SectionRenderer.tsx importa todos os nomes daqui.
 */

import type { RenderCtx } from '../RenderCtx'
import type {
  SiteHeaderSection, SiteFooterSection, AnnouncementBarSection, BreadcrumbSection,
  WhatsappCatalogSection,
} from '@/lib/storefront/v3/types'

// ── Navegação básica (inline aqui) ──

export function SiteHeader({ ctx, section }: { ctx: RenderCtx; section: SiteHeaderSection }) {
  const { logoText, logoUrl, logoMaxHeight, nav } = section.settings
  // Fallback: se logoUrl do header v3 vazio, usa logo_url da store_config
  // (campo principal de identidade da loja). Permite subir 1 vez e refletir.
  const effectiveLogoUrl = logoUrl?.trim() || ctx.store.logo_url || null
  const fallbackText     = logoText ?? ctx.store.store_name
  // Clamp tamanho: 24-120px (proteção contra valores fora do range no jsonb).
  const h = Math.max(24, Math.min(120, logoMaxHeight ?? 40))
  // Largura max proporcional (~4.5x a altura — proporção comum de logos).
  const w = Math.round(h * 4.5)

  return (
    <header className="container mx-auto px-4 flex items-center justify-between"
      style={{ minHeight: Math.max(56, h + 16), fontFamily: 'var(--f-body)' }}>
      <a href={`/loja/${ctx.slug}`}
        style={{ color: 'var(--c-text)', fontWeight: 600, fontFamily: 'var(--f-heading)', display: 'inline-flex', alignItems: 'center' }}>
        {effectiveLogoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={effectiveLogoUrl} alt={fallbackText} style={{ maxHeight: h, maxWidth: w, objectFit: 'contain', display: 'block' }} />
          : fallbackText}
      </a>
      <nav className="hidden md:flex gap-6 text-sm" style={{ color: 'var(--c-text)' }}>
        {(nav ?? []).map((n, i) => <a key={i} href={n.href} style={{ color: 'inherit' }}>{n.label}</a>)}
      </nav>
      <button className="md:hidden" aria-label="Menu" style={{ color: 'var(--c-text)', minHeight: 44, minWidth: 44, background: 'transparent', border: 0 }}>☰</button>
    </header>
  )
}

export function SiteFooter({ ctx: _ctx, section }: { ctx: RenderCtx; section: SiteFooterSection }) {
  void _ctx
  const { copyright, columns } = section.settings
  return (
    <footer className="container mx-auto px-4" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--f-body)', fontSize: 14 }}>
      <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {(columns ?? []).map((c, i) => (
          <div key={i}>
            <h4 style={{ color: 'var(--c-text)', marginBottom: 12, fontFamily: 'var(--f-heading)' }}>{c.title}</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {c.links.map((l, j) => <li key={j} style={{ marginBottom: 6 }}><a href={l.href} style={{ color: 'inherit' }}>{l.label}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      {copyright && <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--c-border)' }}>{copyright}</div>}
    </footer>
  )
}

export function AnnouncementBar({ ctx: _ctx, section }: { ctx: RenderCtx; section: AnnouncementBarSection }) {
  void _ctx
  const { message, ctaLabel, ctaHref } = section.settings
  return (
    <div className="container mx-auto px-4 text-center text-sm" style={{ color: 'var(--c-on-accent)' }}>
      {message}
      {ctaLabel && ctaHref && <a href={ctaHref} className="ml-3 underline" style={{ color: 'inherit' }}>{ctaLabel}</a>}
    </div>
  )
}

export function Breadcrumb({ ctx, section: _section }: { ctx: RenderCtx; section: BreadcrumbSection }) {
  void _section
  return (
    <nav className="container mx-auto px-4 text-sm" style={{ color: 'var(--c-text-muted)' }}>
      <a href={`/loja/${ctx.slug}`} style={{ color: 'inherit' }}>Início</a>
      <span style={{ margin: '0 8px' }}>/</span>
      <span>Página</span>
    </nav>
  )
}

export function WhatsappCatalog({ ctx, section }: { ctx: RenderCtx; section: WhatsappCatalogSection }) {
  if (!section.settings.enabled || !ctx.store.whatsapp_catalog?.enabled) return null
  const link = ctx.store.whatsapp_catalog.link
  if (!link) return null
  return (
    <div className="container mx-auto px-4 text-center">
      <a href={link} target="_blank" rel="noopener noreferrer"
        className="inline-block px-6 py-3 text-sm font-medium"
        style={{ background: 'var(--c-primary)', color: 'var(--c-on-accent)', borderRadius: 'var(--r)', minHeight: 44 }}>
        {section.settings.label || 'Ver catálogo no WhatsApp'}
      </a>
    </div>
  )
}

// ── Hero/Banners ──
export { HeroSectionView as Hero } from './Hero'
export { SliderSectionView as Slider } from './Slider'
export { ImageHotspotSectionView as ImageHotspot } from './ImageHotspot'
export { ImageBanner, ImageWithText, Marquee } from './standard'
export { LeadForm } from './LeadForm'
export { RoomVisualizerPromo as RoomVisualizer } from './RoomVisualizerPromo'

// ── Produto/Coleção ──
export { ProductGridSectionView as ProductGrid } from './ProductGrid'
export { ProductCarouselSectionView as ProductCarousel } from './ProductCarousel'
export { CollectionGridSectionView as CollectionGrid } from './CollectionGrid'
export { ProductDetailLayoutSectionView as ProductDetailLayout } from './ProductDetailLayout'
export { ProductKitsSectionView as ProductKits } from './ProductKits'
export { FeaturedProduct } from './standard'

// ── Conteúdo ──
export { RichText, Testimonials, LogoList, Faq, Newsletter, VideoBlock } from './standard'
export { CustomHtmlSectionView as CustomHtml } from './CustomHtml'

// ── Comércio ──
export { CartLayoutSectionView as CartLayout } from './CartLayout'
export { CheckoutLayoutSectionView as CheckoutLayout } from './CheckoutLayout'
