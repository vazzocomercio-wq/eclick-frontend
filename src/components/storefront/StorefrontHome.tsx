/**
 * Renderizador da home da Loja Propria.
 *
 * Le a receita de design (StorefrontDesign) e monta a pagina bloco a
 * bloco. Componente de servidor — sem estado, sem interatividade. Todos
 * os blocos sao mobile-first (testados em celular / tablet / desktop).
 */

import Link from 'next/link'
import type { StorefrontDesign, Section } from '@/lib/storefront/types'
import { alpha, googleFontsHref } from '@/lib/storefront/theme'
import { formatBRL, whatsappLink } from '@/lib/storefront/data'
import type { StorefrontStore, StorefrontProduct } from '@/lib/storefront/data'
import { buildCtx, type RenderCtx } from './renderCtx'
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

/* ---------------------------------------------------------------- Header */

function Header({ store, section, ctx }: {
  store: StorefrontStore
  section: Extract<Section, { type: 'header' }>
  ctx: RenderCtx
}) {
  const { colors } = ctx.theme
  const centered = section.variant !== 'minimal'
  return (
    <header
      className="px-4 sm:px-8 py-5 sm:py-6"
      style={{ borderBottom: `1px solid ${colors.border}` }}
    >
      <div
        className={`max-w-6xl mx-auto flex items-center gap-3 ${centered ? 'justify-center text-center' : ''}`}
      >
        {store.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.logo_url}
            alt={store.store_name}
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-contain shrink-0"
            style={{ background: '#fff', padding: 3 }}
          />
        )}
        <span
          className="text-lg sm:text-2xl font-bold truncate"
          style={{ color: colors.text, fontFamily: ctx.fontH }}
        >
          {store.store_name}
        </span>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ Hero */

