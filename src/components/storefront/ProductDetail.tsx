/**
 * Renderizador da pagina de produto da Loja Propria.
 *
 * Le a receita de design e monta a pagina respeitando tema, layout da
 * galeria e tipo de botao (WhatsApp / carrinho). Mobile-first.
 */

import Link from 'next/link'
import type { StorefrontDesign } from '@/lib/storefront/types'
import { fonts, radiusPx, alpha } from '@/lib/storefront/theme'
import { formatBRL, whatsappLink } from '@/lib/storefront/data'
import type { StorefrontStore, StorefrontProductDetail } from '@/lib/storefront/data'
import { ProductGallery } from './ProductGallery'
import { WhatsAppButton } from './StorefrontHome'

const CONDITION_LABELS: Record<string, string> = { new: 'Novo', used: 'Usado', refurbished: 'Recondicionado' }

function attributeRows(attributes: unknown): Array<{ label: string; value: string }> {
  if (Array.isArray(attributes)) {
    return attributes
      .map(a => {
        if (a && typeof a === 'object') {
          const o = a as Record<string, unknown>
          const label = String(o.name ?? o.id ?? '').trim()
          const value = String(o.value_name ?? o.value ?? '').trim()
          if (label && value) return { label, value }
        }
        return null
      })
      .filter((x): x is { label: string; value: string } => x !== null)
  }
  if (attributes && typeof attributes === 'object') {
    return Object.entries(attributes as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => ({ label: k, value: String(v) }))
  }
  return []
}

export function ProductDetail({ design, store, product, slug }: {
  design: StorefrontDesign
  store: StorefrontStore
  product: StorefrontProductDetail
  slug: string
}) {
  const { theme, product: pd } = design
  const { colors } = theme
  const fontH = fonts(theme).heading
  const fontB = fonts(theme).body
  const radius = radiusPx(theme)

  const images = product.photo_urls ?? []
  const description =
    product.ai_long_description?.trim() ||
    product.description?.trim() ||
    product.ai_short_description?.trim() ||
    ''
  const bullets = (product.bullets ?? []).filter(b => typeof b === 'string' && b.trim())
  const attrs = pd.showAttributes ? attributeRows(product.attributes) : []
  const condition = product.condition ? CONDITION_LABELS[product.condition] ?? product.condition : null
  const outOfStock = typeof product.stock === 'number' && product.stock <= 0

  const sideLayout = pd.gallery === 'side'
  const ctaMessage = `Olá! Tenho interesse no produto "${product.name}" (${formatBRL(product.price)}).`

  const badges = [product.category, product.brand, condition].filter(Boolean) as string[]

  const cta = pd.ctaMode === 'whatsapp' && store.whatsapp_number ? (
    <a
      href={whatsappLink(store.whatsapp_number, ctaMessage)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center w-full sm:w-auto px-7 py-3.5 font-semibold text-sm sm:text-base transition-transform hover:scale-[1.02]"
      style={{ background: '#25D366', color: '#fff', borderRadius: radius }}
    >
      Comprar pelo WhatsApp
    </a>
  ) : (
    <span
      className="inline-flex items-center justify-center w-full sm:w-auto px-7 py-3.5 font-semibold text-sm sm:text-base"
      style={{ background: colors.surface, color: colors.textMuted, borderRadius: radius, border: `1px solid ${colors.border}` }}
    >
      Carrinho em breve
    </span>
  )

  return (
    <div style={{ background: colors.background, color: colors.text, fontFamily: fontB, minHeight: '100vh' }}>
      {/* Header */}
      <header className="px-4 sm:px-8 py-5" style={{ borderBottom: `1px solid ${colors.border}` }}>
        <Link href={`/loja/${slug}`} className="max-w-6xl mx-auto flex items-center gap-3">
          {store.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.logo_url}
              alt={store.store_name}
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg object-contain"
              style={{ background: '#fff', padding: 3 }}
            />
          )}
          <span className="text-base sm:text-xl font-bold truncate" style={{ color: colors.text, fontFamily: fontH }}>
            {store.store_name}
          </span>
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <Link
          href={`/loja/${slug}`}
          className="text-xs sm:text-sm hover:underline"
          style={{ color: colors.textMuted }}
        >
          &larr; Voltar para a loja
        </Link>

        <div
          className={`mt-4 ${sideLayout
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10'
            : 'flex flex-col gap-6 max-w-2xl mx-auto'}`}
        >
          <ProductGallery images={images} name={product.name} radius={radius} border={colors.border} />

          <div>
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {badges.map(b => (
                  <span
                    key={b}
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ background: alpha(colors.primary, 0.12), color: colors.primary }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}

            <h1
              className="text-xl sm:text-3xl font-bold leading-snug"
              style={{ color: colors.text, fontFamily: fontH }}
            >
              {product.name}
            </h1>

            <p
              className="mt-3 text-2xl sm:text-4xl font-bold"
              style={{ color: colors.primary, fontFamily: fontH }}
            >
              {formatBRL(product.price)}
            </p>
            {outOfStock && (
              <p className="mt-1 text-xs" style={{ color: colors.textMuted }}>
                Indisponível no momento
              </p>
            )}

            <div className="mt-5">{cta}</div>

            {description && (
              <div className="mt-7">
                <h2 className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Descrição</h2>
                <p
                  className="text-sm leading-relaxed whitespace-pre-line"
                  style={{ color: colors.textMuted }}
                >
                  {description}
                </p>
              </div>
            )}

            {bullets.length > 0 && (
              <ul className="mt-5 space-y-1.5">
                {bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: colors.textMuted }}>
                    <span style={{ color: colors.primary }}>&#9656;</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {attrs.length > 0 && (
              <div className="mt-7">
                <h2 className="text-sm font-semibold mb-2" style={{ color: colors.text }}>Ficha técnica</h2>
                <dl
                  className="text-sm overflow-hidden"
                  style={{ border: `1px solid ${colors.border}`, borderRadius: radius }}
                >
                  {attrs.map((row, i) => (
                    <div
                      key={i}
                      className="flex gap-3 px-3 py-2"
                      style={{ background: i % 2 === 0 ? colors.surface : 'transparent' }}
                    >
                      <dt className="w-2/5 shrink-0" style={{ color: colors.textMuted }}>{row.label}</dt>
                      <dd className="w-3/5" style={{ color: colors.text }}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer
        className="px-4 sm:px-8 py-8 mt-6 text-center text-xs"
        style={{ borderTop: `1px solid ${colors.border}`, background: colors.surface, color: colors.textMuted }}
      >
        Powered by <span style={{ color: colors.primary }}>e-Click</span>
      </footer>

      <WhatsAppButton store={store} message={ctaMessage} />
    </div>
  )
}
