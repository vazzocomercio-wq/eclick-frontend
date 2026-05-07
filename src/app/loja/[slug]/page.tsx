/** Storefront publico — renderizado quando:
 *  - User acessa app.eclick.app.br/loja/<slug> diretamente
 *  - Host customizado (loja.cliente.com.br) eh resolvido pelo middleware
 *    e reescrito pra esta rota
 *  - storefront.eclick.app.br/<slug>/... reescrito pra esta rota
 *
 *  MVP: carrega store_config via /public/store/:slug, mostra header com
 *  branding + lista produtos publicos. Sem auth.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface StoreConfig {
  id:                 string
  organization_id:    string
  store_name:         string
  store_slug:         string
  store_description:  string | null
  logo_url:           string | null
  custom_domain:      string | null
  domain_verified:    boolean
  theme:              {
    primary_color?:    string
    secondary_color?:  string
    accent_color?:     string
  } | null
  whatsapp_widget_enabled: boolean
  whatsapp_number:    string | null
  status:             'setup' | 'active' | 'paused' | 'suspended'
}

interface PublicProduct {
  id:           string
  name:         string
  price:        number
  photo_urls:   string[] | null
  category:     string | null
  ai_score:     number | null
  ai_short_description: string | null
}

async function getStore(slug: string): Promise<StoreConfig | null> {
  try {
    const res = await fetch(`${BACKEND}/public/store/by-slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const text = await res.text()
    if (!text || text === 'null') return null
    return JSON.parse(text) as StoreConfig
  } catch { return null }
}

async function getProducts(slug: string): Promise<PublicProduct[]> {
  try {
    // Endpoint retorna { config, products } — extrai products do shape
    const res = await fetch(`${BACKEND}/public/store/${encodeURIComponent(slug)}/products?limit=24`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const text = await res.text()
    if (!text) return []
    const parsed = JSON.parse(text) as { products?: PublicProduct[] } | PublicProduct[]
    if (Array.isArray(parsed)) return parsed
    return parsed?.products ?? []
  } catch { return [] }
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function StorefrontPage({ params }: Props) {
  const { slug } = await params
  const store = await getStore(slug)
  if (!store || store.status !== 'active') notFound()

  const products = await getProducts(slug)

  const primary   = store.theme?.primary_color   ?? '#00E5FF'
  const secondary = store.theme?.secondary_color ?? '#0a0a0e'
  const accent    = store.theme?.accent_color    ?? '#fafafa'

  return (
    <div style={{ background: secondary, color: accent, minHeight: '100vh' }}>
      {/* Hero / header */}
      <header
        className="px-6 py-10 sm:px-12 sm:py-16"
        style={{
          background: `linear-gradient(135deg, ${secondary} 0%, ${primary}15 100%)`,
          borderBottom: `1px solid ${primary}30`,
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          {store.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logo_url} alt={store.store_name}
              className="h-14 w-14 rounded-xl object-contain"
              style={{ background: '#fff', padding: 4 }} />
          )}
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold" style={{ color: accent }}>{store.store_name}</h1>
            {store.store_description && (
              <p className="text-sm sm:text-base mt-1.5 opacity-70">{store.store_description}</p>
            )}
          </div>
        </div>
      </header>

      {/* Catalog */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
        <h2 className="text-lg font-semibold mb-4 opacity-90">Produtos</h2>
        {products.length === 0 ? (
          <div className="rounded-xl p-12 text-center text-sm opacity-50"
            style={{ border: `1px dashed ${primary}30` }}>
            Nenhum produto disponível no momento.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {products.map(p => (
              <Link key={p.id} href={`/loja/${slug}/produto/${p.id}`}
                className="rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
                style={{ background: `${primary}08`, border: `1px solid ${primary}20` }}>
                <div className="aspect-square overflow-hidden" style={{ background: '#fff' }}>
                  {p.photo_urls?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_urls[0]} alt={p.name}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">sem foto</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs sm:text-sm font-medium line-clamp-2" style={{ color: accent }}>
                    {p.name}
                  </p>
                  <p className="text-base sm:text-lg font-bold mt-1.5" style={{ color: primary }}>
                    {brl(p.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* WhatsApp button (quando habilitado) */}
      {store.whatsapp_widget_enabled && store.whatsapp_number && (
        <a
          href={`https://wa.me/${store.whatsapp_number.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 rounded-full p-4 shadow-2xl transition-transform hover:scale-105"
          style={{ background: '#25D366', color: '#fff' }}
          aria-label="Falar no WhatsApp"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}

      {/* Footer */}
      <footer className="mt-12 py-6 text-center text-xs opacity-40 border-t" style={{ borderColor: `${primary}15` }}>
        Powered by <span style={{ color: primary }}>e-Click</span>
      </footer>
    </div>
  )
}