function Hero({ section, ctx }: {
  section: Extract<Section, { type: 'hero' }>
  ctx: RenderCtx
}) {
  const { colors } = ctx.theme
  const isSplit = section.variant === 'split'
  const hasImage = section.variant === 'image' && !!section.imageUrl

  const text = (
    <div className={isSplit ? 'lg:w-1/2' : 'max-w-2xl mx-auto'}>
      <h1
        className="text-3xl sm:text-5xl font-bold leading-tight"
        style={{ color: hasImage ? '#fff' : colors.text, fontFamily: ctx.fontH }}
      >
        {section.headline}
      </h1>
      <p
        className="mt-3 sm:mt-4 text-base sm:text-lg"
        style={{ color: hasImage ? 'rgba(255,255,255,0.85)' : colors.textMuted }}
      >
        {section.subheadline}
      </p>
      <a
        href="#produtos"
        className="inline-block mt-6 px-6 py-3 text-sm sm:text-base font-semibold transition-transform hover:scale-[1.03]"
        style={{
          background: colors.primary,
          color: ctx.theme.mode === 'dark' ? '#0a0a0a' : '#fff',
          borderRadius: ctx.radius,
        }}
      >
        {section.ctaLabel}
      </a>
    </div>
  )

  const imageBlock = isSplit && section.imageUrl ? (
    <div className="lg:w-1/2 w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={section.imageUrl}
        alt=""
        className="w-full h-56 sm:h-80 object-cover"
        style={{ borderRadius: ctx.radius }}
      />
    </div>
  ) : null

  const background = hasImage
    ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${section.imageUrl}) center/cover`
    : `linear-gradient(135deg, ${colors.background} 0%, ${alpha(colors.primary, 0.14)} 100%)`

  return (
    <section
      className="px-4 sm:px-8"
      style={{ background, paddingTop: ctx.padY, paddingBottom: ctx.padY }}
    >
      <div
        className={`max-w-6xl mx-auto ${isSplit ? 'flex flex-col lg:flex-row items-center gap-8' : 'text-center'}`}
      >
        {text}
        {imageBlock}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ ProductCard */

function ProductCard({ product, slug, ctx, variant }: {
  product: StorefrontProduct
  slug: string
  ctx: RenderCtx
  variant: 'compact' | 'elevated' | 'editorial'
}) {
  const { colors } = ctx.theme
  const elevated = variant === 'elevated'
  const editorial = variant === 'editorial'
  return (
    <Link
      href={`/loja/${slug}/produto/${product.id}`}
      className="group block overflow-hidden transition-transform hover:scale-[1.02]"
      style={{
        background: elevated ? colors.surface : 'transparent',
        border: editorial ? 'none' : `1px solid ${colors.border}`,
        borderRadius: ctx.radius,
        boxShadow: elevated ? '0 6px 24px -14px rgba(0,0,0,0.5)' : 'none',
      }}
    >
      <div
        className={`${editorial ? 'aspect-[4/5]' : 'aspect-square'} overflow-hidden`}
        style={{ background: '#fff', borderRadius: editorial ? ctx.radius : 0 }}
      >
        {product.photo_urls?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.photo_urls[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
            sem foto
          </div>
        )}
      </div>
      <div className={variant === 'compact' ? 'p-2.5' : 'p-3 sm:p-4'}>
        <p
          className="text-xs sm:text-sm font-medium line-clamp-2"
          style={{ color: colors.text }}
        >
          {product.name}
        </p>
        <p
          className="mt-1.5 font-bold text-base sm:text-lg"
          style={{ color: colors.primary, fontFamily: ctx.fontH }}
        >
          {formatBRL(product.price)}
        </p>
      </div>
    </Link>
  )
}

/* ------------------------------------------------------------ ProductGrid */

const COLS_MOBILE: Record<number, string>  = { 1: 'grid-cols-1', 2: 'grid-cols-2' }
const COLS_TABLET: Record<number, string>  = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }
const COLS_DESKTOP: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4' }

function ProductGrid({ section, products, slug, ctx }: {
  section: Extract<Section, { type: 'productGrid' }>
  products: StorefrontProduct[]
  slug: string
  ctx: RenderCtx
}) {
  const { colors } = ctx.theme
  const gridClass = [
    COLS_MOBILE[section.columns.mobile]   ?? 'grid-cols-2',
    COLS_TABLET[section.columns.tablet]   ?? 'sm:grid-cols-3',
    COLS_DESKTOP[section.columns.desktop] ?? 'lg:grid-cols-4',
  ].join(' ')

  return (
    <section
      id="produtos"
      className="px-4 sm:px-8"
      style={{ paddingTop: ctx.padY, paddingBottom: ctx.padY }}
    >
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-xl sm:text-2xl font-bold mb-5 sm:mb-6"
          style={{ color: colors.text, fontFamily: ctx.fontH }}
        >
          {section.title}
        </h2>
        {products.length === 0 ? (
          <div
            className="py-16 text-center text-sm"
            style={{ color: colors.textMuted, border: `1px dashed ${colors.border}`, borderRadius: ctx.radius }}
          >
            Nenhum produto disponível no momento.
          </div>
        ) : (
          <div className={`grid ${gridClass}`} style={{ gap: ctx.gap }}>
            {products.map(p => (
              <ProductCard key={p.id} product={p} slug={slug} ctx={ctx} variant={section.variant} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- About */

function About({ section, ctx }: {
  section: Extract<Section, { type: 'about' }>
  ctx: RenderCtx
}) {
  const { colors } = ctx.theme
  const banner = section.variant === 'banner'
  return (
    <section className="px-4 sm:px-8" style={{ paddingTop: ctx.padY / 2, paddingBottom: ctx.padY / 2 }}>
      <div
        className={`max-w-6xl mx-auto ${banner ? 'p-6 sm:p-10' : 'max-w-2xl text-center'}`}
        style={banner ? {
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: ctx.radius,
        } : undefined}
      >
        <h2
          className="text-xl sm:text-2xl font-bold"
          style={{ color: colors.text, fontFamily: ctx.fontH }}
        >
          {section.title}
        </h2>
        <p className="mt-3 text-sm sm:text-base leading-relaxed" style={{ color: colors.textMuted }}>
          {section.body}
        </p>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- Footer */

function Footer({ store, section, ctx }: {
  store: StorefrontStore
  section: Extract<Section, { type: 'footer' }>
  ctx: RenderCtx
}) {
  const { colors } = ctx.theme
  const full = section.variant === 'full'
  const socials = store.social_links ? Object.entries(store.social_links).filter(([, v]) => !!v) : []
  return (
    <footer
      className="px-4 sm:px-8 py-8 sm:py-10 mt-6"
      style={{ borderTop: `1px solid ${colors.border}`, background: colors.surface }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-center sm:text-left">
        <div>
          <p className="font-bold" style={{ color: colors.text, fontFamily: ctx.fontH }}>
            {store.store_name}
          </p>
          {full && store.store_description && (
            <p className="mt-1 text-xs sm:text-sm max-w-md" style={{ color: colors.textMuted }}>
              {store.store_description}
            </p>
          )}
          {full && socials.length > 0 && (
            <div className="mt-2 flex gap-3 justify-center sm:justify-start flex-wrap">
              {socials.map(([name, url]) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs capitalize hover:underline"
                  style={{ color: colors.primary }}
                >
                  {name}
                </a>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs" style={{ color: colors.textMuted }}>
          Powered by <span style={{ color: colors.primary }}>e-Click</span>
        </p>
      </div>
    </footer>
  )
}

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
  /** Quando true (preview no dashboard): sem altura de viewport e sem botao fixo. */
  embedded?: boolean
}) {
  const ctx = buildCtx(design.theme, embedded)
  const { colors } = design.theme

  // Primeira secao de produtos recebe o ancora #produtos (alvo dos CTAs).
  const firstProductIdx = design.sections.findIndex(
    s => s.type === 'productGrid' || s.type === 'productShowcase',
  )

  return (
    <div style={{ background: colors.background, color: colors.text, fontFamily: ctx.fontB, minHeight: embedded ? undefined : '100vh' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(design.theme)} />
      {design.sections.map((section, i) => {
        switch (section.type) {
          // ── v1 ────────────────────────────────────────────────────
          case 'header':
            return <Header key={i} store={store} section={section} ctx={ctx} />
          case 'hero':
            return <Hero key={i} section={section} ctx={ctx} />
          case 'productGrid':
            return <ProductGrid key={i} section={section} products={products} slug={slug} ctx={ctx} />
          case 'about':
            return <About key={i} section={section} ctx={ctx} />
          case 'footer':
            return <Footer key={i} store={store} section={section} ctx={ctx} />
          case 'collections':
            // Requer endpoint publico de listagem de colecoes (fase futura).
            return null
          // ── v2 premium ────────────────────────────────────────────
          case 'announcementBar':
            return <AnnouncementBar key={i} section={section} ctx={ctx} />
          case 'siteHeader':
            return <SiteHeader key={i} store={store} section={section} ctx={ctx} />
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
      })}
      {!embedded && <WhatsAppButton store={store} />}
    </div>
  )
}
