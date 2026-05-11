'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Zap, ExternalLink, RefreshCw, CheckCircle2 } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

interface FlexOpportunityItem {
  ml_item_id:         string
  listing_title:      string | null
  visits_7d:          number
  coverage_pct:       number | null
  listing_permalink:  string | null
}

interface FlexOpportunityCardData {
  summary: {
    totalEligible:   number
    activated:       number
    opportunity:     number
    notEligible:     number
    activationRate:  number
    nullCoverage:    number
  }
  opportunityTopItems: FlexOpportunityItem[]
  lastSyncedAt: string | null
}

const num = (v: number) => v.toLocaleString('pt-BR')

function timeSince(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60_000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m}m`
  const h = Math.round(m / 60)
  return h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)}d`
}

export default function FlexOpportunityCard() {
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<FlexOpportunityCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await fetch(`${BACKEND}/executive/cards/flex-opportunity`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setData(await res.json() as FlexOpportunityCardData)
    } catch (err) {
      console.warn('[flex-card] load fail:', (err as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const oppCount = data?.summary.opportunity ?? 0
  const allActivated = data && data.summary.totalEligible > 0 && oppCount === 0

  return (
    <div style={{
      background:   oppCount > 0 ? 'rgba(132,204,22,0.04)' : 'rgba(255,255,255,0.02)',
      border:       oppCount > 0 ? '1px solid rgba(132,204,22,0.20)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={14} color={oppCount > 0 ? '#84cc16' : '#71717a'} />
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#a1a1aa' }}>
            Flex — Oportunidades
          </span>
        </div>
        <button onClick={load} disabled={refreshing} style={{
          background: 'none', border: 'none', cursor: refreshing ? 'wait' : 'pointer',
          color: '#71717a', padding: 4,
        }}>
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
        </button>
      </div>

      {loading && <div style={{ color: '#52525b', fontSize: 13 }}>Carregando…</div>}

      {!loading && allActivated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#22c55e' }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: 13 }}>100% dos elegíveis ativos.</span>
        </div>
      )}

      {!loading && data && oppCount === 0 && data.summary.totalEligible === 0 && (
        <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5 }}>
          Nenhum item elegível ao Flex nesta região.
        </div>
      )}

      {!loading && data && oppCount > 0 && (
        <>
          <div>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#84cc16', lineHeight: 1 }}>
              {num(oppCount)}
            </div>
            <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
              elegíveis sem adesão · {num(data.summary.activated)} ativos · {num(data.summary.notEligible)} não elegíveis
            </div>
          </div>
          {data.summary.nullCoverage > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.04)',
              border: '1px solid rgba(245,158,11,0.20)',
              borderRadius: 8, padding: '8px 10px',
              fontSize: 11, color: '#f59e0b',
            }}>
              Scan parcial — {num(data.summary.nullCoverage)} items ainda não verificados
            </div>
          )}
          {data.opportunityTopItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <div style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
                Top por tráfego
              </div>
              {data.opportunityTopItems.slice(0, 5).map(it => (
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
                  <span style={{ color: '#84cc16', whiteSpace: 'nowrap', marginLeft: 8 }}>
                    {it.visits_7d > 0 ? `${num(it.visits_7d)} v/7d` : '—'}
                  </span>
                </a>
              ))}
            </div>
          )}
          <a href="https://www.mercadolivre.com.br/envios/flex/coverage"
             target="_blank" rel="noopener noreferrer"
             style={{
               display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
               background: 'rgba(132,204,22,0.10)',
               border: '1px solid rgba(132,204,22,0.30)',
               color: '#84cc16', padding: '8px 14px', borderRadius: 8,
               fontSize: 12, fontWeight: 500, textDecoration: 'none',
               marginTop: 4,
             }}>
            Ativar Flex no ML <ExternalLink size={11} />
          </a>
        </>
      )}

      <div style={{ fontSize: 10, color: '#52525b', marginTop: 'auto' }}>
        ↻ atualizado {timeSince(data?.lastSyncedAt ?? null)}
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
