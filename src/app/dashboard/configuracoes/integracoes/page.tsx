'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { CheckCircle2, XCircle, Clock, RefreshCw, Plug, Zap } from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type MlConn = { seller_id: number; nickname: string | null; expires_at: string }
type IntegStatus = 'connected' | 'expired' | 'disconnected' | 'soon'

// ── Helpers ───────────────────────────────────────────────────────────────────

function connStatus(conn: MlConn): IntegStatus {
  return new Date(conn.expires_at).getTime() - Date.now() < 0 ? 'expired' : 'connected'
}

const STATUS_CFG: Record<IntegStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  connected:    { label: 'Conectado',      color: '#4ade80', bg: 'rgba(74,222,128,0.1)',   icon: <CheckCircle2 size={11} /> },
  expired:      { label: 'Token expirado', color: '#f87171', bg: 'rgba(248,113,113,0.1)',  icon: <XCircle size={11} /> },
  disconnected: { label: 'Desconectado',   color: '#71717a', bg: 'rgba(113,113,122,0.12)', icon: <XCircle size={11} /> },
  soon:         { label: 'Em breve',       color: '#52525b', bg: 'rgba(82,82,91,0.15)',    icon: <Clock size={11} /> },
}

function StatusBadge({ status }: { status: IntegStatus }) {
  const c = STATUS_CFG[status]
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.color }}>
      {c.icon} {c.label}
    </span>
  )
}

// ── Integration card ──────────────────────────────────────────────────────────

