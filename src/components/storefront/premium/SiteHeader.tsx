/**
 * Cabecalho rico (v2) — logo, navegacao, icones de busca/carrinho.
 * Sticky opcional; navegacao colapsa em menu hamburguer no mobile.
 *
 * Busca segue visual nesta fase. Carrinho ja e funcional: CartButton e
 * client component com badge + drawer, consome useCart (localStorage).
 */

import type { Section } from '@/lib/storefront/types'
import type { StorefrontStore } from '@/lib/storefront/data'
import type { RenderCtx } from '../renderCtx'
import { MobileNav } from './MobileNav'
import { CartButton } from './CartButton'

function SearchIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  )
}

export function SiteHeader({ store, section, ctx, slug }: {
  store: StorefrontStore
  section: Extract<Section, { type: 'siteHeader' }>
  ctx: RenderCtx
  /** Slug da loja — necessario pro CartButton (carrinho por loja). */
  slug?: string
}) {
  const { colors } = ctx.theme
  const sticky = section.sticky && !ctx.embedded
  const centered = section.variant === 'centered'

  const brand = (
    <div className="flex items-center gap-2.5 shrink-0">
      {store.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={store.logo_url}
          alt={store.store_name}
          className="h-9 w-9 sm:h-10 sm:w-10 rounded-md object-contain"
          style={{ background: '#fff', padding: 3 }}
        />
      )}
      <span
        className="text-base sm:text-xl font-bold truncate tracking-tight"
        style={{ color: colors.text, fontFamily: ctx.fontH }}
      >
        {store.store_name}
      </span>
    </div>
  )

  const navLinks = (extra: string) => (
    <nav className={`items-center gap-6 ${extra}`}>
      {section.nav.map(n => (
        <a
          key={`${n.href}-${n.label}`}
          href={n.href}
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: colors.text }}
        >
          {n.label}
        </a>
      ))}
    </nav>
  )

  const icons = (
    <div className="flex items-center gap-3 sm:gap-4">
      {section.showSearch && <span aria-hidden><SearchIcon color={colors.text} /></span>}
      {section.showCart && slug && <CartButton store={store} slug={slug} ctx={ctx} />}
      <MobileNav nav={section.nav} color={colors.text} surface={colors.background} border={colors.border} />
    </div>
  )

  return (
    <header
      className={sticky ? 'sticky top-0 z-30' : ''}
      style={{
        background: colors.background,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div className="relative max-w-6xl mx-auto px-4 sm:px-8">
        {centered ? (
          <div className="py-3 sm:py-4">
            <div className="flex items-center justify-between md:justify-center">
              {brand}
              <div className="md:absolute md:right-4 md:top-1/2 md:-translate-y-1/2">
                {icons}
              </div>
            </div>
            {section.nav.length > 0 && navLinks('hidden md:flex justify-center mt-3')}
          </div>
        ) : (
          <div className="flex items-center gap-4 h-16">
            {brand}
            {navLinks('hidden md:flex flex-1 justify-center')}
            <div className="ml-auto md:ml-0">{icons}</div>
          </div>
        )}
      </div>
    </header>
  )
}
