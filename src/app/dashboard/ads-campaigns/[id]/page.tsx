'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, RefreshCw, Check, Megaphone, Pause, Play,
  Archive, Send, AlertCircle, Sparkles, Plus, X, BarChart3, Save,
} from 'lucide-react'
import {
  AdsCampaignsApi, type AdsCampaign,
} from '@/components/ads-campaigns/adsCampaignsApi'

const PLATFORM_COLOR: Record<string, string> = {
  meta: '#0866FF', google: '#4285F4', tiktok: '#FF0050', mercado_livre_ads: '#FFE600',
}
const STATUS_COLOR: Record<string, string> = {
  draft: '#71717a', ready: '#00E5FF', publishing: '#a855f7', active: '#22c55e',
  paused: '#f59e0b', completed: '#52525b', error: '#ef4444', archived: '#52525b',
}

export default function AdsCampaignDetail() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [c, setC] = useState<AdsCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  // Regenerate dialog
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenInstr, setRegenInstr] = useState('')
  const [regenBusy, setRegenBusy] = useState(false)

  // Edit destination_url
  const [destUrl, setDestUrl] = useState('')
  const [savingDest, setSavingDest] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await AdsCampaignsApi.get(id)
      setC(data)
      setDestUrl(data.destination_url ?? '')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void refresh() }, [refresh])

  async function action(fn: () => Promise<unknown>) {
    setActing(true); setError(null)
    try {
      await fn()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setActing(false)
    }
  }

  async function regenerate() {
    if (!regenInstr.trim()) return
    setRegenBusy(true)
    try {
      await AdsCampaignsApi.regenerateCopies(id, regenInstr.trim())
      setRegenOpen(false); setRegenInstr('')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRegenBusy(false)
    }
  }

  async function saveDest() {
    if (destUrl === c?.destination_url) return
    setSavingDest(true)
    try {
      await AdsCampaignsApi.update(id, { destination_url: destUrl || null })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingDest(false)
    }
  }

  if (loading) return (
    <div className="p-6 flex items-center gap-2 text-zinc-500 text-sm">
      <Loader2 size={14} className="animate-spin" /> carregando…
    </div>
  )

  if (error || !c) return (
    <div className="p-6 space-y-3">
      <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300 text-sm flex items-center gap-1">
        <ArrowLeft size={14} /> voltar
      </button>
      <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
        ❌ {error ?? 'Campanha não encontrada'}
      </div>
    </div>
  )

  const m = c.metrics as { impressions?: number; clicks?: number; ctr?: number; cpc_brl?: number; spend_brl?: number; conversions?: number; roas?: number; last_sync?: string }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300 text-sm flex items-center gap-1">
        <ArrowLeft size={14} /> voltar
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-4 rounded-sm" style={{ background: PLATFORM_COLOR[c.platform] }} />
            <span className="text-[11px] uppercase tracking-wider text-zinc-400">{c.platform}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] border"
              style={{
                borderColor: `${STATUS_COLOR[c.status]}40`,
                background:  `${STATUS_COLOR[c.status]}10`,
                color:       STATUS_COLOR[c.status],
              }}
            >{c.status}</span>
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-100">{c.name}</h1>
          <p className="text-[11px] text-zinc-500">
            R$ {Number(c.budget_daily_brl).toFixed(2)}/dia · {c.duration_days} dias · objetivo {c.objective}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {c.status === 'draft' && (
            <button
              onClick={() => action(() => AdsCampaignsApi.markReady(id))}
              disabled={acting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
            >
              <Check size={12} /> Marcar pronta
            </button>
          )}
          {c.status === 'ready' && (
            <button
              onClick={() => action(() => AdsCampaignsApi.publish(id))}
              disabled={acting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-black text-xs font-medium"
            >
              <Send size={12} /> Publicar
            </button>
          )}
          {c.status === 'active' && (
            <>
              <button
                onClick={() => action(() => AdsCampaignsApi.pause(id))}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/40 hover:bg-amber-400/10 text-amber-300 text-xs"
              >
                <Pause size={12} /> Pausar
              </button>
              <button
                onClick={() => action(() => AdsCampaignsApi.syncMetrics(id))}
                disabled={acting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-cyan-400/60 text-zinc-300 hover:text-cyan-300 text-xs"
              >
                <BarChart3 size={12} /> Sync métricas
              </button>
            </>
          )}
          {c.status === 'paused' && (
            <button
              onClick={() => action(() => AdsCampaignsApi.resume(id))}
              disabled={acting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-400/40 hover:bg-emerald-400/10 text-emerald-300 text-xs"
            >
              <Play size={12} /> Retomar
            </button>
          )}
          <button
            onClick={() => setRegenOpen(true)}
            disabled={acting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-cyan-400/60 text-zinc-300 hover:text-cyan-300 text-xs"
          >
            <RefreshCw size={12} /> Regenerar copies
          </button>
          <button
            onClick={() => action(() => AdsCampaignsApi.addVariant(id))}
            disabled={acting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-cyan-400/60 text-zinc-300 hover:text-cyan-300 text-xs"
          >
            <Plus size={12} /> Variante
          </button>
          {c.status !== 'archived' && (
            <button
              onClick={() => {
                if (confirm('Arquivar campanha?')) {
                  void action(() => AdsCampaignsApi.archive(id))
                  router.push('/dashboard/ads-campaigns')
                }
              }}
              disabled={acting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-red-400/40 text-zinc-500 hover:text-red-300 text-xs"
            >
              <Archive size={12} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Metrics — só pra active/paused com dados */}
      {(c.status === 'active' || c.status === 'paused' || c.status === 'completed') && Object.keys(m).length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-zinc-400">Métricas (últimos 7 dias)</p>
            {m.last_sync && (
              <p className="text-[10px] text-zinc-500">sync: {new Date(m.last_sync).toLocaleString('pt-BR')}</p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Impressões" value={m.impressions?.toLocaleString('pt-BR') ?? '—'} />
            <Metric label="Cliques" value={m.clicks?.toLocaleString('pt-BR') ?? '—'} />
            <Metric label="Gasto" value={m.spend_brl != null ? `R$ ${m.spend_brl.toFixed(2)}` : '—'} />
            <Metric label="ROAS" value={m.roas != null ? `${m.roas.toFixed(2)}×` : '—'} accent={m.roas && m.roas > 1 ? '#22c55e' : '#ef4444'} />
            <Metric label="CTR" value={m.ctr != null ? `${(m.ctr * 100).toFixed(2)}%` : '—'} />
            <Metric label="CPC" value={m.cpc_brl != null ? `R$ ${m.cpc_brl.toFixed(2)}` : '—'} />
            <Metric label="Conversões" value={m.conversions?.toString() ?? '—'} />
          </div>
        </div>
      )}

      {/* Destination URL */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">URL de destino</p>
        <div className="flex gap-2">
          <input
            value={destUrl}
            onChange={e => setDestUrl(e.target.value)}
            placeholder="https://..."
            disabled={savingDest || c.status === 'active' || c.status === 'publishing'}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 disabled:opacity-60"
          />
          <button
            onClick={saveDest}
            disabled={savingDest || destUrl === (c.destination_url ?? '') || c.status === 'active' || c.status === 'publishing'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
          >
            {savingDest ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          </button>
        </div>
      </div>

      {/* Ad copies */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-zinc-500">Variantes de copy ({c.ad_copies.length})</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {c.ad_copies.map(copy => (
            <div key={copy.variant} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="rounded bg-cyan-400/10 text-cyan-300 px-2 py-0.5 text-[10px] font-mono">var {copy.variant}</span>
                {copy.cta && <span className="text-[10px] text-zinc-500 font-mono">{copy.cta}</span>}
              </div>
              <p className="text-sm font-medium text-zinc-200">{copy.headline}</p>
              <p className="text-[12px] text-zinc-400 leading-relaxed">{copy.primary_text}</p>
              {copy.description && (
                <p className="text-[11px] text-zinc-500 italic">{copy.description}</p>
              )}
              {copy.angle && (
                <p className="text-[10px] text-cyan-300/70 pt-1 border-t border-zinc-800">
                  ↳ ângulo: {copy.angle}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Targeting (collapsed JSON view) */}
      <details className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-200">Segmentação (JSON)</summary>
        <pre className="text-[10px] font-mono text-cyan-200 mt-2 max-h-60 overflow-auto">
          {JSON.stringify(c.targeting, null, 2)}
        </pre>
      </details>

      {/* UTMs */}
      {Object.keys(c.utm_params).length > 0 && (
        <details className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-200">UTM Parameters</summary>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            {Object.entries(c.utm_params).map(([k, v]) => (
              <div key={k}>
                <p className="text-zinc-500">{k}</p>
                <p className="text-zinc-200 font-mono truncate">{v}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Regenerate dialog */}
      {regenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRegenOpen(false)}>
          <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Regenerar copies</h3>
              <button onClick={() => setRegenOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={14} /></button>
            </div>
            <p className="text-xs text-zinc-400">Mantém targeting e budget — só refaz os copies.</p>
            <textarea
              value={regenInstr}
              onChange={e => setRegenInstr(e.target.value)}
              disabled={regenBusy}
              placeholder="Ex: 'foque mais em economia', 'tom mais urgente', 'remove emojis'…"
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 outline-none focus:border-cyan-400/60 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRegenOpen(false)} className="px-3 py-1.5 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs">Cancelar</button>
              <button
                onClick={regenerate}
                disabled={regenBusy || !regenInstr.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black text-xs font-medium"
              >
                {regenBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Regenerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-sm font-medium" style={{ color: accent ?? '#e4e4e7' }}>{value}</p>
    </div>
  )
}
