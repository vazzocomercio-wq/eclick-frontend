/**
 * Renderizador da home da Loja Própria (Tema Premium).
 *
 * Lê a receita de design (StorefrontDesign) e monta a página seção a
 * seção. As seções premium ficam em ./premium/. Todas são mobile-first.
 */

import type { ReactNode } from 'react'
import type { StorefrontDesign, Section } from '@/lib/storefront/types'
import { googleFontsHref, effects } from '@/lib/storefront/theme'
import { whatsappLink } from '@/lib/storefront/data'
import type { StorefrontStore, StorefrontProduct } from '@/lib/storefront/data'
import { buildCtx } from './renderCtx'
import { AnnouncementBar } from './premium/AnnouncementBar'
import { SiteHeader } from './premium/SiteHeader'
import { HeroPortrait } from './premium/HeroPortrait'
import { ProductShowcase } from './premium/ProductShowcase'
import { Marquee } from './premium/Marquee'
import { CategoryGrid } from './premium/CategoryGrid'
import { EditorialSplit } from './premium/EditorialSplit'
import { TiltBanner } from './premium/TiltBanner'
import { FullBanner } from './premium/FullBanner'
import { ImageHotspot } from './premium/ImageHotspot'
import { SiteFooter } from './premium/SiteFooter'
import { Reveal } from './premium/Reveal'
import { WhatsAppFloater } from './premium/WhatsAppFloater'

/* -------------------------------------------------------- WhatsApp button */

export function WhatsAppButton({ store, message }: { store: StorefrontStore; message?: string }) {
  if (!store.whatsapp_widget_enabled || !store.whatsapp_number) return null
  return (
    <a
      href={whatsappLink(store.whatsapp_number, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-50 rounded-full p-3.5 sm:p-4 shadow-2xl transition-transform hover:scale-105"
      style={{ background: '#25D366', color: '#fff' }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  )
}

/* -------------------------------------------------------------- composer */

export function StorefrontHome({ design, store, products, slug, embedded = false }: {
  design: StorefrontDesign
  store: StorefrontStore
  products: StorefrontProduct[]
  slug: string
  /** Quando true (preview no dashboard): sem altura de viewport e sem botão fixo. */
  embedded?: boolean
}) {
  const ctx = buildCtx(design.theme, embedded)
  const { colors } = design.theme

  // Primeira vitrine de produtos recebe o âncora #produtos (alvo dos CTAs).
  const firstProductIdx = design.sections.findIndex(s => s.type === 'productShowcase')

  // Efeito de revelar seções no scroll (desligado no preview embutido).
  const reveal = effects(design.theme).scrollReveal && !embedded

  const renderSection = (section: Section, i: number): ReactNode => {
    switch (section.type) {
      case 'announcementBar':
        return <AnnouncementBar key={i} section={section} ctx={ctx} />
      case 'siteHeader':
        return <SiteHeader key={i} store={store} section={section} ctx={ctx} slug={slug} />
      case 'heroPortrait':
        return <HeroPortrait key={i} section={section} ctx={ctx} />
      case 'productShowcase':
        return (
          <ProductShowcase
            key={i} section={section} products={products} slug={slug} ctx={ctx}
            anchorId={i === firstProductIdx ? 'produtos' : undefined}
          />
        )
      case 'marquee':
        return <Marquee key={i} section={section} ctx={ctx} />
      case 'categoryGrid':
        return <CategoryGrid key={i} section={section} ctx={ctx} />
      case 'editorialSplit':
        return <EditorialSplit key={i} section={section} ctx={ctx} />
      case 'tiltBanner':
        return <TiltBanner key={i} section={section} ctx={ctx} />
      case 'fullBanner':
        return <FullBanner key={i} section={section} ctx={ctx} />
      case 'imageHotspot':
        return <ImageHotspot key={i} section={section} slug={slug} ctx={ctx} />
      case 'siteFooter':
        return <SiteFooter key={i} store={store} section={section} ctx={ctx} />
      default:
        return null
    }
  }

  return (
    <div style={{ background: colors.background, color: colors.text, fontFamily: ctx.fontB, minHeight: embedded ? undefined : '100vh' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(design.theme)} />
      {design.sections.map((section, i) => {
        const node = renderSection(section, i)
        if (!node) return null
        const chrome = section.type === 'siteHeader' || section.type === 'announcementBar'
        return reveal && !chrome ? <Reveal key={i}>{node}</Reveal> : node
      })}
      {!embedded && <WhatsAppFloater store={store} />}
    </div>
  )
}
