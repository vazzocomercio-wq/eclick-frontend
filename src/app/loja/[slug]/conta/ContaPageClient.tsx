'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut, Package, User, Wallet, Trophy, ChevronLeft, ExternalLink } from 'lucide-react'
import {
  fetchCurrentCustomer, fetchMyOrders, clearCustomerToken,
  type Customer, type CustomerOrder,
} from '@/lib/storefront/customer-auth'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

const brl = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  if (!Number.isFinite(n)) return 'R$ 0,00'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABEL: Record<string, string> = {
  pending:            'Aguardando pagamento',
  awaiting_payment:   'Aguardando pagamento',
  paid:               'Pago',
  cancelled:          'Cancelado',
  failed:             'Falhou',
  expired:            'Expirado',
  refunded:           'Reembolsado',
}

const SHIPPING_LABEL: Record<string, string> = {
  pending:    'Aguardando envio',
  preparing:  'Em preparação',
  shipped:    'Enviado',
  in_transit: 'Em trânsito',
  delivered:  'Entregue',
  returned:   'Devolvido',
  lost:       'Perdido',
}

export function ContaPageClient({ slug, storeName }: { slug: string; storeName: string }) {
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [cashback, setCashback] = useState<number>(0)
  const [tier, setTier] = useState<{ name: string; color: string; emoji: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const cur = await fetchCurrentCustomer(slug)
    if (!cur) {
      router.push(`/loja/${slug}/conta/entrar`)
      return
    }
    setCustomer(cur)

    // Paralelo: pedidos + cashback + loyalty
    const [orderList, cashRes, loyalRes] = await Promise.all([
      fetchMyOrders(slug),
      fetch(`${BACKEND}/public/cashback/by-slug/${encodeURIComponent(slug)}/balance?email=${encodeURIComponent(cur.email)}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${BACKEND}/public/loyalty/by-slug/${encodeURIComponent(slug)}/customer?email=${encodeURIComponent(cur.email)}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])

    setOrders(orderList)
    if (cashRes && (cashRes as { enabled?: boolean }).enabled) {
      setCashback((cashRes as { balance: number }).balance ?? 0)
    }
    if (loyalRes && (loyalRes as { enabled?: boolean }).enabled && (loyalRes as { currentTier?: unknown }).currentTier) {
      const t = (loyalRes as { currentTier: { name: string; color: string; icon_emoji: string | null } }).currentTier
      setTier({ name: t.name, color: t.color, emoji: t.icon_emoji })
    }
    setLoading(false)
  }, [slug, router])

  useEffect(() => { void load() }, [load])

  const logout = () => {
    clearCustomerToken(slug)
    router.push(`/loja/${slug}`)
  }

  if (loading || !customer) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--c-text-muted)' }}>
        <Loader2 className="animate-spin inline-block" size={24} />
      </div>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
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

      {/* Header */}
      <div className="rounded-xl p-5 sm:p-6"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ background: 'var(--c-primary)', color: 'var(--c-on-accent, #000)' }}>
            {customer.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--c-text)', fontFamily: 'var(--f-heading)' }}>
              Olá, {customer.name.split(' ')[0]}!
            </h1>
            <p className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
              {customer.email}
            </p>
          </div>
        </div>
      </div>

      {/* Cards de status (cashback + tier) */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl p-5"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--c-text-muted)' }}>
            <Wallet size={14} /> Seu cashback
          </div>
          <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>
            {brl(cashback / 100)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)' }}>
            {cashback > 0 ? 'Disponível pra usar no próximo pedido' : 'Faça compras pra acumular'}
          </p>
        </div>

        <div className="rounded-xl p-5"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--c-text-muted)' }}>
            <Trophy size={14} /> Seu nível
          </div>
          {tier ? (
            <>
              <p className="text-2xl font-bold flex items-center gap-2" style={{ color: tier.color }}>
                <span>{tier.emoji ?? '⭐'}</span> {tier.name}
              </p>
              <Link href={`/loja/${slug}/fidelidade`}
                className="text-xs hover:underline inline-flex items-center gap-1 mt-1"
                style={{ color: 'var(--c-text-muted)' }}>
                Ver benefícios <ExternalLink size={10} />
              </Link>
            </>
          ) : (
            <>
              <p className="text-base" style={{ color: 'var(--c-text-muted)' }}>—</p>
              <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)' }}>Sem nível ainda</p>
            </>
          )}
        </div>
      </div>

      {/* Histórico de pedidos */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2"
          style={{ color: 'var(--c-text-muted)' }}>
          <Package size={14} /> Meus pedidos
        </h2>

        {orders.length === 0 ? (
          <div className="rounded-lg p-8 text-center"
            style={{ background: 'var(--c-surface)', border: '1px dashed var(--c-border)' }}>
            <Package size={32} className="mx-auto mb-2" style={{ color: 'var(--c-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
              Você ainda não tem pedidos
            </p>
            <Link href={`/loja/${slug}`}
              className="inline-block mt-3 px-4 py-2 text-sm font-semibold"
              style={{
                background: 'var(--c-primary)', color: 'var(--c-on-accent, #000)',
                borderRadius: 'var(--r)', minHeight: 44,
              }}>
              Ver produtos
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {orders.map(o => (
              <li key={o.id} className="rounded-lg p-3"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                <Link href={`/loja/${slug}/pedido/${o.id}/sucesso`}
                  className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
                      Pedido #{o.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                      {o.items_count} {o.items_count === 1 ? 'item' : 'itens'} · {new Date(o.created_at).toLocaleDateString('pt-BR')}
                      {' · '}
                      <span style={{ color: o.status === 'paid' ? '#22c55e' : 'var(--c-text-muted)' }}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      {o.shipping_status && o.status === 'paid' && (
                        <> · <span style={{ color: o.shipping_status === 'delivered' ? '#22c55e' : '#06b6d4' }}>
                          {SHIPPING_LABEL[o.shipping_status] ?? o.shipping_status}
                        </span></>
                      )}
                    </p>
                    {o.tracking_code && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                        Rastreio: <strong style={{ color: 'var(--c-text)' }}>{o.tracking_code}</strong>
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold" style={{ color: 'var(--c-primary)' }}>
                      {brl(o.total)}
                    </p>
                    <ExternalLink size={11} className="inline ml-1" style={{ color: 'var(--c-text-muted)' }} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dados pessoais */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2"
          style={{ color: 'var(--c-text-muted)' }}>
          <User size={14} /> Meus dados
        </h2>
        <div className="rounded-lg p-4 space-y-2 text-sm"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <p><strong style={{ color: 'var(--c-text)' }}>Nome:</strong> <span style={{ color: 'var(--c-text-muted)' }}>{customer.name}</span></p>
          <p><strong style={{ color: 'var(--c-text)' }}>Email:</strong> <span style={{ color: 'var(--c-text-muted)' }}>{customer.email}</span></p>
          {customer.phone && <p><strong style={{ color: 'var(--c-text)' }}>Telefone:</strong> <span style={{ color: 'var(--c-text-muted)' }}>{customer.phone}</span></p>}
          {customer.doc && <p><strong style={{ color: 'var(--c-text)' }}>Documento:</strong> <span style={{ color: 'var(--c-text-muted)' }}>{customer.doc}</span></p>}
        </div>
      </div>

      <p className="text-xs text-center pt-6" style={{ color: 'var(--c-text-muted)' }}>
        {storeName} · Conta exclusiva desta loja
      </p>
    </main>
  )
}
