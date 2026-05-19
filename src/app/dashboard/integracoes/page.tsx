'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type MlAccount = {
  seller_id: number
  expires_at: string
  nickname: string | null
  created_at: string
}

type Toast = { id: number; msg: string; type: 'success' | 'error' }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() < Date.now()
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl pointer-events-auto"
          style={{
            background: t.type === 'success' ? '#111114' : '#1a0a0a',
            border: `1px solid ${t.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: t.type === 'success' ? '#34d399' : '#f87171',
          }}>
          {t.type === 'success'
            ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          }
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── ML Account Card ───────────────────────────────────────────────────────────

function MlAccountCard({
  account,
  onDisconnect,
  disconnecting,
}: {
  account: MlAccount
  onDisconnect: (sellerId: number) => void
  disconnecting: number | null
}) {
  const t = useTranslations('integracoes')
  const expired = isExpired(account.expires_at)
  const loading = disconnecting === account.seller_id

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
            style={{ background: '#ffe600', color: '#333' }}
          >
            ML
          </div>
          <div>
            <p className="text-white text-sm font-semibold">
              {account.nickname ?? t('account.unnamed', { id: account.seller_id })}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">{t('account.id')}: {account.seller_id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={expired
              ? { background: 'rgba(248,113,113,0.1)', color: '#f87171' }
              : { background: 'rgba(52,211,153,0.1)', color: '#34d399' }}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${expired ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`} />
            {expired ? t('account.expired') : t('account.active')}
          </span>
          <button
            onClick={() => onDisconnect(account.seller_id)}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-all disabled:opacity-50"
            style={{ borderColor: '#3f3f46', color: '#f87171', background: 'transparent' }}
          >
            {loading ? t('account.removing') : t('account.disconnect')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px" style={{ background: '#1e1e24' }}>
        {[
          { label: t('account.nickname'), value: account.nickname ?? `#${account.seller_id}` },
          { label: t('account.tokenExpires'), value: new Date(account.expires_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) },
          { label: t('account.connectedAt'), value: account.created_at ? new Date(account.created_at).toLocaleDateString('pt-BR') : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="px-5 py-4" style={{ background: '#111114' }}>
            <p className="text-zinc-500 text-xs mb-1">{label}</p>
            <p className="text-white text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Add account card ──────────────────────────────────────────────────────────

function AddMlAccountCard({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations('integracoes')
  return (
    <button
      onClick={onAdd}
      className="w-full rounded-2xl p-5 flex items-center gap-4 transition-colors hover:bg-zinc-900 text-left"
      style={{ background: '#0a0a0e', border: '2px dashed #27272a' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: '#1e1e24' }}
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#71717a" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <div>
        <p className="text-zinc-300 text-sm font-medium">{t('addMlAccount.title')}</p>
        <p className="text-zinc-600 text-xs mt-0.5">{t('addMlAccount.subtitle')}</p>
      </div>
    </button>
  )
}

// ── Not connected state ───────────────────────────────────────────────────────

function MlNotConnected({ onConnect }: { onConnect: () => void }) {
  const t = useTranslations('integracoes')
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
            style={{ background: '#ffe600', color: '#333' }}>
            ML
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Mercado Livre</p>
            <p className="text-zinc-500 text-xs mt-0.5">{t('notConnected.status')}</p>
          </div>
        </div>
        <button
          onClick={onConnect}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
          style={{ background: '#ffe600', color: '#333' }}
        >
          {t('notConnected.connectButton')}
        </button>
      </div>
      <div className="px-6 py-5">
        <p className="text-zinc-400 text-sm leading-relaxed">
          {t('notConnected.description')}
        </p>
        <ul className="mt-4 space-y-2">
          {[
            t('notConnected.benefit1'),
            t('notConnected.benefit2'),
            t('notConnected.benefit3'),
          ].map(item => (
            <li key={item} className="flex items-start gap-2 text-sm text-zinc-500">
              <svg className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Coming soon card ──────────────────────────────────────────────────────────

function ComingSoonCard({ name, logo, color }: { name: string; logo: string; color: string }) {
  const t = useTranslations('integracoes')
  return (
    <div
      className="rounded-2xl px-6 py-5 flex items-center justify-between opacity-50"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: color + '22', color }}
        >
          {logo}
        </div>
        <div>
          <p className="text-white text-sm font-semibold">{name}</p>
          <p className="text-zinc-500 text-xs mt-0.5">{t('comingSoon')}</p>
        </div>
      </div>
      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: '#1e1e24', color: '#52525b' }}>
        {t('comingSoon')}
      </span>
    </div>
  )
}

// ── Marketplace connect card (Shopee/Magalu) ──────────────────────────────────

function MarketplaceConnectCard({
  name, logo, color, description, onConnect, connecting,
}: {
  name: string
  logo: string
  color: string
  description: string
  onConnect: () => void
  connecting: boolean
}) {
  const t = useTranslations('integracoes')
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: color, color: '#fff' }}
          >
            {logo}
          </div>
          <div>
            <p className="text-white text-sm font-semibold">{name}</p>
            <p className="text-zinc-500 text-xs mt-0.5">{description}</p>
          </div>
        </div>
        <button
          onClick={onConnect}
          disabled={connecting}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: color, color: '#fff' }}
        >
          {connecting ? t('marketplaceCard.opening') : t('marketplaceCard.connect')}
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IntegracoesPage() {
  const t = useTranslations('integracoes')
  const [accounts, setAccounts] = useState<MlAccount[]>([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [disconnecting, setDisconnecting] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [connectingShopee, setConnectingShopee] = useState(false)
  const [connectingMagalu, setConnectingMagalu] = useState(false)

  function toast(msg: string, type: Toast['type'] = 'success') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  async function startOAuth(platform: 'shopee' | 'magalu') {
    const setLoading = platform === 'shopee' ? setConnectingShopee : setConnectingMagalu
    setLoading(true)
    const token = await getToken()
    if (!token) { toast(t('toast.sessionExpired'), 'error'); setLoading(false); return }
    try {
      const res = await fetch(`${BACKEND}/marketplace/${platform}/auth-url`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast(body?.message ?? t('toast.oauthStartFailed', { platform }), 'error')
        setLoading(false)
        return
      }
      const data = await res.json()
      if (!data?.url) { toast(t('toast.invalidBackendResponse'), 'error'); setLoading(false); return }
      window.location.href = data.url
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast(`${t('toast.networkError')}: ${msg}`, 'error')
      setLoading(false)
    }
  }

  const loadAccounts = useCallback(async () => {
    const token = await getToken()
    if (!token) { setLoadingStatus(false); return }
    try {
      const res = await fetch(`${BACKEND}/ml/connections`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setAccounts(Array.isArray(data) ? data : [])
      } else {
        console.error('[ML connections] resposta:', res.status, res.statusText)
      }
    } catch (err) {
      console.error('[ML connections] erro de rede:', err)
    }
    setLoadingStatus(false)
  }, [])

  useEffect(() => {
    const search = window.location.search
    if (search.includes('connected=1')) {
      const params = new URLSearchParams(search)
      const platform = params.get('platform') ?? 'ml'
      const nick = params.get('nickname')
      const platformLabel: Record<string, string> = {
        ml: 'Mercado Livre', shopee: 'Shopee', magalu: 'Magalu',
      }
      const label = platformLabel[platform] ?? platform
      toast(nick
        ? t('toast.connectedAs', { label, nick })
        : t('toast.connected', { label }), 'success')
      window.history.replaceState({}, '', window.location.pathname)
    }
    loadAccounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAccounts])

  function handleConnect() {
    const clientId = process.env.NEXT_PUBLIC_ML_CLIENT_ID
    const redirectUri = process.env.NEXT_PUBLIC_ML_REDIRECT_URI
    if (!clientId || !redirectUri) {
      toast(t('toast.mlConfigMissing'), 'error')
      return
    }
    window.location.href =
      `https://auth.mercadolivre.com.br/authorization?response_type=code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`
  }

  async function handleDisconnect(sellerId: number) {
    setDisconnecting(sellerId)
    const token = await getToken()
    if (!token) { toast(t('toast.sessionExpired'), 'error'); setDisconnecting(null); return }

    const res = await fetch(`${BACKEND}/ml/disconnect?seller_id=${sellerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    setDisconnecting(null)
    if (res.ok || res.status === 204) {
      setAccounts(prev => prev.filter(a => a.seller_id !== sellerId))
      toast(t('toast.accountDisconnected'))
    } else {
      toast(t('toast.disconnectError'), 'error')
    }
  }

  return (
    <>
      <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>
        <div className="shrink-0 px-6 pt-6 pb-5" style={{ borderBottom: '1px solid #1e1e24' }}>
          <h1 className="text-white text-lg font-semibold">{t('title')}</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{t('subtitle')}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-7 space-y-4">
            <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-semibold mb-2">{t('marketplacesLabel')}</p>

            {/* Mercado Livre section */}
            {loadingStatus ? (
              <div className="h-36 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
            ) : accounts.length === 0 ? (
              <MlNotConnected onConnect={handleConnect} />
            ) : (
              <div className="space-y-3">
                {/* Header label */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                      style={{ background: '#ffe600', color: '#333' }}>
                      ML
                    </div>
                    <span className="text-zinc-300 text-sm font-medium">Mercado Livre</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                      {t('connectedAccountsCount', { count: accounts.length })}
                    </span>
                  </div>
                </div>

                {/* Connected account cards */}
                {accounts.map(acc => (
                  <MlAccountCard
                    key={acc.seller_id}
                    account={acc}
                    onDisconnect={handleDisconnect}
                    disconnecting={disconnecting}
                  />
                ))}

                {/* Add another account */}
                <AddMlAccountCard onAdd={handleConnect} />
              </div>
            )}

            <MarketplaceConnectCard
              name="Shopee"
              logo="SP"
              color="#ee4d2d"
              description={t('shopeeDescription')}
              onConnect={() => startOAuth('shopee')}
              connecting={connectingShopee}
            />

            <MarketplaceConnectCard
              name="Magalu"
              logo="ML"
              color="#0086ff"
              description={t('magaluDescription')}
              onConnect={() => startOAuth('magalu')}
              connecting={connectingMagalu}
            />

            <ComingSoonCard name="Amazon"  logo="AZ" color="#ff9900" />
            <ComingSoonCard name="Shopify" logo="SH" color="#96bf48" />
          </div>
        </div>
      </div>

      <Toasts toasts={toasts} />
    </>
  )
}
