import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ExternalLink, Check, X, Lightbulb, Users, Calendar, Package } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface PublicLandingProduct {
  id:                       string
  name:                     string
  brand:                    string | null
  category:                 string | null
  description:              string | null
  price:                    number | null
  photo_urls:               string[] | null
  gtin:                     string | null
  condition:                string | null
  weight_kg:                number | null
  width_cm:                 number | null
  length_cm:                number | null
  height_cm:                number | null
  ml_permalink:             string | null
  ai_short_description:     string | null
  ai_long_description:      string | null
  ai_keywords:              string[]
  ai_target_audience:       string | null
  ai_use_cases:             string[]
  ai_pros:                  string[]
  ai_cons:                  string[]
  ai_seo_keywords:          string[]
  ai_seasonality_hint:      string | null
}

async function fetchProduct(id: string): Promise<PublicLandingProduct | null> {
  try {
    const res = await fetch(`${BACKEND}/products/public/${id}/landing`, {
      cache: 'no-store', // landing dinâmica — bumpa view counter
    })
    if (res.status === 404) return null
    if (!res.ok) return null
    return await res.json() as PublicLandingProduct
  } catch {
    return null
  }
}

// ── SEO ─────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const product = await fetchProduct(id)
  if (!product) {
    return { title: 'Produto não encontrado' }
  }

  const title = product.ai_short_description
    ? `${product.name} — ${product.ai_short_description}`
    : product.name

  const description = product.ai_long_description?.slice(0, 160)
    ?? product.description?.slice(0, 160)
    ?? `${product.name}${product.brand ? ' por ' + product.brand : ''}.`

  return {
    title,
    description,
    keywords: [...product.ai_seo_keywords, ...product.ai_keywords].slice(0, 15),
    openGraph: {
      title:       product.name,
      description,
      images:      product.photo_urls?.slice(0, 4) ?? [],
      type:        'website',
    },
    twitter: {
      card:        'summary_large_image',
      title:       product.name,
      description,
      images:      product.photo_urls?.[0] ? [product.photo_urls[0]] : [],
    },
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function PublicLandingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await fetchProduct(id)
  if (!product) notFound()

  const photos = product.photo_urls?.filter(Boolean) ?? []
  const mainPhoto = photos[0]
  const otherPhotos = photos.slice(1, 5)

  const dims = [
    product.weight_kg && `${product.weight_kg}kg`,
    product.width_cm && `${product.width_cm}cm L`,
    product.length_cm && `${product.length_cm}cm C`,
    product.height_cm && `${product.height_cm}cm A`,
  ].filter(Boolean).join(' × ')

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Photo */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
            {mainPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mainPhoto}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-700">
                <Package size={48} />
              </div>
            )}
          </div>

          {/* Title block */}
          <div>
            {product.brand && (
              <p className="text-[11px] uppercase tracking-widest text-cyan-400 font-semibold mb-2">
                {product.brand}
              </p>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{product.name}</h1>
            {product.ai_short_description && (
              <p className="text-base sm:text-lg text-zinc-300 mt-3 leading-relaxed">
                {product.ai_short_description}
              </p>
            )}
            {product.price !== null && product.price > 0 && (
              <div className="mt-5">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider">A partir de</p>
                <p className="text-3xl font-bold text-emerald-400 font-mono mt-0.5">
                  R$ {Number(product.price).toFixed(2).replace('.', ',')}
                </p>
              </div>
            )}
            {product.ml_permalink && (
              <a
                href={product.ml_permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-semibold transition-all shadow-[0_0_20px_rgba(0,229,255,0.3)]"
              >
                Comprar no Mercado Livre <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Long description ─────────────────────────────────────────────── */}
      {product.ai_long_description && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-base text-zinc-300 leading-relaxed whitespace-pre-line">
            {product.ai_long_description}
          </p>
        </section>
      )}

      {/* ── Photos grid ──────────────────────────────────────────────────── */}
      {otherPhotos.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {otherPhotos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`${product.name} foto ${i + 2}`}
                className="aspect-square w-full object-contain bg-zinc-900 rounded-lg border border-zinc-800"
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Pros / Use cases / Cons (3 cols) ─────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        {product.ai_pros.length > 0 && (
          <ContentCard
            title="Por que comprar"
            icon={<Check size={14} />}
            tone="emerald"
            items={product.ai_pros}
          />
        )}
        {product.ai_use_cases.length > 0 && (
          <ContentCard
            title="Como usar"
            icon={<Lightbulb size={14} />}
            tone="amber"
            items={product.ai_use_cases}
          />
        )}
        {product.ai_cons.length > 0 && (
          <ContentCard
            title="Considere antes"
            icon={<X size={14} />}
            tone="zinc"
            items={product.ai_cons}
          />
        )}
      </section>

      {/* ── Target audience + sazonalidade ────────────────────────────────── */}
      {(product.ai_target_audience || product.ai_seasonality_hint) && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {product.ai_target_audience && (
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <div className="flex items-center gap-2 text-cyan-300 text-[11px] uppercase tracking-wider mb-2">
                <Users size={12} /> Pra quem é
              </div>
              <p className="text-sm text-zinc-200">{product.ai_target_audience}</p>
            </div>
          )}
          {product.ai_seasonality_hint && (
            <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-4">
              <div className="flex items-center gap-2 text-violet-300 text-[11px] uppercase tracking-wider mb-2">
                <Calendar size={12} /> Quando comprar
              </div>
              <p className="text-sm text-zinc-200">{product.ai_seasonality_hint}</p>
            </div>
          )}
        </section>
      )}

      {/* ── Specs ────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-3">Especificações</h2>
        <dl className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden divide-y divide-zinc-800">
          {product.brand     && <SpecRow label="Marca"     value={product.brand} />}
          {product.category  && <SpecRow label="Categoria" value={product.category} />}
          {product.condition && <SpecRow label="Condição"  value={product.condition === 'new' ? 'Novo' : product.condition === 'used' ? 'Usado' : product.condition} />}
          {dims              && <SpecRow label="Dimensões" value={dims} />}
          {product.gtin      && <SpecRow label="GTIN/EAN"  value={product.gtin} />}
        </dl>
      </section>

      {/* ── CTA final ─────────────────────────────────────────────────────── */}
      {product.ml_permalink && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-center">
          <a
            href={product.ml_permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-bold transition-all shadow-[0_0_24px_rgba(0,229,255,0.3)]"
          >
            Comprar agora no Mercado Livre <ExternalLink size={16} />
          </a>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-6 text-center text-[10px] text-zinc-600">
        <p>Página gerada por IA · e-Click</p>
      </footer>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function ContentCard({
  title, icon, tone, items,
}: {
  title: string
  icon:  React.ReactNode
  tone:  'emerald' | 'amber' | 'zinc'
  items: string[]
}) {
  const tones: Record<string, { border: string; bg: string; text: string; iconBg: string }> = {
    emerald: { border: 'border-emerald-400/30', bg: 'bg-emerald-400/5', text: 'text-emerald-300', iconBg: 'bg-emerald-400/20' },
    amber:   { border: 'border-amber-400/30',   bg: 'bg-amber-400/5',   text: 'text-amber-300',   iconBg: 'bg-amber-400/20' },
    zinc:    { border: 'border-zinc-800',       bg: 'bg-zinc-900/30',   text: 'text-zinc-300',    iconBg: 'bg-zinc-800' },
  }
  const c = tones[tone]
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <header className={`flex items-center gap-2 ${c.text} mb-3`}>
        <span className={`p-1.5 rounded-lg ${c.iconBg}`}>{icon}</span>
        <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
      </header>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-zinc-200 leading-snug">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-200 font-medium">{value}</dd>
    </div>
  )
}

// silenciar warning de Image import não usado (pode usar futuramente)
void Image
