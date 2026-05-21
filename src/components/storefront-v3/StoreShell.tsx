/**
 * StoreShell — wrapper raiz do renderizador v3.
 *
 * Server Component. Recebe `ctx` + `pageKey` e renderiza:
 *  - <link> do Google Fonts do tema
 *  - <style> com CSS vars do tema + body styling
 *  - Header global
 *  - <main> com sections da pagina
 *  - Footer global
 *
 * Floaters (WhatsApp, Carrinho) ficam fora do shell — sao Client Components
 * injetados pela rota.
 */

import { SectionRenderer } from './SectionRenderer'
import { StorefrontPixels } from './StorefrontPixels'
import type { RenderCtx } from './RenderCtx'
import { googleFontsHref, themeCssVars } from './helpers'
import type { PageDesign } from '@/lib/storefront/v3/types'
import { WhatsAppFloater } from '@/components/storefront/premium/WhatsAppFloater'

export function StoreShell({ ctx }: { ctx: RenderCtx }) {
  const page: PageDesign = ctx.design.pages[ctx.page]
  const { header, footer } = ctx.design.globals

  return (
    <div style={{
      ...themeCssVars(ctx.theme),
      background: 'var(--c-bg)',
      color:      'var(--c-text)',
      fontFamily: 'var(--f-body)',
      minHeight:  '100vh',
    }}>
      <link rel="stylesheet" href={googleFontsHref(ctx.theme)} />
      <StorefrontPixels store={ctx.store} />

      {/* Header global (sticky se configurado) */}
      <div style={{
        position: header.settings.sticky ? 'sticky' : 'relative',
        top: 0, zIndex: 30,
        background: 'var(--c-bg)',
        borderBottom: '1px solid var(--c-border)',
      }}>
        <SectionRenderer ctx={ctx} section={header} />
      </div>

      {/* Main — sections da pagina atual */}
      <main>
        {page.sections.map(s => (
          <SectionRenderer key={s.id} ctx={ctx} section={s} />
        ))}
      </main>

      {/* Footer global */}
      <div style={{ borderTop: '1px solid var(--c-border)', marginTop: 40 }}>
        <SectionRenderer ctx={ctx} section={footer} />
      </div>

      {/* WhatsApp floater (botão flutuante bottom-right) — mostrado quando
          a loja tem whatsapp_widget_enabled + whatsapp_number. */}
      {ctx.store.whatsapp_widget_enabled && ctx.store.whatsapp_number && (
        <WhatsAppFloater store={ctx.store} />
      )}
    </div>
  )
}
