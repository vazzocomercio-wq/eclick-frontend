'use client'
/* eslint-disable @next/next/no-img-element -- thumbs do IG são URLs externas/efêmeras do CDN; next/image não cabe */

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart3, Loader2, RefreshCw, Eye, Users, TrendingUp,
  Sparkles, ShoppingBag, AtSign, Share2, MessageCircle, Megaphone,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

// ── Tipos do /analytics/overview ───────────────────────────────────────────
interface Account {
  network: string
  external_account_id: string
  label: string
  status: string
}
interface TopPost {
  permalink: string | null
  caption: string
  type: string | null
  thumbnail_url: string | null
  reach: number
  views: number
  engagement_rate: number
}
interface Overview {
  accounts: { total: number; by_network: Record<string, number>; list: Account[] }
  organic: {
    posts_count: number; total_reach: number; total_views: number
    total_engagement: number; avg_engagement_rate: number; top_posts: TopPost[]
    account: { followers_count: number; reach: number; profile_views: number } | null
  }
  geo: { audits: number; avg_score: number; distribution: Record<string, number> }
  paid: { connected: boolean; note: string }
  generated_at: string
}

const NETWORK_LABEL: Record<string, string> = {
  mercadolivre: 'Mercado Livre', instagram: 'Instagram', facebook: 'Facebook',
  whatsapp: 'WhatsApp', tiktok: 'TikTok', store: 'Loja', meta_ads: 'Meta Ads',
  google_ads: 'Google Ads', ai_engine: 'IA',
}
function netIcon(n: string) {
  const p = { size: 13 }
  if (n === 'instagram') return <AtSign {...p} />
  if (n === 'facebook') return <Share2 {...p} />
  if (n === 'whatsapp') return <MessageCircle {...p} />
  if (n === 'mercadolivre') return <ShoppingBag {...p} />
  return <Megaphone {...p} />
}

const nf = (n: number) => n.toLocaleString('pt-BR')
const pct = (n: number) => `${(n * 100).toFixed(2)}%`

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await createClient().auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } : null
}

// ── Sub-componentes ────────────────────────────────────────────────────────
function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#111114', border: '1px solid #1e1e24' }}>
      <div className="flex items-center gap-2" style={{ color: '#a1a1aa' }}>
        <span style={{ color: '#00E5FF' }}>{icon}</span>
        <span className="text-[12px]">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: '#fafafa' }}>{value}</div>
      {hint && <div className="text-[11px]" style={{ color: '#52525b' }}>{hint}</div>}
    </div>
  )
}

function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-4" style={{ background: '#111114', border: '1px solid rgba(0,229,255,0.18)' }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: '#fafafa' }}>{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  )
}