function IntegCard({
  name, abbr, abbrBg, abbrColor, status, description, accounts, onConnect, onDisconnect,
}: {
  name: string; abbr: string; abbrBg: string; abbrColor: string
  status: IntegStatus; description: string
  accounts?: MlConn[]
  onConnect?: () => void
  onDisconnect?: (sellerId: number) => void
}) {
  const isSoon = status === 'soon'
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111114', border: '1px solid #1e1e24', opacity: isSoon ? 0.65 : 1 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs font-black"
            style={{ background: abbrBg + (isSoon ? '60' : ''), color: abbrColor }}>
            {abbr}
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-200">{name}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{description}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Connected ML accounts */}
      {accounts && accounts.length > 0 && (
        <div className="space-y-1">
          {accounts.map(acc => {
            const st  = connStatus(acc)
            const cfg = STATUS_CFG[st]
            return (
              <div key={acc.seller_id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: '#18181b', border: '1px solid #27272a' }}>
                <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold"
                  style={{ background: 'rgba(255,230,0,0.12)', color: '#FFE600' }}>
                  {(acc.nickname ?? `${acc.seller_id}`).charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] font-medium text-zinc-300 flex-1 truncate">{acc.nickname ?? `Conta #${acc.seller_id}`}</span>
                <span className="text-[9px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                {onDisconnect && (
                  <button onClick={() => onDisconnect(acc.seller_id)}
                    className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
                    style={{ color: '#71717a', border: '1px solid #2e2e33' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}>
                    Remover
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!isSoon && onConnect && (
        <button onClick={onConnect}
          className="flex items-center gap-1.5 w-full justify-center py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: accounts && accounts.length > 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,229,255,0.1)',
            color:      accounts && accounts.length > 0 ? '#71717a' : '#00E5FF',
            border:    `1px solid ${accounts && accounts.length > 0 ? '#2e2e33' : 'rgba(0,229,255,0.25)'}`,
          }}>
          <Plug size={11} />
          {accounts && accounts.length > 0 ? 'Adicionar conta' : 'Conectar'}
        </button>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-zinc-600">{icon}</span>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{children}</div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegracoesPage() {
  const [mlConns, setMlConns] = useState<MlConn[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setLoading(false); return }
    try {
      const res = await fetch(`${BACKEND}/ml/connections`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (res.ok) setMlConns(await res.json())
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function connectML() {
    setConnecting(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    const redirectUri = `${window.location.origin}/dashboard/integracoes/ml/callback`
    try {
      const res = await fetch(`${BACKEND}/ml/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.ok) { const { url } = await res.json(); window.location.href = url }
    } finally { setConnecting(false) }
  }

  async function disconnectML(sellerId: number) {
    if (!confirm(`Remover integração ML ${sellerId}?`)) return
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    await fetch(`${BACKEND}/ml/disconnect?seller_id=${sellerId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } })
    setMlConns(cs => cs.filter(c => c.seller_id !== sellerId))
  }

  const overallMlStatus: IntegStatus = loading ? 'disconnected'
    : mlConns.length === 0 ? 'disconnected'
    : mlConns.some(c => new Date(c.expires_at).getTime() - Date.now() < 0) ? 'expired'
    : 'connected'

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Configurações</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">Integrações</h2>
          <p className="text-zinc-500 text-xs mt-1">Conecte marketplaces, ERPs e ferramentas ao eClick.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Marketplaces */}
      <Section title="Marketplaces" icon={<Zap size={13} />}>
        <IntegCard
          name="Mercado Livre" abbr="ML" abbrBg="rgba(255,230,0,0.15)" abbrColor="#FFE600"
          status={connecting ? 'disconnected' : overallMlStatus}
          description="OAuth 2.0 · token renovado automaticamente pelo backend."
          accounts={mlConns} onConnect={connectML} onDisconnect={disconnectML}
        />
        {([
          { name: 'Shopee',     abbr: 'SH', bg: '#EE4D2D', fg: '#fff', desc: 'Sincronize pedidos, estoque e anúncios.' },
          { name: 'Amazon',     abbr: 'AZ', bg: '#FF9900', fg: '#111', desc: 'Amazon Seller Central via SP-API.' },
          { name: 'Magalu',     abbr: 'MG', bg: '#0086FF', fg: '#fff', desc: 'Magazine Luiza Marketplace.' },
          { name: 'Americanas', abbr: 'AM', bg: '#e8002d', fg: '#fff', desc: 'Marketplace Americanas.' },
        ] as const).map(m => (
          <IntegCard key={m.name} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
            status="soon" description={m.desc} />
        ))}
      </Section>

      {/* ERP */}
      <Section title="ERP & Gestão" icon={<Plug size={13} />}>
        {([
          { name: 'Bling',     abbr: 'BL', bg: '#0055A5', fg: '#fff', desc: 'NF-e, pedidos e estoque via Bling ERP.' },
          { name: 'Omie',      abbr: 'OM', bg: '#FF6B35', fg: '#fff', desc: 'Integração bidirecional com Omie.' },
          { name: 'ContaAzul', abbr: 'CA', bg: '#1E90FF', fg: '#fff', desc: 'Financeiro e conciliação via ContaAzul.' },
          { name: 'Tiny ERP',  abbr: 'TN', bg: '#00C16E', fg: '#fff', desc: 'Emissão de NF-e e gestão via Tiny.' },
        ] as const).map(m => (
          <IntegCard key={m.name} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
            status="soon" description={m.desc} />
        ))}
      </Section>

      {/* Frete */}
      <Section title="Frete & Logística" icon={<Plug size={13} />}>
        {([
          { name: 'Melhor Envio', abbr: 'ME', bg: '#6C4EF2', fg: '#fff', desc: 'Cotação automática e etiquetas.' },
          { name: 'Frenet',       abbr: 'FR', bg: '#1a56db', fg: '#fff', desc: 'Multi-transportadora em tempo real.' },
          { name: 'ClickPost',    abbr: 'CP', bg: '#06b6d4', fg: '#fff', desc: 'Rastreamento unificado de encomendas.' },
        ] as const).map(m => (
          <IntegCard key={m.name} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
            status="soon" description={m.desc} />
        ))}
      </Section>

      {/* Fiscal */}
      <Section title="Fiscal & NF-e" icon={<Plug size={13} />}>
        {([
          { name: 'Focus NFe', abbr: 'FN', bg: '#7c3aed', fg: '#fff', desc: 'Emissão automática de NF-e e NFC-e.' },
          { name: 'Nfe.io',    abbr: 'NI', bg: '#059669', fg: '#fff', desc: 'API de emissão de notas fiscais.' },
          { name: 'eNotas',    abbr: 'EN', bg: '#0284c7', fg: '#fff', desc: 'NFS-e e NF-e em escala.' },
        ] as const).map(m => (
          <IntegCard key={m.name} name={m.name} abbr={m.abbr} abbrBg={m.bg} abbrColor={m.fg}
            status="soon" description={m.desc} />
        ))}
      </Section>

      <p className="text-[10px] text-zinc-700">
        Novas integrações são adicionadas continuamente. Entre em contato para priorizar uma integração específica.
      </p>
    </div>
  )
}
