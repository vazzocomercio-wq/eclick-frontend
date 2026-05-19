'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'
import { Package, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface StaleItem {
  ml_item_id:          string
  inventory_id:        string | null
  available_quantity:  number
  last_sold_at:        string | null
  days_since_sale:     number | null
  listing_title:       string | null
  listing_permalink:   string | null
}

interface FullFulfillmentCardData {
  summary: {
    totalSkusActive:     number
    skusInFull:          number
    skusOutsideFull:     number
    fullPenetrationPct:  number
    staleItemsCount:     number
    staleItemsUnits:     number
  }
  staleTopItems: StaleItem[]
  lastSyncedAt:          string | null
}

type Translator = ReturnType<typeof useTranslations>

const num = (v: number) => v.toLocaleString('pt-BR')

function timeSince(iso: string | null, t: Translator): string {
  if (!iso) return t('timeNever')
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60_000)
  if (m < 1) return t('timeNow')
  if (m < 60) return t('timeMinutesAgo', { m })
  const h = Math.round(m / 60)
  return h < 24 ? t('timeHoursAgo', { h }) : t('timeDaysAgo', { d: Math.round(h / 24) })
}

export default function FullFulfillmentCard() {
  const t = useTranslations('executive')
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<FullFulfillmentCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch(`${BACKEND}/executive/cards/full-fulfillment`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setData(await res.json() as FullFulfillmentCardData)
    } catch (err) {
      console.warn('[full-card] load fail:', (err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const empty = !loading && data && data.summary.skusInFull === 0
  const tone  = empty ? 'neutral' : 'positive'

  return (
    <div style={{
      background:   'rgba(255,255,255,0.02)',
      border:       '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={14} color={tone === 'positive' ? '#00E5FF' : '#71717a'} />
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
            {t('fullCardTitle')}
          </span>
        </div>
        <button onClick={load} disabled={refreshing} style={{
          background: 'none', border: 'none', cursor: refreshing ? 'wait' : 'pointer',
          color: '#71717a', padding: 4,
        }}>
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      {loading && (
        <div style={{ color: '#52525b', fontSize: 13 }}>{t('loading')}</div>
      )}

      {!loading && empty && (
        <div style={{ paddingTop: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#a1a1aa', marginBottom: 6 }}>
            {t('fullEmptyTitle')}
          </div>
          <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5, marginBottom: 10 }}>
            {t('fullEmptyDesc')}
          </div>
          <a href="https://www.mercadolivre.com.br/ajuda/Como-funciona-Full-Fulfillment_15064"
             target="_blank" rel="noopener noreferrer"
             style={{
               display: 'inline-flex', alignItems: 'center', gap: 6,
               color: '#00E5FF', fontSize: 12, textDecoration: 'none',
             }}>
            {t('fullSeeRequirements')} <ExternalLink size={11} />
          </a>
        </div>
      )}

      {!loading && data && !empty && (
        <>
          <div>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#00E5FF', lineHeight: 1 }}>
              {data.summary.fullPenetrationPct}%
            </div>
            <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
              {t('fullSkusInFull', { inFull: num(data.summary.skusInFull), total: num(data.summary.totalSkusActive) })}
            </div>
          </div>
          {data.summary.staleItemsCount > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.04)',
              border: '1px solid rgba(245,158,11,0.20)',
              borderRadius: 8, padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={14} color="#f59e0b" />
              <span style={{ fontSize: 12, color: '#f59e0b' }}>
                {t('fullStaleItems', { count: num(data.summary.staleItemsCount), units: num(data.summary.staleItemsUnits) })}
              </span>
            </div>
          )}
          {data.staleTopItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {data.staleTopItems.slice(0, 5).map(it => (
                <a key={it.ml_item_id}
                   href={it.listing_permalink ?? '#'}
                   target="_blank" rel="noopener noreferrer"
                   style={{
                     display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                     fontSize: 11, color: '#a1a1aa', textDecoration: 'none',
                     padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                   }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                    {it.listing_title ?? it.ml_item_id}
                  </span>
                  <span style={{ color: '#71717a', whiteSpace: 'nowrap', marginLeft: 8 }}>
                    {t('fullStaleItemMeta', { units: it.available_quantity, days: it.days_since_sale ?? '?' })}
                  </span>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ fontSize: 10, color: '#52525b', marginTop: 'auto' }}>
        {t('refreshedAt', { since: timeSince(data?.lastSyncedAt ?? null, t) })}
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
