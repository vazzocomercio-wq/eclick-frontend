'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Clock, Loader2, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import AccountSelector, { useMlAccount, getStoredSellerId } from '@/components/ml/AccountSelector'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://eclick-backend-production-2a87.up.railway.app'

interface Campaign {
  id:                          string
  ml_campaign_id:              string
  ml_promotion_type:           string
  name:                        string | null
  status:                      string
  deadline_date:               string | null
  finish_date:                 string | null
  has_subsidy_items:           boolean
  candidate_count:             number
  started_count:               number
  seller_id:                   number
}

async function getToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export default function DeadlinesPage() {
  const { selected: selectedSellerId } = useMlAccount()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [daysAhead, setDaysAhead] = useState(7)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const t = await getToken()
      const sid = getStoredSellerId()
      const url = sid != null
        ? `${BACKEND}/ml-campaigns/deadlines?seller_id=${sid}&days_ahead=${daysAhead}`
        : `${BACKEND}/ml-campaigns/deadlines?days_ahead=${daysAhead}`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      if (r.ok) setCampaigns(await r.json())
    } finally {
      setLoading(false)
    }
  }, [daysAhead])

  useEffect(() => { void load() }, [load, selectedSellerId])

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto" style={{ background: 'var(--background)', minHeight: '100vh', color: 'var(--text)' }}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Link href="/dashboard/ml-campaigns" className="hover:text-cyan-400">Campaign Center</Link>
            <span>/</span>
            <span className="text-zinc-300">Encerrando em breve</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Clock size={22} className="text-amber-400" />
            Campanhas encerrando
          </h1>
        </div>
        <AccountSelector compact hideWhenEmpty />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-500">Janela:</span>
        {[1, 3, 7, 14].map(d => (
          <button key={d} onClick={() => setDaysAhead(d)}
            className="px-2.5 py-1 rounded-lg transition-all"
            style={{
              background: daysAhead === d ? 'rgba(0,229,255,0.15)' : '#0c0c10',
              border: `1px solid ${daysAhead === d ? 'rgba(0,229,255,0.4)' : '#1a1a1f'}`,
              color: daysAhead === d ? '#67e8f9' : '#a1a1aa',
            }}>
            {d}d
          </button>
        ))}
      </div>

      {loading && <div className="text-zinc-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}

      {!loading && campaigns.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#0c0c10', border: '1px solid #1a1a1f' }}>
          <Clock size={48} className="mx-auto text-emerald-700 mb-3" />
          <p className="text-zinc-300 font-medium">Nenhuma campanha encerrando em {daysAhead} dia{daysAhead > 1 ? 's' : ''}</p>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="space-y-2">
          {campaigns.map(c => <DeadlineRow key={c.id} campaign={c} />)}
        </div>
      )}
    </div>
  )
}

function DeadlineRow({ campaign }: { campaign: Campaign }) {
  const ms = campaign.deadline_date ? (new Date(campaign.deadline_date).getTime() - Date.now()) : 0
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(h / 24)
  const isUrgent = h < 24
  const color = isUrgent ? '#ef4444' : h < 72 ? '#fbbf24' : '#71717a'
  const label = h < 1 ? '< 1 hora' : h < 24 ? `${h} horas` : `${d} dia${d > 1 ? 's' : ''}`

  return (
    <Link href={`/dashboard/ml-campaigns/${campaign.id}`}
      className="block rounded-lg p-3 transition-all hover:border-cyan-400/30"
      style={{ background: '#0c0c10', border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.25)' : '#1a1a1f'}` }}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 rounded-lg w-14 h-14 flex flex-col items-center justify-center font-bold"
          style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}>
          <span className="text-base leading-none">{h < 1 ? '⚠' : h < 24 ? `${h}h` : `${d}d`}</span>
          <span className="text-[8px] mt-0.5 opacity-70">restantes</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-zinc-200">
            {campaign.name ?? `${campaign.ml_promotion_type} ${campaign.ml_campaign_id}`}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1 flex-wrap">
            <span>{campaign.ml_promotion_type}</span>
            <span>{campaign.candidate_count} candidatos · {campaign.started_count} participando</span>
            {campaign.has_subsidy_items && <span className="text-cyan-400">✦ subsidio</span>}
            <span className="font-mono">seller {campaign.seller_id}</span>
          </div>
        </div>
        <ChevronRight size={14} className="text-zinc-600 flex-shrink-0" />
      </div>
    </Link>
  )
}
