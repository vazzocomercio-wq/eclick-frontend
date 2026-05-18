/**
 * Rodape rico (v2) — variante `columns` (escuro, colunas de links +
 * newsletter) ou `minimal` (marca + redes). Newsletter e visual nesta
 * fase; a inscricao real entra com o modulo de marketing.
 */

import type { Section } from '@/lib/storefront/types'
import type { StorefrontStore } from '@/lib/storefront/data'
import { darkColor, bestContrast, alpha, onAccentColor } from '@/lib/storefront/theme'
import type { RenderCtx } from '../renderCtx'

export function SiteFooter({ store, section, ctx }: {
  store: StorefrontStore
  section: Extract<Section, { type: 'siteFooter' }>
  ctx: RenderCtx
}) {
  const { colors } = ctx.theme
  const columns = section.variant === 'columns'
  const bg = columns ? darkColor(ctx.theme) : colors.surface
  const fg = columns ? bestContrast(bg) : colors.text
  const muted = alpha(fg, 0.6)
  const socials = store.social_links
    ? Object.entries(store.social_links).filter(([, v]) => !!v)
    : []

  return (
    <footer
      className="px-4 sm:px-8 pt-10 sm:pt-14 pb-8"
      style={{ background: bg, borderTop: `1px solid ${columns ? alpha(fg, 0.12) : colors.border}` }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* marca */}
          <div>
            <p className="text-lg font-bold" style={{ color: fg, fontFamily: ctx.fontH }}>
              {store.store_name}
            </p>
            {store.store_description && (
              <p className="mt-2 text-xs leading-relaxed max-w-xs" style={{ color: muted }}>
                {store.store_description}
              </p>
            )}
            {socials.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
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

          {/* colunas de links */}
          {columns && section.columns?.map((col, i) => (
            <div key={i}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: fg }}>
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l, j) => (
                  <li key={j}>
                    <a href={l.href} className="text-sm hover:underline" style={{ color: muted }}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* newsletter */}
          {columns && section.newsletter && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: fg }}>
                Receba novidades
              </p>
              <p className="mt-3 text-xs" style={{ color: muted }}>
                Ofertas e lançamentos no seu e-mail.
              </p>
              <div className="mt-3 flex" style={{ borderRadius: ctx.radius, overflow: 'hidden' }}>
                <input
                  type="email"
                  placeholder="Seu e-mail"
                  className="flex-1 min-w-0 px-3 py-2 text-sm outline-none"
                  style={{ background: alpha(fg, 0.08), color: fg, border: `1px solid ${alpha(fg, 0.15)}` }}
                />
                <button
                  type="button"
                  className="px-4 text-sm font-semibold shrink-0"
                  style={{ background: colors.primary, color: onAccentColor(ctx.theme) }}
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className="mt-10 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-center sm:text-left"
          style={{ borderTop: `1px solid ${columns ? alpha(fg, 0.12) : colors.border}` }}
        >
          <p className="text-xs" style={{ color: muted }}>
            © {new Date().getFullYear()} {store.store_name}
          </p>
          <p className="text-xs" style={{ color: muted }}>
            Powered by <span style={{ color: colors.primary }}>e-Click</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
