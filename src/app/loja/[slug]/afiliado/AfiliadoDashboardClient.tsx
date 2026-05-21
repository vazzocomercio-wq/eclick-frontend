'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Loader2, LogOut, ChevronLeft, Copy, Check, MousePointer, ShoppingBag,
  Wallet, Clock, AlertCircle, ExternalLink,
} from 'lucide-react'
import {
  fetchCurrentAffiliate, fetchMyStats, fetchMyCommissions, clearAffiliateToken,
  type Affiliate, type AffiliateStats, type AffiliateCommission,
} from '@/lib/storefront/affiliate-auth'

const brl = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const COMM_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Aguardando aprovação', color: '#f59e0b' },
  approved: { label: 'Aprovada',              color: '#3b82f6' },
  paid:     { label: 'Paga',                  color: '#22c55e' },
  rejected: { label: 'Rejeitada',             color: '#ef4444' },
  refunded: { label: 'Cancelada',             color: '#71717a' },
}

export function AfiliadoDashboardClient({ slug, storeName, baseUrl }: { slug: string; storeName: string; baseUrl: string }) {
  const router = useRouter()
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [stats,     setStats]     = useState<AffiliateStats | null>(null)
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([])
  const [loading,   setLoading]   = useState(true)
  const [copied,    setCopied]    = useState(false)

  const load = useCallback(async () => {
    const aff = await fetchCurrentAffiliate(slug)
    if (!aff) {
      router.push(`/loja/${slug}/afiliado/entrar`)
      return
    }
    setAffiliate(aff)
    const [s, c] = await Promise.all([fetchMyStats(slug), fetchMyCommissions(slug)])
    setStats(s)
    setCommissions(c)
    setLoading(false)
  }, [slug, router])

  useEffect(() => { void load() }, [load])

  const logout = () => {
    clearAffiliateToken(slug)
    router.push(`/loja/${slug}`)
  }

  const copyLink = async () => {
    if (!affiliate) return
    const link = `${baseUrl}?ref=${affiliate.code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  if (loading || !affiliate) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--c-text-muted)' }}>
        <Loader2 className="animate-spin inline-block" size={24} />
      </div>
    )
  }

  const isApproved = affiliate.status === 'approved'
  const personalLink = `${baseUrl}?ref=${affiliate.code}`

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href={`/loja/${slug}`} className="text-xs hover:underline inline-flex items-center gap-1"
          style={{ color: 'var(--c-text-muted)' }}>
          <ChevronLeft size={12} /> Voltar pra loja
        </Link>
        <button onClick={logout}
          className="text-xs px-3 py-2 rounded inline-flex items-center gap-1.5"
          style={{ background: 'transparent', color: 'var(--c-text-muted)', border: '1px solid var(--c-border)', minHeight: 36 }}>
          <LogOut size={12} /> Sair
        </button>
      </div>

      {/* Status banner */}
      <div className="rounded-xl p-5"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ background: isApproved ? '#22c55e' : '#f59e0b', color: '#000' }}>
            {affiliate.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--c-text)', fontFamily: 'var(--f-heading)' }}>
              Olá, {affiliate.name.split(' ')[0]}!
            </h1>
            <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
              {affiliate.email} ·{' '}
              {affiliate.status === 'pending' && <span style={{ color: '#f59e0b' }}>⏳ Cadastro aguardando aprovação</span>}
              {affiliate.status === 'approved' && <span style={{ color: '#22c55e' }}>✓ Afiliado aprovado</span>}
              {affiliate.status === 'rejected' && <span style={{ color: '#ef4444' }}>✗ Cadastro rejeitado</span>}
              {affiliate.status === 'suspended' && <span style={{ color: '#71717a' }}>⊘ Suspenso</span>}
            </p>
          </div>
        </div>

        {!isApproved && (
          <div className="mt-4 p-3 rounded text-sm"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
            <AlertCircle size={14} className="inline mr-2" />
            {affiliate.status === 'pending' && 'Aguarde a aprovação do lojista pra começar a usar seu link.'}
            {affiliate.status === 'rejected' && 'Seu cadastro foi rejeitado. Contate o lojista.'}
            {affiliate.status === 'suspended' && 'Seu cadastro foi suspenso. Contate o lojista.'}
          </div>
        )}
      </div>

      {/* Link personalizado */}
      {isApproved && (
        <div className="rounded-xl p-5"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-primary)' }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--c-primary)' }}>
            🔗 Seu link personalizado
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--c-text-muted)' }}>
            Divulgue esse link nas redes. Quando alguém comprar pela primeira vez, você ganha comissão.
          </p>
          <div className="flex gap-2">
            <input readOnly value={personalLink}
              className="flex-1 px-3 py-2 text-sm rounded outline-none font-mono"
              style={{ background: 'var(--c-bg)', color: 'var(--c-text)', border: '1px solid var(--c-border)', minHeight: 44 }} />
            <button onClick={copyLink}
              className="text-sm px-4 py-2 rounded font-semibold inline-flex items-center gap-2"
              style={{
                background: copied ? '#22c55e' : 'var(--c-primary)',
                color: '#000', minHeight: 44,
              }}>
              {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
            </button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: 'var(--c-text-muted)' }}>
            Code: <strong className="font-mono" style={{ color: 'var(--c-primary)' }}>{affiliate.code}</strong>
          </p>
        </div>
      )}

      {/* Stats */}
      {stats && isApproved && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--c-text-muted)' }}>
            Suas estatísticas
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<MousePointer size={14} />} label="Cliques 24h"  value={String(stats.clicks_today)} />
            <StatCard icon={<MousePointer size={14} />} label="Cliques 7 dias" value={String(stats.clicks_7d)} />
            <StatCard icon={<MousePointer size={14} />} label="Cliques 30 dias" value={String(stats.clicks_30d)} />
            <StatCard icon={<ShoppingBag size={14} />}  label="Total de vendas" value={String(stats.orders_total)} />
          </div>

          <h2 className="text-sm font-semibold uppercase tracking-wide mt-6 mb-3" style={{ color: 'var(--c-text-muted)' }}>
            Suas comissões
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Clock size={14} />}  label="Pendente"    value={brl(stats.pending_cents / 100)}  color="#f59e0b" />
            <StatCard icon={<Wallet size={14} />} label="A receber"   value={brl(stats.approved_cents / 100)} color="#3b82f6" />
            <StatCard icon={<Wallet size={14} />} label="Já recebido" value={brl(stats.paid_cents / 100)}     color="#22c55e" />
          </div>
        </div>
      )}

      {/* Histórico */}
      {isApproved && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--c-text-muted)' }}>
            Histórico de comissões
          </h2>
          {commissions.length === 0 ? (
            <div className="rounded-lg p-8 text-center"
              style={{ background: 'var(--c-surface)', border: '1px dashed var(--c-border)' }}>
              <Wallet size={32} className="mx-auto mb-2" style={{ color: 'var(--c-text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
                Ainda não rolou nenhuma venda do seu link
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)' }}>
                Compartilhe e divulgue mais!
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {commissions.map(c => {
                const meta = COMM_STATUS[c.status] ?? { label: c.status, color: '#71717a' }
                return (
                  <li key={c.id} className="rounded-lg p-3 flex items-center justify-between gap-3"
                    style={{ background: 'var(--c-surface)', border: `1px solid ${meta.color}30` }}>
                    <div className="min-w-0">
                      <p className="text-sm" style={{ color: 'var(--c-text)' }}>
                        Pedido <strong className="font-mono">#{c.order_id.slice(0, 8).toUpperCase()}</strong>
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                        {brl(c.order_total_cents / 100)} × {c.commission_pct}% · {new Date(c.created_at).toLocaleDateString('pt-BR')}
                        {' · '}
                        <span style={{ color: meta.color }}>{meta.label}</span>
                      </p>
                    </div>
                    <span className="text-lg font-bold" style={{ color: meta.color }}>
                      {brl(c.amount_cents / 100)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-center pt-6" style={{ color: 'var(--c-text-muted)' }}>
        {storeName} · Programa de Afiliados
      </p>
    </main>
  )
}

function StatCard({ icon, label, value, color = 'var(--c-text)' }: {
  icon: React.ReactNode; label: string; value: string; color?: string
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-center gap-2 text-xs mb-1.5" style={{ color: 'var(--c-text-muted)' }}>
        {icon} {label}
      </div>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  )
}
