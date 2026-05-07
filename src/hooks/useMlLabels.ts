'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

export interface MlLabelsMap {
  domains:    Record<string, string>
  attributes: Record<string, string>
}

const EMPTY: MlLabelsMap = { domains: {}, attributes: {} }

/** Fallback humanize: MLB-LIGHT_BULBS → "Light Bulbs". So pra quando label
 *  ainda nao foi resolvido (race condition ou cache miss). */
function humanize(id: string): string {
  return id
    .replace(/^MLB-/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}

/** Hook canonico pra obter dictionary { domains, attributes } com
 *  traducoes PT-BR vindas do ML. Usa cache do localStorage entre sessoes
 *  pra evitar flash inicial. Backend cacheia 30d entao chamada eh barata. */
export function useMlLabels(): {
  labels:  MlLabelsMap
  loading: boolean
  domainName:    (id: string | null | undefined) => string
  attributeName: (id: string | null | undefined) => string
  refresh:       () => Promise<void>
} {
  const [labels, setLabels]   = useState<MlLabelsMap>(EMPTY)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      const t = session?.access_token ?? ''
      const sid = getStoredSellerId()
      const url = sid != null
        ? `${BACKEND}/ml-quality/labels?seller_id=${sid}`
        : `${BACKEND}/ml-quality/labels`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      if (!r.ok) {
        setLabels(EMPTY)
        return
      }
      const text = await r.text()
      if (!text) { setLabels(EMPTY); return }
      const body = JSON.parse(text) as MlLabelsMap
      setLabels({
        domains:    body.domains    ?? {},
        attributes: body.attributes ?? {},
      })
    } catch {
      setLabels(EMPTY)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const domainName = useCallback((id: string | null | undefined) => {
    if (!id) return ''
    return labels.domains[id] ?? humanize(id)
  }, [labels])

  const attributeName = useCallback((id: string | null | undefined) => {
    if (!id) return ''
    return labels.attributes[id] ?? humanize(id)
  }, [labels])

  return { labels, loading, domainName, attributeName, refresh }
}
