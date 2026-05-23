/**
 * Seção "Monte o ambiente" (productKits) — wrapper server.
 *
 * Só repassa slug + settings pro client (ProductKitsClient), que busca os
 * kits no endpoint público e renderiza. Mantém o renderer base como Server
 * Component (mesmo padrão do RoomVisualizerPromo → RoomVisualizerLauncher).
 */

import type { ProductKitsSection } from '@/lib/storefront/v3/types'
import type { RenderCtx } from '../RenderCtx'
import { ProductKitsClient } from './ProductKitsClient'

export function ProductKitsSectionView({ ctx, section }: { ctx: RenderCtx; section: ProductKitsSection }) {
  return <ProductKitsClient slug={ctx.slug} settings={section.settings} />
}
