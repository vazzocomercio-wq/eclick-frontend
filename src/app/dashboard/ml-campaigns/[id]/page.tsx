'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, ExternalLink, Sparkles, Clock, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Campaign {
  id:                          string
  ml_campaign_id:              string
  ml_promotion_type:           string
  name:                        string | null
  start_date:                  string | null
  finish_date:                 string | null
  deadline_date:               string | null
  status:                      string
  candidate_count:             number
  pending_count:               number
  started_count:               number
  has_subsidy_items:           boolean
  items_with_subsidy_count:    number
  avg_meli_subsidy_pct:        number | null
  seller_id:                   number
}

interface Item {
  id:                          string
  ml_item_id:                  string
  status:                      string
  original_price:              number | null
  current_price:               number | null
  suggested_discounted_price:  number | null
  min_discounted_price:        number | null
  max_discounted_price:        number | null
  meli_percentage:             number | null
  seller_percentage:           number | null
  has_meli_subsidy:            boolean
  meli_subsidy_amount:         number | null
  estimated_margin_brl:        number | null
  estimated_margin_pct:        number | null
  health_status:               string | null
  health_warnings:             Array<{ code: string; message: string }>
  product_id:                  string | null
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

function brl(v: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { selected: selectedSellerId } = useMlAccount()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [items, setItems]       = useState<Item[]>([])
  const [total, setTotal]       = useState(0)
  const [statusFilter, setStatusFilter] = useState<'candidate' | 'started' | ''>('candidate')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const sidQ = sid != null ? `?seller_id=${sid}` : ''
      const sidQAmp = sid != null ? `&seller_id=${sid}` : ''

      const [cRes, iRes] = await Promise.all([
        fetch(`${BACKEND}/ml-campaigns/${id}${sidQ}`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${BACKEND}/ml-campaigns/${id}/items?limit=100${sidQAmp}${statusFilter ? `&status=${statusFilter}` : ''}`, {
          headers: { Authorization: `Bearer ${t}` },
        }),
      ])
      if (!cRes.ok) throw new Error(`HTTP ${cRes.status}`)
      const text = await cRes.text()
      setCampaign(text ? JSON.parse(text) : null)

      if (iRes.ok) {
        const body = await iRes.json()
        setItems(body.items ?? [])
        setTotal(body.total ?? 0)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id, statusFilter])

  useEffect(() => { void load() }, [load, selectedSellerId])

  if (loading && !campaign) {
    return (
      <div className="p-6 max-w-6xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" /> Carregando…
        </div>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="p-6 max-w-6xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
        <Link href="/dashboard/ml-campaigns/list" className="inline-flex items-center gap-1 text-cyan-400 text-xs mb-3">
          <ArrowLeft size={12} /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error || 'Campanha não encontrada.'}
        </div>
      </div>
    )
  }

  const totalItems = campaign.candidate_count + campaign.pending_count + campaign.started_count

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
        <span>/</span>
        <Link href="/dashboard/ml-campaigns/list" className="hover:text-cyan-400">Campanhas</Link>
        <span>/</span>
        <span className="text-zinc-300 font-mono">{campaign.ml_campaign_id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <CampaignTypeBadge type={campaign.ml_promotion_type} />
            <StatusBadge status={campaign.status} />
            {campaign.has_subsidy_items && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-semibold"
                style={{ background: 'rgba(0,229,255,0.1)', color: '#67e8f9', border: '1px solid rgba(0,229,255,0.3)' }}>
                <Sparkles size={10} />
                ML subsidia ~{campaign.avg_meli_subsidy_pct?.toFixed(1) ?? '?'}%
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold">
            {campaign.name ?? `${campaign.ml_promotion_type} ${campaign.ml_campaign_id}`}
          </h1>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500 mt-1 flex-wrap">
            <span className="font-mono">{campaign.ml_campaign_id}</span>
            <span>seller {campaign.seller_id}</span>
            {campaign.deadline_date && (
              <span className="flex items-center gap-1 text-amber-400">
                <Clock size={10} /> Aderir até {new Date(campaign.deadline_date).toLocaleDateString('pt-BR')}
              </span>
            )}
            {campaign.finish_date && (
              <span>Encerra em {new Date(campaign.finish_date).toLocaleDateString('pt-BR')}</span>
            )}
          </div>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Counter label="Candidatos"   value={campaign.candidate_count} color="#00E5FF" />
        <Counter label="Programados"  value={campaign.pending_count}   color="#a78bfa" />
        <Counter label="Participando" value={campaign.started_count}   color="#22c55e" />
        <Counter label="Total"        value={totalItems}                color="#fafafa" />
      </div>

      {/* Items toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 mt-4">
        <h2 className="text-sm font-semibold">Anúncios</h2>
        <div className="flex items-center gap-1 text-xs">
          {[
            { v: '',           label: 'Todos' },
            { v: 'candidate',  label: `Candidatos (${campaign.candidate_count})` },
            { v: 'started',    label: `Participando (${campaign.started_count})` },
          ].map(opt => (
            <button key={opt.v}
              onClick={() => setStatusFilter(opt.v as any)}
              className="px-2.5 py-1 rounded-lg transition-all"
              style={{
                background: statusFilter === opt.v ? 'rgba(0,229,255,0.15)' : '#0c0c10',
                border: `1px solid ${statusFilter === opt.v ? 'rgba(0,229,255,0.4)' : '#1a1a1f'}`,
                color: statusFilter === opt.v ? '#67e8f9' : '#a1a1aa',
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      {items.length === 0 && !loading && (
        <div className="rounded-xl p-6 text-center text-xs text-zinc-500"
          style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          Nenhum anúncio nesse status.
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => <ItemRow key={item.id} item={item} />)}
          {total > items.length && (
            <p className="text-[11px] text-zinc-500 text-center pt-2">
              Mostrando {items.length} de {total}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item }: { item: Item }) {
  const showcasePrice = item.current_price ?? item.suggested_discounted_price
  const discount = (item.original_price && showcasePrice)
    ? Math.round(((item.original_price - showcasePrice) / item.original_price) * 100)
    : null

  return (
    <div className="rounded-lg p-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
      <div className="flex items-start gap-3">
        {/* MLB ID + status */}
        <div className="flex-shrink-0 w-32">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-zinc-200 truncate">{item.ml_item_id}</span>
            <a href={`https://www.mercadolivre.com.br/${item.ml_item_id}`} target="_blank" rel="noreferrer"
              className="text-cyan-400 hover:underline flex-shrink-0">
              <ExternalLink size={10} />
            </a>
          </div>
          <ItemStatusBadge status={item.status} />
        </div>

        {/* Preços */}
        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-500">Preço original</p>
            <p className="text-zinc-300 font-medium">{brl(item.original_price)}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-500">
              {item.status === 'started' ? 'Preço promocional' : 'Sugerido ML'}
            </p>
            <p className="font-medium" style={{ color: discount && discount > 0 ? '#22c55e' : '#fafafa' }}>
              {brl(showcasePrice)}
              {discount && discount > 0 && (
                <span className="ml-1 text-[10px] text-emerald-400">−{discount}%</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-500">Mínimo aceito</p>
            <p className="text-zinc-300 font-medium">{brl(item.min_discounted_price)}</p>
          </div>
        </div>

        {/* Subsídio */}
        {item.has_meli_subsidy && (
          <div className="flex-shrink-0 px-2 py-1.5 rounded text-right"
            style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
            <p className="text-[9px] uppercase tracking-wider text-cyan-300">ML reduz</p>
            <p className="text-cyan-400 font-bold text-sm">
              {item.meli_subsidy_amount ? brl(item.meli_subsidy_amount) : `${item.meli_percentage?.toFixed(1)}%`}
            </p>
          </div>
        )}

        {/* M.C. (placeholder até K2) */}
        {item.estimated_margin_pct != null && (
          <div className="flex-shrink-0 px-2 py-1.5 rounded text-right"
            style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p className="text-[9px] uppercase tracking-wider text-emerald-300">M.C.</p>
            <p className="text-emerald-400 font-bold text-sm">{item.estimated_margin_pct.toFixed(1)}%</p>
          </div>
        )}

        {/* Health warning */}
        {item.health_status && item.health_status !== 'ready' && (
          <div className="flex-shrink-0 text-amber-400 text-[10px] uppercase tracking-wider font-semibold">
            ⚠ {item.health_status.replace('_', ' ')}
          </div>
        )}
      </div>
    </div>
  )
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0c0c10', border: `1px solid ${color}30` }}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function CampaignTypeBadge({ type }: { type: string }) {
  return (
    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold"
      style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.4)' }}>
      {type}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    started:  { label: 'ATIVA',       color: '#22c55e' },
    pending:  { label: 'PROGRAMADA',  color: '#a78bfa' },
    finished: { label: 'ENCERRADA',   color: '#71717a' },
    paused:   { label: 'PAUSADA',     color: '#fbbf24' },
    expired:  { label: 'EXPIRADA',    color: '#ef4444' },
  }
  const m = map[status] ?? { label: status, color: '#71717a' }
  return (
    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}>
      {m.label}
    </span>
  )
}

function ItemStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    candidate: { label: 'Candidato',    color: '#00E5FF' },
    pending:   { label: 'Programado',   color: '#a78bfa' },
    started:   { label: 'Participando', color: '#22c55e' },
    finished:  { label: 'Encerrado',    color: '#71717a' },
  }
  const m = map[status] ?? { label: status, color: '#71717a' }
  return (
    <span className="text-[9px] mt-1 inline-block px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}>
      {m.label}
    </span>
  )
}
