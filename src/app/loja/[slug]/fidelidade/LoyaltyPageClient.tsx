'use client'

/**
 * Form de consulta de saldo de fidelidade — Client Component.
 *
 * Cliente digita email → fetch /public/loyalty/by-slug/:slug/customer
 * → mostra tier atual, progresso pro próximo, saldo de cashback.
 */

import { useState } from 'react'
import { Loader2, Search, Trophy } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface TierLite {
  id:              string
  name:            string
  color:           string
  icon_emoji:      string | null
  min_spent_cents: number
}

interface CustomerData {
  enabled?:     boolean
  loyalty?: {
    total_spent_cents: number
    order_count:       number
  }
  currentTier?:        TierLite | null
  nextTier?:           TierLite | null
  progressToNextCents?: number
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function LoyaltyPageClient({ slug, tiers }: { slug: string; tiers: TierLite[] }) {
  const [email, setEmail] = useState('')
  const [data, setData] = useState<CustomerData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const consultar = async () => {
    if (!email.trim() || !email.includes('@')) {
      setErr('Informe um email válido')
      return
    }
    setLoading(true); setErr(null); setData(null)
    try {
      const res = await fetch(
        `${BACKEND}/public/loyalty/by-slug/${encodeURIComponent(slug)}/customer?email=${encodeURIComponent(email.trim())}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json() as CustomerData | null
      setData(body)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const totalSpent = data?.loyalty?.total_spent_cents ?? 0
  const orderCount = data?.loyalty?.order_count ?? 0
  const current = data?.currentTier ?? null
  const next = data?.nextTier ?? null
  const progressToNext = data?.progressToNextCents ?? 0

  // Progress bar: posição atual no caminho do nextTier
  const progressPct = (() => {
    if (!next) return 100 // já no topo
    const range = next.min_spent_cents - (current?.min_spent_cents ?? 0)
    const done  = totalSpent - (current?.min_spent_cents ?? 0)
    return Math.min(100, Math.max(0, (done / range) * 100))
  })()

  return (
    <div className="rounded-xl p-5 sm:p-6"
      style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <h2 className="text-lg font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
        <Trophy size={18} /> Consultar seu nível
      </h2>
      <p className="text-xs mb-4" style={{ color: 'var(--c-text-muted)' }}>
        Informe o email usado nas compras pra ver seu nível atual e benefícios.
      </p>

      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && consultar()}
          placeholder="seu@email.com"
          className="flex-1 px-3 py-2 text-sm outline-none rounded"
          style={{
            background: 'var(--c-bg)', color: 'var(--c-text)',
            border: '1px solid var(--c-border)', minHeight: 44,
          }}
        />
        <button
          onClick={consultar}
          disabled={loading || !email.trim()}
          className="px-4 py-2 text-sm font-semibold rounded inline-flex items-center gap-2 disabled:opacity-50"
          style={{
            background: 'var(--c-primary)', color: 'var(--c-on-accent, #000)',
            minHeight: 44,
          }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Consultar
        </button>
      </div>

      {err && (
        <p className="text-xs mt-3" style={{ color: '#ef4444' }}>{err}</p>
      )}

      {data && (
        <div className="mt-5 space-y-4">
          {current ? (
            <>
              {/* Tier atual */}
              <div className="text-center py-4 rounded-lg"
                style={{ background: `${current.color}10`, border: `1px solid ${current.color}40` }}>
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--c-text-muted)' }}>
                  Seu nível atual
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span style={{ fontSize: 32 }}>{current.icon_emoji ?? '⭐'}</span>
                  <h3 className="text-2xl font-bold" style={{ color: current.color }}>
                    {current.name}
                  </h3>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)' }}>
                  {brl(totalSpent)} em compras · {orderCount} pedido{orderCount === 1 ? '' : 's'}
                </p>
              </div>

              {/* Progresso pro próximo */}
              {next && (
                <div>
                  <div className="flex items-baseline justify-between mb-2 text-sm">
                    <span style={{ color: 'var(--c-text-muted)' }}>
                      Faltam <strong style={{ color: 'var(--c-text)' }}>{brl(progressToNext)}</strong> pra...
                    </span>
                    <span className="font-semibold flex items-center gap-1" style={{ color: next.color }}>
                      {next.icon_emoji ?? '⭐'} {next.name}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
                    <div style={{
                      width: `${progressPct}%`, height: '100%',
                      background: next.color, transition: 'width 300ms',
                    }} />
                  </div>
                </div>
              )}

              {!next && (
                <p className="text-center text-sm" style={{ color: 'var(--c-text-muted)' }}>
                  ✨ Parabéns! Você já está no nível mais alto.
                </p>
              )}
            </>
          ) : tiers.length > 0 && (
            <div className="text-center py-6">
              <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
                Esse email ainda não tem histórico nesta loja. Faça sua primeira
                compra pra começar acumular!
              </p>
              {tiers[0] && (
                <p className="text-xs mt-3" style={{ color: 'var(--c-text-muted)' }}>
                  Você começa em <strong style={{ color: tiers[0].color }}>{tiers[0].icon_emoji} {tiers[0].name}</strong>.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
