'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { CheckCircle2, AlertCircle, Plus, Trash2, RefreshCw, ExternalLink, Clock } from 'lucide-react'
import { useConfirm, useAlert } from '@/components/ui/dialog-provider'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Types ─────────────────────────────────────────────────────────────────────

type MlConnection = {
  seller_id: number
  nickname: string | null
  expires_at: string
  created_at: string
  organization_id: string
}

type ListingCounts = {
  active: number
  paused: number
  closed: number
  under_review: number
}

type SalesKpis = {
  count: number
  revenue: number
  avg_ticket: number
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

// ── Token status ──────────────────────────────────────────────────────────────

function tokenStatus(expiresAt: string): { ok: boolean; label: string } {
  const ms  = new Date(expiresAt).getTime() - Date.now()
  if (ms < 0)              return { ok: false, label: 'Token expirado' }
  if (ms < 60 * 60 * 1000) return { ok: false, label: 'Expira em breve' }
  const h = Math.floor(ms / 3_600_000)
  if (h < 24)              return { ok: true, label: `Expira em ${h}h` }
  const d = Math.floor(h / 24)
  return { ok: true, label: `Expira em ${d}d` }
}

// ── ML Account Row ────────────────────────────────────────────────────────────

function MlAccountRow({
  conn,
  onDisconnect,
  disconnecting,
}: {
  conn: MlConnection
  onDisconnect: (sellerId: number) => void
  disconnecting: boolean
}) {
  const ts = tokenStatus(conn.expires_at)
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
        style={{ background: 'rgba(255,230,0,0.12)', color: '#FFE600', border: '1px solid rgba(255,230,0,0.2)' }}>
        {(conn.nickname ?? `${conn.seller_id}`).charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{conn.nickname ?? `Conta #${conn.seller_id}`}</p>
        <p className="text-[10px] text-zinc-500 font-mono">ID {conn.seller_id}</p>
      </div>

      {/* Token status */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold`}
        style={{
          background: ts.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          color: ts.ok ? '#4ade80' : '#f87171',
          border: `1px solid ${ts.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
        }}>
        <Clock size={10} />
        {ts.label}
      </div>

      {/* Connected badge */}
      <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold"
        style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
        <CheckCircle2 size={10} /> Conectado
      </div>

      {/* Disconnect */}
      <button
        onClick={() => onDisconnect(conn.seller_id)}
        disabled={disconnecting}
        title="Desconectar conta"
        className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
        style={{ color: '#71717a' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
        onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── Future channel card ───────────────────────────────────────────────────────

function FutureChannelCard({ name, color, abbr, bg }: { name: string; color: string; abbr: string; bg: string }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
          style={{ background: bg, color }}>
          {abbr}
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm">{name}</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: '#27272a', color: '#71717a' }}>
            Em breve
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {['Anúncios ativos', 'Vendas este mês', 'Receita', 'Integração'].map(l => (
          <div key={l} className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-600">{l}</span>
            <div className="h-3 w-16 rounded animate-none" style={{ background: '#1e1e24' }} />
          </div>
        ))}
      </div>
      <button disabled
        className="w-full py-2 rounded-xl text-xs font-semibold transition-all opacity-40 cursor-not-allowed"
        style={{ background: '#1c1c1f', color: '#71717a', border: '1px solid #2e2e33' }}>
        Conectar {name}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CanaisPage() {
  const [connections, setConnections] = useState<MlConnection[]>([])
  const [counts, setCounts]           = useState<ListingCounts | null>(null)
  const [kpis, setKpis]               = useState<SalesKpis | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [disconnecting, setDisconn]   = useState(false)
  const [connecting, setConnecting]   = useState(false)
  const confirm = useConfirm()
  const alert   = useAlert()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error('Sessão expirada')
      const h = { Authorization: `Bearer ${token}` }

      const [connRes, countsRes, kpisRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/connections`,     { headers: h }),
        fetch(`${BACKEND}/ml/listings/counts`, { headers: h }),
        fetch(`${BACKEND}/ml/orders/kpis`,     { headers: h }),
      ])

      if (connRes.status === 'fulfilled' && connRes.value.ok) {
        setConnections(await connRes.value.json())
      }
      if (countsRes.status === 'fulfilled' && countsRes.value.ok) {
        setCounts(await countsRes.value.json())
      }
      if (kpisRes.status === 'fulfilled' && kpisRes.value.ok) {
        const d = await kpisRes.value.json()
        const cm = d?.current_month ?? {}
        setKpis({ count: cm.count ?? 0, revenue: cm.revenue ?? 0, avg_ticket: cm.count > 0 ? (cm.revenue ?? 0) / cm.count : 0 })
      }
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar canais')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDisconnect(sellerId: number) {
    const ok = await confirm({
      title:        'Desconectar conta ML',
      message:      `Desconectar a conta ML ${sellerId}?`,
      confirmLabel: 'Desconectar',
      variant:      'warning',
    })
    if (!ok) return
    setDisconn(true)
    try {
      const token = await getToken()
      await fetch(`${BACKEND}/ml/disconnect?seller_id=${sellerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      await load()
    } finally {
      setDisconn(false)
    }
  }

  async function handleConnect() {
    setConnecting(true)
    try {
      const token = await getToken()
      const redirectUri = `${window.location.origin}/dashboard/integracoes/ml/callback`
      const res = await fetch(`${BACKEND}/ml/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erro ao gerar URL de autenticação')
      const { url } = await res.json()
      window.location.href = url
    } catch (e: any) {
      await alert({
        title:   'Erro',
        message: e.message,
        variant: 'danger',
      })
      setConnecting(false)
    }
  }

  const totalListings = counts ? counts.active + counts.paused + counts.closed + counts.under_review : null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Comercial</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Canais de Venda</h2>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Channel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* ── Mercado Livre ── */}
        <div className="lg:col-span-2 rounded-2xl p-5 space-y-5" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          {/* Card header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
                style={{ background: 'rgba(255,230,0,0.12)', color: '#FFE600', border: '1px solid rgba(255,230,0,0.2)' }}>
                ML
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Mercado Livre</h3>
                <span className="text-[10px] font-medium" style={{ color: '#4ade80' }}>
                  {loading ? '…' : `${connections.length} conta${connections.length !== 1 ? 's' : ''} conectada${connections.length !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
            <a href="https://www.mercadolivre.com.br/vendas" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
              Painel ML <ExternalLink size={11} />
            </a>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Anúncios ativos',  value: loading ? '…' : (counts?.active ?? '—'),           color: '#4ade80' },
              { label: 'Pausados',         value: loading ? '…' : (counts?.paused ?? '—'),           color: '#f59e0b' },
              { label: 'Vendas este mês',  value: loading ? '…' : (kpis?.count ?? '—'),              color: '#00E5FF' },
              { label: 'Receita este mês', value: loading ? '…' : (kpis ? brl(kpis.revenue) : '—'), color: '#a78bfa' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-xl p-3" style={{ background: '#18181b', border: '1px solid #27272a' }}>
                <p className="text-[10px] text-zinc-500 font-medium leading-snug">{kpi.label}</p>
                <p className="text-lg font-black mt-1" style={{ color: kpi.color }}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Listing breakdown */}
          {!loading && counts && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Distribuição de anúncios</p>
                <p className="text-[10px] text-zinc-600">{totalListings?.toLocaleString('pt-BR')} total</p>
              </div>
              {totalListings && totalListings > 0 ? (
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                  {[
                    { val: counts.active,       color: '#4ade80' },
                    { val: counts.paused,        color: '#f59e0b' },
                    { val: counts.under_review,  color: '#60a5fa' },
                    { val: counts.closed,        color: '#3f3f46' },
                  ].map((s, i) => s.val > 0 && (
                    <div key={i} className="rounded-sm" title={`${s.val}`}
                      style={{ background: s.color, flex: s.val }} />
                  ))}
                </div>
              ) : (
                <div className="h-2 rounded-full" style={{ background: '#1e1e24' }} />
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {[
                  { label: 'Ativos',       val: counts.active,      color: '#4ade80' },
                  { label: 'Pausados',     val: counts.paused,      color: '#f59e0b' },
                  { label: 'Em revisão',   val: counts.under_review, color: '#60a5fa' },
                  { label: 'Encerrados',   val: counts.closed,      color: '#52525b' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                    <span className="text-[10px] text-zinc-500">{s.label}: <strong style={{ color: s.color }}>{s.val}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected accounts */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Contas conectadas</p>
            {loading ? (
              [...Array(2)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#18181b' }} />
              ))
            ) : connections.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: '#18181b', border: '1px solid #27272a' }}>
                <AlertCircle size={14} className="text-zinc-600 shrink-0" />
                <p className="text-xs text-zinc-500">Nenhuma conta conectada.</p>
              </div>
            ) : (
              connections.map(c => (
                <MlAccountRow key={c.seller_id} conn={c} onDisconnect={handleDisconnect} disconnecting={disconnecting} />
              ))
            )}
          </div>

          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={connecting || loading}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
            style={{ background: 'rgba(255,230,0,0.08)', color: '#FFE600', border: '1px solid rgba(255,230,0,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,230,0,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,230,0,0.08)')}>
            <Plus size={14} />
            {connecting ? 'Redirecionando…' : 'Conectar nova conta ML'}
          </button>
        </div>

        {/* ── Shopee ── */}
        <FutureChannelCard name="Shopee" color="#fff" abbr="SH" bg="#EE4D2D" />

        {/* ── Amazon ── */}
        <FutureChannelCard name="Amazon" color="#111" abbr="AZ" bg="#FF9900" />

      </div>

      {/* Second row: Magalu + more future */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FutureChannelCard name="Magalu" color="#fff" abbr="MG" bg="#0086FF" />
        <FutureChannelCard name="Americanas" color="#fff" abbr="AM" bg="#e8002d" />
        <FutureChannelCard name="Via Varejo" color="#fff" abbr="VV" bg="#e31212" />
      </div>

      {/* Info footer */}
      <p className="text-[10px] text-zinc-700">
        Mercado Livre usa OAuth 2.0 — o token é renovado automaticamente pelo backend a cada 6 horas.
        Para reconectar uma conta expirada, use o botão "Conectar nova conta ML".
      </p>
    </div>
  )
}
