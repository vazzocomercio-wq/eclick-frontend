/**
 * Cliente Sanity + helpers de imagem para o blog (eclick.app.br/blog).
 *
 * Dataset é PÚBLICO → leitura de conteúdo publicado não precisa de token.
 * Envs (não-secretas) em .env.local do eclick-frontend:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID=...
 *   NEXT_PUBLIC_SANITY_DATASET=production
 */
import { createClient, type SanityClient } from 'next-sanity'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'

export const SANITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'MISSING_PROJECT_ID'
export const SANITY_DATASET =
  process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
export const SANITY_API_VERSION = '2024-10-01'

export const sanityClient: SanityClient = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: SANITY_API_VERSION,
  useCdn: true, // conteúdo publicado pode vir do CDN (mais rápido/barato)
  perspective: 'published',
})

const builder = imageUrlBuilder(sanityClient)

/** Gera URL de imagem do Sanity com transformações (ex: urlFor(img).width(1200).url()). */
export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}

/**
 * Fetch tipado com ISR. `tags`/`revalidate` permitem revalidação on-demand
 * (webhook do Active ao publicar) + fallback por tempo.
 */
export async function sanityFetch<T>(
  query: string,
  params: Record<string, unknown> = {},
  opts: { revalidate?: number | false; tags?: string[] } = {},
): Promise<T> {
  return sanityClient.fetch<T>(query, params, {
    next: {
      revalidate: opts.revalidate ?? 3600,
      tags: opts.tags,
    },
  })
}

/** Indica se as credenciais reais já foram configuradas (evita build quebrar antes do wiring). */
export const SANITY_CONFIGURED = SANITY_PROJECT_ID !== 'MISSING_PROJECT_ID'
