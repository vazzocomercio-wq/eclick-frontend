'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles, Megaphone, ShoppingBag, TrendingUp, Star } from 'lucide-react'
import {
  ProductsAnalyticsApi, type ProductSocialAnalytics,
} from './productsAnalyticsApi'

/** Onda 3 / S6 — Card de analytics social/ads pra embedar em /produtos/[id].
 *
 *  Mostra: peças sociais geradas, sync com canais commerce, performance
 *  de ads (ROAS, gastos, conversões) e bonus components que somariam
 *  ao score original (mostrados como "+" ao lado do número). */
export default function ProductSocialAnalyticsCard({ productId }: { productId: string }) {
  const [data, setData]       = useState<ProductSocialAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true); setError(null)
      try {
        const a = await ProductsAnalyticsApi.getProductAnalytics(productId)
        setData(a)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [productId])

  if (loading) return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 flex items-center gap-2 text-zinc-500 text-sm">
      <Loader2 size={14} className="animate-spin" /> carregando analytics…
    </div>
  )

  if (error) return (
    <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">⚠ {error}</div>
  )

  if (!data) return null

  const noActivity = data.social.total_pieces === 0 && data.ads.total_campaigns === 0 && data.commerce.synced_in_channels.length === 0

  if (noActivity) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-center space-y-2">
        <Sparkles size={20} className="mx-auto text-zinc-600" />
        <p className="text-xs text-zinc-400">Sem atividade social/ads ainda</p>
        <div className="flex items-center justify-center gap-2 text-[11px]">
          <a href="/dashboard/social/generate" className="text-cyan-400 hover:underline">Gerar conteúdo →</a>
          <span className="text-zinc-700">·</span>
          <a href="/dashboard/ads-campaigns/new" className="text-cyan-400 hover:underline">Criar campanha →</a>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-gradient-to-r from-cyan-400/[0.08] to-transparent border-b border-zinc-800 flex items-center gap-2">
        <Star size={14} className="text-cyan-400" />
        <p className="text-xs uppercase tracking-wider text-zinc-200">Analytics social & ads</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Bonus components */}
        <div className="grid grid-cols-2 gap-2">
          <BonusCard
            icon={<Sparkles size={12} className="text-pink-400" />}
            label="Social presence"
            points={data.bonus.social_presence.points}
            max={data.bonus.social_presence.max}
            rationale={data.bonus.social_presence.rationale}
          />
          <BonusCard
            icon={<Megaphone size={12} className="text-cyan-400" />}
            label="Ads performance"
            points={data.bonus.ads_performance.points}
            max={data.bonus.ads_performance.max}
            rationale={data.bonus.ads_performance.rationale}
          />
        </div>

        {/* Social */}
        {data.social.total_pieces > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1">
              <Sparkles size={10} className="text-pink-400" /> Conteúdo social
            </p>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <Stat label="Peças" value={data.social.total_pieces} />
              <Stat label="Publicadas" value={data.social.published_count} />
              <Stat label="Canais" value={Object.keys(data.social.by_channel).length} />
            </div>
            {data.social.last_generated_at && (
              <p className="text-[10px] text-zinc-500 mt-1">
                Última geração: {new Date(data.social.last_generated_at).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        )}

        {/* Commerce sync */}
        {data.commerce.synced_in_channels.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1">
              <ShoppingBag size={10} className="text-amber-400" /> Sincronizado em
            </p>
            <div className="flex flex-wrap gap-1">
              {data.commerce.synced_in_channels.map(ch => (
                <span key={ch} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">
                  {ch}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ads */}
        {data.ads.total_campaigns > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center gap-1">
              <Megaphone size={10} className="text-cyan-400" /> Performance de ads
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <Stat label="Campanhas" value={data.ads.total_campaigns} />
              <Stat label="Ativas" value={data.ads.active_campaigns} accent={data.ads.active_campaigns > 0 ? '#22c55e' : undefined} />
              <Stat label="Gasto" value={`R$ ${data.ads.total_spend_brl.toFixed(2)}`} />
              <Stat
                label="ROAS"
                value={data.ads.roas_avg != null ? `${data.ads.roas_avg.toFixed(2)}×` : '—'}
                accent={data.ads.roas_avg != null && data.ads.roas_avg > 1 ? '#22c55e' : (data.ads.roas_avg != null ? '#ef4444' : undefined)}
              />
              <Stat label="Impressões" value={data.ads.total_impressions.toLocaleString('pt-BR')} />
              <Stat label="Cliques" value={data.ads.total_clicks.toLocaleString('pt-BR')} />
              <Stat label="Conversões" value={data.ads.total_conversions} />
              <Stat label="Receita" value={`R$ ${data.ads.total_revenue_brl.toFixed(2)}`} accent={data.ads.total_revenue_brl > 0 ? '#22c55e' : undefined} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div>
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="text-sm font-medium" style={{ color: accent ?? '#e4e4e7' }}>{value}</p>
    </div>
  )
}

function BonusCard({ icon, label, points, max, rationale }: {
  icon: React.ReactNode; label: string; points: number; max: number; rationale: string
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
          {icon} {label}
        </span>
        <span className="text-[10px] font-mono text-cyan-300">+{points}/{max}</span>
      </div>
      <p className="text-[10px] text-zinc-400 leading-relaxed">{rationale}</p>
    </div>
  )
}
