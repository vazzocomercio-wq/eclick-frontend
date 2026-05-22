/**
 * Renderiza UMA section v3 — switch por type → componente concreto.
 *
 * Server Component. Componentes Client (Slider, ImageHotspot, etc.)
 * recebem ctx via prop.
 *
 * Sections ainda nao implementadas caem no placeholder visual com aviso
 * (Vazzo pode ate ver isso em dev, mas em prod a Fase B.3+ ja preenche).
 */

import type { Section } from '@/lib/storefront/v3/types'
import type { RenderCtx } from './RenderCtx'
import { sectionContainerStyle, backgroundOverlay, mobileOverrideCss } from './helpers'

// Imports dos componentes de section (preenchidos em B.3+).
// Cada arquivo exporta default uma funcao (ctx, section) => JSX.
// Stubs em sections/index.ts retornam null + comentario quando nao implementado.
import {
  SiteHeader, SiteFooter, AnnouncementBar, Breadcrumb,
  Hero, Slider, ImageBanner, ImageHotspot, ImageWithText, Marquee,
  ProductGrid, ProductCarousel, FeaturedProduct, CollectionGrid, ProductDetailLayout,
  RichText, Testimonials, LogoList, Faq, Newsletter, VideoBlock, CustomHtml,
  CartLayout, CheckoutLayout, WhatsappCatalog, LeadForm,
} from './sections'

export function SectionRenderer({ ctx, section }: { ctx: RenderCtx; section: Section }) {
  // Visibility: sempre renderiza no SSR, mas adiciona classe que esconde em mobile/desktop
  // via Tailwind (`max-md:hidden` ou `md:hidden`). Isso preserva SEO + UX.
  const visCls = section.visibility.mobile && section.visibility.desktop
    ? ''
    : !section.visibility.mobile
      ? 'max-md:hidden'
      : 'md:hidden'

  const overlay = backgroundOverlay(section.background)
  const mobileCss = mobileOverrideCss(section)

  // Discriminated dispatch — TS pega o tipo certo em cada branch.
  let inner: React.ReactNode = null
  switch (section.type) {
    case 'siteHeader':         inner = <SiteHeader ctx={ctx} section={section} />; break
    case 'siteFooter':         inner = <SiteFooter ctx={ctx} section={section} />; break
    case 'announcementBar':    inner = <AnnouncementBar ctx={ctx} section={section} />; break
    case 'breadcrumb':         inner = <Breadcrumb ctx={ctx} section={section} />; break
    case 'hero':               inner = <Hero ctx={ctx} section={section} />; break
    case 'slider':             inner = <Slider ctx={ctx} section={section} />; break
    case 'imageBanner':        inner = <ImageBanner ctx={ctx} section={section} />; break
    case 'imageHotspot':       inner = <ImageHotspot ctx={ctx} section={section} />; break
    case 'imageWithText':      inner = <ImageWithText ctx={ctx} section={section} />; break
    case 'marquee':            inner = <Marquee ctx={ctx} section={section} />; break
    case 'productGrid':        inner = <ProductGrid ctx={ctx} section={section} />; break
    case 'productCarousel':    inner = <ProductCarousel ctx={ctx} section={section} />; break
    case 'featuredProduct':    inner = <FeaturedProduct ctx={ctx} section={section} />; break
    case 'collectionGrid':     inner = <CollectionGrid ctx={ctx} section={section} />; break
    case 'productDetailLayout':inner = <ProductDetailLayout ctx={ctx} section={section} />; break
    case 'richText':           inner = <RichText ctx={ctx} section={section} />; break
    case 'testimonials':       inner = <Testimonials ctx={ctx} section={section} />; break
    case 'logoList':           inner = <LogoList ctx={ctx} section={section} />; break
    case 'faq':                inner = <Faq ctx={ctx} section={section} />; break
    case 'newsletter':         inner = <Newsletter ctx={ctx} section={section} />; break
    case 'videoBlock':         inner = <VideoBlock ctx={ctx} section={section} />; break
    case 'customHtml':         inner = <CustomHtml ctx={ctx} section={section} />; break
    case 'cartLayout':         inner = <CartLayout ctx={ctx} section={section} />; break
    case 'checkoutLayout':     inner = <CheckoutLayout ctx={ctx} section={section} />; break
    case 'whatsappCatalog':    inner = <WhatsappCatalog ctx={ctx} section={section} />; break
    case 'leadForm':           inner = <LeadForm ctx={ctx} section={section} />; break
  }

  return (
    <section
      data-section-id={section.id}
      data-section-type={section.type}
      className={visCls}
      style={sectionContainerStyle(section)}
    >
      {mobileCss && <style dangerouslySetInnerHTML={{ __html: mobileCss }} />}
      {overlay && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: overlay.color, opacity: overlay.opacity,
            pointerEvents: 'none',
          }}
        />
      )}
      <div style={{ position: 'relative' }}>{inner}</div>
    </section>
  )
}
