'use client'

/**
 * Detecta ?ref=<code> na URL e:
 *   1. Salva cookie de afiliado (localStorage, 30 dias)
 *   2. Dispara POST /public/affiliate/track no backend (dedup 24h por IP)
 *   3. Remove o ?ref= da URL (history.replaceState) pra não poluir
 *
 * Plugado no <StoreShell /> uma vez — fica invisível.
 */

import { useEffect } from 'react'
import { trackAffiliateRef } from '@/lib/storefront/affiliate-auth'

export function AffiliateRefTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const ref = url.searchParams.get('ref')
    if (!ref) return

    void trackAffiliateRef(slug, ref)

    // Remove o ?ref= da URL pra não poluir links compartilhados
    url.searchParams.delete('ref')
    window.history.replaceState({}, '', url.toString())
  }, [slug])

  return null
}
