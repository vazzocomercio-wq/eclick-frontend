'use client'

/**
 * ClientPreview — escuta postMessage do Designer v3 e re-renderiza
 * o StoreShell com o design recebido em tempo real.
 *
 * Protocolo:
 *   parent.postMessage({ type: 'design:update', design: StorefrontDesignV3 }, '*')
 *   parent.postMessage({ type: 'design:page',   page:   keyof PageMap }, '*')
 *   parent.postMessage({ type: 'preview:ready?' }, '*')  → responde 'preview:ready'
 *
 * Aceita mensagens de qualquer origem (intencional — o iframe roda no
 * mesmo dominio que o parent em prod, e em dev pode rodar local).
 */

import { useEffect, useState } from 'react'
import { StoreShell } from '@/components/storefront-v3/StoreShell'
import type { StorefrontDesignV3, PageMap } from '@/lib/storefront/v3/types'
import type { StorefrontStore, StorefrontProduct } from '@/lib/storefront/v3/data'

interface Props {
  store:         StorefrontStore
  products:      StorefrontProduct[]
  initialDesign: StorefrontDesignV3
  slug:          string
}

type PageKey = keyof PageMap

export function ClientPreview({ store, products, initialDesign, slug }: Props) {
  const [design, setDesign] = useState<StorefrontDesignV3>(initialDesign)
  const [page, setPage]     = useState<PageKey>('home')

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; design?: StorefrontDesignV3; page?: PageKey } | null
      if (!data || typeof data !== 'object') return
      if (data.type === 'design:update' && data.design && data.design.version === 3) {
        setDesign(data.design)
      } else if (data.type === 'design:page' && data.page) {
        setPage(data.page)
      } else if (data.type === 'preview:ready?') {
        // Responde ao parent que esta pronto pra receber updates.
        e.source?.postMessage({ type: 'preview:ready' }, { targetOrigin: '*' })
      }
    }
    window.addEventListener('message', onMessage)
    // Anuncia que esta pronto (caso o parent ja tenha enviado design antes
    // do listener registrar).
    window.parent.postMessage({ type: 'preview:ready' }, '*')
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <StoreShell ctx={{
      store, design, theme: design.theme,
      slug, page, products,
      paymentDisplay: store.payment_display_settings ?? null,
    }} />
  )
}
