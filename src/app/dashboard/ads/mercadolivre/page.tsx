'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  RefreshCw, Megaphone, ExternalLink, TrendingUp,
  Eye, Zap, AlertCircle, CheckCircle2,
} from 'lucide-react'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

type MlConn = { seller_id: number; nickname: string | null; expires_at: string }
type Listing = {
  id: string; title: string; price: number; available_quantity: number
  sold_quantity: number; status: string; thumbnail?: string; permalink?: string
  listing_type_id?: string
}
type ListingCounts = { active: number; paused: number; under_review: number; closed: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TYPE_LABEL: Record<string, string> = {
  gold_special:    'Gold Special',
  gold_pro:        'Gold Pro',
  gold:            'Gold',
  silver:          'Silver',
  bronze:          'Bronze',
  free:            'Grátis',
  classified:      'Classificado',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AccountCard({ conn }: { conn: MlConn }) {
  const expired = new Date(conn.expires_at).getTime() - Date.now() < 0
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
        style={{ background: 'rgba(255,230,0,0.12)', color: '#FFE600' }}>
        {(conn.nickname ?? `${conn.seller_id}`).charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200">{conn.nickname ?? `Conta #${conn.seller_id}`}</p>
        <p className="text-[10px] text-zinc-500">ID {conn.seller_id}</p>
      </div>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: expired ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)', color: expired ? '#f87171' : '#4ade80' }}>
        {expired ? 'Token expirado' : 'Conectado'}
      </span>
    </div>
  )
}

function ListingRow({ listing }: { listing: Listing }) {
  const typeLabel = TYPE_LABEL[listing.listing_type_id ?? ''] ?? listing.listing_type_id ?? '—'
  const isPremium = ['gold_special', 'gold_pro', 'gold'].includes(listing.listing_type_id ?? '')
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: '#1e1e24' }}>
      {listing.thumbnail && (
        <img src={listing.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" loading="lazy" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-zinc-200 truncate">{listing.title}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-zinc-500">{fmtBRL(listing.price)}</span>
          <span className="text-[10px] text-zinc-600">{listing.sold_quantity} vendas</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: isPremium ? 'rgba(255,230,0,0.08)' : '#1e1e24', color: isPremium ? '#FFE600' : '#52525b' }}>
            {typeLabel}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!isPremium && (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
            <Zap size={9} />
            Impulsionar
          </span>
        )}
        {listing.permalink && (
          <a href={listing.permalink} target="_blank" rel="noreferrer"
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Ver no ML">
            <ExternalLink size={12} className="text-zinc-500" />
          </a>
        )}
      </div>
    </div>
  )
}

// ── ML Ads info panel ─────────────────────────────────────────────────────────

function MLAdsInfoPanel() {
  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2">
        <Megaphone size={13} style={{ color: '#FFE600' }} />
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Product Ads — Mercado Livre</h3>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">
        Os <strong className="text-zinc-200">Product Ads</strong> permitem que seus anúncios apareçam em destaque nos resultados de busca e nas páginas de produto do Mercado Livre.
        Você paga apenas quando o comprador clica no anúncio (CPC).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: <Eye size={13} />, label: 'Mais visibilidade', desc: 'Seus produtos aparecem no topo dos resultados.' },
          { icon: <TrendingUp size={13} />, label: 'CPC automático', desc: 'O ML otimiza os lances para maximizar conversões.' },
          { icon: <Zap size={13} />, label: 'Fácil ativação', desc: 'Ative ou pause campanhas a qualquer momento.' },
        ].map(f => (
          <div key={f.label} className="rounded-xl p-3 space-y-1.5" style={{ background: '#18181b', border: '1px solid #27272a' }}>
            <span style={{ color: '#FFE600' }}>{f.icon}</span>
            <p className="text-xs font-semibold text-zinc-300">{f.label}</p>
            <p className="text-[10px] text-zinc-500">{f.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)' }}>
        <AlertCircle size={13} className="text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          O gerenciamento direto de campanhas via API do ML Ads será disponibilizado em breve.
          Por enquanto, acesse o <a href="https://ads.mercadolivre.com.br" target="_blank" rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline transition-colors">painel do Mercado Ads</a> para criar e gerenciar suas campanhas.
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MLAdsPage() {
  const [conns,    setConns]    = useState<MlConn[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [counts,   setCounts]   = useState<ListingCounts | null>(null)
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setLoading(false); return }
    const h = { Authorization: `Bearer ${session.access_token}` }

    try {
      const [connRes, listRes, cntRes] = await Promise.allSettled([
        fetch(`${BACKEND}/ml/connections`,       { headers: h }),
        fetch(`${BACKEND}/ml/listings?limit=20`, { headers: h }),
        fetch(`${BACKEND}/ml/listings/counts`,   { headers: h }),
      ])
      if (connRes.status === 'fulfilled' && connRes.value.ok)  setConns(await connRes.value.json())
      if (listRes.status === 'fulfilled' && listRes.value.ok)  {
        const d = await listRes.value.json(); setListings(d?.listings ?? d ?? [])
      }
      if (cntRes.status === 'fulfilled' && cntRes.value.ok)    setCounts(await cntRes.value.json())
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const nonPremium = listings.filter(l => !['gold_special', 'gold_pro', 'gold'].includes(l.listing_type_id ?? ''))

  return (
    <div className="p-6 space-y-7 min-h-full" style={{ background: '#09090b' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-zinc-500 text-xs">Ads</p>
          <h2 className="text-white text-lg font-semibold mt-0.5">ML Ads</h2>
          <p className="text-zinc-500 text-xs mt-1">Product Ads e impulsionamento de anúncios no Mercado Livre.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60"
          style={{ borderColor: '#3f3f46', color: '#a1a1aa' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Account status */}
      {conns.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-green-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Contas conectadas</span>
          </div>
          <div className="space-y-2">
            {conns.map(c => <AccountCard key={c.seller_id} conn={c} />)}
          </div>
        </div>
      ) : !loading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
          <AlertCircle size={13} className="text-red-400 shrink-0" />
          <p className="text-xs text-zinc-400">Nenhuma conta do Mercado Livre conectada. Acesse <strong className="text-zinc-200">Configurações → Integrações</strong> para conectar.</p>
        </div>
      )}

      {/* Listing counts */}
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'active',       label: 'Ativos',          color: '#4ade80' },
            { key: 'paused',       label: 'Pausados',        color: '#facc15' },
            { key: 'under_review', label: 'Em análise',      color: '#60a5fa' },
            { key: 'closed',       label: 'Encerrados',      color: '#71717a' },
          ].map(({ key, label, color }) => (
            <div key={key} className="rounded-2xl p-4" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#52525b' }}>{label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color }}>{(counts as any)[key] ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* ML Ads info */}
      <MLAdsInfoPanel />

      {/* Listings to boost */}
      {listings.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1e1e24' }}>
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-cyan-400" />
              <span className="text-xs font-semibold text-zinc-300">Anúncios ativos</span>
            </div>
            <span className="text-[10px] text-zinc-600">
              {nonPremium.length} sem plano premium
            </span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-600 text-xs">Carregando…</div>
          ) : (
            <div>
              {listings.slice(0, 15).map(l => <ListingRow key={l.id} listing={l} />)}
              {listings.length > 15 && (
                <p className="text-center text-[10px] text-zinc-600 py-3">+{listings.length - 15} anúncios</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