// ── Tela ───────────────────────────────────────────────────────────────────
export default function AnalyticsClient() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const headers = await authHeaders()
    if (!headers) { setError('Sessão expirada — recarregue a página.'); setLoading(false); return }
    try {
      const res = await fetch(`${BACKEND}/analytics/overview`, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData((await res.json()) as Overview)
    } catch (e) {
      setError(`Não consegui carregar o painel (${String(e)}).`)
    } finally {
      setLoading(false)
    }
  }, [])

  // Dispara a coleta orgânica e recarrega o overview.
  const collect = useCallback(async () => {
    setRefreshing(true)
    const headers = await authHeaders()
    if (headers) {
      try { await fetch(`${BACKEND}/analytics/organic/collect`, { method: 'POST', headers }) } catch { /* segue */ }
    }
    await load()
    setRefreshing(false)
  }, [load])

  useEffect(() => { void load() }, [load])

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto" style={{ color: '#fafafa' }}>
      {/* Hero */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center rounded-2xl shrink-0"
            style={{ width: 56, height: 56, background: 'rgba(0,229,255,0.10)', border: '1px solid rgba(0,229,255,0.25)', boxShadow: '0 0 32px -12px rgba(0,229,255,0.4)' }}>
            <BarChart3 size={28} style={{ color: '#00E5FF' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="mt-1.5 text-sm leading-relaxed max-w-2xl" style={{ color: '#a1a1aa' }}>
              Visão unificada de performance — orgânico, marketplace, visibilidade em IA e
              anúncios, de todas as suas contas e redes num só lugar.
            </p>
          </div>
        </div>
        <button onClick={collect} disabled={refreshing || loading}
          className="flex items-center gap-2 text-[13px] font-medium px-3 py-2 rounded-lg shrink-0 transition-colors disabled:opacity-50"
          style={{ background: 'rgba(0,229,255,0.10)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.35)' }}>
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Atualizar dados
        </button>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm mt-6" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl p-8 flex items-center gap-3 mt-8" style={{ background: '#18181b', border: '1px solid #27272a' }}>
          <Loader2 size={22} className="animate-spin" style={{ color: '#00E5FF' }} />
          <span className="text-sm" style={{ color: '#a1a1aa' }}>Carregando seu painel…</span>
        </div>
      ) : data ? (
        <>
          {/* Contas conectadas */}
          <div className="flex flex-wrap items-center gap-2 mt-8">
            <span className="text-[12px] font-medium" style={{ color: '#71717a' }}>
              {data.accounts.total} conta(s) conectada(s):
            </span>
            {Object.entries(data.accounts.by_network).map(([net, count]) => (
              <span key={net} className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full"
                style={{ background: '#18181b', color: '#d4d4d8', border: '1px solid #27272a' }}>
                <span style={{ color: '#00E5FF' }}>{netIcon(net)}</span>
                {NETWORK_LABEL[net] ?? net}{count > 1 ? ` ×${count}` : ''}
              </span>
            ))}
          </div>

          {/* KPIs orgânicos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <Kpi icon={<Eye size={15} />} label="Alcance (orgânico)" value={nf(data.organic.total_reach)} hint={`${data.organic.posts_count} posts/reels`} />
            <Kpi icon={<TrendingUp size={15} />} label="Visualizações" value={nf(data.organic.total_views)} />
            <Kpi icon={<Sparkles size={15} />} label="Engajamento" value={nf(data.organic.total_engagement)} hint={`taxa média ${pct(data.organic.avg_engagement_rate)}`} />
            <Kpi icon={<Users size={15} />} label="Seguidores" value={data.organic.account ? nf(data.organic.account.followers_count) : '—'} hint={data.organic.account ? `${nf(data.organic.account.profile_views)} visitas ao perfil` : undefined} />
          </div>

          {/* Cards: top posts + GEO + pago */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            {/* Top posts */}
            <div className="lg:col-span-2">
              <Card title="Top conteúdo orgânico" badge={<span className="text-[11px]" style={{ color: '#52525b' }}>por alcance</span>}>
                {data.organic.top_posts.length === 0 ? (
                  <p className="text-sm" style={{ color: '#71717a' }}>Sem posts coletados ainda. Clique em “Atualizar dados”.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.organic.top_posts.map((p, i) => (
                      <a key={i} href={p.permalink ?? '#'} target="_blank" rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:opacity-90"
                        style={{ background: '#0d0d10', border: '1px solid #1e1e24' }}>
                        {p.thumbnail_url
                          ? <img src={p.thumbnail_url} alt="" className="rounded object-cover shrink-0" style={{ width: 44, height: 44 }} />
                          : <div className="rounded shrink-0" style={{ width: 44, height: 44, background: '#1e1e24' }} />}
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] truncate" style={{ color: '#d4d4d8' }}>{p.caption || '(sem legenda)'}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: '#52525b' }}>
                            {p.type ?? 'POST'} · {nf(p.reach)} alcance · {nf(p.views)} views
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* GEO + Pago */}
            <div className="flex flex-col gap-4">
              <Card title="Visibilidade em IA (GEO)">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold" style={{ color: '#00E5FF' }}>{data.geo.avg_score}</span>
                  <span className="text-[12px]" style={{ color: '#71717a' }}>nota média · {nf(data.geo.audits)} análises</span>
                </div>
                <div className="flex flex-col gap-1.5 text-[11px]" style={{ color: '#a1a1aa' }}>
                  <DistBar label="Crítico (0–30)" v={data.geo.distribution.critico_0_30} total={data.geo.audits} color="#f87171" />
                  <DistBar label="Fraco (31–60)" v={data.geo.distribution.fraco_31_60} total={data.geo.audits} color="#fcd34d" />
                  <DistBar label="Bom (61–80)" v={data.geo.distribution.bom_61_80} total={data.geo.audits} color="#a5f3fc" />
                  <DistBar label="Ótimo (81–100)" v={data.geo.distribution.otimo_81_100} total={data.geo.audits} color="#4ade80" />
                </div>
              </Card>
              <Card title="Anúncios pagos">
                <p className="text-[13px]" style={{ color: data.paid.connected ? '#a1a1aa' : '#71717a' }}>
                  {data.paid.connected ? 'Conectado' : data.paid.note}
                </p>
              </Card>
            </div>
          </div>

          <p className="text-[11px] mt-6" style={{ color: '#3f3f46' }}>
            Atualizado em {new Date(data.generated_at).toLocaleString('pt-BR')}
          </p>
        </>
      ) : null}
    </div>
  )
}

function DistBar({ label, v, total, color }: { label: string; v: number; total: number; color: string }) {
  const w = total > 0 ? Math.round((v / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1e24' }}>
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
      </div>
      <span className="w-8 text-right" style={{ color: '#d4d4d8' }}>{nf(v)}</span>
    </div>
  )
}
