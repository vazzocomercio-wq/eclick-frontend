/**
 * Tipo do contexto de render v3 — passado por prop drilling controlado
 * (nao usamos React Context aqui porque queremos Server Components no
 * renderer base; Context obriga Client Components em toda a arvore).
 *
 * Sections e Blocks recebem `ctx: RenderCtx` + `section/block` por prop.
 */

import type { StorefrontDesignV3, ThemeV3 } from '@/lib/storefront/v3/types'
import type { StorefrontStore, StorefrontProduct, PaymentDisplaySettings } from '@/lib/storefront/v3/data'

export interface RenderCtx {
  store:  StorefrontStore
  design: StorefrontDesignV3
  theme:  ThemeV3
  /** Slug da loja — usado pra montar URLs internas (`/loja/<slug>/...`). */
  slug:   string
  /** Pagina sendo renderizada. */
  page:   keyof StorefrontDesignV3['pages']
  /** Produtos carregados (pre-fetched pela rota, pra ProductGrid/Carousel). */
  products?: StorefrontProduct[]
  /** Settings de exibição de preço — vem de store.payment_display_settings.
   *  Componentes PriceDisplay usam isso pra escolher formato (parcelas / Pix /
   *  total em destaque). NULL/undefined = DEFAULT_PAYMENT_DISPLAY. */
  paymentDisplay?: PaymentDisplaySettings | null
}
