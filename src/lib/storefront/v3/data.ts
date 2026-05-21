/**
 * Acesso aos dados publicos da Loja Propria — v3.
 *
 * Reusa os fetchers v2 (`lib/storefront/data.ts`) e adiciona suporte ao
 * campo `design_v3` retornado pelo backend (que ja faz `select('*')` em
 * store_config).
 *
 * O renderer escolhe a versao via `resolveDesign(store)`:
 *  - design_v3 nao-nulo  → renderiza com componentes v3
 *  - senao, design (v2)  → renderiza com componentes v2 (legado)
 *  - senao, DEFAULT_DESIGN_V3 → loja nova, sem design definido
 */

import type { StorefrontStore as StorefrontStoreV2, StorefrontProduct, StorefrontProductDetail, PaymentDisplaySettings } from '../data'
import { getStore as getStoreV2, getProducts, getProduct, formatBRL, whatsappLink, DEFAULT_PAYMENT_DISPLAY } from '../data'
import type { StorefrontDesignV3 } from './types'
import { DEFAULT_DESIGN_V3 } from './templates'
import type { StorefrontDesign as StorefrontDesignV2 } from '../types'

export type { StorefrontProduct, StorefrontProductDetail, PaymentDisplaySettings }
export { getProducts, getProduct, formatBRL, whatsappLink, DEFAULT_PAYMENT_DISPLAY }

/** Store publica + design_v3 opcional (vem direto do select('*') do backend). */
export interface StorefrontStore extends StorefrontStoreV2 {
  design_v3?:           StorefrontDesignV3 | null
  google_analytics_id?: string | null
  meta_pixel_id?:       string | null
  tiktok_pixel_id?:     string | null
  gtm_id?:              string | null
}

export async function getStore(slug: string): Promise<StorefrontStore | null> {
  return (await getStoreV2(slug)) as StorefrontStore | null
}

/**
 * Resolve qual versao de design usar pra renderizar.
 *
 * Sempre devolve um StorefrontDesignV3 ou um marcador de v2 — o consumidor
 * (Renderer raiz) ramifica por `version`.
 */
export type ResolvedDesign =
  | { version: 3; design: StorefrontDesignV3 }
  | { version: 2; design: StorefrontDesignV2 }

export function resolveDesign(store: StorefrontStore | null): ResolvedDesign {
  if (store?.design_v3) return { version: 3, design: store.design_v3 }
  if (store?.design)    return { version: 2, design: store.design }
  return { version: 3, design: DEFAULT_DESIGN_V3 }
}
