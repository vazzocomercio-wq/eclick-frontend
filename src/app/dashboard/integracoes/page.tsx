'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

// ── types ────────────────────────────────────────────────────────────────────

type MlStatus = {
  seller_id: number
  expires_at: string
  access_token: string
} | null

type Toast = { id: number; msg: string; type: 'success' | 'error' }

// ── helpers ──────────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

// ── toast ────────────────────────────────────────────────────────────────────

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

// ── ML Card ──────────────────────────────────────────────────────────────────

function MercadoLivreCard({
  status,
  onConnect,
  onDisconnect,
  loading,
}: {
  status: MlStatus
  onConnect: () => void
  onDisconnect: () => void
  loading: boolean
}) {
  const connected = !!status

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#111114', border: '1px solid #1e1e24' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid #1e1e24' }}>
        <div className="flex items-center gap-3">
          {/* ML logo placeholder */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
            style={{ background: '#ffe600', color: '#333' }}
          >
            ML
          </div>
          <div>
            <p className="text-white text-sm font-semibold">Mercado Livre</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              {connected ? `Conta #${status!.seller_id} conectada` : 'Não conectado'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {connected && (
            <span
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Ativo
            </span>
          )}

          {connected ? (
            <button
              onClick={onDisconnect}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-all disabled:opacity-50"
              style={{ borderColor: '#3f3f46', color: '#f87171', background: 'transparent' }}
            >
              {loading ? 'Desconectando…' : 'Desconectar'}
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: '#ffe600', color: '#333' }}
            >
              {loading ? 'Aguarde…' : 'Conectar conta'}
            </button>
          )}
        </div>
      </div>

      {/* Body — connected stats */}
      {connected && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px" style={{ background: '#1e1e24' }}>
          {[
            { label: 'Seller ID', value: String(status!.seller_id) },
            { label: 'Token expira', value: new Date(status!.expires_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) },
            { label: 'Status', value: 'Autenticado' },
          ].map(({ label, value }) => (
            <div key={label} className="px-5 py-4" style={{ background: '#111114' }}>
              <p className="text-zinc-500 text-xs mb-1">{label}</p>
              <p className="text-white text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Body — not connected info */}
      {!connected && (
        <div className="px-6 py-5">
          <p className="text-zinc-400 text-sm leading-relaxed">
            Conecte sua conta do Mercado Livre para sincronizar anúncios, pedidos e métricas automaticamente.
          </p>
          <ul className="mt-4 space-y-2">
            {[
              'Importar anúncios existentes com um clique',
              'Ver métricas de visitas e vendas em tempo real',
              'Atualizar preços e estoque diretamente',
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
      )}
    </div>
  )
}

// ── Coming soon card ─────────────────────────────────────────────────────────

function ComingSoonCard({ name, logo, color }: { name: string; logo: string; color: string }) {
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
          <p className="text-zinc-500 text-xs mt-0.5">Em breve</p>
        </div>
      </div>
      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: '#1e1e24', color: '#52525b' }}>
        Em breve
      </span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IntegracoesPage() {
  const [mlStatus, setMlStatus] = useState<MlStatus>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  function toast(msg: string, type: Toast['type'] = 'success') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // Load ML connection status
  useEffect(() => {
    ;(async () => {
      const token = await getToken()
      if (!token) { setLoadingStatus(false); return }
      try {
        const res = await fetch(`${BACKEND}/ml/status`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setMlStatus(data ?? null)
        }
      } catch (_) {}
      setLoadingStatus(false)
    })()
  }, [])

  function handleConnect() {
    const clientId = process.env.NEXT_PUBLIC_ML_CLIENT_ID
    const redirectUri = process.env.NEXT_PUBLIC_ML_REDIRECT_URI
    if (!clientId || !redirectUri) {
      toast('Configuração ML ausente (CLIENT_ID ou REDIRECT_URI).', 'error')
      return
    }
    const mlAuthUrl =
      `https://auth.mercadolivre.com.br/authorization?response_type=code` +
      `&client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`
    window.location.href = mlAuthUrl
  }

  async function handleDisconnect() {
    setActionLoading(true)
    const token = await getToken()
    if (!token) { toast('Sessão expirada.', 'error'); setActionLoading(false); return }

    const res = await fetch(`${BACKEND}/ml/disconnect`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    setActionLoading(false)
    if (res.ok || res.status === 204) {
      setMlStatus(null)
      toast('Mercado Livre desconectado.')
    } else {
      toast('Erro ao desconectar.', 'error')
    }
  }

  return (
    <>
      <div className="flex flex-col h-full" style={{ background: '#09090b' }}>
        {/* Top bar */}
        <div className="shrink-0 px-6 pt-6 pb-5" style={{ borderBottom: '1px solid #1e1e24' }}>
          <h1 className="text-white text-lg font-semibold">Integrações</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Conecte suas contas de marketplace para sincronizar dados automaticamente.</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-7 space-y-4">
            <p className="text-zinc-500 text-[11px] uppercase tracking-widest font-semibold mb-2">Marketplaces</p>

            {loadingStatus ? (
              <div className="h-36 rounded-2xl animate-pulse" style={{ background: '#111114' }} />
            ) : (
              <MercadoLivreCard
                status={mlStatus}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                loading={actionLoading}
              />
            )}

            <ComingSoonCard name="Shopee" logo="SP" color="#ee4d2d" />
            <ComingSoonCard name="Amazon" logo="AZ" color="#ff9900" />
            <ComingSoonCard name="Shopify" logo="SH" color="#96bf48" />
          </div>
        </div>
      </div>

      <Toasts toasts={toasts} />
    </>
  )
}
