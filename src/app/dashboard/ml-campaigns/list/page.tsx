'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  Megaphone, Clock, Loader2, ChevronRight, Sparkles, X, ArrowUpDown,
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

interface ListResp { campaigns: Campaign[]; total: number }

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export default function CampaignsListPage() {
  return (
    <Suspense fallback={<div className="p-6 text-zinc-500 text-sm">Carregando…</div>}>
      <Inner />
    </Suspense>
  )
}

function Inner() {
  const sp       = useSearchParams()
  const router   = useRouter()
  const pathname = usePathname()
  const { selected: selectedSellerId } = useMlAccount()

  const status     = sp.get('status')      ?? ''
  const type       = sp.get('type')        ?? ''
  const hasSubsidy = sp.get('has_subsidy') ?? ''

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const updateFilter = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else                        next.set(k, v)
    }
    router.replace(`${pathname}?${next.toString()}`)
  }, [sp, router, pathname])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const params = new URLSearchParams()
      if (sid != null)   params.set('seller_id', String(sid))
      if (status)        params.set('status', status)
      if (type)          params.set('type',   type)
      if (hasSubsidy)    params.set('has_subsidy', hasSubsidy)
      params.set('limit', '200')
      const r = await fetch(`${BACKEND}/ml-campaigns?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`)
      const body = (await r.json()) as ListResp
      setCampaigns(body.campaigns); setTotal(body.total)
    } catch (e) {
      setError((e as Error).message)
      setCampaigns([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [status, type, hasSubsidy])

  useEffect(() => { void load() }, [load, selectedSellerId])

  const hasFilters = !!(status || type || hasSubsidy)

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400 transition-colors">
              Campaign Center
            </Link>
            <span>/</span>
            <span className="text-zinc-300">Campanhas</span>
          </div>
          <h1 className="text-2xl font-bold mt-1">Campanhas</h1>
          <p className="text-xs text-zinc-500 mt-1">
            {loading ? 'Carregando…' : `${total} campanha${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      {/* Filtros */}
      <div className="rounded-xl p-3" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FilterChip label="Status" value={status}
            options={[
              { value: '',         label: 'Todos' },
              { value: 'started',  label: 'Ativas' },
              { value: 'pending',  label: 'Programadas' },
              { value: 'finished', label: 'Encerradas' },
              { value: 'paused',   label: 'Pausadas' },
            ]}
            onChange={v => updateFilter({ status: v || null })}
          />
          <FilterChip label="Tipo" value={type}
            options={[
              { value: '',                     label: 'Todos' },
              { value: 'DEAL',                 label: 'DEAL (campanhas tematicas)' },
              { value: 'SMART',                label: 'SMART (impulsionadas)' },
              { value: 'LIGHTNING',            label: 'LIGHTNING (relampago)' },
              { value: 'PRICE_DISCOUNT',       label: 'PRICE_DISCOUNT (desconto individual)' },
              { value: 'MARKETPLACE_CAMPAIGN', label: 'MARKETPLACE_CAMPAIGN' },
              { value: 'DOD',                  label: 'DOD (do dia)' },
              { value: 'VOLUME',               label: 'VOLUME (por quantidade)' },
            ]}
            onChange={v => updateFilter({ type: v || null })}
          />
          <FilterChip label="Subsidio ML" value={hasSubsidy}
            options={[
              { value: '',     label: 'Todos' },
              { value: 'true', label: 'Com subsidio' },
              { value: 'false',label: 'Sem subsidio' },
            ]}
            onChange={v => updateFilter({ has_subsidy: v || null })}
          />
          {hasFilters && (
            <button onClick={() => router.replace(pathname)}
              className="ml-auto text-zinc-500 hover:text-red-400 transition-colors">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && campaigns.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-zinc-900/50 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <Megaphone size={48} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-300 font-medium">Nenhuma campanha encontrada</p>
          <p className="text-xs text-zinc-500 mt-2">
            {hasFilters ? 'Ajusta os filtros pra ver mais resultados.' : 'Roda um sync no dashboard pra puxar campanhas.'}
          </p>
        </div>
      )}

      {/* Cards */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}
    </div>
  )
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const totalItems = campaign.candidate_count + campaign.pending_count + campaign.started_count
  const deadline = campaign.deadline_date ? deadlineLabel(campaign.deadline_date) : null

  return (
    <Link href={`/dashboard/ml-campaigns/${campaign.id}`}
      className="block rounded-xl p-4 transition-all hover:scale-[1.01]"
      style={{
        background: '#0c0c10',
        border: campaign.has_subsidy_items ? '1px solid rgba(0,229,255,0.3)' : '1px solid #1a1a1f',
      }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <CampaignTypeBadge type={campaign.ml_promotion_type} />
        <StatusBadge status={campaign.status} />
      </div>

      <h3 className="font-semibold text-sm text-zinc-100 line-clamp-2 leading-snug">
        {campaign.name ?? `${campaign.ml_promotion_type} ${campaign.ml_campaign_id}`}
      </h3>

      {/* Subsidy callout */}
      {campaign.has_subsidy_items && campaign.avg_meli_subsidy_pct != null && (
        <div className="mt-2 px-2 py-1 rounded inline-flex items-center gap-1 text-[10px] font-semibold"
          style={{ background: 'rgba(0,229,255,0.1)', color: '#67e8f9', border: '1px solid rgba(0,229,255,0.25)' }}>
          <Sparkles size={10} />
          ML subsidia ~{campaign.avg_meli_subsidy_pct.toFixed(1)}%
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-300">{campaign.items_with_subsidy_count} itens</span>
        </div>
      )}

      {/* Counters */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Counter label="Candidatos"   value={campaign.candidate_count} color="#00E5FF" />
        <Counter label="Programados"  value={campaign.pending_count}   color="#a78bfa" />
        <Counter label="Participando" value={campaign.started_count}   color="#22c55e" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 text-[11px] text-zinc-500"
        style={{ borderTop: '1px solid #1a1a1f' }}>
        {deadline ? (
          <span className="flex items-center gap-1" style={{ color: deadline.color }}>
            <Clock size={10} /> {deadline.label}
          </span>
        ) : (
          <span>{totalItems} itens elegíveis</span>
        )}
        <span className="font-mono">seller {campaign.seller_id}</span>
      </div>
    </Link>
  )
}

function CampaignTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    DEAL:                 { label: 'Tradicional',     color: '#a78bfa' },
    SMART:                { label: 'Smart',           color: '#00E5FF' },
    LIGHTNING:            { label: 'Relâmpago',       color: '#f97316' },
    PRICE_DISCOUNT:       { label: 'Desc. Individual',color: '#22c55e' },
    MARKETPLACE_CAMPAIGN: { label: 'Marketplace',     color: '#fbbf24' },
    DOD:                  { label: 'Do Dia',          color: '#ec4899' },
    VOLUME:               { label: 'Volume',          color: '#84cc16' },
    PRE_NEGOTIATED:       { label: 'Pré-negociada',   color: '#94a3b8' },
    SELLER_CAMPAIGN:      { label: 'Seller',          color: '#94a3b8' },
    PRICE_MATCHING:       { label: 'Preço competitivo', color: '#94a3b8' },
    UNHEALTHY_STOCK:      { label: 'Liquidação',      color: '#ef4444' },
    SELLER_COUPON_CAMPAIGN: { label: 'Cupom',         color: '#94a3b8' },
  }
  const m = map[type] ?? { label: type, color: '#71717a' }
  return (
    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold"
      style={{ background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}40` }}>
      {m.label}
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

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center rounded p-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <p className="text-base font-bold" style={{ color }}>{value}</p>
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function FilterChip({ label, value, options, onChange }: {
  label: string; value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-zinc-500 text-[10px] uppercase tracking-wider">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg px-2 py-1.5 text-xs outline-none cursor-pointer"
        style={{
          background: value ? 'rgba(0,229,255,0.08)' : '#09090b',
          border: `1px solid ${value ? 'rgba(0,229,255,0.3)' : '#1a1a1f'}`,
          color: value ? '#67e8f9' : '#fafafa',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function deadlineLabel(iso: string): { label: string; color: string } {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms < 0)            return { label: 'Prazo expirado', color: '#ef4444' }
  const h = Math.floor(ms / 3_600_000)
  if (h < 1)             return { label: 'Encerra em < 1h', color: '#ef4444' }
  if (h < 24)            return { label: `Encerra em ${h}h`, color: '#ef4444' }
  const d = Math.floor(h / 24)
  if (d <= 2)            return { label: `${d} dia${d > 1 ? 's' : ''} pra aderir`, color: '#fbbf24' }
  return { label: `${d} dias pra aderir`, color: '#71717a' }
}
