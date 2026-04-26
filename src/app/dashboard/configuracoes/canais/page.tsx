'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { CheckCircle2, AlertCircle, Clock, Plug, RefreshCw, ExternalLink } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Channel = {
  id: string
  name: string
  logo_url: string | null
  api_status: 'available' | 'coming_soon' | 'deprecated'
  is_integrated: boolean
  integration_status: 'connected' | 'expired' | 'error' | 'never_connected' | null
  last_token_check: string | null
  created_at: string
}

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' }

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  connected:        { label: 'Integrado',        color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   border: 'rgba(74,222,128,0.3)',   icon: <CheckCircle2 size={14} /> },
  expired:          { label: 'Token expirado',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.3)',   icon: <AlertCircle size={14} /> },
  error:            { label: 'Erro',             color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.3)',  icon: <AlertCircle size={14} /> },
  never_connected:  { label: 'Não integrado',    color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.3)',   icon: <Plug size={14} /> },
  coming_soon:      { label: 'Em breve',         color: '#71717a', bg: 'rgba(113,113,122,0.1)',  border: 'rgba(113,113,122,0.3)',  icon: <Clock size={14} /> },
}

function timeAgo(iso?: string | null) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)   return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`
  return `${Math.floor(diff / 86400000)}d atrás`
}

function statusKey(c: Channel): string {
  if (c.api_status === 'coming_soon') return 'coming_soon'
  if (c.is_integrated && c.integration_status === 'connected') return 'connected'
  if (c.integration_status === 'expired') return 'expired'
  if (c.integration_status === 'error')   return 'error'
  return 'never_connected'
}

export default function CanaisPage() {
  const supabase = useMemo(() => createClient(), [])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading,  setLoading]  = useState(true)
  const [toasts,   setToasts]   = useState<Toast[]>([])

  const pushToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${BACKEND}/channels`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setChannels(await res.json() as Channel[])
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : 'Erro ao carregar canais', 'error')
    } finally { setLoading(false) }
  }, [getHeaders, pushToast])

  useEffect(() => { load() }, [load])

  function handleConnect(c: Channel) {
    if (c.id === 'mercadolivre') {
      // ML já tem fluxo em /configuracoes/integracoes — mandar pra lá
      window.location.href = '/dashboard/configuracoes/integracoes'
      return
    }
    pushToast(`OAuth para ${c.name} ainda não disponível — em breve`, 'info')
  }

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-semibold">Canais de Marketplace</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Conecte suas contas para sincronizar estoque, preços e pedidos automaticamente.
          Modo de distribuição automática só funciona com canais integrados.
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="rounded-2xl h-40 animate-pulse" style={{ background: '#111114', border: '1px solid #1a1a1f' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map(c => {
            const sk  = statusKey(c)
            const cfg = STATUS_CFG[sk]
            const isComingSoon = c.api_status === 'coming_soon'
            const isConnected  = sk === 'connected'

            return (
              <div key={c.id} className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: '#111114', border: '1px solid #1a1a1f' }}>

                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: '#1a1a1f', color: '#a1a1aa' }}>
                      {c.logo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={c.logo_url} alt={c.name} className="w-full h-full rounded-lg object-cover" />
                        : c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{c.name}</p>
                      <p className="text-zinc-600 text-[11px] font-mono">{c.id}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>

                {/* Last check */}
                {c.last_token_check && (
                  <p className="text-zinc-600 text-[11px]">
                    Última verificação: <span className="text-zinc-400">{timeAgo(c.last_token_check)}</span>
                  </p>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Action */}
                {isComingSoon ? (
                  <button disabled
                    className="w-full py-2 rounded-xl text-xs font-semibold opacity-50 cursor-not-allowed"
                    style={{ background: '#1a1a1f', color: '#71717a', border: '1px solid #27272a' }}>
                    Em breve
                  </button>
                ) : isConnected ? (
                  <button onClick={() => handleConnect(c)}
                    className="w-full py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    style={{ background: '#1a1a1f', color: '#a1a1aa', border: '1px solid #27272a' }}>
                    <RefreshCw size={12} /> Reconectar
                  </button>
                ) : (
                  <button onClick={() => handleConnect(c)}
                    className="w-full py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    style={{ background: '#00E5FF', color: '#000' }}>
                    <Plug size={12} /> Conectar via OAuth
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info card */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)' }}>
        <div className="flex items-start gap-3">
          <ExternalLink size={16} style={{ color: '#00E5FF' }} className="mt-0.5 shrink-0" />
          <div className="text-[12px] text-zinc-400 space-y-1">
            <p>O <span className="text-zinc-200 font-semibold">Mercado Livre</span> usa OAuth via tela de Integrações.</p>
            <p>Os demais canais estão sendo desenvolvidos — assim que ficarem prontos, o botão acima vai abrir o fluxo de autorização.</p>
            <Link href="/dashboard/configuracoes/integracoes"
              className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold"
              style={{ color: '#00E5FF' }}>
              Ir para Integrações <ExternalLink size={11} />
            </Link>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 space-y-2">
          {toasts.map(t => (
            <div key={t.id}
              className="px-4 py-3 rounded-xl text-xs font-semibold"
              style={{
                background: t.type === 'success' ? 'rgba(74,222,128,0.1)'   : t.type === 'error' ? 'rgba(248,113,113,0.1)'   : 'rgba(0,229,255,0.1)',
                color:      t.type === 'success' ? '#4ade80'                : t.type === 'error' ? '#f87171'                : '#00E5FF',
                border:    `1px solid ${t.type === 'success' ? 'rgba(74,222,128,0.3)' : t.type === 'error' ? 'rgba(248,113,113,0.3)' : 'rgba(0,229,255,0.3)'}`,
              }}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
