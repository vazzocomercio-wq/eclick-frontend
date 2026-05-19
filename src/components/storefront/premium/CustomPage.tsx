/**
 * Renderizador de pagina customizada — title + content prosa.
 *
 * Server component. Reusa o chrome (announcement, header, footer) do
 * design da loja pra ficar coerente com /loja/[slug].
 *
 * Content: texto simples com `whitespace-pre-line` (quebras de linha
 * preservadas). Sem markdown nesta fase pra evitar deps adicionais e
 * risco de XSS — quando o user pedir markdown, plugar uma libreria
 * sanitizada (ex: marked + DOMPurify) em CustomPage.
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { StorefrontStore } from '@/lib/storefront/data'
import type { StorefrontDesign } from '@/lib/storefront/types'
import { buildCtx } from '../renderCtx'
import { googleFontsHref } from '@/lib/storefront/theme'
import { AnnouncementBar } from './AnnouncementBar'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'

export function CustomPage({ store, design, slug, page }: {
  store:  StorefrontStore
  design: StorefrontDesign
  slug:   string
  page:   { title: string; content: string }
}) {
  const ctx = buildCtx(design.theme)
  const { colors } = ctx.theme

  const announce = design.sections.find(s => s.type === 'announcementBar')
  const header   = design.sections.find(s => s.type === 'siteHeader')
  const footer   = design.sections.find(s => s.type === 'siteFooter')

  return (
    <div style={{ background: colors.background, color: colors.text, fontFamily: ctx.fontB, minHeight: '100vh' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(design.theme)} />

      {announce && <AnnouncementBar section={announce} ctx={ctx} />}
      {header && header.type === 'siteHeader' && (
        <SiteHeader store={store} section={header} ctx={ctx} slug={slug} />
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-16">
        <Link href={`/loja/${slug}`}
          className="text-xs sm:text-sm inline-flex items-center gap-1 hover:underline"
          style={{ color: colors.textMuted }}>
          <ArrowLeft size={12} /> Voltar para a loja
        </Link>

        <h1 className="mt-6 text-3xl sm:text-5xl font-bold leading-tight"
          style={{ color: colors.text, fontFamily: ctx.fontH }}>
          {page.title}
        </h1>

        <div
          className="mt-8 text-sm sm:text-base leading-relaxed whitespace-pre-line"
          style={{ color: colors.text }}
        >
          {page.content}
        </div>
      </main>

      {footer && footer.type === 'siteFooter' && <SiteFooter store={store} section={footer} ctx={ctx} />}
    </div>
  )
}
