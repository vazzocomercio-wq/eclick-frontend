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
import { HeaderActions } from './HeaderActions'
import { AnnouncementBarClient } from './AnnouncementBarClient'
import { NewsletterSignup } from './NewsletterSignup'
import { WhatsAppIcon } from '@/components/storefront/WhatsAppIcon'

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
  // Logo fluido: mantém `h` no mobile e cresce ~1.5× no desktop (mesma ideia
  // do texto). Cap pela altura máxima do desktop (h*1.5).
  const hMax = Math.round(h * 1.5)
  const wMax = Math.round(w * 1.5)
  const logoH = `clamp(${h}px, calc(${Math.round(h * 0.85)}px + 1.4vw), ${hMax}px)`
  const logoW = `clamp(${w}px, calc(${Math.round(w * 0.85)}px + 6.3vw), ${wMax}px)`

  return (
    <header className="container mx-auto px-4 flex items-center justify-between"
      style={{ minHeight: `clamp(${Math.max(56, h + 16)}px, calc(${Math.max(56, h + 16)}px + 1.4vw), ${hMax + 16}px)`, fontFamily: 'var(--f-body)' }}>
      <a href={`/loja/${ctx.slug}`}
        style={{ color: 'var(--c-text)', fontWeight: 600, fontFamily: 'var(--f-heading)', display: 'inline-flex', alignItems: 'center' }}>
        {effectiveLogoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={effectiveLogoUrl} alt={fallbackText} style={{ maxHeight: logoH, maxWidth: logoW, objectFit: 'contain', display: 'block' }} />
          : fallbackText}
      </a>
      <nav className="hidden md:flex gap-6 text-sm" style={{ color: 'var(--c-text)' }}>
        {(nav ?? []).map((n, i) => <a key={i} href={n.href} style={{ color: 'inherit' }}>{n.label}</a>)}
      </nav>
      <HeaderActions
        nav={nav ?? []}
        slug={ctx.slug}
        // Defaults retrocompatíveis: setting ausente no jsonb = mostrar
        showSearch={section.settings.showSearch ?? true}
        showCart={section.settings.showCart ?? true}
        showAccount={section.settings.showAccount ?? true}
        storeName={ctx.store.store_name}
        whatsappNumber={ctx.store.whatsapp_number}
        paymentsEnabled={!!ctx.store.payments_enabled}
      />
    </header>
  )
}

export function SiteFooter({ ctx, section }: { ctx: RenderCtx; section: SiteFooterSection }) {
  const { copyright, columns, showNewsletter, showSocialIcons, showPaymentMethods } = section.settings
  const socialLinks = ctx.store.social_links ?? null
  const socialEntries = showSocialIcons && socialLinks
    ? Object.entries(socialLinks).filter(([, url]) => typeof url === 'string' && url.trim())
    : []
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

      {/* Newsletter do rodapé (destino do lead configurado no editor) */}
      {showNewsletter && (
        <div style={{ marginTop: 32, maxWidth: 480 }}>
          <h4 style={{ color: 'var(--c-text)', marginBottom: 12, fontFamily: 'var(--f-heading)' }}>Receba nossas novidades</h4>
          <NewsletterSignup
            slug={ctx.slug}
            sectionId={section.id}
            placeholder="seu@email.com"
            ctaLabel="Inscrever"
            successMessage="Inscrito! ✓"
            destination={{
              pipelineId: section.settings.pipelineId,
              stageId:    section.settings.stageId,
              assignedTo: section.settings.assignedTo,
            }}
          />
        </div>
      )}

      {/* Redes sociais (links vêm da store_config.social_links) */}
      {socialEntries.length > 0 && (
        <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {socialEntries.map(([network, url]) => (
            <FooterSocialIcon key={network} network={network} url={url} />
          ))}
        </div>
      )}

      {/* Meios de pagamento (linha estática, discreta) */}
      {showPaymentMethods && (
        <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {['Pix', 'Visa', 'Mastercard', 'Boleto'].map(pm => (
            <span key={pm} style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              color: 'var(--c-text-muted)',
              border: '1px solid var(--c-border)', borderRadius: 'var(--r)',
              background: 'var(--c-surface)',
            }}>
              {pm}
            </span>
          ))}
        </div>
      )}

      {copyright && <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--c-border)' }}>{copyright}</div>}
    </footer>
  )
}

/** Ícone de rede social do rodapé — SVG próprio pro WhatsApp, sigla pros
 *  demais (o lucide-react do projeto não tem ícones de marca — mesmo padrão
 *  do bloco SocialIcon em blocks/index.tsx). */
function FooterSocialIcon({ network, url }: { network: string; url: string }) {
  const key = network.trim().toLowerCase()
  const siglas: Record<string, string> = {
    instagram: 'IG', facebook: 'FB', tiktok: 'TT', youtube: 'YT',
    twitter: 'X', x: 'X', linkedin: 'IN', pinterest: 'PT',
  }
  const icons: Record<string, React.ReactNode> = {
    whatsapp: <WhatsAppIcon size={18} />,
  }
  const sigla = siglas[key] ?? key.slice(0, 2)
  const fallback = <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{sigla}</span>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={network}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 44, height: 44, borderRadius: 'var(--r)',
        background: 'var(--c-surface)', color: 'var(--c-text)',
        border: '1px solid var(--c-border)', textDecoration: 'none',
      }}>
      {icons[key] ?? fallback}
    </a>
  )
}

export function AnnouncementBar({ ctx, section }: { ctx: RenderCtx; section: AnnouncementBarSection }) {
  const { message, ctaLabel, ctaHref, countdownTo, dismissible } = section.settings
  // Interatividade (dismiss + countdown) vive no Client Component.
  // Defaults retrocompatíveis: dismissible ausente = false.
  return (
    <AnnouncementBarClient
      sectionId={section.id}
      slug={ctx.slug}
      message={message}
      ctaLabel={ctaLabel}
      ctaHref={ctaHref}
      countdownTo={countdownTo ?? null}
      dismissible={dismissible ?? false}
    />
  )
}

export function Breadcrumb({ ctx, section }: { ctx: RenderCtx; section: BreadcrumbSection }) {
  const showHome  = section.settings.showHome ?? true
  const separator = section.settings.separator ?? '/'

  // Trilha real por página: o ctx sabe a page atual + o produto carregado.
  const items: Array<{ label: string; href?: string }> = []
  if (showHome) items.push({ label: 'Início', href: `/loja/${ctx.slug}` })
  switch (ctx.page) {
    case 'product': {
      items.push({ label: 'Produtos', href: `/loja/${ctx.slug}/produtos` })
      const product = (ctx.products ?? [])[0]
      if (product) items.push({ label: product.name })
      break
    }
    case 'collection':
      items.push({ label: 'Produtos' })
      break
    case 'cart':
      items.push({ label: 'Carrinho' })
      break
    case 'checkout':
      items.push({ label: 'Finalizar compra' })
      break
    default:
      break // home: só "Início"
  }
  if (items.length === 0) return null

  return (
    <nav aria-label="Trilha de navegação" className="container mx-auto px-4 text-sm" style={{ color: 'var(--c-text-muted)' }}>
      {items.map((it, i) => {
        const last = i === items.length - 1
        return (
          <span key={i}>
            {i > 0 && <span style={{ margin: '0 8px' }}>{separator}</span>}
            {it.href && !last
              ? <a href={it.href} style={{ color: 'inherit' }}>{it.label}</a>
              : <span aria-current={last ? 'page' : undefined} style={{ color: last ? 'var(--c-text)' : 'inherit' }}>{it.label}</span>}
          </span>
        )
      })}
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
